# agaclar/treeNN.png (seffaf kesimler) -> assets/agac/NN.png (kirpilmis) + src/trees.json (12 meyve konumu, alttan uste)
import json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
data = json.load(open('src/data.json'))
out = []
Q = [0.5, 0.28, 0.72, 0.4, 0.62, 0.2, 0.8, 0.5]
for t in data['trees']:
    n = t['n']; ayat = len(data['pages'][n-1]['ayat'])
    im = Image.open(f'agaclar/tree{n:02d}.png').convert('RGBA')
    # agaclar/treeNN.png video_kareleri.py tarafindan zaten kirpildi (animasyon kareleriyle ayni kutu)
    im.save(f'assets/agac/{n:02d}.png', optimize=True)
    arr = np.asarray(im).astype(int); H, W = arr.shape[:2]
    alpha = arr[..., 3] > 200
    leaf = alpha & (arr[..., 1] >= arr[..., 0]-3)
    leaf = ndi.binary_closing(leaf, iterations=3)
    leaf = ndi.binary_erosion(leaf, iterations=max(3, W//60))
    rows = np.where(leaf.any(1))[0]
    ytop, ybot = np.quantile(rows, 0.06), np.quantile(rows, 0.93)
    pts = []
    for k in range(ayat):
        f = k/(max(1, ayat-1))
        y = ybot - (ybot-ytop)*f
        best = None
        for q in [Q[k % len(Q)]] + Q:
            for band in (0.012, 0.03, 0.06):
                b0, b1 = int(max(0, y-band*H)), int(min(H, y+band*H)+1)
                xx = np.where(leaf[b0:b1].any(0))[0]
                if len(xx) == 0: continue
                x = float(np.quantile(xx, q))
                if all(((x-px)/W)**2*0.6+((y-py)/H)**2 > 0.012**2*4 and abs(x-px)/W+abs(y-py)/H > 0.09 for px, py in pts):
                    best = (x, y); break
            if best: break
        if not best: best = (W*0.5, y)
        pts.append(best)
    out.append({'n': n, 'name': t['name'], 'w': im.width, 'h': im.height, 'aspect': im.width/im.height,
                'anch': [[round(x/W, 4), round(y/H, 4)] for x, y in pts]})
    print(n, t['name'], im.size, ayat)
json.dump(out, open('src/trees.json', 'w'), ensure_ascii=False)
# onizleme
from PIL import ImageDraw
sheet = Image.new('RGB', (5*270, 4*340), (60, 110, 60))
for i, t in enumerate(out):
    im = Image.open(f'assets/agac/{t["n"]:02d}.png'); s = min(260/im.width, 330/im.height)
    im2 = im.resize((int(im.width*s), int(im.height*s))); bg = Image.new('RGB', im2.size, (60, 110, 60)); bg.paste(im2, mask=im2.split()[3])
    d = ImageDraw.Draw(bg)
    for k, (x, y) in enumerate(t['anch']):
        X, Y = x*im2.width, y*im2.height; d.ellipse((X-9, Y-9, X+9, Y+9), fill=['#111', '#d22', '#fc3', '#4a4', '#236'][k % 5], outline='white'); d.text((X-3, Y-5), str(k+1), fill='white')
    sheet.paste(bg, ((i % 5)*270, (i//5)*340))
sheet.save('/tmp/v/anchors.png')
