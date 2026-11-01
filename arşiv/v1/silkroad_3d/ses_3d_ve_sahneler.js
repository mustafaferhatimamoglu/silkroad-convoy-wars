// ses_3d_ve_sahneler.js

// Ses dosyalarını yükleyen fonksiyon
function loadSesDosyaları() {
    return ['path/to/ses1.mp3', 'path/to/ses2.mp3', 'path/to/ses3.mp3'];
}

// Ses animasyonunu başlatan fonksiyon
function sesAnimasyonuBaşlat(sesYolu) {
    const audio = new Audio(sesYolu);
    audio.load();
    return audio;
}

// Ses etrafında dalgalanmasını kameraya göre düzenleyen fonksiyon
function sesKamerayaGöreDalgala(sesAnimasyonu, kamera) {
    sesAnimasyonu.addEventListener('timeupdate', () => {
        const currentTime = sesAnimasyonu.currentTime;
        const volume = Math.sin(currentTime) * 0.5 + 0.5; // Ses düzeyini 0-1 arasında değiştirecek
        sesAnimasyonu.volume = volume;
    });
}

// Sesin kameraya yakından veya uzaklaşmasını kontrol eden fonksiyon
function sesKamerayaYakınlaştırmadanUzaklaş(sesAnimasyonu, yakınlık) {
    sesAnimasyonu.addEventListener('timeupdate', () => {
        const currentTime = sesAnimasyonu.currentTime;
        const volume = Math.exp(-currentTime / yakınlık); // Ses düzeyini zamanla azaltacak
        sesAnimasyonu.volume = volume;
    });
}

// Ses animasyonunu durduran fonksiyon
function sesDurdur(sesAnimasyonu) {
    sesAnimasyonu.pause();
}

// Sesin ses düzeyini ayarlayan fonksiyon
function sesSesVolumeAyarla(sesAnimasyonu, sesDüzeni) {
    sesAnimasyonu.volume = sesDüzeni;
}

// Ses yönetimi sınıfı
class SesManager {
    constructor() {
        this.sesDosyaları = [];
    }

    // Ses dosyalarını yükleyen fonksiyon
    loadSesDosyaları() {
        this.sesDosyaları = ['path/to/ses1.mp3', 'path/to/ses2.mp3', 'path/to/ses3.mp3'];
    }

    // Ses animasyonunu başlatan fonksiyon
    sesAnimasyonuBaşlat(sesYolu) {
        const audio = new Audio(sesYolu);
        audio.load();
        return audio;
    }

    // Ses etrafında dalgalanmasını kameraya göre düzenleyen fonksiyon
    sesKamerayaGöreDalgala(sesAnimasyonu, kamera) {
        sesAnimasyonu.addEventListener('timeupdate', () => {
            const currentTime = sesAnimasyonu.currentTime;
            const volume = Math.sin(currentTime) * 0.5 + 0.5; // Ses düzeyini 0-1 arasında değiştirecek
            sesAnimasyonu.volume = volume;
        });
    }

    // Sesin kameraya yakından veya uzaklaşmasını kontrol eden fonksiyon
    sesKamerayaYakınlaştırmadanUzaklaş(sesAnimasyonu, yakınlık) {
        sesAnimasyonu.addEventListener('timeupdate', () => {
            const currentTime = sesAnimasyonu.currentTime;
            const volume = Math.exp(-currentTime / yakınlık); // Ses düzeyini zamanla azaltacak
            sesAnimasyonu.volume = volume;
        });
    }

    // Ses animasyonunu durduran fonksiyon
    sesDurdur(sesAnimasyonu) {
        sesAnimasyonu.pause();
    }

    // Sesin ses düzeyini ayarlayan fonksiyon
    sesSesVolumeAyarla(sesAnimasyonu, sesDüzeni) {
        sesAnimasyonu.volume = sesDüzeni;
    }
}

// Örnek kullanım
const sesManager = new SesManager();
sesManager.loadSesDosyaları();

const sesAnimasyonu = sesManager.sesAnimasyonuBaşlat('path/to/ses.mp3');
sesManager.sesKamerayaGöreDalgala(sesAnimasyonu, kamera);
sesManager.sesKamerayaYakınlaştırmadanUzaklaş(sesAnimasyonu, 10);
sesManager.sesDurdur(sesAnimasyonu);
sesManager.sesSesVolumeAyarla(sesAnimasyonu, 0.5);