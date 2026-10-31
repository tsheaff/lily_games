import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { config } from '../config';
import { Clouds } from './Clouds';
import type { FrameContext, System } from '../engine/Engine';

const deg = THREE.MathUtils.degToRad;

/**
 * Sky, sun, ambient light, fog and the captured reflection cubemap that
 * everything else (water, PBR materials) reads from.
 */
export class Environment implements System {
  readonly sunDirection = new THREE.Vector3();
  readonly sunColor = new THREE.Color();
  readonly sky: Sky;
  readonly clouds: Clouds;
  readonly sunLight: THREE.DirectionalLight;
  readonly fog: THREE.FogExp2;
  /** Linear HDR capture of the surroundings, used for reflections. */
  readonly cubeTarget: THREE.WebGLCubeRenderTarget;
  private cubeCamera: THREE.CubeCamera;
  private pmremTarget?: THREE.WebGLRenderTarget;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    private camera: THREE.Camera,
  ) {
    const { elevation, azimuth, color, intensity } = config.sun;
    const el = deg(elevation);
    const az = deg(azimuth);
    this.sunDirection.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.sunColor.setRGB(color[0], color[1], color[2]).multiplyScalar(intensity);

    this.sky = new Sky();
    this.sky.scale.setScalar(18000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = config.sky.turbidity;
    u.rayleigh.value = config.sky.rayleigh;
    u.mieCoefficient.value = config.sky.mieCoefficient;
    u.mieDirectionalG.value = config.sky.mieDirectionalG;
    u.sunPosition.value.copy(this.sunDirection);
    scene.add(this.sky);

    this.clouds = new Clouds(this.sunDirection, this.sunColor);
    scene.add(this.clouds.mesh);

    this.sunLight = new THREE.DirectionalLight(new THREE.Color(color[0], color[1], color[2]), intensity);
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(100);
    scene.add(this.sunLight);
    scene.add(new THREE.HemisphereLight(0x9cc8ff, 0x1b5a63, 0.55));

    this.fog = new THREE.FogExp2(0xbfd8e8, config.fog.density);
    scene.fog = this.fog;

    this.cubeTarget = new THREE.WebGLCubeRenderTarget(512, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.cubeCamera = new THREE.CubeCamera(1, 30000, this.cubeTarget);
    this.cubeCamera.position.set(0, 2, 0);
  }

  /**
   * Captures the sky into the cubemap. Call once with only the sky visible
   * to derive the fog color, then again after land is added.
   */
  capture(hidden: THREE.Object3D[] = [], deriveFog = false) {
    const visibility = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    const fog = this.scene.fog;
    if (deriveFog) this.scene.fog = null;

    this.cubeCamera.update(this.renderer, this.scene);

    this.scene.fog = fog;
    hidden.forEach((o, i) => (o.visible = visibility[i]));

    if (deriveFog) this.deriveFogColor();

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmremTarget?.dispose();
    this.pmremTarget = pmrem.fromCubemap(this.cubeTarget.texture);
    pmrem.dispose();
    this.scene.environment = this.pmremTarget.texture;
    this.scene.environmentIntensity = 0.8;
  }

  /** Averages the horizon band of the side faces so distant land melts into the sky. */
  private deriveFogColor() {
    const size = this.cubeTarget.width;
    const rows = 2;
    const buffer = new Uint16Array(size * rows * 4);
    const sum = new THREE.Vector3();
    let count = 0;
    for (const face of [0, 1, 4, 5]) {
      this.renderer.readRenderTargetPixels(this.cubeTarget, 0, size / 2, size, rows, buffer, face);
      for (let i = 0; i < buffer.length; i += 4) {
        const r = THREE.DataUtils.fromHalfFloat(buffer[i]);
        const g = THREE.DataUtils.fromHalfFloat(buffer[i + 1]);
        const b = THREE.DataUtils.fromHalfFloat(buffer[i + 2]);
        if (!Number.isFinite(r + g + b) || r + g + b > 30) continue;
        sum.x += r;
        sum.y += g;
        sum.z += b;
        count++;
      }
    }
    if (count > 0) {
      sum.divideScalar(count);
      this.fog.color.setRGB(sum.x, sum.y, sum.z, THREE.LinearSRGBColorSpace);
    }
  }

  update({ time }: FrameContext) {
    this.clouds.update(time, this.camera.position);
  }

  dispose() {
    this.cubeTarget.dispose();
    this.pmremTarget?.dispose();
  }
}
