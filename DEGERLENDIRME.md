# Gemini prototipinin değerlendirmesi (gemini/index.html)

## İyi olanlar
- Durum makinesi doğru: bahçe -> ağaç -> tırman -> zirve meyvesi -> avuçta incele -> sonraki meyve -> bahçeye dön.
- POV el fikri (referans/ görselleri) oyun hissini verir.
- Tek dokunuşla "meyve kopar" akışı basit ve anlaşılır.

## Sorunlar
1. **Bahçe sahte**: ağaçlar yok, yalnızca tahta tabelalar var. İstenen "gerçek bahçeye girmek" hissi oluşmuyor.
2. **Tek 100 sn'lik MP4 + currentTime ile arama** (tree.start/end): mobil WebView'da seek yavaş/ağır, döngü sıçrar. Ağaç başına ayrı kısa klip veya kare dizisi gerekir.
3. **Videonun arka planı beyaz** (#isolated-tree-scene beyaz): ağaç bahçeden ayrılınca "kağıt" görünür. Klip bahçe zemini üzerine önceden kompozit edilmeli.
4. **Her ağaçta 5 sabit meyve**, 12 ayet / 5 renk sistemi yok; ayet verisi (src/data.json) bağlı değil. Meyve konumları elle yazılmış, video döndüğü için kayar.
5. **Eller CSS kutusu** (turuncu dikdörtgen); gerçek el görselleri kullanılmıyor. Yeşil perde görsellerinde parmak hayaleti ve yeşil sızıntı var (referans/06, 07) - kullanılamaz, temiz alfa gerekir.
6. **Tırmanma = 3 kez CSS zoom**; gerçek yükselme hissi yok.
7. **Web/HTML**: asıl uygulama React Native/Expo (Hafizbahcesi). Bu dosya doğrudan APK'ya girmez, yalnızca davranış taslağıdır.
8. bahce.jpg ve 1000149889.mp4 repoda yok; dosya tek başına çalışmaz.

## Karar
Gemini kodu **referans prototip** olarak saklanır, doğrudan kullanılmaz. Fikirler (durum makinesi, el, avuçta incele) alınır; uygulama şu mimariyle yapılacak:
- Ağaç başına kısa döngü klibi, bahçe zemini üzerine kompozit.
- 12 ayet = 12 meyve düğmesi, 5 renk, aşağıdan yukarı; zirve meyvesi sonda.
- Girişte kapı klibi (referans/01-03), meyvede el klibi (referans/04), temiz alfa elle.
- expo-video veya kare dizisi; toplam boyut hedefi 60-80 MB.
