// World-space animation retargeting between different humanoid rigs (Mixamo, RenderPeople, and the
// auto-rigged scans). Bones are matched by canonical name; each target bone is first aligned to the
// source bone's rest direction (so A-pose and T-pose rigs map cleanly), then follows the source's
// rotation away from its rest pose. Hips motion is scaled by leg length and optionally kept in place.
// The result is baked into an ordinary AnimationClip for the target skeleton.
import * as THREE from 'three';

export const CHILD = {
  Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head',
  LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand',
  RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase',
  RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase',
};
const ORDER = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
const RP = {
  hip: 'Hips', pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck: 'Neck', head: 'Head',
  shoulder_l: 'LeftShoulder', upperarm_l: 'LeftArm', lowerarm_l: 'LeftForeArm', hand_l: 'LeftHand',
  shoulder_r: 'RightShoulder', upperarm_r: 'RightArm', lowerarm_r: 'RightForeArm', hand_r: 'RightHand',
  upperleg_l: 'LeftUpLeg', lowerleg_l: 'LeftLeg', upperleg_r: 'RightUpLeg', lowerleg_r: 'RightLeg',
  thigh_l: 'LeftUpLeg', calf_l: 'LeftLeg', foot_l: 'LeftFoot', ball_l: 'LeftToeBase',
  thigh_r: 'RightUpLeg', calf_r: 'RightLeg', foot_r: 'RightFoot', ball_r: 'RightToeBase',
};

/** canonical humanoid bone name, or null */
export function canonName(raw) {
  let n = raw.replace(/_\d+$/, '');
  n = n.replace(/^mixamorig:?/i, '');
  if (ORDER.includes(n)) return n;
  for (const k of Object.keys(RP)) if (n === k || n.endsWith('_' + k)) return RP[k];
  return null;
}

/** map canonical name -> bone (first match) */
export function boneMap(root) {
  const m = {};
  root.traverse((o) => { if (o.isBone) { const c = canonName(o.name); if (c && !m[c]) m[c] = o; } });
  return m;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
/** body frame from the current pose: X = character's left, Y = up, Z = forward */
function bodyFrame(B) {
  const hips = B.Hips.getWorldPosition(new THREE.Vector3());
  const head = (B.Head || B.Neck).getWorldPosition(new THREE.Vector3());
  const left = B.LeftUpLeg.getWorldPosition(new THREE.Vector3()).sub(B.RightUpLeg.getWorldPosition(_v));
  const up = head.sub(hips).normalize();
  const x = left.addScaledVector(up, -left.dot(up)).normalize();
  const z = new THREE.Vector3().crossVectors(x, up).normalize();
  const m = new THREE.Matrix4().makeBasis(x, up, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function restInfo(root, B) {
  root.updateMatrixWorld(true);
  const F = bodyFrame(B), Fi = F.clone().invert();
  const rel = {}, dir = {};
  for (const k of ORDER) {
    const b = B[k]; if (!b) continue;
    rel[k] = Fi.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    const c = B[CHILD[k]];
    if (c) dir[k] = c.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(_v2)).applyQuaternion(Fi).normalize();
  }
  const hipH = B.Hips.getWorldPosition(new THREE.Vector3()).y - Math.min(
    (B.LeftFoot || B.Hips).getWorldPosition(_v).y, (B.RightFoot || B.Hips).getWorldPosition(_v2).y);
  return { F, Fi, rel, dir, hipPos: B.Hips.getWorldPosition(new THREE.Vector3()).applyQuaternion(Fi), hipH: Math.max(hipH, 0.05) };
}

/**
 * Bake `clip` (playing on `srcRoot`) onto the skeleton under `tgtRoot`.
 * Both roots must be in their rest pose when called.
 */
export function retargetClip(srcRoot, clip, tgtRoot, { fps = 30, inPlace = true, name = clip.name, keepY = true } = {}) {
  const SB = boneMap(srcRoot), TB = boneMap(tgtRoot);
  if (!SB.Hips || !TB.Hips || !SB.LeftUpLeg || !TB.LeftUpLeg) throw new Error('retarget: missing core bones');
  // save target rest locals (we pose the target while baking and restore it after)
  const saved = new Map(); tgtRoot.traverse((o) => { if (o.isBone) saved.set(o, [o.position.clone(), o.quaternion.clone()]); });
  const SR = restInfo(srcRoot, SB), TR = restInfo(tgtRoot, TB);
  const align = {};
  for (const k of ORDER) {
    if (!TB[k] || !SB[k]) continue;
    align[k] = (TR.dir[k] && SR.dir[k]) ? new THREE.Quaternion().setFromUnitVectors(TR.dir[k], SR.dir[k]) : new THREE.Quaternion();
  }
  const scale = TR.hipH / SR.hipH;
  const mixer = new THREE.AnimationMixer(srcRoot); const action = mixer.clipAction(clip); action.play();
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(frames);
  const qv = {}; for (const k of ORDER) if (TB[k] && SB[k]) qv[k] = new Float32Array(frames * 4);
  const pv = new Float32Array(frames * 3);
  const q = new THREE.Quaternion(), pw = new THREE.Quaternion();
  let hip0 = null;
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / fps); times[f] = t;
    action.time = t; mixer.update(0); srcRoot.updateMatrixWorld(true);
    // target body frame stays its rest frame; source frame is its rest frame (so turning in the clip is kept)
    for (const k of ORDER) {
      if (!qv[k]) continue;
      const sRel = SR.Fi.clone().multiply(SB[k].getWorldQuaternion(q));
      const delta = sRel.multiply(SR.rel[k].clone().invert());
      const tRel = delta.multiply(align[k]).multiply(TR.rel[k]);
      const tWorld = TR.F.clone().multiply(tRel);
      const b = TB[k]; b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(pw);
      b.quaternion.copy(pw.invert().multiply(tWorld)); b.updateMatrixWorld(true);
      b.quaternion.toArray(qv[k], f * 4);
    }
    // hips translation, scaled to the target's leg length
    const sp = SB.Hips.getWorldPosition(new THREE.Vector3()).applyQuaternion(SR.Fi);
    if (!hip0) hip0 = sp.clone();
    const d = sp.sub(SR.hipPos).multiplyScalar(scale);
    if (inPlace) { d.x = 0; d.z = 0; }
    if (!keepY) d.y = 0;
    const tw = TR.hipPos.clone().add(d).applyQuaternion(TR.F);
    const hb = TB.Hips; hb.parent.updateMatrixWorld(true);
    const local = hb.parent.worldToLocal(tw);
    local.toArray(pv, f * 3);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(srcRoot);
  for (const [b, [p, r]] of saved) { b.position.copy(p); b.quaternion.copy(r); }
  tgtRoot.updateMatrixWorld(true);
  const tracks = [];
  for (const k of Object.keys(qv)) tracks.push(new THREE.QuaternionKeyframeTrack(`${TB[k].name}.quaternion`, times, qv[k]));
  tracks.push(new THREE.VectorKeyframeTrack(`${TB.Hips.name}.position`, times, pv));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}
