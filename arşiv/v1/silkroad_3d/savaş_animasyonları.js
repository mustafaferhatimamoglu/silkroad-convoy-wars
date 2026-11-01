// savaş_animasyonları.js

class Animation {
    constructor(id, data) {
        this.id = id;
        this.data = data;
    }

    play() {
        console.log(`Animation ${this.id} is playing`);
    }

    stop() {
        console.log(`Animation ${this.id} is stopped`);
    }

    setSpeed(speed) {
        console.log(`Animation ${this.id} speed set to ${speed}`);
    }

    setPosition(position) {
        console.log(`Animation ${this.id} position set to ${position}`);
    }

    setLoop(loop) {
        console.log(`Animation ${this.id} loop set to ${loop}`);
    }

    trigger(triggerID) {
        console.log(`Animation ${this.id} triggered by ${triggerID}`);
    }
}

class AnimationManager {
    constructor() {
        this.animations = {};
        this.animationSpeeds = {};
        this.animationPositions = {};
        this.animationLoops = {};
    }

    init() {
        console.log("Animations initialized");
    }

    addAnimation(animationID, animationData) {
        this.animations[animationID] = new Animation(animationID, animationData);
        this.animationSpeeds[animationID] = 1;
        this.animationPositions[animationID] = { x: 0, y: 0, z: 0 };
        this.animationLoops[animationID] = false;
        console.log(`Animation ${animationID} added`);
    }

    removeAnimation(animationID) {
        delete this.animations[animationID];
        delete this.animationSpeeds[animationID];
        delete this.animationPositions[animationID];
        delete this.animationLoops[animationID];
        console.log(`Animation ${animationID} removed`);
    }

    playAnimation(animationID) {
        if (this.animations[animationID]) {
            this.animations[animationID].play();
        } else {
            console.log(`Animation ${animationID} not found`);
        }
    }

    stopAnimation(animationID) {
        if (this.animations[animationID]) {
            this.animations[animationID].stop();
        } else {
            console.log(`Animation ${animationID} not found`);
        }
    }

    setAnimationSpeed(animationID, speed) {
        if (this.animations[animationID]) {
            this.animationSpeeds[animationID] = speed;
            this.animations[animationID].setSpeed(speed);
        } else {
            console.log(`Animation ${animationID} not found`);
        }
    }

    setPosition(animationID, position) {
        if (this.animations[animationID]) {
            this.animationPositions[animationID] = position;
            this.animations[animationID].setPosition(position);
        } else {
            console.log(`Animation ${animationID} not found`);
        }
    }

    setAnimationLoop(animationID, loop) {
        if (this.animations[animationID]) {
            this.animationLoops[animationID] = loop;
            this.animations[animationID].setLoop(loop);
        } else {
            console.log(`Animation ${animationID} not found`);
        }
    }

    triggerAnimationTrigger(animationID, triggerID) {
        if (this.animations[animationID]) {
            this.animations[animationID].trigger(triggerID);
        } else {
            console.log(`Animation ${animationID} not found`);
        }
    }
}

function initAnimations() {
    const animationManager = new AnimationManager();
    animationManager.init();
    // Add more animations as needed
    animationManager.addAnimation("swordSwing", { /* animation data */ });
    animationManager.addAnimation("shieldBlock", { /* animation data */ });
}

function setAnimationSpeed(animationID, speed) {
    const animationManager = new AnimationManager();
    animationManager.setAnimationSpeed(animationID, speed);
}

function setPosition(animationID, position) {
    const animationManager = new AnimationManager();
    animationManager.setPosition(animationID, position);
}

function playAnimation(animationID) {
    const animationManager = new AnimationManager();
    animationManager.playAnimation(animationID);
}

function stopAnimation(animationID) {
    const animationManager = new AnimationManager();
    animationManager.stopAnimation(animationID);
}

function loopAnimation(animationID) {
    const animationManager = new AnimationManager();
    animationManager.setAnimationLoop(animationID, true);
}

function setAnimationLoop(animationID, loop) {
    const animationManager = new AnimationManager();
    animationManager.setAnimationLoop(animationID, loop);
}

function triggerAnimationTrigger(animationID, triggerID) {
    const animationManager = new AnimationManager();
    animationManager.triggerAnimationTrigger(animationID, triggerID);
}

function addAnimation(animationID, animationData) {
    const animationManager = new AnimationManager();
    animationManager.addAnimation(animationID, animationData);
}

function removeAnimation(animationID) {
    const animationManager = new AnimationManager();
    animationManager.removeAnimation(animationID);
}