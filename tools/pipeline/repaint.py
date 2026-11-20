import sys, numpy as np
from PIL import Image
import colorsys
def load(p):
    im=Image.open(p); mode=im.mode; a=np.asarray(im.convert('RGBA')).astype(np.float32)/255; return a,mode
def hsv(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; mx=a[...,:3].max(-1); mn=a[...,:3].min(-1); d=mx-mn+1e-6
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    s=np.where(mx>0,(mx-mn)/(mx+1e-6),0); return h,s,mx
def save(a,p): Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8),'RGBA').save(p)
kind,p=sys.argv[1],sys.argv[2]
a,_=load(p); h,s,v=hsv(a)
rng=np.random.default_rng(3); n=rng.random(a.shape[:2])*0.04
if kind=='house':
    m=((h>170)&(h<235)&(s>0.06)).astype(np.float32)[...,None]
    lum=(0.3*a[...,0]+0.59*a[...,1]+0.11*a[...,2])[...,None]
    white=np.concatenate([lum*0.25+0.72, lum*0.25+0.68, lum*0.25+0.6],-1)  # warm weathered off-white
    white=white*(1-n[...,None])
    a[...,:3]=a[...,:3]*(1-m)+white*m
    # warm up the cold white trim slightly too
    t=((s<0.06)&(v>0.75)).astype(np.float32)[...,None]
    a[...,:3]=a[...,:3]*(1-t)+(a[...,:3]*np.array([0.97,0.93,0.85]))*t
elif kind=='truck':
    m=(((h<20)|(h>340))&(s>0.45)&(v>0.25)).astype(np.float32)[...,None]
    lum=(0.3*a[...,0]+0.59*a[...,1]+0.11*a[...,2])[...,None]
    faded=np.concatenate([lum*0.5+0.42, lum*0.5+0.30, lum*0.5+0.25],-1)*(1-n[...,None])  # chalky sun-faded brick
    a[...,:3]=a[...,:3]*(1-m)+faded*m
save(a,p); print('repainted',kind,p,'pixels',int(m.sum()))
