// kervan_3d_animasyonlar_v3.js

// Animasyon yönetimi sınıfı
class VehicleAnimation {
    constructor() {
        this.currentAnimation = null;
    }

    playAnimation(animationName) {
        if (this.currentAnimation) this.stopAnimation(this.currentAnimation);
        this.currentAnimation = animationName;
        // Animasyonu oynat
        console.log(`Oynatılıyor: ${animationName}`);
    }

    stopAnimation(animationName) {
        if (animationName === this.currentAnimation) {
            this.currentAnimation = null;
            // Animasyonu durdur
            console.log(`Durduruldu: ${animationName}`);
        }
    }

    setAnimationSpeed(animationName, speed) {
        // Animasyon hızını ayarla
        console.log(`Animasyon hızı ayarlandı: ${animationName} - Hız: ${speed}`);
    }
}

// Hareket yönetimi sınıfı
class VehicleMovementController {
    constructor() {
        this.movementDirection = null;
    }

    moveForward() {
        this.movementDirection = 'forward';
        console.log('İleri hareket');
    }

    moveBackward() {
        this.movementDirection = 'backward';
        console.log('Geri hareket');
    }

    turnLeft() {
        this.movementDirection = 'left';
        console.log('Sola dön');
    }

    turnRight() {
        this.movementDirection = 'right';
        console.log('Sağa dön');
    }

    stopMovement() {
        this.movementDirection = null;
        console.log('Hareket durduruldu');
    }
}

// Etkileşim yönetimi sınıfı
class VehicleInteractivityManager {
    constructor() {
        this.interactWithEnemiesFlag = false;
    }

    interactWithEnvironment() {
        // Çevresiyle etkileşim
        console.log('Çevresiyle etkileşim');
    }

    interactWithOtherVehicles() {
        // Başka kervanlarla etkileşim
        console.log('Başka kervanlarla etkileşim');
    }

    interactWithEnemies() {
        this.interactWithEnemiesFlag = true;
        console.log('Düşmanlarla etkileşim');
    }
}

// Global değişkenler
let currentAnimation = null;
let vehicleSpeed = 0;
let movementDirection = null;
let animationSpeedFactor = 1;
let vehicleModel = null;
let environmentObjects = [];
let interactWithEnemiesFlag = false;

// Animasyon fonksiyonları
function rotateVehicle() {
    console.log('Kervan döndürüyor');
}

function walkVehicle() {
    console.log('Kervan duruyor');
}

function runVehicle() {
    console.log('Kervan koşuyor');
}

function attackVehicle() {
    console.log('Kervan saldıryor');
}

function idleVehicle() {
    console.log('Kervan boş duruyor');
}

function animateVehicleMovement() {
    if (movementDirection) {
        console.log('Kervan hareket ediyor');
    } else {
        console.log('Kervan duruyor');
    }
}

function startAttackAnimation() {
    animateVehicleMovement();
    attackVehicle();
}

function stopAttackAnimation() {
    animateVehicleMovement();
    idleVehicle();
}

function updateVehicleAnimation() {
    if (currentAnimation) {
        console.log(`Mevcut animasyon güncellendi: ${currentAnimation}`);
    }
}

// Örnek kullanım
const vehicleAnimation = new VehicleAnimation();
const vehicleMovementController = new VehicleMovementController();
const vehicleInteractivityManager = new VehicleInteractivityManager();

vehicleAnimation.playAnimation('walk');
vehicleMovementController.moveForward();
vehicleInteractivityManager.interactWithEnemies();