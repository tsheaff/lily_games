import * as THREE from 'three';
import { config } from '../../config';

export interface WaveComponent {
  dirX: number;
  dirZ: number;
  k: number;
  amplitude: number;
  /** Gerstner horizontal displacement factor. */
  q: number;
  omega: number;
  phase: number;
  wavelength: number;
}

/**
 * Sum of Gerstner waves. The same parameters drive the GPU vertex shader
 * and the CPU `heightAt` query, so floating objects sit on the rendered surface.
 */
export class Waves {
  readonly components: WaveComponent[];
  /** Packed for shaders: A = (dirX, dirZ, k, amplitude), B = (q, omega, phase, wavelength). */
  readonly uniformA: THREE.Vector4[];
  readonly uniformB: THREE.Vector4[];

  constructor(defs = config.ocean.waves, gravity = config.ocean.gravity) {
    const n = defs.length;
    this.components = defs.map((w, i) => {
      const a = THREE.MathUtils.degToRad(w.direction);
      const k = (2 * Math.PI) / w.wavelength;
      return {
        dirX: Math.sin(a),
        dirZ: -Math.cos(a),
        k,
        amplitude: w.amplitude,
        q: w.steepness / (k * w.amplitude * n),
        omega: Math.sqrt(gravity * k),
        phase: i * 1.7,
        wavelength: w.wavelength,
      };
    });
    this.uniformA = this.components.map((c) => new THREE.Vector4(c.dirX, c.dirZ, c.k, c.amplitude));
    this.uniformB = this.components.map((c) => new THREE.Vector4(c.q, c.omega, c.phase, c.wavelength));
  }

  get count() {
    return this.components.length;
  }

  /** Displacement of the surface point whose rest position is (x, z). */
  displacement(x: number, z: number, t: number, out = new THREE.Vector3()) {
    out.set(0, 0, 0);
    for (const c of this.components) {
      const ph = c.k * (c.dirX * x + c.dirZ * z) - c.omega * t + c.phase;
      const cos = Math.cos(ph);
      out.x += c.q * c.amplitude * c.dirX * cos;
      out.z += c.q * c.amplitude * c.dirZ * cos;
      out.y += c.amplitude * Math.sin(ph);
    }
    return out;
  }

  private tmp = new THREE.Vector3();

  /** Water surface height at world (x, z), inverting the horizontal Gerstner shift. */
  heightAt(x: number, z: number, t: number) {
    let px = x;
    let pz = z;
    for (let i = 0; i < 4; i++) {
      const d = this.displacement(px, pz, t, this.tmp);
      px = x - d.x;
      pz = z - d.z;
    }
    return this.displacement(px, pz, t, this.tmp).y;
  }

  /** GLSL that defines `gerstner(p, t, fade)` and `gerstnerSlope(p, t, footprint)`. */
  glsl() {
    return /* glsl */ `
      #define WAVE_COUNT ${this.count}
      uniform vec4 uWaveA[WAVE_COUNT];
      uniform vec4 uWaveB[WAVE_COUNT];

      vec3 gerstner(vec2 p, float t, float dist) {
        vec3 d = vec3(0.0);
        for (int i = 0; i < WAVE_COUNT; i++) {
          vec4 a = uWaveA[i];
          vec4 b = uWaveB[i];
          float fade = 1.0 - smoothstep(b.w * 12.0, b.w * 24.0, dist);
          float ph = a.z * dot(a.xy, p) - b.y * t + b.z;
          float c = cos(ph);
          d.xz += b.x * a.w * a.xy * c * fade;
          d.y += a.w * sin(ph) * fade;
        }
        return d;
      }

      vec2 gerstnerSlope(vec2 p, float t, float footprint) {
        vec2 s = vec2(0.0);
        for (int i = 0; i < WAVE_COUNT; i++) {
          vec4 a = uWaveA[i];
          vec4 b = uWaveB[i];
          float fade = 1.0 - smoothstep(b.w * 0.12, b.w * 0.5, footprint);
          float ph = a.z * dot(a.xy, p) - b.y * t + b.z;
          s += a.xy * (a.z * a.w * cos(ph)) * fade;
        }
        return s;
      }
    `;
  }
}
