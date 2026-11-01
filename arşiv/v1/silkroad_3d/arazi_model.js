class AraziModel {
    constructor() {
        this.yollar = [];
        this.naturlar = [];
        this.kervanlar = [];
        this.cesitler = [];
        this.oyuncular = [];
        this.sesler = new CevreselSesler();
        this.kamera = new TPSFPSCamera();
        this.levelManager = new LevelManager();
        this.levelSistemi = new LevelSistemi();
    }

    EkleYol(yol) {
        this.yollar.push(yol);
    }

    EkleNaturlar(naturlar) {
        this.naturlar.push(naturlar);
    }

    EkleKervan(kervan) {
        this.kervanlar.push(kervan);
    }

    EkleCesit(cesit) {
        this.cesitler.push(cesit);
    }

    EkleOyuncu(oyuncu) {
        this.oyuncular.push(oyuncu);
    }

    SesYayınEt(sesAdi) {
        this.sesler.Yayin(sesAdi);
    }

    KameraKontrol(etkileyici) {
        this.kamera.Kontrol(etkileyici);
    }

    LevelYükle(levelAdi) {
        this.levelManager.Yükle(levelAdi);
    }

    LevelGuncelle() {
        this.levelSistemi.Guncelle();
    }
}

class Yol {
    constructor(isim, uzunluk) {
        this.isim = isim;
        this.uzunluk = uzunluk;
    }
}

class Naturlar {
    constructor(isim, tip) {
        this.isim = isim;
        this.tip = tip;
    }
}

class Kervan {
    constructor(isim, kapasite) {
        this.isim = isim;
        this.kapasite = kapasite;
    }
}

class Cesit {
    constructor(isim, miktar) {
        this.isim = isim;
        this.miktar = miktar;
    }
}

class Oyuncu {
    constructor(isim, level) {
        this.isim = isim;
        this.level = level;
    }
}

class CevreselSesler {
    Yayin(sesAdi) {
        console.log(`Ses: ${sesAdi} yayınlanıyor.`);
    }
}

class TPSFPSCamera {
    Kontrol(etkileyici) {
        console.log(`Kamera kontrolü: ${etkileyici}`);
    }
}

class LevelManager {
    Yükle(levelAdi) {
        console.log(`Level yüklendi: ${levelAdi}`);
    }
}

class LevelSistemi {
    Guncelle() {
        console.log("Level güncelleniyor.");
    }
}