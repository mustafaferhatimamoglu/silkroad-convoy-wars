// Malzeme sınıfı
class Malzeme {
    constructor(isim, fiyat, adet) {
        this.isim = isim;
        this.fiyat = fiyat;
        this.adet = adet;
    }

    sat(adet) {
        if (adet <= this.adet) {
            this.adet -= adet;
            return adet * this.fiyat;
        } else {
            console.error("Yeterli malzeme yok!");
            return 0;
        }
    }

    al(adet) {
        this.adet += adet;
    }
}

// Kervan sınıfı
class Kervan {
    constructor(kervanID, kervanModel, kervanKonumu) {
        this.kervanID = kervanID;
        this.kervanModel = kervanModel;
        this.kervanKonumu = kervanKonumu;
    }

    konumuGuncelle(yeniKonum) {
        this.kervanKonumu = yeniKonum;
    }

    modeliGuncelle(yeniModel) {
        this.kervanModel = yeniModel;
    }
}

// KervanTicariSistemi sınıfı
class KervanTicariSistemi {
    constructor(kervan, malzemeListesi, fiyatListesi) {
        this.kervan = kervan;
        this.malzemeListesi = malzemeListesi;
        this.fiyatListesi = fiyatListesi;
    }

    satisYap(malzeme, adet) {
        const fiyat = malzeme.sat(adet);
        console.log(`${malzeme.isim} satıldı. Toplam fiyat: ${fiyat}`);
        return fiyat;
    }

    satinAl(malzeme, adet) {
        malzeme.al(adet);
        console.log(`${malzeme.isim} satın alındı.`);
        return malzeme.fiyat * adet;
    }

    fiyatGuncelle(malzeme, yeniFiyat) {
        malzeme.fiyat = yeniFiyat;
        console.log(`${malzeme.isim} fiyatı güncellendi: ${yeniFiyat}`);
    }
}

// Örnek kullanım
const malzeme1 = new Malzeme("Kömür", 10, 100);
const malzeme2 = new Malzeme("Boğaz", 5, 200);
const malzemeListesi = [malzeme1, malzeme2];
const fiyatListesi = [10, 5];
const kervan = new Kervan("Kervan123", "Kervan Model A", "Konya");
const kervanTicariSistemiInstance = new KervanTicariSistemi(kervan, malzemeListesi, fiyatListesi);

// Malzeme satışı
kervanTicariSistemiInstance.satisYap(malzeme1, 10);

// Malzeme satın alma
kervanTicariSistemiInstance.satinAl(malzeme2, 30);

// Malzeme fiyatı güncelleme
kervanTicariSistemiInstance.fiyatGuncelle(malzeme1, 15);