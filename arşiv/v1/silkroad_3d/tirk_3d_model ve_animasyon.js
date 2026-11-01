// tirk_3d_model ve_animasyon.js

// Değişkenler
let tirModel = null;
let tirAnimations = {};
let currentTirAnimation = null;
let isTirAnimating = false;
let tirModelLoaded = false;
let tirModelScale = { x: 1, y: 1, z: 1 };
let tirModelRotation = { x: 0, y: 0, z: 0 };
let tirAnimationDuration = 2000; // ms
let tirAnimationProgress = 0;
let tirAnimationName = '';

// Sınıflar

class TirModel {
  constructor() {
    this.model = null;
    this.animations = {};
    this.currentAnimation = null;
    this.isAnimating = false;
  }

  loadModel() {
    // Model yükleme işlemleri burada yapılabilir
    this.model = new THREE.Mesh();
    tirModelLoaded = true;
  }

  unloadModel() {
    // Model kaldırma işlemleri burada yapılabilir
    this.model = null;
    tirModelLoaded = false;
  }

  playAnimation(animationName) {
    if (this.animations[animationName]) {
      this.currentAnimation = this.animations[animationName];
      this.isAnimating = true;
    }
  }

  stopAnimation() {
    this.currentAnimation = null;
    this.isAnimating = false;
  }

  updateAnimation(deltaTime) {
    if (this.currentAnimation && this.isAnimating) {
      // Animasyon güncelleme işlemleri burada yapılabilir
      tirAnimationProgress += deltaTime;
      if (tirAnimationProgress >= tirAnimationDuration) {
        this.stopAnimation();
      }
    }
  }
}

class TirAnimation {
  constructor(animationName, animationData, animationDuration) {
    this.animationName = animationName;
    this.animationData = animationData;
    this.animationDuration = animationDuration;
  }

  initialize() {
    // Animasyon init işlemleri burada yapılabilir
  }

  play() {
    // Animasyon oynatma işlemleri burada yapılabilir
  }

  stop() {
    // Animasyon durma işlemleri burada yapılabilir
  }

  update() {
    // Animasyon güncelleme işlemleri burada yapılabilir
  }
}

// Fonksiyonlar

function createTirModel() {
  tirModel = new TirModel();
  tirModel.loadModel();
}

function initializeTirAnimations() {
  // Animasyonları burada tanımlayabilir ve eleyebilirsiniz
  tirAnimations['open'] = new TirAnimation('open', [], tirAnimationDuration);
  tirAnimations['close'] = new TirAnimation('close', [], tirAnimationDuration);
  tirAnimations['drive'] = new TirAnimation('drive', [], tirAnimationDuration);
}

function playTirAnimation(animationName) {
  if (tirAnimations[animationName]) {
    tirModel.playAnimation(animationName);
    currentTirAnimation = tirAnimations[animationName];
    isTirAnimating = true;
  }
}

function stopTirAnimation() {
  tirModel.stopAnimation();
  isTirAnimating = false;
}

function updateTirAnimation(deltaTime) {
  if (tirModel && isTirAnimating) {
    tirModel.updateAnimation(deltaTime);
  }
}

function loadTirModel() {
  if (!tirModelLoaded) {
    tirModel.loadModel();
  }
}

function unloadTirModel() {
  if (tirModelLoaded) {
    tirModel.unloadModel();
  }
}

function resizeTirModel(newScale) {
  tirModelScale = newScale;
  // Modeli yeniden ölçekleme işlemleri burada yapılabilir
}

function rotateTirModel(newRotation) {
  tirModelRotation = newRotation;
  // Modeli yeniden döndürme işlemleri burada yapılabilir
}