// Level 1 story flow: the five Farm scenes of THE LONG TIDE (see STORY.md and src/story.js).
// Each scene saves a checkpoint so "Continue" can resume at its start.
import * as THREE from 'three';
import { STORY, CAST } from '../../story.js';
import { heightAt } from '../../assets/terrain.js';
import { NPC } from '../../assets/npc.js';
import { createBalloon } from '../../assets/balloon.js';
import { createHUD } from '../../systems/hud.js';
import { save } from '../../systems/save.js';
import { buildObservatory, OBS } from './observatory.js';
import { runTapePuzzle } from './puzzle.js';
import { ROOM } from './bedroom.js';
import { SPOTS } from './world.js';
import { patchModel } from '../../assets/materialPatch.js';

const S = STORY.farm;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const until = (f) => new Promise((r) => { const id = setInterval(() => { if (f()) { clearInterval(id); r(); } }, 50); });

export async function runFarmStory(L, game, models, { startScene = 1 } = {}) {
  const { scene, camera } = game;
  const { player, truck, cutscenes, dialogue, triggers, atmo, audio, bedroom } = L;
  const hud = createHUD(game.ui);
  L.hud = hud;

  // ---------- props & characters ----------
  const groundUnder = (x, z, fallback) => {
    // the first surface above the ground (porch floor, step) found by casting up from just above the terrain
    const rc = new THREE.Raycaster(V(x, heightAt(x, z) + 0.02, z), V(0, 1, 0), 0, 3);
    const hit = rc.intersectObject(L.farm.house, true)[0];
    return hit ? hit.point.y : (fallback ?? heightAt(x, z));
  };
  const porchY = groundUnder(-8.4, -4.5);
  const npc = {
    june: new NPC(scene, models, 'june', V(-6.2, groundUnder(-6.2, -1.2), -1.2), Math.PI / 2),
    wes: new NPC(scene, models, 'wes', V(-4.6, heightAt(-4.6, 1.4), 1.4), -2.2),
    ada: new NPC(scene, models, 'ada', V(-8.6, porchY, -4.6), Math.PI / 2 + 0.2),
    okafor: new NPC(scene, models, 'okafor', V(0, -50, 0), 0),
  };
  npc.okafor.visible = false;
  const chair = models.rocking_chair.clone(); patchModel(chair, { dustTop: 0.5, dustLow: 0.6, fade: 0.3 });
  chair.position.set(-8.6, porchY, -4.6); chair.rotation.y = Math.PI / 2 + 0.2; scene.add(chair);
  const table = models.porch_table.clone(); patchModel(table, { dustTop: 0.6, dustLow: 0.5, fade: 0.3 });
  table.position.set(-8.0, porchY, -2.9); table.rotation.y = Math.PI / 2; scene.add(table);
  table.updateMatrixWorld(true); const tableTop = new THREE.Box3().setFromObject(table).max.y;
  const lantern = models.lantern.clone(); patchModel(lantern, { dustTop: 0.4, dustLow: 0.2, fade: 0.2 });
  lantern.position.set(-8.1, tableTop, -3.2); scene.add(lantern);
  const lanternLight = new THREE.PointLight('#ffb060', 3.5, 6, 1.6); lanternLight.position.set(-8.1, tableTop + 0.25, -3.2); scene.add(lanternLight);
  const radio = models.junes_radio.clone(); patchModel(radio, { dustTop: 0.5, dustLow: 0.3, fade: 0.2 });
  radio.position.set(-7.9, tableTop, -2.6); radio.rotation.y = 1.4; scene.add(radio);
  const walkie = models.walkie.clone(); patchModel(walkie, { dustTop: 0.2, dustLow: 0, fade: 0.1 });
  walkie.visible = false; scene.add(walkie);
  const obs = buildObservatory(scene, models);
  L.physics.addStatic(obs.colliders);
  const balloon = createBalloon(scene, models.probe);
  L.balloon = balloon; L.obs = obs; L.npcByName = npc;
  balloon.group.visible = false;
  for (const n of Object.values(npc)) L.npcs.push(n);
  L.extraUpdate.push((dt, t) => { if (balloon.group.visible) balloon.update(dt, L.mode === 'truck' ? truck.position : player.position, t); });

  const ROOM_O = ROOM.origin;
  const placePlayer = (p, facing) => { if (L.mode === 'truck') L.exitTruck(); p = p.clone(); p.y = p.y || heightAt(p.x, p.z); player.setPosition(p, facing); };
  const placeTruck = (x, z, yaw) => {
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    truck.body.setTranslation({ x, y: heightAt(x, z) + 0.6, z }, true); truck.body.setRotation(q, true);
    truck.body.setLinvel({ x: 0, y: 0, z: 0 }, true); truck.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };
  L.aimTruckAt = (x, z) => {
    const p = truck.position; const yaw = Math.atan2(-(z - p.z), x - p.x);
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw); truck.body.setRotation(q, true);
    const v = truck.body.linvel(), sp = Math.hypot(v.x, v.z); truck.body.setLinvel({ x: Math.cos(yaw) * sp, y: v.y, z: -Math.sin(yaw) * sp }, true);
  };
  // project a world point to the screen; clamps to the edges when it's off-screen or behind
  function screenPoint(w) {
    const v = w.clone().project(camera);
    const behind = v.z > 1;
    let x = (v.x + 1) / 2, y = (1 - v.y) / 2;
    if (behind) { x = 1 - x; y = 0.92; }
    const edge = behind || x < 0.04 || x > 0.96 || y < 0.06 || y > 0.94;
    return { x: Math.min(0.96, Math.max(0.04, x)), y: Math.min(0.94, Math.max(0.06, y)), edge };
  }
  const checkpoint = (n) => save.store({ level: 'farm', scene: n });
  const holdShot = (pos, look) => { L.hold = { pos: V(...pos), look: V(...look) }; };
  const release = () => { L.hold = null; };

  // =========================================================
  async function scene1() {
    checkpoint(1);
    atmo.set('day'); audio.playMusic([98, 146.8, 196, 246.9], 0.16);
    placePlayer(V(-4.2, 0, -2.4), -Math.PI / 2);
    npc.june.play('sit'); npc.ada.play('sit'); npc.wes.play('idle');
    cutscenes.setFade(1, '#000', 0);
    await cutscenes.showCard(S.openingCard, 3.2);
    const p = V(-6.5, porchY, -2.5);
    await cutscenes.play({
      fadeIn: 1.6, subs: S.supperSubs,
      shots: [
        { path: [[10, 3.4, 9], [4, 2.6, 5], [-1.5, 2.0, 1.5]], look: [[-10, 3, -4], [-9, 2.2, -3], [-7.5, 1.4, -2.6]], dur: 8.5, fov: 40 },
        { path: [[-2.2, 1.6, 1.8], [-2.6, 1.55, 1.2]], look: [[-7.4, 1.1, -2.6], [-7.6, 1.05, -2.8]], dur: 6.5, fov: 38 },
      ],
    });
    holdShot([-2.4, 1.6, 1.4], [-7.4, 1.1, -2.6]);
    await dialogue.play(S.supperDialogue.slice(0, 6));
    // Wes spots the balloon
    balloon.group.visible = true;
    const bp = balloon.group.position;
    await cutscenes.play({ shots: [{ path: [[-3.8, 1.7, 0.2], [-3.4, 1.8, 0.6]], look: [[bp.x, bp.y, bp.z], [bp.x, bp.y - 1, bp.z]], dur: 3.5, fov: 30 }],
      subs: [{ t: 0.3, who: CAST.wes, text: S.supperDialogue[6].text, dur: 3 }] });
    release();
    await dialogue.play(S.chaseStart);
    return scene2();
  }

  // =========================================================
  async function scene2() {
    checkpoint(2);
    balloon.group.visible = true;
    hud.objective(S.objectiveChase);
    const barks = [...S.chaseBarks];
    while (!balloon.landed) {
      const c = L.mode === 'truck' ? truck.position : player.position;
      const d = c.distanceTo(balloon.group.position);
      hud.meter(Math.max(0.05, 1 - d / 220));
      truck.lookExtra = d < 140 ? balloon.group.position.clone().add(V(0, 4, 0)) : null;
      hud.marker(screenPoint(balloon.group.position.clone().add(V(0, 9, 0))), `${Math.round(d)} m`);
      if (barks.length && balloon.progress >= barks[0].at && L.mode === 'truck') { const b = barks.shift(); hud.say(b.who, b.text, 3); }
      await wait(0.1);
    }
    truck.lookExtra = null; hud.marker(null);
    hud.say(S.balloonDown[0].who, S.balloonDown[0].text, 3);
    hud.objective(S.objectivePayload);
    const lp = balloon.landPos;
    await new Promise((resolve) => triggers.add({ id: 'payload', x: lp.x, z: lp.z, r: 3.2, interact: 'Pick up the payload', once: true, onInteract: resolve }));
    hud.meter(null);
    balloon.payload.visible = false;
    await dialogue.play(S.payloadFound);
    return scene3();
  }

  // =========================================================
  async function scene3() {
    checkpoint(3);
    npc.wes.visible = false;
    balloon.group.visible = true; balloon.payload.visible = false;
    hud.objective(S.objectiveHome);
    const house = V(-10, 0, -3);
    await until(() => (L.mode === 'truck' ? truck.position : player.position).distanceTo(house.setY((L.mode === 'truck' ? truck.position : player.position).y)) < 32);
    atmo.transition('storm', 7); audio.setWind(0.95);
    for (const s of S.stormSubs) { hud.say(s.who, s.text, s.dur); await wait(s.dur + 0.3); }
    hud.objective(S.objectiveRoom);
    // June waits in her room, radio on the desk
    npc.june.visible = true; npc.june.root.position.set(ROOM_O.x - 0.9, ROOM_O.y + 0.53, ROOM_O.z + ROOM.d / 2 - 0.9); npc.june.root.rotation.y = Math.PI * 0.9; npc.june.play('sit');
    radio.position.set(ROOM_O.x + ROOM.w / 2 - 0.55, bedroom.deskTop, ROOM_O.z + 0.75); radio.rotation.y = -Math.PI / 2;
    await until(() => L.indoors);
    hud.objective('Listen to June\'s radio.');
    await new Promise((resolve) => triggers.add({ id: 'radio', x: ROOM_O.x + ROOM.w / 2 - 0.9, z: ROOM_O.z + 0.75, r: 1.2, interact: 'Listen to the radio', once: true, onInteract: resolve }));
    hud.objective(null);
    await dialogue.play(S.puzzleIntro);
    game.input.state.enabled = false;
    await runTapePuzzle(game.ui, game.input, audio, S.puzzleHelp);
    game.input.state.enabled = true;
    await dialogue.play(S.puzzleSolved);
    return scene4();
  }

  // =========================================================
  async function scene4() {
    checkpoint(4);
    npc.wes.visible = false; npc.ada.visible = false; npc.june.visible = false;
    hud.objective(S.objectiveObservatory);
    L.onOutside = () => { atmo.set('night'); truck.setHeadlights(true); obs.setNight(true); audio.setWind(0.35); audio.playMusic([82.4, 123.5, 164.8, 207.7], 0.12); };
    if (!L.indoors) L.onOutside();
    npc.okafor.visible = true;
    const gp = obs.okaforSpot; npc.okafor.root.position.set(gp.x, heightAt(gp.x, gp.z), gp.z); npc.okafor.lookAt(OBS.gate);
    await until(() => !L.indoors && (L.mode === 'truck' ? truck.position : player.position).distanceTo(V(OBS.gate.x, (L.mode === 'truck' ? truck.position : player.position).y, OBS.gate.z)) < 16);
    hud.objective(null);
    truck.locked = true;
    const o = npc.okafor.root.position; npc.okafor.lookAt(L.mode === 'truck' ? truck.position : player.position);
    await cutscenes.play({
      subs: S.observatorySubs,
      shots: [
        { path: [[o.x - 9, o.y + 3.5, o.z + 8], [o.x - 5, o.y + 2.2, o.z + 5]], look: [[o.x + 8, o.y + 3, o.z - 6], [o.x, o.y + 1.5, o.z]], dur: 9 },
        { path: [[o.x - 7.5, o.y + 1.5, o.z - 2.5], [o.x - 6.8, o.y + 1.55, o.z - 1.5]], look: [[o.x + 2, o.y + 1.4, o.z + 1], [o.x + 2, o.y + 1.5, o.z + 0.6]], dur: 12, fov: 34 },
        { path: [[OBS.gate.x - 26, o.y + 4, OBS.gate.z + 22], [OBS.gate.x - 34, o.y + 14, OBS.gate.z + 30]], look: [[OBS.center.x, o.y + 3, OBS.center.z], [OBS.center.x, o.y + 6, OBS.center.z]], dur: 13.5, fov: 40 },
      ],
      fadeOut: 1.5,
    });
    return scene5(true);
  }

  // =========================================================
  async function scene5(fromCutscene = false) {
    checkpoint(5);
    cutscenes.setFade(1, '#000', 0);
    L.onOutside = null;
    atmo.set('day'); truck.setHeadlights(false); obs.setNight(false); audio.setWind(0.45); npc.okafor.visible = false;
    placeTruck(SPOTS.truckSpawn.x, SPOTS.truckSpawn.z, 0.85 + Math.PI);
    if (L.indoors) await L.goOutside();
    placePlayer(V(-4.2, 0, -2.4), Math.PI / 2);
    // June on her bed, back to the door; the radio on her desk
    npc.june.root.position.set(ROOM_O.x - 0.9, ROOM_O.y + 0.32, ROOM_O.z + ROOM.d / 2 - 0.9); npc.june.root.rotation.y = Math.PI * 0.9; npc.june.play('sit');
    npc.june.visible = true; npc.ada.visible = true; npc.ada.play('sit'); npc.wes.visible = false;
    npc.june.root.position.y = ROOM_O.y + 0.53;
    if (!fromCutscene) await wait(0.3);
    await cutscenes.showCard(S.morningCard, 2.6);
    cutscenes.setFade(0, '#000', 1.2);
    audio.playMusic([110, 138.6, 164.8, 220], 0.14);
    hud.objective(S.objectiveDoor);
    await until(() => L.indoors);
    await new Promise((resolve) => triggers.add({ id: 'june', x: ROOM_O.x - 0.9, z: ROOM_O.z + ROOM.d / 2 - 1.6, r: 1.3, interact: 'Talk to June', once: true, onInteract: resolve }));
    hud.objective(null);
    await dialogue.play(S.doorDialogue);
    hud.objective(S.objectiveShelf);
    const sh = bedroom.shelf;
    await new Promise((resolve) => triggers.add({ id: 'shelf', x: (sh.min.x + sh.max.x) / 2, z: sh.max.z + 0.7, r: 1.1, interact: 'Leave the walkie-talkie', once: true, onInteract: resolve }));
    walkie.position.set((sh.min.x + sh.max.x) / 2 - 0.4, sh.min.y + 1.07, sh.max.z - 0.12); walkie.rotation.set(0, 0.3, 0); walkie.visible = true;
    audio.tone(240, 0.12, 0.06, 'square');
    hud.objective(S.objectiveLeave);
    // drive away: once the truck is well down the road, cut to June on the porch
    await until(() => !L.indoors && L.mode === 'truck' && truck.position.distanceTo(V(-10, truck.position.y, -3)) > 70);
    hud.objective(null);
    const runFrom = V(-8.9, porchY, -2.4), runTo = V(-6.6, porchY, -1.2);
    npc.june.root.position.copy(runFrom); npc.june.lookAt(runTo); npc.june.play('run', 0.15);
    walkie.visible = false;
    // aim the second shot down the road toward the truck, never further than the road can be seen
    const t = truck.position.clone(); const toT = t.clone().sub(V(-6.6, 0, -1.2)); if (toT.length() > 90) t.copy(V(-6.6, 0, -1.2).add(toT.setLength(90)));
    t.y = heightAt(t.x, t.z);
    await cutscenes.play({
      subs: S.departureSubs,
      shots: [
        { path: [[-1.2, 1.6, 2.6], [-1.6, 1.62, 2.1]], look: [[-7.4, 1.2, -1.8], [-6.6, 1.15, -1.3]], dur: 4.2, fov: 40,
          onUpdate: (k) => { if (k < 0.55) { const p = runFrom.clone().lerp(runTo, k / 0.55); npc.june.root.position.copy(p); } else if (npc.june.current !== npc.june.mixer.existingAction(npc.june.clips.idle)) { npc.june.play('idle', 0.3); npc.june.lookAt(t); } } },
        { path: [[-6.8, 1.6, -1.6], [-6.9, 1.7, -1.7]], look: [[t.x, t.y + 1, t.z], [t.x, t.y + 1.2, t.z]], dur: 5.8, fov: 26 },
      ],
      fadeOut: 1.4,
    });
    // three weeks later: dusk on the porch, a launch trail over the hills
    cutscenes.setFade(1, '#000', 0);
    await cutscenes.showCard(S.weeksCard, 2.6);
    atmo.set('dusk');
    npc.ada.root.visible = true;
    const launch = createLaunch(scene, V(OBS.center.x + 30, heightAt(OBS.center.x, OBS.center.z), OBS.center.z - 20));
    L.extraUpdate.push((dt) => launch.update(dt));
    await cutscenes.play({
      fadeIn: 1.5, subs: S.launchSubs, fadeOut: 2.6, fadeColor: '#fff',
      shots: [
        { path: [[-2.4, 1.2, 2.6], [-2.8, 1.25, 2.2]], look: [[-6.4, 1.3, -1.0], [-6.2, 1.5, -0.8]], dur: 4.5, fov: 36, onUpdate: (k) => { if (k > 0.3) launch.go(); } },
        { path: [[-7.4, 1.55, -1.4], [-7.5, 1.6, -1.5]], look: [[180, 40, -170], [180, 120, -170]], dur: 7.5, fov: 30, onUpdate: (k) => launch.track(k) },
      ],
    });
    L.ended = true; game.input.state.enabled = false; truck.locked = true;
    cutscenes.setFade(1, '#fff', 0); hud.objective(null); hud.marker(null);
    L.hold = { pos: camera.position.clone(), look: camera.position.clone().add(V(0, 0.2, -1)) };
    audio.stopMusic(3);
    await wait(0.8);
    await cutscenes.showCard('<span style="color:#3a2c22">End of the Farm</span><br><small style="font-size:.45em;letter-spacing:.3em;color:#5a4636">' + STORY.transit.card + '</small>', 4.5);
    save.store({ level: 'transit', scene: 1 });
    await wait(1.5);
    location.href = location.pathname; // back to the title screen
  }

  const scenes = [scene1, scene2, scene3, scene4, scene5];
  // resuming mid-level: put the world into the right state for that scene
  if (startScene === 2) { balloon.group.visible = true; placePlayer(V(-3, 0, 2), Math.PI / 2); }
  if (startScene === 3) { balloon.group.visible = true; balloon.payload.visible = false; placePlayer(V(-3, 0, 2), Math.PI / 2); }
  if (startScene === 4) { placePlayer(V(-3, 0, 2), Math.PI / 2); }
  return scenes[startScene - 1]();
}

// A rocket climbing over the hills at dusk: a blinding point, an orange light washing the clouds,
// and a long plume of smoke billowing behind it.
function createLaunch(scene, pad) {
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffe8c8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.2, 'rgba(255,220,170,.8)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() }));
  head.scale.setScalar(9); head.visible = false; scene.add(head);
  const glow = new THREE.PointLight('#ffb070', 0, 380, 2); scene.add(glow);
  const N = 420; const puffs = [];
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: '#cfb39e', transparent: true, opacity: 0.13, depthWrite: false,
    map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() });
  const inst = new THREE.InstancedMesh(geo, mat, N); inst.frustumCulled = false; inst.count = 0; scene.add(inst);
  let t = -1, emitted = 0;
  const pos = (k) => pad.clone().add(new THREE.Vector3(k * k * 60, k * 520, -k * k * 40));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  return {
    go() { if (t < 0) t = 0; },
    track() {},
    update(dt, cam) {
      if (t < 0) return;
      t += dt; const k = Math.min(1, t / 14);
      const p = pos(k); head.position.copy(p); head.visible = true; glow.position.copy(p); glow.intensity = 90 * (1 - k * 0.7);
      if (emitted < N && Math.floor(t * 30) > emitted) { puffs.push({ p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, -3, (Math.random() - 0.5) * 2)), s: 2.2 + Math.random() * 1.8, born: t }); emitted++; }
      inst.count = puffs.length;
      const camQ = scene.userData.camQ || q;
      puffs.forEach((f, i) => { const age = t - f.born; const s = f.s + age * 2.4; f.p.x += dt * (1.5 + age * 0.6); f.p.y -= dt * 0.4; m4.compose(f.p, camQ, new THREE.Vector3(s, s, s)); inst.setMatrixAt(i, m4); });
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}
