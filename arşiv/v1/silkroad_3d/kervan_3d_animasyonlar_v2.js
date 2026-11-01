// Sınıflar
class Kervan {
    constructor(model, hareket, seviye, tahsisat) {
        this.model = model;
        this.hareket = hareket;
        this.seviye = seviye;
        this.tahsisat = tahsisat;
    }

    hareketEt() {
        this.hareket.animasyonuCalistir();
    }

    tahsisatYap() {
        this.tahsisat.animasyonuCalistir();
    }

    seviyeArtir() {
        // Seviye yükseltme animasyonunu çalıştır
        console.log("Seviye yükseltme animasyonu çalıştırıldı.");
    }
}

class KervanHareket {
    constructor(tip, hız, yön) {
        this.tip = tip;
        this.hız = hız;
        this.yön = yön;
    }

    animasyonuCalistir() {
        switch (this.tip) {
            case "yürüyüş":
                this.yürüyüşAnimasyonu();
                break;
            case " uçuş":
                this.flightAnimasyonu();
                break;
            default:
                console.log("Geçerli hareket tipi bulunmamaktadır.");
        }
    }

    yürüyüşAnimasyonu() {
        // Yürüyüş animasyonunu çalıştır
        console.log("Yürüyüş animasyonu çalıştırıldı.");
    }

    flightAnimasyonu() {
        // Uçma animasyonunu çalıştır
        console.log("Uçma animasyonu çalıştırıldı.");
    }
}

class KervanTahsisat {
    constructor(turu, miktari, konumu) {
        this.turu = turu;
        this.miktari = miktari;
        this.konumu = konumu;
    }

    animasyonuCalistir() {
        switch (this.turu) {
            case "yemek":
                this.yemekTahsisati();
                break;
            case "su":
                this.suTahsisati();
                break;
            default:
                console.log("Geçerli tahsisat türü bulunmamaktadır.");
        }
    }

    yemekTahsisati() {
        // Yemek tahsisatı animasyonunu çalıştır
        console.log("Yemek tahsisatı animasyonu çalıştırıldı.");
    }

    suTahsisati() {
        // Su tahsisatı animasyonunu çalıştır
        console.log("Su tahsisatı animasyonu çalıştırıldı.");
    }
}

// Fonksiyonlar
function kervanOluştur(model, hareket, seviye, tahsisat) {
    return new Kervan(model, hareket, seviye, tahsisat);
}

function hareketAnimasyonuOlustur(tip, hız, yön) {
    return new KervanHareket(tip, hız, yön);
}

function tahsisatAnimasyonuOlustur(turu, miktari, konumu) {
    return new KervanTahsisat(turu, miktari, konumu);
}

function kervanAnimasyonlarıGüncelle(kervan) {
    kervan.hareketEt();
    kervan.tahsisatYap();
    kervan.seviyeArtir();
}