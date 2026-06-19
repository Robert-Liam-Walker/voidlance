// Procedural synthesis primitives. Every game sound is built from these — short
// oscillator blips, frequency sweeps and filtered noise bursts. Nothing here
// allocates persistent nodes: each call creates one-shot nodes that auto-stop,
// so the graph stays small under heavy fire.

export type Wave = OscillatorType;

export interface ToneOpts {
  freq: number;
  endFreq?: number; // if set, glide freq -> endFreq over the note
  wave?: Wave;
  dur: number; // seconds
  gain?: number; // peak gain (pre-bus)
  attack?: number; // seconds
  release?: number; // seconds (tail after dur)
  detune?: number; // cents
}

/** A single enveloped oscillator note, routed to `dest`, starting at `t`. */
export function tone(ctx: BaseAudioContext, dest: AudioNode, t: number, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  osc.type = o.wave ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  if (o.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.endFreq), t + o.dur);
  }

  const g = ctx.createGain();
  const peak = o.gain ?? 0.3;
  const atk = o.attack ?? 0.005;
  const rel = o.release ?? 0.04;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur + rel);

  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + o.dur + rel + 0.02);
}

export interface NoiseOpts {
  dur: number; // seconds
  gain?: number;
  attack?: number;
  release?: number;
  type?: BiquadFilterType; // filter shape (default lowpass)
  freq?: number; // filter cutoff at start
  endFreq?: number; // filter cutoff at end (sweep)
  q?: number;
}

/** A filtered white-noise burst — used for hits, explosions, thrust. */
export function noise(ctx: BaseAudioContext, dest: AudioNode, t: number, o: NoiseOpts): void {
  const len = Math.max(1, Math.ceil(ctx.sampleRate * (o.dur + (o.release ?? 0.05))));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = o.type ?? 'lowpass';
  filter.Q.value = o.q ?? 1;
  const f0 = o.freq ?? 1200;
  filter.frequency.setValueAtTime(f0, t);
  if (o.endFreq !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.endFreq), t + o.dur);
  }

  const g = ctx.createGain();
  const peak = o.gain ?? 0.3;
  const atk = o.attack ?? 0.002;
  const rel = o.release ?? 0.05;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur + rel);

  src.connect(filter).connect(g).connect(dest);
  src.start(t);
  src.stop(t + o.dur + rel + 0.02);
}

/** Convenience: midi note number -> frequency (A4 = 69 = 440Hz). */
export function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
