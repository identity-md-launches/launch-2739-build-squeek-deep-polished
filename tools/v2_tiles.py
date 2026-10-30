"""v2 tiles: procedural, seamless (toroidal) 32px pixel-art tiles, hard edges, no AA.
Output work/v2/tiles.png (3 cols x 6 rows)."""
import numpy as np
from PIL import Image
T = 32
W2 = '/workspace/squeek_deep/work/v2/'
def H(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def voronoi(rng, n, jitter=1.0):
    md = T / np.sqrt(n) * 0.75
    pts = []
    while len(pts) < n:
        q = rng.uniform(0, T, 2)
        ok = True
        for p in pts:
            d = np.abs(q - p); d = np.minimum(d, T - d)
            if np.hypot(*d) < md: ok = False; break
        if ok: pts.append(q)
        md *= 0.999
    pts = np.array(pts)
    yy, xx = np.mgrid[0:T, 0:T]
    d = np.full((n, T, T), 1e9)
    for i, (px, py) in enumerate(pts):
        dx = np.abs(xx - px); dx = np.minimum(dx, T - dx)
        dy = np.abs(yy - py); dy = np.minimum(dy, T - dy)
        dy = dy * 1.25  # slightly wide cells (horizontal strata feel)
        d[i] = np.sqrt(dx * dx + dy * dy)
    o = np.argsort(d, axis=0)
    lab = o[0]; d1 = np.take_along_axis(d, o[:1], 0)[0]; d2 = np.take_along_axis(d, o[1:2], 0)[0]
    return lab, d2 - d1

def roll(a, dy, dx): return np.roll(np.roll(a, dy, 0), dx, 1)

def cobble(rng, n, ramp, crack, gap=1.1, tones=(1, 2, 2, 3)):
    """ramp: [shadow, dark, mid, light, highlight]; returns index image into ramp (+crack=-1)."""
    lab, e = voronoi(rng, n)
    tone = rng.choice(tones, size=n)
    idx = tone[lab].copy()
    edge = e < gap
    # light from top-left: pixel whose upper/left neighbour is a different cell -> highlight
    up_diff = roll(lab, 1, 0) != lab; lf_diff = roll(lab, 0, 1) != lab
    dn_diff = roll(lab, -1, 0) != lab; rt_diff = roll(lab, 0, -1) != lab
    inner = ~edge
    hl = inner & (roll(edge, 1, 0) | roll(edge, 0, 1))
    sh = inner & (roll(edge, -1, 0) | roll(edge, 0, -1))
    idx = np.where(hl, np.minimum(idx + 1, 4), idx)
    idx = np.where(sh & ~hl, np.maximum(idx - 1, 0), idx)
    idx = np.where(edge, -1, idx)
    return idx, lab

def paint(idx, ramp, crack):
    pal = np.array(ramp + [crack], np.uint8)
    return pal[np.where(idx < 0, len(ramp), idx)]

def dots(img, rng, n, col, avoid=None, size=1):
    for _ in range(n):
        x, y = rng.integers(0, T, 2)
        for dy in range(size):
            for dx in range(size):
                img[(y + dy) % T, (x + dx) % T] = col

def put(img, x, y, c):
    img[y % T, x % T] = c

# ---------------------------------------------------------------- layers
def topsoil(seed):
    rng = np.random.default_rng(seed)
    ramp = [H('5E3820'), H('7A4A2A'), H('955E34'), H('B47842'), H('D69A5C')]
    idx, _ = cobble(rng, 9, ramp, H('3E2416'), gap=0.9, tones=(1, 2, 2, 2, 3))
    img = paint(idx, ramp, H('42261A'))
    # pebbles: 3x2 grey-beige ovals with highlight
    for _ in range(3):
        x, y = rng.integers(0, T, 2)
        for dx, dy, c in [(0,0,'A89A88'),(1,0,'C8BCA8'),(2,0,'A89A88'),(0,1,'7E7062'),(1,1,'938676'),(2,1,'7E7062'),(1,-1,'5A4A3C')]:
            if dy == -1: continue
            put(img, x+dx, y+dy, H(c))
        put(img, x+1, y+2, H('4A2E1C')); put(img, x+2, y+2, H('4A2E1C'))
    # rootlets: short wiggly pale lines
    for _ in range(2):
        x, y = rng.integers(0, T, 2)
        for k in range(rng.integers(5, 9)):
            put(img, x + k, y + int(1.2 * np.sin(k * 0.9)), H('E2B27A'))
            if k % 3 == 0: put(img, x + k, y + int(1.2 * np.sin(k * 0.9)) + 1, H('8A5230'))
    dots(img, rng, 10, H('C88A50'))
    return img

def clay(seed):
    rng = np.random.default_rng(seed)
    ramp = [H('8C3E26'), H('AE5232'), H('C8683E'), H('E08856'), H('F4AE7A')]
    yy, xx = np.mgrid[0:T, 0:T]
    ph = rng.uniform(0, 6.28)
    band = (yy + 2.0 * np.sin(2 * np.pi * xx / T + ph) + 1.0 * np.sin(4 * np.pi * xx / T + ph * 2)) % T
    # strata: 4 bands of 8 px
    b = (band // 8).astype(int)
    tones = np.array([2, 3, 2, 1])[(b + seed) % 4]
    idx = tones.copy()
    # thin dark seams between strata + light lip on top of each band
    fr = band % 8
    idx = np.where(fr < 1, 0, idx)
    idx = np.where((fr >= 1) & (fr < 2), np.minimum(tones + 1, 4), idx)
    img = paint(idx, ramp, H('5C2818'))
    # small embedded clay nodules (lighter blobs) and dark specks
    for _ in range(4):
        x, y = rng.integers(0, T, 2)
        for dx, dy in [(0,0),(1,0),(0,1),(1,1),(2,0)]: put(img, x+dx, y+dy, H('E89A66'))
        put(img, x, y-1, H('FAC294')); put(img, x+1, y+2, H('9A4630')); put(img, x+2, y+1, H('9A4630'))
    dots(img, rng, 9, H('7E3420'))
    dots(img, rng, 4, H('F8C8A0'))
    return img

def stone(seed):
    rng = np.random.default_rng(seed)
    ramp = [H('4C5670'), H('66728E'), H('808CA8'), H('A0ACC4'), H('C8D2E4')]
    idx, _ = cobble(rng, 7, ramp, H('2C3248'), gap=1.0, tones=(1, 2, 2, 3))
    img = paint(idx, ramp, H('2E3448'))
    # mineral flecks
    dots(img, rng, 6, H('DCE6F4'))
    dots(img, rng, 5, H('5A6480'))
    return img

def crystal(seed):
    rng = np.random.default_rng(seed)
    ramp = [H('2E2860'), H('40387E'), H('54489A'), H('6C60B6'), H('8C80D0')]
    idx, _ = cobble(rng, 7, ramp, H('1E1A40'), gap=1.0, tones=(1, 1, 2, 2))
    img = paint(idx, ramp, H('201A44'))
    # crystal clusters: vertical prisms, kept 3px inside the tile
    CL = [H('1E6AA8'), H('3AA8E0'), H('8CE6FF'), H('D8FAFF')]
    spots = [(rng.integers(7, 11), rng.integers(16, 26)), (rng.integers(21, 25), rng.integers(16, 26))]
    if seed % 2: spots = [(16, rng.integers(18, 24))]
    for cx, by in spots:
        for k, (ox, hgt, lean) in enumerate([(-3, 6, -1), (0, 10, 0), (3, 7, 1)]):
            top = max(4, by - hgt)
            for y in range(top, by + 1):
                x0 = cx + ox + (lean * (by - y) // 4)
                img[y, x0 - 1] = CL[1]; img[y, x0] = CL[2]; img[y, x0 + 1] = CL[0]
                if y == by - 2 or y == top + 1: img[y, x0 - 1] = CL[3]
            x0 = cx + ox + (lean * (by - top) // 4)
            img[top - 1, x0] = CL[3]; img[top - 2, x0] = CL[2]
            img[top, x0 - 1] = CL[3]; img[top, x0 + 1] = CL[1]
            img[top - 1, x0 + 1] = CL[0]
        # base shadow
        for x in range(cx - 4, cx + 5): img[min(by + 1, 28), x] = H('1E1A40')
    dots(img, rng, 4, H('B8F0FF'))
    return img

def fungal(seed):
    rng = np.random.default_rng(seed)
    ramp = [H('3E2C54'), H('543C6E'), H('6A4C88'), H('8462A4'), H('A882C4')]
    idx, lab = cobble(rng, 8, ramp, H('281C3A'), gap=1.0, tones=(1, 2, 2, 3))
    img = paint(idx, ramp, H('2A1E3E'))
    # teal moss patches on a few cells (hard dithered)
    yy, xx = np.mgrid[0:T, 0:T]
    moss_cells = rng.choice(8, 2, replace=False)
    m = np.isin(lab, moss_cells) & (idx >= 0)
    img[m] = H('2E8C80')
    img[m & (idx >= 3)] = H('4CC0A4')
    img[m & ~roll(m, 1, 0)] = H('8CF0CC')
    # glowing pink mushrooms, inside tile
    for _ in range(1):
        cx, by = rng.integers(8, 22), rng.integers(18, 27)
        for y in range(by - 4, by + 1):
            img[y, cx] = H('F6E6F0'); img[y, cx + 1] = H('F6E6F0'); img[y, cx + 2] = H('C8A8C8')
        rows_ = [(-7, 0, 3), (-6, -2, 5), (-5, -3, 6), (-4, -3, 6)]
        for dy, x0, x1 in rows_:
            for dx in range(x0, x1 + 1): img[by + dy, cx + dx] = H('FF6EB4')
        for dx in range(-3, 7): img[by - 4, cx + dx] = H('C8428C')
        for dx in range(-1, 3): img[by - 8, cx + dx] = H('8A2A64')
        img[by - 7, cx - 1] = H('8A2A64'); img[by - 7, cx + 4] = H('8A2A64')
        img[by - 6, cx - 3] = H('8A2A64'); img[by - 6, cx + 6] = H('8A2A64')
        img[by - 6, cx] = H('FFE8F4'); img[by - 5, cx + 3] = H('FFE8F4'); img[by - 7, cx + 1] = H('FFB8DC')
        img[by - 5, cx - 2] = H('FFB8DC')
        img[by + 1, cx - 1:cx + 4] = H('281C3A')
    dots(img, rng, 5, H('B8FFE6'))
    return img

def magma(seed):
    rng = np.random.default_rng(seed)
    ramp = [H('342630'), H('46343E'), H('58444E'), H('6E5660'), H('8C707A')]
    lab, e = voronoi(rng, 7)
    tone = rng.choice([1, 2, 2, 3], size=7)
    idx = tone[lab].copy()
    edge = e < 1.35
    hl = ~edge & (roll(edge, 1, 0) | roll(edge, 0, 1))
    idx = np.where(hl, np.minimum(idx + 1, 4), idx)
    img = np.array(ramp, np.uint8)[idx]
    # glowing cracks: core yellow, orange, red rim
    core = e < 0.55
    img[edge] = H('E8461E')
    img[(e < 0.85)] = H('FF8A20')
    img[e < 0.35] = H('FFD84A')
    # heat glow on rock right next to cracks
    near = (~edge) & (roll(edge, -1, 0) | roll(edge, 1, 0) | roll(edge, 0, 1) | roll(edge, 0, -1))
    img[near & ~hl] = H('7A3A2C')
    dots(img, rng, 4, H('FFB040'))
    return img

def dug(solid, hue_dark, hue_mid, k=0.5):
    """Dug-out wall: same pattern, compressed to 3 dark tones of the layer hue (readable but recessive)."""
    lum = solid.astype(float) @ np.array([0.3, 0.59, 0.11])
    q = np.digitize(lum, np.percentile(lum, [22, 70]))
    pal = np.array([hue_dark, hue_mid, tuple(int(c * 1.18) for c in hue_mid)], np.uint8)
    out = pal[q]
    return out

LAYERS = [
    (topsoil, ('3A2416', '563620')),
    (clay, ('4E2418', '6C3424')),
    (stone, ('262C3E', '3A4258')),
    (crystal, ('1C1838', '2C2652')),
    (fungal, ('221830', '362648')),
    (magma, ('382A30', '42303A')),
]

def build():
    sheet = np.zeros((T * 6, T * 3, 4), np.uint8); sheet[..., 3] = 255
    for r, (fn, (dk, md)) in enumerate(LAYERS):
        a = fn(11 + r * 7); b = fn(12 + r * 7)
        base = fn(99 + r)
        if fn is magma:
            d = dug(base, H(dk), H(md))
            # keep faint ember cracks in dug magma wall
            lum = base.astype(int)
            hot = (lum[..., 0] > 200) & (lum[..., 2] < 120)
            d[hot] = H('6A2A1A')
        elif fn is crystal:
            d = dug(base, H(dk), H(md)); 
            cy = (base[..., 2] > 200) & (base[..., 0] < 200)
            d[cy] = H('3A5A8A')
        elif fn is fungal:
            d = dug(base, H(dk), H(md))
            pk = (base[..., 0] > 230) & (base[..., 1] < 140)
            d[pk] = H('7A3A66')
        else:
            d = dug(base, H(dk), H(md))
        for c, t in enumerate([a, b, d]):
            sheet[r * T:(r + 1) * T, c * T:(c + 1) * T, :3] = t
    Image.fromarray(sheet, 'RGBA').save(W2 + 'tiles.png')

if __name__ == '__main__':
    build()
    s = Image.open(W2 + 'tiles.png')
    # seamless check: 3x3 tiling of each solid
    big = Image.new('RGBA', (T * 3 * 3 * 3 + 40, T * 3 * 6), (0, 0, 0, 255))
    for r in range(6):
        for c in range(3):
            t = s.crop((c * T, r * T, c * T + T, r * T + T))
            for i in range(3):
                for j in range(3):
                    big.paste(t, (c * (T * 3 + 20) + i * T, r * T * 3 + j * T))
    big.resize((big.width * 2, big.height * 2), Image.NEAREST).save(W2 + 't_tiles_tiled.png')
