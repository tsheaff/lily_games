import * as THREE from 'three';
import { config } from '../config';
import type { FrameContext, System } from '../engine/Engine';
import type { Input } from '../engine/Input';
import type { Player } from './Player';

type State = 'idle' | 'slash' | 'spin';

const SLASH_TIME = 0.3;
const SPIN_TIME = 0.5;
const ATTACK_KEYS = ['KeyF', 'KeyX', 'Enter'];

function buildSword() {
  const group = new THREE.Group();

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.032, 0);
  bladeShape.lineTo(0.032, 0);
  bladeShape.lineTo(0.03, 0.72);
  bladeShape.lineTo(0, 0.84);
  bladeShape.lineTo(-0.03, 0.72);
  bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.006,
    bevelSegments: 1,
  });
  bladeGeo.translate(0, 0.06, -0.004);
  const bladeMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe8f0,
    metalness: 1,
    roughness: 0.18,
    emissive: new THREE.Color(0.45, 0.75, 1.0),
    emissiveIntensity: 0,
  });
  group.add(new THREE.Mesh(bladeGeo, bladeMat));

  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 1, roughness: 0.3 });
  const royal = new THREE.MeshStandardMaterial({ color: 0x3b47b8, metalness: 0.3, roughness: 0.4 });

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.05), royal);
  guard.position.y = 0.05;
  const wingL = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 8), royal);
  wingL.position.set(-0.15, 0.07, 0);
  wingL.rotation.z = 0.6;
  const wingR = wingL.clone();
  wingR.position.x = 0.15;
  wingR.rotation.z = -0.6;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb000, emissiveIntensity: 0.6 }));
  gem.position.set(0, 0.05, 0.028);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.17, 10), royal);
  grip.position.y = -0.04;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), gold);
  pommel.position.y = -0.135;
  group.add(guard, wingL, wingR, gem, grip, pommel);

  return { group, bladeMat };
}

function pose(x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  return {
    position: new THREE.Vector3(x, y, z),
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ')),
  };
}

const IDLE = pose(0.36, -0.34, -0.62, -0.5, 0.15, 0.3);
const SLASH_START = pose(0.5, -0.12, -0.7, -0.35, 0.2, -1.35);
const SLASH_END = pose(-0.32, -0.36, -0.68, -1.25, -0.2, 1.55);
const SPIN = pose(0.42, -0.3, -0.65, -1.45, 0, -1.45);
const CHARGE = pose(0.3, -0.24, -0.55, -0.15, 0.3, 0.55);

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * First-person sword. Tap the attack key to slash (also parries rocks);
 * hold it to charge a spin attack, then release.
 */
export class Sword implements System {
  readonly group: THREE.Group;
  state: State = 'idle';
  /** Seconds into the current slash/spin. */
  t = 0;
  /** 0..1 spin-attack charge while the key is held. */
  charge = 0;
  onSlash?: () => void;
  onSpin?: () => void;
  onCharged?: () => void;

  private bladeMat: THREE.MeshPhysicalMaterial;
  private holding = false;
  private chargedNotified = false;
  private trail: THREE.Mesh;
  /** Unique id per swing, so each swing hits each target at most once. */
  swingId = 0;

  constructor(
    camera: THREE.Camera,
    private input: Input,
    private player: Player,
  ) {
    const { group, bladeMat } = buildSword();
    this.group = group;
    this.bladeMat = bladeMat;
    this.applyPose(IDLE);
    camera.add(group);

    this.trail = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.5, 48, 1, Math.PI * 0.05, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(3, 3.2, 3.6),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    this.trail.position.set(0, -0.35, -0.9);
    this.trail.rotation.set(-1.25, 0, 0);
    this.trail.renderOrder = 5;
    camera.add(this.trail);
  }

  /** True during the part of a swing that can hit things. */
  get active() {
    if (this.state === 'slash') return this.t > 0.03 && this.t < 0.22;
    if (this.state === 'spin') return this.t < SPIN_TIME;
    return false;
  }

  update({ dt }: FrameContext) {
    const pressed = this.player.controlsEnabled && ATTACK_KEYS.some((k) => this.input.wasPressed(k));
    const down = ATTACK_KEYS.some((k) => this.input.isDown(k));

    if (pressed && this.state === 'idle') {
      this.startSlash();
      this.holding = true;
      this.charge = 0;
      this.chargedNotified = false;
    }
    if (this.holding && !down) {
      this.holding = false;
      if (this.charge >= 1 && this.state === 'idle') this.startSpin();
      this.charge = 0;
    }
    if (this.holding && this.state === 'idle') {
      this.charge = Math.min(1, this.charge + dt / config.sword.spinChargeTime);
      if (this.charge >= 1 && !this.chargedNotified) {
        this.chargedNotified = true;
        this.onCharged?.();
      }
    }

    this.t += dt;
    const trail = this.trail.material as THREE.MeshBasicMaterial;
    if (this.state === 'slash') {
      const k = Math.min(1, this.t / 0.18);
      if (this.t < 0.18) this.lerpPose(SLASH_START, SLASH_END, smooth(k));
      else this.lerpPose(SLASH_END, IDLE, smooth(Math.min(1, (this.t - 0.18) / (SLASH_TIME - 0.18))));
      trail.opacity = Math.max(0, 0.5 * (1 - this.t / 0.22));
      this.trail.rotation.z = -0.5 + k * 0.9;
      if (this.t >= SLASH_TIME) this.state = 'idle';
    } else if (this.state === 'spin') {
      const k = Math.min(1, this.t / SPIN_TIME);
      this.applyPose(SPIN);
      this.player.spinOffset = smooth(k) * Math.PI * 2;
      trail.opacity = 0.6 * Math.sin(k * Math.PI);
      this.trail.rotation.z = 0;
      if (this.t >= SPIN_TIME) {
        this.state = 'idle';
        this.player.spinOffset = 0;
      }
    } else {
      trail.opacity = 0;
      const charging = this.holding ? smooth(this.charge) : 0;
      const target = this.holding ? CHARGE : IDLE;
      this.group.position.lerp(target.position, 1 - Math.exp(-dt * 14));
      this.group.quaternion.slerp(target.quaternion, 1 - Math.exp(-dt * 14));
      if (charging >= 1) this.group.position.x += (Math.random() - 0.5) * 0.006;
    }

    const glow = this.state === 'spin' ? 5 : this.holding ? this.charge * this.charge * 4 : 0;
    this.bladeMat.emissiveIntensity += (glow - this.bladeMat.emissiveIntensity) * (1 - Math.exp(-dt * 12));
    this.trail.visible = trail.opacity > 0.01;
  }

  private startSlash() {
    this.state = 'slash';
    this.t = 0;
    this.swingId++;
    this.onSlash?.();
  }

  private startSpin() {
    this.state = 'spin';
    this.t = 0;
    this.swingId++;
    this.onSpin?.();
  }

  private applyPose(p: { position: THREE.Vector3; quaternion: THREE.Quaternion }) {
    this.group.position.copy(p.position);
    this.group.quaternion.copy(p.quaternion);
  }

  private lerpPose(a: typeof IDLE, b: typeof IDLE, k: number) {
    this.group.position.lerpVectors(a.position, b.position, k);
    this.group.quaternion.slerpQuaternions(a.quaternion, b.quaternion, k);
  }
}
