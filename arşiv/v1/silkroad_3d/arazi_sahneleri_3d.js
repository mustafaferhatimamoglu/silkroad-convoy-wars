// AraziSahne sınıfı
class AraziSahne {
  constructor(sahneID, temelBati, sahneParçalari) {
    this.sahneID = sahneID;
    this.temelBati = temelBati;
    this.sahneParçalari = sahneParçalari;
  }

  yarat() {
    // Sahne oluşturma işlemleri
  }

  sahneyiYükle() {
    // Sahne yükleme işlemleri
  }

  sahneyiAnimasyonla() {
    // Sahne animasyonu işlemleri
  }
}

// TemelBati sınıfı
class TemelBati {
  constructor(batiID, batiModel) {
    this.batiID = batiID;
    this.batiModel = batiModel;
  }

  yarat() {
    // Batı oluşturma işlemleri
  }

  batiyiYükle() {
    // Batı yükleme işlemleri
  }

  batiyiAnimasyonla() {
    // Batı animasyonu işlemleri
  }
}

// AraziParcasi sınıfı
class AraziParcasi {
  constructor(parcaID, parcaModel) {
    this.parcaID = parcaID;
    this.parcaModel = parcaModel;
  }

  yarat() {
    // Parça oluşturma işlemleri
  }

  parcayıYükle() {
    // Parça yükleme işlemleri
  }

  parcayıAnimasyonla() {
    // Parça animasyonu işlemleri
  }
}

// AraziSahneManager sınıfı
class AraziSahneManager {
  constructor() {
    this.sahneler = [];
  }

  sahneEkle(sahne) {
    this.sahneler.push(sahne);
    sahneEklendi = true;
  }

  sahneSil(sahneID) {
    this.sahneler = this.sahneler.filter(sahne => sahne.sahneID !== sahneID);
    sahneSilindi = true;
  }

  tumSahneleriYükle() {
    this.sahneler.forEach(sahne => sahne.sahneyiYükle());
    sahneYüklendi = true;
  }

  tumSahneleriAnimasyonla() {
    this.sahneler.forEach(sahne => sahne.sahneyiAnimasyonla());
    sahneAnimasyonlu = true;
  }
}

// Fonksiyonlar
function yaratSahne(sahneID, temelBati, sahneParçalari) {
  return new AraziSahne(sahneID, temelBati, sahneParçalari);
}

function yaratTemelBati(batiID, batiModel) {
  return new TemelBati(batiID, batiModel);
}

function yaratAraziParcasi(parcaID, parcaModel) {
  return new AraziParcasi(parcaID, parcaModel);
}

function yaratAraziSahneManager() {
  return new AraziSahneManager();
}

// Değişkenler
let sahneEklendi = false;
let sahneSilindi = false;
let sahneYüklendi = false;
let sahneAnimasyonlu = false;