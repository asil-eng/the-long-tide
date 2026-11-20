// Dusty ground plane with a blended dirt road, tyre ruts, furrowed soil under corn and
// macro color variation to hide texture tiling. Uses Poly Haven PBR sets.
import * as THREE from 'three';
import { patchMaterial } from './materialPatch.js';

export const ROAD = { x: 3.5, amp: 2.2, freq: 0.035, half: 2.3 };
export function roadX(z) { return ROAD.x + Math.sin(z * ROAD.freq) * ROAD.amp; }

const tl = new THREE.TextureLoader();
function tex(path, srgb, rep) {
  const t = tl.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createGround({ size = 1600, fields = [] } = {}) {
  const base = '/textures/brown_mud_dry/brown_mud_dry_';
  const road = '/textures/gravelly_sand/gravelly_sand_';
  const rep = size / 3.5; // one tile ≈ 3.5 m
  const mat = new THREE.MeshStandardMaterial({
    map: tex(base + 'diff.jpg', true, rep),
    normalMap: tex(base + 'nor.jpg', false, rep),
    roughnessMap: tex(base + 'rough.jpg', false, rep),
    aoMap: tex(base + 'ao.jpg', false, rep),
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: new THREE.Color('#e2d2b8'),
  });
  const roadMap = tex(road + 'diff.jpg', true, 1);
  const fieldData = new Float32Array(16);
  fields.slice(0, 4).forEach((f, i) => fieldData.set([f.x0, f.x1, f.z0, f.z1], i * 4));

  patchMaterial(mat, {
    dustTop: 0.3, dustLow: 0.0, fade: 0.5,
    extraUniforms: {
      uRoadMap: { value: roadMap },
      uRoad: { value: new THREE.Vector4(ROAD.x, ROAD.amp, ROAD.freq, ROAD.half) },
      uFields: { value: fieldData.reduce((a, v, i) => { if (i % 4 === 0) a.push(new THREE.Vector4()); a[a.length - 1].setComponent(i % 4, v); return a; }, []) },
      uNumFields: { value: Math.min(4, fields.length) },
    },
    fragPars: /* glsl */ `
      uniform sampler2D uRoadMap; uniform vec4 uRoad; uniform vec4 uFields[4]; uniform int uNumFields;
      float fxRoadMask(vec3 wp, out float ruts){
        float cx = uRoad.x + sin(wp.z * uRoad.z) * uRoad.y;
        float n = fx_fbm(vec3(wp.xz * 0.6, 1.0)) - 0.5;
        float d = abs(wp.x - cx + n * 0.7);
        ruts = 0.0;
        float rx = abs(abs(wp.x - cx) - 0.85);
        ruts = (1.0 - smoothstep(0.08, 0.32, rx + (fx_vnoise(vec3(wp.xz*3.0, 2.0))-0.5)*0.12));
        return 1.0 - smoothstep(uRoad.w - 0.5, uRoad.w + 0.6, d);
      }
      float fxFieldMask(vec3 wp){
        float m = 0.0;
        for (int i = 0; i < 4; i++) { if (i >= uNumFields) break; vec4 f = uFields[i];
          vec2 a = smoothstep(vec2(f.x, f.z) - 0.6, vec2(f.x, f.z) + 0.4, wp.xz) * (1.0 - smoothstep(vec2(f.y, f.w) - 0.4, vec2(f.y, f.w) + 0.6, wp.xz));
          m = max(m, a.x * a.y); }
        return m;
      }
    `,
    beforeDust: /* glsl */ `
      {
        // macro variation: large patches of paler, drier dust and darker soil
        float macro = fx_fbm(vec3(vFxWorldPos.xz * 0.035, 3.0));
        float macro2 = fx_fbm(vec3(vFxWorldPos.xz * 0.21, 7.0));
        diffuseColor.rgb *= mix(0.78, 1.12, macro) * mix(0.9, 1.06, macro2);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.5, 0.38), smoothstep(0.55, 0.8, macro) * 0.35);
        // furrows under corn rows (rows run along z, 0.76 m apart)
        float fm = fxFieldMask(vFxWorldPos);
        float furrow = 0.5 + 0.5 * cos(vFxWorldPos.x / 0.76 * 6.2831);
        diffuseColor.rgb *= mix(1.0, mix(0.72, 1.0, furrow), fm);
        // the dirt road: lighter compacted dust, darker tyre ruts
        float ruts; float rm = fxRoadMask(vFxWorldPos, ruts);
        vec3 rc = texture2D(uRoadMap, vFxWorldPos.xz / 2.6).rgb;
        float rl = dot(rc, vec3(0.3, 0.59, 0.11));
        vec3 roadCol = mix(vec3(rl), rc, 0.35) * vec3(1.2, 1.04, 0.86) * 1.3;
        roadCol = mix(roadCol, roadCol * 0.7, ruts * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, roadCol, rm);
      }
    `,
  });
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute('uv1', geo.attributes.uv);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
