class SesManager {
    constructor() {
        this.sesler = {};
        this.etkileşimler = {};
    }

    sesEkle(sesAdi, sesDosya) {
        this.sesler[sesAdi] = sesDosya;
    }

    sesOynat(sesAdi) {
        if (this.sesler[sesAdi]) {
            console.log(`Ses oynatılıyor: ${sesAdi}`);
            // Ses oynatma kodları
            // Örneğin: this.sesler[sesAdi].play();
        } else {
            console.log(`Ses bulunamadı: ${sesAdi}`);
        }
    }

    sesDurdur(sesAdi) {
        if (this.sesler[sesAdi]) {
            console.log(`Ses durduruldu: ${sesAdi}`);
            // Ses durdurma kodları
            // Örneğin: this.sesler[sesAdi].pause();
        } else {
            console.log(`Ses bulunamadı: ${sesAdi}`);
        }
    }

    etkileşimEkle(etkileşimAdi, sesler) {
        this.etkileşimler[etkileşimAdi] = sesler;
    }

    etkileşimCalistir(etkileşimAdi) {
        if (this.etkileşimler[etkileşimAdi]) {
            console.log(`Etkileşim oynatılıyor: ${etkileşimAdi}`);
            this.etkileşimler[etkileşimAdi].forEach(sesAdi => this.sesOynat(sesAdi));
        } else {
            console.log(`Etkileşim bulunamadı: ${etkileşimAdi}`);
        }
    }
}

class SesEtkileşim {
    constructor(etkileşimAdi, sesler) {
        this.etkileşimAdi = etkileşimAdi;
        this.sesler = sesler;
    }

    calistir() {
        sesManager.etkileşimCalistir(this.etkileşimAdi);
    }
}

const sesManager = new SesManager();

// Örnek sesler
sesManager.sesEkle("yapay_zeka_sesi", new Audio("audio/yapay_zeka.mp3"));
sesManager.sesEkle("hedefleme_sesi", new Audio("audio/hedefleme.mp3"));
sesManager.sesEkle("kavga_sesi", new Audio("audio/kavga.mp3"));

// Örnek etkileşimler
const hedeflemeEtkileşi = new SesEtkileşim("hedefleme", ["hedefleme_sesi"]);
const kavgaEtkileşi = new SesEtkileşim("kavga", ["kavga_sesi"]);

// Etkileşimleri yönetme
sesManager.etkileşimEkle("hedefleme", ["hedefleme_sesi"]);
sesManager.etkileşimEkle("kavga", ["kavga_sesi"]);

// Etkileşimleri çalıştırma
hedeflemeEtkileşi.calistir();
kavgaEtkileşi.calistir();