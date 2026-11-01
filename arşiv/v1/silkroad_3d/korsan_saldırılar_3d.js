// Dosya: korsan_saldırılar_3d.js

// Fonksiyonlar

function initKorsanSaldırılar() {
    // Korsan saldırılarının başlatılmasını sağlar
    korsanAracılar = [];
    korsanlar = [];
    currentLevel = 1;
    korsanSaldırılar = [];
}

function createKorsanAracı(type, position) {
    // 3D korsan aracı modelini oluşturur
    return new KorsanAracı(type, position);
}

function animateKorsanSaldırı() {
    // Korsan saldırılarını animasyon eder
    korsanSaldırılar.forEach(saldırı => saldırı.animate());
}

function spawnKorsan(position, type) {
    // 3D korsanı yaratır
    const korsan = new Korsan(type, position);
    korsanlar.push(korsan);
    return korsan;
}

function handleKorsanSaldırı() {
    // Korsan saldırılarını yönetir
    korsanSaldırılar.forEach(saldırı => saldırı.handle());
}

function calculateDamage(attacker, defender) {
    // Saldırının verilen hasarı hesaplar
    return attacker.damage * (1 - defender.defense);
}

// Sınıflar

class KorsanAracı {
    constructor(type, position) {
        this.type = type;
        this.position = position;
        this.health = 100;
    }

    moveTo(destination) {
        // Korsan aracı belirli bir konuma taşır
        this.position = destination;
    }

    takeDamage(amount) {
        // Korsan aracı hasar alır
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
        }
    }
}

class Korsan {
    constructor(name, position) {
        this.name = name;
        this.position = position;
        this.health = 100;
    }

    attack(target) {
        // Belirli bir hedefe saldıır
        const damage = calculateDamage(this, target);
        target.takeDamage(damage);
    }

    moveTo(destination) {
        // Korsan belirli bir konuma taşır
        this.position = destination;
    }
}

// Değişkenler

let korsanAracılar;
let korsanlar;
let currentLevel;
let korsanSaldırılar;