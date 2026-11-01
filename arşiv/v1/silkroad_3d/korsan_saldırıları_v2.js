class KorsanSaldırısı {
    constructor(saldırıID, saldırıZamanı, saldırıTipi, saldırııcıID, hedefID) {
        this.saldırıID = saldırıID;
        this.saldırıcıID = saldırııcıID;
        this.hedefID = hedefID;
        this.saldırıZamanı = saldırıZamanı;
        this.saldırıTipi = saldırıTipi;
    }

    saldırıyüGönder() {
        console.log(`Saldırı ${this.saldırıID} gönderildi.`);
    }

    saldırıyüİptalEt() {
        console.log(`Saldırı ${this.saldırıID} iptal edildi.`);
    }

    saldırıyüRaporEt() {
        console.log(`Saldırı ${this.saldırıID} hakkında rapor oluşturuldu.`);
    }
}

class SaldırıAnimasyonu {
    constructor(animasyonID, saldırıID, animasyonTipi, animasyonZamanı) {
        this.animasyonID = animasyonID;
        this.saldırıID = saldırıID;
        this.animasyonTipi = animasyonTipi;
        this.animasyonZamanı = animasyonZamanı;
    }

    animasyonuBaşlat() {
        console.log(`Animasyon ${this.animasyonID} başlatıldı.`);
    }

    animasyonuDurdur() {
        console.log(`Animasyon ${this.animasyonID} durduruldu.`);
    }

    animasyonuGeriAl() {
        console.log(`Animasyon ${this.animasyonID} geri alındı.`);
    }
}

class SavaşSonucu {
    constructor(savaşID, kazananID, kaybedenID, savaşSonucuZamanı, savaşSonucuTipi) {
        this.savaşID = savaşID;
        this.kazananID = kazananID;
        this.kaybedenID = kaybedenID;
        this.savaşSonucuZamanı = savaşSonucuZamanı;
        this.savaşSonucuTipi = savaşSonucuTipi;
    }

    sonucuGöster() {
        console.log(`Savaş ${this.savaşID} sonucu gösterildi.`);
    }

    sonucuKaydet() {
        console.log(`Savaş ${this.savaşID} sonucu kaydedildi.`);
    }

    sonucuSıfırla() {
        console.log(`Savaş ${this.savaşID} sonucu sıfırlandı.`);
    }
}

let saldırılar = [];
let animasyonlar = [];
let savaşlar = [];

function saldırıOluştur(saldırıcıID, hedefID, saldırıZamanı, saldırıTipi) {
    let saldırı = new KorsanSaldırısı(saldırılar.length + 1, saldırıZamanı, saldırıTipi, saldırııcıID, hedefID);
    saldırılar.push(saldırı);
    return saldırı;
}

function saldırıAnimasyonuOluştur(saldırıID, animasyonTipi, animasyonZamanı) {
    let animasyon = new SaldırıAnimasyonu(animasyonlar.length + 1, saldırıID, animasyonTipi, animasyonZamanı);
    animasyonlar.push(animasyon);
    return animasyon;
}

function savaşSonucuOluştur(kazananID, kaybedenID, savaşSonucuZamanı, savaşSonucuTipi) {
    let sonuc = new SavaşSonucu(savaşlar.length + 1, kazananID, kaybedenID, savaşSonucuZamanı, savaşSonucuTipi);
    savaşlar.push(sonuc);
    return sonuc;
}

function saldırıyüGönder(saldırıID) {
    let saldırı = saldırılar.find(saldırı => saldırı.saldırıID === saldırıID);
    if (saldırı) {
        saldırı.saldırıyıGönder();
    } else {
        console.log(`Saldırı ${saldırıID} bulunamadı.`);
    }
}

function saldırıyüİptalEt(saldırıID) {
    let saldırı = saldırılar.find(saldırı => saldırı.saldırıID === saldırıID);
    if (saldırı) {
        saldırı.saldırıyıİptalEt();
    } else {
        console.log(`Saldırı ${saldırıID} bulunamadı.`);
    }
}

function saldırıyüRaporEt(saldırıID) {
    let saldırı = saldırılar.find(saldırı => saldırı.saldırıID === saldırıID);
    if (saldırı) {
        saldırı.saldırıyıRaporEt();
    } else {
        console.log(`Saldırı ${saldırıID} bulunamadı.`);
    }
}

function animasyonuBaşlat(animasyonID) {
    let animasyon = animasyonlar.find(animasyon => animasyon.animasyonID === animasyonID);
    if (animasyon) {
        animasyon.animasyonuBaşlat();
    } else {
        console.log(`Animasyon ${animasyonID} bulunamadı.`);
    }
}

function animasyonuDurdur(animasyonID) {
    let animasyon = animasyonlar.find(animasyon => animasyon.animasyonID === animasyonID);
    if (animasyon) {
        animasyon.animasyonuDurdur();
    } else {
        console.log(`Animasyon ${animasyonID} bulunamadı.`);
    }
}

function animasyonuGeriAl(animasyonID) {
    let animasyon = animasyonlar.find(animasyon => animasyon.animasyonID === animasyonID);
    if (animasyon) {
        animasyon.animasyonuGeriAl();
    } else {
        console.log(`Animasyon ${animasyonID} bulunamadı.`);
    }
}

function sonucuGöster(savaşID) {
    let sonuc = savaşlar.find(sonuc => sonuc.savaşID === savaşID);
    if (sonuc) {
        sonuc.sonucuGöster();
    } else {
        console.log(`Savaş ${savaşID} bulunamadı.`);
    }
}

function sonucuKaydet(savaşID) {
    let sonuc = savaşlar.find(sonuc => sonuc.savaşID === savaşID);
    if (sonuc) {
        sonuc.sonucuKaydet();
    } else {
        console.log(`Savaş ${savaşID} bulunamadı.`);
    }
}

function sonucuSıfırla(savaşID) {
    let sonuc = savaşlar.find(sonuc => sonuc.savaşID === savaşID);
    if (sonuc) {
        sonuc.sonucuSıfırla();
    } else {
        console.log(`Savaş ${savaşID} bulunamadı.`);
    }
}