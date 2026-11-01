class Kervan {
  constructor(id, malzeme, yol, speed, level) {
    this.id = id;
    this.malzeme = malzeme;
    this.yol = yol;
    this.speed = speed;
    this.level = level;
  }

  hareketEt() {
    // Kervanın yol üzerinde hareket etme kodu
  }

  malzemeYukle(mal) {
    this.malzeme.push(mal);
  }

  malzemeBosalt() {
    this.malzeme = [];
  }

  levelYeniYap() {
    this.level++;
  }
}

class Korsan {
  constructor(id, tahsilat, yol, speed, level) {
    this.id = id;
    this.tahsilat = tahsilat;
    this.yol = yol;
    this.speed = speed;
    this.level = level;
  }

  saldırı() {
    // Korsanın saldırı kodu
  }

  tahsilatAl() {
    // Korsanın tahsilat alma kodu
  }

  levelYeniYap() {
    this.level++;
  }
}

class Savaş {
  constructor(kervan, korsan, yol, sure) {
    this.kervan = kervan;
    this.korsan = korsan;
    this.yol = yol;
    this.sure = sure;
  }

  baslat() {
    // Savaşın başlatma kodu
  }

  bitir() {
    // Savaşın bitirme kodu
  }

  kaynakDengele() {
    // Savaşın kaynak dağılımı dengelenme kodu
  }
}

function yolDegerlendir(yol) {
  // Yolun ekonomik değeri hesaplanır
  return yol.length * 10; // Örnek olarak yol uzunluğu 10 ile çarpılıyor
}

function malzemeDegerlendir(mal) {
  // Malın ekonomik değeri hesaplanır
  return mal.quantity * mal.value; // Örnek olarak malin miktarı ile değer çarpılıyor
}

function tahsilatHesapla(tahsilat) {
  // Tahsilatın ekonomik değeri hesaplanır
  return tahsilat.amount * tahsilat.rate; // Örnek olarak tahsilat miktarı ile oran çarpılıyor
}

const savaşlar = [];
const kervanlar = [];
const korsanlar = [];
let savaşDurumu = 'Pasif';