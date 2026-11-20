// Tiled instanced scatter with distance LOD, used for corn and grass across the whole valley.
// Each tile owns one instance buffer shared by a high-detail and a low-detail mesh. Instances are
// shuffled, so the low LOD can draw a sparse subset just by lowering mesh.count.
import * as THREE from 'three';

export class TiledScatter {
  /**
   * @param {object} o
   *  area {x0,x1,z0,z1}, tile (m), place(tile, push(x,y,z,rotY,scale,sy, tint)) fills instances,
   *  geoHigh, geoLow, matHigh, matLow, depthHigh, nearDist, farDist, lowFraction, castShadow
   */
  constructor(scene, o) {
    this.o = { tile: 32, nearDist: 45, farDist: 220, lowFraction: 0.35, ...o };
    this.tiles = [];
    const { area, tile } = this.o;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const tilt = new THREE.Quaternion();
    let total = 0;
    for (let x = area.x0; x < area.x1; x += tile) for (let z = area.z0; z < area.z1; z += tile) {
      const items = [];
      this.o.place({ x0: x, x1: x + tile, z0: z, z1: z + tile }, (px, py, pz, ry, sc, sy = 1, tint = null, lean = 0) => items.push([px, py, pz, ry, sc, sy, tint, lean]));
      if (!items.length) continue;
      for (let i = items.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [items[i], items[j]] = [items[j], items[i]]; }
      const mats = new Float32Array(items.length * 16), cols = new Float32Array(items.length * 3);
      items.forEach(([px, py, pz, ry, sc, sy, tint, lean], i) => {
        q.setFromAxisAngle(up, ry); if (lean) q.multiply(tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean));
        m.compose(p.set(px, py, pz), q, s.set(sc, sc * sy, sc)); m.toArray(mats, i * 16);
        const c = tint || [1, 1, 1]; cols.set(c, i * 3);
      });
      const im = new THREE.InstancedBufferAttribute(mats, 16), ic = new THREE.InstancedBufferAttribute(cols, 3);
      const mk = (geo, mat) => {
        const mesh = new THREE.InstancedMesh(geo, mat, items.length);
        mesh.instanceMatrix = im; mesh.instanceColor = ic;
        mesh.frustumCulled = true; mesh.computeBoundingSphere();
        mesh.boundingSphere.radius += 3; mesh.visible = false; scene.add(mesh); return mesh;
      };
      const hi = mk(this.o.geoHigh, this.o.matHigh);
      hi.castShadow = this.o.castShadow !== false; hi.receiveShadow = true;
      if (this.o.depthHigh) hi.customDepthMaterial = this.o.depthHigh;
      const lo = this.o.geoLow ? mk(this.o.geoLow, this.o.matLow || this.o.matHigh) : null;
      if (lo) { lo.castShadow = false; lo.receiveShadow = true; lo.count = Math.max(1, Math.floor(items.length * this.o.lowFraction)); }
      this.tiles.push({ cx: x + tile / 2, cz: z + tile / 2, hi, lo, n: items.length });
      total += items.length;
    }
    this.total = total;
  }

  update(camPos) {
    const half = this.o.tile * 0.71;
    for (const t of this.tiles) {
      const d = Math.max(0, Math.hypot(t.cx - camPos.x, t.cz - camPos.z) - half);
      t.hi.visible = d < this.o.nearDist;
      if (t.lo) t.lo.visible = !t.hi.visible && d < this.o.farDist;
    }
  }
}
