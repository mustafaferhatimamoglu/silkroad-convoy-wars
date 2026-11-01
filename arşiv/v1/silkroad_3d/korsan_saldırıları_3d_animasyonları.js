// korsan_saldırıları_3d_animasyonları.js

class KorsanSaldırısı {
  constructor(hedef, saldırıHareketleri, geriSayımEtkisi) {
    this.hedef = hedef;
    this.saldırıHareketleri = saldırıHareketleri;
    this.geriSayımEtkisi = geriSayımEtkisi;
  }

  hedefle(hedef) {
    this.hedef = hedef;
  }

  saldırı() {
    this.saldırıHareketleri.forEach(hareket => hareket.baslat());
    this.geriSayım();
  }

  geriSayım() {
    geriSayımBaslat(this.geriSayımEtkisi);
  }

  saldırıDurdur() {
    this.saldırıHareketleri.forEach(hareket => hareket.durdur());
    geriSayımDurdur(this.geriSayımEtkisi);
  }
}

class SaldırıHareketi {
  constructor(tip, sure) {
    this.tip = tip;
    this.sure = sure;
  }

  baslat() {
    // Hareketi başlatan kod
    console.log(`Hareket tipi: ${this.tip}, Süre: ${this.sure}s`);
  }

  durdur() {
    // Hareketi durduran kod
    console.log(`Hareket durduruldu`);
  }
}

class GeriSayımEtkisi {
  constructor(sure, efekt) {
    this.sure = sure;
    this.efekt = efekt;
  }

  baslat() {
    // Geri sayım efekti başlatan kod
    console.log(`Geri sayım süresi: ${this.sure}s`);
  }

  durdur() {
    // Geri sayım efekti durduran kod
    console.log(`Geri sayım durduruldu`);
  }
}

let saldırılar = [];

function oluştursaldırı(hedef, hareketler, geriSayımEtkisi) {
  return new KorsanSaldırısı(hedef, hareketler, geriSayımEtkisi);
}

function geriSayımBaslat(geriSayımEtkisi) {
  geriSayımEtkisi.baslat();
}

function geriSayımDurdur(geriSayımEtkisi) {
  geriSayımEtkisi.durdur();
}