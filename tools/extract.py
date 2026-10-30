import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def key_mask(img):
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    h,w,_ = a.shape
    border = np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
    bg = np.median(border,axis=0)
    d = np.sqrt(((a-bg)**2).sum(-1))
    r,g,b = a[...,0],a[...,1],a[...,2]
    magenta = (r-g>110)&(b-g>40)&(r>150)
    cand = (d<95)|magenta
    lab,n = ndi.label(cand)
    edge = set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bgm = np.isin(lab,list(edge))
    # interior enclosed bg pockets that are very close to bg
    strict = d<55
    lab2,n2 = ndi.label(strict & ~bgm)
    if n2:
        sizes = ndi.sum(np.ones_like(lab2),lab2,range(1,n2+1))
        big = [i+1 for i,s in enumerate(sizes) if s>60]
        bgm |= np.isin(lab2,big)
    fg = ~bgm
    fg = ndi.binary_opening(fg,iterations=1)
    # despill: shrink by 1px to drop magenta fringe
    fg = ndi.binary_erosion(fg,iterations=1)
    return fg, bg

def components(fg, merge=12, minarea=400):
    m = ndi.binary_dilation(fg,iterations=merge)
    lab,n = ndi.label(m)
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab)):
        sub = (lab[sl]==i+1)&fg[sl]
        if sub.sum()<minarea: continue
        ys,xs = np.nonzero(sub)
        y0,x0 = sl[0].start+ys.min(), sl[1].start+xs.min()
        y1,x1 = sl[0].start+ys.max()+1, sl[1].start+xs.max()+1
        out.append((x0,y0,x1,y1,int(sub.sum())))
    return out

def rows(comps, tol=None):
    comps = sorted(comps,key=lambda c:(c[1]+c[3])/2)
    rs=[]
    for c in comps:
        cy=(c[1]+c[3])/2
        if rs and abs(cy-rs[-1][-1][4+1] if False else cy-np.mean([(k[1]+k[3])/2 for k in rs[-1]]))< (tol or (c[3]-c[1])*0.5):
            rs[-1].append(c)
        else: rs.append([c])
    return [sorted(r,key=lambda c:c[0]) for r in rs]

def rgba_cut(img, fg):
    a = np.asarray(img.convert('RGB'))
    al = (fg*255).astype(np.uint8)
    return Image.fromarray(np.dstack([a,al]),'RGBA')

def downscale(rgba, f):
    """box downscale with premultiplied alpha then hard alpha"""
    a = np.asarray(rgba).astype(np.float32)/255
    rgb = a[...,:3]*a[...,3:4]
    w,h = rgba.size
    nw,nh = max(1,round(w*f)),max(1,round(h*f))
    pm = Image.fromarray((np.dstack([rgb,a[...,3]])*255).astype(np.uint8),'RGBA').resize((nw,nh),Image.BOX)
    b = np.asarray(pm).astype(np.float32)/255
    al = b[...,3]
    rgb = np.where(al[...,None]>0, b[...,:3]/np.maximum(al[...,None],1e-6),0)
    alpha = (al>0.5).astype(np.float32)
    return Image.fromarray((np.dstack([np.clip(rgb,0,1),alpha])*255).astype(np.uint8),'RGBA')

if __name__=='__main__':
    import sys
    for f in sys.argv[1:]:
        im = Image.open(f)
        fg,bg = key_mask(im)
        cs = components(fg)
        print(f,'bg',bg)
        for r in rows(cs):
            print('  row:',[(c[0],c[1],c[2]-c[0],c[3]-c[1]) for c in r])
