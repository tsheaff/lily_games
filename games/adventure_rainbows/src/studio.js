import * as THREE from 'three';
import { Sailor } from './sailor.js';
import { damp } from './utils.js';
import { woodTexture, wallpaperTexture, portholeTexture, tiled, patternTexture } from './textures.js';
import { mesh, sphere, cyl, lathe, phys, plainMat, metalMat, fabric, glossMat, tube } from './parts.js';
import { SPECTRUM_HEX } from './utils.js';

const STAGE_Y = 0.14;
const WALL_R = 9;
const WALL_Z = 5;
const wallZ = (x) => WALL_Z - Math.sqrt(WALL_R * WALL_R - x * x) + 0.06;

/** Where the camera looks for each picker tab, in sailor-local meters. */
const FOCUS = {
  full: { y: 0.78, h: 1.72, w: 1.1, dir: [0.25, 0.14, 1] },
  face: { y: 1.24, h: 0.72, w: 0.7, dir: [0.22, 0.06, 1] },
  upper: { y: 0.98, h: 1.05, w: 0.95, dir: [0.25, 0.1, 1] },
  lower: { y: 0.52, h: 1.15, w: 1.0, dir: [0.25, 0.22, 1] },
  feet: { y: 0.2, h: 0.62, w: 0.75, dir: [0.4, 0.28, 1] },
};

/** The Captain's Closet: a little boutique where the sailor gets dressed up on a turntable. */
export class Studio {
  constructor(environment) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f9cfe2');
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.6;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    this.sailor = new Sailor({ shadows: true });
    this.sailor.group.position.y = STAGE_Y;
    this.scene.add(this.sailor.group);

    this.focus = 'full';
    this.spin = 0;
    this.spinV = 0;
    this.idle = 0;
    this.drag = null;
    this.target = new THREE.Vector3();
    this.snap = true;
    this.twinkle = [];
    this.buildRoom();
    this.buildLights();
  }

  setFocus(name) {
    this.focus = FOCUS[name] ? name : 'full';
  }

  buildLights() {
    const key = new THREE.DirectionalLight('#fff3e6', 2.6);
    key.position.set(2.2, 4.6, 3.6);
    key.target.position.set(0, 0.8, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 2.2, bottom: -1.3, near: 1, far: 12 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight('#ffc2e6', 1.8);
    rim.position.set(-3, 3, -4);
    const front = new THREE.DirectionalLight('#ffffff', 0.55);
    front.position.set(0, 1.5, 5);
    this.scene.add(key, key.target, rim, front, new THREE.HemisphereLight('#fff0f6', '#c49a80', 0.8));
  }

  buildRoom() {
    const s = this.scene;
    const floor = mesh(new THREE.CircleGeometry(14, 64).rotateX(-Math.PI / 2), phys({ map: tiled(woodTexture(), 23, 23), roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.FrontSide }), 0, 0, WALL_Z);
    floor.receiveShadow = true;
    s.add(floor);

    const wall = mesh(new THREE.CylinderGeometry(WALL_R, WALL_R, 7, 96, 1, true), phys({ map: tiled(wallpaperTexture(), 60, 7.5), roughness: 0.85, side: THREE.BackSide }), 0, 4.7, WALL_Z);
    const wainscot = mesh(new THREE.CylinderGeometry(WALL_R - 0.02, WALL_R - 0.02, 1.2, 96, 1, true), phys({ color: '#fff4ea', roughness: 0.6, clearcoat: 0.3, side: THREE.BackSide }), 0, 0.6, WALL_Z);
    const rail = mesh(new THREE.TorusGeometry(WALL_R - 0.05, 0.05, 8, 128).rotateX(Math.PI / 2), glossMat('#ffffff', 0.3), 0, 1.2, WALL_Z);
    s.add(wall, wainscot, rail);

    // Turntable stage and rug.
    const stage = mesh(cyl(0.8, 0.84, STAGE_Y, 64), phys({ color: '#f6d9e8', roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.15 }), 0, STAGE_Y / 2, 0);
    stage.receiveShadow = true;
    s.add(stage);
    s.add(mesh(new THREE.TorusGeometry(0.8, 0.018, 10, 96).rotateX(Math.PI / 2), metalMat(0), 0, STAGE_Y, 0));
    this.ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7fc4').multiplyScalar(2.2) });
    s.add(mesh(new THREE.TorusGeometry(0.845, 0.012, 8, 96).rotateX(Math.PI / 2), this.ledMat, 0, 0.02, 0));
    const rug = mesh(new THREE.CircleGeometry(1.7, 64).rotateX(-Math.PI / 2), phys({ color: '#ffb6d5', roughness: 1, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffffff'), side: THREE.FrontSide }), 0, 0.006, 0);
    rug.receiveShadow = true;
    s.add(rug);

    this.buildPorthole(2.4, 2.15);
    this.buildMirror(-2.5, 2.0);
    this.buildRack();
    this.buildHatBoxes();
    this.buildGarland();
  }

  buildPorthole(x, y) {
    const g = new THREE.Group();
    g.position.set(x, y, wallZ(x));
    g.lookAt(0, y, WALL_Z);
    g.add(mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ map: portholeTexture() })));
    const brass = phys({ color: '#d6a84a', metalness: 1, roughness: 0.3 });
    g.add(mesh(new THREE.TorusGeometry(0.6, 0.075, 16, 64), brass));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(mesh(sphere(0.025, 10, 8), brass, Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.07));
    }
    const glass = mesh(new THREE.CircleGeometry(0.55, 48), phys({ color: '#ffffff', roughness: 0.02, transparent: true, opacity: 0.12, clearcoat: 1 }), 0, 0, 0.02);
    g.add(glass);
    this.scene.add(g);
  }

  buildMirror(x, y) {
    const g = new THREE.Group();
    g.position.set(x, y, wallZ(x));
    g.lookAt(0, y, WALL_Z);
    const glass = mesh(new THREE.CircleGeometry(0.7, 64), phys({ color: '#eef3f8', metalness: 1, roughness: 0.04, side: THREE.FrontSide }), 0, 0, 0.02);
    glass.scale.set(0.72, 1, 1);
    const frame = mesh(new THREE.TorusGeometry(0.7, 0.06, 14, 72), phys({ color: '#f2c14e', metalness: 1, roughness: 0.25 }), 0, 0, 0.03);
    frame.scale.set(0.72, 1, 1);
    g.add(glass, frame);
    const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6').multiplyScalar(2.6) });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.add(mesh(sphere(0.045, 14, 10), bulb, Math.cos(a) * 0.84 * 0.72, Math.sin(a) * 0.84, 0.08));
    }
    this.scene.add(g);
  }

  buildRack() {
    const g = new THREE.Group();
    g.position.set(2.0, 0, -1.7);
    g.rotation.y = -0.5;
    const gold = metalMat(0);
    for (const x of [-0.75, 0.75]) g.add(mesh(cyl(0.018, 0.018, 1.7, 12), gold, x, 0.85, 0), mesh(cyl(0.12, 0.14, 0.03, 20), gold, x, 0.015, 0));
    g.add(mesh(cyl(0.016, 0.016, 1.56, 12).rotateZ(Math.PI / 2), gold, 0, 1.68, 0));
    const looks = [
      ['#ff5fa2', 'dots'], ['#4fb8ff', 'stripes'], ['#ffd23f', 'flowers'], ['#b47cff', 'sparkle'],
      ['#5cd88a', 'gingham'], ['#ff8a3d', 'hearts'], ['#ffffff', 'stars'],
    ];
    looks.forEach(([color, pattern], i) => {
      const x = -0.6 + i * 0.2;
      const hanger = new THREE.Group();
      hanger.position.set(x, 1.68, 0);
      hanger.rotation.y = 1.25 + (i % 2) * 0.12;
      hanger.add(mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 16, Math.PI * 1.4), gold, 0, 0.0, 0));
      hanger.add(mesh(cyl(0.004, 0.004, 0.26, 6).rotateZ(Math.PI / 2 - 0.25), gold, -0.06, -0.06, 0), mesh(cyl(0.004, 0.004, 0.26, 6).rotateZ(-Math.PI / 2 + 0.25), gold, 0.06, -0.06, 0));
      const dress = mesh(lathe([[0.27, -0.75], [0.17, -0.42], [0.09, -0.2], [0.08, -0.08], [0.02, -0.04]], { segments: 32 }), fabric({ color, pattern }, pattern === 'sparkle' ? 'satin' : 'cotton', 1.2, 0.7));
      dress.scale.z = 0.3;
      hanger.add(dress);
      g.add(hanger);
    });
    this.scene.add(g);
  }

  buildHatBoxes() {
    const g = new THREE.Group();
    g.position.set(-1.9, 0, -1.4);
    const boxes = [
      [0.36, 0.3, '#ff8ac4', 'stripes'],
      [0.28, 0.26, '#4fb8ff', 'dots'],
      [0.2, 0.2, '#ffd23f', 'hearts'],
    ];
    let y = 0;
    boxes.forEach(([r, h, color, pattern], i) => {
      const side = phys({ map: tiled(patternTexture(pattern, color), 6, 1.2), roughness: 0.7, side: THREE.FrontSide });
      const box = mesh(cyl(r, r, h, 40), side, (i - 1) * 0.04, y + h / 2, 0);
      box.castShadow = true;
      const lid = mesh(cyl(r + 0.02, r + 0.02, 0.05, 40), plainMat(i === 1 ? '#ffffff' : color, 0.6), (i - 1) * 0.04, y + h + 0.02, 0);
      g.add(box, lid);
      y += h + 0.05;
    });
    const bowMat = fabric({ color: '#ff5fa2' }, 'satin');
    for (const s of [-1, 1]) {
      const loop = mesh(sphere(0.06, 14, 10), bowMat, s * 0.065 + 0.04, y + 0.03, 0);
      loop.scale.set(1.2, 0.6, 0.5);
      g.add(loop);
    }
    this.scene.add(g);
  }

  buildGarland() {
    const pts = [];
    const bulbs = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const x = -4.2 + t * 8.4;
      const y = 3.55 - Math.sin(t * Math.PI) * 0.55 + Math.sin(t * Math.PI * 3) * 0.08;
      const p = new THREE.Vector3(x, y, wallZ(x) + 0.25);
      pts.push(p);
      if (i > 0 && i < 26) bulbs.push(p);
    }
    this.scene.add(tube(pts, 0.008, plainMat('#5a8a4a', 0.6), false, 120));
    bulbs.forEach((p, i) => {
      const color = new THREE.Color(SPECTRUM_HEX[i % 7]);
      const m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.4) });
      m.userData = { base: color, phase: i * 1.7 };
      this.twinkle.push(m);
      this.scene.add(mesh(sphere(0.045, 12, 10), m, p.x, p.y - 0.05, p.z));
    });
  }

  // ---------- turntable input ----------
  grab(e) {
    this.drag = { x: e.clientX, last: e.clientX, t: performance.now(), moved: 0 };
  }

  move(e) {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.last;
    const now = performance.now();
    this.spin += dx * 0.012;
    this.spinV = (dx * 0.012) / Math.max(0.008, (now - this.drag.t) / 1000);
    this.drag.last = e.clientX;
    this.drag.t = now;
    this.drag.moved += Math.abs(dx);
    this.idle = 0;
  }

  /** Returns true if this was a tap rather than a drag. */
  release() {
    if (!this.drag) return false;
    const tap = this.drag.moved < 8;
    if (performance.now() - this.drag.t > 80) this.spinV = 0;
    this.drag = null;
    if (tap) this.sailor.twirl();
    return tap;
  }

  /** `view` is the full canvas size plus the part of it the picker panel leaves free. */
  update(dt, time, view) {
    if (!this.drag) {
      this.spin += this.spinV * dt;
      this.spinV *= Math.exp(-3 * dt);
      this.idle += dt;
      if (this.idle > 1.5 && Math.abs(this.spinV) < 0.4) this.spin = damp(this.spin, Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2, 1.2, dt);
    }
    const f = FOCUS[this.focus];
    const dir = new THREE.Vector3(...f.dir).normalize();
    this.sailor.update(dt, time, { face: Math.atan2(dir.x, dir.z) + this.spin });

    const cam = this.camera;
    cam.aspect = view.w / view.h;
    cam.setViewOffset(view.w, view.h, view.ox, view.oy, view.w, view.h);
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = Math.max((f.h * view.h) / (view.fh * 0.86), (f.w * view.h) / (view.fw * 0.86)) / (2 * tanH);
    const lift = this.sailor.lift || 0;
    const target = new THREE.Vector3(0, f.y + STAGE_Y + lift, 0);
    const pos = target.clone().addScaledVector(dir, d);
    if (this.snap) {
      cam.position.copy(pos);
      this.target.copy(target);
      this.snap = false;
    } else {
      cam.position.lerp(pos, 1 - Math.exp(-4 * dt));
      this.target.lerp(target, 1 - Math.exp(-5 * dt));
    }
    cam.lookAt(this.target);

    this.ledMat.color.setHSL((time * 0.05) % 1, 0.9, 0.62).multiplyScalar(2.2);
    for (const m of this.twinkle) m.color.copy(m.userData.base).multiplyScalar(1.4 + Math.max(0, Math.sin(time * 2.2 + m.userData.phase)) * 1.8);
  }
}