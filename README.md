# Silkroad: Convoy Wars — V4

Silkroad Online'ın gerçek dünyasında (orijinal harita, binalar, zemin dokuları, müzikler) geçen,
tarayıcıda çalışan 3B oyun. V4, önceki üç sürümün temiz baştan yazımıdır; eski sürümler
`C:\Silkroad\_ARSIV\` altında saklanır.

## Çalıştırma

```bat
OYNA.bat
```

ya da elle: `python server.py 5070` ve tarayıcıda <http://localhost:5070/>.
Oyun internetsiz çalışır; Three.js ve diğer kütüphaneler `vendor/` altındadır.

Hızlı test adresleri:

| Adres | Ne açar |
|---|---|
| `/?mode=drive&city=hotan` | Hotan'da serbest sürüş |
| `/?mode=kervan&city=jangan` | Kervan RPG (kayıtlı oyuna devam) |
| `/?mode=chars&keys=player_ch_m,cos_t_horse1` | Dönüştürülmüş karakterleri inceleme |
| `/?mode=garage&variant=kartal80&paint=lacivert` | Aracı yakından inceleme |
| `/?city=jangan` | Dünya gezgini (serbest kamera) |
| `&debug=1` | FPS / çizim çağrısı / bölge bilgisi (F3) |

## Kontroller (sürüş)

| Tuş | İşlev |
|---|---|
| W / S (oklar) | Gaz / fren; dururken S'ye basılı tutunca geri vites |
| A / D | Direksiyon |
| Boşluk | El freni |
| C | Kamera: takip, uzak, kaput, kokpit, sinematik |
| Sağ fare tuşu | Etrafa bakma |
| L | Farlar |
| R | Aracı düzelt; iki kez basınca (ya da suya/çukura düşünce) son güvenli noktaya dön |
| T | Otomatik / manuel şanzıman (manuelde Q / E vites) |
| Esc | Menü |

Xbox uyumlu kumanda desteklenir (RT gaz, LT fren, sol çubuk direksiyon, A el freni, Y kamera, X düzelt, LB/RB vites).

## Kervan RPG

Ana menüden **Kervan RPG** → görünüm seç → *Yeni kervan*. Jangan'da tüccar olarak başlarsın.

1. **Ahır Sorumlusu**'ndan yük hayvanı al (eşek 30, at 60, deve 100 birim taşır).
2. **Özel Ürün Tüccarı**'ndan şehrin malını yükle (Jangan: ipek, seladon vazo; Donwhang: deri,
   eyer; Hotan: nefrit, yeşim; Semerkant: yün, baharat; Konstantiniyye: keten, inci...).
3. Malı başka bir şehre götür ve orada sat. Uzak şehir = daha çok kâr. Nehir ve denizleri
   iskelelerdeki **Kayık Bilet Satıcısı** ile kervanınla birlikte geçersin.
4. Şehir dışında yüklü kervanı **haydutlar** basar: bineğinin dayanıklılığı biterse yükünün
   bir kısmını kaparlar. Savaş, iksir iç, Demirci'de mızrağını, Zırhçı'da zırhını güçlendir.

Sol üstte sıradaki adım ve hedef yazar; mini haritadaki noktalı çizgi yol bulucunun
önerdiği yoldur. NPC'lerin adları ve karşılama sözleri oyunun kendi Türkçe metinleridir.
İlerleme tarayıcıda saklanır (Devam et).

| Tuş | İşlev |
|---|---|
| W A S D | Hareket (kameraya göre) · Shift: yürü/koş |
| E | Konuş (NPC) |
| Boşluk | Saldır (en yakın düşman) · Tab: hedef seç |
| Q | Can iksiri |
| M | Dünya haritası (feribot/gemi hatlarıyla) · H: hedef şehri değiştir |
| Sağ fare | Kamera · tekerlek: yakınlaştır |
| Esc | Menü |

## Yapı

```
index.html            giriş (import map: three, three/addons, three-mesh-bvh)
server.py, OYNA.bat   yerel sunucu (doğru MIME türleri, çok iş parçacıklı)
src/
  core/               uygulama, renderer, girişler, ayarlar
  world/              bölge akışı, zemin dokusu karışımı, objeler, su, gökyüzü, çarpışma
  vehicle/            araç fiziği (physics/), Tofaş Kartal modeli (model/), kamera
  chars/              Silkroad karakter/NPC/canavar yükleyicisi (iskelet, animasyon, eşya takma)
  rpg/                Kervan RPG: nüfus, hareket, savaş, ekonomi, feribot rotaları, yol bulucu, ses
  modes/              sürüş, garaj, dünya gezgini, ralli, kervan
  ui/                 göstergeler, menüler, stiller
  data/               şehirler ve başlangıç noktaları
tools/                varlık üretim betikleri ve geliştirme araçları
tests/                node --test ile çalışan fizik testleri
vendor/               three.js r186, three-mesh-bvh
assets/               (git dışı) PK2'den üretilmiş harita, model, müzik, mini harita
```

## Zemin dokuları

Her bölge 97×97 köşe noktasında bir orijinal Silkroad zemin dokusu (`tile2d`, 512×512) ve
ölçek üssü taşır. Parça shader'ı bulunduğu hücrenin dört köşesindeki dokuyu
`4 × 2^üs` hücre tekrar boyunda örnekler ve parlaklığa göre karıştırır. Bu ölçek kuralı,
farklı yorumlarla üstten çizilen zeminin orijinal oyunun mini haritasıyla karşılaştırılmasıyla
bulundu (en iyi uyum korelasyonu ~4 kat daha yüksek). Dokular tek bir GPU doku dizisinde
LRU ile tutulur.

## Araç fiziği

`src/vehicle/physics/` Three.js'den bağımsızdır ve 240 Hz sabit adımla çalışır:
ışınlı süspansiyon (yay, ayrı sıkışma/açılma sönümü, viraj demiri), kayma açısı ve kayma
oranına bağlı lastik modeli (sürtünme elipsi, yük duyarlılığı, zemin malzemesine göre tutuş),
motor tork eğrisi + otomatik debriyaj + 5 ileri vites + hafif kilitli diferansiyel, ABS, TCS,
gövde çarpışma küreleri ve hasar. Testler:

```bat
node --test
```

## Varlıkları yeniden üretme

Varlıklar `C:\Silkroad\SRO_Client\*.pk2` dosyalarından üretilir (bkz. `tools/`).
Kervan RPG için (sırayla):

```bat
python tools/assets/export_gamedata.py
python tools/assets/export_chars.py
python tools/assets/export_sfx.py
python tools/assets/fix_textures.py
```

`export_gamedata` NPC/canavar doğma noktalarını, Türkçe adları ve konuşmaları, feribot
iskelelerini ve ticaret malı ikonlarını; `export_chars` karakter/NPC/binek/canavar modellerini
(iskelet + animasyon), kıyafetli oyuncu görünümlerini ve silahları; `export_sfx` oyunun ses
efektlerini üretir.
