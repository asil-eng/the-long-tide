// One shader patch for every lit material in Earth levels:
//  - sun-faded, dusty top surfaces and dirt on lower parts (world-space, noise broken up)
//  - analytic height fog tinted toward the sun (in-scattering)
//  - optional wind displacement for plants (per-instance phase)
//  - optional fake translucency for thin leaves lit from behind
import * as THREE from 'three';

export const world = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },     // direction TO the sun
  uSunColor: { value: new THREE.Color('#ffb070') },
  uFogColor: { value: new THREE.Color('#c99a74') },
  uFogSunColor: { value: new THREE.Color('#f2c48c') },
  uFogDensity: { value: 0.012 },
  uFogFalloff: { value: 0.09 },
  uFogBase: { value: 0.0 },
  uWindDir: { value: new THREE.Vector2(0.92, 0.38).normalize() },
  uWindStrength: { value: 1.0 },
  uDustColor: { value: new THREE.Color('#c9ab88') },
  // things that push plants aside: xyz = position, w = radius (0 = off); dir: xy = travel dir, z = strength
  uPush: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
  uPushDir: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
  // lasting flattening painted by vehicles: rg = fall direction (0..1 → -1..1), b = amount
  uTrample: { value: null },
  uTrampleExtent: { value: 200 },
};
{
  const d = new Uint8Array([128, 128, 0, 255]);
  const t = new THREE.DataTexture(d, 1, 1); t.needsUpdate = true; world.uTrample.value = t;
}

export const NOISE_GLSL = /* glsl */ `
float fx_hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float fx_vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(fx_hash13(i),               fx_hash13(i+vec3(1,0,0)),f.x),
                 mix(fx_hash13(i+vec3(0,1,0)),   fx_hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(fx_hash13(i+vec3(0,0,1)),   fx_hash13(i+vec3(1,0,1)),f.x),
                 mix(fx_hash13(i+vec3(0,1,1)),   fx_hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fx_fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*fx_vnoise(p); p*=2.03; a*=0.5; } return s; }
`;

const WIND_UNIFORMS = /* glsl */ `
uniform float uTime; uniform vec2 uWindDir; uniform float uWindStrength; uniform float uWindHeight;
uniform vec4 uPush[4]; uniform vec4 uPushDir[4]; uniform sampler2D uTrample; uniform float uTrampleExtent;
`;

// Runs inside the vertex shader after <begin_vertex>; bends `transformed` in local space.
export const WIND_GLSL = /* glsl */ `
{
  #ifdef USE_INSTANCING
    vec3 iOrigin = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
    mat3 iRot = mat3(instanceMatrix);
  #else
    vec3 iOrigin = (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
    mat3 iRot = mat3(1.0);
  #endif
  float wh = clamp(position.y / uWindHeight, 0.0, 1.0); wh *= wh;
  vec2 scroll = uWindDir * uTime * 1.6;
  float gust = fx_vnoise(vec3((iOrigin.xz - scroll) * 0.07, uTime * 0.11));
  gust = smoothstep(0.25, 0.85, gust);
  float sway = sin(uTime * 1.25 + dot(iOrigin.xz, vec2(0.23, 0.19))) * 0.28 + gust * 1.1;
  vec3 wdir = vec3(uWindDir.x, 0.0, uWindDir.y);
  float ph = fx_hash13(floor(iOrigin * 3.0)) * 6.2831;
  vec3 flutter = vec3(sin(uTime * 5.1 + ph + position.y * 4.0), 0.0,
                      cos(uTime * 4.3 + ph + position.x * 7.0 + position.z * 5.0)) * 0.035 * wh;
  vec3 offW = (wdir * sway * 0.32 * wh + flutter * (0.6 + gust)) * uWindStrength;
  offW.y -= length(offW.xz) * 0.35 * wh;

  // pushed aside by the truck / the player, or flattened where a vehicle has driven
  vec2 bendDir = vec2(0.0); float bend = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 P = uPush[i];
    if (P.w <= 0.0) continue;
    vec2 dv = iOrigin.xz - P.xz; float dist = length(dv);
    float k = 1.0 - smoothstep(P.w * 0.4, P.w, dist);
    if (k <= 0.0) continue;
    vec2 away = dist > 1e-3 ? dv / dist : uWindDir;
    vec2 dir = normalize(away + uPushDir[i].xy * 1.4);
    // a little shiver on the way down
    k *= uPushDir[i].z * (0.92 + 0.08 * sin(uTime * 23.0 + ph));
    bendDir += dir * k; bend = max(bend, k);
  }
  vec2 tuv = (iOrigin.xz + uTrampleExtent) / (2.0 * uTrampleExtent);
  vec4 tr = texture2D(uTrample, tuv);
  if (tr.b > bend * 0.9) { bendDir = tr.rg * 2.0 - 1.0; bend = max(bend, tr.b); }
  if (bend > 0.002) {
    vec2 bd = normalize(bendDir + 1e-5);
    float hy = position.y * length(iRot[1]);
    float ang = bend * 1.35 * sqrt(clamp(position.y / uWindHeight, 0.0, 1.0));
    vec3 o = vec3(bd.x * hy * sin(ang), -hy * (1.0 - cos(ang)), bd.y * hy * sin(ang));
    offW = offW * (1.0 - bend * 0.8) + o;
  }

  float s2 = max(dot(iRot[0], iRot[0]), 1e-4);
  transformed += (transpose(iRot) * offW) / s2;
}
`;

const VERT_PARS = /* glsl */ `
varying vec3 vFxWorldPos; varying vec3 vFxWorldNrm;
${NOISE_GLSL}
${WIND_UNIFORMS}
`;

const VERT_WORLD = /* glsl */ `
{
  vec4 lwp = vec4(transformed, 1.0);
  vec3 lwn = objectNormal;
  #ifdef USE_INSTANCING
    lwp = instanceMatrix * lwp; lwn = mat3(instanceMatrix) * lwn;
  #endif
  vFxWorldPos = (modelMatrix * lwp).xyz;
  vFxWorldNrm = normalize(mat3(modelMatrix) * lwn);
}
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vFxWorldPos; varying vec3 vFxWorldNrm;
uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform vec3 uFogColor; uniform vec3 uFogSunColor; uniform float uFogDensity; uniform float uFogFalloff; uniform float uFogBase;
uniform vec3 uDustColor; uniform float uDustTop; uniform float uDustLow; uniform float uDirtHeight; uniform float uFade; uniform float uTranslucency;
float fxDust = 0.0;
${NOISE_GLSL}
vec3 fxApplyFog(vec3 col, vec3 wp){
  vec3 ro = cameraPosition; vec3 rd = wp - ro; float d = length(rd); rd /= max(d, 1e-4);
  float b = uFogFalloff;
  float ry = abs(rd.y) < 1e-3 ? 1e-3 : rd.y;
  float fog = uFogDensity / b * exp(-(ro.y - uFogBase) * b) * (1.0 - exp(-d * ry * b)) / ry;
  fog = 1.0 - exp(-max(fog, 0.0));
  float sunAmt = pow(max(dot(rd, uSunDir), 0.0), 5.0);
  vec3 fc = mix(uFogColor, uFogSunColor, sunAmt);
  return mix(col, fc, clamp(fog, 0.0, 1.0));
}
`;

const FRAG_DUST = /* glsl */ `
{
  vec3 wn = normalize(vFxWorldNrm);
  float brk = fx_fbm(vFxWorldPos * 1.7);
  float top = smoothstep(0.25, 0.9, wn.y) * uDustTop * (0.55 + 0.9 * brk);
  float low = (1.0 - smoothstep(0.0, uDirtHeight, vFxWorldPos.y - uFogBase)) * uDustLow * (0.5 + brk);
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  // sun fading: desaturate and lift toward a warm pale tone
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.06, 1.0, 0.9) + 0.04, uFade);
  // keep pure black and pure white out of the frame
  diffuseColor.rgb = clamp(diffuseColor.rgb, vec3(0.035, 0.03, 0.025), vec3(0.86, 0.82, 0.74));
  fxDust = clamp(top * 0.75 + low * 0.7, 0.0, 0.92);
  vec3 dirt = mix(uDustColor * 0.55, uDustColor, smoothstep(0.0, uDirtHeight, vFxWorldPos.y - uFogBase));
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(dirt, uDustColor, top > low ? 1.0 : 0.0), fxDust);
}
`;

/**
 * Patch a MeshStandardMaterial (or Physical) in place.
 * opts: dustTop, dustLow, dirtHeight, fade, wind (bool), windHeight, translucency, extraUniforms,
 *       fragPars (string), beforeDust (string, runs after <color_fragment>, may edit diffuseColor)
 */
export function patchMaterial(mat, opts = {}) {
  const o = { dustTop: 0.45, dustLow: 0.5, dirtHeight: 0.9, fade: 0.25, wind: false, windHeight: 2.4, translucency: 0, ...opts };
  mat.fog = false;
  const local = {
    uDustTop: { value: o.dustTop }, uDustLow: { value: o.dustLow }, uDirtHeight: { value: o.dirtHeight },
    uFade: { value: o.fade }, uTranslucency: { value: o.translucency }, uWindHeight: { value: o.windHeight },
    ...(o.extraUniforms || {}),
  };
  mat.userData.fx = local;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, world, local);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.wind ? WIND_GLSL : ''))
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_WORLD);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS + (o.fragPars || ''))
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.beforeDust || '') + FRAG_DUST)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.97, fxDust);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= (1.0 - fxDust);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uTranslucency > 0.0) {
          vec3 vdir = normalize(vFxWorldPos - cameraPosition);
          float back = pow(max(dot(vdir, uSunDir), 0.0), 3.0);
          totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * uTranslucency;
        }`)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = fxApplyFog(gl_FragColor.rgb, vFxWorldPos);');
  };
  mat.customProgramCacheKey = () => 'fx' + (o.wind ? 'w' : '') + (o.fragPars ? o.fragPars.length : 0) + (o.beforeDust ? o.beforeDust.length : 0);
  mat.needsUpdate = true;
  return mat;
}

// Depth material for shadows of wind-animated instanced plants, so shadows sway too.
export function windDepthMaterial(windHeight = 2.4) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, world, { uWindHeight: { value: windHeight } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + NOISE_GLSL + WIND_UNIFORMS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND_GLSL);
  };
  m.customProgramCacheKey = () => 'fxwinddepth';
  return m;
}

export function patchModel(root, opts = {}, perMaterial) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true; obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m.userData.fxPatched) continue;
      m.userData.fxPatched = true;
      const extra = perMaterial ? perMaterial(m, obj) : null;
      if (extra === false) continue;
      patchMaterial(m, { ...opts, ...(extra || {}) });
    }
  });
}
