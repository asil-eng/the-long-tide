import bpy, sys, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
vs=[]
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        vs+= [o.matrix_world @ v.co for v in o.data.vertices]
mn=mathutils.Vector([min(v[i] for v in vs) for i in range(3)]); mx=mathutils.Vector([max(v[i] for v in vs) for i in range(3)])
print('BB', [round(x,3) for x in mn], [round(x,3) for x in mx], 'n', len(vs))
# front: nose sits forward at ~0.93H; report y-extent at head height
H=mx.z-mn.z
head=[v for v in vs if v.z>mn.z+0.88*H]
print('HEAD y range', round(min(v.y for v in head),3), round(max(v.y for v in head),3), 'x range', round(min(v.x for v in head),3), round(max(v.x for v in head),3))
feet=[v for v in vs if v.z<mn.z+0.03*H]
print('FEET y range', round(min(v.y for v in feet),3), round(max(v.y for v in feet),3))
