class Kervan {
  constructor(model, tahsisat, ticariIslemler) {
    this.model = model;
    this.tahsisat = tahsisat;
    this.ticariIslemler = ticariIslemler;
  }

  hareketEt() {
    // Kervanın hareket etme mantığı
    console.log("Kervan hareket ediyor.");
  }

  animasyonGoster() {
    // Kervanın animasyonlarını gösterme mantığı
    console.log("Kervan animasyonları gösteriliyor.");
  }

  tasarrufYap() {
    // Kervanın tasarruf yapma mantığı
    console.log("Kervan tasarruf yapılıyor.");
  }

  ticaretYap() {
    // Kervanın ticaret yapma mantığı
    console.log("Kervan ticaret yapılıyor.");
  }
}

class Tahsisat {
  constructor(uretim, tasarruf) {
    this.uretim = uretim;
    this.tasarruf = tasarruf;
  }

  optimize() {
    // Tahsisatın optimize edilmesi
    console.log("Tahsisat optimize ediliyor.");
  }
}

class TicariIslemler {
  constructor(satim, satin Alma) {
    this.satim = satim;
    this.satın Alma = satın Alma;
  }

  fiyatlama() {
    // Ticari işlemlerin fiyatlama işlemi
    console.log("Ticari işlemler fiyatlama işlemi gerçekleştiriliyor.");
  }

  stokYonetimi() {
    // Ticari işlemlerin stok yönetimi
    console.log("Ticari işlemler stok yönetimi gerçekleştiriliyor.");
  }
}

class ThirdPersonCamera {
  constructor(kameraKonumu, hedef) {
    this.kameraKonumu = kameraKonumu;
    this.hedef = hedef;
  }

  konumuGuncelle() {
    // Kamera konumunu güncelleme mantığı
    console.log("Kamera konumu güncellendi.");
  }

  hedefAyarla() {
    // Kamera hedefini ayarlama mantığı
    console.log("Kamera hedefi ayarlandı.");
  }
}

class FPS_TPS_Kamera {
  constructor(kameraTipi, konumu) {
    this.kameraTipi = kameraTipi;
    this.konumu = konumu;
  }

  kamerayıHareketEttir() {
    // FPS/TPS kamerayı hareket ettirme mantığı
    console.log("FPS/TPS kamerası hareket ediyor.");
  }

  kamerayıDondur() {
    // FPS/TPS kamerayı döndürme mantığı
    console.log("FPS/TPS kamerası döndürüldü.");
  }
}

class Level {
  constructor(dinamikler, ekonomisi) {
    this.dinamikler = dinamikler;
    this.ekonomisi = ekonomisi;
  }

  oynat() {
    // Seviyanın oynatılması
    console.log("Seviye oynatılıyor.");
  }

  ekonomiYonetimi() {
    // Seviyenin ekonomi yönetimi
    console.log("Seviyenin ekonomisi yönetiliyor.");
  }
}

class Savaş {
  constructor(dinamikler, ekonomisi) {
    this.dinamikler = dinamikler;
    this.ekonomisi = ekonomisi;
  }

  devamEt() {
    // Savaşın devam etme mantığı
    console.log("Savaş devam ediyor.");
  }

  ekonomiYonetimi() {
    // Savaşın ekonomi yönetimi
    console.log("Savaşın ekonomisi yönetiliyor.");
  }
}

class Tcatışmalar {
  constructor(dinamikler, ekonomisi) {
    this.dinamikler = dinamikler;
    this.ekonomisi = ekonomisi;
  }

  devamEt() {
    // Tcatışmaların devam etme mantığı
    console.log("Tcatışmalar devam ediyor.");
  }

  ekonomiYonetimi() {
    // Tcatışmaların ekonomi yönetimi
    console.log("Tcatışmaların ekonomisi yönetiliyor.");
  }
}