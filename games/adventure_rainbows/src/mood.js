import * as THREE from 'three';
import { smoothstep } from './utils.js';

const RAW = {
  day: {
    top: '#2f86e0', horizon: '#c4ecff', bottom: '#9fd3f0', sun: '#fff3d6', sunEl: 38, sunI: 2.6,
    hemiSky: '#d4f0ff', hemiGround: '#f2d7a0', hemiI: 1.3,
    deep: '#0a4f8c', shallow: '#1d9fd0', lagoon: '#38e0d2', cloudShadow: '#a9c6e8', stars: 0,
  },
  golden: {
    top: '#5b74d6', horizon: '#ffc6a3', bottom: '#f4b39a', sun: '#ffb36b', sunEl: 9, sunI: 2.2,
    hemiSky: '#ffd9c2', hemiGround: '#e8b98a', hemiI: 1.15,
    deep: '#1d4a88', shallow: '#4a86c0', lagoon: '#55d1c9', cloudShadow: '#c99bb4', stars: 0,
  },
  twilight: {
    top: '#2b2466', horizon: '#f59ac0', bottom: '#c07bb0', sun: '#ff9cc0', sunEl: 3, sunI: 1.3,
    hemiSky: '#b39cff', hemiGround: '#8a6aa8', hemiI: 1.25,
    deep: '#1a1f55', shallow: '#3b4590', lagoon: '#3fb8c8', cloudShadow: '#7a6aa8', stars: 1,
  },
};

const COLOR_KEYS = ['top', 'horizon', 'bottom', 'sun', 'hemiSky', 'hemiGround', 'deep', 'shallow', 'lagoon', 'cloudShadow'];
const NUM_KEYS = ['sunEl', 'sunI', 'hemiI', 'stars'];

const MOODS = Object.fromEntries(
  Object.entries(RAW).map(([name, m]) => {
    const o = { ...m };
    for (const k of COLOR_KEYS) o[k] = new THREE.Color(m[k]);
    return [name, o];
  })
);

// Gentle day → golden hour → pink twilight → back to day.
const KEYS = [
  [0.0, 'day'], [0.42, 'day'], [0.55, 'golden'], [0.66, 'twilight'],
  [0.76, 'twilight'], [0.87, 'golden'], [1.0, 'day'],
];

const SUN_AZIMUTH = 0.5;
const out = Object.fromEntries(COLOR_KEYS.map((k) => [k, new THREE.Color()]));
out.sunDir = new THREE.Vector3();

export function sampleMood(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const [t0, a] = KEYS[i];
  const [t1, b] = KEYS[i + 1];
  const f = smoothstep(t0, t1, t);
  const A = MOODS[a];
  const B = MOODS[b];
  for (const k of COLOR_KEYS) out[k].copy(A[k]).lerp(B[k], f);
  for (const k of NUM_KEYS) out[k] = A[k] + (B[k] - A[k]) * f;
  const el = THREE.MathUtils.degToRad(out.sunEl);
  out.sunDir.set(Math.cos(el) * Math.sin(SUN_AZIMUTH), Math.sin(el), Math.cos(el) * Math.cos(SUN_AZIMUTH));
  return out;
}
