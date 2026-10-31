import * as THREE from 'three';

const PALETTES = [
  ['#f25f5c', '#fdfdf8', '#ffd166', '#fdfdf8', '#2a9fd6', '#fdfdf8'],
  ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#fdfdf8', '#ff9f1c'],
  ['#ff7b54', '#fdfdf8', '#3fc1c9', '#fdfdf8', '#ffb26b', '#fdfdf8'],
];

const cache = new Map<number, THREE.MeshPhysicalMaterial>();

/** Glossy striped beach-ball material. Index picks a palette. */
export function beachBallMaterial(index: number): THREE.MeshPhysicalMaterial {
  const key = index % PALETTES.length;
  const existing = cache.get(key);
  if (existing) return existing;

  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  const colors = PALETTES[key];
  const gore = w / colors.length;
  colors.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(i * gore, 0, gore + 1, h);
  });
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 2;
  for (let i = 0; i <= colors.length; i++) {
    g.beginPath();
    g.moveTo(i * gore, 0);
    g.lineTo(i * gore, h);
    g.stroke();
  }
  g.fillStyle = '#fdfdf8';
  g.fillRect(0, 0, w, h * 0.06);
  g.fillRect(0, h * 0.94, w, h * 0.06);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const mat = new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.32,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    sheen: 0.2,
  });
  cache.set(key, mat);
  return mat;
}
