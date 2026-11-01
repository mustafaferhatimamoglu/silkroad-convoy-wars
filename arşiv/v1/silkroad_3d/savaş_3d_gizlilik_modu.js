// GizlilikManager sınıfı
class GizlilikManager {
  constructor() {
    this.gizlilikDurumu = 100; // Gizlilik durumu (0-100 arası)
  }

  gizliliğiArtır() {
    if (this.gizlilikDurumu < 100) {
      this.gizlilikDurumu++;
    }
  }

  gizliliğiAzalt() {
    if (this.gizlilikDurumu > 0) {
      this.gizlilikDurumu--;
    }
  }

  gizlilikDurumunuGetir() {
    return this.gizlilikDurumu;
  }
}

// Kervan sınıfı
class Kervan {
  constructor(kervanID) {
    this.kervanID = kervanID;
    this.gizlilikManager = new GizlilikManager();
  }

  gizliliğiArtır() {
    this.gizlilikManager.gizliliğiArtır();
  }

  gizliliğiAzalt() {
    this.gizlilikManager.gizliliğiAzalt();
  }

  gizlilikDurumunuGetir() {
    return this.gizlilikManager.gizlilikDurumunuGetir();
  }
}

// Korsan sınıfı
class Korsan {
  constructor(korsanID) {
    this.korsanID = korsanID;
    this.gizlilikManager = new GizlilikManager();
  }

  gizliliğiArtır() {
    this.gizlilikManager.gizliliğiArtır();
  }

  gizliliğiAzalt() {
    this.gizlilikManager.gizliliğiAzalt();
  }

  gizlilikDurumunuGetir() {
    return this.gizlilikManager.gizlilikDurumunuGetir();
  }
}

// Gizlilik durumunu yükleme fonksiyonu
function gizlilikDurumunuYükle(kervanID) {
  if (!gizlilikDataları[kervanID]) {
    gizlilikDataları[kervanID] = new GizlilikManager();
  }
  return gizlilikDataları[kervanID].gizlilikDurumunuGetir();
}

// Gizlilik durumunu kaydetme fonksiyonu
function gizlilikDurumunuKaydet(kervanID, yeniDurum) {
  if (!gizlilikDataları[kervanID]) {
    gizlilikDataları[kervanID] = new GizlilikManager();
  }
  gizlilikDataları[kervanID].gizlilikDurumu = yeniDurum;
}

// Gizlilik durumunu güncelleme fonksiyonu
function gizlilikDurumunuGuncelle(kervanID, fark) {
  if (!gizlilikDataları[kervanID]) {
    gizlilikDataları[kervanID] = new GizlilikManager();
  }
  gizlilikDataları[kervanID].gizlilikDurumu += fark;
}

// GizlilikManager sınıfının tek bir örneğini tutar
const gizlilikManagerInstance = new GizlilikManager();

// Gizlilik durumları depolar
const gizlilikDataları = {};