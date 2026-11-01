class GrafikAyarları {
  constructor(renderQuality, textureQuality, shaderQuality, antiAliasing, shadowQuality, postProcessing) {
    this.renderQuality = renderQuality;
    this.textureQuality = textureQuality;
    this.shaderQuality = shaderQuality;
    this.antiAliasing = antiAliasing;
    this.shadowQuality = shadowQuality;
    this.postProcessing = postProcessing;
  }

  setRenderQuality(value) {
    this.renderQuality = value;
  }

  setTextureQuality(value) {
    this.textureQuality = value;
  }

  setShaderQuality(value) {
    this.shaderQuality = value;
  }

  setAntiAliasing(value) {
    this.antiAliasing = value;
  }

  setShadowQuality(value) {
    this.shadowQuality = value;
  }

  enablePostProcessing(value) {
    this.postProcessing = value;
  }
}

class KameraAyarları {
  constructor(cameraType, sensitivity, zoomSpeed) {
    this.cameraType = cameraType;
    this.sensitivity = sensitivity;
    this.zoomSpeed = zoomSpeed;
  }

  setCameraType(type) {
    this.cameraType = type;
  }

  setSensitivity(value) {
    this.sensitivity = value;
  }

  setZoomSpeed(value) {
    this.zoomSpeed = value;
  }
}

class LevelDinamikleri {
  constructor(autoNav, pauseMode) {
    this.autoNav = autoNav;
    this.pauseMode = pauseMode;
  }

  enableAutoNav(value) {
    this.autoNav = value;
  }

  setPauseMode(mode) {
    this.pauseMode = mode;
  }
}

class EkonomiSistemi {
  constructor(resourceDistribution, tradingMode) {
    this.resourceDistribution = resourceDistribution;
    this.tradingMode = tradingMode;
  }

  setResourceDistribution(value) {
    this.resourceDistribution = value;
  }

  setTradingMode(mode) {
    this.tradingMode = mode;
  }
}

class GizlilikModu {
  constructor(privacyMode, chatFilter) {
    this.privacyMode = privacyMode;
    this.chatFilter = chatFilter;
  }

  enablePrivacyMode(value) {
    this.privacyMode = value;
  }

  setChatFilter(filter) {
    this.chatFilter = filter;
  }
}

function initGrafikAyarları(renderQuality, textureQuality, shaderQuality, antiAliasing, shadowQuality, postProcessing) {
  return new GrafikAyarları(renderQuality, textureQuality, shaderQuality, antiAliasing, shadowQuality, postProcessing);
}

function initKameraAyarları(cameraType, sensitivity, zoomSpeed) {
  return new KameraAyarları(cameraType, sensitivity, zoomSpeed);
}

function initLevelDinamikleri(autoNav, pauseMode) {
  return new LevelDinamikleri(autoNav, pauseMode);
}

function initEkonomiSistemi(resourceDistribution, tradingMode) {
  return new EkonomiSistemi(resourceDistribution, tradingMode);
}

function initGizlilikModu(privacyMode, chatFilter) {
  return new GizlilikModu(privacyMode, chatFilter);
}

// Örnek kullanım
const grafikAyarları = initGrafikAyarları('high', 'high', 'high', true, 'high', true);
const kameraAyarları = initKameraAyarları('TPS', 0.5, 1);
const levelDinamikleri = initLevelDinamikleri(true, 'paused');
const ekonomiSistemi = initEkonomiSistemi('balanced', 'open');
const gizlilikModu = initGizlilikModu(true, 'basic');