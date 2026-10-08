# Silkroad: Convoy Wars — V4

Silkroad Online'ın gerçek dünyasında (orijinal harita, binalar, zemin dokuları, müzikler) geçen,
tarayıcıda çalışan 3B oyun. V4, önceki üç sürümün temiz baştan yazımıdır; eski sürümler
`C:\Silkroad\_ARSIV\` altında saklanır.

## Çalıştırma

```bat
INTERNET_OYUNU.bat
```

Oyunu açar (<http://localhost:5070/>) ve internetten arkadaş çağırmak için tüneli hazırlar (bkz.
aşağıda **İnternetten**). Tek başına oynamak için de bu yeter.
Elle: `python server.py 5070`. Eski başlatıcılar `arşiv/` altında: `OYNA.bat` (yalnız yerel
sunucu) ve `COKLU_OYUNCU.bat` (yerel ağ, `python server.py 5070 --lan`); bkz.
[Çok oyunculu](#çok-oyunculu).
Oyun internetsiz çalışır; Three.js ve diğer kütüphaneler `vendor/` altındadır.

Hızlı test adresleri:

| Adres | Ne açar |
|---|---|
| `/?mode=drive&city=hotan` | Hotan'da serbest sürüş |
| `/?mode=rally&stage=hotan&variant=kartal80&prep=ralli` | Ralli (zamana karşı), etap seçilebilir |
| `/?mode=race&stage=jangan&bots=7&level=zor` | Botlara karşı yarış (`&auto=1`: oyuncu aracını da bot sürer, izleme) |
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
| Boşluk | El freni: arka kilitlenir, araç savrulur (debriyaja basılır; 4x4'te merkez kavrama ayrılır) |
| C | Kamera: takip, uzak, kaput, kokpit, sinematik |
| Sağ fare tuşu | Etrafa bakma |
| F | Tam ekran: fare kilitlenir, tuşa basmadan fareyle etrafa bakılır (Esc: kilidi aç / menü) |
| L | Farlar |
| R | Zamanda geri sarar: basınca 1 sn geriye; 1 sn basılı tutunca 5 sn, 2 sn tutunca 10 sn geriye (basıldığı ana göre). Ralli ve yarışta 3 sn basılı tutmak rotaya döndürür. Araç dik, durağan ve duvar/çatı/su dışında bir yere konur |
| V | Yarışta finişten sonra diğer araçları izle |
| T | Otomatik / manuel şanzıman (manuelde Q / E vites) |
| Esc | Menü |

Xbox uyumlu kumanda desteklenir (RT gaz, LT fren, sol çubuk direksiyon, A el freni, Y kamera, X düzelt, LB/RB vites).

## Ralli

Altı etap, her şehrin çevresinde (ana menüden **Ralli: Zamana Karşı**):

| Etap | Uzunluk | Karakter |
|---|---|---|
| Jangan Kırları – Göl Tapınağı | 2.8 km | güney kapısı, pirinç tarlaları, doğu sırtı, saray yolu, surun dibi, gölle sur arası düzlük |
| Donwhang Çölü – Kızıl Platolar | 3.3 km | kızıl mesalar arasındaki kanyon vadileri, dar boğaz, vaha gölü |
| Hotan Vahası – Lord Yarkan Rallisi | 2.7 km | vaha toprak yolları, hurma düzlüğü, kayalık boğaz (kör sıçrama), kum tepeleri |
| Semerkant Vadisi – Karlı Dağ Eteği | 3.1 km | ova, dev mantar kaya sütunları arasında slalom, iki sütunun oluşturduğu dar kapı |
| Konstantiniyye Kıyıları | 2.3 km | Haliç kıyısı, nehir boyu ormanlar, deniz gören kuzey sırtları |
| İskenderiye Tepeleri – Vaha | 2.8 km | bağ evleri, zeytinlik, Nil kıyısı, kuzey vadisi, kum yarımadasının güney burnu |

Sıradaki kapı ışık sütunuyla, ondan sonraki sönük direklerle görünür; mini haritada rota
çizilidir. Üst paneldeki **pilot notları** yaklaşan virajın yönünü ve şiddetini (1 en keskin … 6
en hafif, firkete, *uzun*) ve tümsek / sıçrama / çukuru mesafesiyle söyler. R'yi 3 sn basılı tutmak
aracı rotaya (son geçilen ile sıradaki kapı arasındaki en yakın noktaya) geri koyar.

## Yarış: Botlara Karşı

Aynı etaplarda 8 araca kadar toplu kalkış. Botlar **aynı araçları aynı fizikle** kullanır: ek güç
ya da "lastik bandı" yoktur, zorluk yalnız sürüş becerisini ve kirli taktiklerin sıklığını
belirler (Kolay / Orta / Zor / Acımasız). Taktikler:

- **PIT manevrası** — yanındaki aracın arka çamurluğuna gelip direksiyonu ona kırar, arkasını döndürür
- **Bariyer** — viraj girişinde dış tarafındaki araca yaslanıp ondan destek alarak daha hızlı döner
- **Blok** (kirli botlar zigzag), **fren testi**, **yandan itme** (kenara, kayaya, uçuruma doğru),
  **arkadan dürtme**
- **Kestirme** — hızlı çizgideki viraj içleri ve açık arazi kestirmeleri (kapılar yine geçilmek zorunda)

Araçlar arası çarpışma gerçek fiziktir (gövde küreleri, kütle oranında itme, göçük ve hasar). Botlar
takla, takılma, kaçırılan kapı ve rotadan kopmada insan oyuncunun kullandığı aynı kurtarmaları
(düzelt, rotaya dön) kullanır. Sıralama geçilen kapı + rota üzerindeki ilerlemeyle; sonuçta puan
(10-8-6-5-4-3-2-1). Finişten sonra **V** ile diğer araçları izlersin. Oyuncudan uzaktaki botlar
(bölgesi yüklü olmayan) fiziksiz modda kendi hız planlarıyla yarışmaya devam eder.

## Çok oyunculu

Bir bilgisayar sunucu olur: `COKLU_OYUNCU.bat` (ya da `python server.py 5070 --lan`). Konsolda
yazan yerel ağ adresini (ör. `http://192.168.1.20:5070/`) aynı ağdaki arkadaşların tarayıcıda açar;
Windows güvenlik duvarı sorarsa "Özel ağlar" için izin verilmelidir. Oyun dosyaları sunucudan
yüklenir; arkadaşların bilgisayarında kurulum gerekmez.

Ana menü → **Çok Oyunculu**: adını yaz, **Oda kur** ya da açık odalardan birine / 4 harfli kodla
**katıl**. Lobide herkes aracını ve rengini seçip **Hazırım** der; oda kurucusu etabı, modu, bot
sayısını, zorluğunu ve bot araçlarını ayarlayıp başlatır. Modlar:

- **Herkes kendi için** — oyuncular ve botlar birbiriyle yarışır
- **Takım (co-op)** — oyuncular botlara karşı; botlar yalnız oyunculara saldırır, sonuçta takım
  puanları toplanır

Her oyuncu kendi aracını kendi bilgisayarında simüle eder ve durumunu saniyede 20 kez yayınlar;
botları oda kurucusu simüle eder. Uzak araçlar 110 ms geriden ara değerlenerek gösterilir; araçlar
arası temas iki tarafta da kendi aracına uygulanır. Start, sunucu saatine göre herkeste aynı anda
verilir; süreler karşılaştırılabilir. Sunucu oyun mantığı çalıştırmaz, yalnız oda ve mesaj aktarır
(Python standart kütüphanesi, ek kurulum yok).

### İnternetten (sabit IP gerekmez)

Oyunu `INTERNET_OYUNU.bat` ile başlat (`python server.py 5070 --tunnel`). Sunucu Cloudflare'in
ücretsiz hızlı tünelini açar: bilgisayarın dışarıya bağlandığı için sabit IP, modem/port ayarı ya
da hesap gerekmez. Bunun için `tools/cloudflared.exe` gerekir (Cloudflare'in resmî sürümü
`cloudflared-windows-amd64.exe`, git dışı). Oda kurunca lobide **Davet dosyası (.html)** ile
arkadaşına gönderirsin (WhatsApp, e-posta…); arkadaşın dosyayı açar, adını yazar, **Yarışa katıl**
der ve doğrudan odana girer. **Bağlantıyı kopyala** aynı şeyi bağlantı olarak verir.

Arkadaşın tarafında:

- **Oyun kodu** GitHub Pages'teki kopyadan gelir (`https://mustafaferhatimamoglu.github.io/silkroad-convoy-wars/`;
  yalnız `index.html`, `sw.js`, `src/`, `vendor/`). Kodu değiştirince yeniden yayınla:
  `python tools/publish_pages.py publish` (önce `python tools/publish_pages.py serve` ile yerelde,
  `http://localhost:5080/silkroad-convoy-wars/?host=http://localhost:5070` adresinde denenebilir).
- **Silkroad dosyaları** (harita, modeller, müzik — Joymax'in telifli içeriği) hiçbir siteye
  yüklenmez. Lobide, kurucunun seçtiği etabın paketi senin bilgisayarından **bir kez** iner ve
  arkadaşın tarayıcısında saklanır (etap başına 40–70 MB). Sunucu yeniden başlasa, tünel adresi
  değişse de tekrar inmez. Bir dosyayı değiştirirsen yalnız o dosya yeniden iner: sunucu paket
  listesini her istekte güncel içerik özetleriyle verir.
- Paket inmeden **Hazırım** açılmaz; herkes hazır olmadan kurucu **Yarışı başlat** diyemez. Lobide
  her oyuncunun indirme yüzdesi görünür.
- Sürüm kontrolü: ağ protokolü (`src/version.js` → `PROTOCOL`) ya da etap verisi kurucununkinden
  farklıysa lobide “sürüm farklı” yazar ve hazır olunamaz; kurucu yeni sürümü yayınlar, arkadaş
  sayfayı yeniler.

Etap paketleri `python tools/packs.py all` ile kaydedilir (oyun ve test tarayıcısı açıkken): her
etap otomatik pilotla baştan sona sürülür, istenen dosyalar `assets/packs/<etap>.json` listesine
yazılır. Etap rotası değişirse o etabı yeniden kaydet: `python tools/packs.py record hotan`, sonra
`python tools/packs.py write`.

Sunucu yalnızca oyunun çalışması için gereken dosyaları verir (`index.html`, `src/`, `vendor/`,
`assets/`); git geçmişi, araçlar, testler ve klasör listeleri dışarıya kapalıdır. Tünel adresi
rastgeledir; daveti yalnız arkadaşlarınla paylaş. Pencere kapanınca tünel de kapanır.

## Etap araçları

Etaplar `tools/rally/` ile üretilir (oyun ve `node tools/devharness.mjs` açıkken):

```bat
python tools/rally/rally.py scan jangan    :: araziyi tara (4 m ızgara: eğim, su, engel, zemin)
python tools/rally/rally.py reach jangan   :: başlangıçtan araçla ulaşılabilen alan haritası
python tools/rally/rally.py build jangan   :: A* rota + ince engel koridoru + hızlı çizgi + pilot notları
python tools/rally/rally.py drive jangan kartal80 ralli   :: otomatik pilotla deneme turu
```

Etap tanımı `tools/rally/stages/<id>.json`: ara noktalar (adı olanlar kontrol kapısı; finişten sonra
adsız bir nokta kaçış yolu bırakır) ve ayarlar: `road` (toprak yolu ne kadar sıkı izlesin; tarlalar
böylece kestirme olur), `smooth` (tümsek/set cezası), `maxslope` / `slopecost` (dik yokuş), `avoid`
(`[rx, rz, yarıçap m, not]`: rotanın ve hızlı çizginin girmeyeceği alanlar; 4 m ızgaranın yumuşattığı
kaya eteği, yan eğim gibi yarış denemesinde takla çıkan yerler için). Rota
eğim/zemin/engel yakınlığı maliyetli A* ile bulunur, görüş hattıyla sadeleştirilip yumuşatılır;
kaktüs, hurma gövdesi, çalı, kütük ve hendek gibi 4 m ızgarada kaçan ince engeller koridorun 1 m'lik
taramasıyla bulunup uzak tutulur. Botların hızlı çizgisi rotanın kapılardan geçen gergin ip
hâlidir; koridor genişlikleri sollama/blok yerlerini sınırlar. Pilot notları 1 m'lik yükseklik
profilinden çıkar; kısa ve sert basamaklar (teras kenarı) `vmax` güvenli hızıyla işaretlenir, botlar
oraya o hızla varır. Her etap 8 botla baştan sona
yarıştırılarak denendi (`/?mode=race&stage=…&bots=7&level=zor&auto=1`).

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
server.py             yerel sunucu (doğru MIME türleri, çok iş parçacıklı, WebSocket oda sistemi)
src/
  core/               uygulama, renderer, girişler, ayarlar
  world/              bölge akışı, zemin dokusu karışımı, objeler, su, gökyüzü, çarpışma
  vehicle/            araç fiziği (physics/), Tofaş Kartal modeli (model/), kamera
  chars/              Silkroad karakter/NPC/canavar yükleyicisi (iskelet, animasyon, eşya takma)
  rpg/                Kervan RPG: nüfus, hareket, savaş, ekonomi, feribot rotaları, yol bulucu, ses
  modes/              sürüş, garaj, dünya gezgini, ralli, yarış, kervan
  race/               yarış: parkur takibi (Course), bot sürücü ve zorluklar (BotDriver)
  net/                çok oyunculu: sunucu bağlantısı, lobi, uzak araçların ara değerlemesi
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
node --test
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

## Varlıkları yeniden üretme

Varlıklar orijinal istemcinin `*.pk2` dosyalarından üretilir (bkz. `tools/`). İstemci arşivde:
`C:\Silkroad\_ARSIV\SRO_Client\` (başka yerdeyse `SRO_CLIENT` ortam değişkeniyle verilir).
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
