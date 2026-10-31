import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './Input';
import { config } from '../config';

export interface FrameContext {
  /** Seconds since the previous call. */
  dt: number;
  /** Seconds since engine start. */
  time: number;
}

/**
 * A unit of game logic. `fixedUpdate` runs at a constant rate (physics,
 * simulations); `update` runs once per rendered frame (visuals, UI).
 */
export interface System {
  fixedUpdate?(ctx: FrameContext): void;
  update?(ctx: FrameContext): void;
  /** Called after the frame is rendered. */
  lateUpdate?(ctx: FrameContext): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
}

export class Engine {
  static readonly FIXED_DT = 1 / 60;

  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly input: Input;

  private systems: System[] = [];
  private accumulator = 0;
  private fixedTime = 0;
  private time = 0;
  private last = 0;
  private running = false;
  private freezeTimer = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.render.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = config.render.exposure;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      config.render.fov,
      window.innerWidth / window.innerHeight,
      0.25,
      30000,
    );

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const { strength, radius, threshold } = config.render.bloom;
    this.composer.addPass(new UnrealBloomPass(size.clone().multiplyScalar(0.5), strength, radius, threshold));
    this.composer.addPass(new OutputPass());

    this.input = new Input(this.renderer.domElement);
    window.addEventListener('resize', this.onResize);
  }

  add<T extends System>(system: T): T {
    this.systems.push(system);
    system.resize?.(window.innerWidth, window.innerHeight);
    return system;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  dispose() {
    this.stop();
    for (const s of this.systems) s.dispose?.();
    this.input.dispose();
    window.removeEventListener('resize', this.onResize);
    this.composer.dispose();
    this.renderer.dispose();
  }

  /** Freeze simulation briefly (hit-stop). Rendering continues. */
  freeze(seconds: number) {
    this.freezeTimer = Math.max(this.freezeTimer, seconds);
  }

  private frame = (now: number) => {
    let dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      dt = 0;
    }

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= Engine.FIXED_DT && steps < 5) {
      this.fixedTime += Engine.FIXED_DT;
      const fixed = { dt: Engine.FIXED_DT, time: this.fixedTime };
      for (const s of this.systems) s.fixedUpdate?.(fixed);
      this.accumulator -= Engine.FIXED_DT;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;

    // Render time tracks simulation time so shaders and physics agree on wave phase.
    this.time = this.fixedTime + this.accumulator;
    const ctx = { dt, time: this.time };
    for (const s of this.systems) s.update?.(ctx);
    this.composer.render(dt);
    for (const s of this.systems) s.lateUpdate?.(ctx);
    this.input.endFrame();
  };

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    for (const s of this.systems) s.resize?.(w, h);
  };
}
