// Dosya: savaş_3d_analizi_v5.js

// Sınıflar
class SavaşDinamikleri {
    constructor() {
        this.dinamikler = [];
    }

    // Savaş dinamiklerini ekleme fonksiyonu
    ekle(dinamik) {
        this.dinamikler.push(dinamik);
    }

    // Savaş dinamiklerini silme fonksiyonu
    sil(dinamik) {
        const index = this.dinamikler.indexOf(dinamik);
        if (index !== -1) {
            this.dinamikler.splice(index, 1);
        }
    }

    // Savaş dinamiklerini listeleme fonksiyonu
    listele() {
        return this.dinamikler;
    }
}

class KervanSaldırıları {
    constructor() {
        this.saldırılar = [];
    }

    // Kervan saldırılarını ekleme fonksiyonu
    ekle(saldırı) {
        this.saldırılar.push(saldırı);
    }

    // Kervan saldırılarını silme fonksiyonu
    sil(saldırı) {
        const index = this.saldırılar.indexOf(saldırı);
        if (index !== -1) {
            this.saldırılar.splice(index, 1);
        }
    }

    // Kervan saldırılarını listeleme fonksiyonu
    listele() {
        return this.saldırılar;
    }
}

// Fonksiyonlar
function hesaplaToplamSaldırıSayısı() {
    let toplam = 0;
    savaşDinamikleri.listele().forEach(dinamik => {
        if (dinamik instanceof KervanSaldırıları) {
            toplam += dinamik.listele().length;
        }
    });
    return toplam;
}

// Değişkenler
const savaşDinamikleri = new SavaşDinamikleri();
const kervanSaldırıları = new KervanSaldırıları();