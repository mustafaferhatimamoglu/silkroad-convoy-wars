class KervanTicariSistemi {
  constructor() {
    this.kervanlar = [];
    this.maddeler = [];
    this.fiyatlar = {};
  }

  yukleKervan(kervan) {
    this.kervanlar.push(kervan);
  }

  sat(kervan, madde) {
    const maddeninFiyati = this.fiyatlar[madde];
    if (maddeninFiyati) {
      const maddeninAgirlik = this.maddeler.find(m => m.isim === madde).agirlik;
      kervan.cikar(madde);
      console.log(`${madde} satıldı, fiyatı: ${maddeninFiyati}, ağırlığı: ${maddeninAgirlik}`);
    } else {
      console.log(`${madde} bulunamadı.`);
    }
  }

  guncelleFiyatlar() {
    for (const maddeninFiyati of Object.entries(this.fiyatlar)) {
      const [madde, yeniFiyat] = maddeninFiyati;
      this.maddeler.find(m => m.isim === madde).setFiyat(yeniFiyat);
    }
  }
}

class Kervan {
  constructor(model) {
    this.model = model;
    this.maddeler = [];
    this.agirlik = 0;
  }

  ekle(madde) {
    const maddeninAgirlik = this.maddeler.find(m => m.isim === madde).agirlik;
    this.maddeler.push(madde);
    this.agirlik += maddeninAgirlik;
  }

  cikar(madde) {
    const maddeninAgirlik = this.maddeler.find(m => m.isim === madde).agirlik;
    this.maddeler = this.maddeler.filter(m => m.isim !== madde);
    this.agirlik -= maddeninAgirlik;
  }

  hesaplaToplamAgirlik() {
    this.agirlik = this.maddeler.reduce((toplam, madde) => toplam + madde.agirlik, 0);
  }
}

class Madde {
  constructor(isim, fiyat, agirlik) {
    this.isim = isim;
    this.fiyat = fiyat;
    this.agirlik = agirlik;
  }

  setFiyat(yeniFiyat) {
    this.fiyat = yeniFiyat;
  }

  setAgirlik(yeniAgirlik) {
    this.agirlik = yeniAgirlik;
  }
}

// Örnek kullanım
const kervanTicariSistemi = new KervanTicariSistemi();

const kervan1 = new Kervan("Kervan 1");
const kervan2 = new Kervan("Kervan 2");

const maddenin1 = new Madde("Kahve", 10, 2);
const maddenin2 = new Madde("Elma", 5, 1);

kervanTicariSistemi.yukleKervan(kervan1);
kervanTicariSistemi.yukleKervan(kervan2);

kervan1.ekle("Kahve");
kervan1.ekle("Elma");

kervanTicariSistemi.sat(kervan1, "Kahve");

kervanTicariSistemi.fiyatlar = {
  "Kahve": 15,
  "Elma": 3
};

kervanTicariSistemi.guncelleFiyatlar();

console.log(kervan1.maddeler);
console.log(kervan1.agirlik);