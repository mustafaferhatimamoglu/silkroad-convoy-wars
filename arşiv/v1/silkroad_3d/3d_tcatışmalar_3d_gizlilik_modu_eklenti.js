class GizlilikModu {
  constructor() {
    this.aktifDurum = false;
    this.gizlilikSeviyesi = 100; // %100 gizli
  }

  gizlilikModunuKapat() {
    this.aktifDurum = false;
    console.log("Gizlilik modu kapatıldı.");
  }

  gizlilikModunuAc() {
    this.aktifDurum = true;
    console.log("Gizlilik modu açıldı.");
  }

  gizlilikSeviyesiniAyarla(seviye) {
    this.gizlilikSeviyesi = seviye;
    console.log(`Gizlilik seviyesi ${seviye}% olarak ayarlandı.`);
  }
}

class TcatışmaYöneticisi {
  constructor() {
    this.katılımcılar = [];
  }

  katılımBilgisiGüncelle(kullanıcı, durum) {
    this.katılımcılar.push({ kullanıcı, durum });
    console.log(`${kullanıcı} katılımı güncellendi.`);
  }

  katılımBilgisiAl(kullanıcı) {
    return this.katılımcılar.find(k => k.kullanıcı === kullanıcı);
  }

  katılımBilgisiBitir(kullanıcı) {
    const index = this.katılımcılar.findIndex(k => k.kullanıcı === kullanıcı);
    if (index !== -1) {
      this.katılımcılar.splice(index, 1);
      console.log(`${kullanıcı} katılımı bitirildi.`);
    }
  }
}

class PerformansOptimizasyonu {
  constructor() {
    this.frameRate = 60;
    this.görüntüKalitesi = "yüksek";
  }

  performansAyarla(calısmalar) {
    // Performans ayarlarını belirli işlemler için optimize eder.
    if (calısmalar === "Yüksek Performans") {
      this.frameRate = 60;
      this.görüntüKalitesi = "yüksek";
    } else if (calısmalar === "Orta Performans") {
      this.frameRate = 30;
      this.görüntüKalitesi = "orta";
    } else if (calısmalar === "Düşük Performans") {
      this.frameRate = 15;
      this.görüntüKalitesi = "düşük";
    }
    console.log(`Frame Rate: ${this.frameRate}, Görüntü Kalitesi: ${this.görüntüKalitesi}`);
  }

  performansDurumunuGüncelle() {
    console.log(`Frame Rate: ${this.frameRate}, Görüntü Kalitesi: ${this.görüntüKalitesi}`);
  }
}

// Kullanım Örneği
const gizlilikModu = new GizlilikModu();
gizlilikModu.gizlilikModunuAc();
gizlilikModu.gizlilikSeviyesiniAyarla(50);

const tcatışmaYöneticisi = new TcatışmaYöneticisi();
tcatışmaYöneticisi.katılımBilgisiGüncelle("Kullanıcı1", "Katılıyor");
console.log(tcatışmaYöneticisi.katılımBilgisiAl("Kullanıcı1"));

const performansOptimizasyonu = new PerformansOptimizasyonu();
performansOptimizasyonu.performansDurumunuGüncelle();
performansOptimizasyonu.performansAyarla("Yüksek Performans");