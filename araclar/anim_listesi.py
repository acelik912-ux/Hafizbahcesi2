# assets/animasyon/NN/KK.webp dosyalarindan src/anim.js uretir
import os
lines = ["// otomatik uretildi (araclar/anim_listesi.py)", "export const NF = %d;"]
d = {}
for n in range(1, 21):
    fs = sorted(os.listdir(f'assets/animasyon/{n:02d}')); d[n] = fs
lines[1] = "export const NF = %d;" % len(d[1])
lines.append("export const ANIM = {" + ",".join(f"{n}:[" + ",".join(f"require('../assets/animasyon/{n:02d}/{f}')" for f in d[n]) + "]" for n in d) + "};")
open('src/anim.js', 'w').write("\n".join(lines) + "\n")
print('ok', len(d))
