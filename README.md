# Hafız Bahçesi (v2)

Kapıdan girilen gerçekçi bahçe, 20 ağaç (Cüz 1). Ağaca yaklaş, tırman, meyveleri alttan üste topla.
Her meyve bir ayet: 1 siyah, 2 kırmızı, 3 sarı, 4 yeşil, 5 lacivert, sonra tekrar. Meyvenin üstündeki plakada ayetin başı yazar; koparınca avucunda ayetin tamamı açılır.

## APK
GitHub > Actions > "Android APK" > Run workflow > bitince Artifacts > HafizBahcesi-apk.

## Yapı
- `App.js` kapı girişi, bahçe yürüyüşü, tırmanma ekranı
- `src/data.json` ayet görselleri ve mealler, `src/trees.json` her ağacın meyve konumları (alttan üste)
- `assets/agac` kırpılmış şeffaf ağaçlar, `assets/sahne` kapı ve bahçe zemini, `assets/el` şeffaf eller
- `araclar/agac_hazirla.py` ağaçları kırpar ve meyve konumlarını üretir

## Güncelleme: panorama bahçe
- Bahçe arka planı `assets/sahne/panorama.jpg`. Parmakla sağa sola sürükleyince etrafa bakılır.
- Ağaçlar panorama şeridinde sağdan sola dizili (1. ağaç en sağda, en büyük). Sürükleyerek veya Önceki/Sonraki ile gezilir.
- Ağaçta meyveler yukarıdan aşağıya sıralıdır (1. ayet en üstte).

## Ağaç animasyonları (video -> kare dizisi)
- `araclar/video_kareleri.py <video.mp4>`: 20 ağaçlı videoyu keser, her ağaç için `assets/animasyon/NN/KK.webp` (40 şeffaf kare) ve `agaclar/treeNN.png` üretir.
- `araclar/agac_hazirla.py`, `araclar/anim_listesi.py`: meyve konumlarını ve `src/anim.js` listesini üretir.
- Bahçede ortadaki ağaç varınca bir kez yavaşça döner (ileri-geri), sonra durur.
