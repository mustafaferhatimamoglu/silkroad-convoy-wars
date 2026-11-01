class KorsanSaldırıları {
    constructor(kamera, oyunHaritası) {
        this.kamera = kamera;
        this.oyunHaritası = oyunHaritası;
        this.korsanlar = [];
        this.saldırılar = [];
        this.korsanSaldırısıAnimasyonlar = [];
    }

    // Korsanları ekleyen fonksiyon
    ekleKorsan(korsan) {
        this.korsanlar.push(korsan);
    }

    // Saldırıları ekleyen fonksiyon
    ekleSaldırı(saldırı) {
        this.saldırılar.push(saldırı);
    }

    // Korsan Saldırısı Animasyonlarını ekleyen fonksiyon
    ekleKorsanSaldırısıAnimasyon(animasyon) {
        this.korsanSaldırısıAnimasyonlar.push(animasyon);
    }

    // Korsanların hareketini güncellenen fonksiyon
    güncelleKorsanHareketleri() {
        for (let korsan of this.korsanlar) {
            korsan.güncelleHareket();
        }
    }

    // Saldırıları güncellenen fonksiyon
    güncelleSaldırılar() {
        for (let saldırı of this.saldırılar) {
            saldırı.güncelle();
        }
    }

    // Korsan Saldırısı Animasyonlarını güncellenen fonksiyon
    güncelleKorsanSaldırısıAnimasyonlar() {
        for (let animasyon of this.korsanSaldırısıAnimasyonlar) {
            animasyon.güncelle();
        }
    }

    // Korsanları ve saldırıları çizecek fonksiyon
    çiz() {
        this.korsanlar.forEach(korsan => korsan.çiz(this.kamera));
        this.saldırılar.forEach(saldırı => saldırı.çiz(this.kamera));
        this.korsanSaldırısıAnimasyonlar.forEach(animasyon => animasyon.çiz(this.kamera));
    }

    // Korsanlardan saldırıya kaçınma kontrolü
    kaçınmaKontrolü() {
        this.korsanlar.forEach(korsan => {
            for (let saldırı of this.saldırılar) {
                if (saldırı.korumaÇapı > korsan.neredenMevcut()) {
                    korsan.kacın(saldırı.hedef);
                }
            }
        });
    }
}

class Saldırı {
    constructor(nereden, hedef, saldırıÇapı) {
        this.nereden = nereden;
        this.hedef = hedef;
        this.saldırıÇapı = saldırıÇapı;
        this.zaman = 0;
    }

    // Saldırıyı güncellenen fonksiyon
    güncelle() {
        this.zaman++;
    }

    // Saldırıyı çizecek fonksiyon
    çiz(kamera) {
        // Saldırıyı çizecek kodlar
    }
}

class KorsanSaldırısıAnimasyon {
    constructor(nereden, hedef, saldırıÇapı) {
        this.nereden = nereden;
        this.hedef = hedef;
        this.saldırıÇapı = saldırıÇapı;
        this.zaman = 0;
        this.animasyonDurumu = 'hareket';
    }

    // Animasyonu güncellenen fonksiyon
    güncelle() {
        this.zaman++;
        if (this.zaman > 10) {
            this.animasyonDurumu = 'saldırı';
        }
    }

    // Animasyonu çizecek fonksiyon
    çiz(kamera) {
        // Animasyonu çizecek kodlar
    }
}