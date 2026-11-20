// Keyboard + mouse input. Pointer lock for mouse-look; controls can be locked during cutscenes/dialogue.
export function createInput(canvas) {
  const down = new Set(), pressed = new Set();
  const state = { mx: 0, my: 0, locked: false, enabled: true };
  addEventListener('keydown', (e) => { if (!down.has(e.code)) pressed.add(e.code); down.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());
  canvas.addEventListener('click', () => { if (!state.locked && state.enabled) canvas.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => { state.locked = document.pointerLockElement === canvas; });
  addEventListener('mousemove', (e) => { if (state.locked) { state.mx += e.movementX; state.my += e.movementY; } });
  addEventListener('mousedown', (e) => { if (e.button === 0) pressed.add('Mouse0'); });
  return {
    state,
    /** held key, ignored while controls are locked */
    key: (c) => state.enabled && down.has(c),
    /** pressed this frame (always reported, so dialogue can advance while controls are locked) */
    hit: (c) => pressed.has(c),
    axis(neg, pos) { return (this.key(pos) ? 1 : 0) - (this.key(neg) ? 1 : 0); },
    takeMouse() { const m = { x: state.mx, y: state.my }; state.mx = 0; state.my = 0; return state.enabled ? m : { x: 0, y: 0 }; },
    endFrame() { pressed.clear(); },
  };
}
