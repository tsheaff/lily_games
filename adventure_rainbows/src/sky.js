import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFrag = /* glsl */ `
uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor;
uniform float uStars, uTime;
varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0
    ? mix(uHorizon, uTop, pow(h, 0.55))
    : mix(uHorizon, uBottom, pow(min(-h * 4.0, 1.0), 0.7));
  col += uHorizon * 0.22 * exp(-abs(h) * 16.0);

  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 6.0) * 0.2 + pow(sd, 90.0) * 0.6);
  col += uSunColor * smoothstep(0.9990, 0.9995, sd) * 3.0;

  if (uStars > 0.001 && h > 0.0) {
    vec3 cell = floor(d * 240.0);
    float r = hash(cell);
    if (r > 0.993) {
      vec3 center = normalize((cell + 0.5) / 240.0);
      float dd = length(d - center) * 240.0;
      float tw = 0.6 + 0.4 * sin(uTime * (2.0 + r * 30.0) + r * 100.0);
      col += vec3(1.0, 0.95, 1.0) * (1.0 - smoothstep(0.0, 0.32, dd)) * tw * uStars * smoothstep(0.04, 0.35, h) * 1.4;
    }
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uStars: { value: 0 },
    uTime: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 48, 24),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

const cloudVert = /* glsl */ `
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const cloudFrag = /* glsl */ `
uniform vec3 uSunDir, uSunColor, uShadow, uHorizon;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vec3 N = normalize(vN);
  float l = dot(N, uSunDir) * 0.5 + 0.5;
  float up = N.y * 0.5 + 0.5;
  float lit = smoothstep(0.15, 0.95, l * 0.55 + up * 0.6);
  vec3 col = mix(uShadow, vec3(0.93) + uSunColor * 0.16, lit);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uSunColor * rim * 0.3 * l;
  float h = clamp((vWorld.y - cameraPosition.y) / 180.0, 0.0, 1.0);
  col = mix(uHorizon, col, 0.55 + 0.4 * h);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createClouds(rng) {
  const parts = [];
  const count = 16;
  for (let c = 0; c < count; c++) {
    const a = (c / count) * Math.PI * 2 + rng() * 0.3;
    const dist = 680 + rng() * 260;
    const cy = 70 + rng() * 120;
    const scale = 16 + rng() * 22;
    const puffs = 5 + Math.floor(rng() * 5);
    const cloud = [];
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5;
      const s = scale * (0.5 + 0.5 * Math.cos(t * Math.PI)) * (0.7 + rng() * 0.45);
      const g = new THREE.IcosahedronGeometry(1, 2);
      g.scale(s, s * 0.82, s);
      g.translate(t * scale * 2.6 + (rng() - 0.5) * scale * 0.4, rng() * 0.35 * s, (rng() - 0.5) * scale * 0.8);
      cloud.push(g);
    }
    const g = mergeGeometries(cloud);
    const pos = g.attributes.position;
    const floor = -scale * 0.22;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < floor) pos.setY(i, floor);
    g.rotateY(a);
    g.translate(Math.sin(a) * dist, cy, Math.cos(a) * dist);
    parts.push(g);
  }
  const uniforms = {
    uSunDir: { value: new THREE.Vector3() },
    uSunColor: { value: new THREE.Color() },
    uShadow: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
  };
  const mesh = new THREE.Mesh(
    mergeGeometries(parts),
    new THREE.ShaderMaterial({ uniforms, vertexShader: cloudVert, fragmentShader: cloudFrag })
  );
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
