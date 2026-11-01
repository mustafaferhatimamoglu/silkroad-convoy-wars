// 3D Tır Modeli Geliştirme Fonksiyonları ve Sınıflar

// Sınıf: Tır
class Tır {
    constructor(model, animasyonlar, hareketler, lojistikStatları) {
        this.model = model;
        this.animasyonlar = animasyonlar;
        this.hareketler = hareketler;
        this.lojistikStatları = lojistikStatları;
    }

    hareketEt(hareket) {
        if (this.animasyonlar[hareket]) {
            this.animasyonlar[hareket]();
        } else {
            console.log('Geçersiz hareket adı');
        }
    }

    güncelleLojistik(artış) {
        this.lojistikStatları += artış;
    }
}

// Fonksiyon: Tır Modelini Yükle
function yükleTırModeli(modelURL) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        loader.load(modelURL, (gltf) => {
            resolve(gltf.scene);
        }, undefined, (error) => {
            reject(error);
        });
    });
}

// Fonksiyon: Tır Animasyonları
function tırAnimasyonları(animasyonAdı) {
    return {
        'yavaş hareket': () => {
            // Yavaş hareket animasyonu
            console.log('Tır yürüyor: Yavaş Hareket');
        },
        'hızlı hareket': () => {
            // Hızlı hareket animasyonu
            console.log('Tır yürüyor: Hızlı Hareket');
        },
        // Diğer animasyonlar...
        default: () => {
            console.log('Geçersiz animasyon adı');
        }
    }[animasyonAdı] || (() => {
        console.log('Geçersiz animasyon adı');
    });
}

// Fonksiyon: Tır Lojistik Statları
function tırLojistikStatları(STR, INT) {
    return {
        STR: STR,
        INT: INT
    };
}

// Fonksiyon: Tır Interaktivitesi
function tırInteraktivitesi(tır) {
    // Interaktivite işlemleri
    tır.model.traverse((child) => {
        if (child.isMesh) {
            child.material.wireframe = true;
            child.material.color.set(0xff0000);
        }
    });
}

// Fonksiyon: Tır Tahsisatı
function tırTahsisat(tır) {
    // Tahsisat işlemleri
    console.log('Tır tahsis ediliyor...');
    tır.hareketEt('yavaş hareket');
}

// Fonksiyon: Tır Ticari İşlemleri
function tırTicariİşlemleri(tır) {
    // Ticari işlemler
    console.log('Tır ticari işlemlerinde...');
    tır.güncelleLojistik(10);
}