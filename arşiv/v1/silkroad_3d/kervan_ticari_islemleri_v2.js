class KervanTicariIslemi {
    constructor(kervan, ticariMalzeme, depo) {
        this.kervan = kervan;
        this.ticariMalzeme = ticariMalzeme;
        this.depo = depo;
    }

    ticariMalzemeDepolamayıYap() {
        // Malzeme depolama işlemlerini gerçekleştirir
    }

    ticariIslemYap() {
        // Ticari işlemi gerçekleştirir
    }

    ticariMalzemeSatinAl() {
        // Ticari malzeme satın alır
    }

    ticariMalzemeSatisYap() {
        // Ticari malzeme satışı gerçekleştirir
    }
}

class KervanDepo {
    constructor(malzemeListesi, kaynakDepo, satışDepo) {
        this.malzemeListesi = malzemeListesi;
        this.kaynakDepo = kaynakDepo;
        this.satışDepo = satışDepo;
    }

    malzemeEkle(malzeme) {
        // Malzeme ekler
    }

    malzemeCikar(malzeme) {
        // Malzeme çıkarır
    }

    malzemeYukle(malzeme) {
        // Malzeme yükler
    }

    malzemeSatinAl(malzeme) {
        // Malzeme satın alır
    }
}

class KervanSatinAlmaIslemi {
    constructor(kervan, ticariMalzeme, satıcı) {
        this.kervan = kervan;
        this.ticariMalzeme = ticariMalzeme;
        this.satıcı = satıcı;
    }

    malzemeSatınAl() {
        // Malzeme satın alır
    }

    paraOdeme() {
        // Ödeme yapar
    }
}

class KervanSatisIslemi {
    constructor(kervan, ticariMalzeme, satıcı) {
        this.kervan = kervan;
        this.ticariMalzeme = ticariMalzeme;
        this.satıcı = satıcı;
    }

    malzemeSatisYap() {
        // Malzeme satışı gerçekleştirir
    }

    paraAl() {
        // Paranı alır
    }
}

function initKervanTicariIslemi(kervan, ticariMalzeme, depo) {
    const kervanTicariIslemi = new KervanTicariIslemi(kervan, ticariMalzeme, depo);
    kervanTicariIslemi.ticariMalzemeDepolamayıYap();
    kervanTicariIslemi.ticariIslemYap();
    kervanTicariIslemi.ticariMalzemeSatinAl();
    kervanTicariIslemi.ticariMalzemeSatisYap();
    return kervanTicariIslemi;
}

function initKervanDepo(malzemeListesi, kaynakDepo, satışDepo) {
    const kervanDepo = new KervanDepo(malzemeListesi, kaynakDepo, satışDepo);
    kervanDepo.init();
    return kervanDepo;
}

function initKervanSatinAlmaIslemi(kervan, ticariMalzeme, satıcı) {
    const kervanSatinAlmaIslemi = new KervanSatinAlmaIslemi(kervan, ticariMalzeme, satıcı);
    kervanSatinAlmaIslemi.malzemeSatınAl();
    kervanSatinAlmaIslemi.paraOdeme();
    return kervanSatinAlmaIslemi;
}

function initKervanSatisIslemi(kervan, ticariMalzeme, satıcı) {
    const kervanSatisIslemi = new KervanSatisIslemi(kervan, ticariMalzeme, satıcı);
    kervanSatisIslemi.malzemeSatisYap();
    kervanSatisIslemi.paraAl();
    return kervanSatisIslemi;
}

// Değişkenler
const kervanTicariIslemi = initKervanTicariIslemi(/* parametreler */);
const kervanDepo = initKervanDepo(/* parametreler */);
const kervanSatinAlmaIslemi = initKervanSatinAlmaIslemi(/* parametreler */);
const kervanSatisIslemi = initKervanSatisIslemi(/* parametreler */);