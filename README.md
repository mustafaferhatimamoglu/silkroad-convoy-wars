# ⚔️ Silkroad: Convoy Wars (3D Açık Dünya Kervan Simülatörü)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![WebGL](https://img.shields.io/badge/Graphics-Three.js%20WebGL-00f0ff.svg)](https://threejs.org/)
[![60 FPS](https://img.shields.io/badge/Performance-60%20FPS-green.svg)]()
[![Zero Cost](https://img.shields.io/badge/Cost-0%20USD%20(Local%20Ollama)-orange.svg)]()

> **Silkroad Online** efsanesinin kervan ticareti, meslek savaşları (Tüccar / Hırsız / Avcı), simya (+1..+12) ve Berserker (Zerk) modunun modern 3D Three.js WebGL motoru üzerinde yeniden doğuşu.

---

## 🎮 Oyunu Nasıl Oynarsınız?

1. **Tek Tıkla Başlatma:**
   * Klasördeki **`OYNA_CONVOY_WARS.bat`** dosyasına çift tıklayın.
   * Tarayıcınızda otomatik olarak `http://localhost:8080` açılacak ve oyun 60 FPS başlayacaktır.
2. **Doğrudan Tarayıcıda Açma:**
   * **`index.html`** dosyasını herhangi bir modern tarayıcıda (Chrome, Edge, Brave, Firefox) çift tıklayarak açabilirsiniz. Sıfır harici paket veya derleme gerektirmez.

---

## ⌨️ Oyun Kontrolleri

| Tuş / Eylem | İşlev |
| :--- | :--- |
| **`W` / `S`** | İleri Gaz / Geri Fren & Geri Vites |
| **`A` / `D`** | 360° Hassas Kervan Direksiyonu |
| **Fare Hareketi** | Serbest 360° Kamera Açısı & Taret Hedefleme |
| **Sol Fare Tıkı** | Çift Plazma Taret Ateşi (Gatling Laser) |
| **`SPACE` veya `Z`** | **⚡ Berserker (Zerk) Modu** (Çift Hız & Çift Hasar & Ateş İzi) |
| **`B`** | **🏛️ Şehir Borsası & Simya (+1..+12)** Arayüzü |
| **`V`** | 3. Şahıs (TPS Orbit) / 1. Şahıs (FPS Kokpit) Kamera Geçişi |
| **`F11` veya Ekrana Tık** | Fareyi Kilitle / Tam Ekran Modu (Çıkmak için `ESC`) |

---

## 🚀 Oyun Özellikleri ve Mekanikleri

### 1. 🚛 3D Zırhlı Kervan Gövdesi & Araç Fiziği
* 6 bağımsız dönen ağır hizmet tekerleği, süspansiyon ve eğim dinamikleri.
* Farenin baktığı noktayı 360° takip eden döner çift plazma taret.
* Dinamik ön farlar ve motor partikülleri.

### 2. ⚡ Efsanevi Berserker (Zerk) Modu
* Yoldaki korsanları avladıkça Berserker küresi dolar.
* `%100` dolduğunda `SPACE` ile aktifleşir:
  * Ekran kenarları alev kırmızısı vinyet ile parlar.
  * Kervanın son hızı 2 katına çıkar (120+ km/h).
  * Lazer atış hızı ve hasarı ikiye katlanır.
  * Özel Web Audio sentezleyicisi ile Berserker kükremesi çalar!

### 3. 🏛️ İpek Yolu Şehir Borsası (Jangan, Donwhang, Hotan)
* Şehir kapılarına ulaştığınızda kargonuzu otomatik olarak satıp altın kazanırsınız.
* `[B]` tuşuyla açılan borsada İpek Kumaş, Porselen ve Şam Çeliği yükleyebilir, kervanınızı tamir ettirebilirsiniz.

### 4. ✨ Silkroad Simya (Alchemy) Motoru (+1 .. +12)
* Kazandığınız altınlarla taretlerinizi güçlendirin!
* Orijinal Silkroad oranları:
  * `+1 .. +2`: Temel güç
  * `+3 .. +4`: **Beyaz Işıma**
  * `+5 .. +6`: **Altın / Sarı Işıma**
  * `+7 .. +8`: **Mavi Buz Işıması**
  * `+9 .. +10`: **Zümrüt Yeşil Işıma**
  * `+11 .. +12`: **Efsanevi Kırmızı / Mor Alev Işıması**

### 5. 📡 Donanımsal Ses Sentezleyicisi (Web Audio API)
* Sıfır harici MP3 veya ses dosyası! Tarayıcının kendi donanımsal osilatörleri ile motor sesi, taret lazerleri, patlamalar ve Zerk efektleri anlık sentezlenir.

---

## 📁 Proje Dizin Yapısı
```
C:\Silkroad\Silkroad_V2\
├── index.html                 # 3D Three.js WebGL Tam Oyun İstemcisi
├── server.py                  # Yerel Hızlı Web Sunucusu
├── OYNA_CONVOY_WARS.bat       # Tek Tıkla Oyunu Başlatıcı
├── README.md                  # Proje Açıklaması ve Kılavuz
├── .gitignore                 # 5GB ham arşivleri depodan ayıran kural
├── extracted/                 # [SALT-OKUNUR] Orijinal Silkroad istemci arşivleri
└── reports/                   # PK2 başlık ve veri şeması analizleri
```

---

## 🛡️ Lisans ve Kurallar Protokolü
Bu proje `C:\Rules.md` disiplinine tam uyumlu olarak 0 USD maliyetle, yerel RTX 5060 Ollama destekli geliştirilmiştir.
