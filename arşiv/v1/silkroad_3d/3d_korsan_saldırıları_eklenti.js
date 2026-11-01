// Sınıflar

class Korsan {
    constructor(isim, gücü, hız) {
        this.isim = isim;
        this.güçü = güç;
        this.hız = hız;
    }

    saldır() {
        console.log(`${this.isim} saldırıyor.`);
    }

    kaçın() {
        console.log(`${this.isim} kaçınıyor.`);
    }
}

class Saldırı {
    constructor(hedef, gücü) {
        this.hedef = hedef;
        this.güçü = güç;
    }

    geriDönüş() {
        console.log(`Saldırı geri döndürüldü.`);
    }
}

class Hedef {
    constructor(isim, koordinatlar) {
        this.isim = isim;
        this.koordinatlar = koordinatlar;
    }

    gizliliğinİzniKaldır() {
        console.log(`Hedefin gizliliği kaldırdı.`);
    }
}

class Kervan {
    constructor(isim, nesneler) {
        this.isim = isim;
        this.nesneler = nesneler;
    }

    taşın() {
        console.log(`${this.isim} taşınıyor.`);
    }

    ticaretEt() {
        console.log(`${this.isim} ticaret ediyor.`);
    }
}

// Fonksiyonlar

function korsanSaldırısınıPlanla(korsan, saldırı) {
    console.log(`${korsan.isim} ${saldırı.hedef.isim} 'e saldırıyor.`);
    saldırı.geriDönüş();
}

function hedefiGizlilikDüzeyiniAzalt(hedef) {
    hedef.gizliliğinİzniKaldır();
}

function kervaniTaşı(kervan, yeniKonum) {
    console.log(`${kervan.isim} ${yeniKonum} 'e taşındı.`);
    kervan.ticaretEt();
}

// Değişkenler

const korsan1 = new Korsan("Mustafazade", 100, 50);
const saldırı1 = new Saldırı(korsan1, 200);
const hedef1 = new Hedef("Silkroad Kasabası", { x: 100, y: 200, z: 300 });
const kervan1 = new Kervan("Golden Caravan", ["Silkroad Kasabı", "Zerk"]);

// Kullanım

korsanSaldırısınıPlanla(korsan1, saldırı1);
hedefiGizlilikDüzeyiniAzalt(hedef1);
kervaniTaşı(kervan1, { x: 150, y: 250, z: 350 });