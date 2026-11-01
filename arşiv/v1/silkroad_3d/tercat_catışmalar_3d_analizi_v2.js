class Catışma {
  constructor(tır, korsan, konum) {
    this.tır = tır;
    this.korsan = korsan;
    this.konum = konum;
    this.hız = Math.random() * 5;
    this.dönüşÜzeyi = Math.random() * Math.PI * 2;
  }

  move() {
    this.konum.x += this.hız * Math.cos(this.dönüşÜzeyi);
    this.konum.z += this.hız * Math.sin(this.dönüşÜzeyi);
  }

  calculateCollision() {
    // Catışmayı hesapla
  }

  animate() {
    // Catışmayı animasyonlar
  }
}

class TercatCatışmalarManager {
  constructor() {
    this.catışmalar = [];
  }

  init() {
    // Catışma nesnelerini başlat
  }

  addCatışma(catışma) {
    this.catışmalar.push(catışma);
  }

  removeCatışma(catışma) {
    const index = this.catışmalar.indexOf(catışma);
    if (index !== -1) {
      this.catışmalar.splice(index, 1);
    }
  }

  update() {
    for (const catışma of this.catışmalar) {
      catışma.move();
      catışma.calculateCollision();
    }
  }

  render() {
    for (const catışma of this.catışmalar) {
      catışma.animate();
    }
  }
}

// Kullanım
const catışmaManager = new TercatCatışmalarManager();
catışmaManager.init();