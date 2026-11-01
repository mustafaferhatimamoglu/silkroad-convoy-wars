// fps_tps_kamera.js

class FPS_TPS_Kamera {
  constructor(canvas) {
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.camera.position.z = 5;
    this.orbitaMerkez = new THREE.Vector3(0, 0, 0);
    this.orbitaYukseklik = 5;
    this.orbitaAcisi = 0;
    this.kameraTipi = 'FPS';
    this.kameraKonumu = this.camera.position;
    this.kameraHedefi = this.orbitaMerkez;
    this.kameraAcisi = 0;
    this.kameraYukseklik = 5;
    this.kameraHareketHızı = 0.05;
    this.kameraZoomHızı = 0.1;
    this.mouseOrbitaKontrol = new MouseOrbitControl(this.camera, canvas);
    this.keyboardInput = new KeyboardInput();
    this.mouseInput = new MouseInput();
  }

  initKamera() {
    this.camera.lookAt(this.orbitaMerkez);
    this.mouseOrbitaKontrol.update();
  }

  updateKamera() {
    if (this.kameraTipi === 'FPS') {
      this.updateFPSKamera();
    } else if (this.kameraTipi === 'TPS') {
      this.updateTPSKamera();
    }
    this.mouseOrbitaKontrol.update();
  }

  updateFPSKamera() {
    this.kameraKonumu.setFromMatrixPosition(this.camera.matrixWorld);
  }

  updateTPSKamera() {
    this.camera.lookAt(this.orbitaMerkez);
    this.camera.position.copy(this.orbitaMerkez);
    this.camera.position.y += this.orbitaYukseklik;
    this.camera.position.x += Math.sin(this.orbitaAcisi) * this.orbitaYukseklik;
    this.camera.position.z += Math.cos(this.orbitaAcisi) * this.orbitaYukseklik;
  }

  setKameraTipi(tip) {
    this.kameraTipi = tip;
  }

  zoomKamera(yon, miktar) {
    if (yon === 'yukari') {
      this.orbitaYukseklik += miktar;
    } else if (yon === 'asagi') {
      this.orbitaYukseklik -= miktar;
    }
  }

  hareketKamera(yon, miktar) {
    if (yon === 'ileri') {
      this.orbitaMerkez.x += Math.sin(this.orbitaAcisi) * miktar;
      this.orbitaMerkez.z += Math.cos(this.orbitaAcisi) * miktar;
    } else if (yon === 'geri') {
      this.orbitaMerkez.x -= Math.sin(this.orbitaAcisi) * miktar;
      this.orbitaMerkez.z -= Math.cos(this.orbitaAcisi) * miktar;
    } else if (yon === 'sag') {
      this.orbitaMerkez.x += Math.cos(this.orbitaAcisi) * miktar;
      this.orbitaMerkez.z -= Math.sin(this.orbitaAcisi) * miktar;
    } else if (yon === 'sol') {
      this.orbitaMerkez.x -= Math.cos(this.orbitaAcisi) * miktar;
      this.orbitaMerkez.z += Math.sin(this.orbitaAcisi) * miktar;
    }
  }

  kameraYukseklikAyarla(yukseklik) {
    this.orbitaYukseklik = yukseklik;
  }

  kameraAcisiAyarla(aci) {
    this.orbitaAcisi = aci;
  }

  kameraOrbitaYukseklikAyarla(yukseklik) {
    this.orbitaYukseklik = yukseklik;
  }

  kameraOrbitaAcisiAyarla(aci) {
    this.orbitaAcisi = aci;
  }

  kameraOrbitaMerkezAyarla(merkez) {
    this.orbitaMerkez = merkez;
  }

  kameraYonunuGuncelle() {
    if (this.kameraTipi === 'FPS') {
      this.kamera.lookAt(this.orbitaMerkez);
    } else if (this.kameraTipi === 'TPS') {
      this.camera.lookAt(this.orbitaMerkez);
    }
  }
}

class MouseInput {
  constructor() {
    this.mouseDown = false;
    this.mousePos = new THREE.Vector2();
    this.lastMousePos = new THREE.Vector2();
  }

  onMouseDown(event) {
    this.mouseDown = true;
    this.lastMousePos.set(event.clientX, event.clientY);
  }

  onMouseUp(event) {
    this.mouseDown = false;
  }

  onMouseMove(event) {
    if (this.mouseDown) {
      this.mousePos.set(event.clientX, event.clientY);
      const deltaX = this.mousePos.x - this.lastMousePos.x;
      const deltaY = this.mousePos.y - this.lastMousePos.y;
      this.lastMousePos.copy(this.mousePos);
      orbitaAcisi += deltaX * 0.01;
      orbitaYukseklik += deltaY * 0.01;
      kameraOrbitaAcisiAyarla(orbitaAcisi);
      kameraOrbitaYukseklikAyarla(orbitaYukseklik);
    }
  }
}

class KeyboardInput {
  constructor() {
    this.keys = {};
  }

  onKeyDown(event) {
    this.keys[event.key] = true;
  }

  onKeyUp(event) {
    this.keys[event.key] = false;
  }

  handleInput() {
    if (this.keys['w']) {
      hareketKamera('ileri', kameraHareketHızı);
    }
    if (this.keys['s']) {
      hareketKamera('geri', kameraHareketHızı);
    }
    if (this.keys['a']) {
      hareketKamera('sol', kameraHareketHızı);
    }
    if (this.keys['d']) {
      hareketKamera('sag', kameraHareketHızı);
    }
    if (this.keys['z']) {
      zoomKamera('yukari', kameraZoomHızı);
    }
    if (this.keys['x']) {
      zoomKamera('asagi', kameraZoomHızı);
    }
  }
}

function initKamera() {
  fpsTpsKamera = new FPS_TPS_Kamera(canvas);
  fpsTpsKamera.initKamera();
}

function updateKamera() {
  fpsTpsKamera.updateKamera();
}

function setKameraTipi(tip) {
  fpsTpsKamera.setKameraTipi(tip);
}

function zoomKamera(yon, miktar) {
  fpsTpsKamera.zoomKamera(yon, miktar);
}

function hareketKamera(yon, miktar) {
  fpsTpsKamera.hareketKamera(yon, miktar);
}

function kameraYukseklikAyarla(yukseklik) {
  fpsTpsKamera.kameraYukseklikAyarla(yukseklik);
}

function kameraAcisiAyarla(aci) {
  fpsTpsKamera.kameraAcisiAyarla(aci);
}

function kameraOrbitaYukseklikAyarla(yukseklik) {
  fpsTpsKamera.kameraOrbitaYukseklikAyarla(yukseklik);
}

function kameraOrbitaAcisiAyarla(aci) {
  fpsTpsKamera.kameraOrbitaAcisiAyarla(aci);
}

function kameraOrbitaMerkezAyarla(merkez) {
  fpsTpsKamera.kameraOrbitaMerkezAyarla(merkez);
}

function kameraYonunuGuncelle() {
  fpsTpsKamera.kameraYonunuGuncelle();
}

document.addEventListener('mousedown', fpsTpsKamera.mouseInput.onMouseDown.bind(fpsTpsKamera.mouseInput));
document.addEventListener('mouseup', fpsTpsKamera.mouseInput.onMouseUp.bind(fpsTpsKamera.mouseInput));
document.addEventListener('mousemove', fpsTpsKamera.mouseInput.onMouseMove.bind(fpsTpsKamera.mouseInput));
document.addEventListener('keydown', fpsTpsKamera.keyboardInput.onKeyDown.bind(fpsTpsKamera.keyboardInput));
document.addEventListener('keyup', fpsTpsKamera.keyboardInput.onKeyUp.bind(fpsTpsKamera.keyboardInput));