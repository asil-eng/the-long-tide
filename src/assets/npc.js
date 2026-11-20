// Story characters: realistic scanned people (June, Wes, Ada, Dr. Okafor), each on its own rig,
// with motion-captured idle / sitting / walking / running clips retargeted onto their skeletons.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { patchModel } from './materialPatch.js';
import { retargetClip } from '../core/retarget.js';

const HEIGHT = { june: 1.38, wes: 1.7, ada: 1.6, okafor: 1.72 };

/** clip sources: { anims: gltf (idle/sit/...), walk: gltf, run: gltf } */
export class NPC {
  constructor(scene, models, who, pos, rotY = 0) {
    this.who = who;
    this.root = new THREE.Group();
    const model = SkeletonUtils.clone(models[who].scene);
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
      if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.transparent = false; o.material.alphaTest = o.material.alphaMap ? 0.5 : 0; }
    });
    // Wes's downloaded tee carries a printed graphic: make it a plain, faded work shirt instead
    if (who === 'wes') model.traverse((o) => { if (o.isMesh && /outfit_top/i.test(o.material.name)) { o.material.map = null; o.material.color.set('#5e6247'); o.material.roughness = 0.95; o.material.needsUpdate = true; } });
    patchModel(model, { dustTop: 0.12, dustLow: 0.25, dirtHeight: 0.3, fade: 0.08 });
    // stand it up if the rig came in lying down, then scale to the character's height
    this.inner = new THREE.Group(); this.inner.add(model); this.root.add(this.inner);
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model, true); const sz = box.getSize(new THREE.Vector3());
    if (sz.z > sz.y * 1.4) { model.rotation.x = -Math.PI / 2; model.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(model, true); }
    model.scale.multiplyScalar(HEIGHT[who] / (box.max.y - box.min.y));
    model.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(model, true);
    model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    this.model = model;
    this.root.position.copy(pos); this.root.rotation.y = rotY;
    scene.add(this.root);
    this.root.updateMatrixWorld(true);

    // retarget the clips onto this rig (while it is still in its rest pose)
    const src = (g, re) => g && g.animations.find((c) => re.test(c.name));
    const sources = {
      idle: [models.anims, src(models.anims, /_idle$/i)],
      sit: [models.anims, src(models.anims, /sitidle/i)],
      walk: [models.walk, models.walk?.animations[0]],
      run: [models.run, models.run?.animations[0]],
    };
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = {};
    for (const [k, [g, clip]] of Object.entries(sources)) {
      if (!g || !clip) continue;
      try { this.clips[k] = retargetClip(g.scene, clip, model, { name: k, inPlace: true }); }
      catch (e) { console.warn('[npc]', who, k, e.message); }
    }
    this.play('idle');
  }
  play(name, fade = 0.4) {
    const clip = this.clips[name]; if (!clip) return;
    const a = this.mixer.clipAction(clip);
    if (this.current === a) return;
    a.reset().fadeIn(fade).play(); a.time = Math.random() * clip.duration;
    if (this.current) this.current.fadeOut(fade);
    this.current = a;
  }
  set visible(v) { this.root.visible = v; }
  get visible() { return this.root.visible; }
  update(dt) { if (this.root.visible) this.mixer.update(dt); }
  lookAt(p) { this.root.rotation.y = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z); }
}
