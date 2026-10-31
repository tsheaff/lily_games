import * as THREE from 'three';
import { SPECTRUM_GLSL, spectrumColor, smoothstep } from './utils.js';
import { STAR_POINT_FRAG } from './effects.js';

const arcVert = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Neon ribbon: saturated bands with bright tube highlights, a soft halo, and a travelling glint.
const arcFrag = /* glsl */ `
uniform float uInner, uOuter, uReverse, uOpacity, uTime, uIntensity, uFlash;
varying vec2 vLocal;
${SPECTRUM_GLSL}
void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  float tc = clamp(t, 0.0, 1.0);
  float s = uReverse > 0.5 ? tc : 1.0 - tc;
  vec3 col = spectrum(s);
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float boost = 1.1 + 1.3 * (1.0 - luma);

  float core = smoothstep(-0.02, 0.1, t) * (1.0 - smoothstep(0.9, 1.02, t));
  float d = max(max(-t, t - 1.0), 0.0);
  float glow = exp(-d * 4.0) * 0.55 + exp(-d * 14.0) * 0.45;

  float ang = atan(vLocal.y, vLocal.x);
  float ribbon = pow(1.0 - abs(fract(s * 7.0) - 0.5) * 2.0, 2.0);
  float shimmer = 0.88 + 0.12 * sin(ang * 60.0 - uTime * 2.0 + r * 0.3) * sin(ang * 13.0 + uTime * 0.7);
  float glint = pow(0.5 + 0.5 * sin(ang * 5.0 - uTime * 1.1), 10.0);

  float foot = smoothstep(-2.0, 38.0, vLocal.y);
  float body = core * uOpacity * foot;
  float halo = glow * (1.0 - core) * 0.6 * uOpacity * foot;
  vec3 rgb = col * boost * uIntensity * (1.0 + uFlash) * (body * (0.85 + 0.5 * ribbon) * shimmer + halo)
           + vec3(1.0) * body * (glint + uFlash * 0.6) * ribbon * 0.45;
  gl_FragColor = vec4(rgb, body * 0.88);
}
`;

const sparkVert = /* glsl */ `
attribute float aPhase;
attribute float aSize;
attribute vec3 aColor;
uniform float uTime, uScale, uOpacity, uSize;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
  p.x += cos(uTime * 0.5 + aPhase * 12.0) * 1.8;
  p.y += sin(uTime * 0.6 + aPhase * 6.28) * 1.8;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = pow(0.5 + 0.5 * sin(uTime * (2.0 + aPhase * 3.0) + aPhase * 40.0), 3.0);
  vAlpha = tw * uOpacity;
  vColor = aColor;
  gl_PointSize = min(aSize * uSize * uScale / -mv.z * (0.5 + tw), uScale * 0.2);
  gl_Position = projectionMatrix * mv;
}
`;
const sparkFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
${STAR_POINT_FRAG}
void main() {
  float a = starShape(gl_PointCoord - 0.5) * vAlpha;
  gl_FragColor = vec4(vColor * 2.2, a);
}
`;

const bubbleVert = /* glsl */ `
attribute float aPhase;
attribute float aSize;
attribute float aSpeed;
uniform float uTime, uScale, uOpacity, uSize;
varying float vAlpha;
void main() {
  float span = 110.0;
  float life = mod(uTime * aSpeed + aPhase * span, span);
  vec3 p = position;
  p.y += life;
  p.x += sin(uTime * 0.7 + aPhase * 10.0) * 4.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float f = life / span;
  vAlpha = uOpacity * smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.75, 1.0, f));
  gl_PointSize = min(aSize * uSize * uScale / -mv.z, uScale * 0.3);
  gl_Position = projectionMatrix * mv;
}
`;
const bubbleFrag = /* glsl */ `
uniform float uTime;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float rim = smoothstep(0.72, 0.96, d) * (1.0 - smoothstep(0.96, 1.0, d));
  float ang = atan(c.y, c.x);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + ang / 3.1416 + uTime * 0.1));
  float hl = exp(-pow(length(c - vec2(-0.18, 0.18)) * 7.0, 2.0));
  vec3 col = mix(vec3(1.0), irid, 0.7) * rim * 1.3 + vec3(1.0) * hl * 1.3 + irid * 0.05;
  gl_FragColor = vec4(col, (rim * 0.8 + hl + 0.05) * vAlpha);
}
`;

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
}

const SCALE = 0.32;
const DISTANCE = 170;
const HOLD = 15;

/**
 * One big rainbow with a little rainbow underneath it. It appears out on the water ahead of
 * the boat and stays put, so you can race to it and sail under the arch before it fades.
 */
export class DoubleRainbow {
  constructor(scene, shared) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.scale.setScalar(SCALE);
    scene.add(this.group);
    this.opacity = { value: 0 };
    this.flash = { value: 0 };
    this.size = { value: SCALE };
    this.shared = shared;
    this.dir = new THREE.Vector3(0, 0, 1);
    this.center = new THREE.Vector3();
    this.state = 'hidden';
    this.level = 0;
    this.enabled = false;
    this.timer = 15;
    this.holdT = 0;
    this.pending = false;
    this.passed = false;
    this.side = 0;
    this.onAppear = null;
    this.onPass = null;
    this.pickables = [];

    this.arcs = [
      { outer: 132, width: 19, reverse: 1, intensity: 1.05 },
      { outer: 96, width: 15, reverse: 0, intensity: 1.25 },
    ];
    for (const a of this.arcs) this.addArc(a);
    this.addSparkles();
    this.addBubbles();
  }

  addArc({ outer, width, reverse, intensity }) {
    const inner = outer - width;
    const margin = width * 1.8;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uInner: { value: inner },
        uOuter: { value: outer },
        uReverse: { value: reverse },
        uIntensity: { value: intensity },
        uOpacity: this.opacity,
        uFlash: this.flash,
        uTime: this.shared.uTime,
      },
      vertexShader: arcVert,
      fragmentShader: arcFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(inner - margin, outer + margin, 220, 8, 0, Math.PI), mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.pickables.push(mesh);
  }

  addSparkles() {
    const n = 650;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const size = new Float32Array(n);
    const c = new THREE.Color();
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const arc = this.arcs[i % 2];
      const th = 0.03 + Math.random() * (Math.PI - 0.06);
      const t = 0.5 + gauss() * 0.75;
      const r = arc.outer - arc.width + t * arc.width;
      pos.set([Math.cos(th) * r, Math.sin(th) * r, (Math.random() - 0.5) * 12], i * 3);
      const s = arc.reverse ? t : 1 - t;
      spectrumColor(s, c).lerp(white, 0.45);
      col.set([c.r, c.g, c.b], i * 3);
      phase[i] = Math.random();
      size[i] = 2 + Math.random() * 3.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const pts = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uTime: this.shared.uTime, uScale: this.shared.uScale, uOpacity: this.opacity, uSize: this.size },
        vertexShader: sparkVert,
        fragmentShader: sparkFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  addBubbles() {
    const n = 22;
    const pos = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const size = new Float32Array(n);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      pos.set([side * (60 + Math.random() * 110), -5 + Math.random() * 20, 10 + Math.random() * 30], i * 3);
      phase[i] = Math.random();
      size[i] = 7 + Math.random() * 12;
      speed[i] = 4 + Math.random() * 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    const pts = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uTime: this.shared.uTime, uScale: this.shared.uScale, uOpacity: this.opacity, uSize: this.size },
        vertexShader: bubbleVert,
        fragmentShader: bubbleFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  show() {
    this.pending = true;
  }

  get visible() {
    return this.level > 0;
  }

  /** Half-width of the big arch at the waterline, in world units. */
  get gateRadius() {
    return (this.arcs[0].outer - this.arcs[0].width) * SCALE;
  }

  /** A point on the water just past the arch, for steering straight through it. */
  throughPoint(out = new THREE.Vector3()) {
    return out.copy(this.center).addScaledVector(this.dir, 25);
  }

  /** Puts the rainbow out ahead of the boat, nudged off to one side, with no island in the way. */
  place(boat, islands) {
    const base = Math.atan2(boat.forward.x, boat.forward.z);
    const jitter = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.2);
    const tries = [jitter, -jitter, jitter * 2, -jitter * 2, 0, 0.8, -0.8, 1.4, -1.4];
    let best = null;
    for (const off of tries) {
      const a = base + off;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      let clearance = Infinity;
      for (const isl of islands) {
        const t = THREE.MathUtils.clamp((isl.x - boat.pos.x) * dx + (isl.z - boat.pos.y) * dz, 0, DISTANCE + 30);
        const d = Math.hypot(boat.pos.x + dx * t - isl.x, boat.pos.y + dz * t - isl.z) - isl.shoreR;
        clearance = Math.min(clearance, d);
      }
      if (!best || clearance > best.clearance) best = { a, clearance };
      if (clearance > this.gateRadius * 0.6) break;
    }
    this.dir.set(Math.sin(best.a), 0, Math.cos(best.a));
    this.center.set(boat.pos.x + this.dir.x * DISTANCE, -2, boat.pos.y + this.dir.z * DISTANCE);
    this.group.position.copy(this.center);
    this.group.rotation.y = Math.atan2(-this.dir.x, -this.dir.z);
    this.passed = false;
    this.side = -1;
  }

  update(dt, boat, islands) {
    if (this.pending) {
      this.pending = false;
      if (this.state === 'hidden') {
        this.place(boat, islands);
        this.onAppear?.();
      }
      if (this.state === 'hold') this.holdT = Math.max(this.holdT, HOLD);
      else this.state = 'in';
    }

    switch (this.state) {
      case 'hidden':
        if (this.enabled) this.timer -= dt;
        if (this.timer <= 0) this.show();
        break;
      case 'in':
        this.level = Math.min(1, this.level + dt / 3.5);
        if (this.level >= 1) {
          this.state = 'hold';
          this.holdT = HOLD;
        }
        break;
      case 'hold':
        this.holdT -= dt;
        if (this.holdT <= 0) this.state = 'out';
        break;
      case 'out':
        this.level = Math.max(0, this.level - dt / 5);
        if (this.level <= 0) {
          this.state = 'hidden';
          this.timer = 30 + Math.random() * 25;
        }
        break;
    }

    if (this.level > 0) {
      const rx = boat.pos.x - this.center.x;
      const rz = boat.pos.y - this.center.z;
      const along = rx * this.dir.x + rz * this.dir.z;
      const across = rx * this.dir.z - rz * this.dir.x;
      const side = Math.sign(along) || 1;
      if (!this.passed && this.side < 0 && side > 0 && Math.abs(across) < this.gateRadius && this.level > 0.1) {
        this.passed = true;
        this.flash.value = 2.5;
        if (this.state !== 'out') {
          this.state = 'hold';
          this.holdT = Math.min(this.holdT, 4);
        }
        this.onPass?.();
      }
      this.side = side;
    }

    this.flash.value = Math.max(0, this.flash.value - dt * 1.2);
    this.opacity.value = smoothstep(0, 1, this.level);
    this.group.visible = this.level > 0;
  }
}
