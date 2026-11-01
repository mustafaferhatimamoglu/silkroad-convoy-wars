// level_dinamikleri.js

class LevelManager {
  constructor(levels) {
    this.levels = levels;
  }

  loadLevel(levelNumber) {
    const level = this.getLevelContent(levelNumber);
    levelContent = new LevelContent(level.contentData);
    levelContent.getContentDescription();
    levelContent.getContentObjects();
  }

  transitionToLevel(levelNumber) {
    const transition = new LevelTransition('fade');
    transition.applyTransition();
  }

  getLevelContent(levelNumber) {
    return this.levels[levelNumber - 1];
  }

  getLevelEnemies(levelNumber) {
    return this.levels[levelNumber - 1].enemies;
  }

  getLevelRewards(levelNumber) {
    return this.levels[levelNumber - 1].rewards;
  }

  getLevelEnvironment(levelNumber) {
    return this.levels[levelNumber - 1].environment;
  }
}

class LevelContent {
  constructor(contentData) {
    this.contentData = contentData;
  }

  getContentDescription() {
    console.log('Level description:', this.contentData.description);
  }

  getContentObjects() {
    console.log('Level objects:', this.contentData.objects);
  }
}

class Kervan {
  constructor(model, animation) {
    this.model = model;
    this.animation = animation;
    this.position = { x: 0, y: 0, z: 0 };
  }

  moveToDestination(destination) {
    this.position = destination;
    console.log('Kervan moved to:', this.position);
  }

  updatePosition(position) {
    this.position = position;
    console.log('Kervan updated position to:', this.position);
  }

  getKervanStatus() {
    return {
      model: this.model,
      animation: this.animation,
      position: this.position
    };
  }
}

class KorsanSaldırı {
  constructor(enemyType, attackPattern) {
    this.enemyType = enemyType;
    this.attackPattern = attackPattern;
  }

  triggerAttack(target) {
    console.log(`Korsan ${this.enemyType} attacks ${target}`);
  }

  getEnemyStatus() {
    return {
      type: this.enemyType,
      pattern: this.attackPattern
    };
  }
}

class LevelTransition {
  constructor(transitionEffect) {
    this.transitionEffect = transitionEffect;
  }

  applyTransition() {
    console.log(`Applying ${this.transitionEffect} transition`);
  }

  getTransitionStatus() {
    return {
      effect: this.transitionEffect,
      status: 'applying'
    };
  }
}

function loadLevelContent(levelNumber) {
  levelManager.loadLevel(levelNumber);
}

function handleLevelTransition(fromLevel, toLevel) {
  levelManager.transitionToLevel(toLevel);
}

function updateKervanMovement(levelNumber) {
  const kervan = new Kervan('kervan_model', 'walking_animation');
  const destination = { x: 100, y: 50, z: 200 };
  kervan.moveToDestination(destination);
  kervan.updatePosition(destination);
  console.log('Kervan status:', kervan.getKervanStatus());
}

function spawnEnemies(levelNumber) {
  const enemies = [
    new KorsanSaldırı('goblin', 'melee'),
    new KorsanSaldırı('orc', 'ranged'),
    new KorsanSaldırı('wizard', 'spell')
  ];
  enemies.forEach(enemy => enemy.triggerAttack('player'));
  enemies.forEach(enemy => console.log('Enemy status:', enemy.getEnemyStatus()));
}

function collectRewards(levelNumber) {
  const rewards = levelManager.getLevelRewards(levelNumber);
  rewards.forEach(reward => console.log('Collected reward:', reward));
}

// Örnek kullanım
const levels = [
  {
    contentData: {
      description: 'Welcome to Level 1',
      objects: ['caravan', 'trees', 'rocks']
    },
    enemies: ['goblin', 'orc'],
    rewards: ['gold', 'gems'],
    environment: 'desert'
  },
  {
    contentData: {
      description: 'Welcome to Level 2',
      objects: ['castle', 'forest', 'water']
    },
    enemies: ['wizard', 'dragon'],
    rewards: ['treasure', 'mana'],
    environment: 'forest'
  }
];
const levelManager = new LevelManager(levels);
currentLevel = levelManager.getLevelContent(1);
kervanInstance = new Kervan('kervan_model', 'walking_animation');
enemies = [new KorsanSaldırı('goblin', 'melee'), new KorsanSaldırı('orc', 'ranged')];

loadLevelContent(1);
handleLevelTransition(1, 2);
updateKervanMovement(1);
spawnEnemies(1);
collectRewards(1);