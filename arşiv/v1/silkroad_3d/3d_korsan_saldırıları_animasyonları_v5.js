// Dosya: 3d_korsan_saldırıları_animasyonları_v5.js

class KorsanSaldırısı {
    constructor() {
        this.saldırıHareketi = null;
        this.saldırıSesleri = null;
        this.saldırıAnimasyonları = null;
    }

    getSaldırıHareketi() {
        return this.saldırıHareketi;
    }

    getSaldırıSesleri() {
        return this.saldırıSesleri;
    }

    getSaldırıAnimasyonları() {
        return this.saldırıAnimasyonları;
    }

    setSaldırıHareketi(hareket) {
        this.saldırıHareketi = hareket;
    }

    setSaldırıSesleri(sesler) {
        this.saldırıSesleri = sesler;
    }

    setSaldırıAnimasyonları(animasyonlar) {
        this.saldırıAnimasyonları = animasyonlar;
    }
}

class SaldırıAnimasyonu {
    constructor() {
        this.hareket = null;
        this.ses = null;
        this.animasyon = null;
    }

    getHareket() {
        return this.hareket;
    }

    getSes() {
        return this.ses;
    }

    getAnimasyon() {
        return this.animasyon;
    }

    setHareket(hareket) {
        this.hareket = hareket;
    }

    setSes(ses) {
        this.ses = ses;
    }

    setAnimasyon(animasyon) {
        this.animasyon = animasyon;
    }
}

let korsanSaldırılarıAnimasyonları = [];

function animateKorsanSaldırılar() {
    korsanSaldırılarıAnimasyonları.forEach(saldırı => {
        setSaldırıHareketi(saldırı.getSaldırıHareketi());
        setSaldırıSesleri(saldırı.getSaldırıSesleri());
        setSaldırıAnimasyonları(saldırı.getSaldırıAnimasyonları());
    });
}

function setSaldırıHareketi(hareket) {
    // Hareketi uygulama kodu buraya gelecek
}

function setSaldırıSesleri(sesler) {
    // Sesleri oynatma kodu buraya gelecek
}

function setSaldırıAnimasyonları(animasyonlar) {
    // Animasyonları uygulama kodu buraya gelecek
}