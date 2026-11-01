// Dosya: 3d_kervan_model_geliştirme.js

class KervanModel {
    constructor() {
        this.kervanModel = null;
    }

    init() {
        console.log("Kervan modeli başlatılıyor...");
        this.loadModel();
    }

    loadModel() {
        const loader = new THREE.GLTFLoader();
        loader.load('path/to/kervan_model.glb', (gltf) => {
            this.kervanModel = gltf.scene;
            scene.add(this.kervanModel);
            console.log("Kervan modeli yüklendi.");
        }, undefined, (error) => {
            console.error("Kervan modeli yükleme hatası:", error);
        });
    }
}

class KervanAnimasyon {
    constructor(kervanModel) {
        this.kervanModel = kervanModel;
        this.kervanAnimasyon = null;
    }

    init() {
        console.log("Kervan animasyonu başlatılıyor...");
        this.loadAnimasyon();
    }

    loadAnimasyon() {
        const loader = new THREE.GLTFLoader();
        loader.load('path/to/kervan_animation.glb', (gltf) => {
            this.kervanAnimasyon = gltf.animations;
            const mixer = new THREE.AnimationMixer(this.kervanModel);
            this.animationAction = mixer.clipAction(this.kervanAnimasyon[0]);
            this.animationAction.play();
            console.log("Kervan animasyonu yüklendi.");
        }, undefined, (error) => {
            console.error("Kervan animasyonu yükleme hatası:", error);
        });
    }
}

class KervanInteraktivite {
    constructor(kervanModel) {
        this.kervanModel = kervanModel;
    }

    init() {
        console.log("Kervan interaktivitesi başlatılıyor...");
        this.addInteraktivite();
    }

    addInteraktivite() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        canvas.addEventListener('click', (event) => {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects(scene.children);

            if (intersects.length > 0) {
                if (intersects[0].object === this.kervanModel) {
                    console.log("Kervan modeline tıklandı.");
                    // Interaktif eylemleri burada eklenebilir
                }
            }
        }, false);
    }
}

const kervanModel = new KervanModel();
const kervanAnimasyon = new KervanAnimasyon(kervanModel.kervanModel);
const kervanInteraktivite = new KervanInteraktivite(kervanModel.kervanModel);

kervanModel.init();
kervanAnimasyon.init();
kervanInteraktivite.init();