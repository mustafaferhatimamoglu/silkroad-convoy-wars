// Modül: Çevre Sesleri
// Dosya: cevresel_sesler.js

class Ses {
    constructor(ad, dosyaYolu, sesTip) {
        this.ad = ad;
        this.dosyaYolu = dosyaYolu;
        this.sesTip = sesTip; // "Doğal", "Etkileyici", vb.
    }

    oynat() {
        // Sesi oynatma kodu
        console.log(`Ses oynatılıyor: ${this.ad}`);
    }

    durdur() {
        // Sesi durdurma kodu
        console.log(`Ses durduruldu: ${this.ad}`);
    }
}

class ÇevreSesleri {
    constructor() {
        this.sesler = [];
    }

    ekleSes(ses) {
        this.sesler.push(ses);
    }

    sesleriYukle() {
        this.sesler.forEach(ses => {
            ses.oynat();
        });
    }

    sesleriDurdur() {
        this.sesler.forEach(ses => {
            ses.durdur();
        });
    }
}

class ÇölYoluSesi extends Ses {
    constructor(ad, dosyaYolu) {
        super(ad, dosyaYolu, "Doğal");
    }
}

class BitkiSesi extends Ses {
    constructor(ad, dosyaYolu) {
        super(ad, dosyaYolu, "Doğal");
    }
}

class KorsanSesi extends Ses {
    constructor(ad, dosyaYolu) {
        super(ad, dosyaYolu, "Etkileyici");
    }
}

class DoğalSesler {
    constructor() {
        this.sesler = [];
    }

    ekleDoğalSes(ses) {
        this.sesler.push(ses);
    }

    sesleriYukle() {
        this.sesler.forEach(ses => {
            ses.oynat();
        });
    }
}

class EtkileyiciSesler {
    constructor() {
        this.sesler = [];
    }

    ekleEtkileyiciSes(ses) {
        this.sesler.push(ses);
    }

    sesleriYukle() {
        this.sesler.forEach(ses => {
            ses.oynat();
        });
    }
}

// Örnek kullanım
const çevreSesleri = new ÇevreSesleri();
const çölYoluSesi = new ÇölYoluSesi("Çöl Yolu Sesi", "dosyalar/çöl_yolu_sesi.mp3");
const bitkiSesi = new BitkiSesi("Bitki Sesi", "dosyalar/bitki_sesi.mp3");

çevreSesleri.ekleSes(çölYoluSesi);
çevreSesleri.ekleSes(bitkiSesi);

çevreSesleri.sesleriYukle();