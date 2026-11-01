class Level {
    constructor(levelNumber, name, lootTables, enemies, environment) {
        this.levelNumber = levelNumber;
        this.name = name;
        this.lootTables = lootTables;
        this.enemies = enemies;
        this.environment = environment;
    }

    load() {
        // Seviyeyi yükleme kodları
        console.log(`Loading level ${this.levelNumber}: ${this.name}`);
    }

    generateLoot() {
        // Lojistik tabloları yaratma kodları
        console.log(`Generating loot for level ${this.levelNumber}: ${this.name}`);
    }

    spawnEnemies() {
        // Düşmanları yaratma kodları
        console.log(`Spawning enemies for level ${this.levelNumber}: ${this.name}`);
    }

    loadEnvironment() {
        // Seviyenin çevre öğelerini yükleme kodları
        console.log(`Loading environment for level ${this.levelNumber}: ${this.name}`);
    }
}

class LevelManager {
    constructor() {
        this.levels = [];
        this.currentLevel = null;
        this.playerProgress = 1;
    }

    initializeLevels() {
        this.loadAllLevels();
    }

    loadLevel(levelNumber) {
        const level = this.getLevelByNumber(levelNumber);
        if (level) {
            this.currentLevel = level;
            this.currentLevel.load();
            this.currentLevel.generateLoot();
            this.currentLevel.spawnEnemies();
            this.currentLevel.loadEnvironment();
        } else {
            console.log(`Level ${levelNumber} not found.`);
        }
    }

    savePlayerProgress() {
        // Oyuncunun ilerleme durumunu kaydetme kodları
        console.log(`Saving player progress: ${this.playerProgress}`);
    }

    getLevelProgress() {
        return this.playerProgress;
    }

    loadAllLevels() {
        // Tüm seviyeleri yükleme kodları
        for (let i = 1; i <= 120; i++) {
            this.levels.push(new Level(i, `Level ${i}`, [], [], []));
        }
    }

    getLevelByNumber(levelNumber) {
        return this.levels.find(level => level.levelNumber === levelNumber);
    }

    getLevelByName(levelName) {
        return this.levels.find(level => level.name === levelName);
    }

    getLevelNumberByProgress(progress) {
        return progress;
    }

    checkLevelCompletion() {
        // Mevcut seviyenin tamamlanıp tamamlanmadığını kontrol eden kodları
        return this.playerProgress >= this.currentLevel.levelNumber;
    }

    loadNextLevel() {
        if (this.playerProgress < 120) {
            this.playerProgress++;
            this.loadLevel(this.playerProgress);
        } else {
            console.log("All levels completed.");
        }
    }

    loadPreviousLevel() {
        if (this.playerProgress > 1) {
            this.playerProgress--;
            this.loadLevel(this.playerProgress);
        } else {
            console.log("Already on the first level.");
        }
    }
}

const LEVELS = [];
const CURRENT_LEVEL = null;
const PLAYER_PROGRESS = 1;
const LEVEL_LOADER = function(levelNumber) {
    const levelManager = new LevelManager();
    levelManager.loadLevel(levelNumber);
};

// Örnek kullanım
const levelManager = new LevelManager();
levelManager.initializeLevels();
levelManager.loadLevel(1);