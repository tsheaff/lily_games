// Yum Yum Monster: a green, spiky, rainbow-tailed monster who only likes to eat.
// He asks for a food (or later, a color), you drag or tap it into his mouth.
// Five yummy foods fill his tummy, he burps rainbow bubbles, then gets a cake you tap to feed him.
'use strict';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const muteBtn = document.getElementById('mute');

const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
const C = {
  bodyLight: '#94e68c',
  body: '#6fd46b',
  bodyDark: '#4cb85a',
  belly: '#cdf6b2',
  spike: '#3f9f5c',
  horn: '#fff3c9',
  hornEdge: '#e9cb82',
  mouth: '#5b2342',
  tongue: '#ff8fab',
  eye: '#2d2a3e',
};
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const UI_FONT = 'Quicksand, ui-rounded, "SF Pro Rounded", system-ui, sans-serif';

const FOODS = [
  { e: '🍎', name: 'an apple', color: 'red' },
  { e: '🍓', name: 'a strawberry', color: 'red' },
  { e: '🍌', name: 'a banana', color: 'yellow' },
  { e: '🧀', name: 'some cheese', color: 'yellow' },
  { e: '🥦', name: 'some broccoli', color: 'green' },
  { e: '🍐', name: 'a pear', color: 'green' },
  { e: '🍇', name: 'some grapes', color: 'purple' },
  { e: '🥕', name: 'a carrot', color: 'orange' },
  { e: '🍊', name: 'an orange', color: 'orange' },
  { e: '🫐', name: 'some blueberries', color: 'blue' },
  { e: '🍩', name: 'a donut', color: 'pink' },
  { e: '🍪', name: 'a cookie', color: null },
  { e: '🍕', name: 'some pizza', color: null },
  { e: '🍉', name: 'some watermelon', color: null },
];
const COLORS = {
  red: '#ff4d4d',
  yellow: '#ffd21f',
  green: '#4cc94c',
  purple: '#9b5cf0',
  orange: '#ff9330',
  blue: '#3f7dff',
  pink: '#ff7fbf',
};
const TUMMY = 5;
const BITES = 5;
const SLOTS = 4;

const ASK = ['I want {x}!', '{X}, please!', 'Can I have {x}?', 'Yummy! {X}!'];
const YUMS = ['Yum!', 'Mmm, yummy!', 'Delicious!', 'Yum yum yum!', 'More please!', 'So tasty!'];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOutBack = (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------- sound ----------

let ac = null;
let master = null;
let muted = false;

function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.55;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
}

function tone({ f, f2 = f, dur, vol, delay = 0, type = 'sine', vib = 0, vibDepth = 6, lp = 0 }) {
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (vib) {
    const l = ac.createOscillator();
    const lg = ac.createGain();
    l.frequency.value = vib;
    lg.gain.value = vibDepth;
    l.connect(lg).connect(o.frequency);
    l.start(t0);
    l.stop(t0 + dur);
  }
  let node = o;
  if (lp) {
    const fl = ac.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = lp;
    node.connect(fl);
    node = fl;
  }
  node.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

let noiseBuf = null;
function noise({ dur, vol, freq, delay = 0 }) {
  if (!ac || muted) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const sfx = {
  pick: () => tone({ f: 600, f2: 900, dur: 0.08, vol: 0.15 }),
  pop: () => tone({ f: 500, f2: 1100, dur: 0.08, vol: 0.12 }),
  chomp: () => {
    noise({ dur: 0.08, vol: 0.4, freq: 900 });
    tone({ f: 190, f2: 90, dur: 0.09, vol: 0.25, type: 'triangle' });
  },
  yum: () => {
    tone({ f: 392, f2: 440, dur: 0.2, vol: 0.22, vib: 7 });
    tone({ f: 523, f2: 698, dur: 0.32, vol: 0.22, delay: 0.2, vib: 7 });
  },
  no: () => {
    tone({ f: 330, f2: 300, dur: 0.16, vol: 0.2, type: 'triangle' });
    tone({ f: 262, f2: 220, dur: 0.26, vol: 0.2, delay: 0.2, type: 'triangle' });
  },
  burp: () => {
    tone({ f: 120, f2: 55, dur: 0.8, vol: 0.55, type: 'sawtooth', lp: 520, vib: 24, vibDepth: 16 });
    noise({ dur: 0.6, vol: 0.18, freq: 300 });
  },
  giggle: () => {
    for (let i = 0; i < 6; i++) {
      tone({ f: 760 + (i % 2) * 200 + i * 25, f2: 640 + i * 25, dur: 0.07, vol: 0.14, delay: i * 0.085 });
    }
  },
  boing: () => tone({ f: 220, f2: 720, dur: 0.38, vol: 0.2, vib: 16, vibDepth: 50 }),
  yawn: () => tone({ f: 300, f2: 180, dur: 0.9, vol: 0.18, type: 'triangle', vib: 5, vibDepth: 10 }),
  tada: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.3, vol: 0.18, delay: i * 0.11, type: 'triangle' })),
};

// ---------- speech ----------

let voice = null;
let talking = false;
let lastSpoke = -99;

function chooseVoice() {
  if (!window.speechSynthesis) return;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith('en'));
  voice =
    voices.find((v) => /Samantha|Karen|Moira|Tessa/.test(v.name)) ||
    voices.find((v) => /Google US English/.test(v.name)) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices[0] ||
    null;
}
if (window.speechSynthesis) {
  chooseVoice();
  speechSynthesis.addEventListener?.('voiceschanged', chooseVoice);
}

function speak(text) {
  lastSpoke = time;
  if (muted || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = 'en-US';
  u.pitch = 1.7;
  u.rate = 0.92;
  u.onstart = () => (talking = true);
  u.onend = u.onerror = () => (talking = false);
  speechSynthesis.speak(u);
}

function askPhrase(r) {
  if (r.type === 'color') return `I want something ${r.color}!`;
  const t = pick(ASK);
  return t.replace('{x}', r.food.name).replace('{X}', cap(r.food.name));
}

// ---------- emoji images ----------

const emojiCache = new Map();
function emojiImg(e, px = 192) {
  const key = e + px;
  let c = emojiCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px * 1.3);
    const g = c.getContext('2d');
    g.font = `${px}px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, c.width / 2, c.height / 2 + px * 0.06);
    emojiCache.set(key, c);
  }
  return c;
}

function drawEmoji(e, x, y, size, rot = 0, alpha = 1) {
  if (size <= 0.5 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(emojiImg(e), -size * 0.65, -size * 0.65, size * 1.3, size * 1.3);
  ctx.restore();
}

// ---------- game state ----------

let W = 0;
let H = 0;
let DPR = 1;
let R = 100;
const L = {};
let time = 0;

let mode = 'sleep'; // sleep | wake | play | cake
let tray = [];
let req = null;
let bubble = { s: 0, pop: 0, content: null };
let tummy = [];
let cakes = 0;
let lastReqFood = null;
let drag = null;
let lastActive = 0;
let lastPointer = null;
let particles = [];
let cake = null;
let trayShow = 1;
let tailPts = [];
let timers = [];
let clouds = [];

const m = {
  state: 'sleep',
  t: 0,
  dur: 0,
  blink: 0,
  nextBlink: 2,
  lookX: 0,
  lookY: 0.4,
  mouth: 0,
  jump: 0,
  rot: 0,
  shake: 0,
  sx: 1,
  sy: 1,
  full: 0,
  arm: 0,
  wag: 1,
  puff: 0,
  happy: 0,
  chewN: 0,
};

function setState(s, dur = 0) {
  m.state = s;
  m.t = 0;
  m.dur = dur;
  m.chewN = 0;
}

function after(sec, fn) {
  timers.push({ at: time + sec, fn });
}

function mouthPos() {
  return { x: L.mx, y: L.my + 0.24 * R };
}

// ---------- layout ----------

function layout() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);

  const trayH = clamp(H * 0.22, 100, 210);
  const slotW = Math.min(W / 4.3, trayH * 1.3);
  L.trayH = trayH;
  L.trayTop = H - trayH;
  L.plateY = H - trayH * 0.5;
  L.plateR = Math.min(slotW * 0.42, trayH * 0.36);
  L.slots = Array.from({ length: SLOTS }, (_, i) => W / 2 + (i - (SLOTS - 1) / 2) * slotW);

  L.meterR = clamp(Math.min(W, H) * 0.042, 15, 30);
  L.meterY = 12 + 26 - L.meterR / 2 + L.meterR;
  const top = L.meterY + L.meterR + 14;
  const avail = L.trayTop - top;
  R = Math.min(W * 0.19, avail * 0.36);
  L.mx = W / 2 + R * 0.15;
  L.my = top + avail * 0.56;
  L.br = R * 0.55;
  L.bx = Math.max(L.br + 14, L.mx - R * 1.8);
  L.by = Math.max(top + L.br * 0.9, L.my - R * 1.05);

  for (const it of tray) {
    if (it.state === 'idle' || it.state === 'spawn') {
      it.x = L.slots[it.slot];
      it.y = L.plateY;
    }
  }
  if (!clouds.length) {
    clouds = Array.from({ length: 4 }, (_, i) => ({ x: rand(0, 1), y: rand(0.05, 0.35), s: rand(0.7, 1.3), v: rand(0.004, 0.01) * (i % 2 ? 1 : 0.7) }));
  }
}

// ---------- tray & requests ----------

function freshFood() {
  const inTray = new Set(tray.filter((i) => i.food && i.state !== 'gone').map((i) => i.food.e));
  const options = FOODS.filter((f) => !inTray.has(f.e));
  return pick(options.length ? options : FOODS);
}

function spawnItem(it, delay = 0) {
  it.food = freshFood();
  it.state = 'wait';
  after(delay, () => {
    it.state = 'spawn';
    it.t = 0;
    it.x = L.slots[it.slot];
    it.y = L.plateY;
    sfx.pop();
  });
}

function fillTray() {
  tray = [];
  for (let i = 0; i < SLOTS; i++) {
    const it = { slot: i, food: null, x: L.slots[i], y: L.plateY, state: 'wait', t: 0, s: 0, hop: 0 };
    tray.push(it);
  }
  tray.forEach((it, i) => spawnItem(it, i * 0.15));
}

function matches(food, r) {
  if (!r) return false;
  return r.type === 'color' ? food.color === r.color : food.e === r.food.e;
}

function nextRequest() {
  if (mode !== 'play') return;
  const ready = tray.filter((i) => i.food && i.state !== 'gone');
  if (!ready.length) return after(0.3, nextRequest);
  let choices = ready.filter((i) => i.food.e !== lastReqFood);
  if (!choices.length) choices = ready;
  const target = pick(choices).food;
  lastReqFood = target.e;
  const colorRound = cakes > 0 && target.color && Math.random() < 0.5;
  req = colorRound ? { type: 'color', color: target.color } : { type: 'food', food: target };
  bubble.content = req;
  bubble.pop = 1;
  lastActive = time;
  speak(askPhrase(req));
}

function canFeed() {
  return mode === 'play' && req && m.state === 'idle' && !tray.some((i) => i.state === 'fly');
}

function arrive(it) {
  if (!canFeedArrived()) {
    it.state = 'return';
    return;
  }
  if (matches(it.food, req)) eat(it);
  else reject(it);
}

function canFeedArrived() {
  return mode === 'play' && req && m.state === 'idle';
}

function eat(it) {
  it.state = 'gone';
  const food = it.food;
  req = null;
  setState('chew', 0.85);
  after(0.85, () => {
    setState('happy', 1.3);
    tummy.push({ food, born: time });
    sfx.yum();
    speak(pick(YUMS));
    const mp = mouthPos();
    for (let i = 0; i < 10; i++) burst('heart', mp.x, mp.y - R * 0.2, pick(['#ff7fa8', '#ff9fc0', '#ffb3d1']));
    for (let i = 0; i < 8; i++) burst('spark', mp.x, mp.y - R * 0.2, pick(RAINBOW));
  });
  after(1.3, () => spawnItem(it));
  after(2.15, () => (tummy.length >= TUMMY ? burp() : nextRequest()));
}

function reject(it) {
  it.state = 'return';
  it.hop = 1;
  it.t = 0;
  setState('no', 1.0);
  sfx.no();
  const r = req;
  speak(`No no! ${r.type === 'color' ? `Something ${r.color}!` : cap(r.food.name) + '!'}`);
  bubble.pop = 1;
}

function burp() {
  setState('burp', 1.9);
  after(0.45, () => sfx.burp());
  after(1.25, () => {
    for (const t of tummy) burst('spark', L.meterX(tummy.indexOf(t)), L.meterY, pick(RAINBOW));
    tummy = [];
    speak('Excuse me! Hee hee!');
  });
  after(2.3, startCake);
}

// ---------- cake ----------

function startCake() {
  mode = 'cake';
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.font = `420px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('🎂', 256, 280);
  cake = { canvas: c, bites: 0, hop: -1, pop: 0, bitten: false };
  bubble.content = { type: 'cake' };
  bubble.pop = 1;
  sfx.tada();
  speak('Cake! Tap tap tap!');
}

function cakePos() {
  return { x: W / 2, y: L.plateY - L.plateR * 0.25, size: Math.min(L.plateR * 2.7, L.trayH * 1.1) };
}

function biteCake() {
  if (!cake || cake.hop >= 0 || cake.bites >= BITES || m.state !== 'idle') return;
  cake.hop = 0;
  cake.bitten = false;
  setState('chomp', 0.55);
}

function cutCake() {
  cake.bites++;
  const g = cake.canvas.getContext('2d');
  g.globalCompositeOperation = 'destination-out';
  if (cake.bites >= BITES) {
    g.clearRect(0, 0, 512, 512);
  } else {
    const x0 = 512 * (1 - cake.bites / BITES) + 20;
    g.fillRect(x0, 0, 512, 512);
    for (let y = 30; y < 512; y += 70) {
      g.beginPath();
      g.arc(x0 + rand(-6, 6), y + rand(-10, 10), rand(34, 46), 0, Math.PI * 2);
      g.fill();
    }
  }
  sfx.chomp();
  const mp = mouthPos();
  for (let i = 0; i < 10; i++) burst('crumb', mp.x, mp.y, pick(['#f7d9a8', '#ffffff', '#ff9fc0', '#c98b5a']));
  if (cake.bites >= BITES) after(0.5, finishCake);
}

function finishCake() {
  cake = null;
  cakes++;
  setState('dance', 2.6);
  sfx.tada();
  sfx.giggle();
  speak('Yummy yummy! Thank you!');
  for (let i = 0; i < 80; i++) {
    particles.push({
      type: 'confetti',
      x: rand(0, W),
      y: rand(-H * 0.3, 0),
      vx: rand(-30, 30),
      vy: rand(60, 160),
      life: 0,
      max: rand(2.5, 4),
      size: rand(6, 11),
      rot: rand(0, 6),
      vr: rand(-6, 6),
      color: pick(RAINBOW),
    });
  }
  after(2.7, () => {
    mode = 'play';
    fillTray();
    after(1.0, nextRequest);
  });
}

// ---------- particles ----------

function burst(type, x, y, color) {
  const a = rand(0, Math.PI * 2);
  const sp = type === 'crumb' ? rand(60, 200) : rand(40, 160);
  particles.push({
    type,
    x,
    y,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp - (type === 'heart' ? 80 : 40),
    life: 0,
    max: type === 'crumb' ? rand(0.5, 0.9) : rand(0.9, 1.5),
    size: type === 'heart' ? rand(12, 22) : type === 'crumb' ? rand(3, 6) : rand(8, 16),
    rot: rand(-0.4, 0.4),
    vr: rand(-2, 2),
    color,
  });
}

function updateParticles(dt) {
  for (const p of particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.type === 'crumb') p.vy += 600 * dt;
    else if (p.type === 'confetti') {
      p.vx += Math.sin(p.life * 3 + p.size) * 40 * dt;
    } else if (p.type === 'bubble') {
      p.vx *= 1 - dt * 1.2;
      p.vy -= 30 * dt;
      p.x += Math.sin(p.life * 4 + p.size) * 20 * dt;
    } else if (p.type === 'z') {
      p.x += Math.sin(p.life * 2) * 15 * dt;
    } else {
      p.vx *= 1 - dt * 2;
      p.vy = p.vy * (1 - dt * 2) - 20 * dt;
    }
  }
  const before = particles.length;
  particles = particles.filter((p) => {
    if (p.life < p.max) return true;
    if (p.type === 'bubble') {
      for (let i = 0; i < 4; i++) burst('spark', p.x, p.y, p.color);
    }
    return false;
  });
  if (particles.length < before && particles.length > 400) particles.splice(0, particles.length - 400);
}

function heartPath(s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.35, -s * 0.85, 0, -s * 0.35);
  ctx.bezierCurveTo(s * 0.35, -s * 0.85, s * 0.9, -s * 0.2, 0, s * 0.35);
  ctx.closePath();
}

function sparkPath(s) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? s * 0.22 : s * 0.6;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawParticles() {
  for (const p of particles) {
    const k = p.life / p.max;
    const alpha = p.type === 'confetti' ? 1 - Math.max(0, k - 0.8) * 5 : 1 - k * k;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.type === 'heart') {
      heartPath(p.size * (0.6 + 0.4 * Math.min(1, k * 5)));
      ctx.fill();
    } else if (p.type === 'spark') {
      sparkPath(p.size * (1 - k * 0.5));
      ctx.fill();
    } else if (p.type === 'crumb') {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'confetti') {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else if (p.type === 'bubble') {
      const r = p.size * Math.min(1, k * 6);
      ctx.globalAlpha *= 0.85;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.14, -0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'z') {
      ctx.font = `700 ${p.size}px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7d7aa8';
      ctx.fillText('z', 0, 0);
    }
    ctx.restore();
  }
}

// ---------- update ----------

function update(dt) {
  time += dt;
  for (const t of timers.filter((t) => t.at <= time)) {
    timers.splice(timers.indexOf(t), 1);
    t.fn();
  }

  m.t += dt;
  if (m.dur && m.t >= m.dur) setState('idle');

  // Tray items
  const mp = mouthPos();
  for (const it of tray) {
    it.t += dt;
    const sx = L.slots[it.slot];
    const sy = L.plateY;
    if (it.state === 'spawn') {
      it.s = easeOutBack(clamp(it.t / 0.45, 0, 1));
      if (it.t > 0.45) it.state = 'idle';
    } else if (it.state === 'idle') {
      it.s = 1;
      it.x = sx;
      it.y = sy;
    } else if (it.state === 'drag') {
      it.s += (1.3 - it.s) * Math.min(1, dt * 14);
    } else if (it.state === 'fly') {
      const k = clamp(it.t / 0.45, 0, 1);
      const e = k * k * (3 - 2 * k);
      it.x = lerp(it.fx, mp.x, e);
      it.y = lerp(it.fy, mp.y, e) - Math.sin(k * Math.PI) * R * 0.6;
      it.s = 1.15 - 0.3 * k;
      if (k >= 1) arrive(it);
    } else if (it.state === 'return') {
      const f = Math.min(1, dt * 9);
      it.x += (sx - it.x) * f;
      it.y += (sy - it.y) * f;
      it.s += (1 - it.s) * f;
      if (Math.hypot(sx - it.x, sy - it.y) < 2) {
        it.state = 'idle';
        it.hop = 0;
      }
    }
  }

  const want = mode === 'cake' || mode === 'play' ? 1 : 0;
  trayShow += ((mode === 'cake' ? 0 : want) - trayShow) * Math.min(1, dt * 6);
  bubble.s += ((req && mode === 'play') || mode === 'cake' ? 1 - bubble.s : -bubble.s) * Math.min(1, dt * 10);
  bubble.pop = Math.max(0, bubble.pop - dt * 3);

  if (cake) {
    cake.pop = Math.min(1, cake.pop + dt * 2.5);
    if (cake.hop >= 0) {
      cake.hop += dt / 0.55;
      if (cake.hop >= 0.5 && !cake.bitten) {
        cake.bitten = true;
        cutCake();
      }
      if (cake.hop >= 1) cake.hop = -1;
    }
  }

  updateMonster(dt);
  updateParticles(dt);

  for (const c of clouds) {
    c.x += c.v * dt;
    if (c.x > 1.2) c.x = -0.2;
  }
}

function updateMonster(dt) {
  let tMouth = 0;
  let tSx = 1;
  let tSy = 1;
  let jump = 0;
  let rot = 0;
  let shake = 0;
  let arm = 0;
  let happy = 0;
  let puff = 0;
  const breathe = Math.sin(time * 2.2) * 0.02;
  tSy = 1 + breathe;
  tSx = 1 - breathe * 0.6;
  const mp = mouthPos();
  const k = m.dur ? clamp(m.t / m.dur, 0, 1) : 0;

  switch (m.state) {
    case 'sleep':
      tSy = 1 + Math.sin(time * 1.3) * 0.035;
      if (Math.floor(time / 1.1) !== Math.floor((time - dt) / 1.1)) {
        particles.push({ type: 'z', x: L.mx + R * 0.5, y: L.my - R * 0.7, vx: 10, vy: -40, life: 0, max: 2.2, size: R * rand(0.22, 0.34), rot: rand(-0.3, 0.3), vr: 0, color: '' });
      }
      break;
    case 'wake':
      tSy = 1 + Math.sin(k * Math.PI) * 0.16;
      tSx = 1 - Math.sin(k * Math.PI) * 0.08;
      tMouth = k < 0.65 ? Math.sin((k / 0.65) * Math.PI) * 0.9 : 0;
      arm = Math.sin(k * Math.PI);
      break;
    case 'idle': {
      const near = tray.find((i) => i.state === 'drag' || i.state === 'fly');
      if (near) {
        const d = Math.hypot(near.x - mp.x, near.y - mp.y);
        tMouth = near.state === 'fly' ? 1 : clamp(1.15 - d / (R * 2.2), 0, 1);
        arm = tMouth * 0.4;
      }
      if (mode === 'cake') {
        tMouth = Math.max(tMouth, 0.25 + 0.1 * Math.sin(time * 5));
        arm = 0.3 + 0.2 * Math.sin(time * 4);
      }
      if (talking) tMouth = Math.max(tMouth, 0.12 + 0.28 * Math.abs(Math.sin(time * 12)));
      break;
    }
    case 'chew': {
      const c = Math.abs(Math.sin(m.t * 13));
      tMouth = 0.08 + 0.32 * c;
      puff = 1;
      tSy = 1 - 0.045 * c;
      tSx = 1 + 0.03 * c;
      const n = Math.floor(m.t / 0.24);
      if (n > m.chewN && m.t < m.dur - 0.1) {
        m.chewN = n;
        sfx.chomp();
        const food = tray.find((i) => i.state === 'gone')?.food;
        const col = food ? COLORS[food.color] || '#e0b080' : '#e0b080';
        for (let i = 0; i < 5; i++) burst('crumb', mp.x + rand(-R * 0.2, R * 0.2), mp.y, col);
      }
      break;
    }
    case 'happy': {
      const hop = Math.abs(Math.sin(k * Math.PI * 2));
      jump = hop * R * 0.28;
      tSy = 1 + hop * 0.08;
      tSx = 1 - hop * 0.05;
      arm = 1;
      happy = 1;
      tMouth = 0.45;
      break;
    }
    case 'no':
      shake = Math.sin(m.t * 28) * R * 0.07 * (1 - k);
      arm = 0.15;
      break;
    case 'giggle':
      rot = Math.sin(m.t * 32) * 0.07 * (1 - k);
      tSy = 1 + 0.03 * Math.sin(m.t * 30);
      happy = 1;
      tMouth = 0.5;
      arm = 0.7;
      break;
    case 'burp':
      if (m.t < 0.45) {
        const q = m.t / 0.45;
        tSy = 1 + 0.12 * q;
        tSx = 1 + 0.06 * q;
        puff = q;
      } else if (m.t < 1.4) {
        tMouth = 1;
        shake = Math.sin(m.t * 45) * R * 0.03;
        tSy = 0.95;
        if (Math.random() < dt * 30) {
          particles.push({
            type: 'bubble',
            x: mp.x + rand(-R * 0.1, R * 0.1),
            y: mp.y,
            vx: rand(-160, 160),
            vy: rand(-220, -90),
            life: 0,
            max: rand(1.4, 2.4),
            size: R * rand(0.1, 0.22),
            rot: 0,
            vr: 0,
            color: pick(RAINBOW),
          });
        }
      } else {
        happy = 1;
        tMouth = 0.4;
      }
      break;
    case 'chomp':
      tMouth = k < 0.45 ? 1 : 0.15;
      puff = k > 0.5 ? 1 : 0;
      arm = 0.6;
      break;
    case 'dance': {
      const b = m.t * Math.PI * 2.2;
      jump = Math.abs(Math.sin(b)) * R * 0.3;
      rot = Math.sin(b * 0.5) * 0.15;
      arm = 0.5 + 0.5 * Math.sin(b);
      happy = 1;
      tMouth = 0.45;
      break;
    }
  }

  const f = Math.min(1, dt * 18);
  m.mouth += (tMouth - m.mouth) * f;
  m.sx += (tSx - m.sx) * Math.min(1, dt * 14);
  m.sy += (tSy - m.sy) * Math.min(1, dt * 14);
  m.jump = jump;
  m.rot += (rot - m.rot) * Math.min(1, dt * 20);
  m.shake = shake;
  m.arm += (arm - m.arm) * Math.min(1, dt * 10);
  m.happy += (happy - m.happy) * Math.min(1, dt * 12);
  m.puff += (puff - m.puff) * Math.min(1, dt * 12);
  m.full += (tummy.length / TUMMY - m.full) * Math.min(1, dt * 4);
  m.wag += (1 - m.wag) * Math.min(1, dt * 1.2);

  if (time > m.nextBlink) {
    m.blink = 0.16;
    m.nextBlink = time + rand(2, 5);
  }
  m.blink = Math.max(0, m.blink - dt);

  // Eyes follow the food being moved, the cake, or the last touch.
  let target = null;
  const moving = tray.find((i) => i.state === 'drag' || i.state === 'fly');
  if (moving) target = moving;
  else if (cake) target = cakePos();
  else if (lastPointer && time - lastPointer.t < 2.5) target = lastPointer;
  let lx = 0;
  let ly = 0.5;
  if (target) {
    const dx = target.x - L.mx;
    const dy = target.y - (L.my - R * 0.3);
    const d = Math.hypot(dx, dy) || 1;
    const s = Math.min(1, d / (R * 1.5));
    lx = (dx / d) * s;
    ly = (dy / d) * s;
  } else {
    lx = Math.sin(time * 0.6) * 0.5;
    ly = 0.4;
  }
  m.lookX += (lx - m.lookX) * Math.min(1, dt * 8);
  m.lookY += (ly - m.lookY) * Math.min(1, dt * 8);

  // Gentle hints when she's been waiting a while.
  if (mode === 'play' && req && m.state === 'idle' && !drag) {
    const idle = time - lastActive;
    for (const it of tray) it.hint = idle > 6 && it.state === 'idle' && matches(it.food, req);
    if (idle > 9 && time - lastSpoke > 9) {
      speak(askPhrase(req));
      bubble.pop = 1;
    }
  } else {
    for (const it of tray) it.hint = false;
  }
}

// ---------- drawing ----------

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#d9f2ff');
  sky.addColorStop(0.55, '#fff4e6');
  sky.addColorStop(1, '#fff0f3');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun
  const sx = W * 0.86;
  const sy = H * 0.16;
  const sr = Math.min(W, H) * 0.08;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 2.4);
  glow.addColorStop(0, 'rgba(255,230,150,0.55)');
  glow.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
  ctx.fillStyle = '#ffe49a';
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of clouds) {
    const x = c.x * W;
    const y = c.y * H;
    const s = Math.min(W, H) * 0.06 * c.s;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.arc(x + s * 1.1, y + s * 0.2, s * 0.8, 0, Math.PI * 2);
    ctx.arc(x - s * 1.1, y + s * 0.25, s * 0.7, 0, Math.PI * 2);
    ctx.arc(x + s * 0.3, y - s * 0.5, s * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hills
  const ground = L.my + R * 1.02;
  ctx.fillStyle = '#e1f4cf';
  ctx.beginPath();
  ctx.moveTo(0, ground - R * 0.6);
  ctx.quadraticCurveTo(W * 0.25, ground - R * 1.3, W * 0.55, ground - R * 0.4);
  ctx.quadraticCurveTo(W * 0.8, ground - R * 0.9, W, ground - R * 0.5);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  ctx.fillStyle = '#cdebb6';
  ctx.beginPath();
  ctx.moveTo(0, ground - R * 0.05);
  ctx.quadraticCurveTo(W * 0.5, ground - R * 0.35, W, ground - R * 0.05);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();

  // Little flowers
  const flowers = [0.08, 0.2, 0.33, 0.7, 0.84, 0.95];
  flowers.forEach((fx, i) => {
    const x = fx * W;
    const y = ground - R * (0.15 + (i % 3) * 0.06);
    const s = R * 0.05;
    ctx.fillStyle = ['#ffb3c7', '#fff', '#ffd6a5', '#cdb4ff'][i % 4];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + time * 0.2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTray() {
  const x = L.slots[0] - L.plateR * 1.5;
  const w = L.slots[SLOTS - 1] - L.slots[0] + L.plateR * 3;
  const y = L.trayTop + L.trayH * 0.08;
  const h = H - y + 40;
  ctx.save();
  roundRect(x, y, w, h, 30);
  ctx.fillStyle = '#fff1f4';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,170,190,0.28)';
  const g = Math.max(18, L.plateR * 0.45);
  for (let gx = x; gx < x + w; gx += g * 2) ctx.fillRect(gx, y, g, h);
  for (let gy = y; gy < y + h; gy += g * 2) ctx.fillRect(x, gy, w, g);
  ctx.restore();

  for (let i = 0; i < SLOTS; i++) {
    const px = L.slots[i];
    const py = L.plateY;
    ctx.fillStyle = 'rgba(150,100,120,0.15)';
    ctx.beginPath();
    ctx.ellipse(px, py + L.plateR * 0.12, L.plateR, L.plateR * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, L.plateR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2e6ea';
    ctx.lineWidth = L.plateR * 0.08;
    ctx.beginPath();
    ctx.arc(px, py, L.plateR * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    const it = tray.find((t) => t.slot === i);
    if (it?.hint) {
      ctx.strokeStyle = `rgba(255,200,60,${0.5 + 0.4 * Math.sin(time * 8)})`;
      ctx.lineWidth = L.plateR * 0.14;
      ctx.beginPath();
      ctx.arc(px, py, L.plateR * 1.05, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawFoods(layer) {
  for (const it of tray) {
    if (!it.food || it.state === 'gone' || it.state === 'wait') continue;
    const top = it.state === 'drag' || it.state === 'fly';
    if ((layer === 'top') !== top) continue;
    let y = it.y;
    let rot = 0;
    if (it.state === 'idle') {
      y += Math.sin(time * 2.2 + it.slot * 1.3) * L.plateR * 0.04;
      if (it.hint) rot = Math.sin(time * 12) * 0.22;
    }
    if (it.state === 'return' && it.hop) rot = Math.sin(it.t * 20) * 0.3 * Math.max(0, 1 - it.t * 2);
    if (it.state === 'drag') rot = Math.sin(time * 6) * 0.08;
    const size = L.plateR * 1.35 * it.s;
    const a = top ? 1 : trayShow;
    if (top) {
      ctx.fillStyle = 'rgba(80,60,80,0.12)';
      ctx.beginPath();
      ctx.ellipse(it.x, it.y + size * 0.7, size * 0.4, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawEmoji(it.food.e, it.x, y, size, rot, a);
  }
}

function drawCake() {
  if (!cake) return;
  const p = cakePos();
  const mp = mouthPos();
  let x = p.x;
  let y = p.y;
  let s = p.size * easeOutBack(cake.pop);
  if (cake.hop >= 0) {
    const h = Math.sin(clamp(cake.hop, 0, 1) * Math.PI);
    x = lerp(p.x, mp.x - p.size * 0.25, h);
    y = lerp(p.y, mp.y + p.size * 0.2, h);
    s *= 1 - 0.2 * h;
  } else if (cake.bites < BITES) {
    s *= 1 + Math.sin(time * 5) * 0.03;
  }
  ctx.drawImage(cake.canvas, x - s / 2, y - s / 2, s, s);
}

function drawBubble() {
  if (bubble.s < 0.02 || !bubble.content) return;
  const s = bubble.s * (1 + 0.18 * Math.sin(bubble.pop * Math.PI));
  const wiggle = tray.some((i) => i.hint) ? Math.sin(time * 10) * 0.05 : 0;
  const hx = L.mx - R * 0.55;
  const hy = L.my - R * 0.8;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(120,90,130,0.25)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  for (const [t, r] of [
    [0.25, 0.1],
    [0.5, 0.15],
  ]) {
    ctx.beginPath();
    ctx.arc(lerp(hx, L.bx, t), lerp(hy, L.by, t), L.br * r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(L.bx, L.by);
  ctx.rotate(wiggle);
  ctx.scale(s, s);
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = L.br * (1 + 0.05 * Math.sin(a * 7));
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.92);
  }
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(L.bx, L.by);
  ctx.rotate(wiggle);
  ctx.scale(s, s);
  const c = bubble.content;
  if (c.type === 'food') drawEmoji(c.food.e, 0, 0, L.br * 1.15);
  else if (c.type === 'cake') drawEmoji('🎂', 0, 0, L.br * 1.15);
  else splat(0, 0, L.br * 0.62, COLORS[c.color]);
  ctx.restore();
}

function splat(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const rr = r * (1 + 0.13 * Math.sin(a * 7 + 1) + 0.06 * Math.sin(a * 3));
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
  for (const [dx, dy, dr] of [
    [1.25, -0.6, 0.16],
    [-1.2, 0.75, 0.12],
    [0.9, 1.05, 0.1],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, dr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.38, r * 0.3, r * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawMeter() {
  if (mode === 'sleep' || mode === 'wake') return;
  const r = L.meterR;
  const gap = r * 2.5;
  const x0 = W / 2 - ((TUMMY - 1) * gap) / 2;
  L.meterX = (i) => x0 + i * gap;
  ctx.save();
  roundRect(x0 - r * 1.5, L.meterY - r * 1.3, (TUMMY - 1) * gap + r * 3, r * 2.6, r * 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
  for (let i = 0; i < TUMMY; i++) {
    const x = x0 + i * gap;
    const t = tummy[i];
    if (t) {
      const k = clamp((time - t.born) / 0.4, 0, 1);
      drawEmoji(t.food.e, x, L.meterY, r * 1.7 * easeOutBack(k));
    } else {
      ctx.fillStyle = 'rgba(180,220,170,0.55)';
      ctx.beginPath();
      ctx.arc(x, L.meterY, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawMonster() {
  const full = m.full;
  const rx = R * 0.95 * (1 + 0.12 * full);
  const ry = R;

  // Ground shadow
  ctx.fillStyle = 'rgba(70,110,60,0.18)';
  ctx.beginPath();
  ctx.ellipse(L.mx, L.my + R * 1.06, rx * (1 - (m.jump / R) * 0.6), R * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(L.mx + m.shake, L.my + R - m.jump);
  ctx.rotate(m.rot);
  ctx.scale(m.sx, m.sy);
  ctx.translate(0, -R);

  drawTail(rx);

  // Spikes along the top of his head
  for (const a of [-2.08, -1.84, -1.57, -1.3, -1.06]) {
    const big = a === -1.57;
    drawSpike(rx, ry, a, (big ? 0.36 : 0.27) * R, 0.13 * R);
  }
  // Horns
  drawHorn(rx, ry, -2.3, -1);
  drawHorn(rx, ry, -0.84, 1);

  // Body
  const grad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.45, R * 0.1, 0, 0, R * 1.25);
  grad.addColorStop(0, C.bodyLight);
  grad.addColorStop(0.55, C.body);
  grad.addColorStop(1, C.bodyDark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly grows as he eats
  ctx.fillStyle = C.belly;
  ctx.beginPath();
  ctx.ellipse(0, R * 0.52, R * 0.55 * (1 + 0.3 * full), R * 0.4 * (1 + 0.15 * full), 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet
  for (const side of [-1, 1]) {
    const fx = side * R * 0.45;
    const fy = R * 0.95;
    ctx.fillStyle = C.bodyDark;
    ctx.beginPath();
    ctx.ellipse(fx, fy, R * 0.26, R * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.horn;
    for (let t = -1; t <= 1; t++) {
      ctx.beginPath();
      ctx.arc(fx + t * R * 0.1, fy + R * 0.08, R * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Arms
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * rx * 0.93, R * 0.28);
    const wave = m.arm > 0.6 ? Math.sin(time * 14 + side) * 0.25 : 0;
    ctx.rotate(-side * (0.45 + m.arm * 2.0 + wave));
    ctx.fillStyle = C.bodyDark;
    ctx.beginPath();
    ctx.ellipse(0, R * 0.2, R * 0.12, R * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCheeks();
  drawEyes();
  drawMouth();

  ctx.restore();
}

function drawSpike(rx, ry, a, len, w) {
  const px = rx * Math.cos(a);
  const py = ry * Math.sin(a);
  let nx = Math.cos(a) / rx;
  let ny = Math.sin(a) / ry;
  const nl = Math.hypot(nx, ny);
  nx /= nl;
  ny /= nl;
  ctx.save();
  ctx.translate(px - nx * R * 0.08, py - ny * R * 0.08);
  ctx.rotate(Math.atan2(ny, nx) + Math.PI / 2);
  ctx.fillStyle = C.spike;
  ctx.strokeStyle = C.spike;
  ctx.lineWidth = R * 0.06;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(0, -len);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHorn(rx, ry, a, side) {
  const px = rx * Math.cos(a);
  const py = ry * Math.sin(a);
  let nx = Math.cos(a) / rx;
  let ny = Math.sin(a) / ry;
  const nl = Math.hypot(nx, ny);
  nx /= nl;
  ny /= nl;
  const len = R * 0.44;
  const w = R * 0.12;
  ctx.save();
  ctx.translate(px - nx * R * 0.06, py - ny * R * 0.06);
  ctx.rotate(Math.atan2(ny, nx) + Math.PI / 2);
  ctx.scale(side, 1);
  ctx.fillStyle = C.horn;
  ctx.strokeStyle = C.hornEdge;
  ctx.lineWidth = R * 0.03;
  ctx.beginPath();
  ctx.moveTo(-w, R * 0.05);
  ctx.quadraticCurveTo(-w * 0.4, -len * 0.55, R * 0.17, -len);
  ctx.quadraticCurveTo(w * 1.2, -len * 0.5, w, R * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTail(rx) {
  const N = 14;
  const seg = R * 0.11;
  let x = rx * 0.78;
  let y = R * 0.6;
  let ang = -0.1;
  const speed = 3 + (m.wag - 1) * 3;
  const amp = 0.09 * m.wag;
  const pts = [];
  for (let i = 0; i < N; i++) {
    ang += -0.14 + amp * Math.sin(time * speed - i * 0.45);
    x += Math.cos(ang) * seg;
    y += Math.sin(ang) * seg;
    pts.push({ x, y, r: R * 0.17 * (1 - (i / N) * 0.55), c: RAINBOW[Math.floor((i * RAINBOW.length) / N)] });
  }
  for (let i = N - 1; i >= 0; i--) {
    const p = pts[i];
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tip = pts[N - 1];
  ctx.save();
  ctx.translate(tip.x + Math.cos(ang) * R * 0.08, tip.y + Math.sin(ang) * R * 0.08);
  ctx.rotate(ang + Math.PI / 2);
  ctx.fillStyle = '#ff8fb8';
  heartPath(R * 0.26);
  ctx.fill();
  ctx.restore();

  const T = ctx.getTransform();
  tailPts = pts.map((p) => {
    const q = T.transformPoint(new DOMPoint(p.x, p.y));
    return { x: q.x / DPR, y: q.y / DPR, r: p.r * Math.abs(m.sx) + 10 };
  });
}

function drawCheeks() {
  const s = 1 + 0.3 * m.puff;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * R * 0.62, R * 0.08);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,140,170,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.17, R * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.03;
    for (let k = 0; k < 5; k++) {
      ctx.strokeStyle = RAINBOW[k];
      ctx.beginPath();
      ctx.arc(0, R * 0.06, R * (0.15 - k * 0.028), Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawEyes() {
  const asleep = m.state === 'sleep' || (m.state === 'wake' && m.t < 0.35);
  const open = m.blink > 0 ? 0.1 : 1;
  for (const side of [-1, 1]) {
    const ex = side * R * 0.33;
    const ey = -R * 0.3;
    const er = R * 0.23;
    ctx.lineCap = 'round';
    if (asleep || m.happy > 0.5) {
      ctx.strokeStyle = C.eye;
      ctx.lineWidth = R * 0.06;
      ctx.beginPath();
      if (asleep) ctx.arc(ex, ey, er * 0.6, 0.15 * Math.PI, 0.85 * Math.PI);
      else ctx.arc(ex, ey + er * 0.3, er * 0.6, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, er, er * open, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(45,42,62,0.25)';
    ctx.lineWidth = R * 0.02;
    ctx.stroke();
    if (open < 0.5) continue;
    const px = ex + m.lookX * R * 0.09;
    const py = ey + m.lookY * R * 0.08;
    ctx.fillStyle = C.eye;
    ctx.beginPath();
    ctx.arc(px, py, R * 0.125, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - R * 0.04, py - R * 0.045, R * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + R * 0.04, py + R * 0.04, R * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMouth() {
  const o = m.mouth;
  const w = R * 0.24 * (1 + 0.25 * o);
  ctx.save();
  ctx.translate(0, R * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (m.state === 'no') {
    ctx.strokeStyle = C.mouth;
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = lerp(-w * 0.8, w * 0.8, i / 16);
      ctx.lineTo(x, R * 0.06 + Math.sin(i * 1.2 + time * 10) * R * 0.025);
    }
    ctx.stroke();
  } else if (o < 0.05) {
    ctx.strokeStyle = C.mouth;
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    ctx.moveTo(-w * 0.8, 0);
    ctx.quadraticCurveTo(0, R * 0.16, w * 0.8, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w * 0.3, R * 0.05);
    ctx.lineTo(w * 0.5, R * 0.035);
    ctx.lineTo(w * 0.42, R * 0.12);
    ctx.closePath();
    ctx.fill();
  } else {
    const h = R * 0.42 * o;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(0, -R * 0.04, w, 0);
    ctx.bezierCurveTo(w, h * 1.3, -w, h * 1.3, -w, 0);
    ctx.closePath();
    ctx.fillStyle = C.mouth;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.tongue;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.95, w * 0.6, h * 0.42 + R * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * w * 0.55, -R * 0.02);
      ctx.lineTo(side * w * 0.25, -R * 0.02);
      ctx.lineTo(side * w * 0.4, Math.min(R * 0.11, h * 0.5));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawTitle() {
  if (mode !== 'sleep') return;
  const size = clamp(Math.min(W, H) * 0.085, 30, 64);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${UI_FONT}`;
  const text = 'Yum Yum Monster';
  const tw = ctx.measureText(text).width;
  const g = ctx.createLinearGradient(W / 2 - tw / 2, 0, W / 2 + tw / 2, 0);
  RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
  ctx.lineWidth = size * 0.18;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, W / 2, size * 1.1);
  ctx.fillStyle = g;
  ctx.fillText(text, W / 2, size * 1.1);

  const bx = W / 2;
  const by = L.plateY;
  const br = Math.min(L.trayH * 0.32, 60) * (1 + Math.sin(time * 4) * 0.05);
  ctx.shadowColor = 'rgba(60,140,70,0.4)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = C.body;
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(bx - br * 0.3, by - br * 0.42);
  ctx.lineTo(bx + br * 0.5, by);
  ctx.lineTo(bx - br * 0.3, by + br * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.font = `700 ${clamp(size * 0.38, 14, 22)}px ${UI_FONT}`;
  ctx.fillStyle = '#7a6a80';
  ctx.fillText('Tap to wake him up!', bx, by - br - 18);
  ctx.restore();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground();
  if (mode !== 'sleep') drawTray();
  drawFoods('tray');
  drawMeter();
  drawMonster();
  drawCake();
  drawBubble();
  drawFoods('top');
  drawParticles();
  drawTitle();
}

// ---------- input ----------

function pointFrom(e) {
  return { x: e.clientX, y: e.clientY };
}

function itemAt(p) {
  let best = null;
  let bestD = Infinity;
  for (const it of tray) {
    if (it.state !== 'idle' && it.state !== 'spawn') continue;
    const d = Math.hypot(p.x - it.x, p.y - it.y);
    if (d < L.plateR * 1.15 && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  return best;
}

function hitTail(p) {
  return tailPts.some((t) => Math.hypot(p.x - t.x, p.y - t.y) < t.r);
}

function hitBody(p) {
  const dx = (p.x - L.mx) / (R * 1.05);
  const dy = (p.y - L.my) / (R * 1.1);
  return dx * dx + dy * dy < 1;
}

function wake() {
  mode = 'wake';
  setState('wake', 1.4);
  sfx.yawn();
  speak("Yawn! I'm so hungry!");
  after(1.5, () => {
    mode = 'play';
    fillTray();
    after(1.0, nextRequest);
  });
}

function tickle() {
  setState('giggle', 0.9);
  sfx.giggle();
  if (Math.random() < 0.4) speak(pick(['Hee hee! That tickles!', 'Hee hee hee!', 'Tickle tickle!']));
  for (let i = 0; i < 6; i++) burst('heart', lastPointer.x, lastPointer.y, pick(['#ff7fa8', '#ffb3d1']));
}

function wagTail() {
  m.wag = 4;
  sfx.boing();
  for (const t of tailPts) if (Math.random() < 0.5) burst('spark', t.x, t.y, pick(RAINBOW));
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointFrom(e);
  lastPointer = { ...p, t: time };
  lastActive = time;
  audio();
  if (mode === 'sleep') return wake();
  if (mode === 'wake') return;
  if (hitTail(p)) return wagTail();
  if (mode === 'cake') return biteCake();
  if (mode !== 'play') return;
  const it = itemAt(p);
  if (it) {
    if (!canFeed()) {
      it.hop = 1;
      it.t = 0;
      it.state = 'return';
      return;
    }
    it.state = 'drag';
    it.t = 0;
    drag = { item: it, id: e.pointerId, ox: it.x - p.x, oy: it.y - p.y, sx: p.x, sy: p.y, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    sfx.pick();
    return;
  }
  if (hitBody(p) && m.state === 'idle') tickle();
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointFrom(e);
  if (!drag || drag.id !== e.pointerId) return;
  lastPointer = { ...p, t: time };
  lastActive = time;
  drag.item.x = p.x + drag.ox;
  drag.item.y = p.y + drag.oy;
  drag.moved = Math.max(drag.moved, Math.hypot(p.x - drag.sx, p.y - drag.sy));
});

function endDrag(e) {
  if (!drag || drag.id !== e.pointerId) return;
  const it = drag.item;
  const mp = mouthPos();
  const moved = drag.moved;
  drag = null;
  if (Math.hypot(it.x - mp.x, it.y - mp.y) < R * 0.75) {
    arrive(it);
  } else if (moved < 14) {
    it.state = 'fly';
    it.t = 0;
    it.fx = it.x;
    it.fy = it.y;
  } else {
    it.state = 'return';
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  if (muted && window.speechSynthesis) speechSynthesis.cancel();
});

// ---------- loop ----------

window.addEventListener('resize', layout);
layout();
L.meterX = () => W / 2;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
