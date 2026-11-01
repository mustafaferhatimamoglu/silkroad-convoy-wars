class Catışma {
  constructor(tarih, yer, katışmaTipi) {
    this.tarih = tarih;
    this.yer = yer;
    this.katışmaTipi = katışmaTipi;
  }
}

class CatışmaDetay {
  constructor(katışmaID, katışmaTipi, katışmaKatılımı, katışmaSonucu) {
    this.katışmaID = katışmaID;
    this.katışmaTipi = katışmaTipi;
    this.katışmaKatılımı = katışmaKatılımı;
    this.katışmaSonucu = katışmaSonucu;
  }
}

class CatışmaAnalizi {
  constructor() {
    this.katışmalar = [];
    this.katışmaDetayları = [];
    this.analizSonucu = null;
    this.etkiler = [];
    this.katışmaOlayları = [];
  }

  init() {
    this.katışmalar = [];
    this.katışmaDetayları = [];
    this.analizSonucu = null;
    this.etkiler = [];
    this.katışmaOlayları = [];
  }

  katışmaEkle(katışma) {
    this.katışmalar.push(katışma);
  }

  katışmaDetayEkle(katışmaDetay) {
    this.katışmaDetayları.push(katışmaDetay);
  }

  katışmaAnalizEt() {
    // Bu metot katışmaları analiz eder ve sonuçları döndürür.
    // Örneğin: Analiz sonucunu hesapla ve this.analizSonucu'na atayabiliriz.
    this.analizSonucu = "Analiz Sonucu";
    return this.analizSonucu;
  }

  katışmaOlayEkle(katışmaOlay) {
    this.katışmaOlayları.push(katışmaOlay);
  }

  katışmaEtkisiHesapla() {
    // Bu metot katışmaların etkilerini hesaplar ve sonuçları döndürür.
    // Örneğin: Etkileri hesapla ve this.etkiler'ine atayabiliriz.
    this.etkiler = ["Etki 1", "Etki 2"];
    return this.etkiler;
  }

  katışmaListesiniGetir() {
    return this.katışmalar;
  }

  katışmaDetayListesiniGetir() {
    return this.katışmaDetayları;
  }

  katışmaOlayListesiniGetir() {
    return this.katışmaOlayları;
  }

  katışmaEtkileriniGetir() {
    return this.etkiler;
  }
}

// Kullanım örneği
const analiz = new CatışmaAnalizi();
analiz.init();
const yeniCatışma = new Catışma("2023-04-01", "Kervan Yolu", "Yapışma");
const yeniCatışmaDetay = new CatışmaDetay(1, "Yapışma", "Birlikte", "Başarı");
analiz.katışmaEkle(yeniCatışma);
analiz.katışmaDetayEkle(yeniCatışmaDetay);
console.log(analiz.katışmaListesiniGetir());
console.log(analiz.katışmaDetayListesiniGetir());
console.log(analiz.katışmaAnalizEt());
console.log(analiz.katışmaEtkisiHesapla());