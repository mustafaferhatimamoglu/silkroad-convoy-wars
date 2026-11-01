class SavaşAnimasyon {
  constructor() {
    this.durum = 'DURDU';
  }

  başlat() {
    this.durum = 'BAŞLADI';
    console.log('Savaş animasyonu başladı');
  }

  durdur() {
    this.durum = 'DURDU';
    console.log('Savaş animasyonu durdu');
  }

  bekle() {
    this.durum = 'BEKLEDİ';
    console.log('Savaş animasyonu bekliyor');
  }

  yolcuGüncelle(yolcu) {
    console.log(`Yolcu ${yolcu} güncellendi`);
  }

  saldırıYap(hedef) {
    console.log(`Savaş animasyonu ${hedef} üzerinde saldırı yaptı`);
  }

  hedefAyarla(target) {
    console.log(`Savaş animasyonu hedefi ${target} olarak ayarladı`);
  }
}

class SavaşÇatışması {
  constructor(korsan, hedef) {
    this.korsan = korsan;
    this.hedef = hedef;
    this.durum = 'DURDU';
  }

  başlat() {
    this.durum = 'BAŞLADI';
    console.log('Savaş çatışması başladı');
  }

  durdur() {
    this.durum = 'DURDU';
    console.log('Savaş çatışması durdu');
  }

  kazananBelirle() {
    // Kazanan belirlenir ve ödüller verilir
    console.log('Savaş çatışması kazanan belirlendi');
  }

  kazananÖdülleriVer() {
    console.log('Kazanan ödüller verildi');
  }
}

class SavaşSahnesi {
  constructor(sahneAdı) {
    this.sahneAdı = sahneAdı;
  }

  sahneYükle() {
    console.log(`${this.sahneAdı} sahnesi yüklendi`);
  }

  sahneGüncelle() {
    console.log(`${this.sahneAdı} sahnesi güncellendi`);
  }

  sahneKapat() {
    console.log(`${this.sahneAdı} sahnesi kapandı`);
  }
}

class SavaşEskişehir {
  constructor(eskişehirAdı) {
    this.eskişehirAdı = eskişehirAdı;
  }

  eskişehirYükle() {
    console.log(`${this.eskişehirAdı} eskişehir yüklendi`);
  }

  eskişehirGüncelle() {
    console.log(`${this.eskişehirAdı} eskişehir güncellendi`);
  }

  eskişehirKapat() {
    console.log(`${this.eskişehirAdı} eskişehir kapandı`);
  }
}

function savaşAnimasyonlarıYükle() {
  // Tüm savaş dinamikleri animasyonlarını yükler
  console.log('Savaş animasyonları yüklendi');
}

function savaşÇatışmalarıYükle() {
  // Tüm savaş dinamikleri çatışmalarını yükler
  console.log('Savaş çatışmaları yüklendi');
}

function savaşSahneleriYükle() {
  // Tüm savaş dinamikleri sahnelerini yükler
  console.log('Savaş sahneleri yüklendi');
}

function savaşEskişehirleriYükle() {
  // Tüm savaş dinamikleri eskişehirlerini yükler
  console.log('Savaş eskişehirleri yüklendi');
}

// Değişkenler
const savaşAnimasyonları = [];
const savaşÇatışmaları = [];
const savaşSahneleri = [];
const savaşEskişehirleri = [];