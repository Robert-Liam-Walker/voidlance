// Derives audio cues from a running World by polling its PUBLIC state once per
// frame and diffing against the previous frame. This indirection exists because
// the World's authoritative FxEvent stream is drained exclusively by the
// Renderer (World.drainFx) and the file-ownership rules forbid editing World.ts
// or Renderer.ts — so we can't read the fx queue directly. Polling public
// fields (score / hp / bullets / bossHp / weaponText) is the clean,
// non-invasive way to reach these events from Game.ts.
//
// A WorldAudio is created per run and discarded when the run ends.

import type { Audio } from './Audio';

// Structural view of the bits of World we read — keeps this decoupled and avoids
// pulling World's whole type graph in. World already exposes all of these as
// public fields / getters.
interface WorldView {
  score: number;
  hp: number;
  over: boolean;
  bossHp: number; // <0 when no boss, else 0..1
  weaponText: string;
  bullets: { id: number }[]; // player shots
  ebullets: { id: number }[]; // enemy shots
}

export class WorldAudio {
  private prevScore = 0;
  private prevHp: number;
  private prevBossActive = false;
  private prevWeapon = '';
  private maxPlayerBulletId = 0;
  private maxEnemyBulletId = 0;
  private deathFired = false;

  constructor(private audio: Audio, world: WorldView) {
    // Seed from the initial state so the first frame doesn't fire spuriously.
    this.prevScore = world.score;
    this.prevHp = world.hp;
    this.prevWeapon = world.weaponText;
    this.prevBossActive = world.bossHp >= 0;
    this.maxPlayerBulletId = maxId(world.bullets);
    this.maxEnemyBulletId = maxId(world.ebullets);
  }

  /** Call once per frame, after world.tick(). */
  sample(world: WorldView): void {
    // --- shots: new entity ids appeared since last frame ---
    const pMax = maxId(world.bullets);
    if (pMax > this.maxPlayerBulletId) {
      this.audio.playerShoot();
      this.maxPlayerBulletId = pMax;
    }
    const eMax = maxId(world.ebullets);
    if (eMax > this.maxEnemyBulletId) {
      this.audio.enemyShoot();
      this.maxEnemyBulletId = eMax;
    }

    // --- enemy destroyed: score went up ---
    if (world.score > this.prevScore) {
      this.audio.enemyExplode();
      this.prevScore = world.score;
    } else if (world.score < this.prevScore) {
      this.prevScore = world.score; // defensive (shouldn't happen)
    }

    // --- player damage / death ---
    if (world.hp < this.prevHp) {
      if (world.over || world.hp <= 0) {
        if (!this.deathFired) {
          this.audio.playerDeath();
          this.deathFired = true;
        }
      } else {
        this.audio.playerHurt();
      }
    }
    this.prevHp = world.hp;
    if (world.over && !this.deathFired) {
      // Caught the run ending without a separate hp dip this frame.
      this.audio.playerDeath();
      this.deathFired = true;
    }

    // --- boss appearance: bossHp crossed from absent (<0) to active (>=0) ---
    const bossActive = world.bossHp >= 0;
    if (bossActive && !this.prevBossActive) this.audio.bossAppear();
    this.prevBossActive = bossActive;

    // --- powerup pickup: weaponText changed to a new non-empty value ---
    if (world.weaponText && world.weaponText !== this.prevWeapon) {
      this.audio.powerup();
    }
    this.prevWeapon = world.weaponText;
  }
}

function maxId(arr: { id: number }[]): number {
  let m = 0;
  for (const e of arr) if (e.id > m) m = e.id;
  return m;
}
