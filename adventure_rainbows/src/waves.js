import { smoothstep } from './utils.js';

const RAW = [
  { dir: [1.0, 0.35], L: 42, Q: 0.11 },
  { dir: [-0.45, 1.0], L: 27, Q: 0.1 },
  { dir: [0.75, -0.6], L: 17, Q: 0.09 },
  { dir: [-0.9, -0.25], L: 11, Q: 0.07 },
];

export const WAVES = RAW.map((w) => {
  const len = Math.hypot(w.dir[0], w.dir[1]);
  const k = (2 * Math.PI) / w.L;
  return { d: [w.dir[0] / len, w.dir[1] / len], k, c: Math.sqrt(9.8 / k) * 0.8, a: w.Q / k };
});

const num = (v) => v.toFixed(6);

/** Gerstner displacement; accumulates surface tangent (T) and binormal (B) for the normal. */
export const WAVES_GLSL = /* glsl */ `
vec3 gerstner(vec2 p, float t, float damp, inout vec3 T, inout vec3 B) {
  vec3 disp = vec3(0.0);
  vec2 d; float k, c, a, f, s, co, q;
${WAVES.map(
  (w) => `  d = vec2(${num(w.d[0])}, ${num(w.d[1])}); k = ${num(w.k)}; c = ${num(w.c)}; a = ${num(w.a)} * damp;
  f = k * (dot(d, p) - c * t); s = sin(f); co = cos(f); q = k * a;
  disp += vec3(d.x * a * co, a * s, d.y * a * co);
  T += vec3(-d.x * d.x * q * s, d.x * q * co, -d.x * d.y * q * s);
  B += vec3(-d.x * d.y * q * s, d.y * q * co, -d.y * d.y * q * s);`
).join('\n')}
  return disp;
}
`;

export function shoreDamp(x, z, islands) {
  let m = 1e9;
  for (const isl of islands) m = Math.min(m, Math.hypot(x - isl.x, z - isl.z) - isl.shoreR);
  return 0.25 + 0.75 * smoothstep(0, 30, m);
}

export function waveHeight(x, z, t, damp = 1) {
  let y = 0;
  for (const w of WAVES) y += w.a * damp * Math.sin(w.k * (w.d[0] * x + w.d[1] * z - w.c * t));
  return y;
}
