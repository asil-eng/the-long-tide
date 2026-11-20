// The daughter's bedroom: a modest child's room built in code (PBR walls/floor, window with
// sunlight, curtains in the draught) furnished with the downloaded bed, desk, bookshelf and props.
// It sits away from the valley at ROOM.origin; the farmhouse door teleports the player here.
import * as THREE from 'three';
import { patchMaterial, patchModel } from '../../assets/materialPatch.js';

export const ROOM = { origin: new THREE.Vector3(620, 0, 620), w: 4.4, d: 3.8, h: 2.6 };

const tl = new THREE.TextureLoader();
function pbr(name, rep = [1, 1], { color } = {}) {
  const t = (s, srgb) => { const x = tl.load(`/textures/${name}/${name}_${s}.jpg`); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(...rep); x.anisotropy = 8; if (srgb) x.colorSpace = THREE.SRGBColorSpace; return x; };
  const m = new THREE.MeshStandardMaterial({ map: t('diff', true), normalMap: t('nor'), roughnessMap: t('rough') });
  if (color) m.color.set(color);
  return m;
}

function drawing(kind, seed) {
  // a child's crayon drawing on off-white paper, painted on a canvas
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,90,60,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 320, 2, 2); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const crayon = (col, w, pts) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + Math.random() * 3, y + Math.random() * 3) : g.moveTo(x, y))); g.stroke(); };
  if (kind === 'planets') {
    g.fillStyle = '#26314a'; g.fillRect(14, 14, 228, 292);
    for (let i = 0; i < 40; i++) { g.fillStyle = '#e8e2c0'; g.fillRect(20 + Math.random() * 216, 20 + Math.random() * 280, 3, 3); }
    g.fillStyle = '#d98a3a'; g.beginPath(); g.arc(90, 120, 44, 0, 7); g.fill();
    crayon('#e9c46a', 6, [[30, 140], [150, 100]]);
    g.fillStyle = '#7fb0c9'; g.beginPath(); g.arc(180, 220, 28, 0, 7); g.fill();
    g.fillStyle = '#c95b4a'; g.beginPath(); g.arc(70, 250, 14, 0, 7); g.fill();
  } else if (kind === 'rocket') {
    crayon('#7a8fa6', 10, [[128, 60], [100, 120], [100, 230], [156, 230], [156, 120], [128, 60]]);
    crayon('#c0462f', 8, [[100, 230], [80, 262], [100, 250]]); crayon('#c0462f', 8, [[156, 230], [176, 262], [156, 250]]);
    crayon('#f0a030', 9, [[112, 240], [128, 296], [144, 240]]);
    g.strokeStyle = '#3d6e8f'; g.lineWidth = 5; g.beginPath(); g.arc(128, 140, 14, 0, 7); g.stroke();
  } else {
    crayon('#5d4a32', 4, [[20, 250], [236, 250]]);
    for (let x = 24; x < 236; x += 9) crayon('#d6b25a', 3, [[x, 250], [x + 2, 200 + Math.random() * 20]]);
    crayon('#f5f0e6', 6, [[60, 250], [60, 170], [110, 130], [160, 170], [160, 250], [60, 250]]);
    crayon('#8a3a2a', 6, [[52, 175], [110, 122], [168, 175]]);
    g.fillStyle = '#e5a44a'; g.beginPath(); g.arc(205, 70, 26, 0, 7); g.fill();
    crayon('#333', 3, [[96, 300], [104, 284], [112, 300]]); // stick figures
    crayon('#333', 3, [[140, 300], [146, 290], [152, 300]]);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export async function buildBedroom(scene, loadModel) {
  const O = ROOM.origin, { w, d, h } = ROOM;
  const group = new THREE.Group(); group.position.copy(O); scene.add(group);
  const colliders = [];
  const box = (x, y, z, hx, hy, hz, rotY = 0) => colliders.push({ kind: 'box', pos: new THREE.Vector3(O.x + x, O.y + y, O.z + z), half: new THREE.Vector3(hx, hy, hz), rotY });

  const dustOpts = { dustTop: 0.35, dustLow: 0.15, dirtHeight: 0.3, fade: 0.15 };
  const floorM = patchMaterial(pbr('wood_floor_worn', [2, 2]), { ...dustOpts, dustTop: 0.25 });
  const wallM = patchMaterial(pbr('beige_wall_001', [2.2, 1.3], { color: '#e8dcc6' }), { dustTop: 0, dustLow: 0.2, dirtHeight: 0.35, fade: 0.1 });
  const ceilM = patchMaterial(pbr('painted_plaster_wall', [2, 2], { color: '#e6dccb' }), { dustTop: 0, dustLow: 0, fade: 0.05 });
  const trimM = patchMaterial(pbr('wood_table_worn', [4, 0.3], { color: '#d8c9ad' }), dustOpts);

  const plane = (gw, gh, mat, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), mat); m.position.set(...pos); m.rotation.set(...rot); m.receiveShadow = true; m.castShadow = true; group.add(m); return m; };
  // floor & ceiling
  plane(w, d, floorM, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  plane(w, d, ceilM, [0, h, 0], [Math.PI / 2, 0, 0]);
  // walls (+z wall has the window cut out of it, -x wall has the door)
  const winW = 1.25, winH = 1.35, winY = 0.85, winX = 0.55;
  plane(d, h, wallM, [w / 2, h / 2, 0], [0, -Math.PI / 2, 0]);
  plane(w, h, wallM, [0, h / 2, -d / 2], [0, 0, 0]);
  // -x wall with a door gap at z in [-0.5, 0.4]
  const zA = -d / 2, zB = -0.5, zC = 0.4, zD = d / 2;
  plane(zB - zA, h, wallM, [-w / 2, h / 2, (zA + zB) / 2], [0, Math.PI / 2, 0]);
  plane(zD - zC, h, wallM, [-w / 2, h / 2, (zC + zD) / 2], [0, Math.PI / 2, 0]);
  plane(zC - zB, h - 2.05, wallM, [-w / 2, 2.05 + (h - 2.05) / 2, (zB + zC) / 2], [0, Math.PI / 2, 0]);
  // a closed wooden door in the gap (the way back out)
  const doorM = patchMaterial(pbr('old_planks_02', [1, 2], { color: '#cdbb9c' }), dustOpts);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.03, 0.88), doorM); door.position.set(-w / 2 + 0.03, 1.015, (zB + zC) / 2); door.castShadow = door.receiveShadow = true; group.add(door);
  // window wall (+z): four pieces around the opening
  const wl = -w / 2, wr = w / 2, x0 = winX - winW / 2, x1 = winX + winW / 2;
  plane(x0 - wl, h, wallM, [(wl + x0) / 2, h / 2, d / 2], [0, Math.PI, 0]);
  plane(wr - x1, h, wallM, [(x1 + wr) / 2, h / 2, d / 2], [0, Math.PI, 0]);
  plane(winW, winY, wallM, [winX, winY / 2, d / 2], [0, Math.PI, 0]);
  plane(winW, h - winY - winH, wallM, [winX, winY + winH + (h - winY - winH) / 2, d / 2], [0, Math.PI, 0]);
  // window frame + muntins + dusty glass
  const frame = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), trimM); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; group.add(m); };
  frame(winW + 0.12, 0.07, 0.16, winX, winY - 0.02, d / 2 - 0.02); frame(winW + 0.12, 0.06, 0.12, winX, winY + winH + 0.02, d / 2);
  frame(0.06, winH, 0.12, x0 - 0.03, winY + winH / 2, d / 2); frame(0.06, winH, 0.12, x1 + 0.03, winY + winH / 2, d / 2);
  frame(0.035, winH, 0.04, winX, winY + winH / 2, d / 2); frame(winW, 0.035, 0.04, winX, winY + winH * 0.5, d / 2);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshPhysicalMaterial({ color: '#efe2c8', roughness: 0.25, transparent: true, opacity: 0.12, depthWrite: false }));
  glass.position.set(winX, winY + winH / 2, d / 2 + 0.01); glass.rotation.y = Math.PI; group.add(glass);
  // baseboards
  frame(w, 0.1, 0.02, 0, 0.05, -d / 2 + 0.01); frame(0.02, 0.1, d, w / 2 - 0.01, 0.05, 0);

  // curtains: thin cloth panels that billow in the draught (vertex wave)
  const curtainM = new THREE.MeshStandardMaterial({ color: '#d9c3a0', roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  patchMaterial(curtainM, { dustTop: 0.1, dustLow: 0, fade: 0.1, translucency: 0.9 });
  const curtains = [];
  for (const sx of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.42, winH + 0.25, 6, 14); geo.translate(0, -(winH + 0.25) / 2, 0);
    const c = new THREE.Mesh(geo, curtainM); c.position.set(winX + sx * (winW / 2 - 0.08), winY + winH + 0.15, d / 2 - 0.09); c.rotation.y = Math.PI; c.castShadow = true;
    c.userData.base = geo.attributes.position.array.slice(); c.userData.sx = sx; group.add(c); curtains.push(c);
  }
  // a rod
  frame(winW + 0.6, 0.02, 0.02, winX, winY + winH + 0.16, d / 2 - 0.09);

  // drawings pinned to the walls
  const pin = (kind, pos, rotY, s = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.28 * s, 0.35 * s), new THREE.MeshStandardMaterial({ map: drawing(kind), roughness: 0.9 }));
    patchMaterial(m.material, { dustTop: 0, dustLow: 0, fade: 0.08 });
    m.position.set(...pos); m.rotation.set(0, rotY, (Math.random() - 0.5) * 0.08); m.receiveShadow = true; group.add(m);
  };
  pin('planets', [w / 2 - 0.01, 1.55, -0.9], -Math.PI / 2); pin('rocket', [w / 2 - 0.01, 1.5, -0.45], -Math.PI / 2, 0.9);
  pin('farm', [-0.3, 1.6, -d / 2 + 0.01], 0, 1.1);

  // ---------- furniture ----------
  const names = ['bookshelf', 'bedroom_bed', 'bedroom_desk', 'chair', 'alarm_clock', 'books', 'lantern', 'dresser', 'crate'];
  const M = Object.fromEntries(await Promise.all(names.map(async (n) => [n, (await loadModel(n)).scene])));
  for (const r of Object.values(M)) patchModel(r, dustOpts);
  const put = (n, x, z, ry = 0, { y = 0, s = 1, col = true } = {}) => {
    const o = M[n].clone(); o.scale.setScalar(s); o.rotation.y = ry; o.position.set(x, y, z); group.add(o);
    o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o);
    if (col) { const c = b.getCenter(new THREE.Vector3()), hs = b.getSize(new THREE.Vector3()).multiplyScalar(0.5); colliders.push({ kind: 'box', pos: c, half: hs, rotY: 0 }); }
    return { o, b };
  };
  // the tall bookshelf against the back wall: the heart of the room
  const shelf = put('bookshelf', 0.75, -d / 2 + 0.33, 0);
  const bed = put('bedroom_bed', -1.12, d / 2 - 0.66, 0);
  const desk = put('bedroom_desk', w / 2 - 0.42, 0.9, Math.PI);
  const deskTop = desk.b.max.y;
  put('chair', w / 2 - 1.0, 0.95, Math.PI / 2 + 0.25, { col: false });
  put('books', w / 2 - 0.4, 0.62, -Math.PI / 2 + 0.2, { y: deskTop - O.y, s: 0.8, col: false });
  put('alarm_clock', w / 2 - 0.32, 1.28, -2.2, { y: deskTop - O.y, col: false });
  put('lantern', w / 2 - 0.45, 1.35, 0.4, { y: deskTop - O.y, s: 0.8, col: false });
  put('dresser', -w / 2 + 0.35, -d / 2 + 0.5, Math.PI / 2);
  put('crate', w / 2 - 0.35, -0.55, 0.3, { s: 0.6 });

  // walls as colliders
  box(0, h / 2, -d / 2 - 0.1, w / 2, h / 2, 0.1); box(0, h / 2, d / 2 + 0.1, w / 2, h / 2, 0.1);
  box(w / 2 + 0.1, h / 2, 0, 0.1, h / 2, d / 2); box(-w / 2 - 0.1, h / 2, 0, 0.1, h / 2, d / 2);
  box(0, -0.1, 0, w / 2 + 0.3, 0.1, d / 2 + 0.3);

  // a warm bounce light so the shaded side of the room isn't dead
  const fill = new THREE.PointLight('#ffc78e', 5.5, 8, 1.4); fill.position.set(0.6, 1.7, 1.2); group.add(fill);
  const shelfGlow = new THREE.PointLight('#ffb36b', 2.2, 3.2, 1.6); shelfGlow.position.set(0.75, 1.4, -d / 2 + 1.0); group.add(shelfGlow);
  // a soft beam of sunlight through the window: additive, fades along its length and at the edges
  const beamGeo = new THREE.BoxGeometry(winW * 0.95, winH * 0.95, 4.2, 1, 1, 8); beamGeo.translate(0, 0, -2.1);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#ffb877') }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec3 vP;
      void main(){ float along = clamp(-vP.z / 4.2, 0.0, 1.0);
        float edge = (1.0 - smoothstep(0.25, 0.6, abs(vP.x) / ${(winW * 0.95).toFixed(3)} )) * (1.0 - smoothstep(0.25, 0.6, abs(vP.y) / ${(winH * 0.95).toFixed(3)}));
        float flick = 0.85 + 0.15 * sin(uTime * 0.7 + vP.z * 2.0);
        gl_FragColor = vec4(uColor * 0.06 * edge * edge * pow(1.0 - along, 1.6) * flick, 1.0); }`,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(winX, winY + winH / 2, d / 2);
  beam.lookAt(new THREE.Vector3(winX - 0.35, winY + winH / 2 - 0.75, d / 2 - 1).add(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4()));
  beam.rotation.set(-0.42, 0.28 + Math.PI, 0); beam.rotation.y = 0.28; beam.rotateX(0);
  group.add(beam);
  // dust in the sunbeam is provided by the global dust particles

  // ground outside the window so the view isn't a void
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), patchMaterial(pbr('brown_mud_dry', [110, 110], { color: '#e2d2b8' }), { dustTop: 0.3, fade: 0.5 }));
  outside.rotation.x = -Math.PI / 2; outside.position.set(O.x, -0.02, O.z); outside.receiveShadow = true; scene.add(outside);

  return {
    group, colliders,
    spawn: new THREE.Vector3(O.x - w / 2 + 0.7, O.y, O.z + (zB + zC) / 2), spawnFacing: Math.PI / 2,
    door: { x: O.x - w / 2 + 0.45, z: O.z + (zB + zC) / 2, r: 0.75 },
    shelf: shelf.b, floorCenter: new THREE.Vector3(O.x + 0.5, O.y, O.z + 0.6),
    bounds: { x0: O.x - w / 2 + 0.2, x1: O.x + w / 2 - 0.2, z0: O.z - d / 2 + 0.2, z1: O.z + d / 2 - 0.2, y0: O.y + 0.3, y1: O.y + h - 0.15 },
    sunDir: new THREE.Vector3(-0.2, 0.62, 0.76).normalize(),
    update(t) {
      beamMat.uniforms.uTime.value = t;
      for (const c of curtains) {
        const p = c.geometry.attributes.position, b = c.userData.base;
        for (let i = 0; i < p.count; i++) {
          const y = b[i * 3 + 1], k = Math.min(1, -y / (winH + 0.25));
          const wave = Math.sin(t * 1.7 + b[i * 3] * 6 + y * 3 + c.userData.sx) * 0.05 + Math.sin(t * 0.6 + c.userData.sx) * 0.07;
          p.setZ(i, b[i * 3 + 2] + wave * k * k);
        }
        p.needsUpdate = true; c.geometry.computeVertexNormals();
      }
    },
  };
}
