// Farm look-development scene: a 60x60 m patch at hazy golden hour.
// Open /lookdev-farm.html  (?view=corn|road|wide, ?q=low|high). Keys: 1/2/3 views, G toggles quality.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createRenderer, createPipeline, getQuality, setQuality } from '../../core/renderer.js';
import { world, patchModel } from '../../assets/materialPatch.js';
import { createCornField } from '../../assets/corn.js';
import { createGround, roadX } from '../../assets/ground.js';
import { createSky } from '../../assets/sky.js';
import { createDust } from '../../assets/dust.js';
import { createGrass } from '../../assets/grass.js';

const quality = getQuality();
const HIGH = quality === 'high';
const renderer = createRenderer(quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 4000);

// ---------- palette & atmosphere ----------
const sunDir = new THREE.Vector3(0.62, 0.2, 0.76).normalize();
world.uSunDir.value.copy(sunDir);
world.uSunColor.value.set('#ffad6a');
world.uFogColor.value.set('#d2a682');
world.uFogSunColor.value.set('#f6cc92');
world.uFogDensity.value = 0.0065;
world.uFogFalloff.value = 0.06;
world.uDustColor.value.set('#c7a985');

scene.add(createSky({ zenith: '#8c6e5e', horizon: '#e4b68c' }));

const sun = new THREE.DirectionalLight(world.uSunColor.value, 7.5);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(HIGH ? 2048 : 1024);
const S = 24;
Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 140 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);

new HDRLoader().load('/hdri/kloppenheim_06_puresky_2k.hdr', (hdr) => {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.26;
  hdr.dispose(); pmrem.dispose();
});

// ---------- ground, road, corn ----------
const eastField = { x0: 7.8, x1: 31, z0: -31, z1: 31 };
const westField = { x0: -31, x1: -22, z0: -31, z1: 31 };
const farEast = { x0: 31, x1: 95, z0: -110, z1: 110 };
const farWest = { x0: -95, x1: -31, z0: -110, z1: 110 };
scene.add(createGround({ fields: [eastField, westField, farEast, farWest] }));

const nearRoad = (x, z) => Math.abs(x - roadX(z)) < 4.2;
const corn = createCornField({ rects: [eastField, westField], detail: 1, plantSpacing: HIGH ? 0.3 : 0.45, exclude: nearRoad, seed: 5 });
const cornFar = createCornField({ rects: [farEast, farWest], detail: 0, plantSpacing: HIGH ? 0.55 : 0.9, seed: 9 });
cornFar.castShadow = false;
scene.add(corn, cornFar);
console.log('corn instances', corn.userData.count, '+', cornFar.userData.count, 'tris/plant', corn.userData.tris, cornFar.userData.tris);

// ---------- models ----------
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const load = (n) => new Promise((res, rej) => loader.load(`/models/${n}.glb`, (g) => res(g.scene), undefined, rej));

const props = Promise.all([load('farmhouse'), load('truck'), load('fence'), load('utility_pole')]).then(([house, truck, fence, pole]) => {
  patchModel(house, { dustTop: 0.55, dustLow: 1.0, dirtHeight: 2.0, fade: 0.3 }, (m) => { m.color.set('#d6c8b2'); return null; });
  house.position.set(-13.5, 0, -4); house.rotation.y = Math.PI / 2;
  scene.add(house);

  patchModel(truck, { dustTop: 0.7, dustLow: 0.95, dirtHeight: 1.1, fade: 0.5 }, (m) => {
    if (/glass/i.test(m.name)) return { dustTop: 0.3, dustLow: 0.4, fade: 0 };
    if (/plast/i.test(m.name)) { m.color.set('#2b2622'); return { fade: 0.35 }; }
    if (/dodge/i.test(m.name)) m.color.set('#f2e6d8');
    return null;
  });
  truck.position.set(-3.0, 0, 4.5); truck.rotation.y = 0.85;
  scene.add(truck);

  // fence along the yard side of the road
  patchModel(fence, { dustTop: 0.35, dustLow: 0.7, dirtHeight: 0.5, fade: 0.3 });
  for (let z = -29; z < 29; z += 2.4) {
    if (z > 1 && z < 9) continue; // driveway gap
    const f = fence.clone();
    const x = roadX(z + 1.2) - 3.6;
    f.position.set(x, 0, z + 1.2);
    f.rotation.y = Math.atan2(roadX(z + 2.4) - roadX(z), 2.4) * -1;
    f.rotation.z = (Math.random() - 0.5) * 0.04;
    scene.add(f);
  }

  // utility poles marching along the road to the horizon
  patchModel(pole, { dustTop: 0.2, dustLow: 0.5, dirtHeight: 1.0, fade: 0.3 });
  for (let z = -340; z <= 340; z += 26.2) {
    const p = pole.clone();
    p.position.set(roadX(z) + 4.2, 0, z + 6);
    scene.add(p);
  }
});

// ---------- dry grass & weeds: along the fence, field edges, around the house ----------
const inField = (x, z) => [eastField, westField].some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1);
scene.add(createGrass({
  area: { x0: -40, x1: 40, z0: -40, z1: 40 }, tries: HIGH ? 60000 : 25000,
  density: (x, z) => {
    if (inField(x, z)) return 0.04;
    const dr = Math.abs(x - roadX(z));
    if (dr < 2.6) return 0.0;                            // the road itself
    if (dr < 4.4) return 0.32;                           // road shoulders and fence line
    if (Math.abs(x - eastField.x0) < 1.2 || Math.abs(x - westField.x1) < 1.4) return 0.7; // field edges
    const hx = x + 13.5, hz = z + 4;
    if (Math.abs(hx) < 6.5 && Math.abs(hz) < 7.5) return 0.0; // house footprint
    return 0.025;
  },
}));

// ---------- yard props ----------
Promise.all([load('barrel'), load('crate'), load('tyre')]).then(([barrel, crate, tyre]) => {
  const place = (o, x, z, ry = 0, rx = 0) => {
    const c = o.clone(); patchModel(c, { dustTop: 0.6, dustLow: 0.8, dirtHeight: 0.6, fade: 0.35 });
    c.rotation.set(rx, ry, 0); c.position.set(x, 0, z); c.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(c); c.position.y -= b.min.y; scene.add(c);
  };
  place(barrel, -6.4, -9.2, 0.3); place(barrel, -5.6, -9.9, 1.2);
  place(crate, -6.8, -7.8, 0.4); place(crate, -7.0, -7.9, 1.1);
  place(tyre, -4.2, -8.6, 0.2, Math.PI / 2); place(tyre, -1.8, 0.6, 1.0, Math.PI / 2 - 0.1);
});

// ---------- dust ----------
const dust = createDust({ count: HIGH ? 5000 : 2000, box: 44, height: 10 });
scene.add(dust);

// ---------- post ----------
const post = createPipeline(renderer, scene, camera, quality, {
  grade: { saturation: 1.02, contrast: 1.12, shadowTint: [0.8, 0.96, 1.1], highlightTint: [1.08, 1.01, 0.84], lift: [0.012, 0.017, 0.024], gain: [1.2, 1.15, 1.06] },
});

// ---------- cameras ----------
const VIEWS = {
  corn: { pos: [8.6, 1.15, -12.5], target: [22, 1.9, 2] },
  road: { pos: [roadX(14), 1.7, 14], target: [-12, 3.2, -4] },
  wide: { pos: [-34, 13, 34], target: [2, 1, -6] },
};
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
function setView(name) {
  const v = VIEWS[name] || VIEWS.road;
  camera.position.set(...v.pos); controls.target.set(...v.target); controls.update();
}
setView(new URLSearchParams(location.search).get('view') || 'road');
window.__setView = setView;
addEventListener('keydown', (e) => {
  if (e.key === '1') setView('corn'); if (e.key === '2') setView('road'); if (e.key === '3') setView('wide');
  if (e.key === 'g' || e.key === 'G') setQuality(HIGH ? 'low' : 'high');
});

// ---------- HUD ----------
const hud = document.getElementById('hud');
let frames = 0, acc = 0, fps = 0;

// ---------- loop ----------
const clock = new THREE.Clock();
let ready = false, framesAfterLoad = 0;
props.then(() => { ready = true; });
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  world.uTime.value += dt;
  controls.update();
  // keep the shadow frustum tight around what the camera is looking at
  const focus = controls.target.clone().lerp(camera.position, 0.45); focus.y = 0;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sunDir, 70);
  post.composer.render(dt);
  frames++; acc += dt;
  if (acc > 0.5) { fps = Math.round(frames / acc); frames = 0; acc = 0; if (hud) hud.textContent = `${fps} fps · ${quality.toUpperCase()} (G to toggle) · 1/2/3 views`; }
  if (ready && ++framesAfterLoad === 30) window.__ready = true;
});
