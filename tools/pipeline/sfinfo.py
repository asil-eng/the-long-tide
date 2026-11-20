import json, os, sys, urllib.request
tok=os.environ['SF']; out=sys.argv[1]; os.makedirs(out,exist_ok=True)
for uid in sys.argv[2:]:
    r=urllib.request.Request('https://api.sketchfab.com/v3/models/'+uid, headers={'Authorization':'Token '+tok})
    try: m=json.load(urllib.request.urlopen(r,timeout=30))
    except Exception as e: print(uid,'ERR',e); continue
    imgs=sorted(m['thumbnails']['images'],key=lambda i:-i['width'])
    img=[i for i in imgs if i['width']<=1024] or imgs
    try: urllib.request.urlretrieve(img[0]['url'], os.path.join(out,uid[:8]+'.jpg'))
    except Exception as e: print('thumb err',e)
    desc=(m.get('description') or '').replace('\n',' ')[:160]
    print(f"{uid[:8]} | {m['name']} | {m['user']['username']} | {m['license']['label']} | faces {m.get('faceCount')} | anim {m.get('animationCount')} | {m.get('viewerUrl')} | {desc}")
