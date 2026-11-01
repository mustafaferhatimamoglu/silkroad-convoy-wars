// tcatışmalar_3d_v3.js

// Değişkenler
let collisionSystem;
let entities = [];
let collisionEvents = [];

// Sınıflar
class CollisionHandler {
    constructor(entity) {
        this.entity = entity;
    }

    handle(event) {
        // Tcatışmayı işleyen kod buraya yazılacak
        console.log(`Collision handled for entity: ${this.entity.id}`);
    }
}

class CollisionManager {
    constructor() {
        this.collisionHandlers = {};
    }

    initialize() {
        // Tcatışmaları başlatan kod buraya yazılacak
        console.log("Collision system initialized");
    }

    addHandler(entity) {
        if (!this.collisionHandlers[entity.id]) {
            this.collisionHandlers[entity.id] = new CollisionHandler(entity);
            entities.push(entity);
            console.log(`Handler added for entity: ${entity.id}`);
        } else {
            console.log(`Handler already exists for entity: ${entity.id}`);
        }
    }

    removeHandler(entity) {
        if (this.collisionHandlers[entity.id]) {
            delete this.collisionHandlers[entity.id];
            entities = entities.filter(e => e.id !== entity.id);
            console.log(`Handler removed for entity: ${entity.id}`);
        } else {
            console.log(`No handler found for entity: ${entity.id}`);
        }
    }

    update() {
        // Tcatışmaları güncellenen kod buraya yazılacak
        collisionEvents.forEach(event => {
            if (this.collisionHandlers[event.entityId]) {
                this.collisionHandlers[event.entityId].handle(event);
            }
        });
    }
}

// Fonksiyonlar
function initializeCollisions() {
    collisionSystem = new CollisionManager();
    collisionSystem.initialize();
    console.log("Collisions initialized");
}

function updateCollisions() {
    collisionSystem.update();
    console.log("Collisions updated");
}

function handleCollision(event) {
    collisionEvents.push(event);
    console.log(`Collision event handled: ${event.type}`);
}

function addCollisionHandler(entity) {
    collisionSystem.addHandler(entity);
}

function removeCollisionHandler(entity) {
    collisionSystem.removeHandler(entity);
}