// Game entry point.
import * as THREE from 'three';
import { createRenderer, createPipeline, getQuality, setQuality } from './core/renderer.js';
import { world } from './assets/materialPatch.js';
import { startFarm } from './levels/farm/index.js';

const quality = getQuality();
const renderer = createRenderer(quality);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 4000);
const scene = new THREE.Scene();

const ui = document.getElementById('ui');
const debug = document.createElement('div'); debug.className = 'debug'; ui.appendChild(debug);

const game = { renderer, scene, camera, quality, high: quality === 'high', ui, world, setQuality };
const level = await startFarm(game);
const post = createPipeline(renderer, scene, camera, quality, { grade: level.grade });
game.post = post;
level.onPost?.(post);

const timer = new THREE.Timer(); timer.connect(document);
let frames = 0, acc = 0;
renderer.setAnimationLoop((t) => {
  timer.update(t);
  const dt = Math.min(timer.getDelta(), 0.05);
  world.uTime.value += dt;
  level.update(dt);
  post.composer.render(dt);
  frames++; acc += dt;
  if (acc > 0.5) { debug.textContent = `${Math.round(frames / acc)} fps · ${quality.toUpperCase()} · G toggles graphics`; frames = 0; acc = 0; }
});
addEventListener('keydown', (e) => { if (e.code === 'KeyG' && !e.repeat && !level.typing) setQuality(quality === 'high' ? 'low' : 'high'); });
window.__game = game; window.__level = level;
