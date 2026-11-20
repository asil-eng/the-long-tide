import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
for o in bpy.context.scene.objects:
    bb = [o.matrix_world @ __import__('mathutils').Vector(c) for c in o.bound_box] if o.type=='MESH' else []
    zs = [v.z for v in bb]; xs=[v.x for v in bb]
    print('OBJ', o.type, o.name, 'parent=', o.parent.name if o.parent else None,
          ('x %.2f..%.2f z %.2f..%.2f' % (min(xs),max(xs),min(zs),max(zs))) if bb else '',
          'tris', sum(len(p.vertices)-2 for p in o.data.polygons) if o.type=='MESH' else '')
for a in bpy.data.actions: print('ACTION', a.name, a.frame_range[:])
