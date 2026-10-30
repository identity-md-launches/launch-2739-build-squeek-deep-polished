"""compare.png: v1 (from _v1_backup) vs v2 (assets/) for tiles, hamster frames, mole shade, UI, mockup."""
from PIL import Image, ImageDraw, ImageFont
D = '/workspace/squeek_deep/'; V1 = D + '_v1_backup/assets/'; V2 = D + 'assets/'
FP = '/usr/share/fonts/truetype/sand-box/google/Pixelify Sans/PixelifySans-VariableFont_wght.ttf'
F = lambda s: ImageFont.truetype(FP, s)
BG = (30, 24, 38, 255); CELL = (58, 48, 70, 255)
def L(p): return Image.open(p).convert('RGBA')
def up(im, s): return im.resize((im.width * s, im.height * s), Image.NEAREST)
def on(im, col=CELL):
    c = Image.new('RGBA', im.size, col); c.alpha_composite(im); return c
W = 1960
sheet = Image.new('RGBA', (W, 6400), BG); d = ImageDraw.Draw(sheet); y = 16
def title(s, sz=30, col=(255, 206, 64)):
    global y; d.text((20, y), s, font=F(sz), fill=col); y += sz + 12
def pair(a, b, la='v1', lb='v2'):
    global y
    d.text((20, y), la, font=F(22), fill=(200, 160, 160)); d.text((W // 2 + 10, y), lb, font=F(22), fill=(170, 230, 160)); y += 30
    sheet.paste(on(a), (20, y)); sheet.paste(on(b), (W // 2 + 10, y)); y += max(a.height, b.height) + 26
title('SQUEEK DEEP  —  v1 vs v2 asset polish', 40)
title('Tiles (6 layers x solidA / solidB / dug wall), 3x')
pair(up(L(V1 + 'tiles/tiles.png'), 3), up(L(V2 + 'tiles/tiles.png'), 3))
title('Tiles tiled 3x3 (seamless check), 2x')
def tiled(p):
    t = up(L(p), 2); out = Image.new('RGBA', (3 * 192 + 2 * 12, 6 * 192 + 5 * 10), BG)
    for r in range(6):
        for c in range(3):
            tt = t.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64))
            for i in range(3):
                for j in range(3): out.paste(tt, (c * 204 + i * 64, r * 202 + j * 64))
    return up(out, 1)
pair(tiled(V1 + 'tiles/tiles.png'), tiled(V2 + 'tiles/tiles.png'))
for nm, lab in [('ham_walk', 'Hamster walk (all frames), 3x'), ('ham_dig', 'Hamster dig, 3x'), ('ham_ride', 'Hamster basket ride (v1: 2 frames, v2: 4), 3x')]:
    title(lab)
    a = L(V1 + 'hamster/%s.png' % nm); b = L(V2 + 'hamster/%s.png' % nm)
    s = 3 if max(a.width, b.width) * 3 <= W // 2 - 30 else 2
    pair(up(a, s), up(b, s))
title('NEW: hamster dig-down (v2 only), 3x')
b = L(V2 + 'hamster/ham_dig_down.png'); sheet.paste(on(up(b, 3)), (W // 2 + 10, y)); y += b.height * 3 + 26
title('Mole shade (float / telegraph / lunge), 4x')
pair(up(L(V1 + 'enemies/mole_shade.png'), 4), up(L(V2 + 'enemies/mole_shade.png'), 4))
title('UI kit, 3x  (v2 also ships ui/2x and ui/3x nearest-neighbour copies)')
def uik(base):
    names = ['hud_bar', 'shop_panel', 'cheek_meter', 'btn_gold', 'btn_green', 'btn_wood', 'depth_gauge', 'slot']
    ims = [up(L(base + 'ui/%s.png' % n), 3) for n in names]
    out = Image.new('RGBA', (W // 2 - 30, 700), BG); x = 0; yy = 0; rh = 0
    for im in ims:
        if x + im.width > out.width: x = 0; yy += rh + 8; rh = 0
        out.alpha_composite(on(im), (x, yy)); x += im.width + 8; rh = max(rh, im.height)
    return out.crop((0, 0, out.width, yy + rh))
pair(uik(V1), uik(V2))
title('In-game mockup (480x270 @2x)')
pair(L(D + '_v1_backup/assets/mock_gameplay_target.png'), L(V2 + 'mock_gameplay_target.png'))
sheet.crop((0, 0, W, y)).convert('RGB').save(D + 'compare.png', optimize=True)
print(y)
