import json, os, sys, urllib.request, urllib.parse
tok = os.environ['SF']
def search(q, maxfaces=200000, n=24):
    res=[]
    for lic in ['cc0','by']:
        p = urllib.parse.urlencode({'type':'models','q':q,'downloadable':'true','license':lic,'max_face_count':maxfaces,'count':n,'sort_by':'-likeCount'})
        r = urllib.request.Request('https://api.sketchfab.com/v3/search?'+p, headers={'Authorization':'Token '+tok})
        try: d=json.load(urllib.request.urlopen(r, timeout=30))
        except Exception as e: print('ERR',q,e); continue
        for m in d.get('results',[]):
            res.append((m.get('likeCount',0), m['uid'], m['name'][:50], m['user']['username'], m['license']['label'] if m.get('license') else lic, m.get('faceCount'), m.get('viewerUrl')))
    res.sort(reverse=True)
    return res
for q in sys.argv[1:]:
    print('=== ',q)
    for x in search(q)[:14]: print(x)
