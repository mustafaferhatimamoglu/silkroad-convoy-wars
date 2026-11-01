// 3d_tır_modelleri_geliştirme_v9.js

class TirModeli {
  constructor(model, pozisyon, hız, hizmetDurumu) {
    this.model = model;
    this.pozisyon = pozisyon;
    this.hız = hız;
    this.hizmetDurumu = hizmetDurumu;
  }

  hareketEt() {
    this.hizmetDurumu = "yürüyor";
    // Hareket etme kodu
  }

  durdur() {
    this.hizmetDurumu = "duruyor";
    // Durma kodu
  }

  hizlan() {
    this.hız += 1;
    this.hizmetDurumu = "hızlı hareket ediyor";
    // Hızlandırma kodu
  }

  yavaşla() {
    this.hız -= 1;
    this.hizmetDurumu = "yürüyor";
    // Yavaşlatma kodu
  }
}

class TirKontrolleri {
  constructor(tir) {
    this.tir = tir;
  }

  yukariGit() {
    // YUKARI gitme kodu
    this.tir.pozisyon.y += this.tir.hız;
  }

  asagiGit() {
    // AŞAĞI gitme kodu
    this.tir.pozisyon.y -= this.tir.hız;
  }

  sagGit() {
    // SAĞ gitme kodu
    this.tir.pozisyon.x += this.tir.hız;
  }

  solGit() {
    // SOL gitme kodu
    this.tir.pozisyon.x -= this.tir.hız;
  }
}

class TirAnimasyonu {
  constructor(tir) {
    this.tir = tir;
  }

  baslaAnimasyon() {
    // Animasyonu başlatma kodu
    this.tir.model.animate();
  }

  durdurAnimasyon() {
    // Animasyonu durdurma kodu
    this.tir.model.stopAnimation();
  }

  geriGit() {
    // Geri alma kodu
    this.tir.model.rewind();
  }
}

function loadTirModel(modelPath) {
  // Model yükleme kodu
  const model = new THREE.Mesh(geometry, material);
  return new TirModeli(model, new THREE.Vector3(0, 0, 0), 1, "duruyor");
}

function initTirContoller(tirModel) {
  return new TirKontrolleri(tirModel);
}

function startTirAnimation(tirModel) {
  const tirAnimasyonu = new TirAnimasyonu(tirModel);
  tirAnimasyonu.baslaAnimasyon();
}

// Değişkenler
let tirModelListesi = [];
let tirKontrollerListesi = [];
let tirAnimasyonListesi = [];