// 3d_kervan_ticari_islemleri_v6.js

class Kervan {
    constructor(id, malzeme) {
        this.id = id;
        this.malzeme = malzeme;
        this.durum = 'hareket ediyor';
    }

    tahsisatYap(malzemeID, miktar) {
        // Tahsisat logikleri burada
        console.log(`Kervan ${this.id}: ${miktar} adet ${malzemeID} tahsisatı yapıldı.`);
    }

    saticiGoruntule() {
        // Satıcı görünümü logicleri burada
        console.log(`Kervan ${this.id}: Satıcı görünümü açıldı.`);
    }
}

class Satıcı {
    constructor(id, ad) {
        this.id = id;
        this.ad = ad;
    }
}

class Malzeme {
    constructor(ad, miktar) {
        this.ad = ad;
        this.miktar = miktar;
    }
}

class KervanManager {
    constructor() {
        this.kervanlar = [];
        this.kervanDurumu = 'duruyor';
    }

    yeniKervanOlustur() {
        const kervan = new Kervan(this.kervanlar.length + 1, null);
        this.kervanlar.push(kervan);
        return kervan;
    }

    kervaniYukle(kervanID) {
        // Kervan yükleme logikleri burada
        console.log(`Kervan ${kervanID}: Yükleniyor.`);
    }

    kervaniTahsisatYap(kervanID, malzemeID, miktar) {
        const kervan = this.kervanlar.find(k => k.id === kervanID);
        if (kervan) {
            kervan.tahsisatYap(malzemeID, miktar);
        } else {
            console.log(`Kervan ${kervanID}: Bulunamadı.`);
        }
    }

    kervaniSaticiGoruntule(kervanID) {
        const kervan = this.kervanlar.find(k => k.id === kervanID);
        if (kervan) {
            kervan.saticiGoruntule();
        } else {
            console.log(`Kervan ${kervanID}: Bulunamadı.`);
        }
    }
}

class TicariIslem {
    constructor(id, kervanID, satıcıID, malzemeID, miktar) {
        this.id = id;
        this.kervanID = kervanID;
        this.satıcıID = satıcıID;
        this.malzemeID = malzemeID;
        this.miktar = miktar;
        this.durum = 'yapıldı';
    }

    yap() {
        // Ticari işlem logikleri burada
        console.log(`Ticari İşlem ${this.id}: Gerçekleştirildi.`);
    }

    iptalEt() {
        // Ticari işlem iptal logikleri burada
        console.log(`Ticari İşlem ${this.id}: İptal Edildi.`);
    }
}

class TicariIslemManager {
    constructor() {
        this.ticariIslemler = [];
        this.satıcılar = [];
    }

    yeniTicariIslemOlustur(kervanID, satıcıID, malzemeID, miktar) {
        const islem = new TicariIslem(this.ticariIslemler.length + 1, kervanID, satıcıID, malzemeID, miktar);
        this.ticariIslemler.push(islem);
        return islem;
    }

    ticariIslemiYap(islemID) {
        const islem = this.ticariIslemler.find(islem => islem.id === islemID);
        if (islem) {
            islem.yap();
        } else {
            console.log(`Ticari İşlem ${islemID}: Bulunamadı.`);
        }
    }

    ticariIslemiIptalEt(islemID) {
        const islem = this.ticariIslemler.find(islem => islem.id === islemID);
        if (islem) {
            islem.iptalEt();
        } else {
            console.log(`Ticari İşlem ${islemID}: Bulunamadı.`);
        }
    }
}

class MalzemeManager {
    constructor() {
        this.malzemeListesi = [];
    }

    yeniMalzemeEkle(malzemeAdi, miktar) {
        const malzeme = new Malzeme(malzemeAdi, miktar);
        this.malzemeListesi.push(malzeme);
        return malzeme;
    }

    malzemeKullan(malzemeAdi, miktar) {
        const malzeme = this.malzemeListesi.find(malzeme => malzeme.ad === malzemeAdi);
        if (malzeme && malzeme.miktar >= miktar) {
            malzeme.miktar -= miktar;
            console.log(`${miktar} adet ${malzemeAdi}: Kullanıldı. Kalan Miktar: ${malzeme.miktar}`);
        } else if (malzeme) {
            console.log(`Yeterli miktar ${malzemeAdi} bulunmamaktadır.`);
        } else {
            console.log(`${malzemeAdi}: Mevcut değil.`);
        }
    }
}

function initKervanManager() {
    return new KervanManager();
}

function initTicariIslemManager() {
    return new TicariIslemManager();
}

function initMalzemeManager() {
    return new MalzemeManager();
}

// Örnek Kullanım
kervanManager = initKervanManager();
ticariIslemManager = initTicariIslemManager();
malzemeManager = initMalzemeManager();

const yeniKervan = kervanManager.yeniKervanOlustur();
kervanManager.kervaniYukle(1);
kervanManager.kervaniTahsisatYap(1, 'Kahve', 10);
kervanManager.kervaniSaticiGoruntule(1);

const yeniTicariIslem = ticariIslemManager.yeniTicariIslemOlustur(1, 1, 'Kahve', 5);
ticariIslemManager.ticariIslemiYap(1);
ticariIslemManager.ticariIslemiIptalEt(1);

malzemeManager.yeniMalzemeEkle('Kahve', 100);
malzemeManager.malzemeKullan('Kahve', 50);