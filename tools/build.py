import json, numpy as np, os
from PIL import Image, ImageOps
from scipy import ndimage as ndi
import sys; sys.path.insert(0,os.path.dirname(__file__))
from extract import key_mask, components, rows, rgba_cut, downscale
R='/workspace/squeek_deep/raw/'; O='/workspace/squeek_deep/assets/'; W='/workspace/squeek_deep/work/'
os.makedirs(W,exist_ok=True)
manifest={}
staged={}  # path -> RGBA image (pre-palette)

def sheet_rows(name):
    im=Image.open(R+name); fg,_=key_mask(im); cut=rgba_cut(im,fg)
    return cut, rows(components(fg))

def frames_from_row(cut,row,f,fw,fh,anchor='bottom',fit=None):
    imgs=[]
    if fit:
        mw=max(c[2]-c[0] for c in row); mh=max(c[3]-c[1] for c in row)
        f=min(fit[0]/mw,fit[1]/mh)
    bottom=max(c[3] for c in row)
    for c in row:
        x0,y0,x1,y1,_=c
        crop=cut.crop((x0,y0,x1,y1))
        small=downscale(crop,f)
        cell=Image.new('RGBA',(fw,fh),(0,0,0,0))
        sw,sh=small.size
        off=round((bottom-y1)*f)
        px=(fw-sw)//2; py=fh-2-sh-off
        if py<0: small=small.crop((0,-py,sw,sh)); sh=small.size[1]; py=0
        if sw>fw: small=small.crop(((sw-fw)//2,0,(sw-fw)//2+fw,sh)); px=0
        cell.paste(small,(px,py),small)
        imgs.append(cell)
    return imgs

def save_strip(path,frames,meta):
    fw,fh=frames[0].size
    s=Image.new('RGBA',(fw*len(frames),fh),(0,0,0,0))
    for i,fr in enumerate(frames): s.paste(fr,(i*fw,0))
    staged[path]=s
    manifest[path]=dict(frameW=fw,frameH=fh,frames=len(frames),**meta)

# ---- hamster (80x80 frames, facing right)
FW=FH=80
cut,rs=sheet_rows('ham_idle_walk.jpg')
save_strip('hamster/ham_idle.png',frames_from_row(cut,rs[0],0.185,FW,FH),dict(fps=6,loop=True,use='idle, facing right; flip X for left'))
save_strip('hamster/ham_walk.png',frames_from_row(cut,rs[1],0.185,FW,FH),dict(fps=10,loop=True,use='walk cycle'))
cut,rs=sheet_rows('ham_dig_jump.jpg')
save_strip('hamster/ham_dig.png',frames_from_row(cut,rs[0],0.229,FW,FH),dict(fps=12,loop=True,use='dig/pickaxe swing; side dig. For down-dig rotate effect or reuse'))
save_strip('hamster/ham_jump.png',frames_from_row(cut,rs[1],0.229,FW,FH),dict(fps=10,loop=False,use='0 crouch,1 takeoff,2 airborne,3 land'))
cut,rs=sheet_rows('ham_hurt_ride.jpg')
save_strip('hamster/ham_hurt.png',frames_from_row(cut,rs[0],0.2,FW,FH),dict(fps=8,loop=False,use='0 flinch,1 knockback,2 dizzy (hold)'))
save_strip('hamster/ham_ride.png',frames_from_row(cut,rs[1][:2],0.215,FW,FH),dict(fps=3,loop=True,use='riding elevator basket; rope continues upward via drawn line'))
cut,rs=sheet_rows('ham_cheeks.jpg')
save_strip('hamster/ham_cheeks.png',frames_from_row(cut,rs[0],0.17,FW,FH),dict(fps=0,loop=False,use='portrait/HUD + overlay: frame = cheek stage 0..3 (load ratio 0-25/25-60/60-90/90-100%)'))

# ---- enemies (72x64 frames, facing left)
EW,EH=72,64
cut,rs=sheet_rows('enemies1.jpg')
save_strip('enemies/mole_shade.png',frames_from_row(cut,rs[0],0,EW,EH,fit=(68,58)),dict(fps=6,loop=True,use='0 float,1 claws up (telegraph),2 lunge'))
save_strip('enemies/root_beetle.png',frames_from_row(cut,rs[1],0,EW,EH,fit=(50,36)),dict(fps=8,loop=True,use='walk'))
save_strip('enemies/glow_worm.png',frames_from_row(cut,rs[2],0,EW,EH,fit=(62,40)),dict(fps=6,loop=True,use='wriggle; lantern glow = light source'))
cut,rs=sheet_rows('enemies2.jpg')
save_strip('enemies/crystal_bat.png',frames_from_row(cut,rs[0],0,EW,EH,fit=(56,36)),dict(fps=10,loop=True,use='flap; frames 0,1,2,1'))
save_strip('enemies/magma_slug.png',frames_from_row(cut,rs[1],0,EW,EH,fit=(60,36)),dict(fps=5,loop=True,use='crawl'))

# ---- items 32x32
cut,rs=sheet_rows('items.jpg')
names=['seed_sunflower','seed_pumpkin','acorn_gold','walnut','amber','emerald','sapphire','ruby','amethyst','crystal_shard','gold_nugget','fossil','magma_heart','heart','battery','chest']
icons=[]
for r in rs:
    for c in r:
        icons.append(frames_from_row(cut,[c],0,32,32,fit=(28,28))[0])
save_strip('items/items.png',icons,dict(fps=0,loop=False,use='icon atlas, order: '+','.join(names)))
manifest['items/items.png']['order']=names

# ---- UI (native ~4x reduce)
cut,rs=sheet_rows('ui_kit.jpg')
uinames=[['hud_bar','shop_panel'],['btn_gold','btn_green','btn_wood'],['cheek_meter','depth_gauge','slot']]
for r,nm in zip(rs,uinames):
    for c,n in zip(r,nm):
        x0,y0,x1,y1,_=c
        im=downscale(cut.crop((x0,y0,x1,y1)),0.25)
        staged['ui/'+n+'.png']=im
        manifest['ui/'+n+'.png']=dict(w=im.size[0],h=im.size[1],use='UI; draw with 9-slice (border ~6px) at integer scale 2-3x')

# ---- props
cut,rs=sheet_rows('props.jpg')
pn=[['wheel_off','wheel_on','basket_ride_alt','lantern'],['beam','ore_seeds','ore_gems','rock_cracked']]
for r,nm in zip(rs,pn):
    for c,n in zip(r,nm):
        x0,y0,x1,y1,_=c
        if n.startswith('ore') or n=='rock_cracked':
            im=frames_from_row(cut,[c],0,32,32,fit=(30,30))[0]
        else:
            im=downscale(cut.crop((x0,y0,x1,y1)),0.3)
        staged['props/'+n+'.png']=im
        manifest['props/'+n+'.png']=dict(w=im.size[0],h=im.size[1])

# ---- tiles 32x32, seamless
t=Image.open(R+'tiles.jpg').convert('RGB'); T=np.asarray(t)
layers=['topsoil','clay','stone','crystal','fungal','magma']
cw,ch=1152//3,864//2
def seamless(a):
    n=a.shape[0]
    rolled=np.roll(np.roll(a,n//2,0),n//2,1)
    yy,xx=np.mgrid[0:n,0:n]
    d=np.minimum(np.minimum(xx,n-1-xx),np.minimum(yy,n-1-yy))/(n/2)
    w=np.clip(d*1.6,0,1)[...,None]
    return a*w+rolled*(1-w)
tilesets=[]
for i,l in enumerate(layers):
    cx,cy=(i%3)*cw,(i//3)*ch
    vs=[]
    for (ox,oy) in [(40,60),(190,230)]:
        crop=t.crop((cx+ox,cy+oy,cx+ox+150,cy+oy+150)).resize((32,32),Image.BOX)
        a=seamless(np.asarray(crop).astype(np.float32))
        vs.append(Image.fromarray(a.clip(0,255).astype(np.uint8)).convert('RGBA'))
    # background (dug) wall: darker, desaturated
    bgw=np.asarray(vs[0]).astype(np.float32); g=bgw[...,:3].mean(-1,keepdims=True); bgw[...,:3]=(bgw[...,:3]*0.5+g*0.5)*0.30+np.array([6,4,10])
    vs.append(Image.fromarray(bgw.astype(np.uint8),'RGBA'))
    tilesets+=vs
strip=Image.new('RGBA',(32*3,32*6))
for i,v in enumerate(tilesets): strip.paste(v,((i%3)*32,(i//3)*32))
staged['tiles/tiles.png']=strip
manifest['tiles/tiles.png']=dict(frameW=32,frameH=32,cols=3,rows=6,use='row=layer ('+','.join(layers)+'); col0,col1 = solid variants (seamless), col2 = dug-out background wall',layers=layers)

# ---- shared palette: per-asset centers pooled, then k-means (keeps rare hues)
centers=[]
for p,im in staged.items():
    a=np.asarray(im); m=a[...,3]>0; px=a[m][:,:3]
    k=min(24,max(4,len(px)//50))
    q=Image.fromarray(px.reshape(1,-1,3).astype(np.uint8)).quantize(colors=k,method=Image.Quantize.MEDIANCUT)
    centers.append(np.array(q.getpalette()[:k*3]).reshape(-1,3))
C=np.concatenate(centers).astype(np.float32)
NC=128
rng=np.random.RandomState(0)
cent=C[rng.choice(len(C),NC,replace=False)]
for it in range(40):
    d=((C[:,None,:]-cent[None])**2).sum(-1); lab=d.argmin(1)
    for j in range(NC):
        if (lab==j).any(): cent[j]=C[lab==j].mean(0)
pal=cent.round().clip(0,255).astype(np.uint8)
palimg=Image.new('P',(1,1)); palimg.putpalette(pal.flatten().tolist()+[0]*(768-NC*3))
for p,im in staged.items():
    a=np.asarray(im); rgb=Image.fromarray(a[...,:3]).quantize(palette=palimg,dither=Image.Dither.NONE).convert('RGB')
    out=np.dstack([np.asarray(rgb),np.where(a[...,3]>0,255,0).astype(np.uint8)])
    os.makedirs(os.path.dirname(O+p),exist_ok=True)
    Image.fromarray(out,'RGBA').save(O+p,optimize=True)
# palette file
sw=Image.new('RGB',(NC*8,8))
for i,c in enumerate(pal): sw.paste(tuple(int(x) for x in c),(i*8,0,i*8+8,8))
sw.save(O+'palette.png')
manifest['palette.png']=dict(colors=NC,hex=['#%02x%02x%02x'%tuple(int(x) for x in c) for c in pal])

# ---- keyart + share bg
k=Image.open(R+'keyart_clean.jpg').convert('RGB'); os.makedirs(O+'keyart',exist_ok=True)
k.save(O+'keyart/title_keyart.png',optimize=True); k.save(O+'keyart/title_keyart.webp',quality=90)
manifest['keyart/title_keyart.png']=dict(w=1280,h=720,use='title screen background / og:image (title baked in)')
s=Image.open(R+'share_bg.jpg').convert('RGB').resize((1200,675),Image.LANCZOS).crop((0,22,1200,652))
os.makedirs(O+'share',exist_ok=True); s.save(O+'share/share_bg.png',optimize=True)
manifest['share/share_bg.png']=dict(w=1200,h=630,use='share card bg; text safe zone x 470-1160, y 60-570')
json.dump(manifest,open(O+'manifest.json','w'),indent=1)
print('ok',len(staged))
