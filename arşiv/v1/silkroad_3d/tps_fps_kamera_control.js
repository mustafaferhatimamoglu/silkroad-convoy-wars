const { Vector3, Vector2 } = require('three');

class TPSCamera {
    constructor() {
        this.position = new Vector3();
        this.target = new Vector3();
        this.up = new Vector3(0, 1, 0);
        this.yaw = 0;
        this.pitch = 0;
    }

    initialize() {
        // Initialize camera position and target
        this.position.set(0, 5, 10);
        this.target.set(0, 5, 0);
    }

    update(deltaTime) {
        // Update camera position and rotation
        const speed = keyboardSpeed * deltaTime;
        const horizontalSpeed = speed * Math.sin(this.pitch);
        const verticalSpeed = speed * Math.cos(this.pitch);

        if (cameraControls.forward) {
            camera.position.x -= horizontalSpeed * Math.cos(this.yaw);
            camera.position.y += verticalSpeed;
            camera.position.z -= horizontalSpeed * Math.sin(this.yaw);
        }
        if (cameraControls.backward) {
            camera.position.x += horizontalSpeed * Math.cos(this.yaw);
            camera.position.y -= verticalSpeed;
            camera.position.z += horizontalSpeed * Math.sin(this.yaw);
        }
        if (cameraControls.left) {
            camera.position.x -= horizontalSpeed * Math.sin(this.yaw);
            camera.position.z += horizontalSpeed * Math.cos(this.yaw);
        }
        if (cameraControls.right) {
            camera.position.x += horizontalSpeed * Math.sin(this.yaw);
            camera.position.z -= horizontalSpeed * Math.cos(this.yaw);
        }

        camera.lookAt(this.target);
    }

    handleKeyboard(event) {
        if (event.key === 'w') {
            cameraControls.forward = true;
        } else if (event.key === 's') {
            cameraControls.backward = true;
        } else if (event.key === 'a') {
            cameraControls.left = true;
        } else if (event.key === 'd') {
            cameraControls.right = true;
        } else if (event.key === 'q') {
            cameraControls.up = true;
        } else if (event.key === 'e') {
            cameraControls.down = true;
        }
    }

    handleMouse(event) {
        const sensitivity = mouseSensitivity;
        this.yaw += event.movementX * sensitivity;
        this.pitch -= event.movementY * sensitivity;

        if (this.pitch > Math.PI / 2) {
            this.pitch = Math.PI / 2;
        }
        if (this.pitch < -Math.PI / 2) {
            this.pitch = -Math.PI / 2;
        }

        this.target.set(
            this.position.x + Math.sin(this.yaw) * Math.cos(this.pitch),
            this.position.y + Math.sin(this.pitch),
            this.position.z + Math.cos(this.yaw) * Math.cos(this.pitch)
        );
    }

    handleMouseWheel(event) {
        const zoomSpeed = zoomSpeed;
        this.position.add(this.target.clone().sub(this.position).normalize().multiplyScalar(event.deltaY * zoomSpeed));
    }
}

class FPSCamera {
    constructor() {
        this.position = new Vector3();
        this.target = new Vector3();
        this.up = new Vector3(0, 1, 0);
        this.yaw = 0;
        this.pitch = 0;
    }

    initialize() {
        // Initialize camera position and target
        this.position.set(0, 5, 10);
        this.target.set(0, 5, 0);
    }

    update(deltaTime) {
        // Update camera position and rotation
        const speed = keyboardSpeed * deltaTime;
        const horizontalSpeed = speed * Math.sin(this.pitch);
        const verticalSpeed = speed * Math.cos(this.pitch);

        if (cameraControls.forward) {
            camera.position.x -= horizontalSpeed * Math.cos(this.yaw);
            camera.position.y += verticalSpeed;
            camera.position.z -= horizontalSpeed * Math.sin(this.yaw);
        }
        if (cameraControls.backward) {
            camera.position.x += horizontalSpeed * Math.cos(this.yaw);
            camera.position.y -= verticalSpeed;
            camera.position.z += horizontalSpeed * Math.sin(this.yaw);
        }
        if (cameraControls.left) {
            camera.position.x -= horizontalSpeed * Math.sin(this.yaw);
            camera.position.z += horizontalSpeed * Math.cos(this.yaw);
        }
        if (cameraControls.right) {
            camera.position.x += horizontalSpeed * Math.sin(this.yaw);
            camera.position.z -= horizontalSpeed * Math.cos(this.yaw);
        }

        camera.lookAt(this.target);
    }

    handleKeyboard(event) {
        if (event.key === 'w') {
            cameraControls.forward = true;
        } else if (event.key === 's') {
            cameraControls.backward = true;
        } else if (event.key === 'a') {
            cameraControls.left = true;
        } else if (event.key === 'd') {
            cameraControls.right = true;
        } else if (event.key === 'q') {
            cameraControls.up = true;
        } else if (event.key === 'e') {
            cameraControls.down = true;
        }
    }

    handleMouse(event) {
        const sensitivity = mouseSensitivity;
        this.yaw += event.movementX * sensitivity;
        this.pitch -= event.movementY * sensitivity;

        if (this.pitch > Math.PI / 2) {
            this.pitch = Math.PI / 2;
        }
        if (this.pitch < -Math.PI / 2) {
            this.pitch = -Math.PI / 2;
        }

        this.target.set(
            this.position.x + Math.sin(this.yaw) * Math.cos(this.pitch),
            this.position.y + Math.sin(this.pitch),
            this.position.z + Math.cos(this.yaw) * Math.cos(this.pitch)
        );
    }

    handleMouseWheel(event) {
        const zoomSpeed = zoomSpeed;
        this.position.add(this.target.clone().sub(this.position).normalize().multiplyScalar(event.deltaY * zoomSpeed));
    }
}

function initializeCamera() {
    if (currentMode === 'TPS') {
        camera = new TPSCamera();
    } else if (currentMode === 'FPS') {
        camera = new FPSCamera();
    }
    camera.initialize();
}

function updateCamera(deltaTime) {
    if (camera) {
        camera.update(deltaTime);
    }
}

function handleKeyboardInput(event) {
    if (camera) {
        camera.handleKeyboard(event);
    }
}

function handleMouseInput(event) {
    if (camera) {
        camera.handleMouse(event);
    }
}

function handleMouseWheel(event) {
    if (camera) {
        camera.handleMouseWheel(event);
    }
}

// Initialize camera
initializeCamera();