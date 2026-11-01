// 3d_tcatışmalar_eklenti.js

// Sınıflar

class Tcatışma {
    constructor(type, participants, location, startTime, endTime) {
        this.type = type;
        this.participants = participants;
        this.location = location;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    start() {
        console.log(`Tcatışma ${this.type} başladı.`);
    }

    end() {
        console.log(`Tcatışma ${this.type} bitti.`);
    }

    update() {
        console.log(`Tcatışma ${this.type} güncellendi.`);
    }

    addParticipant(participant) {
        this.participants.push(participant);
    }

    removeParticipant(participant) {
        this.participants = this.participants.filter(p => p !== participant);
    }
}

class TcatışmaYönetici {
    constructor() {
        this.tcatışmalar = [];
    }

    addTcatışma(tcatışma) {
        this.tcatışmalar.push(tcatışma);
    }

    removeTcatışma(tcatışma) {
        this.tcatışmalar = this.tcatışmalar.filter(t => t !== tcatışma);
    }

    getTcatışmaById(id) {
        return this.tcatışmalar.find(t => t.id === id);
    }

    getAllTcatışmalar() {
        return this.tcatışmalar;
    }
}

class TcatışmaSahne {
    constructor(tcatışma, camera, environment, interactives) {
        this.tcatışma = tcatışma;
        this.camera = camera;
        this.environment = environment;
        this.interactives = interactives;
    }

    setup() {
        console.log("Sahne başlatıldı.");
    }

    update() {
        console.log("Sahne güncellendi.");
    }

    render() {
        console.log("Sahne render edildi.");
    }
}

// Fonksiyonlar

function createTcatışma(type, participants, location, startTime, endTime) {
    return new Tcatışma(type, participants, location, startTime, endTime);
}

function startTcatışma(tcatışma) {
    tcatışma.start();
}

function endTcatışma(tcatışma) {
    tcatışma.end();
}

function updateTcatışma(tcatışma) {
    tcatışma.update();
}

function addParticipantToTcatışma(tcatışma, participant) {
    tcatışma.addParticipant(participant);
}

function removeParticipantFromTcatışma(tcatışma, participant) {
    tcatışma.removeParticipant(participant);
}

// Değişkenler

let tcatışmalar = [];
let tcatışmaSahnesi = null;
let camera = null;
let environment = null;
let interactives = null;
let currentTcatışma = null;