// kervan_interaktivite_geliştirme.js

class KervanInteraktivitesi {
  constructor(kervan, hareketHızı, hareketYönü) {
    this.kervan = kervan;
    this.hareketHızı = hareketHızı || 1;
    this.hareketYönü = hareketYönü || 'saga';
  }

  hareketEt() {
    // Kervanın hareket etmesini sağlar
    switch (this.hareketYönü) {
      case 'saga':
        this.kervan.position.x += this.hareketHızı;
        break;
      case 'sol':
        this.kervan.position.x -= this.hareketHızı;
        break;
      case 'yukari':
        this.kervan.position.y += this.hareketHızı;
        break;
      case 'asagi':
        this.kervan.position.y -= this.hareketHızı;
        break;
    }
  }

  yönDeğiştir(yön) {
    // Kervanın yönünü değiştirir
    this.hareketYönü = yön;
  }

  hızDeğiştir(hız) {
    // Kervanın hızını değiştirir
    this.hareketHızı = hız;
  }
}

class KervanKontroller {
  constructor(kervanInteraktivitesi, kamera) {
    this.kervanInteraktivitesi = kervanInteraktivitesi;
    this.kamera = kamera;
  }

  hareketDüzeltiler() {
    // Kervanın hareketini kontrol eder
    this.kervanInteraktivitesi.hareketEt();
  }

  yönKontrolü() {
    // Kervanın yönünü kullanıcıdan alır
    let yön = prompt('Yönü girin (saga, sol, yukari, asagi):');
    this.kervanInteraktivitesi.yönDeğiştir(yön);
  }

  hızKontrolü() {
    // Kervanın hızını kullanıcıdan alır
    let hız = parseFloat(prompt('Hızı girin:'));
    this.kervanInteraktivitesi.hızDeğiştir(hız);
  }
}

function hareketEttir(kervan) {
  // Kervanın hareket etmesini sağlar
  kervan.position.x += 1;
}

function yönDeğiştir(kervan, yön) {
  // Kervanın yönünü belirtilen yön olarak değiştirir
  kervan.rotation.y = (yön === 'saga') ? 0 : (yön === 'sol') ? Math.PI : (yön === 'yukari') ? Math.PI / 2 : (yön === 'asagi') ? -Math.PI / 2 : kervan.rotation.y;
}

function hızDeğiştir(kervan, hız) {
  // Kervanın hızını belirtilen hız olarak değiştirir
  kervan.scale.set(hız, hız, hız);
}