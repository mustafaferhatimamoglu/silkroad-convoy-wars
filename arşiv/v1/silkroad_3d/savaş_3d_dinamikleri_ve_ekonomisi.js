// savaş_3d_dinamikleri_ve_ekonomisi.js

class Savaş {
    constructor(isim) {
        this.isim = isim;
        this.partisanlar = [];
        this.noktalar = [];
    }

    eklePartisan(partisan) {
        this.partisanlar.push(partisan);
    }

    ekleNokta(nokta) {
        this.noktalar.push(nokta);
    }

    guncelle() {
        // Savaşın güncellemeleri
    }
}

class Partisan {
    constructor(isim, tur, pozisyon) {
        this.isim = isim;
        this.tur = tur;
        this.pozisyon = pozisyon;
        this.kuvvet = 0;
    }

    guncelle() {
        // Partisanın güncellemeleri
    }
}

class Nokta {
    constructor(pozisyon) {
        this.pozisyon = pozisyon;
    }
}

class SavaşDinamikleri {
    constructor() {
        this.savaşlar = [];
        this.oyuncular = [];
        this.ekonomi = new Ekonomi();
    }

    yarat(isim) {
        return new Savaş(isim);
    }

    ekleSavaş(savaş) {
        this.savaşlar.push(savaş);
    }

    silSavaş(savaş) {
        const index = this.savaşlar.indexOf(savaş);
        if (index !== -1) {
            this.savaşlar.splice(index, 1);
        }
    }

    guncelle() {
        this.savaşlar.forEach(savaş => savaş.guncelle());
        this.oyuncular.forEach(oyuncu => oyuncu.guncelle());
        this.ekonomi.guncelle();
    }

    ekleOyuncu(oyuncu) {
        this.oyuncular.push(oyuncu);
    }

    silOyuncu(oyuncu) {
        const index = this.oyuncular.indexOf(oyuncu);
        if (index !== -1) {
            this.oyuncular.splice(index, 1);
        }
    }
}

class Oyuncu {
    constructor(id, isim, level, STR, INT) {
        this.id = id;
        this.isim = isim;
        this.level = level;
        this.STR = STR;
        this.INT = INT;
        this.kervan = [];
    }

    guncelle() {
        // Oyuncunun güncellemeleri
    }

    kervanGuncelle() {
        // Oyuncunun kervanının güncellemeleri
    }
}

class Ekonomi {
    constructor() {
        this.para = 0;
        this.malzeme = 0;
    }

    paraArtir(miktar) {
        this.para += miktar;
    }

    paraAzalt(miktar) {
        this.para -= miktar;
    }

    malzemeArtir(miktar) {
        this.malzeme += miktar;
    }

    malzemeAzalt(miktar) {
        this.malzeme -= miktar;
    }

    guncelle() {
        // Ekonomi güncellemeleri
    }
}

// Fonksiyonlar
function savaşYarat(isim) {
    return new Savaş(isim);
}

function savaşEkle(savaş) {
    savaşlar.push(savaş);
}

function savaşSil(savaş) {
    const index = savaşlar.indexOf(savaş);
    if (index !== -1) {
        savaşlar.splice(index, 1);
    }
}

function oyuncuEkle(oyuncu) {
    oyuncular.push(oyuncu);
}

function oyuncuSil(oyuncu) {
    const index = oyuncular.indexOf(oyuncu);
    if (index !== -1) {
        oyuncular.splice(index, 1);
    }
}

function paraArtir(miktar) {
    ekonomi.paraArtir(miktar);
}

function paraAzalt(miktar) {
    ekonomi.paraAzalt(miktar);
}

function malzemeArtir(miktar) {
    ekonomi.malzemeArtir(miktar);
}

function malzemeAzalt(miktar) {
    ekonomi.malzemeAzalt(miktar);
}

// Değişkenler
let savaşlar = [];
let oyuncular = [];
let ekonomi = new Ekonomi();