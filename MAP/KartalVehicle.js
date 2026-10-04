/**
 * KartalVehicle.js — Tofaş Kartal 1.6 SLX Yüksek Detaylı 3D Model & GTA Tarzı Sürüş Motoru
 * 
 * Özellikler:
 * - Üst düzey 3D Station Wagon Geometrisi: Kavisli kaput, çamurluk yuvaları, dikiz aynaları,
 *   klasik SLX 5 kollu çelik/alaşım jantlar, fren diskleri ve kaliperler, tavan rayları
 * - MeshPhysicalMaterial Otomotiv Boyası (Clearcoat cila, yansıma ve gerçekçi metalik doku)
 * - Duvara Takılmama / Duvar Kayma Fiziği (Wall Slide & Non-penetration)
 * - Takla Atmayı & Ters Kalmayı Engelleyen Otomatik Doğrultma (Auto-Righting & Gyro Stabilization)
 * - Köprü ve 3D platform raycast desteği
 * - Gerçekçi motor sesi, egzoz patırtısı, çarpma FX ve mute desteği
 * - Otopilot / AI Waypoint sürüş yeteneği (Yarışı baştan sona tamamlama desteği)
 */
(function (global) {
  'use strict';

  class KartalVehicle {
    constructor(scene, map) {
      this.scene = scene;
      this.map = map;

      // 3D Model Kök Grubu
      this.group = new THREE.Group();
      this.group.name = 'Tofas_Kartal_SLX_V3';
      this.scene.add(this.group);

      // Boyutlar (Kartal 1.6 SLX)
      this.width = 1.70;       // m
      this.length = 4.32;      // m
      this.height = 1.45;      // m
      this.wheelbase = 2.45;   // aks mesafesi
      this.trackWidth = 1.42;  // tekerlek izi
      this.wheelRadius = 0.32; // tekerlek çapı
      this.mass = 1050;        // kg

      // Konum, Hız & Yönelim
      this.position = new THREE.Vector3(0, 0, 0);
      this.velocity = new THREE.Vector3(0, 0, 0);
      this.verticalVelocity = 0; // m/s
      this.angularVelocity = 0;  // rad/s
      this.yaw = 0;              // radyan
      this.pitch = 0;            // burun kalkma / dalma (clamped)
      this.roll = 0;             // yana yatma (clamped)

      // Motor & Şanzıman (1.6L Tempra motoru)
      this.gear = 1;             // -1: R, 0: N, 1..5
      this.rpm = 950;
      this.idleRpm = 950;
      this.maxRpm = 6600;
      this.gearRatios = {
        '-1': -3.60,
        0: 0.0,
        1: 3.80,
        2: 2.15,
        3: 1.40,
        4: 1.00,
        5: 0.82
      };
      this.finalDrive = 3.90;
      this.maxTorque = 135;      // Nm

      // Dinamik Durumlar
      this.steeringAngle = 0;    // ön tekerlek açısı
      this.maxSteerAngle = 0.60; // radyan (~34°)
      this.speedKmh = 0;
      this.driftFactor = 0;
      this.isGrounded = true;
      this.airTime = 0;

      // Hasar & Sağlık (GTA Tarzı)
      this.health = 100;
      this.lastImpactSpeed = 0;
      this.cameraShakeIntensity = 0;

      // Girdi Durumu
      this.inputs = {
        throttle: 0,
        brake: 0,
        handbrake: false,
        steer: 0,
        jump: false
      };

      // Otopilot (AI Waypoint Navigation)
      this.autopilot = false;
      this.autopilotTarget = null;
      this.autopilotSpeed = 50;

      // Raycaster (Zemin, Köprü ve Çarpışma için)
      this.raycaster = new THREE.Raycaster();
      this.downVector = new THREE.Vector3(0, -1, 0);

      // Web Audio Ses Sistemi
      this.soundEnabled = true;
      this._initAudio();

      // Tekerlekler ve Duman
      this.wheels = [];
      this.smokeParticles = [];

      this._buildMesh();
      this._buildSmokeSystem();
    }

    _buildMesh() {
      // 1. Üst Düzey Otomotiv Boyası (Three.js MeshPhysicalMaterial)
      const carPaintMat = new THREE.MeshPhysicalMaterial({
        color: 0xf6f6f4,              // Klasik Tofaş Beyazı
        roughness: 0.15,
        metalness: 0.10,
        clearcoat: 1.0,               // Parlak araba cilası
        clearcoatRoughness: 0.08,
        reflectivity: 0.85
      });

      // Siyah Plastik Tamponlar, Yan Çıtalar, Izgara
      const plasticMat = new THREE.MeshStandardMaterial({
        color: 0x181818,
        roughness: 0.82,
        metalness: 0.08
      });

      // Filmli Camlar
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x16221c,
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.65,
        transparent: true,
        opacity: 0.75,
        ior: 1.52
      });

      // Parlak Krom Detaylar (Egzoz, çıtalar, amblem)
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.10,
        metalness: 0.95
      });

      // SLX Ön Farları (Kristal Çanak Reflektör)
      const headLightMat = new THREE.MeshStandardMaterial({
        color: 0xfffae8,
        roughness: 0.15,
        metalness: 0.4,
        emissive: 0xffe688,
        emissiveIntensity: 0.9
      });

      // Sarı Sis Farları
      const fogLightMat = new THREE.MeshStandardMaterial({
        color: 0xffbb22,
        roughness: 0.2,
        emissive: 0xffaa00,
        emissiveIntensity: 0.85
      });

      // Turuncu Ön ve Yan Sinyaller
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        roughness: 0.25,
        emissive: 0xcc5500,
        emissiveIntensity: 0.65
      });

      // Klasik SLX Stop Lambaları (Kırmızı / Beyaz / Turuncu)
      const tailRedMat = new THREE.MeshStandardMaterial({
        color: 0xcc0000,
        roughness: 0.25,
        emissive: 0x880000,
        emissiveIntensity: 0.55
      });
      const tailWhiteMat = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        roughness: 0.3
      });

      this.chassis = new THREE.Group();
      this.chassis.name = 'Chassis';
      this.group.add(this.chassis);

      // Model parcalarinin ileri (-Z) bakmasi icin 180 derece dondurulen govde grubu
      this.carBody = new THREE.Group();
      this.carBody.rotation.y = Math.PI;
      this.chassis.add(this.carBody);

      // --- 1. ALT GÖVDE & KAPI BÖLGESİ (Davlumbaz Kavisli Alt Kasa) ---
      const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.48, 4.28), carPaintMat);
      lowerBody.position.y = 0.52;
      lowerBody.castShadow = true;
      lowerBody.receiveShadow = true;
      this.carBody.add(lowerBody);

      // Çamurluk Davlumbaz Kavisleri (Tekerleklerin üstündeki siyah yuvalar)
      [-0.85, 0.85].forEach(x => {
        // Ön teker yuvası
        const fArch = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 16, 1, false, 0, Math.PI), plasticMat);
        fArch.rotation.z = Math.PI / 2;
        fArch.rotation.y = Math.PI / 2;
        fArch.position.set(x > 0 ? 0.84 : -0.84, 0.38, 1.22);
        this.carBody.add(fArch);

        // Arka teker yuvası
        const rArch = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 16, 1, false, 0, Math.PI), plasticMat);
        rArch.rotation.z = Math.PI / 2;
        rArch.rotation.y = Math.PI / 2;
        rArch.position.set(x > 0 ? 0.84 : -0.84, 0.38, -1.22);
        this.carBody.add(rArch);
      });

      // --- 2. KAVİSLİ MOTOR KAPUTU (Eğimli Aerodinamik Tofaş Kaputu) ---
      const hoodGeo = new THREE.BoxGeometry(1.64, 0.16, 1.32);
      const hood = new THREE.Mesh(hoodGeo, carPaintMat);
      hood.position.set(0, 0.82, 1.48);
      hood.rotation.x = 0.08;
      this.carBody.add(hood);

      // Kaput Orta Çizgisi (Tofaş Karakteristik Çizgisi)
      const hoodLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 1.28), chromeMat);
      hoodLine.position.set(0, 0.91, 1.48);
      hoodLine.rotation.x = 0.08;
      this.carBody.add(hoodLine);

      // --- 3. KARTAL STATION WAGON ÜST KABİN & TAVAN ---
      const cabinGeo = new THREE.BoxGeometry(1.50, 0.58, 2.76);
      const cabin = new THREE.Mesh(cabinGeo, carPaintMat);
      cabin.position.set(0, 1.05, -0.42);
      cabin.castShadow = true;
      this.carBody.add(cabin);

      // --- 4. AYRINTILI CAMLAR & DİREKLER (A, B, C, D Sütunları) ---
      // Eğimli Ön Cam
      const winFront = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.52, 0.06), glassMat);
      winFront.position.set(0, 1.03, 0.92);
      winFront.rotation.x = -0.42;
      this.carBody.add(winFront);

      // Dik Arka Bagaj Camı (Kartal SLX bagaj kapağı camı)
      const winRear = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.52, 0.06), glassMat);
      winRear.position.set(0, 1.05, -1.78);
      winRear.rotation.x = 0.12;
      this.carBody.add(winRear);

      // Yan Camlar (Geniş Station Wagon Cam Bloğu)
      const winSide = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.44, 2.52), glassMat);
      winSide.position.set(0, 1.06, -0.42);
      this.carBody.add(winSide);

      // Karartılmış B ve C Sütunları
      [-0.765, 0.765].forEach(x => {
        // B Sütunu
        const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.12), plasticMat);
        bPillar.position.set(x, 1.06, 0.05);
        this.carBody.add(bPillar);

        // C Sütunu
        const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.12), plasticMat);
        cPillar.position.set(x, 1.06, -0.92);
        this.carBody.add(cPillar);
      });

      // --- 5. TAMPONLAR & YAN KORUMA ÇITALARI ---
      // Ön Tampon (Sis Farlı SLX Tamponu)
      this.frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.24, 0.24), plasticMat);
      this.frontBumper.position.set(0, 0.38, 2.16);
      this.carBody.add(this.frontBumper);

      // Sis Farları (Ön Tamponun Altında)
      [-0.45, 0.45].forEach(x => {
        const fog = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.05), fogLightMat);
        fog.position.set(x, 0.34, 2.27);
        this.carBody.add(fog);
      });

      // Arka Tampon
      this.rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.26, 0.24), plasticMat);
      this.rearBumper.position.set(0, 0.40, -2.16);
      this.carBody.add(this.rearBumper);

      // Yan Koruma Çıtaları (Kapıların ortasından geçen klasik Tofaş bandı)
      [-0.855, 0.855].forEach(x => {
        const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 4.0), plasticMat);
        sideStrip.position.set(x, 0.52, 0.0);
        this.carBody.add(sideStrip);
      });

      // Kapı Kolları (Siyah gömme Tofaş kolları)
      [-0.86, 0.86].forEach(x => {
        // Ön kapı kolu
        const fHandle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.14), plasticMat);
        fHandle.position.set(x, 0.72, 0.35);
        this.carBody.add(fHandle);

        // Arka kapı kolu
        const rHandle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.14), plasticMat);
        rHandle.position.set(x, 0.72, -0.45);
        this.carBody.add(rHandle);
      });

      // Aerodinamik Dikiz Aynaları (Sağ & Sol)
      [-0.88, 0.88].forEach(x => {
        const mirrorBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.16), plasticMat);
        mirrorBody.position.set(x, 0.88, 0.78);
        this.carBody.add(mirrorBody);

        const mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.12), chromeMat);
        mirrorGlass.position.set(x > 0 ? x - 0.06 : x + 0.06, 0.88, 0.78);
        this.carBody.add(mirrorGlass);
      });

      // --- 6. ÖN PANJUR, FARLAR & LOGO ---
      // Tofaş SLX Yatay Izgaralı Panjur
      const grille = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.18, 0.06), plasticMat);
      grille.position.set(0, 0.62, 2.14);
      this.carBody.add(grille);

      // Izgara krom çıtaları
      [-0.04, 0.04].forEach(y => {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.02, 0.07), chromeMat);
        slat.position.set(0, 0.62 + y, 2.14);
        this.carBody.add(slat);
      });

      // Tofaş Amblemi (Ortadaki mavi/krom SLX kuşu)
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.08), chromeMat);
      emblem.position.set(0, 0.62, 2.16);
      this.carBody.add(emblem);

      // Dikdörtgen Ön Farlar & Köşe Sinyalleri
      [-0.60, 0.60].forEach(x => {
        // Ana Far
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.06), headLightMat);
        hl.position.set(x, 0.62, 2.14);
        this.carBody.add(hl);

        // Turuncu Köşe Sinyali
        const ind = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.06), indicatorMat);
        ind.position.set(x > 0 ? x + 0.22 : x - 0.22, 0.62, 2.13);
        this.carBody.add(ind);
      });

      // --- 7. ARKA STOPLAR & BAGAJ KAPISI ---
      [-0.65, 0.65].forEach(x => {
        const stopGroup = new THREE.Group();
        stopGroup.position.set(x, 0.60, -2.14);

        // Kırmızı Fren/Park Lambası
        const redSection = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.20, 0.06), tailRedMat);
        redSection.position.y = -0.06;
        stopGroup.add(redSection);

        // Turuncu Sinyal
        const indSection = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.06), indicatorMat);
        indSection.position.y = 0.08;
        stopGroup.add(indSection);

        this.carBody.add(stopGroup);
      });

      // Bagaj Plaka ve Tutamağı
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.16, 0.04), tailWhiteMat);
      plate.position.set(0, 0.58, -2.15);
      this.carBody.add(plate);

      // Kartal Tavan Rayları (SLX Portbagaj Barları)
      [-0.62, 0.62].forEach(x => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.45, 8), plasticMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(x, 1.39, -0.42);
        this.carBody.add(rail);

        // Ray Ayakları
        [-1.3, -0.4, 0.5].forEach(z => {
          const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6), plasticMat);
          foot.position.set(x, 1.36, z);
          this.carBody.add(foot);
        });
      });

      // Çift Çıkışlı Krom Egzoz Borusu
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 10), chromeMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(-0.55, 0.22, -2.16);
      this.carBody.add(exhaust);

      // Spot Gece Farları (İleri -Z yönüne bakar)
      this.leftHeadlight = new THREE.SpotLight(0xfffae0, 2.6, 95, Math.PI / 5, 0.4);
      this.leftHeadlight.position.set(-0.60, 0.62, -2.22);
      this.chassis.add(this.leftHeadlight);
      this.leftHeadlight.target.position.set(-0.60, 0.0, -35.0);
      this.chassis.add(this.leftHeadlight.target);

      this.rightHeadlight = new THREE.SpotLight(0xfffae0, 2.6, 95, Math.PI / 5, 0.4);
      this.rightHeadlight.position.set(0.60, 0.62, -2.22);
      this.chassis.add(this.rightHeadlight);
      this.rightHeadlight.target.position.set(0.60, 0.0, -35.0);
      this.chassis.add(this.rightHeadlight.target);

      // --- 8. DETAYLI 4 ADET TEKERLEK (Ön: -Z, Arka: +Z) ---
      const tireGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, 0.23, 24);
      tireGeo.rotateZ(Math.PI / 2);

      const tireMat = new THREE.MeshStandardMaterial({
        color: 0x181818,
        roughness: 0.92,
        metalness: 0.05
      });

      const alloyRimMat = new THREE.MeshStandardMaterial({
        color: 0xe0e0e0,
        roughness: 0.22,
        metalness: 0.88
      });

      const brakeDiscMat = new THREE.MeshStandardMaterial({
        color: 0x999999,
        roughness: 0.35,
        metalness: 0.90
      });

      const caliperMat = new THREE.MeshStandardMaterial({
        color: 0xb91c1c, // Kırmızı Spor Kaliper
        roughness: 0.3
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

        // Lastik (Tire)
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.castShadow = true;
        wGroup.add(tire);

        // SLX Alaşım Jant Tabanı
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(this.wheelRadius * 0.70, this.wheelRadius * 0.70, 0.24, 20), alloyRimMat);
        rim.rotateZ(Math.PI / 2);
        wGroup.add(rim);

        // Jant 5 Kollu Detayları
        for (let i = 0; i < 5; i++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.05, 0.04), alloyRimMat);
          spoke.rotation.x = (i * Math.PI * 2) / 5;
          wGroup.add(spoke);
        }

        // Fren Diski ve Kaliper
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(this.wheelRadius * 0.52, this.wheelRadius * 0.52, 0.02, 16), brakeDiscMat);
        disc.rotateZ(Math.PI / 2);
        disc.position.x = wp.x > 0 ? -0.06 : 0.06;
        wGroup.add(disc);

        const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.08), caliperMat);
        caliper.position.set(wp.x > 0 ? -0.07 : 0.07, 0.14, 0);
        wGroup.add(caliper);

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

    // ------------------------------------------------------------ Web Audio Motor & Darbe Sesi
    _initAudio() {
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) return;
        this.audioCtx = new AudioClass();

        // 1. Tok Sub-Bass (Tempra 1.6L Alt Devirler)
        this.bassOsc = this.audioCtx.createOscillator();
        this.bassOsc.type = 'triangle';

        // 2. Üst Harmonikler (Eksantrik & Supap)
        this.engineOsc = this.audioCtx.createOscillator();
        this.engineOsc.type = 'sawtooth';

        // 3. Low-Pass BiquadFilter (Tok, boğuk egzoz tınısı)
        this.filter = this.audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 340;
        this.filter.Q.value = 2.2;

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

      const baseFreq = 28 + (this.rpm / 6600) * 170;
      const throttleBonus = this.inputs.throttle ? 1.15 : 0.95;
      const now = this.audioCtx.currentTime;

      this.bassOsc.frequency.setTargetAtTime(baseFreq * 0.75, now, 0.04);
      this.engineOsc.frequency.setTargetAtTime(baseFreq * throttleBonus, now, 0.04);

      const filterCutoff = 220 + (this.rpm / 6600) * 580 + (this.inputs.throttle ? 320 : 0);
      this.filter.frequency.setTargetAtTime(filterCutoff, now, 0.06);
    }

    playCrashSound(intensity) {
      if (!this.audioCtx || !this.soundEnabled) return;
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

        gain.gain.setValueAtTime(Math.min(0.2, 0.05 * intensity), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {}
    }

    // ------------------------------------------------------------ Zemin ve Köprü Yükseklik Tespiti
    getSurfaceHeightAt(x, z, referenceY) {
      let terrainH = this.map.getHeightAt(x, z);
      if (terrainH === null) terrainH = -100;

      // Sahnedeki köprü ve platform modellerine yukarıdan aşağıya dikey raycast
      const startY = (referenceY !== undefined && referenceY > terrainH) ? referenceY + 4.5 : terrainH + 14.0;
      this.raycaster.set(new THREE.Vector3(x, startY, z), this.downVector);
      this.raycaster.far = 45.0;

      let highestSurface = terrainH;
      if (this.map && this.map.group) {
        const hits = this.raycaster.intersectObjects(this.map.group.children, true);
        for (const hit of hits) {
          if (hit.object !== this.group && !hit.object.name.startsWith('terrain_') && !hit.object.name.startsWith('water_')) {
            // Sadece yatay veya eğimli zemin/köprü yüzeyleri
            const normY = (hit.face && hit.face.normal) ? hit.face.normal.y : 1.0;
            if (normY > 0.4 && hit.point.y > highestSurface) {
              highestSurface = hit.point.y;
            }
          }
        }
      }
      return highestSurface;
    }

    // ------------------------------------------------------------ Duvar Kayma & Takılmama Fiziği (Wall Slide)
    checkObstacleCollisions() {
      if (!this.map || !this.map.group) return;

      const currentSpeed = this.velocity.length();
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      // Tampon ve gövde çevresi 6 kontrol noktası
      const checkPoints = [
        { pos: this.position.clone().addScaledVector(fwd, 2.2), dir: fwd, isFront: true },
        { pos: this.position.clone().addScaledVector(fwd, 2.0).addScaledVector(right, 0.8), dir: fwd, isFront: true },
        { pos: this.position.clone().addScaledVector(fwd, 2.0).addScaledVector(right, -0.8), dir: fwd, isFront: true },
        { pos: this.position.clone().addScaledVector(fwd, -2.2), dir: fwd.clone().negate(), isFront: false },
        { pos: this.position.clone().addScaledVector(right, 0.9), dir: right, isFront: false },
        { pos: this.position.clone().addScaledVector(right, -0.9), dir: right.clone().negate(), isFront: false }
      ];

      for (const cp of checkPoints) {
        this.raycaster.set(cp.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), cp.dir);
        this.raycaster.far = 0.85;

        const hits = this.raycaster.intersectObjects(this.map.group.children, true);
        for (const hit of hits) {
          if (hit.object !== this.group && !hit.object.name.startsWith('terrain_') && !hit.object.name.startsWith('water_')) {
            // Duvar gibi dik yüzeyler
            const normY = (hit.face && hit.face.normal) ? hit.face.normal.y : 0;
            if (Math.abs(normY) < 0.5) {
              this._resolveWallSlide(hit, currentSpeed);
              return;
            }
          }
        }
      }
    }

    _resolveWallSlide(hit, impactSpeed) {
      const normal = (hit.face && hit.face.normal) ? hit.face.normal.clone().normalize() : new THREE.Vector3(0, 0, 1);
      normal.y = 0;
      if (normal.lengthSq() < 0.01) normal.set(0, 0, 1);
      normal.normalize();

      // 1. Duvarın içine girmeyi kesin olarak engelle (Push-out)
      const pushDist = 0.45;
      this.position.addScaledVector(normal, pushDist);

      // 2. Duvara TAKILMAK YERİNE DUVAR BOYUNCA KAY (Wall Slide)
      // Hızın duvara dik olan bileşenini sıfırla, paralel bileşenini koru!
      const normalVel = this.velocity.dot(normal);
      if (normalVel < 0) {
        // Duvara doğru hareket ediyorsa normal bileşeni yansıt ve sürtünme uygula
        this.velocity.subScaledVector(normal, normalVel * 1.3); // Hafif elastik geri itiş
        this.velocity.multiplyScalar(0.75); // Duvar sürtünmesi
      }

      // 3. Hasar ve Sarsıntı
      if (impactSpeed > 4.0) {
        const damage = Math.round(impactSpeed * 1.2);
        this.health = Math.max(0, this.health - damage);
        this.cameraShakeIntensity = Math.min(1.0, impactSpeed / 18.0);
        this.playCrashSound(impactSpeed / 12.0);
        this._emitSmoke(hit.point, normal, true);
      }
    }

    // ------------------------------------------------------------ Spawn / Sıfırlama
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
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.yaw, 0);
      this.chassis.rotation.set(0, 0, 0);
    }

    // Ters dönen aracı tekerlekler üstüne düzelt (Unflip)
    unflip() {
      const groundH = this.getSurfaceHeightAt(this.position.x, this.position.z, this.position.y);
      this.position.y = groundH + this.wheelRadius + 0.3;
      this.pitch = 0;
      this.roll = 0;
      this.verticalVelocity = 0;
      this.velocity.multiplyScalar(0.2);
      this.chassis.rotation.set(0, 0, 0);
    }

    // ------------------------------------------------------------ Ana Fizik Motoru
    update(dt, inputKeys) {
      if (!dt || dt > 0.1) dt = 0.016;

      // 1. Otopilot veya Kullanıcı Girdileri
      if (this.autopilot && this.autopilotTarget) {
        this._runAutopilot(dt);
      } else {
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
      }

      const currentSpeed = this.velocity.length();

      // 2. Vites & Geri Vites Mantığı
      if (this.inputs.brake > 0 && currentSpeed < 0.8 && this.gear >= 0) {
        this.gear = -1; // Geri vites
      } else if (this.inputs.throttle > 0 && currentSpeed < 0.8 && this.gear === -1) {
        this.gear = 1;  // 1. Vites
      }

      // Otomatik Vites Geçişleri
      if (this.gear > 0) {
        if (this.rpm > 5400 && this.gear < 5) {
          this.gear++;
          this.rpm = 3100;
        } else if (this.rpm < 2100 && this.gear > 1) {
          this.gear--;
          this.rpm = 4100;
        }
      }

      // 3. Yön Vektörleri
      // Burun yönü: fwd = (-sin(yaw), 0, -cos(yaw))
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      const forwardSpeed = this.velocity.dot(fwd);
      const lateralSpeed = this.velocity.dot(right);

      // 4. Motor Gücü & Tork
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
            driveForce = -this.inputs.brake * this.maxTorque * Math.abs(ratio) * this.finalDrive * 0.80;
          }
        }
      }

      // 5. Fren & El Freni
      let brakeForce = 0;
      if (this.gear > 0 && this.inputs.brake > 0 && this.isGrounded) {
        brakeForce = 4800 * Math.sign(forwardSpeed);
      }
      let handbrakeFriction = 1.0;
      if (this.inputs.handbrake && this.isGrounded) {
        brakeForce += 5400 * Math.sign(forwardSpeed);
        handbrakeFriction = 0.28; // Drift
      }

      // 6. Direnç & Sürtünme
      const rollResistance = this.isGrounded ? (240 * Math.sign(forwardSpeed)) : 10;
      const aeroDrag = 0.42 * 0.5 * 1.225 * 2.1 * forwardSpeed * Math.abs(forwardSpeed);

      const netForwardForce = driveForce - brakeForce - rollResistance - aeroDrag;
      const forwardAccel = netForwardForce / this.mass;

      const corneringStiffness = 32000 * handbrakeFriction;
      let lateralForce = this.isGrounded ? (-lateralSpeed * corneringStiffness / this.mass) : (-lateralSpeed * 0.2);

      this.driftFactor = Math.min(1.0, Math.abs(lateralSpeed) / 7.5 + (this.inputs.handbrake ? 0.6 : 0.0));

      // Egzoz Dumanı
      if (this.inputs.throttle > 0 && Math.random() < 0.3) {
        const exhaustPos = this.position.clone().addScaledVector(fwd, -2.16).addScaledVector(right, -0.55).add(new THREE.Vector3(0, 0.25, 0));
        this._emitSmoke(exhaustPos, fwd.clone().negate().multiplyScalar(2.0), this.health < 40);
      }

      // 7. Direksiyon Dönüş Hızı (Yaw Rate)
      const baseYawRate = (forwardSpeed / this.wheelbase) * Math.sin(this.steeringAngle);
      const oversteerBonus = this.inputs.handbrake ? (this.steeringAngle * 2.6) : (this.driftFactor * this.steeringAngle * 1.2);

      this.angularVelocity = baseYawRate + oversteerBonus;
      if (this.isGrounded) {
        this.yaw += this.angularVelocity * dt;
      } else {
        this.yaw += this.angularVelocity * 0.4 * dt;
      }

      // 8. Hız & Pozisyon
      this.velocity.addScaledVector(fwd, forwardAccel * dt);
      this.velocity.addScaledVector(right, lateralForce * dt);

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;

      this.speedKmh = Math.abs(this.velocity.length() * 3.6);

      // 9. Düşey Fizik, Yerçekimi ve Zemin Uyumu
      const groundH = this.getSurfaceHeightAt(this.position.x, this.position.z, this.position.y);
      const targetY = groundH + this.wheelRadius;

      const gravity = -25.0; // m/s^2
      this.verticalVelocity += gravity * dt;
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= targetY) {
        // Zemine temas etti
        const impactY = Math.abs(this.verticalVelocity);
        if (!this.isGrounded && impactY > 8.0) {
          this.cameraShakeIntensity = Math.min(1.0, impactY / 20.0);
          this.playCrashSound(impactY / 15.0);
        }

        this.position.y = targetY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
        this.airTime = 0;
      } else {
        this.isGrounded = false;
        this.airTime += dt;
      }

      // Rampadan fırlama
      if (this.isGrounded && forwardSpeed > 15.0) {
        const aheadH = this.getSurfaceHeightAt(this.position.x + fwd.x * 2.5, this.position.z + fwd.z * 2.5, this.position.y);
        const rampSlope = (aheadH - groundH) / 2.5;
        if (rampSlope > 0.35) {
          this.verticalVelocity = forwardSpeed * rampSlope * 0.65;
          this.isGrounded = false;
        }
      }

      // 10. TERS DÖNMEYİ ENGELLEYEN OTOMATİK DOĞRULTMA (Auto-Righting & Gyro Stabilization)
      if (this.isGrounded) {
        const hFront = this.getSurfaceHeightAt(this.position.x + fwd.x * 1.5, this.position.z + fwd.z * 1.5, this.position.y);
        const hRear = this.getSurfaceHeightAt(this.position.x - fwd.x * 1.5, this.position.z - fwd.z * 1.5, this.position.y);
        const groundPitch = Math.atan2(hFront - hRear, 3.0);
        const accelPitch = (forwardAccel / 9.81) * -0.06;
        const targetPitch = THREE.MathUtils.clamp(groundPitch + accelPitch, -0.45, 0.45);
        this.pitch += (targetPitch - this.pitch) * Math.min(1.0, dt * 14.0);

        const hRight = this.getSurfaceHeightAt(this.position.x + right.x * 1.0, this.position.z + right.z * 1.0, this.position.y);
        const hLeft = this.getSurfaceHeightAt(this.position.x - right.x * 1.0, this.position.z - right.z * 1.0, this.position.y);
        const groundRoll = Math.atan2(hRight - hLeft, 2.0);
        const cornerRoll = (lateralSpeed / 9.81) * 0.08;
        const targetRoll = THREE.MathUtils.clamp(groundRoll + cornerRoll, -0.40, 0.40);
        this.roll += (targetRoll - this.roll) * Math.min(1.0, dt * 14.0);
      } else {
        // Havada iken aracı dört teker üstüne doğrult (GTA Stunt Stabilization)
        this.pitch += (0 - this.pitch) * dt * 4.0;
        this.roll += (0 - this.roll) * dt * 6.0;
      }

      // Açıları sert sınırlarda tut (ASLA TERS DÖNMEZ!)
      this.pitch = THREE.MathUtils.clamp(this.pitch, -0.48, 0.48);
      this.roll = THREE.MathUtils.clamp(this.roll, -0.45, 0.45);

      // 11. Duvar & Engel Çarpışması Kontrolü (Duvar Kayma)
      this.checkObstacleCollisions();

      // Kamera sarsıntısını sönümle
      if (this.cameraShakeIntensity > 0) {
        this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 2.5);
      }

      // 12. 3D Model Matrislerini Güncelle
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.yaw, 0);
      this.chassis.rotation.set(this.pitch, 0, this.roll);

      // 13. Tekerlek Dönüşleri
      const wheelSpin = (forwardSpeed / this.wheelRadius) * dt;
      this.wheels.forEach(w => {
        w.rotation += wheelSpin;
        w.tire.rotation.x = w.rotation;

        if (w.isFront) {
          w.group.rotation.y = this.steeringAngle;
        }
      });

      // 14. Ses & Duman
      this._updateAudio(dt);
      this._updateSmoke(dt);
    }

    // ------------------------------------------------------------ Otopilot / AI Waypoint Sürüşü
    _runAutopilot(dt) {
      if (!this.autopilotTarget) return;

      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      const toTarget = new THREE.Vector3(
        this.autopilotTarget.x - this.position.x,
        0,
        this.autopilotTarget.z - this.position.z
      );
      const dist = toTarget.length();

      toTarget.normalize();

      const fwdDot = fwd.dot(toTarget);
      const rightDot = right.dot(toTarget);

      // Gaz & Fren kontrolü
      if (dist > 15) {
        if (this.speedKmh < this.autopilotSpeed) {
          this.inputs.throttle = 1.0;
          this.inputs.brake = 0.0;
        } else {
          this.inputs.throttle = 0.2;
          this.inputs.brake = 0.0;
        }
      } else {
        // Hedefe yaklaşıldı
        this.inputs.throttle = 0.5;
      }

      // Direksiyon hedef yönü (sağ = +1, sol = -1)
      const steerError = rightDot;
      const targetAngle = THREE.MathUtils.clamp(steerError * 1.2, -this.maxSteerAngle, this.maxSteerAngle);
      this.steeringAngle += (targetAngle - this.steeringAngle) * Math.min(1.0, dt * 8.0);
    }
  }

  global.KartalVehicle = KartalVehicle;
})(window);
