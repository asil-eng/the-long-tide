// Dialogue box with speaker names and a typing effect.
// await dialogue.play([{ who, text, voice? }, ...]) — Space / E / click advances (first press completes the line).
export function createDialogue(ui, input, audio) {
  const el = document.createElement('div'); el.className = 'dialogue';
  el.innerHTML = '<div class="who"></div><div class="line"></div><div class="more">SPACE ▸</div>';
  ui.appendChild(el);
  const who = el.querySelector('.who'), line = el.querySelector('.line');
  let active = null;

  function advancePressed() { return input.hit('Space') || input.hit('KeyE') || input.hit('Enter') || input.hit('Mouse0'); }

  async function playLine(l) {
    who.textContent = l.who || ''; line.textContent = ''; el.classList.remove('done'); el.classList.add('on');
    const voice = l.voice ? await audio.playFile(l.voice) : null;
    const chars = [...l.text]; let shown = 0;
    const cps = l.cps || 42;
    return new Promise((resolve) => {
      active = (dt) => {
        if (shown < chars.length) {
          shown = Math.min(chars.length, shown + dt * cps);
          const n = Math.floor(shown);
          line.textContent = chars.slice(0, n).join('');
          if (n % 3 === 0 && !voice) audio.tone(520 + Math.random() * 60, 0.025, 0.012, 'triangle');
          if (advancePressed()) { shown = chars.length; line.textContent = l.text; }
          if (shown >= chars.length) el.classList.add('done');
        } else if (advancePressed() || (l.auto && (l._t = (l._t || 0) + dt) > l.auto)) {
          voice?.stop?.(); active = null; resolve();
        }
      };
    });
  }

  return {
    get busy() { return !!active; },
    async play(lines) {
      for (const l of lines) await playLine(l);
      el.classList.remove('on');
    },
    update(dt) { active?.(dt); },
  };
}
