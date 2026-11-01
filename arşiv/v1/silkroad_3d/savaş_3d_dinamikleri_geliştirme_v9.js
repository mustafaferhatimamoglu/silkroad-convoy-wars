// savaş_3d_dinamikleri_geliştirme_v9.js

// Sınıflar

class SavunmaDinamikleri {
  başlat() {
    console.log("Savaş dinamikleri başlatıldı.");
  }
  
  bitir() {
    console.log("Savaş dinamikleri bitirildi.");
  }
  
  zorlukAyarla(zorluk) {
    this.zorluk = zorluk;
    console.log(`Zorluk seviyesi ${zorluk} olarak ayarlandı.`);
  }
  
  senaryoOluştur() {
    console.log("Senaryo oluşturuluyor.");
  }
  
  sonucuHesapla() {
    console.log("Sonuç hesaplanıyor.");
  }
}

class Kervan {
  yapılandır() {
    console.log("Kervan yapılandırıldı.");
  }
  
  hareketEt() {
    console.log("Kervan hareket etiyor.");
  }
  
  ticaretiYap() {
    console.log("Ticaret yapıyor.");
  }
  
  interaktifEylemler() {
    console.log("Interaktif eylemler gerçekleştiriliyor.");
  }
  
  durumunuGetir() {
    console.log("Kervan durumu getiriliyor.");
  }
}

class Tir {
  yapılandır() {
    console.log("Tir yapılandırıldı.");
  }
  
  hareketEt() {
    console.log("Tir hareket etiyor.");
  }
  
  silahıYükle() {
    console.log("Silah yükleniyor.");
  }
  
  silahıKaldır() {
    console.log("Silah kaldırılıyor.");
  }
  
  durumunuGetir() {
    console.log("Tir durumu getiriliyor.");
  }
}

class Korsan {
  yapılandır() {
    console.log("Korsan yapılandırıldı.");
  }
  
  hareketEt() {
    console.log("Korsan hareket etiyor.");
  }
  
  saldırı() {
    console.log("Saldırı yapıyor.");
  }
  
  interaktifEylemler() {
    console.log("Interaktif eylemler gerçekleştiriliyor.");
  }
  
  durumunuGetir() {
    console.log("Korsan durumu getiriliyor.");
  }
}

class Level {
  yapılandır() {
    console.log("Level yapılandırıldı.");
  }
  
  hazırlıkYap() {
    console.log("Level hazırlığı yapılıyor.");
  }
  
  diziEt() {
    console.log("Level dizi ediliyor.");
  }
  
  sonucuHesapla() {
    console.log("Level sonuçları hesaplanıyor.");
  }
}

class Sahne {
  yapılandır() {
    console.log("Sahne yapılandırıldı.");
  }
  
  hareketEt() {
    console.log("Sahne hareket etiyor.");
  }
  
  interaktifEylemler() {
    console.log("Interaktif eylemler gerçekleştiriliyor.");
  }
  
  durumunuGetir() {
    console.log("Sahne durumu getiriliyor.");
  }
}

class Kamera {
  yapılandır() {
    console.log("Kamera yapılandırıldı.");
  }
  
  hareketEt() {
    console.log("Kamera hareket etiyor.");
  }
  
  rotasyonuAyarla(rotasyon) {
    this.rotasyon = rotasyon;
    console.log(`Kamera rotasyonu ${rotasyon} olarak ayarlandı.`);
  }
  
  durumunuGetir() {
    console.log("Kamera durumu getiriliyor.");
  }
}

class GizlilikModu {
  yapılandır() {
    console.log("Gizlilik modu yapılandırıldı.");
  }
  
  gizliModuAyarla(gizli) {
    this.gizli = gizli;
    console.log(`Gizlilik modu ${gizli ? 'aktif' : 'pasif'} olarak ayarlandı.`);
  }
  
  durumunuGetir() {
    console.log("Gizlilik modu durumu getiriliyor.");
  }
}

class Ekonomi {
  yapılandır() {
    console.log("Ekonomi yapılandırıldı.");
  }
  
  paraYatır(miktar) {
    this.para += miktar;
    console.log(`Para yatırıldı. Toplam para: ${this.para}`);
  }
  
  paraÇek(miktar) {
    if (this.para >= miktar) {
      this.para -= miktar;
      console.log(`Para çekildi. Kalan para: ${this.para}`);
    } else {
      console.log("Yeterli para yok.");
    }
  }
  
  durumunuGetir() {
    console.log("Ekonomi durumu getiriliyor.");
  }
}

class SesManager {
  sesYükle(ad) {
    this.sesAdı = ad;
    console.log(`Ses ${ad} yüklendi.`);
  }
  
  sesOynat() {
    console.log(`Ses ${this.sesAdı} oynatılıyor.`);
  }
  
  sesDurdur() {
    console.log(`Ses ${this.sesAdı} durduruldu.`);
  }
  
  sesVolumeAyarla(volume) {
    this.volume = volume;
    console.log(`Ses volume ${volume} olarak ayarlandı.`);
  }
}

class AnimasyonManager {
  animasyonYükle(ad) {
    this.animasyonAdı = ad;
    console.log(`Animasyon ${ad} yüklendi.`);
  }
  
  animasyonOynat() {
    console.log(`Animasyon ${this.animasyonAdı} oynatılıyor.`);
  }
  
  animasyonDurdur() {
    console.log(`Animasyon ${this.animasyonAdı} durduruldu.`);
  }
  
  animasyonDurumunuGetir() {
    console.log("Animasyon durumu getiriliyor.");
  }
}

class Tahsisat {
  yapılandır() {
    console.log("Tahsisat yapılandırıldı.");
  }
  
  tahsisatYap(miktar) {
    console.log(`Tahsisat ${miktar} yapıldı.`);
  }
  
  tahsisatDurumunuGetir() {
    console.log("Tahsisat durumu getiriliyor.");
  }
}

class Tcatışmalar {
  yapılandır() {
    console.log("Tcatışmalar yapılandırıldı.");
  }
  
  tcatışmalarıYap() {
    console.log("Tcatışmalar yapıldı.");
  }
  
  sonucuHesapla() {
    console.log("Tcatışma sonuçları hesaplanıyor.");
  }
}

// Değişkenler

let savaşZorluk;
let kervanKonumu;
let tirSilah;
let korsanKonumu;
let levelHazırlıkDurumu;
let kameraKonumu;
let gizlilikModu;
let paraMiktarı;
let sesAdı;
let animasyonAdı;
let tahsisatDurumu;
let tcatışmaSonucu;