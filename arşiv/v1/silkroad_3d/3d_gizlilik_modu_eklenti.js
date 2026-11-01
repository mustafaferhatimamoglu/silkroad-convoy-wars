// Dosya: 3d_gizlilik_modu_eklenti.js

// Gizlilik moduyla ilgili değişkenler
let gizlilikKaplaması;
let gizlilikSesleri;
let gizlilikModuIslemi;
let gizlilikModuEventListeners;

// Gizlilik kaplaması sınıfı
class GizlilikKaplaması {
  constructor() {
    this.isActive = false;
    this.currentLocation = null;
    this.startLocation = null;
  }

  initialize() {
    this.isActive = false;
    this.currentLocation = null;
    this.startLocation = null;
  }

  enterGizlilikModu(location) {
    this.startLocation = this.currentLocation;
    this.currentLocation = location;
    this.isActive = true;
    gizlilikSesleri.playEnterSound();
    gizlilikModuIslemi = setInterval(() => {
      gizlilikKaplamasıGuncelle();
    }, 1000);
  }

  exitGizlilikModu() {
    clearInterval(gizlilikModuIslemi);
    gizlilikSesleri.playExitSound();
    this.isActive = false;
    this.currentLocation = this.startLocation;
    this.startLocation = null;
  }
}

// Gizlilik sesleri sınıfı
class GizlilikSesleri {
  constructor() {
    this.enterSound = new Audio('path/to/enter_sound.mp3');
    this.exitSound = new Audio('path/to/exit_sound.mp3');
  }

  playEnterSound() {
    this.enterSound.play();
  }

  playExitSound() {
    this.exitSound.play();
  }
}

// Gizlilik modu eklenti fonksiyonları
function initGizlilikModu() {
  gizlilikKaplaması = new GizlilikKaplaması();
  gizlilikSesleri = new GizlilikSesleri();

  gizlilikModuEventListeners = {
    enable: enableGizlilikKaplaması,
    disable: disableGizlilikKaplaması,
    toggle: toggleGizlilikModu
  };

  document.addEventListener('keydown', (event) => {
    if (event.key === 'G') {
      toggleGizlilikModu();
    }
  });
}

function enableGizlilikKaplaması() {
  if (!gizlilikKaplaması.isActive) {
    gizlilikKaplaması.enterGizlilikModu('current_location');
  }
}

function disableGizlilikKaplaması() {
  if (gizlilikKaplaması.isActive) {
    gizlilikKaplaması.exitGizlilikModu();
  }
}

function toggleGizlilikModu() {
  if (gizlilikKaplaması.isActive) {
    disableGizlilikKaplaması();
  } else {
    enableGizlilikKaplaması();
  }
}

function gizlilikKaplamasıGuncelle() {
  // Gizlilik kaplaması sırasında güncelleme işlemlerini burada yapabilirsiniz
  console.log('Gizlilik kaplaması güncellendi:', gizlilikKaplaması.currentLocation);
}

function gizlilikKaplamasıSesEkle() {
  gizlilikSesleri.playEnterSound();
  gizlilikSesleri.playExitSound();
}

function gizlilikKaplamasıSesKaldır() {
  // Ses efektlerini kaldırmayı burada yapabilirsiniz
  console.log('Ses efektleri kaldırıldı');
}