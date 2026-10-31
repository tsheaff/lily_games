import * as THREE from 'three';
import { mulberry32, SPECTRUM_HEX } from './utils.js';

// All textures are painted on canvases at runtime, so the game still ships without image files.

const cache = new Map();
function memo(key, make) {
  let v = cache.get(key);
  if (v === undefined) cache.set(key, (v = make()));
  return v;
}

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** The same image tiled differently. Clones share one GPU upload. */
export function tiled(tex, u, v = u) {
  return memo(`${tex.uuid}|${u.toFixed(2)}|${v.toFixed(2)}`, () => {
    const t = tex.clone();
    t.repeat.set(u, v);
    t.needsUpdate = true;
    return t;
  });
}

// ---------- color helpers (sRGB hex, for canvas painting) ----------
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const toHex = (a) => '#' + a.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('');
export const mixHex = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return toHex(A.map((x, i) => x + (B[i] - x) * t));
};
export const luma = (hex) => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// ---------- little drawing helpers ----------
function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + 0.45 * s);
  ctx.bezierCurveTo(x - 0.6 * s, y + 0.05 * s, x - 0.5 * s, y - 0.5 * s, x, y - 0.18 * s);
  ctx.bezierCurveTo(x + 0.5 * s, y - 0.5 * s, x + 0.6 * s, y + 0.05 * s, x, y + 0.45 * s);
  ctx.closePath();
}
function starPath(ctx, x, y, r, inner = 0.45, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
// Draws at every wrapped copy so motifs that cross an edge tile seamlessly.
function wrapped(S, x, y, fn) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(x + dx, y + dy);
}

// ---------- fabric patterns ----------
export function drawPattern(ctx, S, id, base) {
  const accent = luma(base) > 0.72 ? '#ff5fa2' : '#ffffff';
  const rand = mulberry32(id.length * 977 + S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  const grid = [
    [0.25, 0.25],
    [0.75, 0.75],
  ];
  switch (id) {
    case 'stripes':
      ctx.fillStyle = accent;
      for (let i = 0; i < 2; i++) ctx.fillRect(0, (i * S) / 2, S, S / 6);
      break;
    case 'dots':
      ctx.fillStyle = accent;
      for (const [u, v] of grid)
        wrapped(S, u * S, v * S, (x, y) => {
          ctx.beginPath();
          ctx.arc(x, y, S * 0.1, 0, Math.PI * 2);
          ctx.fill();
        });
      break;
    case 'hearts':
      ctx.fillStyle = luma(base) > 0.72 ? '#ff3b6b' : accent;
      for (const [u, v] of grid) wrapped(S, u * S, v * S, (x, y) => (heartPath(ctx, x, y, S * 0.26), ctx.fill()));
      break;
    case 'stars':
      ctx.fillStyle = luma(base) > 0.6 ? '#ff9f1c' : '#ffe14d';
      for (const [u, v] of grid) wrapped(S, u * S, v * S, (x, y) => (starPath(ctx, x, y, S * 0.14), ctx.fill()));
      break;
    case 'flowers':
      for (const [u, v] of grid)
        wrapped(S, u * S, v * S, (x, y) => {
          ctx.fillStyle = accent;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * S * 0.07, y + Math.sin(a) * S * 0.07, S * 0.055, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath();
          ctx.arc(x, y, S * 0.04, 0, Math.PI * 2);
          ctx.fill();
        });
      break;
    case 'gingham':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = base;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 2; i++) {
        ctx.fillRect((i * S) / 2, 0, S / 4, S);
        ctx.fillRect(0, (i * S) / 2, S, S / 4);
      }
      ctx.globalAlpha = 1;
      break;
    case 'plaid': {
      const dark = mixHex(base, '#000000', 0.4);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = dark;
      ctx.fillRect(S * 0.1, 0, S * 0.3, S);
      ctx.fillRect(0, S * 0.1, S, S * 0.3);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = luma(base) > 0.6 ? '#e63946' : '#ffd23f';
      ctx.fillRect(S * 0.7, 0, S * 0.03, S);
      ctx.fillRect(0, S * 0.7, S, S * 0.03);
      ctx.globalAlpha = 1;
      break;
    }
    case 'rainbow':
      SPECTRUM_HEX.forEach((c, i) => {
        ctx.fillStyle = mixHex(c, '#ffffff', 0.15);
        ctx.fillRect(0, (i * S) / 7, S, S / 7 + 1);
      });
      break;
    case 'leopard': {
      ctx.fillStyle = mixHex(base, '#f0c27a', 0.35);
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 9; i++) {
        const cx = rand() * S;
        const cy = rand() * S;
        const r = S * (0.05 + rand() * 0.04);
        wrapped(S, cx, cy, (x, y) => {
          ctx.fillStyle = mixHex(base, '#6b3a12', 0.45);
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.8, rand() * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2b1a0e';
          ctx.lineWidth = S * 0.025;
          ctx.beginPath();
          ctx.arc(x, y, r * 1.15, 0.3, 2.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, r * 1.15, 3.3, 5.3);
          ctx.stroke();
        });
      }
      break;
    }
    case 'sparkle':
      for (let i = 0; i < S * 2.5; i++) {
        const b = rand();
        ctx.fillStyle = b > 0.6 ? '#ffffff' : b > 0.3 ? mixHex(base, '#ffffff', 0.5) : mixHex(base, '#000000', 0.25);
        ctx.globalAlpha = 0.5 + rand() * 0.5;
        const r = S * (0.006 + rand() * 0.012);
        ctx.fillRect(rand() * S, rand() * S, r, r);
      }
      ctx.globalAlpha = 1;
      break;
    case 'denim': {
      ctx.fillStyle = mixHex(base, '#000000', 0.15);
      ctx.fillRect(0, 0, S, S);
      ctx.lineWidth = S / 64;
      for (let i = -S; i < S * 2; i += S / 16) {
        ctx.strokeStyle = mixHex(base, '#ffffff', 0.25 + rand() * 0.15);
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + S, S);
        ctx.stroke();
      }
      for (let i = 0; i < S * 3; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
        ctx.globalAlpha = rand() * 0.12;
        ctx.fillRect(rand() * S, rand() * S, S / 40, S / 120);
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

export function patternTexture(id, color) {
  return memo(`pattern|${id}|${color}`, () => {
    const c = makeCanvas(256);
    drawPattern(c.getContext('2d'), 256, id, color);
    return toTexture(c);
  });
}

/** A small preview image for the picker buttons. */
export function patternSwatch(id, color) {
  return memo(`swatch|${id}|${color}`, () => {
    const c = makeCanvas(96);
    const ctx = c.getContext('2d');
    ctx.scale(96 / 64, 96 / 64);
    drawPattern(ctx, 64, id, color);
    return c.toDataURL();
  });
}

// ---------- normal maps ----------
function normalMap(S, height, strength) {
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = height(x, y);
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      img.data[i] = (-dx / l) * 127 + 128;
      img.data[i + 1] = (-dy / l) * 127 + 128;
      img.data[i + 2] = (1 / l) * 127 + 128;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, false);
}

/** Over-under cotton weave. */
export const weaveNormal = () =>
  memo('n|weave', () =>
    normalMap(64, (x, y) => {
      const p = 8;
      const fx = (x % p) / p;
      const fy = (y % p) / p;
      return ((Math.floor(x / p) + Math.floor(y / p)) % 2 ? Math.sin(Math.PI * fx) : Math.sin(Math.PI * fy)) * 0.6;
    }, 2.5)
  );

/** Rows of little knitted Vs. */
export const knitNormal = () =>
  memo('n|knit', () =>
    normalMap(64, (x, y) => {
      const fx = (x % 16) / 16;
      const fy = (y % 12) / 12;
      const tent = fx < 0.5 ? fx * 2 : (1 - fx) * 2;
      const v = (tent * 0.5 + fy) % 1;
      return Math.sin(Math.PI * v) * (0.4 + 0.6 * Math.sin(Math.PI * tent));
    }, 3)
  );

/** Diagonal denim twill. */
export const twillNormal = () =>
  memo('n|twill', () =>
    normalMap(64, (x, y) => Math.sin(((x + y) / 8) * Math.PI * 2) * 0.5 + Math.sin((x / 64) * Math.PI * 2 * 3) * 0.1, 2)
  );

/** Tiny tilted flakes that catch the light one by one. */
export const flakeNormal = () =>
  memo('n|flake', () => {
    const S = 128;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(7);
    for (let y = 0; y < S; y += 4)
      for (let x = 0; x < S; x += 4) {
        const nx = (rand() - 0.5) * 1.4;
        const ny = (rand() - 0.5) * 1.4;
        const l = Math.hypot(nx, ny, 1);
        ctx.fillStyle = `rgb(${(nx / l) * 127 + 128},${(ny / l) * 127 + 128},${(1 / l) * 127 + 128})`;
        ctx.fillRect(x, y, 4, 4);
      }
    return toTexture(c, false);
  });

// ---------- hair ----------
function strandValues(S, seed) {
  const rand = mulberry32(seed);
  const raw = Array.from({ length: S }, () => rand());
  return raw.map((_, i) => (raw[i] * 0.5 + raw[(i + 1) % S] * 0.3 + raw[(i + S - 1) % S] * 0.2));
}

/** Light streaks running along the hair (texture v). Multiplied by the hair color. */
export function hairTexture(rainbow = false) {
  return memo(`hair|${rainbow}`, () => {
    const S = 256;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const vals = strandValues(S, 11);
    if (rainbow) {
      SPECTRUM_HEX.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(0, (i * S) / 7, S, S / 7 + 1);
      });
      ctx.globalCompositeOperation = 'multiply';
    }
    for (let x = 0; x < S; x++) {
      const b = Math.round(150 + vals[x] * 105);
      ctx.fillStyle = `rgb(${b},${b},${b})`;
      ctx.fillRect(x, 0, 1, S);
    }
    ctx.globalCompositeOperation = 'source-over';
    return toTexture(c);
  });
}

export const hairNormal = () =>
  memo('n|hair', () => {
    const vals = strandValues(256, 11);
    return normalMap(256, (x) => vals[x], 4);
  });

// ---------- face ----------
export function irisTexture(color) {
  return memo(`iris|${color}`, () => {
    const S = 128;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const m = S / 2;
    const g = ctx.createRadialGradient(m, m, S * 0.12, m, m, m);
    g.addColorStop(0, mixHex(color, '#000000', 0.45));
    g.addColorStop(0.35, mixHex(color, '#ffffff', 0.12));
    g.addColorStop(0.8, color);
    g.addColorStop(0.93, mixHex(color, '#000000', 0.6));
    g.addColorStop(1, '#1a1010');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const rand = mulberry32(3);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2;
      ctx.strokeStyle = rand() > 0.5 ? mixHex(color, '#ffffff', 0.4) : mixHex(color, '#000000', 0.35);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(m + Math.cos(a) * S * 0.16, m + Math.sin(a) * S * 0.16);
      ctx.lineTo(m + Math.cos(a + 0.1) * S * 0.44, m + Math.sin(a + 0.1) * S * 0.44);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#080506';
    ctx.beginPath();
    ctx.arc(m, m, S * 0.17, 0, Math.PI * 2);
    ctx.fill();
    return toTexture(c);
  });
}

/** White center fading to clear, tinted by the material color. Used for blush and soft glows. */
export const softDot = () =>
  memo('softdot', () => {
    const c = makeCanvas(64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

/** An emoji painted onto a transparent canvas: face paint, hat badges. */
export function emojiTexture(emoji, size = 128) {
  return memo(`emoji|${emoji}|${size}`, () => {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d');
    ctx.font = `${Math.round(size * 0.78)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size * 0.55);
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

export const frecklesTexture = () =>
  memo('freckles', () => {
    const c = makeCanvas(128);
    const ctx = c.getContext('2d');
    const rand = mulberry32(21);
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 50;
      ctx.fillStyle = `rgba(120,64,30,${0.35 + rand() * 0.35})`;
      ctx.beginPath();
      ctx.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r * 0.7, 2 + rand() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

/** Navy sailor collar with two white trim lines along the edges. */
export const sailorCollarTexture = () =>
  memo('collar', () => {
    const W = 256;
    const H = 128;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#22336b';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    for (const inset of [14, 26]) {
      ctx.beginPath();
      ctx.moveTo(inset, 0);
      ctx.lineTo(inset, H - inset);
      ctx.lineTo(W - inset, H - inset);
      ctx.lineTo(W - inset, 0);
      ctx.stroke();
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

/** Woven straw for the sun hat. */
export const strawTexture = () =>
  memo('straw', () => {
    const S = 128;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e9c77f';
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8)
      for (let x = 0; x < S; x += 8) {
        const over = ((x + y) / 8) % 2;
        const g = ctx.createLinearGradient(x, y, over ? x + 8 : x, over ? y : y + 8);
        g.addColorStop(0, '#c99a4b');
        g.addColorStop(0.5, '#f6dc9c');
        g.addColorStop(1, '#c99a4b');
        ctx.fillStyle = g;
        ctx.fillRect(x + 0.5, y + 0.5, 7, 7);
      }
    return toTexture(c);
  });

// ---------- dressing room ----------
export const woodTexture = () =>
  memo('wood', () => {
    const S = 512;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(5);
    const rows = 8;
    const h = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rand() * S * 0.5;
      while (x < S) {
        const len = S * (0.45 + rand() * 0.5);
        const tone = mixHex('#c98d5a', rand() > 0.5 ? '#e7b886' : '#9c6337', rand() * 0.6);
        ctx.fillStyle = tone;
        ctx.fillRect(x, r * h, len, h);
        for (let i = 0; i < 14; i++) {
          ctx.strokeStyle = mixHex(tone, '#5b3417', 0.2 + rand() * 0.3);
          ctx.globalAlpha = 0.25 + rand() * 0.3;
          ctx.lineWidth = 0.6 + rand() * 1.4;
          const yy = r * h + rand() * h;
          ctx.beginPath();
          ctx.moveTo(x, yy);
          for (let k = 1; k <= 8; k++) ctx.lineTo(x + (len * k) / 8, yy + Math.sin(k * 1.3 + i) * 2.2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#4a2a14';
        ctx.fillRect(x, r * h, 2, h);
        x += len;
      }
      ctx.fillStyle = '#4a2a14';
      ctx.fillRect(0, r * h, S, 2);
    }
    return toTexture(c);
  });

export const wallpaperTexture = () =>
  memo('wallpaper', () => {
    const S = 256;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffd6e7';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#ffe6f0';
    ctx.fillRect(0, 0, S / 2, S);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(S / 2 - 3, 0, 6, S);
    ctx.fillRect(S - 3, 0, 6, S);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f7a8c8';
    for (const [x, y] of [
      [0.25, 0.25],
      [0.75, 0.75],
    ]) {
      heartPath(ctx, x * S, y * S, S * 0.12);
      ctx.fill();
    }
    ctx.fillStyle = '#f2c14e';
    for (const [x, y] of [
      [0.25, 0.75],
      [0.75, 0.25],
    ]) {
      starPath(ctx, x * S, y * S, S * 0.04);
      ctx.fill();
    }
    return toTexture(c);
  });

export const portholeTexture = () =>
  memo('porthole', () => {
    const S = 256;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, S * 0.6);
    sky.addColorStop(0, '#7cc8ff');
    sky.addColorStop(1, '#ffd9f0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, S, S * 0.6);
    const sea = ctx.createLinearGradient(0, S * 0.6, 0, S);
    sea.addColorStop(0, '#3fb5d8');
    sea.addColorStop(1, '#1d6fa8');
    ctx.fillStyle = sea;
    ctx.fillRect(0, S * 0.6, S, S * 0.4);
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath();
    ctx.arc(S * 0.7, S * 0.32, S * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${S * 0.22}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🏝️', S * 0.3, S * 0.64);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(S * 0.1 + i * 40, S * (0.7 + (i % 3) * 0.08));
      ctx.lineTo(S * 0.2 + i * 40, S * (0.7 + (i % 3) * 0.08));
      ctx.stroke();
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
