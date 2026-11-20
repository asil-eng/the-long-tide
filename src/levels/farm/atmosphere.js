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
    storm: { sun: '#e0915a', sunI: 3.0, env: 0.3, fog: '#b98a66', fogSun: '#d8a874', density: 0.03, falloff: 0.03, zenith: '#7a5a48', horizon: '#c08e68', dust: '#b89474' },
    night: { sun: '#8fa6d6', sunI: 0.55, env: 0.05, fog: '#2a2f3d', fogSun: '#3b4052', density: 0.006, falloff: 0.05, zenith: '#0b0e17', horizon: '#232838', dust: '#5c5a5c' },
  };
  let mode = 'day';
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
    sun, sky, dust, set, get mode() { return mode; },
    setEnabled(on) { sky.visible = on; dust.visible = on; sun.visible = on; },
    update(focus) {
      const f = focus.clone();
      sun.target.position.copy(f);
      sun.position.copy(f).addScaledVector(world.uSunDir.value, 80);
    },
  };
}
