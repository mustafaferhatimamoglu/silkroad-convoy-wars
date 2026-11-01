// tercat_catışmalar_3d.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let cat1, cat2;

init();
animate();

function init() {
    // Create the scene
    scene = new THREE.Scene();

    // Create the camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Create the renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create the controls
    controls = new OrbitControls(camera, renderer.domElement);

    // Load textures for cats
    const loader = new THREE.TextureLoader();
    const cat1Texture = loader.load('cat1.jpg');
    const cat2Texture = loader.load('cat2.jpg');

    // Create cats
    cat1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: cat1Texture }));
    cat1.position.set(-2, 0, 0);
    scene.add(cat1);

    cat2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: cat2Texture }));
    cat2.position.set(2, 0, 0);
    scene.add(cat2);

    // Set up physics
    const physics = {
        velocity: {
            cat1: new THREE.Vector3(0, 0, 0),
            cat2: new THREE.Vector3(0, 0, 0)
        },
        force: {
            cat1: new THREE.Vector3(0, 0, 0),
            cat2: new THREE.Vector3(0, 0, 0)
        },
        mass: {
            cat1: 1,
            cat2: 1
        }
    };

    // Update function
    function update() {
        // Apply forces
        physics.force.cat1.set(0, 0, 0);
        physics.force.cat2.set(0, 0, 0);

        // Calculate acceleration
        const acceleration = {
            cat1: new THREE.Vector3(0, 0, 0),
            cat2: new THREE.Vector3(0, 0, 0)
        };

        acceleration.cat1.copy(physics.force.cat1).divideScalar(physics.mass.cat1);
        acceleration.cat2.copy(physics.force.cat2).divideScalar(physics.mass.cat2);

        // Update velocity
        physics.velocity.cat1.add(acceleration.cat1);
        physics.velocity.cat2.add(acceleration.cat2);

        // Update position
        cat1.position.add(physics.velocity.cat1);
        cat2.position.add(physics.velocity.cat2);

        // Check for collision
        const distance = cat1.position.distanceTo(cat2.position);
        if (distance < 1.5) {
            // Resolve collision
            const overlap = 1.5 - distance;
            const collisionVector = new THREE.Vector3().subVectors(cat1.position, cat2.position).normalize().multiplyScalar(overlap / 2);
            cat1.position.sub(collisionVector);
            cat2.position.add(collisionVector);
        }
    }

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Update physics
        update();

        // Render the scene
        renderer.render(scene, camera);

        // Update controls
        controls.update();
    }

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}