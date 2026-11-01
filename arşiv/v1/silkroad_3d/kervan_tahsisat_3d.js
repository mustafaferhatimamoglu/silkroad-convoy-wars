// kervan_tahsisat_3d.js

// Sınıflar

class KervanPart {
  constructor(partType, material, position) {
    this.type = partType;
    this.material = material;
    this.position = position;
    this.animation = null;
  }

  animate(animationName, duration) {
    // Animasyonu uygulama logik
    this.animation = animationName;
    console.log(`${this.type} is being animated with ${animationName} for ${duration} ms.`);
  }

  update(material, position) {
    this.material = material;
    this.position = position;
    console.log(`${this.type} updated with new material and position.`);
  }

  remove() {
    // Parçayı sildiğindeki işlemleri uygulama logik
    console.log(`${this.type} removed.`);
  }
}

class KervanManager {
  constructor() {
    this.parts = [];
  }

  createPart(partType, material, position) {
    const part = new KervanPart(partType, material, position);
    this.parts.push(part);
    console.log(`Part created: ${part.type}`);
    return part;
  }

  removePart(part) {
    const index = this.parts.indexOf(part);
    if (index !== -1) {
      this.parts.splice(index, 1);
      part.remove();
    }
    console.log(`Part removed: ${part.type}`);
  }

  animatePart(part, animationName, duration) {
    part.animate(animationName, duration);
  }

  updatePart(part, newMaterial, newPosition) {
    part.update(newMaterial, newPosition);
  }
}

// Değişkenler

let parts = [];
let animationManager = new AnimationManager();
let materialLibrary = {
  wood: {},
  metal: {},
  leather: {}
};
let positionManager = new PositionManager();

// Fonksiyonlar

function createPart(partType, material, position) {
  const part = new KervanPart(partType, material, position);
  parts.push(part);
  return part;
}

function animatePart(part, animationName, duration) {
  part.animate(animationName, duration);
}

function updatePart(part, newMaterial, newPosition) {
  part.update(newMaterial, newPosition);
}

function removePart(part) {
  parts.splice(parts.indexOf(part), 1);
  part.remove();
}