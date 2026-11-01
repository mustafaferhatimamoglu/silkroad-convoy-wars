class SavaşDinamikleri {
    constructor() {
        this.savaşlar = [];
        this.korsanlar = [];
    }

    yaratSavaş() {
        const savaş = new Savaş(this.savaşlar.length + 1, 'Savaş Yeri', new Date());
        this.savaşlar.push(savaş);
    }

    yaratKorsan() {
        const korsan = new Korsan(this.korsanlar.length + 1, 'Korsan ' + (this.korsanlar.length + 1), true);
        this.korsanlar.push(korsan);
    }

    savaşaBaşla() {
        if (this.savaşlar.length > 0) {
            const savaş = this.savaşlar[0];
            savaş.devamEt();
        } else {
            console.log('Hiç savaş yok.');
        }
    }

    savaşaBitir() {
        if (this.savaşlar.length > 0) {
            const savaş = this.savaşlar[0];
            savaş.bitir();
        } else {
            console.log('Hiç savaş yok.');
        }
    }

    korsanaYanıtVer(korsan, saldırı) {
        if (this.savaşlar.length > 0) {
            const savaş = this.savaşlar[0];
            korsan.saldırıYap(savaş);
            saldırı.devamEt();
        } else {
            console.log('Hiç savaş yok.');
        }
    }
}

class Savaş {
    constructor(id, yer, zaman) {
        this.id = id;
        this.yer = yer;
        this.zaman = zaman;
    }

    devamEt() {
        console.log(`Savaş ${this.id}: ${this.zaman} tarihinde ${this.yer} yerinde devam ediyor.`);
    }

    bitir() {
        console.log(`Savaş ${this.id}: ${this.zaman} tarihinde ${this.yer} yerinde bitiyor.`);
    }
}

class Korsan {
    constructor(id, isim, kalkan) {
        this.id = id;
        this.isim = isim;
        this.kalkan = kalkan;
    }

    saldırıYap(savaş) {
        console.log(`Korsan ${this.id} (${this.isim}): Savaşa saldırı yapıyor.`);
        const saldırı = new Saldırı(this.savaşlar.length + 1, 'Saldırı Türü', this.kalkan);
        savaş.korsanaYanıtVer(this, saldırı);
    }
}

class Saldırı {
    constructor(id, turu, kalkan) {
        this.id = id;
        this.turu = turu;
        this.kalkan = kalkan;
    }

    devamEt() {
        console.log(`Saldırı ${this.id}: ${this.turu} türünden saldırının devam ediyor.`);
    }

    bitir() {
        console.log(`Saldırı ${this.id}: ${this.turu} türünden saldırının bitiyor.`);
    }
}

const savaşDinamikleri = new SavaşDinamikleri();
savaşDinamikleri.yaratSavaş();
savaşDinamikleri.yaratKorsan();
savaşDinamikleri.savaşaBaşla();
savaşDinamikleri.korsanaYanıtVer(savaşDinamikleri.korsanlar[0], null);
savaşDinamikleri.savaşaBitir();