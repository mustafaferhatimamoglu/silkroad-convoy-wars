// level_design_3d.js

class Level {
  constructor(id, name, description, levelData) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.levelData = levelData;
  }

  toString() {
    return `Level: ${this.name}, ID: ${this.id}`;
  }

  save() {
    // Save the level data to a persistent storage (e.g., localStorage)
    localStorage.setItem(this.id, JSON.stringify(this.levelData));
  }

  load() {
    // Load the level data from a persistent storage
    const savedData = localStorage.getItem(this.id);
    if (savedData) {
      this.levelData = JSON.parse(savedData);
    }
  }

  delete() {
    // Delete the level from a persistent storage
    localStorage.removeItem(this.id);
  }
}

class LevelManager {
  constructor() {
    this.levels = [];
    this.levelTemplates = {};
    this.levelCache = {};
  }

  addLevel(level) {
    this.levels.push(level);
    this.levelCache[level.id] = level;
  }

  removeLevel(levelId) {
    const index = this.levels.findIndex(level => level.id === levelId);
    if (index !== -1) {
      this.levels.splice(index, 1);
      delete this.levelCache[levelId];
    }
  }

  getLevel(levelId) {
    return this.levelCache[levelId];
  }

  updateLevel(levelId, updatedData) {
    const level = this.getLevel(levelId);
    if (level) {
      Object.assign(level.levelData, updatedData);
      level.save();
    }
  }

  generatePreview(levelId) {
    const level = this.getLevel(levelId);
    if (level) {
      // Generate a preview based on the level data
      console.log(`Generating preview for level: ${level.name}`);
      // Implement the preview generation logic here
    }
  }
}

// Global variables
let levels = [];
let levelTemplates = {};
let levelCache = {};

// Functions
function createLevel(levelData) {
  const newLevel = new Level(Date.now().toString(), levelData.name, levelData.description, levelData);
  newLevel.save();
  levelsManager.addLevel(newLevel);
}

function loadLevel(levelId) {
  const level = levelsManager.getLevel(levelId);
  if (level) {
    level.load();
  }
}

function saveLevel(levelId, levelData) {
  const level = levelsManager.getLevel(levelId);
  if (level) {
    Object.assign(level.levelData, levelData);
    level.save();
  }
}

function deleteLevel(levelId) {
  levelsManager.removeLevel(levelId);
}

function editLevel(levelId, updatedData) {
  levelsManager.updateLevel(levelId, updatedData);
}

function generateLevelPreview(levelId) {
  levelsManager.generatePreview(levelId);
}

function getLevelData(levelId) {
  const level = levelsManager.getLevel(levelId);
  if (level) {
    return level.levelData;
  }
}

// Initialize the LevelManager
const levelsManager = new LevelManager();