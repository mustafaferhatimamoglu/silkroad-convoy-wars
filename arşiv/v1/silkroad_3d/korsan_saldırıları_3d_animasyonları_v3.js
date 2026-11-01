// korsan_saldırıları_3d_animasyonları_v3.js

// Fonksiyonlar

function initializeAnimations() {
    // Animasyonları başlatır ve yükler.
    attackAnimations = [];
    siegeAnimations = [];
    currentAnimation = null;
    currentLevel = "";
    isSiegeMode = false;

    // Saldırı animasyonlarının tanımlanması ve yüklü olması
    for (let i = 1; i <= 5; i++) {
        const attackClip = new THREE.AnimationClip(`attack_${i}`, 2, [
            // Animasyon kliplerinin tanımlanması
        ]);
        attackAnimations.push(new AttackAnimation(attackClip, new THREE.AnimationMixer()));
    }

    // Savaş animasyonlarının tanımlanması ve yüklü olması
    const siegeClip = new THREE.AnimationClip("siege", 2, [
        // Animasyon kliplerinin tanımlanması
    ]);
    siegeAnimations.push(new SiegeAnimation(siegeClip, new THREE.AnimationMixer()));
}

function updateAnimations() {
    // Animasyonları günceller.
    if (currentAnimation) {
        currentAnimation.animationController.update(0.016);
    }
}

function playAttackAnimation(level) {
    // Korsan saldırı animasyonunu oynatır.
    currentLevel = level;
    const attackAnimation = getAttackAnimation(level);
    if (attackAnimation) {
        currentAnimation = attackAnimation;
        currentAnimation.startAnimation();
    }
}

function stopAttackAnimation() {
    // Korsan saldırı animasyonunu durdurur.
    if (currentAnimation) {
        currentAnimation.stopAnimation();
        currentAnimation = null;
    }
}

function startSiegeAnimation() {
    // Savaş modu için animasyonları başlatır.
    if (!isSiegeMode) {
        const siegeAnimation = siegeAnimations[0];
        currentAnimation = siegeAnimation;
        siegeAnimation.startSiege();
        isSiegeMode = true;
    }
}

function endSiegeAnimation() {
    // Savaş modu için animasyonları sonlandırır.
    if (isSiegeMode) {
        currentAnimation.stopAnimation();
        currentAnimation = null;
        isSiegeMode = false;
    }
}

// Sınıflar

class AttackAnimation {
    constructor(animationClip, animationController) {
        this.animationClip = animationClip;
        this.animationController = animationController;
    }

    startAnimation() {
        this.animationController.setAnimationAction(this.animationClip);
        this.animationController.play();
    }

    stopAnimation() {
        this.animationController.stop();
    }
}

class SiegeAnimation {
    constructor(animationClip, animationController) {
        this.animationClip = animationClip;
        this.animationController = animationController;
    }

    startSiege() {
        this.animationController.setAnimationAction(this.animationClip);
        this.animationController.play();
    }

    endSiege() {
        this.animationController.stop();
    }
}

class KervanSaldırıManager {
    constructor() {
        this.currentLevel = "";
    }

    playAttack(level) {
        playAttackAnimation(level);
    }

    stopAttack() {
        stopAttackAnimation();
    }
}

// Değişkenler

let attackAnimations = [];
let siegeAnimations = [];
let currentAnimation = null;
let currentLevel = "";
let isSiegeMode = false;