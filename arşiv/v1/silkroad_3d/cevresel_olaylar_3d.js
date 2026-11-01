// cevresel_olaylar_3d.js dosyası için kod

class EnvironmentElement {
    constructor(name, position, geometry, material) {
        this.name = name;
        this.position = position;
        this.geometry = geometry;
        this.material = material;
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        scene.add(this.mesh);
    }

    animate(time) {
        // Elementin animasyonunu ekleyin
    }
}

class NaturalElement extends EnvironmentElement {
    constructor(name, position, geometry, material, type) {
        super(name, position, geometry, material);
        this.type = type; // 'yeraltı' veya 'yeraltı'
    }
}

class ManmadeElement extends EnvironmentElement {
    constructor(name, position, geometry, material, type) {
        super(name, position, geometry, material);
        this.type = type; // 'kervan', 'korsan', vb.
    }
}

class ResourceDepot extends ManmadeElement {
    constructor(name, position, geometry, material) {
        super(name, position, geometry, material, 'resource');
        this.resources = {};
    }

    addResource(resource, amount) {
        if (this.resources[resource]) {
            this.resources[resource] += amount;
        } else {
            this.resources[resource] = amount;
        }
    }

    removeResource(resource, amount) {
        if (this.resources[resource]) {
            this.resources[resource] -= amount;
            if (this.resources[resource] < 0) {
                this.resources[resource] = 0;
            }
        }
    }
}

class Event {
    constructor(name, position, trigger, effect) {
        this.name = name;
        this.position = position;
        this.trigger = trigger;
        this.effect = effect;
    }

    triggerEvent() {
        this.effect();
    }
}

class NaturalEvent extends Event {
    constructor(name, position, trigger, effect) {
        super(name, position, trigger, effect);
        this.type = 'natural';
    }
}

class ManmadeEvent extends Event {
    constructor(name, position, trigger, effect) {
        super(name, position, trigger, effect);
        this.type = 'manmade';
    }
}

class KervanEncounter extends ManmadeEvent {
    constructor(name, position, trigger, effect) {
        super(name, position, trigger, effect);
        this.type = 'kervan';
    }
}

class CorsairAttack extends ManmadeEvent {
    constructor(name, position, trigger, effect) {
        super(name, position, trigger, effect);
        this.type = 'corsair';
    }
}

class ResourceDepletionEvent extends NaturalEvent {
    constructor(name, position, trigger, effect) {
        super(name, position, trigger, effect);
        this.type = 'depletion';
    }
}

class NaturalCatastrophe extends NaturalEvent {
    constructor(name, position, trigger, effect) {
        super(name, position, trigger, effect);
        this.type = 'catastrophe';
    }
}

// Örnek kullanım
const desert = new NaturalElement('Desert', new THREE.Vector3(0, 0, 0), new THREE.BoxGeometry(100, 1, 100), new THREE.MeshBasicMaterial({color: 0x8b4513}));
const oasis = new NaturalElement('Oasis', new THREE.Vector3(50, 0, 50), new THREE.SphereGeometry(5), new THREE.MeshBasicMaterial({color: 0x00ff00}));
const kervan = new ManmadeElement('Kervan', new THREE.Vector3(100, 0, 100), new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0x8b4513}), 'kervan');
const corsairCamp = new ManmadeElement('Corsair Camp', new THREE.Vector3(-100, 0, -100), new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({color: 0xff0000}), 'corsair');

const resourceDepot = new ResourceDepot('Resource Depot', new THREE.Vector3(0, 0, 0), new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({color: 0x8b4513}));
resourceDepot.addResource('water', 100);
resourceDepot.addResource('wood', 50);

const waterDepletionEvent = new ResourceDepletionEvent('Water Depletion', new THREE.Vector3(0, 0, 0), () => {
    if (resourceDepot.resources.water > 0) {
        resourceDepot.removeResource('water', 10);
    }
}, () => {
    console.log('Water Depletion Event');
});

// Animasyon örneği
function animate(time) {
    requestAnimationFrame(animate);
    // Elementlerin animasyonlarını güncelle
    kervan.animate(time);
    corsairCamp.animate(time);
}

animate();