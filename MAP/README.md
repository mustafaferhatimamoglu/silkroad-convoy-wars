# Silkroad MAP — Map.pk2'den dönüştürülmüş dünya verisi

Kaynak: `C:\Silkroad\Silkroad_V2\extracted\client\Map.pk2`
Araçlar: `C:\Silkroad\Silkroad\tools\map_export\` (yeniden üretmek için aşağıya bakın)

## Hızlı test

Sunucu çalışırken (BASLAT_SILKROAD.bat) tarayıcıda açın:

```
http://localhost:5050/3d/MAP/viewer.html
```

Mini haritaya tıklayınca ışınlanırsınız, WASD ile gezersiniz (Shift = hızlı).

## Oyuna entegrasyon (Three.js r128)

```html
<script src="MAP/SilkroadMap.js"></script>
<script>
  const silkMap = new SilkroadMap(scene, { baseUrl: 'MAP/', scale: 0.1, viewRadius: 2 });
  silkMap.init().then(() => {
    // Jangan'ın merkezine ışınla
    vehiclePos.copy(silkMap.regionCenter(168, 97));
  });

  // oyun döngüsünde:
  silkMap.update(vehiclePos);                       // çevredeki bölgeleri yükler/boşaltır
  const y = silkMap.getHeightAt(vehiclePos.x, vehiclePos.z);
  if (y !== null) vehiclePos.y = y;                 // aracı zemine oturt
</script>
```

| Seçenek | Varsayılan | Açıklama |
|---|---|---|
| `scale` | `0.1` | 1 Silkroad birimi → Three.js birimi (bölge = 192 birim) |
| `origin` | Jangan `{x:168,z:97}` | Three.js (0,0,0) noktası olacak bölge |
| `viewRadius` / `keepRadius` | `2` / `3` | Yükleme / boşaltma yarıçapı (bölge) |
| `colormap`, `water`, `objects` | `true` | Katmanları aç/kapat |

Diğer API: `toThree(rx,rz,lx,y,lz)`, `fromThree(x,z)`, `regionCenter(rx,rz)`, `hasRegion(rx,rz)`, `onRegionLoaded = (key, reg) => {}`.

## Klasör yapısı

| Yol | İçerik |
|---|---|
| `world.json` | Manifest: tüm bölgeler, sınırlar, koordinat sistemi, `.bin` yerleşimi |
| `regions/{z}_{x}.bin` | Bölge arazi verisi (4590 adet, 84.508 byte) |
| `colormaps/{z}_{x}.jpg` | Bölgenin zemin dokularından "bake" edilmiş renk haritası (256×256, üst = kuzey) |
| `objects/{z}_{x}.json` | Bölgedeki obje yerleşimleri (bina, ağaç, kaya… 77.284 obje) |
| `objects/models.json` | Model indexi → `Data.pk2` içindeki `.bsr` yolu |
| `textures/tile2d/*.jpg` | 719 orijinal zemin dokusu (512×512) |
| `textures/tiles.json` | Doku indexi → dosya, bölge adı, ortalama renk |
| `preview/world_color.jpg` | Tüm dünya önizlemesi (bölge başına 16 px, üst = kuzey) |
| `preview/world_height16.png` | 16-bit yükseklik haritası (aralık: `world.json → preview.heightRange`) |
| `preview/region_mask.png` | Hangi bölgelerin var olduğu |

## Koordinat sistemi

- Dünya 1920×1920 birimlik **bölgelere** bölünür. Bölge ID = `(z << 8) | x` (örn. Jangan = 25000 = `97_168`).
- Her bölge 96×96 hücre (hücre = 20 birim), **97×97 vertex**.
- Silkroad dünya koordinatı: `WX = x*1920 + localX`, `WZ = z*1920 + localZ`, Y yukarı, Z kuzey (sol el).
- Three.js'e geçerken Z ters çevrilir: `threeZ = -WZ` (ayna görüntüsü olmaması için), obje yaw → `rotation.y = -yaw`.

## `regions/*.bin` formatı (little-endian)

Header (32 byte): `char[4] "SRMP"`, `u16 version`, `u16 regionId`, `u8 x`, `u8 z`, `u16 verts(97)`, `f32 minH`, `f32 maxH`.

| Alan | Tip | Adet | Açıklama |
|---|---|---|---|
| `height` | float32 | 97×97 | Satır-major `[z][x]`, satır 0 = güney kenarı |
| `texture` | uint16 | 97×97 | Alt 10 bit = `tiles.json` indexi, üst 6 bit = doku ölçeği |
| `light` | uint8 | 97×97 | Orijinal vertex parlaklık/gölge değeri |
| `cellFlags` | uint16 | 96×96 | Orijinal hücre bilgisi (ham) |
| `waterType` | uint8 | 6×6 | Blok başına su tipi, `255` = su yok |
| `waterHeight` | float32 | 6×6 | Blok başına su yüksekliği |

Byte offset'leri `world.json → binLayout.fields` içinde; JS'de doğrudan `new Float32Array(buf, offset, count)` ile okunur.

## `objects/*.json`

```json
{ "region": 25000, "fields": ["model","x","y","z","yaw","uid","static"], "objects": [[702, 860.6, -1.76, 1764.4, 0, 43009, 65535], ...] }
```
`x,y,z` bölge-yerel koordinattır, `model` → `models.json`. Şu an yükleyici objeleri **yer tutucu kutu** olarak çizer;
gerçek 3D modeller `Data.pk2` içindeki `.bsr/.bms/.ddj` dosyalarıdır (sonraki adım: glTF'e dönüştürme).

## Yeniden üretme

```powershell
cd C:\Silkroad\Silkroad\tools\map_export
python extract_pk2.py   # Map.pk2 -> C:\Silkroad\Silkroad_V2\extracted\Map_raw  (ham dosyalar)
python convert_map.py   # Map_raw -> silkroad_3d\MAP   (--colormap 512 ile daha keskin zemin)
```

## Bilinen sınırlamalar

- Zindan/iç mekân haritaları (`.m` boyutu farklı olan 5 dosya, `0/` ve `1/` klasörleri) ve navmesh dahil değil.
- Colormap ortalama/küçültülmüş dokudan üretilir; yakın plan detay için `textures/tile2d` + `texture` indexi ile shader tabanlı splatting yapılabilir.
