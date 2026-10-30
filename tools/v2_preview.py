import numpy as np
from PIL import Image, ImageDraw, ImageFont
import random, json
O='/workspace/squeek_deep/assets/'; D='/workspace/squeek_deep/'
FP='/usr/share/fonts/truetype/sand-box/google/Pixelify Sans/PixelifySans-VariableFont_wght.ttf'
F=lambda s: ImageFont.truetype(FP,s)
L=lambda p: Image.open(O+p).convert('RGBA')
def frame(p,i,fw,fh): return L(p).crop((i*fw,0,i*fw+fw,fh))
def outline_text(d,xy,s,font,fill,ol=(30,18,24)):
    x,y=xy
    for dx in(-2,0,2):
        for dy in(-2,0,2): d.text((x+dx,y+dy),s,font=font,fill=ol)
    d.text(xy,s,font=font,fill=fill)

# ---------- gameplay mockup 480x270 (render 2x)
W,H=480,270; m=Image.new('RGBA',(W,H),(14,10,20,255))
tiles=L('tiles/tiles.png'); T=lambda r,c: tiles.crop((c*32,r*32,c*32+32,r*32+32))
random.seed(3)
shaft_x=7
for gy in range(0,9):
    for gx in range(15):
        layer=min(5,max(0,(gy-1)//1)) if gy>0 else 0
        layer=[0,0,1,1,2,3,3,4,5][gy]
        dug = (gx==shaft_x) or (gy in (4,5) and 3<=gx<=10) or (gy==6 and gx in(9,10))
        if gy==0: continue
        m.paste(T(layer,2 if dug else random.choice([0,0,1])),(gx*32,gy*32))
# edge shading between solid and dug cells
dd=ImageDraw.Draw(m)
isdug=lambda gx,gy: gy>0 and ((gx==shaft_x) or (gy in (4,5) and 3<=gx<=10) or (gy==6 and gx in(9,10)))
for gy in range(1,9):
    for gx in range(15):
        if not isdug(gx,gy): continue
        X,Y=gx*32,gy*32
        if gy-1>=1 and not isdug(gx,gy-1): dd.rectangle((X,Y,X+31,Y+2),fill=(20,12,24)); dd.line((X,Y+3,X+31,Y+3),fill=(44,30,48))
        if gx-1>=0 and not isdug(gx-1,gy): dd.rectangle((X,Y,X+2,Y+31),fill=(20,12,24))
        if gx+1<15 and not isdug(gx+1,gy): dd.rectangle((X+29,Y,X+31,Y+31),fill=(20,12,24))
        if gy+1<9 and not isdug(gx,gy+1): dd.line((X,Y+31,X+31,Y+31),fill=(255,214,150))
# sky/surface strip
d=ImageDraw.Draw(m); d.rectangle((0,0,W,31),fill=(28,22,46))
for x in range(0,W,5): d.point((x,random.randint(2,20)),fill=(220,220,255))
wh=L('props/wheel_on.png'); m.alpha_composite(wh,(shaft_x*32-wh.size[0]+28,32-wh.size[1]+6))
d.line((shaft_x*32+16,32,shaft_x*32+16,4*32+30),fill=(150,110,60),width=1)
lan=L('props/lantern.png').resize((12,30),Image.NEAREST)
for lx in(4*32,9*32+8): m.alpha_composite(lan,(lx,4*32))
og=L('props/ore_gems.png'); osd=L('props/ore_seeds.png'); rc=L('props/rock_cracked.png')
for (x,y,im) in [(2,4,og),(11,5,osd),(12,4,og),(6,6,rc),(3,7,og),(13,7,osd)]: m.alpha_composite(im,(x*32,y*32))
ham=frame('hamster/ham_dig.png',2,80,80); m.alpha_composite(ham,(8*32-24,5*32+32-78))
mole=frame('enemies/mole_shade.png',1,72,64); ma=np.asarray(mole).copy(); ma[...,3]=(ma[...,3]*0.85).astype(np.uint8); m.alpha_composite(Image.fromarray(ma),(4*32-30,5*32+32-64))
bat=frame('enemies/crystal_bat.png',0,72,64); m.alpha_composite(bat,(10*32-8,4*32-14))
# darkness vignette around lamp
a=np.asarray(m).astype(np.float32); yy,xx=np.mgrid[0:H,0:W]
cx,cy=8*32+12,5*32+8; dist=np.sqrt((xx-cx)**2+(yy-cy)**2)
light=np.clip(1.35-dist/230,0.5,1.0); light[:40]=1
a[...,:3]*=light[...,None]; m=Image.fromarray(a.clip(0,255).astype(np.uint8))
# HUD
hud=L('ui/hud_bar.png'); m.alpha_composite(hud,(4,H-hud.size[1]-4))
cm=L('ui/cheek_meter.png'); m.alpha_composite(cm,(W-cm.size[0]-4,4))
d=ImageDraw.Draw(m); cmx=W-cm.size[0]-4
d.rectangle((cmx+cm.size[0]*0.38,4+cm.size[1]*0.32,cmx+cm.size[0]*0.75,4+cm.size[1]*0.68),fill=(120,210,90))
it=L('items/items.png')
for i,k in enumerate([0,5,6]): m.alpha_composite(it.crop((k*32,0,k*32+32,32)).resize((16,16),Image.NEAREST),(14+i*40,H-hud.size[1]+8))
d.text((32,H-hud.size[1]+6),'214',font=F(12),fill=(255,230,180)); d.text((72,H-hud.size[1]+6),'6',font=F(12),fill=(255,230,180)); d.text((112,H-hud.size[1]+6),'3',font=F(12),fill=(255,230,180))
d.text((8,6),'WHEEL ACTIVE 412rpm   ROUND 6:12',font=F(11),fill=(190,255,160))
d.text((8,20),'DEPTH 142m',font=F(11),fill=(255,230,180))
mock=m.resize((W*2,H*2),Image.NEAREST); mock.save(D+'work/mock_gameplay.png'); mock.save(D+'assets/mock_gameplay_target.png')

# ---------- contact sheet
S=2; PW=1600
sheet=Image.new('RGBA',(PW,3600),(30,24,38,255)); d=ImageDraw.Draw(sheet); y=20
def title(s):
    global y; d.text((20,y),s,font=F(28),fill=(255,206,64)); y+=40
title('SQUEEK DEEP — asset pack v2 (preview)')
k=L('keyart/title_keyart.png').resize((768,432),Image.LANCZOS); sheet.paste(k,(20,y))
sheet.paste(mock.resize((768,432),Image.NEAREST),(810,y)); y+=445
d.text((20,y),'title key art 1280x720',font=F(16),fill=(200,190,210)); d.text((810,y),'target in-game mockup (composited from the pack)',font=F(16),fill=(200,190,210)); y+=30
def row(label,paths,scale=3,x0=20):
    global y
    title(label); x=x0; rh=0
    for p in paths:
        im=L(p); im=im.resize((im.size[0]*scale,im.size[1]*scale),Image.NEAREST)
        if x+im.size[0]>PW-20: x=x0; y+=rh+10; rh=0
        bgc=Image.new('RGBA',im.size,(58,48,70,255)); bgc.alpha_composite(im); sheet.paste(bgc,(x,y))
        x+=im.size[0]+12; rh=max(rh,im.size[1])
    y+=rh+20
row('Hamster 80x80: idle / walk (4) / walk6 (6)',['hamster/ham_idle.png','hamster/ham_walk.png','hamster/ham_walk6.png'],2)
row('Hamster: dig side / dig DOWN (new) / jump',['hamster/ham_dig.png','hamster/ham_dig_down.png','hamster/ham_jump.png'],2)
row('Hamster: hurt / ride basket (4) / cheek stages 0-3',['hamster/ham_hurt.png','hamster/ham_ride.png','hamster/ham_cheeks.png'],2)
row('Enemies 72x64: mole shade / root beetle / glow worm / crystal bat / magma slug',['enemies/mole_shade.png','enemies/root_beetle.png','enemies/glow_worm.png','enemies/crystal_bat.png','enemies/magma_slug.png'],2)
row('Tiles 32x32 (6 layers x [solid A, solid B, dug wall]) + props',['tiles/tiles.png','props/ore_seeds.png','props/ore_gems.png','props/rock_cracked.png','props/lantern.png','props/beam.png','props/wheel_off.png','props/wheel_on.png'],3)
row('Items 32x32',['items/items.png'],3)
row('UI kit @2x (ui/2x, 9-slice border 12px; 1x and 3x also shipped)',['ui/2x/hud_bar.png','ui/2x/shop_panel.png','ui/2x/cheek_meter.png','ui/2x/btn_gold.png','ui/2x/btn_green.png','ui/2x/btn_wood.png','ui/2x/depth_gauge.png','ui/2x/slot.png'],1)
title('Share card 1200x630 (bg + example)')
sc=L('share/share_bg.png').resize((600,315)); sheet.paste(sc,(20,y)); sheet.paste(L('share/share_card_example.png').resize((600,315)),(640,y)); y+=330
pal=L('palette.png'); title('Shared palette (128)'); sheet.paste(pal.resize((pal.size[0]*1,40),Image.NEAREST),(20,y)); y+=60
d.text((20,y),'Audio: 13 SFX + 19s music loop (assets/audio/*.ogg, synthesized originals)',font=F(18),fill=(200,190,210)); y+=40
sheet.crop((0,0,PW,y)).convert('RGB').save(D+'preview.png')
print('preview',y)
