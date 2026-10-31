const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];

/** Everything here is synthesized live with WebAudio, no sound files. */
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    this.delay.connect(tone);
    tone.connect(fb);
    fb.connect(this.delay);
    tone.connect(this.master);

    this.sfx = this.bus(0.6, 0.3);
    this.music = this.bus(0.22, 0.5);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.startOcean();
    this.startMusic();
  }

  bus(gain, send) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.master);
    const s = this.ctx.createGain();
    s.gain.value = send;
    g.connect(s);
    s.connect(this.delay);
    return g;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  tone(freq, t, { dur = 1, type = 'sine', gain = 0.3, attack = 0.005, dest = this.sfx, glideTo = 0 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  bell(freq, t, gain = 0.2, dur = 1.4, dest = this.sfx) {
    this.tone(freq, t, { dur, gain, dest });
    this.tone(freq * 2.01, t, { dur: dur * 0.6, gain: gain * 0.35, dest });
    this.tone(freq * 3.0, t, { dur: dur * 0.3, gain: gain * 0.12, type: 'triangle', dest });
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tap() {
    if (!this.ctx) return;
    this.tone(520, this.now, { dur: 0.18, gain: 0.12, glideTo: 900 });
  }

  open() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.now;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + 0.8);
    [0, 2, 4, 7, 9, 12].forEach((s, i) => this.bell(mtof(67 + s), t + 0.05 + i * 0.06, 0.07, 0.6));
  }

  chime() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 4, 7, 12, 16].forEach((s, i) => this.bell(mtof(72 + s), t + i * 0.09, 0.17));
    this.bell(mtof(84), t + 0.55, 0.12, 2.2);
    this.bell(mtof(88), t + 0.55, 0.1, 2.2);
  }

  sparkle() {
    if (!this.ctx) return;
    const t = this.now;
    const notes = [0, 4, 7, 12, 16, 19];
    for (let i = 0; i < 8; i++) this.bell(mtof(84 + notes[Math.floor(Math.random() * notes.length)]), t + i * 0.05, 0.05, 0.5);
  }

  rainbow() {
    if (!this.ctx) return;
    const t = this.now;
    [60, 64, 67, 71, 74, 79, 83, 86].forEach((n, i) => this.bell(mtof(n + 12), t + i * 0.14, 0.08, 2.6));
  }

  win() {
    if (!this.ctx) return;
    const t = this.now;
    const seq = [
      [72, 0], [76, 0.15], [79, 0.3], [84, 0.45], [79, 0.75], [84, 0.9],
    ];
    seq.forEach(([n, dt]) => this.bell(mtof(n), t + dt, 0.18, 0.9));
    [72, 76, 79, 84, 88].forEach((n) => this.bell(mtof(n), t + 1.2, 0.1, 3));
    for (let i = 0; i < 14; i++) this.bell(mtof(96 + [0, 4, 7, 12][i % 4]), t + 1.3 + i * 0.07, 0.04, 0.6);
  }

  startOcean() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 450;
    const g = ctx.createGain();
    g.gain.value = 0.07;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.045;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start();
    lfo.start();
  }

  startMusic() {
    const eighth = 60 / 88 / 2;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.4;
    this.mel = 4;
    setInterval(() => {
      const now = this.ctx.currentTime;
      if (this.nextTime < now - 0.1) this.nextTime = now + 0.05;
      while (this.nextTime < now + 0.2) {
        this.scheduleStep(this.step++, this.nextTime, eighth);
        this.nextTime += eighth;
      }
    }, 50);
  }

  scheduleStep(step, t, eighth) {
    const bar = Math.floor(step / 8);
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const inBar = step % 8;
    const music = this.music;
    if (step % 16 === 0) {
      for (const n of chord) {
        this.tone(mtof(n), t, { dur: eighth * 16, type: 'triangle', gain: 0.03, attack: 1.0, dest: music });
        this.tone(mtof(n - 12), t, { dur: eighth * 16, gain: 0.035, attack: 1.2, dest: music });
      }
    }
    if (inBar === 0 || inBar === 4) this.tone(mtof(chord[0] - 24), t, { dur: 1.3, gain: 0.13, attack: 0.01, dest: music });
    if (Math.random() < (inBar % 2 === 0 ? 0.6 : 0.28)) {
      this.mel = Math.max(0, Math.min(SCALE.length - 1, this.mel + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      let n = SCALE[this.mel];
      if (inBar % 4 === 0) {
        const tones = chord.flatMap((c) => [c, c + 12, c + 24]);
        n = tones.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best), tones[0]);
      }
      this.bell(mtof(n + 12), t, 0.07, 0.9, music);
    }
  }
}
