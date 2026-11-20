// Placeholder story characters: one rigged base mesh (the same Mixamo-style rig as the player),
// cloned per character, scaled to their height and "dressed" in code: boots, trousers or a dress,
// shirt, skin and hair painted by body height. Plays idle / sitting clips from the same file.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { patchMaterial } from './materialPatch.js';

const LOOKS = {
  june: { h: 1.36, boots: '#2e241d', legs: '#3c5170', shirt: '#8a3b2e', skin: '#c99a7c', hair: '#5a3824', dress: false },
  wes: { h: 1.68, boots: '#2a211b', legs: '#34435a', shirt: '#5a6142', skin: '#c49377', hair: '#4a3020' },
  ada: { h: 1.6, boots: '#2a221d', legs: '#3f4a44', shirt: '#4e5a52', skin: '#cfa58a', hair: '#bdb7aa', dress: true },
  okafor: { h: 1.74, boots: '#1f1b18', legs: '#2a2c30', shirt: '#3a3f4c', skin: '#6a4430', hair: '#1e1916' },
};

export class NPC {
  constructor(scene, animGltf, who, pos, rotY = 0) {
    const look = LOOKS[who];
    this.who = who;
    this.root = new THREE.Group();
    const model = SkeletonUtils.clone(animGltf.scene);
    this.root.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const s = look.h / (box.max.y - box.min.y);
    model.scale.multiplyScalar(s); model.position.y = -box.min.y * s;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    this.uniforms = { uBaseY: { value: 0 }, uH: { value: look.h } };
    const col = (k) => new THREE.Color(look[k]);
    patchMaterial(mat, {
      dustTop: 0.25, dustLow: 0.35, dirtHeight: 0.35, fade: 0.08,
      extraUniforms: {
        ...this.uniforms,
        cBoots: { value: col('boots') }, cLegs: { value: col('legs') }, cShirt: { value: col('shirt') }, cSkin: { value: col('skin') }, cHair: { value: col('hair') },
        uDress: { value: look.dress ? 1 : 0 },
      },
      fragPars: 'uniform float uBaseY; uniform float uH; uniform vec3 cBoots; uniform vec3 cLegs; uniform vec3 cShirt; uniform vec3 cSkin; uniform vec3 cHair; uniform float uDress;',
      beforeDust: /* glsl */ `
        {
          float y = (vFxWorldPos.y - uBaseY) / uH;
          vec3 c = cBoots;
          c = mix(c, uDress > 0.5 ? cShirt * 0.92 : cLegs, smoothstep(0.055, 0.07, y));
          float waist = uDress > 0.5 ? 0.3 : 0.47;
          c = mix(c, cShirt, smoothstep(waist - 0.01, waist + 0.01, y));
          c = mix(c, cSkin, smoothstep(0.82, 0.84, y));
          c = mix(c, cHair, smoothstep(0.935, 0.95, y));
          // fabric weave & wear so it isn't flat plastic
          float n = fx_fbm(vFxWorldPos * 38.0);
          c *= 0.9 + 0.2 * n;
          diffuseColor.rgb = c;
        }`,
    });
    model.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = animGltf.animations;
    this.play('idle');
    this.root.position.copy(pos); this.root.rotation.y = rotY;
    scene.add(this.root);
  }
  play(name, fade = 0.4) {
    const re = { idle: /_idle$/i, sit: /sitidle/i, walk: /walk/i, run: /run/i, standup: /standup/i, sitdown: /sitdown/i }[name] || new RegExp(name, 'i');
    const clip = this.clips.find((c) => re.test(c.name)); if (!clip) return;
    // strip root motion so characters stay where they're placed
    const c = clip.clone(); c.tracks = c.tracks.filter((t) => !/Hips.*\.position$/.test(t.name) || name === 'sit');
    const a = this.mixer.clipAction(c);
    a.reset().fadeIn(fade).play(); a.time = Math.random() * c.duration;
    if (this.current && this.current !== a) this.current.fadeOut(fade);
    this.current = a;
  }
  set visible(v) { this.root.visible = v; }
  update(dt) { this.uniforms.uBaseY.value = this.root.position.y; this.mixer.update(dt); }
  lookAt(p) { this.root.rotation.y = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z); }
}
