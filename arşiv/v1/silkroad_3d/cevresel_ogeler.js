// cevresel_ogeler.js

class Ogun {
    constructor(model, etiket) {
        this.model = model;
        this.etiket = etiket;
    }

    render() {
        // Modeli render eden kod
        console.log('Ogun render edildi');
    }

    update() {
        // Modeli güncellenen kod
        console.log('Ogun güncellendi');
    }
}

class Agac {
    constructor(model, konum) {
        this.model = model;
        this.konum = konum;
    }

    render() {
        // Ağaç modelini render eden kod
        console.log('Agac render edildi');
    }

    update() {
        // Ağaç modelini güncellenen kod
        console.log('Agac güncellendi');
    }
}

class Gokyuzu {
    constructor(model, renk) {
        this.model = model;
        this.renk = renk;
    }

    render() {
        // Gökyüzü modelini render eden kod
        console.log('Gokyuzu render edildi');
    }

    update() {
        // Gökyüzü modelini güncellenen kod
        console.log('Gokyuzu güncellendi');
    }
}

class Tavan {
    constructor(model, renk) {
        this.model = model;
        this.renk = renk;
    }

    render() {
        // Tavan modelini render eden kod
        console.log('Tavan render edildi');
    }

    update() {
        // Tavan modelini güncellenen kod
        console.log('Tavan güncellendi');
    }
}

class Yoksulluk {
    constructor(model, konum) {
        this.model = model;
        this.konum = konum;
    }

    render() {
        // Yoksulluk modelini render eden kod
        console.log('Yoksulluk render edildi');
    }

    update() {
        // Yoksulluk modelini güncellenen kod
        console.log('Yoksulluk güncellendi');
    }
}

function createOgun(konum, etiket) {
    return new Ogun(konum, etiket);
}

function createAgac(konum) {
    return new Agac(konum);
}

function createGokyuzu(renk) {
    return new Gokyuzu(renk);
}

function createTavan(renk) {
    return new Tavan(renk);
}

function createYoksulluk(konum) {
    return new Yoksulluk(konum);
}

let ogunlar = [];
let agaclar = [];
let gokyuzular = [];
let tavanlar = [];
let yoksulluklar = [];