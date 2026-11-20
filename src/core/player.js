// Third-person player: Rapier kinematic character controller + motion-captured idle/walk/run
// clips retargeted onto the character's Mixamo rig.
//
// Split in two:
//  - step(h)  fixed 60 Hz simulation: momentum-based locomotion (acceleration limits, speed-dependent
//             turn rate, slowing into sharp turns, slope cost), collision via the character controller.
//  - frame(dt, alpha)  every rendered frame: interpolated transform (no judder on 120 Hz screens),
//             stride-matched animation, body bank / spine lean / head look, foot IK on uneven ground,
//             follow camera.
// (A procedural cycle remains as a fallback if the clips fail to load.)
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const AX = { x: V(1, 0, 0), y: V(0, 1, 0), z: V(0, 0, 1) };
const { clamp, damp, lerp, smoothstep } = THREE.MathUtils;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = V(), _v2 = V(), _v3 = V();

// locomotion tuning (metres, seconds)
const TUNE = {
  accel: 4.2,        // m/s² speeding up (a jog start takes ~1 s)
  decel: 7.0,        // m/s² slowing down (stop from a run in ~0.5 s, about one stride)
  turnIdle: 7.5,     // rad/s max turn rate standing / walking
  turnRun: 3.4,      // rad/s max turn rate at full run
  turnResp: 9,       // how fast the turn rate follows the wanted heading
  turnSlow: 0.25,    // fraction of speed kept while turning ~180°
  uphillCost: 1.4,   // speed lost per unit of grade going uphill
};

function findBone(root, base) {
  const re = new RegExp(`(^|mixamorig:?|[^A-Za-z])${base}(_\\d+)?$`);
  let found = null;
  root.traverse((o) => { if (!found && o.isBone && re.test(o.name)) found = o; });
  return found;
}

export class Player {
  constructor(game, model, physics, spawn) {
    this.game = game; this.physics = physics;
    const { RAPIER, world } = physics;
    this.root = new THREE.Group();
    this.model = model;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    // the exported rig lies along +Z; stand it up and drop the feet onto the origin
    const box = new THREE.Box3().setFromObject(model);
    const sz = box.getSize(new THREE.Vector3());
    if (sz.z > sz.y * 1.5) model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);
    let b2 = new THREE.Box3().setFromObject(model);
    model.scale.multiplyScalar(1.8 / (b2.max.y - b2.min.y));
    model.updateMatrixWorld(true);
    b2 = new THREE.Box3().setFromObject(model);
    this.inner = new THREE.Group(); this.inner.add(model);
    model.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
    this.root.add(this.inner);
    game.scene.add(this.root);

    const names = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
      'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
    this.b = {}; for (const n of names) this.b[n] = findBone(model, n);
    this.rest = new Map(); model.traverse((o) => { if (o.isBone) this.rest.set(o, o.quaternion.clone()); });

    // physics: kinematic capsule (total height 1.8 m)
    this.radius = 0.3; this.half = 0.6;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + 1.0, spawn.z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(this.half, this.radius), this.body);
    this.ctrl = world.createCharacterController(0.03);
    this.ctrl.enableAutostep(0.35, 0.2, true);
    this.ctrl.enableSnapToGround(0.4);
    this.ctrl.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    this.ctrl.setMinSlopeSlideAngle(55 * Math.PI / 180);
    this.ctrl.setApplyImpulsesToDynamicBodies(true);

    this.speed = 0; this.vy = 0; this.facing = 0; this.turnVel = 0; this.accel = 0;
    this.moveDir = V(0, 0, 1); this.grade = 0;
    this.phase = 0; this.grounded = true; this.active = true;
    this.yaw = 0; this.pitch = 0.18; this.camDist = 4.2;
    this.camPos = V(); this.camInit = false;
    this.walkSpeed = 1.35; this.runSpeed = 3.9;
    this.onStep = null; // footstep callback (intensity)
    this.lastStep = 0;
    // interpolation between fixed steps
    this.prev = { pos: V(), facing: 0 }; this.curr = { pos: V(), facing: 0 };
    this.visY = null; this.pelvis = 0; this.footOff = [0, 0];
    this.lean = { bank: 0, fwd: 0, look: 0 };
    this.snapState();
    this.applyTransform(1);
  }

  get position() { const t = this.body.translation(); return V(t.x, t.y - this.half - this.radius, t.z); }

  setPosition(p, facing) {
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + this.half + this.radius + 0.05, z: p.z });
    this.body.setTranslation({ x: p.x, y: p.y + this.half + this.radius + 0.05, z: p.z }, true);
    if (facing !== undefined) { this.facing = facing; this.yaw = facing + Math.PI; this.moveDir.set(Math.sin(facing), 0, Math.cos(facing)); }
    this.vy = 0; this.speed = 0; this.turnVel = 0; this.camInit = false; this.visY = null;
    this.snapState(); this.applyTransform(1);
  }

  setActive(on) {
    this.active = on; this.root.visible = on;
    this.collider.setEnabled(on);
  }

  snapState() {
    const p = this.position;
    this.prev.pos.copy(p); this.curr.pos.copy(p);
    this.prev.facing = this.curr.facing = this.facing;
  }

  /** Back-compat: one fixed step (the level calls this from inside physics.step). */
  update(h, input) { this.step(h, input); }

  // ---------------- fixed-step simulation ----------------
  step(h, input) {
    if (!this.active) return;
    this.prev.pos.copy(this.curr.pos); this.prev.facing = this.curr.facing;

    // intent, relative to where the camera looks
    const f = input.axis('KeyS', 'KeyW'), s = input.axis('KeyA', 'KeyD');
    const run = input.key('ShiftLeft') || input.key('ShiftRight');
    const fwd = _v.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = _v2.set(-fwd.z, 0, fwd.x);
    const dir = _v3.copy(fwd).multiplyScalar(f).addScaledVector(right, s);
    const moving = dir.lengthSq() > 0.01;
    const runK = clamp(this.speed / this.runSpeed, 0, 1);

    let target = 0, turnErr = 0;
    if (moving) {
      dir.normalize();
      turnErr = wrap(Math.atan2(dir.x, dir.z) - this.facing);
      target = run ? this.runSpeed : this.walkSpeed;
      // people slow down to turn sharply; a full reversal at a run is a plant-and-pivot
      target *= lerp(1, TUNE.turnSlow, smoothstep(Math.abs(turnErr), 0.5, 2.8));
      // walking uphill costs speed, gentle downhill is free
      target *= clamp(1 - Math.max(0, this.grade) * TUNE.uphillCost, 0.55, 1);
    }

    // heading: rate-limited, slower at speed (momentum)
    const maxTurn = lerp(TUNE.turnIdle, TUNE.turnRun, runK * runK);
    const wantTurn = clamp(turnErr * TUNE.turnResp, -maxTurn, maxTurn);
    this.turnVel = damp(this.turnVel, moving ? wantTurn : 0, 16, h);
    this.facing = wrap(this.facing + this.turnVel * h);

    // speed: smooth approach with acceleration / braking limits
    const rate = target > this.speed ? TUNE.accel * lerp(1, 0.75, runK) : TUNE.decel;
    const want = this.speed + (target - this.speed) * (1 - Math.exp(-h * (target > this.speed ? 6 : 11)));
    const ds = clamp(want - this.speed, -rate * h, rate * h);
    this.speed = Math.max(0, this.speed + ds);
    this.accel = damp(this.accel, ds / h, 6, h);

    // travel follows the body (with a little drift on fast direction changes)
    this.moveDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));

    // gravity
    this.vy = this.grounded ? -2 : Math.max(this.vy - 9.81 * h, -30);
    const desired = { x: this.moveDir.x * this.speed * h, y: this.vy * h, z: this.moveDir.z * this.speed * h };
    this.ctrl.computeColliderMovement(this.collider, desired);
    const mv = this.ctrl.computedMovement();
    this.grounded = this.ctrl.computedGrounded();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z });
    const hm = Math.hypot(mv.x, mv.z);
    this.actualSpeed = hm / h;
    if (hm > 1e-4 && this.grounded) this.grade = damp(this.grade, clamp(mv.y / hm, -1, 1), 8, h);
    // pressing into a wall: don't keep building speed you can't use
    if (this.speed > 0.5 && this.actualSpeed < this.speed * 0.4) this.speed = damp(this.speed, this.actualSpeed, 10, h);

    this.curr.pos.set(t.x + mv.x, t.y + mv.y - this.half - this.radius, t.z + mv.z);
    this.curr.facing = this.facing;
  }

  // ---------------- per rendered frame ----------------
  frame(dt, alpha, input, camera) {
    if (!this.active) return;
    const m = input.takeMouse();
    this.yaw -= m.x * 0.0024; this.pitch = clamp(this.pitch + m.y * 0.002, -0.35, 0.9);
    this.applyTransform(alpha, dt);
    if (this.mixer) this.animateClips(dt); else this.animate(dt);
    this.layers(dt);
    this.footIK(dt);
    this.updateCamera(dt, camera);
  }

  applyTransform(alpha, dt = 0) {
    const p = _v.copy(this.prev.pos).lerp(this.curr.pos, alpha);
    // smooth the visual height over steps / autostep pops (the capsule stays exact)
    if (this.visY === null || Math.abs(this.visY - p.y) > 0.6 || !dt) this.visY = p.y;
    else this.visY = damp(this.visY, p.y, p.y > this.visY ? 14 : 22, dt);
    this.root.position.set(p.x, this.visY, p.z);
    this.root.rotation.y = this.prev.facing + wrap(this.curr.facing - this.prev.facing) * alpha;
  }

  // ---------------- motion-captured locomotion ----------------
  /** Retarget Mixamo clips from another rig onto this character (by bone name, rest-pose corrected). */
  setClips(srcScene, srcClips, names = { idle: /idle/i, walk: /walk/i, run: /run/i, sit: /sitidle/i }) {
    const norm = (n) => n.replace(/^mixamorig:?/, '').replace(/_\d+$/, '');
    const srcRest = new Map(); let srcHipsY = 1;
    srcScene.traverse((o) => { if (o.isBone) { srcRest.set(norm(o.name), o.quaternion.clone()); if (norm(o.name) === 'Hips') srcHipsY = o.position.y; } });
    const tgt = new Map(); this.model.traverse((o) => { if (o.isBone) tgt.set(norm(o.name), o); });
    const tHips = tgt.get('Hips'); const tRestPos = tHips.position.clone();
    const ratio = tRestPos.y / (srcHipsY || 1);
    const qs = new THREE.Quaternion(), qr = new THREE.Quaternion();
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {}; this.actions = {};
    for (const [key, re] of Object.entries(names)) {
      const clip = srcClips.find((c) => re.test(c.name)); if (!clip) continue;
      const tracks = [];
      for (const tr of clip.tracks) {
        const dot = tr.name.lastIndexOf('.'); const node = norm(tr.name.slice(0, dot)), prop = tr.name.slice(dot + 1);
        const bone = tgt.get(node); if (!bone) continue;
        if (prop === 'quaternion') {
          const rs = srcRest.get(node) || new THREE.Quaternion(), rt = this.rest.get(bone);
          const rsInv = rs.clone().invert(); const v = tr.values.slice();
          for (let i = 0; i < v.length; i += 4) { qs.fromArray(v, i); qr.copy(qs).multiply(rsInv).multiply(rt); qr.toArray(v, i); }
          tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, tr.times, v));
        } else if (prop === 'position' && node === 'Hips') {
          const v = tr.values.slice(), n = v.length / 3;
          for (let i = 0; i < n; i++) { v[i * 3] = tRestPos.x; v[i * 3 + 1] = tRestPos.y + (v[i * 3 + 1] - srcHipsY) * ratio; v[i * 3 + 2] = tRestPos.z; }
          tracks.push(new THREE.VectorKeyframeTrack(`${bone.name}.position`, tr.times, v));
        }
      }
      const c = new THREE.AnimationClip(key, clip.duration, tracks);
      c.userData = { speed: 0, phase0: 0 };
      this.clips[key] = c;
      const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); this.actions[key] = a;
    }
    this.finishClips();
  }

  /** Use clips already retargeted onto this skeleton: { idle, walk, run, sit } */
  setBakedClips(clips) {
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {}; this.actions = {};
    for (const [key, c] of Object.entries(clips)) {
      if (!c) continue;
      c.userData = { speed: 0, phase0: 0 };
      this.clips[key] = c;
      const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); this.actions[key] = a;
    }
    this.finishClips();
  }

  finishClips() {
    for (const k of ['walk', 'run']) if (this.clips[k]) this.measureGait(k);
    const W = this.clips.walk?.userData, R = this.clips.run?.userData;
    // locomotion speeds = the speeds the clips were captured at, so feet plant without sliding
    if (W?.speed) this.walkSpeed = clamp(W.speed, 1.1, 1.7);
    if (R?.speed) this.runSpeed = clamp(R.speed * 1.08, 3.0, 5.5);
    for (const [k, a] of Object.entries(this.actions)) a.setEffectiveWeight(k === 'idle' ? 1 : 0);
    this.cycle = 0; this.blend = { idle: 1, walk: 0, run: 0 };
    console.log('[player] clips', Object.entries(this.clips).map(([k, c]) => `${k} ${c.duration.toFixed(2)}s ${c.userData.speed.toFixed(2)}m/s φ0 ${c.userData.phase0.toFixed(2)}`).join(', '),
      `| walk ${this.walkSpeed.toFixed(2)} run ${this.runSpeed.toFixed(2)} m/s`);
  }

  /** Measure an in-place clip's real ground speed (how fast the planted foot moves backward) and
   *  the phase of the left heel strike, so walk and run can share one phase and stride-match. */
  measureGait(key) {
    const c = this.clips[key], a = this.actions[key], L = this.b.LeftFoot, R = this.b.RightFoot;
    if (!L || !R) return;
    for (const x of Object.values(this.actions)) x.setEffectiveWeight(x === a ? 1 : 0);
    const N = 90, samples = [];
    const saved = this.root.matrixWorld.clone();
    this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.root.updateMatrixWorld(true);
    for (let i = 0; i <= N; i++) {
      a.time = (i / N) * c.duration; this.mixer.update(0); this.root.updateMatrixWorld(true);
      const l = L.getWorldPosition(V()), r = R.getWorldPosition(V());
      samples.push({ t: a.time, l, r });
    }
    const minY = Math.min(...samples.map((s) => Math.min(s.l.y, s.r.y)));
    const vels = [];
    for (let i = 1; i < samples.length; i++) {
      const s0 = samples[i - 1], s1 = samples[i], dt = s1.t - s0.t;
      for (const k of ['l', 'r']) if (s0[k].y < minY + 0.03 && s1[k].y < minY + 0.03) vels.push(-(s1[k].z - s0[k].z) / dt);
    }
    vels.sort((x, y) => x - y);
    const v = vels.length ? vels[Math.floor(vels.length / 2)] : 0;
    let iMax = 0; samples.forEach((s, i) => { if (s.l.z > samples[iMax].l.z) iMax = i; });
    c.userData.speed = v > 0.3 ? v : ({ walk: 1.35, run: 3.7 })[key];
    c.userData.phase0 = iMax / N;
    this.root.matrixWorld.copy(saved);
  }

  animateClips(dt) {
    const sp = this.smoothSpeed = damp(this.smoothSpeed || 0, Math.min(this.actualSpeed ?? 0, 7), 12, dt);
    const W = this.clips.walk, R = this.clips.run;
    const wN = W?.userData.speed || 1.35, rN = R?.userData.speed || 3.7;
    // weights: idle → walk → run, crossing over between the two natural speeds
    const moveK = smoothstep(sp, 0.05, Math.min(0.75, wN * 0.55));
    const runK = R ? smoothstep(sp, wN * 1.25, (wN + rN) * 0.5 + 0.4) : 0;
    const target = { idle: 1 - moveK, walk: moveK * (1 - runK), run: moveK * runK };
    for (const k of Object.keys(target)) {
      if (!this.actions[k]) continue;
      this.blend[k] = damp(this.blend[k], target[k], 10, dt);
      this.actions[k].setEffectiveWeight(this.blend[k]);
    }
    // one shared gait phase; cadence picked so the planted foot moves at the ground speed.
    // Below a clip's natural speed we shorten the stride as well as the cadence (as people do).
    const cad = (clip, nat) => { const r = sp / nat; return (r < 1 ? Math.max(0.55, Math.sqrt(r)) : Math.min(r, 1.5)) / clip.duration; };
    const wb = this.blend.walk, rb = this.blend.run;
    const rate = (wb * (W ? cad(W, wN) : 0) + rb * (R ? cad(R, rN) : 0)) / Math.max(wb + rb, 1e-3);
    const prev = this.cycle;
    this.cycle = (this.cycle + rate * dt) % 1;
    for (const [k, clip] of [['walk', W], ['run', R]]) {
      if (!clip) continue;
      this.actions[k].time = ((this.cycle + clip.userData.phase0) % 1) * clip.duration;
      this.actions[k].setEffectiveTimeScale(0);
    }
    // footsteps at the two heel strikes (phase 0 = left heel, 0.5 = right heel)
    if (moveK > 0.5) for (const c of [0.0, 0.5]) if ((prev < c && this.cycle >= c) || (prev > this.cycle && c === 0)) this.onStep?.(0.3 + runK * 0.7);
    this.mixer.update(dt);
  }

  // additive layers on top of the clips: bank into turns, lean with acceleration, head follows the camera
  layers(dt) {
    const b = this.b, sp = this.smoothSpeed ?? this.actualSpeed ?? 0;
    const runK = clamp(sp / this.runSpeed, 0, 1);
    // whole-body bank (pivots at the feet, like a runner cornering): grows with speed × turn rate
    const bank = clamp(-this.turnVel * sp * 0.035, -0.2, 0.2);
    this.lean.bank = damp(this.lean.bank, bank, 7, dt);
    this.inner.rotation.z = this.lean.bank * 0.6;
    // upper body: forward when accelerating, back when braking
    const fwd = clamp(this.accel * 0.03, -0.12, 0.14) + runK * 0.04;
    this.lean.fwd = damp(this.lean.fwd, fwd, 6, dt);
    // head looks where the camera looks (not when the camera is in front of the face)
    const camHead = this.yaw + Math.PI;
    let look = wrap(camHead - this.root.rotation.y);
    look = Math.abs(look) < 1.9 ? clamp(look, -1.0, 1.0) * lerp(1, 0.4, runK) : 0;
    this.lean.look = damp(this.lean.look, look, 5, dt);
    const lookPitch = clamp(-(this.pitch - 0.18) * 0.5, -0.3, 0.3) * (Math.abs(look) > 0 ? 1 : 0.3);
    this.root.updateMatrixWorld(true);
    this.rot(b.Spine, AX.x, this.lean.fwd * 0.5); this.rot(b.Spine1, AX.x, this.lean.fwd * 0.5);
    this.rot(b.Spine, AX.z, this.lean.bank * 0.4);
    this.rot(b.Spine2, AX.y, this.lean.look * 0.2);
    this.rot(b.Neck, AX.y, this.lean.look * 0.35); this.rot(b.Head, AX.y, this.lean.look * 0.45);
    this.rot(b.Head, AX.x, lookPitch);
  }

  // ---------------- foot IK on uneven ground ----------------
  footIK(dt) {
    const b = this.b, legs = [[b.LeftUpLeg, b.LeftLeg, b.LeftFoot], [b.RightUpLeg, b.RightLeg, b.RightFoot]];
    if (legs.some((l) => l.some((x) => !x))) return;
    this.inner.updateMatrixWorld(true);
    const baseY = this.root.position.y;
    const offs = legs.map(([, , foot], i) => {
      const p = foot.getWorldPosition(_v);
      const hit = this.physics.ray({ x: p.x, y: baseY + 0.6, z: p.z }, { x: 0, y: -1, z: 0 }, 1.3, this.collider);
      const off = hit === null ? 0 : clamp(0.6 - hit, -0.35, 0.35);
      return (this.footOff[i] = damp(this.footOff[i], this.grounded ? off : 0, 16, dt));
    });
    // drop the pelvis so the lower foot can reach; the higher foot bends its knee
    this.pelvis = damp(this.pelvis, Math.min(0, offs[0], offs[1]), 12, dt);
    this.inner.position.y = this.pelvis;
    this.inner.updateMatrixWorld(true);
    legs.forEach(([up, lo, foot], i) => {
      const lift = offs[i] - this.pelvis;
      if (lift < 0.005) return;
      const target = foot.getWorldPosition(V()); target.y += lift;
      this.twoBoneIK(up, lo, foot, target);
    });
  }

  twoBoneIK(a, b, c, T) {
    const footQ = c.getWorldQuaternion(new THREE.Quaternion());
    const A = a.getWorldPosition(V()), B = b.getWorldPosition(V()), C = c.getWorldPosition(V());
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const d = clamp(A.distanceTo(T), 0.05, l1 + l2 - 1e-3);
    const BA = A.clone().sub(B), BC = C.clone().sub(B);
    const n = BA.clone().cross(BC); if (n.lengthSq() < 1e-8) return; n.normalize();
    const cur = BA.angleTo(BC), want = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    this.rotWorld(b, n, want - cur);
    const C2 = c.getWorldPosition(V());
    _q.setFromUnitVectors(C2.sub(A).normalize(), T.clone().sub(A).normalize());
    this.rotWorldQ(a, _q);
    // keep the foot's world orientation (stays flat instead of following the shin)
    const pq = c.parent.getWorldQuaternion(new THREE.Quaternion());
    c.quaternion.copy(pq.invert().multiply(footQ)); c.updateMatrixWorld(true);
  }

  rotWorld(bone, axisW, angle) { this.rotWorldQ(bone, _q2.setFromAxisAngle(axisW, angle)); }
  rotWorldQ(bone, qW) {
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.premultiply(pq.clone().invert().multiply(qW).multiply(pq));
    bone.updateMatrixWorld(true);
  }

  // ---------------- procedural locomotion (fallback) ----------------
  rot(bone, axisChar, angle) {
    if (!bone || !angle) return;
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    this.rotWorld(bone, axisChar.clone().applyQuaternion(rootQ), angle);
  }

  animate(dt) {
    for (const [bone, q] of this.rest) bone.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    const sp = Math.min(this.actualSpeed ?? 0, 6);
    const runK = smoothstep(sp, 2.2, 4.2);
    const moveK = smoothstep(sp, 0.05, 0.6);
    const cadence = lerp(1.75, 2.9, runK); // strides per second
    this.phase += dt * cadence * Math.PI * 2 * moveK;
    const ph = this.phase, sw = Math.sin(ph), cw = Math.cos(ph);
    const stride = lerp(0.42, 0.75, runK) * moveK;
    const b = this.b, t = performance.now() / 1000;
    const beat = Math.floor(ph / Math.PI);
    if (moveK > 0.5 && beat !== this.lastStep) { this.lastStep = beat; this.onStep?.(0.4 + runK * 0.6); }
    this.inner.position.y = -(1 - Math.abs(cw)) * 0.03 * moveK - runK * 0.04;
    this.rot(b.Hips, AX.y, sw * 0.12 * moveK);
    this.rot(b.Spine, AX.x, 0.05 + runK * 0.2 * moveK + Math.sin(t * 1.6) * 0.012 * (1 - moveK));
    this.rot(b.Spine1, AX.y, -sw * 0.16 * moveK);
    this.rot(b.Neck, AX.x, -runK * 0.12);
    const armDown = 1.28;
    this.rot(b.LeftArm, AX.z, -armDown); this.rot(b.RightArm, AX.z, armDown);
    this.rot(b.LeftArm, AX.x, sw * stride * 0.9); this.rot(b.RightArm, AX.x, -sw * stride * 0.9);
    const elbow = 0.18 + runK * 0.9;
    this.rot(b.LeftForeArm, AX.x, -elbow - Math.max(0, sw) * 0.3 * runK); this.rot(b.RightForeArm, AX.x, -elbow - Math.max(0, -sw) * 0.3 * runK);
    this.rot(b.LeftArm, AX.y, 0.08); this.rot(b.RightArm, AX.y, -0.08);
    const legs = [[b.LeftUpLeg, b.LeftLeg, b.LeftFoot, 1], [b.RightUpLeg, b.RightLeg, b.RightFoot, -1]];
    for (const [up, lo, foot, sgn] of legs) {
      const s1 = sw * sgn, c1 = cw * sgn;
      this.rot(up, AX.x, -s1 * stride);
      const knee = (Math.max(0, c1) * (0.55 + runK * 0.75) + 0.06) * moveK;
      this.rot(lo, AX.x, knee);
      this.rot(foot, AX.x, -knee * 0.45 + s1 * stride * 0.3);
    }
  }

  // ---------------- follow camera ----------------
  updateCamera(dt, camera) {
    const p = this.root.position;
    const target = V(p.x, p.y + 1.55, p.z);
    const back = V(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const side = V(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.45); // over-the-shoulder
    if (this.bounds) side.multiplyScalar(0.55);
    this.runCam = damp(this.runCam || 0, smoothstep(this.smoothSpeed ?? 0, 2.5, this.runSpeed), 2.5, dt);
    let dist = this.bounds ? 2.3 : this.camDist + this.runCam * 0.6;
    const from = target.clone().add(side);
    const hit = this.physics.ray(from, back, dist + 0.3, this.collider);
    if (hit !== null) dist = Math.max(0.6, hit - 0.3);
    const want = from.clone().addScaledVector(back, dist);
    if (this.bounds) { const B = this.bounds; want.x = clamp(want.x, B.x0, B.x1); want.z = clamp(want.z, B.z0, B.z1); want.y = clamp(want.y, B.y0, B.y1); }
    if (!this.camInit) { this.camPos.copy(want); this.camInit = true; }
    // follow tightly sideways (mouse look must feel direct), with a little lag in height
    const k = 1 - Math.exp(-dt * 14), ky = 1 - Math.exp(-dt * 8);
    this.camPos.x += (want.x - this.camPos.x) * k; this.camPos.z += (want.z - this.camPos.z) * k;
    this.camPos.y += (want.y - this.camPos.y) * ky;
    if (hit !== null && this.camPos.distanceTo(from) > dist) this.camPos.copy(want); // never lag into a wall
    camera.position.copy(this.camPos);
    camera.lookAt(from);
  }
}
