from PIL import Image, ImageDraw
import os

BG = (11, 18, 32, 255)
CYAN = (6, 182, 212, 255)
LIGHT = (34, 211, 238, 255)


def make(size):
    f = size / 64.0
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(14 * f)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
    cx = cy = 32 * f
    for rad, op in ((12, 0.45), (19, 0.7), (26, 0.45)):
        col = (CYAN[0], CYAN[1], CYAN[2], int(255 * op))
        w = max(2, int(3 * f))
        d.arc([cx - rad, cy - rad, cx + rad, cy + rad], start=270, end=360, fill=col, width=w)
    w2 = max(2, int(3 * f))
    d.line([cx, cy, 50 * f, 20 * f], fill=LIGHT, width=w2)
    r2 = max(2, int(3.6 * f))
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=LIGHT)
    return im


sizes = [16, 32, 48, 64, 256]
imgs = [make(s) for s in sizes]
os.makedirs("public", exist_ok=True)
out = os.path.join("public", "favicon.ico")
imgs[0].save(out, format="ICO", sizes=[(s, s) for s in sizes])
print("wrote", out)
