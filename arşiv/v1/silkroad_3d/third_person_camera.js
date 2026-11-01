// third_person_camera.js

class ThirdPersonCamera {
    constructor() {
        this.target = null;
        this.position = new THREE.Vector3(0, 10, -20);
        this.rotation = new THREE.Vector3(0, 0, 0);
        this.zoom = 1;
        this.sensitivity = 0.1;
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.copy(this.position);
        this.camera.lookAt(this.target.position);
    }

    update() {
        if (this.target) {
            this.camera.position.copy(this.target.position);
            this.camera.position.add(this.rotation.x * this.sensitivity, this.rotation.y * this.sensitivity, this.rotation.z * this.sensitivity);
            this.camera.position.applyMatrix4(new THREE.Matrix4().makeScale(this.zoom, this.zoom, this.zoom));
            this.camera.lookAt(this.target.position);
        }
    }

    setTarget(target) {
        this.target = target;
    }

    setPosition(position) {
        this.position.copy(position);
        this.camera.position.copy(this.position);
    }

    setRotation(rotation) {
        this.rotation.copy(rotation);
        this.update();
    }

    zoomIn() {
        this.zoom *= 0.9;
        this.update();
    }

    zoomOut() {
        this.zoom *= 1.1;
        this.update();
    }
}