import Phaser from 'phaser';
import { services } from '../services';
import { Starfield } from '../core/Starfield';
import { Bullets } from '../core/Bullets';
import { Player } from '../core/Player';
import { EnemyManager } from '../core/EnemyManager';
import { Enemy } from '../core/Enemy';
import { burst, shake, popText } from '../core/Juice';
import { hexToNum } from '../util/color';
import type { ThemeDef, LevelDef } from '../data/types';

export class GameScene extends Phaser.Scene {
  private theme!: ThemeDef;
  private bg!: Starfield;
  private playerBullets!: Bullets;
  private enemyBullets!: Bullets;
  private player!: Player;
  private enemies!: EnemyManager;
  private powerUps?: Phaser.Physics.Arcade.Group;

  private score = 0;
  private runCoins = 0;
  private combo = 0;
  private comboTimer = 0;
  private levelIdx = 0;
  private loop = 0;
  private levelIds: string[] = [];
  private over = false;

  constructor() {
    super('Game');
  }

  create(): void {
    const s = services();
    this.theme = s.themes.active;
    this.over = false;
    this.score = 0;
    this.runCoins = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.loop = 0;
    this.levelIdx = 0;
    this.powerUps = undefined;
    this.levelIds = this.theme.levelIds.slice();

    this.bg = new Starfield(this, this.theme);
    this.playerBullets = new Bullets(this, 'bullet', 256);
    this.enemyBullets = new Bullets(this, 'enemy-bullet', 256);
    this.player = new Player(this, this.theme, s.economy.stats(this.theme), this.playerBullets);
    this.enemies = new EnemyManager(this, s.data, this.theme, this.enemyBullets, () => this.player, () => this.onLevelCleared());

    this.registry.set('score', 0);
    this.registry.set('coins', 0);
    this.registry.set('hp', this.player.hp);
    this.registry.set('maxHp', this.player.maxHp);
    this.registry.set('combo', 0);
    this.registry.set('levelName', '');
    this.scene.launch('Hud');

    this.physics.add.overlap(
      this.playerBullets.group,
      this.enemies.group,
      (b, e) => this.onBulletHitsEnemy(b as unknown as Phaser.Physics.Arcade.Sprite, e as unknown as Enemy),
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.enemyBullets.group,
      (_p, b) => this.onPlayerHitByBullet(b as unknown as Phaser.Physics.Arcade.Sprite),
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.enemies.group,
      (_p, e) => this.onPlayerHitByEnemy(e as unknown as Enemy),
      undefined,
      this
    );

    this.input.keyboard?.on('keydown-ESC', () => this.endRun());
    this.events.once('shutdown', () => {
      this.enemies.clearAll();
      this.bg.destroy();
    });

    this.startLevel(0);
  }

  private startLevel(idx: number): void {
    this.levelIdx = idx;
    const level = services().data.level(this.levelIds[idx]) as LevelDef;
    this.registry.set('levelName', this.loop > 0 ? `${level.name} +${this.loop}` : level.name);
    this.enemies.startLevel(level, this.loop);
  }

  private onLevelCleared(): void {
    if (this.over) return;
    let next = this.levelIdx + 1;
    if (next >= this.levelIds.length) {
      next = 0;
      this.loop += 1;
    }
    this.startLevel(next);
  }

  private onBulletHitsEnemy(bullet: Phaser.Physics.Arcade.Sprite, enemy: Enemy): void {
    if (!bullet.active || !enemy.active) return;
    this.playerBullets.kill(bullet);
    enemy.hp -= this.player.damage;
    enemy.setTintFill(0xffffff);
    this.time.delayedCall(40, () => {
      if (enemy.active) enemy.setTint(hexToNum(enemy.def.tint));
    });
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    const mult = 1 + Math.min(this.combo, 20) * 0.05;
    const gained = Math.round(enemy.def.scoreValue * mult);
    this.score += gained;
    this.runCoins += enemy.def.coinValue;
    this.combo += 1;
    this.comboTimer = 2500;

    burst(this, enemy.x, enemy.y, hexToNum(enemy.def.tint), 14);
    shake(this, 0.004, 90);
    popText(this, enemy.x, enemy.y, `+${gained}`, this.theme.palette.text);
    this.maybeDropPowerUp(enemy.x, enemy.y);

    this.enemies.killEnemy(enemy);
    this.registry.set('score', this.score);
    this.registry.set('coins', this.runCoins);
    this.registry.set('combo', this.combo);
  }

  private maybeDropPowerUp(x: number, y: number): void {
    const ids = this.theme.powerupIds ?? [];
    if (ids.length === 0) return;
    const pu = services().data.powerup(ids[0]);
    if (!pu || Math.random() > pu.dropChance) return;

    if (!this.powerUps) {
      this.powerUps = this.physics.add.group();
      this.physics.add.overlap(
        this.player,
        this.powerUps,
        (_p, d) => this.collectPowerUp(d as unknown as Phaser.Physics.Arcade.Sprite),
        undefined,
        this
      );
    }
    const drop = this.powerUps.create(x, y, 'powerup') as Phaser.Physics.Arcade.Sprite;
    drop.setTint(hexToNum(pu.tint)).setDepth(9).setData('puId', pu.id);
    (drop.body as Phaser.Physics.Arcade.Body).setVelocity(0, 95);
    this.tweens.add({ targets: drop, scale: { from: 0.7, to: 1.15 }, yoyo: true, repeat: -1, duration: 500 });
  }

  private collectPowerUp(drop: Phaser.Physics.Arcade.Sprite): void {
    const id = drop.getData('puId') as string;
    const pu = services().data.powerup(id);
    drop.destroy();
    if (!pu) return;
    if (pu.type === 'rapidFire') this.player.applyRapid(pu.durationMs, this.time.now);
    popText(this, this.player.x, this.player.y - 42, pu.name, this.theme.palette.accent);
  }

  private onPlayerHitByBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active || this.player.isInvuln(this.time.now)) return;
    this.enemyBullets.kill(bullet);
    this.damagePlayer();
  }

  private onPlayerHitByEnemy(enemy: Enemy): void {
    if (!enemy.active || this.player.isInvuln(this.time.now)) return;
    burst(this, enemy.x, enemy.y, hexToNum(enemy.def.tint), 12);
    this.enemies.killEnemy(enemy);
    this.damagePlayer();
  }

  private damagePlayer(): void {
    if (this.over) return;
    const dead = this.player.takeHit(this.time.now);
    this.combo = 0;
    this.registry.set('combo', 0);
    shake(this, 0.012, 220);
    this.cameras.main.flash(120, 255, 60, 80);
    this.registry.set('hp', Math.max(0, this.player.hp));
    if (dead) this.endRun();
  }

  private endRun(): void {
    if (this.over) return;
    this.over = true;
    const s = services();
    s.economy.addCoins(this.theme.id, this.runCoins);
    const isBest = s.economy.recordScore(this.theme.id, this.score);
    burst(this, this.player.x, this.player.y, hexToNum(this.theme.palette.danger), 26);
    shake(this, 0.02, 320);
    this.player.setActive(false).setVisible(false);
    this.scene.stop('Hud');
    this.time.delayedCall(750, () => {
      this.scene.start('GameOver', { score: this.score, coins: this.runCoins, best: s.economy.bestScore(this.theme.id), isBest });
    });
  }

  override update(time: number, delta: number): void {
    this.bg.update(time, delta);
    if (this.over) return;
    this.player.tick(time, delta, this.input.activePointer);
    this.enemies.update(time, delta);
    this.playerBullets.recycle();
    this.enemyBullets.recycle();
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0;
        this.registry.set('combo', 0);
      }
    }
  }
}
