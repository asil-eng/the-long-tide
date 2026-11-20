# usage: phdl.py <kind> <outdir> <res> ids...   kind = hdri|tex|model
import json, os, sys, urllib.request
UA={'User-Agent':'gamejam-asset-pipeline/1.0'}
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
def dl(u,p):
    os.makedirs(os.path.dirname(p),exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=120) as r, open(p,'wb') as f: f.write(r.read())
kind,out,res=sys.argv[1],sys.argv[2],sys.argv[3]
for a in sys.argv[4:]:
    try:
        f=get('https://api.polyhaven.com/files/'+a); info=get('https://api.polyhaven.com/info/'+a)
        auth=', '.join(info.get('authors',{}).keys())
        if kind=='hdri':
            dl(f['hdri'][res]['hdr']['url'], f'{out}/{a}_{res}.hdr')
        elif kind=='tex':
            for m,key in [('Diffuse','diff'),('nor_gl','nor'),('Rough','rough'),('AO','ao'),('Displacement','disp')]:
                if m in f and res in f[m]:
                    e=f[m][res].get('jpg') or f[m][res].get('png'); ext=e['url'].rsplit('.',1)[1]
                    dl(e['url'], f'{out}/{a}/{a}_{key}.{ext}')
        else:
            g=f['gltf'][res]['gltf']; d=f'{out}/{a}'
            dl(g['url'], f'{d}/{a}.gltf')
            for rel,v in g.get('include',{}).items(): dl(v['url'], f'{d}/{rel}')
        print(f'OK|{kind}|{a}|{auth}|https://polyhaven.com/a/{a}')
    except Exception as e: print(f'FAIL|{kind}|{a}|{e}|https://polyhaven.com/a/{a}')
