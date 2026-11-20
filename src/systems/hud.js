// Objective line (top-left), a signal-strength meter for the balloon chase, and a chapter card.
export function createHUD(ui) {
  const obj = document.createElement('div'); obj.className = 'objective'; obj.innerHTML = '<small>OBJECTIVE</small><span></span>';
  const meter = document.createElement('div'); meter.className = 'meter';
  meter.innerHTML = '<small>SIGNAL</small><div class="bars">' + '<i></i>'.repeat(10) + '</div>';
  ui.append(obj, meter);
  const bars = [...meter.querySelectorAll('i')];
  const bark = document.createElement('div'); bark.className = 'subtitle'; bark.style.bottom = '18vh'; ui.append(bark);
  let barkT = null;
  const mark = document.createElement('div'); mark.className = 'marker'; mark.innerHTML = '<i></i><span></span>'; ui.append(mark);
  return {
    /** a world-space marker: pass {x,y} in 0..1 screen space (or null) and a distance label */
    marker(p, label = '') {
      if (!p) { mark.classList.remove('on'); return; }
      mark.classList.add('on'); mark.classList.toggle('edge', !!p.edge);
      mark.style.left = `${p.x * 100}%`; mark.style.top = `${p.y * 100}%`;
      mark.querySelector('span').textContent = label;
    },
    /** a spoken line that doesn't lock the controls */
    say(who, text, dur = 3.4) {
      bark.innerHTML = (who ? `<b>${who}</b>` : '') + text; bark.classList.add('on');
      clearTimeout(barkT); barkT = setTimeout(() => bark.classList.remove('on'), dur * 1000);
      return new Promise((r) => setTimeout(r, dur * 1000));
    },
    objective(text) {
      if (!text) { obj.classList.remove('on'); return; }
      obj.classList.remove('on');
      setTimeout(() => { obj.querySelector('span').textContent = text; obj.classList.add('on'); }, 250);
    },
    meter(v) {
      if (v === null) { meter.classList.remove('on'); return; }
      meter.classList.add('on');
      const n = Math.round(v * 10);
      bars.forEach((b, i) => b.classList.toggle('lit', i < n));
    },
  };
}
