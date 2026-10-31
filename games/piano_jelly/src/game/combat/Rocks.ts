import * as THREE from 'three';
import type { Octorok } from './Octorok';

export interface Rock {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  owner: Octorok;
  /** Sent back by a parry: now it hurts enemies instead of you. */
  reflected: boolean;
  age: number;
  radius: number;
}

const GRAVITY = 9.81;

function rockGeometry(seed: number) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 2) * Math.sin(v.z * 3.7 + seed * 3);
    v.multiplyScalar(0.85 + n * 0.25);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Ballistic projectiles spat by Octoroks. */
export class Rocks {
  readonly list: Rock[] = [];
  private geometries = [0, 1, 2, 3].map(rockGeometry);
  private material = new THREE.MeshStandardMaterial({ color: 0x7b746b, roughness: 0.85, flatShading: true });
  private reflectedMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe9a8,
    roughness: 0.4,
    emissive: new THREE.Color(1, 0.75, 0.3),
    emissiveIntensity: 3,
    flatShading: true,
  });

  constructor(private scene: THREE.Scene) {}

  /** Launch so the rock arrives at `target` after `flightTime` seconds. */
  spawn(from: THREE.Vector3, target: THREE.Vector3, flightTime: number, owner: Octorok, radius = 0.32) {
    const velocity = target.clone().sub(from).divideScalar(flightTime);
    velocity.y += 0.5 * GRAVITY * flightTime;
    const mesh = new THREE.Mesh(this.geometries[Math.floor(Math.random() * 4)], this.material);
    mesh.scale.setScalar(radius);
    mesh.position.copy(from);
    this.scene.add(mesh);
    const rock: Rock = {
      mesh,
      position: from.clone(),
      velocity,
      spin: new THREE.Vector3().randomDirection().multiplyScalar(8),
      owner,
      reflected: false,
      age: 0,
      radius,
    };
    this.list.push(rock);
    return rock;
  }

  /** Bat the rock back toward `target`. */
  reflect(rock: Rock, target: THREE.Vector3) {
    rock.reflected = true;
    rock.mesh.material = this.reflectedMaterial;
    const flight = 0.55;
    rock.velocity.copy(target).sub(rock.position).divideScalar(flight);
    rock.velocity.y += 0.5 * GRAVITY * flight;
    rock.spin.multiplyScalar(3);
  }

  remove(rock: Rock) {
    const i = this.list.indexOf(rock);
    if (i >= 0) this.list.splice(i, 1);
    rock.mesh.removeFromParent();
  }

  clear() {
    for (const r of [...this.list]) this.remove(r);
  }

  /** Integrates motion; calls `onWater` for rocks that splash down. */
  update(dt: number, waterHeight: (x: number, z: number) => number, onWater: (r: Rock) => void) {
    for (const r of [...this.list]) {
      r.age += dt;
      r.velocity.y -= GRAVITY * dt;
      r.position.addScaledVector(r.velocity, dt);
      r.mesh.position.copy(r.position);
      r.mesh.rotation.x += r.spin.x * dt;
      r.mesh.rotation.y += r.spin.y * dt;
      r.mesh.rotation.z += r.spin.z * dt;
      if ((r.velocity.y < 0 && r.position.y < waterHeight(r.position.x, r.position.z)) || r.age > 8) {
        onWater(r);
        this.remove(r);
      }
    }
  }
}
