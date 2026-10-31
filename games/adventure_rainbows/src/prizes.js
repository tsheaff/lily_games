import * as THREE from 'three';

export const PRIZES = [
  { id: 'heart', name: 'Sparkly Heart', emoji: '💖', color: '#ff4f9a' },
  { id: 'diamond', name: 'Blue Diamond', emoji: '💎', color: '#4fd8ff' },
  { id: 'star', name: 'Golden Star', emoji: '⭐', color: '#ffd23f' },
  { id: 'crown', name: 'Princess Crown', emoji: '👑', color: '#ffb627' },
  { id: 'crystal', name: 'Magic Crystal Ball', emoji: '🔮', color: '#b46bff' },
  { id: 'pearl', name: 'Shiny Pearl', emoji: '🦪', color: '#ffd6f0' },
  { id: 'flower', name: 'Magic Flower', emoji: '🌸', color: '#ff8ad8' },
  { id: 'rainbow', name: 'Rainbow Gem', emoji: '🌈', color: '#9dffcf' },
];
export const PRIZE_BY_ID = Object.fromEntries(PRIZES.map((p) => [p.id, p]));

function shiny(color, emissive, emissiveIntensity, opts = {}) {
  // Very low roughness makes sun highlights overflow the HDR buffer, which bloom smears into big squares.
  const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: 0.2, metalness: 0.1, ...opts });
  m.roughness = Math.max(m.roughness, 0.3);
  return m;
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(25, 25);
  s.bezierCurveTo(25, 25, 20, 0, 0, 0);
  s.bezierCurveTo(-30, 0, -30, 35, -30, 35);
  s.bezierCurveTo(-30, 55, -10, 77, 25, 95);
  s.bezierCurveTo(60, 77, 80, 55, 80, 35);
  s.bezierCurveTo(80, 35, 80, 0, 50, 0);
  s.bezierCurveTo(35, 0, 25, 25, 25, 25);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 18, bevelEnabled: true, bevelThickness: 9, bevelSize: 7, bevelSegments: 4, curveSegments: 28,
  });
  g.rotateZ(Math.PI);
  g.center();
  g.scale(0.021, 0.021, 0.021);
  return g;
}

function starShape(outer, inner, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

export function starGeometry(outer, inner, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(starShape(outer, inner), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
  });
  g.center();
  return g;
}

function addVertexColorGlow(mat, amount) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * ${amount.toFixed(2)};`
    );
  };
  return mat;
}

export function makePrizeModel(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'heart': {
      g.add(new THREE.Mesh(heartGeometry(), shiny('#ff4f9a', '#ff2277', 0.55, { roughness: 0.18 })));
      break;
    }
    case 'diamond': {
      const geo = new THREE.LatheGeometry(
        [new THREE.Vector2(0, -1.3), new THREE.Vector2(1.15, 0), new THREE.Vector2(0.75, 0.5), new THREE.Vector2(0, 0.5)],
        8
      );
      const m = new THREE.Mesh(geo, shiny('#5ad8ff', '#1e8cff', 0.6, { flatShading: true, roughness: 0.05, metalness: 0.35 }));
      m.position.y = 0.35;
      g.add(m);
      break;
    }
    case 'star': {
      g.add(new THREE.Mesh(starGeometry(1.35, 0.58, 0.35, 0.16), shiny('#ffd23f', '#ff9d00', 0.45, { metalness: 0.7, roughness: 0.25 })));
      break;
    }
    case 'crown': {
      const gold = shiny('#ffc93c', '#ff8a00', 0.35, { metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide });
      const pink = shiny('#ff6fb5', '#ff2a8a', 0.6);
      const gems = [shiny('#ff3b6b', '#ff0040', 0.6), shiny('#4fb8ff', '#0070ff', 0.6), shiny('#4dff8a', '#00c050', 0.6)];
      const inner = new THREE.Group();
      inner.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.55, 28, 1, true), gold));
      const cushion = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        shiny('#d6336c', '#a0104a', 0.3, { roughness: 0.8 })
      );
      cushion.scale.y = 0.65;
      cushion.position.y = 0.05;
      inner.add(cushion);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.8, 4), gold);
        spike.position.set(Math.cos(a) * 0.97, 0.66, Math.sin(a) * 0.97);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), pink);
        ball.position.set(Math.cos(a) * 0.97, 1.1, Math.sin(a) * 0.97);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), gems[i % 3]);
        gem.position.set(Math.cos(a + 0.52) * 1.03, 0, Math.sin(a + 0.52) * 1.03);
        inner.add(spike, ball, gem);
      }
      inner.rotation.x = 0.3;
      inner.position.y = -0.3;
      g.add(inner);
      break;
    }
    case 'crystal': {
      const gold = shiny('#ffc93c', '#ff8a00', 0.3, { metalness: 0.85, roughness: 0.25 });
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 36, 24),
        new THREE.MeshPhysicalMaterial({
          color: '#c38bff', emissive: '#8a3dff', emissiveIntensity: 0.75, roughness: 0.3,
          clearcoat: 1, clearcoatRoughness: 0.3, iridescence: 0.6,
        })
      );
      ball.position.y = 0.4;
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 0.35, 28), gold);
      stand.position.y = -0.62;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 10, 32), gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.42;
      g.add(ball, stand, ring);
      break;
    }
    case 'pearl': {
      const shellMat = shiny('#ffb3d1', '#ff6fa8', 0.3, { roughness: 0.4, side: THREE.DoubleSide });
      const half = () => {
        const geo = new THREE.SphereGeometry(1.15, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i);
          const z = p.getZ(i);
          const f = 1 + 0.07 * Math.cos(Math.atan2(z, x) * 14);
          p.setXYZ(i, x * f, p.getY(i) * 0.4, z * f);
        }
        geo.computeVertexNormals();
        return geo;
      };
      const inner = new THREE.Group();
      const bottom = new THREE.Mesh(half(), shellMat);
      bottom.rotation.x = Math.PI;
      const hinge = new THREE.Group();
      hinge.position.z = -1.1;
      const top = new THREE.Mesh(half(), shellMat);
      top.position.z = 1.1;
      hinge.add(top);
      hinge.rotation.x = -1.0;
      const pearl = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 32, 20),
        new THREE.MeshPhysicalMaterial({
          color: '#fff6fb', roughness: 0.3, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.6,
          iridescenceThicknessRange: [200, 600], emissive: '#ffe0f0', emissiveIntensity: 0.3, clearcoat: 1,
        })
      );
      pearl.position.y = 0.4;
      inner.add(bottom, hinge, pearl);
      inner.rotation.x = 0.45;
      g.add(inner);
      break;
    }
    case 'flower': {
      const petalMat = shiny('#ff8ad8', '#ff3fb0', 0.5, { roughness: 0.35, side: THREE.DoubleSide });
      const whiteMat = shiny('#fff0fa', '#ffc0e8', 0.35, { roughness: 0.35, side: THREE.DoubleSide });
      const centerMat = shiny('#ffe14d', '#ffb000', 0.6, { roughness: 0.5 });
      const inner = new THREE.Group();
      const petalGeo = new THREE.SphereGeometry(0.5, 18, 10);
      petalGeo.scale(0.6, 0.14, 1.0);
      petalGeo.translate(0, 0, 0.75);
      for (let i = 0; i < 6; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i / 6) * Math.PI * 2;
        const m = new THREE.Mesh(petalGeo, petalMat);
        m.rotation.x = -0.35;
        pivot.add(m);
        inner.add(pivot);
      }
      for (let i = 0; i < 5; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i / 5) * Math.PI * 2 + 0.3;
        const m = new THREE.Mesh(petalGeo, whiteMat);
        m.scale.setScalar(0.62);
        m.position.y = 0.08;
        m.rotation.x = -0.6;
        pivot.add(m);
        inner.add(pivot);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), centerMat);
      center.position.y = 0.12;
      inner.add(center);
      inner.rotation.x = 1.05;
      g.add(inner);
      break;
    }
    case 'rainbow': {
      const geo = new THREE.IcosahedronGeometry(1.15, 0);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const c = new THREE.Color();
      for (let f = 0; f < pos.count / 3; f++) {
        c.setHSL(f / (pos.count / 3), 0.95, 0.6);
        for (let v = 0; v < 3; v++) colors.set([c.r, c.g, c.b], (f * 3 + v) * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = addVertexColorGlow(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.2, flatShading: true }),
        0.6
      );
      g.add(new THREE.Mesh(geo, mat));
      break;
    }
  }
  return g;
}

export function makeChest() {
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#b8692f', roughness: 0.75, flatShading: true });
  const woodDS = wood.clone();
  woodDS.side = THREE.DoubleSide;
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 0.85, roughness: 0.3, emissive: '#7a4a00', emissiveIntensity: 0.35 });
  const goldDS = gold.clone();
  goldDS.side = THREE.DoubleSide;
  const W = 2.4;
  const H = 1.3;
  const D = 1.6;

  const base = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wood);
  base.position.y = H / 2;
  root.add(base);
  for (const x of [-W / 2 + 0.28, W / 2 - 0.28]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.22, H + 0.04, D + 0.06), gold);
    band.position.set(x, H / 2, 0);
    root.add(band);
  }
  const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.14, D + 0.06), gold);
  rim.position.y = H - 0.06;
  root.add(rim);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 0.14), gold);
  lock.position.set(0, H - 0.2, D / 2 + 0.06);
  root.add(lock);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.15, D - 0.15),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe9a0').multiplyScalar(2.4) })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = H - 0.02;
  root.add(glow);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H, -D / 2);
  root.add(lidPivot);
  const lidGeo = new THREE.CylinderGeometry(D / 2, D / 2, W, 16, 1, false, 0, Math.PI);
  lidGeo.rotateZ(Math.PI / 2);
  const lid = new THREE.Mesh(lidGeo, woodDS);
  lid.position.z = D / 2;
  lidPivot.add(lid);
  for (const x of [-W / 2 + 0.28, W / 2 - 0.28]) {
    const bg = new THREE.CylinderGeometry(D / 2 + 0.04, D / 2 + 0.04, 0.22, 16, 1, true, 0, Math.PI);
    bg.rotateZ(Math.PI / 2);
    const band = new THREE.Mesh(bg, goldDS);
    band.position.set(x, 0, D / 2);
    lidPivot.add(band);
  }

  root.userData.lidPivot = lidPivot;
  root.userData.height = H;
  return root;
}
