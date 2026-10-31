import * as THREE from 'three';
import { config } from '../../config';
import type { Engine, FrameContext, System } from '../../engine/Engine';
import type { Ocean } from '../../world/ocean/Ocean';
import type { Islands } from '../../world/Islands';
import type { Particles } from '../../fx/Particles';
import type { Ambience } from '../../audio/Ambience';
import type { Sfx } from '../../audio/Sfx';
import type { Player } from '../Player';
import type { Sword } from '../Sword';
import type { BallToss } from '../BallToss';
import type { Hud } from '../Hud';
import { Octorok, type OctorokWorld } from './Octorok';
import { Rocks, type Rock } from './Rocks';
import { Pickups } from './Pickups';

export interface ArenaDeps {
  engine: Engine;
  ocean: Ocean;
  islands: Islands;
  particles: Particles;
  ambience: Ambience;
  sfx: Sfx;
  player: Player;
  sword: Sword;
  toss: BallToss;
  hud: Hud;
}

type Phase = 'intro' | 'fighting' | 'break' | 'gameover';

const SPARK = new THREE.Color(5, 4.2, 2.2);
const GOLD = new THREE.Color(6, 4, 1.2);
const SMOKE = new THREE.Color(1.1, 0.9, 1.25);
const deg = THREE.MathUtils.degToRad;

/** Runs the waves and resolves every hit between you, your weapons and the Octoroks. */
export class Arena implements System {
  readonly enemies: Octorok[] = [];
  readonly rocks: Rocks;
  readonly pickups: Pickups;
  wave = 0;
  rupees = 0;
  kills = 0;

  private phase: Phase = 'intro';
  private timer = 0;
  private spawnQueue: { boss: boolean; at: number }[] = [];
  private targeted: Octorok | null = null;
  private world: OctorokWorld;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;

  constructor(private d: ArenaDeps) {
    this.camera = d.engine.camera;
    this.scene = d.engine.scene;
    this.rocks = new Rocks(this.scene);
    this.pickups = new Pickups(this.scene);

    this.world = {
      playerPosition: this.camera.position,
      playerVelocity: d.player.velocity,
      waterHeight: (x, z) => d.ocean.heightAt(x, z),
      isWater: (x, z) => d.islands.groundHeight(x, z) < -2,
      spit: (from, target, owner) => this.spit(from, target, owner),
      surfaced: (o) => this.surfaced(o),
      windup: (o) => {
        if (o.position.distanceTo(this.camera.position) < 40) d.sfx.windup();
      },
    };

    d.toss.aimAssist = (origin, forward) => {
      const t = this.findTarget(origin, forward);
      return t ? new THREE.Vector3(t.position.x - origin.x, 0, t.position.z - origin.z).normalize() : null;
    };
    d.sword.onSlash = () => d.sfx.slash();
    d.sword.onCharged = () => d.sfx.charged();
    d.sword.onSpin = () => this.spinShockwave();
    d.player.onBump = () => d.sfx.bump();

    d.hud.setHealth(d.player.health, config.player.maxHealth);
    d.hud.setRupees(0);
  }

  update({ dt, time }: FrameContext) {
    const { player, hud } = this.d;
    if (dt > 0) {
      this.timer += dt;
      this.runPhase();

      for (const e of this.enemies) e.update(dt, time, this.world);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (this.enemies[i].state === 'dead') {
          this.enemies[i].dispose();
          this.enemies.splice(i, 1);
        }
      }

      this.rocks.update(dt, this.world.waterHeight, (r) => this.rockSplash(r));
      this.resolveParries();
      this.resolveRockHits();
      this.resolveBallHits();
      this.resolveSwordHits();
      this.collectPickups(dt, time);
    }

    this.targeted = this.findTarget(this.camera.position, player.flatForward());
    for (const e of this.enemies) e.setTargeted(e === this.targeted);

    hud.setHealth(player.health, config.player.maxHealth);
    const boss = this.enemies.find((e) => e.boss && e.alive);
    hud.setBoss(boss ? boss.health : null, boss?.maxHealth);
    hud.updateIndicators(
      this.enemies
        .filter((e) => e.vulnerable)
        .map((e) => ({ position: e.position.clone().setY(e.position.y + e.radius), urgent: e.windingUp })),
      this.camera,
    );
  }

  // ---------------------------------------------------------------- waves

  private runPhase() {
    const { player, hud, sfx } = this.d;

    if (player.dead && this.phase !== 'gameover') {
      this.phase = 'gameover';
      this.timer = 0;
      player.controlsEnabled = false;
      sfx.gameOver();
      hud.showGameOver(`wave ${this.wave} · ${this.kills} octoroks · ${this.rupees} rupees`);
      return;
    }

    switch (this.phase) {
      case 'intro':
        if (this.timer > 5) {
          document.getElementById('title')?.classList.add('hidden');
          this.startWave(1);
        }
        break;
      case 'fighting':
        for (const s of [...this.spawnQueue]) {
          if (this.timer >= s.at) {
            this.spawnEnemy(s.boss);
            this.spawnQueue.splice(this.spawnQueue.indexOf(s), 1);
          }
        }
        if (this.spawnQueue.length === 0 && this.enemies.every((e) => !e.alive)) {
          this.phase = 'break';
          this.timer = 0;
          hud.announce('Wave cleared', `${this.rupees} rupees`);
          sfx.waveCleared();
          player.heal(1);
        }
        break;
      case 'break':
        if (this.timer > 4) this.startWave(this.wave + 1);
        break;
      case 'gameover':
        if (this.timer > 1.5 && ['Enter', 'Space', 'KeyF'].some((k) => this.d.engine.input.wasPressed(k))) this.restart();
        break;
    }
  }

  private startWave(n: number) {
    this.wave = n;
    this.phase = 'fighting';
    this.timer = 0;
    const bossWave = n % config.enemies.bossEvery === 0;
    if (bossWave) {
      this.spawnQueue.push({ boss: true, at: 1.8 });
      const minions = Math.floor(n / config.enemies.bossEvery);
      for (let i = 0; i < minions; i++) this.spawnQueue.push({ boss: false, at: 4 + i * 2 });
      this.d.hud.announce(`Wave ${n}`, 'the King Octorok rises', 3);
      this.d.sfx.boss();
    } else {
      const count = Math.min(1 + n, 7);
      for (let i = 0; i < count; i++) this.spawnQueue.push({ boss: false, at: 1.2 + i * 1.5 });
      this.d.hud.announce(`Wave ${n}`, `${count} octoroks`);
      this.d.sfx.waveStart();
    }
  }

  private restart() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this.spawnQueue.length = 0;
    this.rocks.clear();
    this.pickups.clear();
    this.d.player.reset();
    this.d.hud.showGameOver(null);
    this.rupees = 0;
    this.kills = 0;
    this.wave = 0;
    this.d.hud.setRupees(0);
    this.phase = 'break';
    this.timer = 2;
  }

  private spawnEnemy(boss: boolean) {
    const p = this.camera.position;
    const fwd = this.d.player.flatForward();
    const facing = Math.atan2(fwd.x, fwd.z);
    let x = p.x;
    let z = p.z;
    for (let i = 0; i < 20; i++) {
      const a = facing + (Math.random() - 0.5) * deg(i < 10 ? 150 : 360);
      const r = boss ? 26 : 14 + Math.random() * 20;
      x = p.x + Math.sin(a) * r;
      z = p.z + Math.cos(a) * r;
      if (this.world.isWater(x, z)) break;
    }
    const e = new Octorok(boss, this.wave);
    this.scene.add(e.root);
    e.emerge(x, z);
    this.enemies.push(e);
  }

  // ---------------------------------------------------------------- events

  private surfaced(o: Octorok) {
    const at = new THREE.Vector3(o.position.x, this.d.ocean.heightAt(o.position.x, o.position.z), o.position.z);
    this.d.particles.splash(at, o.boss ? 22 : 12, o.radius * 0.8);
    this.d.ocean.disturb({ x: at.x, z: at.z, radius: o.radius * 1.6, strength: -0.05, foam: 1 });
    this.d.ambience.splash(at, this.camera, o.boss ? 20 : 10);
  }

  private spit(from: THREE.Vector3, target: THREE.Vector3, owner: Octorok) {
    if (this.phase === 'gameover') return;
    const flight = 0.9 + from.distanceTo(target) / config.enemies.rockSpeed;
    this.rocks.spawn(from, target, flight, owner, owner.boss ? 0.5 : 0.32);
    this.d.particles.burst(from, { count: 14, speed: [0.5, 2], size: [0.2, 0.45], life: [0.3, 0.6], color: SMOKE, gravity: -0.1, drag: 3, killOnWater: false });
    if (from.distanceTo(this.camera.position) < 50) this.d.sfx.spit();
  }

  private rockSplash(r: Rock) {
    const at = r.position.clone();
    at.y = this.d.ocean.heightAt(at.x, at.z);
    this.d.particles.splash(at, 9, r.radius);
    this.d.ocean.disturb({ x: at.x, z: at.z, radius: r.radius * 3, strength: -0.03, foam: 0.8 });
  }

  private sparks(at: THREE.Vector3, color = SPARK, count = 50) {
    this.d.particles.burst(at, { count, speed: [3, 9], size: [0.05, 0.13], life: [0.2, 0.55], color, gravity: 0.6, drag: 2.5, killOnWater: false });
  }

  private spinShockwave() {
    const { particles, ocean, sfx, player } = this.d;
    sfx.spin();
    player.addShake(0.25);
    const c = this.camera.position;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = c.x + Math.cos(a) * 3;
      const z = c.z + Math.sin(a) * 3;
      ocean.disturb({ x, z, radius: 1.2, strength: -0.04, foam: 0.9 });
      if (i % 2 === 0) particles.splash(new THREE.Vector3(x, ocean.heightAt(x, z), z), 7, 0.4);
    }
  }

  private kill(e: Octorok) {
    const { particles, sfx, engine, pickups, player, hud } = { ...this.d, pickups: this.pickups };
    this.kills++;
    engine.freeze(e.boss ? 0.25 : 0.1);
    player.addShake(e.boss ? 0.9 : 0.3);
    const at = e.position.clone().setY(e.position.y + e.radius * 0.5);
    particles.burst(at, { count: e.boss ? 140 : 50, speed: [1, 4 * (e.boss ? 2 : 1)], size: [0.6, 1.6].map((v) => v * (e.boss ? 2 : 1)) as [number, number], life: [0.5, 1.1], color: SMOKE, gravity: -0.12, drag: 2.2, spread: e.radius * 0.5, killOnWater: false });
    this.sparks(at, GOLD, e.boss ? 200 : 70);
    sfx.poof();

    const drops = e.boss ? 10 : 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < drops; i++) {
      const r = Math.random();
      pickups.drop(at, 'rupee', e.boss ? (r < 0.4 ? 20 : 5) : r < 0.05 ? 20 : r < 0.3 ? 5 : 1);
    }
    const hurt = player.health < config.player.maxHealth;
    if (e.boss) {
      pickups.drop(at, 'heart');
      pickups.drop(at, 'heart');
      hud.announce('King Octorok defeated!', '', 2.5);
    } else if (hurt && Math.random() < 0.3) {
      pickups.drop(at, 'heart');
    }
  }

  private damage(e: Octorok, amount: number, from: THREE.Vector3, knockback?: number) {
    if (e.hurt(amount, from, knockback)) this.kill(e);
  }

  // ---------------------------------------------------------------- hits

  /** Sword swings bat incoming rocks back at whoever threw them. */
  private resolveParries() {
    const { sword, player, sfx, engine } = this.d;
    if (!sword.active) return;
    const eye = this.camera.position;
    const fwd = player.flatForward();
    for (const r of this.rocks.list) {
      if (r.reflected) continue;
      const to = r.position.clone().sub(eye);
      const dist = to.length();
      const reach = sword.state === 'spin' ? config.sword.spinRadius : config.sword.parryReach;
      if (dist > reach) continue;
      const flat = to.setY(0).normalize();
      if (sword.state !== 'spin' && flat.dot(fwd) < Math.cos(deg(80))) continue;

      const target = r.owner.alive
        ? r.owner.position.clone().setY(r.owner.position.y + r.owner.radius * 0.4)
        : eye.clone().addScaledVector(fwd, 40).setY(0);
      this.rocks.reflect(r, target);
      sfx.clang();
      engine.freeze(0.09);
      player.addShake(0.3);
      this.sparks(r.position, GOLD, 60);
    }
  }

  private resolveRockHits() {
    const { player, hud, sfx } = this.d;
    const center = player.hitCenter();
    for (const r of [...this.rocks.list]) {
      if (r.reflected) {
        for (const e of this.enemies) {
          if (!e.vulnerable) continue;
          if (r.position.distanceTo(e.position) < e.radius + r.radius + 0.4) {
            this.damage(e, 3, r.position, 9);
            sfx.bonk(true);
            this.sparks(r.position, GOLD, 80);
            this.rocks.remove(r);
            break;
          }
        }
        continue;
      }
      if (r.position.distanceTo(center) < r.radius + 0.95) {
        const dmg = config.enemies.rockDamage * (r.owner.boss ? 2 : 1);
        if (player.damage(dmg, r.position)) {
          hud.hurt();
          sfx.hurt();
        }
        this.d.particles.burst(r.position, { count: 25, speed: [2, 5], size: [0.1, 0.25], life: [0.3, 0.6], color: new THREE.Color(0.5, 0.45, 0.4), gravity: 1, drag: 1 });
        this.rocks.remove(r);
      }
    }
  }

  private resolveBallHits() {
    const { toss, sfx, engine, player } = this.d;
    const now = performance.now();
    for (const ball of toss.balls) {
      const b = ball.body;
      if (ball.dying !== undefined || b.velocity.length() < 3) continue;
      if ((b.userData.lastHit as number | undefined) && now - (b.userData.lastHit as number) < 300) continue;
      for (const e of this.enemies) {
        if (!e.vulnerable) continue;
        const n = b.position.clone().sub(e.position);
        if (n.length() > e.radius + b.radius + 0.1) continue;
        n.normalize();
        b.velocity.addScaledVector(n, -2 * b.velocity.dot(n)).multiplyScalar(0.5);
        b.velocity.y = Math.max(b.velocity.y, 3.5);
        b.userData.lastHit = now;
        this.damage(e, 1, b.position);
        sfx.bonk();
        engine.freeze(0.05);
        player.addShake(0.08);
        this.sparks(b.position);
        break;
      }
    }
  }

  private resolveSwordHits() {
    const { sword, player, sfx, engine } = this.d;
    if (!sword.active) return;
    const eye = this.camera.position;
    const fwd = player.flatForward();
    const spin = sword.state === 'spin';
    for (const e of this.enemies) {
      if (!e.vulnerable || e.lastSwingHit === sword.swingId) continue;
      const to = new THREE.Vector3(e.position.x - eye.x, 0, e.position.z - eye.z);
      const dist = to.length() - e.radius;
      if (spin ? dist > config.sword.spinRadius : dist > config.sword.reach) continue;
      if (!spin && to.normalize().dot(fwd) < Math.cos(deg(config.sword.arc))) continue;
      e.lastSwingHit = sword.swingId;
      this.damage(e, spin ? 2 : 1, eye, spin ? 11 : 7);
      sfx.bonk(spin);
      engine.freeze(spin ? 0.06 : 0.08);
      player.addShake(0.25);
      this.sparks(e.position.clone().setY(e.position.y + e.radius * 0.3), SPARK, 70);
    }
  }

  private collectPickups(dt: number, time: number) {
    const { player, hud, sfx } = this.d;
    for (const p of this.pickups.update(dt, time, this.camera.position, this.world.waterHeight)) {
      if (p.kind === 'rupee') {
        this.rupees += p.value;
        hud.setRupees(this.rupees);
        hud.pulseRupees();
        sfx.rupee(p.value);
      } else {
        player.heal(2);
        sfx.heart();
      }
    }
  }

  /** The enemy closest to your aim line, for soft lock-on. */
  private findTarget(origin: THREE.Vector3, forward: THREE.Vector3) {
    let best: Octorok | null = null;
    let bestDot = Math.cos(deg(9));
    for (const e of this.enemies) {
      if (!e.vulnerable) continue;
      const to = new THREE.Vector3(e.position.x - origin.x, 0, e.position.z - origin.z);
      const dist = to.length();
      if (dist > config.throw.maxDistance + 6) continue;
      const dot = to.normalize().dot(forward);
      if (dot > bestDot) {
        bestDot = dot;
        best = e;
      }
    }
    return best;
  }
}
