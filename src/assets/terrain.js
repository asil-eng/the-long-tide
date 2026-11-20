// Farm valley terrain: a near-flat 400x400 m valley floor ringed by dusty hills.
// Roads, tyre ruts, fields and packed-dirt yards live in one mask texture painted from
// polylines, so the ground shader, corn scatter, grass and physics all agree on the layout.
import * as THREE from 'three';
import { patchMaterial } from './materialPatch.js';

export const MASK_EXTENT = 230; // mask covers [-230, 230] on x and z

// ---------- deterministic noise for heights (JS side) ----------
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, o = 4) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * vnoise(x, z); x *= 2.03; z *= 2.03; a *= 0.5; } return s; }

/** Terrain height in metres. Flat-ish inside the valley, rising into hills beyond ~190 m. */
export function heightAt(x, z) {
  const r = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25); // rounded square
  const floor = (fbm(x * 0.012, z * 0.012) - 0.5) * 1.4;
  const t = THREE.MathUtils.smoothstep(r, 185, 330);
  const hills = t * (34 + fbm(x * 0.006 + 7, z * 0.006 - 3) * 48) + t * (fbm(x * 0.03, z * 0.03) - 0.5) * 8;
  return floor * (1 - t * 0.5) + hills;
}

// ---------- layout: roads and fields ----------
export function createLayout() {
  const roads = [];
  const road = (pts, width = 4.6, ruts = true) => roads.push({ pts: pts.map(([x, z]) => new THREE.Vector2(x, z)), width, ruts });
  const mainRoadX = (z) => 3.5 + Math.sin(z * 0.035) * 2.2 + Math.sin(z * 0.009) * 6;
  const main = []; for (let z = -260; z <= 260; z += 4) main.push([mainRoadX(z), z]);
  road(main, 4.8);
  road([[mainRoadX(4), 4], [-4, 3], [-9, 1.5], [-14, 4.5], [-22, 2], [-30, -6], [-33, -18]], 3.6);        // farm lane to house & barn
  road([[mainRoadX(-118), -118], [30, -122], [70, -131], [110, -150], [150, -170], [175, -182], [200, -190]], 4.0); // east road toward the hills
  road([[mainRoadX(92), 92], [-30, 96], [-80, 90], [-130, 104], [-175, 118]], 3.6);                          // west section road
  road([[-33, -18], [-38, -60], [-36, -110], [-40, -160]], 3.0);                                             // field track behind the barn
  road([[mainRoadX(40), 40], [60, 44], [120, 38], [160, 52]], 3.2);                                          // field track to the reservoir
  const fields = [
    { x0: 8, x1: 64, z0: -112, z1: 36 }, { x0: 8, x1: 120, z0: 50, z1: 175 }, { x0: 70, x1: 175, z0: -110, z1: 30 },
    { x0: -22, x1: 0, z0: 16, z1: 40 }, { x0: -175, x1: -48, z0: -110, z1: 84 }, { x0: -175, x1: -10, z0: 104, z1: 175 },
    { x0: -175, x1: -46, z0: -175, z1: -122 }, { x0: -30, x1: 0, z0: -175, z1: -40 }, { x0: 8, x1: 100, z0: -175, z1: -132 },
  ];
  const yards = [{ x: -16, z: -4, r: 16 }, { x: -36, z: -24, r: 17 }];
  return { roads, fields, yards, mainRoadX };
}

export function distToRoads(layout, x, z) {
  let best = 1e9, bw = 0;
  for (const r of layout.roads) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      const abx = b.x - a.x, abz = b.y - a.y; const L = abx * abx + abz * abz;
      let t = ((x - a.x) * abx + (z - a.y) * abz) / L; t = Math.max(0, Math.min(1, t));
      const dx = x - (a.x + abx * t), dz = z - (a.y + abz * t);
      const d = Math.sqrt(dx * dx + dz * dz) - r.width / 2;
      if (d < best) { best = d; bw = r.width; }
    }
  }
  return best; // < 0 means on the road
}
export function inYard(layout, x, z, pad = 0) { return layout.yards.some((y) => Math.hypot(x - y.x, z - y.z) < y.r + pad); }

/** Paint roads (R), tyre ruts (G), fields (B) and yards (A) into a texture. */
export function paintMask(layout, size = 2048) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / (MASK_EXTENT * 2);
  const P = (v) => [(v.x + MASK_EXTENT) * s, (v.y + MASK_EXTENT) * s];
  const layer = (draw, blur) => {
    const l = document.createElement('canvas'); l.width = l.height = size; const lg = l.getContext('2d');
    lg.filter = `blur(${blur}px)`; lg.fillStyle = lg.strokeStyle = '#fff'; lg.lineCap = lg.lineJoin = 'round'; draw(lg); return l;
  };
  const strokeRoad = (lg, r, w) => { lg.lineWidth = w * s; lg.beginPath(); r.pts.forEach((p, i) => (i ? lg.lineTo(...P(p)) : lg.moveTo(...P(p)))); lg.stroke(); };
  const roadL = layer((lg) => layout.roads.forEach((r) => strokeRoad(lg, r, r.width)), 0.6 * s);
  const rutL = layer((lg) => layout.roads.filter((r) => r.ruts !== false).forEach((r) => {
    // two parallel tracks 0.85 m either side of the centreline
    for (const off of [-0.85, 0.85]) {
      lg.lineWidth = 0.34 * s; lg.beginPath();
      r.pts.forEach((p, i) => {
        const q = r.pts[Math.min(i + 1, r.pts.length - 1)], o = r.pts[Math.max(i - 1, 0)];
        const dx = q.x - o.x, dz = q.y - o.y, L = Math.hypot(dx, dz) || 1;
        const v = new THREE.Vector2(p.x - dz / L * off, p.y + dx / L * off);
        i ? lg.lineTo(...P(v)) : lg.moveTo(...P(v));
      });
      lg.stroke();
    }
  }), 0.12 * s);
  const fieldL = layer((lg) => layout.fields.forEach((f) => lg.fillRect((f.x0 + MASK_EXTENT) * s, (f.z0 + MASK_EXTENT) * s, (f.x1 - f.x0) * s, (f.z1 - f.z0) * s)), 1.2 * s);
  const yardL = layer((lg) => layout.yards.forEach((y) => { lg.beginPath(); lg.arc((y.x + MASK_EXTENT) * s, (y.z + MASK_EXTENT) * s, y.r * s, 0, 7); lg.fill(); }), 4 * s);
  // combine the four greyscale layers into RGBA
  const out = g.createImageData(size, size);
  const read = (l) => l.getContext('2d').getImageData(0, 0, size, size).data;
  const R = read(roadL), G = read(rutL), B = read(fieldL), A = read(yardL);
  for (let i = 0; i < out.data.length; i += 4) { out.data[i] = R[i]; out.data[i + 1] = G[i]; out.data[i + 2] = B[i]; out.data[i + 3] = A[i]; }
  const tex = new THREE.DataTexture(out.data, size, size, THREE.RGBAFormat);
  tex.flipY = false; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const tl = new THREE.TextureLoader();
function tex(path, srgb, rep) {
  const t = tl.load(path); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createTerrain(layout, { size = 960, segments = 320 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  geo.setAttribute('uv1', geo.attributes.uv);
  const rep = size / 3.5;
  const base = '/textures/brown_mud_dry/brown_mud_dry_';
  const mat = new THREE.MeshStandardMaterial({
    map: tex(base + 'diff.jpg', true, rep), normalMap: tex(base + 'nor.jpg', false, rep),
    roughnessMap: tex(base + 'rough.jpg', false, rep), aoMap: tex(base + 'ao.jpg', false, rep),
    normalScale: new THREE.Vector2(1.1, 1.1), color: new THREE.Color('#e2d2b8'),
  });
  const mask = paintMask(layout);
  patchMaterial(mat, {
    dustTop: 0.3, dustLow: 0.0, fade: 0.5,
    extraUniforms: { uMask: { value: mask }, uRoadMap: { value: tex('/textures/gravelly_sand/gravelly_sand_diff.jpg', true, 1) }, uExtent: { value: MASK_EXTENT } },
    fragPars: /* glsl */ `uniform sampler2D uMask; uniform sampler2D uRoadMap; uniform float uExtent;`,
    beforeDust: /* glsl */ `
      {
        vec2 muv = (vFxWorldPos.xz + uExtent) / (2.0 * uExtent);
        vec4 mk = (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) ? texture2D(uMask, muv) : vec4(0.0);
        float macro = fx_fbm(vec3(vFxWorldPos.xz * 0.03, 3.0));
        float macro2 = fx_fbm(vec3(vFxWorldPos.xz * 0.21, 7.0));
        diffuseColor.rgb *= mix(0.78, 1.12, macro) * mix(0.9, 1.06, macro2);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.5, 0.38), smoothstep(0.55, 0.8, macro) * 0.35);
        // hills: drier, paler, a little greyer with slope
        float hill = smoothstep(2.0, 14.0, vFxWorldPos.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.06, 0.98), hill);
        // furrows under corn rows (rows run along z)
        float furrow = 0.5 + 0.5 * cos(vFxWorldPos.x / 0.76 * 6.2831);
        diffuseColor.rgb *= mix(1.0, mix(0.7, 1.0, furrow), mk.b);
        // packed, paler dirt in the yards
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 1.1, 1.02), mk.a * 0.7);
        // roads and ruts
        vec3 rc = texture2D(uRoadMap, vFxWorldPos.xz / 2.6).rgb;
        float rl = dot(rc, vec3(0.3, 0.59, 0.11));
        vec3 roadCol = mix(vec3(rl), rc, 0.35) * vec3(1.2, 1.04, 0.86) * 1.3;
        roadCol = mix(roadCol, roadCol * 0.7, mk.g * 0.85);
        float edge = fx_vnoise(vec3(vFxWorldPos.xz * 1.3, 4.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, roadCol, smoothstep(0.25, 0.75, mk.r + (edge - 0.5) * 0.35));
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.mask = mask;
  return mesh;
}
