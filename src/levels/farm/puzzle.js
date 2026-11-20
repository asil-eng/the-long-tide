// The tape puzzle: June's radio clicks live (top row, with a sweeping playhead and audio), the
// payload's tape log shows the same pattern recorded at the wrong speed and offset (bottom row).
// A/D shift the tape, W/S change its speed. Hold a close match to lock it in.
const PATTERN = [0, 0.7, 1.4, 1.85, 2.15, 3.2, 3.5, 3.8, 4.5, 5.2]; // three slow, two fast, ... (seconds)
const LOOP = 6;

export function runTapePuzzle(ui, input, audio, helpText) {
  const el = document.createElement('div'); el.className = 'puzzle';
  el.innerHTML = `<h3>JUNE'S RADIO · PAYLOAD TAPE</h3><canvas width="1540" height="380"></canvas><div class="lock"><b></b></div><div class="help">${helpText}</div>`;
  ui.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), lockBar = el.querySelector('.lock b');
  let speed = 1.62, offset = 1.35, t = 0, lock = 0, lastBeat = -1;
  return new Promise((resolve) => {
    let raf;
    let prev = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now; t += dt;
      // controls
      const dn = new Set(); for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) if (keys.has(k)) dn.add(k);
      offset += ((dn.has('KeyD') ? 1 : 0) - (dn.has('KeyA') ? 1 : 0)) * dt * 0.9;
      speed += ((dn.has('KeyW') ? 1 : 0) - (dn.has('KeyS') ? 1 : 0)) * dt * 0.45;
      speed = Math.min(2.2, Math.max(0.5, speed)); offset = Math.min(3, Math.max(-3, offset));
      // live clicks
      const lt = t % LOOP; const beat = PATTERN.findIndex((p) => Math.abs(p - lt) < dt * 0.6 + 0.01);
      if (beat >= 0 && beat !== lastBeat) { audio.tone(1300, 0.03, 0.09, 'square'); lastBeat = beat; }
      if (beat < 0) lastBeat = -1;
      // match quality
      const err = PATTERN.reduce((a, p) => a + Math.abs(p * speed + offset - p), 0) / PATTERN.length;
      const good = err < 0.12;
      lock = Math.max(0, Math.min(1, lock + (good ? dt / 1.6 : -dt * 1.5)));
      lockBar.style.width = `${lock * 100}%`;
      draw(lt, err);
      if (lock >= 1) { el.classList.remove('on'); setTimeout(() => el.remove(), 500); cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); audio.tone(660, 0.4, 0.12, 'sine'); resolve(); return; }
      raf = requestAnimationFrame(frame);
    };
    const keys = new Set(); const kd = (e) => keys.add(e.code), ku = (e) => keys.delete(e.code);
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    raf = requestAnimationFrame(frame);
  });

  function draw(lt, err) {
    const W = cv.width, H = cv.height, padL = 150, span = W - padL - 30, sx = (s) => padL + (s / LOOP) * span;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(240,200,150,0.06)'; g.fillRect(padL, 40, span, 120); g.fillRect(padL, 220, span, 120);
    g.font = '600 22px ui-monospace, Menlo, monospace'; g.fillStyle = '#cdb699';
    g.fillText('LIVE', 30, 108); g.fillText('TAPE', 30, 288);
    // grid
    g.strokeStyle = 'rgba(240,200,150,0.08)'; g.lineWidth = 2;
    for (let s = 0; s <= LOOP; s += 0.5) { g.beginPath(); g.moveTo(sx(s), 40); g.lineTo(sx(s), 340); g.stroke(); }
    // live marks + playhead
    for (const p of PATTERN) {
      const hot = Math.max(0, 1 - Math.abs(lt - p) * 4);
      g.fillStyle = `rgba(240,180,110,${0.55 + hot * 0.45})`; g.fillRect(sx(p) - 4, 60, 8, 80);
      if (hot > 0) { g.shadowColor = '#f0b46e'; g.shadowBlur = 24 * hot; g.fillRect(sx(p) - 4, 60, 8, 80); g.shadowBlur = 0; }
    }
    g.fillStyle = 'rgba(255,240,220,0.35)'; g.fillRect(sx(lt) - 1, 40, 2, 120);
    // tape marks (scratched, uneven, like a real tape log)
    for (const [i, p] of PATTERN.entries()) {
      const x = p * speed + offset; if (x < -0.2 || x > LOOP + 0.2) continue;
      g.fillStyle = 'rgba(214,200,170,0.85)'; g.fillRect(sx(x) - 3, 240 + (i % 3) * 4, 6, 76 - (i % 2) * 8);
    }
    // alignment hint: faint lines from live to tape
    g.strokeStyle = err < 0.12 ? 'rgba(240,180,110,0.7)' : 'rgba(240,200,150,0.12)';
    for (const p of PATTERN) { const x = p * speed + offset; g.beginPath(); g.moveTo(sx(p), 140); g.lineTo(sx(x), 240); g.stroke(); }
  }
}
