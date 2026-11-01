// Dosya: 3d_korsan_saldırıları.js

// Değişkenler
let swarmCount = 5;
let swarmSpeed = 10;
let swarmDamage = 50;
let swarmHealth = 200;
let swarmSpawningInterval = 2000;

// Sınıflar
class Swarm {
  constructor() {
    this.initialize();
  }

  initialize() {
    this.position = new THREE.Vector3(Math.random() * 1000 - 500, Math.random() * 1000 - 500, Math.random() * 1000 - 500);
    this.velocity = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(swarmSpeed);
    this.target = null;
    this.health = swarmHealth;
  }

  move() {
    this.position.add(this.velocity);
  }

  attack() {
    if (this.target) {
      calculateDamage();
    }
  }

  update() {
    this.move();
    if (this.health <= 0) {
      this.initialize();
    }
  }

  animate() {
    // Animasyon kodu buraya gelecektir.
  }
}

class SwarmManager {
  constructor() {
    this.swarms = [];
  }

  initializeSwarms() {
    for (let i = 0; i < swarmCount; i++) {
      this.swarms.push(new Swarm());
    }
  }

  spawnSwarm() {
    this.swarms.push(new Swarm());
  }

  updateSwarms() {
    this.swarms.forEach(swarm => swarm.update());
  }

  animateSwarms() {
    this.swarms.forEach(swarm => swarm.animate());
  }

  handleCollisions() {
    for (let i = 0; i < this.swarms.length; i++) {
      for (let j = i + 1; j < this.swarms.length; j++) {
        if (this.swarms[i].position.distanceTo(this.swarms[j].position) < 10) {
          this.swarms[i].handleCollision(this.swarms[j]);
          this.swarms[j].handleCollision(this.swarms[i]);
        }
      }
    }
  }
}

// Fonksiyonlar
function initializeSwarms() {
  swarmManager.initializeSwarms();
}

function spawnSwarm() {
  swarmManager.spawnSwarm();
}

function updateSwarm() {
  swarmManager.updateSwarms();
}

function attackTarget(target) {
  swarmManager.swarms.forEach(swarm => swarm.attack(target));
}

function calculateDamage() {
  return Math.floor(Math.random() * swarmDamage);
}

function animateSwarm() {
  swarmManager.animateSwarms();
}

function handleCollision(other) {
  this.health -= calculateDamage();
}

// Örnek kullanım
let swarmManager = new SwarmManager();
initializeSwarms();
setInterval(updateSwarm, 16); // FPS için yaklaşık 60 FPS
setInterval(animateSwarm, 16);