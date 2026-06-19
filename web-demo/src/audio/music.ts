// Procedural looping background track. A slow minor arpeggio over a soft bass
// pulse — low, ambient, non-fatiguing. Uses a look-ahead scheduler (the classic
// "A Tale of Two Clocks" pattern): a setInterval timer queues notes a little
// ahead of the audio clock so timing stays sample-accurate without a busy loop.

import type { AudioEngine } from './AudioEngine';
import { tone, mtof } from './synth';

const BPM = 84;
const STEP = 60 / BPM / 2; // eighth-note grid (seconds)
const LOOKAHEAD_MS = 25; // how often the timer wakes
const SCHEDULE_AHEAD = 0.12; // how far ahead to queue (seconds)

// A natural-minor vamp (NOVA LANCE = brooding/space). Two-bar arpeggio in MIDI.
const ARP = [
  57, 60, 64, 67, 64, 60, 62, 59, // Am -> Em-ish motion
  55, 59, 62, 67, 62, 59, 57, 53,
];
// One bass note per bar (8 steps).
const BASS = [33, 31];

export class Music {
  private playing = false;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;

  constructor(private engine: AudioEngine) {}

  start(): void {
    if (this.playing) return;
    this.playing = true;
    this.nextTime = this.engine.now + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.tick(), LOOKAHEAD_MS);
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    if (!this.playing) return;
    const ctx = this.engine.ctx;
    const bus = this.engine.musicBus;
    while (this.nextTime < this.engine.now + SCHEDULE_AHEAD) {
      this.scheduleStep(ctx, bus, this.step, this.nextTime);
      this.nextTime += STEP;
      this.step++;
    }
  }

  private scheduleStep(ctx: BaseAudioContext, bus: AudioNode, step: number, t: number): void {
    const i = step % ARP.length;
    // Lead arpeggio — soft triangle, gentle.
    tone(ctx, bus, t, {
      freq: mtof(ARP[i]),
      wave: 'triangle',
      dur: STEP * 0.85,
      gain: 0.16,
      attack: 0.01,
      release: 0.12,
    });
    // Bass pulse on each downbeat (every 8 steps).
    if (i % 8 === 0) {
      const b = BASS[(Math.floor(step / 8)) % BASS.length];
      tone(ctx, bus, t, {
        freq: mtof(b),
        endFreq: mtof(b) * 0.98,
        wave: 'sawtooth',
        dur: STEP * 6,
        gain: 0.2,
        attack: 0.02,
        release: 0.3,
      });
    }
    // Sparse high shimmer to keep it moving without busyness.
    if (i % 4 === 2) {
      tone(ctx, bus, t, {
        freq: mtof(ARP[i] + 12),
        wave: 'sine',
        dur: STEP * 0.4,
        gain: 0.05,
        attack: 0.005,
        release: 0.08,
      });
    }
  }
}
