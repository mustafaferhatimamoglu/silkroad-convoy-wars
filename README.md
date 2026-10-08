# Silkroad: Convoy Wars — V5

İpek Yolu'nda geçen, tarayıcı motoruyla çalışan 3B araç oyunu. V5'te dünya, zemin ve yapı
dokuları, binalar, bitkiler, müzik ve simge **tamamen bizim ürettiğimiz** içeriktir: Silkroad
Online'ın dosyalarına bağımlılık yoktur (şehir adları ve kültürler esin kaynağıdır). Bu yüzden
oyunun tamamı tek bir exe olarak paylaşılabilir. Plan ve aşamalar: [docs/V5_PLAN.md](docs/V5_PLAN.md).

## Oynamak

- **Oyuncu**: `SilkroadV5-<sürüm>.exe` (GitHub Releases). Kurulum yok: ilk açılışta oyun dosyalarını
  `%LOCALAPPDATA%\SilkroadConvoyWars\` altına açar ve Edge'in uygulama penceresinde başlatır
  (Edge yoksa Chrome, o da yoksa varsayılan tarayıcı). İmzasız exe olduğu için Windows "korundu"
  uyarısı verirse *Ek bilgi → Yine de çalıştır*.
- **Kaynaktan / kurucu**: `INTERNET_OYUNU.bat` çok oyunculu sunucuyu internet tüneliyle açar ve
  oyunu tarayıcıda açar (`python server/server.py 5070 --tunnel --client . --open`). Yalnız yerel
  oyun: `arşiv/OYNA.bat`, yerel ağ: `arşiv/COKLU_OYUNCU.bat`.

Hızlı test adresleri (sunucu `--client .` ile açıkken):

| Adres | Ne açar |
|---|---|
| `/?mode=drive&city=hotan` | Hotan'da serbest sürüş |
| `/?mode=rally&stage=hotan&variant=kartal80&prep=ralli` | Ralli (zamana karşı) |
| `/?mode=race&stage=jangan&bots=7&level=zor&auto=1` | Botlara karşı yarış (`auto=1`: oyuncu aracını da bot sürer) |
| `/?mode=garage&variant=kartal80&paint=lacivert` | Aracı yakından inceleme |
| `/?mode=explore&city=jangan` | Dünya gezgini (serbest kamera) |
| `&debug=1` | FPS / çizim çağrısı / bölge bilgisi (F3) |

## Kontroller (sürüş)

| Tuş | İşlev |
|---|---|
| W / S (oklar) | Gaz / fren; dururken S'ye basılı tutunca geri vites |
| A / D | Direksiyon |
| Boşluk | El freni: arka kilitlenir, araç savrulur (debriyaja basılır; 4x4'te merkez kavrama ayrılır) |
| C | Kamera: takip, uzak, kaput, kokpit, sinematik |
| M | Büyük dünya haritası (şehirler, yollar, feribot ve hava gemisi hatları, tünel, diğer oyuncular) |
| G | Feribota / hava gemisine bin (iskele ucunda ya da güvertede, yavaşken); ışınlanma kapısında hedef seç |
| K | Müzik aç/kapa |
| Sağ fare tuşu | Etrafa bakma |
| F | Tam ekran: fare kilitlenir, tuşa basmadan fareyle etrafa bakılır (Esc: kilidi aç / menü) |
| L | Farlar |
| R | Zamanda geri sarar: basınca 1 sn geriye; 1 sn basılı tutunca 5 sn, 2 sn tutunca 10 sn geriye (basıldığı ana göre). Ralli ve yarışta 3 sn basılı tutmak rotaya döndürür. Araç dik, durağan ve duvar/çatı/su dışında bir yere konur |
| V | Yarışta finişten sonra diğer araçları izle |
| T | Otomatik / manuel şanzıman (manuelde Q / E vites) |
| Esc | Menü |

Xbox uyumlu kumanda desteklenir (RT gaz, LT fren, sol çubuk direksiyon, A el freni, Y kamera, X düzelt, LB/RB vites).

## Dünya

80 × 40 bölgelik (≈15 × 7,7 km) üretilmiş dünya: doğudan batıya Jangan → büyük nehir (feribot) →
Donwhang → Hotan → sıradağ (açık geçit yolu ve 870 m'lik tünel; kuzeyde Roc Dağı) → Semerkant →
Konstantiniyye (boğaz, feribot); güneydeki limandan gemiyle İskenderiye. Arazi sabit tohumlu
gürültü ve elle tasarlanmış özelliklerden (`src/world/gen/plan.js`) üretilir; yollar %9 eğim
sınırlı, yarma/dolgu şevli. Şehirler kültürüne göre kodla kurulur (sur, kule, açık kapılar,
evler, meydan yapısı); çarpışma görünen geometriden yapılır.

- **Işınlanma kapıları**: her şehrin meydanında; içinde yavaşlayıp G → hedef şehir.
- **Feribotlar**: iskelenin ucunda ya da güvertede yavaşla, G. Araç gemiyle karşıya geçer.
- **Roc hava gemileri**: Hotan'ın kuzey kapısından çıkan toprak yolun sonundaki istasyonda; rampadan
  iskeleye çık, G. Gemiyi iki dev Roc kuşu taşır, Roc Dağı'nın zirve platosuna uçar (ve geri).
- **Tünel**: Hotan–Semerkant arasında, dağın altından; içeride farlar kendiliğinden yanar.
- **Harita**: M (tekerlek yakınlaştırır, sürükleyerek kaydırılır).
- **Müzik**: bölgeye göre makam/çalgı ile üretilir (Karplus-Strong telli, ney/dizi, davul).

## Ralli

Altı etap, her şehrin çevresinde (ana menüden **Ralli: Zamana Karşı**). Etaplar gerçek ralli
parkurları gibi araziden açılmıştır: parkur boyunca ağaç ve kaya temizlenmiş, zemin toprak/çakıl
şerittir; serbest sürüşte de görünür.

| Etap | Uzunluk | Kapılar |
|---|---|---|
| Jangan Bayırları – Lotus Gölü | 2.2 km | Pirinç Tarlaları, Lotus Gölü, Kuzey Tepesi, Tapınak Sırtı, Jangan Kuzey Bayırı |
| Donwhang – Kızıl Mesalar | 2.2 km | Taş Düzlüğü, Mesa Geçidi, Kurumuş Dere, Batı Tepeleri, Donwhang Batı Kapısı |
| Hotan Vahası – Taklamakan | 2.0 km | Vaha Gölü, Kum Tepeleri, Kızıl Kayalar Firketesi, Çöl Düzlüğü, Kervan Kuyusu, Hotan Batı Yolu |
| Semerkant – Zerefşan Vadisi | 2.7 km | Bağ Evleri, Kuzey Sırtı, Çoban Yaylası, Dağ Eteği, Kervan Yolu Geçidi, Zerefşan Kıyısı |
| Konstantiniyye – Boğaz Sırtları | 2.5 km | Doğu Bağları, Bağ Yokuşu, Kuzey Ormanı, Boğaz Manzarası, Konstantiniyye Batı Kapısı |
| İskenderiye – Kum Denizi | 2.3 km | Batı Kumulları, Kum Denizi, Firavun Taşları, Nil Kıyısı, İskenderiye Doğu Kapısı |

Sıradaki kapı ışık sütunuyla, ondan sonraki sönük direklerle görünür; mini haritada rota
çizilidir. Üst paneldeki **pilot notları** yaklaşan virajın yönünü ve şiddetini (1 en keskin … 6
en hafif, firkete, *uzun*) ve tümsek / sıçrama / çukuru mesafesiyle söyler. R'yi 3 sn basılı tutmak
aracı rotaya geri koyar.

## Yarış: Botlara Karşı

Aynı etaplarda 8 araca kadar toplu kalkış. Botlar **aynı araçları aynı fizikle** kullanır; zorluk
yalnız sürüş becerisini ve kirli taktiklerin sıklığını belirler (Kolay / Orta / Zor / Acımasız):
PIT manevrası, bariyer olarak kullanma, blok, fren testi, yandan itme, kestirme. Araçlar arası
çarpışma gerçek fiziktir. Sonuçta puan (10-8-6-5-4-3-2-1); finişten sonra **V** ile izleme.

## Çok oyunculu

İstemci (oyun) ve sunucu ayrı programlardır. Sunucu (`server/server.py`, yalnız Python standart
kütüphanesi) oda kurar ve mesaj aktarır; oyun mantığı çalıştırmaz, oyun dosyası sunmaz (`--client`
verilmedikçe). Herkes kendi aracını simüle eder ve saniyede 20 kez yayınlar; botları oda kurucusu
sürer. Uzak araçlar 110 ms geriden ara değerlenir.

- **Sunucu açmak**: `INTERNET_OYUNU.bat` (kaynak klasöründen) ya da sunucu paketindeki
  `INTERNET_SUNUCU.bat`. Cloudflare hızlı tüneli açılır: sabit IP, modem ayarı ya da hesap gerekmez
  (`server/cloudflared.exe` gerekir: Cloudflare'in resmî `cloudflared-windows-amd64.exe` sürümü, git
  dışı). Konsolda ve oyunda görünen `https://….trycloudflare.com` adresini arkadaşına ver.
- **Katılmak**: oyunda **Çok Oyunculu** → **Sunucu adresi** kutusuna adresi yaz → **Bağlan** →
  odaya katıl (ya da oda kur). Lobide **Kopyala** sunucu adresini ve oda kodunu panoya alır.
- **Sürüm denetimi**: istemci bağlanırken sürümünü (`src/version.js`) yollar; sunucunun sürümüyle
  (`server/server.py`) birebir aynı değilse sunucu reddeder ve oyun güncel sürümün indirileceği
  yeri gösterir. Her değişiklikte ara sürüm bir artar: `python tools/bump.py` (ikisini birlikte).
- **Modlar**: **Serbest gezinti** (açık dünyada birlikte: feribot, hava gemisi, ışınlanma, harita;
  biri gemiye binince gemi herkeste kalkar, sonradan gelen arkadaş doğrudan dünyaya katılır),
  **Yarış: herkes kendi için**, **Yarış: takım (co-op)** — oyuncular botlara karşı. Bot sayısı 0
  seçilirse ralli etabında yalnız oyuncular yarışır.

## Dağıtım paketleri

```bat
python tools/build_client.py
```

`dist/SilkroadV5-<sürüm>.exe` (oyunun tamamı içinde; Windows'un hazır .NET Framework derleyicisiyle
derlenen küçük bir başlatıcı: oyunu açar, 127.0.0.1'de sunar, Edge uygulama penceresinde gösterir)
ve `dist/SilkroadV5-Sunucu-<sürüm>.zip` (sunucu + başlatıcılar; Python 3 gerekir). Silkroad'ın
dosyaları (`assets/`, git dışı, yalnız eski modlar için) hiçbir pakete girmez.

## Etap araçları

Etaplar `tools/rally/` ile üretilir (sunucu `--client .` ve `node tools/devharness.mjs` açıkken):

```bat
python tools/rally/rally.py scan jangan    :: bitki örtüsüz araziyi tara (4 m ızgara: eğim, su, engel, zemin)
python tools/rally/rally.py reach jangan   :: başlangıçtan araçla ulaşılabilen alan haritası
python tools/rally/rally.py build jangan   :: A* rota + ince engel koridoru + hızlı çizgi + pilot notları
python tools/rally/rally.py drive jangan kartal80 ralli   :: otomatik pilotla deneme turu
```

Etap tanımı `tools/rally/stages/<id>.json` (koordinatlar kesirli bölge: bölge = 192 m, rx doğu,
rz kuzey). Tarama dünyayı bitki örtüsü olmadan kurar (`?noveg=1`); planlanan parkur boyunca ağaç ve
kayalar oyunda temizlenir (`src/world/gen/tracks.js`). Her etap 8 botla baştan sona yarıştırılarak
denendi. Yerel harita (tasarım için): `node tools/gen/localmap.mjs çıktı.rgb rx0 rx1 rz0 rz1`.

## Yapı

```
index.html            giriş (import map: three, three/addons, three-mesh-bvh)
server/server.py      çok oyunculu sunucu (oda sistemi, sürüm denetimi, tünel; --client ile oyunu da sunar)
src/
  core/               uygulama, renderer, girişler, ayarlar, fare kilidi
  world/              bölge akışı, zemin, objeler, su, gökyüzü, çarpışma, ulaşım (feribot, hava gemisi, kapılar)
  world/gen/          dünya üretimi: plan (arazi, yollar, tünel), şehir düzeni, modeller, yerleşim, parkurlar
  vehicle/            araç fiziği (physics/), modeller, kamera, ses
  audio/              üretken müzik
  modes/              sürüş, garaj, dünya gezgini, ralli, yarış
  race/               parkur takibi (Course), bot sürücü ve zorluklar (BotDriver)
  net/                sunucu bağlantısı, lobi, uzak araçlar, serbest gezinti varlığı
  ui/                 göstergeler, menüler, büyük harita, stiller
  data/               şehirler, ralli etapları (üretilmiş)
content/              kendi ürettiğimiz dokular ve simge (tools/gen/textures.py, tools/gen/icon.py)
tools/                dünya/doku/simge üreticileri, ralli araçları, istemci paketleyici, sürüm aracı
tests/                node --test ile çalışan fizik ve sürüm testleri
vendor/               three.js r186, three-mesh-bvh
```

## Araç fiziği

`src/vehicle/physics/` Three.js'den bağımsızdır ve 240 Hz sabit adımla çalışır:
ışınlı süspansiyon (yay, ayrı sıkışma/açılma sönümü, viraj demiri), kayma açısı ve kayma
oranına bağlı lastik modeli (sürtünme elipsi, yük duyarlılığı, zemin malzemesine göre tutuş),
motor tork eğrisi + otomatik debriyaj + 5 ileri vites + hafif kilitli diferansiyel, ABS, TCS,
gövde çarpışma küreleri ve hasar.

- **Kayan lastik**: teker kilitlenince (el freni) ya da hızlıyken patinaj yapınca sürtünme kayma
  hızının tersine döner, yana tutunma büyük ölçüde kaybolur: el freniyle arka savrulur, gazla
  drift yapılır. Kalkışta (düşük hızda) patinaj yana savurmaz.
- **Karşı direksiyon**: kayarken tekerler gidiş yönüne kadar serbestçe çevrilebilir; tuş bırakılınca
  kaster etkisi tekerleri kendiliğinden kayma yönüne çeker (botlar direksiyonu sıkı tutar).
- **El freni**: sürücü debriyaja basar; 4x4'te merkez kavrama ayrılır (ralli hidrolik el freni).
- **Gaz tepkisi**: tam gazda şanzıman tek adımda uygun vitese iner (devir eşlemeli, kısa geçiş).
- **Güç**: bütün motorlar fabrika torkunun %40 üstünde (`presets.js` → `POWER`); botlar aynı
  araçları kullanır. Botların gaz ayağı patinaj/arka kayması ve havada kalma durumunda gazı keser.

Testler (drift, karşı direksiyon, gaz tepkisi: `tests/drift.test.mjs`):

```bat
node --test tests/*.test.mjs
```

## Motor sesi

`src/audio/engine-worklet.js` kayit kullanmayan fiziksel bir modeldir (DasEtwas/enginesound ve
Antonio-R1/engine-sound-generator calismalarindaki dalga kilavuzu fikrinden esinlenildi):
silindir basinci krank acisina gore hesaplanir, supaplar orifis akisi olarak manifold
kollarina, kollektore, borulara, susturucu odalarina ve egzoz ucuna baglanir; duyulan ses
uctaki akisin turevidir. Emme hatti, gaz kelebegi, dizel yanma takirtisi, turbo isligi,
supap tikirtisi, yakit kesme ve geri tepme de modeldedir. Arac profilleri: `kartal`
(1.6 karburatorlu), `hilux` (2.8 turbo dizel), `f150` (5.0 V8, capraz duzlem krank).

```bat
node tools/enginelab.mjs all <klasor>
```

senaryolari (rolanti, gaz pompalama, tam gaz, motor freni, seyir, devir siniri) cevrimdisi
isler; seviyeleri olcer, WAV ve spektrogram yazar.
