# SİLKROAD V2 — OYUN GELİŞTİRME VE MİMARİ PLANI

Bu doküman, Silkroad Online V2 oyununun geliştirilmesinde izlenecek otonom mimariyi, test odaklı (TDD) disiplini ve aşamaları tanımlar.

---

## 1. Temel Kurallar ve Güvenlik Protokolü
1. **[C:\Rules.md] Zaman Aşımı:** Tüm testler ve Ollama API çağrıları maksimum 30 saniye süre sınırı ile çalıştırılır. Askıda kalma ve sonsuz döngü engellenmiştir.
2. **[C:\Rules.md] Sıfır Maliyet:** Geliştirme sürecindeki tüm kod üretimleri ve test analizleri yerel RTX 5060 Ollama (`huihui_ai/qwen2.5-coder-abliterate:7b` - 0 USD) ve ücretsiz kotalar üzerinden yürütülür.
3. **[SALT-OKUNUR KORUMASI] `extracted/` İzolasyonu:**
   - `C:\Silkroad\Silkroad_V2\extracted\` dizinindeki tüm orijinal istemci ve PK2 arşivleri (`Data.pk2`, `Media.pk2` vb.) kesinlikle **SALT-OKUNUR (READ-ONLY)** kabul edilir.
   - Geliştirme motoru bu dosyaları asla değiştirmez veya üzerine yazmaz; yalnızca referans ve varlık okuyucusu olarak kullanır.
4. **Test-Odaklı Geliştirme (TDD):**
   - Her modül geliştirilmeden önce veya geliştirilirken birim testi (`tests/test_*.py`) yazılır.
   - `pytest` tüm testleri %100 onaylamadan kod Git'e commit edilmez ve aşama tamamlandı sayılmaz.
   - Hata durumunda Ollama azami 3 kez kendi kodunu düzeltmeyi dener; çözülemezse mimara eskalasyon yapar.

---

## 2. Dizin Yapısı ve Modüler Mimari
```
C:\Silkroad\Silkroad_V2\
├── extracted\                  [SALT-OKUNUR ORİJİNAL KAYNAK / ASLA DEĞİŞTİRİLMEZ]
│   └── client\                 (Data.pk2, Media.pk2, sro_client.exe vb.)
├── src\                        [YENİ OYUN MOTORU VE KOD TABANI]
│   ├── engine\                 (3D WebGL / Three.js sahnesi, kamera, döngü)
│   ├── gameplay\               (Karakter, envanter, simya, kervan, dövüş)
│   ├── network\                (Protokol ayrıştırıcı, paket yapıları)
│   ├── ui\                     (HUD, can/mana küreleri, zerk göstergesi, harita)
│   └── assets\                 (Ayrıştırılmış ve optimize edilmiş modeller/dokular)
├── tests\                      [OTOMATİK TEST SUİTİ]
│   ├── test_readonly_guard.py
│   ├── test_character.py
│   ├── test_inventory.py
│   ├── test_alchemy.py
│   ├── test_caravan.py
│   └── test_combat.py
├── tools\                      [YARDIMCI ARAÇLAR]
│   └── pk2_reader.py           (Salt-okunur PK2 okuma motoru)
├── reports\                    (Geriye dönük analizler ve şemalar)
├── .gitignore                  (5GB ikili dosyaları hariç tutan repo kuralı)
├── ollama_dev_loop.py          (TDD Otonom Geliştirme Yürütücüsü)
└── START_OLLAMA_DEV.bat        (Geliştirme Döngüsü Başlatıcısı)
```

---

## 3. Geliştirme Fazları ve Test Hedefleri

### Faz 1: Karakter & Stat Sistemi (`src/gameplay/character.py`)
- Seviye 1-120 EXP eğrisi, STR ve INT puan dağılımı.
- Fiziksel/Büyüsel saldırı gücü ve savunma hesabı, Can (HP) ve Mana (MP) havuzları.
- **Doğrulama Testi:** `tests/test_character.py`

### Faz 2: Envanter & Simya (Alchemy) Motoru (`src/gameplay/inventory.py` & `alchemy.py`)
- Slotlu envanter (silah, zırh, takı, potlar).
- Elixir ve Lucky Powder ile +1'den +12'ye güçlendirme olasılık matriksi.
- Silah parlama (glow) ve stat artış hesaplamaları.
- **Doğrulama Testi:** `tests/test_inventory.py` ve `tests/test_alchemy.py`

### Faz 3: Kervan Ticaret ve Meslek Sistemi (`src/gameplay/caravan.py`)
- Jangan, Donwhang, Hotan arası kervan rotaları ve mal alım-satım kâr marjları.
- Kervan araçları (Deve, At) canı, yük kapasitesi ve hareket hızı.
- Hırsız (Thief) pusu mekaniği ve Avcı (Hunter) koruma desteği.
- **Doğrulama Testi:** `tests/test_caravan.py`

### Faz 4: Dövüş, Ustalık (Mastery) & Berserker (`src/gameplay/combat.py`)
- Bicheon, Heuksal, Pacheon ve Büyü ustalıkları (Buz, Şimşek, Ateş).
- Kritik vuruş, bloklama ve hasar formülleri.
- Berserker küresi dolumu ve Zerk aktifleştiğinde %100 hız/hasar artışı.
- **Doğrulama Testi:** `tests/test_combat.py`

### Faz 5: Salt-Okunur PK2 Varlık Köprüsü (`tools/pk2_reader.py`)
- `extracted/client/` altındaki PK2 arşivlerini salt-okunur modda tarama.
- Varlıkları yeni oyun projesine dönüştürerek aktarma.
- **Doğrulama Testi:** `tests/test_pk2_readonly.py`

### Faz 6: 3D WebGL / Three.js İstemcisi (`src/engine/index.html` & `engine.js`)
- Üçüncü şahıs arkadan takip kamerası, 3D vaha ve otoyol haritası.
- Silkroad HUD: Kırmızı/Mavi can küreleri, Berserker göstergesi, mini harita.
- **Doğrulama Testi:** `tests/test_webgl_engine.py`

---

## 4. Otonom Döngü Algoritması (Ollama TDD Loop)
```
[Şef Ollama: Sıradaki Modülü Seç]
         │
         ▼
[Geliştirici Ollama: Kodu & Testi Üret]
         │
         ▼
[Sistem: Pytest Koş (Timeout: 10s)]
         │
    ┌────┴────┐
    ▼         ▼
[BAŞARILI]  [BAŞARISIZ]
    │         │
    │         ├──► [Ollama: Hatayı İncele & Düzelt (Maks 3 Deneme)]
    │         └──► [3 Başarısızlık: Mimara Eskalasyon & Dur]
    ▼
[Git Otomatik Commit: "feat(modul): ..."]
         │
         ▼
[Durumu task_state.json Dosyasına Yaz]
         │
         ▼
[%100 Tamamlanana Kadar Sıradaki Modüle Geç]
```
