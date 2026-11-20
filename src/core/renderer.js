// Renderer + post-processing pipeline with a Low/High graphics setting.
// High: N8AO, bloom, ACES, grade, vignette, SMAA. Low: bloom, ACES, grade, vignette at lower resolution.
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, SMAAEffect, SMAAPreset,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { GradeEffect } from './grade.js';

export function getQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'high') return q;
  try { return localStorage.getItem('quality') || 'high'; } catch { return 'high'; }
}
export function setQuality(q) {
  try { localStorage.setItem('quality', q); } catch { /* private mode */ }
  const u = new URL(location.href); u.searchParams.set('q', q); location.href = u.toString();
}

export function createRenderer(quality) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, depth: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.5 : 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in post
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

export function createPipeline(renderer, scene, camera, quality, { grade = {}, bloom = {}, ao = {} } = {}) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  let aoPass = null;
  composer.addPass(new RenderPass(scene, camera));
  if (quality === 'high') {
    aoPass = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
    Object.assign(aoPass.configuration, {
      aoRadius: 2.0, distanceFalloff: 1.0, intensity: 2.2, color: new THREE.Color('#2a1d16'),
      halfRes: true, depthAwareUpsampling: true, gammaCorrection: false, ...ao,
    });
    aoPass.setQualityMode('Medium');
    composer.addPass(aoPass);
  }
  const bloomFx = new BloomEffect({ luminanceThreshold: 0.92, luminanceSmoothing: 0.12, intensity: 0.7, mipmapBlur: true, radius: 0.72, ...bloom });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const gradeFx = new GradeEffect(grade);
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
  composer.addPass(new EffectPass(camera, bloomFx, tone, gradeFx, vignette));
  if (quality === 'high') composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  return { composer, aoPass, bloomFx, tone, gradeFx, vignette };
}
