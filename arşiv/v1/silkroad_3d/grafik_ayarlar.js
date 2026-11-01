// grafik_ayarlar.js

// Kalite seçeneklerini saklayan sabit nesne
const graphicsQualityOptions = {
    low: "low",
    medium: "medium",
    high: "high",
    ultra: "ultra"
};

// Anti-aliasing seçeneklerini saklayan sabit nesne
const antiAliasingOptions = {
    enabled: true,
    disabled: false
};

// Gölge kalite seçeneklerini saklayan sabit nesne
const shadowQualityOptions = {
    low: "low",
    medium: "medium",
    high: "high",
    ultra: "ultra"
};

// Metinlik kalite seçeneklerini saklayan sabit nesne
const textureQualityOptions = {
    low: "low",
    medium: "medium",
    high: "high",
    ultra: "ultra"
};

// Tam ekran seçeneklerini saklayan sabit nesne
const fullscreenOptions = {
    enabled: true,
    disabled: false
};

// Grafik ayarlarını yönetmek için kullanılan sınıf
class GraphicsSettings {
    constructor() {
        this.currentQualityLevel = graphicsQualityOptions.medium;
        this.isAntiAliasingEnabled = antiAliasingOptions.enabled;
        this.currentShadowQuality = shadowQualityOptions.medium;
        this.isVSyncEnabled = true;
        this.currentTextureQuality = textureQualityOptions.medium;
        this.isPostProcessingEnabled = true;
        this.currentResolution = { width: window.innerWidth, height: window.innerHeight };
    }

    updateSettings() {
        // Ayarları güncelleyen metot
    }

    saveSettings() {
        // Ayarları kaydeden metot
    }

    loadSettings() {
        // Ayarları yükleyen metot
    }
}

// Fonksiyonlar
function setGraphicsQuality(qualityLevel) {
    GraphicsSettings.currentQualityLevel = qualityLevel;
}

function toggleAntiAliasing(enable) {
    GraphicsSettings.isAntiAliasingEnabled = enable;
}

function setShadowQuality(shadowQuality) {
    GraphicsSettings.currentShadowQuality = shadowQuality;
}

function toggleVSync(enable) {
    GraphicsSettings.isVSyncEnabled = enable;
}

function setTextureQuality(textureQuality) {
    GraphicsSettings.currentTextureQuality = textureQuality;
}

function togglePostProcessing(enable) {
    GraphicsSettings.isPostProcessingEnabled = enable;
}

function setResolution(width, height) {
    GraphicsSettings.currentResolution = { width, height };
    if (GraphicsSettings.isFullscreenEnabled) {
        document.fullscreenElement.requestFullscreen();
    }
}

function toggleFullscreen(enable) {
    GraphicsSettings.isFullscreenEnabled = enable;
    if (enable) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }
}