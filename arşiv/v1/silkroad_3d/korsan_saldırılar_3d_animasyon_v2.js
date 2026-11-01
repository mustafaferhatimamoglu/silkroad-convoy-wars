class KorsanSaldırısı {
    constructor(model, animasyon) {
        this.model = model;
        this.animasyon = animasyon;
        this.animasyonYukle(animasyon);
    }

    baslaAnimasyon() {
        this.animasyon.baslaAnimasyon();
    }

    durdurAnimasyon() {
        this.animasyon.durdurAnimasyon();
    }

    hedefeYonlendir(hedef) {
        this.hedefeYonlendir(hedef);
    }

    saldırı() {
        return this.saldır();
    }

    parçala() {
        this.parçala();
    }

    geriDön() {
        this.geriDön();
    }

    hedefeYonlendir(hedef) {
        this.animasyon.hedefeYonlendir(hedef);
    }

    saldırı() {
        return this.animasyon.saldır();
    }

    parçala() {
        this.animasyon.parçala();
    }

    geriDön() {
        this.animasyon.geriDön();
    }

    animasyonYukle(animasyon) {
        this.animasyon = animasyon;
        this.animasyon.baslaAnimasyon();
    }
}

class KorsanSaldırısıAnimasyon {
    constructor(model, animasyon) {
        this.model = model;
        this.animasyon = animasyon;
        this.animasyonYukle(animasyon);
    }

    baslaAnimasyon() {
        this.animasyon.baslaAnimasyon();
    }

    durdurAnimasyon() {
        this.animasyon.durdurAnimasyon();
    }

    yeniAnimasyonYukle(animasyon) {
        this.animasyon = animasyon;
        this.animasyon.baslaAnimasyon();
    }

    hedefeYonlendir(hedef) {
        this.animasyon.hedefeYonlendir(hedef);
    }

    saldırı() {
        return this.animasyon.saldır();
    }

    parçala() {
        this.animasyon.parçala();
    }

    geriDön() {
        this.animasyon.geriDön();
    }
}

class KorsanSaldırısıHedef {
    constructor(hedef) {
        this.hedef = hedef;
    }

    hedefeYonlendir(hedef) {
        this.hedef = hedef;
    }

    hedefiKontrolEt() {
        return this.hedef;
    }

    hedefiAta(hedef) {
        this.hedef = hedef;
    }
}

function baslaKorsanSaldırısıAnimasyon(model, animasyon) {
    return new KorsanSaldırısıAnimasyon(model, animasyon);
}

function durdurKorsanSaldırısıAnimasyon(korsanSaldırısıAnimasyon) {
    korsanSaldırısıAnimasyon.durdurAnimasyon();
}

function hedefeYonlendirKorsanSaldırısı(korsanSaldırısı, hedef) {
    korsanSaldırısı.hedefeYonlendir(hedef);
    return korsanSaldırısı;
}

function saldırıKorsanSaldırısı(korsanSaldırısı) {
    return korsanSaldırısı.saldır();
}

function parçalaKorsanSaldırısı(korsanSaldırısı) {
    korsanSaldırısı.parçala();
}

function geriDönKorsanSaldırısı(korsanSaldırısı) {
    korsanSaldırısı.geriDön();
}

function yeniAnimasyonYukleKorsanSaldırısı(korsanSaldırısıAnimasyon, animasyon) {
    return korsanSaldırısıAnimasyon.yeniAnimasyonYukle(animasyon);
}

function hedefeYonlendirKorsanSaldırısıAnimasyon(korsanSaldırısıAnimasyon, hedef) {
    korsanSaldırısıAnimasyon.hedefeYonlendir(hedef);
    return korsanSaldırısıAnimasyon;
}

function hedefiKontrolEtKorsanSaldırısıAnimasyon(korsanSaldırısıAnimasyon) {
    return korsanSaldırısıAnimasyon.hedefiKontrolEt();
}

function hedefiAtaKorsanSaldırısıAnimasyon(korsanSaldırısıAnimasyon, hedef) {
    korsanSaldırısıAnimasyon.hedefiAta(hedef);
    return korsanSaldırısıAnimasyon;
}

let korsanSaldırılar = [];
let korsanSaldırıAnimasyonlar = [];
let hedefler = [];
let saldırıAnimasyonları = [];