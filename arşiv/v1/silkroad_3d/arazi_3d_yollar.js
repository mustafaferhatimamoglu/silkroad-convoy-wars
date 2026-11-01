// arazi_3d_yollar.js

class YolModeli {
    constructor(nitelikler) {
        this.nitelikler = nitelikler;
    }

    olustur() {
        const geometry = new THREE.BoxGeometry(this.nitelikler.en, this.nitelikler.boy, this.nitelikler.yukseklik);
        const material = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);
    }

    animasyonEkle() {
        this.mesh.rotation.x += 0.01;
        this.mesh.rotation.y += 0.01;
    }

    interaktiviteYap() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        function onMouseMove(event) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(scene.children);
            if (intersects.length > 0) {
                intersects[0].object.material.color.set(0xff0000);
            }
        }

        window.addEventListener('mousemove', onMouseMove, false);
    }
}

class YolManager {
    constructor(yollar) {
        this.yollar = yollar;
    }

    yollariYukle() {
        this.yollar.forEach(yol => {
            const yolModeli = new YolModeli(yol.nitelikler);
            yolModeli.olustur();
            this.yollar.push(yolModeli);
        });
    }

    yollariGuncelle() {
        this.yollar.forEach(yol => {
            yol.mesh.position.set(yol.nitelikler.x, yol.nitelikler.y, yol.nitelikler.z);
        });
    }

    yollariSil() {
        this.yollar.forEach(yol => {
            scene.remove(yol.mesh);
        });
        this.yollar = [];
    }
}

class YolAnimasyonManager {
    constructor(yollar, animasyonlar) {
        this.yollar = yollar;
        this.animasyonlar = animasyonlar;
    }

    animasyonuBaslat() {
        this.animasyon = requestAnimationFrame(this.animasyonuGuncelle.bind(this));
    }

    animasyonuDurdur() {
        cancelAnimationFrame(this.animasyon);
    }

    animasyonuGuncelle() {
        this.yollar.forEach(yol => {
            yol.animasyonEkle();
        });
        this.animasyon = requestAnimationFrame(this.animasyonuGuncelle.bind(this));
    }
}

class YolInteraktiviteManager {
    constructor(yollar, interaktivite) {
        this.yollar = yollar;
        this.interaktivite = interaktivite;
    }

    interaktiviteyiEkle() {
        this.yollariYukle();
        const yolManager = new YolManager(this.yollar);
        const yolAnimasyonManager = new YolAnimasyonManager(this.yollar, this.interaktivite.animasyonlar);
        yolAnimasyonManager.animasyonuBaslat();
    }

    interaktiviteyiGuncelle() {
        this.yollariGuncelle();
    }

    interaktiviteyiSil() {
        this.yollariSil();
    }
}

class YolEconomisiManager {
    constructor(yollar, ekonomi) {
        this.yollar = yollar;
        this.ekonomi = ekonomi;
    }

    ekonomiyiGuncelle() {
        // Ekonomi güncelleme kodu
    }

    ekonomiyiYazdir() {
        console.log(this.ekonomi);
    }
}

class YolGizlilikManager {
    constructor(yollar, gizlilik) {
        this.yollar = yollar;
        this.gizlilik = gizlilik;
    }

    gizliliğiEkle() {
        // Gizlilik ekleme kodu
    }

    gizliliğiGuncelle() {
        // Gizlilik güncelleme kodu
    }

    gizliliğiSil() {
        // Gizlilik silme kodu
    }
}