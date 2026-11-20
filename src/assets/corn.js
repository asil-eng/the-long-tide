// Procedural late-season, drought-dry corn: one merged plant geometry with vertex colors,
// drawn as an InstancedMesh with per-instance scale/rotation/tint and a wind vertex shader.
import * as THREE from 'three';
import { patchMaterial, windDepthMaterial } from './materialPatch.js';

const C = (h) => new THREE.Color(h);
const PAL = {
  stalkLow: C('#7d6a3c'), stalkHigh: C('#c8b27a'),
  leafA: C('#ddca92'), leafB: C('#a99a55'), leafC: C('#c39f62'), leafD: C('#8f8a4e'), tipDry: C('#9c7a50'),
  husk: C('#d6c08e'), tassel: C('#c9a463'),
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function buildPlant(detail = 1, seed = 7) {
  const r = rng(seed);
  const pos = [], col = [], idx = [];
  const H = 2.45;
  const push = (p, c) => { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };

  // stalk: tapered n-gon tube
  const sides = detail > 0.5 ? 5 : 3, segs = detail > 0.5 ? 6 : 3;
  const ring0 = pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = t * H * 0.94, rad = THREE.MathUtils.lerp(0.024, 0.007, t);
    const c = PAL.stalkLow.clone().lerp(PAL.stalkHigh, Math.min(1, t * 1.4));
    const lean = t * t * 0.06;
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      push(new THREE.Vector3(Math.cos(a) * rad + lean, y, Math.sin(a) * rad), c);
    }
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < sides; k++) {
    const a = ring0 + i * sides + k, b = ring0 + i * sides + ((k + 1) % sides);
    idx.push(a, b, a + sides, b, b + sides, a + sides);
  }

  // leaves: long arching ribbons, alternating sides, drooping and curling when dry
  const nLeaves = detail > 0.5 ? 10 : 4, lsegs = detail > 0.5 ? 8 : 3;
  for (let l = 0; l < nLeaves; l++) {
    const t0 = 0.12 + (l / nLeaves) * 0.72 + r() * 0.03;
    const y0 = t0 * H;
    const ang = (l % 2 ? Math.PI : 0) + (r() - 0.5) * 1.1 + l * 0.35;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const L = THREE.MathUtils.lerp(0.95, 0.55, l / nLeaves) * (0.85 + r() * 0.3);
    const W = 0.052 * (0.8 + r() * 0.45);
    const rise = 0.35 + r() * 0.25, droop = 0.55 + r() * 0.45;
    const base = [PAL.leafA, PAL.leafB, PAL.leafC, PAL.leafD, PAL.leafA][Math.floor(r() * 5)];
    const start = pos.length / 3;
    for (let i = 0; i <= lsegs; i++) {
      const t = i / lsegs;
      const out = dir.clone().multiplyScalar(t * L * 0.85);
      const up = (Math.sin(t * Math.PI * 0.6) * rise - t * t * droop) * L;
      const center = new THREE.Vector3(0, y0 + up, 0).add(out);
      const w = Math.sin(Math.min(1, t * 1.15) * Math.PI) * W * (1 - t * 0.5) + 0.006;
      const curl = t * 0.7; // edges curl up as the leaf dries
      const c = base.clone().lerp(PAL.tipDry, t * t * 0.8);
      push(center.clone().addScaledVector(side, w).add(new THREE.Vector3(0, w * curl, 0)), c);
      push(center.clone().addScaledVector(side, -w).add(new THREE.Vector3(0, w * curl, 0)), c.clone().multiplyScalar(0.9));
    }
    for (let i = 0; i < lsegs; i++) {
      const a = start + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  if (detail > 0.5) {
    // ear in husk, angled off the stalk
    const ey = H * 0.45, eang = r() * Math.PI * 2;
    const edir = new THREE.Vector3(Math.cos(eang) * 0.45, 0.9, Math.sin(eang) * 0.45).normalize();
    const eside = new THREE.Vector3().crossVectors(edir, new THREE.Vector3(0, 0, 1)).normalize();
    const eside2 = new THREE.Vector3().crossVectors(edir, eside).normalize();
    const es = pos.length / 3, esegs = 4, esides = 4;
    for (let i = 0; i <= esegs; i++) {
      const t = i / esegs, rad = Math.sin(Math.min(1, t * 1.3 + 0.1) * Math.PI) * 0.032 + 0.004;
      const ctr = new THREE.Vector3(0.02, ey, 0).addScaledVector(edir, t * 0.24);
      for (let k = 0; k < esides; k++) {
        const a = (k / esides) * Math.PI * 2;
        push(ctr.clone().addScaledVector(eside, Math.cos(a) * rad).addScaledVector(eside2, Math.sin(a) * rad), PAL.husk.clone().lerp(PAL.tipDry, t * 0.6));
      }
    }
    for (let i = 0; i < esegs; i++) for (let k = 0; k < esides; k++) {
      const a = es + i * esides + k, b = es + i * esides + ((k + 1) % esides);
      idx.push(a, b, a + esides, b, b + esides, a + esides);
    }
    // tassel: a few thin drooping strands at the top
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2 + r();
      const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const st = pos.length / 3;
      for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        const p = new THREE.Vector3(0.06, H * 0.94 + t * 0.28 - t * t * 0.12, 0).addScaledVector(d, t * 0.16);
        const sd = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(0.008);
        push(p.clone().add(sd), PAL.tassel); push(p.clone().sub(sd), PAL.tassel);
      }
      for (let i = 0; i < 3; i++) { const q = st + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Create a corn field.
 * @param {object} o  { rects: [{x0,x1,z0,z1}], rowSpacing, plantSpacing, rowAxis:'z'|'x', detail, seed, exclude(x,z)->bool }
 */
export function createCornField(o) {
  const { rects, rowSpacing = 0.76, plantSpacing = 0.3, detail = 1, seed = 11, exclude, heightScale = 1 } = o;
  const r = rng(seed);
  const mats = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const tint = new THREE.Color();
  const colors = [];
  for (const R of rects) {
    for (let x = R.x0; x <= R.x1; x += rowSpacing) {
      for (let z = R.z0; z <= R.z1; z += plantSpacing * (0.8 + r() * 0.4)) {
        if (r() < 0.035) continue; // gaps: failed plants
        const px = x + (r() - 0.5) * 0.12, pz = z + (r() - 0.5) * 0.08;
        if (exclude && exclude(px, pz)) continue;
        const sc = (0.78 + r() * 0.36) * heightScale;
        p.set(px, 0, pz);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
        // a slight random lean
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (r() - 0.5) * 0.12));
        s.set(sc * (0.9 + r() * 0.2), sc, sc * (0.9 + r() * 0.2));
        m.compose(p, q, s);
        mats.push(m.clone());
        const v = r(), k = r();
        if (k < 0.18) tint.setRGB(0.86, 0.9, 0.72);        // still a little green
        else if (k < 0.36) tint.setRGB(0.95, 0.82, 0.68);  // browner, drier
        else tint.setRGB(0.92 + v * 0.14, 0.88 + v * 0.12, 0.78 + r() * 0.14);
        colors.push(tint.r, tint.g, tint.b);
      }
    }
  }
  const geo = buildPlant(detail, seed + 1);
  const mat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide }),
    { wind: true, windHeight: 2.4, dustTop: 0.35, dustLow: 0.45, dirtHeight: 0.6, fade: 0.12, translucency: 0.7 });
  const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((mm, i) => mesh.setMatrixAt(i, mm));
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.customDepthMaterial = windDepthMaterial(2.4);
  mesh.frustumCulled = false;
  mesh.userData.count = mats.length;
  mesh.userData.tris = geo.index.count / 3;
  return mesh;
}
