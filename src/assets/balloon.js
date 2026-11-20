// A sinking weather balloon: a lathed latex envelope (sun-bleached, slightly wrinkled, breathing in
// the wind), a sagging tether and the instrument payload. Follows a flight path across the fields.
import * as THREE from 'three';
import { patchMaterial } from './materialPatch.js';
import { heightAt } from './terrain.js';

export function createBalloon(scene, payloadModel) {
  const group = new THREE.Group();
  // teardrop profile, ~4 m tall: a weather balloon half-deflated as it sinks
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = t * Math.PI;
    const r = Math.sin(a) * (1.5 + 0.35 * Math.sin(a)) * (1 - 0.55 * Math.pow(1 - t, 3));
    pts.push(new THREE.Vector2(Math.max(0.03, r), -1.9 + t * 3.9 - Math.pow(1 - t, 4) * 0.4));
  }
  const geo = new THREE.LatheGeometry(pts, 48);
  const base = geo.attributes.position.array.slice();
  const envMat = new THREE.MeshPhysicalMaterial({ color: '#e8e2d6', roughness: 0.42, metalness: 0, transmission: 0, transparent: true, opacity: 0.93, sheen: 0.6, sheenColor: new THREE.Color('#fff1da'), side: THREE.DoubleSide });
  patchMaterial(envMat, { dustTop: 0.25, dustLow: 0, fade: 0.05, translucency: 0.6 });
  const env = new THREE.Mesh(geo, envMat); env.castShadow = true; env.position.y = 7.2; group.add(env);
  // tether: a sagging line from the neck to the payload
  const tether = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 5.3, 0), new THREE.Vector3(0.15, 2.8, 0.05), new THREE.Vector3(0, 0.45, 0)]), 16, 0.008, 4),
    new THREE.MeshStandardMaterial({ color: '#cfc2a8', roughness: 0.9 }));
  group.add(tether);
  const payload = payloadModel.clone(); group.add(payload);
  const beacon = new THREE.PointLight('#ff6a3a', 0, 6, 2); beacon.position.y = 0.6; group.add(beacon);
  group.scale.setScalar(1.35);
  scene.add(group);

  const path = new THREE.CatmullRomCurve3([[30, 22, -6], [48, 20, -24], [62, 17, -40], [84, 13, -52], [104, 8, -58], [118, 3, -61], [124, 0, -62]].map((p) => new THREE.Vector3(...p)));
  let progress = 0, landed = false, deflate = 0;
  const landPos = path.getPoint(1); landPos.y = heightAt(landPos.x, landPos.z);
  function place(t) {
    const p = path.getPoint(t);
    p.y = Math.max(p.y, 0) + heightAt(p.x, p.z);
    group.position.copy(p);
  }
  place(0);
  return {
    group, payload, landPos,
    get progress() { return progress; }, get landed() { return landed; },
    /** chaser: world position of the player/truck. The balloon drifts faster when it is being followed. */
    update(dt, chaser, time) {
      // breathing & wrinkling envelope
      const a = geo.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
        const w = 1 + Math.sin(time * 1.3 + y * 2.1 + Math.atan2(z, x) * 3) * 0.025 - deflate * (0.6 + 0.3 * Math.sin(y * 3 + x));
        a.setXYZ(i, x * w, y * (1 - deflate * 0.65), z * w);
      }
      a.needsUpdate = true; geo.computeVertexNormals();
      if (!landed) {
        const d = chaser ? chaser.distanceTo(group.position) : 999;
        const speed = d < 60 ? 0.02 : d < 110 ? 0.01 : 0.002; // waits for the player, never runs off
        progress = Math.min(1, progress + speed * dt);
        place(progress);
        group.rotation.y += dt * 0.15; env.rotation.z = Math.sin(time * 0.7) * 0.06;
        if (progress >= 1) landed = true;
      } else {
        deflate = Math.min(1, deflate + dt * 0.35);
        env.position.y = 7.2 - deflate * 5.6; env.rotation.z = deflate * 1.2;
        group.position.y = landPos.y;
        beacon.intensity = (Math.sin(time * 6) > 0.6 ? 3 : 0);
      }
    },
  };
}
