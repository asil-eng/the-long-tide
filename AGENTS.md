# AGENTS.md: handoff for finishing *The Long Tide*

You are continuing an existing, working project. Read this file, then `CLAUDE.md` (the art-direction and working rules, which still apply) and `STORY.md` (the full story) before changing anything.

## 1. What this is

A story-driven, third-person 3D browser game. Vite + Three.js (r187) + Rapier (`@dimforge/rapier3d-compat` 0.21) + pmndrs `postprocessing` + N8AO. Plain JavaScript ES modules, no framework, no TypeScript.

**Level 1 (The Farm) is finished and playable.** Levels 2–5 are written in `STORY.md` but not built. Your job is to build them.

**Hard rule:** the story is original. It must never follow an existing film scene by scene, and must not use any film's characters, names, ship designs or iconic set pieces. Keep to `STORY.md`. If something you're about to build feels like a recreation of a famous movie scene, change it. All dialogue lives in `src/story.js` and is original.

## 2. Run, test, debug

```bash
npm install
npx vite                 # serves on IPv6 localhost: http://[::1]:5173/ (use [::1] in scripts)
```

- `?scene=1..5`: start a Farm scene directly (skips the title menu)
- `?q=low|high`: graphics quality; **G** toggles in game
- `?view=aerial|yard|barn|road|hills`: free OrbitControls camera
- `?shot`: hides the debug fps overlay (used by screenshot tools)
- Globals for debugging and tests: `window.__game` (renderer, scene, camera, player, truck, input, audio…), `window.__level` (the level object: npcs, triggers, cutscenes, dialogue, hud, balloon, obs, `goInside()`, `goOutside()`, `aimTruckAt(x,z)`, …), `window.__retarget`, and `window.__ready`, which becomes `true` about 40 frames after load.

**Screenshot / play-through tools** (run them with the dev server up):

```bash
node tools/shoot.mjs <outDir> lookdev-farm.html corn,road,wide high
node tools/play.mjs <outDir> "scene=2" "wait:1500;;down:KeyW;;wait:1200;;shot:walk;;up:KeyW;;eval:__game.player.position.toArray()"
```

`play.mjs` steps are separated by **`;;`** (not `;`, because eval code contains semicolons): `wait:ms`, `down:Key`, `up:Key`, `tap:Key`, `shot:name`, `eval:js`, `until:js`. It prints the fps at each shot and any console errors. Chromium runs headless with `--use-angle=metal --enable-gpu`, so fps numbers are real on the dev Mac. Don't run two browsers at once if you're measuring fps.

**Quality loop (required by CLAUDE.md):** after every visual change, screenshot from the player's view, critique it honestly (flat light, empty areas, off-palette, bad scale, cheap-looking characters), fix, and repeat. Commit after each working step, ending commit messages with a `Co-Authored-By` line.

## 3. Code map

```
index.html, src/main.js      entry; creates renderer + post pipeline, runs the loop, calls level.update(dt)
src/ui.css                   all HUD/menu/dialogue/cutscene styling
src/story.js                 STORY + CAST: every line of dialogue for every level (already written for levels 2–5)
src/core/
  renderer.js                createRenderer(quality), createPipeline(renderer, scene, camera, quality, {grade, bloom, ao}); getQuality/setQuality
  grade.js                   GradeEffect: saturation, contrast, split toning, lift/gain, grain (per-level grade objects)
  physics.js                 createPhysics(): addHeightfield(heightAt), addStatic(colliders), step(dt, fixedCb), alpha, ray()
  input.js                   createInput(canvas): key(), hit(), axis(), takeMouse(), state.enabled (set false to lock controls)
  player.js                  Player: kinematic capsule, momentum, mocap blending, foot IK, follow camera. API below
  truck.js                   Truck: Rapier ray-cast vehicle, wheels, dust, headlights, chase camera, engine sound
  retarget.js                retargetClip(srcRoot, clip, tgtRoot, {inPlace}): world-space retarget between rigs; canonName()
src/systems/
  dialogue.js                dialogue.play([{who,text,voice?}]) → Promise; typing effect; Space/E/click advance
  cutscene.js                cutscenes.play({shots:[{path,look,dur,fov,onUpdate}], subs:[{t,who,text,dur}], fadeIn, fadeOut, fadeColor, keepLocked}); showCard(html,secs); setFade(v,color,secs)
  triggers.js                triggers.add({id,x,z,r | box, interact:'label', onInteract, onEnter, once}); returns hint HTML
  hud.js                     createHUD(ui): objective(text), meter(0..1|null), say(who,text,dur) (non-blocking bark), marker({x,y,edge}|null,label)
  timecounter.js             createTimeCounter(ui,{startAge}): show(bool), setRate(yearsPerSecond), add(years). Hidden on the Farm
  audio.js                   createAudio(): startWind/setWind, footstep, createEngine, createRustle, playMusic(chordHz[]), stopMusic, playFile(url), tone()
  trample.js                 plant pushers + trample map (corn/grass bend away from the truck/player)
  save.js                    save.load()/store({level, scene})/clear() in localStorage
src/assets/
  materialPatch.js           THE shared shader: patchMaterial(mat, opts) / patchModel(root, opts, perMaterialFn). Adds dust on top
                             surfaces, dirt low, sun-fade, height fog, optional wind (instanced plants) and leaf translucency.
                             `world` holds shared uniforms (uTime, uSunDir, uSunColor, uFog*, uWind*, uDustColor, uPush*, uTrample)
  terrain.js                 heightAt(x,z), createLayout() (roads/fields/yards), distToRoads(), paintMask(), createTerrain()
  corn.js, grass.js          procedural plant geometry (buildPlant, buildClump)
  scatter.js                 TiledScatter: instanced, tiled, distance LOD (hi/lo share one instance buffer)
  sky.js                     sky dome (gradient, sun glow, drifting cloud banks, stars at night)
  dust.js, dustTrail.js      floating dust motes; billowing wheel dust
  balloon.js                 the weather balloon + flight path
  npc.js                     NPC(scene, models, who, pos, rotY): realistic scanned characters + retargeted idle/sit/walk/run; play(name), lookAt(p)
src/levels/farm/
  index.js                   startFarm(game): builds world, physics, player, truck, systems, title menu; the per-frame update
  world.js                   buildFarmWorld(): terrain, corn/grass, buildings, fences, poles, rocks; SPOTS; loadModel(name)
  atmosphere.js              createFarmAtmosphere(): presets day / storm / dusk / night, set(name), transition(name, secs); FARM_GRADE
  bedroom.js                 June's room (ROOM.origin = (620, 0, 620), far from the valley; the house door teleports you there)
  observatory.js             half-buried observatory at OBS.center (176, -170)
  puzzle.js                  the tape-matching overlay
  script.js                  runFarmStory(): the five scenes, checkpoints, the launch, the ending
src/levels/farm/lookdev.js   the original look-dev scene (lookdev-farm.html); keep it working
tools/shoot.mjs, play.mjs    Playwright tools (see above)
tools/pipeline/              asset-prep scripts (Blender + Python), see section 6
public/models, textures, hdri  optimized assets (meshopt + WebP). Every one is listed in CREDITS.md
```

### Key APIs you will reuse

- **Level object contract** (see `src/levels/farm/index.js`): `startX(game)` returns `{ grade, update(dt), typing, … }`. `main.js` builds the post pipeline with `level.grade` and calls `level.update(dt)` every frame. Inside update: `physics.step(dt, h => { truck.step(h,input); player.step(h,input) })`, then `player.frame(dt, physics.alpha, input, camera)`, `cutscenes.update(dt)`, `dialogue.update(dt)`, `triggers.update(player.position)`, `atmo.update(focus, dt)`, `input.endFrame()`. Level hooks used by scripts: `level.npcs[]` (auto-updated), `level.extraUpdate[]` (fn(dt,t)), `level.hold = {pos, look}` (Vector3s; a fixed camera while not in a cutscene), `level.onOutside`, `level.ended`.
- **Player:** `new Player(game, gltf.scene, physics, spawn)`, `setPosition(p, facing)`, `setActive(bool)`, `setBakedClips({idle, walk, run, sit})` (clips from `retargetClip` onto `player.model`), `bounds` (clamp the camera indoors), `onStep` (footstep callback), `walkSpeed`/`runSpeed` (measured from the clips).
- **Retargeting:** `retargetClip(srcGltf.scene, clip, targetModelRoot, { name, inPlace: true })`. Both rigs must be in their rest pose when called. Bone names are mapped by `canonName()` (Mixamo `mixamorig*`, RenderPeople `upperarm_l`, `upperleg_l`, … and the auto-rigged scans).
- **Materials:** run every new model through `patchModel(root, { dustTop, dustLow, dirtHeight, fade })`, otherwise it won't get fog and will look pasted in. For non-Earth levels use `dustTop: 0, dustLow: 0` and set the `world.uFog*` and `world.uSun*` uniforms to that level's palette.

## 4. Assets on hand (all in `public/models`, credited in CREDITS.md)

- **Player:** `player.glb` (Eli; Mixamo rig, T-pose rest). Clips: `m_walk.glb` (RenderPeople mocap walk), `anims.glb` (Basic Human Male: Idle, Walk, Run, SitIdle, SitDown, StandUp, Attack, Death). The player uses walk = `m_walk`, run/idle/sit = `anims`.
- **Characters:** `june.glb` (auto-rigged scan, 1.38 m), `wes.glb` (Mixamo rig), `ada.glb` (auto-rigged scan), `okafor.glb` (RenderPeople rig). The NPC class sizes them by a **skinning-aware** box (`Box3.setFromObject(model, true)`).
- **Not yet sourced:** an older June (for the Ending), Reyes and Ward (crew), spacesuits, the ship *Longtide*, a shuttle, and the relay Kestrel-2. Search Sketchfab (CC0 / CC-BY only, no NoDerivatives, no game rips, no likenesses of real people), or build them in code from PBR textures. A Mixamo-named rig retargets with no extra work.

## 5. Remaining work (in this order)

1. **Level 2: Transit** (`STORY.md` §Level 2, lines in `STORY.transit`). Minimum: a card plus a 20 s camera move past a giant banded planet with a ship silhouette, and the crew's messages as subtitles. Deep-space palette; add a new grade object. Then hand off to Level 3.
2. **Level 3: The Tide World** (`STORY.tide`). Pale aqua shallow water to the horizon: a code-built water shader with ripples, foam and sky reflection, and wading slows the player. Pearl-white sky; a huge planet in the sky with a faint gold ring of light. Beacon objective, dig out the core (hold E), then the **surge**: a giant wave rises on the horizon and the player runs to the shuttle. Reyes is lost, then the flooded-engine wait. **Time counter ON** at **2.5 home-years per real minute** (`timeCounter.setRate(2.5/60)`). The message-screen scene: a cockpit screen playing `STORY.tide.messages`, with a slow piano (synth pads via `audio.playMusic`).
3. **Level 4: The Relay** (`STORY.relay`). Zero-g movement: add a float mode to the player, or a separate controller that thrusts with WASD/Space/Ctrl and no gravity. Three couplings in order, re-seat the core, and the **radio lag**: June's lines arrive after the `lag` seconds given in `story.js`. The choice beat at the end. Indigo/violet space, warm gold panel light.
4. **Ending** (`STORY.ending`). The farm valley **green and replanted**: reuse the Farm world with a green-corn palette and day atmosphere. The rebuilt porch, old June in the rocking chair (needs an older-woman model), the reunion dialogue, then the final subtitles and "The End", then a **credits screen** generated from CREDITS.md that lists every CC-BY author.
5. **Level flow:** a small level manager in `main.js` that disposes one level and starts the next. Checkpoints already save `{level, scene}`, and the title menu should offer "Continue" for any level.
6. **Polish:**
   - transition animations (walk start/stop, turn-in-place, jog start/stop), e.g. from Mixamo FBX the user can download; retarget them with `retargetClip`
   - the bedroom window should show the storm and night outside
   - a better bunker on the observatory
   - a fuller rocket launch
   - recorded or synthesized voice lines (`voice:` fields in `story.js` are already supported)
   - keep 60 fps on High: watch corn overdraw, and keep skinned characters around 26k triangles

## 6. Asset pipeline (tools/pipeline)

Run with `/Applications/Blender.app/Contents/MacOS/Blender -b --python <script> -- <args>`. Put downloads in their own folder outside the repo.

- `sfsearch.py q1 q2 …`: Sketchfab search, CC0 + CC-BY, downloadable (env `SF` = token, `SSL_CERT_FILE=/etc/ssl/cert.pem`). `sfinfo.py outdir uid…`: details plus a thumbnail. `sfdl.py outdir name=uid …`: download. **The token is in `.env` (`SKETCHFAB_TOKEN`). Never print, log or commit it.** Read it with `SF=$(grep '^SKETCHFAB_TOKEN=' .env | cut -d= -f2-)`.
- `phdl.py hdri|tex|model outdir 1k|2k ids…`: Poly Haven downloads (CC0, no key).
- `prep_blender.py in out h|l|w meters max_tris [anim]`: apply transforms, scale to real-world size (1 unit = 1 m), origin at bottom-centre, decimate.
- `autorig.py in out height max_tris adult|child`: fit and bind a Mixamo-named skeleton to an unrigged standing scan. It falls back to proxy-mesh weighting when heat weights fail.
- `repaint.py`, `truck_wheels.py`, `truck_debadge.py`, `player_clean.py`: the specific fixes used on the farmhouse, the truck and the player. They're examples to adapt.
- Then optimize: `npx gltf-transform optimize in.glb public/models/x.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false` (add `--join false --instance false` for skinned models).
- Add every new asset to **CREDITS.md** (name, author, URL, license, what you changed). Remove trademark logos and badges from any asset before committing; check textures as well as geometry.

## 7. Gotchas that already cost time

- Vite only listens on **IPv6**: use `http://[::1]:5173/` in Node and Playwright.
- `THREE.PCFSoftShadowMap` was removed in r187; it falls back to PCF (the warning is harmless).
- **Skinned models:** `new Box3().setFromObject(obj)` without `precise = true` uses raw vertex data, which is often in centimetres. Always pass `true`.
- RenderPeople rigs use `upperleg_l`/`lowerleg_l` and sit under a 0.01-scale node. Some Sketchfab rigs import lying along +Z: stand them up (`rotation.x = -π/2`).
- `camera.lookAt()` needs a `Vector3`, not a plain object (a plain object gives a black screen).
- Truck model: the real front is model −X, so it's mounted turned 180° (physics forward is +X). The wheel axle is `(0,0,1)`. With a −Z axle, positive engine force drives backwards.
- Rapier heightfield index = `i*(n+1)+j`, with `i` along x and `j` along z (verified).
- `materialPatch` program cache key: if you add new GLSL variants, extend `customProgramCacheKey`, or materials will share the wrong shader.
- The Farm's `distToRoads` loops over every road segment. Don't call it per vertex per frame.
- The bedroom is at (620, 0, 620), outside the terrain. Indoors, fog and the sun direction are switched by `goInside`/`goOutside`.

## 8. Done means

Each level is playable from the title menu and runs at 60 fps on High on the dev Mac. It's been screenshotted and critiqued against CLAUDE.md's palette for that level, every asset is credited, and it's committed and pushed to `main` on https://github.com/asil-eng/the-long-tide.
