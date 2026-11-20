// Plant interaction: live "pushers" (truck nose, truck body, player) that bend corn and grass
// aside, plus a trample map the truck paints so crushed plants stay down and slowly recover.
import * as THREE from 'three';
import { world } from '../assets/materialPatch.js';

export function createTrample({ size = 512, extent = 200 } = {}) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { data[i * 4] = 128; data[i * 4 + 1] = 128; data[i * 4 + 2] = 0; data[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  world.uTrample.value = tex; world.uTrampleExtent.value = extent;
  const px = (2 * extent) / size; // metres per pixel
  let dirty = false, decayT = 0, any = false;

  /** paint an oriented rectangle (centre, forward unit vec2, half length/width) as flattened */
  function stamp(cx, cz, fx, fz, halfL, halfW, amount = 1) {
    const r = Math.hypot(halfL, halfW);
    const i0 = Math.max(0, Math.floor((cx - r + extent) / px)), i1 = Math.min(size - 1, Math.ceil((cx + r + extent) / px));
    const j0 = Math.max(0, Math.floor((cz - r + extent) / px)), j1 = Math.min(size - 1, Math.ceil((cz + r + extent) / px));
    const sx = -fz, sz = fx;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -extent + (i + 0.5) * px - cx, z = -extent + (j + 0.5) * px - cz;
      const l = x * fx + z * fz, w = x * sx + z * sz;
      if (Math.abs(l) > halfL || Math.abs(w) > halfW) continue;
      const k = (j * size + i) * 4;
      const a = Math.round(255 * amount * (1 - Math.max(0, Math.abs(w) / halfW - 0.75) * 2));
      if (a <= data[k + 2]) continue;
      // fall forward along the direction of travel, and outward from the centreline
      const side = w >= 0 ? 1 : -1;
      let dx = fx * 0.85 + sx * side * 0.55, dz = fz * 0.85 + sz * side * 0.55; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
      data[k] = Math.round((dx * 0.5 + 0.5) * 255); data[k + 1] = Math.round((dz * 0.5 + 0.5) * 255); data[k + 2] = a;
      dirty = true; any = true;
    }
  }

  function setPusher(i, pos, radius, dir = null, strength = 1) {
    const P = world.uPush.value[i], D = world.uPushDir.value[i];
    if (!pos || radius <= 0) { P.w = 0; return; }
    P.set(pos.x, pos.y, pos.z, radius);
    D.set(dir ? dir.x : 0, dir ? dir.z : 0, strength, 0);
  }

  return {
    stamp, setPusher,
    update(dt) {
      // recover: ~60 s for flattened plants to stand back up
      decayT += dt;
      if (any && decayT > 0.5) {
        const f = Math.pow(0.5, decayT / 22); decayT = 0; let left = false;
        for (let k = 2; k < data.length; k += 4) if (data[k]) { const v = Math.floor(data[k] * f); data[k] = v; if (v) left = true; }
        any = left; dirty = true;
      }
      if (dirty) { tex.needsUpdate = true; dirty = false; }
    },
  };
}
