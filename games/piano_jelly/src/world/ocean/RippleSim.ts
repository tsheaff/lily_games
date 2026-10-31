import * as THREE from 'three';
import { config } from '../../config';

const MAX_DROPS = 32;

export interface Disturbance {
  x: number;
  z: number;
  radius: number;
  /** Height change in meters applied this step (negative pushes water down). */
  strength: number;
  /** Foam added at the center (0..1). */
  foam?: number;
}

/**
 * GPU wave-equation heightfield for local ripples. State texture channels:
 * R = height, G = previous height, B = foam.
 */
export class RippleSim {
  readonly resolution: number;
  readonly size: number;
  readonly center = new THREE.Vector2();
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private current = 0;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private pending: Disturbance[] = [];
  private drops = Array.from({ length: MAX_DROPS }, () => new THREE.Vector4());
  private dropFoam = new Float32Array(MAX_DROPS);

  constructor(private renderer: THREE.WebGLRenderer) {
    this.resolution = config.ripples.resolution;
    this.size = config.ripples.size;
    const make = () =>
      new THREE.WebGLRenderTarget(this.resolution, this.resolution, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
      });
    this.targets = [make(), make()];

    const dx = this.size / this.resolution;
    const courant = (config.ripples.waveSpeed * (1 / 60)) / dx;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null },
        uTexel: { value: new THREE.Vector2(1 / this.resolution, 1 / this.resolution) },
        uCourant2: { value: courant * courant },
        uDamping: { value: config.ripples.damping },
        uFoamDecay: { value: config.ripples.foamDecay },
        uDrops: { value: this.drops },
        uDropFoam: { value: this.dropFoam },
        uDropCount: { value: 0 },
        uShift: { value: new THREE.Vector2() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        #define MAX_DROPS ${MAX_DROPS}
        uniform sampler2D uState;
        uniform vec2 uTexel;
        uniform float uCourant2;
        uniform float uDamping;
        uniform float uFoamDecay;
        uniform vec4 uDrops[MAX_DROPS];
        uniform float uDropFoam[MAX_DROPS];
        uniform int uDropCount;
        varying vec2 vUv;

        uniform vec2 uShift;

        void main() {
          // uShift scrolls the grid when the simulated area follows the player.
          vec2 p = vUv + uShift;
          vec4 s = texture2D(uState, p);
          if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) s = vec4(0.0);
          float h = s.r;
          float l = texture2D(uState, p - vec2(uTexel.x, 0.0)).r;
          float r = texture2D(uState, p + vec2(uTexel.x, 0.0)).r;
          float d = texture2D(uState, p - vec2(0.0, uTexel.y)).r;
          float u = texture2D(uState, p + vec2(0.0, uTexel.y)).r;
          float lap = l + r + d + u - 4.0 * h;
          float next = (2.0 * h - s.g + uCourant2 * lap) * uDamping;
          float foam = s.b * uFoamDecay;

          for (int i = 0; i < MAX_DROPS; i++) {
            if (i >= uDropCount) break;
            vec4 drop = uDrops[i];
            vec2 q = (vUv - drop.xy) / drop.z;
            float f = max(0.0, 1.0 - dot(q, q));
            f *= f;
            next += drop.w * f;
            foam = max(foam, uDropFoam[i] * f);
          }

          vec2 e = min(vUv, 1.0 - vUv);
          float edge = smoothstep(0.0, 0.08, min(e.x, e.y));
          next *= mix(0.94, 1.0, edge);

          gl_FragColor = vec4(next, h, foam, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);

    for (const t of this.targets) {
      renderer.setRenderTarget(t);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
    }
    renderer.setRenderTarget(null);
  }

  get texture() {
    return this.targets[this.current].texture;
  }

  disturb(d: Disturbance) {
    this.pending.push(d);
  }

  private follow = new THREE.Vector2();

  /** Keep the simulated square centered near (x, z); shifts happen in whole texels. */
  followPoint(x: number, z: number) {
    this.follow.set(x, z);
  }

  step() {
    const texel = this.size / this.resolution;
    const kx = Math.round((this.follow.x - this.center.x) / texel);
    const kz = Math.round((this.follow.y - this.center.y) / texel);
    const shift = this.material.uniforms.uShift.value as THREE.Vector2;
    if (Math.abs(kx) >= 4 || Math.abs(kz) >= 4) {
      this.center.x += kx * texel;
      this.center.y += kz * texel;
      shift.set(kx / this.resolution, -kz / this.resolution);
    } else {
      shift.set(0, 0);
    }

    const batch = this.pending
      .sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength))
      .slice(0, MAX_DROPS);
    this.pending = [];

    let n = 0;
    for (const d of batch) {
      const u = (d.x - this.center.x) / this.size + 0.5;
      const v = 0.5 - (d.z - this.center.y) / this.size;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const texelRadius = Math.max(d.radius / this.size, 2.2 / this.resolution);
      this.drops[n].set(u, v, texelRadius, d.strength);
      this.dropFoam[n] = d.foam ?? 0;
      n++;
    }
    this.material.uniforms.uDropCount.value = n;

    const read = this.targets[this.current];
    const write = this.targets[1 - this.current];
    this.material.uniforms.uState.value = read.texture;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(write);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prev);
    this.current = 1 - this.current;
  }

  dispose() {
    this.targets.forEach((t) => t.dispose());
    this.material.dispose();
  }
}
