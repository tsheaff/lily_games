import * as THREE from 'three';

export type PickupKind = 'rupee' | 'heart';

export interface Pickup {
  kind: PickupKind;
  value: number;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  landed: boolean;
}

const RUPEE_COLORS: Record<number, number> = { 1: 0x2fe36a, 5: 0x3a8bff, 20: 0xff3b4f };
const LIFETIME = 30;

function rupeeGeometry() {
  const pts = [
    new THREE.Vector2(0, -0.5),
    new THREE.Vector2(0.24, -0.24),
    new THREE.Vector2(0.24, 0.24),
    new THREE.Vector2(0, 0.5),
  ];
  const geo = new THREE.LatheGeometry(pts, 6);
  geo.scale(1, 1, 0.5);
  geo.computeVertexNormals();
  return geo;
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.35);
  s.bezierCurveTo(-0.1, -0.22, -0.42, -0.05, -0.42, 0.14);
  s.bezierCurveTo(-0.42, 0.32, -0.28, 0.42, -0.16, 0.42);
  s.bezierCurveTo(-0.06, 0.42, 0, 0.34, 0, 0.26);
  s.bezierCurveTo(0, 0.34, 0.06, 0.42, 0.16, 0.42);
  s.bezierCurveTo(0.28, 0.42, 0.42, 0.32, 0.42, 0.14);
  s.bezierCurveTo(0.42, -0.05, 0.1, -0.22, 0, -0.35);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 });
  geo.center();
  return geo;
}

/** Rupees and hearts that float on the water and fly to you when close. */
export class Pickups {
  readonly list: Pickup[] = [];
  private rupeeGeo = rupeeGeometry();
  private heartGeo = heartGeometry();
  private materials = new Map<number, THREE.Material>();

  constructor(private scene: THREE.Scene) {}

  private material(kind: PickupKind, value: number) {
    const key = kind === 'heart' ? -1 : value;
    let m = this.materials.get(key);
    if (!m) {
      const color = new THREE.Color(kind === 'heart' ? 0xff3355 : RUPEE_COLORS[value]);
      m = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.9,
        roughness: 0.08,
        metalness: 0.1,
        clearcoat: 1,
        flatShading: kind === 'rupee',
      });
      this.materials.set(key, m);
    }
    return m;
  }

  /** Pop a pickup out of `at` with a little hop. */
  drop(at: THREE.Vector3, kind: PickupKind, value = 1) {
    const mesh = new THREE.Mesh(kind === 'heart' ? this.heartGeo : this.rupeeGeo, this.material(kind, value));
    mesh.scale.setScalar(kind === 'heart' ? 0.9 : value >= 20 ? 1.25 : value >= 5 ? 1.1 : 1);
    mesh.position.copy(at);
    this.scene.add(mesh);
    const a = Math.random() * Math.PI * 2;
    const out = 1.5 + Math.random() * 3;
    this.list.push({
      kind,
      value,
      mesh,
      position: at.clone(),
      velocity: new THREE.Vector3(Math.cos(a) * out, 5 + Math.random() * 3, Math.sin(a) * out),
      age: 0,
      landed: false,
    });
  }

  remove(p: Pickup) {
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
    p.mesh.removeFromParent();
  }

  clear() {
    for (const p of [...this.list]) this.remove(p);
  }

  /** Moves pickups; returns the ones collected this frame. */
  update(dt: number, time: number, player: THREE.Vector3, waterHeight: (x: number, z: number) => number) {
    const collected: Pickup[] = [];
    for (const p of [...this.list]) {
      p.age += dt;
      const floatY = waterHeight(p.position.x, p.position.z) + 0.55 + Math.sin(time * 2.5 + p.age) * 0.1;
      const toPlayer = new THREE.Vector3(player.x - p.position.x, 0, player.z - p.position.z);
      const flat = toPlayer.length();

      if (flat < 8 && p.age > 0.6) {
        const pull = player.clone().add(new THREE.Vector3(0, -1, 0)).sub(p.position);
        p.velocity.lerp(pull.normalize().multiplyScalar(14), 1 - Math.exp(-dt * 6));
        p.position.addScaledVector(p.velocity, dt);
      } else if (!p.landed) {
        p.velocity.y -= 9.81 * dt;
        p.position.addScaledVector(p.velocity, dt);
        if (p.velocity.y < 0 && p.position.y <= floatY) p.landed = true;
      } else {
        p.position.y += (floatY - p.position.y) * (1 - Math.exp(-dt * 6));
      }

      p.mesh.position.copy(p.position);
      p.mesh.rotation.y = time * 2.2 + p.age;
      const remaining = LIFETIME - p.age;
      p.mesh.visible = remaining > 4 || Math.sin(p.age * 25) > 0;

      if (p.position.distanceTo(player) < 1.8 && p.age > 0.4) {
        collected.push(p);
        this.remove(p);
      } else if (remaining <= 0) {
        this.remove(p);
      }
    }
    return collected;
  }
}
