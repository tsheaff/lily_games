import * as THREE from 'three';

/** Procedural ocean ambience and splash sounds — no audio files needed. */
export class Ambience {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  muted = false;

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 4);
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 6;
    this.noise = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = this.noise.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
      }
    }

    this.addSurf(0.07, 380, 0.5);
    this.addSurf(0.043, 650, 0.28);
    this.addSurf(0.11, 1200, 0.1);
  }

  /** The live audio graph, once started. */
  get graph() {
    if (!this.ctx || !this.master || !this.noise) return undefined;
    return { ctx: this.ctx, out: this.master, noise: this.noise };
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime + 0.4);
    }
  }

  /** Slow swelling wash of brown noise. */
  private addSurf(rate: number, cutoff: number, level: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.4;

    const gain = ctx.createGain();
    gain.gain.value = level * 0.6;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = level * 0.4;
    lfo.connect(lfoGain).connect(gain.gain);
    const lfoFreq = ctx.createGain();
    lfoFreq.gain.value = cutoff * 0.45;
    lfo.connect(lfoFreq).connect(filter.frequency);

    src.connect(filter).connect(gain).connect(this.master!);
    src.start(0, Math.random() * 5);
    lfo.start();
  }

  /** A plunge: noisy burst plus a falling "bloop". Pan/attenuate by listener. */
  splash(at: THREE.Vector3, listener: THREE.Camera, energy: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const toSound = at.clone().sub(listener.position);
    const dist = toSound.length();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(listener.quaternion);
    const pan = THREE.MathUtils.clamp(toSound.normalize().dot(right), -1, 1) * 0.8;
    const loud = THREE.MathUtils.clamp(energy / 15, 0.2, 1.2) / (1 + dist / 12);

    const out = ctx.createStereoPanner();
    out.pan.value = pan;
    out.connect(this.master);

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(1800, t);
    band.frequency.exponentialRampToValueAtTime(500, t + 0.6);
    band.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(loud * 1.6, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    src.connect(band).connect(g).connect(out);
    src.start(t, Math.random() * 4, 1);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(loud * 0.35, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(og).connect(out);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  /** Soft whoosh when throwing. */
  whoosh(power: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1400 + power * 1200, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25 + power * 0.3, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 4, 0.5);
  }
}
