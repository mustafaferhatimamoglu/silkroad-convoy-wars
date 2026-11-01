// level_system.js

class Player {
    constructor(name) {
        this.name = name;
        this.experience = 0;
        this.level = 1;
        this.strength = 5;
        this.intelligence = 5;
    }

    levelUp() {
        this.level++;
        this.experience = 0;
        this.strength += 2;
        this.intelligence += 2;
        console.log(`${this.name} seviyesi yükseldi! Yeni seviye: ${this.level}`);
    }
}

class LevelManager {
    constructor() {
        this.levels = [
            { number: 1, requiredExperience: 100 },
            { number: 2, requiredExperience: 200 },
            { number: 3, requiredExperience: 300 },
            // ...
            { number: 120, requiredExperience: 12000 }
        ];
        this.currentLevel = 1;
    }

    updatePlayerExperience(experience) {
        this.currentPlayer.experience += experience;

        while (this.currentPlayer.experience >= this.levels[this.currentLevel - 1].requiredExperience) {
            this.currentPlayer.levelUp();
            this.currentPlayer.experience -= this.levels[this.currentLevel - 1].requiredExperience;
        }
    }
}

class ExperienceCalculator {
    calculateExperience(points) {
        return points * 10; // Basit bir hesaplama
    }
}

// Örnek kullanım
const player = new Player("Örnek Oyuncu");
const levelManager = new LevelManager();
const experienceCalculator = new ExperienceCalculator();

// Oyuncunun deneyimini artırma
levelManager.updatePlayerExperience(experienceCalculator.calculateExperience(50));
levelManager.updatePlayerExperience(experienceCalculator.calculateExperience(50));