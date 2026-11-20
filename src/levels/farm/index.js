// Level 1: the Farm.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFarmWorld, loadModel, SPOTS } from './world.js';
import { createFarmAtmosphere, FARM_GRADE } from './atmosphere.js';
import { heightAt } from '../../assets/terrain.js';
import { createPhysics } from '../../core/physics.js';
import { createInput } from '../../core/input.js';
import { Player } from '../../core/player.js';
import { Truck } from '../../core/truck.js';
import { createAudio } from '../../systems/audio.js';
import { createDustTrail } from '../../assets/dustTrail.js';
import { createDialogue } from '../../systems/dialogue.js';
import { createCutscenes } from '../../systems/cutscene.js';
import { createTriggers } from '../../systems/triggers.js';
import { createTimeCounter } from '../../systems/timecounter.js';
import { STORY } from '../../story.js';

export async function startFarm(game) {
  const { scene, camera, renderer, high } = game;
  const params = new URLSearchParams(location.search);
  const atmo = createFarmAtmosphere(renderer, scene, { high });
  const [farm, physics, playerGltf, truckGltf] = await Promise.all([buildFarmWorld(scene, { high }), createPhysics(), loadModel('player'), loadModel('truck')]);
  physics.addHeightfield(heightAt);
  physics.addStatic(farm.colliders);

  const input = createInput(renderer.domElement);
  game.input = input;
  const spawn = SPOTS.playerSpawn.clone(); spawn.y = heightAt(spawn.x, spawn.z);
  const player = new Player(game, playerGltf.scene, physics, spawn);
  player.setPosition(spawn, Math.PI * 0.6);
  game.player = player;

  const audio = game.audio = createAudio();
  audio.startWind(0.45);
  player.onStep = (k) => audio.footstep(k);
  const dust = createDustTrail({ max: high ? 1600 : 700 });
  scene.add(dust.object);
  const truckModel = truckGltf.scene;
  const { patchModel } = await import('../../assets/materialPatch.js');
  patchModel(truckModel, { dustTop: 0.7, dustLow: 0.95, dirtHeight: 1.1, fade: 0.5 }, (m) => {
    if (/glass/i.test(m.name)) return { dustTop: 0.3, dustLow: 0.4, fade: 0 };
    if (/plast/i.test(m.name)) { m.color.set('#2b2622'); return { fade: 0.35 }; }
    if (/dodge/i.test(m.name)) m.color.set('#f2e6d8');
    return null;
  });
  const truck = new Truck(game, truckModel, physics, audio, dust, SPOTS.truckSpawn, 0.85 + Math.PI);
  game.truck = truck;

  // interaction hint
  const hint = document.createElement('div'); hint.className = 'hud-hint'; game.ui.appendChild(hint);
  const showHint = (html) => { if (html) { hint.innerHTML = html; hint.classList.add('on'); } else hint.classList.remove('on'); };
  let mode = 'foot';
  const dialogue = game.dialogue = createDialogue(game.ui, input, audio);
  const cutscenes = game.cutscenes = createCutscenes(game.ui, camera, input, audio);
  const triggers = game.triggers = createTriggers(input, showHint);
  const timeCounter = game.timeCounter = createTimeCounter(game.ui, { startAge: 10 });
  timeCounter.show(false); // hidden on the Farm
  const busy = () => dialogue.busy || cutscenes.running;
  const lockedInput = { axis: () => 0, key: () => false, hit: () => false, takeMouse: () => input.takeMouse() };
  function enterTruck() { mode = 'truck'; player.setActive(false); truck.enter(); }
  function exitTruck() {
    const d = truck.doorPoint; d.y = heightAt(d.x, d.z);
    mode = 'foot'; truck.exit(); player.setActive(true);
    const f = truck.forward; player.setPosition(d, Math.atan2(f.x, f.z));
  }

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

  if (params.get('test') === 'systems') {
    setTimeout(async () => {
      const p = player.position;
      await cutscenes.play({ fadeIn: 1, subs: STORY.systemTest.subs, shots: [
        { path: [[p.x + 14, 6, p.z + 16], [p.x + 6, 3, p.z + 10], [p.x - 2, 2.2, p.z + 6]], look: [-13.5, 4, -4], dur: 5 },
        { path: [[-2, 1.8, 12], [-6, 1.7, 6]], look: [[-13.5, 4, -4], [-13.5, 3, -2]], dur: 3.5 },
      ] });
      await dialogue.play(STORY.systemTest.dialogue);
    }, 600);
  }

  let ready = 0;
  const level = {
    grade: FARM_GRADE,
    input, player, physics, farm, atmo, truck, audio, dust, dialogue, cutscenes, triggers, timeCounter,
    get typing() { return dialogue.busy; },
    get mode() { return mode; }, enterTruck, exitTruck,
    update(dt) {
      dialogue.update(dt);
      const cine = cutscenes.running;
      truck.locked = busy();
      physics.step(dt, (h) => { truck.step(h, input); if (mode === 'foot' && !cine) player.update(h, busy() ? lockedInput : input, camera); });
      truck.update(dt, input, mode === 'truck' && !cine ? camera : null);
      cutscenes.update(dt);
      timeCounter.update(dt);
      dust.update(dt);
      // E: get in / out of the truck
      const near = mode === 'foot' && player.position.distanceTo(truck.doorPoint.setY(player.position.y)) < 2.6 && Math.abs(truck.speed) < 2;
      const zoneHint = mode === 'foot' && !busy() ? triggers.update(player.position) : null;
      if (busy()) showHint(null);
      else if (mode === 'foot') showHint(zoneHint || (near ? '<kbd>E</kbd>Drive' : null));
      else showHint(Math.abs(truck.speed) < 1.5 ? '<kbd>E</kbd>Get out &nbsp; <kbd>R</kbd>Reset' : null);
      if (input.hit('KeyE') && !busy() && !input.state.consumedE) { if (near && !zoneHint) enterTruck(); else if (mode === 'truck' && Math.abs(truck.speed) < 2.5) exitTruck(); }
      input.state.consumedE = false;
      if (mode === 'truck' && input.hit('KeyR')) truck.reset();
      if (controls) controls.update();
      farm.update(camera.position);
      const focus = controls ? controls.target.clone().lerp(camera.position, 0.45) : (mode === 'truck' ? truck.position : player.position).clone().lerp(camera.position, 0.3);
      focus.y = heightAt(focus.x, focus.z);
      atmo.update(focus);
      input.endFrame();
      if (++ready === 40) window.__ready = true;
    },
  };
  return level;
}
