import sys
from PIL import Image
d=sys.argv[1]; names=sys.argv[2].split(','); cols=2
ims=[Image.open(f'{d}/{n}.png').convert('RGB').resize((800,450)) for n in names]
rows=(len(ims)+1)//2; s=Image.new('RGB',(1600,450*rows))
for i,im in enumerate(ims): s.paste(im,((i%2)*800,(i//2)*450))
s.save(f'{d}/sheet.jpg',quality=85)
