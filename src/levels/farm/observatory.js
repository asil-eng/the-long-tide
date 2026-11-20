// The half-buried observatory at the end of the east road: a ribbed corrugated dome sunk into the
// hillside, a concrete bunker entrance with a lit door, the dish, and a floodlit chain-link compound.
import * as THREE from 'three';
import { patchMaterial, patchModel } from '../../assets/materialPatch.js';
import { heightAt } from '../../assets/terrain.js';

const tl = new THREE.TextureLoader();
function pbr(name, rep, color) {
  const t = (s, srgb) => { const x = tl.load(`/textures/${name}/${name}_${s}.jpg`); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(...rep); x.anisotropy = 8; if (srgb) x.colorSpace = THREE.SRGBColorSpace; return x; };
  const m = new THREE.MeshStandardMaterial({ map: t('diff', true), normalMap: t('nor'), roughnessMap: t('rough'), metalness: 0.2 });
  if (color) m.color.set(color);
  return m;
}

export const OBS = { center: new THREE.Vector3(176, 0, -170), gate: new THREE.Vector3(160, 0, -164) };

export function buildObservatory(scene, M) {
  const g = new THREE.Group();
  const c = OBS.center; const base = heightAt(c.x, c.z);
  g.position.set(c.x, base, c.z); scene.add(g);
  const colliders = [];
  const ironM = pbr('corrugated_iron', [10, 3], '#c9c2b4'); ironM.side = THREE.DoubleSide;
  const iron = patchMaterial(ironM, { dustTop: 0.55, dustLow: 0.6, dirtHeight: 2.5, fade: 0.4 });
  const rust = patchMaterial(pbr('rusty_metal_02', [3, 3], '#b8a28a'), { dustTop: 0.5, dustLow: 0.6, dirtHeight: 1.5, fade: 0.35 });
  const concrete = patchMaterial(pbr('painted_plaster_wall', [4, 2], '#8f8574'), { dustTop: 0.5, dustLow: 0.8, dirtHeight: 1.6, fade: 0.3 });

  // dome: lathed profile with a slot, sunk 2.5 m into the ground
  const prof = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI / 2; prof.push(new THREE.Vector2(Math.cos(a) * 9, Math.sin(a) * 9 - 2.5)); }
  const dome = new THREE.Mesh(new THREE.LatheGeometry(prof, 64, 0.25, Math.PI * 2 - 0.5), iron);
  dome.rotation.y = -0.6; dome.castShadow = dome.receiveShadow = true; g.add(dome);
  // ribs on the dome
  for (let k = 0; k < 16; k++) {
    const pts = prof.map((p) => new THREE.Vector3(p.x * 1.01, p.y, 0));
    const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.09, 5), rust);
    rib.rotation.y = (k / 16) * Math.PI * 2; rib.castShadow = true; g.add(rib);
  }
  // the open observing slot glows faintly from inside at night
  const slotLight = new THREE.PointLight('#ffb77a', 0, 22, 1.6); slotLight.position.set(0, 4, 0); g.add(slotLight);
  // concrete ring wall
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10.4, 2.6, 64, 1, false), concrete); ring.position.y = -0.55; ring.receiveShadow = ring.castShadow = true; g.add(ring);
  colliders.push({ kind: 'cyl', pos: new THREE.Vector3(c.x, base + 2, c.z), r: 9.7, h: 6 });

  // bunker entrance facing the gate
  const bunker = new THREE.Group(); bunker.position.set(-11, 0, 2.5); bunker.rotation.y = 0.45; g.add(bunker);
  const blk = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; bunker.add(b); return b; };
  blk(5, 3.2, 4, 0, 1.4, 0, concrete); blk(5.6, 0.35, 4.6, 0, 3.15, 0, concrete);
  const door = blk(1.4, 2.2, 0.12, -2.53, 1.1, 0, rust); door.rotation.y = Math.PI / 2;
  const doorLamp = new THREE.PointLight('#ffcf8a', 0, 9, 1.5); doorLamp.position.set(-2.9, 2.6, 0); bunker.add(doorLamp);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe4b0' })); lampGlow.position.copy(doorLamp.position); bunker.add(lampGlow);
  bunker.updateMatrixWorld(true);
  const bw = new THREE.Vector3(); bunker.getWorldPosition(bw);
  colliders.push({ kind: 'box', pos: new THREE.Vector3(bw.x, bw.y + 1.6, bw.z), half: new THREE.Vector3(2.6, 1.7, 2.1), rotY: 0.45 });

  // the dish on a pad
  const dish = M.dish.clone(); dish.position.set(10, 0, -12); dish.rotation.y = 2.2; g.add(dish);
  colliders.push({ kind: 'cyl', pos: new THREE.Vector3(c.x + 10, base + 3, c.z - 12), r: 2.0, h: 6 });

  // chain-link compound with a gate gap toward the road
  const R = 24, panels = 16;
  const gateAng = Math.atan2(OBS.gate.z - c.z, OBS.gate.x - c.x);
  for (let k = 0; k < panels; k++) {
    const a = (k / panels) * Math.PI * 2 + gateAng + Math.PI / panels;
    let da = Math.atan2(Math.sin(a - gateAng), Math.cos(a - gateAng));
    if (Math.abs(da) < 0.25) continue;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const f = M.chainfence.clone(); f.position.set(x, heightAt(c.x + x, c.z + z) - base, z); f.rotation.y = -a; g.add(f);
    colliders.push({ kind: 'box', pos: new THREE.Vector3(c.x + x, base + 1.1, c.z + z), half: new THREE.Vector3(0.12, 1.1, 4.9), rotY: -a });
  }
  // floodlights on poles, pointing inward
  const floods = [];
  for (const a of [gateAng + 0.35, gateAng - 0.35, gateAng + 2.4, gateAng - 2.4]) {
    const x = Math.cos(a) * (R - 1.5), z = Math.sin(a) * (R - 1.5);
    const f = M.floodlight.clone(); f.position.set(x, heightAt(c.x + x, c.z + z) - base, z); f.rotation.y = -a + Math.PI / 2; g.add(f);
    const s = new THREE.SpotLight('#f2e6d2', 0, 45, 0.7, 0.6, 1.3); s.position.set(x * 0.98, 4.4, z * 0.98); s.target.position.set(x * 0.2, 0, z * 0.2);
    g.add(s, s.target); floods.push(s);
  }
  // clutter: crates and barrels by the bunker
  const put = (m, x, z, r = 0, s = 1) => { const o = M[m].clone(); o.scale.setScalar(s); o.rotation.y = r; o.position.set(x, heightAt(c.x + x, c.z + z) - base, z); g.add(o); };
  put('crate', -14, 6, 0.3); put('crate', -14.5, 7.4, 1.1, 0.9); put('barrel', -12.5, 7.8); put('barrel', -16, 5.2, 0.6);

  for (const k of ['dish', 'chainfence', 'floodlight']) patchModel(M[k], { dustTop: 0.45, dustLow: 0.6, dirtHeight: 1.2, fade: 0.35 });

  return {
    group: g, colliders,
    okaforSpot: new THREE.Vector3(OBS.gate.x + 3, 0, OBS.gate.z - 1),
    setNight(on) { floods.forEach((s) => { s.intensity = on ? 110 : 0; }); doorLamp.intensity = on ? 14 : 0; slotLight.intensity = on ? 30 : 0; },
  };
}
