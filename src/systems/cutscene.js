// Cutscenes: camera paths (Catmull-Rom through keyframes, with look targets), letterbox bars,
// timed subtitles synced to optional audio, and locked controls for the duration.
// await cutscene.play({ shots: [{ path:[[x,y,z],...], look:[[x,y,z],...]|[x,y,z], dur, fov, ease }],
//                       subs: [{ t, who, text, dur, voice }], onStart, onEnd, fadeIn, fadeOut })
import * as THREE from 'three';

export function createCutscenes(ui, camera, input, audio) {
  const bars = document.createElement('div'); bars.className = 'bars'; bars.style.cssText = 'position:absolute;inset:0;';
  const sub = document.createElement('div'); sub.className = 'subtitle';
  const fade = document.createElement('div'); fade.className = 'fade';
  const card = document.createElement('div'); card.className = 'card';
  ui.append(bars, sub, fade, card);
  let running = null;
  const ease = { linear: (t) => t, inOut: (t) => t * t * (3 - 2 * t), out: (t) => 1 - (1 - t) * (1 - t) };

  function setFade(v, color = '#000', secs = 1) { fade.style.transition = `opacity ${secs}s`; fade.style.background = color; fade.style.opacity = v; }
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

  async function showCard(text, secs = 3) {
    card.innerHTML = text; card.classList.add('on'); await wait(secs); card.classList.remove('on'); await wait(1.2);
  }

  function play(cs) {
    return new Promise((resolve) => {
      const shots = cs.shots.map((s) => ({
        ...s,
        curve: new THREE.CatmullRomCurve3(s.path.map((p) => new THREE.Vector3(...p)), false, 'centripetal'),
        lookCurve: Array.isArray(s.look?.[0]) ? new THREE.CatmullRomCurve3(s.look.map((p) => new THREE.Vector3(...p))) : null,
        lookFixed: s.look && !Array.isArray(s.look[0]) ? new THREE.Vector3(...s.look) : null,
      }));
      const total = shots.reduce((a, s) => a + s.dur, 0);
      const subs = (cs.subs || []).map((s) => ({ ...s, shown: false, hidden: false }));
      input.state.enabled = false;
      if (document.pointerLockElement) document.exitPointerLock();
      bars.classList.add('on');
      cs.onStart?.();
      if (cs.fadeIn) { setFade(1, cs.fadeColor, 0); requestAnimationFrame(() => setFade(0, cs.fadeColor, cs.fadeIn)); }
      const prevFov = camera.fov;
      let t = 0, fadedOut = false;
      running = (dt) => {
        t += dt;
        if (cs.skippable !== false && input.hit('Escape')) t = total;
        // which shot?
        let acc = 0, s = shots[shots.length - 1], lt = 1;
        for (const sh of shots) { if (t < acc + sh.dur) { s = sh; lt = (t - acc) / sh.dur; break; } acc += sh.dur; }
        const k = (ease[s.ease] || ease.inOut)(THREE.MathUtils.clamp(lt, 0, 1));
        camera.position.copy(s.curve.getPoint(k));
        const look = s.lookCurve ? s.lookCurve.getPoint(k) : s.lookFixed || s.curve.getPoint(Math.min(1, k + 0.02));
        camera.lookAt(look);
        if (s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
        s.onUpdate?.(k, dt);
        // subtitles
        for (const su of subs) {
          if (!su.shown && t >= su.t) {
            su.shown = true; sub.innerHTML = (su.who ? `<b>${su.who}</b>` : '') + su.text; sub.classList.add('on');
            if (su.voice) audio.playFile(su.voice);
          }
          if (su.shown && !su.hidden && t >= su.t + (su.dur || 3.2)) { su.hidden = true; sub.classList.remove('on'); }
        }
        if (cs.fadeOut && !fadedOut && t > total - cs.fadeOut) { fadedOut = true; setFade(1, cs.fadeColor, cs.fadeOut); }
        if (t >= total) {
          running = null; sub.classList.remove('on'); bars.classList.remove('on');
          camera.fov = prevFov; camera.updateProjectionMatrix();
          input.state.enabled = true;
          cs.onEnd?.();
          resolve();
        }
      };
    });
  }

  return { play, showCard, setFade, wait, get running() { return !!running; }, update(dt) { running?.(dt); } };
}
