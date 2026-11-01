// tirk_3d_animasyonları.js

// Değişkenler
let tirAnimations = {};
let currentTirAnimation = null;
let tirAnimationSpeed = 1;
let tirAnimationStatus = "stopped";

// Fonksiyonlar
function animateTir(tirModel) {
  let animation = new THREE.AnimationClip("tirAnimation", null, [
    new THREE.VectorKeyframeTrack(".position", [0, 1], [tirModel.position.x, tirModel.position.y, tirModel.position.z, tirModel.position.x + 10, tirModel.position.y + 10, tirModel.position.z + 10], THREE.InterpolateLinear),
    new THREE.QuaternionKeyframeTrack(".quaternion", [0, 1], [tirModel.quaternion.x, tirModel.quaternion.y, tirModel.quaternion.z, tirModel.quaternion.w, 0, 0, 0, 1], THREE.InterpolateQuaternion)
  ]);
  tirModel.mixer = new THREE.AnimationMixer(tirModel);
  let action = tirModel.mixer.clipAction(animation);
  action.play();
}

function updateTirAnimation() {
  if (currentTirAnimation) {
    currentTirAnimation.mixer.update(tirAnimationSpeed);
  }
}

function playTirAnimation(tirModel) {
  if (tirModel) {
    animateTir(tirModel);
    currentTirAnimation = tirModel;
    tirAnimationStatus = "playing";
  }
}

function stopTirAnimation() {
  if (currentTirAnimation) {
    currentTirAnimation.mixer.stop();
    currentTirAnimation = null;
    tirAnimationStatus = "stopped";
  }
}

function resetTirAnimation() {
  if (currentTirAnimation) {
    currentTirAnimation.mixer.reset();
    tirAnimationStatus = "reset";
  }
}

function setTirAnimationSpeed(speed) {
  if (speed > 0) {
    tirAnimationSpeed = speed;
  }
}

function getTirAnimationStatus() {
  return tirAnimationStatus;
}

function toggleTirAnimation() {
  if (tirAnimationStatus === "playing") {
    stopTirAnimation();
  } else {
    playTirAnimation(currentTirAnimation);
  }
}

function animateTirCollision(tirModel, targetModel) {
  // Implement collision animation logic
}

function animateTirTurn(tirModel, direction) {
  // Implement turn animation logic
}

function animateTirSpeed(tirModel, speed) {
  // Implement speed animation logic
}

function animateTirBrake(tirModel) {
  // Implement brake animation logic
}

function animateTirLoad(tirModel, cargo) {
  // Implement load animation logic
}

function animateTirUnload(tirModel) {
  // Implement unload animation logic
}

function animateTirPassengerEntry(tirModel, passenger) {
  // Implement passenger entry animation logic
}

function animateTirPassengerExit(tirModel, passenger) {
  // Implement passenger exit animation logic
}

function animateTirHarvest(tirModel, resource) {
  // Implement harvest animation logic
}

function animateTirRepair(tirModel) {
  // Implement repair animation logic
}

// Sınıf
class TirAnimation {
  constructor(tirModel) {
    this.tirModel = tirModel;
    this.animation = null;
    this.status = "stopped";
    this.speed = 1;
    this.collision = false;
    this.turn = null;
    this.speed = null;
    this.brake = false;
    this.load = false;
    this.unload = false;
    this.passengerEntry = false;
    this.passengerExit = false;
    this.harvest = false;
    this.repair = false;
  }

  start() {
    playTirAnimation(this.tirModel);
  }

  stop() {
    stopTirAnimation();
  }

  reset() {
    resetTirAnimation();
  }

  setSpeed(newSpeed) {
    setTirAnimationSpeed(newSpeed);
  }

  toggleCollision() {
    this.collision = !this.collision;
    animateTirCollision(this.tirModel, targetModel);
  }

  toggleTurn(direction) {
    this.turn = direction;
    animateTirTurn(this.tirModel, direction);
  }

  toggleSpeed(newSpeed) {
    this.speed = newSpeed;
    animateTirSpeed(this.tirModel, newSpeed);
  }

  toggleBrake() {
    this.brake = !this.brake;
    animateTirBrake(this.tirModel);
  }

  toggleLoad(cargo) {
    this.load = !this.load;
    animateTirLoad(this.tirModel, cargo);
  }

  toggleUnload() {
    this.unload = !this.unload;
    animateTirUnload(this.tirModel);
  }

  togglePassengerEntry(passenger) {
    this.passengerEntry = !this.passengerEntry;
    animateTirPassengerEntry(this.tirModel, passenger);
  }

  togglePassengerExit(passenger) {
    this.passengerExit = !this.passengerExit;
    animateTirPassengerExit(this.tirModel, passenger);
  }

  toggleHarvest(resource) {
    this.harvest = !this.harvest;
    animateTirHarvest(this.tirModel, resource);
  }

  toggleRepair() {
    this.repair = !this.repair;
    animateTirRepair(this.tirModel);
  }
}