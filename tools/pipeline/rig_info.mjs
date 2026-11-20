import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f); const j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)));
  const skins = j.skins || []; const bones = skins[0] ? skins[0].joints.map((i) => j.nodes[i].name) : [];
  console.log('==', f.split('/').slice(-2).join('/'), 'skins', skins.length, 'joints', bones.length, 'anims', (j.animations || []).map((a) => a.name + ':' + a.channels.length).join(','), 'meshes', j.meshes.length, 'mats', j.materials?.length);
  console.log('   bones:', bones.slice(0, 26).join(' '));
}
