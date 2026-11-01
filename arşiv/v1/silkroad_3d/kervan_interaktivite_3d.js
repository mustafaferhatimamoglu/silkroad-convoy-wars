// kervan_interaktivite_3d.js

// KervanManager sınıfı
class KervanManager {
    constructor() {
        this.kervanModel = null;
        this.hareketDurumu = false;
        this.durum = 'durak';
    }

    hareketEt(hareketTip) {
        this.hareketDurumu = true;
        this.durum = hareketTip;
        console.log(`Kervan ${hareketTip} hareket ediyor.`);
    }

    durakla() {
        this.hareketDurumu = false;
        this.durum = 'durak';
        console.log('Kervan durakladı.');
    }

    vuruşYap() {
        this.durum = 'vuruş';
        console.log('Kervan vuruş yapıyor.');
    }
}

// EkipmanManager sınıfı
class EkipmanManager {
    constructor() {
        this.ekipmanlar = [];
    }

    ekipmanEkle(ekipman) {
        this.ekipmanlar.push(ekipman);
        console.log(`${ekipman} ekipmanı eklendi.`);
    }

    ekipmanKaldır(ekipman) {
        const index = this.ekipmanlar.indexOf(ekipman);
        if (index !== -1) {
            this.ekipmanlar.splice(index, 1);
            console.log(`${ekipman} ekipmanı kaldırıldı.`);
        } else {
            console.log(`${ekipman} ekipmanı bulunamadı.`);
        }
    }

    ekipmanKullan(ekipman) {
        console.log(`${ekipman} ekipmanı kullanılıyor.`);
    }
}

// InteraktiviteManager sınıfı
class InteraktiviteManager {
    constructor() {
        this.etkileşimler = [];
    }

    etkileşimEkle(etkileşim) {
        this.etkileşimler.push(etkileşim);
        console.log(`${etkileşim} etkileşimi eklendi.`);
    }

    etkileşimKaldır(etkileşim) {
        const index = this.etkileşimler.indexOf(etkileşim);
        if (index !== -1) {
            this.etkileşimler.splice(index, 1);
            console.log(`${etkileşim} etkileşimi kaldırıldı.`);
        } else {
            console.log(`${etkileşim} etkileşimi bulunamadı.`);
        }
    }

    etkileşimYap(etkileşim) {
        console.log(`${etkileşim} etkileşimi gerçekleştiriliyor.`);
    }
}

// SesManager sınıfı
class SesManager {
    constructor() {
        this.sesler = [];
    }

    sesEkle(ses) {
        this.sesler.push(ses);
        console.log(`${ses} sesi eklendi.`);
    }

    sesKaldır(ses) {
        const index = this.sesler.indexOf(ses);
        if (index !== -1) {
            this.sesler.splice(index, 1);
            console.log(`${ses} sesi kaldırıldı.`);
        } else {
            console.log(`${ses} sesi bulunamadı.`);
        }
    }

    sesOynat(ses) {
        console.log(`${ses} sesi oynatılıyor.`);
    }
}

// Kervan Interaktivite Modülü fonksiyonları
function initKervanInteraktivitesi() {
    kervanInteraktiviteModülü = new KervanManager();
    ekipmanManager = new EkipmanManager();
    interaktiviteManager = new InteraktiviteManager();
    sesManager = new SesManager();
}

function kervanHareketEt(hareketTip) {
    kervanInteraktiviteModülü.hareketEt(hareketTip);
}

function kervanDurakla() {
    kervanInteraktiviteModülü.durakla();
}

function kervanVuruşYap() {
    kervanInteraktiviteModülü.vuruşYap();
}

function ekipmanEkle(ekipman) {
    ekipmanManager.ekipmanEkle(ekipman);
}

function ekipmanKaldır(ekipman) {
    ekipmanManager.ekipmanKaldır(ekipman);
}

function ekipmanKullan(ekipman) {
    ekipmanManager.ekipmanKullan(ekipman);
}

function etkileşimEkle(etkileşim) {
    interaktiviteManager.etkileşimEkle(etkileşim);
}

function etkileşimKaldır(etkileşim) {
    interaktiviteManager.etkileşimKaldır(etkileşim);
}

function etkileşimYap(etkileşim) {
    interaktiviteManager.etkileşimYap(etkileşim);
}

function sesEkle(ses) {
    sesManager.sesEkle(ses);
}

function sesKaldır(ses) {
    sesManager.sesKaldır(ses);
}

function sesOynat(ses) {
    sesManager.sesOynat(ses);
}

// Kervan Interaktivite Modülü değişkenleri
let kervanInteraktiviteModülü;
let ekipmanManager;
let interaktiviteManager;
let sesManager;