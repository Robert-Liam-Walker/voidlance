// Owns the Web Audio graph: a single AudioContext, a master gain node, the
// mute flag (persisted to localStorage) and the autoplay-policy resume logic.
// Everything procedural — no asset files. Sound generators (see synth.ts) write
// into the busses exposed here; the rest of the game only ever talks to Audio
// (Audio.ts), never to this class directly.

const MUTE_KEY = 'vl.audio.muted';
const MASTER_LEVEL = 0.7; // headroom below 1.0 so layered sounds never clip

// Separate busses keep music well under the SFX so gunfire never drowns it out
// (and vice-versa). Tuned conservatively — see Audio.ts for per-sound trims.
const SFX_LEVEL = 0.9;
const MUSIC_LEVEL = 0.18;

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  private _muted: boolean;
  private resumed = false;

  constructor() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();

    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_LEVEL;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = SFX_LEVEL;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = MUSIC_LEVEL;
    this.musicBus.connect(this.master);

    this._muted = readMuted();
    this.applyMute();
  }

  /** Current audio time, in seconds — the clock all schedulers run against. */
  get now(): number {
    return this.ctx.currentTime;
  }

  get muted(): boolean {
    return this._muted;
  }

  /**
   * Resume the context. Browsers create it `suspended` until a user gesture, so
   * this must be called from inside a click/keydown handler. Idempotent.
   */
  resume(): void {
    if (this.resumed) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.resumed = true;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    writeMuted(muted);
    this.applyMute();
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  private applyMute(): void {
    // Ramp rather than hard-set to avoid clicks on toggle.
    const g = this.master.gain;
    const target = this._muted ? 0.0001 : MASTER_LEVEL;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0001), t);
    g.exponentialRampToValueAtTime(target, t + 0.04);
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // localStorage unavailable (private mode / blocked) — fail silent.
  }
}
