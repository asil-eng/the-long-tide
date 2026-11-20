# usage: sfdl.py outdir name=uid ...
import json, os, sys, urllib.request, zipfile, io
tok=os.environ['SF']; out=sys.argv[1]
H={'Authorization':'Token '+tok}
for arg in sys.argv[2:]:
    name,uid=arg.split('=')
    try:
        m=json.load(urllib.request.urlopen(urllib.request.Request('https://api.sketchfab.com/v3/models/'+uid,headers=H),timeout=30))
        lic=m['license']['label']
        if 'NoDerivs' in lic or 'NonCommercial' in lic and False: raise Exception('bad license '+lic)
        d=json.load(urllib.request.urlopen(urllib.request.Request(f'https://api.sketchfab.com/v3/models/{uid}/download',headers=H),timeout=30))
        dd=os.path.join(out,name); os.makedirs(dd,exist_ok=True)
        if 'glb' in d:
            data=urllib.request.urlopen(d['glb']['url'],timeout=300).read(); open(os.path.join(dd,name+'.glb'),'wb').write(data)
        else:
            data=urllib.request.urlopen(d['gltf']['url'],timeout=300).read(); zipfile.ZipFile(io.BytesIO(data)).extractall(dd)
        print(f"OK|{name}|{m['name']}|{m['user']['displayName']} ({m['user']['username']})|{lic}|{m.get('faceCount')}|{m['viewerUrl']}")
    except Exception as e:
        print(f"FAIL|{name}|{uid}|{e}|https://sketchfab.com/3d-models/{uid}")
