import * as THREE from 'three';
import { config } from '../config';
import type { FrameContext, System } from '../engine/Engine';
import type { Input } from '../engine/Input';
import type { Ocean } from '../world/ocean/Ocean';
import type { Islands } from '../world/Islands';

const deg = THREE.MathUtils.degToRad;

/**
 * You: a first-person float that sails with the arrow keys (or WASD),
 * rides the swell, leaves a wake, and has hearts.
 */
export class Player implements System {
  /** Position on the water plane (x, z). */
  readonly position = new THREE.Vector2();
  readonly velocity = new THREE.Vector2();
  yaw = 0;
  pitch = deg(config.camera.pitch);
  /** Extra yaw applied on top of `yaw` (spin attack). */
  spinOffset = 0;
  health = config.player.maxHealth;
  invulnerable = 0;
  controlsEnabled = true;
  onBump?: () => void;

  private yawVelocity = 0;
  private smoothedHeight = 0;
  private shake = 0;
  private sink = 0;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private ocean: Ocean,
    private islands: Islands,
  ) {
    camera.rotation.order = 'YXZ';
  }

  get dead() {
    return this.health <= 0;
  }

  /** Unit vector pointing where you face, flattened to the horizon. */
  flatForward(out = new THREE.Vector3()) {
    const a = this.yaw + this.spinOffset;
    return out.set(-Math.sin(a), 0, -Math.cos(a));
  }

  /** Where incoming projectiles count as hitting you. */
  hitCenter(out = new THREE.Vector3()) {
    return out.copy(this.camera.position).add(new THREE.Vector3(0, -0.7, 0));
  }

  addShake(amount: number) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  /** Returns true if the hit landed. */
  damage(halfHearts: number, from?: THREE.Vector3) {
    if (this.invulnerable > 0 || this.dead) return false;
    this.health = Math.max(0, this.health - halfHearts);
    this.invulnerable = config.player.invulnerableTime;
    this.addShake(0.7);
    if (from) {
      const push = new THREE.Vector2(this.position.x - from.x, this.position.y - from.z).normalize().multiplyScalar(4);
      this.velocity.add(push);
    }
    return true;
  }

  heal(halfHearts: number) {
    this.health = Math.min(config.player.maxHealth, this.health + halfHearts);
  }

  reset() {
    this.health = config.player.maxHealth;
    this.invulnerable = 0;
    this.sink = 0;
    this.controlsEnabled = true;
  }

  update({ dt, time }: FrameContext) {
    const p = config.player;
    const key = (...codes: string[]) => (this.controlsEnabled && codes.some((c) => this.input.isDown(c)) ? 1 : 0);
    const turn = key('ArrowLeft', 'KeyA') - key('ArrowRight', 'KeyD');
    const thrust = key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS') * 0.6;

    this.yawVelocity += (turn * deg(p.turnRate) - this.yawVelocity) * (1 - Math.exp(-dt * 8));
    this.yaw += this.yawVelocity * dt;

    const fwd = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    this.velocity.addScaledVector(fwd, thrust * p.acceleration * dt);
    this.velocity.multiplyScalar(Math.exp(-dt * (thrust === 0 ? 0.9 : 0.35)));
    if (this.velocity.length() > p.maxSpeed) this.velocity.setLength(p.maxSpeed);

    const next = this.position.clone().addScaledVector(this.velocity, dt);
    if (this.islands.groundHeight(next.x, next.y) > -0.8) {
      if (this.velocity.length() > 2) this.onBump?.();
      this.velocity.multiplyScalar(-0.35);
      this.addShake(0.15);
    } else {
      this.position.copy(next);
    }

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.dead) this.sink = Math.min(2.2, this.sink + dt * 0.6);

    const { x, y: z } = this.position;
    const water = this.ocean.heightAt(x, z);
    this.smoothedHeight += (water - this.smoothedHeight) * (1 - Math.exp(-dt * 2.5));
    const view = this.yaw + this.spinOffset;
    const fwdH = this.ocean.heightAt(x - Math.sin(view) * 1.5, z - Math.cos(view) * 1.5);
    const sideH = this.ocean.heightAt(x + Math.cos(view) * 1.5, z - Math.sin(view) * 1.5);
    const f = config.camera.float;
    const s = this.shake * this.shake;
    const jitter = () => (Math.random() - 0.5) * s;

    this.camera.position.set(
      x + jitter() * 0.3,
      config.camera.height + this.smoothedHeight * f - this.sink + jitter() * 0.3,
      z + jitter() * 0.3,
    );
    this.camera.rotation.set(
      this.pitch + (fwdH - water) * 0.05 * f + Math.sin(time * 0.31) * 0.004 + jitter() * 0.06 - this.sink * 0.2,
      view,
      (sideH - water) * -0.06 * f + Math.sin(time * 0.23) * 0.006 - turn * 0.025 + jitter() * 0.05,
    );
  }

  fixedUpdate() {
    const speed = this.velocity.length();
    if (speed < 0.5) return;
    this.ocean.disturb({
      x: this.position.x,
      z: this.position.y,
      radius: 1.1,
      strength: -0.0028 * Math.min(speed, 8),
      foam: Math.min(0.5, speed * 0.05),
    });
  }
}
