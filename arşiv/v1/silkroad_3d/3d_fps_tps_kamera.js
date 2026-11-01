const camera = new Camera();
const cameraControls = new CameraControls(camera);
const keyboard = cameraControls.keyboard;
const mouse = cameraControls.mouse;
const touch = cameraControls.touch;

function initializeCamera() {
    camera.position.set(0, 10, 20);
    camera.target.set(0, 5, 0);
    camera.update();
}

function updateCameraControls() {
    cameraControls.update();
}

function handleKeyboardInput() {
    if (keyboard.isKeyDown('w')) {
        camera.moveForward(0.1);
    }
    if (keyboard.isKeyDown('s')) {
        camera.moveBackward(0.1);
    }
    if (keyboard.isKeyDown('a')) {
        camera.moveLeft(0.1);
    }
    if (keyboard.isKeyDown('d')) {
        camera.moveRight(0.1);
    }
    if (keyboard.isKeyDown('ArrowUp')) {
        camera.rotateX(-0.1);
    }
    if (keyboard.isKeyDown('ArrowDown')) {
        camera.rotateX(0.1);
    }
    if (keyboard.isKeyDown('ArrowLeft')) {
        camera.rotateY(-0.1);
    }
    if (keyboard.isKeyDown('ArrowRight')) {
        camera.rotateY(0.1);
    }
}

function handleMouseInput() {
    const deltaX = mouse.movementX;
    const deltaY = mouse.movementY;
    camera.rotateY(deltaX * 0.01);
    camera.rotateX(deltaY * 0.01);
    camera.update();
}

function handleTouchInput() {
    const touchDeltaX = touch.deltaX;
    const touchDeltaY = touch.deltaY;
    camera.rotateY(touchDeltaX * 0.01);
    camera.rotateX(touchDeltaY * 0.01);
    camera.update();
}

function applyCameraTransformations() {
    camera.applyTransformations();
}

function optimizeCameraPerformance() {
    camera.optimizePerformance();
}

function getCameraPosition() {
    return camera.position;
}

function getCameraDirection() {
    return camera.getDirection();
}