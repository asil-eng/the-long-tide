import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
a = bpy.data.objects['GLTF_created_0']
print('BONES', [b.name for b in a.data.bones])
for ac in bpy.data.actions: print('ACTION', ac.name, ac.frame_range[:])
