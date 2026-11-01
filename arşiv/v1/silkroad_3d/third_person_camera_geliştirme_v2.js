class ThirdPersonCamera {
    constructor(player, cameraSpeed, rotationSpeed) {
        this.player = player;
        this.cameraSpeed = cameraSpeed;
        this.rotationSpeed = rotationSpeed;
        this.position = new Vector3(0, 0, 0);
        this.rotation = new Vector3(0, 0, 0);
    }

    update(deltaTime) {
        const forward = this.player.forward.clone();
        const right = this.player.right.clone();

        forward.normalize();
        right.normalize();

        if (Input.isKeyPressed('w')) {
            this.position.add(forward.multiplyScalar(this.cameraSpeed * deltaTime));
        }
        if (Input.isKeyPressed('s')) {
            this.position.subtract(forward.multiplyScalar(this.cameraSpeed * deltaTime));
        }
        if (Input.isKeyPressed('a')) {
            this.position.subtract(right.multiplyScalar(this.cameraSpeed * deltaTime));
        }
        if (Input.isKeyPressed('d')) {
            this.position.add(right.multiplyScalar(this.cameraSpeed * deltaTime));
        }

        if (Input.isKeyPressed('q')) {
            this.rotation.y += this.rotationSpeed * deltaTime;
        }
        if (Input.isKeyPressed('e')) {
            this.rotation.y -= this.rotationSpeed * deltaTime;
        }

        this.rotation.x += Input.mouseY * this.rotationSpeed * deltaTime;
        this.rotation.y += Input.mouseX * this.rotationSpeed * deltaTime;

        this.camera.lookAt(this.player.position);
        this.camera.position.set(
            this.player.position.x + this.position.x,
            this.player.position.y + this.position.y,
            this.player.position.z + this.position.z
        );
        this.camera.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
    }

    setCamera(camera) {
        this.camera = camera;
    }
}

function initCamera(player) {
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const thirdPersonCamera = new ThirdPersonCamera(player, 10, 0.1);
    thirdPersonCamera.setCamera(camera);
    return thirdPersonCamera;
}