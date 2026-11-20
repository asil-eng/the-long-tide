// Drivable pickup: Rapier ray-cast vehicle with arcade tuning, wheel spin/steer/suspension visuals,
// dust trails from the rear tyres, a chase camera and a synthesized engine.
import * as THREE from 'three';
import { heightAt } from '../assets/terrain.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Truck {
  constructor(game, gltfScene, physics, audio, dustTrail, spawn, rotY) {
    this.game = game; this.physics = physics; this.dust = dustTrail;
    const { RAPIER, world } = physics;
    // The model's front faces -X; mount it turned 180° so physics forward (+X) is the real front.
    this.root = new THREE.Group();
    this.model = gltfScene; this.model.rotation.y = Math.PI; this.root.add(this.model);
    this.model.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      const m = o.material; if (m && !/glass/i.test(m.name)) { m.transmission = 0; m.transparent = false; m.opacity = 1; m.depthWrite = true; }
    });
    game.scene.add(this.root);
    // physics order: front-left, front-right, rear-left, rear-right (in the turned frame)
    const all = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((n) => this.model.getObjectByName(n));
    const flip = (v) => V(-v.x, v.y, -v.z);
    const front = all.filter((w) => w.position.x < 0).sort((a, b) => a.position.z - b.position.z); // model x<0 is the real front
    const rear = all.filter((w) => w.position.x > 0).sort((a, b) => a.position.z - b.position.z);
    this.wheels = [front[1], front[0], rear[1], rear[0]];
    this.wheelRestModel = this.wheels.map((w) => w.position.clone());
    this.wheelRest = this.wheels.map((w) => flip(w.position));

    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rotY);
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, heightAt(spawn.x, spawn.z) + 0.3, spawn.z).setRotation(q)
      .setLinearDamping(0.12).setAngularDamping(1.6).setCanSleep(false));
    // chassis: body box + cab box, mass ~2.8 t, low centre of mass
    world.createCollider(RAPIER.ColliderDesc.cuboid(3.05, 0.42, 0.98).setTranslation(0, 1.0, 0).setDensity(180).setFriction(0.4), this.body);
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.05, 0.42, 0.95).setTranslation(0.45, 1.75, 0).setDensity(40).setFriction(0.4), this.body);
    this.body.setAdditionalMassProperties(0, { x: 0.1, y: 0.55, z: 0 }, { x: 900, y: 3200, z: 2900 }, { x: 0, y: 0, z: 0, w: 1 }, true);

    this.vc = world.createVehicleController(this.body);
    const rest = 0.32, radius = 0.445;
    this.wheelRest.forEach((p, i) => {
      this.vc.addWheel({ x: p.x, y: p.y + rest, z: p.z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, rest, radius);
      this.vc.setWheelSuspensionStiffness(i, 26);
      this.vc.setWheelSuspensionCompression(i, 2.6);
      this.vc.setWheelSuspensionRelaxation(i, 3.2);
      this.vc.setWheelMaxSuspensionForce(i, 120000);
      this.vc.setWheelMaxSuspensionTravel(i, 0.3);
      this.vc.setWheelFrictionSlip(i, i < 2 ? 2.4 : 2.0);
      this.vc.setWheelSideFrictionStiffness(i, 1.0);
    });

    this.engine = audio.createEngine();
    this.audio = audio;
    this.driving = false; this.steer = 0; this.throttle = 0; this.rpm = 0;
    this.camPos = V(); this.camInit = false; this.camYaw = 0; this.locked = false;
    this.speed = 0;
  }

  get position() { const t = this.body.translation(); return V(t.x, t.y, t.z); }
  get quaternion() { const r = this.body.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); }
  get forward() { return V(1, 0, 0).applyQuaternion(this.quaternion); }
  /** where the driver gets in/out (left side, by the driver's door) */
  get doorPoint() { return V(0.45, 0, -1.9).applyQuaternion(this.quaternion).add(this.position).setY(0); }

  enter() { this.driving = true; this.camInit = false; }
  exit() { this.driving = false; }

  reset() {
    const p = this.position, f = this.forward; const yaw = Math.atan2(-f.z, f.x);
    this.body.setTranslation({ x: p.x, y: heightAt(p.x, p.z) + 1.2, z: p.z }, true);
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    this.body.setRotation(q, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** physics-rate update */
  step(h, input) {
    const fwdIn = this.driving && !this.locked ? input.axis('KeyS', 'KeyW') : 0;
    const steerIn = this.driving && !this.locked ? input.axis('KeyD', 'KeyA') : 0;
    const brake = this.driving && !this.locked && input.key('Space');
    const sp = this.vc.currentVehicleSpeed();
    this.speed = sp;
    // speed-sensitive steering
    const maxSteer = THREE.MathUtils.lerp(0.58, 0.2, THREE.MathUtils.clamp(Math.abs(sp) / 28, 0, 1));
    this.steer = THREE.MathUtils.damp(this.steer, steerIn * maxSteer, 6, h);
    let force = 0, brakeF = 0;
    if (fwdIn > 0) force = sp < -0.5 ? 0 : 5200, brakeF = sp < -0.5 ? 90 : 0;
    else if (fwdIn < 0) force = sp > 0.5 ? 0 : -3600, brakeF = sp > 0.5 ? 90 : 0;
    force *= THREE.MathUtils.clamp((24 - Math.abs(sp)) / 6, 0, 1); // top speed ~85 km/h
    if (brake) brakeF = 140;
    if (!this.driving) brakeF = 30;
    if (!fwdIn && !brake && this.driving) brakeF = 4; // engine braking
    this.throttle = THREE.MathUtils.damp(this.throttle, Math.abs(fwdIn), 8, h);
    for (let i = 0; i < 4; i++) {
      this.vc.setWheelSteering(i, i < 2 ? this.steer : 0);
      this.vc.setWheelEngineForce(i, i >= 2 ? force : force * 0.35); // 4x4, rear-biased
      this.vc.setWheelBrake(i, brakeF);
    }
    this.vc.updateVehicle(h);
    // arcade assist: keep it planted and kill some sideways slide
    const lv = this.body.linvel(), f = this.forward, right = V(0, 0, 1).applyQuaternion(this.quaternion);
    const side = lv.x * right.x + lv.y * right.y + lv.z * right.z;
    this.body.applyImpulse({ x: -right.x * side * 160, y: 0, z: -right.z * side * 160 }, true);
    // flipped? auto-right after a moment
    const up = V(0, 1, 0).applyQuaternion(this.quaternion);
    this.flippedT = up.y < 0.3 ? (this.flippedT || 0) + h : 0;
    if (this.flippedT > 2) this.reset();
  }

  /** frame-rate update: visuals, dust, sound, camera */
  update(dt, input, camera) {
    const t = this.body.translation(), r = this.body.rotation();
    this.root.position.set(t.x, t.y, t.z);
    this.root.quaternion.set(r.x, r.y, r.z, r.w);
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i]; if (!w) continue;
      const susp = this.vc.wheelSuspensionLength(i) ?? 0.32;
      w.position.y = this.wheelRestModel[i].y + 0.32 - susp;
      w.rotation.set(0, this.vc.wheelSteering(i) ?? 0, 0);
      w.rotateZ(this.vc.wheelRotation(i) ?? 0);
    }
    // dust from the rear tyres, more with speed and wheelspin
    const sp = Math.abs(this.speed);
    if (sp > 1.5 || (this.throttle > 0.5 && this.driving)) {
      const rate = Math.min(1, sp / 14) * 0.85 + this.throttle * 0.15;
      for (const i of [2, 3]) {
        if (!this.vc.wheelIsInContact(i) || Math.random() > rate) continue;
        const cp = this.vc.wheelContactPoint(i); if (!cp) continue;
        const back = this.forward.multiplyScalar(-sp * 0.25);
        this.dust.emit(V(cp.x, cp.y + 0.25, cp.z), V(back.x, 0.6 + Math.random() * 0.6, back.z), { sz: 1.0 + sp * 0.09, lf: 2.5 + sp * 0.12 });
      }
    }
    // engine
    const targetRpm = THREE.MathUtils.clamp(0.12 + (sp % 9) / 9 * 0.5 + this.throttle * 0.35, 0, 1);
    this.rpm = THREE.MathUtils.damp(this.rpm, this.driving ? targetRpm : 0, 4, dt);
    this.engine.set(this.rpm, this.throttle, this.driving || sp > 1);

    if (this.driving && camera) this.updateCamera(dt, input, camera);
  }

  updateCamera(dt, input, camera) {
    const m = input.takeMouse();
    this.camYaw = THREE.MathUtils.clamp(this.camYaw - m.x * 0.003, -2.6, 2.6);
    if (Math.abs(m.x) < 0.5) this.camYaw = THREE.MathUtils.damp(this.camYaw, 0, 1.2, dt);
    const p = this.position, f = this.forward.setY(0).normalize();
    const back = f.clone().negate().applyAxisAngle(V(0, 1, 0), this.camYaw);
    const sp = Math.abs(this.speed);
    const dist = 9.5 + sp * 0.08;
    const want = p.clone().addScaledVector(back, dist).add(V(0, 3.4, 0));
    const g = heightAt(want.x, want.z) + 1.2; if (want.y < g) want.y = g;
    if (!this.camInit) { this.camPos.copy(want); this.camInit = true; }
    this.camPos.lerp(want, 1 - Math.exp(-dt * 5));
    camera.position.copy(this.camPos);
    camera.lookAt(p.x + f.x * 3, p.y + 1.6, p.z + f.z * 3);
    camera.fov = THREE.MathUtils.damp(camera.fov, 50 + Math.min(sp, 30) * 0.35, 3, dt); camera.updateProjectionMatrix();
  }
}
