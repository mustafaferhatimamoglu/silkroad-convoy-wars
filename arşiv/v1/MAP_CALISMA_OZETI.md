# Silkroad Map.pk2 Dönüşümü — Çalışma Özeti

> Tarih: 2026-10-03 · Hazırlayan: Antigravity
> Amaç: `C:\Silkroad\Silkroad_V2\extracted\client\Map.pk2` dosyasındaki Silkroad Online dünyasını kendi Three.js (r128) oyunumuzda kullanılabilir bir `MAP` klasörüne dönüştürmek.

---

## 1. Yapılanlar

### 1.1 PK2 arşiv okuyucu
- **Dosya:** `C:\Silkroad\Silkroad\tools\map_export\pk2.py`
- Joymax PK2 formatı çözüldü:
  - 256 byte header ("JoyMax File Manager!", versiyon `0x1000002`, şifreli = 1)
  - Dizin blokları 20 × 128 byte, **Blowfish ECB** ile şifreli
  - Anahtar `"169841"`, salt `03 F8 E4 44 88 99 3F 64 FE 35` ile XOR'lanıyor
  - **Little-endian Blowfish:** her 4 byte'lık kelime ters çevriliyor (otomatik algılanıyor)
  - Entry: type(1) name(81, cp949) zaman(24) position(int64) size(uint32) nextChain(int64) pad(2)
  - Dosya verileri şifresiz
- Map.pk2 taraması: **19.587 dosya, 92 klasör**, ~0,1 sn

### 1.2 Ham çıkartma
- **Dosya:** `tools\map_export\extract_pk2.py`
- Çıktı: `C:\Silkroad\Silkroad_V2\extracted\Map_raw\` (1,3 GB, ~4 sn)
- İçerik: 4595 `.m`, 4595 `.o`, 4452 `.o2`, 5092 `.t`, 839 `.ddj`, 2 `.tga`, 8 `.ifo` dosyası, ayrıca `mapinfo.mfo`, `plugin.dat` ve 2 `.txt` dosyası

### 1.3 Doğrulanan dosya formatları

| Dosya | Format | Durum |
|---|---|---|
| `{z}/{x}.m` | `JMXVMAPM1000`, 12 byte header + 36 blok × 2575 byte = **92.712 byte**. Blok: flag u32, env u16, 17×17 vertex (f32 yükseklik, u16 doku, u8 parlaklık), su tipi u8, su dalgası u8, su yüksekliği f32, 16×16 u16 hücre, hmax f32, hmin f32, 20 byte rezerve | ✅ Blok kenarları birebir eşleşti |
| `{z}/{x}.o2` | `JMXVMAPO1001`, 144 grup × (u16 adet + adet × **30 byte**): model u32, x/y/z f32, static u16, yaw f32, uid u32, unk u16, regionId u16 | ✅ 4452 dosyanın tamamı hatasız |
| `{z}/{x}.o` | `JMXVMAPO1001`, aynı yapı ama **28 byte** (regionId yok) | ⚠️ Kısmen: bazı dosyalar (örn. 228 byte) farklı yapıda, kullanılmadı |
| `tile2d/*.ddj` | 20 byte `JMXVDDJ 1000` header + DDS (DXT1, 512² / 256²) | ✅ 752 dosyanın tamamı Pillow ile açıldı |
| `tile2d.ifo` | `JMXV2DTI1001`, 719 doku (index, flag, bölge adı, dosya) | ✅ |
| `object.ifo` | `JMXVOBJI1000`, 3307 model yolu (`res\bldg\...\*.bsr`, Data.pk2 içinde) | ✅ |
| `.t`, `mapinfo.mfo`, `environment.ifo`, `objectstring.ifo`, `layerobjectlist.ifo`, `objext.ifo`, `config.ifo`, `tile3d.ifo` | Header'lara bakıldı | ❌ Parse edilmedi |

- Koordinatlar: bölge 1920×1920 birim, 96×96 hücre (hücre 20 birim), 97×97 vertex. Klasör adı = Z, dosya adı = X, bölge ID = `(z<<8)|x` (Jangan = 25000 = `97/168`).

### 1.4 Dönüştürücü
- **Dosya:** `tools\map_export\convert_map.py` (~87 sn)
- **Çıktı:** `C:\Silkroad\Silkroad\silkroad_3d\MAP\`

| Çıktı | Adet / Boyut |
|---|---|
| `world.json`: manifest, bölge listesi, koordinat sistemi, `.bin` yerleşimi | 1 |
| `regions/{z}_{x}.bin`: "SRMP" header, height f32, texture u16, light u8, cellFlags u16, waterType u8, waterHeight f32 | 4590 × 84.508 byte ≈ 370 MB |
| `colormaps/{z}_{x}.jpg`: doku indekslerinden üretilmiş zemin rengi, **256×256** | 4590, 56 MB |
| `objects/{z}_{x}.json` + `objects/models.json` | 77.284 obje, 2565 bölge, 2609 farklı model |
| `textures/tile2d/*.jpg` + `textures/tiles.json` | 719 doku (512×512 JPG) |
| `preview/world_color.jpg`, `world_height16.png`, `region_mask.png` | Dünya önizlemesi |

### 1.5 Three.js tarafı
- `silkroad_3d\MAP\SilkroadMap.js`: oyuncunun çevresindeki bölgeleri yükleyip uzaktakileri boşaltan yükleyici. Özellikler:
  - `getHeightAt()`, `toThree()`, `fromThree()`, `regionCenter()`
  - Su düzlemleri
  - Objeler için yer tutucu kutular (InstancedMesh)
- `silkroad_3d\MAP\viewer.html`: bağımsız test görüntüleyici (mini harita, ışınlanma, WASD)
- `silkroad_3d\MAP\README.md`: format ve entegrasyon dokümanı

### 1.6 Yapılan doğrulamalar
- Dünya önizlemesi görsel olarak doğru: Avrupa solda, Jangan sağda, Roc Dağı ortada.
- Jangan çevresindeki 3×3 colormap kesintisiz; şehir ve güney kapısı yönü doğru.
- Objeler araziye oturuyor: Jangan bölgelerinde yükseklik farkı medyanı **0.0**. X/Z ters çevrilince fark büyüyor, yani eşleme doğru.
- Sunucu `/3d/*` yolunu alt klasörler dahil servis ediyor (`orchestrator_hub/server.py`).

---

## 2. Yapılmayanlar / Eksikler

1. **Görüntüleyici tarayıcıda test edilmedi.** 5050 portundaki sunucu kapalıydı. Orkestratör başlatılmadı, çünkü Ollama döngüsünü tetikleyebilir.
2. **Dönüşüm kayıpsız değil.** `.bin` dosyasına şunlar yazılmadı:
   - blok başına `flag`, `env`, `wwave`, `hmax`/`hmin` ve 20 byte rezerve alan
   - `.t` dosyaları, `.o` dosyaları ve diğer `.ifo`/`.mfo` dosyaları
   - Geri dönüşüm (round-trip) testi yok.
3. **Zindanlar yok.**
   - Map.pk2'deki `0/` ve `1/` klasörlerindeki 5 farklı boyutlu `.m` dosyası (136.128 / 137.128 byte) atlandı.
   - Data.pk2'deki zindan verileri hiç incelenmedi.
4. **Zemin keskin değil.**
   - Colormap, 16×16'ya küçültülmüş dokulardan 256×256 çözünürlükte üretildi.
   - Doku tekrar periyodu tahmini (4 hücre).
   - Doku indeksindeki üst 6 bit (ölçek) kullanılmadı.
   - Sonuç: yakından bakınca bulanık ve grenli.
5. **`light` byte'ının anlamı çözülmedi.** Değerlerin yarısı 0, render'da kullanılmıyor.
6. **Gerçek 3D modeller yok.** `.bsr/.bms/.bmt/.ddj` (Data.pk2) dönüştürülmedi, objeler kutu olarak çiziliyor.
7. **Navmesh / çarpışma yok.**
8. **Ortam yok:** environment.ifo (sis, ışık, gökyüzü), Media.pk2 minimap'leri.
9. **`index.html` entegrasyonu yapılmadı** (bilerek dokunulmadı).

---

## 3. Ortam notları (sonraki ajan için kritik)

- **Python:** `C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe`. Düz `python` komutu WindowsApps stub'ına gidiyor ve "Python bulunamadı" hatası veriyor.
- **Kurulu paketler:** numpy 2.5.3, pillow 12.3.0, pycryptodomex 3.23.0 (`from Cryptodome.Cipher import Blowfish`). Node.js yok.
- **Diğer PK2'ler** (`C:\Silkroad\Silkroad_V2\extracted\client\`):
  - `Data.pk2` (3,1 GB)
  - `Media.pk2` (879 MB)
  - `Particles.pk2` (175 MB)
  - `Music.pk2` (72 MB)
  - Aynı `pk2.py` ile açılabilmeleri bekleniyor (doğrulanmadı).
- **Sunucu:** `BASLAT_SILKROAD.bat` → `http://localhost:5050/3d/` = `silkroad_3d\`. Test için yerine `python -m http.server` (`silkroad_3d` içinde) kullanılabilir.
- **Geçici test scriptleri:** `C:\Users\Administrator\.gemini\antigravity\brain\61c93465-58d3-473c-bf30-cf1baee5189a\scratch\`
  - `scan_test.py`
  - `format_test.py`
  - `format_test2.py`
  - `verify_out.py`: obje/arazi uyum testi
