// tercat_catışmalar_3d_animasyon.js

// Değişkenler
let tercatModels = [];
let tercatAnimations = [];
let tercatHealth = 100;
let tercatSpeed = 0.1;
let tercatDirection = new THREE.Vector3(1, 0, 0);
let tercatAttackPower = 10;
let tercatDefensePower = 5;
let tercatSoundManager = new TercatSoundManager();
let tercatCollisionHandler = new TercatCollision();
let tercatMovementController = new TercatMovement();

// Sınıflar
class Tercat {
    constructor(id, position) {
        this.id = id;
        this.position = position;
        this.health = tercatHealth;
        this.model = createTercatModel();
        this.animation = createTercatAnimation();
        this.sound = tercatSoundManager.getSound('tercat');
    }

    update() {
        this.model.position.copy(this.position);
        this.animation.update();
        this.sound.play();
    }
}

class TercatAnimation {
    update() {
        // Animasyon güncelleme logikleri
    }
}

class TercatMovement {
    update() {
        this.position.add(this.direction.multiplyScalar(tercatSpeed));
    }
}

class TercatCollision {
    handleCollision(tercat) {
        // Çatışma işleyicisi
    }
}

class TercatHealth {
    update(tercat, damage) {
        tercat.health -= damage;
        if (tercat.health <= 0) {
            tercat.sound.play('die');
            tercat.endCombat();
        }
    }
}

class TercatSoundManager {
    getSound(soundType) {
        // Ses yöneticisi logikleri
    }
}

// Fonksiyonlar
function initializeTercatAnimations() {
    tercatAnimations = tercatModels.map(model => new TercatAnimation());
}

function createTercatModel() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const model = new THREE.Mesh(geometry, material);
    tercatModels.push(model);
    return model;
}

function animateTercatMovement() {
    tercatMovementController.update();
}

function handleTercatCollision(tercat) {
    tercatCollisionHandler.handleCollision(tercat);
}

function updateTercatAnimation() {
    tercatAnimations.forEach(animation => animation.update());
}

function startTercatCombat(tercat) {
    tercat.sound.play('attack');
    // Savaş başlangıcı logikleri
}

function endTercatCombat(tercat) {
    tercat.sound.play('die');
    // Savaş sonu logikleri
}

function updateTercatHealth(tercat, damage) {
    tercatHealth.update(tercat, damage);
}

function playTercatAttackSound() {
    tercatSoundManager.getSound('attack').play();
}

function playTercatDieSound() {
    tercatSoundManager.getSound('die').play();
}

// Oyunun ana döngüsü
function animate(time) {
    requestAnimationFrame(animate);
    animateTercatMovement();
    updateTercatAnimation();
    tercatModels.forEach(tercat => tercat.update());
}

animate();