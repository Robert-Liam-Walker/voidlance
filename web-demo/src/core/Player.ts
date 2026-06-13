import Phaser from 'phaser';
import type { ThemeDef } from '../data/types';
import type { PlayerStats } from '../systems/Economy';
import type { Bullets } from './Bullets';
import { glow } from './ui';
import { hexToNum } from '../util/color';

// Pointer-drag movement (thumb) + auto-fire — the mobile-standard control scheme.
export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  private stats: PlayerStats;
  private bullets: Bullets;
  private bulletTint: number;
  private fireCd = 0;
  private rapidUntil = 0;
  private invulnUntil = 0;
  private minY: number;
  private maxY: number;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, theme: ThemeDef, stats: PlayerStats, bullets: Bullets) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    super(scene, W / 2, H - 160, theme.player.shape === 'wasp' ? 'ship-wasp' : 'ship-arrow');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.stats = stats;
    this.bullets = bullets;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.bulletTint = hexToNum(theme.player.bulletTint);
    this.setTint(hexToNum(theme.player.tint));
    glow(this, hexToNum(theme.player.tint), 4, 8);
    this.setDepth(10);
    this.setDisplaySize(46, 50);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width * 0.5, this.height * 0.5, true);
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
    this.setVelocity(
      Phaser.Math.Clamp((tx - this.x) * k, -maxS, maxS),
      Phaser.Math.Clamp((ty - this.y) * k, -maxS, maxS)
    );

    this.fireCd -= delta;
    if (this.fireCd <= 0) {
      this.fire(time);
      this.fireCd = this.currentFireRate(time);
    }

    this.setAlpha(time < this.invulnUntil ? (Math.floor(time / 80) % 2 === 0 ? 0.3 : 1) : 1);
  }

  private currentFireRate(time: number): number {
    return time < this.rapidUntil ? this.stats.fireRateMs * 0.45 : this.stats.fireRateMs;
  }

  private fire(time: number): void {
    const vy = -this.stats.bulletSpeed;
    this.bullets.fire(this.x, this.y - 24, 0, vy, this.bulletTint, 1.1);
    if (time < this.rapidUntil) {
      this.bullets.fire(this.x - 13, this.y - 14, -60, vy, this.bulletTint, 0.9);
      this.bullets.fire(this.x + 13, this.y - 14, 60, vy, this.bulletTint, 0.9);
    }
  }

  get damage(): number {
    return this.stats.bulletDamage;
  }

  applyRapid(durationMs: number, time: number): void {
    this.rapidUntil = time + durationMs;
  }

  isInvuln(time: number): boolean {
    return time < this.invulnUntil;
  }

  /** @returns true if this hit was fatal. */
  takeHit(time: number): boolean {
    if (this.isInvuln(time)) return false;
    this.hp -= 1;
    this.invulnUntil = time + 1300;
    return this.hp <= 0;
  }
}
