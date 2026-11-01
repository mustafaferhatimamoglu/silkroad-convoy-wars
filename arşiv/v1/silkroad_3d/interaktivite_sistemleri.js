// interaktivite_sistemleri.js

// Fonksiyonlar

function moveCamera(direction, speed) {
    // Kamera hareketini kontrol eden fonksiyon
}

function interactWithNPC(npcID) {
    // NPC ile etkileşime giren fonksiyon
}

function engageInCombat(target) {
    // Savaşa katılan fonksiyon
}

function startTrade(traderID) {
    // Ticari işlemler başlattığında çalışan fonksiyon
}

function endTrade() {
    // Ticari işlemleri sonlandıran fonksiyon
}

function useItem(itemID) {
    // Öğeyi kullanmak için çalışan fonksiyon
}

function pickUpItem(itemID) {
    // Öğeyi toplamak için çalışan fonksiyon
}

function dropItem(itemID) {
    // Öğeyi atmak için çalışan fonksiyon
}

// Sınıflar

class CameraController {
    constructor(position, rotation) {
        this.position = position;
        this.rotation = rotation;
    }

    updateCamera() {
        // Kamera güncelleme metodu
    }

    setTarget(target) {
        // Kamera hedef ayarlama metodu
    }
}

class NPCManager {
    constructor() {
        this.npcs = [];
    }

    addNPC(npc) {
        this.npcs.push(npc);
    }

    removeNPC(npcID) {
        this.npcs = this.npcs.filter(npc => npc.id !== npcID);
    }

    interactWithNPC(npcID) {
        // NPC ile etkileşime giren fonksiyon
    }
}

class CombatManager {
    constructor(player) {
        this.enemies = [];
        this.player = player;
    }

    engageInCombat(target) {
        // Savaşa katılan fonksiyon
    }

    endCombat() {
        // Savaşın sona ermesi durumunda çalışan fonksiyon
    }
}

class TradeManager {
    constructor() {
        this.buyers = [];
        this.sellers = [];
    }

    startTrade(traderID) {
        // Ticari işlemler başlattığında çalışan fonksiyon
    }

    endTrade() {
        // Ticari işlemleri sonlandıran fonksiyon
    }
}

class InventoryManager {
    constructor() {
        this.inventory = [];
    }

    addItem(item) {
        this.inventory.push(item);
    }

    removeItem(itemID) {
        this.inventory = this.inventory.filter(item => item.id !== itemID);
    }

    useItem(itemID) {
        // Öğeyi kullanmak için çalışan fonksiyon
    }

    pickUpItem(itemID) {
        // Öğeyi toplamak için çalışan fonksiyon
    }

    dropItem(itemID) {
        // Öğeyi atmak için çalışan fonksiyon
    }
}

// Değişkenler

let camera;
let npcList = [];
let enemies = [];
let player;
let buyers = [];
let sellers = [];
let inventory = [];