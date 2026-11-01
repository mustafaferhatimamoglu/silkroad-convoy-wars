// 3d_ekonomi_sistemi_geliştirme_v3.js

class EkonomiManager {
  constructor() {
    this.kaynaklar = {};
    this.fiyatlar = {};
    this.doviz = 1000; // Örnek olarak 1000 döviz
  }

  yarat() {
    return this;
  }

  kaynakEkle(kaynakAdi, miktar) {
    if (!this.kaynaklar[kaynakAdi]) {
      this.kaynaklar[kaynakAdi] = new Kaynak(kaynakAdi, miktar);
    } else {
      this.kaynaklar[kaynakAdi].guncelle(miktar);
    }
  }

  fiyatGuncelle(kaynakAdi, yeniFiyat) {
    this.fiyatlar[kaynakAdi] = yeniFiyat;
  }

  sat(kaynakAdi, miktar) {
    if (this.kaynaklar[kaynakAdi]) {
      const sattikDoviz = miktar * this.fiyatlar[kaynakAdi];
      this.kaynaklar[kaynakAdi].sat(miktar);
      this.doviz += sattikDoviz;
    }
  }

  satmak(kaynakAdi, miktar) {
    if (this.doviz >= miktar * this.fiyatlar[kaynakAdi]) {
      this.doviz -= miktar * this.fiyatlar[kaynakAdi];
      this.kaynaklar[kaynakAdi].satmak(miktar);
    }
  }
}

class Kaynak {
  constructor(ad, miktar) {
    this.ad = ad;
    this.miktar = miktar;
    this.fiyat = 1; // Örnek olarak her kaynak 1 döviz fiyatı
  }

  guncelle(miktar) {
    this.miktar += miktar;
  }

  sat(miktar) {
    if (this.miktar >= miktar) {
      this.miktar -= miktar;
    }
  }

  satmak(miktar) {
    this.miktar += miktar;
  }
}

class SimyaVeZerkManager {
  constructor() {
    this.simya = new Kaynak("Simya", 0);
    this.zerk = new Kaynak("Zerk", 0);
  }

  guncelleSimya(miktar) {
    this.simya.guncelle(miktar);
  }

  guncelleZerk(miktar) {
    this.zerk.guncelle(miktar);
  }

  simyaSat(miktar) {
    this.simya.sat(miktar);
  }

  simyaSatmak(miktar) {
    this.simya.satmak(miktar);
  }

  zerkSat(miktar) {
    this.zerk.sat(miktar);
  }

  zerkSatmak(miktar) {
    this.zerk.satmak(miktar);
  }
}

function ekonomiInitialize() {
  ekonomi = new EkonomiManager().yarat();
  ekonomi.kaynakEkle("Simya", 100);
  ekonomi.kaynakEkle("Zerk", 50);
  ekonomi.fiyatGuncelle("Simya", 2);
  ekonomi.fiyatGuncelle("Zerk", 3);
}

function ekonomiYarat() {
  ekonomiInitialize();
}

function kaynakEkle(kaynakAdi, miktar) {
  ekonomi.kaynakEkle(kaynakAdi, miktar);
}

function fiyatGuncelle(kaynakAdi, yeniFiyat) {
  ekonomi.fiyatGuncelle(kaynakAdi, yeniFiyat);
}

function sat(kaynakAdi, miktar) {
  ekonomi.sat(kaynakAdi, miktar);
}

function satmak(kaynakAdi, miktar) {
  ekonomi.satmak(kaynakAdi, miktar);
}

function guncelleSimya(miktar) {
  simyaVeZerkManager.guncelleSimya(miktar);
}

function guncelleZerk(miktar) {
  simyaVeZerkManager.guncelleZerk(miktar);
}

function simyaSat(miktar) {
  simyaVeZerkManager.simyaSat(miktar);
}

function simyaSatmak(miktar) {
  simyaVeZerkManager.simyaSatmak(miktar);
}

function zerkSat(miktar) {
  simyaVeZerkManager.zerkSat(miktar);
}

function zerkSatmak(miktar) {
  simyaVeZerkManager.zerkSatmak(miktar);
}

// Başlangıçta ekonomi sistemini başlat
ekonomiYarat();