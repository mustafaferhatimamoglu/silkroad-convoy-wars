// tirk_3d_model_ve_animasyon.js

class TirkModel {
    constructor() {
        this.modelData = null;
        this.animationData = null;
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1 };
    }

    loadModel() {
        // Modeli yükleme işlemini burada gerçekleştirebilirsiniz
        console.log("Model yüklendi");
    }

    loadModelFromData(data) {
        this.modelData = data;
        console.log("Model verisinden yüklendi");
    }

    animate(animationName) {
        // Animasyonu oynatma işlemini burada gerçekleştirebilirsiniz
        console.log(`${animationName} animasyonu oynatıldı`);
    }

    update() {
        // Modeli güncelleme işlemini burada gerçekleştirebilirsiniz
        console.log("Model güncellendi");
    }
}

class TirkAnimation {
    constructor(animationName, animationData) {
        this.animationName = animationName;
        this.animationData = animationData;
    }

    loadAnimation() {
        // Animasyonu yükleme işlemini burada gerçekleştirebilirsiniz
        console.log(`${this.animationName} animasyonu yüklendi`);
    }

    play() {
        // Animasyonu oynatma işlemini burada gerçekleştirebilirsiniz
        console.log(`${this.animationName} animasyonu oynatıldı`);
    }

    stop() {
        // Animasyonu durdurma işlemini burada gerçekleştirebilirsiniz
        console.log(`${this.animationName} animasyonu durduruldu`);
    }
}

class TirkAnimationController {
    constructor() {
        this.animations = [];
        this.currentAnimation = null;
    }

    addAnimation(animation) {
        this.animations.push(animation);
        console.log(`${animation.animationName} animasyonu eklendi`);
    }

    removeAnimation(animationName) {
        this.animations = this.animations.filter(animation => animation.animationName !== animationName);
        console.log(`${animationName} animasyonu kaldırıldı`);
    }

    startAnimation(animationName) {
        const animation = this.animations.find(animation => animation.animationName === animationName);
        if (animation) {
            this.currentAnimation = animation;
            animation.play();
            console.log(`${animationName} animasyonu başlatıldı`);
        } else {
            console.log(`${animationName} animasyonu bulunamadı`);
        }
    }

    stopAnimation(animationName) {
        const animation = this.animations.find(animation => animation.animationName === animationName);
        if (animation) {
            animation.stop();
            console.log(`${animationName} animasyonu durduruldu`);
        } else {
            console.log(`${animationName} animasyonu bulunamadı`);
        }
    }
}

function loadTirkModel(data) {
    tirkModel = new TirkModel();
    tirkModel.loadModelFromData(data);
    console.log("Tır modeli yüklendi");
}

function loadTirkAnimation(data) {
    const animation = new TirkAnimation("default", data);
    animation.loadAnimation();
    tirkAnimations.push(animation);
    console.log("Tır animasyonu yüklendi");
}

function playTirkAnimation(animationName) {
    const controller = new TirkAnimationController();
    controller.startAnimation(animationName);
}

function stopTirkAnimation(animationName) {
    const controller = new TirkAnimationController();
    controller.stopAnimation(animationName);
}

function updateTirkModel() {
    if (tirkModel) {
        tirkModel.update();
        console.log("Tır modeli güncellendi");
    } else {
        console.log("Tır modeli bulunamadı");
    }
}

// Örnek kullanım
const modelData = { /* Kervan modelinin 3D verileri */ };
const animationData = { /* Animasyonun 3D verileri */ };

loadTirkModel(modelData);
loadTirkAnimation(animationData);
playTirkAnimation("default");
stopTirkAnimation("default");
updateTirkModel();