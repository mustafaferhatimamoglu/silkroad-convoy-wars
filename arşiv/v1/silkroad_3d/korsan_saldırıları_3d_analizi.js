// korsan_saldırıları_3d_analizi.js

// Veri tabanındaki tüm korsan saldırılarını içeren dizi
let korsanSaldırılar = [];

// Farklı korsan saldırı türlerine özgü analiz fonksiyonlarını içeren nesne
let analizFonksiyonları = {
    "tip1": (saldırı) => {
        // Analiz işlemleri
        return "Analiz Sonucu 1";
    },
    "tip2": (saldırı) => {
        // Analiz işlemleri
        return "Analiz Sonucu 2";
    }
};

// Korsan Saldırı Sınıfı
class KorsanSaldırı {
    constructor(saldırıID, saldırıTipi, saldırıZamanı, saldırıKonumu) {
        this.saldırıID = saldırıID;
        this.saldırıTipi = saldırıTipi;
        this.saldırıZamanı = saldırıZamanı;
        this.saldırıKonumu = saldırıKonumu;
    }

    setSaldırıID(saldırıID) {
        this.saldırıID = saldırıID;
    }

    setSaldırıTipi(saldırıTipi) {
        this.saldırıTipi = saldırıTipi;
    }

    setSaldırıZamanı(saldırıZamanı) {
        this.saldırıZamanı = saldırıZamanı;
    }

    setSaldırıKonumu(saldırıKonumu) {
        this.saldırıKonumu = saldırıKonumu;
    }

    getSaldırıID() {
        return this.saldırıID;
    }

    getSaldırıTipi() {
        return this.saldırıTipi;
    }

    getSaldırıZamanı() {
        return this.saldırıZamanı;
    }

    getSaldırıKonumu() {
        return this.saldırıKonumu;
    }
}

// Korsan Saldırı Analizi Sınıfı
class KorsanSaldırıAnalizi {
    constructor(saldırıID, analizSonucu, rapor) {
        this.saldırıID = saldırıID;
        this.analizSonucu = analizSonucu;
        this.rapor = rapor;
    }

    setSaldırıID(saldırıID) {
        this.saldırıID = saldırıID;
    }

    setAnalizSonucu(analizSonucu) {
        this.analizSonucu = analizSonucu;
    }

    setRapor(rapor) {
        this.rapor = rapor;
    }

    getSaldırıID() {
        return this.saldırıID;
    }

    getAnalizSonucu() {
        return this.analizSonucu;
    }

    getRapor() {
        return this.rapor;
    }
}

// Fonksiyonlar

function addKorsanSaldırısı(saldırı) {
    korsanSaldırılar.push(saldırı);
}

function getKorsanSaldırılar() {
    return korsanSaldırılar;
}

function analyzeSaldırı(saldırı) {
    if (analizFonksiyonları[saldırı.saldırıTipi]) {
        return analizFonksiyonları[saldırı.saldırıTipi](saldırı);
    }
    return "Analiz Fonksiyonu Yok";
}

function generateReport(saldırı) {
    let rapor = "Korsan Saldırı Raporu:\n";
    rapor += "ID: " + saldırı.saldırıID + "\n";
    rapor += "Tipi: " + saldırı.saldırıTipi + "\n";
    rapor += "Zamanı: " + saldırı.saldırıZamanı + "\n";
    rapor += "Konumu: " + saldırı.saldırıKonumu + "\n";
    rapor += "Analiz Sonucu: " + analyzeSaldırı(saldırı) + "\n";
    return rapor;
}

function updateSaldırı(saldırıID, saldırı) {
    let index = korsanSaldırılar.findIndex(saldırı => saldırıID === saldırı.saldırıID);
    if (index !== -1) {
        korsanSaldırılar[index] = saldırı;
    }
}

function deleteSaldırı(saldırıID) {
    korsanSaldırılar = korsanSaldırılar.filter(saldırı => saldırıID !== saldırı.saldırıID);
}