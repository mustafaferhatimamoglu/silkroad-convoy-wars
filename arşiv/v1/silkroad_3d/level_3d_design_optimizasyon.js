// level_3d_design_optimizasyon.js

class LevelManager {
    constructor() {
        this.levels = [];
        this.currentLevel = null;
    }

    loadLevel(levelName) {
        // Seviye dosyasını yükle ve seviyeyi başlat
        const level = this.getLevel(levelName);
        if (level) {
            this.currentLevel = level;
            designLevel(this.currentLevel);
        } else {
            console.error(`Seviye ${levelName} bulunamadı.`);
        }
    }

    getLevel(levelName) {
        // Belirtilen seviyeyi döndür
        return this.levels.find(level => level.levelName === levelName);
    }

    removeLevel(levelName) {
        // Belirtilen seviyeyi kaldır
        this.levels = this.levels.filter(level => level.levelName !== levelName);
        if (this.currentLevel && this.currentLevel.levelName === levelName) {
            this.currentLevel = null;
        }
    }
}

class LevelDesign {
    constructor(levelName) {
        this.levelName = levelName;
        this.environment = null;
        this.objects = [];
    }

    addObject(object) {
        // Seviyeye obje ekle
        this.objects.push(object);
    }

    removeObject(object) {
        // Seviyeden obje kaldır
        this.objects = this.objects.filter(obj => obj !== object);
    }

    designLevel() {
        // Seviyeyi tasarım yap ve objeleri ekleyin
        console.log(`Seviye ${this.levelName} tasarımına başlandı.`);
    }
}

class ObjectManager {
    constructor() {
        this.objects = [];
    }

    createObject(type, options) {
        // Belirtilen tür ve seçeneklerle obje oluştur
        const object = { type, options };
        this.objects.push(object);
        return object;
    }

    updateObject(object, options) {
        // Belirtilen objeyi güncelle
        Object.assign(object, options);
    }

    deleteObject(object) {
        // Belirtilen objeyi kaldır
        this.objects = this.objects.filter(obj => obj !== object);
    }
}

class CameraController {
    constructor(cameraType, cameraPosition) {
        this.cameraType = cameraType;
        this.cameraPosition = cameraPosition;
    }

    setCameraPosition(position) {
        // Kamera pozisyonunu ayarla
        this.cameraPosition = position;
    }

    getCameraPosition() {
        // Kamera pozisyonunu döndür
        return this.cameraPosition;
    }

    moveCamera(direction) {
        // Kamerayi belirtilen yöne hareket ettir
        switch (direction) {
            case 'forward':
                this.cameraPosition[1] += 1;
                break;
            case 'backward':
                this.cameraPosition[1] -= 1;
                break;
            case 'left':
                this.cameraPosition[0] -= 1;
                break;
            case 'right':
                this.cameraPosition[0] += 1;
                break;
            default:
                console.error('Geçersiz yön');
        }
    }
}

// Örnek kullanım
const levelManager = new LevelManager();
const level = new LevelDesign('level1');
levelManager.loadLevel('level1');

const objectManager = new ObjectManager();
const object = objectManager.createObject('cube', { size: 2 });
level.addObject(object);

const cameraController = new CameraController('TPS', [0, 0, 0]);
cameraController.moveCamera('forward');
console.log(cameraController.getCameraPosition());