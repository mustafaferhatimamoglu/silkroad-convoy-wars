// SahneManager.js
class SahneManager {
  constructor() {
    this.sahneler = [];
    this.guncelSahne = null;
  }

  yukle(sahneAdi) {
    const sahne = Sahne.sahneGetir(sahneAdi);
    sahne.yukle();
    this.sahneler.push(sahne);
    this.guncelSahne = sahne;
  }

  gecis(sahneAdi) {
    if (this.guncelSahne) {
      this.guncelSahne.gizle();
    }
    this.guncelSahne = Sahne.sahneGetir(sahneAdi);
    this.guncelSahne.goster();
    this.animasyonYap(sahneAdi);
  }

  animasyonYap(sahneAdi) {
    const sahne = Sahne.sahneGetir(sahneAdi);
    sahne.animasyonYap();
  }
}

// Sahne.js
class Sahne {
  constructor(isim, model, interaktivite, sesler) {
    this.isim = isim;
    this.model = model;
    this.interaktivite = interaktivite;
    this.sesler = sesler;
  }

  yukle() {
    // Sahneyi yükleyen kod
  }

  goster() {
    // Sahneyi gösteren kod
  }

  gizle() {
    // Sahneyi gizleyen kod
  }

  static sahneGetir(isim) {
    // Sahne listesinden belirli bir sahneyi döndüren kod
  }
}

// InteraktiviteManager.js
class InteraktiviteManager {
  constructor() {
    this.interaktiviteElemanları = [];
  }

  etkinleştir(elemanAdi) {
    // Belirtilen interaktivite öğesini etkinleştirir
  }

  devreDışı(elemanAdi) {
    // Belirtilen interaktivite öğesini devre dışı bırakır
  }
}

// KorsanSaldırıManager.js
class KorsanSaldırıManager {
  constructor() {
    this.saldırılar = [];
  }

  saldırıYap(saldırıAdi) {
    // Belirtilen korsan saldırısını yönetir
  }

  saldırıGuncelle() {
    // Korsan saldırılarının güncel durumunu günceller
  }
}

// SesManager.js
class SesManager {
  constructor() {
    this.sesler = [];
  }

  sesYap(sesAdi) {
    // Belirtilen sesi çalar
  }

  sesGuncelle(sesAdi) {
    // Belirtilen sesin güncel durumunu günceller
  }
}

// Fonksiyonlar
function yukleSahne(sahneAdi) {
  SahneManager.yukle(sahneAdi);
}

function gecisYap(sahneAdi) {
  SahneManager.gecis(sahneAdi);
}

function animasyonYap(sahneAdi) {
  SahneManager.animasyonYap(sahneAdi);
}

function etkinleştirInteraktivite(elemanAdi) {
  InteraktiviteManager.etkinleştir(elemanAdi);
}

function devreDışıInteraktivite(elemanAdi) {
  InteraktiviteManager.devreDışı(elemanAdi);
}

function saldırıYap(saldırıAdi) {
  KorsanSaldırıManager.saldırıYap(saldırıAdi);
}

function sesYap(sesAdi) {
  SesManager.sesYap(sesAdi);
}

// Değişkenler
const sahneler = [];
let guncelSahne = null;
const interaktiviteElemanları = [];
const saldırılar = [];
const sesler = [];