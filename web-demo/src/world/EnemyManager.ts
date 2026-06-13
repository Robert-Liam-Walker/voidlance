import type { ThemeDef, LevelDef, WaveDef, EnemyDef } from '../data/types';
import type { GameData } from '../data/loader';
import type { Entity } from './types';
import { LOGICAL_W as W, LOGICAL_H as H } from '../config';

export type Vec = { x: number; y: number };

// Cross-system actions a behavior needs (implemented by World).
export interface EnemyHost {
  spawnEnemy(def: EnemyDef, x: number, y: number, hp: number): Entity;
  enemyFire(x: number, y: number, vx: number, vy: number): void;
  playerPos(): Vec;
  spawnBarrier(x: number, y: number, hp: number): void;
  compressionBomb(x: number, y: number): void;
  shotgunBomb(x: number, y: number): void;
  emitterLaser(x: number, y: number): void;
  nearestDrop(x: number, y: number): Vec | null;
  stealDropNear(x: number, y: number, r: number): boolean;
  ghost(x: number, y: number, color: number): void;
  onLevelCleared(): void;
}

const between = (a: number, b: number): number => Math.floor(Math.random() * (b - a + 1)) + a;
const backOut = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const quadOut = (t: number): number => 1 - (1 - t) * (1 - t);
const sineInOut = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

// Spawns Alien-Sky formations and runs each enemy's archetype behavior. Ported
// from the Phaser EnemyManager; Phaser tweens (entry / dive / return) are
// reimplemented as manual easing on per-entity progress fields.
export class EnemyManager {
  enemies: Entity[] = [];
  private level!: LevelDef;
  private wave?: WaveDef;
  private waveIndex = 0;
  private loop = 0;
  private diveTimer = 0;
  private swayPhase = 0;
  private transitioning = false;
  private transitionTimer = 0;

  constructor(private data: GameData, private theme: ThemeDef, private host: EnemyHost) {}

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
    const hp = def.hp + Math.floor(this.loop * 0.7); // difficulty scaling per loop
    const totalW = (wave.cols - 1) * wave.spacingX;
    const startX = W / 2 - totalW / 2;

    for (let r = 0; r < wave.rows; r++) {
      for (let c = 0; c < wave.cols; c++) {
        const slotX = startX + c * wave.spacingX;
        const slotY = wave.startY + r * wave.spacingY;
        const e = this.host.spawnEnemy(def, slotX, -50 - r * 32, hp);
        e.slotX = slotX;
        e.slotY = slotY;
        e.row = r;
        e.col = c;
        e.dir = slotX < W / 2 ? 1 : -1;
        e.mode = 'enter';
        e.fromX = slotX;
        e.fromY = -50 - r * 32;
        e.enterDelay = (r * wave.cols + c) * wave.entryStaggerMs;
        e.enterT = 0;
        e.enterDur = 600;
        e.fireCd = between(900, 2800);
        e.actCd = between(1400, 2800);
        this.enemies.push(e);
      }
    }
  }

  update(dtMs: number): void {
    const wave = this.wave;
    if (!wave) return;
    const dt = dtMs / 1000;
    this.swayPhase += dtMs * 0.0014;
    const offsetX = Math.sin(this.swayPhase) * 24;
    const bob = Math.cos(this.swayPhase * 0.8) * 6;
    const player = this.host.playerPos();

    for (const e of this.enemies) {
      if (!e.alive) continue;
      switch (e.mode) {
        case 'enter':
          this.tickEnter(e, dtMs);
          break;
        case 'dive':
          this.tickDive(e, dtMs);
          break;
        case 'return':
          this.tickReturn(e, dtMs);
          break;
        default:
          this.behave(e, dt, dtMs, player, offsetX, bob);
      }
    }

    this.diveTimer -= dtMs;
    if (this.diveTimer <= 0) {
      this.diveTimer = (wave.diveIntervalMs ?? 1300) / (1 + this.loop * 0.15);
      this.startDive();
    }

    this.enemies = this.enemies.filter((e) => e.alive);

    if (this.transitioning) {
      this.transitionTimer -= dtMs;
      if (this.transitionTimer <= 0) this.advanceWave();
    } else if (this.activeCount() === 0) {
      this.transitioning = true;
      this.transitionTimer = 650;
    }
  }

  private advanceWave(): void {
    if (this.waveIndex + 1 < this.level.waves.length) {
      this.transitioning = false;
      this.spawnWave(this.waveIndex + 1);
    } else {
      this.host.onLevelCleared();
    }
  }

  private setVel(e: Entity, nx: number, ny: number, dt: number): void {
    e.vx = (nx - e.x) / dt;
    e.vy = (ny - e.y) / dt;
    e.x = nx;
    e.y = ny;
  }

  private tickEnter(e: Entity, dtMs: number): void {
    if (e.enterDelay > 0) {
      e.enterDelay -= dtMs;
      return;
    }
    e.enterT = Math.min(1, e.enterT + dtMs / e.enterDur);
    const k = backOut(e.enterT);
    const ny = e.fromY + (e.slotY - e.fromY) * k;
    this.setVel(e, e.slotX, ny, dtMs / 1000);
    if (e.enterT >= 1) e.mode = e.def?.behavior === 'fighter' ? 'formation' : 'active';
  }

  private tickDive(e: Entity, dtMs: number): void {
    e.diveT = Math.min(1, e.diveT + dtMs / e.diveDur);
    const t = sineInOut(e.diveT);
    const u = 1 - t;
    const nx = u * u * e.fromX + 2 * u * t * e.dcx + t * t * e.dex;
    const ny = u * u * e.fromY + 2 * u * t * e.dcy + t * t * e.dey;
    this.setVel(e, nx, ny, dtMs / 1000);
    if (Math.random() < 0.02) this.host.enemyFire(e.x, e.y + 14, ...this.aimAtPlayer(e));
    if (e.diveT >= 1) {
      e.mode = 'return';
      e.fromX = e.slotX;
      e.fromY = -40;
      e.x = e.slotX;
      e.y = -40;
      e.enterT = 0;
    }
  }

  private tickReturn(e: Entity, dtMs: number): void {
    e.enterT = Math.min(1, e.enterT + dtMs / 700);
    const k = quadOut(e.enterT);
    const ny = e.fromY + (e.slotY - e.fromY) * k;
    this.setVel(e, e.slotX, ny, dtMs / 1000);
    if (e.enterT >= 1) e.mode = 'formation';
  }

  private behave(e: Entity, dt: number, dtMs: number, player: Vec, offsetX: number, bob: number): void {
    const def = e.def!;
    switch (def.behavior) {
      case 'fighter':
        if (e.mode === 'formation') this.setVel(e, e.slotX + offsetX, e.slotY + bob, dt);
        this.maybeFire(e, dtMs);
        break;
      case 'smasher': // kamikaze straight-down dive
        this.setVel(e, e.x + Math.sin(e.y * 0.02) * 0.7, e.y + def.speed * dt, dt);
        if (e.y > H + 50) this.kill(e);
        break;
      case 'builder':
        this.setVel(e, e.slotX + offsetX, e.slotY + bob, dt);
        e.actCd -= dtMs;
        if (e.actCd <= 0) {
          e.actCd = 3400;
          this.host.spawnBarrier(e.x, e.slotY + 48, 3 + Math.floor(this.loop * 0.5));
        }
        break;
      case 'transport': // crosses the screen; guaranteed drop on kill
        this.setVel(e, e.x + e.dir * def.speed * dt, e.slotY + bob * 0.5, dt);
        this.maybeFire(e, dtMs);
        if (e.x < -60 || e.x > W + 60) this.kill(e);
        break;
      case 'demolisher':
        this.sidle(e, dt, bob);
        e.actCd -= dtMs;
        if (e.actCd <= 0) {
          e.actCd = 2600;
          this.host.compressionBomb(e.x, e.y + 20);
        }
        break;
      case 'razer':
        this.sidle(e, dt, bob);
        e.actCd -= dtMs;
        if (e.actCd <= 0) {
          e.actCd = 2800;
          this.host.shotgunBomb(e.x, e.y + 20);
        }
        break;
      case 'emitter':
        this.sidle(e, dt, bob);
        e.actCd -= dtMs;
        if (e.actCd <= 0) {
          e.actCd = 3200;
          this.host.emitterLaser(e.x, e.y + 24);
        }
        break;
      case 'phantom':
        this.phantom(e, dt, player);
        break;
      case 'interceptor': {
        const d = this.host.nearestDrop(e.x, e.y);
        if (d) {
          const ang = Math.atan2(d.y - e.y, d.x - e.x);
          this.setVel(e, e.x + Math.cos(ang) * def.speed * dt, e.y + Math.sin(ang) * def.speed * dt, dt);
          this.host.stealDropNear(e.x, e.y, 34);
        } else {
          this.setVel(e, e.slotX + offsetX, e.slotY + bob, dt);
        }
        this.maybeFire(e, dtMs);
        break;
      }
    }
  }

  private sidle(e: Entity, dt: number, bob: number): void {
    let nx = e.x + e.dir * e.def!.speed * dt;
    if (nx < 90) {
      nx = 90;
      e.dir = 1;
    } else if (nx > W - 90) {
      nx = W - 90;
      e.dir = -1;
    }
    this.setVel(e, nx, e.slotY + bob * 0.5, dt);
  }

  private phantom(e: Entity, dt: number, player: Vec): void {
    const def = e.def!;
    const midY = H * 0.42;
    if (e.phase === 0) {
      const ang = Math.atan2(midY - e.y, player.x - e.x);
      this.setVel(e, e.x + Math.cos(ang) * def.speed * dt, e.y + Math.sin(ang) * def.speed * dt, dt);
      if (e.y >= midY - 6) e.phase = 1;
    } else if (e.phase === 1) {
      if (!e.didAct) {
        e.didAct = true;
        this.phantomVolley(e, player);
      }
      e.phase = 2;
    } else {
      this.setVel(e, e.x, e.y - def.speed * 0.8 * dt, dt);
      if (e.y < -50) this.kill(e);
    }
  }

  private phantomVolley(e: Entity, player: Vec): void {
    const sp = e.def!.bulletSpeed ?? 240;
    const base = Math.atan2(player.y - e.y, player.x - e.x);
    for (let i = -2; i <= 2; i++) {
      const ang = base + i * 0.22;
      this.host.enemyFire(e.x, e.y + 12, Math.cos(ang) * sp, Math.max(60, Math.sin(ang) * sp));
    }
    this.host.ghost(e.x - 46, e.y, e.color);
    this.host.ghost(e.x + 46, e.y, e.color);
  }

  private maybeFire(e: Entity, dtMs: number): void {
    e.fireCd -= dtMs;
    if (e.fireCd <= 0) {
      e.fireCd = between(1300, 3000);
      if (Math.random() < (e.def!.fireChance ?? 0)) this.host.enemyFire(e.x, e.y + 14, ...this.aimAtPlayer(e));
    }
  }

  private aimAtPlayer(e: Entity): [number, number] {
    const player = this.host.playerPos();
    const sp = e.def!.bulletSpeed ?? 240;
    const ang = Math.atan2(player.y - e.y, player.x - e.x);
    return [Math.cos(ang) * sp, Math.max(70, Math.sin(ang) * sp)];
  }

  private startDive(): void {
    const cands = this.enemies.filter((e) => e.alive && e.mode === 'formation' && e.def?.behavior === 'fighter');
    if (cands.length === 0) return;
    const e = cands[between(0, cands.length - 1)];
    const player = this.host.playerPos();
    e.mode = 'dive';
    e.fromX = e.x;
    e.fromY = e.y;
    e.dcx = Math.max(30, Math.min(W - 30, player.x + between(-90, 90)));
    e.dcy = H * 0.5;
    e.dex = Math.max(10, Math.min(W - 10, player.x + between(-160, 160)));
    e.dey = H + 90;
    e.diveT = 0;
    e.diveDur = 1500 / (1 + this.loop * 0.12);
  }

  activeCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  activeEnemies(): Entity[] {
    return this.enemies.filter((e) => e.alive);
  }

  kill(e: Entity): void {
    e.alive = false;
  }

  clearAll(): void {
    for (const e of this.enemies) e.alive = false;
    this.enemies = [];
    this.wave = undefined;
  }
}
