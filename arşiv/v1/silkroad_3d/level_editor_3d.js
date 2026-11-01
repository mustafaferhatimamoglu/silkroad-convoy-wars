// level_editor_3d.js

class Camera {
  constructor(type, position, rotation) {
    this.type = type;
    this.position = position;
    this.rotation = rotation;
  }

  moveCamera(position) {
    this.position = position;
  }

  rotateCamera(rotation) {
    this.rotation = rotation;
  }
}

class Audio {
  constructor(backgroundMusic, effects) {
    this.backgroundMusic = backgroundMusic;
    this.effects = effects;
  }

  playBackgroundMusic() {
    console.log("Background music is playing.");
  }

  playEffect(effectName) {
    console.log(`Effect ${effectName} is playing.`);
  }
}

class Level {
  constructor(name) {
    this.name = name;
    this.objects = [];
    this.cameras = [];
    this.audio = new Audio(null, []);
  }

  addObject(object) {
    this.objects.push(object);
  }

  removeObject(object) {
    const index = this.objects.indexOf(object);
    if (index !== -1) {
      this.objects.splice(index, 1);
    }
  }

  moveObject(object, newPosition) {
    const index = this.objects.indexOf(object);
    if (index !== -1) {
      this.objects[index].position = newPosition;
    }
  }

  rotateObject(object, newRotation) {
    const index = this.objects.indexOf(object);
    if (index !== -1) {
      this.objects[index].rotation = newRotation;
    }
  }
}

class LevelEditor {
  constructor() {
    this.levels = [];
    this.currentLevel = null;
  }

  addLevel(name) {
    const level = new Level(name);
    this.levels.push(level);
    this.currentLevel = level;
  }

  editLevel(levelName, changes) {
    const level = this.levels.find(l => l.name === levelName);
    if (level) {
      Object.assign(level, changes);
      this.currentLevel = level;
    }
  }

  deleteLevel(levelName) {
    const index = this.levels.findIndex(l => l.name === levelName);
    if (index !== -1) {
      this.levels.splice(index, 1);
      if (this.currentLevel.name === levelName) {
        this.currentLevel = this.levels[0] || null;
      }
    }
  }

  saveLevel(levelName) {
    const level = this.levels.find(l => l.name === levelName);
    if (level) {
      console.log(`Level ${levelName} saved.`);
    }
  }

  loadLevel(levelName) {
    const level = this.levels.find(l => l.name === levelName);
    if (level) {
      this.currentLevel = level;
      console.log(`Level ${levelName} loaded.`);
    }
  }
}

function initEditor() {
  const editor = new LevelEditor();
  editor.addLevel("Level 1");
  editor.currentLevel.objects.push({ name: "Tree", position: [0, 0, 0], rotation: [0, 0, 0] });
  editor.currentLevel.cameras.push(new Camera("TPS", [5, 5, 5], [0, 0, 0]));
  editor.currentLevel.audio.backgroundMusic = "main_theme.mp3";
  return editor;
}

function saveAllLevels(editor) {
  editor.levels.forEach(level => {
    editor.saveLevel(level.name);
  });
}

function loadAllLevels(editor) {
  editor.levels.forEach(level => {
    editor.loadLevel(level.name);
  });
}

function exportLevel(editor, levelName) {
  const level = editor.levels.find(l => l.name === levelName);
  if (level) {
    console.log(`Level ${levelName} exported.`);
  }
}

function importLevel(editor, levelData) {
  const level = new Level(levelData.name);
  level.objects = levelData.objects;
  level.cameras = levelData.cameras;
  level.audio = levelData.audio;
  editor.levels.push(level);
  editor.currentLevel = level;
  console.log(`Level ${levelData.name} imported.`);
}

// Example usage
const editor = initEditor();
saveAllLevels(editor);
exportLevel(editor, "Level 1");
importLevel(editor, { name: "Level 1", objects: [{ name: "Tree", position: [0, 0, 0], rotation: [0, 0, 0] }], cameras: [new Camera("TPS", [5, 5, 5], [0, 0, 0])], audio: new Audio("main_theme.mp3", []) });
loadAllLevels(editor);