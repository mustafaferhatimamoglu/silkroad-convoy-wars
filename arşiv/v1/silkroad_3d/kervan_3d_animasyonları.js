// kervan_3d_animasyonları.js

// Değişkenler
const kervanAnimations = {};
const animationTypes = ['walk', 'run', 'gallop', 'stop'];
const animationSpeeds = {
    walk: 0.1,
    run: 0.5,
    gallop: 1.0,
    stop: 0
};

// Sınıflar
class KervanAnimation {
    constructor(animationType, speed) {
        this.animationType = animationType;
        this.speed = speed;
        this.events = {};
    }

    play() {
        console.log(`Kervan is now ${this.animationType}ing at speed ${this.speed}`);
    }

    pause() {
        console.log(`Kervan has paused`);
    }

    stop() {
        console.log(`Kervan has stopped`);
    }

    setSpeed(speed) {
        this.speed = speed;
        console.log(`Kervan speed set to ${this.speed}`);
    }

    addEvent(eventType, callback) {
        if (!this.events[eventType]) {
            this.events[eventType] = [];
        }
        this.events[eventType].push(callback);
        console.log(`Event ${eventType} added to kervan animation`);
    }
}

class KervanAnimationManager {
    constructor() {
        this.kervanAnimations = {};
    }

    addAnimation(kervanModel, animation) {
        this.kervanAnimations[kervanModel] = animation;
        console.log(`Animation added for kervan model ${kervanModel}`);
    }

    removeAnimation(kervanModel) {
        if (this.kervanAnimations[kervanModel]) {
            delete this.kervanAnimations[kervanModel];
            console.log(`Animation removed for kervan model ${kervanModel}`);
        }
    }

    getAnimation(kervanModel) {
        return this.kervanAnimations[kervanModel];
    }
}

// Fonksiyonlar
function createKervanAnimation(kervanModel, animationType) {
    if (animationTypes.includes(animationType)) {
        const speed = animationSpeeds[animationType];
        const animation = new KervanAnimation(animationType, speed);
        kervanAnimations[kervanModel] = animation;
        console.log(`Kervan animation created for model ${kervanModel}`);
        return animation;
    } else {
        console.error(`Invalid animation type: ${animationType}`);
        return null;
    }
}

function animateKervan(kervanModel, animationType) {
    const animation = kervanAnimations[kervanModel];
    if (animation) {
        animation.play();
    } else {
        console.error(`No animation found for kervan model ${kervanModel}`);
    }
}

function stopKervanAnimation(kervanModel) {
    const animation = kervanAnimations[kervanModel];
    if (animation) {
        animation.stop();
    } else {
        console.error(`No animation found for kervan model ${kervanModel}`);
    }
}

function setKervanAnimationSpeed(kervanModel, speed) {
    const animation = kervanAnimations[kervanModel];
    if (animation) {
        animation.setSpeed(speed);
    } else {
        console.error(`No animation found for kervan model ${kervanModel}`);
    }
}

function addKervanAnimationEvent(kervanModel, eventType, callback) {
    const animation = kervanAnimations[kervanModel];
    if (animation) {
        animation.addEvent(eventType, callback);
    } else {
        console.error(`No animation found for kervan model ${kervanModel}`);
    }
}

// Kullanım Örneği
const manager = new KervanAnimationManager();
const kervanAnimation = createKervanAnimation('kervan1', 'walk');
manager.addAnimation('kervan1', kervanAnimation);
animateKervan('kervan1', 'walk');
setKervanAnimationSpeed('kervan1', 0.2);
addKervanAnimationEvent('kervan1', 'stop', () => console.log('Kervan stopped'));
stopKervanAnimation('kervan1');
manager.removeAnimation('kervan1');