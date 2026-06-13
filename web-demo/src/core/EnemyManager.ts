import Phaser from 'phaser';
import type { ThemeDef, LevelDef, WaveDef } from '../data/types';
import type { GameData } from '../data/loader';
import { Enemy } from './Enemy';
import type { Bullets } from './Bullets';
import { hexToNum } from '../util/color';

const ENEMY_TEX: Record<string, string> = {
  drone: 'enemy-drone',
  wing: 'enemy-wing',
  bug: 'enemy-bug',
  diamond: 'enemy-diamond',
};

type Vec = { x: number; y: number };

// Spawns Galaga-style formations, sways them, and peels enemies off into
// curved dive-bombing runs. Level/wave shapes come from shared-data.
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

  constructor(
    private scene: Phaser.Scene,
    private data: GameData,
    private theme: ThemeDef,
    private enemyBullets: Bullets,
    private getPlayer: () => Vec,
    private onLevelCleared: () => void
  ) {
    this.group = scene.physics.add.group();
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
    this.diveTimer = wave.diveIntervalMs ?? 1200;

    const def = this.data.enemyForWave(this.theme, wave);
    const tex = ENEMY_TEX[def.shape] ?? 'enemy-drone';
    const hp = def.hp + Math.floor(this.loop);
    const W = this.scene.scale.width;
    const totalW = (wave.cols - 1) * wave.spacingX;
    const startX = W / 2 - totalW / 2;

    for (let r = 0; r < wave.rows; r++) {
      for (let c = 0; c < wave.cols; c++) {
        const slotX = startX + c * wave.spacingX;
        const slotY = wave.startY + r * wave.spacingY;
        const e = new Enemy(this.scene, slotX, -40 - r * 30, def, tex, hp);
        e.slotX = slotX;
        e.slotY = slotY;
        e.row = r;
        e.col = c;
        e.mode = 'enter';
        this.group.add(e);
        this.enemies.push(e);
        this.scene.tweens.add({
          targets: e,
          x: slotX,
          y: slotY,
          delay: (r * wave.cols + c) * wave.entryStaggerMs,
          duration: 620,
          ease: 'Back.Out',
          onComplete: () => {
            if (e.active && e.mode === 'enter') e.mode = 'formation';
          },
        });
      }
    }
  }

  update(_time: number, delta: number): void {
    const wave = this.wave;
    if (!wave) return;

    this.swayPhase += delta * 0.0014;
    const offsetX = Math.sin(this.swayPhase) * 26;
    const bob = Math.cos(this.swayPhase * 0.8) * 6;
    const player = this.getPlayer();

    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.mode === 'formation') {
        e.x = e.slotX + offsetX;
        e.y = e.slotY + bob;
      }
      e.fireCd -= delta;
      if (e.fireCd <= 0) {
        e.fireCd = Phaser.Math.Between(1400, 3200);
        if (e.mode === 'dive' || Math.random() < (e.def.fireChance ?? 0)) this.enemyFire(e, player);
      }
    }

    this.diveTimer -= delta;
    if (this.diveTimer <= 0) {
      this.diveTimer = (wave.diveIntervalMs ?? 1200) / (1 + this.loop * 0.12);
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

  private startDive(): void {
    const candidates = this.enemies.filter((e) => e.active && e.mode === 'formation');
    if (candidates.length === 0) return;
    const e = Phaser.Utils.Array.GetRandom<Enemy>(candidates);
    e.mode = 'dive';

    const player = this.getPlayer();
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const sx = e.x;
    const sy = e.y;
    const cx = Phaser.Math.Clamp(player.x + Phaser.Math.Between(-90, 90), 30, W - 30);
    const cy = H * 0.5;
    const ex = Phaser.Math.Clamp(player.x + Phaser.Math.Between(-160, 160), 10, W - 10);
    const ey = H + 90;
    const prog = { t: 0 };

    e.diveTween = this.scene.tweens.add({
      targets: prog,
      t: 1,
      duration: 1500 / (1 + this.loop * 0.1),
      ease: 'Sine.InOut',
      onUpdate: () => {
        if (!e.active) return;
        const t = prog.t;
        const u = 1 - t;
        e.x = u * u * sx + 2 * u * t * cx + t * t * ex;
        e.y = u * u * sy + 2 * u * t * cy + t * t * ey;
        e.setRotation(Math.sin(t * Math.PI) * 0.3);
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

  private enemyFire(e: Enemy, player: Vec): void {
    const sp = e.def.bulletSpeed ?? 240;
    const ang = Math.atan2(player.y - e.y, player.x - e.x);
    this.enemyBullets.fire(e.x, e.y + 14, Math.cos(ang) * sp, Math.max(70, Math.sin(ang) * sp), hexToNum(e.def.tint), 1);
  }

  activeCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.active) n++;
    return n;
  }

  killEnemy(e: Enemy): void {
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
