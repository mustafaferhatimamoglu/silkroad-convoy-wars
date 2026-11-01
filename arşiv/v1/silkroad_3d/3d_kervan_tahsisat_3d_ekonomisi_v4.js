// 3d_kervan_tahsisat_3d_ekonomisi_v4.js

// Fonksiyonlar
function loadKervanModels(modelPaths, onLoadCallback) {
    const loader = new THREE.GLTFLoader();
    let loadedModels = 0;

    modelPaths.forEach((path, index) => {
        loader.load(path, (gltf) => {
            modelPaths[index] = gltf.scene;
            loadedModels++;

            if (loadedModels === modelPaths.length) {
                onLoadCallback();
            }
        });
    });
}

function setKervanPosition(kervan, position) {
    kervan.position.set(position[0], position[1], position[2]);
}

function updateKervanSpeed(kervan, speed) {
    kervan.speed = speed;
}

function calculateKervanEconomy(kervan, resources) {
    return resources.gold * kervan.speed;
}

function simulateKervanTrade(kervan, tradeData) {
    kervan.resources.gold += tradeData.quantity * tradeData.buyPrice;
    kervan.resources.gold -= tradeData.quantity * tradeData.sellPrice;
}

function animateKervan(kervan, animationType) {
    // Animasyon kodu burada eklenebilir
}

// Sınıflar
class Kervan {
    constructor(position, speed, resources) {
        this.position = new THREE.Vector3(position[0], position[1], position[2]);
        this.speed = speed;
        this.resources = resources;
    }

    setPosition(position) {
        this.position.set(position[0], position[1], position[2]);
    }

    updateSpeed(speed) {
        this.speed = speed;
    }

    calculateEconomy() {
        return this.resources.gold * this.speed;
    }

    simulateTrade(tradeData) {
        this.resources.gold += tradeData.quantity * tradeData.buyPrice;
        this.resources.gold -= tradeData.quantity * tradeData.sellPrice;
    }

    animate(animationType) {
        // Animasyon kodu burada eklenebilir
    }
}

class KervanEconomyManager {
    constructor(resources) {
        this.resources = resources;
    }

    updateResources(delta) {
        this.resources.gold += delta * 0.1; // Örneğin her saniye 0.1 altın artışı
    }

    calculateProfit() {
        return this.resources.gold * this.resources.iron; // Örneğin altın ve yelken ile kazanc
    }

    simulateMarketTrade(tradeData) {
        this.resources.gold += tradeData.quantity * tradeData.buyPrice;
        this.resources.gold -= tradeData.quantity * tradeData.sellPrice;
    }
}

class KervanTradeManager {
    constructor(marketData) {
        this.marketData = marketData;
    }

    updateMarketData(newData) {
        this.marketData = newData;
    }

    simulateTrade(tradeData) {
        this.marketData.gold += tradeData.quantity * tradeData.buyPrice;
        this.marketData.gold -= tradeData.quantity * tradeData.sellPrice;
    }

    calculateTradeProfit(tradeData) {
        return tradeData.quantity * (tradeData.sellPrice - tradeData.buyPrice);
    }
}

// Değişkenler
const kervanModels = ['models/kervan1.glb', 'models/kervan2.glb'];
const defaultSpeed = 5.0;
const defaultResources = { gold: 100, wood: 50, iron: 30 };
const defaultTradeData = { buyPrice: 1, sellPrice: 1.2, quantity: 100 };