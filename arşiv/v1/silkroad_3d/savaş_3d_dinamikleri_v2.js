// savaş_3d_dinamikleri_v2.js

class SavaşDinamikleri {
    constructor() {
        this.savaşlar = [];
        this.etkileşimler = [];
        this.savaşEkonomi = new SavaşEkonomi();
    }

    yeniSavaşOluştur(savaş) {
        this.savaşlar.push(savaş);
    }

    savaşlarıGüncelle(savaş) {
        const index = this.savaşlar.findIndex(s => s.id === savaş.id);
        if (index !== -1) {
            this.savaşlar[index] = savaş;
        }
    }

    savaşlarıSil(savaş) {
        const index = this.savaşlar.findIndex(s => s.id === savaş.id);
        if (index !== -1) {
            this.savaşlar.splice(index, 1);
        }
    }
}

class SavaşEkonomi {
    constructor() {
        this.maliyetler = {};
        this.gelirler = {};
    }

    maliyetleriGüncelle(maliyet) {
        this.maliyetler[maliyet.id] = maliyet;
    }

    gelirleriGüncelle(gelir) {
        this.gelirler[gelir.id] = gelir;
    }
}

// Fonksiyonlar
function yeniSavaşOluştur(savaş) {
    savaşDinamikleri.yeniSavaşOluştur(savaş);
}

function savaşlarıGüncelle(savaş) {
    savaşDinamikleri.savaşlarıGüncelle(savaş);
}

function savaşlarıSil(savaş) {
    savaşDinamikleri.savaşlarıSil(savaş);
}

function yeniAnimasyonOluştur(animasyon) {
    animasyonlarıGüncelle(animasyon);
}

function animasyonlarıGüncelle(animasyon) {
    animasyonlar.push(animasyon);
}

function animasyonlarıSil(animasyon) {
    const index = animasyonlar.findIndex(a => a.id === animasyon.id);
    if (index !== -1) {
        animasyonlar.splice(index, 1);
    }
}

function maliyetleriGüncelle(maliyet) {
    savaşDinamikleri.savaşEkonomi.maliyetleriGüncelle(maliyet);
}

function gelirleriGüncelle(gelir) {
    savaşDinamikleri.savaşEkonomi.gelirleriGüncelle(gelir);
}

// Değişkenler
let savaşDinamikleri = new SavaşDinamikleri();
let animasyonlar = [];