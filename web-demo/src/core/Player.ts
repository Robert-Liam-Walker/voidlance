import Phaser from 'phaser';
import type { ThemeDef } from '../data/types';
import type { PlayerStats } from '../systems/Economy';
import type { Bullets } from './Bullets';
import { glow } from './ui';
import { hexToNum } from '../util/color';

// Pointer-drag movement + auto-fire, with the Alien-Sky weapon modifiers:
// multishot (extra gun lanes), spread, rapid fire, and shield.
export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  lanes = 1;
  private stats: PlayerStats;
  private bullets: Bullets;
  private fireCd = 0;
  private rapidUntil = 0;
  private spreadUntil = 0;
  private shieldUntil = 0;
  private invulnUntil = 0;
  private minY: number;
  private maxY: number;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private shieldFx?: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, theme: ThemeDef, stats: PlayerStats, bullets: Bullets) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    super(scene, W / 2, H - 170, theme.player.sprite);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.stats = stats;
    this.bullets = bullets;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.setScale(64 / this.width);
    glow(this, hexToNum(theme.player.tint), 5, 10);
    this.setDepth(10);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width * 0.58, this.height * 0.58, true);
    this.setCollideWorldBounds(true);

    this.minY = H * 0.5;
    this.maxY = H - 80;
    this.cursors = scene.input.keyboard?.createCursorKeys();
  }

  tick(time: number, delta: number, pointer: Phaser.Input.Pointer): void {
    const W = this.scene.scale.width;
    const isTouch = this.scene.sys.game.device.input.touch;
    let tx = this.x;
    let ty = this.y;
    if (pointer.active && (!isTouch || pointer.isDown)) {
      tx = pointer.x;
      ty = pointer.y;
    }
    if (this.cursors) {
      const step = 320;
      if (this.cursors.left.isDown) tx = this.x - step;
      if (this.cursors.right.isDown) tx = this.x + step;
      if (this.cursors.up.isDown) ty = this.y - step;
      if (this.cursors.down.isDown) ty = this.y + step;
    }
    tx = Phaser.Math.Clamp(tx, 28, W - 28);
    ty = Phaser.Math.Clamp(ty, this.minY, this.maxY);

    const k = 10;
    const maxS = 1000;
    this.setVelocity(Phaser.Math.Clamp((tx - this.x) * k, -maxS, maxS), Phaser.Math.Clamp((ty - this.y) * k, -maxS, maxS));

    this.fireCd -= delta;
    if (this.fireCd <= 0) {
      this.fire(time);
      this.fireCd = time < this.rapidUntil ? this.stats.fireRateMs * 0.45 : this.stats.fireRateMs;
    }

    this.updateShieldFx(time);
    if (!this.isShielded(time)) {
      this.setAlpha(time < this.invulnUntil ? (Math.floor(time / 80) % 2 === 0 ? 0.3 : 1) : 1);
    } else {
      this.setAlpha(1);
    }
  }

  private fire(time: number): void {
    const vy = -this.stats.bulletSpeed;
    const spacing = 14;
    const x0 = -((this.lanes - 1) * spacing) / 2;
    for (let i = 0; i < this.lanes; i++) {
      this.bullets.fire(this.x + x0 + i * spacing, this.y - 30, 0, vy, 0xffffff, 0.85);
    }
    if (time < this.spreadUntil) {
      this.bullets.fire(this.x, this.y - 20, -160, vy, 0xffffff, 0.7);
      this.bullets.fire(this.x, this.y - 20, 160, vy, 0xffffff, 0.7);
    }
  }

  private updateShieldFx(time: number): void {
    const on = time < this.shieldUntil;
    if (on && !this.shieldFx) {
      this.shieldFx = this.scene.add
        .image(this.x, this.y, 'glow')
        .setTint(0x6affc0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(9)
        .setScale(0.95);
    }
    if (this.shieldFx) {
      if (on) this.shieldFx.setPosition(this.x, this.y).setAlpha(0.35 + 0.18 * Math.sin(time * 0.02));
      else {
        this.shieldFx.destroy();
        this.shieldFx = undefined;
      }
    }
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

  /** @returns true if this hit was fatal. Shield/invuln absorb with no damage. */
  takeHit(time: number): boolean {
    if (this.isInvuln(time)) return false;
    this.hp -= 1;
    this.invulnUntil = time + 1300;
    return this.hp <= 0;
  }
}
