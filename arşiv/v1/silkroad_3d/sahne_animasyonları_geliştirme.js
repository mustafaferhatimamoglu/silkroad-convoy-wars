class SahneManager {
    constructor() {
        this.sahne = null;
        this.nesneler = [];
    }

    sahneYükle(sahneAdı) {
        // Sahne yükleme işlemleri
        this.sahne = sahneAdı;
        console.log(`Sahne "${sahneAdı}" yüklendi.`);
    }

    nesneEkle(nesne) {
        this.nesneler.push(nesne);
        console.log(`Nesne "${nesne}" eklendi.`);
    }

    nesneSil(nesne) {
        const index = this.nesneler.indexOf(nesne);
        if (index !== -1) {
            this.nesneler.splice(index, 1);
            console.log(`Nesne "${nesne}" silindi.`);
        } else {
            console.log(`Nesne "${nesne}" bulunamadı.`);
        }
    }

    sahneKaydet() {
        // Sahne kaydetme işlemleri
        console.log("Sahne kaydedildi.");
    }
}

class AnimasyonManager {
    constructor() {
        this.animasyonlar = [];
    }

    animasyonEkle(animasyon) {
        this.animasyonlar.push(animasyon);
        console.log(`Animasyon "${animasyon}" eklendi.`);
    }

    animasyonSil(animasyonAdı) {
        const index = this.animasyonlar.findIndex(animasyon => animasyon === animasyonAdı);
        if (index !== -1) {
            this.animasyonlar.splice(index, 1);
            console.log(`Animasyon "${animasyonAdı}" silindi.`);
        } else {
            console.log(`Animasyon "${animasyonAdı}" bulunamadı.`);
        }
    }

    animasyonGuncelle(animasyonAdı, yeniParametreler) {
        const animasyon = this.animasyonlar.find(animasyon => animasyon === animasyonAdı);
        if (animasyon) {
            Object.assign(animasyon, yeniParametreler);
            console.log(`Animasyon "${animasyonAdı}" güncellendi.`);
        } else {
            console.log(`Animasyon "${animasyonAdı}" bulunamadı.`);
        }
    }
}

class CameraManager {
    constructor() {
        this.kamera = null;
    }

    kameraYükle(kameraAdı) {
        // Kamera yükleme işlemleri
        this.kamera = kameraAdı;
        console.log(`Kamera "${kameraAdı}" yüklendi.`);
    }

    kameraGuncelle(kameraAdı, yeniParametreler) {
        const kamera = this.kamera;
        if (kamera) {
            Object.assign(kamera, yeniParametreler);
            console.log(`Kamera "${kameraAdı}" güncellendi.`);
        } else {
            console.log(`Kamera "${kameraAdı}" bulunamadı.`);
        }
    }

    kameraSil(kameraAdı) {
        if (this.kamera === kameraAdı) {
            this.kamera = null;
            console.log(`Kamera "${kameraAdı}" silindi.`);
        } else {
            console.log(`Kamera "${kameraAdı}" bulunamadı.`);
        }
    }
}

function sahneOlustur(sahneAdı) {
    console.log(`Yeni sahne "${sahneAdı}" oluşturuldu.`);
    return sahneAdı;
}

function animasyonOlustur(animasyonAdı, hedefNesne, parametreler) {
    console.log(`Yeni animasyon "${animasyonAdı}" oluşturuldu.`);
    return { adı: animasyonAdı, hedefNesne, parametreler };
}

function kameraOlustur(kameraAdı, parametreler) {
    console.log(`Yeni kamera "${kameraAdı}" oluşturuldu.`);
    return { adı: kameraAdı, parametreler };
}

function sahneGuncelle(sahneAdı, yeniParametreler) {
    console.log(`Sahne "${sahneAdı}" güncellendi.`);
    return sahneAdı;
}

function animasyonGuncelle(animasyonAdı, yeniParametreler) {
    console.log(`Animasyon "${animasyonAdı}" güncellendi.`);
    return animasyonAdı;
}

function kameraGuncelle(kameraAdı, yeniParametreler) {
    console.log(`Kamera "${kameraAdı}" güncellendi.`);
    return kameraAdı;
}

const sahneManager = new SahneManager();
const animasyonManager = new AnimasyonManager();
const cameraManager = new CameraManager();