// Yum Yum Monster: a rainbow monster who only likes to eat.
// He never names the food; he gives a clue (a color, a shape, a kind of food, two clues, or a riddle)
// and you drag or tap the right food into his mouth. Five foods fill his tummy, he burps rainbow
// bubbles, and you open a present with a prize he wears. Each level brings trickier clues.
import { COLORS, SHAPES, KINDS, FOODS, RIDDLES, RIDDLE_ALSO, PRIZES, LINES, colorShapeCombos, colorKindCombos } from './content.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const muteBtn = document.getElementById('mute');

const RAINBOW = ['#ff5f7e', '#ff9a4d', '#ffd447', '#6bdc6b', '#4fb8ff', '#9b7bff'];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const UI_FONT = 'Quicksand, ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
const TUMMY = 5;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOutBack = (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, k) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  const c = x.map((v, i) => Math.round(lerp(v, y[i], k)));
  return `#${((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1)}`;
}
function bodyColorAt(t) {
  const p = clamp(t, 0, 1) * (RAINBOW.length - 1);
  const i = Math.min(RAINBOW.length - 2, Math.floor(p));
  return mix(RAINBOW[i], RAINBOW[i + 1], p - i);
}

// ---------- sound effects ----------

let ac = null;
let master = null;
let voiceOut = null;
let analyser = null;
let muted = false;

function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.6;
    master.connect(ac.destination);
    voiceOut = ac.createGain();
    voiceOut.gain.value = 1.4;
    analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    voiceOut.connect(analyser);
    analyser.connect(master);
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
  pick: () => tone({ f: 600, f2: 900, dur: 0.08, vol: 0.12 }),
  pop: () => tone({ f: 500, f2: 1100, dur: 0.08, vol: 0.1 }),
  chomp: () => {
    noise({ dur: 0.08, vol: 0.35, freq: 900 });
    tone({ f: 190, f2: 90, dur: 0.09, vol: 0.2, type: 'triangle' });
  },
  yum: () => {
    tone({ f: 523, f2: 587, dur: 0.12, vol: 0.12, type: 'triangle' });
    tone({ f: 784, f2: 1047, dur: 0.2, vol: 0.12, delay: 0.1, type: 'triangle' });
  },
  no: () => tone({ f: 300, f2: 220, dur: 0.25, vol: 0.12, type: 'triangle' }),
  burp: () => {
    tone({ f: 120, f2: 55, dur: 0.8, vol: 0.5, type: 'sawtooth', lp: 520, vib: 24, vibDepth: 16 });
    noise({ dur: 0.6, vol: 0.16, freq: 300 });
  },
  boing: () => tone({ f: 220, f2: 720, dur: 0.38, vol: 0.16, vib: 16, vibDepth: 50 }),
  shake: () => noise({ dur: 0.25, vol: 0.2, freq: 2500 }),
  tada: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.3, vol: 0.15, delay: i * 0.11, type: 'triangle' })),
};

// ---------- voice (pre-recorded clips in voice/<key>.<i>.mp3) ----------

const clipData = new Map();
const clipBuffers = new Map();
const lastIndex = {};
let voiceSrc = null;
let sayToken = 0;
let lastSpoke = -99;

function fetchClip(file) {
  if (!clipData.has(file)) {
    clipData.set(
      file,
      fetch(`voice/${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null),
    );
  }
  return clipData.get(file);
}

async function clipBuffer(file) {
  if (clipBuffers.has(file)) return clipBuffers.get(file);
  const data = await fetchClip(file);
  if (!data || !ac) return null;
  const buf = await new Promise((res) => ac.decodeAudioData(data.slice(0), res, () => res(null)));
  if (buf) clipBuffers.set(file, buf);
  return buf;
}

function preload(keys) {
  const files = keys.flatMap((k) => (LINES[k] || []).map((_, i) => `${k}.${i}.mp3`));
  let i = 0;
  const next = () => {
    if (i < files.length) fetchClip(files[i++]).then(next);
  };
  for (let n = 0; n < 4; n++) next();
}

function chooseLine(key) {
  const n = LINES[key]?.length || 0;
  if (!n) return -1;
  let i = Math.floor(Math.random() * n);
  if (n > 1 && i === lastIndex[key]) i = (i + 1) % n;
  lastIndex[key] = i;
  return i;
}

// Plays one line for `key`, then calls `then` when he's done talking.
function say(key, then, index = chooseLine(key)) {
  const token = ++sayToken;
  lastSpoke = time;
  if (voiceSrc) {
    try {
      voiceSrc.stop();
    } catch {}
    voiceSrc = null;
  }
  if (index < 0) return then && after(0.5, then);
  const text = LINES[key][index];
  const fallbackDur = 0.4 + text.length * 0.06;
  if (muted || !ac) return then && after(muted ? 0.6 : fallbackDur, then);
  clipBuffer(`${key}.${index}.mp3`).then((buf) => {
    if (token !== sayToken) return;
    if (!buf) return then && after(0.6, then);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(voiceOut);
    src.onended = () => {
      if (voiceSrc === src) voiceSrc = null;
      if (token === sayToken && then) then();
    };
    src.start();
    voiceSrc = src;
  });
}

const ampBuf = new Float32Array(512);
function voiceLevel() {
  if (!analyser || !voiceSrc) return 0;
  analyser.getFloatTimeDomainData(ampBuf);
  let s = 0;
  for (let i = 0; i < ampBuf.length; i++) s += ampBuf[i] * ampBuf[i];
  return Math.sqrt(s / ampBuf.length);
}

// ---------- emoji images ----------

const emojiCache = new Map();
function emojiImg(e) {
  let c = emojiCache.get(e);
  if (!c) {
    const px = 192;
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px * 1.3);
    const g = c.getContext('2d');
    g.font = `${px}px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, c.width / 2, c.height / 2 + px * 0.06);
    emojiCache.set(e, c);
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

// ---------- state ----------

let W = 0;
let H = 0;
let DPR = 1;
let R = 100;
const L = { slots: [] };
let time = 0;

let mode = 'sleep'; // sleep | wake | play | present
let level = 1;
let tray = [];
let leaving = [];
let req = null;
let lastReqKey = null;
let wrongs = 0;
let bubble = { s: 0, pop: 0, content: null };
let tummy = [];
let prizes = 0;
let flyingPrize = null;
let present = null;
let drag = null;
let lastActive = 0;
let hinted = false;
let lastPointer = null;
let particles = [];
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
  talk: 0,
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
  L.trayH = trayH;
  L.trayTop = H - trayH;
  L.plateY = H - trayH * 0.5;
  L.plateR = Math.min((W / 5.3) * 0.42, trayH * 0.36);

  L.meterR = clamp(Math.min(W, H) * 0.042, 15, 30);
  L.meterY = 12 + 26 - L.meterR / 2 + L.meterR;
  const top = L.meterY + L.meterR + 18;
  const avail = L.trayTop - top;
  const portrait = H > W * 1.2;
  if (portrait) {
    R = Math.min(W * 0.25, avail * 0.3);
    L.mx = W / 2 - R * 0.12;
    L.my = top + avail * 0.6;
    L.br = R * 0.6;
    L.bx = Math.max(L.br + 14, L.mx - R * 0.85);
    L.by = Math.max(top + L.br * 0.9, L.my - R * 2.2);
  } else {
    R = Math.min(W * 0.19, avail * 0.36);
    L.mx = W / 2 + R * 0.15;
    L.my = top + avail * 0.56;
    L.br = R * 0.55;
    L.bx = Math.max(L.br + 14, L.mx - R * 1.8);
    L.by = Math.max(top + L.br * 0.9, L.my - R * 1.05);
  }
  layoutSlots();

  if (!clouds.length) {
    clouds = Array.from({ length: 4 }, (_, i) => ({ x: rand(0, 1), y: rand(0.05, 0.35), s: rand(0.7, 1.3), v: rand(0.004, 0.01) * (i % 2 ? 1 : 0.7) }));
  }
}

function layoutSlots() {
  const n = Math.max(3, tray.length);
  const slotW = Math.min(W / (n + 0.3), L.trayH * 1.3);
  L.slots = Array.from({ length: n }, (_, i) => W / 2 + (i - (n - 1) / 2) * slotW);
  for (const it of tray) {
    if (it.state === 'idle' || it.state === 'spawn' || it.state === 'wait') {
      it.x = L.slots[it.slot];
      it.y = L.plateY;
    }
  }
}

// ---------- clues & rounds ----------

function levelConfig(lv) {
  if (lv === 1) return { plates: 3, types: ['color'] };
  if (lv === 2) return { plates: 4, types: ['color', 'shape', 'kind', 'shape', 'kind'] };
  if (lv === 3) return { plates: 4, types: ['cs', 'ck', 'cs', 'ck', 'shape', 'kind'] };
  if (lv === 4) return { plates: 4, types: ['riddle', 'riddle', 'riddle', 'cs', 'ck'] };
  return { plates: 5, types: ['riddle', 'riddle', 'cs', 'ck', 'two', 'two', 'shape', 'kind'] };
}

const byId = Object.fromEntries(FOODS.map((f) => [f.id, f]));

function makeRequest(type) {
  switch (type) {
    case 'color': {
      const c = pick(Object.keys(COLORS));
      return { type, color: c, key: `ask.color.${c}`, test: (f) => f.color === c, fair: (f) => f.color !== null };
    }
    case 'shape': {
      const s = pick(Object.keys(SHAPES));
      return { type, shape: s, key: `ask.shape.${s}`, test: (f) => f.shape === s, fair: (f) => f.shape !== null };
    }
    case 'kind': {
      const k = pick(Object.keys(KINDS));
      return { type, kind: k, key: `ask.kind.${k}`, test: (f) => f.kind === k, fair: (f) => f.kind !== null };
    }
    case 'cs': {
      const [c, s] = pick(colorShapeCombos());
      return {
        type, color: c, shape: s, key: `ask.cs.${c}.${s}`,
        test: (f) => f.color === c && f.shape === s,
        fair: (f) => f.color !== null && f.shape !== null,
        near: (f) => f.color === c || f.shape === s,
      };
    }
    case 'ck': {
      const [c, k] = pick(colorKindCombos());
      return {
        type, color: c, kind: k, key: `ask.ck.${c}.${k}`,
        test: (f) => f.color === c && f.kind === k,
        fair: (f) => f.color !== null && f.kind !== null,
        near: (f) => f.color === c || f.kind === k,
      };
    }
    case 'riddle': {
      const id = pick(Object.keys(RIDDLES).filter((r) => FOODS.some((f) => f.riddles.includes(r))));
      const also = RIDDLE_ALSO[id] || [];
      const targets = FOODS.filter((f) => f.riddles.includes(id));
      const kinds = new Set(targets.map((f) => f.kind));
      return {
        type, riddle: id, key: `riddle.${id}`,
        test: (f) => f.riddles.includes(id),
        fair: (f) => !also.includes(f.id) && !(f.kind && kinds.has(f.kind) && Math.random() < 0.5),
      };
    }
    case 'two': {
      const base = pick(['color', 'shape', 'kind']);
      for (let tries = 0; tries < 20; tries++) {
        const r = makeRequest(base);
        if (FOODS.filter(r.test).length >= 2) {
          const v = r.color || r.shape || r.kind;
          return { ...r, type: 'two', base, count: 2, key: `two.${base}.${v}` };
        }
      }
      return makeRequest('color');
    }
  }
}

function newRequest() {
  const cfg = levelConfig(level);
  for (let tries = 0; tries < 30; tries++) {
    const r = makeRequest(pick(cfg.types));
    if (r.key === lastReqKey || !LINES[r.key]) continue;
    const matches = FOODS.filter(r.test);
    const count = r.count || 1;
    if (matches.length < count) continue;
    const right = shuffle(matches).slice(0, count);
    const wrongPool = shuffle(FOODS.filter((f) => !r.test(f) && r.fair(f)));
    const near = r.near ? wrongPool.filter(r.near).slice(0, 2) : [];
    const wrong = [...near, ...wrongPool.filter((f) => !near.includes(f))].slice(0, cfg.plates - count);
    if (wrong.length < 2) continue;
    r.count = count;
    r.left = count;
    r.foods = shuffle([...right, ...wrong]);
    return r;
  }
  return null;
}

function newRound() {
  if (mode !== 'play') return;
  const r = newRequest();
  if (!r) return after(0.2, newRound);
  for (const it of tray) {
    if (it.state !== 'gone') leaving.push({ ...it, state: 'leave', t: 0 });
  }
  tray = r.foods.map((food, slot) => ({ food, slot, x: 0, y: 0, s: 0, state: 'wait', t: 0, hop: 0, hint: false }));
  layoutSlots();
  tray.forEach((it, i) =>
    after(0.25 + i * 0.12, () => {
      it.state = 'spawn';
      it.t = 0;
      sfx.pop();
    }),
  );
  req = r;
  lastReqKey = r.key;
  wrongs = 0;
  hinted = false;
  bubble.content = r;
  bubble.pop = 1;
  lastActive = time;
  r.line = chooseLine(r.key);
  fetchClip(`${r.key}.${r.line}.mp3`);
  after(0.5, () => askAgain());
}

function askAgain() {
  if (!req || mode !== 'play') return;
  bubble.pop = 1;
  say(req.key, null, req.line);
}

function canFeed() {
  return mode === 'play' && req && m.state === 'idle' && !tray.some((i) => i.state === 'fly');
}

function arrive(it) {
  if (!(mode === 'play' && req && m.state === 'idle')) {
    it.state = 'return';
    return;
  }
  if (req.test(it.food)) eat(it);
  else reject(it);
}

function eat(it) {
  it.state = 'gone';
  const food = it.food;
  req.left--;
  const done = req.left <= 0;
  for (const t of tray) t.hint = false;
  setState('chew', 0.85);
  after(0.85, () => {
    setState('happy', 1.3);
    tummy.push({ food, born: time });
    sfx.yum();
    const full = tummy.length >= TUMMY;
    const mp = mouthPos();
    for (let i = 0; i < 10; i++) burst('heart', mp.x, mp.y - R * 0.2, pick(['#ff7fa8', '#ff9fc0', '#ffb3d1']));
    for (let i = 0; i < 8; i++) burst('spark', mp.x, mp.y - R * 0.2, pick(RAINBOW));
    if (full) {
      req = null;
      say('yum', () => after(0.2, burp));
    } else if (done) {
      req = null;
      say('yum', () => after(0.3, newRound));
    } else {
      say('onemore', () => (lastActive = time));
    }
  });
}

function reject(it) {
  it.state = 'return';
  it.hop = 1;
  it.t = 0;
  wrongs++;
  setState('no', 1.0);
  sfx.no();
  bubble.pop = 1;
  say('no', () => {
    if (!req) return;
    if (wrongs >= 2) showHint();
    after(0.25, askAgain);
  });
}

function showHint() {
  hinted = true;
  for (const t of tray) t.hint = t.state === 'idle' && req.test(t.food);
}

function burp() {
  setState('burp', 1.9);
  after(0.45, () => sfx.burp());
  after(1.25, () => {
    tummy.forEach((_, i) => {
      for (let k = 0; k < 4; k++) burst('spark', meterX(i), L.meterY, pick(RAINBOW));
    });
    tummy = [];
  });
  after(1.6, () => say('burp', () => after(0.2, startPresent)));
}

// ---------- present & prizes ----------

function startPresent() {
  mode = 'present';
  for (const it of tray) if (it.state !== 'gone') leaving.push({ ...it, state: 'leave', t: 0 });
  tray = [];
  present = { t: 0, open: -1, shakes: 0 };
  sfx.tada();
  say('present');
}

function presentPos() {
  return { x: W / 2, y: L.plateY - L.trayH * 0.08, size: Math.min(L.trayH * 0.95, W * 0.3) };
}

function openPresent() {
  if (!present || present.open >= 0) return;
  present.open = 0;
  sfx.shake();
  after(0.45, () => {
    const p = presentPos();
    sfx.tada();
    for (let i = 0; i < 90; i++) {
      const a = rand(-Math.PI, 0);
      const sp = rand(200, 520);
      particles.push({
        type: 'confetti', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: rand(2, 3.4), size: rand(7, 12), rot: rand(0, 6), vr: rand(-8, 8), color: pick(RAINBOW),
      });
    }
    const prize = PRIZES[prizes];
    if (prize) {
      flyingPrize = { e: prize.e, index: prizes, t: 0, x0: p.x, y0: p.y };
      say(prize.key);
    } else {
      say('prize.more');
    }
    setState('dance', 2.6);
  });
  after(3.4, () => {
    if (flyingPrize) prizes = Math.max(prizes, flyingPrize.index + 1);
    flyingPrize = null;
    present = null;
    level++;
    mode = 'play';
    const intro = `level.${Math.min(level, 5)}`;
    if (level <= 5) say(intro, () => after(0.3, newRound));
    else after(0.3, newRound);
    preloadLevel();
  });
}

// Where each prize sits, in the monster's own coordinates (multiples of R).
const PRIZE_SPOTS = [
  { x: -0.62, y: -0.8, s: 0.42, r: -0.35 },
  { x: 0, y: -1.17, s: 0.56, r: 0 },
  { x: 0.62, y: -0.8, s: 0.38, r: 0.3 },
  null,
  null,
  { x: 0, y: 0.55, s: 0.34, r: 0 },
];

function preloadLevel() {
  const cfg = levelConfig(level);
  const keys = Object.keys(LINES).filter((k) => {
    const t = k.split('.')[0];
    if (t === 'riddle') return cfg.types.includes('riddle');
    if (t === 'two') return cfg.types.includes('two');
    if (t !== 'ask') return false;
    const sub = k.split('.')[1];
    return cfg.types.includes(sub);
  });
  preload(keys);
}

// ---------- particles ----------

function burst(type, x, y, color) {
  const a = rand(0, Math.PI * 2);
  const sp = type === 'crumb' ? rand(60, 200) : rand(40, 160);
  particles.push({
    type, x, y,
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
      p.vy += 300 * dt;
      p.vx *= 1 - dt * 1.5;
      p.vy = Math.min(p.vy, 140);
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
  particles = particles.filter((p) => {
    if (p.life < p.max) return true;
    if (p.type === 'bubble') for (let i = 0; i < 4; i++) burst('spark', p.x, p.y, p.color);
    return false;
  });
  if (particles.length > 500) particles.splice(0, particles.length - 500);
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

  const mp = mouthPos();
  for (const it of tray) {
    it.t += dt;
    const sx = L.slots[it.slot];
    const sy = L.plateY;
    if (it.state === 'spawn') {
      it.x = sx;
      it.y = sy;
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
  for (const it of leaving) {
    it.t += dt;
    it.s = Math.max(0, 1 - it.t / 0.25);
  }
  leaving = leaving.filter((it) => it.t < 0.25);

  bubble.s += ((req && mode === 'play') || present ? 1 - bubble.s : -bubble.s) * Math.min(1, dt * 10);
  bubble.pop = Math.max(0, bubble.pop - dt * 3);
  if (present) {
    bubble.content = { type: 'present' };
    present.t += dt;
    if (present.open >= 0) present.open += dt;
  }
  if (flyingPrize) flyingPrize.t += dt;

  // Gentle nudges when she's been waiting a while.
  if (mode === 'play' && req && m.state === 'idle' && !drag && !voiceSrc) {
    const idle = time - lastActive;
    if (idle > 8 && !hinted) {
      showHint();
      say('hint');
    } else if (idle > 14 && time - lastSpoke > 10) {
      if (Math.random() < 0.5) say('waiting', () => after(0.2, askAgain));
      else askAgain();
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
      arm = Math.sin(k * Math.PI);
      break;
    case 'idle': {
      const near = tray.find((i) => i.state === 'drag' || i.state === 'fly');
      if (near) {
        const d = Math.hypot(near.x - mp.x, near.y - mp.y);
        tMouth = near.state === 'fly' ? 1 : clamp(1.15 - d / (R * 2.2), 0, 1);
        arm = tMouth * 0.4;
      }
      if (present) arm = 0.5 + 0.3 * Math.sin(time * 6);
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
        const col = food?.color ? COLORS[food.color] : '#e0b080';
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
            type: 'bubble', x: mp.x + rand(-R * 0.1, R * 0.1), y: mp.y,
            vx: rand(-160, 160), vy: rand(-220, -90), life: 0, max: rand(1.4, 2.4),
            size: R * rand(0.1, 0.22), rot: 0, vr: 0, color: pick(RAINBOW),
          });
        }
      } else {
        happy = 1;
      }
      break;
    case 'dance': {
      const b = m.t * Math.PI * 2.2;
      jump = Math.abs(Math.sin(b)) * R * 0.3;
      rot = Math.sin(b * 0.5) * 0.15;
      arm = 0.5 + 0.5 * Math.sin(b);
      happy = 1;
      break;
    }
  }

  // His mouth moves with his voice.
  const lvl = voiceLevel();
  m.talk += (clamp(lvl * 5, 0, 1) - m.talk) * Math.min(1, dt * 25);
  if (m.state !== 'chew' && m.state !== 'burp') tMouth = Math.max(tMouth, m.talk * 0.75);
  if (happy && m.talk < 0.05) tMouth = Math.max(tMouth, 0.4);

  m.mouth += (tMouth - m.mouth) * Math.min(1, dt * 20);
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

  let target = null;
  const moving = tray.find((i) => i.state === 'drag' || i.state === 'fly');
  if (moving) target = moving;
  else if (present) target = presentPos();
  else if (lastPointer && time - lastPointer.t < 2.5) target = lastPointer;
  let lx;
  let ly;
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
}

// ---------- drawing: world ----------

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#d9f2ff');
  sky.addColorStop(0.55, '#fff4e6');
  sky.addColorStop(1, '#fff0f3');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

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

  [0.08, 0.2, 0.33, 0.7, 0.84, 0.95].forEach((fx, i) => {
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
  if (mode === 'sleep' || mode === 'wake') return;
  const n = L.slots.length;
  const x = L.slots[0] - L.plateR * 1.5;
  const w = L.slots[n - 1] - L.slots[0] + L.plateR * 3;
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

  if (present) return;
  for (let i = 0; i < n; i++) {
    const px = L.slots[i];
    const py = L.plateY;
    ctx.fillStyle = 'rgba(150,100,120,0.15)';
    ctx.beginPath();
    ctx.ellipse(px, py + L.plateR * 0.12, L.plateR, L.plateR * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    const pg = ctx.createRadialGradient(px - L.plateR * 0.3, py - L.plateR * 0.4, L.plateR * 0.1, px, py, L.plateR);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(1, '#f4eef2');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, L.plateR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#efe3e8';
    ctx.lineWidth = L.plateR * 0.08;
    ctx.beginPath();
    ctx.arc(px, py, L.plateR * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    const it = tray.find((t) => t.slot === i);
    if (it?.hint) {
      ctx.strokeStyle = `rgba(255,200,60,${0.55 + 0.4 * Math.sin(time * 8)})`;
      ctx.lineWidth = L.plateR * 0.14;
      ctx.beginPath();
      ctx.arc(px, py, L.plateR * 1.05, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawFoods(layer) {
  const items = layer === 'tray' ? [...leaving, ...tray] : tray;
  for (const it of items) {
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
    if (top) {
      ctx.fillStyle = 'rgba(80,60,80,0.12)';
      ctx.beginPath();
      ctx.ellipse(it.x, it.y + size * 0.7, size * 0.4, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawEmoji(it.food.e, it.x, y, size, rot);
  }
}

function drawPresent() {
  if (!present) return;
  const p = presentPos();
  const appear = easeOutBack(clamp(present.t / 0.5, 0, 1));
  if (present.open < 0) {
    const bounce = Math.abs(Math.sin(present.t * 3.5)) * p.size * 0.08;
    const wob = Math.sin(present.t * 7) * 0.06;
    drawEmoji('🎁', p.x, p.y - bounce, p.size * appear, wob);
    const ring = (present.t * 1.2) % 1;
    ctx.strokeStyle = `rgba(255,210,80,${0.6 * (1 - ring)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + ring * 0.4), 0, Math.PI * 2);
    ctx.stroke();
  } else if (present.open < 0.45) {
    const sh = Math.sin(present.open * 60) * 0.25;
    drawEmoji('🎁', p.x, p.y, p.size * (1 + present.open * 0.4), sh);
  }
}

function prizeWorld(i) {
  const s = PRIZE_SPOTS[i];
  if (s) return { x: L.mx + s.x * R, y: L.my + s.y * R, size: s.s * R };
  if (i === 3) return { ...butterflyPos(), size: R * 0.34 };
  return { x: L.mx + R * 1.3, y: L.my - R * 1.25, size: R * 0.55 };
}

function butterflyPos() {
  const a = time * 0.9;
  return { x: L.mx + Math.cos(a) * R * 1.45, y: L.my - R * 0.55 + Math.sin(a * 2) * R * 0.3 };
}

function drawFlyingPrize() {
  if (!flyingPrize) return;
  const p = presentPos();
  const k = clamp((flyingPrize.t - 0.2) / 0.9, 0, 1);
  const to = prizeWorld(flyingPrize.index);
  const e = k * k * (3 - 2 * k);
  const x = lerp(p.x, to.x, e);
  const y = lerp(p.y, to.y, e) - Math.sin(k * Math.PI) * R * 0.9;
  const size = lerp(p.size * 0.7, to.size, e) * (k < 1 ? 1 + 0.15 * Math.sin(flyingPrize.t * 12) : 1);
  if (k < 1) {
    ctx.fillStyle = 'rgba(255,240,170,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEmoji(flyingPrize.e, x, y, size, k < 1 ? Math.sin(k * 12) * 0.3 : 0);
}

function drawWornPrizes(where) {
  const owned = flyingPrize ? flyingPrize.index : prizes;
  for (let i = 0; i < owned && i < PRIZES.length; i++) {
    const s = PRIZE_SPOTS[i];
    if (where === 'body' && s) {
      drawEmoji(PRIZES[i].e, s.x * R, s.y * R, s.s * R, s.r);
    } else if (where === 'world' && i === 3) {
      const b = butterflyPos();
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(0.55 + 0.45 * Math.abs(Math.sin(time * 9)), 1);
      drawEmoji(PRIZES[i].e, 0, 0, R * 0.34);
      ctx.restore();
    } else if (where === 'world' && i === 4) {
      const bx = L.mx + R * 1.3 + Math.sin(time * 1.4) * R * 0.08;
      const by = L.my - R * 1.25 + Math.sin(time * 2) * R * 0.05;
      ctx.strokeStyle = 'rgba(120,100,130,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(L.mx + R * 0.98 + m.shake, L.my + R * 0.42 - m.jump);
      ctx.quadraticCurveTo(bx + R * 0.1, by + R * 0.7, bx, by + R * 0.3);
      ctx.stroke();
      drawEmoji(PRIZES[i].e, bx, by, R * 0.55, Math.sin(time * 1.4) * 0.08);
    }
  }
}

// ---------- drawing: thought bubble ----------

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
  for (const [t, r] of [[0.25, 0.1], [0.5, 0.15]]) {
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
  ctx.shadowColor = 'transparent';
  drawClue(bubble.content, L.br);
  ctx.restore();
}

// Draws the clue picture centered at 0,0 inside a bubble of radius r.
function drawClue(c, r) {
  switch (c.type) {
    case 'present':
      return drawEmoji('🎁', 0, 0, r * 1.15);
    case 'color':
      return splat(0, 0, r * 0.6, COLORS[c.color]);
    case 'shape':
      return shapeIcon(c.shape, 0, 0, r * 0.62, '#b7aee0');
    case 'kind':
      return drawEmoji(KINDS[c.kind].icon, 0, 0, r * 1.1);
    case 'cs':
      return shapeIcon(c.shape, 0, 0, r * 0.62, COLORS[c.color]);
    case 'ck':
      splat(-r * 0.32, r * 0.05, r * 0.36, COLORS[c.color]);
      return drawEmoji(KINDS[c.kind].icon, r * 0.33, 0, r * 0.75);
    case 'riddle':
      drawEmoji(RIDDLES[c.riddle].icon, 0, -r * 0.05, r * 1.0);
      ctx.font = `700 ${r * 0.42}px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#9b7bff';
      ctx.fillText('?', r * 0.62, -r * 0.5);
      return;
    case 'two': {
      const sub = { ...c, type: c.base };
      for (const dx of [-0.42, 0.42]) {
        ctx.save();
        ctx.translate(dx * r, 0);
        ctx.scale(0.55, 0.55);
        drawClue(sub, r);
        ctx.restore();
      }
      return;
    }
  }
}

function splat(x, y, r, color) {
  const white = color === '#ffffff';
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.2);
  g.addColorStop(0, white ? '#ffffff' : mix(color, '#ffffff', 0.35));
  g.addColorStop(0.55, white ? '#f3f1f8' : color);
  g.addColorStop(1, white ? '#cfc8de' : mix(color, '#3a2050', 0.25));
  ctx.fillStyle = g;
  ctx.strokeStyle = white ? '#a99fc2' : mix(color, '#3a2050', 0.2);
  ctx.lineWidth = r * (white ? 0.1 : 0.05);
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const rr = r * (1 + 0.13 * Math.sin(a * 7 + 1) + 0.06 * Math.sin(a * 3));
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [dx, dy, dr] of [[1.25, -0.6, 0.16], [-1.2, 0.75, 0.12], [0.9, 1.05, 0.1]]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, dr * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.38, r * 0.3, r * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function shapeIcon(shape, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  if (shape === 'round') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else if (shape === 'long') {
    ctx.rotate(-0.6);
    roundRect(-r * 1.25, -r * 0.38, r * 2.5, r * 0.76, r * 0.38);
  } else {
    ctx.lineJoin = 'round';
    ctx.moveTo(0, -r * 0.95);
    ctx.lineTo(r * 1.0, r * 0.75);
    ctx.lineTo(-r * 1.0, r * 0.75);
    ctx.closePath();
  }
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.3);
  g.addColorStop(0, mix(color, '#ffffff', 0.5));
  g.addColorStop(0.5, color);
  g.addColorStop(1, mix(color, '#3a2050', 0.3));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = mix(color, '#3a2050', 0.25);
  ctx.lineWidth = r * 0.1;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function meterX(i) {
  const gap = L.meterR * 2.5;
  return W / 2 - ((TUMMY - 1) * gap) / 2 + i * gap;
}

function drawMeter() {
  if (mode === 'sleep' || mode === 'wake') return;
  const r = L.meterR;
  const gap = r * 2.5;
  const x0 = meterX(0);
  ctx.save();
  roundRect(x0 - r * 1.5, L.meterY - r * 1.3, (TUMMY - 1) * gap + r * 3, r * 2.6, r * 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fill();
  for (let i = 0; i < TUMMY; i++) {
    const x = x0 + i * gap;
    const t = tummy[i];
    if (t) {
      const k = clamp((time - t.born) / 0.4, 0, 1);
      drawEmoji(t.food.e, x, L.meterY, r * 1.7 * easeOutBack(k));
    } else {
      ctx.fillStyle = 'rgba(200,190,230,0.55)';
      ctx.beginPath();
      ctx.arc(x, L.meterY, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Level stars under the tummy meter
  const stars = Math.min(level, 10);
  const ss = r * 0.62;
  for (let i = 0; i < stars; i++) {
    drawEmoji('⭐', W / 2 + (i - (stars - 1) / 2) * ss * 1.15, L.meterY + r * 1.3 + ss * 0.75, ss);
  }
  ctx.restore();
}

// ---------- drawing: the monster ----------

function shadedEllipse(x, y, rx, ry, color, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, Math.min(rx, ry) * 0.05, 0, 0, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, mix(color, '#ffffff', 0.55));
  g.addColorStop(0.45, color);
  g.addColorStop(1, mix(color, '#2a1640', 0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMonster() {
  const full = m.full;
  const rx = R * 0.95 * (1 + 0.12 * full);
  const ry = R;

  const sg = ctx.createRadialGradient(L.mx, L.my + R * 1.06, 0, L.mx, L.my + R * 1.06, rx * 1.1);
  sg.addColorStop(0, 'rgba(60,90,60,0.32)');
  sg.addColorStop(1, 'rgba(60,90,60,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(L.mx, L.my + R * 1.06, rx * 1.1 * (1 - (m.jump / R) * 0.6), R * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(L.mx + m.shake, L.my + R - m.jump);
  ctx.rotate(m.rot);
  ctx.scale(m.sx, m.sy);
  ctx.translate(0, -R);

  drawTail(rx);

  const spikes = [-1.92, -1.75, -1.57, -1.39, -1.22];
  spikes.forEach((a, i) => drawSpike(rx, ry, a, (i === 2 ? 0.36 : 0.28) * R, 0.12 * R, RAINBOW[i]));
  drawHorn(rx, ry, -2.2, -1);
  drawHorn(rx, ry, -0.94, 1);

  // Feet behind the body so they tuck under
  for (const side of [-1, 1]) {
    const fx = side * R * 0.45;
    const fy = R * 0.95;
    shadedEllipse(fx, fy, R * 0.27, R * 0.16, bodyColorAt(0.97));
    ctx.fillStyle = '#fff7e0';
    for (let t = -1; t <= 1; t++) {
      ctx.beginPath();
      ctx.arc(fx + t * R * 0.1, fy + R * 0.09, R * 0.036, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Rainbow body
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  const band = ctx.createLinearGradient(0, -ry, 0, ry);
  RAINBOW.forEach((c, i) => band.addColorStop(i / (RAINBOW.length - 1), c));
  ctx.fillStyle = band;
  ctx.fill();
  ctx.clip();
  const shade = ctx.createRadialGradient(-rx * 0.32, -ry * 0.38, 0, -rx * 0.1, -ry * 0.1, R * 1.35);
  shade.addColorStop(0, 'rgba(255,255,255,0.55)');
  shade.addColorStop(0.3, 'rgba(255,255,255,0.15)');
  shade.addColorStop(0.62, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(40,10,70,0.42)');
  ctx.fillStyle = shade;
  ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);
  // Bounce light from the grass along the bottom edge
  const bounce = ctx.createLinearGradient(0, ry * 0.55, 0, ry);
  bounce.addColorStop(0, 'rgba(200,255,200,0)');
  bounce.addColorStop(1, 'rgba(200,255,200,0.22)');
  ctx.fillStyle = bounce;
  ctx.fillRect(-rx, ry * 0.55, rx * 2, ry * 0.5);
  ctx.restore();

  // Glossy highlight
  const hl = ctx.createRadialGradient(-rx * 0.45, -ry * 0.58, 0, -rx * 0.45, -ry * 0.58, R * 0.26);
  hl.addColorStop(0, 'rgba(255,255,255,0.85)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.ellipse(-rx * 0.45, -ry * 0.58, R * 0.26, R * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // Pearly belly that grows as he eats
  const bx = 0;
  const by = R * 0.52;
  const brx = R * 0.55 * (1 + 0.3 * full);
  const bry = R * 0.4 * (1 + 0.15 * full);
  const bg = ctx.createRadialGradient(bx - brx * 0.3, by - bry * 0.4, 0, bx, by, Math.max(brx, bry) * 1.05);
  bg.addColorStop(0, 'rgba(255,255,255,0.95)');
  bg.addColorStop(0.6, 'rgba(255,250,255,0.7)');
  bg.addColorStop(1, 'rgba(255,240,255,0.25)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(bx, by, brx, bry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * rx * 0.93, R * 0.28);
    const wave = m.arm > 0.6 ? Math.sin(time * 14 + side) * 0.25 : 0;
    ctx.rotate(-side * (0.45 + m.arm * 2.0 + wave));
    shadedEllipse(0, R * 0.2, R * 0.13, R * 0.27, bodyColorAt(0.66));
    ctx.restore();
  }

  drawCheeks();
  drawEyes();
  drawMouth();
  drawWornPrizes('body');

  ctx.restore();
}

function normalAt(rx, ry, a) {
  let nx = Math.cos(a) / rx;
  let ny = Math.sin(a) / ry;
  const nl = Math.hypot(nx, ny);
  return [nx / nl, ny / nl];
}

function drawSpike(rx, ry, a, len, w, color) {
  const [nx, ny] = normalAt(rx, ry, a);
  ctx.save();
  ctx.translate(rx * Math.cos(a) - nx * R * 0.08, ry * Math.sin(a) - ny * R * 0.08);
  ctx.rotate(Math.atan2(ny, nx) + Math.PI / 2);
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, mix(color, '#ffffff', 0.45));
  g.addColorStop(0.5, color);
  g.addColorStop(1, mix(color, '#2a1640', 0.3));
  ctx.fillStyle = g;
  ctx.strokeStyle = g;
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
  const [nx, ny] = normalAt(rx, ry, a);
  const len = R * 0.58;
  const w = R * 0.15;
  ctx.save();
  ctx.translate(rx * Math.cos(a) - nx * R * 0.04, ry * Math.sin(a) - ny * R * 0.04);
  ctx.rotate(Math.atan2(ny, nx) + Math.PI / 2 - side * 0.3);
  ctx.scale(side, 1);
  ctx.beginPath();
  ctx.moveTo(-w, R * 0.05);
  ctx.quadraticCurveTo(-w * 0.4, -len * 0.55, R * 0.17, -len);
  ctx.quadraticCurveTo(w * 1.2, -len * 0.5, w, R * 0.05);
  ctx.closePath();
  // Rainbow stripes from base to tip
  const stripes = ctx.createLinearGradient(0, R * 0.05, R * 0.1, -len);
  const cols = [...RAINBOW].reverse();
  cols.forEach((c, i) => {
    stripes.addColorStop(i / cols.length, c);
    stripes.addColorStop((i + 1) / cols.length - 0.001, c);
  });
  ctx.fillStyle = stripes;
  ctx.fill();
  const roundness = ctx.createLinearGradient(-w, 0, w, 0);
  roundness.addColorStop(0, 'rgba(255,255,255,0.5)');
  roundness.addColorStop(0.45, 'rgba(255,255,255,0)');
  roundness.addColorStop(1, 'rgba(40,10,70,0.3)');
  ctx.fillStyle = roundness;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = R * 0.02;
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
    shadedEllipse(p.x, p.y, p.r, p.r, p.c);
  }
  const tip = pts[N - 1];
  ctx.save();
  ctx.translate(tip.x + Math.cos(ang) * R * 0.08, tip.y + Math.sin(ang) * R * 0.08);
  ctx.rotate(ang + Math.PI / 2);
  const hg = ctx.createRadialGradient(-R * 0.05, -R * 0.08, 0, 0, 0, R * 0.2);
  hg.addColorStop(0, '#ffd1e3');
  hg.addColorStop(1, '#ff6fa5');
  ctx.fillStyle = hg;
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
    const bl = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.2);
    bl.addColorStop(0, 'rgba(255,120,170,0.55)');
    bl.addColorStop(1, 'rgba(255,120,170,0)');
    ctx.fillStyle = bl;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.2, R * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = R * 0.17;
    ctx.beginPath();
    ctx.arc(0, R * 0.06, R * 0.094, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.lineWidth = R * 0.03;
    for (let k = 0; k < 5; k++) {
      ctx.strokeStyle = RAINBOW[k === 4 ? 5 : k];
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
      ctx.strokeStyle = '#3a2450';
      ctx.lineWidth = R * 0.06;
      ctx.beginPath();
      if (asleep) ctx.arc(ex, ey, er * 0.6, 0.15 * Math.PI, 0.85 * Math.PI);
      else ctx.arc(ex, ey + er * 0.3, er * 0.6, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      continue;
    }
    // Socket shadow for depth
    ctx.fillStyle = 'rgba(60,20,70,0.18)';
    ctx.beginPath();
    ctx.ellipse(ex, ey + er * 0.08, er * 1.08, er * 1.08 * open, 0, 0, Math.PI * 2);
    ctx.fill();
    const sc = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.35, er * 0.1, ex, ey, er);
    sc.addColorStop(0, '#ffffff');
    sc.addColorStop(0.75, '#f6f4fb');
    sc.addColorStop(1, '#d9d3e8');
    ctx.fillStyle = sc;
    ctx.beginPath();
    ctx.ellipse(ex, ey, er, er * open, 0, 0, Math.PI * 2);
    ctx.fill();
    if (open < 0.5) continue;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, er, er, 0, 0, Math.PI * 2);
    ctx.clip();
    const px = ex + m.lookX * R * 0.08;
    const py = ey + m.lookY * R * 0.07;
    const ir = R * 0.145;
    const iris = ctx.createRadialGradient(px - ir * 0.25, py - ir * 0.3, ir * 0.1, px, py, ir);
    iris.addColorStop(0, '#c4ff8f');
    iris.addColorStop(0.45, '#4fd256');
    iris.addColorStop(1, '#1d7a33');
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(px, py, ir, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#155c26';
    ctx.lineWidth = R * 0.014;
    ctx.stroke();
    ctx.fillStyle = '#14121c';
    ctx.beginPath();
    ctx.arc(px, py, ir * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - ir * 0.38, py - ir * 0.4, ir * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + ir * 0.35, py + ir * 0.35, ir * 0.13, 0, Math.PI * 2);
    ctx.fill();
    // Upper lid shade
    const lid = ctx.createLinearGradient(0, ey - er, 0, ey - er * 0.3);
    lid.addColorStop(0, 'rgba(70,30,90,0.25)');
    lid.addColorStop(1, 'rgba(70,30,90,0)');
    ctx.fillStyle = lid;
    ctx.fillRect(ex - er, ey - er, er * 2, er * 0.7);
    ctx.restore();
  }
}

function drawMouth() {
  const o = m.mouth;
  const w = R * 0.24 * (1 + 0.25 * o);
  ctx.save();
  ctx.translate(0, R * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lip = '#5b2342';
  if (m.state === 'no' && o < 0.2) {
    ctx.strokeStyle = lip;
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = lerp(-w * 0.8, w * 0.8, i / 16);
      ctx.lineTo(x, R * 0.06 + Math.sin(i * 1.2 + time * 10) * R * 0.025);
    }
    ctx.stroke();
  } else if (o < 0.05) {
    ctx.strokeStyle = lip;
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
    const mg = ctx.createRadialGradient(0, h * 0.4, 0, 0, h * 0.4, w * 1.1);
    mg.addColorStop(0, '#2c0c22');
    mg.addColorStop(1, '#6b2a4e');
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const tg = ctx.createRadialGradient(-w * 0.15, h * 0.8, 0, 0, h * 0.95, w * 0.7);
    tg.addColorStop(0, '#ffb3c8');
    tg.addColorStop(1, '#ff6f96');
    ctx.fillStyle = tg;
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
  ctx.shadowColor = 'rgba(120,80,160,0.4)';
  ctx.shadowBlur = 16;
  const pg = ctx.createLinearGradient(bx, by - br, bx, by + br);
  RAINBOW.forEach((c, i) => pg.addColorStop(i / (RAINBOW.length - 1), c));
  ctx.fillStyle = pg;
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
  drawTray();
  drawFoods('tray');
  drawMeter();
  drawMonster();
  drawWornPrizes('world');
  drawPresent();
  drawBubble();
  drawFoods('top');
  drawFlyingPrize();
  drawParticles();
  drawTitle();
}

// ---------- input ----------

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
  preload(['wake', 'yum', 'no', 'tickle', 'tail', 'hint', 'onemore', 'burp', 'present', 'waiting']);
  preloadLevel();
  say('wake', () => {
    mode = 'play';
    after(0.2, newRound);
  });
}

function tickle(p) {
  setState('giggle', 0.9);
  say('tickle', () => after(0.4, () => req && m.state === 'idle' && askAgain()));
  for (let i = 0; i < 6; i++) burst('heart', p.x, p.y, pick(['#ff7fa8', '#ffb3d1']));
}

function wagTail() {
  m.wag = 4;
  sfx.boing();
  for (const t of tailPts) if (Math.random() < 0.5) burst('spark', t.x, t.y, pick(RAINBOW));
  if (!voiceSrc && Math.random() < 0.6) say('tail', () => after(0.4, () => req && m.state === 'idle' && askAgain()));
}

canvas.addEventListener('pointerdown', (e) => {
  const p = { x: e.clientX, y: e.clientY };
  lastPointer = { ...p, t: time };
  lastActive = time;
  audio();
  if (mode === 'sleep') return wake();
  if (mode === 'wake') return;
  if (hitTail(p)) return wagTail();
  if (mode === 'present') return openPresent();
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
  if (hitBody(p) && m.state === 'idle' && !voiceSrc) tickle(p);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const p = { x: e.clientX, y: e.clientY };
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
  if (master) master.gain.value = muted ? 0 : 0.6;
});

// ---------- loop ----------

window.addEventListener('resize', layout);
layout();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Lets a silent automated check jump around the game; never used during play.
window.__monster = {
  get state() {
    return { mode, level, req, tray, tummy, prizes, m };
  },
  mouthPos,
  setLevel: (lv) => (level = lv),
};
