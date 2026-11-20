# Auto-rig a standing, arms-down 3D scan with a Mixamo-named skeleton fitted to its proportions.
# Run: Blender -b --python autorig.py -- <in.glb> <out.glb> <height_m> <max_tris> <adult|child>
import bpy, sys, mathutils, bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst, H, max_tris, kind = argv[0], argv[1], float(argv[2]), int(argv[3]), argv[4]
child = kind == 'child'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1: bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
for o in list(bpy.context.scene.objects):
    if o != body: bpy.data.objects.remove(o, do_unlink=True)
body.name = 'Body'

def verts(): return [body.matrix_world @ v.co for v in body.data.vertices]
V = verts()
mn = Vector([min(v[i] for v in V) for i in range(3)]); mx = Vector([max(v[i] for v in V) for i in range(3)])
h0 = mx.z - mn.z
# scale to height, feet on the ground, centred
s = H / h0
body.scale = (s, s, s); bpy.ops.object.transform_apply(scale=True)
V = verts(); mn = Vector([min(v[i] for v in V) for i in range(3)]); mx = Vector([max(v[i] for v in V) for i in range(3)])
mid = [v for v in V if mn.z + 0.45 * H < v.z < mn.z + 0.6 * H]
cx = sum(v.x for v in mid) / len(mid); cy = sum(v.y for v in mid) / len(mid)
body.location = (-cx, -cy, -mn.z); bpy.ops.object.transform_apply(location=True)
V = verts()

# facing: toes stick out in front of the ankles. Make the character face -Y (glTF +Z).
low = [v for v in V if v.z < 0.035 * H]; ank = [v for v in V if 0.04 * H < v.z < 0.08 * H]
ay = sum(v.y for v in ank) / max(1, len(ank))
front_plus = (max(v.y for v in low) - ay) > (ay - min(v.y for v in low))
if front_plus:
    body.rotation_euler = (0, 0, 3.14159265); bpy.ops.object.transform_apply(rotation=True); V = verts()
print('FACING was', '+Y' if front_plus else '-Y')

# decimate for real-time use
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
if tris > max_tris:
    m = body.modifiers.new('dec', 'DECIMATE'); m.ratio = max_tris / tris
    bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier='dec')
V = verts()

def sl(z0, z1, f=lambda v: True): return [v for v in V if z0 * H <= v.z <= z1 * H and f(v)]
def cen(pts, fb):
    if not pts: return fb
    return Vector((sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts), sum(p.z for p in pts) / len(pts)))

P = {}
hipZ = 0.50 if child else 0.52
shZ = 0.775 if child else 0.81
neckZ = 0.81 if child else 0.845
headZ = 0.855 if child else 0.885
torso = lambda v: abs(v.x) < 0.07 * H
def tcy(z0, z1): pts = sl(z0, z1, torso); return sum(p.y for p in pts) / max(1, len(pts))
P['Hips'] = Vector((0, tcy(hipZ - 0.03, hipZ + 0.03), hipZ * H))
P['Spine'] = Vector((0, tcy(0.58, 0.62), 0.60 * H))
P['Spine1'] = Vector((0, tcy(0.65, 0.69), 0.67 * H))
P['Spine2'] = Vector((0, tcy(0.72, 0.76), 0.74 * H))
P['Neck'] = Vector((0, tcy(neckZ - 0.01, neckZ + 0.01), neckZ * H))
P['Head'] = Vector((0, tcy(headZ - 0.01, headZ + 0.02), headZ * H))
P['HeadTop_End'] = Vector((0, P['Head'].y, H))
for side, sg in (('Left', 1), ('Right', -1)):
    S = lambda v: v.x * sg > 0
    # legs
    thigh = cen(sl(0.36, 0.44, S), Vector((sg * 0.1 * H, 0, 0.4 * H)))
    knee = cen(sl(0.26, 0.31, S), Vector((sg * 0.1 * H, 0, 0.285 * H)))
    ankle = cen(sl(0.04, 0.07, S), Vector((sg * 0.1 * H, 0, 0.05 * H)))
    toes = sl(0.0, 0.03, S); tip = min(toes, key=lambda v: v.y) if toes else ankle + Vector((0, -0.08 * H, 0))
    P[side + 'UpLeg'] = Vector((thigh.x * 0.95, P['Hips'].y, (hipZ - 0.03) * H))
    P[side + 'Leg'] = Vector((knee.x, knee.y, 0.285 * H))
    P[side + 'Foot'] = Vector((ankle.x, ankle.y, 0.05 * H))
    P[side + 'ToeBase'] = Vector((ankle.x, (ankle.y + tip.y) * 0.5 - 0.01 * H, 0.018 * H))
    P[side + 'Toe_End'] = Vector((ankle.x, tip.y, 0.012 * H))
    # arms hang beside the body: take the outermost vertices in each band
    def arm(z0, z1):
        pts = sl(z0, z1, S)
        if not pts: return None
        m = max(abs(p.x) for p in pts); out = [p for p in pts if abs(p.x) > m - 0.045 * H]
        return cen(out, None)
    sh = arm(shZ - 0.06, shZ - 0.02)
    el = arm(0.58 if child else 0.60, 0.63 if child else 0.65)
    wr = arm(0.44 if child else 0.46, 0.48 if child else 0.50)
    hand = arm(0.37 if child else 0.39, 0.41 if child else 0.43)
    P[side + 'Shoulder'] = Vector((sg * 0.035 * H, P['Spine2'].y, shZ * H))
    P[side + 'Arm'] = Vector((sh.x - sg * 0.03 * H, sh.y, shZ * H - 0.01 * H))
    P[side + 'ForeArm'] = el
    P[side + 'Hand'] = wr
    P[side + 'HandEnd'] = hand

# build the armature
arm = bpy.data.armatures.new('Armature'); rig = bpy.data.objects.new('Armature', arm)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
E = {}
def bone(name, head, tail, parent=None):
    b = arm.edit_bones.new('mixamorig:' + name); b.head = head; b.tail = tail
    if (tail - head).length < 1e-3: b.tail = head + Vector((0, 0, 0.03))
    if parent: b.parent = E[parent]; b.use_connect = False
    E[name] = b; return b
bone('Hips', P['Hips'], P['Spine'])
bone('Spine', P['Spine'], P['Spine1'], 'Hips'); bone('Spine1', P['Spine1'], P['Spine2'], 'Spine'); bone('Spine2', P['Spine2'], P['Neck'], 'Spine1')
bone('Neck', P['Neck'], P['Head'], 'Spine2'); bone('Head', P['Head'], P['HeadTop_End'], 'Neck')
for sd in ('Left', 'Right'):
    bone(sd + 'Shoulder', P[sd + 'Shoulder'], P[sd + 'Arm'], 'Spine2')
    bone(sd + 'Arm', P[sd + 'Arm'], P[sd + 'ForeArm'], sd + 'Shoulder')
    bone(sd + 'ForeArm', P[sd + 'ForeArm'], P[sd + 'Hand'], sd + 'Arm')
    bone(sd + 'Hand', P[sd + 'Hand'], P[sd + 'HandEnd'], sd + 'ForeArm')
    bone(sd + 'UpLeg', P[sd + 'UpLeg'], P[sd + 'Leg'], 'Hips')
    bone(sd + 'Leg', P[sd + 'Leg'], P[sd + 'Foot'], sd + 'UpLeg')
    bone(sd + 'Foot', P[sd + 'Foot'], P[sd + 'ToeBase'], sd + 'Leg')
    bone(sd + 'ToeBase', P[sd + 'ToeBase'], P[sd + 'Toe_End'], sd + 'Foot')
bpy.ops.object.mode_set(mode='OBJECT')

# bind with automatic (heat) weights; fall back to envelopes if heat diffusion fails on the scan
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
try:
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
except Exception as e:
    print('AUTO failed', e); bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
def count_unweighted(o): return sum(1 for v in o.data.vertices if not any(g.weight > 0.01 for g in v.groups))
if count_unweighted(body) > 0.3 * len(body.data.vertices):
    # heat weights failed (non-manifold scan): weight a watertight voxel proxy, then transfer to the scan
    print('PROXY weighting')
    for g in list(body.vertex_groups): body.vertex_groups.remove(g)
    for m in list(body.modifiers):
        if m.type == 'ARMATURE': body.modifiers.remove(m)
    body.parent = None
    proxy = body.copy(); proxy.data = body.data.copy(); bpy.context.scene.collection.objects.link(proxy)
    rm = proxy.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = H * 0.012
    bpy.context.view_layer.objects.active = proxy; bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True)
    bpy.ops.object.modifier_apply(modifier='rm')
    bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    print('proxy unweighted', count_unweighted(proxy), 'of', len(proxy.data.vertices))
    dt = body.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = proxy; dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = body; bpy.ops.object.select_all(action='DESELECT'); body.select_set(True)
    bpy.ops.object.datalayout_transfer(modifier='dt')
    bpy.ops.object.modifier_apply(modifier='dt')
    bpy.data.objects.remove(proxy, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_NAME')
groups = {g.index: g.name for g in body.vertex_groups}
unweighted = count_unweighted(body)
print('WEIGHTS groups', len(groups), 'unweighted verts', unweighted, 'of', len(body.data.vertices))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_skins=True, export_animations=False)
print('DONE tris', sum(len(p.vertices) - 2 for p in body.data.polygons))
