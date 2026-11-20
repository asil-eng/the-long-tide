// Dry prairie grass and weed clumps: instanced, wind-animated, scattered by a density function.
import * as THREE from 'three';
import { patchMaterial, windDepthMaterial } from './materialPatch.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function buildClump(seed = 3) {
  const r = rng(seed);
  const pos = [], col = [], idx = [];
  const cols = ['#c9ad78', '#b39a62', '#a48a58', '#d4bf8e', '#9a8a5a'].map((c) => new THREE.Color(c));
  const blades = 11;
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, lean = 0.25 + r() * 0.55;
    const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-d.z, 0, d.x);
    const h = 0.35 + r() * 0.45, w = 0.012 + r() * 0.01;
    const base = d.clone().multiplyScalar(r() * 0.08);
    const c0 = cols[Math.floor(r() * cols.length)];
    const st = pos.length / 3, segs = 4;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = base.clone().addScaledVector(d, t * t * lean * h).add(new THREE.Vector3(0, t * h * (1 - t * lean * 0.35), 0));
      const ww = w * (1 - t * 0.9);
      const c = c0.clone().multiplyScalar(0.7 + t * 0.4);
      pos.push(...p.clone().addScaledVector(side, ww).toArray(), ...p.clone().addScaledVector(side, -ww).toArray());
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let i = 0; i < segs; i++) { const q = st + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** density(x,z) -> 0..1 ; area {x0,x1,z0,z1}; tries = number of candidate points */
export function createGrass({ area, density, tries = 20000, seed = 21 }) {
  const r = rng(seed);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const list = [];
  for (let i = 0; i < tries; i++) {
    const x = THREE.MathUtils.lerp(area.x0, area.x1, r()), z = THREE.MathUtils.lerp(area.z0, area.z1, r());
    if (r() > density(x, z)) continue;
    const sc = 0.6 + r() * 0.9;
    p.set(x, 0, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28); s.set(sc, sc * (0.7 + r() * 0.6), sc);
    list.push(m.compose(p, q, s).clone());
  }
  const mat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    { wind: true, windHeight: 0.8, dustTop: 0.3, dustLow: 0.2, dirtHeight: 0.2, fade: 0.1, translucency: 0.5 });
  const mesh = new THREE.InstancedMesh(buildClump(seed), mat, list.length);
  list.forEach((mm, i) => mesh.setMatrixAt(i, mm));
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.customDepthMaterial = windDepthMaterial(0.8);
  mesh.frustumCulled = false;
  return mesh;
}
