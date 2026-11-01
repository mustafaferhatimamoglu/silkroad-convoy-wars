class ThirdPersonCamera {
  constructor(position, target, up, sensitivity, zoom) {
    this.position = position;
    this.target = target;
    this.up = up;
    this.sensitivity = sensitivity;
    this.zoom = zoom;
  }

  update(deltaTime) {
    const offset = new THREE.Vector3().subVectors(this.position, this.target);
    offset.y = 0;
    offset.normalize().multiplyScalar(this.zoom);
    this.position.copy(this.target).add(offset);

    this.camera.lookAt(this.target);
  }

  processMouseMovement(xoffset, yoffset) {
    xoffset *= this.sensitivity;
    yoffset *= this.sensitivity;

    this.camera.rotation.y -= xoffset;
    this.camera.rotation.x -= yoffset;

    this.camera.rotation.x = THREE.MathUtils.clamp(this.camera.rotation.x, -Math.PI / 2, Math.PI / 2);
  }

  processMouseScroll(yoffset) {
    this.zoom -= yoffset;
    this.zoom = THREE.MathUtils.clamp(this.zoom, 0.1, 100);
  }

  processKeyboardInput(direction, speed) {
    const moveDirection = new THREE.Vector3();
    moveDirection.x = -Math.sin(this.camera.rotation.y) * direction;
    moveDirection.z = Math.cos(this.camera.rotation.y) * direction;
    moveDirection.y = direction;

    moveDirection.applyMatrix4(this.camera.quaternion);
    moveDirection.multiplyScalar(speed);

    this.position.add(moveDirection);
    this.target.add(moveDirection);
  }
}

class CameraController {
  constructor(camera, thirdPersonCamera) {
    this.camera = camera;
    this.thirdPersonCamera = thirdPersonCamera;
  }

  update(deltaTime) {
    this.thirdPersonCamera.update(deltaTime);
  }

  handleInput() {
    const direction = 0;
    const speed = 0.1;

    if (keys['w']) {
      direction += 1;
    }
    if (keys['s']) {
      direction -= 1;
    }

    this.thirdPersonCamera.processKeyboardInput(direction, speed);
  }
}

class Player {
  constructor(position, rotation, velocity) {
    this.position = position;
    this.rotation = rotation;
    this.velocity = velocity;
  }

  update(deltaTime) {
    const direction = 0;
    const speed = 0.1;

    if (keys['w']) {
      direction += 1;
    }
    if (keys['s']) {
      direction -= 1;
    }

    this.position.add(new THREE.Vector3().copy(direction).multiplyScalar(speed * deltaTime));
  }

  handleMovement() {
    const direction = 0;
    const speed = 0.1;

    if (keys['w']) {
      direction += 1;
    }
    if (keys['s']) {
      direction -= 1;
    }

    this.position.add(new THREE.Vector3().copy(direction).multiplyScalar(speed * deltaTime));
  }
}

class GameLoop {
  constructor(cameraController, player) {
    this.cameraController = cameraController;
    this.player = player;
    this.deltaTime = 0;
    this.lastFrameTime = 0;
  }

  start() {
    const animate = (timestamp) => {
      const now = timestamp / 1000;
      this.deltaTime = now - this.lastFrameTime;
      this.lastFrameTime = now;

      this.cameraController.update(this.deltaTime);
      this.player.update(this.deltaTime);

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  update() {
    this.cameraController.update(this.deltaTime);
    this.player.update(this.deltaTime);
  }
}

class CameraUtils {
  static lerp(start, end, t) {
    return start + (end - start) * t;
  }

  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
}

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const thirdPersonCamera = new ThirdPersonCamera(new THREE.Vector3(0, 10, -30), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.1, 10);
const cameraController = new CameraController(camera, thirdPersonCamera);
const player = new Player(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
const gameLoop = new GameLoop(cameraController, player);

gameLoop.start();