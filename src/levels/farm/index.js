// Level 1: the Farm.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFarmWorld, loadModel, SPOTS } from './world.js';
import { createFarmAtmosphere, FARM_GRADE } from './atmosphere.js';
import { world } from '../../assets/materialPatch.js';
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
import { buildBedroom, ROOM } from './bedroom.js';
import { createTrample } from '../../systems/trample.js';
import { distToRoads } from '../../assets/terrain.js';
import { runFarmStory } from './script.js';
import { retargetClip } from '../../core/retarget.js';
window.__retarget = retargetClip;
import { save } from '../../systems/save.js';

export async function startFarm(game) {
  const { scene, camera, renderer, high } = game;
  const params = new URLSearchParams(location.search);
  const atmo = createFarmAtmosphere(renderer, scene, { high });
  const [farm, physics, playerGltf, truckGltf, animGltf] = await Promise.all([buildFarmWorld(scene, { high }), createPhysics(), loadModel('player'), loadModel('truck'), loadModel('anims')]);
  physics.addHeightfield(heightAt);
  physics.addStatic(farm.colliders);
  const bedroom = await buildBedroom(scene, loadModel);
  physics.addStatic(bedroom.colliders);

  const input = createInput(renderer.domElement);
  game.input = input;
  const spawn = SPOTS.playerSpawn.clone(); spawn.y = heightAt(spawn.x, spawn.z);
  const player = new Player(game, playerGltf.scene, physics, spawn);
  player.setPosition(spawn, Math.PI * 0.6);
  // motion-captured walk (RenderPeople) and run, idle from the base library, all retargeted onto the player
  const [walkGltf, runGltf] = await Promise.all([loadModel('m_walk'), loadModel('m_run2')]);
  {
    const find = (g, re) => g.animations.find((c) => re.test(c.name)) || g.animations[0];
    const bake = (g, clip, name) => { try { return retargetClip(g.scene, clip, player.model, { name }); } catch (e) { console.warn('[retarget]', name, e.message); return null; } };
    const baked = { idle: bake(animGltf, find(animGltf, /_idle$/i), 'idle'), walk: bake(walkGltf, walkGltf.animations[0], 'walk'), run: bake(animGltf, find(animGltf, /_run$/i), 'run'), sit: bake(animGltf, find(animGltf, /sitidle/i), 'sit') };
    if (baked.walk && baked.run && baked.idle) player.setBakedClips(baked); else player.setClips(animGltf.scene, animGltf.animations);
  }
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

  // ---- plants react to the truck and the player ----
  const trample = createTrample({ size: 512, extent: 200 });
  const rustle = audio.createRustle();
  const inCorn = (x, z) => farm.layout.fields.some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) && distToRoads(farm.layout, x, z) > 1.2;
  function updatePlants(dt) {
    let rust = 0;
    const tp = truck.position, tf = truck.forward.setY(0).normalize(), tsp = Math.abs(truck.speed);
    const moving = tsp > 0.6;
    // nose pushes plants ahead and to the sides, the body keeps them down underneath
    const nose = tp.clone().addScaledVector(tf, 2.9);
    trample.setPusher(0, nose, 2.3, tf.clone().multiplyScalar(Math.sign(truck.speed) || 1), moving ? 1 : 0.55);
    trample.setPusher(1, tp, 3.3, tf, 0.9);
    if (moving) {
      trample.stamp(tp.x, tp.z, tf.x * Math.sign(truck.speed || 1), tf.z * Math.sign(truck.speed || 1), 3.0, 1.25, 1);
      if (inCorn(nose.x, nose.z)) rust = Math.min(1.4, tsp / 9);
    }
    truck.cornDrag = inCorn(nose.x, nose.z) && moving ? 0.35 : 0;
    if (mode === 'foot') {
      const pp = player.position, ps = player.actualSpeed || 0;
      trample.setPusher(2, pp, 0.85, player.moveDir || null, 0.75);
      if (ps > 0.4 && inCorn(pp.x, pp.z)) rust = Math.max(rust, Math.min(0.7, ps / 6));
    } else trample.setPusher(2, null, 0);
    rustle.set(rust);
    trample.update(dt);
  }

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

  // ---- farmhouse door <-> the bedroom ----
  let indoors = false;
  async function goInside() {
    cutscenes.setFade(1, '#000', 0.5); input.state.enabled = false; await cutscenes.wait(0.55);
    indoors = true; player.setPosition(bedroom.spawn, bedroom.spawnFacing);
    world.uFogDensity.value = 0.0005; scene.environmentIntensity = 0.32; audio.setWind(0.12);
    world.uSunDir.value.copy(bedroom.sunDir); player.bounds = bedroom.bounds;
    const mood = { day: 1, dusk: 0.6, storm: 0.15, night: 0 }[atmo.mode] ?? 1; bedroom.setMood(mood); atmo.sun.intensity *= 0.35 + 0.65 * mood;
    await cutscenes.wait(0.2); cutscenes.setFade(0, '#000', 0.6); input.state.enabled = true;
  }
  async function goOutside() {
    cutscenes.setFade(1, '#000', 0.5); input.state.enabled = false; await cutscenes.wait(0.55);
    indoors = false; atmo.set(atmo.mode); player.bounds = null; level.onOutside?.();
    const p = SPOTS.houseDoor.clone(); p.y = heightAt(p.x, p.z); player.setPosition(p, Math.PI / 2);
    audio.setWind(0.45);
    await cutscenes.wait(0.2); cutscenes.setFade(0, '#000', 0.6); input.state.enabled = true;
  }
  triggers.add({ id: 'houseDoor', x: SPOTS.houseDoor.x, z: SPOTS.houseDoor.z, r: 1.6, interact: 'Go inside', onInteract: goInside });
  triggers.add({ id: 'roomDoor', ...bedroom.door, interact: 'Go outside', onInteract: goOutside });
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

  // ---- story: title screen, then the five Farm scenes ----
  const storyModels = { anims: animGltf, walk: walkGltf, run: runGltf };
  await Promise.all(['june', 'wes', 'ada', 'okafor'].map(async (n) => { storyModels[n] = await loadModel(n); }));
  await Promise.all(['porch_table', 'lantern', 'rocking_chair', 'junes_radio', 'walkie', 'probe', 'chainfence', 'floodlight', 'dish', 'crate', 'barrel'].map(async (n) => { storyModels[n] = (await loadModel(n)).scene; }));
  function startStory(sceneN) { runFarmStory(level, game, storyModels, { startScene: sceneN }).catch((e) => console.error('[story]', e)); }
  if (!VIEWS[params.get('view')] && params.get('test') !== 'systems') {
    if (params.has('scene')) setTimeout(() => startStory(+params.get('scene') || 1), 300);
    else showMenu();
  }
  function showMenu() {
    const saved = save.load();
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = `<div><h1>${STORY.title.name}</h1><p>${STORY.title.tagline}</p><div class="row">
      <button data-a="new">New game</button>${saved?.level === 'farm' && saved.scene > 1 ? `<button data-a="cont">Continue · scene ${saved.scene}</button>` : ''}</div>
      <div class="keys">WASD move · Shift run · mouse look · E interact / drive · Space brake · G graphics (${game.quality})</div></div>`;
    game.ui.appendChild(m); input.state.enabled = false;
    m.addEventListener('click', (e) => {
      const a = e.target.dataset.a; if (!a) return;
      m.classList.add('hide'); setTimeout(() => m.remove(), 900); input.state.enabled = true;
      renderer.domElement.requestPointerLock?.();
      startStory(a === 'cont' ? saved.scene : 1);
    });
  }

  let ready = 0;
  const level = {
    npcs: [], extraUpdate: [], hold: null, onOutside: null,
    grade: FARM_GRADE,
    input, player, physics, farm, atmo, truck, audio, dust, dialogue, cutscenes, triggers, timeCounter,
    get typing() { return dialogue.busy; }, bedroom, goInside, goOutside, get indoors() { return indoors; },
    get mode() { return mode; }, enterTruck, exitTruck,
    update(dt) {
      dialogue.update(dt);
      const cine = cutscenes.running;
      truck.locked = busy() || level.ended;
      const pin = busy() ? lockedInput : input;
      physics.step(dt, (h) => { truck.step(h, input); if (mode === 'foot' && !cine) player.step(h, pin); });
      if (mode === 'foot' && !cine) player.frame(dt, physics.alpha, pin, camera);
      if (level.hold && !cine) { camera.position.copy(level.hold.pos); camera.lookAt(level.hold.look); }
      for (const n of level.npcs) n.update(dt);
      for (const f of level.extraUpdate) f(dt, world.uTime.value);
      scene.userData.camQ = camera.quaternion;
      truck.update(dt, input, mode === 'truck' && !cine ? camera : null);
      cutscenes.update(dt);
      timeCounter.update(dt);
      dust.update(dt);
      updatePlants(dt);
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
      focus.y = indoors ? ROOM.origin.y : heightAt(focus.x, focus.z);
      bedroom.update(world.uTime.value);
      atmo.update(focus, dt);
      input.endFrame();
      if (++ready === 40) window.__ready = true;
    },
  };
  return level;
}
