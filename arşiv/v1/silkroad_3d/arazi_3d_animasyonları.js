// arazi_3d_animasyonları.js

class AnimationManager {
    constructor() {
        this.animations = {};
    }

    startAnimation(animationName, object) {
        if (this.animations[animationName]) {
            this.animations[animationName].play();
        }
    }

    stopAnimation(animationName, object) {
        if (this.animations[animationName]) {
            this.animations[animationName].stop();
        }
    }

    updateAnimations() {
        for (let animation in this.animations) {
            this.animations[animation].update();
        }
    }
}

class PathAnimator {
    constructor() {
        this.paths = {};
    }

    animatePath(object, path) {
        if (path) {
            object.traverse((child) => {
                if (child.isMesh) {
                    child.position.copy(path[child.name]);
                }
            });
        }
    }

    stopPathAnimation(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                child.position.set(0, 0, 0);
            }
        });
    }
}

class RealTimeUpdater {
    constructor() {
        this.objects = {};
    }

    update() {
        for (let object in this.objects) {
            this.objects[object].update();
        }
    }
}

class EnvironmentAnimator {
    constructor() {
        this.environmentObjects = {};
    }

    animateEnvironment(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                child.rotation.y += 0.01;
            }
        });
    }

    stopEnvironmentAnimation(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                child.rotation.y = 0;
            }
        });
    }
}

function createAnimation(animationName, animationData) {
    let animation = new THREE.AnimationClip(animationName, null, animationData);
    animations[animationName] = animation;
    return animation;
}

function loadAnimation(animationName) {
    return animations[animationName];
}

function saveAnimation(animationName, animationObject) {
    animations[animationName] = animationObject;
}

function deleteAnimation(animationName) {
    delete animations[animationName];
}

// Örnek kullanım
let animationManager = new AnimationManager();
let pathAnimator = new PathAnimator();
let realTimeUpdater = new RealTimeUpdater();
let environmentAnimator = new EnvironmentAnimator();

let exampleAnimation = createAnimation('exampleAnimation', animationData);
animationManager.startAnimation('exampleAnimation', object);

pathAnimator.animatePath(object, path);

realTimeUpdater.objects['exampleObject'] = object;

environmentAnimator.animateEnvironment(object);