// kervan_3d_interaktivite.js

class KervanInteraktiviteManager {
    constructor() {
        this.kervanModel = null;
        this.kamerakontrol = null;
        this.interaktiviteTutucu = {};
        this.etkileşimListesi = [];
        this.oyuncu = null;
    }

    init() {
        // Kervan modelini ve kamerayı yükle
        // Interaktivite nesnelerini oluştur ve ekleyin
        // Oyuncu nesnesini initialize edin
    }

    interaktifEtkileşimEkle(nesne) {
        this.interaktiviteTutucu[nesne.id] = nesne;
        this.etkileşimListesi.push(nesne);
    }

    interaktifEtkileşimKaldır(nesne) {
        delete this.interaktiviteTutucu[nesne.id];
        this.etkileşimListesi = this.etkileşimListesi.filter(e => e.id !== nesne.id);
    }

    interaktifEtkileşimYap(nesne) {
        // Kervanla etkileşime geçiş yap
    }

    interaktifEtkileşimKapat(nesne) {
        // Kervanla etkileşime geçişi kapat
    }

    interaktifEtkileşimGuncelle() {
        // Interaktif etkileşimleri güncelle
    }
}

class KervanInteraktivite {
    constructor(nesne) {
        this.nesne = nesne;
        this.interaktifEtkileşim = null;
    }

    interaktifEtkileşimYap() {
        // Etkileşime geçiş yap
    }

    interaktifEtkileşimKapat() {
        // Etkileşime geçişi kapat
    }

    interaktifEtkileşimGuncelle() {
        // Etkileşimi güncelle
    }
}

class KervanInteraktiviteSistemleri {
    constructor() {
        this.interaktiviteListesi = [];
    }

    sistemEkle(sistem) {
        this.interaktiviteListesi.push(sistem);
    }

    sistemKaldır(sistem) {
        this.interaktiviteListesi = this.interaktiviteListesi.filter(s => s !== sistem);
    }

    sistemleriGuncelle() {
        // Interaktivite sistemlerini güncelle
    }
}

function initKervanInteraktivite() {
    interaktiviteManager = new KervanInteraktiviteManager();
    interaktiviteManager.init();
}

function ekleInteraktifEtkileşim(nesne) {
    interaktiviteManager.interaktifEtkileşimEkle(nesne);
}

function kaldırInteraktifEtkileşim(nesne) {
    interaktiviteManager.interaktifEtkileşimKaldır(nesne);
}

function interaktifEtkileşimYap(nesne) {
    interaktiviteManager.interaktifEtkileşimYap(nesne);
}

function interaktifEtkileşimKapat(nesne) {
    interaktiviteManager.interaktifEtkileşimKapat(nesne);
}

function interaktifEtkileşimGuncelle(nesne) {
    interaktiviteManager.interaktifEtkileşimGuncelle(nesne);
}

let interaktiviteManager;
let interaktiviteListesi = [];