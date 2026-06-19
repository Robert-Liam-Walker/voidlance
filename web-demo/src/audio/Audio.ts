// Public audio façade. The game (Game.ts / main.ts) only ever touches this:
// one method per game event plus mute/resume/music control. All sounds are
// procedural (see synth.ts) and mixed conservatively so nothing fatigues —
// gunfire in particular is short, quiet and rate-limited.

import { AudioEngine } from './AudioEngine';
import { Music } from './music';
import { tone, noise, mtof } from './synth';

// Per-sound minimum spacing (ms) so spammy events (auto-fire, radial bursts)
// don't stack into a wall of clipping noise.
const THROTTLE = {
  playerShoot: 70,
  enemyShoot: 90,
  enemyHit: 45,
} as const;

export class Audio {
  readonly engine: AudioEngine;
  private music: Music;
  private last: Record<string, number> = {};

  constructor() {
    this.engine = new AudioEngine();
    this.music = new Music(this.engine);
  }

  // ---- lifecycle ----
  /** Must run inside a user gesture (autoplay policy). Safe to call repeatedly. */
  resume(): void {
    this.engine.resume();
  }
  startMusic(): void {
    this.music.start();
  }
  stopMusic(): void {
    this.music.stop();
  }

  // ---- mute ----
  get muted(): boolean {
    return this.engine.muted;
  }
  toggleMute(): boolean {
    return this.engine.toggleMute();
  }
  setMuted(m: boolean): void {
    this.engine.setMuted(m);
  }

  // ---- throttle helper ----
  private gate(key: keyof typeof THROTTLE): boolean {
    const t = performance.now();
    const min = THROTTLE[key];
    if (this.last[key] !== undefined && t - this.last[key] < min) return false;
    this.last[key] = t;
    return true;
  }

  private bus(): GainNode {
    return this.engine.sfxBus;
  }

  // ---- SFX (one per game event) ----

  /** Player auto-fire — tiny, bright, quiet click-blip. Rate-limited. */
  playerShoot(): void {
    if (this.muted || !this.gate('playerShoot')) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    tone(ctx, this.bus(), t, { freq: 880, endFreq: 1500, wave: 'square', dur: 0.05, gain: 0.06, release: 0.03 });
  }

  /** Enemy fire — lower, duller than the player's so they're distinguishable. */
  enemyShoot(): void {
    if (this.muted || !this.gate('enemyShoot')) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    tone(ctx, this.bus(), t, { freq: 320, endFreq: 180, wave: 'sawtooth', dur: 0.07, gain: 0.05, release: 0.04 });
  }

  /** Non-fatal hit on an enemy — short filtered noise tick. Rate-limited. */
  enemyHit(): void {
    if (this.muted || !this.gate('enemyHit')) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    noise(ctx, this.bus(), t, { dur: 0.04, gain: 0.08, freq: 2600, endFreq: 1200, type: 'bandpass', q: 1.2 });
  }

  /** Enemy destroyed — punchy noise burst + falling tone. */
  enemyExplode(): void {
    if (this.muted) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    noise(ctx, this.bus(), t, { dur: 0.18, gain: 0.16, freq: 1800, endFreq: 120, type: 'lowpass', release: 0.1 });
    tone(ctx, this.bus(), t, { freq: 200, endFreq: 60, wave: 'square', dur: 0.16, gain: 0.1, release: 0.08 });
  }

  /** Player took a hit (but survived) — harsh descending zap. */
  playerHurt(): void {
    if (this.muted) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    tone(ctx, this.bus(), t, { freq: 420, endFreq: 90, wave: 'sawtooth', dur: 0.22, gain: 0.16, release: 0.1 });
    noise(ctx, this.bus(), t, { dur: 0.12, gain: 0.1, freq: 900, endFreq: 200, type: 'lowpass' });
  }

  /** Player death — bigger, longer detuned explosion + downward sweep. */
  playerDeath(): void {
    if (this.muted) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    noise(ctx, this.bus(), t, { dur: 0.6, gain: 0.22, freq: 2000, endFreq: 80, type: 'lowpass', release: 0.3 });
    tone(ctx, this.bus(), t, { freq: 300, endFreq: 40, wave: 'sawtooth', dur: 0.55, gain: 0.16, release: 0.25 });
    tone(ctx, this.bus(), t, { freq: 305, endFreq: 42, wave: 'square', dur: 0.55, gain: 0.1, release: 0.25, detune: 12 });
  }

  /** Powerup collected — rising two-note chime. */
  powerup(): void {
    if (this.muted) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    tone(ctx, this.bus(), t, { freq: mtof(72), wave: 'triangle', dur: 0.09, gain: 0.14, release: 0.05 });
    tone(ctx, this.bus(), t + 0.08, { freq: mtof(79), wave: 'triangle', dur: 0.12, gain: 0.14, release: 0.08 });
  }

  /** Upgrade purchased in the hangar — confident three-note flourish. */
  purchase(): void {
    if (this.muted) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    [60, 64, 67].forEach((n, i) => {
      tone(ctx, this.bus(), t + i * 0.06, { freq: mtof(n + 12), wave: 'square', dur: 0.08, gain: 0.1, release: 0.05 });
    });
  }

  /** Boss arrival — ominous low swell with a bright accent. */
  bossAppear(): void {
    if (this.muted) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    tone(ctx, this.bus(), t, { freq: 70, endFreq: 110, wave: 'sawtooth', dur: 0.9, gain: 0.22, attack: 0.08, release: 0.4 });
    tone(ctx, this.bus(), t, { freq: 105, endFreq: 165, wave: 'square', dur: 0.9, gain: 0.1, attack: 0.08, release: 0.4, detune: -8 });
    noise(ctx, this.bus(), t + 0.1, { dur: 0.5, gain: 0.08, freq: 400, endFreq: 1600, type: 'highpass', release: 0.3 });
  }

  /** Generic UI button click — short soft blip. */
  uiClick(): void {
    if (this.muted) return;
    const ctx = this.engine.ctx;
    const t = this.engine.now;
    tone(ctx, this.bus(), t, { freq: 660, endFreq: 990, wave: 'triangle', dur: 0.04, gain: 0.09, release: 0.03 });
  }
}
