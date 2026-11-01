// level_3d_animasyonları.js

// Animasyon dosyalarını depolar
const animations = {};
const characterAnimations = {};
const enemyAnimations = {};
const animationSpeeds = {};
const currentAnimations = {};

class Animation {
    constructor(name, clip) {
        this.name = name;
        this.clip = clip;
    }
}

class AnimationSpeedController {
    setSpeed(entity, animationName, speed) {
        if (entity.animations && entity.animations[animationName]) {
            entity.animations[animationName].speed = speed;
        }
    }
}

class EntityAnimation {
    constructor() {
        this.animations = {};
    }

    play(animationName, speed = 1.0) {
        if (this.animations[animationName]) {
            this.animations[animationName].clip.play({ loop: true, autoplay: true, rate: speed });
        }
    }

    stop(animationName) {
        if (this.animations[animationName]) {
            this.animations[animationName].clip.stop();
        }
    }
}

class CharacterAnimation extends EntityAnimation {
    constructor(character) {
        super();
        this.character = character;
        this.animations = {};
    }

    loadAnimation(animationName) {
        if (!this.animations[animationName]) {
            const clip = THREE.AnimationClip.parse(JSON.parse(animationName));
            this.animations[animationName] = new Animation(animationName, clip);
        }
    }

    play(animationName, speed = 1.0) {
        super.play(animationName, speed);
        currentAnimations[this.character.name] = animationName;
    }

    stop() {
        super.stop();
        currentAnimations[this.character.name] = null;
    }
}

class EnemyAnimation extends EntityAnimation {
    constructor(enemy) {
        super();
        this.enemy = enemy;
        this.animations = {};
    }

    loadAnimation(animationName) {
        if (!this.animations[animationName]) {
            const clip = THREE.AnimationClip.parse(JSON.parse(animationName));
            this.animations[animationName] = new Animation(animationName, clip);
        }
    }

    play(animationName, speed = 1.0) {
        super.play(animationName, speed);
        currentAnimations[this.enemy.name] = animationName;
    }

    stop() {
        super.stop();
        currentAnimations[this.enemy.name] = null;
    }
}

class AnimationManager {
    constructor() {
        this.animationSpeedController = new AnimationSpeedController();
    }

    initAnimations() {
        // Animasyonları başlat ve yükle
    }

    updateAnimations() {
        // Animasyonları güncelle
    }

    playCharacterAnimation(character, animationName) {
        if (!characterAnimations[character.name]) {
            characterAnimations[character.name] = new CharacterAnimation(character);
        }
        characterAnimations[character.name].loadAnimation(animationName);
        characterAnimations[character.name].play(animationName);
    }

    playEnemyAnimation(enemy, animationName) {
        if (!enemyAnimations[enemy.name]) {
            enemyAnimations[enemy.name] = new EnemyAnimation(enemy);
        }
        enemyAnimations[enemy.name].loadAnimation(animationName);
        enemyAnimations[enemy.name].play(animationName);
    }

    stopAnimation(entity, animationName) {
        if (entity === currentAnimations[entity.name]) {
            if (entity instanceof CharacterAnimation) {
                characterAnimations[entity.character.name].stop();
            } else if (entity instanceof EnemyAnimation) {
                enemyAnimations[entity.enemy.name].stop();
            }
        }
    }

    setAnimationSpeed(entity, animationName, speed) {
        if (entity instanceof CharacterAnimation) {
            this.animationSpeedController.setSpeed(entity.character, animationName, speed);
        } else if (entity instanceof EnemyAnimation) {
            this.animationSpeedController.setSpeed(entity.enemy, animationName, speed);
        }
    }

    loadAnimation(animationName) {
        animations[animationName] = new Animation(animationName, THREE.AnimationClip.parse(JSON.parse(animationName)));
    }
}

// Örnek kullanım
const animationManager = new AnimationManager();
animationManager.initAnimations();

// Animasyonları yükle
animationManager.loadAnimation('walkAnimation');
animationManager.loadAnimation('runAnimation');
animationManager.loadAnimation('attackAnimation');

// Karakter animasyonlarını oynat
const character = new THREE.Object3D();
animationManager.playCharacterAnimation(character, 'walkAnimation');

// Düşman animasyonlarını oynat
const enemy = new THREE.Object3D();
animationManager.playEnemyAnimation(enemy, 'attackAnimation');

// Animasyon hızını ayarla
animationManager.setAnimationSpeed(character, 'walkAnimation', 0.5);