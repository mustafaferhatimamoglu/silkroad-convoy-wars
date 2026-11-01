class Path {
  constructor(id, points) {
    this.id = id;
    this.points = points;
  }

  getDistanceTo(point) {
    // Mesafe hesaplama algoritması
    return Math.sqrt(
      Math.pow(point.x - this.points[0].x, 2) +
      Math.pow(point.y - this.points[0].y, 2) +
      Math.pow(point.z - this.points[0].z, 2)
    );
  }
}

class PathManager {
  constructor() {
    this.paths = [];
    this.currentPath = null;
  }

  initializePaths() {
    // Yolları başlatma
    this.paths.push(new Path(1, [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
      { x: 0, y: 10, z: 0 }
    ]));
    this.paths.push(new Path(2, [
      { x: 15, y: 0, z: 0 },
      { x: 25, y: 0, z: 0 },
      { x: 25, y: 10, z: 0 },
      { x: 15, y: 10, z: 0 }
    ]));
  }

  getPathById(pathId) {
    return this.paths.find(path => path.id === pathId);
  }
}

function drawPaths() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const geometry = new THREE.BufferGeometry().setFromPoints(new PathManager().getPathById(1).points);
  const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
  const line = new THREE.Line(geometry, material);
  scene.add(line);

  camera.position.z = 20;

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();
}

function updatePathTraversal(player) {
  // Oyuncunun yol üzerinde ilerlemesini güncelleme kodu
}

function checkPathIntersection(player) {
  // Yollar üzerinde olup olmadığını kontrol etme kodu
}

// Değişkenler
let paths = [];
let currentPath = null;
let pathManager = new PathManager();

// Başlatma
pathManager.initializePaths();