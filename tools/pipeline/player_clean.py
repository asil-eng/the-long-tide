import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
keep_arm = bpy.data.objects['GLTF_created_0']
keep = {keep_arm} | {o for o in bpy.data.objects if o.parent == keep_arm}
meshes = [o for o in keep if o.type == 'MESH']
for o in list(bpy.data.objects):
    if o not in keep and o.type in ('MESH','ARMATURE'): bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
# unparent armature keeping transform, drop empties
bpy.context.view_layer.objects.active = keep_arm
for o in bpy.data.objects: o.select_set(o == keep_arm)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in list(bpy.data.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
zs=[(m.matrix_world @ v.co).z for m in meshes for v in m.data.vertices]
h=max(zs)-min(zs); s=1.8/h
keep_arm.scale = [c*s for c in keep_arm.scale]
bpy.context.view_layer.update()
zs=[(m.matrix_world @ v.co).z for m in meshes for v in m.data.vertices]
keep_arm.location.z -= min(zs)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.export_scene.gltf(filepath=argv[1], export_format='GLB', export_animations=False, export_skins=True)
print('DONE height', h*s)
