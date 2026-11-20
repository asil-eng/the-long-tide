// Trigger zones: circles or boxes on the ground that fire onEnter / onExit / onInteract (E).
import * as THREE from 'three';

export function createTriggers(input, showHint) {
  const zones = [];
  return {
    /** add({ id, x, z, r } or { id, box:{x0,x1,z0,z1} }, onEnter, onExit, interact:'label', onInteract, once, enabled }) */
    add(z) { const zone = { enabled: true, inside: false, ...z }; zones.push(zone); return zone; },
    remove(id) { const i = zones.findIndex((z) => z.id === id); if (i >= 0) zones.splice(i, 1); },
    get(id) { return zones.find((z) => z.id === id); },
    update(pos) {
      let hint = null;
      for (const z of zones) {
        if (!z.enabled) { z.inside = false; continue; }
        const inside = z.box ? (pos.x > z.box.x0 && pos.x < z.box.x1 && pos.z > z.box.z0 && pos.z < z.box.z1)
          : Math.hypot(pos.x - z.x, pos.z - z.z) < z.r;
        if (inside && !z.inside) { z.inside = true; z.onEnter?.(z); if (z.once && !z.interact) z.enabled = false; }
        else if (!inside && z.inside) { z.inside = false; z.onExit?.(z); }
        if (inside && z.interact && input.state.enabled) {
          hint = `<kbd>E</kbd>${z.interact}`;
          if (input.hit('KeyE')) { z.onInteract?.(z); if (z.once) z.enabled = false; input.state.consumedE = true; }
        }
      }
      return hint;
    },
    debugDraw(scene) {
      for (const z of zones) if (!z.box) {
        const m = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.05, z.r, 48), new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.4 }));
        m.rotation.x = -Math.PI / 2; m.position.set(z.x, 0.05, z.z); scene.add(m);
      }
    },
  };
}
