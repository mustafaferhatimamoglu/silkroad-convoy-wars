// level_obje_animasyonları.js

// Sınıflar
class LevelAnimationManager {
  constructor() {
    this.animations = [];
  }

  addAnimation(animation) {
    this.animations.push(animation);
  }

  removeAnimation(animation) {
    const index = this.animations.indexOf(animation);
    if (index !== -1) {
      this.animations.splice(index, 1);
    }
  }

  startAllAnimations() {
    this.animations.forEach(animation => animation.start());
  }

  stopAllAnimations() {
    this.animations.forEach(animation => animation.stop());
  }
}

class Animation {
  constructor(target, duration, animationFunction) {
    this.target = target;
    this.duration = duration;
    this.animationFunction = animationFunction;
    this.startTime = null;
  }

  start() {
    this.startTime = performance.now();
    this.interval = setInterval(() => this.update(), 16); // ~60 FPS
  }

  stop() {
    clearInterval(this.interval);
    this.startTime = null;
  }

  update() {
    const currentTime = performance.now();
    const elapsedTime = currentTime - this.startTime;

    if (elapsedTime >= this.duration) {
      this.animationFunction(this.target, 1);
      this.stop();
    } else {
      const progress = elapsedTime / this.duration;
      this.animationFunction(this.target, progress);
    }
  }
}

// Fonksiyonlar
function createPathwayAnimation(pathway, duration) {
  return new Animation(pathway, duration, (target, progress) => {
    // Animasyon logikleri burada
    target.position.y = Math.sin(progress * Math.PI * 2) * 0.5; // Örnek: Yükseklik değişimi
  });
}

function createStructureAnimation(structure, duration) {
  return new Animation(structure, duration, (target, progress) => {
    // Animasyon logikleri burada
    target.rotation.y += progress * Math.PI / 4; // Örnek: Y-ekseni dönmek
  });
}

function createVehicleAnimation(vehicle, duration) {
  return new Animation(vehicle, duration, (target, progress) => {
    // Animasyon logikleri burada
    target.position.x += progress * 5; // Örnek: X-ekseni ilerlemek
  });
}

function playLevelTransitionAnimations() {
  levelAnimationManager.startAllAnimations();
}

function playGameplayAnimations() {
  levelAnimationManager.startAllAnimations();
}

// Değişkenler
const levelAnimationManager = new LevelAnimationManager();
const pathwayAnimations = [
  createPathwayAnimation(pathway1, 5000),
  createPathwayAnimation(pathway2, 7000)
];
const structureAnimations = [
  createStructureAnimation(structure1, 3000),
  createStructureAnimation(structure2, 4000)
];
const vehicleAnimations = [
  createVehicleAnimation(vehicle1, 2000),
  createVehicleAnimation(vehicle2, 3000)
];

// Animasyonları ekleme
pathwayAnimations.forEach(animation => levelAnimationManager.addAnimation(animation));
structureAnimations.forEach(animation => levelAnimationManager.addAnimation(animation));
vehicleAnimations.forEach(animation => levelAnimationManager.addAnimation(animation));