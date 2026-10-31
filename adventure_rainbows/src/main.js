import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { mulberry32 } from './utils.js';
import { createSky, createClouds } from './sky.js';
import { sampleMood } from './mood.js';
import { createOcean } from './ocean.js';
import { waveHeight, shoreDamp } from './waves.js';
import { IslandWorld } from './islands.js';
import { PRIZES } from './prizes.js';
import { Boat } from './boat.js';
import { DoubleRainbow } from './rainbow.js';
import { Wake, Confetti, TargetMarker, makeGlowTexture } from './effects.js';
import { GameAudio } from './audio.js';

const MOOD_PERIOD = 360;
const CAM_DIST = 17;
const CAM_HEIGHT = 8;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 160, 720);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 5000);

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(pixelRatio);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.65, 0.55, 1.3);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const shared = { uTime: { value: 0 }, uScale: { value: 800 } };

// ---------- world ----------
const rng = mulberry32(20261030);
const glowTex = makeGlowTexture();
const world = new IslandWorld(scene, shared, glowTex, rng);
const islands = world.islands;

const sky = createSky();
scene.add(sky.mesh);
const clouds = createClouds(rng);
scene.add(clouds.mesh);
const ocean = createOcean(shared, world.uniformArray);
scene.add(ocean.mesh);

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.2);
scene.add(hemi);

const boat = new Boat();
scene.add(boat.group);
const wake = new Wake(scene, shared);
const confetti = new Confetti(scene);
const marker = new TargetMarker(scene);
const rainbow = new DoubleRainbow(scene, shared);
const audio = new GameAudio();

let time = 0;
const heightAt = (x, z) => waveHeight(x, z, time, shoreDamp(x, z, islands));

// ---------- HUD ----------
const $ = (id) => document.getElementById(id);
const hud = $('hud');
const slotsEl = $('treasures');
const toastEl = $('toast');
let found = [];

function renderSlots() {
  slotsEl.innerHTML = '';
  for (let i = 0; i < islands.length; i++) {
    const s = document.createElement('div');
    s.className = 'slot empty';
    slotsEl.appendChild(s);
  }
}

const toastQueue = [];
let toastBusy = false;
function toast(text) {
  toastQueue.push(text);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const text = toastQueue.shift();
  if (!text) {
    toastBusy = false;
    return;
  }
  toastBusy = true;
  toastEl.textContent = text;
  toastEl.classList.remove('show');
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  setTimeout(nextToast, 3000);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newGame() {
  found = [];
  world.reset(shuffle(PRIZES.map((p) => p.id)));
  renderSlots();
}
newGame();

// ---------- game state ----------
let started = false;
let won = false;

const callbacks = {
  canCollect: false,
  onOpen() {
    audio.open();
  },
  onReveal(isl, prize) {
    audio.chime();
    toast(`You found a ${prize.name}! ${prize.emoji}`);
    confetti.burst(_tmp.set(isl.x, isl.chestTop + 2, isl.z), 180, 1);
  },
  onCollected(isl, prize) {
    audio.sparkle();
    const slot = slotsEl.children[found.length];
    found.push(prize);
    if (slot) {
      slot.className = 'slot filled';
      slot.textContent = prize.emoji;
    }
    if (found.length === islands.length && !won) {
      won = true;
      setTimeout(celebrate, 1200);
    }
  },
};

function celebrate() {
  audio.win();
  rainbow.show();
  $('win-treasures').textContent = found.map((p) => p.emoji).join(' ');
  $('win').classList.remove('hidden');
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      const a = Math.random() * Math.PI * 2;
      confetti.burst(_tmp.set(boat.pos.x + Math.cos(a) * 6, boat.y + 3, boat.pos.y + Math.sin(a) * 6), 160, 1.3);
    }, i * 350);
  }
}

rainbow.onAppear = () => {
  if (!started) return;
  audio.rainbow();
  toast('✨ Double Rainbow! ✨');
};

$('play').addEventListener('click', () => {
  audio.init();
  started = true;
  callbacks.canCollect = true;
  $('start').classList.add('hidden');
  hud.classList.add('show');
});

$('again').addEventListener('click', () => {
  $('win').classList.add('hidden');
  won = false;
  newGame();
});

const muteBtn = $('mute');
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.setMuted(!audio.muted);
  muteBtn.textContent = audio.muted ? '🔇' : '🔊';
});

// ---------- input ----------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') rainbow.show();
  if (!started) return;
  if (e.code.startsWith('Arrow')) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _tmp = new THREE.Vector3();
let pointerDown = false;

function steerToPointer(e, isTap) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  let tx;
  let tz;
  const hits = raycaster.intersectObjects(world.pickables, true);
  const isl = hits.length ? world.islandFromObject(hits[0].object) : null;
  if (isl) {
    const dx = boat.pos.x - isl.x;
    const dz = boat.pos.y - isl.z;
    const d = Math.hypot(dx, dz) || 1;
    tx = isl.x + (dx / d) * (isl.shoreR + 3.5);
    tz = isl.z + (dz / d) * (isl.shoreR + 3.5);
  } else {
    const hit = raycaster.ray.intersectPlane(waterPlane, _tmp);
    if (hit && hit.distanceTo(camera.position) < 900) {
      tx = hit.x;
      tz = hit.z;
    } else {
      const d = raycaster.ray.direction;
      const l = Math.hypot(d.x, d.z) || 1;
      tx = boat.pos.x + (d.x / l) * 80;
      tz = boat.pos.y + (d.z / l) * 80;
    }
  }
  boat.target = new THREE.Vector2(tx, tz);
  marker.show(tx, tz);
  if (isTap) audio.tap();
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!started) return;
  pointerDown = true;
  renderer.domElement.setPointerCapture(e.pointerId);
  steerToPointer(e, true);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (pointerDown) steerToPointer(e, false);
});
const release = () => (pointerDown = false);
renderer.domElement.addEventListener('pointerup', release);
renderer.domElement.addEventListener('pointercancel', release);

// ---------- resize ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 70 : 55;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  shared.uScale.value = buf.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
window.addEventListener('resize', resize);
resize();

// ---------- mood (time of day) ----------
let moodT = 0.05;
function applyMood(m) {
  const su = sky.uniforms;
  su.uTop.value.copy(m.top);
  su.uHorizon.value.copy(m.horizon);
  su.uBottom.value.copy(m.bottom);
  su.uSunDir.value.copy(m.sunDir);
  su.uSunColor.value.copy(m.sun);
  su.uStars.value = m.stars;
  su.uTime.value = time;

  const ou = ocean.uniforms;
  ou.uDeep.value.copy(m.deep);
  ou.uShallow.value.copy(m.shallow);
  ou.uLagoon.value.copy(m.lagoon);
  ou.uSkyTop.value.copy(m.top);
  ou.uSkyHorizon.value.copy(m.horizon);
  ou.uSunDir.value.copy(m.sunDir);
  ou.uSunColor.value.copy(m.sun);
  ou.uFogColor.value.copy(m.horizon);

  const cu = clouds.uniforms;
  cu.uSunDir.value.copy(m.sunDir);
  cu.uSunColor.value.copy(m.sun);
  cu.uShadow.value.copy(m.cloudShadow);
  cu.uHorizon.value.copy(m.horizon);

  scene.fog.color.copy(m.horizon);
  sun.color.copy(m.sun);
  sun.intensity = m.sunI;
  hemi.color.copy(m.hemiSky);
  hemi.groundColor.copy(m.hemiGround);
  hemi.intensity = m.hemiI;
}

// ---------- camera ----------
const lookTarget = new THREE.Vector3();
const desiredCam = new THREE.Vector3();
function placeCamera(dt, snap) {
  const f = boat.forward;
  desiredCam.set(boat.pos.x - f.x * CAM_DIST, CAM_HEIGHT + boat.y * 0.3, boat.pos.y - f.z * CAM_DIST);
  _tmp.set(boat.pos.x + f.x * 14, 2.5, boat.pos.y + f.z * 14);
  if (snap) {
    camera.position.copy(desiredCam);
    lookTarget.copy(_tmp);
  } else {
    camera.position.lerp(desiredCam, 1 - Math.exp(-2.5 * dt));
    lookTarget.lerp(_tmp, 1 - Math.exp(-4 * dt));
  }
  camera.lookAt(lookTarget);
}

// ---------- loop ----------
const clock = new THREE.Clock();
let wakeAcc = 0;
boat.update(0, 0, keys, islands, heightAt, () => {});
placeCamera(0, true);

function spawnWake(dt) {
  const speed = Math.abs(boat.speed);
  if (speed < 1.5) return;
  wakeAcc += dt * speed * 1.8;
  const f = boat.forward;
  while (wakeAcc > 1) {
    wakeAcc -= 1;
    const side = (Math.random() - 0.5) * 1.4;
    wake.spawn(
      boat.pos.x - f.x * 2.4 + f.z * side,
      boat.pos.y - f.z * 2.4 - f.x * side,
      f.z * side * 1.5 - f.x * 0.6,
      -f.x * side * 1.5 - f.z * 0.6,
      1.1 + Math.random() * 0.6
    );
    for (const s of [-1, 1]) {
      wake.spawn(
        boat.pos.x + f.x * 1.6 + f.z * s * 1.2,
        boat.pos.y + f.z * 1.6 - f.x * s * 1.2,
        f.z * s * 3.5,
        -f.x * s * 3.5,
        0.7 + Math.random() * 0.4
      );
    }
  }
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  shared.uTime.value = time;

  moodT = (moodT + dt / MOOD_PERIOD) % 1;
  const mood = sampleMood(moodT);
  applyMood(mood);

  boat.update(dt, time, keys, islands, heightAt, () => marker.hide());
  spawnWake(dt);
  wake.update(dt, heightAt);
  marker.update(dt, heightAt);

  world.update(dt, time, boat.pos, camera, callbacks);
  confetti.update(dt);

  placeCamera(dt, false);
  rainbow.update(dt, camera);

  ocean.follow(camera.position.x, camera.position.z);
  sky.mesh.position.copy(camera.position);
  clouds.mesh.position.set(camera.position.x, 0, camera.position.z);
  sun.target.position.set(boat.pos.x, 0, boat.pos.y);
  sun.position.copy(sun.target.position).addScaledVector(mood.sunDir, 100);

  composer.render();
}
renderer.setAnimationLoop(loop);

// Debug helpers for screenshots: ?play&mood=0.6&at=x,z,heading
const params = new URLSearchParams(location.search);
if (params.has('mood')) moodT = parseFloat(params.get('mood'));
if (params.has('at')) {
  const [x, z, h] = params.get('at').split(',').map(Number);
  boat.pos.set(x, z);
  boat.heading = h || 0;
  boat.update(0, 0, keys, islands, heightAt, () => {});
  placeCamera(0, true);
}
if (params.has('play')) $('play').click();
if (params.has('warp')) {
  for (let i = 0; i < parseFloat(params.get('warp')) * 60; i++) {
    time += 1 / 60;
    shared.uTime.value = time;
    world.update(1 / 60, time, boat.pos, camera, callbacks);
    confetti.update(1 / 60);
  }
}
if (params.has('rainbow')) {
  rainbow.update(0, camera);
  rainbow.level = 1;
  rainbow.state = 'hold';
  rainbow.holdT = 999;
}
