import * as THREE from 'three';
import { config } from '../../config';

export type OctorokState = 'rising' | 'idle' | 'windup' | 'hurt' | 'diving' | 'hidden' | 'dying' | 'dead';

export interface OctorokWorld {
  playerPosition: THREE.Vector3;
  playerVelocity: THREE.Vector2;
  waterHeight(x: number, z: number): number;
  isWater(x: number, z: number): boolean;
  spit(from: THREE.Vector3, target: THREE.Vector3, owner: Octorok): void;
  surfaced(o: Octorok): void;
  windup(o: Octorok): void;
}

const markerTexture = (() => {
  let tex: THREE.CanvasTexture | undefined;
  return () => {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(10, 14);
    g.lineTo(54, 14);
    g.lineTo(32, 52);
    g.closePath();
    g.stroke();
    g.fill();
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
})();

function buildMesh(boss: boolean) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = new THREE.MeshPhysicalMaterial({
    color: boss ? 0x7a3fd1 : 0xe0482d,
    roughness: 0.42,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: 0,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a0f0c, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.3 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 28), skin);
  head.scale.set(0.9, 0.82, 0.9);
  body.add(head);

  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.13 + (i % 3) * 0.04, 12, 10),
      new THREE.MeshStandardMaterial({ color: boss ? 0xb98af0 : 0xffb08a, roughness: 0.5 }),
    );
    spot.position.set(Math.cos(a) * 0.55, 0.48 + (i % 2) * 0.12, Math.sin(a) * 0.55 - 0.1);
    spot.scale.y = 0.4;
    spot.lookAt(spot.position.clone().multiplyScalar(2));
    body.add(spot);
  }

  const snout = new THREE.Group();
  snout.position.set(0, -0.08, 0.78);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.55, 24), skin);
  tube.rotation.x = Math.PI / 2;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 24), skin);
  lip.position.z = 0.28;
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24), dark);
  mouth.position.z = 0.285;
  snout.add(tube, lip, mouth);
  body.add(snout);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), white);
    eye.position.set(side * 0.33, 0.3, 0.66);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), dark);
    pupil.position.set(side * 0.35, 0.29, 0.83);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.08), dark);
    brow.position.set(side * 0.3, 0.52, 0.74);
    brow.rotation.z = side * -0.45;
    body.add(eye, pupil, brow);
  }

  if (boss) {
    const gold = new THREE.MeshStandardMaterial({ color: 0xffcf4a, metalness: 1, roughness: 0.25, emissive: 0x553300 });
    const crown = new THREE.Group();
    crown.position.y = 0.78;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.16, 20, 1, true), gold);
    crown.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), gold);
      spike.position.set(Math.cos(a) * 0.42, 0.2, Math.sin(a) * 0.42);
      crown.add(spike);
    }
    body.add(crown);
  }

  const marker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: markerTexture(),
      color: new THREE.Color(1.0, 0.35, 0.3),
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
      transparent: true,
      fog: false,
    }),
  );
  marker.scale.setScalar(0.028);
  marker.renderOrder = 10;
  root.add(marker);

  return { root, body, snout, skin, marker };
}

/** Pops out of the sea, glares at you, and spits rocks. */
export class Octorok {
  readonly root: THREE.Group;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector2();
  readonly radius: number;
  readonly boss: boolean;
  readonly maxHealth: number;
  health: number;
  state: OctorokState = 'hidden';
  /** The most recent sword swing that hit this enemy. */
  lastSwingHit = -1;

  private body: THREE.Group;
  private snout: THREE.Group;
  private skin: THREE.MeshPhysicalMaterial;
  private marker: THREE.Sprite;
  private timer = 0;
  private fireCooldown: number;
  private diveCooldown: number;
  private yaw = 0;
  private flash = 0;
  private strafe = Math.random() < 0.5 ? -1 : 1;
  private preferred: number;
  private scale: number;
  private depth = -2.5;
  private bob = Math.random() * 10;

  constructor(
    boss: boolean,
    private aggression: number,
  ) {
    this.boss = boss;
    this.scale = boss ? 2.6 : 1;
    this.radius = 0.95 * this.scale;
    this.maxHealth = boss ? config.enemies.bossHealth : config.enemies.octorokHealth;
    this.health = this.maxHealth;
    const mesh = buildMesh(boss);
    this.root = mesh.root;
    this.body = mesh.body;
    this.snout = mesh.snout;
    this.skin = mesh.skin;
    this.marker = mesh.marker;
    this.body.scale.setScalar(this.scale);
    this.preferred = boss ? 22 : 9 + Math.random() * 18;
    this.fireCooldown = 2 + Math.random() * 2;
    this.diveCooldown = 9 + Math.random() * 8;
    this.root.visible = false;
  }

  get alive() {
    return this.state !== 'dying' && this.state !== 'dead';
  }

  /** Can be hit (not submerged). */
  get vulnerable() {
    return this.state === 'idle' || this.state === 'windup' || this.state === 'hurt' || this.state === 'rising';
  }

  get windingUp() {
    return this.state === 'windup';
  }

  /** Emerge from the water at (x, z). */
  emerge(x: number, z: number) {
    this.position.set(x, 0, z);
    this.state = 'rising';
    this.timer = 0;
    this.depth = -2.5 * this.scale;
    this.root.visible = true;
  }

  /** Returns true if this hit was lethal. */
  hurt(amount: number, from: THREE.Vector3, knockback = 7) {
    if (!this.alive || !this.vulnerable) return false;
    this.health -= amount;
    this.flash = 1;
    const away = new THREE.Vector2(this.position.x - from.x, this.position.z - from.z).normalize();
    this.velocity.addScaledVector(away, knockback / (this.boss ? 4 : 1));
    if (this.health <= 0) {
      this.state = 'dying';
      this.timer = 0;
      return true;
    }
    if (!this.boss || this.state !== 'windup') {
      this.state = 'hurt';
      this.timer = 0;
    }
    return false;
  }

  /** World position of the snout tip. */
  muzzle(out = new THREE.Vector3()) {
    return out.set(0, -0.08, 1.15).multiplyScalar(this.scale).applyMatrix4(this.root.matrixWorld);
  }

  update(dt: number, time: number, world: OctorokWorld) {
    if (this.state === 'dead') return;
    this.timer += dt;
    const p = world.playerPosition;
    const toPlayer = new THREE.Vector2(p.x - this.position.x, p.z - this.position.z);
    const dist = toPlayer.length();
    toPlayer.divideScalar(Math.max(dist, 1e-3));

    // Face the player.
    const targetYaw = Math.atan2(toPlayer.x, toPlayer.y);
    let dy = targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (1 - Math.exp(-dt * (this.state === 'windup' ? 10 : 4)));

    let targetDepth = 0.1 * this.scale;
    let squash = 1;
    let snoutPuff = 1;

    switch (this.state) {
      case 'rising':
        if (this.timer > 0.9) {
          this.state = 'idle';
          this.timer = 0;
        }
        if (this.timer < dt * 1.5) world.surfaced(this);
        break;
      case 'idle': {
        const range = dist - this.preferred;
        const approach = THREE.MathUtils.clamp(range * 0.4, -2.5, 2.5);
        const side = new THREE.Vector2(-toPlayer.y, toPlayer.x).multiplyScalar(this.strafe * (this.boss ? 0.8 : 1.4));
        const desired = toPlayer.clone().multiplyScalar(approach).add(side);
        this.velocity.lerp(desired, 1 - Math.exp(-dt * 1.5));
        if (Math.random() < dt * 0.15) this.strafe *= -1;

        this.fireCooldown -= dt;
        this.diveCooldown -= dt;
        if (this.fireCooldown <= 0 && dist < 55) {
          this.state = 'windup';
          this.timer = 0;
          world.windup(this);
        } else if (this.diveCooldown <= 0 && !this.boss) {
          this.state = 'diving';
          this.timer = 0;
        }
        break;
      }
      case 'windup': {
        const wind = this.boss ? 0.9 : 0.65;
        const k = Math.min(1, this.timer / wind);
        squash = 1 - 0.18 * k;
        snoutPuff = 1 + 0.6 * k;
        this.velocity.multiplyScalar(Math.exp(-dt * 4));
        if (this.timer >= wind) {
          this.fire(world, dist);
          this.state = 'idle';
          this.timer = 0;
          const base = Math.max(1.6, 4.2 - this.aggression * 0.35);
          this.fireCooldown = base * (0.7 + Math.random() * 0.6) * (this.boss ? 0.8 : 1);
        }
        break;
      }
      case 'hurt':
        squash = 1 + Math.sin(this.timer * 40) * 0.12 * (1 - this.timer / 0.4);
        if (this.timer > 0.4) {
          this.state = 'idle';
          this.timer = 0;
          this.fireCooldown = Math.max(this.fireCooldown, 0.8);
        }
        break;
      case 'diving':
        targetDepth = -2.6 * this.scale;
        this.velocity.multiplyScalar(Math.exp(-dt * 3));
        if (this.timer > 0.9) {
          this.state = 'hidden';
          this.timer = 0;
        }
        break;
      case 'hidden':
        targetDepth = -2.6 * this.scale;
        if (this.timer > 1.2 + Math.random() * 0.5) {
          const spot = this.findSpot(world);
          this.diveCooldown = 8 + Math.random() * 8;
          this.fireCooldown = 0.6 + Math.random();
          this.emerge(spot.x, spot.y);
        }
        break;
      case 'dying': {
        const k = Math.min(1, this.timer / 0.45);
        squash = 1 + k * 0.5;
        this.body.rotation.y += dt * 25;
        this.flash = 0.6 + 0.4 * Math.sin(this.timer * 60);
        if (k >= 1) {
          this.state = 'dead';
          this.root.visible = false;
        }
        break;
      }
    }

    // Move, but never onto land.
    const nx = this.position.x + this.velocity.x * dt;
    const nz = this.position.z + this.velocity.y * dt;
    if (world.isWater(nx, nz)) {
      this.position.x = nx;
      this.position.z = nz;
    } else {
      this.velocity.multiplyScalar(-0.5);
      this.strafe *= -1;
    }
    this.velocity.multiplyScalar(Math.exp(-dt * 0.8));

    const rise = this.state === 'rising' ? 3.2 : 4;
    this.depth += (targetDepth - this.depth) * (1 - Math.exp(-dt * rise));
    const water = world.waterHeight(this.position.x, this.position.z);
    this.position.y = water + this.depth + Math.sin(time * 2 + this.bob) * 0.06 * this.scale;

    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    this.body.scale.set(this.scale / Math.sqrt(squash), this.scale * squash, this.scale / Math.sqrt(squash));
    this.snout.scale.setScalar(snoutPuff);

    this.flash = Math.max(0, this.flash - dt * 6);
    this.skin.emissiveIntensity = this.flash * 2.5 + (this.state === 'windup' ? 0.25 + 0.25 * Math.sin(this.timer * 40) : 0);
    this.skin.emissive.setRGB(1, this.state === 'windup' && this.flash === 0 ? 0.55 : 1, this.state === 'windup' && this.flash === 0 ? 0.3 : 1);

    this.marker.visible = this.vulnerable;
    this.marker.position.set(0, this.radius * 1.55 + Math.sin(time * 4 + this.bob) * 0.12, 0);
  }

  setTargeted(on: boolean) {
    (this.marker.material as THREE.SpriteMaterial).color.setRGB(on ? 1.0 : 1.0, on ? 0.9 : 0.35, on ? 0.25 : 0.3);
    this.marker.scale.setScalar(on ? 0.036 : 0.028);
  }

  dispose() {
    this.root.removeFromParent();
  }

  private fire(world: OctorokWorld, dist: number) {
    const from = this.muzzle();
    const flight = 0.9 + dist / config.enemies.rockSpeed;
    const lead = world.playerPosition.clone();
    lead.x += world.playerVelocity.x * flight * 0.8;
    lead.z += world.playerVelocity.y * flight * 0.8;
    lead.y -= 0.7;
    world.spit(from, lead, this);
    if (this.boss) {
      const right = new THREE.Vector3(lead.z - from.z, 0, from.x - lead.x).normalize();
      world.spit(from, lead.clone().addScaledVector(right, 5), this);
      world.spit(from, lead.clone().addScaledVector(right, -5), this);
    }
  }

  private findSpot(world: OctorokWorld) {
    const p = world.playerPosition;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = this.preferred * (0.8 + Math.random() * 0.5);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (world.isWater(x, z)) return new THREE.Vector2(x, z);
    }
    return new THREE.Vector2(this.position.x, this.position.z);
  }
}
