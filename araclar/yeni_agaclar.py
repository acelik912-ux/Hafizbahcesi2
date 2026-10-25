# Canva'da uretilen 10 gorsel (5 agac x alttan/tam) -> seffaf webp + trees.json
import json, sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
A='/mnt/user-data/attachments/4a073c19-fb4a-56cc-8c54-69564817b7fc/'
alt=['26ee70fc','a5aff257','3bebf4f6','9bca2083','c0bcc933']
tam=['94ebff05','88244353','8492b60f','ed9399e4','6b5246f8']
def matte(p, mound=False):
    im=np.asarray(Image.open(A+p+'-image.png').convert('RGB')).astype(float)
    mn=im.min(2)
    a=np.clip((248-mn)/(248-222),0,1)           # beyaza yakin = seffaf
    a=ndi.grey_closing(a,size=(1,1))
    # kucuk bosluklari doldur (parlak yaprak vurgulari): agac icindeki yalitik seffaf noktalar
    solid=a>0.5
    holes=ndi.binary_fill_holes(solid)&~solid
    lab,nl=ndi.label(holes); sz=ndi.sum(holes,lab,range(1,nl+1))
    for i,s in enumerate(sz):
        if s<60: a[lab==i+1]=1
    a3=np.clip(a,1e-3,1)[...,None]
    c=np.clip((im-(1-a3)*255)/a3,0,255)
    if mound:
        H,W=a.shape; rows=np.where((a>0.5).any(1))[0]; yb=rows.max(); yt=rows.min()
        h=yb-yt; y0=int(yb-0.17*h)
        yy,xx=np.mgrid[0:H,0:W]
        zone=yy>y0
        grass=(im[...,1]>im[...,0]*0.93)
        a=np.where(zone&(grass|(a<0.6)),0,a)
        # kalan kucuk parcalari temizle
        lab,nl=ndi.label(a>0.3); sz=ndi.sum(a>0.3,lab,range(1,nl+1))
        big=np.argmax(sz)+1; a=np.where(lab==big,a,0)
    out=np.dstack([c,a*255]).astype(np.uint8)
    return Image.fromarray(out,'RGBA')
def crop(im):
    bb=im.split()[3].point(lambda v:255 if v>20 else 0).getbbox(); return im.crop(bb), bb
tj=json.load(open('src/trees.json'))
for i in range(5):
    n=i+1
    ia=matte(alt[i]); ia.save(f'assets/agac/{n:02d}.webp',quality=90,alpha_quality=100,method=4)
    it=matte(tam[i],True); it,bb=crop(it)
    it.resize((round(it.width*600/it.height),600),Image.LANCZOS).save(f'assets/bahce/{n:02d}.webp',quality=85,alpha_quality=100,method=4)
    it.save(f'/tmp/v/new/g{n}.png'); ia.save(f'/tmp/v/new/a{n}.png')
    t=tj[i]; t['fill']=True; t['crown']=[0.5,0.5,1.0,1.0]; t['w']=ia.width; t['h']=ia.height; t['aspect']=ia.width/ia.height; t['gaspect']=it.width/it.height
    print(n,t['name'],ia.size,it.size)
json.dump(tj,open('src/trees.json','w'),ensure_ascii=False)
