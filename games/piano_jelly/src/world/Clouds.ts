import * as THREE from 'three';
import { config } from '../config';

/** A procedural cumulus layer projected onto a dome inside the sky box. */
export class Clouds {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(sunDirection: THREE.Vector3, sunColor: THREE.Color) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: sunDirection },
        uSunColor: { value: sunColor },
        uCoverage: { value: config.clouds.coverage },
        uBrightness: { value: config.clouds.brightness },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uCoverage;
        uniform float uBrightness;
        varying vec3 vDir;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 6; i++) { v += a * noise(p); p = r * p * 2.03; a *= 0.5; }
          return v;
        }

        void main() {
          vec3 d = normalize(vDir);
          if (d.y <= 0.0) discard;
          vec2 uv = d.xz / (d.y + 0.06) * 0.9;
          vec2 wind = vec2(1.0, 0.3) * uTime * ${config.clouds.speed.toFixed(5)};
          float n = fbm(uv + wind);
          float detail = fbm(uv * 3.1 - wind * 2.0);
          float shape = n * 0.8 + detail * 0.2;

          float lo = 1.0 - uCoverage;
          float density = smoothstep(lo, lo + 0.22, shape);
          float horizon = smoothstep(0.0, 0.1, d.y);
          float zenith = 1.0 - 0.6 * smoothstep(0.3, 0.85, d.y);
          float alpha = density * horizon * zenith * 0.92;
          if (alpha < 0.002) discard;

          float thickness = smoothstep(lo + 0.05, lo + 0.45, shape);
          float toSun = max(dot(d, uSunDir), 0.0);
          vec3 lit = vec3(1.0, 0.98, 0.96);
          vec3 shade = vec3(0.62, 0.68, 0.8);
          vec3 col = mix(lit, shade, thickness * 0.85) * uBrightness;
          col += uSunColor * (pow(toSun, 6.0) * 1.4 + pow(toSun, 40.0) * 2.5) * (1.0 - thickness * 0.6);
          col = mix(col, col * vec3(1.05, 0.92, 0.85), smoothstep(0.25, 0.0, d.y));
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(8500, 48, 24), this.material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  update(time: number, cameraPosition: THREE.Vector3) {
    this.material.uniforms.uTime.value = time;
    this.mesh.position.copy(cameraPosition);
  }
}
