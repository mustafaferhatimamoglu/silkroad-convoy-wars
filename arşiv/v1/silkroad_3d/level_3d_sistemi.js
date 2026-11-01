// level_3d_sistemi.js

// 3D Level Sistemi modülünü tanımladık
const Level3DSystem = (() => {
    let scene, camera, renderer, controls;

    // WebGL ile 3D senaryo oluşturmak için gereken ilk ayarları yaparız
    function init() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        camera.position.z = 5;

        // Sadece görsel için temel bir ışık ekliyoruz
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1).normalize();
        scene.add(directionalLight);

        // Level oluşturmak için gerekli olan nesneleri ekleyebiliriz
        addLevelObjects();
    }

    // Level nesnelerini ekleyen fonksiyon
    function addLevelObjects() {
        // Örneğin, bir yuva ve bir kervan nesnesi ekleyelim
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const floor = new THREE.Mesh(geometry, material);
        floor.position.y = -0.5;
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const geometryKervan = new THREE.BoxGeometry(2, 2, 0.5);
        const materialKervan = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const kervan = new THREE.Mesh(geometryKervan, materialKervan);
        kervan.position.set(0, 1, 0);
        scene.add(kervan);
    }

    // Animasyon döngüsü
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    return {
        init: init,
        animate: animate
    };
})();

// Modülü başlat ve animasyonu başlat
Level3DSystem.init();
Level3DSystem.animate();