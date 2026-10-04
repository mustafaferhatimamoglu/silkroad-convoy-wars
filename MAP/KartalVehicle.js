/**
 * KartalVehicle.js — 1980 Model Klasik Tofaş Kartal (Murat 131 Kartal / Panorama)
 * 
 * Özellikler:
 * - 1980 Klasik Gövde: Derin Gece Mavisi (Lacivert) Metalik Otomotiv Boyası (MeshPhysicalMaterial)
 * - 1980 İkonik Detaylar: Çift yuvarlak krom çerçeveli farlar, krom ön ve arka çelik tamponlar,
 *   tampon babaları (overriders), nikelaj cam çıtaları, ön kelebek camları, krom kapı kolları
 * - 1980 Klasik Sac Jantlar + Ortada Parlak Krom Göbek Kapakları (Chrome Hubcaps)
 * - Kesin Duvara Saplanmama & Duvar İtme Fiziği (Continuous Separation & Anti-Stuck Booster)
 * - Geri Vites Kurtarma & R Tuşu Acil Çıkış (Emergency Unstuck & Unflip)
 * - Takla Atmayı ve Ters Kalmayı Engelleyen Jiroskopik Doğrultma (Auto-Righting)
 * - Tok ve Gerçekçi 1.6L Motor Sesi, Mute (M tuşu) ve Çarpma FX
 */
(function (global) {
  'use strict';

  class KartalVehicle {
    constructor(scene, map) {
      this.scene = scene;
      this.map = map;

      // 3D Kök Grubu
      this.group = new THREE.Group();
      this.group.name = 'Tofas_Kartal_1980_Classic';
      this.scene.add(this.group);

      // Boyutlar (1980 Murat 131 Kartal Station Wagon)
      this.width = 1.68;       // m
      this.length = 4.26;      // m
      this.height = 1.44;      // m
      this.wheelbase = 2.49;   // m
      this.trackWidth = 1.39;  // m
      this.wheelRadius = 0.31; // 155 SR 13
      this.mass = 990;         // kg (1980 kasa)

      // Dinamik Durumlar
      this.position = new THREE.Vector3(0, 0, 0);
      this.velocity = new THREE.Vector3(0, 0, 0);
      this.verticalVelocity = 0;
      this.angularVelocity = 0;
      this.yaw = 0;
      this.pitch = 0;
      this.roll = 0;

      // Süspansiyon Dinamikleri (Yay ve Amortisör Simülasyonu)
      this.suspensionPitch = 0;
      this.suspensionRoll = 0;
      this.suspensionPitchVel = 0;
      this.suspensionRollVel = 0;
      this.suspensionBounce = 0;
      this.suspensionBounceVel = 0;

      // Motor & Şanzıman
      this.gear = 1;
      this.rpm = 900;
      this.idleRpm = 900;
      this.maxRpm = 6800;
      this.gearRatios = {
        '-1': -3.67,
        0: 0.0,
        1: 3.67,
        2: 2.10,
        3: 1.36,
        4: 1.00,
        5: 0.86
      };
      this.finalDrive = 4.10;
      this.maxTorque = 135; // Nm (1.6 OHV / OHC)

      this.steeringAngle = 0;
      this.maxSteerAngle = 0.62;
      this.speedKmh = 0;
      this.driftFactor = 0;
      this.isGrounded = true;

      // NFS Nitro / Boost Sistemi (NFS tarzı N2O)
      this.nitro = 100; // 0 - 100%
      this.isNitroActive = false;

      // Hasar, Çarpışma ve Deformasyon
      this.health = 100;
      this.cameraShakeIntensity = 0;
      this.stuckTimer = 0;
      this.isColliding = false;
      this.damageState = {
        hoodBent: 0,
        frontBumperBent: 0,
        rearBumperBent: 0,
        trunkBent: 0,
        windshieldCracked: false,
        rearGlassCracked: false,
        leftLightBroken: false,
        rightLightBroken: false
      };

      // Girdiler
      this.inputs = {
        throttle: 0,
        brake: 0,
        handbrake: false,
        steer: 0,
        nitro: false
      };

      // Raycaster
      this.raycaster = new THREE.Raycaster();
      this.downVector = new THREE.Vector3(0, -1, 0);

      // Ses
      this.soundEnabled = true;
      this._initAudio();

      this.wheels = [];
      this.smokeParticles = [];
      this.sparkParticles = [];
      this.nitroFlames = [];

      this._build1980Mesh();
      this._buildInteriorAndCockpit();
      this._buildParticleSystems();
    }

    _build1980Mesh() {
      // 1. 1980 Klasik Lacivert Otomotiv Boyası (Midnight / Navy Blue)
      const navyPaintMat = new THREE.MeshPhysicalMaterial({
        color: 0x142a52,              // Derin Klasik Tofaş Laciverti
        roughness: 0.16,
        metalness: 0.22,
        clearcoat: 1.0,               // Derin cila yansıması
        clearcoatRoughness: 0.05,
        reflectivity: 0.90
      });

      // 2. 1980 İkonik Parlak Krom (Tamponlar, çerçeveler, çıtalar, jant kapakları)
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xfafafa,
        metalness: 0.98,
        roughness: 0.08
      });

      // 3. Siyah Kauçuk / Plastik Fitiller (Tampon şeridi, lastikler)
      const rubberMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.88,
        metalness: 0.02
      });

      // 4. Klasik Şeffaf Camlar
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xdde8ea,
        roughness: 0.05,
        transmission: 0.70,
        transparent: true,
        opacity: 0.80,
        ior: 1.5
      });

      // 5. Yuvarlak Klasik Reflektörlü Farlar
      const roundHeadlightMat = new THREE.MeshStandardMaterial({
        color: 0xfffbe8,
        roughness: 0.1,
        metalness: 0.5,
        emissive: 0xffea95,
        emissiveIntensity: 0.95
      });

      // Turuncu Park/Sinyal
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        roughness: 0.2,
        emissive: 0xdd5500,
        emissiveIntensity: 0.75
      });

      // Kırmızı Arka Stop
      const tailRedMat = new THREE.MeshStandardMaterial({
        color: 0xd91212,
        roughness: 0.2,
        emissive: 0x990000,
        emissiveIntensity: 0.65
      });

      // Geri Vites Beyazı
      const tailWhiteMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.25
      });

      this.chassis = new THREE.Group();
      this.chassis.name = 'Chassis_1980';
      this.group.add(this.chassis);

      // Modelin ileri yönü Three.js -Z olduğu için gövde container'ı
      this.carBody = new THREE.Group();
      this.carBody.name = 'CarBody_1980';
      this.chassis.add(this.carBody);

      // --- 1. 1980 KARTAL ALT GÖVDE & YAN PANELLER (Düz Klasik Hatlar) ---
      this.lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.46, 4.22), navyPaintMat);
      this.lowerBody.position.y = 0.50;
      this.lowerBody.castShadow = true;
      this.lowerBody.receiveShadow = true;
      this.carBody.add(this.lowerBody);

      // Yan Krom Kuşak Çıtası (1980 Murat 131 boydan boya ince nikelaj çıtası)
      [-0.835, 0.835].forEach(x => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 4.10), chromeMat);
        strip.position.set(x, 0.52, 0);
        this.carBody.add(strip);
      });

      // --- 2. 1980 MOTOR KAPUTU & KROM ÖN BURUN ---
      this.hood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.15, 1.30), navyPaintMat);
      this.hood.position.set(0, 0.77, -1.45);
      this.hood.rotation.x = -0.06; // Öne doğru zarif Murat 131 eğimi
      this.carBody.add(this.hood);

      // Kaput Ön Krom Burun Çıtası
      this.hoodNose = new THREE.Mesh(new THREE.BoxGeometry(1.60, 0.03, 0.04), chromeMat);
      this.hoodNose.position.set(0, 0.73, -2.10);
      this.carBody.add(this.hoodNose);

      // --- 3. 1980 KARTAL STATION WAGON KABİN & TAVAN ---
      this.cabin = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.56, 2.68), navyPaintMat);
      this.cabin.position.set(0, 1.02, 0.42);
      this.cabin.castShadow = true;
      this.carBody.add(this.cabin);

      // Krom Yağmurluk Oluğu (Tavan kenarlarındaki klasik nikelaj oluk)
      [-0.745, 0.745].forEach(x => {
        const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 2.72), chromeMat);
        gutter.position.set(x, 1.30, 0.42);
        this.carBody.add(gutter);
      });

      // --- 4. 1980 KLASİK CAMLAR & NİKELAJ ÇERÇEVELER ---
      // Ön Cam (Krom Çerçeveli)
      this.winFrontMat = glassMat.clone();
      this.winFront = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.50, 0.05), this.winFrontMat);
      this.winFront.position.set(0, 1.00, -0.90);
      this.winFront.rotation.x = 0.38;
      this.carBody.add(this.winFront);

      this.winFrontFrame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.52, 0.03), chromeMat);
      this.winFrontFrame.position.set(0, 1.00, -0.89);
      this.winFrontFrame.rotation.x = 0.38;
      this.carBody.add(this.winFrontFrame);

      // Arka Bagaj Camı (Krom Çerçeveli Dik Bagaj Camı)
      this.winRearMat = glassMat.clone();
      this.winRear = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.48, 0.05), this.winRearMat);
      this.winRear.position.set(0, 1.02, 1.76);
      this.winRear.rotation.x = -0.10;
      this.carBody.add(this.winRear);

      // Yan Camlar Bloğu
      this.winSide = new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.42, 2.45), glassMat);
      this.winSide.position.set(0, 1.03, 0.42);
      this.carBody.add(this.winSide);

      // 1980 Klasik Ön Kelebek Camı Çıtası (Vent Wing Window Divider)
      [-0.755, 0.755].forEach(x => {
        const ventPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 8), chromeMat);
        ventPillar.position.set(x, 1.03, -0.45);
        this.carBody.add(ventPillar);

        // B Sütunu İnce Krom Kaplama
        const bCol = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.43, 0.08), chromeMat);
        bCol.position.set(x, 1.03, 0.15);
        this.carBody.add(bCol);
      });

      // --- 5. 1980 PARLAK KROM ÇELİK TAMPONLAR & TAMPON BABALARI ---
      // ÖN KROM TAMPON
      this.frontBumper = new THREE.Group();
      this.frontBumper.position.set(0, 0.38, -2.16);
      this.carBody.add(this.frontBumper);

      const fBumpBar = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.14, 0.12), chromeMat);
      fBumpBar.castShadow = true;
      this.frontBumper.add(fBumpBar);

      // Tampon orta siyah kauçuk şerit
      const fStrip = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.04, 0.13), rubberMat);
      this.frontBumper.add(fStrip);

      // 2 Adet Dikey Krom Tampon Babası (Overriders)
      [-0.50, 0.50].forEach(x => {
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.15), chromeMat);
        guard.position.set(x, 0.02, 0.02);
        this.frontBumper.add(guard);
      });

      // ARKA KROM TAMPON
      this.rearBumper = new THREE.Group();
      this.rearBumper.position.set(0, 0.38, 2.16);
      this.carBody.add(this.rearBumper);

      const rBumpBar = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.14, 0.12), chromeMat);
      rBumpBar.castShadow = true;
      this.rearBumper.add(rBumpBar);

      const rStrip = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.04, 0.13), rubberMat);
      this.rearBumper.add(rStrip);

      [-0.50, 0.50].forEach(x => {
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.15), chromeMat);
        guard.position.set(x, 0.02, -0.02);
        this.rearBumper.add(guard);
      });

      // --- 6. 1980 MURAT 131 İKİZ YUVARLAK ÖN FARLAR & KROM IZGARA ---
      // Siyah Yatay Izgara
      const grille = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.18, 0.06), rubberMat);
      grille.position.set(0, 0.60, -2.14);
      this.carBody.add(grille);

      // Izgara Yatay Krom Şeritleri
      [-0.04, 0.0, 0.04].forEach(y => {
        const gLine = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.015, 0.07), chromeMat);
        gLine.position.set(0, 0.60 + y, -2.14);
        this.carBody.add(gLine);
      });

      // Klasik Murat 131 / Tofaş Arması
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), chromeMat);
      emblem.position.set(0, 0.60, -2.15);
      this.carBody.add(emblem);

      // İKİZ YUVARLAK KROM ÇERÇEVELİ FARLAR (Her iki yanda 2'şer adet yuvarlak far)
      this.headlightMeshes = [];
      const headlightX = [-0.68, -0.52, 0.52, 0.68];
      headlightX.forEach((x, idx) => {
        const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 20), chromeMat);
        bezel.rotation.x = Math.PI / 2;
        bezel.position.set(x, 0.60, -2.14);
        this.carBody.add(bezel);

        const lensMat = roundHeadlightMat.clone();
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(x, 0.60, -2.15);
        this.carBody.add(lens);
        this.headlightMeshes.push({ mesh: lens, mat: lensMat, isLeft: idx < 2 });
      });

      // Tampon Altı Dikdörtgen Turuncu Ön Sinyaller
      [-0.55, 0.55].forEach(x => {
        const ind = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), indicatorMat);
        ind.position.set(x, 0.28, -2.14);
        this.carBody.add(ind);
      });

      // --- 7. 1980 DİK STOP LAMBALARI & ARKA DETAYLAR ---
      this.tailBrakeMats = [];
      [-0.66, 0.66].forEach(x => {
        const stopGroup = new THREE.Group();
        stopGroup.position.set(x, 0.62, 2.14);

        // Krom Stop Çerçevesi
        const sFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.04), chromeMat);
        stopGroup.add(sFrame);

        // Üst: Turuncu Sinyal
        const sOrange = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.10, 0.05), indicatorMat);
        sOrange.position.y = 0.10;
        stopGroup.add(sOrange);

        // Orta: Beyaz Geri Vites
        const sWhite = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.05), tailWhiteMat);
        sWhite.position.y = 0.0;
        stopGroup.add(sWhite);

        // Alt: Kırmızı Fren Lambası (Dinamik Parlayan)
        const brakeMat = tailRedMat.clone();
        const sRed = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.05), brakeMat);
        sRed.position.y = -0.10;
        stopGroup.add(sRed);
        this.tailBrakeMats.push(brakeMat);

        this.carBody.add(stopGroup);
      });

      // Krom Bagaj Açma Kolu & Plaka Aydınlatması
      const bootHandle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), chromeMat);
      bootHandle.position.set(0, 0.58, 2.15);
      this.carBody.add(bootHandle);

      // Krom Basmalı Kapı Kolları (1980 Murat 131)
      [-0.845, 0.845].forEach(x => {
        const fH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.14), chromeMat);
        fH.position.set(x, 0.68, -0.35);
        this.carBody.add(fH);

        const rH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.14), chromeMat);
        rH.position.set(x, 0.68, 0.45);
        this.carBody.add(rH);
      });

      // Klasik Krom Yuvarlak Sol & Sağ Dikiz Aynaları
      [-0.86, 0.86].forEach((x, isRight) => {
        const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), chromeMat);
        mirrorStem.rotation.z = isRight ? -Math.PI / 4 : Math.PI / 4;
        mirrorStem.position.set(x, 0.84, -0.72);
        this.carBody.add(mirrorStem);

        const mirrorHead = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), chromeMat);
        mirrorHead.rotation.x = Math.PI / 2;
        mirrorHead.position.set(x > 0 ? x + 0.05 : x - 0.05, 0.88, -0.72);
        this.carBody.add(mirrorHead);

        // Ayna Yüzeyi (Gerçekçi Yansıtıcı)
        const mirrorFaceMat = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.98,
          roughness: 0.05
        });
        const mirrorGlass = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), mirrorFaceMat);
        mirrorGlass.position.set(x > 0 ? x + 0.05 : x - 0.05, 0.88, -0.70);
        this.carBody.add(mirrorGlass);
      });

      // Kıvrık Uçlu Klasik Krom Egzoz Borusu (Arka sol)
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.40, 10), chromeMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(-0.52, 0.22, 2.15);
      this.carBody.add(exhaust);

      // Gece Sürüşü Spot Farları (-Z ileri bakar)
      this.leftHeadlight = new THREE.SpotLight(0xfffae0, 2.6, 95, Math.PI / 5, 0.4);
      this.leftHeadlight.position.set(-0.60, 0.60, -2.20);
      this.chassis.add(this.leftHeadlight);
      this.leftHeadlight.target.position.set(-0.60, 0.0, -35.0);
      this.chassis.add(this.leftHeadlight.target);

      this.rightHeadlight = new THREE.SpotLight(0xfffae0, 2.6, 95, Math.PI / 5, 0.4);
      this.rightHeadlight.position.set(0.60, 0.60, -2.20);
      this.chassis.add(this.rightHeadlight);
      this.rightHeadlight.target.position.set(0.60, 0.0, -35.0);
      this.chassis.add(this.rightHeadlight.target);

      // --- 8. 1980 KLASİK SAC JANTLAR & KROM GÖBEK KAPAKLARI ---
      const tireGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, 0.21, 24);
      tireGeo.rotateZ(Math.PI / 2);

      const steelRimMat = new THREE.MeshStandardMaterial({
        color: 0xc8c8c8, // Gümüş Gri Sac Jant
        roughness: 0.40,
        metalness: 0.65
      });

      const wheelPositions = [
        { x: -this.trackWidth / 2, z: -this.wheelbase / 2, isFront: true },  // Ön Sol (İleri -Z)
        { x:  this.trackWidth / 2, z: -this.wheelbase / 2, isFront: true },  // Ön Sağ (İleri -Z)
        { x: -this.trackWidth / 2, z:  this.wheelbase / 2, isFront: false }, // Arka Sol (Geri +Z)
        { x:  this.trackWidth / 2, z:  this.wheelbase / 2, isFront: false }  // Arka Sağ (Geri +Z)
      ];

      wheelPositions.forEach((wp) => {
        const wGroup = new THREE.Group();
        wGroup.position.set(wp.x, this.wheelRadius, wp.z);

        // Siyah Klasik Lastik
        const tire = new THREE.Mesh(tireGeo, rubberMat);
        tire.castShadow = true;
        wGroup.add(tire);

        // Sac Jant Gövdesi
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(this.wheelRadius * 0.72, this.wheelRadius * 0.72, 0.22, 20), steelRimMat);
        rim.rotateZ(Math.PI / 2);
        wGroup.add(rim);

        // Sac Jant Havalandırma Delikleri Detayı
        for (let i = 0; i < 8; i++) {
          const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.225, 8), rubberMat);
          hole.rotateZ(Math.PI / 2);
          const angle = (i * Math.PI * 2) / 8;
          hole.position.y = Math.sin(angle) * (this.wheelRadius * 0.50);
          hole.position.z = Math.cos(angle) * (this.wheelRadius * 0.50);
          wGroup.add(hole);
        }

        // PARLAK KROM GÖBEK KAPAĞI (1980 Murat 131 Chrome Hubcap)
        const hubCap = new THREE.Mesh(new THREE.SphereGeometry(this.wheelRadius * 0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), chromeMat);
        hubCap.rotation.z = wp.x > 0 ? -Math.PI / 2 : Math.PI / 2;
        hubCap.position.x = wp.x > 0 ? 0.11 : -0.11;
        wGroup.add(hubCap);

        this.group.add(wGroup);
        this.wheels.push({
          group: wGroup,
          tire: tire,
          isFront: wp.isFront,
          baseX: wp.x,
          baseZ: wp.z,
          baseY: this.wheelRadius,
          rotation: 0
        });
      });
    }

    // ------------------------------------------------------------ 1980 KOKPİT & İÇ DİZAYN (İÇ MEKAN VE DİREKSİYON)
    _buildInteriorAndCockpit() {
      const interiorGroup = new THREE.Group();
      interiorGroup.name = 'Interior_Cockpit';
      this.carBody.add(interiorGroup);

      const vinylMat = new THREE.MeshStandardMaterial({ color: 0x221a15, roughness: 0.85 }); // Taba/Kahve Vinil
      const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.75 });
      const chromeTrim = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, metalness: 0.95, roughness: 0.1 });

      // Taban Halısı
      const carpet = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 2.50), blackPlastic);
      carpet.position.set(0, 0.52, 0.40);
      interiorGroup.add(carpet);

      // Ön Torpido Konsolu (1980 Murat 131 Düz Göğüs)
      const dashboard = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.26, 0.38), vinylMat);
      dashboard.position.set(0, 0.85, -0.66);
      interiorGroup.add(dashboard);

      // Gösterge Paneli Bloğu (Hız ve Devir Saati Kutusu)
      const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.08), blackPlastic);
      cluster.position.set(-0.35, 0.91, -0.56);
      interiorGroup.add(cluster);

      // Gösterge Kadranları (Yeşil Aydınlatmalı Klasik Tofaş Saatleri)
      const gaugeMat = new THREE.MeshBasicMaterial({ color: 0x44ffaa });
      const speedo = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), gaugeMat);
      speedo.position.set(-0.42, 0.91, -0.51);
      interiorGroup.add(speedo);

      const tacho = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), gaugeMat);
      tacho.position.set(-0.28, 0.91, -0.51);
      interiorGroup.add(tacho);

      // Direksiyon Mili & DİREKSİYON SİMİDİ (Hareketli 2 Kollu Klasik Tofaş Direksiyonu)
      this.steeringColumn = new THREE.Group();
      this.steeringColumn.position.set(-0.35, 0.82, -0.48);
      this.steeringColumn.rotation.x = -0.45;
      interiorGroup.add(this.steeringColumn);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), blackPlastic);
      shaft.position.z = 0.12;
      shaft.rotation.x = Math.PI / 2;
      this.steeringColumn.add(shaft);

      // Direksiyon Simidi (Torus)
      this.steeringWheelMesh = new THREE.Group();
      this.steeringWheelMesh.position.z = 0.24;
      this.steeringColumn.add(this.steeringWheelMesh);

      const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 10, 24), blackPlastic);
      this.steeringWheelMesh.add(wheelRim);

      // 1980 Murat 131 İki Kollu Klasik Göbek & Krom Çıta
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.02), blackPlastic);
      this.steeringWheelMesh.add(spoke);

      const hornBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), chromeTrim);
      hornBtn.rotation.x = Math.PI / 2;
      this.steeringWheelMesh.add(hornBtn);

      // Klasik Ön Koltuklar (Sürücü ve Yolcu Başlıklı Taba Vinil Koltuk)
      [-0.36, 0.36].forEach(x => {
        const seatGroup = new THREE.Group();
        seatGroup.position.set(x, 0.62, -0.05);

        // Minder
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.50), vinylMat);
        seatGroup.add(cushion);

        // Sırtlık
        const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.50, 0.14), vinylMat);
        backrest.position.set(0, 0.28, 0.20);
        backrest.rotation.x = 0.15;
        seatGroup.add(backrest);

        // Başlık
        const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.10), vinylMat);
        headrest.position.set(0, 0.58, 0.24);
        seatGroup.add(headrest);

        interiorGroup.add(seatGroup);
      });

      // Arka Kartal Geniş Süngerli Koltuk
      const rearSeat = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.18, 0.52), vinylMat);
      rearSeat.position.set(0, 0.64, 0.95);
      interiorGroup.add(rearSeat);

      const rearBack = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.52, 0.16), vinylMat);
      rearBack.position.set(0, 0.88, 1.22);
      rearBack.rotation.x = 0.12;
      interiorGroup.add(rearBack);

      // Vites Kolu & Körüğü
      const gearBoot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.10, 8), blackPlastic);
      gearBoot.position.set(0, 0.56, -0.22);
      interiorGroup.add(gearBoot);

      const gearStick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), chromeTrim);
      gearStick.position.set(0, 0.65, -0.22);
      interiorGroup.add(gearStick);

      const gearKnob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), blackPlastic);
      gearKnob.position.set(0, 0.76, -0.22);
      interiorGroup.add(gearKnob);

      // Dikiz Aynası (İç Kabin Orta Ayna)
      const rearViewMirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.03), chromeTrim);
      rearViewMirror.position.set(0, 1.20, -0.74);
      interiorGroup.add(rearViewMirror);
    }

    // ------------------------------------------------------------ ULTRA PARTİKÜL SİSTEMLERİ (Duman, Kıvılcım, Backfire, Nitro Alevi)
    _buildParticleSystems() {
      // 1. Duman ve Yanık Lastik Partikülleri
      const smokeGeo = new THREE.SphereGeometry(0.14, 6, 6);
      const smokeMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.45 });
      this.smokeGroup = new THREE.Group();
      this.smokeGroup.name = 'Smoke_Particles';
      this.scene.add(this.smokeGroup);

      for (let i = 0; i < 35; i++) {
        const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
        p.visible = false;
        p.userData = { life: 0, maxLife: 1.0, velocity: new THREE.Vector3() };
        this.smokeGroup.add(p);
        this.smokeParticles.push(p);
      }

      // 2. Çarpışma ve Sürtünme Kıvılcımları (NFS Sparks FX)
      const sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.12);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
      this.sparkGroup = new THREE.Group();
      this.sparkGroup.name = 'Spark_Particles';
      this.scene.add(this.sparkGroup);

      for (let i = 0; i < 40; i++) {
        const sp = new THREE.Mesh(sparkGeo, sparkMat.clone());
        sp.visible = false;
        sp.userData = { life: 0, maxLife: 0.4, velocity: new THREE.Vector3() };
        this.sparkGroup.add(sp);
        this.sparkParticles.push(sp);
      }

      // 3. Nitro ve Egzoz Backfire Alevi (NFS Blue Flame FX)
      const flameGeo = new THREE.ConeGeometry(0.065, 0.38, 8);
      flameGeo.rotateX(-Math.PI / 2);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.85 });
      this.exhaustFlame = new THREE.Mesh(flameGeo, flameMat);
      this.exhaustFlame.position.set(-0.52, 0.22, 2.38);
      this.exhaustFlame.visible = false;
      this.carBody.add(this.exhaustFlame);
    }

    _emitSmoke(origin, dir, isDamage = false, isTireSmoke = false) {
      const p = this.smokeParticles.find(sp => !sp.visible);
      if (!p) return;
      p.visible = true;
      p.position.copy(origin);
      p.scale.setScalar(isDamage ? 1.6 : (isTireSmoke ? 1.2 : 0.85));
      p.material.color.setHex(isDamage ? 0x111111 : (isTireSmoke ? 0xdddddd : 0x555555));
      p.material.opacity = isDamage ? 0.70 : (isTireSmoke ? 0.50 : 0.35);
      p.userData.life = 0;
      p.userData.maxLife = isDamage ? 1.6 : 0.8;
      p.userData.velocity.set(
        dir.x + (Math.random() - 0.5) * 1.5,
        dir.y + Math.random() * 2.2 + 0.8,
        dir.z + (Math.random() - 0.5) * 1.5
      );
    }

    _emitSparks(origin, normal, count = 15) {
      let emitted = 0;
      for (const sp of this.sparkParticles) {
        if (!sp.visible) {
          sp.visible = true;
          sp.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2));
          sp.userData.life = 0;
          sp.userData.maxLife = 0.25 + Math.random() * 0.25;
          sp.userData.velocity.set(
            normal.x * 6.0 + (Math.random() - 0.5) * 8.0,
            normal.y * 3.0 + Math.random() * 6.0 + 2.0,
            normal.z * 6.0 + (Math.random() - 0.5) * 8.0
          );
          emitted++;
          if (emitted >= count) break;
        }
      }
    }

    _updateParticles(dt) {
      // Duman güncellemesi
      this.smokeParticles.forEach(p => {
        if (!p.visible) return;
        p.userData.life += dt;
        if (p.userData.life >= p.userData.maxLife) {
          p.visible = false;
        } else {
          p.position.addScaledVector(p.userData.velocity, dt);
          p.scale.multiplyScalar(1.0 + dt * 1.8);
          p.material.opacity = Math.max(0, p.material.opacity - dt * 0.45);
        }
      });

      // Kıvılcım güncellemesi (Yerçekimi ve sönme)
      this.sparkParticles.forEach(sp => {
        if (!sp.visible) return;
        sp.userData.life += dt;
        if (sp.userData.life >= sp.userData.maxLife) {
          sp.visible = false;
        } else {
          sp.userData.velocity.y -= 22.0 * dt; // Yerçekimi
          sp.position.addScaledVector(sp.userData.velocity, dt);
          sp.lookAt(sp.position.clone().add(sp.userData.velocity));
        }
      });

      // Nitro & Backfire Alevi
      if (this.exhaustFlame) {
        if (this.isNitroActive) {
          this.exhaustFlame.visible = true;
          this.exhaustFlame.scale.set(1.0 + Math.random() * 0.4, 1.0 + Math.random() * 0.4, 1.5 + Math.random() * 0.8);
          this.exhaustFlame.material.color.setHex(0x00d0ff);
        } else if (this.gear > 1 && this.rpm > 5500 && Math.random() < 0.15) {
          // Vites atarken veya yüksek devirde egzoz patlaması (Backfire)
          this.exhaustFlame.visible = true;
          this.exhaustFlame.scale.set(1.2, 1.2, 1.2 + Math.random() * 0.6);
          this.exhaustFlame.material.color.setHex(0xffaa00);
          this.playBackfireSound();
        } else {
          this.exhaustFlame.visible = false;
        }
      }
    }

    // ------------------------------------------------------------ Web Audio Motor Sesi
    _initAudio() {
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) return;
        this.audioCtx = new AudioClass();

        this.bassOsc = this.audioCtx.createOscillator();
        this.bassOsc.type = 'triangle';

        this.engineOsc = this.audioCtx.createOscillator();
        this.engineOsc.type = 'sawtooth';

        this.filter = this.audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 320;
        this.filter.Q.value = 2.0;

        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = 0.035;

        this.bassGain = this.audioCtx.createGain();
        this.bassGain.gain.value = 0.75;

        this.engineGain = this.audioCtx.createGain();
        this.engineGain.gain.value = 0.25;

        this.bassOsc.connect(this.bassGain);
        this.engineOsc.connect(this.engineGain);
        this.bassGain.connect(this.filter);
        this.engineGain.connect(this.filter);
        this.filter.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);

        this.bassOsc.start();
        this.engineOsc.start();
      } catch (e) {}
    }

    setMute(mute) {
      this.soundEnabled = !mute;
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.soundEnabled ? 0.035 : 0.0, this.audioCtx ? this.audioCtx.currentTime : 0, 0.05);
      }
    }

    _updateAudio(dt) {
      if (!this.audioCtx || !this.soundEnabled) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const baseFreq = 26 + (this.rpm / 6400) * 160;
      const throttleBonus = this.inputs.throttle ? 1.15 : 0.95;
      const now = this.audioCtx.currentTime;

      this.bassOsc.frequency.setTargetAtTime(baseFreq * 0.75, now, 0.04);
      this.engineOsc.frequency.setTargetAtTime(baseFreq * throttleBonus, now, 0.04);

      const filterCutoff = 210 + (this.rpm / 6400) * 550 + (this.inputs.throttle ? 300 : 0);
      this.filter.frequency.setTargetAtTime(filterCutoff, now, 0.06);
    }

    playCrashSound(intensity) {
      if (!this.audioCtx || !this.soundEnabled) return;
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

        gain.gain.setValueAtTime(Math.min(0.2, 0.05 * intensity), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {}
    }

    // ------------------------------------------------------------ Zemin & Köprü Yüksekliği
    getSurfaceHeightAt(x, z, referenceY) {
      let terrainH = this.map.getHeightAt(x, z);
      if (terrainH === null) terrainH = -100;

      const startY = (referenceY !== undefined && referenceY > terrainH) ? referenceY + 4.5 : terrainH + 14.0;
      this.raycaster.set(new THREE.Vector3(x, startY, z), this.downVector);
      this.raycaster.far = 45.0;

      let highestSurface = terrainH;
      if (this.map && this.map.group) {
        const hits = this.raycaster.intersectObjects(this.map.group.children, true);
        for (const hit of hits) {
          if (hit.object !== this.group && !hit.object.name.startsWith('terrain_') && !hit.object.name.startsWith('water_')) {
            const normY = (hit.face && hit.face.normal) ? hit.face.normal.y : 1.0;
            if (normY > 0.4 && hit.point.y > highestSurface) {
              highestSurface = hit.point.y;
            }
          }
        }
      }
      return highestSurface;
    }

    // ------------------------------------------------------------ KESİN DUVARA SAPLANMAMA FİZİĞİ (Non-Penetration & Unstuck)
    checkObstacleCollisions(dt) {
      if (!this.map || !this.map.group) return;

      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      // Aracın gövde sınırları boyunca 8 algılayıcı nokta
      const checkPoints = [
        { pos: this.position.clone().addScaledVector(fwd, 2.15), dir: fwd, isFront: true },                      // Ön merkez
        { pos: this.position.clone().addScaledVector(fwd, 2.05).addScaledVector(right, 0.78), dir: fwd, isFront: true }, // Ön sağ
        { pos: this.position.clone().addScaledVector(fwd, 2.05).addScaledVector(right, -0.78), dir: fwd, isFront: true },// Ön sol
        { pos: this.position.clone().addScaledVector(fwd, -2.15), dir: fwd.clone().negate(), isFront: false },   // Arka merkez
        { pos: this.position.clone().addScaledVector(fwd, -2.05).addScaledVector(right, 0.78), dir: fwd.clone().negate(), isFront: false },
        { pos: this.position.clone().addScaledVector(fwd, -2.05).addScaledVector(right, -0.78), dir: fwd.clone().negate(), isFront: false },
        { pos: this.position.clone().addScaledVector(right, 0.86), dir: right, isFront: false },                  // Sağ yan
        { pos: this.position.clone().addScaledVector(right, -0.86), dir: right.clone().negate(), isFront: false } // Sol yan
      ];

      let collisionDetected = false;

      for (const cp of checkPoints) {
        this.raycaster.set(cp.pos.clone().add(new THREE.Vector3(0, 0.35, 0)), cp.dir);
        this.raycaster.far = 1.10; // Geniş güvenlik tamponu

        const hits = this.raycaster.intersectObjects(this.map.group.children, true);
        for (const hit of hits) {
          if (hit.object !== this.group && !hit.object.name.startsWith('terrain_') && !hit.object.name.startsWith('water_')) {
            const normY = (hit.face && hit.face.normal) ? hit.face.normal.y : 0;
            // Duvar, sur, bina, kapı veya kaya dik yüzeyi
            if (Math.abs(normY) < 0.55) {
              this._resolveSafeWallCollision(hit, cp);
              collisionDetected = true;
              break;
            }
          }
        }
        if (collisionDetected) break;
      }

      this.isColliding = collisionDetected;

      // Otomatik Kurtarma Takipçisi (Anti-Stuck Watchdog)
      if (collisionDetected) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 0.6) {
          // Eğer 0.6 saniyedir duvara yapışıksa aracı duvardan dışarı fırlat
          const escapeDir = fwd.clone().negate();
          this.position.addScaledVector(escapeDir, 1.2);
          this.velocity.multiplyScalar(0);
          this.stuckTimer = 0;
        }
      } else {
        this.stuckTimer = 0;
      }
    }


    playBackfireSound() {
      if (!this.audioCtx || !this.soundEnabled) return;
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } catch (e) {}
    }

    _applyDeformation(sensor, currentSpeed) {
      const dmg = Math.min(1.0, currentSpeed / 20.0);
      if (sensor.isFront) {
        // Ön Kaput ve Tampon Eğilme & Kıvrılma
        this.damageState.hoodBent = Math.min(0.24, this.damageState.hoodBent + dmg * 0.14);
        this.damageState.frontBumperBent = Math.min(0.18, this.damageState.frontBumperBent + dmg * 0.12);

        if (this.hood) {
          this.hood.rotation.x = -0.06 + this.damageState.hoodBent * 0.9;
          this.hood.position.y = 0.77 + this.damageState.hoodBent * 0.4;
          this.hood.position.z = -1.45 + this.damageState.hoodBent * 0.3;
        }
        if (this.frontBumper) {
          this.frontBumper.position.z = -2.16 + this.damageState.frontBumperBent * 0.35;
          this.frontBumper.rotation.z = (Math.random() - 0.5) * this.damageState.frontBumperBent * 0.6;
          this.frontBumper.rotation.x = this.damageState.frontBumperBent * 0.5;
        }

        // Şiddetli çarpışmada ön cam çatlaması (NFS Shattered Glass)
        if (currentSpeed > 10.0 && !this.damageState.windshieldCracked) {
          this.damageState.windshieldCracked = true;
          if (this.winFrontMat) {
            this.winFrontMat.opacity = 0.92;
            this.winFrontMat.roughness = 0.85;
            this.winFrontMat.color.setHex(0xb8d4d8);
          }
        }

        // Farların patlaması
        if (currentSpeed > 8.0) {
          if (sensor.pos.x < this.position.x && !this.damageState.leftLightBroken) {
            this.damageState.leftLightBroken = true;
            if (this.leftHeadlight) this.leftHeadlight.intensity = 0;
            const lMesh = this.headlightMeshes.find(h => h.isLeft);
            if (lMesh) {
              lMesh.mat.emissiveIntensity = 0;
              lMesh.mat.color.setHex(0x333333);
            }
          } else if (sensor.pos.x >= this.position.x && !this.damageState.rightLightBroken) {
            this.damageState.rightLightBroken = true;
            if (this.rightHeadlight) this.rightHeadlight.intensity = 0;
            const rMesh = this.headlightMeshes.find(h => !h.isLeft);
            if (rMesh) {
              rMesh.mat.emissiveIntensity = 0;
              rMesh.mat.color.setHex(0x333333);
            }
          }
        }
      } else {
        // Arka Tampon & Bagaj Eğilmesi
        this.damageState.rearBumperBent = Math.min(0.20, this.damageState.rearBumperBent + dmg * 0.12);
        if (this.rearBumper) {
          this.rearBumper.position.z = 2.16 - this.damageState.rearBumperBent * 0.35;
          this.rearBumper.rotation.z = (Math.random() - 0.5) * this.damageState.rearBumperBent * 0.5;
        }
        if (currentSpeed > 11.0 && !this.damageState.rearGlassCracked) {
          this.damageState.rearGlassCracked = true;
          if (this.winRearMat) {
            this.winRearMat.opacity = 0.95;
            this.winRearMat.roughness = 0.90;
            this.winRearMat.color.setHex(0xb0cbcf);
          }
        }
      }
    }

    _resolveSafeWallCollision(hit, sensor) {
      const normal = (hit.face && hit.face.normal) ? hit.face.normal.clone() : sensor.dir.clone().negate();
      normal.y = 0;
      if (normal.lengthSq() < 0.01) normal.copy(sensor.dir).negate();
      normal.normalize();

      // 1. DUVARIN DIŞINA GÜÇLÜ İTİŞ (Asla saplanamaz!)
      const pushOutDistance = 0.65;
      this.position.addScaledVector(normal, pushOutDistance);

      // 2. DUVARA DOĞRU OLAN HIZI ANINDA SIFIRLA VE GERİ SEKTİR
      const vDotN = this.velocity.dot(normal);
      if (vDotN < 0) {
        this.velocity.subScaledVector(normal, vDotN * 1.4); // Elastik sekme
        this.velocity.multiplyScalar(0.70); // Sürtünme
      }

      // 3. Geri Vites Kurtarma Gücü
      if (this.inputs.brake > 0 && sensor.isFront) {
        this.velocity.addScaledVector(normal, 8.0);
      } else if (this.inputs.throttle > 0 && !sensor.isFront) {
        this.velocity.addScaledVector(normal, 8.0);
      }

      // 4. Sarsıntı, Hasar, Deformasyon, Cam Kırılması ve Kıvılcım FX
      const currentSpeed = this.velocity.length();
      if (currentSpeed > 2.5) {
        this.cameraShakeIntensity = Math.min(1.0, currentSpeed / 14.0);
        this.health = Math.max(10, this.health - Math.round(currentSpeed * 0.75));
        this.playCrashSound(currentSpeed / 9.0);
        this._emitSparks(hit.point, normal, Math.min(30, Math.round(currentSpeed * 2.5)));
        this._emitSmoke(hit.point, normal, true);
        this._applyDeformation(sensor, currentSpeed);

        // Çarpışma anında süspansiyon darbesi
        this.suspensionBounceVel += (currentSpeed / 12.0) * 0.45;
        this.suspensionPitchVel += sensor.isFront ? 0.35 : -0.35;
      }
    }

    // ------------------------------------------------------------ Acil Durum Sıfırlama (R Tuşu)
    unflip() {
      const groundH = this.getSurfaceHeightAt(this.position.x, this.position.z, this.position.y);
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.position.addScaledVector(fwd, -2.0);
      this.position.y = groundH + this.wheelRadius + 0.6;
      this.pitch = 0;
      this.roll = 0;
      this.suspensionPitch = 0;
      this.suspensionRoll = 0;
      this.suspensionBounce = 0;
      this.verticalVelocity = 0;
      this.velocity.set(0, 0, 0);
      this.chassis.rotation.set(0, 0, 0);
      this.stuckTimer = 0;

      // Hasarları sıfırla (Tamir et)
      this.health = 100;
      this.damageState.hoodBent = 0;
      this.damageState.frontBumperBent = 0;
      this.damageState.rearBumperBent = 0;
      this.damageState.windshieldCracked = false;
      this.damageState.rearGlassCracked = false;
      this.damageState.leftLightBroken = false;
      this.damageState.rightLightBroken = false;

      if (this.hood) {
        this.hood.rotation.x = -0.06;
        this.hood.position.set(0, 0.77, -1.45);
      }
      if (this.frontBumper) {
        this.frontBumper.position.set(0, 0.38, -2.16);
        this.frontBumper.rotation.set(0, 0, 0);
      }
      if (this.rearBumper) {
        this.rearBumper.position.set(0, 0.38, 2.16);
        this.rearBumper.rotation.set(0, 0, 0);
      }
      if (this.winFrontMat) {
        this.winFrontMat.opacity = 0.80;
        this.winFrontMat.roughness = 0.05;
        this.winFrontMat.color.setHex(0xdde8ea);
      }
      if (this.winRearMat) {
        this.winRearMat.opacity = 0.80;
        this.winRearMat.roughness = 0.05;
        this.winRearMat.color.setHex(0xdde8ea);
      }
      if (this.leftHeadlight) this.leftHeadlight.intensity = 2.6;
      if (this.rightHeadlight) this.rightHeadlight.intensity = 2.6;
      this.headlightMeshes.forEach(h => {
        h.mat.emissiveIntensity = 0.95;
        h.mat.color.setHex(0xfffbe8);
      });
    }

    setSpawn(x, y, z, yaw = 0) {
      this.position.set(x, y, z);
      this.velocity.set(0, 0, 0);
      this.verticalVelocity = 0;
      this.angularVelocity = 0;
      this.yaw = yaw;
      this.pitch = 0;
      this.roll = 0;
      this.suspensionPitch = 0;
      this.suspensionRoll = 0;
      this.suspensionBounce = 0;
      this.speedKmh = 0;
      this.rpm = this.idleRpm;
      this.gear = 1;
      this.health = 100;
      this.nitro = 100;
      this.stuckTimer = 0;
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.yaw, 0);
      this.chassis.rotation.set(0, 0, 0);
    }

    // ------------------------------------------------------------ Ana Fizik Döngüsü
    update(dt, inputKeys) {
      if (!dt || dt > 0.1) dt = 0.016;

      this.inputs.throttle = inputKeys.KeyW || inputKeys.ArrowUp ? 1 : 0;
      this.inputs.brake = inputKeys.KeyS || inputKeys.ArrowDown ? 1 : 0;
      this.inputs.handbrake = !!inputKeys.Space;
      this.inputs.nitro = !!(inputKeys.ShiftLeft || inputKeys.ShiftRight);

      // NFS Nitro Mantığı (Shift tuşu)
      if (this.inputs.nitro && this.nitro > 0 && this.inputs.throttle > 0) {
        this.isNitroActive = true;
        this.nitro = Math.max(0, this.nitro - dt * 25.0); // 4 saniye tam nitro
        this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.18);
      } else {
        this.isNitroActive = false;
        // Nitro yavaşça dolsun
        this.nitro = Math.min(100, this.nitro + dt * 6.5);
      }

      // Direksiyon: A = SOL (-1), D = SAĞ (+1)
      let steerInput = 0;
      if (inputKeys.KeyA || inputKeys.ArrowLeft) steerInput -= 1.0;
      if (inputKeys.KeyD || inputKeys.ArrowRight) steerInput += 1.0;

      const currentSpeed = this.velocity.length();
      const steerSpeedFactor = Math.max(0.28, 1.0 - (currentSpeed / 65));
      const targetAngle = steerInput * this.maxSteerAngle * steerSpeedFactor;
      this.steeringAngle += (targetAngle - this.steeringAngle) * Math.min(1.0, dt * 10.0);

      // Kokpit Direksiyon Simidini Döndür (360 derece direksiyon açısı)
      if (this.steeringWheelMesh) {
        this.steeringWheelMesh.rotation.z = -this.steeringAngle * 2.8;
      }

      // Vites Mantığı
      if (this.inputs.brake > 0 && currentSpeed < 0.8 && this.gear >= 0) {
        this.gear = -1; // Geri vites
      } else if (this.inputs.throttle > 0 && currentSpeed < 0.8 && this.gear === -1) {
        this.gear = 1;  // 1. Vites
      }

      if (this.gear > 0) {
        if (this.rpm > 5500 && this.gear < 5) {
          this.gear++;
          this.rpm = 3200;
          this.playBackfireSound();
        } else if (this.rpm < 2100 && this.gear > 1) {
          this.gear--;
          this.rpm = 4200;
        }
      }

      // İleri Yön Vektörü (-Z)
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      const forwardSpeed = this.velocity.dot(fwd);
      const lateralSpeed = this.velocity.dot(right);

      // Motor & Güç (Nitro Güç Çarpanı)
      let driveForce = 0;
      const ratio = this.gearRatios[this.gear] || 0;
      const nitroMultiplier = this.isNitroActive ? 1.75 : 1.0;

      if (this.gear !== 0) {
        const targetRpm = Math.max(this.idleRpm, (Math.abs(forwardSpeed) / (this.wheelRadius * 2 * Math.PI)) * 60 * Math.abs(ratio) * this.finalDrive);
        this.rpm += (targetRpm - this.rpm) * Math.min(1.0, dt * 8.0);
        this.rpm = Math.min(this.maxRpm, Math.max(this.idleRpm, this.rpm));

        if (this.isGrounded) {
          if (this.gear > 0 && this.inputs.throttle > 0) {
            const torqueFactor = Math.sin((this.rpm / this.maxRpm) * Math.PI);
            driveForce = this.inputs.throttle * this.maxTorque * nitroMultiplier * ratio * this.finalDrive * (0.65 + 0.35 * torqueFactor);
          } else if (this.gear === -1 && this.inputs.brake > 0) {
            driveForce = -this.inputs.brake * this.maxTorque * Math.abs(ratio) * this.finalDrive * 0.85;
          }
        }
      }

      // Fren & El Freni
      let brakeForce = 0;
      const isBraking = this.gear > 0 && this.inputs.brake > 0 && this.isGrounded;
      if (isBraking) {
        brakeForce = 5200 * Math.sign(forwardSpeed);
      }
      let handbrakeFriction = 1.0;
      if (this.inputs.handbrake && this.isGrounded) {
        brakeForce += 5800 * Math.sign(forwardSpeed);
        handbrakeFriction = 0.26;
      }

      // Arka Fren Lambası Parlaması (Dinamik Aydınlatma)
      if (this.tailBrakeMats && this.tailBrakeMats.length) {
        const brakeBright = (isBraking || this.inputs.handbrake) ? 1.0 : 0.25;
        this.tailBrakeMats.forEach(mat => {
          mat.emissiveIntensity = brakeBright;
        });
      }

      const rollResistance = this.isGrounded ? (240 * Math.sign(forwardSpeed)) : 10;
      const aeroDrag = 0.42 * 0.5 * 1.225 * 2.1 * forwardSpeed * Math.abs(forwardSpeed);

      const netForwardForce = driveForce - brakeForce - rollResistance - aeroDrag;
      const forwardAccel = netForwardForce / this.mass;

      const corneringStiffness = 32000 * handbrakeFriction;
      let lateralForce = this.isGrounded ? (-lateralSpeed * corneringStiffness / this.mass) : (-lateralSpeed * 0.2);

      this.driftFactor = Math.min(1.0, Math.abs(lateralSpeed) / 7.0 + (this.inputs.handbrake ? 0.65 : 0.0));

      // Driftte beyaz lastik dumanı ve asfalta sürtünme
      if (this.driftFactor > 0.45 && currentSpeed > 5.0) {
        const rearWheelPos = this.position.clone().addScaledVector(fwd, -1.25).addScaledVector(right, (Math.random() - 0.5) * 1.3);
        this._emitSmoke(rearWheelPos, new THREE.Vector3(0, 0.8, 0), false, true);
      }

      // Normal egzoz dumanı
      if (this.inputs.throttle > 0 && Math.random() < 0.25) {
        const exhaustPos = this.position.clone().addScaledVector(fwd, -2.15).addScaledVector(right, -0.52).add(new THREE.Vector3(0, 0.25, 0));
        this._emitSmoke(exhaustPos, fwd.clone().negate().multiplyScalar(2.0), this.health < 40);
      }

      const baseYawRate = (forwardSpeed / this.wheelbase) * Math.sin(this.steeringAngle);
      const oversteerBonus = this.inputs.handbrake ? (this.steeringAngle * 2.8) : (this.driftFactor * this.steeringAngle * 1.35);

      this.angularVelocity = baseYawRate + oversteerBonus;
      if (this.isGrounded) {
        this.yaw += this.angularVelocity * dt;
      } else {
        this.yaw += this.angularVelocity * 0.4 * dt;
      }

      this.velocity.addScaledVector(fwd, forwardAccel * dt);
      this.velocity.addScaledVector(right, lateralForce * dt);

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;

      this.speedKmh = Math.abs(this.velocity.length() * 3.6);

      // Zemin & Dikey Fizik
      const groundH = this.getSurfaceHeightAt(this.position.x, this.position.z, this.position.y);
      const targetY = groundH + this.wheelRadius;

      const gravity = -25.0;
      this.verticalVelocity += gravity * dt;
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= targetY) {
        const impactY = Math.abs(this.verticalVelocity);
        if (!this.isGrounded && impactY > 7.0) {
          this.cameraShakeIntensity = Math.min(1.0, impactY / 18.0);
          this.playCrashSound(impactY / 13.0);
          this.suspensionBounceVel += (impactY / 15.0) * 0.5;
        }

        this.position.y = targetY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }

      // ------------------------------------------------------------ GERÇEKÇİ SÜSPANSİYON ESNEME SİMÜLASYONU (Spring-Damper Physics)
      const springFreq = 14.0;
      const damping = 7.5;

      // İvmelenme ve Frende Gövde Burun Dalması / Kalkması (Pitch Squat/Dive)
      const targetSuspPitch = (forwardAccel / 9.81) * -0.095;
      const pitchAcc = (targetSuspPitch - this.suspensionPitch) * (springFreq * springFreq) - this.suspensionPitchVel * damping;
      this.suspensionPitchVel += pitchAcc * dt;
      this.suspensionPitch += this.suspensionPitchVel * dt;

      // Virajda Gövde Yana Yatması (Body Roll / Sway)
      const targetSuspRoll = (lateralSpeed / 9.81) * 0.125;
      const rollAcc = (targetSuspRoll - this.suspensionRoll) * (springFreq * springFreq) - this.suspensionRollVel * damping;
      this.suspensionRollVel += rollAcc * dt;
      this.suspensionRoll += this.suspensionRollVel * dt;

      // Tümsek ve Çukur Zıplaması (Suspension Heave / Bounce)
      const bounceAcc = (0 - this.suspensionBounce) * (springFreq * springFreq) - this.suspensionBounceVel * damping;
      this.suspensionBounceVel += bounceAcc * dt;
      this.suspensionBounce += this.suspensionBounceVel * dt;

      // Arazi Eğimine Uyum
      if (this.isGrounded) {
        const hFront = this.getSurfaceHeightAt(this.position.x + fwd.x * 1.5, this.position.z + fwd.z * 1.5, this.position.y);
        const hRear = this.getSurfaceHeightAt(this.position.x - fwd.x * 1.5, this.position.z - fwd.z * 1.5, this.position.y);
        const groundPitch = Math.atan2(hFront - hRear, 3.0);
        const targetPitch = THREE.MathUtils.clamp(groundPitch, -0.42, 0.42);
        this.pitch += (targetPitch - this.pitch) * Math.min(1.0, dt * 14.0);

        const hRight = this.getSurfaceHeightAt(this.position.x + right.x * 1.0, this.position.z + right.z * 1.0, this.position.y);
        const hLeft = this.getSurfaceHeightAt(this.position.x - right.x * 1.0, this.position.z - right.z * 1.0, this.position.y);
        const groundRoll = Math.atan2(hRight - hLeft, 2.0);
        const targetRoll = THREE.MathUtils.clamp(groundRoll, -0.38, 0.38);
        this.roll += (targetRoll - this.roll) * Math.min(1.0, dt * 14.0);
      } else {
        this.pitch += (0 - this.pitch) * dt * 4.0;
        this.roll += (0 - this.roll) * dt * 6.0;
      }

      this.pitch = THREE.MathUtils.clamp(this.pitch, -0.45, 0.45);
      this.roll = THREE.MathUtils.clamp(this.roll, -0.40, 0.40);

      // DUVAR VE ENGEL KONTROLÜ
      this.checkObstacleCollisions(dt);

      if (this.cameraShakeIntensity > 0) {
        this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 2.5);
      }

      // Matris Güncellemeleri: Şasi zemin eğimini alır, Gövde süspansiyon esnemesini ekler
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.yaw, 0);
      this.chassis.position.y = this.suspensionBounce;
      this.chassis.rotation.set(this.pitch + this.suspensionPitch, 0, this.roll + this.suspensionRoll);

      // Tekerlekler ve Süspansiyon Yukarı/Aşağı Hareketi
      const wheelSpin = (forwardSpeed / this.wheelRadius) * dt;
      this.wheels.forEach(w => {
        w.rotation += wheelSpin;
        w.tire.rotation.x = w.rotation;

        if (w.isFront) {
          w.group.rotation.y = this.steeringAngle;
        }

        // Tekerleğin bağımsız süspansiyon esnemesi
        const wheelPitchOffset = w.isFront ? -this.suspensionPitch * 1.2 : this.suspensionPitch * 1.2;
        const wheelRollOffset = w.baseX > 0 ? -this.suspensionRoll * 0.7 : this.suspensionRoll * 0.7;
        w.group.position.y = THREE.MathUtils.clamp(w.baseY + wheelPitchOffset + wheelRollOffset, this.wheelRadius * 0.75, this.wheelRadius * 1.25);
      });

      this._updateAudio(dt);
      this._updateParticles(dt);
    }
  }

  global.KartalVehicle = KartalVehicle;
})(window);
