// tirk_3d_model_geli_tirme_v8_js.js

// WebGL ve Three.js kütüphanelerini yükle
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Sahne ve kamera oluştur
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Render engine oluştur
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Orbit kamera kontrolü ekleyin
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;

// Eşikler ve malzemeleri oluştur
const loader = new THREE.GLTFLoader();
loader.load('path_to_silkroad_kervan_model.glb', (gltf) => {
    scene.add(gltf.scene);
}, undefined, (error) => {
    console.error('An error happened', error);
});

// Yüzey ışığı ekleyin
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

// Animasyon fonksiyonu
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

// Pencere yeniden boyutlandırıldığında sahnenin boyutunu ayarlayın
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});