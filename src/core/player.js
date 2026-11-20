// Third-person player: Rapier kinematic character controller + procedural walk/run animation
// on a Mixamo-style rig (the downloaded character only ships a T-pose, so the cycle is built in code).
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const AX = { x: V(1, 0, 0), y: V(0, 1, 0), z: V(0, 0, 1) };

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
      'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'];
    this.b = {}; for (const n of names) this.b[n] = findBone(model, n);
    this.rest = new Map(); model.traverse((o) => { if (o.isBone) this.rest.set(o, o.quaternion.clone()); });
    this.hipsRestY = this.b.Hips ? this.b.Hips.position.y : 0;

    // physics: kinematic capsule (total height 1.8 m)
    this.radius = 0.3; this.half = 0.6;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + 1.0, spawn.z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(this.half, this.radius), this.body);
    this.ctrl = world.createCharacterController(0.03);
    this.ctrl.enableAutostep(0.35, 0.2, true);
    this.ctrl.enableSnapToGround(0.4);
    this.ctrl.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    this.ctrl.setApplyImpulsesToDynamicBodies(true);

    this.vel = V(0, 0, 0); this.vy = 0; this.facing = 0; this.speed = 0;
    this.phase = 0; this.grounded = true; this.active = true;
    this.yaw = 0; this.pitch = 0.18; this.camDist = 4.2;
    this.camPos = V(); this.camInit = false;
    this.onStep = null; // footstep callback (intensity)
    this.lastStep = 0;
    this.sync();
  }

  get position() { const t = this.body.translation(); return V(t.x, t.y - this.half - this.radius, t.z); }

  setPosition(p, facing) {
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + this.half + this.radius + 0.05, z: p.z });
    this.body.setTranslation({ x: p.x, y: p.y + this.half + this.radius + 0.05, z: p.z }, true);
    if (facing !== undefined) { this.facing = facing; this.yaw = facing + Math.PI; }
    this.vy = 0; this.camInit = false; this.sync();
  }

  setActive(on) {
    this.active = on; this.root.visible = on;
    this.collider.setEnabled(on);
  }

  update(dt, input, camera) {
    if (!this.active) return;
    const m = input.takeMouse();
    this.yaw -= m.x * 0.0024; this.pitch = THREE.MathUtils.clamp(this.pitch + m.y * 0.002, -0.35, 0.9);

    // movement relative to the camera
    const f = input.axis('KeyS', 'KeyW'), s = input.axis('KeyA', 'KeyD');
    const run = input.key('ShiftLeft') || input.key('ShiftRight');
    const target = (f || s) ? (run ? 4.6 : 1.7) : 0;
    this.speed = THREE.MathUtils.damp(this.speed, target, target > this.speed ? 6 : 9, dt);
    const fwd = V(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = V(-fwd.z, 0, fwd.x);
    const dir = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (dir.lengthSq() > 0.01) {
      dir.normalize();
      const want = Math.atan2(dir.x, dir.z);
      let d = want - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 10);
      this.moveDir = dir;
    }
    const md = this.moveDir || V(0, 0, 1);
    this.vy = this.grounded ? -1 : this.vy - 9.81 * dt;
    const desired = { x: md.x * this.speed * dt, y: this.vy * dt, z: md.z * this.speed * dt };
    this.ctrl.computeColliderMovement(this.collider, desired);
    const mv = this.ctrl.computedMovement();
    this.grounded = this.ctrl.computedGrounded();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z });
    this.actualSpeed = Math.hypot(mv.x, mv.z) / Math.max(dt, 1e-4);
    this.sync();
    this.animate(dt);
    this.updateCamera(dt, camera);
  }

  sync() {
    const p = this.position;
    this.root.position.copy(p);
    this.root.rotation.y = this.facing;
  }

  // ---------------- procedural locomotion ----------------
  rot(bone, axisChar, angle) {
    if (!bone || !angle) return;
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const axisW = axisChar.clone().applyQuaternion(rootQ);
    const qW = new THREE.Quaternion().setFromAxisAngle(axisW, angle);
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.premultiply(pq.clone().invert().multiply(qW).multiply(pq));
    bone.updateMatrixWorld(true);
  }

  animate(dt) {
    for (const [bone, q] of this.rest) bone.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    const sp = Math.min(this.actualSpeed ?? 0, 6);
    const runK = THREE.MathUtils.smoothstep(sp, 2.2, 4.2);
    const moveK = THREE.MathUtils.smoothstep(sp, 0.05, 0.6);
    const cadence = THREE.MathUtils.lerp(1.75, 2.9, runK); // strides per second
    this.phase += dt * cadence * Math.PI * 2 * moveK + dt * 0.0;
    const ph = this.phase, sw = Math.sin(ph), cw = Math.cos(ph);
    const stride = THREE.MathUtils.lerp(0.42, 0.75, runK) * moveK;
    const b = this.b, t = performance.now() / 1000;

    // footsteps on each down-beat
    const beat = Math.floor(ph / Math.PI);
    if (moveK > 0.5 && beat !== this.lastStep) { this.lastStep = beat; this.onStep?.(0.4 + runK * 0.6); }

    // body: bob, lean, counter-rotation, idle breathing
    this.inner.position.y = -(1 - Math.abs(cw)) * 0.03 * moveK - runK * 0.04;
    this.rot(b.Hips, AX.y, sw * 0.12 * moveK);
    this.rot(b.Spine, AX.x, 0.05 + runK * 0.2 * moveK + Math.sin(t * 1.6) * 0.012 * (1 - moveK));
    this.rot(b.Spine1, AX.y, -sw * 0.16 * moveK);
    this.rot(b.Neck, AX.x, -runK * 0.12);

    // arms down from the T-pose, swinging opposite the legs
    const armDown = 1.28;
    this.rot(b.LeftArm, AX.z, -armDown); this.rot(b.RightArm, AX.z, armDown);
    this.rot(b.LeftArm, AX.x, sw * stride * 0.9); this.rot(b.RightArm, AX.x, -sw * stride * 0.9);
    const elbow = 0.18 + runK * 0.9;
    this.rot(b.LeftForeArm, AX.x, -elbow - Math.max(0, sw) * 0.3 * runK); this.rot(b.RightForeArm, AX.x, -elbow - Math.max(0, -sw) * 0.3 * runK);
    this.rot(b.LeftArm, AX.y, 0.08); this.rot(b.RightArm, AX.y, -0.08);

    // legs: hip swing, knee flexes during swing phase, foot keeps level
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
    const p = this.position;
    const target = V(p.x, p.y + 1.55, p.z);
    const back = V(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const side = V(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.45); // over-the-shoulder
    let dist = this.camDist;
    const from = target.clone().add(side);
    const hit = this.physics.ray(from, back, dist + 0.3, this.collider);
    if (hit !== null) dist = Math.max(0.6, hit - 0.3);
    const want = from.clone().addScaledVector(back, dist);
    if (!this.camInit) { this.camPos.copy(want); this.camInit = true; }
    this.camPos.lerp(want, 1 - Math.exp(-dt * 14));
    camera.position.copy(this.camPos);
    camera.lookAt(target.clone().add(side));
  }
}
