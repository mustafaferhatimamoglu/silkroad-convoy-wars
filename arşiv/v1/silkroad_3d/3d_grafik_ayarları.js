// Dosya: 3d_grafik_ayarları.js

// Sınıf: GrafikAyarları
class GrafikAyarları {
  constructor() {
    this.grafikKalitesi = 'Orta';
    this.gorselKalitesi = 'Orta';
    this.grafikParametreleri = {};
  }

  ayarla(ayarlar) {
    if (ayarlar.grafikKalitesi) this.setGrafikKalitesi(ayarlar.grafikKalitesi);
    if (ayarlar.gorselKalitesi) this.setGorselKalitesi(ayarlar.gorselKalitesi);
    if (ayarlar.grafikParametreleri) this.setGrafikParametreleri(ayarlar.grafikParametreleri);
  }

  getGrafikKalitesi() {
    return this.grafikKalitesi;
  }

  setGrafikKalitesi(kalite) {
    this.grafikKalitesi = kalite;
  }

  getGorselKalitesi() {
    return this.gorselKalitesi;
  }

  setGorselKalitesi(kalite) {
    this.gorselKalitesi = kalite;
  }

  getGrafikParametreleri() {
    return this.grafikParametreleri;
  }

  setGrafikParametreleri(parametreler) {
    this.grafikParametreleri = parametreler;
  }

  uygulaAyarlar() {
    console.log('Grafik ayarları uygulandı.');
    console.log('Grafik Kalitesi:', this.grafikKalitesi);
    console.log('Gorsel Kalitesi:', this.gorselKalitesi);
    console.log('Grafik Parametreleri:', this.grafikParametreleri);
  }
}

// Sınıf: GrafikYöneticisi
class GrafikYöneticisi {
  constructor() {
    this.ayarlar = new GrafikAyarları();
  }

  ayarlarıYükle(ayarlar) {
    this.ayarlar.ayarla(ayarlar);
  }

  gecerliAyarlarıGetir() {
    return this.ayarlar;
  }

  grafikKalitesiniGuncelle(kalite) {
    this.ayarlar.setGrafikKalitesi(kalite);
  }

  gorselKalitesiniGuncelle(kalite) {
    this.ayarlar.setGorselKalitesi(kalite);
  }

  grafikParametreleriniGuncelle(parametreler) {
    this.ayarlar.setGrafikParametreleri(parametreler);
  }

  ayarlariUygula() {
    this.ayarlar.uygulaAyarlar();
  }
}

// Değişkenler
let grafikAyarları = new GrafikAyarları();
let grafikYöneticisi = new GrafikYöneticisi();

// Örnek Kullanım
grafikYöneticisi.ayarlarıYükle({ grafikKalitesi: 'Yüksek', gorselKalitesi: 'Yüksek', grafikParametreleri: { antialias: true, shadows: true } });
grafikYöneticisi.ayarlariUygula();