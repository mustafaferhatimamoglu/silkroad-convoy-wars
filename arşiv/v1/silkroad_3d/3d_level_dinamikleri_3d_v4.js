// 3d_level_dinamikleri_3d_v4.js

class LevelManager {
  constructor() {
    this.levels = {};
    this.currentLevel = null;
  }

  loadLevel(levelName) {
    // Seviye dosyasını okuyarak seviyeyi yükleme
    fetch(`levels/${levelName}.json`)
      .then(response => response.json())
      .then(data => {
        this.levels[levelName] = data;
        this.currentLevel = data;
      });
  }

  updateLevel() {
    // Seviyedeki hedeflerin ve düşmanların durumunu güncelleme
    this.currentLevel.targets.forEach(target => target.update());
    this.currentLevel.enemies.forEach(enemy => enemy.update());
  }

  startLevel() {
    // Seviyedeki hedeflerin ve düşmanların başlangıç durumunu ayarlamak
    this.currentLevel.targets.forEach(target => target.reset());
    this.currentLevel.enemies.forEach(enemy => enemy.reset());
  }

  endLevel() {
    // Seviyedeki hedeflerin ve düşmanların durumunu temizleme
    this.currentLevel.targets.forEach(target => target.destroy());
    this.currentLevel.enemies.forEach(enemy => enemy.destroy());
  }
}

class LevelDynamic {
  constructor() {
    this.targets = [];
    this.enemies = [];
  }

  addTarget(target) {
    this.targets.push(target);
  }

  removeTarget(target) {
    const index = this.targets.indexOf(target);
    if (index !== -1) this.targets.splice(index, 1);
  }

  addEnemy(enemy) {
    this.enemies.push(enemy);
  }

  removeEnemy(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index !== -1) this.enemies.splice(index, 1);
  }
}

class Target {
  constructor(position, health) {
    this.position = position;
    this.health = health;
  }

  update() {
    // Hedefin durumunu güncelleme
  }

  reset() {
    // Hedefin başlangıç durumunu ayarlamak
  }

  destroy() {
    // Hedefi temizleme
  }

  takeDamage(amount) {
    // Hedefe zarar verme
    this.health -= amount;
    if (this.health <= 0) this.destroy();
  }
}

class Enemy {
  constructor(position, health) {
    this.position = position;
    this.health = health;
  }

  update() {
    // Düşmanın durumunu güncelleme
  }

  reset() {
    // Düşmanın başlangıç durumunu ayarlamak
  }

  destroy() {
    // Düşmanı temizleme
  }

  takeDamage(amount) {
    // Düşmanın zarar verme
    this.health -= amount;
    if (this.health <= 0) this.destroy();
  }

  attack(target) {
    // Düşmanın hedefi vurgulamak ve zarar vermek
    target.takeDamage(10);
  }
}

class CameraController {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;
  }

  update() {
    // Kamerayı güncellemek
    this.camera.position.copy(this.target.position);
  }

  setTarget(target) {
    // Kameranın hedefini ayarlamak
    this.target = target;
  }
}

// Fonksiyonlar
function loadLevel(levelName) {
  levelManager.loadLevel(levelName);
}

function updateLevel() {
  levelManager.updateLevel();
}

function startLevel() {
  levelManager.startLevel();
}

function endLevel() {
  levelManager.endLevel();
}

function takeDamage(amount) {
  // Bir hedefe zarar verme
  currentTarget.takeDamage(amount);
}

// Değişkenler
let levelManager = new LevelManager();
let currentLevel = null;
let targets = [];
let enemies = [];
let camera = null;
let target = null;