import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    freq *= 2;
    amp *= 0.5;
  }
  return sum / 0.9375;
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
export function mat4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

const _c = new THREE.Color();
/** Non-indexed copy of `geo` with only position/normal plus a flat vertex color, ready for merging. */
export function paint(geo, color, matrix) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (matrix) g.applyMatrix4(matrix);
  g.clearGroups();
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  if (color instanceof THREE.Color) _c.copy(color);
  else _c.set(color);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _c.r;
    arr[i * 3 + 1] = _c.g;
    arr[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export const SPECTRUM_HEX = ['#ff3b5c', '#ff8a2a', '#ffeb4a', '#4dff7a', '#2ee6ff', '#4a7dff', '#c04dff'];
const SPECTRUM = SPECTRUM_HEX.map((h) => new THREE.Color(h));

/** t = 0 red … 1 violet */
export function spectrumColor(t, out = new THREE.Color()) {
  const s = clamp01(t) * 6;
  const i = Math.min(5, Math.floor(s));
  return out.copy(SPECTRUM[i]).lerp(SPECTRUM[i + 1], s - i);
}

export const SPECTRUM_GLSL = /* glsl */ `
vec3 spectrum(float t) {
  t = clamp(t, 0.0, 1.0) * 6.0;
  vec3 c = mix(vec3(1.0, 0.231, 0.361), vec3(1.0, 0.541, 0.165), clamp(t, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.922, 0.290), clamp(t - 1.0, 0.0, 1.0));
  c = mix(c, vec3(0.302, 1.0, 0.478), clamp(t - 2.0, 0.0, 1.0));
  c = mix(c, vec3(0.180, 0.902, 1.0), clamp(t - 3.0, 0.0, 1.0));
  c = mix(c, vec3(0.290, 0.490, 1.0), clamp(t - 4.0, 0.0, 1.0));
  c = mix(c, vec3(0.753, 0.302, 1.0), clamp(t - 5.0, 0.0, 1.0));
  return pow(c, vec3(2.2));
}
`;
