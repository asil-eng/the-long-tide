// Corner HUD: years passed back home and the daughter's age. Hidden on the Farm.
// rate = home-years per real second (e.g. 3.5 / 60 on the water planet).
export function createTimeCounter(ui, { startAge = 10 } = {}) {
  const el = document.createElement('div'); el.className = 'timecounter';
  el.innerHTML = '<div>YEARS PASSED AT HOME</div><div class="big years">0.0</div><div style="margin-top:8px">HER AGE</div><div class="big age">10</div>';
  ui.appendChild(el);
  const yEl = el.querySelector('.years'), aEl = el.querySelector('.age');
  let years = 0, rate = 0;
  const render = () => { yEl.textContent = years.toFixed(years < 10 ? 2 : 1); aEl.textContent = Math.floor(startAge + years); };
  render();
  return {
    show(on = true) { el.classList.toggle('on', on); },
    setRate(r) { rate = r; },
    add(y) { years += y; render(); },
    get years() { return years; },
    set years(v) { years = v; render(); },
    update(dt) { if (rate) { years += rate * dt; render(); } },
  };
}
