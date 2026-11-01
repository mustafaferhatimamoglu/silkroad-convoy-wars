// kervan_3d_animasyonlar_3d.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Kapsayıcı ve Kamere
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Render
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Orbit Kontrollerleri
const controls = new OrbitControls(camera, renderer.domElement);

// Kervan Modelleri
const loader = new THREE.GLTFLoader();
const kervanModels = [];
let kervanCount = 3;

for (let i = 0; i < kervanCount; i++) {
    loader.load('path/to/kervan_model.glb', (gltf) => {
        const kervan = gltf.scene;
        kervan.scale.set(0.5, 0.5, 0.5);
        kervan.position.x = (i - kervanCount / 2) * 2;
        scene.add(kervan);
        kervanModels.push(kervan);
    });
}

// Animasyon
let animationFrameId;

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    // Kervanlarin hareketi
    kervanModels.forEach(kervan => {
        kervan.rotation.y += 0.01;
    });

    controls.update();
    renderer.render(scene, camera);
}

animate();

// Pencere boyutunu değiştirdiğinde renderi güncelle
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});