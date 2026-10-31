import * as THREE from 'three';
import { WAVES_GLSL } from './waves.js';

const ISLAND_GLSL = (n) => /* glsl */ `
uniform vec4 uIslands[${n}];
float shoreDist(vec2 p) {
  float m = 1e4;
  for (int i = 0; i < ${n}; i++) m = min(m, length(p - uIslands[i].xy) - uIslands[i].z);
  return m;
}
`;

const vert = (n) => /* glsl */ `
uniform float uTime;
${ISLAND_GLSL(n)}
${WAVES_GLSL}
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;
varying float vShore;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float sd = shoreDist(wp.xz);
  float damp = 0.25 + 0.75 * smoothstep(0.0, 30.0, sd);
  vec3 T = vec3(1.0, 0.0, 0.0);
  vec3 B = vec3(0.0, 0.0, 1.0);
  vec3 disp = gerstner(wp.xz, uTime, damp, T, B);
  wp.xyz += disp;
  vNormal = normalize(cross(B, T));
  vHeight = disp.y;
  vWorld = wp.xyz;
  vShore = sd;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform vec3 uDeep, uShallow, uLagoon, uSkyTop, uSkyHorizon, uSunDir, uSunColor, uFogColor;
uniform float uTime, uFogNear, uFogFar;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;
varying float vShore;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 ripple(vec2 p) {
  float e = 0.15;
  float n = noise(p);
  return vec2(noise(p + vec2(e, 0.0)) - n, noise(p + vec2(0.0, e)) - n) / e;
}

void main() {
  vec2 p = vWorld.xz;
  float dist = length(cameraPosition - vWorld);
  float detail = 1.0 - smoothstep(60.0, 400.0, dist);
  vec2 g = ripple(p * 0.45 + vec2(uTime * 0.35, uTime * 0.2)) * 0.6
         + ripple(p * 1.1 - vec2(uTime * 0.25, -uTime * 0.4)) * 0.35;
  vec3 N = normalize(vNormal + vec3(-g.x, 0.0, -g.y) * 0.14 * detail);
  vec3 V = normalize(cameraPosition - vWorld);

  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(R.y, 0.6));
  sky += uSunColor * pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.35;

  float crestT = clamp(vHeight * 0.45 + 0.5, 0.0, 1.0);
  vec3 water = mix(uDeep, uShallow, crestT * 0.7);
  float sss = pow(max(dot(-V, uSunDir), 0.0), 3.0) * smoothstep(0.0, 1.2, vHeight);
  water += uShallow * sss * 0.7;
  float lagoon = 1.0 - smoothstep(0.0, 16.0, vShore);
  water = mix(water, uLagoon, lagoon * 0.9);

  vec3 col = mix(water, sky, fres * 0.85);
  vec3 H = normalize(uSunDir + V);
  float NdH = max(dot(N, H), 0.0);
  col += uSunColor * (pow(NdH, 900.0) * 1.6 + pow(NdH, 80.0) * 0.06);

  float fn = noise(p * 0.6 + uTime * 0.3) * 0.6 + noise(p * 1.7 - uTime * 0.2) * 0.4;
  float streak = smoothstep(0.45, 0.8, noise(p * vec2(2.4, 1.2) + uTime * 0.4));
  float crest = smoothstep(1.0, 1.5, vHeight + fn * 0.5) * streak * detail * 0.8;
  float shoreFoam = 1.0 - smoothstep(0.0, 2.2, vShore + fn * 1.6 - 0.4);
  float ring = smoothstep(0.55, 0.95, sin(vShore * 1.1 - uTime * 1.8) * 0.5 + 0.5)
             * (1.0 - smoothstep(1.0, 9.0, vShore)) * step(0.0, vShore) * smoothstep(0.35, 0.65, fn);
  float foam = clamp(crest * 0.8 + shoreFoam + ring * 0.7, 0.0, 1.0);
  vec3 foamCol = mix(vec3(1.0), uSunColor, 0.25);
  col = mix(col, foamCol, foam * 0.9);

  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createOcean(shared, islandUniforms) {
  // Grid is denser near the boat and stretches out toward the horizon.
  const HALF = 900;
  const geo = new THREE.PlaneGeometry(2, 2, 300, 300);
  const pos = geo.attributes.position;
  const remap = (u) => Math.sign(u) * (0.3 * Math.abs(u) + 0.7 * Math.abs(u) ** 3) * HALF;
  for (let i = 0; i < pos.count; i++) pos.setXY(i, remap(pos.getX(i)), remap(pos.getY(i)));
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: shared.uTime,
    uIslands: { value: islandUniforms },
    uDeep: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color() },
    uLagoon: { value: new THREE.Color() },
    uSkyTop: { value: new THREE.Color() },
    uSkyHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() },
    uSunColor: { value: new THREE.Color() },
    uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 160 },
    uFogFar: { value: 720 },
  };
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert(islandUniforms.length),
      fragmentShader: frag,
    })
  );
  mesh.frustumCulled = false;

  return {
    mesh,
    uniforms,
    follow(x, z) {
      const step = 4;
      mesh.position.set(Math.round(x / step) * step, 0, Math.round(z / step) * step);
    },
  };
}
