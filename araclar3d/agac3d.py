# Kodla uretilen gercek 3B agac (gövde + dallar + yaprak kartlari + meyveler). Renkler agac resminden orneklenir, isik ciziminde pisirilir.
import numpy as np, sys, json
from PIL import Image
rng = np.random.default_rng(7)
def norm(v): return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-9)

def tube(p0, p1, r0, r1, seg=7):
    d = p1 - p0; L = np.linalg.norm(d); d = d / L
    a = np.cross(d, [0, 0, 1.0]) if abs(d[2]) < 0.9 else np.cross(d, [1.0, 0, 0]); a = norm(a); b = np.cross(d, a)
    V = []; 
    for k in range(seg):
        t = 2 * np.pi * k / seg; n = np.cos(t) * a + np.sin(t) * b
        V.append(p0 + n * r0); V.append(p1 + n * r1)
    V = np.array(V); F = []
    for k in range(seg):
        i = 2 * k; j = (2 * k + 2) % (2 * seg); F += [[i, i + 1, j], [i + 1, j + 1, j]]
    return V, np.array(F)

def sphere(c, r, sub=1, squash=(1, 1, 1)):
    t = (1 + 5 ** 0.5) / 2
    V = np.array([[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]], float)
    F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
    V = list(norm(V)); F = [tuple(f) for f in F]
    for _ in range(sub):
        cache = {}; NF = []
        def mid(a, b):
            k = (min(a, b), max(a, b))
            if k not in cache: V.append(norm((V[a] + V[b]) / 2)); cache[k] = len(V) - 1
            return cache[k]
        for a, b, c2 in F:
            ab, bc, ca = mid(a, b), mid(b, c2), mid(c2, a); NF += [(a, ab, ca), (b, bc, ab), (c2, ca, bc), (ab, bc, ca)]
        F = NF
    V = np.array(V) * np.array(squash) * r + c
    return V, np.array(F)

def build(img_path, fruit_rgb, n_leaf=2600, n_fruit=7, crown_r=(0.95, 0.8, 0.9), crown_c=(0, 1.9, 0)):
    im = np.asarray(Image.open(img_path).convert('RGBA')).astype(float)
    a = im[..., 3] > 200; g = a & (im[..., 1] > im[..., 0] * 1.05) & (im[..., 1] > im[..., 2])
    greens = im[g][:, :3] / 255; br = a & (im[..., 0] > im[..., 1] * 1.1) & (im[..., 0] < 150); browns = im[br][:, :3] / 255
    gsel = lambda: greens[rng.integers(len(greens))]
    Vs, Fs, Cs = [], [], []
    def add(V, F, col):
        o = sum(len(v) for v in Vs); Vs.append(V); Fs.append(F + o); Cs.append(np.tile(col, (len(V), 1)))
    brown = browns.mean(0) if len(browns) else np.array([0.38, 0.24, 0.14])
    # govde: egri + iki ana dal + ikincil dallar
    tips = []
    def branch(p, d, L, r, depth):
        p1 = p + d * L; add(*tube(p, p1, r, r * 0.72, 6), brown * (0.85 + 0.3 * rng.random()))
        if depth == 0: tips.append(p1); return
        for k in range(2 if depth > 1 else 3):
            nd = norm(d * 1.0 + norm(rng.normal(size=3)) * 0.75 + np.array([0, 0.25, 0]))
            branch(p1, nd, L * 0.72, r * 0.62, depth - 1)
    branch(np.array([0, 0, 0.0]), np.array([0.03, 1, 0.0]), 0.95, 0.11, 0)  # govde
    top = np.array([0.03, 0.95, 0.0])
    for s in (-1, 1): branch(top, norm(np.array([s * 0.45, 1, rng.normal() * 0.2])), 0.62, 0.07, 3)
    cc = np.array(crown_c); cr = np.array(crown_r)
    # yapraklar: tac elipsoidinin icinde/yuzeyinde, disa dogru bakan baklava seklinde kartlar
    for _ in range(n_leaf):
        u = norm(rng.normal(size=3)); rad = rng.random() ** 0.33 * 0.55 + 0.45
        c = cc + u * cr * rad; outward = norm(u / cr + rng.normal(size=3) * 0.35)
        t1 = norm(np.cross(outward, rng.normal(size=3))); t2 = np.cross(outward, t1)
        w, l = 0.09 + 0.05 * rng.random(), 0.15 + 0.07 * rng.random()
        V = np.array([c - t2 * l * 0.15, c + t1 * w, c + t2 * l, c - t1 * w]); F = np.array([[0, 1, 2], [0, 2, 3]])
        nrm = outward; shade = 0.55 + 0.45 * rad ** 1.5 * (0.6 + 0.4 * max(0, nrm @ norm(np.array([-0.4, 0.8, 0.5]))))
        add(V, F, np.clip(gsel() * shade * (0.9 + 0.2 * rng.random()), 0, 1))
    # meyveler: tacin dis yuzeyine yakin, asili
    for k in range(n_fruit):
        u = norm(np.array([rng.normal(), rng.normal() * 0.6 - 0.15, rng.normal()])); c = cc + u * cr * 0.88
        V, F = sphere(c, 0.17 + 0.03 * rng.random(), 1); col = np.array(fruit_rgb) / 255 * (0.9 + 0.2 * rng.random())
        nrmls = norm(V - c); lit = np.clip(0.55 + 0.45 * (nrmls @ norm(np.array([-0.4, 0.8, 0.5]))), 0, 1.15)
        Vs.append(V); Fs.append(F + sum(len(v) for v in Vs[:-1])); Cs.append(np.clip(col * lit[:, None], 0, 1))
    return np.vstack(Vs), np.vstack(Fs), np.vstack(Cs)

def raster(V, F, C, az, el, W=520, name='/tmp/v/p.png', bg=(228, 232, 238)):
    a, e = np.radians(az), np.radians(el)
    R1 = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]]); R2 = np.array([[1, 0, 0], [0, np.cos(e), -np.sin(e)], [0, np.sin(e), np.cos(e)]])
    Q = (V - [0, 1.2, 0]) @ R1.T @ R2.T; s = W / 3.6
    X = Q[:, 0] * s + W / 2; Y = W / 2 - Q[:, 1] * s; Z = Q[:, 2]
    img = np.zeros((W, W, 3)); img[:] = bg; zb = np.full((W, W), 1e9)
    for f in F:
        i, j, k = f; xs = X[[i, j, k]]; ys = Y[[i, j, k]]
        x0, x1 = int(max(0, xs.min())), int(min(W - 1, xs.max() + 1)); y0, y1 = int(max(0, ys.min())), int(min(W - 1, ys.max() + 1))
        if x1 <= x0 or y1 <= y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-9: continue
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d; l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d; l2 = 1 - l0 - l1
        m = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
        if not m.any(): continue
        z = l0 * Z[i] + l1 * Z[j] + l2 * Z[k]; sub = zb[y0:y1 + 1, x0:x1 + 1]; ok = m & (z < sub)
        sub[ok] = z[ok]; zb[y0:y1 + 1, x0:x1 + 1] = sub
        col = (l0[..., None] * C[i] + l1[..., None] * C[j] + l2[..., None] * C[k]) * 255
        img[y0:y1 + 1, x0:x1 + 1][ok] = col[ok]
    Image.fromarray(img.astype(np.uint8)).save(name)
if __name__ == '__main__':
    V, F, C = build('agaclar/tree01.png', (244, 160, 60))
    print(len(V), len(F)); np.savez('/tmp/v/tree01_3d.npz', V=V, F=F, C=C)
    for k, (az, el) in enumerate([(0, 0), (60, 0), (20, -50)]): raster(V, F, C, az, el, name=f'/tmp/v/p{k}.png')
    from PIL import Image as I
    c = I.new('RGB', (1560, 520)); [c.paste(I.open(f'/tmp/v/p{k}.png'), (k * 520, 0)) for k in range(3)]; c.save('/tmp/v/p_all.png')
