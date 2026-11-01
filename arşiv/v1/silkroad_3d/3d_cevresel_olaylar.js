// 3d_cevresel_olaylar.js

// Gerekli modüller
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Sahne ve kamera ayarları
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderere ayarlar
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Orbit kontrolu
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

// Arazi ve çöl yolları
const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513, wireframe: false });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 3D Araba modeli
const carGeometry = new THREE.BoxGeometry(1, 0.5, 2);
const carMaterial = new THREE.MeshBasicMaterial({ color: 0xFFA500, wireframe: false });
const car = new THREE.Mesh(carGeometry, carMaterial);
scene.add(car);

// 3D Korsan saldırıları
const orcGeometry = new THREE.ConeGeometry(0.5, 1, 32);
const orcMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4500, wireframe: false });
const orc = new THREE.Mesh(orcGeometry, orcMaterial);
orc.position.z = 2;
scene.add(orc);

// TPS/FPS kamera arkası kontrolü
const player = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
};

function animate() {
    requestAnimationFrame(animate);

    // Kamera kontrolü
    controls.update();

    // Kervan animasyonu
    car.rotation.y += 0.01;

    // Korsan saldırıları
    orc.position.z -= 0.05;
    if (orc.position.z < -2) {
        orc.position.z = 2;
    }

    renderer.render(scene, camera);
}

animate();

// Pencere boyutu değişikliklerine uyum
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}