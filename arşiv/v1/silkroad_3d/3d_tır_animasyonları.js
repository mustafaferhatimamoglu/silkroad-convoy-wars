// Değişkenler
var tır_modelleri = [];
var animasyonlar = [];
var tır_hareketleri = [];
var kamera_kontrolleri = [];
var sesler = [];
var kervan_dinamikleri = [];
var savaş_dinamikleri = [];
var level_dinamikleri = [];

// Sınıflar
class TırModel {
  constructor(model) {
    this.model = model;
  }
  
  // Tır modeline özel fonksiyonlar
  render() {
    // Modeli render etme kodu
  }
}

class Animasyon {
  constructor(animasyon_adi) {
    this.animasyon_adi = animasyon_adi;
  }
  
  // Animasyona özgü fonksiyonlar
  start() {
    // Animasyonu başlatma kodu
  }
}

class TırHareketi {
  constructor(hareket_adi) {
    this.hareket_adi = hareket_adi;
  }
  
  // Tır hareketine özgü fonksiyonlar
  perform() {
    // Hareketi gerçekleştiren kod
  }
}

class KameraKontrolu {
  constructor(kamera_tipi) {
    this.kamera_tipi = kamera_tipi;
  }
  
  // Kamera kontrolüne özgü fonksiyonlar
  update() {
    // Kamerayı güncelleme kodu
  }
}

class Ses {
  constructor(ses_adi) {
    this.ses_adi = ses_adi;
  }
  
  // Seslere özgü fonksiyonlar
  play() {
    // Sesi oynatma kodu
  }
}

class KervanDinamikleri {
  constructor(dinamik_adi) {
    this.dinamik_adi = dinamik_adi;
  }
  
  // Kervan dinamiklerine özgü fonksiyonlar
  update() {
    // Kervanın dinamiklerini güncelleme kodu
  }
}

class SavaşDinamikleri {
  constructor(dinamik_adi) {
    this.dinamik_adi = dinamik_adi;
  }
  
  // Savaş dinamiklerine özgü fonksiyonlar
  update() {
    // Savaşın dinamiklerini güncelleme kodu
  }
}

class LevelDinamikleri {
  constructor(dinamik_adi) {
    this.dinamik_adi = dinamik_adi;
  }
  
  // Level dinamiklerine özgü fonksiyonlar
  update() {
    // Level dinamiklerini güncelleme kodu
  }
}

// Fonksiyonlar
function yeni_tır_modeli_ekle(model) {
  tır_modelleri.push(new TırModel(model));
}

function yeni_animasyon_ekle(animasyon_adi) {
  animasyonlar.push(new Animasyon(animasyon_adi));
}

function yeni_tır_hareketi_ekle(hareket_adi) {
  tır_hareketleri.push(new TırHareketi(hareket_adi));
}

function yeni_kamera_kontrolu_ekle(kamera_tipi) {
  kamera_kontrolleri.push(new KameraKontrolu(kamera_tipi));
}

function yeni_ses_ekle(ses_adi) {
  sesler.push(new Ses(ses_adi));
}

function yeni_kervan_dinamikleri_ekle(dinamik_adi) {
  kervan_dinamikleri.push(new KervanDinamikleri(dinamik_adi));
}

function yeni_savaş_dinamikleri_ekle(dinamik_adi) {
  savaş_dinamikleri.push(new SavaşDinamikleri(dinamik_adi));
}

function yeni_level_dinamikleri_ekle(dinamik_adi) {
  level_dinamikleri.push(new LevelDinamikleri(dinamik_adi));
}

// Örnek kullanım
yeni_tır_modeli_ekle('Tır Model 1');
yeni_animasyon_ekle('Animasyon 1');
yeni_tır_hareketi_ekle('Hareket 1');
yeni_kamera_kontrolu_ekle('TPS Kamera');
yeni_ses_ekle('Ses 1');
yeni_kervan_dinamikleri_ekle('Kervan Dinamik 1');
yeni_savaş_dinamikleri_ekle('Savaş Dinamik 1');
yeni_level_dinamikleri_ekle('Level Dinamik 1');