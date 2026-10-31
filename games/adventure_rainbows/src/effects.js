import * as THREE from 'three';
import { SPECTRUM_HEX } from './utils.js';

export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.65)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const sparkleVert = /* glsl */ `
attribute float aPhase;
attribute float aRadius;
attribute float aHeight;
attribute float aSize;
uniform float uTime, uScale, uOpacity;
varying float vAlpha;
void main() {
  float a = aPhase * 6.2831 + uTime * (0.4 + aPhase * 0.6);
  vec3 p = vec3(cos(a) * aRadius, aHeight + sin(uTime * 1.3 + aPhase * 20.0) * 0.6, sin(a) * aRadius);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = pow(0.5 + 0.5 * sin(uTime * (3.0 + aPhase * 4.0) + aPhase * 50.0), 2.0);
  vAlpha = tw * uOpacity;
  gl_PointSize = aSize * uScale / -mv.z * (0.6 + 0.8 * tw);
  gl_Position = projectionMatrix * mv;
}
`;

export const STAR_POINT_FRAG = /* glsl */ `
float starShape(vec2 c) {
  float core = exp(-dot(c, c) * 80.0);
  float rays = exp(-abs(c.x) * 30.0) * exp(-abs(c.y) * 5.0) + exp(-abs(c.y) * 30.0) * exp(-abs(c.x) * 5.0);
  return core + rays * 0.7;
}
`;

const sparkleFrag = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
${STAR_POINT_FRAG}
void main() {
  float a = starShape(gl_PointCoord - 0.5) * vAlpha;
  gl_FragColor = vec4(uColor * 2.0, a);
}
`;

/** Twinkly star sparkles orbiting around the object's origin. */
export function makeSparkles(shared, { count = 24, radius = 3, height = 3, size = 0.6, color = '#ffffff' } = {}) {
  const geo = new THREE.BufferGeometry();
  const phase = new Float32Array(count);
  const rad = new Float32Array(count);
  const hgt = new Float32Array(count);
  const sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    phase[i] = Math.random();
    rad[i] = radius * (0.4 + Math.random() * 0.8);
    hgt[i] = Math.random() * height;
    sz[i] = size * (0.6 + Math.random() * 0.8);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aRadius', new THREE.BufferAttribute(rad, 1));
  geo.setAttribute('aHeight', new THREE.BufferAttribute(hgt, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uScale: shared.uScale,
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: sparkleVert,
    fragmentShader: sparkleFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

const wakeVert = /* glsl */ `
attribute float aLife;
attribute float aSize;
uniform float uScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float s = aSize * (1.0 + (1.0 - aLife) * 2.5);
  gl_PointSize = aLife > 0.0 ? s * uScale / -mv.z : 0.0;
  gl_Position = projectionMatrix * mv;
}
`;
const wakeFrag = /* glsl */ `
uniform vec3 uColor;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.25, d) * vLife * 0.6;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export class Wake {
  constructor(scene, shared, count = 320) {
    this.count = count;
    this.idx = 0;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 2);
    this.life = new Float32Array(count);
    this.size = new Float32Array(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.uniforms = { uScale: shared.uScale, uColor: { value: new THREE.Color(1, 1, 1) } };
    const pts = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: wakeVert,
        fragmentShader: wakeFrag,
        transparent: true,
        depthWrite: false,
      })
    );
    pts.frustumCulled = false;
    scene.add(pts);
  }

  spawn(x, z, vx, vz, size) {
    const i = this.idx++ % this.count;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 2] = vx;
    this.vel[i * 2 + 1] = vz;
    this.life[i] = 1;
    this.size[i] = size;
  }

  update(dt, heightAt) {
    const drag = Math.exp(-1.5 * dt);
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] = Math.max(0, this.life[i] - dt / 2.4);
      this.vel[i * 2] *= drag;
      this.vel[i * 2 + 1] *= drag;
      const x = (this.pos[i * 3] += this.vel[i * 2] * dt);
      const z = (this.pos[i * 3 + 2] += this.vel[i * 2 + 1] * dt);
      this.pos[i * 3 + 1] = heightAt(x, z) + 0.2;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

const CONFETTI_COLORS = [...SPECTRUM_HEX, '#ffffff', '#ff9fd8'];

export class Confetti {
  constructor(scene, count = 700) {
    this.count = count;
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.26), mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.parts = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      this.parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3(), life: 0 });
      this.mesh.setColorAt(i, c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]).multiplyScalar(1.4));
    }
    this.idx = 0;
    this.dummy = new THREE.Object3D();
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    scene.add(this.mesh);
  }

  burst(pos, n = 160, power = 1) {
    for (let k = 0; k < n; k++) {
      const part = this.parts[this.idx++ % this.count];
      part.p.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.6;
      const sp = (5 + Math.random() * 9) * power;
      part.v.set(Math.cos(a) * (1 - up) * sp, up * sp * 1.2, Math.sin(a) * (1 - up) * sp);
      part.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      part.rv.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      part.life = 1;
    }
  }

  update(dt) {
    const d = this.dummy;
    const drag = Math.exp(-1.6 * dt);
    for (let i = 0; i < this.count; i++) {
      const part = this.parts[i];
      if (part.life <= 0) continue;
      part.life -= dt / 3.2;
      part.v.y -= 7 * dt;
      part.v.multiplyScalar(drag);
      part.p.addScaledVector(part.v, dt);
      part.r.x += part.rv.x * dt;
      part.r.y += part.rv.y * dt;
      part.r.z += part.rv.z * dt;
      d.position.copy(part.p);
      d.rotation.copy(part.r);
      d.scale.setScalar(part.life <= 0 ? 0 : Math.min(1, part.life * 5));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class TargetMarker {
  constructor(scene) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffd1f0').multiplyScalar(1.6),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 48).rotateX(-Math.PI / 2), mat);
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), mat);
    this.group = new THREE.Group();
    this.group.add(this.ring, this.dot);
    this.group.visible = false;
    this.t = 0;
    scene.add(this.group);
  }
  show(x, z) {
    this.group.position.set(x, 0, z);
    this.group.visible = true;
    this.t = 0;
  }
  hide() {
    this.group.visible = false;
  }
  update(dt, heightAt) {
    if (!this.group.visible) return;
    this.t += dt;
    const g = this.group;
    g.position.y = heightAt(g.position.x, g.position.z) + 0.25;
    const pulse = 1 + 0.25 * Math.sin(this.t * 6);
    this.ring.scale.setScalar(pulse * Math.min(1, this.t * 4));
    this.ring.material.opacity = 0.8;
  }
}
