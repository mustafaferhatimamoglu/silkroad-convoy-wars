class KervanManager {
    constructor() {
        this.kervanListesi = [];
        this.kervanTahsisatListesi = [];
        this.kervanTicariIslemleri = [];
    }

    yeniKervanOlustur(kervan) {
        this.kervanListesi.push(kervan);
    }

    kervaniSil(kervanID) {
        this.kervanListesi = this.kervanListesi.filter(k => k.modelID !== kervanID);
    }

    kervaniTahsisatYap(kervanID, tahsisat) {
        this.kervanTahsisatListesi.push({ kervanID, tahsisat });
    }

    kervaniTicariIslemleriYap(kervanID, islemType, miktart) {
        this.kervanTicariIslemleri.push({ kervanID, islemType, miktart });
    }

    kervaniGuncelle(kervanID, yeniBilgi) {
        let kervan = this.kervanListesi.find(k => k.modelID === kervanID);
        if (kervan) {
            Object.assign(kervan, yeniBilgi);
        }
    }
}

class TahsisatManager {
    constructor() {
        this.tahsisatListesi = [];
        this.tahsisatKontrolListesi = [];
    }

    yeniTahsisatOlustur(tahsisat) {
        this.tahsisatListesi.push(tahsisat);
    }

    tahsisatiSil(tahsisatID) {
        this.tahsisatListesi = this.tahsisatListesi.filter(t => t.tahsisatID !== tahsisatID);
    }

    tahsisatiGuncelle(tahsisatID, yeniBilgi) {
        let tahsisat = this.tahsisatListesi.find(t => t.tahsisatID === tahsisatID);
        if (tahsisat) {
            Object.assign(tahsisat, yeniBilgi);
        }
    }
}

class TicariManager {
    constructor() {
        this.ticariListesi = [];
        this.ticariIslemListesi = [];
    }

    yeniTicariOlustur(ticari) {
        this.ticariListesi.push(ticari);
    }

    ticariyiSil(ticariID) {
        this.ticariListesi = this.ticariListesi.filter(t => t.ticariID !== ticariID);
    }

    ticariyiGuncelle(ticariID, yeniBilgi) {
        let ticari = this.ticariListesi.find(t => t.ticariID === ticariID);
        if (ticari) {
            Object.assign(ticari, yeniBilgi);
        }
    }

    ticariIslemYap(ticariID, islemType, miktart) {
        this.ticariIslemListesi.push({ ticariID, islemType, miktart });
    }
}

class KervanModel {
    constructor() {
        this.modelID = null;
        this.modelBilgileri = {};
    }

    modeliYukle(modelID) {
        this.modelID = modelID;
        this.modelBilgileri = { /* Model bilgileri */ };
    }

    modeliGuncelle(modelID, yeniBilgi) {
        if (this.modelID === modelID) {
            Object.assign(this.modelBilgileri, yeniBilgi);
        }
    }

    modeliSil(modelID) {
        if (this.modelID === modelID) {
            this.modelID = null;
            this.modelBilgileri = {};
        }
    }
}

class KervanAnimasyon {
    constructor() {
        this.animasyonID = null;
        this.animasyonBilgileri = {};
    }

    animasyonuYukle(animasyonID) {
        this.animasyonID = animasyonID;
        this.animasyonBilgileri = { /* Animasyon bilgileri */ };
    }

    animasyonuGuncelle(animasyonID, yeniBilgi) {
        if (this.animasyonID === animasyonID) {
            Object.assign(this.animasyonBilgileri, yeniBilgi);
        }
    }

    animasyonuSil(animasyonID) {
        if (this.animasyonID === animasyonID) {
            this.animasyonID = null;
            this.animasyonBilgileri = {};
        }
    }
}

function kervaniYonlendir(kervanID, yon) {
    // Kervani belirli bir yönüne yönlendirir.
}

function tahsisatiOnayla(tahsisatID) {
    // Tahsisati onaylar.
}

function ticariIslemiYap(ticariID, islemType, miktart) {
    // Ticari işlemi yapar.
}

function kervaniDurumGuncelle(kervanID, durum) {
    // Kervanin durumunu günceller.
}