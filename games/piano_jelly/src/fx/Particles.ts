import * as THREE from 'three';
import type { FrameContext, System } from '../engine/Engine';
import type { Ocean } from '../world/ocean/Ocean';
import type { Environment } from '../world/Environment';

const MAX = 10000;

export interface BurstOptions {
  count: number;
  /** Random spherical speed range (m/s). */
  speed: [number, number];
  /** Extra upward velocity range (m/s). */
  up?: [number, number];
  size: [number, number];
  life: [number, number];
  /** Linear HDR color; values above ~3 bloom. Ignored when `water` is set. */
  color?: THREE.Color;
  /** Shade like sunlit water spray instead of a flat color. */
  water?: boolean;
  /** Multiplier on gravity: 1 falls, negative rises (smoke). */
  gravity?: number;
  drag?: number;
  /** Spawn radius around the origin. */
  spread?: number;
  /** Particles die (and dimple the water) when they fall below the surface. */
  killOnWater?: boolean;
}

const rand = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);

/**
 * One pooled point-sprite system for all particle effects: spray, sparks,
 * smoke. Particles may splash back into the ocean.
 */
export class Particles implements System {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private color = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private lifeFrac = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private water = new Float32Array(MAX);
  private gravity = new Float32Array(MAX);
  private drag = new Float32Array(MAX);
  private killOnWater = new Uint8Array(MAX);
  private cursor = 0;
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;

  constructor(
    private ocean: Ocean,
    env: Environment,
  ) {
    const dyn = (arr: Float32Array, n: number) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', dyn(this.pos, 3));
    this.geometry.setAttribute('aLife', dyn(this.lifeFrac, 1));
    this.geometry.setAttribute('aSize', dyn(this.size, 1));
    this.geometry.setAttribute('aColor', dyn(this.color, 3));
    this.geometry.setAttribute('aWater', dyn(this.water, 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 1 },
        uSunColor: { value: env.sunColor },
        uSunDir: { value: env.sunDirection },
        uSky: { value: env.fog.color },
      },
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSize;
        attribute vec3 aColor;
        attribute float aWater;
        uniform float uScale;
        uniform vec3 uSunDir;
        varying float vLife;
        varying float vFacing;
        varying vec3 vColor;
        varying float vWater;
        void main() {
          vLife = aLife;
          vColor = aColor;
          vWater = aWater;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 view = normalize(position - cameraPosition);
          vFacing = pow(max(dot(view, uSunDir), 0.0), 6.0);
          gl_PointSize = aLife > 0.0 ? aSize * uScale / -mv.z : 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor;
        uniform vec3 uSky;
        varying float vLife;
        varying float vFacing;
        varying vec3 vColor;
        varying float vWater;
        void main() {
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float r = dot(c, c);
          if (r > 1.0) discard;
          float fade = clamp(vLife * 3.0, 0.0, 1.0);
          float alpha = pow(1.0 - r, 1.5) * fade * mix(0.9, 0.6, vWater);
          vec3 spray = uSky * 0.9 + uSunColor * (0.12 + vFacing * 1.5);
          gl_FragColor = vec4(mix(vColor, spray, vWater), alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  burst(at: THREE.Vector3, o: BurstOptions) {
    const col = o.color ?? new THREE.Color(1, 1, 1);
    const spread = o.spread ?? 0;
    for (let n = 0; n < o.count; n++) {
      const i = this.next();
      const j = i * 3;
      const dir = new THREE.Vector3().randomDirection();
      const s = rand(o.speed);
      this.pos[j] = at.x + dir.x * spread;
      this.pos[j + 1] = at.y + dir.y * spread;
      this.pos[j + 2] = at.z + dir.z * spread;
      this.vel[j] = dir.x * s;
      this.vel[j + 1] = dir.y * s + (o.up ? rand(o.up) : 0);
      this.vel[j + 2] = dir.z * s;
      this.spawn(i, rand(o.life), rand(o.size), col, o);
    }
  }

  /** Water spray for an impact. `energy` ~ impact speed in m/s. */
  splash(at: THREE.Vector3, energy: number, radius: number) {
    const e = THREE.MathUtils.clamp(energy / 14, 0.15, 1.6);
    const count = Math.floor(520 * e + 80);
    const opts = { water: true, killOnWater: true, gravity: 1, drag: 0.6 } as BurstOptions;
    for (let n = 0; n < count; n++) {
      const i = this.next();
      const j = i * 3;
      const a = Math.random() * Math.PI * 2;
      const jet = Math.random() < 0.28;
      const ring = radius * (0.6 + Math.random() * 0.8) * (jet ? 0.3 : 1);
      const out = jet ? Math.random() * 0.6 : 1.2 + Math.random() * 2.2;
      const up = jet ? 4 + Math.random() * 5.5 : 1.5 + Math.random() * 3.2;
      this.pos[j] = at.x + Math.cos(a) * ring;
      this.pos[j + 1] = at.y + 0.05;
      this.pos[j + 2] = at.z + Math.sin(a) * ring;
      this.vel[j] = Math.cos(a) * out * e;
      this.vel[j + 1] = up * Math.sqrt(e);
      this.vel[j + 2] = Math.sin(a) * out * e;
      const size = (jet ? 0.06 : 0.04) + Math.random() * Math.random() * 0.1;
      this.spawn(i, 0.9 + Math.random(), size * Math.max(1, radius / 0.4), undefined, opts);
    }
  }

  private next() {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    return i;
  }

  private spawn(i: number, life: number, size: number, col: THREE.Color | undefined, o: Partial<BurstOptions>) {
    this.life[i] = life;
    this.maxLife[i] = life;
    this.lifeFrac[i] = 1;
    this.size[i] = size;
    this.water[i] = o.water ? 1 : 0;
    this.gravity[i] = o.gravity ?? 1;
    this.drag[i] = o.drag ?? 0.6;
    this.killOnWater[i] = o.killOnWater === false ? 0 : 1;
    if (col) this.color.set([col.r, col.g, col.b], i * 3);
  }

  update({ dt }: FrameContext) {
    if (dt === 0) return;
    const g = 9.81;
    let landed = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.lifeFrac[i] = Math.max(0, this.life[i] / this.maxLife[i]) * (this.life[i] > 0 ? 1 : 0);
      const j = i * 3;
      this.vel[j + 1] -= g * this.gravity[i] * dt;
      const drag = Math.exp(-this.drag[i] * dt);
      this.vel[j] *= drag;
      this.vel[j + 1] *= this.gravity[i] < 0 ? drag : 1;
      this.vel[j + 2] *= drag;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      if (
        this.killOnWater[i] &&
        this.vel[j + 1] < 0 &&
        this.pos[j + 1] < this.ocean.heightAt(this.pos[j], this.pos[j + 2])
      ) {
        if (this.water[i] && landed++ < 24 && Math.random() < 0.35) {
          this.ocean.disturb({ x: this.pos[j], z: this.pos[j + 2], radius: 0.25, strength: -0.006, foam: 0.25 });
        }
        this.life[i] = 0;
        this.lifeFrac[i] = 0;
      }
    }
    for (const name of ['position', 'aLife', 'aSize', 'aColor', 'aWater']) {
      (this.geometry.attributes[name] as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  resize(_w: number, h: number) {
    this.material.uniforms.uScale.value = h * 1.1;
  }
}
