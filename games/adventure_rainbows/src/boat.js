import * as THREE from 'three';
import { damp, wrapAngle, spectrumColor } from './utils.js';

const MAX_SPEED = 15;
const TURN_RATE = 1.6;

function hullShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 2.7);
  s.quadraticCurveTo(1.45, 1.2, 1.35, -0.6);
  s.quadraticCurveTo(1.25, -2.2, 0.9, -2.3);
  s.lineTo(-0.9, -2.3);
  s.quadraticCurveTo(-1.25, -2.2, -1.35, -0.6);
  s.quadraticCurveTo(-1.45, 1.2, 0, 2.7);
  return s;
}

function sailGeometry() {
  const rows = 7;
  const cols = 6;
  const P = (u, v) => {
    const y = 1.95 + v * 4.05;
    const chord = 2.45 * (1 - v);
    return [Math.sin(Math.PI * u) * 0.45 * (1 - v * 0.7), y, 0.5 - u * chord];
  };
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  const white = new THREE.Color(1, 1, 1);
  for (let r = 0; r < rows; r++) {
    const v0 = r / rows;
    const v1 = (r + 1) / rows;
    spectrumColor(r / (rows - 1), c).lerp(white, 0.12);
    for (let k = 0; k < cols; k++) {
      const u0 = k / cols;
      const u1 = (k + 1) / cols;
      const a = P(u0, v0), b = P(u1, v0), d = P(u1, v1), e = P(u0, v1);
      pos.push(...a, ...b, ...d, ...a, ...d, ...e);
      for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function triangle(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.computeVertexNormals();
  return g;
}

function buildModel() {
  const root = new THREE.Group();
  const shape = hullShape();

  const hullGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.0, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.18, bevelSegments: 3, curveSegments: 20,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.4, 0);
  const hp = hullGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    if (y < 0.3) {
      hp.setX(i, hp.getX(i) * (1 - (0.3 - y) * 0.28));
      hp.setZ(i, hp.getZ(i) * (1 - (0.3 - y) * 0.08));
    }
  }
  root.add(new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ color: '#ff6f91', roughness: 0.65 })));

  const rimGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 1, curveSegments: 20,
  });
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.scale(1.04, 1, 1.04);
  rimGeo.translate(0, 0.85, 0);
  const white = new THREE.MeshStandardMaterial({ color: '#ebe6ee', roughness: 0.75 });
  root.add(new THREE.Mesh(rimGeo, white));

  const deckGeo = new THREE.ShapeGeometry(shape, 20);
  deckGeo.rotateX(Math.PI / 2);
  deckGeo.scale(0.88, 1, 0.88);
  deckGeo.translate(0, 0.76, 0);
  root.add(new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: '#e0a96d', roughness: 0.8, side: THREE.DoubleSide })));

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.0), white);
  cabin.position.set(0, 1.1, -1.4);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 1.2), new THREE.MeshStandardMaterial({ color: '#ff8ac4', roughness: 0.5 }));
  roof.position.set(0, 1.52, -1.4);
  const windowMat = new THREE.MeshStandardMaterial({ color: '#7fd6ff', emissive: '#3fb0ff', emissiveIntensity: 0.4, roughness: 0.3 });
  for (const x of [-0.71, 0.71]) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), windowMat);
    w.position.set(x, 1.12, -1.4);
    w.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(w);
  }
  root.add(cabin, roof);

  const woodMat = new THREE.MeshStandardMaterial({ color: '#8b5a3c', roughness: 0.7 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.4, 10), woodMat);
  mast.position.set(0, 3.45, 0.6);
  root.add(mast);

  // Sail swings out around the mast so it reads from the chase camera behind the boat.
  const rig = new THREE.Group();
  rig.position.set(0, 0, 0.6);
  rig.rotation.y = 0.55;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), woodMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 1.9, -1.25);
  const sailMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 });
  const sail = new THREE.Mesh(sailGeometry().translate(0, 0, -0.6), sailMat);
  rig.add(boom, sail);
  root.add(rig);
  const jib = new THREE.Mesh(
    triangle([0.05, 5.3, 0.62], [0.05, 1.0, 2.5], [0.18, 1.25, 0.8]),
    new THREE.MeshStandardMaterial({ color: '#fff4fb', side: THREE.DoubleSide, roughness: 0.6 })
  );
  root.add(jib);

  const flag = new THREE.Group();
  flag.position.set(0, 6.1, 0.6);
  flag.add(
    new THREE.Mesh(
      triangle([0, 0, 0], [0, 0.55, 0], [0, 0.27, -0.95]),
      new THREE.MeshStandardMaterial({ color: '#ff4f9a', emissive: '#ff2a7a', emissiveIntensity: 0.3, side: THREE.DoubleSide })
    )
  );
  root.add(flag);
  root.userData.flag = flag;
  return root;
}

export class Boat {
  constructor() {
    this.group = buildModel();
    this.flag = this.group.userData.flag;
    this.pos = new THREE.Vector2(0, 0);
    this.heading = 0;
    this.speed = 0;
    this.turn = 0;
    this.target = null;
    this.y = 0;
    this.pitch = 0;
    this.roll = 0;
    this.forward = new THREE.Vector3(0, 0, 1);
  }

  update(dt, time, keys, islands, heightAt, onArrive) {
    let throttle = 0;
    let steer = 0;
    const up = keys.has('ArrowUp') || keys.has('KeyW');
    const down = keys.has('ArrowDown') || keys.has('KeyS');
    const left = keys.has('ArrowLeft') || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    if (up || down || left || right) {
      if (this.target) {
        this.target = null;
        onArrive();
      }
      throttle = up ? 1 : down ? -0.4 : 0;
      steer = (left ? 1 : 0) - (right ? 1 : 0);
    } else if (this.target) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.y - this.pos.y;
      const dist = Math.hypot(dx, dz);
      const diff = wrapAngle(Math.atan2(dx, dz) - this.heading);
      steer = THREE.MathUtils.clamp(diff * 2.2, -1, 1);
      throttle = Math.min(1, dist / 10) * (1 - Math.min(Math.abs(diff) / Math.PI, 1) * 0.7);
      if (dist < 3.5) {
        this.target = null;
        onArrive();
      }
    }

    this.turn = damp(this.turn, steer, 6, dt);
    this.heading += this.turn * TURN_RATE * dt * (0.5 + 0.5 * Math.min(1, Math.abs(this.speed) / 8));
    this.speed = damp(this.speed, throttle * MAX_SPEED, throttle !== 0 ? 1.2 : 0.8, dt);
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.pos.x += this.forward.x * this.speed * dt;
    this.pos.y += this.forward.z * this.speed * dt;

    for (const isl of islands) {
      const dx = this.pos.x - isl.x;
      const dz = this.pos.y - isl.z;
      const d = Math.hypot(dx, dz);
      const min = isl.shoreR + 2.2;
      if (d < min) {
        this.pos.set(isl.x + (dx / d) * min, isl.z + (dz / d) * min);
        this.speed *= 0.92;
      }
    }

    const f = this.forward;
    const px = this.pos.x;
    const pz = this.pos.y;
    const hF = heightAt(px + f.x * 2, pz + f.z * 2);
    const hB = heightAt(px - f.x * 2, pz - f.z * 2);
    const hL = heightAt(px + f.z * 1.3, pz - f.x * 1.3);
    const hR = heightAt(px - f.z * 1.3, pz + f.x * 1.3);
    this.y = damp(this.y, (hF + hB + hL + hR) / 4, 8, dt);
    this.pitch = damp(this.pitch, -Math.atan2(hF - hB, 4), 5, dt);
    this.roll = damp(this.roll, Math.atan2(hL - hR, 2.6) - this.turn * Math.min(1, Math.abs(this.speed) / 10) * 0.12, 5, dt);
    this.group.position.set(px, this.y, pz);
    this.group.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
    this.flag.rotation.y = Math.sin(time * 7) * 0.35 + 0.1;
  }
}
