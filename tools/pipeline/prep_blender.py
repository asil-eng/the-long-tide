# Run: Blender -b --python prep_blender.py -- <in_file> <out_glb> <axis:h|l|w> <meters> <max_tris> [keep_anim]
# Imports a .glb/.gltf/.fbx/.obj, applies transforms, scales so the chosen dimension equals <meters>,
# puts the origin at bottom-center, decimates meshes if total triangles exceed <max_tris>, exports .glb.
import bpy, sys, os, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst, axis, meters, max_tris = argv[0], argv[1], argv[2], float(argv[3]), int(argv[4])
keep_anim = len(argv) > 5 and argv[5] == 'anim'

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=src)
elif ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src)
elif ext == '.obj': bpy.ops.wm.obj_import(filepath=src)
else: raise SystemExit('unsupported ' + ext)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
skinned = any(o.find_armature() for o in meshes)

# Bake parent transforms into meshes (skip skinned rigs: keep armature hierarchy, scale the root instead)
if not skinned:
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o.type == 'EMPTY': bpy.data.objects.remove(o)

def world_bbox():
    mn = mathutils.Vector((1e9,) * 3); mx = -mn
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        if o.type != 'MESH': continue
        dg = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
        for v in dg.to_mesh().vertices:
            w = o.matrix_world @ v.co
            mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
        dg.to_mesh_clear()
    return mn, mx

mn, mx = world_bbox(); size = mx - mn
cur = {'h': size.z, 'l': max(size.x, size.y), 'w': min(size.x, size.y)}[axis]
s = meters / cur
offset = mathutils.Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z))

roots = [o for o in bpy.context.scene.objects if o.parent is None]
for o in roots:
    o.location = (o.location + offset) * s
    o.scale = o.scale * s
bpy.context.view_layer.update()
if not skinned:
    for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def tris(): return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
before = tris()
if before > max_tris:
    ratio = max_tris / before
    for o in bpy.context.scene.objects:
        if o.type != 'MESH': continue
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio; m.use_collapse_triangulate = True
        if not skinned:
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='dec')
after = tris()
mn, mx = world_bbox(); size = mx - mn
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_apply=True, export_animations=keep_anim,
                          export_yup=True, export_image_format='AUTO')
print(f'PREP|{os.path.basename(dst)}|tris {before}->{after}|size m (x,y,z) {size.x:.2f},{size.y:.2f},{size.z:.2f}|skinned {skinned}')
