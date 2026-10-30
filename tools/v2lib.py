"""Squeek Deep v2 pixel helpers: crisp (mode) downscale, cleanup, palette ops."""
import numpy as np, sys, os
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from extract import key_mask, components, rows, rgba_cut

ROOT = '/workspace/squeek_deep/'
INK = (30, 18, 24)

def kmeans(px, k, it=25, seed=0):
    px = px.astype(np.float32)
    rng = np.random.RandomState(seed)
    c = px[rng.choice(len(px), min(k, len(px)), replace=False)].copy()
    for _ in range(it):
        d = ((px[:, None, :] - c[None]) ** 2).sum(-1); lab = d.argmin(1)
        for j in range(len(c)):
            m = lab == j
            if m.any(): c[j] = px[m].mean(0)
    return c, lab

def crisp_downscale(rgba, f, k=28, cov=0.5):
    """Downscale by factor f picking the MODE colour per block (no blending)."""
    a = np.asarray(rgba).astype(np.float32)
    h, w = a.shape[:2]
    fg = a[..., 3] > 127
    px = a[fg][:, :3]
    sub = px[np.random.RandomState(1).choice(len(px), min(len(px), 6000), replace=False)]
    cent, _ = kmeans(sub, k)
    d = ((a[..., None, :3] - cent[None, None]) ** 2).sum(-1)
    lab = d.argmin(-1); lab[~fg] = -1
    nw, nh = max(1, round(w * f)), max(1, round(h * f))
    out = np.zeros((nh, nw, 4), np.uint8)
    xs = np.linspace(0, w, nw + 1); ys = np.linspace(0, h, nh + 1)
    for j in range(nh):
        y0, y1 = int(ys[j]), max(int(ys[j]) + 1, int(round(ys[j + 1])))
        for i in range(nw):
            x0, x1 = int(xs[i]), max(int(xs[i]) + 1, int(round(xs[i + 1])))
            # weight the centre of the block more (avoids outline smear)
            blk = lab[y0:y1, x0:x1]
            if (blk >= 0).mean() < cov: continue
            cy, cx = (y1 - y0), (x1 - x0)
            inner = blk[cy // 4: cy - cy // 4 or None, cx // 4: cx - cx // 4 or None]
            v = inner[inner >= 0] if (inner >= 0).any() else blk[blk >= 0]
            # dark (outline) colours win ties to keep lines continuous
            cnt = np.bincount(v, minlength=len(cent)).astype(np.float32)
            lum = cent[:, :3] @ [0.3, 0.59, 0.11]
            cnt += (lum < 70) * 0.35 * cnt.max() * (cnt > 0)
            out[j, i, :3] = cent[cnt.argmax()].round()
            out[j, i, 3] = 255
    return Image.fromarray(out, 'RGBA')

def despeckle(im, passes=1):
    """Replace opaque pixels whose colour differs from all 4-neighbours by the neighbour majority."""
    a = np.asarray(im).copy()
    h, w = a.shape[:2]
    for _ in range(passes):
        b = a.copy()
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if a[y, x, 3] == 0: continue
                c = tuple(a[y, x, :3])
                nb = [a[y + dy, x + dx] for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0))]
                op = [tuple(n[:3]) for n in nb if n[3] > 0]
                if len(op) < 4 or c in op: continue
                vals, cnts = np.unique(np.array(op), axis=0, return_counts=True)
                if cnts.max() >= 3:
                    b[y, x, :3] = vals[cnts.argmax()]
        a = b
    # isolated opaque pixels / holes
    al = a[..., 3] > 0
    n = ndi.convolve(al.astype(int), np.ones((3, 3), int), mode='constant') - al
    a[al & (n <= 1), 3] = 0
    hole = (~al) & (n >= 7)
    if hole.any():
        for y, x in zip(*np.nonzero(hole)):
            nbs = a[max(0, y - 1):y + 2, max(0, x - 1):x + 2].reshape(-1, 4)
            nbs = nbs[nbs[:, 3] > 0]
            a[y, x] = nbs[len(nbs) // 2]
    return Image.fromarray(a, 'RGBA')

def outline(im, color=INK, mode='self'):
    """'self': darken boundary pixels of the sprite (keeps silhouette); 'outer': add 1px outer ring."""
    a = np.asarray(im).copy()
    al = a[..., 3] > 0
    if mode == 'outer':
        ring = ndi.binary_dilation(al, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~al
        a[ring] = (*color, 255)
    else:
        er = ndi.binary_erosion(al, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]], border_value=0)
        edge = al & ~er
        rgb = a[..., :3].astype(np.float32)
        lum = rgb @ [0.3, 0.59, 0.11]
        dark = rgb * 0.35 + np.array(color) * 0.65
        sel = edge & (lum > 60)
        a[sel, :3] = dark[sel].round()
    return Image.fromarray(a, 'RGBA')

def to_palette(im, pal, keep_alpha_levels=False):
    a = np.asarray(im.convert('RGBA')).astype(np.int32)
    p = np.asarray(pal, np.int32)
    flat = a[..., :3].reshape(-1, 3)
    out = np.empty_like(flat)
    for s in range(0, len(flat), 65536):
        ch = flat[s:s + 65536]
        d = ((ch[:, None, :] - p[None]) ** 2).sum(-1)
        out[s:s + 65536] = p[d.argmin(1)]
    rgb = out.reshape(a.shape[:2] + (3,))
    al = a[..., 3]
    if not keep_alpha_levels: al = np.where(al > 0, 255, 0)
    rgb[al == 0] = 0
    return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')

def bbox(im):
    a = np.asarray(im)[..., 3] > 0
    ys, xs = np.nonzero(a)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def place(sprite, W, H, cx=None, base=None, dx=0, dy=0):
    """Paste sprite into WxH cell, horizontally centred on cx, bottom at base."""
    cell = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sw, sh = sprite.size
    cx = W // 2 if cx is None else cx
    base = H - 2 if base is None else base
    cell.alpha_composite(sprite, (cx - sw // 2 + dx, base - sh + dy))
    return cell

def strip(frames):
    fw, fh = frames[0].size
    s = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames): s.paste(f, (i * fw, 0))
    return s

def raw_sprites(name):
    im = Image.open(ROOT + 'raw/' + name); fg, _ = key_mask(im); cut = rgba_cut(im, fg)
    out = []
    for r in rows(components(fg)):
        out.append([cut.crop((c[0], c[1], c[2], c[3])) for c in r])
    return out

def trim(im):
    return im.crop(bbox(im))

def up(im, s):
    return im.resize((im.size[0] * s, im.size[1] * s), Image.NEAREST)

def mode_filter_labels(lab, size=5, n=None):
    n = n or lab.max() + 2
    best = None; bestc = None
    L = lab + 1
    for v in range(n):
        c = ndi.uniform_filter((L == v).astype(np.float32), size)
        if best is None: best = np.zeros_like(L); bestc = c
        else:
            m = c > bestc; best[m] = v; bestc = np.where(m, c, bestc)
    return best - 1

def crisp2(rgba, f, k=16, smooth=5, darkbias=0.35):
    """k-means -> label mode filter at hi-res -> block-mode downscale."""
    a = np.asarray(rgba).astype(np.float32)
    h, w = a.shape[:2]
    fg = a[..., 3] > 127
    px = a[fg][:, :3]
    sub = px[np.random.RandomState(1).choice(len(px), min(len(px), 8000), replace=False)]
    cent, _ = kmeans(sub, k)
    d = ((a[..., None, :3] - cent[None, None]) ** 2).sum(-1)
    lab = d.argmin(-1); lab[~fg] = -1
    if smooth: lab = mode_filter_labels(lab, smooth, len(cent) + 1)
    nw, nh = max(1, round(w * f)), max(1, round(h * f))
    out = np.zeros((nh, nw, 4), np.uint8)
    xs = np.linspace(0, w, nw + 1); ys = np.linspace(0, h, nh + 1)
    lum = cent @ np.array([0.3, 0.59, 0.11])
    for j in range(nh):
        y0, y1 = int(ys[j]), max(int(ys[j]) + 1, int(round(ys[j + 1])))
        for i in range(nw):
            x0, x1 = int(xs[i]), max(int(xs[i]) + 1, int(round(xs[i + 1])))
            blk = lab[y0:y1, x0:x1]
            if (blk >= 0).mean() < 0.5: continue
            v = blk[blk >= 0]
            cnt = np.bincount(v, minlength=len(cent)).astype(np.float32)
            cnt += (lum < 60) * darkbias * cnt.max() * (cnt > 0)
            out[j, i, :3] = cent[cnt.argmax()].round(); out[j, i, 3] = 255
    return Image.fromarray(out, 'RGBA')

HAM_PAL = ['#1e1218', '#4a2412', '#8a4414', '#c0621c', '#e8862a', '#f8a84a',
           '#d8a070', '#f2cc98', '#fff0d0', '#e07c78', '#a84c50', '#9a5a0c',
           '#e0a010', '#ffce40', '#fff3a8', '#ffffff', '#6a6a7a', '#b0b0c0']
def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def lowres_clean(im, keep=('#1e1218', '#ffffff'), passes=2):
    """3x3 mode filter on interior pixels; colours in `keep` are never overwritten / never spread."""
    a = np.asarray(im).copy(); h, w = a.shape[:2]
    keep = [hexrgb(k) for k in keep]
    for _ in range(passes):
        b = a.copy()
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if a[y, x, 3] == 0 or tuple(a[y, x, :3]) in keep: continue
                nb = a[y - 1:y + 2, x - 1:x + 2].reshape(-1, 4)
                if (nb[:, 3] == 0).any(): continue
                cols = [tuple(n[:3]) for k2, n in enumerate(nb) if k2 != 4 and tuple(n[:3]) not in keep]
                if not cols: continue
                vals, cnts = np.unique(np.array(cols), axis=0, return_counts=True)
                me = sum(1 for c in cols if c == tuple(a[y, x, :3]))
                if me <= 1 and cnts.max() >= 5: b[y, x, :3] = vals[cnts.argmax()]
        a = b
    return Image.fromarray(a, 'RGBA')

def ham_clean(raw, f, k=18):
    s = crisp2(raw, f, k, 5); s = despeckle(s); s = lowres_clean(s, keep=())
    s = outline(s, mode='outer'); return trim(s)
