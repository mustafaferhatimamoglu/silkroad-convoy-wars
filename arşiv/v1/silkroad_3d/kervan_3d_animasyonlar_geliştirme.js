class KervanAnimasyonu {
    constructor(model, hiz, konum, rotasyon) {
        this.model = model;
        this.hiz = hiz;
        this.konum = konum;
        this.rotasyon = rotasyon;
    }

    hizayiGuncelle(hiz) {
        this.hiz = hiz;
    }

    konumuGuncelle(konum) {
        this.konum = konum;
    }

    rotasyonuGuncelle(rotasyon) {
        this.rotasyon = rotasyon;
    }

    animasyonBaslat() {
        // Animasyonu başlatma kodları
    }

    animasyonDurdur() {
        // Animasyonu durdurma kodları
    }

    simyaArtir() {
        // Simya artırmayı kodları
    }

    zerkArtir() {
        // Zerk artırmayı kodları
    }

    tahsilatYap() {
        // Tahsilatı yapma kodları
    }
}

class KervanTahsisati {
    constructor(tahsisatMiktari, tahsisatTipi) {
        this.tahsisatMiktari = tahsisatMiktari;
        this.tahsisatTipi = tahsisatTipi;
    }

    tahsisatYap() {
        // Tahsisatı yapma kodları
    }

    tahsisatGuncelle(miktar) {
        this.tahsisatMiktari = miktar;
    }

    tahsisatTipiGuncelle(tip) {
        this.tahsisatTipi = tip;
    }
}

class KervanTicari {
    constructor(fiyat, urun) {
        this.fiyat = fiyat;
        this.urun = urun;
    }

    ticaretYap(urun) {
        // Ticaret yapma kodları
    }

    fiyatGuncelle(yeniFiyat) {
        this.fiyat = yeniFiyat;
    }

    urunGuncelle(yeniUrun) {
        this.urun = yeniUrun;
    }
}

class KervanSaldırısı {
    constructor(saldırıDuruumu, saldırıTipi) {
        this.saldırıDuruumu = saldırıDuruumu;
        this.saldırıTipi = saldırıTipi;
    }

    saldırıYap() {
        // Saldırıyı yapma kodları
    }

    saldırıTipiGuncelle(tip) {
        this.saldırıTipi = tip;
    }

    saldırıDuruumuGuncelle(durum) {
        this.saldırıDuruumu = durum;
    }
}

class KervanEkoSistemi {
    constructor(str, int) {
        this.str = str;
        this.int = int;
    }

    strGuncelle(yeniSTR) {
        this.str = yeniSTR;
    }

    intGuncelle(yeniINT) {
        this.int = yeniINT;
    }

    lojistikYap() {
        // Lojistik işlemleri yapma kodları
    }
}

class KervanSahne {
    constructor(sahneModeli, sahneKonumu) {
        this.sahneModeli = sahneModeli;
        this.sahneKonumu = sahneKonumu;
    }

    sahneGuncelle(konum) {
        this.sahneKonumu = konum;
    }

    sahneModeliGuncelle(model) {
        this.sahneModeli = model;
    }

    sahneAnimasyonBaslat() {
        // Sahne animasyonu başlatma kodları
    }

    sahneAnimasyonDurdur() {
        // Sahne animasyonu durdurma kodları
    }
}

function kervanAnimasyonuDuzenle(kervan, hiz, konum, rotasyon) {
    kervan.hizayiGuncelle(hiz);
    kervan.konumuGuncelle(konum);
    kervan.rotasyonuGuncelle(rotasyon);
    kervan.animasyonBaslat();
}

function kervanTahsisatDuzenle(tahsisat, tahsisatMiktari, tahsisatTipi) {
    tahsisat.tahsisatGuncelle(tahsisatMiktari);
    tahsisat.tahsisatTipiGuncelle(tahsisatTipi);
    tahsisat.tahsisatYap();
}

function kervanTicariDuzenle(ticari, fiyat, urun) {
    ticari.fiyatGuncelle(fiyat);
    ticari.urunGuncelle(urun);
    ticari.ticaretYap(urun);
}

function kervanSaldırıDuzenle(saldırı, saldırıDuruumu, saldırıTipi) {
    saldırı.saldırıDuruumuGuncelle(saldırıDuruumu);
    saldırı.saldırıTipiGuncelle(saldırıTipi);
    saldırı.saldırıYap();
}

function kervanEkoSistemiDuzenle(eko, str, int) {
    eko.strGuncelle(str);
    eko.intGuncelle(int);
    eko.lojistikYap();
}

function kervanSahneDuzenle(sahne, sahneModeli, sahneKonumu) {
    sahne.sahneModeliGuncelle(sahneModeli);
    sahne.sahneGuncelle(sahneKonumu);
    sahne.sahneAnimasyonBaslat();
}

let kervanAnimasyonlar = [];
let kervanTahsisatlar = [];
let kervanTicari = [];
let kervanSaldırılar = [];
let kervanEkoSistemleri = [];
let kervanSahneler = [];