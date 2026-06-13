import type { ThemeDef, LevelDef, EnemyDef } from '../data/types';
import type { GameData } from '../data/loader';
import type { Economy, PlayerStats } from '../systems/Economy';
import type { Entity, Kind, FxEvent } from './types';
import type { EnemyHost, Vec } from './EnemyManager';
import { EnemyManager } from './EnemyManager';
import { Player } from './Player';
import { LOGICAL_W as W, LOGICAL_H as H } from '../config';
import { clamp } from '../app/mathx';
import { hexToNum } from '../util/color';

export interface RunResult {
  score: number;
  coins: number;
  best: number;
  isBest: boolean;
}

// The full Phase-0 simulation, ported from the Phaser GameScene to plain TS in
// logical 720x1280 space. Owns the player, the EnemyManager, every projectile /
// pickup / hazard, circle-based collision, scoring, weapons, and level flow.
// Renders nothing — pushes visual cues onto an FX queue the renderer drains.
export class World implements EnemyHost {
  private nextId = 1;
  player: Player;
  private playerE: Entity;
  private enemyMgr: EnemyManager;

  bullets: Entity[] = []; // player shots
  ebullets: Entity[] = [];
  powerups: Entity[] = [];
  barriers: Entity[] = [];
  bots: Entity[] = [];
  missiles: Entity[] = [];
  bombs: Entity[] = [];

  score = 0;
  runCoins = 0;
  combo = 0;
  levelName = '';
  weaponText = '';
  over = false;

  private comboTimer = 0;
  private levelIdx = 0;
  private loop = 0;
  private levelIds: string[];
  private homingAmmo = 0;
  private homingCd = 0;
  private botsUntil = 0;
  private weaponClearAt = 0;
  private time = 0;
  private scheduled: { at: number; fn: () => void }[] = [];
  private fx: FxEvent[] = [];
  private enemyBulletColor: number;

  constructor(
    private theme: ThemeDef,
    stats: PlayerStats,
    private data: GameData,
    private economy: Economy,
    private onGameOver: (r: RunResult) => void,
    startLevel = 0
  ) {
    this.levelIds = theme.levelIds.slice();
    this.playerE = this.make('player', W / 2, H - 170);
    this.player = new Player(this.playerE, theme, stats);
    const roster = data.enemy(theme.enemyRosterIds[0]);
    this.enemyBulletColor = hexToNum(roster?.tint ?? theme.palette.danger);
    this.enemyMgr = new EnemyManager(data, theme, this);
    this.startLevelAt(clamp(startLevel, 0, this.levelIds.length - 1));
  }

  private make(kind: Kind, x: number, y: number): Entity {
    return {
      id: this.nextId++, kind, x, y, vx: 0, vy: 0, radius: 10, hp: 1, alive: true, color: 0xffffff, scale: 20,
      bvx: 0, bvy: 0, def: null, mode: 'active', slotX: x, slotY: y, row: 0, col: 0, fireCd: 0, actCd: 0,
      dir: 1, phase: 0, didAct: false, enterDelay: 0, enterT: 0, enterDur: 600, fromX: x, fromY: y,
      diveT: 0, diveDur: 1500, dcx: 0, dcy: 0, dex: 0, dey: 0, puId: '', ttl: 0, orbA: 0, until: 0,
      targetY: 0, bombKind: '',
    };
  }

  // ---- main tick ----
  tick(dtMs: number, _time: number): void {
    this.time += dtMs;
    if (this.over) {
      this.runScheduled();
      return;
    }
    this.player.move(dtMs, this.tx, this.ty);
    this.player.tickFire(dtMs, this.time, (x, y, bvx, bvy) => this.spawnPlayerBullet(x, y, bvx, bvy));
    this.enemyMgr.update(dtMs);
    this.moveProjectiles(dtMs);
    this.updateBots(dtMs);
    this.updateHoming(dtMs);
    this.updateBombs(dtMs);
    this.updateBarriers(dtMs);
    this.collide();
    this.runScheduled();

    if (this.comboTimer > 0) {
      this.comboTimer -= dtMs;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.weaponClearAt > 0 && this.time > this.weaponClearAt) {
      this.weaponClearAt = 0;
      this.weaponText = '';
    }
  }

  private tx = W / 2;
  private ty = H - 170;
  setTarget(x: number, y: number): void {
    this.tx = x;
    this.ty = y;
  }
  nudgeTarget(dx: number, dy: number): void {
    this.tx = this.playerE.x + dx * 400;
    this.ty = this.playerE.y + dy * 400;
  }

  private after(delayMs: number, fn: () => void): void {
    this.scheduled.push({ at: this.time + delayMs, fn });
  }
  private runScheduled(): void {
    if (this.scheduled.length === 0) return;
    const due = this.scheduled.filter((s) => s.at <= this.time);
    if (due.length === 0) return;
    this.scheduled = this.scheduled.filter((s) => s.at > this.time);
    for (const s of due) s.fn();
  }

  // ---- spawning ----
  private spawnPlayerBullet(x: number, y: number, bvx: number, bvy: number): void {
    const b = this.make('pbullet', x, y);
    b.bvx = bvx;
    b.bvy = bvy;
    b.radius = 10;
    b.scale = 14;
    b.color = this.player.bulletColor;
    this.bullets.push(b);
  }

  spawnEnemy(def: EnemyDef, x: number, y: number, hp: number): Entity {
    const e = this.make('enemy', x, y);
    e.def = def;
    e.hp = hp;
    e.radius = def.size * 0.42;
    e.scale = def.size;
    e.color = hexToNum(def.tint);
    return e;
  }

  enemyFire(x: number, y: number, vx: number, vy: number): void {
    const b = this.make('ebullet', x, y);
    b.bvx = vx;
    b.bvy = vy;
    b.radius = 9;
    b.scale = 13;
    b.color = this.enemyBulletColor;
    this.ebullets.push(b);
  }

  playerPos(): Vec {
    return { x: this.playerE.x, y: this.playerE.y };
  }

  private moveProjectiles(dtMs: number): void {
    const dt = dtMs / 1000;
    const cull = (b: Entity): boolean => {
      b.x += b.bvx * dt;
      b.y += b.bvy * dt;
      return b.alive && b.y > -60 && b.y < H + 60 && b.x > -60 && b.x < W + 60;
    };
    this.bullets = this.bullets.filter(cull);
    this.ebullets = this.ebullets.filter(cull);
    for (const d of this.powerups) {
      d.y += d.bvy * dt;
    }
    this.powerups = this.powerups.filter((d) => d.alive && d.y < H + 60);
  }

  // ---- collision (circle overlap; replaces Phaser Arcade) ----
  private hit(a: Entity, b: Entity): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const rr = a.radius + b.radius;
    return dx * dx + dy * dy <= rr * rr;
  }

  private collide(): void {
    const enemies = this.enemyMgr.enemies;
    // player bullets vs enemies / barriers
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (const e of enemies) {
        if (e.alive && this.hit(b, e)) {
          b.alive = false;
          e.hp -= this.player.damage;
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
      if (!b.alive) continue;
      for (const w of this.barriers) {
        if (w.alive && this.hit(b, w)) {
          b.alive = false;
          w.hp -= this.player.damage;
          if (w.hp <= 0) {
            this.fx.push({ type: 'burst', x: w.x, y: w.y, color: 0x9aa6b4, count: 8 });
            w.alive = false;
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
    this.barriers = this.barriers.filter((w) => w.alive);

    // homing missiles vs enemies
    for (const m of this.missiles) {
      if (!m.alive) continue;
      for (const e of enemies) {
        if (e.alive && this.hit(m, e)) {
          m.alive = false;
          this.fx.push({ type: 'burst', x: m.x, y: m.y, color: 0xff9a6a, count: 12 });
          e.hp -= this.player.damage * 2 + 1;
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
    }

    // bots vs enemy bullets
    for (const bot of this.bots) {
      for (const eb of this.ebullets) {
        if (eb.alive && this.hit(bot, eb)) eb.alive = false;
      }
    }

    if (!this.player.isInvuln(this.time)) {
      for (const eb of this.ebullets) {
        if (eb.alive && this.hit(this.playerE, eb)) {
          eb.alive = false;
          this.damagePlayer();
          break;
        }
      }
    }
    if (!this.player.isInvuln(this.time)) {
      for (const e of enemies) {
        if (e.alive && this.hit(this.playerE, e)) {
          this.fx.push({ type: 'burst', x: e.x, y: e.y, color: e.color, count: 12 });
          this.enemyMgr.kill(e);
          this.damagePlayer();
          break;
        }
      }
    }

    // powerup pickup
    for (const d of this.powerups) {
      if (d.alive && this.hit(this.playerE, d)) {
        d.alive = false;
        this.collectPowerUp(d);
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.alive);
    this.powerups = this.powerups.filter((d) => d.alive);
  }

  // ---- enemy death / scoring ----
  private killEnemy(e: Entity): void {
    const def = e.def!;
    const mult = 1 + Math.min(this.combo, 20) * 0.05;
    const gained = Math.round(def.scoreValue * mult);
    this.score += gained;
    this.runCoins += def.coinValue;
    this.combo += 1;
    this.comboTimer = 2500;
    this.fx.push({ type: 'burst', x: e.x, y: e.y, color: e.color, count: 14 });
    this.fx.push({ type: 'shake', intensity: 0.004, durMs: 80 });
    this.fx.push({ type: 'pop', x: e.x, y: e.y, text: `+${gained}`, color: hexToNum(this.theme.palette.text) });
    this.maybeDropPowerUp(e.x, e.y, def.behavior === 'transport');
    this.enemyMgr.kill(e);
  }

  private maybeDropPowerUp(x: number, y: number, force: boolean): void {
    const ids = this.theme.powerupIds ?? [];
    if (ids.length === 0) return;
    const pick = this.data.powerup(ids[Math.floor(Math.random() * ids.length)]);
    if (!pick) return;
    if (!force && Math.random() >= pick.dropChance) return;
    const d = this.make('powerup', x, y);
    d.puId = pick.id;
    d.bvy = 95;
    d.radius = 22;
    d.scale = 34;
    d.color = hexToNum(pick.tint);
    this.powerups.push(d);
  }

  private collectPowerUp(d: Entity): void {
    const pu = this.data.powerup(d.puId);
    if (!pu) return;
    switch (pu.type) {
      case 'rapidFire': this.player.applyRapid(pu.durationMs, this.time); break;
      case 'spread': this.player.applySpread(pu.durationMs, this.time); break;
      case 'shield': this.player.applyShield(pu.durationMs, this.time); break;
      case 'multishot': this.player.addLane(); break;
      case 'nuke': this.detonateNuke(); break;
      case 'botLauncher': this.launchBots(pu.durationMs); break;
      case 'homing': this.homingAmmo = Math.min(20, this.homingAmmo + 8); break;
      case 'laser': this.fireLaserBeam(); break;
    }
    this.fx.push({ type: 'pop', x: this.playerE.x, y: this.playerE.y - 44, text: pu.name, color: hexToNum(this.theme.palette.accent) });
    this.setWeaponHud(pu.type === 'multishot' ? `GUNS x${this.player.lanes}` : pu.name.toUpperCase());
  }

  private setWeaponHud(text: string): void {
    this.weaponText = text;
    this.weaponClearAt = this.time + 3000;
  }

  // ---- weapons ----
  private detonateNuke(): void {
    this.fx.push({ type: 'flash', color: 0xffdca0, durMs: 280 });
    this.fx.push({ type: 'shake', intensity: 0.02, durMs: 360 });
    for (const e of this.enemyMgr.activeEnemies()) {
      this.score += e.def!.scoreValue;
      this.runCoins += e.def!.coinValue;
      this.fx.push({ type: 'burst', x: e.x, y: e.y, color: e.color, count: 12 });
      this.enemyMgr.kill(e);
    }
  }

  private launchBots(durationMs: number): void {
    this.bots = [];
    for (let i = 0; i < 5; i++) {
      const bot = this.make('bot', this.playerE.x, this.playerE.y);
      bot.orbA = (i * Math.PI * 2) / 5;
      bot.radius = 12;
      bot.scale = 18;
      bot.color = hexToNum(this.theme.palette.accent);
      this.bots.push(bot);
    }
    this.botsUntil = this.time + durationMs;
  }

  private updateBots(dtMs: number): void {
    if (this.bots.length === 0) return;
    if (this.time > this.botsUntil) {
      this.bots = [];
      return;
    }
    for (const bot of this.bots) {
      bot.orbA += dtMs * 0.004;
      bot.x = this.playerE.x + Math.cos(bot.orbA) * 66;
      bot.y = this.playerE.y + Math.sin(bot.orbA) * 66;
    }
  }

  private updateHoming(dtMs: number): void {
    if (this.homingAmmo > 0) {
      this.homingCd -= dtMs;
      if (this.homingCd <= 0) {
        this.homingCd = 240;
        const m = this.make('missile', this.playerE.x, this.playerE.y - 20);
        m.bvx = (Math.random() - 0.5) * 120;
        m.bvy = -300;
        m.radius = 10;
        m.scale = 16;
        m.color = 0xff7a7a;
        this.missiles.push(m);
        this.homingAmmo -= 1;
        this.setWeaponHud(`HOMING x${this.homingAmmo}`);
      }
    }
    const dt = dtMs / 1000;
    const targets = this.enemyMgr.activeEnemies();
    for (const m of this.missiles) {
      if (!m.alive) continue;
      let nearest: Entity | null = null;
      let best = 1e9;
      for (const e of targets) {
        const d = (m.x - e.x) ** 2 + (m.y - e.y) ** 2;
        if (d < best) {
          best = d;
          nearest = e;
        }
      }
      if (nearest) {
        const ang = Math.atan2(nearest.y - m.y, nearest.x - m.x);
        m.bvx = Math.cos(ang) * 460;
        m.bvy = Math.sin(ang) * 460;
      }
      m.x += m.bvx * dt;
      m.y += m.bvy * dt;
      if (m.y < -40 || m.y > H + 40 || m.x < -40 || m.x > W + 40) m.alive = false;
    }
    this.missiles = this.missiles.filter((m) => m.alive);
  }

  private fireLaserBeam(): void {
    const x = this.playerE.x;
    this.fx.push({ type: 'beam', x, y0: 0, y1: this.playerE.y - 40, color: hexToNum(this.theme.palette.accent), width: 30, durMs: 380 });
    for (const e of this.enemyMgr.activeEnemies()) {
      if (Math.abs(e.x - x) < 26 && e.y < this.playerE.y) {
        this.fx.push({ type: 'burst', x: e.x, y: e.y, color: e.color, count: 10 });
        this.killEnemy(e);
      }
    }
  }

  // ---- enemy hazards (called by behaviors) ----
  spawnBarrier(x: number, y: number, hp: number): void {
    const b = this.make('barrier', clamp(x, 40, W - 40), y);
    b.hp = hp;
    b.ttl = 9000;
    b.radius = 27;
    b.scale = 54;
    b.color = 0x9aa6b4;
    this.barriers.push(b);
  }

  private updateBarriers(dtMs: number): void {
    for (const b of this.barriers) {
      b.ttl -= dtMs;
      if (b.ttl <= 0) b.alive = false;
    }
    this.barriers = this.barriers.filter((b) => b.alive);
  }

  compressionBomb(x: number, y: number): void {
    const bomb = this.make('bomb', x, y);
    bomb.bombKind = 'compression';
    bomb.targetY = H - 150;
    bomb.bvy = (bomb.targetY - y) / 1.3;
    bomb.radius = 13;
    bomb.scale = 26;
    bomb.color = 0xff7a3a;
    this.bombs.push(bomb);
  }

  shotgunBomb(x: number, y: number): void {
    const bomb = this.make('bomb', x, y);
    bomb.bombKind = 'shotgun';
    bomb.targetY = H - 260;
    bomb.bvy = (bomb.targetY - y) / 1.1;
    bomb.radius = 13;
    bomb.scale = 26;
    bomb.color = 0xff3a6a;
    this.bombs.push(bomb);
  }

  private updateBombs(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const bomb of this.bombs) {
      if (!bomb.alive) continue;
      bomb.y += bomb.bvy * dt;
      if (bomb.y < bomb.targetY) continue;
      bomb.alive = false;
      const ex = bomb.x;
      const ey = bomb.targetY;
      if (bomb.bombKind === 'compression') {
        this.fx.push({ type: 'ring', x: ex, y: ey, color: 0xff7a3a, radius: 130 });
        this.after(180, () => {
          if (!this.over && dist(ex, ey, this.playerE.x, this.playerE.y) < 120) this.damagePlayer();
        });
      } else {
        this.fx.push({ type: 'burst', x: ex, y: ey, color: 0xff3a6a, count: 14 });
        for (let i = 0; i < 13; i++) {
          const ang = Math.PI * (0.1 + 0.8 * (i / 12));
          this.enemyFire(ex, ey, Math.cos(ang) * 230, Math.sin(ang) * 230);
        }
      }
    }
    this.bombs = this.bombs.filter((b) => b.alive);
  }

  emitterLaser(x: number, y: number): void {
    const green = 0xa6ff3a;
    this.fx.push({ type: 'beam', x, y0: y, y1: H, color: green, width: 4, durMs: 520 }); // telegraph
    this.after(520, () => {
      this.fx.push({ type: 'beam', x, y0: y, y1: H, color: green, width: 34, durMs: 460 });
      this.after(120, () => {
        if (!this.over && Math.abs(this.playerE.x - x) < 24 && this.playerE.y > y) this.damagePlayer();
      });
    });
  }

  nearestDrop(x: number, y: number): Vec | null {
    let nearest: Entity | null = null;
    let best = 1e9;
    for (const d of this.powerups) {
      if (!d.alive) continue;
      const dd = (x - d.x) ** 2 + (y - d.y) ** 2;
      if (dd < best) {
        best = dd;
        nearest = d;
      }
    }
    return nearest ? { x: nearest.x, y: nearest.y } : null;
  }

  stealDropNear(x: number, y: number, r: number): boolean {
    for (const d of this.powerups) {
      if (d.alive && dist(x, y, d.x, d.y) < r) {
        this.fx.push({ type: 'burst', x: d.x, y: d.y, color: 0x3ad0ff, count: 8 });
        d.alive = false;
        return true;
      }
    }
    return false;
  }

  ghost(x: number, y: number, color: number): void {
    this.fx.push({ type: 'burst', x, y, color, count: 6 });
  }

  // ---- player damage / death ----
  private damagePlayer(): void {
    if (this.over) return;
    const dead = this.player.takeHit(this.time);
    this.combo = 0;
    this.fx.push({ type: 'shake', intensity: 0.012, durMs: 220 });
    this.fx.push({ type: 'flash', color: 0xff3c50, durMs: 120 });
    if (dead) this.endRun();
  }

  private endRun(): void {
    if (this.over) return;
    this.over = true;
    this.economy.addCoins(this.theme.id, this.runCoins);
    const isBest = this.economy.recordScore(this.theme.id, this.score);
    this.fx.push({ type: 'burst', x: this.playerE.x, y: this.playerE.y, color: hexToNum(this.theme.palette.danger), count: 26 });
    this.fx.push({ type: 'shake', intensity: 0.02, durMs: 320 });
    this.playerE.alive = false;
    const result: RunResult = { score: this.score, coins: this.runCoins, best: this.economy.bestScore(this.theme.id), isBest };
    this.after(750, () => this.onGameOver(result));
  }

  // ---- level flow ----
  private startLevelAt(idx: number): void {
    this.levelIdx = idx;
    const level = this.data.level(this.levelIds[idx]) as LevelDef;
    this.levelName = this.loop > 0 ? `${level.name}  +${this.loop}` : level.name;
    this.enemyMgr.startLevel(level, this.loop);
  }

  onLevelCleared(): void {
    if (this.over) return;
    let next = this.levelIdx + 1;
    if (next >= this.levelIds.length) {
      next = 0;
      this.loop += 1;
    }
    this.startLevelAt(next);
  }

  // ---- render/UI interface ----
  get hp(): number {
    return Math.max(0, this.player.hp);
  }
  get maxHp(): number {
    return this.player.maxHp;
  }
  drainFx(): FxEvent[] {
    const out = this.fx;
    this.fx = [];
    return out;
  }
  forEach(cb: (e: Entity) => void): void {
    if (this.playerE.alive) cb(this.playerE);
    for (const e of this.enemyMgr.enemies) cb(e);
    for (const b of this.bullets) cb(b);
    for (const b of this.ebullets) cb(b);
    for (const d of this.powerups) cb(d);
    for (const w of this.barriers) cb(w);
    for (const b of this.bots) cb(b);
    for (const m of this.missiles) cb(m);
    for (const b of this.bombs) cb(b);
  }
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
