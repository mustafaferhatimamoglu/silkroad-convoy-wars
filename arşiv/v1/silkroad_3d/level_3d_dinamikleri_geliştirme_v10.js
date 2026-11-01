// Sınıflar
class LevelDinamikleri {
  constructor() {
    this.düşmanlar = [];
    this.itemler = [];
    this.korsanlar = [];
    this.oyuncular = [];
  }

  düşmanEkle(düşman) {
    this.düşmanlar.push(düşman);
  }

  itemEkle(item) {
    this.itemler.push(item);
  }

  korsanEkle(korsan) {
    this.korsanlar.push(korsan);
  }

  oyuncuEkle(oyuncu) {
    this.oyuncular.push(oyuncu);
  }

  düşmanGörmek(düşman) {
    return this.düşmanlar.includes(düşman);
  }

  itemGörmek(item) {
    return this.itemler.includes(item);
  }

  korsanGörmek(korsan) {
    return this.korsanlar.includes(korsan);
  }

  oyuncuGörmek(oyuncu) {
    return this.oyuncular.includes(oyuncu);
  }

  düşmanHareketi(düşman) {
    console.log(`${düşman} hareket ediyor.`);
  }

  itemToplama(item) {
    console.log(`${item} toplanıyor.`);
  }

  korsanSavaşı(korsan) {
    console.log(`${korsan} savaşıyor.`);
  }

  oyuncuBıktığı(item) {
    console.log(`Oyuncu ${item} bıktı.`);
  }

  düşmanıYengeç(düşman) {
    console.log(`${düşman} yengeç oldu.`);
  }

  düşmanıKazandırmak(düşman) {
    console.log(`${düşman} kazandı.`);
  }

  düşmanıYenidenYarat(düşman) {
    console.log(`${düşman} yeniden yaratıldı.`);
  }

  düşmanıSil(düşman) {
    const index = this.düşmanlar.indexOf(düşman);
    if (index !== -1) {
      this.düşmanlar.splice(index, 1);
      console.log(`${düşman} silindi.`);
    }
  }

  itemSil(item) {
    const index = this.itemler.indexOf(item);
    if (index !== -1) {
      this.itemler.splice(index, 1);
      console.log(`${item} silindi.`);
    }
  }

  korsanSil(korsan) {
    const index = this.korsanlar.indexOf(korsan);
    if (index !== -1) {
      this.korsanlar.splice(index, 1);
      console.log(`${korsan} silindi.`);
    }
  }

  oyuncuSil(oyuncu) {
    const index = this.oyuncular.indexOf(oyuncu);
    if (index !== -1) {
      this.oyuncular.splice(index, 1);
      console.log(`${oyuncu} silindi.`);
    }
  }

  düşmanHareketleriYazdır() {
    this.düşmanlar.forEach(düşman => {
      this.düşmanHareketi(düşman);
    });
  }

  itemToplamaYazdır(item) {
    this.itemToplama(item);
  }

  korsanSavaşıYazdır(korsan) {
    this.korsanSavaşı(korsan);
  }

  oyuncuBıktığıYazdır(item) {
    this.oyuncuBıktığı(item);
  }

  düşmanıYengeçYazdır(düşman) {
    this.düşmanıYengeç(düşman);
  }

  düşmanıKazandırmakYazdır(düşman) {
    this.düşmanıKazandırmak(düşman);
  }

  düşmanıYenidenYaratYazdır(düşman) {
    this.düşmanıYenidenYarat(düşman);
  }

  düşmanıSilYazdır(düşman) {
    this.düşmanıSil(düşman);
  }

  itemSilYazdır(item) {
    this.itemSil(item);
  }

  korsanSilYazdır(korsan) {
    this.korsanSil(korsan);
  }

  oyuncuSilYazdır(oyuncu) {
    this.oyuncuSil(oyuncu);
  }
}

// Fonksiyonlar
function düşmanYarat(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanEkle(düşman);
}

function itemYarat(levelDinamikleri, item) {
  levelDinamikleri.itemEkle(item);
}

function korsanYarat(levelDinamikleri, korsan) {
  levelDinamikleri.korsanEkle(korsan);
}

function oyuncuYarat(levelDinamikleri, oyuncu) {
  levelDinamikleri.oyuncuEkle(oyuncu);
}

function düşmanGörmek(levelDinamikleri, düşman) {
  return levelDinamikleri.düşmanGörmek(düşman);
}

function itemGörmek(levelDinamikleri, item) {
  return levelDinamikleri.itemGörmek(item);
}

function korsanGörmek(levelDinamikleri, korsan) {
  return levelDinamikleri.korsanGörmek(korsan);
}

function oyuncuGörmek(levelDinamikleri, oyuncu) {
  return levelDinamikleri.oyuncuGörmek(oyuncu);
}

function düşmanHareketi(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanHareketi(düşman);
}

function itemToplama(levelDinamikleri, item) {
  levelDinamikleri.itemToplama(item);
}

function korsanSavaşı(levelDinamikleri, korsan) {
  levelDinamikleri.korsanSavaşı(korsan);
}

function oyuncuBıktığı(levelDinamikleri, item) {
  levelDinamikleri.oyuncuBıktığı(item);
}

function düşmanıYengeç(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanıYengeç(düşman);
}

function düşmanıKazandırmak(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanıKazandırmak(düşman);
}

function düşmanıYenidenYarat(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanıYenidenYarat(düşman);
}

function düşmanıSil(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanıSil(düşman);
}

function itemSil(levelDinamikleri, item) {
  levelDinamikleri.itemSil(item);
}

function korsanSil(levelDinamikleri, korsan) {
  levelDinamikleri.korsanSil(korsan);
}

function oyuncuSil(levelDinamikleri, oyuncu) {
  levelDinamikleri.oyuncuSil(oyuncu);
}

function düşmanHareketleriYazdır(levelDinamikleri) {
  levelDinamikleri.düşmanHareketleriYazdır();
}

function itemToplamaYazdır(levelDinamikleri, item) {
  levelDinamikleri.itemToplamaYazdır(item);
}

function korsanSavaşıYazdır(levelDinamikleri, korsan) {
  levelDinamikleri.korsanSavaşıYazdır(korsan);
}

function oyuncuBıktığıYazdır(levelDinamikleri, item) {
  levelDinamikleri.oyuncuBıktığıYazdır(item);
}

function düşmanıYengeçYazdır(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanıYengeçYazdır(düşman);
}

function düşmanıKazandırmakYazdır(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanıKazandırmakYazdır(düşman);
}

function düşmanıYenidenYaratYazdır(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanıYenidenYaratYazdır(düşman);
}

function düşmanıSilYazdır(levelDinamikleri, düşman) {
  levelDinamikleri.düşmanıSilYazdır(düşman);
}

function itemSilYazdır(levelDinamikleri, item) {
  levelDinamikleri.itemSilYazdır(item);
}

function korsanSilYazdır(levelDinamikleri, korsan) {
  levelDinamikleri.korsanSilYazdır(korsan);
}

function oyuncuSilYazdır(levelDinamikleri, oyuncu) {
  levelDinamikleri.oyuncuSilYazdır(oyuncu);
}