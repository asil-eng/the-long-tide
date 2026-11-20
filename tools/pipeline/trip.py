import sys
from PIL import Image
d=sys.argv[1]; ims=[Image.open(f'{d}/{v}.png').convert('RGB') for v in ('corn','road','wide')]
W=1200; H=int(W*9/16); s=Image.new('RGB',(W,H*3))
for i,im in enumerate(ims): s.paste(im.resize((W,H)),(0,i*H))
s.save(f'{d}/sheet.jpg',quality=88)
