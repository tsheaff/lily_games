import * as THREE from 'three';
import { damp } from './utils.js';
import {
  HEAD_Y, HEAD_R, LEG_X, SHOULDER, TORSO_DEPTH, armR,
  mesh, sphere, cyl, rod, lathe, wavy, taperedTube, torsoShape, legShape, armShape, phys, skinMat, plainMat, glossMat,
} from './parts.js';
import { hairTexture, hairNormal, irisTexture, softDot, emojiTexture, frecklesTexture, tiled, mixHex } from './textures.js';
import {
  SKIN_TONES, EYE_COLORS, HAIR_COLORS, LIP_COLORS, BLUSH_COLORS, SHADOW_COLORS, NAIL_COLORS, FACE_PAINT,
  DEFAULT_SAILOR, normalizeSailor,
} from './wardrobe.js';
import { dressUp } from './outfit.js';
import { accessorize } from './accessories.js';

export { DEFAULT_SAILOR } from './wardrobe.js';

const R = HEAD_R;
const EYE_R = 0.05;
const LID_OPEN = -0.27;
const LID_SHUT = 1.0;
const TIE_COLOR = '#ff5fa2';

export function hairMat(hex) {
  const rainbow = hex === 'rainbow';
  const base = rainbow ? '#ffffff' : hex;
  return phys({
    color: base,
    map: tiled(hairTexture(rainbow), 3, 1),
    normalMap: tiled(hairNormal(), 3, 1),
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.48,
    sheen: 1,
    sheenRoughness: 0.32,
    sheenColor: new THREE.Color(mixHex(rainbow ? '#ffd6f0' : hex, '#ffffff', 0.45)),
  });
}

// ---------- face ----------
/** Orient a flat decal so it lies on the head sphere in direction `dir`. */
function decal(head, dir, w, h, material) {
  const d = dir.clone().normalize();
  const m = mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.copy(d).multiplyScalar(R + 0.0025);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  m.renderOrder = 2;
  head.add(m);
  return m;
}
const decalMat = (map, color = '#ffffff', opacity = 1) =>
  new THREE.MeshStandardMaterial({ map, color, transparent: true, opacity, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });

function buildEye(head, s, cfg, skin) {
  const ex = s * 0.088;
  const ey = 0.005;
  const eye = new THREE.Group();
  eye.position.set(ex, ey, Math.sqrt(R * R - ex * ex - ey * ey) - 0.026);
  head.add(eye);

  const ball = new THREE.Group();
  eye.add(ball);
  ball.add(mesh(sphere(EYE_R, 32, 24), phys({ color: '#fbf7f4', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 })));
  const irisGeo = new THREE.RingGeometry(0, 0.031, 40, 6);
  const p = irisGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, Math.sqrt((EYE_R + 0.0007) ** 2 - x * x - y * y));
  }
  irisGeo.computeVertexNormals();
  ball.add(mesh(irisGeo, phys({ map: irisTexture(EYE_COLORS[cfg.eyes]), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02 })));

  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  eye.add(mesh(sphere(0.0075, 10, 8), shine, 0.013, 0.017, EYE_R - 0.002), mesh(sphere(0.0035, 8, 6), shine, -0.012, -0.012, EYE_R - 0.001));

  const shadowHex = cfg.shadow >= 0 ? SHADOW_COLORS[cfg.shadow] : null;
  const lidMat = shadowHex
    ? phys({ color: mixHex(SKIN_TONES[cfg.skin], shadowHex, 0.75), roughness: 0.35, metalness: 0.25, iridescence: 0.6, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') })
    : skin;
  const lid = new THREE.Group();
  lid.rotation.x = LID_OPEN;
  lid.add(mesh(new THREE.SphereGeometry(EYE_R + 0.004, 32, 16, 0, Math.PI * 2, 0, 1.25), lidMat));
  eye.add(lid);
  const lower = mesh(new THREE.SphereGeometry(EYE_R + 0.003, 32, 8, 0, Math.PI * 2, Math.PI - 1.0, 1.0), skin);
  lower.rotation.x = 0.15;
  eye.add(lower);

  const lash = { natural: [cfg.kid === 'girl' ? 5 : 3, 0.011], long: [7, 0.019], glam: [9, 0.028] }[cfg.lashes];
  const lashMat = plainMat('#1b1216', 0.5);
  const r = EYE_R + 0.005;
  for (let i = 0; i < lash[0]; i++) {
    const t = lash[0] === 1 ? 0.5 : i / (lash[0] - 1);
    // t runs from the inner corner (0) to the outer corner (1), where lashes are longest.
    const phi = Math.PI / 2 + s * (t * 2 - 1) * 0.95;
    const th = 1.25;
    const a = new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
    const dir = a.clone().normalize().add(new THREE.Vector3(t * s * 0.5, 0.5 + (cfg.lashes === 'glam' ? t * 0.4 : 0), 0)).normalize();
    const len = lash[1] * (0.65 + 0.5 * t);
    lid.add(rod(a, a.clone().addScaledVector(dir, len), 0.0022, lashMat, 0.0007));
  }

  const brow = mesh(new THREE.TorusGeometry(0.055, 0.0075, 6, 16, 1.15), hairMat(HAIR_COLORS[cfg.hairColor]), s * 0.092, 0.09 - 0.055, 0);
  brow.position.z = Math.sqrt(R * R - 0.092 ** 2 - 0.09 ** 2) + 0.002;
  brow.rotation.set(-0.25, s * 0.35, Math.PI / 2 - 0.575);
  brow.scale.set(1, 1, 0.6);
  head.add(brow);
  return { ball, lid };
}

function buildFace(head, cfg, skin) {
  head.add(mesh(sphere(R, 48, 36), skin));
  const eyes = [-1, 1].map((s) => buildEye(head, s, cfg, skin));

  const nose = mesh(sphere(0.028, 16, 12), skin, 0, -0.045, 0.252);
  nose.scale.set(1.1, 0.85, 0.8);
  head.add(nose);

  const lipHex = cfg.lips >= 0 ? LIP_COLORS[cfg.lips] : mixHex(SKIN_TONES[cfg.skin], '#d4606f', 0.55);
  const lipMat =
    cfg.lips < 0
      ? phys({ color: lipHex, roughness: 0.4, clearcoat: 0.4 })
      : cfg.lips === LIP_COLORS.length - 1
        ? phys({ color: lipHex, roughness: 0.2, metalness: 0.3, iridescence: 1, clearcoat: 1 })
        : glossMat(lipHex, 0.3);
  const smile = mesh(new THREE.TorusGeometry(0.047, cfg.lips >= 0 ? 0.013 : 0.0105, 10, 24, Math.PI * 0.72), lipMat, 0, -0.077, 0.24);
  smile.rotation.set(0.3, 0, -Math.PI / 2 - Math.PI * 0.36);
  head.add(smile);

  const dot = softDot();
  const blush = cfg.blush >= 0 ? decalMat(dot, BLUSH_COLORS[cfg.blush], 0.7) : decalMat(dot, '#ff9cb5', 0.3);
  for (const s of [-1, 1]) decal(head, new THREE.Vector3(s * 0.15, -0.065, 0.2), 0.11, 0.075, blush);

  if (cfg.paint === 'freckles') {
    const m = decalMat(frecklesTexture());
    for (const s of [-1, 1]) decal(head, new THREE.Vector3(s * 0.11, -0.035, 0.22), 0.1, 0.07, m);
  } else if (cfg.paint !== 'none') {
    const emoji = FACE_PAINT.find((f) => f.id === cfg.paint).emoji;
    const m = decalMat(emojiTexture(emoji), '#ffffff', 0.92);
    decal(head, new THREE.Vector3(-0.16, -0.04, 0.19), 0.075, 0.075, m).rotateZ(0.2);
  }

  for (const s of [-1, 1]) {
    const ear = mesh(sphere(0.055, 16, 12), skin, s * R * 0.96, -0.02, -0.01);
    ear.scale.set(0.42, 1, 0.75);
    head.add(ear);
  }
  return eyes;
}

// ---------- hair ----------
function scrunchie(at, r) {
  const m = mesh(new THREE.TorusGeometry(r, 0.016, 8, 20), phys({ color: TIE_COLOR, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffd0e6') }));
  m.position.copy(at);
  return m;
}

function hairTail(head, m, points, r0, r1 = 0.012) {
  head.add(mesh(taperedTube(points, (t) => (r0 + (r1 - r0) * t) * (t > 0.92 ? Math.sqrt((1 - t) / 0.08) * 0.8 + 0.2 : 1)), m));
}

function addHair(head, style, hex) {
  const m = hairMat(hex);
  const cap = mesh(new THREE.SphereGeometry(R + 0.022, 48, 24, 0, Math.PI * 2, 0, 1.75), m);
  cap.rotation.x = -0.78;
  head.add(cap);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const longHair = (bottom, flare, curl, phi = 1.0) => {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const y = 0.08 + (bottom - 0.08) * t;
      const bulge = R + 0.024 + flare * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) - curl * Math.pow(Math.max(0, t - 0.8) / 0.2, 2);
      pts.push([bulge, y]);
    }
    const geo = lathe(pts.reverse(), { segments: 48, phiStart: phi, phiLength: Math.PI * 2 - phi * 2 });
    wavy(geo, 0.025, 22, 0.7);
    head.add(mesh(geo, m, 0, 0, -0.015));
  };
  switch (style) {
    case 'short': {
      const top = mesh(new THREE.SphereGeometry(R + 0.04, 40, 16, 0, Math.PI * 2, 0, 1.0), m, 0, -0.005, -0.03);
      top.rotation.x = -0.35;
      head.add(top);
      break;
    }
    case 'spiky': {
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4;
        const up = 0.25 + (i / 16) * 0.85;
        const dir = V(Math.sin(a) * Math.sin(up), Math.cos(up), Math.cos(a) * Math.sin(up) - 0.35).normalize();
        if (dir.z > 0.55) continue;
        const spike = mesh(new THREE.ConeGeometry(0.05, 0.13, 10), m);
        spike.position.copy(dir).multiplyScalar(R + 0.04);
        spike.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
        head.add(spike);
      }
      break;
    }
    case 'curly': {
      const g = sphere(0.055, 14, 10);
      for (let i = 0; i < 70; i++) {
        const y = 1 - (i / 69) * 1.35;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const a = i * 2.39996;
        const p = V(Math.cos(a) * r, y, Math.sin(a) * r);
        if (p.z > 0.25 && p.y < 0.5) continue;
        const k = R + 0.03 + Math.sin(i * 7.1) * 0.012;
        head.add(mesh(g, m, p.x * k, p.y * k + 0.02, p.z * k - 0.02));
      }
      break;
    }
    case 'bob':
      longHair(-0.17, 0.02, 0.035, 0.95);
      break;
    case 'bangs':
    case 'long':
      longHair(-0.5, 0.04, 0.03);
      if (style === 'bangs') {
        const fringe = new THREE.SphereGeometry(R + 0.03, 40, 10, Math.PI / 2 - 0.85, 1.7, 0.2, 0.92);
        wavy(fringe, 0.02, 30, 1);
        head.add(mesh(fringe, m));
      }
      break;
    case 'ponytail':
      head.add(scrunchie(V(0, 0.03, -0.285), 0.045));
      hairTail(head, m, [V(0, 0.04, -0.27), V(0, 0.02, -0.36), V(0, -0.14, -0.38), V(0, -0.34, -0.32), V(0.02, -0.46, -0.28)], 0.07);
      break;
    case 'pigtails':
      for (const s of [-1, 1]) {
        head.add(scrunchie(V(s * 0.27, 0.03, -0.06), 0.04).rotateY(s * 1.2));
        hairTail(head, m, [V(s * 0.25, 0.04, -0.06), V(s * 0.33, 0.0, -0.06), V(s * 0.37, -0.12, -0.04), V(s * 0.36, -0.28, -0.02), V(s * 0.33, -0.36, 0)], 0.06);
      }
      break;
    case 'braids':
      longHair(-0.06, 0.01, 0, 1.1);
      for (const s of [-1, 1]) {
        const path = [V(s * 0.21, -0.1, -0.1), V(s * 0.23, -0.22, -0.03), V(s * 0.21, -0.36, 0.06), V(s * 0.19, -0.52, 0.1)];
        const curve = new THREE.CatmullRomCurve3(path);
        for (let i = 0; i < 11; i++) {
          const t = i / 10;
          const p = curve.getPointAt(t);
          const lump = mesh(sphere(0.042 - t * 0.012, 14, 10), m, p.x + (i % 2 ? 0.012 : -0.012) * s, p.y, p.z);
          lump.scale.set(1, 1.35, 1);
          lump.rotation.z = (i % 2 ? 0.5 : -0.5) * s;
          head.add(lump);
        }
        head.add(scrunchie(curve.getPointAt(1).add(V(0, -0.01, 0)), 0.026).rotateX(Math.PI / 2));
        hairTail(head, m, [V(s * 0.19, -0.53, 0.1), V(s * 0.195, -0.58, 0.11), V(s * 0.2, -0.63, 0.115)], 0.028, 0.02);
      }
      break;
    case 'bun': {
      head.add(mesh(sphere(0.12, 28, 20), m, 0, 0.25, -0.1));
      const band = scrunchie(V(0, 0.2, -0.08), 0.085);
      band.rotation.x = Math.PI / 2 - 0.4;
      head.add(band);
      break;
    }
    case 'spacebuns':
      for (const s of [-1, 1]) {
        head.add(mesh(sphere(0.09, 24, 18), m, s * 0.15, 0.23, -0.04));
        const band = scrunchie(V(s * 0.13, 0.19, -0.035), 0.06);
        band.rotation.set(Math.PI / 2, 0, s * 0.6);
        head.add(band);
      }
      break;
  }
}

// ---------- body ----------
function buildHand(arm, s, skin, nails) {
  const hand = new THREE.Group();
  hand.position.y = -0.4;
  arm.add(hand);
  const palm = mesh(sphere(0.04, 18, 14), skin);
  palm.scale.set(0.62, 1.05, 0.92);
  hand.add(palm);
  const finger = new THREE.CapsuleGeometry(0.0088, 0.03, 4, 10);
  const nail = sphere(0.0062, 8, 6);
  for (let i = 0; i < 4; i++) {
    const z = -0.021 + i * 0.014;
    const len = [0.9, 1.05, 1, 0.82][i];
    const f = new THREE.Group();
    f.position.set(0, -0.03, z);
    f.rotation.z = -s * 0.28;
    const fm = mesh(finger, skin, 0, -0.018 * len, 0);
    fm.scale.y = len;
    f.add(fm);
    if (nails) {
      const n = mesh(nail, nails, s * 0.0062, -0.034 * len, 0);
      n.scale.set(0.45, 1, 0.9);
      f.add(n);
    }
    hand.add(f);
  }
  const thumb = new THREE.Group();
  thumb.position.set(-s * 0.006, -0.005, 0.03);
  thumb.rotation.x = -0.7;
  thumb.add(mesh(finger, skin, 0, -0.016, 0));
  if (nails) thumb.add(mesh(nail, nails, s * 0.005, -0.03, 0));
  hand.add(thumb);
}

function buildArm(s, skin, nails) {
  const pivot = new THREE.Group();
  pivot.position.set(s * SHOULDER.x, SHOULDER.y, 0);
  pivot.add(mesh(sphere(armR(0) + 0.003, 20, 14), skin, 0, -0.01, 0));
  pivot.add(mesh(armShape(0, 0.38, 0)[0], skin));
  buildHand(pivot, s, skin, nails);
  return pivot;
}

/** A kid who stands on the deck. Rebuilt from scratch whenever the look changes. */
export class Sailor {
  constructor({ shadows = false } = {}) {
    this.shadows = shadows;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.yaw = 0;
    this.headYaw = 0;
    this.waveT = 0;
    this.cheerT = 0;
    this.twirlT = 0;
    this.hopT = 0;
    this.blinkIn = 2;
    this.blinkT = 0;
    this.gazeIn = 1;
    this.gaze = new THREE.Vector2();
    this.gazeTarget = new THREE.Vector2();
    this.set(DEFAULT_SAILOR);
  }

  set(input) {
    const cfg = normalizeSailor(input);
    this.cfg = cfg;
    this.body.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    this.body.clear();

    const skin = skinMat(SKIN_TONES[cfg.skin]);
    const nails = cfg.nails >= 0 ? glossMat(NAIL_COLORS[cfg.nails], 0.15) : null;
    const torso = new THREE.Group();
    torso.scale.z = TORSO_DEPTH;
    torso.add(mesh(torsoShape(0.36, 0.94, 0)[0], skin));
    this.body.add(torso, mesh(cyl(0.048, 0.054, 0.16), skin, 0, 0.97, 0));
    for (const s of [-1, 1]) this.body.add(mesh(legShape(0.05, 0.47, 0)[0], skin, s * LEG_X, 0, 0));
    this.armL = buildArm(1, skin, nails);
    this.armR = buildArm(-1, skin, nails);
    this.body.add(this.armL, this.armR);

    this.head = new THREE.Group();
    this.head.position.y = HEAD_Y;
    this.head.scale.set(0.97, 1, 0.95);
    this.eyes = buildFace(this.head, cfg, skin);
    addHair(this.head, cfg.hair, HAIR_COLORS[cfg.hairColor]);
    this.body.add(this.head);

    const parts = { body: this.body, torso, head: this.head, arms: [this.armL, this.armR], skin, nails };
    const dressed = dressUp(parts, cfg);
    this.lift = dressed.lift;
    this.glow = dressed.glow;
    this.armRest = dressed.armRest;
    accessorize(parts, cfg);

    this.body.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = this.shadows && !o.material.transparent;
        o.receiveShadow = this.shadows;
      }
    });
  }

  wave(seconds = 2.2) {
    this.waveT = Math.max(this.waveT, seconds);
  }

  cheer(seconds = 3) {
    this.cheerT = Math.max(this.cheerT, seconds);
  }

  twirl() {
    if (this.twirlT <= 0) this.twirlT = 1;
  }

  hop() {
    this.hopT = 0.45;
  }

  /** `face` turns the whole kid (radians, 0 = facing the bow); `look` turns just the head. */
  update(dt, time, { face = 0, look = 0 } = {}) {
    this.waveT = Math.max(0, this.waveT - dt);
    this.cheerT = Math.max(0, this.cheerT - dt);
    this.hopT = Math.max(0, this.hopT - dt);
    this.yaw = damp(this.yaw, face, 5, dt);
    this.headYaw = damp(this.headYaw, look, 4, dt);
    let spin = 0;
    if (this.twirlT > 0) {
      this.twirlT = Math.max(0, this.twirlT - dt / 0.9);
      const t = 1 - this.twirlT;
      spin = (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) * Math.PI * 2;
    }
    this.group.rotation.y = this.yaw + spin;
    this.head.rotation.y = this.headYaw;
    this.head.rotation.z = Math.sin(time * 1.7) * 0.05;

    const cheering = this.cheerT > 0;
    let hop = cheering ? Math.abs(Math.sin(time * 9)) * 0.12 : Math.sin(time * 2.2) * 0.012;
    if (this.hopT > 0) hop += Math.sin((this.hopT / 0.45) * Math.PI) * 0.07;
    this.body.position.y = hop + this.lift;

    const sway = Math.sin(time * 1.6) * 0.06;
    let left = this.armRest + sway;
    let right = -this.armRest - sway;
    if (cheering) {
      left = 2.7 + Math.sin(time * 12) * 0.25;
      right = -2.7 - Math.sin(time * 12 + 1) * 0.25;
    } else if (this.waveT > 0) {
      right = -2.5 + Math.sin(time * 13) * 0.4;
    } else if (this.twirlT > 0) {
      left = 1.1;
      right = -1.1;
    }
    this.armL.rotation.z = damp(this.armL.rotation.z, left, 12, dt);
    this.armR.rotation.z = damp(this.armR.rotation.z, right, 12, dt);

    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.16;
      this.blinkIn = 1.8 + Math.random() * 3.5;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);
    const shut = this.blinkT > 0 ? Math.sin((this.blinkT / 0.16) * Math.PI) : 0;
    this.gazeIn -= dt;
    if (this.gazeIn <= 0) {
      this.gazeIn = 0.8 + Math.random() * 2.2;
      this.gazeTarget.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.25);
      if (Math.random() < 0.4) this.gazeTarget.set(0, 0);
    }
    this.gaze.x = damp(this.gaze.x, this.gazeTarget.x, 18, dt);
    this.gaze.y = damp(this.gaze.y, this.gazeTarget.y, 18, dt);
    for (const e of this.eyes) {
      e.lid.rotation.x = LID_OPEN + (LID_SHUT - LID_OPEN) * shut - this.gaze.y * 0.3;
      e.ball.rotation.set(-this.gaze.y, this.gaze.x, 0);
    }

    for (const g of this.glow) {
      g.emissive.setHSL((time * 0.6 + g.userData.phase) % 1, 1, 0.55);
      g.emissiveIntensity = 1.5 + Math.max(0, Math.sin(time * 9 + g.userData.phase * 6)) * 2.5;
    }
  }
}
