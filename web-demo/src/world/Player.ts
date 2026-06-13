import type { ThemeDef } from '../data/types';
import type { PlayerStats } from '../systems/Economy';
import type { Entity } from './types';
import { LOGICAL_W as W, LOGICAL_H as H } from '../config';
import { clamp } from '../app/mathx';
import { hexToNum } from '../util/color';

export type SpawnBullet = (x: number, y: number, bvx: number, bvy: number) => void;

// Player ship logic ported from the original Phaser Player: pointer/keyboard
// drag movement, auto-fire with gun lanes + spread, and timed power-ups
// (rapid / spread / shield) + invulnerability frames. Operates on its Entity.
export class Player {
  hp: number;
  maxHp: number;
  lanes = 1;
  private fireCd = 0;
  private rapidUntil = 0;
  private spreadUntil = 0;
  private shieldUntil = 0;
  private invulnUntil = 0;
  private bulletTint: number;

  constructor(public e: Entity, theme: ThemeDef, private stats: PlayerStats) {
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.bulletTint = hexToNum(theme.player.bulletTint);
    e.radius = 28;
    e.scale = 64;
    e.color = hexToNum(theme.player.tint);
  }

  move(dtMs: number, tx: number, ty: number): void {
    const dt = dtMs / 1000;
    const e = this.e;
    const px = e.x;
    const py = e.y;
    const k = 10;
    const maxS = 1000;
    const vx = clamp((tx - e.x) * k, -maxS, maxS);
    const vy = clamp((ty - e.y) * k, -maxS, maxS);
    e.x = clamp(e.x + vx * dt, 28, W - 28);
    e.y = clamp(e.y + vy * dt, H * 0.5, H - 80);
    e.vx = (e.x - px) / dt; // achieved (zero at walls -> bank levels off)
    e.vy = (e.y - py) / dt;
  }

  tickFire(dtMs: number, time: number, spawn: SpawnBullet): void {
    this.fireCd -= dtMs;
    if (this.fireCd > 0) return;
    this.fire(time, spawn);
    this.fireCd = time < this.rapidUntil ? this.stats.fireRateMs * 0.45 : this.stats.fireRateMs;
  }

  private fire(time: number, spawn: SpawnBullet): void {
    const vy = -this.stats.bulletSpeed;
    const spacing = 14;
    const x0 = -((this.lanes - 1) * spacing) / 2;
    for (let i = 0; i < this.lanes; i++) spawn(this.e.x + x0 + i * spacing, this.e.y - 30, 0, vy);
    if (time < this.spreadUntil) {
      spawn(this.e.x, this.e.y - 20, -160, vy);
      spawn(this.e.x, this.e.y - 20, 160, vy);
    }
  }

  get bulletColor(): number {
    return this.bulletTint;
  }
  get damage(): number {
    return this.stats.bulletDamage;
  }
  addLane(): void {
    this.lanes = Math.min(4, this.lanes + 1);
  }
  applyRapid(durationMs: number, time: number): void {
    this.rapidUntil = time + durationMs;
  }
  applySpread(durationMs: number, time: number): void {
    this.spreadUntil = time + durationMs;
  }
  applyShield(durationMs: number, time: number): void {
    this.shieldUntil = time + durationMs;
  }
  isShielded(time: number): boolean {
    return time < this.shieldUntil;
  }
  isInvuln(time: number): boolean {
    return time < this.invulnUntil || time < this.shieldUntil;
  }

  /** @returns true if fatal. Shield/invuln absorb with no damage. */
  takeHit(time: number): boolean {
    if (this.isInvuln(time)) return false;
    this.hp -= 1;
    this.invulnUntil = time + 1300;
    return this.hp <= 0;
  }
}
