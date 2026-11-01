// sava__3d_dinamikleri_3d_gizlilik_v2_js.js

// Öncelikle, Three.js kütüphanesini dahil edelim
import * as THREE from 'three';

// Sahne ve Kamere Oluşturalım
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// WebGL Rendereri Oluşturalım
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Kervan Şablonu Oluşturalım
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const kervan = new THREE.Mesh(geometry, material);
scene.add(kervan);

// Silik Oluşturalım
const silikGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2);
const silikMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const silik = new THREE.Mesh(silikGeometry, silikMaterial);
silik.position.set(0, 1, 0);
scene.add(silik);

// Silikin Gizlilik Özelliğini Eklelim
silik.frustumCulled = false;

// Silikin Durumunu Takip Eleyelim
let silikGizli = false;

// Silikin Gizlilik Durumunu Değiştirelim
function toggleSilikGizli() {
    silikGizli = !silikGizli;
    silik.frustumCulled = silikGizli;
}

// Silikin Gizlilik Durumunu Kontrol Eleyelim
function updateSilikGizlilik() {
    if (silikGizli) {
        silik.position.y = 1;
    } else {
        silik.position.y = -1;
    }
}

// Silikin Gizlilik Durumunu Kontrol Eleyelim
function animate() {
    requestAnimationFrame(animate);

    // Silikin Gizlilik Durumunu Kontrol Eleyelim
    updateSilikGizlilik();

    // Silikin Gizlilik Durumunu Kontrol Eleyelim
    if (silikGizli) {
        silik.position.y = 1;
    } else {
        silik.position.y = -1;
    }

    // Silikin Gizlilik Durumunu Kontrol Eleyelim
    silik.rotation.x += 0.01;
    silik.rotation.y += 0.01;

    renderer.render(scene, camera);
}

animate();