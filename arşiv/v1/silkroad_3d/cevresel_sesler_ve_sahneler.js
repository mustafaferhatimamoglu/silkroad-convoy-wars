// cevresel_sesler_ve_sahneler.js

class CevreselSesManager {
    constructor() {
        this.sesler = {};
        this.sesYon = {};
    }

    yarat() {
        // Nesne yaratılırken herhangi bir eylem yapılmaz
    }

    sesEkle(sesAdi) {
        // Ses dosyasını sesler nesnesine ekler
        if (!this.sesler[sesAdi]) {
            this.sesler[sesAdi] = new Audio(`sesler/${sesAdi}.mp3`);
        }
    }

    sesOynat(sesAdi) {
        // Ses dosyasını oynatır
        if (this.sesler[sesAdi]) {
            this.sesler[sesAdi].play();
        }
    }

    sesDurdur(sesAdi) {
        // Ses dosyasını durdurur
        if (this.sesler[sesAdi]) {
            this.sesler[sesAdi].pause();
        }
    }

    sesKaldır(sesAdi) {
        // Ses dosyasını kaldırır
        if (this.sesler[sesAdi]) {
            this.sesler[sesAdi].currentTime = 0;
        }
    }
}

class SahneManager {
    constructor() {
        this.sahneler = {};
        this.aktifSahne = null;
    }

    yarat() {
        // Nesne yaratılırken herhangi bir eylem yapılmaz
    }

    sahneEkle(sahneAdi) {
        // Sahne dosyasını sahneler nesnesine ekler
        if (!this.sahneler[sahneAdi]) {
            this.sahneler[sahneAdi] = document.createElement('div');
            this.sahneler[sahneAdi].id = sahneAdi;
            document.body.appendChild(this.sahneler[sahneAdi]);
        }
    }

    sahneGoster(sahneAdi) {
        // Sahneyi gösterir
        if (this.sahneler[sahneAdi]) {
            this.sahneler[sahneAdi].style.display = 'block';
            this.aktifSahne = sahneAdi;
        }
    }

    sahneGizle(sahneAdi) {
        // Sahneyi gizler
        if (this.sahneler[sahneAdi]) {
            this.sahneler[sahneAdi].style.display = 'none';
        }
    }
}

function yaratCevreselSesManager() {
    return new CevreselSesManager();
}

function yaratSahneManager() {
    return new SahneManager();
}

function sesEkle(sesAdi) {
    sesManager.sesEkle(sesAdi);
}

function sesOynat(sesAdi) {
    sesManager.sesOynat(sesAdi);
}

function sesDurdur(sesAdi) {
    sesManager.sesDurdur(sesAdi);
}

function sesKaldır(sesAdi) {
    sesManager.sesKaldır(sesAdi);
}

function sahneEkle(sahneAdi) {
    sahneManager.sahneEkle(sahneAdi);
}

function sahneGoster(sahneAdi) {
    sahneManager.sahneGoster(sahneAdi);
}

function sahneGizle(sahneAdi) {
    sahneManager.sahneGizle(sahneAdi);
}

let sesManager = yaratCevreselSesManager();
let sahneManager = yaratSahneManager();