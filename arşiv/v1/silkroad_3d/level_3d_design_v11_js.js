// level_3d_design_v11_js.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// WebGL Engine Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Camera Position
camera.position.z = 10;

// Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Load Textures
const textureLoader = new THREE.TextureLoader();
const roadTexture = textureLoader.load('path/to/road_texture.jpg');
const buildingTexture = textureLoader.load('path/to/building_texture.jpg');
const grassTexture = textureLoader.load('path/to/grass_texture.jpg');

// Create Ground Plane
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshBasicMaterial({ map: grassTexture, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Create Road
const roadGeometry = new THREE.BoxGeometry(20, 1, 0.5);
const roadMaterial = new THREE.MeshBasicMaterial({ map: roadTexture });
const road1 = new THREE.Mesh(roadGeometry, roadMaterial);
road1.position.set(0, 0.5, -5);
scene.add(road1);

const road2 = road1.clone();
road2.position.set(0, 0.5, 5);
scene.add(road2);

// Create Buildings
const buildingGeometry = new THREE.BoxGeometry(10, 10, 10);
const buildingMaterial = new THREE.MeshBasicMaterial({ map: buildingTexture });
const building1 = new THREE.Mesh(buildingGeometry, buildingMaterial);
building1.position.set(15, 5, 0);
scene.add(building1);

const building2 = building1.clone();
building2.position.set(-15, 5, 0);
scene.add(building2);

// Animation Function
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

// Window Resize Handler
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}