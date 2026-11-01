```javascript
// level_editor_3d_extended.js

// Fonksiyonlar

function initializeLevelEditor() {
    // Editori başlatan kod
}

function addLevelElement(element) {
    // Seviyeye eleman ekleyen kod
}

function removeLevelElement(element) {
    // Seviyeden eleman kaldırıran kod
}

function updateLevelElement(element) {
    // Seviyenin elemanını güncelleyen kod
}

function loadLevelFromJson(json) {
    // Seviyeyi JSON'dan yükleyen kod
}

function saveLevelToJson(json) {
    // Seviyeyi JSON'a kaydeden kod
}

function generateRandomLevel() {
    // Rastgele seviye oluşturan kod
}

function enableGizlilikModu() {
    // Gizlilik modunu açan kod
}

function disableGizlilikModu() {
    // Gizlilik modunu kapatayan kod
}

function startLevelSimulation() {
    // Seviyeyi simüle eden kod
}

function stopLevelSimulation() {
    // Seviyeyi simülasyonu durdururan kod
}

function exportLevelToImage() {
    // Seviyeyi görsel olarak dışa aktarılan kod
}

function importLevelFromImage() {
    // Seviyeyi görsel olarak içeri aktarılan kod
}

function activateEconomicalSystem() {
    // Ekonomik sistemi etkinleştirir
}

function deactivateEconomicalSystem() {
    // Ekonomik sistemi devre dışı bırakır
}

function loadCustomModels() {
    // Özel modelleri yükler
}

function unloadCustomModels() {
    // Özel modelleri çıkarır
}

function startTradingSimulation() {
    // Ticari simulasyonu başlatır
}

function stopTradingSimulation() {
    // Ticari simulasyonu durdurur
}

function updateLevelLayout() {
    // Seviye düzenini günceller
}

// Sınıflar

class LevelEditor {
    constructor() {
        // Editor sınıfının yapıcı fonksiyonu
    }
}

class LevelElement {
    constructor() {
        // Seviye elemanının yapıcı fonksiyonu
    }
}

class LevelManager {
    constructor() {
        // Seviye yöneticisinin yapıcı fonksiyonu
    }
}

class EconomicalSystem {
    constructor() {
        // Ekonomik sisteminin yapıcı fonksiyonu
    }
}

class TradingSimulation {
    constructor() {
        // Ticari simulasyonunun yapıcı fonksiyonu
    }
}

class GizlilikModu {
    constructor() {
        // Gizlilik modunun yapıcı fonksiyonu
    }
}

class CustomModelManager {
    constructor() {
        // Özel model yöneticisinin yapıcı fonksiyonu
    }
}

class LevelSaver {
    constructor() {
        // Seviye kaydedicisinin yapıcı fonksiyonu
    }
}

class LevelLoader {
    constructor() {
        // Seviye yükleyicisinin yapıcı fonksiyonu
    }
}

class LevelSimulator {
    constructor() {
        // Seviye simulasyonunun yapıcı fonksiyonu
    }
}

class LevelExporter {
    constructor() {
        // Seviye dışa aktarımcısının yapıcı fonksiyonu
    }
}

class LevelImporter {
    constructor() {
        // Seviye içeri aktarımcısının yapıcı fonksiyonu
    }
}

class TradingManager {
    constructor() {
        // Ticari yöneticisinin yapıcı fonksiyonu
    }
}

// Değişkenler

let levelData = {};
let selectedElement = null;
let levelObjects = [];
let gizlilikModu = false;
let economicalSystem = null;
let tradingSimulation = null;
let levelSimulation = null;
let levelExporter = null;
let levelImporter = null;
let customModels = [];
let currentLevelDesign = {};
let levelSimulationMode = 'normal';