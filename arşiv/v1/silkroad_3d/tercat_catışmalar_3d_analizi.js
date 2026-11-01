// tercat_catışmalar_3d_analizi.js

// Fonksiyonlar

function calculateImpactDamage(zara, kaynak, ekonomikKayıp) {
    return {
        zara: zara,
        kaynak: kaynak,
        ekonomikKayıp: ekonomikKayıp
    };
}

function analyzeCollisionData(data) {
    return data.map(item => ({
        ...item,
        impactDamage: calculateImpactDamage(item.zara, item.kaynak, item.ekonomikKayıp)
    }));
}

function generateCollisionReport(data) {
    return data.reduce((acc, curr) => {
        acc.zara += curr.impactDamage.zara;
        acc.kaynak += curr.impactDamage.kaynak;
        acc.ekonomikKayıp += curr.impactDamage.ekonomikKayıp;
        return acc;
    }, { zara: 0, kaynak: 0, ekonomikKayıp: 0 });
}

function updateResourceLosses(data) {
    return data.map(item => {
        if (item.kaynak) {
            item.kaynak -= item.impactDamage.kaynak;
        }
        return item;
    });
}

function calculateEconomicImpact(data) {
    return data.reduce((acc, curr) => acc + curr.impactDamage.ekonomikKayıp, 0);
}

function displayCollisionStats(data) {
    const stats = generateCollisionReport(data);
    console.log(`Toplam Zara: ${stats.zara}`);
    console.log(`Toplam Kaynak: ${stats.kaynak}`);
    console.log(`Toplam Ekonomik Kayıp: ${stats.ekonomikKayıp}`);
}

function logCollisionDetails(data) {
    data.forEach(item => {
        console.log(`Çatışma Detayları: ${JSON.stringify(item)}`);
    });
}

// Sınıflar

class CollisionAnalyzer {
    constructor() {
        this.collisionData = new CollisionData();
        this.collisionStats = new CollisionStats();
        this.collisionResourceLosses = new CollisionResourceLosses();
        this.collisionEconomicImpact = new CollisionEconomicImpact();
    }

    analyze(data) {
        this.collisionData.addCollision(data);
        this.collisionStats.updateStats(data);
        this.collisionResourceLosses.updateLosses(data);
        this.collisionEconomicImpact.calculateImpact(data);
    }

    generateReport() {
        return {
            stats: this.collisionStats,
            resourceLosses: this.collisionResourceLosses,
            economicImpact: this.collisionEconomicImpact
        };
    }
}

class CollisionData {
    constructor() {
        this.data = [];
    }

    addCollision(data) {
        this.data.push(...data);
    }

    getTotalLosses() {
        return {
            zara: this.data.reduce((acc, curr) => acc + curr.impactDamage.zara, 0),
            kaynak: this.data.reduce((acc, curr) => acc + curr.impactDamage.kaynak, 0),
            ekonomikKayıp: this.data.reduce((acc, curr) => acc + curr.impactDamage.ekonomikKayıp, 0)
        };
    }
}

class CollisionStats {
    constructor() {
        this.stats = { zara: 0, kaynak: 0, ekonomikKayıp: 0 };
    }

    updateStats(data) {
        const report = generateCollisionReport(data);
        this.stats.zara = report.zara;
        this.stats.kaynak = report.kaynak;
        this.stats.ekonomikKayıp = report.ekonomikKayıp;
    }

    displayStats() {
        console.log(`Toplam Zara: ${this.stats.zara}`);
        console.log(`Toplam Kaynak: ${this.stats.kaynak}`);
        console.log(`Toplam Ekonomik Kayıp: ${this.stats.ekonomikKayıp}`);
    }
}

class CollisionResourceLosses {
    constructor() {
        this.losses = { zara: 0, kaynak: 0 };
    }

    updateLosses(data) {
        data.forEach(item => {
            if (item.kaynak) {
                this.losses.kaynak += item.impactDamage.kaynak;
            }
        });
    }

    getTotalLosses() {
        return this.losses;
    }
}

class CollisionEconomicImpact {
    constructor() {
        this.impact = 0;
    }

    calculateImpact(data) {
        this.impact = calculateEconomicImpact(data);
    }

    displayImpact() {
        console.log(`Toplam Ekonomik Kayıp: ${this.impact}`);
    }
}

// Değişkenler

let collisionData = new CollisionData();
let collisionStats = new CollisionStats();
let collisionResourceLosses = new CollisionResourceLosses();
let collisionEconomicImpact = new CollisionEconomicImpact();