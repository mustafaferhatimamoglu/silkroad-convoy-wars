class Kamera {
    constructor() {
        this.currentCameraMode = 'TPS';
        this.cameraSpeed = 0.1;
        this.mouseSensitivity = 0.1;
        this.keyboardSpeed = 0.05;
        this.cameraPosition = new THREE.Vector3(0, 0, 0);
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
    }

    setCameraMode(mode) {
        this.currentCameraMode = mode;
    }

    updateCamera() {
        if (this.currentCameraMode === 'TPS') {
            this.updateTPSCamera();
        } else if (this.currentCameraMode === 'FPS') {
            this.updateFPSCamera();
        }
    }

    handleInput(input) {
        if (this.currentCameraMode === 'TPS') {
            this.handleTPSInput(input);
        } else if (this.currentCameraMode === 'FPS') {
            this.handleFPSInput(input);
        }
    }

    updateTPSCamera() {
        // TPS kamera güncelleme logikleri
    }

    updateFPSCamera() {
        // FPS kamera güncelleme logikleri
    }

    handleTPSInput(input) {
        // TPS kamera için kullanıcı girdisi işleme logikleri
    }

    handleFPSInput(input) {
        // FPS kamera için kullanıcı girdisi işleme logikleri
    }
}

class TPSCamera extends Kamera {
    constructor() {
        super();
        // TPS kamera özel özellikler
    }

    update() {
        // TPS kamera güncelleme logikleri
    }

    handleInput(input) {
        // TPS kamera için kullanıcı girdisi işleme logikleri
    }
}

class FPSCamera extends Kamera {
    constructor() {
        super();
        // FPS kamera özel özellikler
    }

    update() {
        // FPS kamera güncelleme logikleri
    }

    handleInput(input) {
        // FPS kamera için kullanıcı girdisi işleme logikleri
    }
}

function initCamera() {
    camera = new Kamera();
    // Kamera nesnesinin başlatılması
}

function changeCameraMode(mode) {
    camera.setCameraMode(mode);
}

function handleUserInput() {
    camera.handleInput(getUserInput());
}

function updateCameraView() {
    camera.updateCamera();
}

function processMouseInput() {
    // Fare girdisini işleme
}

function processKeyboardInput() {
    // Klavye girdisini işleme
}

function getUserInput() {
    // Kullanıcı girdisini al
    return {
        // Kullanıcı girdisi
    };
}