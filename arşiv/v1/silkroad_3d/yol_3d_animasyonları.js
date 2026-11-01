// yol_3d_animasyonları.js

// Yol noktaları
class PathPoint {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

// Yol
class Path {
    constructor() {
        this.points = [];
    }

    addPoint(point) {
        this.points.push(point);
    }

    getLength() {
        let length = 0;
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p2 = this.points[i + 1];
            length += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));
        }
        return length;
    }

    getNearestPoint(position) {
        let nearestPoint = null;
        let minDistance = Infinity;
        for (const point of this.points) {
            const distance = Math.sqrt(Math.pow(point.x - position.x, 2) + Math.pow(point.y - position.y, 2) + Math.pow(point.z - position.z, 2));
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
            }
        }
        return nearestPoint;
    }
}

// Yol animasyonu
class PathAnimation {
    constructor(path, speed = 0.1, interpolationType = 'linear') {
        this.path = path;
        this.speed = speed;
        this.interpolationType = interpolationType;
        this.currentPointIndex = 0;
        this.currentPosition = this.path.points[0];
        this.targetPosition = this.path.points[1];
        this.animationFrameId = null;
        this.pathLength = this.path.getLength();
    }

    init() {
        this.start();
    }

    update() {
        this.currentPosition = this.interpolate(this.currentPosition, this.targetPosition, this.speed);
        if (this.currentPosition.x === this.targetPosition.x && this.currentPosition.y === this.targetPosition.y && this.currentPosition.z === this.targetPosition.z) {
            this.moveToNextPoint();
        }
    }

    start() {
        this.animationFrameId = requestAnimationFrame(this.update.bind(this));
    }

    stop() {
        cancelAnimationFrame(this.animationFrameId);
    }

    reset() {
        this.currentPointIndex = 0;
        this.currentPosition = this.path.points[0];
        this.targetPosition = this.path.points[1];
        this.stop();
    }

    moveToNextPoint() {
        this.currentPointIndex++;
        if (this.currentPointIndex < this.path.points.length - 1) {
            this.targetPosition = this.path.points[this.currentPointIndex + 1];
        } else {
            this.targetPosition = this.path.points[this.currentPointIndex];
        }
    }

    interpolate(start, end, t) {
        if (this.interpolationType === 'linear') {
            return new PathPoint(
                start.x + (end.x - start.x) * t,
                start.y + (end.y - start.y) * t,
                start.z + (end.z - start.z) * t
            );
        }
        // Diğer interpolasyon türleri için genişletilebilir
    }
}

// Geçerli olan tüm yol animasyonlarının listesi
let pathAnimations = [];

// Yol noktalarının listesi
let pathPoints = [];

// Mevcut yol animasyonu
let currentPathAnimation = null;

// Mevcut yol noktaları indeksi
let currentPathPointIndex = 0;

// Genel animasyon hızı
let animationSpeed = 0.1;

// Yolun nasıl animasyonlandığını belirler (örneğin, lineer, cúbik bézier vb.)
let interpolationMethod = 'linear';

// Yol animasyonu oluşturur
function createPathAnimation(path, speed = animationSpeed, interpolationType = interpolationMethod) {
    const pathAnimation = new PathAnimation(path, speed, interpolationType);
    pathAnimations.push(pathAnimation);
    return pathAnimation;
}

// Yol animasyonunu günceller
function updatePathAnimation() {
    for (const pathAnimation of pathAnimations) {
        pathAnimation.update();
    }
}

// Yol animasyonunu başlatır
function startPathAnimation() {
    for (const pathAnimation of pathAnimations) {
        pathAnimation.start();
    }
}

// Yol animasyonunu durdurur
function stopPathAnimation() {
    for (const pathAnimation of pathAnimations) {
        pathAnimation.stop();
    }
}

// Yol animasyonunu sıfırlar
function resetPathAnimation() {
    for (const pathAnimation of pathAnimations) {
        pathAnimation.reset();
    }
}

// Yolu animasyonla hareket ettirir
function animatePath(path, speed = animationSpeed, interpolationType = interpolationMethod) {
    const pathAnimation = createPathAnimation(path, speed, interpolationType);
    currentPathAnimation = pathAnimation;
    startPathAnimation();
}

// Yolu sürekli olarak animasyonla hareket ettirir
function interpolatePath(path, speed = animationSpeed, interpolationType = interpolationMethod) {
    const pathAnimation = createPathAnimation(path, speed, interpolationType);
    currentPathAnimation = pathAnimation;
    setInterval(() => {
        updatePathAnimation();
    }, 1000 / 60);
}

// Yolu hesaplar
function calculatePathLength(path) {
    return path.getLength();
}

// Mevcut konumdan yola olan mesafeyi hesaplar
function getDistanceToPath(position, path) {
    const nearestPoint = path.getNearestPoint(position);
    return Math.sqrt(Math.pow(nearestPoint.x - position.x, 2) + Math.pow(nearestPoint.y - position.y, 2) + Math.pow(nearestPoint.z - position.z, 2));
}

// Yoldaki en yakın noktayı bulur
function getNearestPointOnPath(position, path) {
    return path.getNearestPoint(position);
}