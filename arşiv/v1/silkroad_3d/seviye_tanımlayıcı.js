// seviye_tanımlayıcı.js

// Sınıflar

class Level {
  constructor(name, data) {
    this.name = name;
    this.data = data;
  }

  initialize() {
    // Seviyeyi başlatan kod
  }

  render() {
    // Seviyeyi render eden kod
  }

  update() {
    // Seviyeyi günceller
  }
}

class LevelManager {
  constructor() {
    this.levelData = null;
    this.currentLevel = null;
    this.levels = [];
    this.levelDataCache = {};
  }

  loadLevelData(levelName) {
    if (this.levelDataCache[levelName]) {
      return this.levelDataCache[levelName];
    }

    const levelData = require(`./levels/${levelName}.json`);
    this.levelDataCache[levelName] = levelData;
    return levelData;
  }

  createLevel(levelData) {
    const level = new Level(levelData.name, levelData);
    level.initialize();
    return level;
  }

  transitionToLevel(nextLevelName) {
    if (!this.levels.some(level => level.name === nextLevelName)) {
      const levelData = this.loadLevelData(nextLevelName);
      const level = this.createLevel(levelData);
      this.levels.push(level);
    }

    this.currentLevel = this.levels.find(level => level.name === nextLevelName);
    this.currentLevel.render();
    return true;
  }

  updateLevel(newData) {
    if (this.currentLevel) {
      this.currentLevel.data = newData;
      this.currentLevel.update();
      return this.currentLevel;
    }
    return null;
  }

  saveLevelData(levelData) {
    const levelName = levelData.name;
    try {
      require(`fs`).writeFileSync(`./levels/${levelName}.json`, JSON.stringify(levelData, null, 2));
      return true;
    } catch (error) {
      console.error('Seviye verileri kaydedilirken hata oluştu:', error);
      return false;
    }
  }
}

// Değişkenler

const levelManager = new LevelManager();
let currentLevel = null;
const levels = [];
const levelDataCache = {};

// Fonksiyonlar

function loadLevelData(levelName) {
  return levelManager.loadLevelData(levelName);
}

function createLevel(levelData) {
  return levelManager.createLevel(levelData);
}

function transitionToLevel(nextLevelName) {
  return levelManager.transitionToLevel(nextLevelName);
}

function updateLevel(newData) {
  return levelManager.updateLevel(newData);
}

function saveLevelData(levelData) {
  return levelManager.saveLevelData(levelData);
}