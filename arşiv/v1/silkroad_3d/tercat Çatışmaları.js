// tercatÇatışmaları.js

class TercatÇatışması {
    constructor(tercatÇatışmaNoktaları, tercatÇatışmaDinamikleri) {
        this.tercatÇatışmaNoktaları = tercatÇatışmaNoktaları;
        this.tercatÇatışmaDinamikleri = tercatÇatışmaDinamikleri;
        this.tercatÇatışmaEtkisiListesi = [];
        this.tercatÇatışmaSessizlikListesi = [];
        this.tercatÇatışmaGüvenlikListesi = [];
        this.tercatÇatışmaKontrolListesi = [];
    }

    tercatÇatışmaEtkisi(tercatÇatışmaEtkisiListesi) {
        this.tercatÇatışmaEtkisiListesi = tercatÇatışmaEtkisiListesi;
        return this.tercatÇatışmaEtkisiListesi;
    }

    tercatÇatışmaSessizlik(tercatÇatışmaNoktaları) {
        this.tercatÇatışmaSessizlikListesi = tercatÇatışmaNoktaları.map(nokta => {
            return { nokta, sessizlik: Math.random() * 100 }; // Rastgele sessizlik değerleri
        });
        return this.tercatÇatışmaSessizlikListesi;
    }

    tercatÇatışmaGüvenlik(tercatÇatışmaDinamikleri) {
        this.tercatÇatışmaGüvenlikListesi = tercatÇatışmaDinamikleri.map(dinamik => {
            return { dinamik, güvenlik: Math.random() * 100 }; // Rastgele güvenlik değerleri
        });
        return this.tercatÇatışmaGüvenlikListesi;
    }

    tercatÇatışmaKontrol(tercatÇatışmaNoktaları, tercatÇatışmaDinamikleri) {
        this.tercatÇatışmaKontrolListesi = tercatÇatışmaNoktaları.map(nokta => {
            return { nokta, kontrol: Math.random() * 100 }; // Rastgele kontrol değerleri
        });
        return this.tercatÇatışmaKontrolListesi;
    }

    tercatÇatışmaEtkisiListesi() {
        return this.tercatÇatışmaEtkisiListesi;
    }

    tercatÇatışmaSessizlikListesi() {
        return this.tercatÇatışmaSessizlikListesi;
    }

    tercatÇatışmaGüvenlikListesi() {
        return this.tercatÇatışmaGüvenlikListesi;
    }

    tercatÇatışmaKontrolListesi() {
        return this.tercatÇatışmaKontrolListesi;
    }
}

class Kervan {
    constructor(tercatÇatışmaNoktaları, tercatÇatışmaDinamikleri) {
        this.tercatÇatışmaNoktaları = tercatÇatışmaNoktaları;
        this.tercatÇatışmaDinamikleri = tercatÇatışmaDinamikleri;
    }

    tercatÇatışmaEtkisi(tercatÇatışmaNoktaları, tercatÇatışmaDinamikleri) {
        // Kervanın tercat çatışmalarının etkisini yönetir
        return new TercatÇatışması(tercatÇatışmaNoktaları, tercatÇatışmaDinamikleri).tercatÇatışmaEtkisi();
    }

    tercatÇatışmaSessizlik(tercatÇatışmaNoktaları) {
        // Kervanın tercat çatışmalarının sessizliğini yönetir
        return new TercatÇatışması(tercatÇatışmaNoktaları).tercatÇatışmaSessizlik();
    }

    tercatÇatışmaGüvenlik(tercatÇatışmaDinamikleri) {
        // Kervanın tercat çatışmalarının güvenliğini yönetir
        return new TercatÇatışması(tercatÇatışmaDinamikleri).tercatÇatışmaGüvenlik();
    }

    tercatÇatışmaKontrol(tercatÇatışmaNoktaları, tercatÇatışmaDinamikleri) {
        // Kervanın tercat çatışmalarının kontrolünü yönetir
        return new TercatÇatışması(tercatÇatışmaNoktaları, tercatÇatışmaDinamikleri).tercatÇatışmaKontrol();
    }
}