import * as THREE from 'three';
import { config } from '../../config';
import type { FrameContext, System } from '../../engine/Engine';
import type { Environment } from '../Environment';
import { Waves } from './Waves';
import { RippleSim, type Disturbance } from './RippleSim';
import { createDetailTexture } from './detailTexture';

/**
 * Polar grid: dense rings near the center, exponentially sparser toward the
 * horizon. The mesh follows the camera, so detail is always where you look.
 */
function createPolarGrid(rings: number, segments: number, firstSpacing: number, radius: number) {
  let lo = 1e-4;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const b = (lo + hi) / 2;
    const r = (firstSpacing / b) * (Math.exp(b * rings) - 1);
    if (r > radius) hi = b;
    else lo = b;
  }
  const b = lo;
  const a = firstSpacing / b;

  const positions = new Float32Array((rings * segments + 1) * 3);
  let p = 3;
  for (let i = 1; i <= rings; i++) {
    const r = a * (Math.exp(b * i) - 1);
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2;
      positions[p++] = Math.cos(t) * r;
      positions[p++] = 0;
      positions[p++] = Math.sin(t) * r;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < segments; j++) {
    indices.push(0, 1 + ((j + 1) % segments), 1 + j);
  }
  for (let i = 0; i < rings - 1; i++) {
    const r0 = 1 + i * segments;
    const r1 = r0 + segments;
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments;
      indices.push(r0 + j, r0 + j1, r1 + j);
      indices.push(r0 + j1, r1 + j1, r1 + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
  return geo;
}

export class Ocean implements System {
  readonly waves = new Waves();
  readonly ripples: RippleSim;
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private time = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    private camera: THREE.Camera,
    env: Environment,
  ) {
    this.ripples = new RippleSim(renderer);
    const c = config.ocean;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaveA: { value: this.waves.uniformA },
        uWaveB: { value: this.waves.uniformB },
        uRipples: { value: this.ripples.texture },
        uRippleRect: { value: new THREE.Vector4(0, 0, this.ripples.size, 1 / this.ripples.resolution) },
        uDetail: { value: createDetailTexture() },
        uDetailStrength: { value: c.detailStrength },
        uEnv: { value: env.cubeTarget.texture },
        uSunDir: { value: env.sunDirection },
        uSunColor: { value: env.sunColor },
        uDeepColor: { value: new THREE.Color().fromArray(c.deepColor) },
        uScatterColor: { value: new THREE.Color().fromArray(c.scatterColor) },
      },
      vertexShader: /* glsl */ `
        ${this.waves.glsl()}
        uniform float uTime;
        uniform sampler2D uRipples;
        uniform vec4 uRippleRect;
        varying vec3 vWorld;
        varying vec2 vRest;
        varying float vHeight;

        vec2 rippleUv(vec2 p) {
          return vec2((p.x - uRippleRect.x) / uRippleRect.z + 0.5, 0.5 - (p.y - uRippleRect.y) / uRippleRect.z);
        }

        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vec2 p = world.xz;
          float dist = length(p - cameraPosition.xz);
          vec3 d = gerstner(p, uTime, dist);

          vec2 ruv = rippleUv(p);
          vec2 e = min(ruv, 1.0 - ruv);
          float edge = smoothstep(0.0, 0.1, min(e.x, e.y));
          d.y += texture2D(uRipples, ruv).r * edge;

          world.xyz += d;
          vWorld = world.xyz;
          vRest = p;
          vHeight = d.y;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        ${this.waves.glsl()}
        uniform float uTime;
        uniform sampler2D uRipples;
        uniform vec4 uRippleRect;
        uniform sampler2D uDetail;
        uniform float uDetailStrength;
        uniform samplerCube uEnv;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uDeepColor;
        uniform vec3 uScatterColor;
        varying vec3 vWorld;
        varying vec2 vRest;
        varying float vHeight;

        vec2 rippleUv(vec2 p) {
          return vec2((p.x - uRippleRect.x) / uRippleRect.z + 0.5, 0.5 - (p.y - uRippleRect.y) / uRippleRect.z);
        }

        vec2 detail(vec2 uv) { return texture2D(uDetail, uv).rg * 2.0 - 1.0; }

        void main() {
          vec3 toCam = cameraPosition - vWorld;
          float dist = length(toCam);
          vec3 V = toCam / dist;
          float footprint = length(fwidth(vRest));

          vec2 slope = gerstnerSlope(vRest, uTime, footprint);

          float detailFade = 1.0 - smoothstep(30.0, 400.0, dist) * 0.75;
          vec2 d1 = detail(vRest / 11.0 + uTime * vec2(0.021, 0.013));
          vec2 d2 = detail(vRest / 4.3 + uTime * vec2(-0.035, 0.028));
          vec2 d3 = detail(vRest / 1.7 + uTime * vec2(0.05, -0.06));
          slope += (d1 * 0.5 + d2 * 0.35 + d3 * 0.2 * (1.0 - smoothstep(10.0, 60.0, dist))) * uDetailStrength * detailFade;

          vec2 ruv = rippleUv(vRest);
          vec2 e = min(ruv, 1.0 - ruv);
          float edge = smoothstep(0.0, 0.1, min(e.x, e.y));
          float tx = uRippleRect.w;
          float texelWorld = uRippleRect.z * tx;
          vec4 rc = texture2D(uRipples, ruv);
          float hl = texture2D(uRipples, ruv - vec2(tx, 0.0)).r;
          float hr = texture2D(uRipples, ruv + vec2(tx, 0.0)).r;
          float hd = texture2D(uRipples, ruv - vec2(0.0, tx)).r;
          float hu = texture2D(uRipples, ruv + vec2(0.0, tx)).r;
          slope += vec2(hr - hl, -(hu - hd)) / (2.0 * texelWorld) * edge;
          float foam = rc.b * edge;

          vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
          vec3 L = uSunDir;

          float NdV = max(dot(N, V), 0.0);
          float fresnel = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);

          vec3 R = reflect(-V, N);
          R.y = max(R.y, 0.015);
          R = normalize(R);
          vec3 reflection = textureCube(uEnv, R).rgb;

          // Body color: deep blue lit by the sky, plus turquoise light scattered through crests.
          float sunUp = clamp(L.y * 4.0, 0.0, 1.0);
          vec3 body = uDeepColor * (0.35 + 0.65 * sunUp);
          float crest = clamp(vHeight * 1.6 + 0.45, 0.0, 1.0);
          float through = pow(clamp(dot(-V, L), 0.0, 1.0), 4.0);
          float sss = (through * 1.4 + 0.3) * crest;
          body += uScatterColor * sss * uSunColor * 0.07;

          // Sun glitter: normalized Blinn-Phong that widens with distance (unresolved micro waves).
          vec3 H = normalize(L + V);
          float rough = smoothstep(0.0, 2.0, footprint);
          float n = mix(2400.0, 380.0, rough);
          float specF = 0.02 + 0.98 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
          float spec = (n + 8.0) / 25.13 * pow(max(dot(N, H), 0.0), n) * max(dot(N, L), 0.0);
          vec3 sun = uSunColor * spec * specF * 0.9;

          vec3 col = mix(body, reflection, fresnel) + sun;

          // Foam from splashes, broken up by the detail pattern.
          float foamNoise = texture2D(uDetail, vRest / 2.1 + uTime * 0.02).b;
          float foamMask = smoothstep(0.25, 0.75, foam * (0.55 + 0.9 * foamNoise));
          vec3 foamCol = vec3(0.9, 0.95, 0.97) * (uSunColor * 0.18 * max(N.y, 0.0) + reflection * 0.6);
          col = mix(col, foamCol, foamMask * 0.9);

          // Melt into the horizon.
          vec3 horizonDir = normalize(vec3(-V.x, 0.015, -V.z));
          vec3 horizon = textureCube(uEnv, horizonDir).rgb;
          float haze = 1.0 - exp(-dist * 0.00028);
          col = mix(col, horizon, haze * haze);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(createPolarGrid(520, 560, 0.22, c.meshRadius), this.material);
    this.mesh.frustumCulled = false;
  }

  /** Surface height (excluding ripples) at world (x, z). */
  heightAt(x: number, z: number) {
    return this.waves.heightAt(x, z, this.time);
  }

  heightAtTime(x: number, z: number, t: number) {
    return this.waves.heightAt(x, z, t);
  }

  disturb(d: Disturbance) {
    this.ripples.disturb(d);
  }

  fixedUpdate({ time }: FrameContext) {
    this.time = time;
    this.ripples.followPoint(this.camera.position.x, this.camera.position.z);
    this.ripples.step();
    this.material.uniforms.uRipples.value = this.ripples.texture;
    const rect = this.material.uniforms.uRippleRect.value as THREE.Vector4;
    rect.x = this.ripples.center.x;
    rect.y = this.ripples.center.y;
  }

  update({ time }: FrameContext) {
    this.time = time;
    this.material.uniforms.uTime.value = time;
    this.mesh.position.set(Math.round(this.camera.position.x), 0, Math.round(this.camera.position.z));
  }

  dispose() {
    this.ripples.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
