// Level 1: the Farm.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFarmWorld, loadModel, SPOTS } from './world.js';
import { createFarmAtmosphere, FARM_GRADE } from './atmosphere.js';
import { heightAt } from '../../assets/terrain.js';
import { createPhysics } from '../../core/physics.js';
import { createInput } from '../../core/input.js';
import { Player } from '../../core/player.js';

export async function startFarm(game) {
  const { scene, camera, renderer, high } = game;
  const params = new URLSearchParams(location.search);
  const atmo = createFarmAtmosphere(renderer, scene, { high });
  const [farm, physics, playerGltf] = await Promise.all([buildFarmWorld(scene, { high }), createPhysics(), loadModel('player')]);
  physics.addHeightfield(heightAt);
  physics.addStatic(farm.colliders);

  const input = createInput(renderer.domElement);
  game.input = input;
  const spawn = SPOTS.playerSpawn.clone(); spawn.y = heightAt(spawn.x, spawn.z);
  const player = new Player(game, playerGltf.scene, physics, spawn);
  player.setPosition(spawn, Math.PI * 0.6);
  game.player = player;

  // debug fly-camera views: ?view=aerial|yard|barn|road|hills
  const VIEWS = {
    aerial: { pos: [-150, 70, 140], target: [-10, 0, -10] },
    yard: { pos: [6, 1.7, 14], target: [-14, 3, -4] },
    barn: { pos: [-14, 1.7, -18], target: [-40, 4, -30] },
    road: { pos: [6, 1.6, -90], target: [3, 1.5, 40] },
    hills: { pos: [60, 2.0, -160], target: [180, 20, -200] },
  };
  let controls = null;
  if (VIEWS[params.get('view')]) {
    const v = VIEWS[params.get('view')];
    controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(...v.pos); controls.target.set(...v.target); controls.update();
  }

  let ready = 0;
  const level = {
    grade: FARM_GRADE,
    input, player, physics, farm, atmo,
    update(dt) {
      physics.step(dt, (h) => { player.update(h, input, camera); });
      if (controls) controls.update();
      farm.update(camera.position);
      const focus = controls ? controls.target.clone().lerp(camera.position, 0.45) : player.position.clone().lerp(camera.position, 0.3);
      focus.y = heightAt(focus.x, focus.z);
      atmo.update(focus);
      input.endFrame();
      if (++ready === 40) window.__ready = true;
    },
  };
  return level;
}
