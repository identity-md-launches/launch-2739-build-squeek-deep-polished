"""v2 UI kit: procedurally redrawn, hard-pixel 9-slice frames (same 1x sizes as v1, 6px border),
plus exact nearest-neighbour @2x and @3x copies (ui/2x, ui/3x).
cheek_meter portrait = crisp2 cleanup of the raw portrait, masked into the new frame."""
import sys; sys.path.insert(0, '/workspace/squeek_deep/tools')
from v2lib import *
from PIL import ImageDraw
W2 = '/workspace/squeek_deep/work/v2/'
def C(h): return hexrgb(h) + (255,)
INK = C('#1E1218')
WOOD = [C('#4A2410'), C('#743A1A'), C('#A05A28'), C('#C87A38'), C('#EAA558')]
BRASS = [C('#7A4A12'), C('#B8781E'), C('#E8A830'), C('#FFCE40'), C('#FFF0A0')]
DARK = C('#2A1A16'); DARK2 = C('#3A2620')
PARCH = [C('#C8965A'), C('#E2B878'), C('#F4D49C'), C('#FFE8BE')]

def rr(d, box, r, fill):
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, r, fill=fill) if r else d.rectangle(box, fill=fill)

def wood_border(img, x0, y0, x1, y1, b=6, inner=DARK, grainseed=0):
    d = ImageDraw.Draw(img)
    d.rectangle((x0, y0, x1, y1), fill=INK)
    d.rectangle((x0 + 1, y0 + 1, x1 - 1, y1 - 1), fill=WOOD[2])
    rng = np.random.default_rng(grainseed)
    # bevel: light top/left, dark bottom/right of the wood band
    d.line((x0 + 1, y0 + 1, x1 - 1, y0 + 1), fill=WOOD[4]); d.line((x0 + 1, y0 + 1, x0 + 1, y1 - 1), fill=WOOD[3])
    d.line((x0 + 1, y1 - 1, x1 - 1, y1 - 1), fill=WOOD[0]); d.line((x1 - 1, y0 + 1, x1 - 1, y1 - 1), fill=WOOD[1])
    # grain: plank streaks along each band (dark + light), knots
    for band_y in range(y0 + 2, y0 + b - 1):
        x = x0 + 2 + int(rng.integers(0, 6))
        while x < x1 - 3:
            L = int(rng.integers(4, 12)); col = WOOD[1] if rng.random() < 0.6 else WOOD[3]
            if (band_y - y0) % 2 == 1: d.line((x, band_y, min(x + L, x1 - 2), band_y), fill=col)
            yb = y1 - (band_y - y0)
            if (band_y - y0) % 2 == 0: d.line((x, yb, min(x + L, x1 - 2), yb), fill=col)
            x += L + int(rng.integers(4, 10))
    for band_x in range(x0 + 2, x0 + b - 1):
        y = y0 + 2 + int(rng.integers(0, 6))
        while y < y1 - 3:
            L = int(rng.integers(3, 9)); col = WOOD[1] if rng.random() < 0.6 else WOOD[3]
            if (band_x - x0) % 2 == 1: d.line((band_x, y, band_x, min(y + L, y1 - 2)), fill=col)
            xb = x1 - (band_x - x0)
            if (band_x - x0) % 2 == 0: d.line((xb, y, xb, min(y + L, y1 - 2)), fill=col)
            y += L + int(rng.integers(4, 10))
    d.line((x0 + 1, y0 + 1, x1 - 1, y0 + 1), fill=WOOD[4]); d.line((x0 + 1, y0 + 1, x0 + 1, y1 - 1), fill=WOOD[3])
    d.line((x0 + 1, y1 - 1, x1 - 1, y1 - 1), fill=WOOD[0]); d.line((x1 - 1, y0 + 1, x1 - 1, y1 - 1), fill=WOOD[0])
    # inner edge: dark groove then interior
    d.rectangle((x0 + b - 1, y0 + b - 1, x1 - b + 1, y1 - b + 1), fill=INK)
    d.rectangle((x0 + b, y0 + b, x1 - b, y1 - b), fill=inner)
    d.line((x0 + b, y0 + b, x1 - b, y0 + b), fill=DARK if inner != DARK else C('#140C0C'))

def rivet_plate(img, x, y, flipx=False, flipy=False, s=10):
    p = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(p)
    d.polygon([(0, 0), (s - 1, 0), (s - 1, 3), (3, s - 1), (0, s - 1)], fill=INK)
    d.polygon([(1, 1), (s - 2, 1), (s - 2, 3), (3, s - 2), (1, s - 2)], fill=BRASS[2])
    d.line((1, 1, s - 2, 1), fill=BRASS[4]); d.line((1, 1, 1, s - 2), fill=BRASS[3])
    d.line((s - 2, 2, s - 2, 3), fill=BRASS[0]); d.line((2, s - 2, 3, s - 2), fill=BRASS[0])
    # bolt
    d.rectangle((3, 3, 5, 5), fill=BRASS[0]); d.point((3, 3), fill=BRASS[4]); d.point((4, 4), fill=BRASS[1])
    d.point((5, 5), fill=INK)
    if flipx: p = p.transpose(Image.FLIP_LEFT_RIGHT)
    if flipy: p = p.transpose(Image.FLIP_TOP_BOTTOM)
    img.alpha_composite(p, (x, y))

def corners(img, w, h, s=10):
    rivet_plate(img, 0, 0, s=s); rivet_plate(img, w - s, 0, True, s=s)
    rivet_plate(img, 0, h - s, False, True, s=s); rivet_plate(img, w - s, h - s, True, True, s=s)

def panel(w, h, inner, seed):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    wood_border(img, 0, 0, w - 1, h - 1, 6, inner, seed); corners(img, w, h)
    return img

def hud_bar():
    return panel(125, 42, DARK, 1)

def shop_panel():
    img = panel(116, 61, PARCH[2], 2)
    d = ImageDraw.Draw(img); rng = np.random.default_rng(5)
    # parchment shading: warm darker rim inside, a few fibres
    d.rectangle((6, 6, 109, 54), outline=PARCH[1]); d.line((7, 7, 108, 7), fill=PARCH[3])
    for _ in range(14):
        x, y = rng.integers(9, 105), rng.integers(9, 51); d.point((int(x), int(y)), fill=PARCH[1])
    return img

def button(w, h, face, hi, lo, rim=BRASS):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 6, fill=INK)
    d.rounded_rectangle((1, 1, w - 2, h - 2), 5, fill=rim[1])
    d.rounded_rectangle((1, 1, w - 2, h - 4), 5, fill=rim[2])     # rim + bottom lip (pressable depth)
    d.rounded_rectangle((3, 3, w - 4, h - 6), 3, fill=INK)
    d.rounded_rectangle((4, 4, w - 5, h - 7), 3, fill=face)
    d.rectangle((6, h - 10, w - 7, h - 8), fill=lo)
    d.line((5, h - 8, w - 6, h - 8), fill=lo)
    d.rounded_rectangle((5, 5, w - 6, 10), 2, fill=hi)
    d.line((7, 5, w // 3, 5), fill=C('#FFFFFF')); d.point((w // 3 + 2, 5), fill=C('#FFFFFF'))
    d.line((2, 2, w - 8, 2), fill=rim[4])
    return img

def btn_gold(): return button(69, 38, C('#FFB82E'), C('#FFDC6A'), C('#E08A1A'))
def btn_green(): return button(81, 38, C('#58B83A'), C('#A6F07E'), C('#3A8A28'))
def btn_wood(): return button(49, 38, WOOD[2], WOOD[3], WOOD[1], rim=BRASS)

def slot():
    img = panel(45, 46, DARK, 3)
    d = ImageDraw.Draw(img); d.rectangle((7, 7, 37, 38), outline=DARK2)
    return img

def depth_gauge():
    w, h = 20, 56
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    # glass tube
    d.rectangle((3, 4, 16, 51), fill=INK)
    d.rectangle((4, 5, 15, 50), fill=C('#3A3448'))
    d.line((5, 6, 5, 49), fill=C('#6A6488')); d.line((6, 7, 6, 32), fill=C('#B8C8E8')); d.line((14, 6, 14, 49), fill=C('#262030'))
    for i, y in enumerate(range(9, 49, 4)):
        d.line((12 if i % 2 else 10, y, 15, y), fill=BRASS[2])
    # caps
    for y0 in (0, 49):
        d.rectangle((1, y0, 18, y0 + 6), fill=INK)
        d.rectangle((2, y0 + 1, 17, y0 + 5), fill=BRASS[2])
        d.line((2, y0 + 1, 17, y0 + 1), fill=BRASS[4]); d.line((2, y0 + 5, 17, y0 + 5), fill=BRASS[0])
        d.line((2, y0 + 3, 17, y0 + 3), fill=BRASS[1])
    return img

def cheek_meter():
    w, h = 115, 40
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    # capsule bar
    d.rounded_rectangle((26, 7, 108, 32), 12, fill=INK)
    d.rounded_rectangle((27, 8, 107, 31), 11, fill=WOOD[2])
    d.line((36, 9, 100, 9), fill=WOOD[4]); d.line((36, 30, 100, 30), fill=WOOD[0])
    d.rounded_rectangle((33, 12, 102, 27), 7, fill=INK)
    d.rounded_rectangle((34, 13, 101, 26), 6, fill=BRASS[1])
    d.rounded_rectangle((36, 15, 99, 24), 4, fill=DARK)
    d.line((40, 15, 95, 15), fill=C('#140C0C'))
    # end knob
    d.rectangle((108, 17, 112, 22), fill=INK); d.rectangle((109, 18, 111, 21), fill=BRASS[2]); d.point((109, 18), fill=BRASS[4])
    # portrait ring
    d.ellipse((0, 0, 39, 39), fill=INK)
    d.ellipse((1, 1, 38, 38), fill=BRASS[1])
    d.ellipse((1, 1, 37, 37), fill=BRASS[2])
    d.arc((2, 2, 36, 36), 180, 270, fill=BRASS[4])
    d.ellipse((4, 4, 35, 35), fill=INK)
    d.ellipse((5, 5, 34, 34), fill=C('#3E6E92')); d.arc((6, 6, 33, 33), 200, 260, fill=C('#6AA0C8'))
    # portrait from raw ui_kit, crisp-cleaned
    im = Image.open(ROOT + 'raw/ui_kit.jpg'); fg, _ = key_mask(im); cut = rgba_cut(im, fg)
    c = rows(components(fg))[2][0]
    src = cut.crop(c[:4]); sw, sh = src.size
    face = src.crop((int(sw * 0.02), int(sh * 0.02), int(sw * 0.33), int(sh * 0.98)))
    f = 30 / face.size[0]
    fc = crisp2(face, f, 12, 3, darkbias=0.4); fc = despeckle(fc)
    fa = np.asarray(fc).copy()
    lum = fa[..., :3].astype(int) @ np.array([30, 59, 11]) // 100
    dk = (lum < 45) | (fa[..., 3] == 0)
    lab, _ = ndi.label(dk); edge_l = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(edge_l))
    fa[..., 3] = np.where(bgm, 0, fa[..., 3])            # drop the raw portrait's dark backdrop (border-connected only)
    fc = trim(Image.fromarray(fa))
    tile = Image.new('RGBA', (30, 30), (0, 0, 0, 0))
    tile.alpha_composite(fc, ((30 - fc.width) // 2, 30 - fc.height if fc.height < 30 else 0))
    fa = np.asarray(tile).copy()
    m = Image.new('L', (30, 30), 0); ImageDraw.Draw(m).ellipse((0, 0, 29, 29), fill=255)
    fa[..., 3] = np.where((np.asarray(m) > 0) & (fa[..., 3] > 0), 255, 0)
    img.alpha_composite(Image.fromarray(fa), (5, 5))
    return img

ALL = dict(hud_bar=hud_bar, shop_panel=shop_panel, btn_gold=btn_gold, btn_green=btn_green, btn_wood=btn_wood,
           cheek_meter=cheek_meter, depth_gauge=depth_gauge, slot=slot)
if __name__ == '__main__':
    for n, fn in ALL.items():
        fn().save(W2 + 'ui_' + n + '.png')
