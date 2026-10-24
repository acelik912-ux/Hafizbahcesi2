# Hafiz_Bahcesi_-_20_agac.mp4 (20 x 5 sn) -> her agac icin seffaf kare dizisi (assets/animasyon/NN/KK.webp) + yuksek cozunurluklu hareketsiz kare (agaclar/treeNN.png)
import sys, os, subprocess, shutil, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
from multiprocessing import Pool
SRC = sys.argv[1]
FPS, NF, AH = 8, 40, 720      # saniyedeki kare, kare sayisi, animasyon kare yuksekligi
def cut(img):
    a = img[240:1680].astype(np.int16)
    bgc = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3)]), axis=0)
    d = np.abs(a - bgc).max(2); m = d <= 22
    lab, n = ndi.label(m); sizes = ndi.sum(m, lab, range(1, n+1))
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    keep = [k+1 for k, s in enumerate(sizes) if (k+1 in border) or s > 60]
    fg = ~np.isin(lab, keep); fg = ndi.binary_opening(fg, iterations=1)
    l2, n2 = ndi.label(fg)
    if n2 > 1:
        s2 = ndi.sum(fg, l2, range(1, n2+1)); fg = np.isin(l2, [k+1 for k, s in enumerate(s2) if s > 300])
    al = cv2.GaussianBlur(ndi.binary_erosion(fg, iterations=1).astype(np.float32), (0, 0), 0.9)
    return a.astype(np.uint8), al
def work(n):
    t0 = 5*(n-1); tmp = f'/tmp/vk/{n:02d}'; os.makedirs(tmp, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t0), '-i', SRC, '-vf', f'fps={FPS}', '-frames:v', str(NF), f'{tmp}/%03d.png'], check=True)
    fr = []
    for k in range(NF):
        img = np.asarray(Image.open(f'{tmp}/{k+1:03d}.png').convert('RGB'))
        rgb, al = cut(img); fr.append((rgb, al))
    boxes = [np.where(al > 0.5) for _, al in fr]
    x0 = min(b[1].min() for b in boxes); x1 = max(b[1].max() for b in boxes)+1
    y0 = min(b[0].min() for b in boxes); y1 = max(b[0].max() for b in boxes)+1
    os.makedirs(f'assets/animasyon/{n:02d}', exist_ok=True)
    for k, (rgb, al) in enumerate(fr):
        rgba = np.dstack([rgb, (al*255).astype(np.uint8)])[y0:y1, x0:x1]
        im = Image.fromarray(rgba, 'RGBA')
        if k == 0: im.save(f'agaclar/tree{n:02d}.png', optimize=True)
        s = AH / im.height
        im.resize((max(1, round(im.width*s)), AH), Image.LANCZOS).save(f'assets/animasyon/{n:02d}/{k:02d}.webp', quality=80, method=4)
    shutil.rmtree(tmp)
    print('tamam', n, (x1-x0, y1-y0), flush=True)
if __name__ == '__main__':
    ns = [int(x) for x in sys.argv[2:]] or list(range(1, 21))
    with Pool(2) as p: p.map(work, ns)
