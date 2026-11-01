class Korsan {
    constructor(adi, guc, kalkan) {
        this.adi = adi;
        this.guc = guc;
        this.kalkan = kalkan;
        this.saldırı = null;
    }

    saldırısınıBaslat(hedef) {
        this.saldırı = new Savaş(this, hedef);
        animasyonuBaslat(this.saldırı.animasyon);
    }

    saldırısınıDurdur() {
        if (this.saldırı) {
            savaşiDurdur(this.saldırı);
            this.saldırı = null;
        }
    }
}

class Kervan {
    constructor(adi, guc, kalkan) {
        this.adi = adi;
        this.guc = guc;
        this.kalkan = kalkan;
        this.saldırı = null;
    }

    saldırısınıBaslat(hedef) {
        this.saldırı = new Savaş(this, hedef);
        animasyonuBaslat(this.saldırı.animasyon);
    }

    saldırısınıDurdur() {
        if (this.saldırı) {
            savaşiDurdur(this.saldırı);
            this.saldırı = null;
        }
    }
}

class Tir {
    constructor(adi, guc, kalkan) {
        this.adi = adi;
        this.guc = guc;
        this.kalkan = kalkan;
        this.saldırı = null;
    }

    saldırısınıBaslat(hedef) {
        this.saldırı = new Savaş(this, hedef);
        animasyonuBaslat(this.saldırı.animasyon);
    }

    saldırısınıDurdur() {
        if (this.saldırı) {
            savaşiDurdur(this.saldırı);
            this.saldırı = null;
        }
    }
}

class Savaş {
    constructor(attan, hedef) {
        this.attan = attan;
        this.hedef = hedef;
        this.animasyon = "savaşAnimasyonu";
    }
}

class Animasyon {
    constructor(adi) {
        this.adi = adi;
    }
}

let korsanlar = [];
let kervanlar = [];
let tırlar = [];
let savaşlar = [];
let animasyonlar = [];

function korsanSaldırısınıBaslat(korsan, hedef) {
    korsan.saldırısınıBaslat(hedef);
}

function kervanınSaldırısınıBaslat(kervan, hedef) {
    kervan.saldırısınıBaslat(hedef);
}

function tırınSaldırısınıBaslat(tır, hedef) {
    tır.saldırısınıBaslat(hedef);
}

function savaşiBaslat(savaş) {
    savaşlar.push(savaş);
    // Savaşın görsel ve sesli animasyonlarını başlat
}

function animasyonuBaslat(animasyon) {
    animasyonlar.push(animasyon);
    // Animasyonun görsel ve sesli göstergelerini başlat
}

function korsanınSaldırısınıDurdur(korsan) {
    korsan.saldırısınıDurdur();
}

function kervanınSaldırısınıDurdur(kervan) {
    kervan.saldırısınıDurdur();
}

function tırınSaldırısınıDurdur(tır) {
    tır.saldırısınıDurdur();
}

function savaşiDurdur(savaş) {
    let index = savaşlar.indexOf(savaş);
    if (index !== -1) {
        savaşlar.splice(index, 1);
        // Savaşın görsel ve sesli animasyonlarını durdur
    }
}

function animasyonuDurdur(animasyon) {
    let index = animasyonlar.indexOf(animasyon);
    if (index !== -1) {
        animasyonlar.splice(index, 1);
        // Animasyonun görsel ve sesli göstergelerini durdur
    }
}