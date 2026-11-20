import sys,os
from PIL import Image, ImageDraw
d=sys.argv[1]; fs=sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
W,H=400,250; cols=4; rows=(len(fs)+cols-1)//cols
s=Image.new('RGB',(W*cols,(H+20)*rows),'white'); dr=ImageDraw.Draw(s)
for i,f in enumerate(fs):
    im=Image.open(os.path.join(d,f)).convert('RGB'); im.thumbnail((W,H))
    x,y=(i%cols)*W,(i//cols)*(H+20); s.paste(im,(x,y+20)); dr.text((x+4,y+4),f[:-4],fill='black')
s.save(sys.argv[2],quality=80)
