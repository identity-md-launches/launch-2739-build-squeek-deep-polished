import sys; sys.path.insert(0,'/workspace/squeek_deep/tools')
from v2lib import *
from PIL import ImageDraw, ImageFont
def gridview(im, out, s=12):
    b = up(im, s); W, H = b.size
    c = Image.new('RGBA', (W + 30, H + 30), (70, 60, 80, 255)); c.alpha_composite(b, (30, 30))
    d = ImageDraw.Draw(c)
    for x in range(0, im.size[0] + 1):
        d.line((30 + x * s, 30, 30 + x * s, 30 + H), fill=(255, 255, 255, 40) if x % 5 else (255, 255, 0, 120))
        if x % 5 == 0: d.text((30 + x * s, 2), str(x), fill=(255, 255, 0))
    for y in range(0, im.size[1] + 1):
        d.line((30, 30 + y * s, 30 + W, 30 + y * s), fill=(255, 255, 255, 40) if y % 5 else (255, 255, 0, 120))
        if y % 5 == 0: d.text((2, 30 + y * s), str(y), fill=(255, 255, 0))
    c.save(out)
if __name__ == '__main__':
    gridview(Image.open(sys.argv[1]).convert('RGBA'), sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 12)
