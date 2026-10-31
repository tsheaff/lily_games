import * as THREE from 'three';
import { damp } from './utils.js';

export const SKIN_TONES = ['#ffe2cc', '#f6c9a4', '#e0a77a', '#b57a50', '#7d5236'];
export const HAIR_COLORS = ['#6b4226', '#24190f', '#f3cf6a', '#d2652c', '#ff8ac4', '#7ab8ff'];
export const CLOTHES_COLORS = ['#ff5fa2', '#4fb8ff', '#ffd23f', '#5cd88a', '#b47cff', '#ff8a3d'];

export const HAIR_STYLES = [
  { id: 'short', name: 'Short' },
  { id: 'long', name: 'Long' },
  { id: 'pigtails', name: 'Pigtails' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'bun', name: 'Bun' },
  { id: 'curly', name: 'Curly' },
];
export const OUTFITS = [
  { id: 'tee', name: 'T-Shirt', emoji: '👕' },
  { id: 'dress', name: 'Dress', emoji: '👗' },
  { id: 'overalls', name: 'Overalls', emoji: '👖' },
  { id: 'stripes', name: 'Stripes', emoji: '⚓' },
];
export const HATS = [
  { id: 'none', name: 'No Hat', emoji: '🙂' },
  { id: 'captain', name: 'Captain', emoji: '⚓' },
  { id: 'sunhat', name: 'Sun Hat', emoji: '👒' },
  { id: 'cap', name: 'Cap', emoji: '🧢' },
  { id: 'crown', name: 'Crown', emoji: '👑' },
  { id: 'bow', name: 'Bow', emoji: '🎀' },
];

export const KID_DEFAULTS = {
  girl: { hair: 'pigtails', outfit: 'dress' },
  boy: { hair: 'short', outfit: 'tee' },
};
export const DEFAULT_SAILOR = { kid: 'girl', skin: 1, hair: 'pigtails', hairColor: 0, outfit: 'dress', clothes: 0, hat: 'none' };

const HEAD_R = 0.26;

function mat(color, roughness = 0.7) {
  return new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide });
}
function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}
const sphere = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);

function addHair(head, style, color) {
  const m = mat(color, 0.8);
  const cap = mesh(new THREE.SphereGeometry(HEAD_R + 0.025, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), m);
  cap.rotation.x = -0.45;
  head.add(cap);
  switch (style) {
    case 'long': {
      const back = mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 20, 1, true, Math.PI / 2, Math.PI), m, 0, -0.18, -0.02);
      head.add(back);
      break;
    }
    case 'pigtails':
      for (const s of [-1, 1]) {
        const tail = mesh(sphere(0.1), m, s * 0.3, -0.06, -0.06);
        tail.scale.set(0.8, 1.4, 0.8);
        tail.rotation.z = s * 0.35;
        head.add(tail, mesh(sphere(0.045), mat('#ff5fa2'), s * 0.27, 0.04, -0.06));
      }
      break;
    case 'ponytail': {
      const tail = mesh(sphere(0.11), m, 0, -0.04, -0.33);
      tail.scale.set(0.75, 1.5, 0.75);
      tail.rotation.x = 0.5;
      head.add(tail, mesh(sphere(0.05), mat('#ff5fa2'), 0, 0.08, -0.27));
      break;
    }
    case 'bun':
      head.add(mesh(sphere(0.13), m, 0, 0.27, -0.1));
      break;
    case 'curly': {
      const g = sphere(0.085, 10, 8);
      for (let i = 0; i < 34; i++) {
        const y = 1 - (i / 33) * 1.25;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const a = i * 2.4;
        const p = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        if (p.z > 0.2 && p.y < 0.45) continue;
        head.add(mesh(g, m, p.x * HEAD_R, p.y * HEAD_R + 0.02, p.z * HEAD_R - 0.01));
      }
      break;
    }
  }
}

function addHat(head, hat, clothes) {
  switch (hat) {
    case 'captain': {
      const g = new THREE.Group();
      g.position.y = 0.22;
      g.rotation.x = -0.15;
      g.add(mesh(cyl(0.25, 0.25, 0.14, 24), mat('#ecebf2', 0.8), 0, 0.03, 0));
      g.add(mesh(cyl(0.255, 0.255, 0.05, 24), mat('#1f2a55'), 0, -0.04, 0));
      const brim = mesh(sphere(0.2), mat('#1f2a55', 0.4), 0, -0.06, 0.18);
      brim.scale.set(1, 0.12, 0.7);
      g.add(brim, mesh(sphere(0.035), mat('#ffcf4a', 0.35), 0, 0.0, 0.25));
      head.add(g);
      break;
    }
    case 'sunhat': {
      const g = new THREE.Group();
      g.position.y = 0.17;
      g.rotation.x = -0.12;
      const straw = mat('#f3d38b', 0.9);
      g.add(mesh(cyl(0.48, 0.48, 0.025, 32), straw), mesh(cyl(0.21, 0.27, 0.16, 24), straw, 0, 0.08, 0));
      g.add(mesh(cyl(0.272, 0.272, 0.05, 24), mat(clothes), 0, 0.03, 0));
      head.add(g);
      break;
    }
    case 'cap': {
      const m = mat(clothes, 0.6);
      const top = mesh(new THREE.SphereGeometry(HEAD_R + 0.04, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.03, 0);
      top.rotation.x = -0.3;
      const visor = mesh(sphere(0.18), m, 0, 0.1, 0.25);
      visor.scale.set(1, 0.12, 0.9);
      head.add(top, visor, mesh(sphere(0.03), mat('#ffffff'), 0, HEAD_R + 0.05, 0.03));
      break;
    }
    case 'crown': {
      const gold = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 0.7, roughness: 0.35, emissive: '#7a4a00', emissiveIntensity: 0.3, side: THREE.DoubleSide });
      const g = new THREE.Group();
      g.position.y = 0.24;
      g.add(mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.1, 20, 1, true), gold));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mesh(new THREE.ConeGeometry(0.05, 0.13, 6), gold, Math.sin(a) * 0.17, 0.1, Math.cos(a) * 0.17));
      }
      g.add(mesh(new THREE.OctahedronGeometry(0.04), mat('#ff3b6b', 0.3), 0, 0.0, 0.19));
      head.add(g);
      break;
    }
    case 'bow': {
      const m = mat(clothes, 0.5);
      const g = new THREE.Group();
      g.position.set(0.12, 0.25, 0.02);
      g.rotation.z = -0.4;
      for (const s of [-1, 1]) {
        const loop = mesh(new THREE.ConeGeometry(0.08, 0.16, 10), m, s * 0.08, 0, 0);
        loop.rotation.z = s * Math.PI / 2;
        g.add(loop);
      }
      g.add(mesh(sphere(0.04), m));
      head.add(g);
      break;
    }
  }
}

function buildArm(side, sleeve, skin) {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.22, 0.86, 0);
  pivot.add(mesh(cyl(0.07, 0.065, 0.16, 10), sleeve, 0, -0.06, 0));
  pivot.add(mesh(cyl(0.052, 0.05, 0.26, 10), skin, 0, -0.24, 0));
  pivot.add(mesh(sphere(0.065, 10, 8), skin, 0, -0.39, 0));
  return pivot;
}

function buildBody(root, cfg, skin) {
  const clothes = CLOTHES_COLORS[cfg.clothes];
  const top = mat(clothes);
  const shoes = mat('#f4f4f8', 0.6);
  let legs = skin;
  let sleeve = top;

  switch (cfg.outfit) {
    case 'dress': {
      root.add(mesh(cyl(0.16, 0.18, 0.26), top, 0, 0.75, 0));
      root.add(mesh(cyl(0.18, 0.33, 0.36, 20), top, 0, 0.47, 0));
      root.add(mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 20).rotateX(Math.PI / 2), mat('#f3dbe6', 0.9), 0, 0.88, 0));
      break;
    }
    case 'overalls': {
      const white = mat('#ffffff');
      sleeve = white;
      legs = top;
      root.add(mesh(cyl(0.17, 0.2, 0.42), white, 0, 0.67, 0));
      root.add(mesh(cyl(0.205, 0.21, 0.2), top, 0, 0.46, 0));
      root.add(mesh(new THREE.BoxGeometry(0.26, 0.2, 0.06), top, 0, 0.66, 0.17));
      for (const s of [-1, 1]) root.add(mesh(new THREE.BoxGeometry(0.05, 0.26, 0.38), top, s * 0.1, 0.76, 0));
      for (const s of [-1, 1]) root.add(mesh(sphere(0.022), mat('#ffcf4a', 0.4), s * 0.09, 0.74, 0.2));
      break;
    }
    case 'stripes': {
      const white = mat('#ffffff');
      for (let i = 0; i < 5; i++) {
        const y0 = 0.47 + i * 0.084;
        const r0 = 0.2 - i * 0.006;
        root.add(mesh(cyl(r0 - 0.006, r0, 0.084), i % 2 ? white : top, 0, y0 + 0.042, 0));
      }
      root.add(mesh(cyl(0.205, 0.21, 0.14), mat('#2b3a67'), 0, 0.42, 0));
      break;
    }
    default: {
      root.add(mesh(cyl(0.17, 0.2, 0.42), top, 0, 0.67, 0));
      root.add(mesh(cyl(0.205, 0.21, 0.14), mat('#3d5a99'), 0, 0.42, 0));
      root.add(mesh(sphere(0.05), mat('#ffffff'), 0, 0.72, 0.18));
    }
  }

  for (const s of [-1, 1]) {
    root.add(mesh(cyl(0.075, 0.07, 0.38, 10), legs, s * 0.09, 0.24, 0));
    const shoe = mesh(sphere(0.09, 12, 8), shoes, s * 0.09, 0.05, 0.03);
    shoe.scale.set(1, 0.6, 1.4);
    root.add(shoe);
  }
  return sleeve;
}

function buildFace(head, cfg, skin) {
  head.add(mesh(sphere(HEAD_R, 28, 20), skin));
  const eye = mat('#2a1f2e', 0.3);
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const s of [-1, 1]) {
    const e = mesh(sphere(0.038, 12, 10), eye, s * 0.09, 0.0, HEAD_R - 0.03);
    e.scale.set(1, 1.2, 0.6);
    head.add(e, mesh(sphere(0.012, 8, 6), shine, s * 0.09 + 0.012, 0.02, HEAD_R - 0.005));
    const cheek = mesh(sphere(0.045, 10, 8), mat('#ff9cb5', 0.9), s * 0.15, -0.075, HEAD_R - 0.07);
    cheek.scale.set(1, 0.6, 0.5);
    head.add(cheek, mesh(sphere(0.05, 10, 8), skin, s * HEAD_R, -0.01, 0));
    if (cfg.kid === 'girl') {
      const lash = mesh(new THREE.BoxGeometry(0.035, 0.012, 0.01), eye, s * 0.13, 0.04, HEAD_R - 0.04);
      lash.rotation.z = s * 0.5;
      head.add(lash);
    }
  }
  const smile = mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 14, Math.PI), mat('#b2405f', 0.5), 0, -0.07, HEAD_R - 0.02);
  smile.rotation.z = Math.PI;
  head.add(smile, mesh(sphere(0.025, 8, 6), skin, 0, -0.025, HEAD_R));
}

/** A little kid who stands on the deck, built from simple shapes so it can be rebuilt instantly. */
export class Sailor {
  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.yaw = 0;
    this.headYaw = 0;
    this.waveT = 0;
    this.cheerT = 0;
    this.set(DEFAULT_SAILOR);
  }

  set(cfg) {
    this.cfg = { ...cfg };
    this.body.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    this.body.clear();
    const skin = mat(SKIN_TONES[cfg.skin], 0.75);
    const sleeve = buildBody(this.body, cfg, skin);
    this.armL = buildArm(1, sleeve, skin);
    this.armR = buildArm(-1, sleeve, skin);
    this.body.add(this.armL, this.armR, mesh(cyl(0.06, 0.07, 0.1, 10), skin, 0, 0.92, 0));
    this.head = new THREE.Group();
    this.head.position.y = 1.18;
    buildFace(this.head, cfg, skin);
    addHair(this.head, cfg.hair, HAIR_COLORS[cfg.hairColor]);
    addHat(this.head, cfg.hat, CLOTHES_COLORS[cfg.clothes]);
    this.body.add(this.head);
  }

  wave(seconds = 2.2) {
    this.waveT = Math.max(this.waveT, seconds);
  }

  cheer(seconds = 3) {
    this.cheerT = Math.max(this.cheerT, seconds);
  }

  /** `face` turns the whole kid (radians, 0 = facing the bow); `look` turns just the head. */
  update(dt, time, { face = 0, look = 0 } = {}) {
    this.waveT = Math.max(0, this.waveT - dt);
    this.cheerT = Math.max(0, this.cheerT - dt);
    this.yaw = damp(this.yaw, face, 5, dt);
    this.headYaw = damp(this.headYaw, look, 4, dt);
    this.group.rotation.y = this.yaw;
    this.head.rotation.y = this.headYaw;
    this.head.rotation.z = Math.sin(time * 1.7) * 0.05;

    const cheering = this.cheerT > 0;
    const hop = cheering ? Math.abs(Math.sin(time * 9)) * 0.12 : Math.sin(time * 2.2) * 0.012;
    this.body.position.y = hop;

    const sway = Math.sin(time * 1.6) * 0.06;
    let left = 0.14 + sway;
    let right = -0.14 - sway;
    if (cheering) {
      left = 2.7 + Math.sin(time * 12) * 0.25;
      right = -2.7 - Math.sin(time * 12 + 1) * 0.25;
    } else if (this.waveT > 0) {
      right = -2.5 + Math.sin(time * 13) * 0.4;
    }
    this.armL.rotation.z = damp(this.armL.rotation.z, left, 12, dt);
    this.armR.rotation.z = damp(this.armR.rotation.z, right, 12, dt);
  }
}
