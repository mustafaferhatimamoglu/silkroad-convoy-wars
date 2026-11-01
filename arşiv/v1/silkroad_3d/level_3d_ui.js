// level_3d_ui.js

// Sınıflar
class Level3DUserInterface {
    constructor(canvas, camera, scene, renderer) {
        this.canvas = canvas;
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer;
        this.controls = new THREE.OrbitControls(camera, canvas);
        this.selectedObject = null;
    }

    initializeUI() {
        // Initialize UI elements here
    }

    updateUI() {
        // Update UI elements here
    }

    addObjectToScene(object) {
        this.scene.add(object);
    }

    removeObjectFromScene(object) {
        this.scene.remove(object);
    }

    selectObject(object) {
        if (this.selectedObject) {
            this.selectedObject.material.emissive.set(0x000000);
        }
        this.selectedObject = object;
        this.selectedObject.material.emissive.set(0xffff00);
    }

    unselectObject() {
        if (this.selectedObject) {
            this.selectedObject.material.emissive.set(0x000000);
            this.selectedObject = null;
        }
    }

    moveCamera(position) {
        this.camera.position.set(position.x, position.y, position.z);
    }

    rotateCamera(angle) {
        this.camera.rotation.set(angle.x, angle.y, angle.z);
    }

    zoomCamera(zoomLevel) {
        this.camera.position.z = zoomLevel;
    }

    // Event listeners
    handleMouseDown(event) {
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / this.canvas.width) * 2 - 1;
        mouse.y = -(event.clientY / this.canvas.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const intersects = raycaster.intersectObjects(this.scene.children);
        if (intersects.length > 0) {
            this.selectObject(intersects[0].object);
        } else {
            this.unselectObject();
        }
    }

    handleMouseMove(event) {
        this.controls.update();
    }

    handleMouseUp(event) {
        this.controls.update();
    }
}

// Fonksiyonlar
function initializeLevel3DUserInterface(canvas, camera, scene, renderer) {
    return new Level3DUserInterface(canvas, camera, scene, renderer);
}

function addLevel3DObjectToScene(ui, object) {
    ui.addObjectToScene(object);
}

function removeLevel3DObjectFromScene(ui, object) {
    ui.removeObjectFromScene(object);
}

function selectLevel3DObject(ui, object) {
    ui.selectObject(object);
}

function unselectLevel3DObject(ui) {
    ui.unselectObject();
}

function moveLevel3DCamera(ui, position) {
    ui.moveCamera(position);
}

function rotateLevel3DCamera(ui, angle) {
    ui.rotateCamera(angle);
}

function zoomLevel3DCamera(ui, zoomLevel) {
    ui.zoomCamera(zoomLevel);
}

function handleLevel3DMouseDown(ui, event) {
    ui.handleMouseDown(event);
}

function handleLevel3DMouseMove(ui, event) {
    ui.handleMouseMove(event);
}

function handleLevel3DMouseUp(ui, event) {
    ui.handleMouseUp(event);
}