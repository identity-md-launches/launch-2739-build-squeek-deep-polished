import sys; sys.path.insert(0,'/workspace/squeek_deep/tools')
from v2lib import *
def gif(strip_path, fw, fh, out, fps, scale=4, bg=(58, 48, 70), order=None, ground=True):
    s = Image.open(strip_path).convert('RGBA'); n = s.size[0] // fw
    order = order or list(range(n)); fr = []
    for i in order:
        c = Image.new('RGBA', (fw, fh), bg + (255,))
        if ground:
            from PIL import ImageDraw
            ImageDraw.Draw(c).line((0, fh - 2, fw, fh - 2), fill=(120, 100, 130, 255))
        c.alpha_composite(s.crop((i * fw, 0, i * fw + fw, fh)))
        fr.append(up(c, scale).convert('P', palette=Image.ADAPTIVE, colors=255))
    fr[0].save(out, save_all=True, append_images=fr[1:], duration=int(1000 / fps), loop=0, disposal=2)
if __name__ == '__main__':
    gif(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], float(sys.argv[5]))
