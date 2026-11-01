// Dosya: kervan_3d_interaktivite_3d.js

// Değişkenler
let kervanModels = [];
let cameraControls = [];
let interactionListeners = [];
let simyaLevels = [];
let zerkLevels = [];

// Sınıflar
class KervanInteractivity {
    constructor(kervanModel, cameraControl) {
        this.kervanModel = kervanModel;
        this.cameraControl = cameraControl;
        this.interactionListeners = [];
        this.simyaLevel = 0;
        this.zerkLevel = 0;
    }

    init() {
        this.interactionListeners.forEach(listener => listener.init());
        this.update();
    }

    update() {
        requestAnimationFrame(() => this.update());
        this.interactionListeners.forEach(listener => listener.update());
    }
}

class TiklaSürükleEtkileşimi {
    constructor(kervanModel) {
        this.kervanModel = kervanModel;
        this.isDragging = false;
    }

    handleMouseDown(event) {
        this.isDragging = true;
    }

    handleMouseMove(event) {
        if (this.isDragging) {
            // Sürükleme etkileşimi işleme al
            console.log("Kervan sürüklendi", event);
        }
    }

    handleMouseUp(event) {
        this.isDragging = false;
    }
}

// Fonksiyonlar
function initInteractivity() {
    kervanModels.forEach((model, index) => {
        const cameraControl = new THREE.OrbitControls(camera, renderer.domElement);
        const interactionListener = new TiklaSürükleEtkileşimi(model);
        kervanModels[index] = model;
        cameraControls[index] = cameraControl;
        interactionListeners[index] = interactionListener;
        cameraControls[index].enableDamping = true;
        cameraControls[index].dampingFactor = 0.25;
    });
}

function addInteractionListeners() {
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDrag);
}

function handleClick(event) {
    // Tıklama etkileşimi işleme al
    console.log("Kervan tıklandı", event);
}

function handleDrag(event) {
    interactionListeners.forEach(listener => {
        if (listener instanceof TiklaSürükleEtkileşimi) {
            listener.handleMouseMove(event);
        }
    });
}

function updateKervanMovement() {
    kervanModels.forEach(model => {
        // Kervan hareketlerini güncelle
        console.log("Kervan hareket ediyor");
    });
}

function interactWithEnvironment() {
    kervanModels.forEach(model => {
        // Kervan ile çevre etkileşimi
        console.log("Kervan çevreyle etkileşiyor");
    });
}

function updateSimyaAndZerkLevels() {
    // Simya ve Zerk seviyelerini güncelle
    console.log("Simya ve Zerk seviyeleri güncellendi");
    simyaLevels.forEach(level => level.update());
    zerkLevels.forEach(level => level.update());
}

// KervanInteractivity sınıfını kullanarak etkileşim başlat
const kervanInteractivity = new KervanInteractivity(kervanModels[0], cameraControls[0]);
kervanInteractivity.init();

// Etkileşimleri başlat
addInteractionListeners();