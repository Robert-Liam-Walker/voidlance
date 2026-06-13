import Phaser from 'phaser';
import type { ThemeDef, LevelDef, WaveDef } from '../data/types';
import type { GameData } from '../data/loader';
import { Enemy } from './Enemy';
import type { Bullets } from './Bullets';

type Vec = { x: number; y: number };

// Cross-system actions a behavior needs (implemented by GameScene).
export interface EnemyHooks {
  player: () => Vec;
  spawnBarrier: (x: number, y: number, hp: number) => void;
  compressionBomb: (x: number, y: number) => void;
  shotgunBomb: (x: number, y: number) => void;
  emitterLaser: (x: number, y: number) => void;
  nearestDrop: (x: number, y: number) => Vec | null;
  stealDropNear: (x: number, y: number, r: number) => boolean;
}

// Spawns Alien-Sky-style formations and runs each enemy's archetype behavior.
export class EnemyManager {
  group: Phaser.Physics.Arcade.Group;
  private enemies: Enemy[] = [];
  private level!: LevelDef;
  private wave?: WaveDef;
  private waveIndex = 0;
  private loop = 0;
  private diveTimer = 0;
  private swayPhase = 0;
  private transitioning = false;
  private readonly W: number;
  private readonly H: number;

  constructor(
    private scene: Phaser.Scene,
    private data: GameData,
    private theme: ThemeDef,
    private enemyBullets: Bullets,
    private hooks: EnemyHooks,
    private onLevelCleared: () => void
  ) {
    this.group = scene.physics.add.group();
    this.W = scene.scale.width;
    this.H = scene.scale.height;
  }

  startLevel(level: LevelDef, loop: number): void {
    this.level = level;
    this.loop = loop;
    this.transitioning = false;
    this.spawnWave(0);
  }

  private spawnWave(index: number): void {
    this.waveIndex = index;
    const wave = this.level.waves[index];
    this.wave = wave;
    this.diveTimer = wave.diveIntervalMs ?? 1300;
    const def = this.data.enemyForWave(this.theme, wave);
    const tex = def.sprite;
    const hp = def.hp + Math.floor(this.loop * 0.7); // difficulty scaling per loop
    const totalW = (wave.cols - 1) * wave.spacingX;
    const startX = this.W / 2 - totalW / 2;

    for (let r = 0; r < wave.rows; r++) {
      for (let c = 0; c < wave.cols; c++) {
        const slotX = startX + c * wave.spacingX;
        const slotY = wave.startY + r * wave.spacingY;
        const e = new Enemy(this.scene, slotX, -50 - r * 32, def, tex, hp);
        e.slotX = slotX;
        e.slotY = slotY;
        e.row = r;
        e.col = c;
        e.mode = 'enter';
        e.dir = slotX < this.W / 2 ? 1 : -1;
        this.group.add(e);
        this.enemies.push(e);
        this.scene.tweens.add({
          targets: e,
          x: slotX,
          y: slotY,
          delay: (r * wave.cols + c) * wave.entryStaggerMs,
          duration: 600,
          ease: 'Back.Out',
          onComplete: () => {
            if (e.active && e.mode === 'enter') e.mode = def.behavior === 'fighter' ? 'formation' : 'active';
          },
        });
      }
    }
  }

  update(_time: number, delta: number): void {
    const wave = this.wave;
    if (!wave) return;
    this.swayPhase += delta * 0.0014;
    const offsetX = Math.sin(this.swayPhase) * 24;
    const bob = Math.cos(this.swayPhase * 0.8) * 6;
    const player = this.hooks.player();
    const dt = delta / 1000;

    for (const e of this.enemies) {
      if (!e.active || e.mode === 'enter') continue;
      this.behave(e, dt, delta, player, offsetX, bob);
    }

    this.diveTimer -= delta;
    if (this.diveTimer <= 0) {
      this.diveTimer = (wave.diveIntervalMs ?? 1300) / (1 + this.loop * 0.15);
      this.startDive();
    }

    if (!this.transitioning && this.activeCount() === 0) {
      this.transitioning = true;
      this.scene.time.delayedCall(650, () => {
        if (this.waveIndex + 1 < this.level.waves.length) {
          this.transitioning = false;
          this.spawnWave(this.waveIndex + 1);
        } else {
          this.onLevelCleared();
        }
      });
    }
  }

  private behave(e: Enemy, dt: number, delta: number, player: Vec, offsetX: number, bob: number): void {
    switch (e.def.behavior) {
      case 'fighter':
        if (e.mode === 'formation') {
          e.x = e.slotX + offsetX;
          e.y = e.slotY + bob;
        }
        this.maybeFire(e, delta, player);
        break;
      case 'smasher': // kamikaze straight-down dive
        e.y += e.def.speed * dt;
        e.x += Math.sin(e.y * 0.02) * 0.7;
        if (e.y > this.H + 50) this.removeEnemy(e);
        break;
      case 'builder':
        e.x = e.slotX + offsetX;
        e.y = e.slotY + bob;
        e.actCd -= delta;
        if (e.actCd <= 0) {
          e.actCd = 3400;
          this.hooks.spawnBarrier(e.x, e.slotY + 48, 3 + Math.floor(this.loop * 0.5));
        }
        break;
      case 'transport': // crosses the screen; guaranteed drop on kill
        e.x += e.dir * e.def.speed * dt;
        e.y = e.slotY + bob * 0.5;
        this.maybeFire(e, delta, player);
        if (e.x < -60 || e.x > this.W + 60) this.removeEnemy(e);
        break;
      case 'demolisher':
        this.sidle(e, dt, bob);
        e.actCd -= delta;
        if (e.actCd <= 0) {
          e.actCd = 2600;
          this.hooks.compressionBomb(e.x, e.y + 20);
        }
        break;
      case 'razer':
        this.sidle(e, dt, bob);
        e.actCd -= delta;
        if (e.actCd <= 0) {
          e.actCd = 2800;
          this.hooks.shotgunBomb(e.x, e.y + 20);
        }
        break;
      case 'emitter':
        this.sidle(e, dt, bob);
        e.actCd -= delta;
        if (e.actCd <= 0) {
          e.actCd = 3200;
          this.hooks.emitterLaser(e.x, e.y + 24);
        }
        break;
      case 'phantom':
        this.phantom(e, dt, player);
        break;
      case 'interceptor': {
        const d = this.hooks.nearestDrop(e.x, e.y);
        if (d) {
          const ang = Math.atan2(d.y - e.y, d.x - e.x);
          e.x += Math.cos(ang) * e.def.speed * dt;
          e.y += Math.sin(ang) * e.def.speed * dt;
          this.hooks.stealDropNear(e.x, e.y, 34);
        } else {
          e.x = e.slotX + offsetX;
          e.y = e.slotY + bob;
        }
        this.maybeFire(e, delta, player);
        break;
      }
    }
  }

  private sidle(e: Enemy, dt: number, bob: number): void {
    e.x += e.dir * e.def.speed * dt;
    if (e.x < 90) {
      e.x = 90;
      e.dir = 1;
    } else if (e.x > this.W - 90) {
      e.x = this.W - 90;
      e.dir = -1;
    }
    e.y = e.slotY + bob * 0.5;
  }

  private phantom(e: Enemy, dt: number, player: Vec): void {
    const midY = this.H * 0.42;
    if (e.phase === 0) {
      const ang = Math.atan2(midY - e.y, player.x - e.x);
      e.x += Math.cos(ang) * e.def.speed * dt;
      e.y += Math.sin(ang) * e.def.speed * dt;
      if (e.y >= midY - 6) e.phase = 1;
    } else if (e.phase === 1) {
      if (!e.didAct) {
        e.didAct = true;
        this.phantomVolley(e, player);
      }
      e.phase = 2;
    } else {
      e.y -= e.def.speed * 0.8 * dt;
      if (e.y < -50) this.removeEnemy(e);
    }
  }

  private phantomVolley(e: Enemy, player: Vec): void {
    const sp = e.def.bulletSpeed ?? 240;
    const base = Math.atan2(player.y - e.y, player.x - e.x);
    for (let i = -2; i <= 2; i++) {
      const ang = base + i * 0.22;
      this.enemyBullets.fire(e.x, e.y + 12, Math.cos(ang) * sp, Math.max(60, Math.sin(ang) * sp), 0xffffff, 0.7);
    }
    for (const dx of [-46, 46]) {
      const clone = this.scene.add.image(e.x + dx, e.y, e.texture.key).setScale(e.scaleX).setAlpha(0.55).setDepth(7);
      this.scene.tweens.add({ targets: clone, alpha: 0, y: clone.y + 28, duration: 600, onComplete: () => clone.destroy() });
    }
  }

  private maybeFire(e: Enemy, delta: number, player: Vec): void {
    e.fireCd -= delta;
    if (e.fireCd <= 0) {
      e.fireCd = Phaser.Math.Between(1300, 3000);
      if (Math.random() < (e.def.fireChance ?? 0)) this.enemyFire(e, player);
    }
  }

  private enemyFire(e: Enemy, player: Vec): void {
    const sp = e.def.bulletSpeed ?? 240;
    const ang = Math.atan2(player.y - e.y, player.x - e.x);
    this.enemyBullets.fire(e.x, e.y + 14, Math.cos(ang) * sp, Math.max(70, Math.sin(ang) * sp), 0xffffff, 0.7);
  }

  private startDive(): void {
    const cands = this.enemies.filter((e) => e.active && e.mode === 'formation' && e.def.behavior === 'fighter');
    if (cands.length === 0) return;
    const e = Phaser.Utils.Array.GetRandom<Enemy>(cands);
    e.mode = 'dive';
    const player = this.hooks.player();
    const sx = e.x;
    const sy = e.y;
    const cx = Phaser.Math.Clamp(player.x + Phaser.Math.Between(-90, 90), 30, this.W - 30);
    const cy = this.H * 0.5;
    const ex = Phaser.Math.Clamp(player.x + Phaser.Math.Between(-160, 160), 10, this.W - 10);
    const ey = this.H + 90;
    const prog = { t: 0 };
    e.diveTween = this.scene.tweens.add({
      targets: prog,
      t: 1,
      duration: 1500 / (1 + this.loop * 0.12),
      ease: 'Sine.InOut',
      onUpdate: () => {
        if (!e.active) return;
        const t = prog.t;
        const u = 1 - t;
        e.x = u * u * sx + 2 * u * t * cx + t * t * ex;
        e.y = u * u * sy + 2 * u * t * cy + t * t * ey;
        e.setRotation(Math.sin(t * Math.PI) * 0.3);
        if (Math.random() < 0.02) this.enemyFire(e, this.hooks.player());
      },
      onComplete: () => {
        e.diveTween = undefined;
        if (!e.active) return;
        e.setRotation(0);
        e.x = e.slotX;
        e.y = -40;
        e.mode = 'return';
        this.scene.tweens.add({
          targets: e,
          x: e.slotX,
          y: e.slotY,
          duration: 700,
          ease: 'Quad.Out',
          onComplete: () => {
            if (e.active && e.mode === 'return') e.mode = 'formation';
          },
        });
      },
    });
  }

  activeCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.active) n++;
    return n;
  }

  /** Active enemies (for screen-clear effects like Nuke). */
  activeEnemies(): Enemy[] {
    return this.enemies.filter((e) => e.active);
  }

  killEnemy(e: Enemy): void {
    this.removeEnemy(e);
  }

  private removeEnemy(e: Enemy): void {
    if (e.diveTween) {
      e.diveTween.stop();
      e.diveTween = undefined;
    }
    e.setActive(false).setVisible(false);
    const body = e.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.enemies = this.enemies.filter((x) => x !== e);
    this.scene.time.delayedCall(10, () => e.destroy());
  }

  clearAll(): void {
    for (const e of this.enemies) {
      if (e.diveTween) e.diveTween.stop();
      e.destroy();
    }
    this.enemies = [];
    this.wave = undefined;
  }
}
