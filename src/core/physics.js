// Rapier physics: world, terrain heightfield, static colliders, and a helper for raycasts.
import RAPIER from '@dimforge/rapier3d-compat';

export async function createPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  let acc = 0;
  return {
    RAPIER, world,
    /** heightfield from a height function. Index layout verified: i along x, j along z. */
    addHeightfield(heightAt, size = 960, n = 240) {
      const h = new Float32Array((n + 1) * (n + 1));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
        h[i * (n + 1) + j] = heightAt(-size / 2 + (i / n) * size, -size / 2 + (j / n) * size);
      }
      return world.createCollider(RAPIER.ColliderDesc.heightfield(n, n, h, { x: size, y: 1, z: size }).setFriction(0.9));
    },
    addStatic(list) {
      for (const c of list) {
        const q = { x: 0, y: Math.sin(c.rotY / 2), z: 0, w: Math.cos(c.rotY / 2) };
        let d;
        if (c.kind === 'box') d = RAPIER.ColliderDesc.cuboid(c.half.x, c.half.y, c.half.z).setRotation(q);
        else d = RAPIER.ColliderDesc.cylinder(c.h / 2, c.r);
        d.setTranslation(c.pos.x, c.pos.y, c.pos.z);
        world.createCollider(d);
      }
    },
    /** fixed-step simulation */
    step(dt, before) {
      acc += dt; let n = 0;
      while (acc >= world.timestep && n < 4) { before?.(world.timestep); world.step(); acc -= world.timestep; n++; }
      if (n === 4) acc = 0;
      return n;
    },
    /** how far the render time is between the last two fixed steps (0..1), for interpolation */
    get alpha() { return Math.min(1, acc / world.timestep); },
    ray(from, dir, maxToi, exclude) {
      const hit = world.castRay(new RAPIER.Ray(from, dir), maxToi, true, undefined, undefined, exclude);
      return hit ? hit.timeOfImpact : null;
    },
  };
}
