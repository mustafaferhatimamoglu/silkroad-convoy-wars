// savaş_3d_dinamikleri_5.js

// Sınıflar
class SavaşDinamikleri {
    constructor() {
        this.dinamikler = [];
    }
    addDinamik(dinamik) {
        this.dinamikler.push(dinamik);
    }
    removeDinamik(dinamik) {
        this.dinamikler = this.dinamikler.filter(d => d !== dinamik);
    }
}

class SavaşEtkileşimleri {
    constructor() {
        this.etkileşimler = [];
    }
    addEtkileşim(etkileşim) {
        this.etkileşimler.push(etkileşim);
    }
    removeEtkileşim(etkileşim) {
        this.etkileşimler = this.etkileşimler.filter(e => e !== etkileşim);
    }
}

class SavaşDinamikleriAnimasyonları {
    constructor() {
        this.animasyonlar = [];
    }
    addAnimasyon(animasyon) {
        this.animasyonlar.push(animasyon);
    }
    removeAnimasyon(animasyon) {
        this.animasyonlar = this.animasyonlar.filter(a => a !== animasyon);
    }
}

class SavaşDinamikleriEconomisi {
    constructor() {
        this.economi = {};
    }
    addResource(resource, amount) {
        if (this.economi[resource]) {
            this.economi[resource] += amount;
        } else {
            this.economi[resource] = amount;
        }
    }
    subtractResource(resource, amount) {
        if (this.economi[resource]) {
            this.economi[resource] -= amount;
            if (this.economi[resource] < 0) {
                this.economi[resource] = 0;
            }
        }
    }
}

class SavaşGizlilikModu {
    constructor() {
        this.isActive = false;
    }
    toggle() {
        this.isActive = !this.isActive;
    }
}

class SavaşSistemi {
    constructor() {
        this.dinamikler = new SavaşDinamikleri();
        this.etkileşimler = new SavaşEtkileşimleri();
        this.animasyonlar = new SavaşDinamikleriAnimasyonları();
        this.economi = new SavaşDinamikleriEconomisi();
        this.gizlilikModu = new SavaşGizlilikModu();
    }
    initialize() {
        this.dinamikler.addDinamik(new SavaşDinamikleri());
        this.etkileşimler.addEtkileşim(new SavaşEtkileşimleri());
        this.animasyonlar.addAnimasyon(new SavaşDinamikleriAnimasyonları());
        this.economi.addResource('gold', 1000);
        this.economi.addResource('wood', 500);
        this.economi.addResource('iron', 200);
    }
    update(dt) {
        this.dinamikler.dinamikler.forEach(dinamik => dinamik.update(dt));
        this.etkileşimler.etkileşimler.forEach(etkileşim => etkileşim.update(dt));
        this.animasyonlar.animasyonlar.forEach(animasyon => animasyon.update(dt));
        this.economi.economi.forEach((amount, resource) => this.economi.adjustEconomy(resource, amount, dt));
    }
    handleUserInput() {
        // Kullanıcı girdisini işleyen kod
    }
    spawnEnemy() {
        // Rastgele bir düşman üreten kod
    }
    handleCombat() {
        // Savaş çatışmasını işleyen kod
    }
    applyDamage(damage, target) {
        // Hedefe zarar veren kod
    }
    healUnit(amount, unit) {
        // Bir birimi iyileştiren kod
    }
    generateResources() {
        // Kaynakları üreten kod
    }
    adjustEconomy(resource, amount, dt) {
        // Ekonomiyi güncelleyen kod
    }
    toggleGizlilikModu() {
        this.gizlilikModu.toggle();
    }
    updateSavaşStatları() {
        // Savaş istatistiklerini güncellenen kod
    }
    spawnTacticalUnit() {
        // Taktiksel bir birimi üreten kod
    }
    handleTacticalCombat() {
        // Taktiksel çatışmayı işleyen kod
    }
    generateWarResources() {
        // Savaş kaynaklarını üreten kod
    }
    updateWarEconomy() {
        // Savaş ekonomisini güncelleyen kod
    }
    manageWarZone() {
        // Savaş bölgesini yöneten kod
    }
}

// Fonksiyonlar
function initializeDinamikleri() {
    savaşDinamikleri = new SavaşDinamikleri();
    savaşEtkileşimleri = new SavaşEtkileşimleri();
    savaşAnimasyonları = new SavaşDinamikleriAnimasyonları();
    savaşEconomisi = new SavaşDinamikleriEconomisi();
    savaşGizlilikModu = new SavaşGizlilikModu();
    savaşSistemi = new SavaşSistemi();
    savaşSistemi.initialize();
}

function updateDinamikleri(dt) {
    savaşSistemi.update(dt);
}

function handleUserInput() {
    savaşSistemi.handleUserInput();
}

function spawnEnemy() {
    savaşSistemi.spawnEnemy();
}

function handleCombat() {
    savaşSistemi.handleCombat();
}

function applyDamage(damage, target) {
    savaşSistemi.applyDamage(damage, target);
}

function healUnit(amount, unit) {
    savaşSistemi.healUnit(amount, unit);
}

function generateResources() {
    savaşSistemi.generateResources();
}

function adjustEconomy(resource, amount, dt) {
    savaşEconomisi.adjustEconomy(resource, amount, dt);
}

function toggleGizlilikModu() {
    savaşSistemi.toggleGizlilikModu();
}

function updateSavaşStatları() {
    savaşSistemi.updateSavaşStatları();
}

function spawnTacticalUnit() {
    savaşSistemi.spawnTacticalUnit();
}

function handleTacticalCombat() {
    savaşSistemi.handleTacticalCombat();
}

function generateWarResources() {
    savaşSistemi.generateWarResources();
}

function updateWarEconomy() {
    savaşSistemi.updateWarEconomy();
}

function manageWarZone() {
    savaşSistemi.manageWarZone();
}

// Değişkenler
let savaşDinamikleri;
let savaşEtkileşimleri;
let savaşAnimasyonları;
let savaşEconomisi;
let savaşGizlilikModu;
let savaşSistemi;