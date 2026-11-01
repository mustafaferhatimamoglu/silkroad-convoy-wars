// tahsisat_3d_v2.js

class TahsisatManager {
  constructor() {
    this.tahsisatListesi = [];
    this.ekonomiSistemi = new EkonomiSistemi();
    this.kervanAnimasyonları = new KervanAnimasyonları();
  }

  tahsisatEkle(tahsisat) {
    this.tahsisatListesi.push(tahsisat);
  }

  tahsisatSil(tahsisatId) {
    this.tahsisatListesi = this.tahsisatListesi.filter(tahsisat => tahsisat.id !== tahsisatId);
  }

  tahsisatGüncelle(tahsisatId, yeniTahsisat) {
    const index = this.tahsisatListesi.findIndex(tahsisat => tahsisat.id === tahsisatId);
    if (index !== -1) {
      this.tahsisatListesi[index] = yeniTahsisat;
    }
  }

  tahsisatListesiGeriVer() {
    return this.tahsisatListesi;
  }
}

class EkonomiSistemi {
  constructor() {
    this.ekonomiDurumu = 0;
    this.kervanTicariIslemleri = [];
  }

  ticariIslemEkle(islem) {
    this.kervanTicariIslemleri.push(islem);
  }

  ticariIslemSil(islemId) {
    this.kervanTicariIslemleri = this.kervanTicariIslemleri.filter(islem => islem.id !== islemId);
  }

  ticariIslemGüncelle(islemId, yeniIslem) {
    const index = this.kervanTicariIslemleri.findIndex(islem => islem.id === islemId);
    if (index !== -1) {
      this.kervanTicariIslemleri[index] = yeniIslem;
    }
  }

  ekonomiDurumuGeriVer() {
    return this.ekonomiDurumu;
  }
}

class KervanAnimasyonları {
  constructor() {
    this.animasyonListesi = [];
    this.kervanModeli = null;
  }

  animasyonEkle(animasyon) {
    this.animasyonListesi.push(animasyon);
  }

  animasyonSil(animasyonId) {
    this.animasyonListesi = this.animasyonListesi.filter(animasyon => animasyon.id !== animasyonId);
  }

  animasyonGüncelle(animasyonId, yeniAnimasyon) {
    const index = this.animasyonListesi.findIndex(animasyon => animasyon.id === animasyonId);
    if (index !== -1) {
      this.animasyonListesi[index] = yeniAnimasyon;
    }
  }

  animasyonListesiGeriVer() {
    return this.animasyonListesi;
  }
}

// Örnek kullanım
const tahsisatManager = new TahsisatManager();
const ekonomiSistemi = tahsisatManager.ekonomiSistemi;
const kervanAnimasyonları = tahsisatManager.kervanAnimasyonları;

// Tahsisat ekleme
tahsisatManager.tahsisatEkle({ id: 1, ad: "Mekanik", miktari: 10 });

// Ticari işlem ekleme
ekonomiSistemi.ticariIslemEkle({ id: 1, miktar: 50, tarih: new Date() });

// Animasyon ekleme
kervanAnimasyonları.animasyonEkle({ id: 1, ad: "Gürültülü Kalkış", süresi: 10 });

// Tahsisat silme
tahsisatManager.tahsisatSil(1);

// Ticari işlem silme
ekonomiSistemi.ticariIslemSil(1);

// Animasyon güncelleme
kervanAnimasyonları.animasyonGüncelle(1, { id: 1, ad: "Gürültülü Kalkış", süresi: 15 });