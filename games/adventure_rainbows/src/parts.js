import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { patternTexture, tiled, weaveNormal, knitNormal, twillNormal, flakeNormal, mixHex } from './textures.js';
import { CLOTH_COLORS, METALS } from './wardrobe.js';

// ---------- body proportions (sailor-local meters, feet on y = 0, facing +z) ----------
export const HEAD_Y = 1.18;
export const HEAD_R = 0.26;
export const LEG_X = 0.085;
export const ANKLE_Y = 0.075;
export const TORSO_DEPTH = 0.78;
export const SHOULDER = { x: 0.2, y: 0.865 };
export const WRIST = 0.335;

const LEG = [[0.05, 0.038], [0.1, 0.045], [0.16, 0.053], [0.22, 0.05], [0.27, 0.045], [0.3, 0.047], [0.35, 0.055], [0.41, 0.063], [0.47, 0.07]];
const ARM = [[0, 0.052], [0.07, 0.05], [0.14, 0.046], [0.2, 0.041], [0.27, 0.04], [0.34, 0.035], [0.38, 0.032]];
const TORSO = [
  [0.36, 0.0], [0.39, 0.12], [0.42, 0.175], [0.47, 0.19], [0.53, 0.178], [0.58, 0.168], [0.66, 0.17],
  [0.74, 0.178], [0.8, 0.176], [0.85, 0.163], [0.88, 0.142], [0.905, 0.11], [0.925, 0.075], [0.94, 0.05],
];

export function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      const k = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * k * k * (3 - 2 * k);
    }
  }
  return table[table.length - 1][1];
}
export const legR = (y) => interp(LEG, y);
export const armR = (d) => interp(ARM, d);
export const torsoR = (y) => interp(TORSO, y);

// ---------- meshes ----------
export function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}
export const sphere = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
export const cyl = (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

/** A round rod from a to b. */
export function rod(a, b, r, material, rEnd = r) {
  _d.subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rEnd, r, _d.length(), 10), material);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.normalize());
  return m;
}

/** A tube along a smooth path whose radius follows `radius(t)`, t = 0..1. UV v runs along it. */
export function taperedTube(points, radius, segs = 28, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [];
  const uv = [];
  const index = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      pos.push(P.x + N.x * c + B.x * s, P.y + N.y * c + B.y * s, P.z + N.z * c + B.z * s);
      uv.push(j / radial, 1 - t);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

export function tube(points, r, material, closed = false, segs = 48) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 8, closed), material);
}

/** A flat ring lying in the horizontal plane. */
export function ring(R, r, y, material, seg = 48) {
  return mesh(new THREE.TorusGeometry(R, r, 8, seg).rotateX(Math.PI / 2), material, 0, y, 0);
}

/** Revolve [radius, y] pairs (listed bottom to top). The seam sits at the back. */
export function lathe(points, { segments = 40, phiStart = Math.PI, phiLength = Math.PI * 2 } = {}) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)),
    segments,
    phiStart,
    phiLength
  );
}

/** Ruffle a lathe: radial waves that grow toward the bottom edge (uv.y = 0). */
export function wavy(geo, amp, freq, power = 1) {
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const w = Math.pow(1 - uv.getY(i), power);
    const k = 1 + amp * w * Math.sin(freq * Math.atan2(x, z));
    p.setXYZ(i, x * k, p.getY(i), z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Points along a body profile between y0 and y1. */
function profile(fn, y0, y1, inflate, { n = 14, minR = 0, flare = 0, flareTop = 0 } = {}) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const y = y0 + (y1 - y0) * t;
    pts.push([Math.max(fn(y) + inflate, minR) + flare * (1 - t) + flareTop * t, y]);
  }
  return pts;
}

const avgR = (pts) => pts.reduce((s, p) => s + p[0], 0) / pts.length;

/** Something hugging the torso, e.g. a shirt body. Returns [geometry, circumference, height]. */
export function torsoShape(y0, y1, inflate, opts = {}) {
  const pts = profile(torsoR, y0, y1, inflate, opts);
  const len = opts.phiLength ?? Math.PI * 2;
  return [lathe(pts, opts), avgR(pts) * len * 0.9, y1 - y0];
}

export function legShape(y0, y1, inflate, opts = {}) {
  const pts = profile(legR, y0, y1, inflate, opts);
  return [lathe(pts, { segments: 28 }), avgR(pts) * Math.PI * 2, y1 - y0];
}

/** Arms hang straight down from the shoulder pivot, so depth d maps to y = -d. */
export function armShape(d0, d1, inflate, { flare = 0, n = 10 } = {}) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const d = d1 + (d0 - d1) * t;
    pts.push([armR(d) + inflate + flare * (1 - t), -d]);
  }
  return [lathe(pts, { segments: 24 }), avgR(pts) * Math.PI * 2, d1 - d0];
}

/** A skirt from a list of [y, r] (top first). */
export function skirtShape(rows, { folds = 0, amp = 0, power = 1.5, segments = 64 } = {}) {
  const pts = [...rows].reverse().map(([y, r]) => [r, y]);
  const geo = lathe(pts, { segments });
  if (folds) wavy(geo, amp, folds, power);
  return [geo, avgR(pts) * Math.PI * 2, rows[0][0] - rows[rows.length - 1][0]];
}

/** Front-facing point on the (z-squashed) torso surface. */
export function onTorso(x, y, inflate, back = false) {
  const r = torsoR(y) + inflate;
  const z = Math.sqrt(Math.max(r * r - x * x, 0)) * TORSO_DEPTH;
  return new THREE.Vector3(x, y, back ? -z : z);
}

/**
 * Side-profile extrusion for shoes. `outline` is [z, height] around the shoe's side,
 * `halfWidth(z)` shapes it from above. Geometry is in foot space (ankle at the origin).
 */
export function sideExtrude(outline, halfWidth, { bevel = 0.012 } = {}) {
  const shape = new THREE.Shape(new THREE.SplineCurve(outline.map(([z, y]) => new THREE.Vector2(z, y))).getPoints(64));
  const depth = 0.04;
  let geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: bevel, bevelSegments: 4, curveSegments: 24 });
  geo.rotateY(-Math.PI / 2);
  geo.translate(depth / 2, bevel - ANKLE_Y, 0);
  const p = geo.attributes.position;
  const half = depth / 2 + 0.03;
  for (let i = 0; i < p.count; i++) p.setX(i, (p.getX(i) / half) * halfWidth(p.getZ(i)));
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-5);
  geo.computeVertexNormals();
  return geo;
}

/** Top-view outline extruded upward (for flat soles). */
export function soleExtrude(halfWidth, z0, z1, thick, lift = 0) {
  const n = 24;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    pts.push(new THREE.Vector2(halfWidth(z), -z));
  }
  for (let i = n; i >= 0; i--) {
    const z = z0 + ((z1 - z0) * i) / n;
    pts.push(new THREE.Vector2(-halfWidth(z), -z));
  }
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(new THREE.SplineCurve(pts).getPoints(80)), {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, lift - ANKLE_Y, 0);
  return geo;
}

export function heartShape(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.45 * s);
  sh.bezierCurveTo(-0.6 * s, -0.05 * s, -0.5 * s, 0.5 * s, 0, 0.18 * s);
  sh.bezierCurveTo(0.5 * s, 0.5 * s, 0.6 * s, -0.05 * s, 0, -0.45 * s);
  return sh;
}
export function starShape(r, inner = 0.45) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return sh;
}
export const puffy = (shape, depth, bevel = depth * 0.6) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3 }).center();

// ---------- materials ----------
const TILE = 0.11;
export const phys = (o) => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o });

export function skinMat(hex) {
  return phys({ color: hex, roughness: 0.55, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(mixHex(hex, '#ff9b8a', 0.5)) });
}

const KINDS = {
  cotton: { roughness: 0.85, sheen: 0.6, sheenRoughness: 0.6, normal: weaveNormal, normalTile: 10, normalScale: 0.5 },
  knit: { roughness: 0.95, sheen: 0.8, sheenRoughness: 0.5, normal: knitNormal, normalTile: 5, normalScale: 0.9 },
  fleece: { roughness: 0.95, sheen: 1, sheenRoughness: 0.4, normal: knitNormal, normalTile: 14, normalScale: 0.35 },
  satin: { roughness: 0.32, sheen: 1, sheenRoughness: 0.25 },
  tulle: { roughness: 0.6, sheen: 0.6, sheenRoughness: 0.4, transparent: true, opacity: 0.6, depthWrite: false },
  leather: { roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 },
  patent: { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 },
  rubber: { roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.1 },
};

/**
 * Cloth for one garment piece. `spec` is a saved {color, pattern}; `u`/`v` are the piece's
 * size in meters so patterns come out the same size on sleeves and skirts.
 */
export function fabric(spec, kind = 'cotton', u = 1, v = 1) {
  const hex = typeof spec.color === 'number' ? CLOTH_COLORS[spec.color] : spec.color;
  const pattern = spec.pattern || 'solid';
  const k = KINDS[kind];
  const ru = Math.max(1, Math.round(u / TILE));
  const rv = Math.max(0.5, v / TILE);
  const o = { roughness: k.roughness, transparent: !!k.transparent, opacity: k.opacity ?? 1 };
  if (k.depthWrite === false) o.depthWrite = false;
  if (k.sheen) Object.assign(o, { sheen: k.sheen, sheenRoughness: k.sheenRoughness, sheenColor: new THREE.Color(mixHex(hex, '#ffffff', 0.3)) });
  if (k.clearcoat) Object.assign(o, { clearcoat: k.clearcoat, clearcoatRoughness: k.clearcoatRoughness });
  let normal = k.normal;
  let nTile = k.normalTile;
  let nScale = k.normalScale;
  if (pattern === 'solid') o.color = hex;
  else o.map = tiled(patternTexture(pattern, hex), ru, rv);
  if (pattern === 'denim') {
    normal = twillNormal;
    nTile = 4;
    nScale = 0.6;
    o.roughness = 0.9;
  }
  if (pattern === 'sparkle') {
    Object.assign(o, { metalness: 0.55, roughness: 0.3, iridescence: 0.7, iridescenceIOR: 1.5, sheen: 0 });
    normal = flakeNormal;
    nTile = 3;
    nScale = 1;
  }
  if (normal) {
    o.normalMap = tiled(normal(), ru * nTile, rv * nTile);
    o.normalScale = new THREE.Vector2(nScale, nScale);
  }
  return phys(o);
}

/** Make materials per piece size, reusing one when sizes match. */
export function garment(spec, kind) {
  const made = new Map();
  return (u = 1, v = 1) => {
    const key = `${Math.round(u / TILE)}|${(v / TILE).toFixed(1)}`;
    if (!made.has(key)) made.set(key, fabric(spec, kind, u, v));
    return made.get(key);
  };
}

export const metalMat = (i) => phys({ color: METALS[i].color, metalness: 1, roughness: 0.22, envMapIntensity: 1.6 });
export const gemMat = (color = '#e8f6ff') =>
  phys({ color, metalness: 0.2, roughness: 0.02, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.8, envMapIntensity: 2.5, emissive: color, emissiveIntensity: 0.12 });
export const pearlMat = () => phys({ color: '#fbf4ec', roughness: 0.22, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.4, sheen: 0.5, sheenColor: new THREE.Color('#ffd9f0') });
export const glossMat = (color, roughness = 0.25) => phys({ color, roughness, clearcoat: 1, clearcoatRoughness: 0.08 });
export const plainMat = (color, roughness = 0.7) => phys({ color, roughness });
