// Savaş Dinamikleri Sınıfı
class SavaşDinamikleri {
  constructor() {
    this.hız = 0;
    this.çap = 0;
    this.sonuç = null;
  }

  ayarlaHız(hız) {
    this.hız = hız;
  }

  ayarlaÇap(çap) {
    this.çap = çap;
  }

  hesaplaSonuç() {
    this.sonuç = Math.random() > 0.5 ? "Kazanıldı" : "Kaydedildi";
  }

  getSonuç() {
    return this.sonuç;
  }
}

// Savaş Modülü Sınıfı
class SavaşModülü {
  constructor() {
    this.savaşlar = [];
  }

  ekleSavaş(savaş) {
    this.savaşlar.push(savaş);
  }

  çalıştırSavaşlar() {
    this.savaşlar.forEach(savaş => {
      savaş.ayarlaHız(10);
      savaş.ayarlaÇap(5);
      savaş.hesaplaSonuç();
      console.log(`Savaş Hızı: ${savaş.hız}, Çapı: ${savaş.çap}, Sonuç: ${savaş.getSonuç()}`);
    });
  }
}

// Korsan Saldırısı Sınıfı
class KorsanSaldırısı extends SavaşDinamikleri {
  constructor() {
    super();
    this.korsanlar = [];
  }

  ekleKorsan(korsan) {
    this.korsanlar.push(korsan);
  }

  saldırıYap() {
    this.korsanlar.forEach(korsan => {
      korsan.ayarlaHız(15);
      korsan.ayarlaÇap(3);
      korsan.hesaplaSonuç();
      console.log(`Korsan Hızı: ${korsan.hız}, Çapı: ${korsan.çap}, Sonuç: ${korsan.getSonuç()}`);
    });
  }
}

// Tercat Saldırısı Sınıfı
class TercatSaldırısı extends SavaşDinamikleri {
  constructor() {
    super();
    this.tercalar = [];
  }

  ekleTercat(tercat) {
    this.tercalar.push(tercat);
  }

  saldırıYap() {
    this.tercalar.forEach(tercat => {
      tercat.ayarlaHız(12);
      tercat.ayarlaÇap(4);
      tercat.hesaplaSonuç();
      console.log(`Tercat Hızı: ${tercat.hız}, Çapı: ${tercat.çap}, Sonuç: ${tercat.getSonuç()}`);
    });
  }
}

// Oyuncu Sınıfı
class Oyuncu {
  constructor(isim, seviye) {
    this.isim = isim;
    this.seviye = seviye;
    this.kazanılanSavaşlar = 0;
    this.kaybedilenSavaşlar = 0;
  }

  kazanSavaş() {
    this.kazanılanSavaşlar++;
  }

  kaybetSavaş() {
    this.kaybedilenSavaşlar++;
  }

  getKazanılanSavaşlar() {
    return this.kazanılanSavaşlar;
  }

  getKaybedilenSavaşlar() {
    return this.kaybedilenSavaşlar;
  }
}

// Oyun Sınıfı
class Oyun {
  constructor() {
    this.oyuncular = [];
    this.savaşModülü = new SavaşModülü();
    this.korsanSaldırısı = new KorsanSaldırısı();
    this.tercatSaldırısı = new TercatSaldırısı();
  }

  ekleOyuncu(oyuncu) {
    this.oyuncular.push(oyuncu);
  }

  başlatSavaşlar() {
    this.savaşModülü.ekleSavaş(new SavaşDinamikleri());
    this.savaşModülü.ekleSavaş(new SavaşDinamikleri());
    this.korsanSaldırısı.ekleKorsan(new SavaşDinamikleri());
    this.korsanSaldırısı.ekleKorsan(new SavaşDinamikleri());
    this.tercatSaldırısı.ekleTercat(new SavaşDinamikleri());
    this.tercatSaldırısı.ekleTercat(new SavaşDinamikleri());

    this.savaşModülü.calıştırSavaşlar();
    this.korsanSaldırısı.saldırıYap();
    this.tercatSaldırısı.saldırıYap();

    this.oyuncular.forEach(oyuncu => {
      if (Math.random() > 0.5) {
        oyuncu.kazanSavaş();
      } else {
        oyuncu.kaybetSavaş();
      }
    });
  }

  getToplamSavaşlar() {
    return this.savaşModülü.savaşlar.length + this.korsanSaldırısı.korsanlar.length + this.tercatSaldırısı.tercalar.length;
  }

  getOyuncular() {
    return this.oyuncular;
  }
}

// Oyun Oluşturma
const oyun = new Oyun();
oyun.ekleOyuncu(new Oyuncu("Oyuncu1", 1));
oyun.ekleOyuncu(new Oyuncu("Oyuncu2", 2));
oyun.ekleOyuncu(new Oyuncu("Oyuncu3", 3));

// Savaşları Başlatma
oyun.başlatSavaşlar();

// Oyuncu Durumunu Yazdırma
oyun.getOyuncular().forEach(oyuncu => {
  console.log(`${oyuncu.isim}: Kazanan Savaşlar - ${oyuncu.getKazanılanSavaşlar()}, Kaybedilen Savaşlar - ${oyuncu.getKaybedilenSavaşlar()}`);
});

console.log(`Toplam Savaşlar: ${oyun.getToplamSavaşlar()}`);