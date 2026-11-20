import bpy, sys, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in bpy.context.scene.objects: o.select_set(o.type=='MESH')
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
W={'wheel_fl':(1.81,0.89),'wheel_fr':(1.81,-0.89),'wheel_rl':(-2.09,0.89),'wheel_rr':(-2.09,-0.89)}
groups={k:[] for k in W}; body=[]
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
    vs=[o.matrix_world@v.co for v in o.data.vertices]
    mn=mathutils.Vector([min(v[i] for v in vs) for i in range(3)]); mx=mathutils.Vector([max(v[i] for v in vs) for i in range(3)])
    c=(mn+mx)/2; d=mx-mn; hit=None
    for k,(wx,wy) in W.items():
        if ((c.x-wx)**2+(c.z-0.45)**2)**0.5<0.36 and abs(c.y-wy)<0.2 and max(d.x,d.z)<0.95 and mx.z<0.92:
            hit=k
    (groups[hit] if hit else body).append(o)
def join(objs,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
    o=bpy.context.view_layer.objects.active; o.name=name; return o
b=join(body,'body')
for k,objs in groups.items():
    print('GROUP',k,len(objs))
    o=join(objs,k); wx,wy=W[k]
    bpy.context.scene.cursor.location=(wx,wy,0.45)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.export_scene.gltf(filepath=argv[1], export_format='GLB')
print('DONE')
