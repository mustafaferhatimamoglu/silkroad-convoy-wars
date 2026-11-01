class Kervan {
  constructor(model, hiz, direksiyon, level, lojistik) {
    this.model = model;
    this.hiz = hiz;
    this.direksiyon = direksiyon;
    this.level = level;
    this.lojistik = lojistik;
  }

  hizGuncelle(n) {
    this.hiz = n;
  }

  direksiyonGuncelle(d) {
    this.direksiyon = d;
  }

  seviyeGuncelle(level) {
    this.level = level;
  }

  lojistikGuncelle(str, int) {
    this.lojistik.str = str;
    this.lojistik.int = int;
  }

  hareketEt() {
    // Kervanın hareket etmesini sağlar
  }
}

class KervanInteraktif {
  constructor(kervan, camera) {
    this.kervan = kervan;
    this.camera = camera;
  }

  hareketEt() {
    // Kervanın hareket etmesini sağlar
  }

  yonBelirle(yon) {
    this.kervan.direksiyonGuncelle(yon);
  }

  hizAyarla(hiz) {
    this.kervan.hizGuncelle(hiz);
  }

  lojistikYonet(str, int) {
    this.kervan.lojistikGuncelle(str, int);
  }

  cameraGuncelle() {
    // Kamera pozisyonunu günceller
  }
}

function hareketEt(kervan, hiz, direksiyon) {
  kervan.hizGuncelle(hiz);
  kervan.direksiyonGuncelle(direksiyon);
  kervan.hareketEt();
}

function yonBelirle(kervan, yon) {
  kervan.direksiyonGuncelle(yon);
}

function hizAyarla(kervan, hiz) {
  kervan.hizGuncelle(hiz);
}

function lojistikYonet(kervan, str, int) {
  kervan.lojistikGuncelle(str, int);
}

function cameraGuncelle(camera, kervan) {
  // Kamera pozisyonunu günceller
}