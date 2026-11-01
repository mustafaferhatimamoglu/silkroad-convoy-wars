// KorsanSaldırısı sınıfı
class KorsanSaldırısı {
    constructor(saldırıTipi, hedef) {
        this.hareket = new SaldırıHareketi();
        this.saldırı = {
            tip: saldırıTipi,
            hedef: hedef
        };
        this.enerji = new SaldırıEnerjisi();
        this.saldırıTipi = saldırıTipi;
        this.hedef = hedef;
    }

    hareketEt() {
        this.hareket.gözlemle();
        return this.hareket;
    }

    saldırı() {
        this.saldırıVer();
        this.enerjiKaybet();
        return this.saldırı;
    }

    enerjiKaybet() {
        this.enerji.kullan();
    }

    saldırıVer() {
        console.log(`Saldırı: ${this.saldırı.tip}, Hedef: ${this.saldırı.hedef}`);
    }
}

// SaldırıHareketi sınıfı
class SaldırıHareketi {
    constructor() {
        this.konum = { x: 0, y: 0, z: 0 };
        this.hız = 1;
        this.yön = { x: 1, y: 0, z: 0 };
    }

    gözlemle() {
        console.log(`Konum: (${this.konum.x}, ${this.konum.y}, ${this.konum.z}), Hız: ${this.hız}, Yön: (${this.yön.x}, ${this.yön.y}, ${this.yön.z})`);
    }

    hızlandır() {
        this.hız *= 1.1;
    }

    yönlandır(yön) {
        this.yön = yön;
    }
}

// SaldırıEnerjisi sınıfı
class SaldırıEnerjisi {
    constructor(miktar = 100) {
        this.miktar = miktar;
        this.maxMiktar = miktar;
    }

    kullan() {
        if (this.miktar > 0) {
            this.miktar -= 10;
        } else {
            console.log("Enerji yetersiz!");
        }
    }

    yenile() {
        this.miktar = this.maxMiktar;
    }

    kalanMiktar() {
        return this.miktar;
    }
}

// Fonksiyonlar
function saldırıOluştur(saldırıTipi, hedef) {
    return new KorsanSaldırısı(saldırıTipi, hedef);
}

function hareketEt(saldırı) {
    return saldırı.hareketEt();
}

function enerjiYenile(enerji) {
    enerji.yenile();
    return enerji;
}

function saldırı(hedef) {
    saldırı.saldır();
    return saldırı.saldırı;
}

// Değişkenler
let saldırılar = [];
let enerjiKaybı = 0;
let saldırıHareketleri = [];
let enerjiler = [];