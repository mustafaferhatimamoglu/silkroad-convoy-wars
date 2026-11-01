// tps_fps_kamera.js

// TPS_Kamera sınıfı
class TPS_Kamera {
    constructor(position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 }, speed = 0.1) {
        this.position = { ...position };
        this.rotation = { ...rotation };
        this.speed = speed;
    }

    update() {
        // Kamera güncelleme kodu
    }

    rotate(deltaX, deltaY) {
        // Kamera döndürme kodu
    }

    moveForward(amount) {
        // Kamera ileri hareketi kodu
    }

    moveBackward(amount) {
        // Kamera geri hareketi kodu
    }

    moveLeft(amount) {
        // Kamera sola hareketi kodu
    }

    moveRight(amount) {
        // Kamera sağa hareketi kodu
    }
}

// FPS_Kamera sınıfı
class FPS_Kamera {
    constructor(position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 }, speed = 0.1) {
        this.position = { ...position };
        this.rotation = { ...rotation };
        this.speed = speed;
    }

    update() {
        // Kamera güncelleme kodu
    }

    rotate(deltaX, deltaY) {
        // Kamera döndürme kodu
    }

    moveForward(amount) {
        // Kamera ileri hareketi kodu
    }

    moveBackward(amount) {
        // Kamera geri hareketi kodu
    }

    moveLeft(amount) {
        // Kamera sola hareketi kodu
    }

    moveRight(amount) {
        // Kamera sağa hareketi kodu
    }

    jump() {
        // Kamera atlatma kodu
    }

    crouch() {
        // Kamera düşme kodu
    }
}

// Kamera_Kontroller sınıfı
class Kamera_Kontroller {
    constructor(tpsCamera, fpsCamera, currentCamera = 'TPS') {
        this.tpsCamera = tpsCamera;
        this.fpsCamera = fpsCamera;
        this.currentCamera = currentCamera;
    }

    switchCamera(newCamera) {
        if (newCamera === 'TPS') {
            this.currentCamera = 'TPS';
        } else if (newCamera === 'FPS') {
            this.currentCamera = 'FPS';
        }
    }

    update() {
        if (this.currentCamera === 'TPS') {
            this.tpsCamera.update();
        } else if (this.currentCamera === 'FPS') {
            this.fpsCamera.update();
        }
    }
}