// korsan_saldırı_3d.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class KorsanSaldırıModeli {
    constructor(model, animation) {
        this.model = model;
        this.animation = animation;
    }

    setHareket(animationName) {
        this.animation.setLoop(THREE.LoopOnce, 1);
        this.animation.play();
    }

    start() {
        this.animation.play();
    }

    stop() {
        this.animation.stop();
    }

    update() {
        this.animation.update(0.016); // 60 FPS
    }
}

class KorsanSaldırıManager {
    constructor(scene) {
        this.scene = scene;
        this.attacks = [];
    }

    addAttack(attackModel) {
        this.attacks.push(attackModel);
        this.scene.add(attackModel.model);
    }

    removeAttack(attackModel) {
        const index = this.attacks.indexOf(attackModel);
        if (index !== -1) {
            this.attacks.splice(index, 1);
            this.scene.remove(attackModel.model);
        }
    }

    updateAttacks() {
        this.attacks.forEach(attack => attack.update());
    }
}

function initializeKorsanSaldırıAnimasyonları() {
    const scene = new THREE.Scene();
    const loader = new GLTFLoader();
    const saldırıManager = new KorsanSaldırıManager(scene);

    loader.load('path/to/attack/model.glb', (gltf) => {
        const attackModel = gltf.scene;
        const animation = new THREE.Animation(attackModel, gltf.animations[0]);
        const saldırıModeli = new KorsanSaldırıModeli(attackModel, animation);
        saldırıManager.addAttack(salacıModeli);
    });

    return saldırıManager;
}

function createSaldırıModeli(modelPath) {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
        loader.load(modelPath, (gltf) => {
            resolve(gltf.scene);
        }, undefined, (error) => {
            reject(error);
        });
    });
}

function setSaldırıHareketi(attackModel, animationName) {
    attackModel.animation.setLoop(THREE.LoopOnce, 1);
    attackModel.animation.play();
}

function startSaldırı(attackModel) {
    attackModel.animation.play();
}

function stopSaldırı(attackModel) {
    attackModel.animation.stop();
}

function updateSaldırı(attackModel) {
    attackModel.animation.update(0.016); // 60 FPS
}

const saldırıModelleri = [];
const saldırıManager = initializeKorsanSaldırıAnimasyonları();