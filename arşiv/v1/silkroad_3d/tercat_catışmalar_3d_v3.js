class TercatÇatışması {
  constructor(karakter, nesne, çatışmaNoktası, çatışmaTipi, havaKoşulları) {
    this.karakter = karakter;
    this.nesne = nesne;
    this.çatışmaNoktası = çatışmaNoktası;
    this.çatışmaTipi = çatışmaTipi;
    this.havaKoşulları = havaKoşulları;
  }

  çatışmayıYap() {
    // Çatışmayı gerçekleştirme kodu
  }

  çatışmayıBitir() {
    // Çatışmayı bitirme kodu
  }

  havaKoşullarınıGüncelle() {
    // Hava koşullarını güncelleme kodu
  }
}

class HavaKoşulları {
  constructor(havaDurumu, havaMiktarı, havaRüzgarı) {
    this.havaDurumu = havaDurumu;
    this.havaMiktarı = havaMiktarı;
    this.havaRüzgarı = havaRüzgarı;
  }

  güncelle() {
    // Hava koşullarını güncelleme kodu
  }

  durumuGetir() {
    return this.havaDurumu;
  }

  miktarıGetir() {
    return this.havaMiktarı;
  }

  rüzgarıGetir() {
    return this.havaRüzgarı;
  }
}

class Karakter {
  constructor(pozisyon, hız, animasyon) {
    this.pozisyon = pozisyon;
    this.hız = hız;
    this.animasyon = animasyon;
  }

  hareketEt() {
    // Karakteri hareket ettirme kodu
  }

  durma() {
    // Karakteri durdurma kodu
  }

  animasyonGüncelle() {
    // Animasyon güncelleme kodu
  }
}

class Nesne {
  constructor(pozisyon, hali, durum) {
    this.pozisyon = pozisyon;
    this.hali = hali;
    this.durum = durum;
  }

  hareketEt() {
    // Nesneyi hareket ettirme kodu
  }

  durma() {
    // Nesneyi durdurma kodu
  }

  haliGüncelle() {
    // Nesne halini güncelleme kodu
  }
}

let tercatÇatışmaları = [];
let havaKoşulları = new HavaKoşulları("iyi", 100, 0);
let karakterler = [];
let nesneler = [];

function çatışmayıYap(tercatÇatışması) {
  tercatÇatışması.çatışmayıYap();
}

function çatışmayıBitir(tercatÇatışması) {
  tercatÇatışması.çatışmayıBitir();
}

function havaKoşullarınıGüncelle() {
  havaKoşulları.güncelle();
  karakterler.forEach(karakter => karakter.animasyonGüncelle());
  nesneler.forEach(nesne => nesne.haliGüncelle());
}

function karakterHareketEt(karakter) {
  karakter.hareketEt();
}

function karakterDurma(karakter) {
  karakter.durma();
}

function nesneHareketEt(nesne) {
  nesne.hareketEt();
}

function nesneDurma(nesne) {
  nesne.durma();
}

function animasyonGüncelle(karakter) {
  karakter.animasyonGüncelle();
}

function haliGüncelle(nesne) {
  nesne.haliGüncelle();
}