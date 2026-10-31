import * as THREE from 'three';
import type { FrameContext, System } from '../engine/Engine';

function hash(x: number, y: number, seed: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 13);
    f *= 2.07;
    amp *= 0.5;
  }
  return sum;
}

export interface IslandOptions {
  x: number;
  z: number;
  radius: number;
  height: number;
  seed: number;
  /** Fraction of the radius that is low sandy shelf. */
  beach?: number;
  /** Elongation along x. */
  stretch?: number;
  rotation?: number;
}

const SAND = new THREE.Color(0xe8d6ae);
const WET_SAND = new THREE.Color(0xbfae8a);
const GRASS = new THREE.Color(0x3f7f3a);
const JUNGLE = new THREE.Color(0x1f4d2a);
const ROCK = new THREE.Color(0x4a4640);

/** Terrain height in the island's local (unrotated) frame. */
export function islandHeight(o: IslandOptions, x: number, z: number) {
  const stretch = o.stretch ?? 1;
  const beach = o.beach ?? 0.08;
  const nx = x / (o.radius * stretch);
  const nz = z / o.radius;
  const warp = (fbm(nx * 1.6, nz * 1.6, o.seed) - 0.5) * 0.45;
  const r = Math.hypot(nx, nz) + warp;
  const t = Math.max(0, 1 - r);
  const ridges = 1 - Math.abs(fbm(nx * 3.5, nz * 3.5, o.seed + 5) * 2 - 1);
  let h = Math.pow(t, 1.7) * o.height * (0.7 + 0.5 * ridges);
  h += fbm(nx * 9, nz * 9, o.seed + 9, 4) * o.height * 0.06 * t;
  const shelf = 1 - THREE.MathUtils.smoothstep(r, 1 - beach * 0.2, 1 + beach);
  return Math.max(h, shelf * 1.6) - 3 + 3 * Math.min(1, t * 12 + shelf);
}

export function createIsland(o: IslandOptions): THREE.Mesh {
  const seg = 180;
  const stretch = o.stretch ?? 1;
  const geo = new THREE.PlaneGeometry(o.radius * 2.4 * stretch, o.radius * 2.4, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, islandHeight(o, pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const steep = 1 - normals.getY(i);
    const n = fbm(pos.getX(i) * 0.02, pos.getZ(i) * 0.02, o.seed + 3, 3);
    if (y < 0.4) c.copy(WET_SAND);
    else if (y < 2.4 + n * 2) c.copy(SAND);
    else {
      c.copy(GRASS).lerp(JUNGLE, THREE.MathUtils.clamp((y / o.height) * 1.6 + n * 0.4, 0, 1));
      c.lerp(ROCK, THREE.MathUtils.smoothstep(steep, 0.35, 0.7));
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.6 }),
  );
  mesh.position.set(o.x, 0, o.z);
  mesh.rotation.y = o.rotation ?? 0;
  return mesh;
}

/** A curved trunk with drooping fronds. */
export function createPalm(height: number, lean: THREE.Vector3, seed: number): THREE.Group {
  const group = new THREE.Group();
  const rand = (i: number) => hash(seed, i, 3);

  const top = new THREE.Vector3(lean.x * height * 0.35, height, lean.z * height * 0.35);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(top.x * 0.15, height * 0.35, top.z * 0.15),
    new THREE.Vector3(top.x * 0.55, height * 0.72, top.z * 0.55),
    top,
  ]);
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, height * 0.022, 7, false),
    new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 1 }),
  );
  group.add(trunk);

  const crown = new THREE.Group();
  crown.position.copy(top);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3d7a2e,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const len = height * (0.42 + rand(i) * 0.12);
    const geo = new THREE.PlaneGeometry(1, 1, 10, 1);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < p.count; v++) {
      const u = p.getX(v) + 0.5;
      const side = p.getY(v);
      const width = Math.sin(Math.PI * Math.min(1, u * 1.15)) * len * 0.16;
      const droop = u * u * len * (0.55 + rand(i + 20) * 0.25);
      p.setXYZ(v, u * len, u * len * 0.25 - droop, side * width);
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMat);
    leaf.rotation.y = (i / fronds) * Math.PI * 2 + rand(i + 40) * 0.4;
    leaf.rotation.x = (rand(i + 60) - 0.5) * 0.6;
    crown.add(leaf);
  }
  group.add(crown);
  group.userData.crown = crown;
  return group;
}

/** The land masses around the scene, with palms gently swaying. */
export class Islands implements System {
  readonly group = new THREE.Group();
  private palms: THREE.Group[] = [];
  private defs: IslandOptions[] = [
    { x: -1500, z: -2300, radius: 1300, height: 520, seed: 1, stretch: 1.5, rotation: 0.3 },
    { x: 2300, z: -3600, radius: 1500, height: 680, seed: 4, stretch: 1.2, rotation: -0.5 },
    { x: -4200, z: 1200, radius: 1000, height: 300, seed: 8, stretch: 2, rotation: 1.2 },
    { x: -170, z: -240, radius: 46, height: 4, seed: 12, beach: 0.3, stretch: 1.8, rotation: 0.4 },
  ];

  constructor() {
    const meshes = this.defs.map(createIsland);
    this.group.add(...meshes);
    const motu = meshes[3];

    const spots = [
      [-8, 2, 11],
      [4, -3, 9],
      [14, 4, 12.5],
      [-20, -4, 8],
      [24, -6, 10],
      [-2, 9, 7.5],
    ];
    spots.forEach(([dx, dz, h], i) => {
      const lean = new THREE.Vector3(hash(i, 1, 9) - 0.5, 0, hash(i, 2, 9) - 0.5).normalize().multiplyScalar(0.6);
      const palm = createPalm(h, lean, i + 1);
      const local = new THREE.Vector3(dx, 2.2, dz).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
      palm.position.copy(motu.position).add(local);
      this.palms.push(palm);
      this.group.add(palm);
    });
  }

  /** Highest terrain at world (x, z); about -3 in open water. Above ~-0.5 is shore. */
  groundHeight(x: number, z: number) {
    let best = -3;
    for (const o of this.defs) {
      const dx = x - o.x;
      const dz = z - o.z;
      const reach = o.radius * Math.max(1, o.stretch ?? 1) * 1.35;
      if (dx * dx + dz * dz > reach * reach) continue;
      const c = Math.cos(o.rotation ?? 0);
      const s = Math.sin(o.rotation ?? 0);
      best = Math.max(best, islandHeight(o, dx * c - dz * s, dx * s + dz * c));
    }
    return best;
  }

  update({ time }: FrameContext) {
    this.palms.forEach((palm, i) => {
      const crown = palm.userData.crown as THREE.Group;
      crown.rotation.z = Math.sin(time * 0.7 + i * 1.3) * 0.04;
      crown.rotation.x = Math.sin(time * 0.53 + i * 2.1) * 0.03;
    });
  }
}
