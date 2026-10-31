import * as THREE from 'three';
import {
  ANKLE_Y, LEG_X, armR, legR, torsoR, interp,
  mesh, sphere, rod, tube, ring, wavy, torsoShape, legShape, armShape, skirtShape, onTorso, sideExtrude, soleExtrude,
  starShape, puffy, phys, garment, fabric, plainMat, glossMat, metalMat,
} from './parts.js';
import { sailorCollarTexture } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const add = (parent, [geo, u, v], mat, x = 0, y = 0, z = 0) => {
  const m = mesh(geo, typeof mat === 'function' ? mat(u, v) : mat, x, y, z);
  parent.add(m);
  return m;
};
const satin = (color) => fabric({ color, pattern: 'solid' }, 'satin');
const tulle = (spec, u, v) => fabric(spec, 'tulle', u, v);

function legs(p, y0, y1, inflate, mat, opts) {
  for (const s of [-1, 1]) add(p.body, legShape(y0, y1, inflate, opts), mat, s * LEG_X);
}
function legCuffs(p, y, r, mat) {
  for (const s of [-1, 1]) p.body.add(ring(r, 0.008, y, mat, 28).translateX(s * LEG_X));
}
function waistband(p, y, inflate, mat, tube = 0.011) {
  p.torso.add(ring(torsoR(y) + inflate, tube, y, mat(0.9, 0.03)));
}
function straps(p, inflate, mat, low = 0.84, x = 0.085, r = 0.009) {
  for (const s of [-1, 1]) {
    const pts = [onTorso(s * x, low, inflate), onTorso(s * (x + 0.004), 0.895, inflate + 0.003), V(s * (x + 0.012), 0.925, 0)];
    pts.push(onTorso(s * (x + 0.004), 0.895, inflate + 0.003, true), onTorso(s * x, low - 0.02, inflate, true));
    p.body.add(tube(pts, r, mat));
  }
}
function bow(mat, size = 1) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.ConeGeometry(0.035 * size, 0.07 * size, 12), mat, s * 0.034 * size, 0, 0);
    loop.rotation.z = (s * Math.PI) / 2;
    loop.scale.z = 0.55;
    g.add(loop);
    const tail = mesh(new THREE.ConeGeometry(0.015 * size, 0.07 * size, 8), mat, s * 0.018 * size, -0.04 * size, 0);
    tail.rotation.z = s * 0.35;
    g.add(tail);
  }
  g.add(mesh(sphere(0.017 * size, 12, 10), mat));
  return g;
}

// ---------- tops ----------
const SLEEVE = { tee: 0.12, sailor: 0.12, ruffle: 0.1, long: 0.33, hoodie: 0.33, sweater: 0.33, tank: 0 };

function buildTop(p, spec, tucked) {
  const type = spec.type;
  const m = garment(spec, type === 'sweater' ? 'knit' : type === 'hoodie' ? 'fleece' : 'cotton');
  const th = { hoodie: 0.03, sweater: 0.026 }[type] ?? 0.02;
  const hem = tucked ? 0.555 : 0.5;
  const neck = type === 'tank' ? 0.87 : 0.905;
  add(p.torso, torsoShape(hem, neck, th, { flare: tucked ? 0 : 0.008 }), m);
  p.torso.add(ring(torsoR(neck) + th, 0.008, neck, m(0.6, 0.02)));
  if (type === 'sweater' || type === 'hoodie') p.torso.add(ring(torsoR(hem) + th + 0.01, 0.013, hem + 0.01, m(1, 0.03)));

  const len = SLEEVE[type];
  for (const arm of len ? p.arms : []) {
    arm.add(mesh(sphere(armR(0) + th + 0.004, 20, 14), m(0.4, 0.1), 0, -0.01, 0));
    const sleeve = add(arm, armShape(0, len, th, { flare: len < 0.2 ? 0.012 : 0.004 }), m);
    if (type === 'ruffle') wavy(sleeve.geometry, 0.28, 9, 2);
    if (len > 0.2) arm.add(ring(armR(len) + th + 0.006, 0.011, -len + 0.01, m(0.25, 0.03), 24));
    if (type === 'sailor') arm.add(ring(armR(len) + th + 0.012, 0.006, -len + 0.012, plainMat('#22336b'), 24));
  }

  switch (type) {
    case 'tank':
      straps(p, th, m(0.3, 0.1), 0.85, 0.08, 0.014);
      break;
    case 'hoodie': {
      const arc = Math.PI * 1.25;
      const hood = mesh(new THREE.TorusGeometry(0.13, 0.05, 12, 28, arc).rotateX(Math.PI / 2).rotateY(arc / 2 + Math.PI / 2), m(0.8, 0.3), 0, 0.9, -0.02);
      hood.scale.set(1, 0.8, 1);
      hood.rotation.x = 0.25;
      p.torso.add(hood);
      add(p.torso, torsoShape(0.56, 0.67, th + 0.01, { phiStart: -0.55, phiLength: 1.1 }), m);
      const white = plainMat('#ffffff', 0.6);
      for (const s of [-1, 1]) {
        const a = onTorso(s * 0.035, 0.885, th + 0.012);
        const b = onTorso(s * 0.04, 0.77, th + 0.012);
        p.body.add(rod(a, b, 0.004, white), mesh(sphere(0.007, 8, 6), white, b.x, b.y, b.z));
      }
      break;
    }
    case 'sailor': {
      const collar = phys({ map: sailorCollarTexture(), roughness: 0.8, sheen: 0.5, sheenColor: new THREE.Color('#8899dd') });
      add(p.torso, torsoShape(0.74, 0.905, th + 0.008, { phiStart: Math.PI - 1.05, phiLength: 2.1, flare: 0.02 }), collar);
      for (const s of [-1, 1]) add(p.torso, torsoShape(0.78, 0.905, th + 0.008, { phiStart: s > 0 ? 0.22 : -0.97, phiLength: 0.75, flare: 0.01 }), collar);
      const red = fabric({ color: '#e63946' }, 'satin');
      const knot = onTorso(0, 0.79, th + 0.02);
      p.body.add(mesh(sphere(0.022, 12, 10), red, knot.x, knot.y, knot.z));
      for (const s of [-1, 1]) {
        const tail = mesh(new THREE.ConeGeometry(0.022, 0.08, 10), red, knot.x + s * 0.016, knot.y - 0.04, knot.z + 0.004);
        tail.rotation.z = Math.PI + s * 0.35;
        tail.scale.z = 0.4;
        p.body.add(tail);
      }
      break;
    }
    case 'ruffle': {
      const pts = [[torsoR(0.84) + th + 0.035, 0.84], [torsoR(0.87) + th + 0.012, 0.875], [torsoR(0.905) + th + 0.002, 0.905]];
      const geo = wavy(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 64, Math.PI), 0.12, 16, 1);
      p.torso.add(mesh(geo, m(1, 0.06)));
      break;
    }
  }
}

// ---------- bottoms ----------
function buildBottom(p, spec) {
  const type = spec.type;
  const m = garment(spec, type === 'leggings' ? 'knit' : 'cotton');
  switch (type) {
    case 'shorts':
      legs(p, 0.31, 0.47, 0.02, m, { minR: 0.08 });
      add(p.torso, torsoShape(0.4, 0.58, 0.015), m);
      waistband(p, 0.572, 0.011, m, 0.006);
      legCuffs(p, 0.315, 0.083, m(0.5, 0.02));
      break;
    case 'pants':
      legs(p, 0.075, 0.47, 0.02, m, { minR: 0.062 });
      add(p.torso, torsoShape(0.4, 0.58, 0.015), m);
      waistband(p, 0.572, 0.011, m, 0.006);
      legCuffs(p, 0.08, 0.065, m(0.4, 0.02));
      break;
    case 'leggings':
      legs(p, 0.062, 0.47, 0.007, m);
      add(p.torso, torsoShape(0.4, 0.57, 0.008), m);
      waistband(p, 0.562, 0.008, m, 0.005);
      break;
    case 'skirt': {
      const r0 = torsoR(0.585) + 0.026;
      add(p.torso, skirtShape([[0.59, r0], [0.5, 0.235], [0.4, 0.285], [0.3, 0.315]], { folds: 9, amp: 0.05 }), m);
      waistband(p, 0.58, 0.03, m);
      break;
    }
    case 'tutu': {
      waistband(p, 0.57, 0.028, () => fabric(spec, 'satin', 1, 0.03));
      const layers = [
        [0.575, 0.45, 0.37],
        [0.565, 0.43, 0.34],
        [0.555, 0.41, 0.31],
      ];
      for (const [top, bottom, r] of layers) {
        const r0 = torsoR(top) + 0.03;
        add(p.torso, skirtShape([[top, r0], [(top + bottom) / 2 + 0.02, r * 0.85], [bottom, r]], { folds: 18, amp: 0.09, power: 1 }), (u, v) => tulle(spec, u, v));
      }
      break;
    }
    case 'overalls': {
      legs(p, 0.075, 0.47, 0.02, m, { minR: 0.062 });
      legCuffs(p, 0.08, 0.065, m(0.4, 0.02));
      add(p.torso, torsoShape(0.4, 0.6, 0.032), m);
      add(p.torso, torsoShape(0.58, 0.775, 0.036, { phiStart: -0.62, phiLength: 1.24 }), m);
      add(p.torso, torsoShape(0.66, 0.73, 0.04, { phiStart: -0.3, phiLength: 0.6 }), m);
      const gold = metalMat(0);
      for (const s of [-1, 1]) {
        const front = onTorso(s * 0.075, 0.765, 0.038);
        const pts = [front, onTorso(s * 0.085, 0.85, 0.036), V(s * 0.1, 0.925, 0), onTorso(s * 0.08, 0.84, 0.036, true), onTorso(s * 0.06, 0.62, 0.036, true)];
        p.body.add(tube(pts, 0.012, m(0.4, 0.4)));
        p.body.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 16).rotateX(Math.PI / 2), gold, front.x, front.y - 0.01, front.z + 0.012));
      }
      break;
    }
  }
}

// ---------- dresses ----------
function buildDress(p, spec) {
  const type = spec.type;
  const m = garment(spec, type === 'gown' ? 'satin' : 'cotton');
  const top = { sundress: 0.86, party: 0.905, gown: 0.865, mermaid: 0.865 }[type];
  add(p.torso, torsoShape(0.54, top, 0.016), m);
  const r0 = torsoR(0.585) + 0.02;
  const skirts = {
    sundress: [[[0.59, r0], [0.48, 0.24], [0.38, 0.29], [0.29, 0.32]], { folds: 8, amp: 0.05 }],
    party: [[[0.59, r0], [0.52, 0.27], [0.44, 0.335], [0.36, 0.365], [0.33, 0.37]], { folds: 12, amp: 0.06 }],
    gown: [[[0.59, r0], [0.5, 0.29], [0.35, 0.41], [0.2, 0.48], [0.05, 0.51], [0.035, 0.5]], { folds: 10, amp: 0.06 }],
    mermaid: [[[0.59, r0], [0.45, 0.205], [0.3, 0.17], [0.2, 0.175], [0.12, 0.24], [0.04, 0.37]], { folds: 10, amp: 0.1, power: 3 }],
  };
  const [rows, opts] = skirts[type];
  add(p.torso, skirtShape(rows, opts), m);
  p.torso.add(ring(torsoR(0.575) + 0.02, 0.007, 0.575, m(1, 0.02)));

  if (type === 'sundress' || type === 'mermaid') straps(p, 0.016, m(0.3, 0.1), 0.84);
  if (type === 'party') {
    p.torso.add(ring(torsoR(0.905) + 0.018, 0.012, 0.905, satin('#ffffff')));
    for (const arm of p.arms) {
      const puff = mesh(sphere(0.082, 24, 16), m(0.5, 0.15), 0, -0.035, 0);
      puff.scale.set(1, 0.85, 1);
      arm.add(puff, ring(armR(0.09) + 0.02, 0.008, -0.095, satin('#ffffff'), 24));
    }
    add(p.torso, skirtShape([[0.5, 0.25], [0.4, 0.33], [0.312, 0.36]], { folds: 26, amp: 0.035 }), (u, v) => tulle({ color: '#ffffff', pattern: 'solid' }, u, v));
    const sash = satin('#ffffff');
    p.torso.add(ring(torsoR(0.575) + 0.024, 0.016, 0.575, sash));
    const back = bow(sash, 1.3);
    back.position.copy(onTorso(0, 0.575, 0.04, true));
    p.body.add(back);
  }
  if (type === 'gown') {
    p.torso.add(ring(torsoR(top) + 0.02, 0.012, top, fabric({ color: spec.color, pattern: 'sparkle' }, 'satin')));
    p.torso.add(ring(torsoR(0.575) + 0.024, 0.014, 0.575, fabric({ color: spec.color, pattern: 'sparkle' }, 'satin')));
    for (const arm of p.arms) {
      const puff = mesh(sphere(0.07, 24, 16), m(0.45, 0.12), 0, -0.07, 0);
      puff.scale.set(1, 0.75, 1);
      arm.add(puff);
    }
  }
  if (type === 'mermaid') {
    const shell = fabric({ color: '#ffffff', pattern: 'sparkle' }, 'satin');
    for (const s of [-1, 1]) {
      const sh = mesh(puffy(starShape(0.035), 0.008), shell);
      sh.position.copy(onTorso(s * 0.06, 0.8, 0.026));
      sh.rotation.y = s * 0.35;
      p.body.add(sh);
    }
  }
}

// ---------- socks ----------
function buildSocks(p, spec) {
  if (spec.type === 'none') return null;
  const top = { ankle: 0.12, crew: 0.2, knee: 0.36, tights: 0.47 }[spec.type];
  const m = garment(spec, 'knit');
  legs(p, 0.03, top, 0.004, m);
  if (spec.type === 'tights') add(p.torso, torsoShape(0.36, 0.56, 0.004), m);
  else legCuffs(p, top - 0.006, legR(top) + 0.006, m(0.3, 0.02));
  return m(0.3, 0.15);
}

// ---------- shoes ----------
const WIDE = [[-0.09, 0.03], [-0.05, 0.038], [0, 0.042], [0.06, 0.047], [0.11, 0.05], [0.15, 0.045], [0.18, 0.033], [0.2, 0.02], [0.22, 0.01]];
const POINTY = [[-0.09, 0.03], [-0.05, 0.036], [0, 0.039], [0.06, 0.043], [0.1, 0.044], [0.15, 0.034], [0.19, 0.016], [0.22, 0.005]];
const wide = (z) => interp(WIDE, z);
const pointy = (z) => interp(POINTY, z);

// Side outlines, [z, height above the ground], heel at -z.
const SNEAKER = [[-0.06, 0.012], [-0.075, 0.03], [-0.078, 0.07], [-0.07, 0.105], [-0.045, 0.115], [-0.015, 0.105], [0.02, 0.095], [0.06, 0.085], [0.1, 0.066], [0.14, 0.052], [0.17, 0.042], [0.185, 0.025], [0.178, 0.012], [0.06, 0.01]];
const SOLE = [[-0.08, 0], [0.06, 0], [0.19, 0], [0.197, 0.012], [0.19, 0.026], [0.06, 0.023], [-0.08, 0.025], [-0.086, 0.012]];
const FLAT = [[-0.06, 0.008], [-0.074, 0.02], [-0.075, 0.045], [-0.06, 0.052], [-0.03, 0.04], [0.03, 0.036], [0.08, 0.04], [0.12, 0.05], [0.16, 0.046], [0.18, 0.03], [0.18, 0.012], [0.06, 0.006]];
const THIN_SOLE = [[-0.075, 0], [0.06, 0], [0.188, 0], [0.19, 0.008], [0.06, 0.009], [-0.075, 0.009], [-0.08, 0.004]];
const HEEL = [[-0.06, 0.008], [-0.072, 0.02], [-0.074, 0.05], [-0.06, 0.056], [-0.03, 0.044], [0.03, 0.034], [0.08, 0.036], [0.13, 0.04], [0.17, 0.032], [0.2, 0.018], [0.2, 0.008], [0.06, 0.006]];
const BOOT = [[-0.06, 0.01], [-0.077, 0.03], [-0.08, 0.1], [-0.07, 0.13], [0.03, 0.13], [0.07, 0.105], [0.11, 0.075], [0.15, 0.058], [0.178, 0.042], [0.188, 0.025], [0.18, 0.01], [0.06, 0.008]];
const COWBOY = [[-0.06, 0.012], [-0.077, 0.03], [-0.08, 0.1], [-0.07, 0.13], [0.03, 0.13], [0.08, 0.095], [0.13, 0.065], [0.18, 0.045], [0.21, 0.028], [0.215, 0.016], [0.2, 0.01], [0.06, 0.01]];

const PITCH = { heels: 0.3, cowboy: 0.1 };
const KIND = { sneakers: 'cotton', lightups: 'cotton', rainboots: 'rubber', maryjanes: 'patent', heels: 'patent', fuzzy: 'fleece', flats: 'satin' };
const CLOSED = ['sneakers', 'lightups', 'rainboots', 'cowboy', 'fuzzy'];
const L = (x, g, z) => V(x, g - ANKLE_Y, z);

function bareFoot(foot, s, mat, toes, nails) {
  const f = mesh(sphere(1, 24, 16), mat, 0, 0.034 - ANKLE_Y, 0.045);
  f.scale.set(0.042, 0.034, 0.098);
  const heel = mesh(sphere(1, 18, 12), mat, 0, 0.036 - ANKLE_Y, -0.028);
  heel.scale.set(0.04, 0.038, 0.048);
  foot.add(f, heel);
  if (!toes) return;
  for (let k = 0; k < 5; k++) {
    const r = 0.015 - k * 0.0017;
    const x = -s * 0.024 + s * k * 0.0125;
    const z = 0.136 - k * 0.007 - (k ? 0.006 : 0);
    foot.add(mesh(sphere(r, 12, 10), mat, x, 0.017 - ANKLE_Y, z));
    if (nails) {
      const n = mesh(sphere(r * 0.6, 10, 8), nails, x, 0.017 - ANKLE_Y + r * 0.55, z + r * 0.35);
      n.scale.set(1, 0.35, 0.9);
      foot.add(n);
    }
  }
}

function buildShoes(p, spec, socks, toeNails) {
  const type = spec.type;
  const pitch = PITCH[type] || 0;
  const mat = garment(spec, KIND[type] || 'leather')(1, 1);
  const rubber = glossMat('#ffffff', 0.5);
  const glow = [];
  let lift = 0;
  for (let z = -0.08; z <= 0.22; z += 0.01) lift = Math.max(lift, -(ANKLE_Y + (-ANKLE_Y * Math.cos(pitch) - z * Math.sin(pitch))));
  if (type === 'heels') lift -= 0.012;

  for (const s of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(s * LEG_X, ANKLE_Y, 0);
    foot.rotation.x = pitch;
    p.body.add(foot);
    if (!CLOSED.includes(type)) bareFoot(foot, s, socks || p.skin, !socks && (type === 'barefoot' || type === 'sandals'), toeNails);

    const heelPost = (rTop, rBottom, m, box = false) => {
      const at = L(0, 0.006, -0.058);
      const g = new THREE.Group();
      g.position.copy(at);
      g.rotation.x = -pitch;
      const len = ANKLE_Y + lift + (at.y * Math.cos(pitch) - at.z * Math.sin(pitch));
      g.add(box ? mesh(new THREE.BoxGeometry(0.06, len, 0.045), m, 0, -len / 2, 0) : mesh(new THREE.CylinderGeometry(rTop, rBottom, len, 14), m, 0, -len / 2, 0));
      foot.add(g);
    };
    const shaft = (top, inflate, m, flareTop = 0) => {
      p.body.add(mesh(legShape(0.07, top, inflate, { flareTop })[0], m, s * LEG_X, 0, 0));
      p.body.add(ring(legR(top) + inflate + flareTop, 0.01, top, m, 28).translateX(s * LEG_X));
    };

    switch (type) {
      case 'sneakers':
      case 'lightups': {
        foot.add(mesh(sideExtrude(SNEAKER, wide), mat));
        let soleMat = rubber;
        if (type === 'lightups') {
          soleMat = phys({ color: '#ffffff', roughness: 0.4, emissive: '#ff5fa2', emissiveIntensity: 2 });
          soleMat.userData.phase = s > 0 ? 0 : 0.5;
          glow.push(soleMat);
        }
        foot.add(mesh(sideExtrude(SOLE, (z) => wide(z) * 1.1, { bevel: 0.005 }), soleMat));
        const lace = plainMat('#ffffff', 0.6);
        for (const [z, g] of [[0.0, 0.103], [0.03, 0.097], [0.06, 0.089], [0.09, 0.075]]) foot.add(rod(L(-0.026, g, z), L(0.026, g, z), 0.0045, lace));
        const star = mesh(puffy(starShape(0.022), 0.004), rubber, s * (wide(0.02) + 0.013), 0.055 - ANKLE_Y, 0.0);
        star.rotation.y = (s * Math.PI) / 2;
        foot.add(star);
        break;
      }
      case 'sandals': {
        foot.add(mesh(soleExtrude(wide, -0.085, 0.19, 0.016), glossMat('#d9a36b', 0.6)));
        foot.add(tube([L(-0.046, 0.02, 0.1), L(-0.022, 0.044, 0.105), L(0.022, 0.044, 0.105), L(0.046, 0.02, 0.1)], 0.007, mat));
        foot.add(tube([L(-0.046, 0.02, 0.03), L(-0.026, 0.068, 0.035), L(0.026, 0.068, 0.035), L(0.046, 0.02, 0.03)], 0.007, mat));
        foot.add(mesh(new THREE.TorusGeometry(legR(0.1) + 0.009, 0.006, 8, 28).rotateX(Math.PI / 2), mat, 0, 0.1 - ANKLE_Y, 0));
        foot.add(rod(L(0, 0.1, -0.05), L(0, 0.02, -0.07), 0.007, mat));
        const flower = mesh(puffy(starShape(0.018, 0.75), 0.005), plainMat('#ffffff', 0.5), 0, 0.071 - ANKLE_Y, 0.04);
        flower.rotation.x = -1.2;
        foot.add(flower);
        break;
      }
      case 'flats':
      case 'maryjanes':
        foot.add(mesh(sideExtrude(FLAT, wide, { bevel: 0.006 }), mat));
        foot.add(mesh(sideExtrude(THIN_SOLE, (z) => wide(z) * 1.04, { bevel: 0.003 }), plainMat('#3b2a22', 0.6)));
        if (type === 'flats') {
          const b = bow(mat, 0.55);
          b.position.copy(L(0, 0.05, 0.115));
          b.rotation.x = -0.4;
          foot.add(b);
        } else {
          foot.add(tube([L(-0.046, 0.03, 0.02), L(-0.026, 0.072, 0.025), L(0.026, 0.072, 0.025), L(0.046, 0.03, 0.02)], 0.008, mat));
          foot.add(mesh(new THREE.BoxGeometry(0.008, 0.018, 0.016), metalMat(0), s * 0.047, 0.032 - ANKLE_Y, 0.02));
        }
        break;
      case 'heels': {
        foot.add(mesh(sideExtrude(HEEL, pointy, { bevel: 0.006 }), mat));
        foot.add(mesh(sideExtrude(THIN_SOLE, (z) => pointy(z) * 1.04, { bevel: 0.003 }), plainMat('#2a1a1a', 0.5)));
        heelPost(0.012, 0.006, mat);
        const gem = mesh(new THREE.OctahedronGeometry(0.012), metalMat(0), 0, 0.042 - ANKLE_Y, 0.15);
        gem.scale.y = 0.6;
        foot.add(gem);
        break;
      }
      case 'rainboots':
      case 'fuzzy': {
        const fuzzy = type === 'fuzzy';
        foot.add(mesh(sideExtrude(BOOT, (z) => wide(z) * (fuzzy ? 1.1 : 1.02), { bevel: fuzzy ? 0.02 : 0.01 }), mat));
        foot.add(mesh(sideExtrude(SOLE, (z) => wide(z) * 1.12, { bevel: 0.005 }), fuzzy ? plainMat('#efe6da', 0.8) : glossMat('#5b4636', 0.4)));
        shaft(fuzzy ? 0.24 : 0.27, fuzzy ? 0.045 : 0.03, mat, fuzzy ? 0.005 : 0.012);
        if (fuzzy) {
          const pom = fabric({ color: '#ffffff', pattern: 'solid' }, 'fleece');
          for (const k of [-1, 1]) p.body.add(mesh(sphere(0.02, 14, 10), pom, s * LEG_X + k * 0.018, 0.2, legR(0.22) + 0.06));
        }
        break;
      }
      case 'cowboy': {
        foot.add(mesh(sideExtrude(COWBOY, pointy, { bevel: 0.01 }), mat));
        foot.add(mesh(sideExtrude(THIN_SOLE, (z) => pointy(z) * 1.05, { bevel: 0.003 }), plainMat('#3b2414', 0.6)));
        heelPost(0, 0, plainMat('#3b2414', 0.6), true);
        shaft(0.26, 0.028, mat, 0.022);
        const stitch = metalMat(0);
        for (const k of [-1, 1]) {
          const st = mesh(puffy(starShape(0.02), 0.003), stitch, s * LEG_X + k * (legR(0.19) + 0.03), 0.19, 0);
          st.rotation.y = (k * Math.PI) / 2;
          p.body.add(st);
        }
        break;
      }
    }
  }
  return { lift, glow };
}

const ARM_REST = { gown: 0.45, party: 0.36, tutu: 0.3, skirt: 0.2, sundress: 0.2, mermaid: 0.12 };

/** Put clothes on the sailor's body parts. Returns how high the shoes lift the kid, and anything that glows. */
export function dressUp(p, cfg) {
  const inDress = cfg.dress.type !== 'none';
  const sockMat = buildSocks(p, cfg.socks);
  const { lift, glow } = buildShoes(p, cfg.shoes, sockMat, p.nails);
  if (inDress) buildDress(p, cfg.dress);
  else {
    buildBottom(p, cfg.bottom);
    buildTop(p, cfg.top, ['skirt', 'tutu', 'overalls'].includes(cfg.bottom.type));
  }
  const armRest = Math.max(0.1, ARM_REST[inDress ? cfg.dress.type : cfg.bottom.type] || 0);
  return { lift, glow, armRest };
}
