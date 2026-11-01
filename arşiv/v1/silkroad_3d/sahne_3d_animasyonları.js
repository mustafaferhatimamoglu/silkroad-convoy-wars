class Sahne {
    constructor(id, konumu, yükseklik, genişlik) {
        this.id = id;
        this.konumu = konumu;
        this.yükseklik = yükseklik;
        this.genişlik = genişlik;
    }

    yarat() {
        // Sahne oluşturma işlemleri
    }

    yükle() {
        // Sahne yükleme işlemleri
    }

    kapat() {
        // Sahne kapatma işlemleri
    }

    hareket_et() {
        // Sahne hareket etme işlemleri
    }

    görünümünü_değiştir() {
        // Sahne görünümünü değiştirme işlemleri
    }
}

class Kervan {
    constructor(id, yönlü, hız) {
        this.id = id;
        this.yönlü = yönlü;
        this.hız = hız;
    }

    yarat() {
        // Kervan oluşturma işlemleri
    }

    yükle() {
        // Kervan yükleme işlemleri
    }

    hareket_et() {
        // Kervan hareket etme işlemleri
    }

    yolunu_değiştir() {
        // Kervan yolunu değiştirme işlemleri
    }
}

class Korsan {
    constructor(id, hız, gücü) {
        this.id = id;
        this.hız = hız;
        this.güçü = gücü;
    }

    yarat() {
        // Korsan oluşturma işlemleri
    }

    yükle() {
        // Korsan yükleme işlemleri
    }

    hareket_et() {
        // Korsan hareket etme işlemleri
    }

    saldırıları_gerçekleştirdir() {
        // Korsan saldırıları gerçekleştirme işlemleri
    }
}

class Seviye {
    constructor(id, gezegen, zorluk) {
        this.id = id;
        this.gezegen = gezegen;
        this.zorluk = zorluk;
    }

    yarat() {
        // Seviye oluşturma işlemleri
    }

    yükle() {
        // Seviye yükleme işlemleri
    }

    kapat() {
        // Seviye kapatma işlemleri
    }

    gezegeni_gerçekleştirdir() {
        // Seviyenin gezegenini gerçekleştirmek için gerekli işlemler
    }
}

class Çatışma {
    constructor(id, katılımcılar, sonuç) {
        this.id = id;
        this.katılımcılar = katılımcılar;
        this.sonuç = sonuç;
    }

    yarat() {
        // Çatışma oluşturma işlemleri
    }

    yükle() {
        // Çatışma yükleme işlemleri
    }

    gerçekleştirdir() {
        // Çatışmayı gerçekleştirmek için gerekli işlemler
    }

    sonucu_göster() {
        // Çatışmanın sonucunu gösterme işlemleri
    }
}

// Değişkenler
let sahneListesi = [];
let kervanListesi = [];
let korsanListesi = [];
let seviyeListesi = [];
let çatışmaListesi = [];