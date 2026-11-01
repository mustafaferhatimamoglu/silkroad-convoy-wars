// Dosya: 3d_korsan_saldırıları_animasyonları.js

class KorsanSaldırıAnimasyonu {
  constructor(id, animasyon) {
    this.id = id;
    this.animasyon = animasyon;
  }
}

class KorsanSaldırıAnimator {
  constructor() {
    this.animations = {};
  }

  addAnimation(animasyon) {
    this.animations[animasyon.id] = animasyon;
  }

  removeAnimation(animasyonID) {
    delete this.animations[animasyonID];
  }

  updateAnimation(animasyonID, yeniAnimasyon) {
    if (this.animations[animasyonID]) {
      this.animations[animasyonID].animasyon = yeniAnimasyon;
    }
  }

  startAnimation(animasyonID) {
    if (this.animations[animasyonID]) {
      this.animations[animasyonID].animasyon.start();
    }
  }

  stopAnimation(animasyonID) {
    if (this.animations[animasyonID]) {
      this.animations[animasyonID].animasyon.stop();
    }
  }

  pauseAnimation(animasyonID) {
    if (this.animations[animasyonID]) {
      this.animations[animasyonID].animasyon.pause();
    }
  }

  resumeAnimation(animasyonID) {
    if (this.animations[animasyonID]) {
      this.animations[animasyonID].animasyon.resume();
    }
  }

  setAnimationSpeed(animasyonID, hız) {
    if (this.animations[animasyonID]) {
      this.animations[animasyonID].animasyon.setSpeed(hız);
    }
  }

  getAnimation(animasyonID) {
    return this.animations[animasyonID];
  }
}

class KorsanSaldırıAnimasyonManagement {
  constructor() {
    this.korsanSaldırılarıAnimasyonlarıListesi = [];
    this.korsanSaldırıAnimator = new KorsanSaldırıAnimator();
  }

  initKorsanSaldırıAnimasyonları() {
    // Burada animasyonları başlatıp ekleyebilirsiniz
  }

  addKorsanSaldırıAnimasyon(animasyon) {
    const yeniAnimasyon = new KorsanSaldırıAnimasyonu(animasyon.id, animasyon);
    this.korsanSaldırılarıAnimasyonlarıListesi.push(yeniAnimasyon);
    this.korsanSaldırıAnimator.addAnimation(yeniAnimasyon);
  }

  removeKorsanSaldırıAnimasyon(animasyonID) {
    this.korsanSaldırılarıAnimasyonlarıListesi = this.korsanSaldırılarıAnimasyonlarıListesi.filter(animasyon => animasyon.id !== animasyonID);
    this.korsanSaldırıAnimator.removeAnimation(animasyonID);
  }

  updateKorsanSaldırıAnimasyon(animasyonID, yeniAnimasyon) {
    const animasyon = this.getKorsanSaldırıAnimasyon(animasyonID);
    if (animasyon) {
      animasyon.animasyon = yeniAnimasyon;
      this.korsanSaldırıAnimator.updateAnimation(animasyonID, yeniAnimasyon);
    }
  }

  startKorsanSaldırıAnimasyon(animasyonID) {
    this.korsanSaldırıAnimator.startAnimation(animasyonID);
  }

  stopKorsanSaldırıAnimasyon(animasyonID) {
    this.korsanSaldırıAnimator.stopAnimation(animasyonID);
  }

  pauseKorsanSaldırıAnimasyon(animasyonID) {
    this.korsanSaldırıAnimator.pauseAnimation(animasyonID);
  }

  resumeKorsanSaldırıAnimasyon(animasyonID) {
    this.korsanSaldırıAnimator.resumeAnimation(animasyonID);
  }

  setKorsanSaldırıAnimasyonSpeed(animasyonID, hız) {
    this.korsanSaldırıAnimator.setAnimationSpeed(animasyonID, hız);
  }

  getKorsanSaldırıAnimasyon(animasyonID) {
    return this.korsanSaldırılarıAnimasyonlarıListesi.find(animasyon => animasyon.id === animasyonID);
  }
}

// Örnek Kullanım:
const korsanSaldırıAnimasyonManagement = new KorsanSaldırıAnimasyonManagement();
korsanSaldırıAnimasyonManagement.initKorsanSaldırıAnimasyonları();
const yeniAnimasyon = new THREE.AnimationClip('example', 30, [new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1, 1, 1])]);
korsanSaldırıAnimasyonManagement.addKorsanSaldırıAnimasyon(yeniAnimasyon);
korsanSaldırıAnimasyonManagement.startKorsanSaldırıAnimasyon(yeniAnimasyon.id);