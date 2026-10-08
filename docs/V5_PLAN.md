# Silkroad: Convoy Wars — V5 planı

V5'in amacı oyunu **tamamen kendi içeriğimizle** çalışır hale getirmek: Joymax/Silkroad Online
dosyalarına (harita, model, doku, müzik, ses, karakter) hiçbir bağımlılık kalmaz. Böylece oyunun
tamamı (istemci) paketlenip dağıtılabilir, internetten oynayan arkadaş her yeri görür, lisans sorunu
olmaz. Dünya Silkroad'dan *esinlenir* (aynı şehir adları ve kültürleri, tarihi İpek Yolu), ama her şey
kodla ya da bizim araçlarımızla üretilir.

## Sürümleme

- Sürüm istemcide `src/version.js`, sunucuda `server/server.py` içindedir (5.0.0'dan başladı).
  **Her değişiklikte minör sürüm bir artar** (5.1.0, 5.2.0 …): `python tools/bump.py` ikisini
  birlikte yükseltir; `tests/version.test.mjs` eşitliği denetler.
- İstemci ve sunucu sürümü birebir aynı değilse sunucu girişi reddeder ("sürüm uyuşmuyor").

## İstemci / sunucu

- İstemci (kök: `index.html`, `src/`, `vendor/`, `content/`): oyun. `tools/build_client.py` ile tek
  bir `.exe` olarak paketlenir (içinde oyun dosyaları; Windows'un kendi Edge tarayıcısı uygulama
  penceresi olarak kullanılır, ek kurulum yok). GitHub Releases'te yayınlanır.
- `server/`: çok oyunculu sunucu (oda, mesaj aktarımı, sürüm denetimi, tünel). Oyun dosyası sunmaz
  (`--client` ile geliştirme/yerel ağ için sunabilir).
- Her mod çok oyunculu: serbest sürüş, ralli, yarış, (ileride) yaya ve FPS/TPS.

## Aşamalar

1. **Kendi dünyamız** (öncelik)
   - Arazi üreticisi: sabit tohumlu gürültü + elle tasarlanmış özellikler (şehir düzlükleri, yollar,
     nehirler, deniz, Pamir benzeri sıradağ, Roc Dağı). Motorun bölge/akış/çarpışma kodu korunur,
     yalnız veri kaynağı değişir.
   - Zemin ve yapı dokuları: `tools/gen/textures.py` (kendini tekrar eden, gürültü tabanlı).
   - Yapılar kodla: kültüre göre evler (Çin, çöl kerpici, Fars kubbeleri, Bizans, Mısır), içine
     girilebilen kaleler (açık kapılar, avlular), surlar, kuleler, köprüler, iskeleler.
   - Bitki ve kayalar kodla: palmiye, kavak, servi, çam, söğüt, çalı; mantar kayalar, mesalar.
   - Çarpışma görüntüyle aynı geometriden: "boşlukta takılma" olmaz.
2. **Ulaşım**: şehirler arası ışınlanma kapıları; nehir/deniz geçişlerinde araç gemileri (feribot);
   Roc Dağı'na kuşların taşıdığı gemiler (bekler, üstüne çıkılır); Hotan–Semerkant arası açık dağ
   yolu ve tünel.
3. **Harita**: M ile büyük dünya haritası (üretilen dünyadan çizilir), mini harita.
4. **Ses**: üretken müzik (şehre göre makam/çalgı), sentezlenmiş efektler.
5. **Çok oyunculu her şey**: serbest sürüş dahil tüm modlar odada; sürüm denetimi.
6. **Paketleme**: tek exe istemci + GitHub Release.
7. **Sonrası** (kullanıcı ileride isteyecek): araçtan inme, yürüme/koşma, karakter düzenleme,
   FPS/TPS (PUBG benzeri oynanış), hikâye.

## Dünya ölçeği

Bölge 192 m. Dünya 80 × 40 bölge (yaklaşık 15 × 7,7 km). Doğudan batıya: Jangan → (nehir, feribot)
→ Donwhang → Hotan → (sıradağ: geçit yolu + tünel; kuzeyde Roc Dağı) → Semerkant → Konstantiniyye
(boğaz, feribot) ; Konstantiniyye'nin güneyindeki limandan gemiyle İskenderiye.
