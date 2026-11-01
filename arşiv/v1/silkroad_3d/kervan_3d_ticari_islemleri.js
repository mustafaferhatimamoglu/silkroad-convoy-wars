// kervan_3d_ticari_islemleri.js

// Sınıflar
class Mal {
    constructor(isim, fiyatı, miktar) {
        this.isim = isim;
        this.fiyatı = fiyatı;
        this.miktar = miktar;
    }
}

class TicariDurum {
    constructor(kervan, harcamaLimiti) {
        this.kervan = kervan;
        this.harcamaLimiti = harcamaLimiti;
        this.bakiye = 0;
    }

    satis(mal, miktar) {
        if (mal.miktar >= miktar && this.bakiye + (mal.fiyatı * miktar) <= this.harcamaLimiti) {
            mal.miktar -= miktar;
            this.bakiye += mal.fiyatı * miktar;
            return true;
        }
        return false;
    }

    satinAl(mal, miktar) {
        if (this.bakiye >= (mal.fiyatı * miktar)) {
            mal.miktar += miktar;
            this.bakiye -= mal.fiyatı * miktar;
            return true;
        }
        return false;
    }
}

class Nakliye {
    constructor(kervan, hedef) {
        this.kervan = kervan;
        this.hedef = hedef;
        this.mal = [];
    }

    ekle(mal) {
        this.mal.push(mal);
    }

    geriAl(mal) {
        const index = this.mal.indexOf(mal);
        if (index !== -1) {
            this.mal.splice(index, 1);
            return true;
        }
        return false;
    }

    hedefeGonder() {
        // Hedefe gönderme işlemleri burada yer alacak
        return true;
    }
}

// Fonksiyonlar
function kervanTicariDurumOlustur(kervan, harcamaLimiti) {
    return new TicariDurum(kervan, harcamaLimiti);
}

function malOlustur(isim, fiyatı, miktar) {
    return new Mal(isim, fiyatı, miktar);
}

function nakliyeOlustur(kervan, hedef) {
    return new Nakliye(kervan, hedef);
}

function nakliyeEkle(nakliye, mal) {
    nakliye.ekle(mal);
}

function nakliyeGeriAl(nakliye, mal) {
    nakliye.geriAl(mal);
}

function nakliyeHedefeGonder(nakliye) {
    return nakliye.hedefeGonder();
}

function ticariSatisYap(ticariDurum, mal, miktar) {
    return ticariDurum.satis(mal, miktar);
}

function ticariSatınAl(ticariDurum, mal, miktar) {
    return ticariDurum.satinAl(mal, miktar);
}