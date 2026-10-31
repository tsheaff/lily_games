import * as THREE from 'three';
import {
  HEAD_R, TORSO_DEPTH, WRIST, armR, torsoR,
  mesh, sphere, cyl, rod, ring, lathe, heartShape, starShape, puffy, phys, fabric, plainMat, glossMat, metalMat, gemMat, pearlMat,
} from './parts.js';
import { emojiTexture, strawTexture, tiled } from './textures.js';
import { CLOTH_COLORS } from './wardrobe.js';
import { SPECTRUM_HEX } from './utils.js';

const R = HEAD_R;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const badge = (emoji, size) =>
  mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: emojiTexture(emoji), transparent: true, roughness: 0.5, depthWrite: false }));

function satinBow(mat, size = 1) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.SphereGeometry(0.06 * size, 16, 12), mat, s * 0.065 * size, 0, 0);
    loop.scale.set(1.2, 0.75, 0.45);
    loop.rotation.z = s * 0.25;
    g.add(loop);
    const tail = mesh(new THREE.ConeGeometry(0.025 * size, 0.1 * size, 10), mat, s * 0.03 * size, -0.06 * size, 0);
    tail.rotation.z = s * 0.4;
    tail.scale.z = 0.4;
    g.add(tail);
  }
  g.add(mesh(sphere(0.028 * size, 14, 10), mat));
  return g;
}

function flower(petal, size = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const pm = mesh(sphere(0.022 * size, 12, 8), petal, Math.cos(a) * 0.022 * size, Math.sin(a) * 0.022 * size, 0);
    pm.scale.set(1, 1, 0.45);
    g.add(pm);
  }
  g.add(mesh(sphere(0.014 * size, 10, 8), plainMat('#ffd23f', 0.5), 0, 0, 0.006 * size));
  return g;
}

// ---------- hats ----------
function addHat(head, cfg) {
  const color = CLOTH_COLORS[cfg.hatColor];
  const cloth = (kind = 'cotton') => fabric({ color, pattern: 'solid' }, kind);
  const g = new THREE.Group();
  head.add(g);
  switch (cfg.hat) {
    case 'captain': {
      g.position.y = 0.22;
      g.rotation.x = -0.15;
      g.add(mesh(cyl(0.255, 0.24, 0.15, 40), fabric({ color: '#f3f2f7' }), 0, 0.035, 0));
      g.add(mesh(cyl(0.243, 0.243, 0.055, 40), fabric({ color: '#1f2a55' }), 0, -0.035, 0));
      g.add(mesh(new THREE.TorusGeometry(0.245, 0.006, 8, 48).rotateX(Math.PI / 2), metalMat(0), 0, -0.005, 0));
      const brim = mesh(sphere(0.2, 32, 16), glossMat('#151d40', 0.2), 0, -0.06, 0.17);
      brim.scale.set(1, 0.1, 0.7);
      const b = badge('⚓', 0.085);
      b.position.set(0, 0.04, 0.252);
      g.add(brim, b);
      break;
    }
    case 'pirate': {
      g.position.y = 0.2;
      g.rotation.x = -0.12;
      const black = phys({ color: '#1b1820', roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color('#5a5070') });
      const dome = mesh(new THREE.SphereGeometry(0.23, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), black);
      dome.scale.y = 0.6;
      g.add(dome);
      // A bicorne: two tall half-moon flaps, front and back, edged in gold.
      const flap = new THREE.Shape();
      flap.absellipse(0, 0, 0.34, 0.24, 0, Math.PI, false);
      const flapGeo = new THREE.ExtrudeGeometry(flap, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 32 });
      const trimPts = new THREE.EllipseCurve(0, 0, 0.345, 0.245, 0, Math.PI).getPoints(40).map((p) => V(p.x, p.y, 0));
      for (const side of [1, -1]) {
        const f = new THREE.Group();
        f.position.set(0, -0.03, side * 0.23);
        f.rotation.x = -side * 0.2;
        f.add(mesh(flapGeo, black, 0, 0, -0.006), mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts), 64, 0.008, 6), metalMat(0), 0, 0, side * 0.012));
        if (side > 0) {
          const b = badge('☠️', 0.13);
          b.position.set(0, 0.11, 0.025);
          f.add(b);
        }
        g.add(f);
      }
      break;
    }
    case 'sunhat': {
      g.position.y = 0.17;
      g.rotation.x = -0.12;
      const straw = phys({ map: tiled(strawTexture(), 6, 1), roughness: 0.9, sheen: 0.4, sheenColor: new THREE.Color('#fff2c0') });
      const brim = mesh(lathe([[0.2, 0.0], [0.38, -0.01], [0.5, -0.045]], { segments: 64 }), straw);
      const crown = mesh(sphere(0.2, 32, 12), straw, 0, 0.165, 0);
      crown.scale.y = 0.25;
      g.add(brim, mesh(cyl(0.2, 0.26, 0.17, 40), straw, 0, 0.085, 0), crown);
      g.add(mesh(cyl(0.262, 0.262, 0.05, 40), cloth('satin'), 0, 0.03, 0));
      const f = flower(plainMat('#ffffff', 0.5), 1.4);
      f.position.set(0.17, 0.04, 0.2);
      f.rotation.y = 0.7;
      g.add(f);
      break;
    }
    case 'cap': {
      const m = cloth();
      const top = mesh(new THREE.SphereGeometry(R + 0.04, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.03, 0);
      top.rotation.x = -0.3;
      const visor = mesh(sphere(0.18, 32, 16), m, 0, 0.1, 0.25);
      visor.scale.set(1, 0.1, 0.9);
      g.add(top, visor, mesh(sphere(0.025, 12, 10), m, 0, R + 0.07, -0.02));
      const star = mesh(puffy(starShape(0.045), 0.006), plainMat('#ffffff', 0.5), 0, 0.2, 0.2);
      star.rotation.x = -0.75;
      g.add(star);
      break;
    }
    case 'beanie': {
      const knit = cloth('knit');
      const dome = mesh(new THREE.SphereGeometry(R + 0.035, 40, 20, 0, Math.PI * 2, 0, 1.55), knit);
      dome.rotation.x = -0.4;
      const edgeR = (R + 0.035) * Math.sin(1.55);
      dome.add(mesh(new THREE.TorusGeometry(edgeR, 0.025, 10, 48).rotateX(Math.PI / 2), knit, 0, (R + 0.035) * Math.cos(1.55) + 0.01, 0));
      dome.add(mesh(sphere(0.07, 20, 16), fabric({ color: '#ffffff' }, 'fleece'), 0, R + 0.08, 0));
      g.add(dome);
      break;
    }
    case 'crown': {
      const gold = phys({ color: '#ffcf4a', metalness: 1, roughness: 0.25, emissive: '#7a4a00', emissiveIntensity: 0.2 });
      g.position.y = 0.25;
      g.add(mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.1, 32, 1, true), gold));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mesh(new THREE.ConeGeometry(0.05, 0.13, 8), gold, Math.sin(a) * 0.17, 0.1, Math.cos(a) * 0.17));
        g.add(mesh(sphere(0.018, 12, 10), gold, Math.sin(a) * 0.175, 0.17, Math.cos(a) * 0.175));
        g.add(mesh(new THREE.OctahedronGeometry(0.025), gemMat(['#ff3b6b', '#4fb8ff', '#5cd88a', '#b47cff', '#ffd23f'][i]), Math.sin(a) * 0.19, 0.0, Math.cos(a) * 0.19));
      }
      break;
    }
    case 'tiara': {
      const metal = metalMat(cfg.metal);
      g.position.set(0, 0.17, 0.01);
      g.rotation.x = -0.3;
      const r = 0.235;
      g.add(mesh(new THREE.TorusGeometry(r, 0.008, 8, 40, 2.4).rotateX(Math.PI / 2).rotateY(1.2 + Math.PI / 2), metal));
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + (i / 6) * 1.8;
        const h = 0.03 + (1 - Math.abs(a) / 0.9) * 0.06;
        const x = Math.sin(a) * r;
        const z = Math.cos(a) * r;
        g.add(rod(V(x, 0, z), V(x, h, z), 0.005, metal, 0.002));
        g.add(mesh(sphere(i === 3 ? 0.022 : 0.011, 14, 10), gemMat(i === 3 ? '#ff9ccf' : '#e9f7ff'), x, h + 0.004, z));
      }
      break;
    }
    case 'flowers': {
      g.position.y = 0.15;
      g.rotation.x = -0.3;
      const colors = ['#ff8ac4', '#ffffff', '#ffd23f', '#b47cff', '#ff5f7e'];
      const leaf = plainMat('#4caf50', 0.6);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const f = flower(plainMat(colors[i % colors.length], 0.55), 1.2);
        f.position.set(Math.sin(a) * 0.235, 0, Math.cos(a) * 0.235);
        f.lookAt(Math.sin(a) * 2, 0.6, Math.cos(a) * 2);
        g.add(f);
        const l = mesh(sphere(0.02, 8, 6), leaf, Math.sin(a + 0.28) * 0.24, -0.01, Math.cos(a + 0.28) * 0.24);
        l.scale.set(1.6, 0.4, 0.8);
        g.add(l);
      }
      break;
    }
    case 'headband':
    case 'ears': {
      const band = mesh(new THREE.TorusGeometry(R + 0.03, 0.014, 10, 48, Math.PI * 1.06), cloth('satin'), 0, 0, 0);
      band.rotation.set(-0.35, 0, -0.03 * Math.PI);
      g.add(band);
      if (cfg.hat === 'headband') {
        const b = satinBow(cloth('satin'), 0.7);
        b.position.set(-0.16, 0.22, 0.12);
        b.rotation.set(-0.3, -0.5, 0.5);
        g.add(b);
      } else {
        const inner = plainMat('#ffb3d1', 0.6);
        for (const s of [-1, 1]) {
          const ear = new THREE.Group();
          ear.position.set(s * 0.13, 0.27, 0.02);
          ear.rotation.set(-0.3, 0, -s * 0.45);
          const outer = mesh(new THREE.ConeGeometry(0.07, 0.13, 3), cloth('fleece'), 0, 0.05, 0);
          outer.scale.z = 0.4;
          const pink = mesh(new THREE.ConeGeometry(0.045, 0.085, 3), inner, 0, 0.04, 0.012);
          pink.scale.z = 0.3;
          ear.add(outer, pink);
          g.add(ear);
        }
      }
      break;
    }
    case 'bow': {
      const b = satinBow(cloth('satin'), 1.1);
      b.position.set(0.12, 0.25, 0.02);
      b.rotation.z = -0.4;
      g.add(b);
      break;
    }
  }
}

// ---------- glasses ----------
function lensShape(type, scale = 1) {
  if (type === 'hearts') return heartShape(0.13 * scale);
  if (type === 'stars') return starShape(0.07 * scale, 0.55);
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.05 * scale, 0, Math.PI * 2, false);
  return s;
}

function addGlasses(head, cfg) {
  const type = cfg.glasses;
  if (type === 'none') return;
  const style = {
    sunglasses: { frame: glossMat('#141418', 0.2), lens: phys({ color: '#121218', metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.88 }) },
    hearts: { frame: glossMat('#ff2f7a', 0.25), lens: phys({ color: '#ff5fa2', roughness: 0.05, transparent: true, opacity: 0.55, iridescence: 0.6 }) },
    stars: { frame: glossMat('#ffb020', 0.25), lens: phys({ color: '#ffd23f', roughness: 0.05, transparent: true, opacity: 0.5, iridescence: 0.6 }) },
    round: { frame: metalMat(cfg.metal), lens: phys({ color: '#e6f5ff', roughness: 0.02, transparent: true, opacity: 0.18 }) },
  }[type];
  const g = new THREE.Group();
  g.position.set(0, 0.01, 0.288);
  head.add(g);
  for (const s of [-1, 1]) {
    const outer = lensShape(type, 1.15);
    outer.holes.push(new THREE.Path(lensShape(type, 0.95).getPoints(40)));
    const frame = mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.008, bevelEnabled: false, curveSegments: 24 }), style.frame, s * 0.09, 0, -0.004);
    const lens = mesh(new THREE.ShapeGeometry(lensShape(type, 1.0), 24), style.lens, s * 0.09, 0, 0);
    lens.renderOrder = 3;
    g.add(frame, lens);
    g.add(rod(V(s * 0.148, 0.012, 0.0), V(s * 0.245, 0.03, -0.27), 0.004, style.frame));
  }
  g.add(rod(V(-0.035, 0.015, 0.004), V(0.035, 0.015, 0.004), 0.005, style.frame));
}

// ---------- jewelry ----------
/** A loop that drapes from the back of the neck down onto the chest, over any top. */
function necklaceCurve(drop = 0.055, inflate = 0.038) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const y = 0.905 - drop * Math.pow((1 + Math.cos(a)) / 2, 1.5);
    const r = torsoR(y) + inflate;
    pts.push(V(r * Math.sin(a), y, r * Math.cos(a) * TORSO_DEPTH));
  }
  return new THREE.CatmullRomCurve3(pts, true);
}

function addNecklace(body, cfg) {
  const type = cfg.necklace;
  if (type === 'none') return;
  const metal = metalMat(cfg.metal);
  const curve = necklaceCurve(type === 'pearls' || type === 'beads' ? 0.045 : 0.06);
  const front = curve.getPointAt(0);
  const chain = () => body.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.0032, 6, true), metal));
  const hang = (m, dy = -0.028) => {
    m.position.set(front.x, front.y + dy, front.z + 0.012);
    body.add(m, rod(V(front.x, front.y + 0.002, front.z), V(front.x, front.y + dy + 0.02, front.z + 0.01), 0.003, metal));
  };
  switch (type) {
    case 'pearls':
    case 'beads': {
      const n = type === 'pearls' ? 34 : 30;
      const g = sphere(type === 'pearls' ? 0.0115 : 0.0125, 14, 10);
      const mats = type === 'pearls' ? [pearlMat()] : SPECTRUM_HEX.map((c) => glossMat(c, 0.2));
      curve.getSpacedPoints(n).slice(0, n).forEach((p, i) => body.add(mesh(g, mats[i % mats.length], p.x, p.y, p.z)));
      break;
    }
    case 'heart': {
      chain();
      const h = mesh(puffy(heartShape(0.06), 0.006), metal);
      hang(h);
      const gem = mesh(sphere(0.008, 12, 10), gemMat('#ff5f9a'), 0, 0, 0.012);
      h.add(gem);
      break;
    }
    case 'diamond': {
      chain();
      const d = mesh(new THREE.OctahedronGeometry(0.022, 0), gemMat('#eaf8ff'));
      d.scale.set(0.9, 1.3, 0.6);
      hang(d, -0.035);
      break;
    }
    case 'starfish': {
      chain();
      const st = mesh(puffy(starShape(0.035, 0.5), 0.008), phys({ color: '#ff8a3d', roughness: 0.65, sheen: 0.6, sheenColor: new THREE.Color('#ffd0a0') }));
      hang(st, -0.035);
      break;
    }
  }
}

function addEarrings(head, cfg) {
  const type = cfg.earrings;
  if (type === 'none') return;
  const metal = metalMat(cfg.metal);
  for (const s of [-1, 1]) {
    const x = s * (R * 0.96 + 0.014);
    const lobe = V(x, -0.062, 0);
    const g = new THREE.Group();
    g.position.copy(lobe);
    head.add(g);
    if (type !== 'hoops') g.add(mesh(sphere(0.008, 10, 8), type === 'studs' ? gemMat('#eaf8ff') : metal));
    switch (type) {
      case 'studs':
        g.children[0].scale.setScalar(1.5);
        break;
      case 'hoops':
        g.add(mesh(new THREE.TorusGeometry(0.03, 0.0035, 8, 32).rotateY(Math.PI / 2), metal, 0, -0.028, 0));
        break;
      case 'pearls':
        g.add(rod(V(0, 0, 0), V(0, -0.025, 0), 0.0022, metal), mesh(sphere(0.014, 14, 10), pearlMat(), 0, -0.038, 0));
        break;
      case 'hearts': {
        const h = mesh(puffy(heartShape(0.04), 0.004), glossMat('#ff3b7a', 0.2), 0, -0.03, 0);
        h.rotation.y = (s * Math.PI) / 2;
        g.add(rod(V(0, 0, 0), V(0, -0.015, 0), 0.0022, metal), h);
        break;
      }
      case 'stars': {
        const st = mesh(puffy(starShape(0.02), 0.004), metalMat(0), 0, -0.03, 0);
        st.rotation.y = (s * Math.PI) / 2;
        g.add(rod(V(0, 0, 0), V(0, -0.012, 0), 0.0022, metal), st);
        break;
      }
    }
  }
}

function addBracelets(arms, cfg) {
  const type = cfg.bracelet;
  if (type === 'none') return;
  const metal = metalMat(cfg.metal);
  const longSleeve = cfg.dress.type === 'none' && ['long', 'hoodie', 'sweater'].includes(cfg.top.type);
  const r = armR(WRIST) + (longSleeve ? 0.04 : 0.012);
  const y = -WRIST - 0.01;
  const [left, right] = arms;
  switch (type) {
    case 'bangles':
      for (const arm of arms)
        [0, 1, 2].forEach((i) => {
          const b = ring(r + i * 0.002, 0.004, y - i * 0.012, metal, 32);
          b.rotation.z = (i - 1) * 0.15;
          arm.add(b);
        });
      break;
    case 'beads': {
      const g = sphere(0.0085, 10, 8);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        left.add(mesh(g, glossMat(SPECTRUM_HEX[i % 7], 0.2), Math.cos(a) * r, y, Math.sin(a) * r));
      }
      break;
    }
    case 'charms': {
      left.add(ring(r, 0.003, y, metal, 32));
      const charms = [puffy(heartShape(0.025), 0.003), puffy(starShape(0.013), 0.003), new THREE.OctahedronGeometry(0.008)];
      charms.forEach((geo, i) => {
        const a = 0.4 + i * 1.1;
        const c = mesh(geo, i === 2 ? gemMat('#b47cff') : i ? metalMat(0) : glossMat('#ff3b7a', 0.2), Math.cos(a) * (r + 0.004), y - 0.016, Math.sin(a) * (r + 0.004));
        c.rotation.y = -a + Math.PI / 2;
        left.add(c);
      });
      break;
    }
    case 'watch': {
      const band = glossMat('#ff8ac4', 0.35);
      const w = ring(r, 0.008, y, band, 32);
      w.scale.y = 1.6;
      right.add(w);
      const face = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 24).rotateZ(Math.PI / 2), metal, -(r + 0.008), y, 0);
      const screen = mesh(new THREE.CircleGeometry(0.016, 24).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: emojiTexture('💖', 64), emissive: '#ff5fa2', emissiveIntensity: 0.6, roughness: 0.1 }), -(r + 0.0135), y, 0);
      right.add(face, screen);
      break;
    }
  }
}

export function accessorize(p, cfg) {
  addHat(p.head, cfg);
  addGlasses(p.head, cfg);
  addEarrings(p.head, cfg);
  addNecklace(p.body, cfg);
  addBracelets(p.arms, cfg);
}
