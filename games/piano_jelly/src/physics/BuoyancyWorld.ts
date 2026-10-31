import * as THREE from 'three';
import type { FrameContext, System } from '../engine/Engine';
import type { Ocean } from '../world/ocean/Ocean';

const GRAVITY = 9.81;
const WATER_DENSITY = 1000;

export class SphereBody {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly angularVelocity = new THREE.Vector3();
  readonly quaternion = new THREE.Quaternion();
  readonly mass: number;
  readonly volume: number;
  /** 0..1 portion of the sphere currently under water. */
  submerged = 0;
  /** Set on the step the body first plunges into the water. */
  onEnterWater?: (body: SphereBody, speed: number) => void;
  userData: Record<string, unknown> = {};
  private wasAirborne = true;
  private lastSubmerged = 0;

  constructor(
    readonly radius: number,
    density: number,
  ) {
    this.volume = (4 / 3) * Math.PI * radius ** 3;
    this.mass = this.volume * density;
  }

  /** @internal */ step(h: number, waterY: number, waterVy: number, current: THREE.Vector2) {
    const r = this.radius;
    const depth = THREE.MathUtils.clamp(waterY - (this.position.y - r), 0, 2 * r);
    const capVolume = (Math.PI * depth * depth * (3 * r - depth)) / 3;
    const frac = capVolume / this.volume;

    if (this.wasAirborne && frac > 0.02) {
      this.wasAirborne = false;
      this.onEnterWater?.(this, this.velocity.length());
    }
    if (frac === 0 && this.position.y - r > waterY + 0.3) this.wasAirborne = true;

    // Added mass: a submerged sphere must also accelerate half its volume of water,
    // which is what keeps light objects from rocketing out after a plunge.
    const effectiveMass = this.mass + 0.5 * WATER_DENSITY * capVolume;
    const buoyancy = WATER_DENSITY * GRAVITY * capVolume;
    this.velocity.y += ((buoyancy - this.mass * GRAVITY) / effectiveMass) * h;

    if (frac > 0) {
      const relY = this.velocity.y - waterVy;
      const relX = this.velocity.x - current.x;
      const relZ = this.velocity.z - current.y;
      const vertical = Math.exp(-(4.5 + Math.abs(relY) * 1.2) * frac * h);
      const horizontal = Math.exp(-(1.2 + Math.hypot(relX, relZ) * 0.8) * frac * h);
      this.velocity.y = waterVy + relY * vertical;
      this.velocity.x = current.x + relX * horizontal;
      this.velocity.z = current.y + relZ * horizontal;

      // Water drags the spin toward rolling with the motion.
      const rollX = this.velocity.z / r;
      const rollZ = -this.velocity.x / r;
      const k = 1 - Math.exp(-3 * frac * h);
      this.angularVelocity.x += (rollX - this.angularVelocity.x) * k;
      this.angularVelocity.z += (rollZ - this.angularVelocity.z) * k;
      this.angularVelocity.y *= Math.exp(-1.5 * frac * h);
    } else {
      this.velocity.multiplyScalar(Math.exp(-0.02 * h));
    }

    this.position.addScaledVector(this.velocity, h);

    const w = this.angularVelocity;
    const angle = w.length() * h;
    if (angle > 1e-6) {
      const dq = new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), angle);
      this.quaternion.premultiply(dq);
    }

    this.submerged = frac;
  }

  /** Change in submerged fraction since the last call — drives ripples. */
  consumeDisplacement() {
    const d = this.submerged - this.lastSubmerged;
    this.lastSubmerged = this.submerged;
    return d;
  }
}

/**
 * Floating rigid spheres on the ocean. Add bodies, step via the engine's
 * fixed update; each body's movement through the surface feeds ripples back.
 */
export class BuoyancyWorld implements System {
  readonly bodies: SphereBody[] = [];
  substeps = 4;
  /** Gentle surface drift (m/s) in x/z. */
  readonly current = new THREE.Vector2(0.12, 0.05);

  constructor(private ocean: Ocean) {}

  add(body: SphereBody) {
    this.bodies.push(body);
    return body;
  }

  remove(body: SphereBody) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  fixedUpdate({ dt, time }: FrameContext) {
    const h = dt / this.substeps;
    const t0 = time - dt;
    for (let s = 0; s < this.substeps; s++) {
      const t = t0 + (s + 1) * h;
      for (const b of this.bodies) {
        const y = this.ocean.heightAtTime(b.position.x, b.position.z, t);
        const yPrev = this.ocean.heightAtTime(b.position.x, b.position.z, t - h);
        b.step(h, y, (y - yPrev) / h, this.current);
      }
      this.resolveCollisions();
    }

    for (const b of this.bodies) {
      const d = b.consumeDisplacement();
      if (Math.abs(d) < 1e-4 || b.submerged === 0) continue;
      this.ocean.disturb({
        x: b.position.x,
        z: b.position.z,
        radius: b.radius * 2.2,
        strength: THREE.MathUtils.clamp(-d * b.radius * 0.25, -0.02, 0.02),
      });
    }
  }

  private resolveCollisions() {
    const n = this.bodies.length;
    const delta = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = this.bodies[i];
      for (let j = i + 1; j < n; j++) {
        const b = this.bodies[j];
        delta.subVectors(b.position, a.position);
        const minDist = a.radius + b.radius;
        const d2 = delta.lengthSq();
        if (d2 >= minDist * minDist || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        delta.divideScalar(d);
        const overlap = minDist - d;
        const total = a.mass + b.mass;
        a.position.addScaledVector(delta, -overlap * (b.mass / total));
        b.position.addScaledVector(delta, overlap * (a.mass / total));
        const rel = b.velocity.clone().sub(a.velocity).dot(delta);
        if (rel < 0) {
          const impulse = (-(1 + 0.5) * rel) / (1 / a.mass + 1 / b.mass);
          a.velocity.addScaledVector(delta, -impulse / a.mass);
          b.velocity.addScaledVector(delta, impulse / b.mass);
        }
      }
    }
  }
}
