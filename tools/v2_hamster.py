"""v2 hamster rig: one cleaned master -> idle/walk/dig_down (consistent silhouette & baseline)."""
import sys; sys.path.insert(0, '/workspace/squeek_deep/tools')
from v2lib import *
from PIL import ImageDraw
W2 = '/workspace/squeek_deep/work/v2/'
FW = FH = 80; BASE = 78; CX = 40   # last opaque row = 77, centre x = 40
INKC = (30, 18, 24, 255)

rs = raw_sprites('ham_idle_walk.jpg')
M = ham_clean(rs[0][0], 0.2)                      # 37x52 master
A = np.asarray(M).copy(); MH, MW = A.shape[:2]

def eye_highlight(a):
    # find the eye: largest ink blob in head rows 12..22, x 15..28
    sub = (a[12:22, 15:28, 3] > 0) & (a[12:22, 15:28, :3].sum(-1) < 120)
    lab, n = ndi.label(sub)
    if not n: return a, None
    sizes = ndi.sum(sub, lab, range(1, n + 1)); i = int(np.argmax(sizes)) + 1
    ys, xs = np.nonzero(lab == i); ys += 12; xs += 15
    a[ys.min(), xs.min() + 1] = (255, 255, 255, 255)
    return a, (xs.min(), ys.min(), xs.max(), ys.max())
A, EYE = eye_highlight(A)
M = Image.fromarray(A)

# ---- split body / feet
FOOT_Y = 47
body = A.copy(); body[FOOT_Y + 1:] = 0
# re-close bottom: ink under any body pixel that lost its lower neighbour
for x in range(MW):
    col = np.nonzero(body[:, x, 3])[0]
    if len(col) and col.max() == FOOT_Y and A[FOOT_Y + 1, x, 3]:
        body[FOOT_Y + 1, x] = INKC
BODY = Image.fromarray(body)

def foot(x0, x1):
    f = A.copy(); f[:FOOT_Y - 1] = 0; f[:, :x0] = 0; f[:, x1:] = 0
    return trim(Image.fromarray(f))
HIND = foot(3, 14); FRONT = foot(21, 34)
HX, FX = 4, 22   # home x of feet in master coords
HY = FOOT_Y - 1

def compose(dy_body=0, hind=(0, 0), front=(0, 0), extra_under=None, extra_over=None, body_img=None):
    """Assemble a frame; offsets in px. Feet: (dx, lift)."""
    cell = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    ox = CX - MW // 2; oy = BASE - MH
    if extra_under: extra_under(cell, ox, oy)
    # far (hind) foot slightly darker so legs read separately
    cell.alpha_composite(HIND, (ox + HX + hind[0], oy + HY - hind[1]))
    cell.alpha_composite(FRONT, (ox + FX + front[0], oy + HY - front[1]))
    cell.alpha_composite(body_img or BODY, (ox, oy + dy_body))
    if extra_over: extra_over(cell, ox, oy + dy_body)
    return cell

def blink(img):
    a = np.asarray(img).copy()
    if EYE:
        x0, y0, x1, y1 = EYE
        fur = a[y0 - 1, x0 - 1].copy()
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if a[y, x, :3].sum() < 120 or tuple(a[y, x, :3]) == (255, 255, 255): a[y, x] = fur
        for x in range(x0, x1 + 1): a[y1 - 1, x] = INKC
    return Image.fromarray(a)

def head_bob(img, dy):
    """shift rows above the cheek line down by dy (breathing)."""
    a = np.asarray(img).copy(); b = a.copy()
    cut = 24
    b[dy:cut + dy] = a[0:cut]; b[:dy] = 0
    return Image.fromarray(b)

frames = {}
# idle: breathe + blink
frames['idle'] = [compose(), compose(body_img=head_bob(BODY, 1)), compose(body_img=head_bob(BODY, 1)), compose(body_img=blink(BODY))]
# walk: 4 contact/passing poses (feet alternate, body bobs on passing)
FUR_D = tuple(int(v) for v in A[40, 6]) if A[40, 6, 3] else (176, 98, 40, 255)
def legs(hind, front, dyb):
    """short fur leg stubs from under the body down to each foot (visible when the body rides up)."""
    def f(cell, ox, oy):
        d = ImageDraw.Draw(cell)
        for (dx, lift), hx, w in ((hind, HX, 9), (front, FX, 9)):
            x0 = ox + hx + dx + 1; x1 = x0 + w - 3
            ytop = oy + FOOT_Y - 4 + dyb; ybot = oy + HY - lift + 1
            if ybot <= ytop: continue
            d.rectangle((x0, ytop, x1, ybot), fill=INKC)
            d.rectangle((x0 + 1, ytop, x1 - 1, ybot), fill=FUR_D)
    return f
def wstep(dyb, hind, front):
    return compose(dyb, hind=hind, front=front, extra_under=legs(hind, front, dyb))
frames['walk'] = [
    wstep(-1, (-4, 0), (4, 0)),     # contact
    wstep(-3, (-1, 0), (1, 4)),     # passing (front foot up, body high)
    wstep(-1, (4, 0), (-4, 0)),     # contact (other foot)
    wstep(-3, (1, 4), (-1, 0)),     # passing
]
frames['walk6'] = [
    wstep(-1, (-4, 0), (4, 0)),
    wstep(-2, (-2, 0), (2, 3)),
    wstep(-3, (0, 0), (0, 4)),
    wstep(-1, (4, 0), (-4, 0)),
    wstep(-2, (2, 3), (-2, 0)),
    wstep(-3, (0, 4), (0, 0)),
]

# ---- pickaxe (drawn crisp, no AA)
STEEL = [(74, 78, 96), (138, 146, 168), (206, 214, 230), (250, 252, 255)]
WOOD = [(110, 56, 22), (176, 98, 40), (220, 148, 70)]
def draw_pick(cell, gx, gy, ang, L=17):
    """grip at (gx,gy); ang deg: 0 = pointing right, 90 = up. Head perpendicular at end."""
    lay = Image.new('RGBA', cell.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    r = np.radians(ang); ux, uy = np.cos(r), -np.sin(r)
    ex, ey = gx + ux * L, gy + uy * L
    d.line((gx - ux * 3, gy - uy * 3, ex, ey), fill=WOOD[1], width=2)
    d.line((gx - ux * 3, gy - uy * 3, ex, ey), fill=WOOD[2], width=1)
    # head: curved bar, perpendicular, pointed tips bending back toward grip
    px_, py_ = -uy, ux
    pts = []
    for t in np.linspace(-1, 1, 15):
        bend = (abs(t) ** 1.6) * 4.0
        pts.append((ex + px_ * t * 8 - ux * bend, ey + py_ * t * 8 - uy * bend))
    n = len(pts)
    for i in range(n - 1):
        mid = 1 - abs((i + 0.5) / (n - 1) * 2 - 1)
        d.line((pts[i], pts[i + 1]), fill=STEEL[1], width=2 + round(mid * 2))
    for i in range(n - 1):
        mid = 1 - abs((i + 0.5) / (n - 1) * 2 - 1)
        if mid > 0.25: d.line((pts[i][0] + uy * 0 - ux, pts[i][1] - uy, pts[i + 1][0] - ux, pts[i + 1][1] - uy), fill=STEEL[2], width=1)
    d.point([(round(pts[0][0]), round(pts[0][1])), (round(pts[-1][0]), round(pts[-1][1]))], fill=STEEL[3])
    # metal collar where head meets handle
    d.rectangle((round(ex) - 1, round(ey) - 1, round(ex) + 1, round(ey) + 1), fill=STEEL[0])
    lay = outline(lay, mode='outer')
    cell.alpha_composite(lay)
    return (pts[0], pts[-1])

def paw(cell, x, y):
    d = ImageDraw.Draw(cell)
    for (dx, dy) in [(-1, -2), (0, -2), (1, -2), (-2, -1), (2, -1), (-2, 0), (2, 0), (-2, 1), (2, 1), (-1, 2), (0, 2), (1, 2)]:
        d.point((x + dx, y + dy), fill=INKC)
    d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(232, 150, 90, 255))
    d.point((x - 1, y - 1), fill=(248, 196, 140, 255)); d.point((x, y - 1), fill=(248, 196, 140, 255))

DIRT = [(92, 52, 26), (150, 92, 48), (206, 140, 78), (240, 196, 130)]
def dirt(cell, pts):
    d = ImageDraw.Draw(cell)
    for (x, y, s, c) in pts:
        d.rectangle((x - 1, y - 1, x + s, y + s), fill=INKC)
        d.rectangle((x, y, x + s - 1, y + s - 1), fill=DIRT[c])
        if s > 1: d.point((x, y), fill=DIRT[min(3, c + 1)])

# grip in master coords ~ front paw (x 27, y 33)
GX, GY = 27, 33
SPARK = [(255, 255, 255, 255), (255, 243, 168, 255)]
def spark(cell, x, y):
    d = ImageDraw.Draw(cell)
    for (a, b, c) in [((x - 5, y - 3), (x - 3, y - 2), 1), ((x + 4, y - 4), (x + 3, y - 3), 1), ((x, y - 7), (x, y - 5), 0), ((x - 7, y - 1), (x - 6, y - 1), 0), ((x + 6, y - 1), (x + 7, y - 1), 0)]:
        d.line((a, b), fill=SPARK[c])
def dig_frame(ang, dy, chips=(), L=17, behind=False, spk=None):
    def pick(cell, ox, oy):
        draw_pick(cell, ox + GX, oy + GY + (dy if behind else 0), ang, L)
    def over(cell, ox, oy):
        if not behind: draw_pick(cell, ox + GX, oy + GY, ang, L)
        paw(cell, ox + GX, oy + GY)
        dirt(cell, chips)
        if spk: spark(cell, *spk)
    return compose(dy, extra_under=pick if behind else None, extra_over=over)
# tip lands on the ground just in front of the feet (y 77)
frames['dig_down'] = [
    dig_frame(72, -1, L=24),                                 # wind-up: pick raised over helmet
    dig_frame(20, 0, L=20),                                     # swing
    dig_frame(-60, 1, L=20, spk=(60, 76), chips=[(57, 73, 3, 1), (64, 71, 2, 2), (53, 70, 2, 0), (67, 75, 2, 1), (50, 74, 2, 2), (61, 67, 1, 3)]),  # impact
    dig_frame(-48, 0, L=20, chips=[(60, 64, 3, 1), (69, 60, 2, 2), (52, 60, 2, 0), (72, 68, 2, 0), (48, 66, 2, 2), (65, 55, 2, 3), (56, 74, 2, 1)]),  # debris
]
for k, v in frames.items():
    strip(v).save(W2 + f'ham_{k}.png')
print({k: len(v) for k, v in frames.items()})

# ---- side dig (rebuilt on the same master so silhouette never changes)
def side_frame(ang, dy, dx, chips=(), L=20, spk=None):
    def over(cell, ox, oy):
        draw_pick(cell, ox + GX + dx, oy + GY, ang, L)
        paw(cell, ox + GX + dx, oy + GY)
        dirt(cell, chips)
        if spk: spark(cell, *spk)
    c = compose(dy, extra_over=over)
    return c
def shifted(img, dx):
    out = Image.new('RGBA', img.size, (0, 0, 0, 0)); out.alpha_composite(img, (dx, 0)); return out
frames['dig'] = [
    side_frame(95, -1, 0, L=22),
    side_frame(45, 0, 1, L=21),
    side_frame(-8, 0, 2, L=21, spk=(72, 64), chips=[(71, 58, 2, 1), (74, 62, 2, 2), (70, 67, 2, 0)]),
    side_frame(5, 0, 1, L=21, chips=[(73, 54, 2, 1), (76, 60, 2, 2), (68, 64, 2, 0), (75, 69, 1, 3)]),
]

# ---- helpers for sheets re-extracted from raw (jump / hurt / cheeks)
def helmet_cx(img):
    a = np.asarray(img).astype(int)
    m = (a[..., 3] > 0) & (a[..., 0] > 200) & (a[..., 1] > 140) & (a[..., 2] < 110)
    ys, xs = np.nonzero(m)
    return xs.mean() if len(xs) else img.size[0] / 2
MASTER_HCX = helmet_cx(M); CELL_HCX = (CX - MW // 2) + MASTER_HCX
def place_by_helmet(spr, lift=0):
    cell = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    x = int(round(CELL_HCX - helmet_cx(spr))); y = BASE - spr.size[1] - lift
    x = max(0, min(FW - spr.size[0], x)); y = max(0, y)
    cell.alpha_composite(spr, (x, y)); return cell

def load_row(name, row, f, crop_top=None):
    im = Image.open(ROOT + 'raw/' + name); fg, _ = key_mask(im); cut = rgba_cut(im, fg)
    comps = rows(components(fg))[row]; bottom = max(c[3] for c in comps)
    out = []
    for c in comps:
        spr = ham_clean(cut.crop(c[:4]), f)
        out.append((spr, int(round((bottom - c[3]) * f))))
    return out

frames['jump'] = [place_by_helmet(s, min(l, 24)) for s, l in load_row('ham_dig_jump.jpg', 1, 0.2476)]
frames['hurt'] = [place_by_helmet(s, l) for s, l in load_row('ham_hurt_ride.jpg', 0, 0.216)]
frames['cheeks'] = [place_by_helmet(s, 0) for s, l in load_row('ham_cheeks.jpg', 0, 0.184)]

# ---- basket ride: 4-frame pendulum sway + waving paw, rope drawn per frame
rr = load_row('ham_hurt_ride.jpg', 1, 0.232)[0][0]
ra = np.asarray(rr).copy(); ra[:19] = 0
RIDE = trim(Image.fromarray(ra)); RA = np.asarray(RIDE).copy(); RH, RW = RA.shape[:2]
pawm = np.zeros(RA.shape[:2], bool); pawm[10:24, 37:] = RA[10:24, 37:, 3] > 0
PAW = RA.copy(); PAW[~pawm] = 0; NOPAW = RA.copy(); NOPAW[pawm] = 0
# fill where paw was removed with nothing (it sits over background), re-outline the head side
PAW = Image.fromarray(PAW); NOPAW = Image.fromarray(NOPAW)
ROPE_D, ROPE_L = (92, 52, 26, 255), (214, 160, 92, 255)
def rope(cell, a, b):
    d = ImageDraw.Draw(cell)
    d.line((a, b), fill=ROPE_D, width=3); d.line((a, b), fill=ROPE_L, width=1)
def ride_frame(sx, paw_dy, paw_dx):
    cell = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    ox = CX - RW // 2 + sx; oy = BASE - RH
    rim = oy + RH - 22
    knot = (CX + sx // 2 if sx >= 0 else CX - ((-sx) // 2), oy - 9)
    rope(cell, (CX, 0), knot)
    rope(cell, knot, (ox + 4, rim)); rope(cell, knot, (ox + RW - 5, rim))
    ImageDraw.Draw(cell).rectangle((knot[0] - 1, knot[1] - 1, knot[0] + 1, knot[1] + 1), fill=ROPE_D)
    cell.alpha_composite(NOPAW, (ox, oy))
    cell.alpha_composite(PAW, (ox + paw_dx, oy + paw_dy))
    return cell
frames['ride'] = [ride_frame(0, 0, 0), ride_frame(1, 1, -1), ride_frame(0, 0, 0), ride_frame(-1, 1, -1)]

for k, v in frames.items():
    strip(v).save(W2 + f'ham_{k}.png')
print({k: len(v) for k, v in frames.items()})
