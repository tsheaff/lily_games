import type { Ambience } from './Ambience';

type Wave = OscillatorType;

/** Synthesized game sounds layered on the ambience's audio graph. */
export class Sfx {
  constructor(private ambience: Ambience) {}

  private tone(freq: number, opts: { type?: Wave; dur?: number; gain?: number; to?: number; delay?: number; attack?: number } = {}) {
    const g = this.ambience.graph;
    if (!g) return;
    const { type = 'sine', dur = 0.2, gain = 0.2, to, delay = 0, attack = 0.005 } = opts;
    const t = g.ctx.currentTime + delay;
    const osc = g.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const env = g.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(g.out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(opts: { from: number; to: number; dur: number; gain: number; q?: number; delay?: number; type?: BiquadFilterType }) {
    const g = this.ambience.graph;
    if (!g) return;
    const t = g.ctx.currentTime + (opts.delay ?? 0);
    const src = g.ctx.createBufferSource();
    src.buffer = g.noise;
    const f = g.ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.Q.value = opts.q ?? 1;
    f.frequency.setValueAtTime(opts.from, t);
    f.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
    const env = g.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(opts.gain, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f).connect(env).connect(g.out);
    src.start(t, Math.random() * 4, opts.dur + 0.1);
  }

  slash() {
    this.noise({ from: 900, to: 3800, dur: 0.18, gain: 0.5, q: 1.4 });
  }

  spin() {
    this.noise({ from: 500, to: 4000, dur: 0.5, gain: 0.6, q: 1.2 });
    this.tone(330, { type: 'triangle', to: 990, dur: 0.45, gain: 0.12 });
  }

  charged() {
    this.tone(1318, { dur: 0.25, gain: 0.12 });
    this.tone(1976, { dur: 0.35, gain: 0.08, delay: 0.06 });
  }

  /** Blunt hit on an enemy. */
  bonk(heavy = false) {
    this.tone(heavy ? 160 : 240, { type: 'square', to: heavy ? 60 : 90, dur: 0.16, gain: 0.16 });
    this.noise({ from: 1200, to: 300, dur: 0.12, gain: 0.35, q: 0.8 });
  }

  /** Metallic parry clang. */
  clang() {
    for (const [f, gain] of [
      [880, 0.12],
      [1397, 0.09],
      [2213, 0.06],
      [3120, 0.04],
    ] as const) {
      this.tone(f, { dur: 0.6, gain });
    }
    this.noise({ from: 6000, to: 2500, dur: 0.08, gain: 0.3, q: 0.7 });
  }

  spit() {
    this.tone(190, { to: 70, dur: 0.18, gain: 0.25 });
    this.noise({ from: 700, to: 200, dur: 0.15, gain: 0.25 });
  }

  windup() {
    this.tone(220, { type: 'triangle', to: 440, dur: 0.4, gain: 0.05 });
  }

  poof() {
    this.noise({ from: 2500, to: 300, dur: 0.45, gain: 0.5, q: 0.6 });
    [784, 622, 466, 349].forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.12, gain: 0.08, delay: i * 0.05 }));
  }

  rupee(value: number) {
    const base = value >= 20 ? 1568 : value >= 5 ? 1318 : 1046;
    this.tone(base, { type: 'triangle', dur: 0.12, gain: 0.12 });
    this.tone(base * 1.5, { type: 'triangle', dur: 0.2, gain: 0.1, delay: 0.07 });
  }

  heart() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, { type: 'sine', dur: 0.22, gain: 0.1, delay: i * 0.06 }));
  }

  hurt() {
    this.tone(330, { type: 'square', to: 150, dur: 0.25, gain: 0.12 });
    this.tone(247, { type: 'square', to: 110, dur: 0.3, gain: 0.08, delay: 0.05 });
  }

  bump() {
    this.tone(110, { to: 55, dur: 0.2, gain: 0.2 });
  }

  waveStart() {
    [392, 523, 659].forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.25, gain: 0.08, delay: i * 0.12 }));
  }

  waveCleared() {
    const notes = [523, 659, 784, 1046, 988, 1175, 1568];
    notes.forEach((f, i) => this.tone(f, { type: 'triangle', dur: i === notes.length - 1 ? 0.7 : 0.16, gain: 0.1, delay: i * 0.09 }));
  }

  boss() {
    [110, 104, 98, 92].forEach((f, i) => this.tone(f, { type: 'sawtooth', dur: 0.5, gain: 0.08, delay: i * 0.35, attack: 0.05 }));
  }

  gameOver() {
    [392, 370, 349, 330, 196].forEach((f, i) => this.tone(f, { type: 'triangle', dur: i === 4 ? 1.2 : 0.3, gain: 0.1, delay: i * 0.28 }));
  }
}
