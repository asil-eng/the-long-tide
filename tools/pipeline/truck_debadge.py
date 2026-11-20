import bpy, sys, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
body=bpy.data.objects['body']
bpy.context.view_layer.objects.active=body
for o in bpy.context.scene.objects: o.select_set(o==body)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
removed={'front':0,'rear':0}; keep=[]
for o in list(bpy.context.scene.objects):
    if o.type!='MESH' or o.name.startswith('wheel'): continue
    vs=[o.matrix_world@v.co for v in o.data.vertices]
    mn=mathutils.Vector([min(v[i] for v in vs) for i in range(3)]); mx=mathutils.Vector([max(v[i] for v in vs) for i in range(3)])
    c=(mn+mx)/2; d=mx-mn
    pl = (o.active_material.name if o.active_material else '') == 'Plastik'
    badge = (max(d)<0.12 and abs(c.y)<0.3 and c.x<-2.95 and 0.95<c.z<1.35) or (c.x>2.85 and 0.75<c.z<1.45 and abs(c.y)<0.45 and max(d)<(0.26 if pl else 0.12))
    if badge:
        removed['front' if c.x<0 else 'rear']+=1; bpy.data.objects.remove(o, do_unlink=True)
    else: keep.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in keep: o.select_set(True)
bpy.context.view_layer.objects.active=keep[0]; bpy.ops.object.join(); bpy.context.view_layer.objects.active.name='body'
print('REMOVED',removed)
bpy.ops.export_scene.gltf(filepath=argv[1], export_format='GLB')
