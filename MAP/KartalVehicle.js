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
      this.mass = 990;         // kg (1980 kasa daha hafif)

      // Dinamik Durumlar
      this.position = new THREE.Vector3(0, 0, 0);
      this.velocity = new THREE.Vector3(0, 0, 0);
      this.verticalVelocity = 0;
      this.angularVelocity = 0;
      this.yaw = 0;
      this.pitch = 0;
      this.roll = 0;

      // Motor & Sanziman
      this.gear = 1;
      this.rpm = 900;
      this.idleRpm = 900;
      this.maxRpm = 6400;
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
      this.maxTorque = 122; // Nm (1.6 OHV / OHC)

      this.steeringAngle = 0;
      this.maxSteerAngle = 0.60;
      this.speedKmh = 0;
      this.driftFactor = 0;
      this.isGrounded = true;

      // Hasar ve Çarpışma Durumu
      this.health = 100;
      this.cameraShakeIntensity = 0;
      this.stuckTimer = 0;
      this.isColliding = false;

      // Girdiler
      this.inputs = {
        throttle: 0,
        brake: 0,
        handbrake: false,
        steer: 0
      };

      // Raycaster
      this.raycaster = new THREE.Raycaster();
      this.downVector = new THREE.Vector3(0, -1, 0);

      // Ses
      this.soundEnabled = true;
      this._initAudio();

      this.wheels = [];
      this.smokeParticles = [];

      this._build1980Mesh();
      this._buildSmokeSystem();
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
      const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.46, 4.22), navyPaintMat);
      lowerBody.position.y = 0.50;
      lowerBody.castShadow = true;
      lowerBody.receiveShadow = true;
      this.carBody.add(lowerBody);

      // Yan Krom Kuşak Çıtası (1980 Murat 131 boydan boya ince nikelaj çıtası)
      [-0.835, 0.835].forEach(x => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 4.10), chromeMat);
        strip.position.set(x, 0.52, 0);
        this.carBody.add(strip);
      });

      // --- 2. 1980 MOTOR KAPUTU & KROM ÖN BURUN ---
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.15, 1.30), navyPaintMat);
      hood.position.set(0, 0.77, -1.45);
      hood.rotation.x = -0.06; // Öne doğru zarif Murat 131 eğimi
      this.carBody.add(hood);

      // Kaput Ön Krom Burun Çıtası
      const hoodNose = new THREE.Mesh(new THREE.BoxGeometry(1.60, 0.03, 0.04), chromeMat);
      hoodNose.position.set(0, 0.73, -2.10);
      this.carBody.add(hoodNose);

      // --- 3. 1980 KARTAL STATION WAGON KABİN & TAVAN ---
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.56, 2.68), navyPaintMat);
      cabin.position.set(0, 1.02, 0.42);
      cabin.castShadow = true;
      this.carBody.add(cabin);

      // Krom Yağmurluk Oluğu (Tavan kenarlarındaki klasik nikelaj oluk)
      [-0.745, 0.745].forEach(x => {
        const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 2.72), chromeMat);
        gutter.position.set(x, 1.30, 0.42);
        this.carBody.add(gutter);
      });

      // --- 4. 1980 KLASİK CAMLAR & NİKELAJ ÇERÇEVELER ---
      // Ön Cam (Krom Çerçeveli)
      const winFront = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.50, 0.05), glassMat);
      winFront.position.set(0, 1.00, -0.90);
      winFront.rotation.x = 0.38;
      this.carBody.add(winFront);

      const winFrontFrame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.52, 0.03), chromeMat);
      winFrontFrame.position.set(0, 1.00, -0.89);
      winFrontFrame.rotation.x = 0.38;
      this.carBody.add(winFrontFrame);

      // Arka Bagaj Camı (Krom Çerçeveli Dik Bagaj Camı)
      const winRear = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.48, 0.05), glassMat);
      winRear.position.set(0, 1.02, 1.76);
      winRear.rotation.x = -0.10;
      this.carBody.add(winRear);

      // Yan Camlar Bloğu
      const winSide = new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.42, 2.45), glassMat);
      winSide.position.set(0, 1.03, 0.42);
      this.carBody.add(winSide);

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
      const headlightX = [-0.68, -0.52, 0.52, 0.68];
      headlightX.forEach(x => {
        // Krom Çerçeve
        const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 20), chromeMat);
        bezel.rotation.x = Math.PI / 2;
        bezel.position.set(x, 0.60, -2.14);
        this.carBody.add(bezel);

        // Yuvarlak Cam Mercek
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), roundHeadlightMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(x, 0.60, -2.15);
        this.carBody.add(lens);
      });

      // Tampon Altı Dikdörtgen Turuncu Ön Sinyaller
      [-0.55, 0.55].forEach(x => {
        const ind = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), indicatorMat);
        ind.position.set(x, 0.28, -2.14);
        this.carBody.add(ind);
      });

      // --- 7. 1980 DİK STOP LAMBALARI & ARKA DETAYLAR ---
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

        // Alt: Kırmızı Fren Lambası
        const sRed = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.05), tailRedMat);
        sRed.position.y = -0.10;
        stopGroup.add(sRed);

        this.carBody.add(stopGroup);
      });

      // Krom Bagaj Açma Kolu & Plaka Aydınlatması
      const bootHandle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), chromeMat);
      bootHandle.position.set(0, 0.58, 2.15);
      this.carBody.add(bootHandle);

      // Krom Basmalı Kapı Kolları (1980 Murat 131)
      [-0.845, 0.845].forEach(x => {
        // Ön kapı kolu
        const fH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.14), chromeMat);
        fH.position.set(x, 0.68, -0.35);
        this.carBody.add(fH);

        // Arka kapı kolu
        const rH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.14), chromeMat);
        rH.position.set(x, 0.68, 0.45);
        this.carBody.add(rH);
      });

      // Klasik Krom Yuvarlak Sol Dikiz Aynası
      const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), chromeMat);
      mirrorStem.rotation.z = Math.PI / 4;
      mirrorStem.position.set(-0.86, 0.84, -0.72);
      this.carBody.add(mirrorStem);

      const mirrorHead = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), chromeMat);
      mirrorHead.rotation.x = Math.PI / 2;
      mirrorHead.position.set(-0.91, 0.88, -0.72);
      this.carBody.add(mirrorHead);

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
          rotation: 0
        });
      });
    }

    _buildSmokeSystem() {
      const smokeGeo = new THREE.SphereGeometry(0.14, 6, 6);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.45
      });

      this.smokeGroup = new THREE.Group();
      this.scene.add(this.smokeGroup);

      for (let i = 0; i < 25; i++) {
        const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
        p.visible = false;
        p.userData = { life: 0, maxLife: 1.0, velocity: new THREE.Vector3() };
        this.smokeGroup.add(p);
        this.smokeParticles.push(p);
      }
    }

    _emitSmoke(origin, dir, isDamage = false) {
      const p = this.smokeParticles.find(sp => !sp.visible);
      if (!p) return;
      p.visible = true;
      p.position.copy(origin);
      p.scale.setScalar(isDamage ? 1.6 : 0.85);
      p.material.color.setHex(isDamage ? 0x111111 : 0x666666);
      p.material.opacity = isDamage ? 0.65 : 0.35;
      p.userData.life = 0;
      p.userData.maxLife = isDamage ? 1.5 : 0.8;
      p.userData.velocity.set(
        dir.x + (Math.random() - 0.5) * 1.5,
        dir.y + Math.random() * 2.2 + 1.0,
        dir.z + (Math.random() - 0.5) * 1.5
      );
    }

    _updateSmoke(dt) {
      this.smokeParticles.forEach(p => {
        if (!p.visible) return;
        p.userData.life += dt;
        if (p.userData.life >= p.userData.maxLife) {
          p.visible = false;
        } else {
          p.position.addScaledVector(p.userData.velocity, dt);
          p.scale.multiplyScalar(1.0 + dt * 1.6);
          p.material.opacity = Math.max(0, p.material.opacity - dt * 0.42);
        }
      });
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
        // Duvara doğru hareket eden hız bileşenini yansıt
        this.velocity.subScaledVector(normal, vDotN * 1.4); // Elastik sekme
        this.velocity.multiplyScalar(0.70); // Sürtünme
      }

      // 3. Geri Vites Kurtarma Gücü (Sürüş kolaylığı)
      if (this.inputs.brake > 0 && sensor.isFront) {
        // Ön tarafı duvardayken geri tuşuna basarsa ekstra geri itme gücü ver
        this.velocity.addScaledVector(normal, 8.0);
      } else if (this.inputs.throttle > 0 && !sensor.isFront) {
        // Arkası duvardayken gaza basarsa ileri it
        this.velocity.addScaledVector(normal, 8.0);
      }

      // 4. Sarsıntı ve Çarpma Sesi
      const currentSpeed = this.velocity.length();
      if (currentSpeed > 3.0) {
        this.cameraShakeIntensity = Math.min(1.0, currentSpeed / 15.0);
        this.health = Math.max(10, this.health - Math.round(currentSpeed * 0.8));
        this.playCrashSound(currentSpeed / 10.0);
        this._emitSmoke(hit.point, normal, true);
      }
    }

    // ------------------------------------------------------------ Acil Durum Sıfırlama (R Tuşu)
    unflip() {
      const groundH = this.getSurfaceHeightAt(this.position.x, this.position.z, this.position.y);
      // Aracı geriye doğru 2.0 metre çek ve yerden kaldır
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.position.addScaledVector(fwd, -2.0);
      this.position.y = groundH + this.wheelRadius + 0.6;
      this.pitch = 0;
      this.roll = 0;
      this.verticalVelocity = 0;
      this.velocity.set(0, 0, 0);
      this.chassis.rotation.set(0, 0, 0);
      this.stuckTimer = 0;
    }

    setSpawn(x, y, z, yaw = 0) {
      this.position.set(x, y, z);
      this.velocity.set(0, 0, 0);
      this.verticalVelocity = 0;
      this.angularVelocity = 0;
      this.yaw = yaw;
      this.pitch = 0;
      this.roll = 0;
      this.speedKmh = 0;
      this.rpm = this.idleRpm;
      this.gear = 1;
      this.health = 100;
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

      // Direksiyon: A = SOL (-1), D = SAĞ (+1)
      let steerInput = 0;
      if (inputKeys.KeyA || inputKeys.ArrowLeft) steerInput -= 1.0;
      if (inputKeys.KeyD || inputKeys.ArrowRight) steerInput += 1.0;

      const currentSpeed = this.velocity.length();
      const steerSpeedFactor = Math.max(0.28, 1.0 - (currentSpeed / 65));
      const targetAngle = steerInput * this.maxSteerAngle * steerSpeedFactor;
      this.steeringAngle += (targetAngle - this.steeringAngle) * Math.min(1.0, dt * 10.0);

      // Vites Mantığı
      if (this.inputs.brake > 0 && currentSpeed < 0.8 && this.gear >= 0) {
        this.gear = -1; // Geri vites
      } else if (this.inputs.throttle > 0 && currentSpeed < 0.8 && this.gear === -1) {
        this.gear = 1;  // 1. Vites
      }

      if (this.gear > 0) {
        if (this.rpm > 5400 && this.gear < 5) {
          this.gear++;
          this.rpm = 3100;
        } else if (this.rpm < 2100 && this.gear > 1) {
          this.gear--;
          this.rpm = 4100;
        }
      }

      // İleri Yön Vektörü (-Z)
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      const forwardSpeed = this.velocity.dot(fwd);
      const lateralSpeed = this.velocity.dot(right);

      // Motor & Güç
      let driveForce = 0;
      const ratio = this.gearRatios[this.gear] || 0;

      if (this.gear !== 0) {
        const targetRpm = Math.max(this.idleRpm, (Math.abs(forwardSpeed) / (this.wheelRadius * 2 * Math.PI)) * 60 * Math.abs(ratio) * this.finalDrive);
        this.rpm += (targetRpm - this.rpm) * Math.min(1.0, dt * 8.0);
        this.rpm = Math.min(this.maxRpm, Math.max(this.idleRpm, this.rpm));

        if (this.isGrounded) {
          if (this.gear > 0 && this.inputs.throttle > 0) {
            const torqueFactor = Math.sin((this.rpm / this.maxRpm) * Math.PI);
            driveForce = this.inputs.throttle * this.maxTorque * ratio * this.finalDrive * (0.65 + 0.35 * torqueFactor);
          } else if (this.gear === -1 && this.inputs.brake > 0) {
            driveForce = -this.inputs.brake * this.maxTorque * Math.abs(ratio) * this.finalDrive * 0.85;
          }
        }
      }

      // Fren & El Freni
      let brakeForce = 0;
      if (this.gear > 0 && this.inputs.brake > 0 && this.isGrounded) {
        brakeForce = 4800 * Math.sign(forwardSpeed);
      }
      let handbrakeFriction = 1.0;
      if (this.inputs.handbrake && this.isGrounded) {
        brakeForce += 5400 * Math.sign(forwardSpeed);
        handbrakeFriction = 0.28;
      }

      const rollResistance = this.isGrounded ? (240 * Math.sign(forwardSpeed)) : 10;
      const aeroDrag = 0.42 * 0.5 * 1.225 * 2.1 * forwardSpeed * Math.abs(forwardSpeed);

      const netForwardForce = driveForce - brakeForce - rollResistance - aeroDrag;
      const forwardAccel = netForwardForce / this.mass;

      const corneringStiffness = 32000 * handbrakeFriction;
      let lateralForce = this.isGrounded ? (-lateralSpeed * corneringStiffness / this.mass) : (-lateralSpeed * 0.2);

      this.driftFactor = Math.min(1.0, Math.abs(lateralSpeed) / 7.5 + (this.inputs.handbrake ? 0.6 : 0.0));

      if (this.inputs.throttle > 0 && Math.random() < 0.25) {
        const exhaustPos = this.position.clone().addScaledVector(fwd, -2.15).addScaledVector(right, -0.52).add(new THREE.Vector3(0, 0.25, 0));
        this._emitSmoke(exhaustPos, fwd.clone().negate().multiplyScalar(2.0), this.health < 40);
      }

      const baseYawRate = (forwardSpeed / this.wheelbase) * Math.sin(this.steeringAngle);
      const oversteerBonus = this.inputs.handbrake ? (this.steeringAngle * 2.6) : (this.driftFactor * this.steeringAngle * 1.2);

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
        if (!this.isGrounded && impactY > 8.0) {
          this.cameraShakeIntensity = Math.min(1.0, impactY / 20.0);
          this.playCrashSound(impactY / 15.0);
        }

        this.position.y = targetY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }

      // Jiroskopik Dengeleme (Asla takla atamaz / ters dönemez)
      if (this.isGrounded) {
        const hFront = this.getSurfaceHeightAt(this.position.x + fwd.x * 1.5, this.position.z + fwd.z * 1.5, this.position.y);
        const hRear = this.getSurfaceHeightAt(this.position.x - fwd.x * 1.5, this.position.z - fwd.z * 1.5, this.position.y);
        const groundPitch = Math.atan2(hFront - hRear, 3.0);
        const accelPitch = (forwardAccel / 9.81) * -0.06;
        const targetPitch = THREE.MathUtils.clamp(groundPitch + accelPitch, -0.42, 0.42);
        this.pitch += (targetPitch - this.pitch) * Math.min(1.0, dt * 14.0);

        const hRight = this.getSurfaceHeightAt(this.position.x + right.x * 1.0, this.position.z + right.z * 1.0, this.position.y);
        const hLeft = this.getSurfaceHeightAt(this.position.x - right.x * 1.0, this.position.z - right.z * 1.0, this.position.y);
        const groundRoll = Math.atan2(hRight - hLeft, 2.0);
        const cornerRoll = (lateralSpeed / 9.81) * 0.08;
        const targetRoll = THREE.MathUtils.clamp(groundRoll + cornerRoll, -0.38, 0.38);
        this.roll += (targetRoll - this.roll) * Math.min(1.0, dt * 14.0);
      } else {
        this.pitch += (0 - this.pitch) * dt * 4.0;
        this.roll += (0 - this.roll) * dt * 6.0;
      }

      this.pitch = THREE.MathUtils.clamp(this.pitch, -0.45, 0.45);
      this.roll = THREE.MathUtils.clamp(this.roll, -0.40, 0.40);

      // DUVAR VE ENGEL KONTROLÜ (Garantili Ayrılma)
      this.checkObstacleCollisions(dt);

      if (this.cameraShakeIntensity > 0) {
        this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 2.5);
      }

      // Matris Güncellemeleri
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.yaw, 0);
      this.chassis.rotation.set(this.pitch, 0, this.roll);

      // Tekerlekler
      const wheelSpin = (forwardSpeed / this.wheelRadius) * dt;
      this.wheels.forEach(w => {
        w.rotation += wheelSpin;
        w.tire.rotation.x = w.rotation;

        if (w.isFront) {
          w.group.rotation.y = this.steeringAngle;
        }
      });

      this._updateAudio(dt);
      this._updateSmoke(dt);
    }
  }

  global.KartalVehicle = KartalVehicle;
})(window);
