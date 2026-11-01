// tercat_catışmaları.js

// Sınıflar

class CollisionManager {
  constructor() {
    this.collisions = [];
  }

  addCollision(collision) {
    this.collisions.push(collision);
  }

  removeCollision(collision) {
    const index = this.collisions.indexOf(collision);
    if (index !== -1) {
      this.collisions.splice(index, 1);
    }
  }

  checkCollisions() {
    for (let i = 0; i < this.collisions.length; i++) {
      this.collisions[i].resolveCollision();
      this.applyDamage(this.collisions[i]);
    }
  }

  applyDamage(collision) {
    collision.objectA.takeDamage(collision.damage);
    collision.objectB.takeDamage(collision.damage);
  }
}

class Collision {
  constructor(objectA, objectB, type) {
    this.objectA = objectA;
    this.objectB = objectB;
    this.type = type;
    this.damage = this.calculateDamage();
  }

  resolveCollision() {
    // Çatışma çözümleme logiği burada yazılabilir
    console.log(`Collision between ${this.objectA.name} and ${this.objectB.name} of type ${this.type}`);
  }

  calculateDamage() {
    // Zarar hesaplama logiği burada yazılabilir
    return 10; // Örnek olarak 10 zarar
  }
}

class CollisionDetector {
  constructor(scene) {
    this.scene = scene;
  }

  detectCollisions() {
    // Çatışma tespiti logiği burada yazılabilir
    const objects = this.scene.children.filter(child => child.isMesh);
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        if (this.checkCollision(objects[i], objects[j])) {
          const collision = createCollision(objects[i], objects[j], "tir-tir");
          collisionManager.addCollision(collision);
        }
      }
    }
  }

  checkCollision(objectA, objectB) {
    // Çatışma tespiti algoritması burada yazılabilir
    return true; // Örnek olarak her iki nesne de çatışıyor
  }
}

// Fonksiyonlar

function handleCollisions(collisionManager) {
  collisionManager.checkCollisions();
}

function createCollision(objectA, objectB, type) {
  return new Collision(objectA, objectB, type);
}

function resolveAllCollisions(collisionManager) {
  collisionManager.checkCollisions();
}

// Değişkenler

const collisionManager = new CollisionManager();
const collisionDetector = new CollisionDetector(scene);