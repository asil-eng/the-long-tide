// Level 1: the Farm.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFarmWorld } from './world.js';
import { createFarmAtmosphere, FARM_GRADE } from './atmosphere.js';
import { heightAt } from '../../assets/terrain.js';

export async function startFarm(game) {
  const { scene, camera, renderer, high } = game;
  const atmo = createFarmAtmosphere(renderer, scene, { high });
  const farm = await buildFarmWorld(scene, { high });

  // ---- debug views (step 1): ?view=aerial|yard|road|hills ----
  const params = new URLSearchParams(location.search);
  const VIEWS = {
    aerial: { pos: [-150, 70, 140], target: [-10, 0, -10] },
    yard: { pos: [6, 1.7, 14], target: [-14, 3, -4] },
    barn: { pos: [-14, 1.7, -18], target: [-40, 4, -30] },
    road: { pos: [6, 1.6, -90], target: [3, 1.5, 40] },
    hills: { pos: [60, 2.0, -160], target: [180, 20, -200] },
  };
  const controls = new OrbitControls(camera, renderer.domElement);
  const v = VIEWS[params.get('view')] || VIEWS.yard;
  camera.position.set(...v.pos); controls.target.set(...v.target); controls.update();
  if (camera.position.y < heightAt(camera.position.x, camera.position.z) + 1) camera.position.y = heightAt(camera.position.x, camera.position.z) + 1.7;

  let ready = 0;
  return {
    grade: FARM_GRADE,
    update(dt) {
      controls.update();
      farm.update(camera.position);
      const f = controls.target.clone().lerp(camera.position, 0.45); f.y = heightAt(f.x, f.z);
      atmo.update(f);
      if (++ready === 40) window.__ready = true;
    },
  };
}
