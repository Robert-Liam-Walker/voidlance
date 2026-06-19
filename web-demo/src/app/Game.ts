import type { GameData } from '../data/loader';
import type { ThemeDef } from '../data/types';
import type { Economy } from '../systems/Economy';
import { World } from '../world/World';
import type { RunResult } from '../world/World';
import { Renderer } from '../render/Renderer';
import { Input } from './input';
import { injectStyles, buildMenu, buildGameOver, Hud } from '../ui/ui';
import type { MenuHandle } from '../ui/ui';
import type { Audio } from '../audio';
import { WorldAudio } from '../audio';

type State = 'menu' | 'playing' | 'over';

// Top-level controller: owns the Renderer + Input (created once), runs the rAF
// loop, and switches between the DOM menu, an active run (World), and game-over.
export class Game {
  readonly renderer: Renderer;
  private input: Input;
  private screenHost: HTMLElement; // menus / game-over (interactive)
  private hudHost: HTMLElement; // in-game HUD (pass-through)
  world: World | null = null;
  private worldAudio: WorldAudio | null = null;
  private hud: Hud | null = null;
  private menu: MenuHandle | null = null;
  private overlay: MenuHandle | null = null;
  private state: State = 'menu';
  private debugLvl: number;
  private debugBoss: string | null;
  private last = 0;

  frames = 0;
  fpsAvg = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(mount: HTMLElement, private data: GameData, private theme: ThemeDef, private economy: Economy, private audio: Audio) {
    injectStyles(theme);
    this.renderer = new Renderer(mount, theme);
    this.input = new Input(this.renderer.domElement);
    this.screenHost = layer(mount, true);
    this.hudHost = layer(mount, false);

    // Menu / game-over UI is built inside src/ui (off-limits to edit), so hook
    // its buttons via a delegated capture-phase listener instead. Any .vl-btn
    // click = a UI blip; an affordable hangar upgrade (.small, not maxed/cant)
    // = the purchase flourish (mirrors the buy path in ui.ts).
    this.screenHost.addEventListener(
      'click',
      (e) => {
        const btn = (e.target as HTMLElement | null)?.closest('.vl-btn');
        if (!btn) return;
        if (btn.classList.contains('small') && !btn.classList.contains('maxed') && !btn.classList.contains('cant')) {
          this.audio.purchase();
        } else {
          this.audio.uiClick();
        }
      },
      true
    );

    const params = new URLSearchParams(location.search);
    const lvl = parseInt(params.get('lvl') ?? '', 10);
    this.debugLvl = Number.isFinite(lvl) ? Math.max(0, Math.min(lvl, theme.levelIds.length - 1)) : -1;
    this.debugBoss = params.get('boss');
  }

  start(): void {
    this.last = performance.now();
    if (this.debugBoss) {
      this.startRun(this.debugLvl >= 0 ? this.debugLvl : 0);
      this.world?.debugSpawnBoss(this.debugBoss);
    } else if (this.debugLvl >= 0) {
      this.startRun(this.debugLvl);
    } else {
      this.showMenu();
    }
    requestAnimationFrame(this.loop);
  }

  private showMenu(): void {
    this.clearRun();
    this.state = 'menu';
    this.overlay?.destroy();
    this.overlay = null;
    this.screenHost.style.pointerEvents = 'auto';
    this.menu = buildMenu(this.screenHost, this.theme, this.economy, () => this.startRun(0));
  }

  private startRun(lvl: number): void {
    this.menu?.destroy();
    this.menu = null;
    this.overlay?.destroy();
    this.overlay = null;
    this.renderer.reset();
    this.screenHost.style.pointerEvents = 'none';
    this.world = new World(this.theme, this.economy.stats(this.theme), this.data, this.economy, (r) => this.showGameOver(r), lvl);
    this.worldAudio = new WorldAudio(this.audio, this.world);
    this.hud = new Hud(this.hudHost);
    this.state = 'playing';
  }

  private showGameOver(r: RunResult): void {
    this.hud?.destroy();
    this.hud = null;
    this.state = 'over';
    this.screenHost.style.pointerEvents = 'auto';
    const retryAt = this.debugLvl >= 0 ? this.debugLvl : 0;
    this.overlay = buildGameOver(this.screenHost, this.theme, r, () => this.startRun(retryAt), () => this.showMenu());
  }

  private clearRun(): void {
    this.hud?.destroy();
    this.hud = null;
    this.world = null;
    this.worldAudio = null;
    this.renderer.reset();
  }

  private loop = (t: number): void => {
    requestAnimationFrame(this.loop);
    let dt = t - this.last;
    this.last = t;
    if (dt > 50) dt = 50;
    if (dt > 0) this.sampleFps(dt);

    if (this.state === 'playing' && this.world) {
      const p = this.input.pointer;
      if (p.active) {
        const g = this.renderer.pointerToLogical(p.ndcX, p.ndcY);
        if (g) this.world.setTarget(g.x, g.y);
      }
      const k = this.input.keyVector();
      if (k.x !== 0 || k.y !== 0) this.world.nudgeTarget(k.x, k.y);

      this.world.tick(dt, t);
      this.worldAudio?.sample(this.world);
      this.renderer.syncWorld(this.world, dt);
      this.hud?.update({
        score: this.world.score,
        coins: this.world.runCoins,
        hp: this.world.hp,
        maxHp: this.world.maxHp,
        combo: this.world.combo,
        weapon: this.world.weaponText,
        level: this.world.levelName,
        bossHp: this.world.bossHp,
        bossName: this.world.bossName,
      });
    }
    this.renderer.frame(dt);
  };

  private sampleFps(dt: number): void {
    this.frames++;
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 500) {
      this.fpsAvg = Math.round((this.fpsFrames * 1000) / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
  }
}

function layer(mount: HTMLElement, interactive: boolean): HTMLElement {
  const el = document.createElement('div');
  Object.assign(el.style, { position: 'absolute', inset: '0', pointerEvents: interactive ? 'auto' : 'none' } as Partial<CSSStyleDeclaration>);
  mount.appendChild(el);
  return el;
}
