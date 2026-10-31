import * as THREE from 'three';
import { config } from '../config';
import type { FrameContext, System } from '../engine/Engine';
import type { Input } from '../engine/Input';
import type { Ocean } from '../world/ocean/Ocean';
import { BuoyancyWorld, SphereBody } from '../physics/BuoyancyWorld';
import type { Particles } from '../fx/Particles';
import type { Ambience } from '../audio/Ambience';
import type { Player } from './Player';
import { beachBallMaterial } from './beachBall';

export interface Ball {
  body: SphereBody;
  mesh: THREE.Mesh;
  /** Seconds remaining while fading out; undefined while alive. */
  dying?: number;
}

const ease = (t: number) => t * (0.6 + 0.4 * t);

/**
 * Hold space to charge, release to lob a beach ball that lands at the
 * charged distance.
 */
export class BallToss implements System {
  readonly balls: Ball[] = [];
  /** Optionally bends the throw direction toward a target (soft lock-on). */
  aimAssist?: (origin: THREE.Vector3, forward: THREE.Vector3) => THREE.Vector3 | null;
  private charging = false;
  private charge = 0;
  private thrown = 0;
  private geometry = new THREE.SphereGeometry(config.ball.radius, 48, 32);
  private target: THREE.Mesh;
  private ui = {
    power: document.getElementById('power')!,
    fill: document.getElementById('power-fill')!,
    label: document.getElementById('power-label')!,
    title: document.getElementById('title')!,
  };

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private rig: Player,
    private input: Input,
    private ocean: Ocean,
    private physics: BuoyancyWorld,
    private particles: Particles,
    private audio: Ambience,
  ) {
    this.target = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.2, 2.0, 1.7),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    );
    this.target.renderOrder = 2;
    scene.add(this.target);
  }

  update({ dt, time }: FrameContext) {
    if (this.input.wasPressed('KeyM')) this.audio.toggleMute();

    if (this.input.wasPressed('Space') && this.rig.controlsEnabled) {
      this.charging = true;
      this.charge = 0;
    }
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / config.throw.chargeTime);
      if (this.input.wasReleased('Space') || !this.input.isDown('Space')) {
        this.throwBall(this.distanceFor(this.charge));
        this.charging = false;
      }
    }

    this.updateAim(dt, time);
    this.syncBalls(dt);
  }

  private distanceFor(charge: number) {
    const { minDistance, maxDistance } = config.throw;
    return THREE.MathUtils.lerp(minDistance, maxDistance, ease(charge));
  }

  private aimDirection() {
    const fwd = this.rig.flatForward();
    return this.aimAssist?.(this.camera.position, fwd) ?? fwd;
  }

  private launchOrigin(out = new THREE.Vector3()) {
    const fwd = this.rig.flatForward();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    return out.copy(this.camera.position).addScaledVector(fwd, 0.8).addScaledVector(right, 0.35).add(new THREE.Vector3(0, -0.45, 0));
  }

  private landingPoint(distance: number, out = new THREE.Vector3()) {
    const origin = this.launchOrigin();
    out.copy(origin).addScaledVector(this.aimDirection(), distance);
    out.y = this.ocean.heightAt(out.x, out.z);
    return out;
  }

  private updateAim(dt: number, time: number) {
    const mat = this.target.material as THREE.MeshBasicMaterial;
    const goal = this.charging ? 0.75 : 0;
    mat.opacity += (goal - mat.opacity) * (1 - Math.exp(-dt * (this.charging ? 12 : 5)));
    this.target.visible = mat.opacity > 0.01;

    if (this.charging) {
      const d = this.distanceFor(this.charge);
      this.landingPoint(d, this.target.position);
      this.target.position.y += 0.06;
      // A flat ring vanishes at grazing angles, so lean it toward the viewer.
      const toCam = this.camera.position.clone().sub(this.target.position).normalize();
      const normal = new THREE.Vector3(0, 1, 0).lerp(toCam, 0.5).normalize();
      this.target.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const s = (1 + d / 22) * (1 + Math.sin(time * 6) * 0.05);
      this.target.scale.setScalar(s);
      this.ui.fill.style.width = `${(this.charge * 100).toFixed(1)}%`;
      this.ui.label.textContent = `${Math.round(d)} m`;
    }
    this.ui.power.classList.toggle('active', this.charging);
  }

  private throwBall(distance: number) {
    const { radius, density } = config.ball;
    const origin = this.launchOrigin();
    const fwd = this.aimDirection();
    const theta = THREE.MathUtils.degToRad(config.throw.launchAngle);
    const drop = origin.y - this.ocean.heightAt(origin.x + fwd.x * distance, origin.z + fwd.z * distance) - radius;
    const g = 9.81;
    const speed = Math.sqrt((g * distance * distance) / (2 * Math.cos(theta) ** 2 * (drop + distance * Math.tan(theta))));

    const body = new SphereBody(radius, density);
    body.position.copy(origin);
    body.velocity.copy(fwd).multiplyScalar(speed * Math.cos(theta));
    body.velocity.y = speed * Math.sin(theta);
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    body.angularVelocity.copy(right).multiplyScalar(-(4 + Math.random() * 6)).add(new THREE.Vector3(0, (Math.random() - 0.5) * 6, 0));
    body.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    body.onEnterWater = (b, impactSpeed) => this.onSplash(b, impactSpeed);
    this.physics.add(body);

    const mesh = new THREE.Mesh(this.geometry, beachBallMaterial(this.thrown++));
    mesh.position.copy(body.position);
    this.scene.add(mesh);
    this.balls.push({ body, mesh });

    const alive = this.balls.filter((b) => b.dying === undefined);
    if (alive.length > config.throw.maxBalls) alive[0].dying = 1.5;

    this.audio.whoosh(this.charge);
    this.ui.title.classList.add('hidden');
  }

  private onSplash(body: SphereBody, speed: number) {
    if (speed < 1.5) return;
    const at = body.position.clone();
    at.y = this.ocean.heightAt(at.x, at.z);
    const e = THREE.MathUtils.clamp(speed / 14, 0.2, 1.5);
    this.particles.splash(at, speed, body.radius);
    this.ocean.disturb({ x: at.x, z: at.z, radius: body.radius * 2.6, strength: -0.035 * e, foam: 1 });
    this.ocean.disturb({ x: at.x, z: at.z, radius: body.radius * 1.1, strength: -0.03 * e, foam: 1 });
    this.audio.splash(at, this.camera, speed);
  }

  private syncBalls(dt: number) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.mesh.position.copy(b.body.position);
      b.mesh.quaternion.copy(b.body.quaternion);
      if (b.dying !== undefined) {
        b.dying -= dt;
        b.mesh.scale.setScalar(Math.max(0.001, b.dying / 1.5));
        if (b.dying <= 0) {
          this.scene.remove(b.mesh);
          this.physics.remove(b.body);
          this.balls.splice(i, 1);
        }
      }
      if (b.body.position.distanceTo(this.camera.position) > 400) b.dying ??= 1.5;
    }
  }
}
