// Silkroad V2 Three.js 3D Engine & TPS Camera
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas3d');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0c0e0);
    scene.fog = new THREE.FogExp2(0xa0c0e0, 0.005);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Işıklar
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.5);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // Zemin (İpek Yolu Arazisi)
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xd2b48c });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Oyuncu Karakteri (Kılıç Ustası Temsili 3D Model)
    const charGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    charGroup.add(body);
    scene.add(charGroup);

    // Kamera Pozisyonu (TPS Arkadan Takip)
    camera.position.set(0, 4, 8);
    camera.lookAt(charGroup.position.x, charGroup.position.y + 1, charGroup.position.z);

    function animate() {
        requestAnimationFrame(animate);
        charGroup.rotation.y += 0.005;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
