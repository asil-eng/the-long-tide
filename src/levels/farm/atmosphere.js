// Golden-hour (and night) atmosphere for the Farm, using the values tuned in the look-dev pass.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { world } from '../../assets/materialPatch.js';
import { createSky } from '../../assets/sky.js';
import { createDust } from '../../assets/dust.js';

export const FARM_GRADE = { saturation: 1.02, contrast: 1.12, shadowTint: [0.8, 0.96, 1.1], highlightTint: [1.08, 1.01, 0.84], lift: [0.012, 0.017, 0.024], gain: [1.2, 1.15, 1.06] };

export function createFarmAtmosphere(renderer, scene, { high = true } = {}) {
  const sunDir = new THREE.Vector3(0.62, 0.2, 0.76).normalize();
  const sky = createSky({ zenith: '#8c6e5e', horizon: '#e4b68c' });
  scene.add(sky);
  const sun = new THREE.DirectionalLight('#ffad6a', 7.5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(high ? 2048 : 1024);
  const S = 26;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 160 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  new HDRLoader().load('/hdri/kloppenheim_06_puresky_2k.hdr', (hdr) => {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose();
  });
  scene.environmentIntensity = 0.26;

  const dust = createDust({ count: high ? 5000 : 2000, box: 44, height: 10 });
  scene.add(dust);

  const presets = {
    day: { sun: '#ffad6a', sunI: 7.5, env: 0.26, fog: '#d2a682', fogSun: '#f6cc92', density: 0.0065, falloff: 0.06, zenith: '#8c6e5e', horizon: '#e4b68c', dust: '#c7a985' },
    storm: { sun: '#d08452', sunI: 2.2, env: 0.28, fog: '#a8795a', fogSun: '#c99a6c', density: 0.05, falloff: 0.022, zenith: '#7a5a48', horizon: '#c08e68', dust: '#b89474' },
    dusk: { sun: '#ff8a4c', sunI: 5.0, env: 0.2, fog: '#c9876a', fogSun: '#f2a874', density: 0.006, falloff: 0.055, zenith: '#5a4a5a', horizon: '#e09a72', dust: '#b8977a' },
    night: { sun: '#9fb4e0', sunI: 1.5, env: 0.11, fog: '#30384c', fogSun: '#48506a', density: 0.005, falloff: 0.05, zenith: '#0c111d', horizon: '#2c3448', dust: '#6a6a72' },
  };
  let mode = 'day';
  let tween = null;
  /** blend smoothly to another preset over `secs` */
  function transition(name, secs = 3) {
    const from = snapshot(); set(name); const to = snapshot(); apply(from); mode = name;
    tween = { from, to, t: 0, secs };
  }
  function snapshot() {
    return { sun: sun.color.clone(), sunI: sun.intensity, env: scene.environmentIntensity, fog: world.uFogColor.value.clone(), fogSun: world.uFogSunColor.value.clone(),
      density: world.uFogDensity.value, falloff: world.uFogFalloff.value, zenith: sky.material.uniforms.uZenith.value.clone(), horizon: sky.material.uniforms.uHorizon.value.clone(),
      dust: world.uDustColor.value.clone(), dir: world.uSunDir.value.clone() };
  }
  function apply(s) {
    sun.color.copy(s.sun); sun.intensity = s.sunI; scene.environmentIntensity = s.env; world.uSunColor.value.copy(s.sun);
    world.uFogColor.value.copy(s.fog); world.uFogSunColor.value.copy(s.fogSun); world.uFogDensity.value = s.density; world.uFogFalloff.value = s.falloff;
    sky.material.uniforms.uZenith.value.copy(s.zenith); sky.material.uniforms.uHorizon.value.copy(s.horizon); world.uDustColor.value.copy(s.dust); world.uSunDir.value.copy(s.dir);
  }
  function lerpSnap(a, b, k) {
    const c = (x, y) => x.clone().lerp(y, k), n = (x, y) => x + (y - x) * k;
    return { sun: c(a.sun, b.sun), sunI: n(a.sunI, b.sunI), env: n(a.env, b.env), fog: c(a.fog, b.fog), fogSun: c(a.fogSun, b.fogSun), density: n(a.density, b.density),
      falloff: n(a.falloff, b.falloff), zenith: c(a.zenith, b.zenith), horizon: c(a.horizon, b.horizon), dust: c(a.dust, b.dust), dir: c(a.dir, b.dir).normalize() };
  }
  function set(name) {
    const p = presets[name]; mode = name;
    sun.color.set(p.sun); sun.intensity = p.sunI; scene.environmentIntensity = p.env;
    world.uSunColor.value.set(p.sun);
    world.uFogColor.value.set(p.fog); world.uFogSunColor.value.set(p.fogSun);
    world.uFogDensity.value = p.density; world.uFogFalloff.value = p.falloff; world.uDustColor.value.set(p.dust);
    sky.material.uniforms.uZenith.value.set(p.zenith); sky.material.uniforms.uHorizon.value.set(p.horizon);
    const dir = name === 'night' ? new THREE.Vector3(-0.3, 0.55, -0.5).normalize() : sunDir;
    world.uSunDir.value.copy(dir);
  }
  set('day');

  return {
    sun, sky, dust, set, transition, get mode() { return mode; },
    setEnabled(on) { sky.visible = on; dust.visible = on; sun.visible = on; },
    update(focus, dt = 0) {
      if (tween) { tween.t += dt; const k = Math.min(1, tween.t / tween.secs); apply(lerpSnap(tween.from, tween.to, k * k * (3 - 2 * k))); if (k >= 1) tween = null; }
      const f = focus.clone();
      sun.target.position.copy(f);
      sun.position.copy(f).addScaledVector(world.uSunDir.value, 80);
    },
  };
}
