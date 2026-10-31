import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, valueNoise, paint, mat4, easeOutBack, easeOutCubic, easeInCubic } from './utils.js';
import { makeChest, makePrizeModel, PRIZE_BY_ID, starGeometry } from './prizes.js';
import { makeSparkles } from './effects.js';

export const ISLAND_COUNT = 8;
const BEAM_COLORS = ['#ffd6f5', '#d6f0ff', '#fff2b8', '#e3d6ff', '#d6ffe8', '#ffe0cc', '#ffd6e0', '#e0fff8'];
const FLOWER_COLORS = ['#ff6fb5', '#ffffff', '#ffd84a', '#c08cff', '#ff8f6b', '#7fd6ff'];
const SHORE_U = 0.85;

/** Terrain height: gentle beach that meets the water exactly on a circle, with a noisy hill inside. */
export function islandHeight(isl, x, z) {
  const u = Math.hypot(x - isl.x, z - isl.z) / isl.R;
  const s = 1 - u / SHORE_U;
  if (s < 0) return Math.max(0.3 + s * 14, -5);
  const n = fbm(x * 0.08 + isl.seed, z * 0.08 - isl.seed);
  return 0.3 + 1.6 * s + isl.H * Math.pow(s, 1.5) * (0.65 + 0.7 * n);
}

function layout(rng) {
  const out = [{ x: 0, z: 62, R: 15 }];
  for (let tries = 0; out.length < ISLAND_COUNT && tries < 5000; tries++) {
    const a = rng() * Math.PI * 2;
    const d = 75 + rng() * 190;
    const R = 12 + rng() * 8;
    const x = Math.sin(a) * d;
    const z = Math.cos(a) * d;
    if (out.every((o) => Math.hypot(o.x - x, o.z - z) > o.R + R + 42) && Math.hypot(x, z) > R + 30) out.push({ x, z, R });
  }
  return out;
}

function pointOnIsland(isl, rng, sMin, sMax) {
  const a = rng() * Math.PI * 2;
  const s = sMin + rng() * (sMax - sMin);
  const r = isl.R * SHORE_U * (1 - s);
  const x = isl.x + Math.cos(a) * r;
  const z = isl.z + Math.sin(a) * r;
  return { x, z, y: islandHeight(isl, x, z), a };
}

function leafGeometry(len, width, droop) {
  const steps = 9;
  const pt = (t, side) => {
    const w = Math.pow(Math.sin(Math.PI * t), 0.7) * width * (1 - t * 0.3);
    return [t * len, t * len * 0.35 - t * t * droop + (side === 0 ? 0.14 : 0), side * w];
  };
  const pos = [];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const L0 = pt(t0, -1), C0 = pt(t0, 0), R0 = pt(t0, 1);
    const L1 = pt(t1, -1), C1 = pt(t1, 0), R1 = pt(t1, 1);
    pos.push(...L0, ...C0, ...L1, ...C0, ...C1, ...L1, ...C0, ...R0, ...C1, ...R0, ...R1, ...C1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function addPalm(parts, rng, p) {
  const h = 5 + rng() * 3.5;
  const dir = rng() * Math.PI * 2;
  const lean = 0.8 + rng() * 1.6;
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3(p.x + Math.cos(dir) * lean * t * t, p.y - 0.3 + h * t, p.z + Math.sin(dir) * lean * t * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const seg = 10;
  const radial = 7;
  const trunk = new THREE.TubeGeometry(curve, seg, 0.3, radial, false);
  const tp = trunk.attributes.position;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(tp, k).sub(c).multiplyScalar(1 - 0.45 * (i / seg)).add(c);
      tp.setXYZ(k, v.x, v.y, v.z);
    }
  }
  parts.push(paint(trunk, rng() < 0.5 ? '#9b6a43' : '#8a5c3a'));

  const top = pts[pts.length - 1];
  const leaves = 7 + Math.floor(rng() * 2);
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rng() * 0.4;
    const leaf = leafGeometry(3.2 + rng() * 1.1, 0.62, 2.0 + rng() * 0.8);
    parts.push(paint(leaf, i % 2 ? '#3fae4a' : '#2f9a42', mat4(top.x, top.y, top.z, 0, a, (rng() - 0.5) * 0.4)));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng();
    parts.push(paint(new THREE.SphereGeometry(0.26, 8, 6), '#6b4426', mat4(top.x + Math.cos(a) * 0.35, top.y - 0.3, top.z + Math.sin(a) * 0.35)));
  }
}

function buildIslandGeometry(isl, rng) {
  const parts = [];
  const size = isl.R * 2.4;
  const terr = new THREE.PlaneGeometry(size, size, 56, 56);
  terr.rotateX(-Math.PI / 2);
  const tp = terr.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i) + isl.x;
    const z = tp.getZ(i) + isl.z;
    tp.setXYZ(i, x, islandHeight(isl, x, z), z);
  }
  const t = terr.toNonIndexed();
  t.deleteAttribute('uv');
  t.computeVertexNormals();
  const pos = t.attributes.position;
  const nrm = t.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const wet = new THREE.Color('#e3c48a');
  const sand = new THREE.Color('#f7e2ae');
  const grassA = new THREE.Color('#6ccf4f');
  const grassB = new THREE.Color('#47b04a');
  const cliff = new THREE.Color('#5a9f43');
  const c = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const y = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3;
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const n = valueNoise(cx * 0.3, cz * 0.3);
    if (y < 0.35) c.copy(wet);
    else if (y < 1.05 + n * 0.5) c.copy(sand);
    else {
      c.copy(grassA).lerp(grassB, valueNoise(cx * 0.12 + 40, cz * 0.12));
      if (nrm.getY(f) < 0.72) c.lerp(cliff, 0.6);
    }
    c.multiplyScalar(0.94 + n * 0.12);
    for (let v = 0; v < 3; v++) colors.set([c.r, c.g, c.b], (f + v) * 3);
  }
  t.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  parts.push(t);

  const clearOfCenter = (p) => Math.hypot(p.x - isl.x, p.z - isl.z) > 4.2;

  const palms = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < palms; i++) {
    const p = pointOnIsland(isl, rng, 0.22, 0.62);
    if (clearOfCenter(p)) addPalm(parts, rng, p);
  }
  const bushes = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < bushes; i++) {
    const p = pointOnIsland(isl, rng, 0.3, 0.8);
    if (!clearOfCenter(p)) continue;
    const s = 0.8 + rng() * 0.7;
    const g = new THREE.IcosahedronGeometry(1, 1);
    parts.push(paint(g, rng() < 0.5 ? '#4fbf56' : '#3da84b', mat4(p.x, p.y + s * 0.35, p.z, 0, rng() * 6, 0, s, s * 0.75, s)));
  }
  const flowerColor = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)];
  const clusters = 5 + Math.floor(rng() * 5);
  for (let i = 0; i < clusters; i++) {
    const base = pointOnIsland(isl, rng, 0.3, 0.85);
    if (!clearOfCenter(base)) continue;
    const color = rng() < 0.65 ? flowerColor : FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)];
    for (let k = 0; k < 4; k++) {
      const x = base.x + (rng() - 0.5) * 1.6;
      const z = base.z + (rng() - 0.5) * 1.6;
      const y = islandHeight(isl, x, z);
      parts.push(paint(new THREE.IcosahedronGeometry(0.24, 0), color, mat4(x, y + 0.22, z, rng(), rng(), 0)));
    }
  }
  const rocks = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < rocks; i++) {
    const p = pointOnIsland(isl, rng, -0.04, 0.12);
    const s = 0.6 + rng() * 0.9;
    parts.push(
      paint(new THREE.DodecahedronGeometry(1, 0), rng() < 0.5 ? '#9aa3ad' : '#b7aea0',
        mat4(p.x, p.y, p.z, rng() * 3, rng() * 3, rng() * 3, s, s * (0.6 + rng() * 0.5), s * (0.8 + rng() * 0.4)))
    );
  }
  const stars = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < stars; i++) {
    const p = pointOnIsland(isl, rng, 0.03, 0.1);
    const color = ['#ff7a6b', '#ff9fd0', '#ffb347'][Math.floor(rng() * 3)];
    parts.push(paint(starGeometry(0.45, 0.2, 0.06, 0.04), color, mat4(p.x, p.y + 0.06, p.z, -Math.PI / 2, 0, rng() * 6)));
  }
  return mergeGeometries(parts);
}

const beamVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const beamFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity, uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  float edge = pow(abs(dot(normalize(vN), normalize(vView))), 2.0);
  float fade = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.03, vUv.y);
  float stripes = 0.75 + 0.25 * sin(vUv.y * 70.0 - uTime * 4.0);
  gl_FragColor = vec4(uColor * 1.6, edge * fade * stripes * uOpacity * 0.6);
}
`;

export class IslandWorld {
  constructor(scene, shared, glowTex, rng) {
    this.islands = [];
    this.pickables = [];
    this.uniformArray = Array.from({ length: ISLAND_COUNT }, () => new THREE.Vector4(1e5, 1e5, 0, 0));
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.3,
    });
    const beamGeo = new THREE.CylinderGeometry(1.4, 1.4, 90, 24, 1, true);
    beamGeo.translate(0, 45, 0);

    layout(rng).forEach((L, i) => {
      const isl = { ...L, H: 3 + rng() * 3, seed: rng() * 100, index: i };
      isl.shoreR = isl.R * SHORE_U * (1 + 0.3 / 14);
      const mesh = new THREE.Mesh(buildIslandGeometry(isl, rng), mat);
      mesh.userData.island = isl;
      scene.add(mesh);
      this.pickables.push(mesh);
      this.uniformArray[i].set(isl.x, isl.z, isl.shoreR, 0);

      const ground = islandHeight(isl, isl.x, isl.z);
      const chest = makeChest();
      chest.scale.setScalar(1.15);
      chest.position.set(isl.x, ground - 0.05, isl.z);
      chest.rotation.y = Math.atan2(-isl.x, -isl.z);
      chest.traverse((o) => (o.userData.island = isl));
      scene.add(chest);
      this.pickables.push(chest);
      isl.chest = chest;
      isl.lid = chest.userData.lidPivot;
      isl.chestTop = ground + chest.userData.height * 1.15;

      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(BEAM_COLORS[i % BEAM_COLORS.length]) }, uOpacity: { value: 1 }, uTime: shared.uTime },
          vertexShader: beamVert,
          fragmentShader: beamFrag,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      beam.position.set(isl.x, ground, isl.z);
      scene.add(beam);
      isl.beam = beam;

      const sparkles = makeSparkles(shared, { count: 28, radius: 2.8, height: 5, size: 0.55, color: '#fff0b0' });
      sparkles.position.set(isl.x, ground + 0.5, isl.z);
      scene.add(sparkles);
      isl.sparkles = sparkles;

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTex, color: '#ffe7a0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      halo.position.set(isl.x, isl.chestTop, isl.z);
      scene.add(halo);
      isl.halo = halo;

      const prizeRoot = new THREE.Group();
      prizeRoot.position.set(isl.x, isl.chestTop, isl.z);
      prizeRoot.visible = false;
      const prizeHalo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 })
      );
      prizeHalo.scale.setScalar(5.5);
      prizeRoot.add(prizeHalo);
      prizeRoot.userData.halo = prizeHalo;
      scene.add(prizeRoot);
      isl.prizeRoot = prizeRoot;
      isl.flyFrom = new THREE.Vector3();

      this.islands.push(isl);
    });
  }

  reset(prizeIds) {
    this.islands.forEach((isl, i) => {
      isl.state = 'closed';
      isl.t = 0;
      isl.fade = 1;
      isl.prizeId = prizeIds[i % prizeIds.length];
      isl.lid.rotation.x = 0;
      const root = isl.prizeRoot;
      if (root.userData.model) root.remove(root.userData.model);
      const model = makePrizeModel(isl.prizeId);
      root.add(model);
      root.userData.model = model;
      root.userData.halo.material.color.set(PRIZE_BY_ID[isl.prizeId].color);
      root.visible = false;
      root.position.set(isl.x, isl.chestTop, isl.z);
      root.scale.setScalar(0.001);
    });
  }

  islandFromObject(obj) {
    while (obj && !obj.userData.island) obj = obj.parent;
    return obj ? obj.userData.island : null;
  }

  update(dt, time, boatPos, camera, cb) {
    for (const isl of this.islands) {
      isl.t += dt;
      const p = isl.prizeRoot;
      switch (isl.state) {
        case 'closed': {
          isl.halo.material.opacity = 0.45 + 0.2 * Math.sin(time * 3 + isl.index);
          isl.halo.scale.setScalar(5);
          const d = Math.hypot(boatPos.x - isl.x, boatPos.y - isl.z);
          if (cb.canCollect && d < isl.shoreR + 6.5) {
            isl.state = 'opening';
            isl.t = 0;
            cb.onOpen(isl);
          }
          break;
        }
        case 'opening': {
          const k = Math.min(1, isl.t / 0.7);
          isl.lid.rotation.x = -easeOutBack(k) * 1.95;
          isl.halo.scale.setScalar(5 + k * 6);
          isl.halo.material.opacity = 0.6 + k * 0.4;
          if (k >= 1) {
            isl.state = 'rising';
            isl.t = 0;
            p.visible = true;
            cb.onReveal(isl, PRIZE_BY_ID[isl.prizeId]);
          }
          break;
        }
        case 'rising': {
          const k = Math.min(1, isl.t / 0.9);
          p.position.y = isl.chestTop + easeOutCubic(k) * 3.5;
          p.scale.setScalar(Math.max(0.001, easeOutBack(k)));
          p.rotation.y += dt * (10 * (1 - k) + 2);
          if (k >= 1) {
            isl.state = 'presenting';
            isl.t = 0;
            isl.flyFrom.copy(p.position);
          }
          break;
        }
        case 'presenting': {
          // Swoop over to the middle of the screen so it can be admired up close.
          const k = Math.min(1, isl.t / 0.8);
          p.position.lerpVectors(isl.flyFrom, showcase(camera, 1), easeOutCubic(k));
          p.scale.setScalar(1 + 0.15 * k);
          p.rotation.y += dt * 4;
          if (k >= 1) {
            isl.state = 'showing';
            isl.t = 0;
          }
          break;
        }
        case 'showing': {
          p.position.copy(showcase(camera, 1 + Math.sin(isl.t * 3) * 0.2));
          p.rotation.y += dt * 2.2;
          if (isl.t > 1.8) {
            isl.state = 'flying';
            isl.t = 0;
            isl.flyFrom.copy(p.position);
          }
          break;
        }
        case 'flying': {
          const k = Math.min(1, isl.t / 0.7);
          p.position.lerpVectors(isl.flyFrom, showcase(camera, 4.8), easeInCubic(k));
          p.scale.setScalar(1.15 * (1 - k * 0.8));
          p.rotation.y += dt * 9;
          if (k >= 1) {
            p.visible = false;
            isl.state = 'done';
            isl.t = 0;
            cb.onCollected(isl, PRIZE_BY_ID[isl.prizeId]);
          }
          break;
        }
        case 'done': {
          isl.fade = Math.max(0, isl.fade - dt * 0.8);
          isl.halo.material.opacity = 0.6 * isl.fade;
          break;
        }
      }
      if (isl.state !== 'done') isl.fade = 1;
      isl.beam.material.uniforms.uOpacity.value = isl.fade;
      isl.sparkles.material.uniforms.uOpacity.value = isl.fade;
      isl.beam.visible = isl.sparkles.visible = isl.halo.visible = isl.fade > 0.001;
    }
  }
}

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _target = new THREE.Vector3();

/** A point 12 units in front of the camera, `lift` units up in screen space. */
function showcase(camera, lift) {
  camera.getWorldDirection(_fwd);
  _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  return _target.copy(camera.position).addScaledVector(_fwd, 12).addScaledVector(_up, lift);
}
