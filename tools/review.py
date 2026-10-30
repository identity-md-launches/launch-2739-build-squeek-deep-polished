from PIL import Image
import sys,glob
O='/workspace/squeek_deep/assets/'
files=sys.argv[2:]; out=sys.argv[1]; S=3
ims=[Image.open(O+f).convert('RGBA') for f in files]
W=max(i.size[0]*S for i in ims)+20; H=sum(i.size[1]*S+10 for i in ims)+10
c=Image.new('RGBA',(W,H),(40,34,48,255)); y=10
for i in ims:
    b=i.resize((i.size[0]*S,i.size[1]*S),Image.NEAREST)
    bg=Image.new('RGBA',b.size,(70,60,80,255)); bg.alpha_composite(b); c.paste(bg,(10,y)); y+=b.size[1]+10
c.save(out)
