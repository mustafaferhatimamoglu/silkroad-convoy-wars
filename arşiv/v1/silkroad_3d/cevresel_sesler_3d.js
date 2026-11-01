// cevresel_sesler_3d.js

class SesManager {
  constructor() {
    this.sesler = {};
  }

  sesYukle(sesAdi, sesDosyaYolu) {
    this.sesler[sesAdi] = new Audio(sesDosyaYolu);
  }

  sesOynat(sesAdi) {
    if (this.sesler[sesAdi]) {
      this.sesler[sesAdi].play();
    }
  }

  sesDurdur(sesAdi) {
    if (this.sesler[sesAdi]) {
      this.sesler[sesAdi].pause();
    }
  }

  sesKapat() {
    for (let ses in this.sesler) {
      if (this.sesler.hasOwnProperty(ses)) {
        this.sesler[ses].pause();
        this.sesler[ses].currentTime = 0;
      }
    }
  }
}

class OlaySesleri {
  constructor() {
    this.olaySesleri = {};
  }

  sesYukle(olayAdi, sesDosyaYolu) {
    this.olaySesleri[olayAdi] = new Audio(sesDosyaYolu);
  }

  sesOynat(olayAdi) {
    if (this.olaySesleri[olayAdi]) {
      this.olaySesleri[olayAdi].play();
    }
  }

  sesDurdur(olayAdi) {
    if (this.olaySesleri[olayAdi]) {
      this.olaySesleri[olayAdi].pause();
    }
  }

  sesKapat() {
    for (let olay in this.olaySesleri) {
      if (this.olaySesleri.hasOwnProperty(olay)) {
        this.olaySesleri[olay].pause();
        this.olaySesleri[olay].currentTime = 0;
      }
    }
  }
}

class HaritaSesleri {
  constructor() {
    this.haritaSesleri = {};
  }

  sesYukle(sesAdi, sesDosyaYolu) {
    this.haritaSesleri[sesAdi] = new Audio(sesDosyaYolu);
  }

  sesOynat(sesAdi) {
    if (this.haritaSesleri[sesAdi]) {
      this.haritaSesleri[sesAdi].play();
    }
  }

  sesDurdur(sesAdi) {
    if (this.haritaSesleri[sesAdi]) {
      this.haritaSesleri[sesAdi].pause();
    }
  }

  sesKapat() {
    for (let ses in this.haritaSesleri) {
      if (this.haritaSesleri.hasOwnProperty(ses)) {
        this.haritaSesleri[ses].pause();
        this.haritaSesleri[ses].currentTime = 0;
      }
    }
  }
}

function sesYukle(sesAdi, sesDosyaYolu) {
  if (!sesler[sesAdi]) {
    sesler[sesAdi] = new Audio(sesDosyaYolu);
  }
}

function sesOynat(sesAdi) {
  if (sesler[sesAdi]) {
    sesler[sesAdi].play();
  }
}

function sesDurdur(sesAdi) {
  if (sesler[sesAdi]) {
    sesler[sesAdi].pause();
  }
}

function sesKapat() {
  for (let ses in sesler) {
    if (sesler.hasOwnProperty(ses)) {
      sesler[ses].pause();
      sesler[ses].currentTime = 0;
    }
  }
}

function olaySesYukle(olayAdi, sesDosyaYolu) {
  if (!olaySesleri[olayAdi]) {
    olaySesleri[olayAdi] = new Audio(sesDosyaYolu);
  }
}

function olaySesOynat(olayAdi) {
  if (olaySesleri[olayAdi]) {
    olaySesleri[olayAdi].play();
  }
}

function olaySesDurdur(olayAdi) {
  if (olaySesleri[olayAdi]) {
    olaySesleri[olayAdi].pause();
  }
}

function olaySesKapat() {
  for (let olay in olaySesleri) {
    if (olaySesleri.hasOwnProperty(olay)) {
      olaySesleri[olay].pause();
      olaySesleri[olay].currentTime = 0;
    }
  }
}

function haritaSesYukle(sesAdi, sesDosyaYolu) {
  if (!haritaSesleri[sesAdi]) {
    haritaSesleri[sesAdi] = new Audio(sesDosyaYolu);
  }
}

function haritaSesOynat(sesAdi) {
  if (haritaSesleri[sesAdi]) {
    haritaSesleri[sesAdi].play();
  }
}

function haritaSesDurdur(sesAdi) {
  if (haritaSesleri[sesAdi]) {
    haritaSesleri[sesAdi].pause();
  }
}

function haritaSesKapat() {
  for (let ses in haritaSesleri) {
    if (haritaSesleri.hasOwnProperty(ses)) {
      haritaSesleri[ses].pause();
      haritaSesleri[ses].currentTime = 0;
    }
  }
}

let sesler = {};
let olaySesleri = {};
let haritaSesleri = {};