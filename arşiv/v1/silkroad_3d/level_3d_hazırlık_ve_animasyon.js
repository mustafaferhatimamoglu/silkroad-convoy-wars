// level_3d_hazırlık_ve_animasyon.js

class Level {
  constructor(levelName, dimensions) {
    this.levelName = levelName;
    this.dimensions = dimensions;
    this.objects = [];
    this.targets = [];
    this.animations = [];
  }

  addObject(object) {
    this.objects.push(object);
  }

  addTarget(target) {
    this.targets.push(target);
  }

  addAnimation(animation) {
    this.animations.push(animation);
  }

  removeObject(object) {
    const index = this.objects.indexOf(object);
    if (index !== -1) {
      this.objects.splice(index, 1);
    }
  }

  removeTarget(target) {
    const index = this.targets.indexOf(target);
    if (index !== -1) {
      this.targets.splice(index, 1);
    }
  }

  removeAnimation(animation) {
    const index = this.animations.indexOf(animation);
    if (index !== -1) {
      this.animations.splice(index, 1);
    }
  }
}

class LevelObject {
  constructor(name, position, model) {
    this.name = name;
    this.position = position;
    this.model = model;
  }

  moveTo(newPosition) {
    this.position = newPosition;
  }
}

class LevelTarget {
  constructor(name, position, type) {
    this.name = name;
    this.position = position;
    this.type = type;
  }

  changeType(newType) {
    this.type = newType;
  }
}

class LevelAnimation {
  constructor(name, object, type) {
    this.name = name;
    this.object = object;
    this.type = type;
  }

  play() {
    // Animasyonu oynatma kodları
  }

  pause() {
    // Animasyonu durdurma kodları
  }
}

function createLevel(name, dimensions) {
  return new Level(name, dimensions);
}

function addObjectToLevel(level, object) {
  level.addObject(object);
}

function addTargetToLevel(level, target) {
  level.addTarget(target);
}

function addAnimationToLevel(level, animation) {
  level.addAnimation(animation);
}

function removeObjectFromLevel(level, object) {
  level.removeObject(object);
}

function removeTargetFromLevel(level, target) {
  level.removeTarget(target);
}

function removeAnimationFromLevel(level, animation) {
  level.removeAnimation(animation);
}

let levels = [];
let objects = [];
let targets = [];
let animations = [];