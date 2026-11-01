class TirAnimation {
    constructor(tirModel, animationSpeed = 1.0) {
        this.tirModel = tirModel;
        this.animationSpeed = animationSpeed;
        this.animation = null;
    }

    playAnimation() {
        if (!this.animation) {
            this.animation = this.tirModel.animate({ duration: 1000 / this.animationSpeed });
            this.animation.start();
        }
    }

    pauseAnimation() {
        if (this.animation) {
            this.animation.pause();
        }
    }

    stopAnimation() {
        if (this.animation) {
            this.animation.stop();
            this.animation = null;
        }
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = speed;
        if (this.animation) {
            this.animation = this.tirModel.animate({ duration: 1000 / this.animationSpeed });
        }
    }
}

class TirAnimator {
    constructor(tirModel) {
        this.tirModel = tirModel;
        this.animations = [];
    }

    addAnimation(animation) {
        this.animations.push(animation);
    }

    removeAnimation(animation) {
        const index = this.animations.indexOf(animation);
        if (index !== -1) {
            this.animations.splice(index, 1);
        }
    }

    playAllAnimations() {
        this.animations.forEach(animation => animation.playAnimation());
    }

    pauseAllAnimations() {
        this.animations.forEach(animation => animation.pauseAnimation());
    }

    stopAllAnimations() {
        this.animations.forEach(animation => animation.stopAnimation());
    }
}

class TirAnimationController {
    constructor(tirModels) {
        this.tirModels = tirModels;
        this.animationControllers = {};
    }

    addTirModel(tirModel) {
        if (!this.tirModels.includes(tirModel)) {
            this.tirModels.push(tirModel);
            this.animationControllers[tirModel] = new TirAnimator(tirModel);
        }
    }

    removeTirModel(tirModel) {
        const index = this.tirModels.indexOf(tirModel);
        if (index !== -1) {
            this.tirModels.splice(index, 1);
            delete this.animationControllers[tirModel];
        }
    }

    startAnimations() {
        Object.values(this.animationControllers).forEach(controller => controller.playAllAnimations());
    }

    stopAnimations() {
        Object.values(this.animationControllers).forEach(controller => controller.stopAllAnimations());
    }
}

function createTirAnimation(tirModel, animationSpeed) {
    return new TirAnimation(tirModel, animationSpeed);
}

function createTirAnimator(tirModel) {
    return new TirAnimator(tirModel);
}

function createTirAnimationController(tirModels) {
    return new TirAnimationController(tirModels);
}

// Değişkenler
const tirAnimations = new Map();
const tirAnimators = new Map();
const tirAnimationControllers = new Map();