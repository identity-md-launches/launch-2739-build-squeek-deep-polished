"""v2 mole shade: from raw/mole_shade_v2.jpg (generated ghost-mole concept) -> crisp 72x64 strip.
Outer glow ring + tail tips get partial alpha so it reads as spectral; engine still draws at 0.85."""
import sys; sys.path.insert(0, '/workspace/squeek_deep/tools')
from v2lib import *
W2 = '/workspace/squeek_deep/work/v2/'
EW, EH = 72, 64
im = Image.open(ROOT + 'raw/mole_shade_v2.jpg'); fg, _ = key_mask(im); cut = rgba_cut(im, fg)
row = rows(components(fg, merge=4))[0]
mw = max(c[2] - c[0] for c in row); mh = max(c[3] - c[1] for c in row)
f = min(68 / mw, 60 / mh)
frames = []
for i, c in enumerate(row):
    s = crisp2(cut.crop(c[:4]), f, 20, 3, darkbias=0.5); s = despeckle(s); s = trim(s)
    a = np.asarray(s).copy().astype(np.int32)
    al = a[..., 3] > 0
    er1 = ndi.binary_erosion(al, border_value=0)
    ring = al & ~er1                     # outermost pixels = the glow halo
    lum = a[..., :3] @ np.array([0.3, 0.59, 0.11])
    # halo: unify to soft lavender glow, translucent
    a[ring, :3] = (196, 170, 255); a[ring, 3] = 130
    # second ring: if very light-pink halo colour, make it the bright rim
    er2 = ndi.binary_erosion(er1, border_value=0); ring2 = er1 & ~er2
    pinkish = (a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 170)
    a[ring2 & pinkish, :3] = (150, 120, 240)
    # tail: lower-right/bottom 22% gets dithered translucency
    h, w = al.shape
    yy, xx = np.mgrid[0:h, 0:w]
    low = (yy > h * 0.80) & er1
    a[low, 3] = np.where((xx[low] + yy[low]) % 2 == 0, 200, 150)
    lab, n = ndi.label(a[..., 3] > 0)
    for k in range(1, n + 1):
        m = lab == k
        if m.sum() <= 4:
            a[m, :3] = (210, 255, 236); a[m, 3] = 230
    out = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
    cell = Image.new('RGBA', (EW, EH), (0, 0, 0, 0))
    sw, sh = out.size
    cell.alpha_composite(out, ((EW - sw) // 2, EH - 1 - sh - [1, 1, 3][i]))
    frames.append(cell)
strip(frames).save(W2 + 'mole_shade.png')
print(f, [fr.size for fr in frames])
