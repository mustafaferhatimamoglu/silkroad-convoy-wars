class KervanAnimasyonSistemi {
    constructor() {
        this.kervanlar = [];
        this.kervanHareketleri = [];
    }

    kervanYarat(kervanModel) {
        this.kervanlar.push(kervanModel);
    }

    kervanHareketEkle(kervanID, hareket) {
        if (this.kervanlar.find(k => k.id === kervanID)) {
            this.kervanHareketleri.push({ kervanID, hareket });
        }
    }

    kervanHareketSil(kervanID, hareket) {
        this.kervanHareketleri = this.kervanHareketleri.filter(h => h.kervanID !== kervanID || h.hareket !== hareket);
    }
}

class KervanInteraktiviteSistemi {
    constructor() {
        this.kervanlar = [];
        this.interaktifEylemler = [];
    }

    interaktifEylemEkle(kervanID, eylem) {
        if (this.kervanlar.find(k => k.id === kervanID)) {
            this.interaktifEylemler.push({ kervanID, eylem });
        }
    }

    interaktifEylemSil(kervanID, eylem) {
        this.interaktifEylemler = this.interaktifEylemler.filter(e => e.kervanID !== kervanID || e.eylem !== eylem);
    }

    interaktifEylemÇalıştır(kervanID, eylem) {
        const eylemDegeri = this.interaktifEylemler.find(e => e.kervanID === kervanID && e.eylem === eylem);
        if (eylemDegeri) {
            console.log(`Interaktif eylem çalıştırıldı: ${eylemDegeri.eylem}`);
        }
    }
}

class KervanKontrol {
    constructor(kervanID, hareket, interaktifEylem) {
        this.kervanID = kervanID;
        this.hareket = hareket;
        this.interaktifEylem = interaktifEylem;
    }

    hareketGuncelle(nesne, yeniHareket) {
        nesne.hareket = yeniHareket;
    }

    interaktifEylemGuncelle(nesne, yeniEylem) {
        nesne.interaktifEylem = yeniEylem;
    }
}

function kervanHareketleriEkle(kervanID, hareket) {
    const sistem = new KervanAnimasyonSistemi();
    sistem.kervanHareketEkle(kervanID, hareket);
}

function kervanHareketleriSil(kervanID, hareket) {
    const sistem = new KervanAnimasyonSistemi();
    sistem.kervanHareketSil(kervanID, hareket);
}

function interaktifEylemlerEkle(kervanID, eylem) {
    const sistem = new KervanInteraktiviteSistemi();
    sistem.interaktifEylemEkle(kervanID, eylem);
}

function interaktifEylemlerSil(kervanID, eylem) {
    const sistem = new KervanInteraktiviteSistemi();
    sistem.interaktifEylemSil(kervanID, eylem);
}

function kervanInteraktifEylemÇalıştır(kervanID, eylem) {
    const sistem = new KervanInteraktiviteSistemi();
    sistem.interaktifEylemÇalıştır(kervanID, eylem);
}

const kervanlarListesi = [];
const kervanHareketleriListesi = [];
const interaktifEylemlerListesi = [];