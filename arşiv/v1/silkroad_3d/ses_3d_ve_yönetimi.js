// ses_3d_ve_yönetimi.js

// THREE.js ve Web Audio API'yi kullanarak 3D ses yönetimi modülünü oluşturuyoruz.
// Bu modül, ses dosyalarını yükleme, ses nesnelerini oluşturma ve 3D ses konumunu ayarlama yeteneklerini sağlayacak.

class SessiYonetici {
    constructor(scene, listener) {
        this.scene = scene;
        this.listener = listener;
        this.sesler = {};
    }

    // Ses dosyasını yükleme ve ses nesnesini oluşturma fonksiyonu
    sesYukle(sesAdi, dosyaYolu) {
        if (!this.sesler[sesAdi]) {
            const audioLoader = new THREE.AudioLoader();
            audioLoader.load(dosyaYolu, (buffer) => {
                const ses = new THREE.Audio(this.listener);
                ses.setBuffer(buffer);
                this.sesler[sesAdi] = ses;
            });
        }
    }

    // Ses nesnesini oynatma fonksiyonu
    sesOynat(sesAdi, konum = new THREE.Vector3(0, 0, 0)) {
        if (this.sesler[sesAdi]) {
            const ses = this.sesler[sesAdi];
            ses.setOriginAndDirection(konum, this.listener.position.sub(konum).normalize());
            ses.play();
        }
    }

    // Ses nesnesini durdurma fonksiyonu
    sesDurdur(sesAdi) {
        if (this.sesler[sesAdi]) {
            this.sesler[sesAdi].pause();
        }
    }

    // Ses nesnesini tekrar oynatma fonksiyonu
    sesTekrar(sesAdi, konum = new THREE.Vector3(0, 0, 0)) {
        this.sesDurdur(sesAdi);
        this.sesOynat(sesAdi, konum);
    }
}

export { SessiYonetici };