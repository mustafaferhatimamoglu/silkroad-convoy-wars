// korsan_saldırıları_3d_v2.js

class KorsanSaldırısı {
    constructor(id, korsan, hedef) {
        this.id = id;
        this.korsan = korsan;
        this.hedef = hedef;
        this.saldırıModel = null;
        this.saldırıAnimasyon = null;
    }

    start() {
        this.saldırıModel = createKorsanSaldırısı(this.korsan, this.hedef);
        this.animate();
    }

    animate() {
        animateSaldırı(this.saldırıModel);
    }

    update() {
        updateSaldırı(this.saldırıModel);
    }

    end() {
        endSaldırı(this.saldırıModel);
        handleSaldırıCollision(this.saldırıModel, this.hedef);
    }
}

let saldırılar = [];
let saldırıAnimasyonları = [];
let saldırıEtkileşimleri = [];

function createKorsanSaldırısı(korsan, hedef) {
    // Saldırı modeli oluşturma ve döndürme
    const saldırıModel = new THREE.Group();
    const korsanMesh = createKorsanMesh(korsan);
    const hedefMesh = createHedefMesh(hedef);
    saldırıModel.add(korsanMesh);
    saldırıModel.add(hedefMesh);
    return saldırıModel;
}

function animateSaldırı(saldırıModel) {
    // Saldırı modelinin animasyonunu başlatma
    const korsanMesh = salaharıModel.children[0];
    const hedefMesh = saldırıModel.children[1];
    const direction = new THREE.Vector3().subVectors(hedefMesh.position, korsanMesh.position).normalize();
    korsanMesh.position.add(direction.multiplyScalar(0.1));
}

function startSaldırı(korsan, hedef) {
    let saldırı = new KorsanSaldırısı(saldırılar.length + 1, korsan, hedef);
    saldırılar.push(saldırı);
    saldırı.start();
}

function endSaldırı(saldırı) {
    // Saldırı modelinin animasyonunu durdurma
    // Saldırının bitiş etkileşimlerini yönetme
}

function updateSaldırı(saldırı) {
    // Saldırının güncel durumunu ve animasyonunu güncellemek
}

function handleSaldırıCollision(saldırı, hedef) {
    // Saldırının hedefe ulaştığında veya hedefe çarptığında gerçekleşen etkileşimleri yönetme
}

function createKorsanMesh(korsan) {
    // Korsan meshi oluşturma ve döndürme
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

function createHedefMesh(hedef) {
    // Hedef meshi oluşturma ve döndürme
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}