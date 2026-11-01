// Dosya: korsan_saldırılar_animasyonları.js

class KorsanSaldırı {
  constructor(saldırıID, saldırıTipi, sure, hedefler, saldırıGucu) {
    this.saldırıID = saldırıID;
    this.saldırıTipi = saldırıTipi;
    this.sure = sure;
    this.hedefler = hedefler;
    this.saldırıGucu = saldırıGucu;
  }

  basla() {
    console.log(`Saldırı ${this.saldırıID} başladı.`);
  }

  bitir() {
    console.log(`Saldırı ${this.saldırıID} bitti.`);
  }

  gucuGuncelle(yeniGuc) {
    this.saldırıGucu = yeniGuc;
    console.log(`Saldırı ${this.saldırıID} gücü güncellendi: ${this.saldırıGucu}`);
  }

  hedefEkle(hedef) {
    this.hedefler.push(hedef);
    console.log(`Saldırı ${this.saldırıID} hedefine eklendi: ${hedef}`);
  }

  hedefleriGuncelle(hedefler) {
    this.hedefler = hedefler;
    console.log(`Saldırı ${this.saldırıID} hedefleri güncellendi: ${this.hedefler}`);
  }
}

class Animasyon {
  constructor(animasyonID, model, sure, dongu) {
    this.animasyonID = animasyonID;
    this.model = model;
    this.sure = sure;
    this.dongu = dongu;
    this.dugmeler = [];
  }

  basla() {
    console.log(`Animasyon ${this.animasyonID} başladı.`);
  }

  bitir() {
    console.log(`Animasyon ${this.animasyonID} bitti.`);
  }

  dugmeEkle(dugme) {
    this.dugmeler.push(dugme);
    console.log(`Animasyon ${this.animasyonID} düğme eklendi: ${dugme}`);
  }

  dugmeleriGuncelle(dugmeler) {
    this.dugmeler = dugmeler;
    console.log(`Animasyon ${this.animasyonID} düğmeleri güncellendi: ${this.dugmeler}`);
  }
}

class SaldırıAnimasyon {
  constructor(saldırı, animasyon) {
    this.saldırı = saldırı;
    this.animasyon = animasyon;
  }

  basla() {
    this.saldırı.basla();
    this.animasyon.basla();
  }

  bitir() {
    this.saldırı.bitir();
    this.animasyon.bitir();
  }

  saldırıGuncelle(saldırı) {
    this.saldırı = saldırı;
    this.saldırı.basla();
  }

  animasyonGuncelle(animasyon) {
    this.animasyon = animasyon;
    this.animasyon.basla();
  }
}

// Fonksiyonlar

function saldırıOlustur(saldırıID, saldırıTipi, sure, hedefler, saldırıGucu) {
  return new KorsanSaldırı(saldırıID, saldırıTipi, sure, hedefler, saldırıGucu);
}

function animasyonOlustur(animasyonID, model, sure, dongu) {
  return new Animasyon(animasyonID, model, sure, dongu);
}

function saldırıAnimasyonOlustur(saldırı, animasyon) {
  return new SaldırıAnimasyon(saldırı, animasyon);
}

// Değişkenler

let saldırılar = [];
let animasyonlar = [];
let saldırıAnimasyonlar = [];