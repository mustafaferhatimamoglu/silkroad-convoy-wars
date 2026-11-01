// 3d_yollar_3d.js

// Fonksiyonlar
function createPath(points) {
    let path = {
        points: points,
        animation: null
    };
    paths.push(path);
    return path;
}

function animatePath(path) {
    path.animation = new PathAnimator(path, 1);
    pathAnimators.push(path.animation);
    return path;
}

function updatePath(path, newPoints) {
    path.points = path.points.concat(newPoints);
    return path;
}

function removePath(path) {
    let index = paths.indexOf(path);
    if (index !== -1) {
        paths.splice(index, 1);
    }
    pathAnimators = pathAnimators.filter(animator => animator.path !== path);
}

// Sınıflar
class Path {
    constructor(points) {
        this.points = points;
        this.animation = null;
    }

    addPoint(point) {
        this.points.push(point);
    }

    removePoint(index) {
        this.points.splice(index, 1);
    }

    startAnimation() {
        this.animation = new PathAnimator(this, 1);
        pathAnimators.push(this.animation);
    }

    stopAnimation() {
        let index = pathAnimators.findIndex(animator => animator.path === this);
        if (index !== -1) {
            pathAnimators.splice(index, 1);
        }
    }
}

class PathAnimator {
    constructor(path, speed) {
        this.path = path;
        this.speed = speed;
        this.elapsedTime = 0;
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.path.points.length * 0.1) { // 0.1 is time per point
            this.elapsedTime = 0;
        }
    }

    isFinished() {
        return this.elapsedTime >= this.path.points.length * 0.1;
    }
}

// Değişkenler
let paths = [];
let currentPath = null;
let pathAnimators = [];