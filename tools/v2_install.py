"""v2 install: build a new shared 128-colour palette (key colours locked), quantise every sprite
asset to it, write assets/ + palette.png, and MERGE-update manifest.json (never drops entries).
Does not touch keyart/share/fonts/audio. Run after v2_tiles/v2_hamster/v2_mole/v2_ui."""
import sys, json, os, shutil; sys.path.insert(0, '/workspace/squeek_deep/tools')
from v2lib import *
W2 = ROOT + 'work/v2/'; O = ROOT + 'assets/'; B = ROOT + '_v1_backup/assets/'
NC = 128
LOCK = ['#FFCE40', '#FFF5E1', '#1E1218', '#BEFFA0', '#8CE6FF', '#5A3A22', '#FFFFFF', '#FF8A20', '#FFD84A', '#FF6EB4']
HAM = ['idle', 'walk', 'walk6', 'dig', 'dig_down', 'jump', 'hurt', 'ride', 'cheeks']
UI = ['hud_bar', 'shop_panel', 'btn_gold', 'btn_green', 'btn_wood', 'cheek_meter', 'depth_gauge', 'slot']
staged = {}
for n in HAM: staged['hamster/ham_%s.png' % n] = Image.open(W2 + 'ham_%s.png' % n).convert('RGBA')
staged['enemies/mole_shade.png'] = Image.open(W2 + 'mole_shade.png').convert('RGBA')
staged['tiles/tiles.png'] = Image.open(W2 + 'tiles.png').convert('RGBA')
for n in UI: staged['ui/%s.png' % n] = Image.open(W2 + 'ui_%s.png' % n).convert('RGBA')
for p in ['enemies/root_beetle.png', 'enemies/glow_worm.png', 'enemies/crystal_bat.png', 'enemies/magma_slug.png',
          'items/items.png'] + ['props/' + f for f in sorted(os.listdir(B + 'props'))]:
    staged[p] = Image.open(B + p).convert('RGBA')

def colors_of(im):
    a = np.asarray(im); return a[a[..., 3] > 0][:, :3].astype(np.float32)
# weighted k-means on the unique colours of every asset: weight = sqrt(count), each asset normalised
# to the same total (so small sprites/rare hues are not swamped by the big tile sheet); key colours locked.
X = []; Wt = []
for k, im in staged.items():
    px = colors_of(im).astype(np.uint8)
    u, cnt = np.unique(px, axis=0, return_counts=True)
    w = np.sqrt(cnt); w = w / w.sum() * {'tiles': 9.0}.get(k.split('/')[0], 2.0 if k.startswith(('hamster', 'enemies/mole', 'ui')) else 1.2)
    X.append(u.astype(np.float32)); Wt.append(w)
X = np.concatenate(X); Wt = np.concatenate(Wt)
lock = np.array([hexrgb(h) for h in LOCK], np.float32)
rng = np.random.RandomState(0)
# k-means++ style init for the free centres
free = [X[rng.choice(len(X), p=Wt / Wt.sum())]]
for _ in range(NC - len(lock) - 1):
    cent = np.concatenate([lock, np.array(free)])
    d = ((X[:, None] - cent[None]) ** 2).sum(-1).min(1) * Wt
    free.append(X[rng.choice(len(X), p=d / d.sum())])
free = np.array(free)
for it in range(40):
    cent = np.concatenate([lock, free])
    lab = ((X[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
    for j in range(len(free)):
        m = lab == j + len(lock)
        if m.any(): free[j] = (X[m] * Wt[m, None]).sum(0) / Wt[m].sum()
pal = np.concatenate([lock, free]).round().clip(0, 255).astype(np.uint8)
# order palette by hue/lum for a readable swatch
import colorsys
key = [(0 if i < len(lock) else 1, round(colorsys.rgb_to_hsv(*(pal[i] / 255))[0] * 12), colorsys.rgb_to_hsv(*(pal[i] / 255))[2]) for i in range(NC)]
pal = pal[sorted(range(NC), key=lambda i: key[i])]

def quant(im):
    a = np.asarray(im).astype(np.int32); out = a.copy()
    m = a[..., 3] > 0
    px = a[m][:, :3]
    d = ((px[:, None] - pal[None].astype(np.int32)) ** 2).sum(-1)
    out[m, :3] = pal[d.argmin(1)]
    return Image.fromarray(out.astype(np.uint8), 'RGBA'), float(np.sqrt(d.min(1)).mean()), float(np.sqrt(d.min(1)).max())

man = json.load(open(O + 'manifest.json'))
for p, im in staged.items():
    q, e, mx = quant(im)
    os.makedirs(os.path.dirname(O + p), exist_ok=True)
    q.save(O + p, optimize=True)
    print('%-32s err mean %.1f max %.1f' % (p, e, mx))
    if p.startswith('ui/'):
        n = p[3:]
        for s in (2, 3):
            os.makedirs(O + 'ui/%dx' % s, exist_ok=True)
            up(q, s).save(O + 'ui/%dx/%s' % (s, n), optimize=True)
# palette swatch
sw = Image.new('RGB', (NC * 8, 8))
for i, c in enumerate(pal): sw.paste(tuple(int(x) for x in c), (i * 8, 0, i * 8 + 8, 8))
sw.save(O + 'palette.png')

# ---- manifest merge (update / add only)
def upd(k, **kw):
    e = man.get(k, {}); e.update(kw); man[k] = e
hm = {'idle': (4, 6, True, 'idle breathe + blink'), 'walk': (4, 10, True, 'walk cycle (contact/passing x2)'),
      'walk6': (6, 12, True, 'optional smoother 6-frame walk cycle'), 'dig': (4, 12, True, 'side dig swing (face right; flip for left)'),
      'dig_down': (4, 12, True, 'dig downward: wind-up, swing, impact (spark+chips), recover'),
      'jump': (4, 10, False, 'crouch, rise, apex, fall'), 'hurt': (3, 8, False, 'hit, knocked, dizzy'),
      'ride': (4, 6, True, 'riding elevator basket (sway + wave); rope continues upward via drawn line from (40,0)'),
      'cheeks': (4, 0, False, 'cheek stage 0-3 (index by load)')}
for n, (fr, fps, loop, use) in hm.items():
    upd('hamster/ham_%s.png' % n, frameW=80, frameH=80, frames=fr, fps=fps, loop=loop, use=use)
upd('enemies/mole_shade.png', frameW=72, frameH=64, frames=3, use='0 float,1 claws up (telegraph),2 lunge; ghost: outer glow ring + tail are semi-transparent (keep alpha)')
for n in UI:
    im = Image.open(O + 'ui/%s.png' % n)
    upd('ui/%s.png' % n, w=im.size[0], h=im.size[1])
    for s in (2, 3):
        man['ui/%dx/%s.png' % (s, n)] = dict(w=im.size[0] * s, h=im.size[1] * s, scale=s, border=6 * s,
                                              use='pre-scaled nearest-neighbour copy of ui/%s.png (9-slice border %dpx)' % (n, 6 * s))
upd('palette.png', colors=NC, hex=['#%02x%02x%02x' % tuple(int(x) for x in c) for c in pal])
upd('tiles/tiles.png', frameW=32, frameH=32, cols=3, rows=6)
json.dump(man, open(O + 'manifest.json', 'w'), indent=1)
print('manifest entries', len(man))
