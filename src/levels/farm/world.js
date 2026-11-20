// Builds the 400x400 m farm valley: terrain, roads, instanced corn and grass, farm buildings,
// fences, utility poles, scattered rocks and dead trees. Returns static colliders for physics.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { patchMaterial, patchModel, windDepthMaterial } from '../../assets/materialPatch.js';
import { buildPlant } from '../../assets/corn.js';
import { buildClump } from '../../assets/grass.js';
import { TiledScatter } from '../../assets/scatter.js';
import { createTerrain, createLayout, heightAt, distToRoads, inYard } from '../../assets/terrain.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
export function loadModel(name) {
  if (!cache.has(name)) cache.set(name, new Promise((res, rej) => loader.load(`/models/${name}.glb`, (g) => res(g), undefined, rej)));
  return cache.get(name).then((g) => g);
}

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export const SPOTS = {
  houseDoor: new THREE.Vector3(-5.6, 0, -2.2),   // in front of the porch steps
  truckSpawn: new THREE.Vector3(-3.0, 0, 4.5),
  playerSpawn: new THREE.Vector3(-6.0, 0, 1.0),
};

export async function buildFarmWorld(scene, { high = true } = {}) {
  const layout = createLayout();
  const colliders = []; // {kind:'box', pos, half, rotY} | {kind:'cyl', pos, r, h}
  scene.add(createTerrain(layout));

  // ---------------- corn ----------------
  const cornMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }),
    { wind: true, windHeight: 2.4, dustTop: 0.35, dustLow: 0.45, dirtHeight: 0.6, fade: 0.12, translucency: 0.7 });
  const cornRng = rng(5);
  const spacing = high ? 0.34 : 0.48;
  const corn = new TiledScatter(scene, {
    area: { x0: -176, x1: 176, z0: -176, z1: 176 }, tile: 32, nearDist: high ? 42 : 30, farDist: high ? 230 : 170, lowFraction: high ? 0.32 : 0.22,
    geoHigh: buildPlant(1, 6), geoLow: buildPlant(0, 6), matHigh: cornMat, depthHigh: windDepthMaterial(2.4),
    place: (t, push) => {
      for (const f of layout.fields) {
        const x0 = Math.max(t.x0, f.x0), x1 = Math.min(t.x1, f.x1), z0 = Math.max(t.z0, f.z0), z1 = Math.min(t.z1, f.z1);
        if (x0 >= x1 || z0 >= z1) continue;
        for (let x = Math.ceil(x0 / 0.76) * 0.76; x < x1; x += 0.76) for (let z = z0; z < z1; z += spacing * (0.8 + cornRng() * 0.4)) {
          if (cornRng() < 0.035) continue;
          const px = x + (cornRng() - 0.5) * 0.12, pz = z + (cornRng() - 0.5) * 0.08;
          if (distToRoads(layout, px, pz) < 1.2 || inYard(layout, px, pz, 2)) continue;
          const k = cornRng(), v = cornRng();
          const tint = k < 0.18 ? [0.86, 0.9, 0.72] : k < 0.36 ? [0.95, 0.82, 0.68] : [0.92 + v * 0.14, 0.88 + v * 0.12, 0.78 + cornRng() * 0.14];
          push(px, heightAt(px, pz), pz, cornRng() * 6.28, 0.78 + cornRng() * 0.36, 1, tint, (cornRng() - 0.5) * 0.12);
        }
      }
    },
  });

  // ---------------- grass and weeds ----------------
  const grassMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    { wind: true, windHeight: 0.8, dustTop: 0.3, dustLow: 0.2, dirtHeight: 0.2, fade: 0.1, translucency: 0.5 });
  const gr = rng(21);
  const grass = new TiledScatter(scene, {
    area: { x0: -320, x1: 320, z0: -320, z1: 320 }, tile: 32, nearDist: high ? 70 : 45, farDist: high ? 160 : 90, lowFraction: 0.3,
    geoHigh: buildClump(3), geoLow: buildClump(8), matHigh: grassMat, depthHigh: windDepthMaterial(0.8),
    place: (t, push) => {
      const tries = high ? 520 : 260;
      for (let i = 0; i < tries; i++) {
        const x = t.x0 + gr() * (t.x1 - t.x0), z = t.z0 + gr() * (t.z1 - t.z0);
        const dr = distToRoads(layout, x, z);
        const inField = layout.fields.some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1);
        const h = heightAt(x, z);
        let d;
        if (dr < 0.3) d = 0;                     // road surface
        else if (dr < 2.2) d = 0.55;             // shoulders
        else if (inYard(layout, x, z)) d = 0.03; // packed yard
        else if (inField) d = 0.02;
        else if (h > 3) d = 0.45;                // hills
        else d = 0.22;                           // fallow ground
        if (gr() > d) continue;
        const sc = 0.6 + gr() * 0.9;
        push(x, h, z, gr() * 6.28, sc, 0.7 + gr() * 0.6);
      }
    },
  });

  // ---------------- models ----------------
  const names = ['farmhouse', 'barn', 'windmill', 'water_tower', 'grain_bin', 'tractor', 'fence', 'utility_pole', 'barrel', 'crate', 'tyre', 'boulder', 'dead_tree', 'dry_branches'];
  const M = Object.fromEntries(await Promise.all(names.map(async (n) => [n, (await loadModel(n)).scene])));
  const dust = {
    farmhouse: { dustTop: 0.55, dustLow: 1.0, dirtHeight: 2.0, fade: 0.3, tint: '#d6c8b2' },
    barn: { dustTop: 0.5, dustLow: 0.9, dirtHeight: 1.8, fade: 0.45 },
    windmill: { dustTop: 0.4, dustLow: 0.7, dirtHeight: 1.5, fade: 0.35 },
    water_tower: { dustTop: 0.45, dustLow: 0.8, dirtHeight: 2.0, fade: 0.4 },
    grain_bin: { dustTop: 0.5, dustLow: 0.8, dirtHeight: 1.4, fade: 0.4 },
    tractor: { dustTop: 0.7, dustLow: 0.9, dirtHeight: 1.0, fade: 0.5 },
    fence: { dustTop: 0.35, dustLow: 0.7, dirtHeight: 0.5, fade: 0.3 },
    utility_pole: { dustTop: 0.2, dustLow: 0.5, dirtHeight: 1.0, fade: 0.3 },
    default: { dustTop: 0.55, dustLow: 0.8, dirtHeight: 0.6, fade: 0.35 },
  };
  for (const [n, root] of Object.entries(M)) {
    const d = dust[n] || dust.default;
    patchModel(root, d, (m) => { if (d.tint) m.color.set(d.tint); if (m.emissive) { m.emissive.set(0); m.emissiveMap = null; } return null; });
  }

  const tmpBox = new THREE.Box3();
  /** place a model on the terrain, optionally adding a box or cylinder collider from its bounds */
  function place(name, x, z, rotY = 0, { collider = 'box', scale = 1, sink = 0.05, tilt = 0 } = {}) {
    const o = M[name].clone();
    o.scale.setScalar(scale); o.rotation.set(tilt, rotY, 0);
    o.position.set(x, heightAt(x, z) - sink, z);
    scene.add(o);
    if (collider) {
      // local bounds → oriented box (local AABB rotated by rotY)
      o.updateMatrixWorld(true);
      const rot = o.rotation.y; o.rotation.y = 0; o.updateMatrixWorld(true);
      tmpBox.setFromObject(o); o.rotation.y = rot; o.updateMatrixWorld(true);
      const c = tmpBox.getCenter(new THREE.Vector3()).sub(o.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(o.position);
      const half = tmpBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      if (collider === 'box') colliders.push({ kind: 'box', pos: c, half, rotY: rot });
      else colliders.push({ kind: 'cyl', pos: c, r: typeof collider === 'number' ? collider : Math.min(half.x, half.z), h: half.y * 2 });
    }
    return o;
  }

  // the homestead
  const house = place('farmhouse', -13.5, -4, Math.PI / 2);
  place('barn', -40, -30, 0.18);
  place('windmill', -26, 17, 0.4, { collider: 0.9 });
  place('water_tower', -50, 6, 0.2, { collider: 2.3 });
  place('grain_bin', -54, -12, 0, { collider: 1.6 }); place('grain_bin', -58.5, -16, 0.6, { collider: 1.6 }); place('grain_bin', -53, -18.5, 1.2, { collider: 1.6 });
  place('tractor', -28, -40, 0.9);
  // yard clutter
  place('barrel', -6.4, -9.2, 0.3, { collider: 0.35 }); place('barrel', -5.6, -9.9, 1.2, { collider: 0.35 });
  place('crate', -6.8, -7.8, 0.4); place('crate', -30, -22, 1.1);
  place('tyre', -4.2, -8.6, 0.2, { collider: null, tilt: Math.PI / 2 });
  place('tyre', -31, -21, 1.0, { collider: null, tilt: Math.PI / 2 - 0.1 });
  place('barrel', -33, -21.5, 0.5, { collider: 0.35 });
  place('dry_branches', -18, 12, 0.3, { collider: null });

  // a neighbour's abandoned farm on the east side, for distant silhouettes
  place('barn', 150, 118, -0.6); place('grain_bin', 162, 104, 0, { collider: 1.6 }); place('grain_bin', 166, 109, 0, { collider: 1.6 });
  place('windmill', 138, 134, 1.2, { collider: 0.9 });
  place('windmill', -120, -100, 2.2, { collider: 0.9 });
  place('farmhouse', -150, 92, -0.3); // empty house to the west

  // fences: along the main road by the yard, and around the barn yard (with gaps and leaning sections)
  const fr = rng(77);
  const fenceLine = (pts, skip = 0.06) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(L / 2.4));
      const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
      for (let k = 0; k < n; k++) {
        if (fr() < skip) continue;
        const t = (k + 0.5) / n; const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const f = place('fence', x, z, ry, { scale: L / n / 2.4, collider: 'box', tilt: (fr() - 0.5) * 0.08 });
        f.rotation.z = (fr() - 0.5) * 0.06;
      }
    }
  };
  const roadEdge = []; for (let z = -40; z <= 40; z += 4) if (z < 0 || z > 8) roadEdge.push([layout.mainRoadX(z) - 3.8, z]); else if (roadEdge.length) { fenceLine(roadEdge); roadEdge.length = 0; }
  fenceLine(roadEdge);
  fenceLine([[-24, -12], [-24, -44], [-58, -46], [-62, -26]], 0.12);

  // utility poles along the main road, aligned so the wires connect
  for (let z = -340; z <= 340; z += 26.2) {
    const x = layout.mainRoadX(z) + 4.6;
    const ry = Math.atan2(layout.mainRoadX(z + 13) - layout.mainRoadX(z - 13), 26);
    place('utility_pole', x, z + 6, ry, { collider: 0.18 });
  }

  // rocks and dead trees on the hills and field margins
  const rr = rng(901);
  for (let i = 0; i < 160; i++) {
    const a = rr() * Math.PI * 2, r = 175 + rr() * 140;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    place('boulder', x, z, rr() * 6.28, { scale: 0.8 + rr() * 2.6, collider: null, sink: 0.4 });
  }
  for (let i = 0; i < 45; i++) {
    const a = rr() * Math.PI * 2, r = 150 + rr() * 150;
    place('dead_tree', Math.cos(a) * r, Math.sin(a) * r, rr() * 6.28, { scale: 0.9 + rr() * 0.8, collider: null });
  }
  place('dead_tree', 2, -30, 1.3, { collider: 0.4 }); place('dead_tree', -60, 30, 0.2, { collider: 0.4 });

  console.log(`[farm] corn ${corn.total} instances in ${corn.tiles.length} tiles, grass ${grass.total}, colliders ${colliders.length}`);
  return {
    layout, colliders, models: M, house, corn, grass,
    update(camPos) { corn.update(camPos); grass.update(camPos); },
  };
}
