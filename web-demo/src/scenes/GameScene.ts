import Phaser from 'phaser';
import { services } from '../services';
import { Nebula } from '../core/Nebula';
import { Bullets } from '../core/Bullets';
import { Player } from '../core/Player';
import { EnemyManager } from '../core/EnemyManager';
import type { EnemyHooks } from '../core/EnemyManager';
import { Enemy } from '../core/Enemy';
import { burst, shake, popText } from '../core/Juice';
import { hexToNum } from '../util/color';
import type { ThemeDef, LevelDef, PowerUpDef } from '../data/types';

type Sprite = Phaser.Physics.Arcade.Sprite;

export class GameScene extends Phaser.Scene {
  private theme!: ThemeDef;
  private bg!: Nebula;
  private playerBullets!: Bullets;
  private enemyBullets!: Bullets;
  private player!: Player;
  private enemies!: EnemyManager;
  private powerUps!: Phaser.Physics.Arcade.Group;
  private barriers!: Phaser.Physics.Arcade.Group;
  private bots!: Phaser.Physics.Arcade.Group;
  private homingGroup!: Phaser.Physics.Arcade.Group;

  private score = 0;
  private runCoins = 0;
  private combo = 0;
  private comboTimer = 0;
  private levelIdx = 0;
  private loop = 0;
  private levelIds: string[] = [];
  private over = false;
  private homingAmmo = 0;
  private homingCd = 0;
  private botsUntil = 0;
  private weaponClearAt = 0;

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
    this.homingAmmo = 0;
    this.homingCd = 0;
    this.botsUntil = 0;
    this.weaponClearAt = 0;
    this.levelIds = this.theme.levelIds.slice();

    this.bg = new Nebula(this, this.theme);
    const enemyBulletKey = s.data.enemy(this.theme.enemyRosterIds[0])?.bulletSprite ?? 'laserRed01';
    this.playerBullets = new Bullets(this, this.theme.player.bulletSprite, 320, Phaser.BlendModes.ADD);
    this.enemyBullets = new Bullets(this, enemyBulletKey, 320, Phaser.BlendModes.ADD);
    this.player = new Player(this, this.theme, s.economy.stats(this.theme), this.playerBullets);

    this.powerUps = this.physics.add.group();
    this.barriers = this.physics.add.group();
    this.bots = this.physics.add.group();
    this.homingGroup = this.physics.add.group();

    const hooks: EnemyHooks = {
      player: () => this.player,
      spawnBarrier: (x, y, hp) => this.spawnBarrier(x, y, hp),
      compressionBomb: (x, y) => this.compressionBomb(x, y),
      shotgunBomb: (x, y) => this.shotgunBomb(x, y),
      emitterLaser: (x, y) => this.emitterLaser(x, y),
      nearestDrop: (x, y) => this.nearestDrop(x, y),
      stealDropNear: (x, y, r) => this.stealDropNear(x, y, r),
    };
    this.enemies = new EnemyManager(this, s.data, this.theme, this.enemyBullets, hooks, () => this.onLevelCleared());

    this.registry.set('score', 0);
    this.registry.set('coins', 0);
    this.registry.set('hp', this.player.hp);
    this.registry.set('maxHp', this.player.maxHp);
    this.registry.set('combo', 0);
    this.registry.set('weapon', '');
    this.registry.set('levelName', '');
    this.scene.launch('Hud');

    this.physics.add.overlap(this.playerBullets.group, this.enemies.group, (b, e) => this.onBulletHitsEnemy(b as Sprite, e as Enemy), undefined, this);
    this.physics.add.overlap(this.playerBullets.group, this.barriers, (b, w) => this.onBulletHitsBarrier(b as Sprite, w as Sprite), undefined, this);
    this.physics.add.overlap(this.player, this.enemyBullets.group, (_p, b) => this.onPlayerHitByBullet(b as Sprite), undefined, this);
    this.physics.add.overlap(this.player, this.enemies.group, (_p, e) => this.onPlayerHitByEnemy(e as Enemy), undefined, this);
    this.physics.add.overlap(this.player, this.powerUps, (_p, d) => this.collectPowerUp(d as Sprite), undefined, this);
    this.physics.add.overlap(this.bots, this.enemyBullets.group, (_bot, b) => this.enemyBullets.kill(b as Sprite), undefined, this);
    this.physics.add.overlap(this.homingGroup, this.enemies.group, (m, e) => this.onHomingHitsEnemy(m as Sprite, e as Enemy), undefined, this);

    this.input.keyboard?.on('keydown-ESC', () => this.endRun());
    this.events.once('shutdown', () => {
      this.enemies.clearAll();
      this.bg.destroy();
    });

    const dbgLvl = parseInt(new URLSearchParams(location.search).get('lvl') ?? '', 10);
    this.startLevel(Number.isFinite(dbgLvl) ? Phaser.Math.Clamp(dbgLvl, 0, this.levelIds.length - 1) : 0);
  }

  private startLevel(idx: number): void {
    this.levelIdx = idx;
    const level = services().data.level(this.levelIds[idx]) as LevelDef;
    this.registry.set('levelName', this.loop > 0 ? `${level.name}  +${this.loop}` : level.name);
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

  // --- combat: player shots ---
  private onBulletHitsEnemy(bullet: Sprite, enemy: Enemy): void {
    if (!bullet.active || !enemy.active) return;
    this.playerBullets.kill(bullet);
    enemy.hp -= this.player.damage;
    enemy.setTintFill(0xffffff);
    this.time.delayedCall(40, () => {
      if (enemy.active) enemy.clearTint();
    });
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private onBulletHitsBarrier(bullet: Sprite, barrier: Sprite): void {
    if (!bullet.active || !barrier.active) return;
    this.playerBullets.kill(bullet);
    const hp = (barrier.getData('hp') as number) - this.player.damage;
    barrier.setData('hp', hp);
    barrier.setTintFill(0xffffff);
    this.time.delayedCall(40, () => {
      if (barrier.active) barrier.clearTint();
    });
    if (hp <= 0) {
      burst(this, barrier.x, barrier.y, 0x9aa6b4, 8);
      barrier.destroy();
    }
  }

  private killEnemy(enemy: Enemy): void {
    const mult = 1 + Math.min(this.combo, 20) * 0.05;
    const gained = Math.round(enemy.def.scoreValue * mult);
    this.score += gained;
    this.runCoins += enemy.def.coinValue;
    this.combo += 1;
    this.comboTimer = 2500;
    burst(this, enemy.x, enemy.y, hexToNum(enemy.def.tint), 14);
    shake(this, 0.004, 80);
    popText(this, enemy.x, enemy.y, `+${gained}`, this.theme.palette.text);
    this.maybeDropPowerUp(enemy.x, enemy.y, enemy.def.behavior === 'transport');
    this.enemies.killEnemy(enemy);
    this.registry.set('score', this.score);
    this.registry.set('coins', this.runCoins);
    this.registry.set('combo', this.combo);
  }

  // --- power-ups ---
  private maybeDropPowerUp(x: number, y: number, force: boolean): void {
    const ids = this.theme.powerupIds ?? [];
    if (ids.length === 0) return;
    const data = services().data;
    let pu: PowerUpDef | undefined;
    if (force) {
      pu = data.powerup(ids[Phaser.Math.Between(0, ids.length - 1)]);
    } else {
      const pick = data.powerup(ids[Phaser.Math.Between(0, ids.length - 1)]);
      if (pick && Math.random() < pick.dropChance) pu = pick;
    }
    if (!pu) return;
    const drop = this.powerUps.create(x, y, pu.sprite) as Sprite;
    drop.setDepth(9).setData('puId', pu.id).setScale(0.85);
    (drop.body as Phaser.Physics.Arcade.Body).setVelocity(0, 95);
    this.tweens.add({ targets: drop, scale: { from: 0.72, to: 1.0 }, yoyo: true, repeat: -1, duration: 480 });
  }

  private collectPowerUp(drop: Sprite): void {
    const id = drop.getData('puId') as string;
    const pu = services().data.powerup(id);
    drop.destroy();
    if (!pu) return;
    const now = this.time.now;
    switch (pu.type) {
      case 'rapidFire':
        this.player.applyRapid(pu.durationMs, now);
        break;
      case 'spread':
        this.player.applySpread(pu.durationMs, now);
        break;
      case 'shield':
        this.player.applyShield(pu.durationMs, now);
        break;
      case 'multishot':
        this.player.addLane();
        break;
      case 'nuke':
        this.detonateNuke();
        break;
      case 'botLauncher':
        this.launchBots(pu.durationMs);
        break;
      case 'homing':
        this.homingAmmo = Math.min(20, this.homingAmmo + 8);
        break;
      case 'laser':
        this.fireLaserBeam();
        break;
    }
    popText(this, this.player.x, this.player.y - 44, pu.name, this.theme.palette.accent);
    this.setWeaponHud(pu.type === 'multishot' ? `GUNS x${this.player.lanes}` : pu.name.toUpperCase());
  }

  private setWeaponHud(text: string): void {
    this.registry.set('weapon', text);
    this.weaponClearAt = this.time.now + 3000;
  }

  // --- extra weapons ---
  private detonateNuke(): void {
    this.cameras.main.flash(280, 255, 220, 160);
    shake(this, 0.02, 360);
    for (const e of this.enemies.activeEnemies()) {
      this.score += e.def.scoreValue;
      this.runCoins += e.def.coinValue;
      burst(this, e.x, e.y, hexToNum(e.def.tint), 12);
      this.enemies.killEnemy(e);
    }
    this.registry.set('score', this.score);
    this.registry.set('coins', this.runCoins);
  }

  private launchBots(durationMs: number): void {
    this.bots.clear(true, true);
    for (let i = 0; i < 5; i++) {
      const bot = this.bots.create(this.player.x, this.player.y, 'bot') as Sprite;
      bot.setTint(hexToNum(this.theme.palette.accent)).setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setScale(1.1).setData('a', (i * Math.PI * 2) / 5);
    }
    this.botsUntil = this.time.now + durationMs;
  }

  private updateBots(time: number, delta: number): void {
    if (this.bots.countActive() === 0) return;
    if (time > this.botsUntil) {
      this.bots.clear(true, true);
      return;
    }
    for (const obj of this.bots.getChildren()) {
      const bot = obj as Sprite;
      const a = (bot.getData('a') as number) + delta * 0.004;
      bot.setData('a', a);
      bot.setPosition(this.player.x + Math.cos(a) * 66, this.player.y + Math.sin(a) * 66);
    }
  }

  private spawnHomingMissile(): void {
    const m = this.homingGroup.get(this.player.x, this.player.y - 20, 'missile') as Sprite | null;
    if (!m) return;
    m.setActive(true).setVisible(true).setTint(0xff7a7a).setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setScale(1.1);
    const body = m.body as Phaser.Physics.Arcade.Body;
    body.reset(this.player.x, this.player.y - 20);
    body.enable = true;
    m.setVelocity(Phaser.Math.Between(-60, 60), -300);
  }

  private updateHoming(delta: number): void {
    if (this.homingAmmo > 0) {
      this.homingCd -= delta;
      if (this.homingCd <= 0) {
        this.homingCd = 240;
        this.spawnHomingMissile();
        this.homingAmmo -= 1;
        this.setWeaponHud(`HOMING x${this.homingAmmo}`);
      }
    }
    const targets = this.enemies.activeEnemies();
    for (const obj of this.homingGroup.getChildren()) {
      const m = obj as Sprite;
      if (!m.active) continue;
      let nearest: Enemy | null = null;
      let best = 1e9;
      for (const e of targets) {
        const d = Phaser.Math.Distance.Between(m.x, m.y, e.x, e.y);
        if (d < best) {
          best = d;
          nearest = e;
        }
      }
      if (nearest) {
        const ang = Math.atan2(nearest.y - m.y, nearest.x - m.x);
        m.setVelocity(Math.cos(ang) * 460, Math.sin(ang) * 460);
        m.setRotation(ang + Math.PI / 2);
      }
      if (m.y < -40 || m.y > this.scale.height + 40 || m.x < -40 || m.x > this.scale.width + 40) {
        m.setActive(false).setVisible(false);
        (m.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    }
  }

  private onHomingHitsEnemy(missile: Sprite, enemy: Enemy): void {
    if (!missile.active || !enemy.active) return;
    missile.setActive(false).setVisible(false);
    (missile.body as Phaser.Physics.Arcade.Body).enable = false;
    burst(this, missile.x, missile.y, 0xff9a6a, 12);
    enemy.hp -= this.player.damage * 2 + 1;
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private fireLaserBeam(): void {
    const x = this.player.x;
    const beam = this.add.rectangle(x, this.player.y - 40, 30, this.scale.height, hexToNum(this.theme.palette.accent), 0.7).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
    this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.4, duration: 380, onComplete: () => beam.destroy() });
    for (const e of this.enemies.activeEnemies()) {
      if (Math.abs(e.x - x) < 26 && e.y < this.player.y) {
        burst(this, e.x, e.y, hexToNum(e.def.tint), 10);
        this.killEnemy(e);
      }
    }
  }

  // --- enemy effects (called by behaviors) ---
  private spawnBarrier(x: number, y: number, hp: number): void {
    const b = this.barriers.create(Phaser.Math.Clamp(x, 40, this.scale.width - 40), y, 'barrier') as Sprite;
    b.setTint(0x9aa6b4).setDepth(7).setData('hp', hp);
    (b.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    this.tweens.add({ targets: b, alpha: { from: 0.2, to: 1 }, duration: 250 });
    this.time.delayedCall(9000, () => {
      if (b.active) this.tweens.add({ targets: b, alpha: 0, duration: 400, onComplete: () => b.destroy() });
    });
  }

  private compressionBomb(x: number, y: number): void {
    const bomb = this.add.image(x, y, 'bomb').setTint(0xff7a3a).setBlendMode(Phaser.BlendModes.ADD).setDepth(7).setScale(0.9);
    this.tweens.add({
      targets: bomb,
      y: this.scale.height - 150,
      duration: 1300,
      ease: 'Quad.In',
      onComplete: () => {
        const ex = bomb.x;
        const ey = bomb.y;
        bomb.destroy();
        const ring = this.add.circle(ex, ey, 12).setStrokeStyle(5, 0xff7a3a).setDepth(7);
        this.tweens.add({ targets: ring, radius: 130, alpha: 0, duration: 480, onComplete: () => ring.destroy() });
        this.time.delayedCall(180, () => {
          if (this.player.active && Phaser.Math.Distance.Between(ex, ey, this.player.x, this.player.y) < 120) this.damagePlayer();
        });
      },
    });
  }

  private shotgunBomb(x: number, y: number): void {
    const bomb = this.add.image(x, y, 'bomb').setTint(0xff3a6a).setBlendMode(Phaser.BlendModes.ADD).setDepth(7).setScale(0.9);
    this.tweens.add({
      targets: bomb,
      y: this.scale.height - 260,
      duration: 1100,
      ease: 'Quad.In',
      onComplete: () => {
        const ex = bomb.x;
        const ey = bomb.y;
        bomb.destroy();
        burst(this, ex, ey, 0xff3a6a, 14);
        for (let i = 0; i < 13; i++) {
          const ang = Math.PI * (0.1 + 0.8 * (i / 12));
          this.enemyBullets.fire(ex, ey, Math.cos(ang) * 230, Math.sin(ang) * 230, 0xffffff, 0.7);
        }
      },
    });
  }

  private emitterLaser(x: number, y: number): void {
    const h = this.scale.height - y;
    const tele = this.add.rectangle(x, y, 4, h, 0xa6ff3a, 0.3).setOrigin(0.5, 0).setDepth(6);
    this.time.delayedCall(520, () => {
      tele.destroy();
      const beam = this.add.rectangle(x, y, 34, h, 0xa6ff3a, 0.85).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
      this.tweens.add({ targets: beam, alpha: 0, duration: 460, delay: 120, onComplete: () => beam.destroy() });
      this.time.delayedCall(120, () => {
        if (this.player.active && Math.abs(this.player.x - x) < 24 && this.player.y > y) this.damagePlayer();
      });
    });
  }

  private nearestDrop(x: number, y: number): { x: number; y: number } | null {
    let nearest: Sprite | null = null;
    let best = 1e9;
    for (const obj of this.powerUps.getChildren()) {
      const d = obj as Sprite;
      if (!d.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, d.x, d.y);
      if (dist < best) {
        best = dist;
        nearest = d;
      }
    }
    return nearest ? { x: nearest.x, y: nearest.y } : null;
  }

  private stealDropNear(x: number, y: number, r: number): boolean {
    for (const obj of this.powerUps.getChildren()) {
      const d = obj as Sprite;
      if (d.active && Phaser.Math.Distance.Between(x, y, d.x, d.y) < r) {
        burst(this, d.x, d.y, 0x3ad0ff, 8);
        d.destroy();
        return true;
      }
    }
    return false;
  }

  // --- player damage / death ---
  private onPlayerHitByBullet(bullet: Sprite): void {
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
    this.updateBots(time, delta);
    this.updateHoming(delta);
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0;
        this.registry.set('combo', 0);
      }
    }
    if (this.weaponClearAt > 0 && time > this.weaponClearAt) {
      this.weaponClearAt = 0;
      this.registry.set('weapon', '');
    }
  }
}
