// Procedural audio (WebAudio): ambient wind, footsteps on dry dirt, a diesel-ish truck engine,
// simple music pads, and playback of optional voice files for cutscenes.
// The AudioContext starts on the first user gesture (browser autoplay rules).

export function createAudio() {
  let ctx = null, master, sfx, amb, mus;
  const pending = [];
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfx = bus(1.0); amb = bus(0.55); mus = bus(0.35);
    pending.splice(0).forEach((f) => f());
  }
  function bus(v) { const g = ctx.createGain(); g.gain.value = v; g.connect(master); return g; }
  const start = () => { init(); ctx.resume(); };
  addEventListener('keydown', start); addEventListener('pointerdown', start);
  const whenReady = (f) => (ctx ? f() : pending.push(f));

  function noiseBuffer(sec = 2, brown = false) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function loopNoise(brown) { const s = ctx.createBufferSource(); s.buffer = noiseBuffer(3, brown); s.loop = true; s.start(); return s; }

  // ---------- ambient wind ----------
  let wind = null;
  function startWind(level = 0.5) {
    whenReady(() => {
      if (wind) { wind.g.gain.setTargetAtTime(level, ctx.currentTime, 1.5); return; }
      const src = loopNoise(true);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(g).connect(amb);
      // gusts: slow random modulation of filter and level
      const hiss = loopNoise(false); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      const hg = ctx.createGain(); hg.gain.value = 0.02; hiss.connect(hp).connect(hg).connect(amb);
      wind = { g, bp, hg, level };
      g.gain.setTargetAtTime(level, ctx.currentTime, 2);
      const gust = () => {
        if (!wind) return; const t = ctx.currentTime, k = Math.random();
        bp.frequency.setTargetAtTime(280 + k * 600, t, 1.2);
        g.gain.setTargetAtTime(wind.level * (0.6 + k * 0.8), t, 1.0);
        hg.gain.setTargetAtTime(0.01 + k * 0.035, t, 0.8);
        setTimeout(gust, 1500 + Math.random() * 3000);
      };
      gust();
    });
  }
  function setWind(level) { if (wind) { wind.level = level; } else startWind(level); }

  // ---------- footsteps ----------
  let stepBuf = null;
  function footstep(intensity = 0.5, surface = 'dirt') {
    if (!ctx) return;
    if (!stepBuf) stepBuf = noiseBuffer(0.25);
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = stepBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = surface === 'wood' ? 900 : 1800 + Math.random() * 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32 * intensity, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + (surface === 'wood' ? 0.12 : 0.2));
    s.connect(lp).connect(g).connect(sfx); s.start(t); s.stop(t + 0.25);
    if (surface === 'wood') { // hollow knock
      const o = ctx.createOscillator(); o.frequency.value = 110 + Math.random() * 30; const og = ctx.createGain();
      og.gain.setValueAtTime(0.12 * intensity, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(og).connect(sfx); o.start(t); o.stop(t + 0.1);
    }
  }

  // ---------- engine ----------
  function createEngine() {
    let nodes = null;
    whenReady(() => {
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const rum = loopNoise(true);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
      const g = ctx.createGain(); g.gain.value = 0;
      const rg = ctx.createGain(); rg.gain.value = 0.5;
      // firing pulses: amplitude modulation at the firing frequency
      const am = ctx.createGain(); const lfo = ctx.createOscillator(); lfo.type = 'sine'; const lfoG = ctx.createGain(); lfoG.gain.value = 0.45;
      lfo.connect(lfoG).connect(am.gain); am.gain.value = 0.6;
      o1.connect(am); o2.connect(am); rum.connect(rg).connect(am);
      am.connect(lp).connect(g).connect(sfx);
      o1.start(); o2.start(); lfo.start();
      nodes = { o1, o2, lp, g, lfo, rg };
    });
    return {
      set(rpm01, throttle, on) {
        if (!nodes) return; const t = ctx.currentTime;
        const f = 32 + rpm01 * 75;
        nodes.o1.frequency.setTargetAtTime(f, t, 0.06); nodes.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
        nodes.lfo.frequency.setTargetAtTime(f * 0.5, t, 0.06);
        nodes.lp.frequency.setTargetAtTime(260 + rpm01 * 900 + throttle * 500, t, 0.08);
        nodes.g.gain.setTargetAtTime(on ? 0.07 + throttle * 0.08 + rpm01 * 0.05 : 0, t, on ? 0.1 : 0.4);
      },
    };
  }

  // ---------- simple per-level music pads ----------
  let music = null;
  function playMusic(chord = [110, 164.8, 220, 277.2], level = 0.25) {
    whenReady(() => {
      stopMusic();
      const g = ctx.createGain(); g.gain.value = 0; g.connect(mus);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g);
      const osc = chord.flatMap((f) => [0, 4].map((det) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det - 2; o.connect(lp); o.start(); return o; }));
      g.gain.setTargetAtTime(level, ctx.currentTime, 3);
      music = { g, osc };
    });
  }
  function stopMusic(fade = 2) {
    if (!music || !ctx) return; const m = music; music = null;
    m.g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3); setTimeout(() => m.osc.forEach((o) => o.stop()), fade * 1500);
  }

  // ---------- optional voice/sfx files ----------
  const files = new Map();
  async function playFile(url, volume = 1) {
    if (!ctx) return null;
    try {
      if (!files.has(url)) files.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((a) => ctx.decodeAudioData(a)));
      const buf = await files.get(url);
      const s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = volume; s.connect(g).connect(sfx); s.start();
      return { duration: buf.duration, stop: () => s.stop() };
    } catch { files.delete(url); return null; }
  }

  function tone(freq = 880, dur = 0.08, vol = 0.15, type = 'sine') {
    if (!ctx) return; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(sfx); o.start(t); o.stop(t + dur + 0.02);
  }

  return { startWind, setWind, footstep, createEngine, playMusic, stopMusic, playFile, tone, get ctx() { return ctx; } };
}
