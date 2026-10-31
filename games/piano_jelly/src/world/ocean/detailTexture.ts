import * as THREE from 'three';

/**
 * Tileable slope map for small capillary waves: RG = d(height)/du, d(height)/dv
 * remapped to 0..1, B = height. Built from sinusoids with integer frequencies
 * so it repeats seamlessly.
 */
export function createDetailTexture(size = 256, count = 72, seed = 7): THREE.DataTexture {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  const waves = Array.from({ length: count }, () => {
    const angle = rand() * Math.PI * 2;
    const freq = 2 + Math.floor(rand() * rand() * 22);
    const kx = Math.round(Math.cos(angle) * freq);
    const ky = Math.round(Math.sin(angle) * freq);
    const mag = Math.max(1, Math.hypot(kx, ky));
    return { kx, ky, amp: 1 / Math.pow(mag, 1.5), phase: rand() * Math.PI * 2 };
  });

  const du = new Float32Array(size * size);
  const dv = new Float32Array(size * size);
  const h = new Float32Array(size * size);
  let maxSlope = 0;
  let maxH = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let sx = 0;
      let sy = 0;
      let hh = 0;
      for (const w of waves) {
        const ph = 2 * Math.PI * (w.kx * u + w.ky * v) + w.phase;
        const c = Math.cos(ph) * w.amp * 2 * Math.PI;
        sx += c * w.kx;
        sy += c * w.ky;
        hh += Math.sin(ph) * w.amp;
      }
      const i = y * size + x;
      du[i] = sx;
      dv[i] = sy;
      h[i] = hh;
      maxSlope = Math.max(maxSlope, Math.abs(sx), Math.abs(sy));
      maxH = Math.max(maxH, Math.abs(hh));
    }
  }

  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.round((du[i] / maxSlope) * 127.5 + 127.5);
    data[i * 4 + 1] = Math.round((dv[i] / maxSlope) * 127.5 + 127.5);
    data[i * 4 + 2] = Math.round((h[i] / maxH) * 127.5 + 127.5);
    data[i * 4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
