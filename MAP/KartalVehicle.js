/**
 * KartalVehicle.js — Tofaş Kartal 1.6 SLX Gerçekçi Fizik & GTA Tarzı Sürüş Motoru
 * 
 * Silkroad Online V3:
 * - Arkadan İtiş (RWD) & Doğru Ackermann Direksiyon Geometrisi (A: Sol, D: Sağ)
 * - GTA Tarzı Zıplama & Havada Kalma Fiziği (Air control & Suspension bounce)
 * - Obje & Sur Çarpışma Tepkisi (Bounce, Elastic Impact, Shake & Hasar Sistemi)
 * - Köprü ve Platform Raycast Desteği (Yükseltilmiş köprülerden geçebilme)
 * - Çift Tonlu Gerçekçi Motor Sesi + Çarpma Sesi + Mute Desteği
 * - Tofaş Kartal SLX Detaylı 3D Modeli, Farlar, Stoplar, Egzoz Dumanı
 */
(function (global) {
  'use strict';

  class KartalVehicle {
    constructor(scene, map) {
      this.scene = scene;
      this.map = map;

      // 3D Model Grubu
      this.group = new THREE.Group();
      this.group.name = 'Tofas_Kartal_SLX';
      this.scene.add(this.group);

      // Boyutlar (Kartal Station Wagon)
      this.width = 1.70;       // metre
      this.length = 4.30;      // metre
      this.height = 1.45;      // metre
      this.wheelbase = 2.45;   // aks mesafesi
      this.trackWidth = 1.42;  // teker izi
      this.wheelRadius = 0.32; // teker yaricapi
      this.mass = 1050;        // kg

      // Konum, Hiz & Yonelim
      this.position = new THREE.Vector3(0, 0, 0);
      this.velocity = new THREE.Vector3(0, 0, 0);
      this.verticalVelocity = 0; // m/s (ziplama ve dusme)
      this.angularVelocity = 0;  // rad/s
      this.yaw = 0;              // radyan
      this.pitch = 0;            // burun kalkma / dalma
      this.roll = 0;             // yana yatma (body roll)

      // Motor & Sanziman
      this.gear = 1;             // -1: R, 0: N, 1..5
      this.rpm = 900;
      this.idleRpm = 900;
      this.maxRpm = 6500;
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
      this.maxTorque = 130;      // Nm

      // Dinamik Durumlar
      this.steeringAngle = 0;    // on tekerlek acisi
      this.maxSteerAngle = 0.60; // radyan (~34 derece)
      this.speedKmh = 0;
      this.driftFactor = 0;
      this.isGrounded = true;
      this.airTime = 0;

      // Hasar & Saglik Sistemi (GTA Tarzi)
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

      // Raycaster (Zemin ve Kopruler icin)
      this.raycaster = new THREE.Raycaster();
      this.downVector = new THREE.Vector3(0, -1, 0);

      // Ses Sistemi (Web Audio)
      this.soundEnabled = true;
      this._initAudio();

      // Tekerlekler & Duman Parcaciklari
      this.wheels = [];
      this.smokeParticles = [];

      this._buildMesh();
      this._buildSmokeSystem();
    }

    _buildMesh() {
      // Beyaz Govde Materyali
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xf5f5f3,
        roughness: 0.32,
        metalness: 0.22
      });

      // Siyah Plastik Tampon ve Yan Citalar
      const plasticMat = new THREE.MeshStandardMaterial({
        color: 0x1f1f1f,
        roughness: 0.88,
        metalness: 0.05
      });

      // Filmli Camlar
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x14201a,
        roughness: 0.1,
        metalness: 0.85,
        transparent: true,
        opacity: 0.70
      });

      // Krom Detaylar
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.15,
        metalness: 0.95
      });

      // Farlar & Stoplar
      const headLightMat = new THREE.MeshStandardMaterial({
        color: 0xfffae6,
        roughness: 0.2,
        metalness: 0.3,
        emissive: 0xffea9f,
        emissiveIntensity: 0.85
      });
      const tailLightMat = new THREE.MeshStandardMaterial({
        color: 0xd91414,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0xaa0000,
        emissiveIntensity: 0.6
      });

      this.chassis = new THREE.Group();
      this.chassis.name = 'Chassis';
      this.group.add(this.chassis);

      // --- 1. ALT GOVDE (Kabin alti & kapi bolgesi) ---
      const lowerBodyGeo = new THREE.BoxGeometry(1.68, 0.55, 4.25);
      const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
      lowerBody.position.y = 0.52;
      lowerBody.castShadow = true;
      lowerBody.receiveShadow = true;
      this.chassis.add(lowerBody);

      // --- 2. KARTAL STATION WAGON UST KABIN ---
      const cabinGeo = new THREE.BoxGeometry(1.50, 0.60, 2.70);
      const cabin = new THREE.Mesh(cabinGeo, bodyMat);
      cabin.position.set(0, 1.05, -0.45);
      cabin.castShadow = true;
      this.chassis.add(cabin);

      // --- 3. CAMLAR ---
      // On Cam
      const winFrontGeo = new THREE.BoxGeometry(1.44, 0.48, 0.08);
      const winFront = new THREE.Mesh(winFrontGeo, glassMat);
      winFront.position.set(0, 1.02, 0.88);
      winFront.rotation.x = -0.38;
      this.chassis.add(winFront);

      // Arka Bagaj Cami
      const winRearGeo = new THREE.BoxGeometry(1.42, 0.50, 0.06);
      const winRear = new THREE.Mesh(winRearGeo, glassMat);
      winRear.position.set(0, 1.04, -1.78);
      winRear.rotation.x = 0.15;
      this.chassis.add(winRear);

      // Yan Camlar
      const winSideGeo = new THREE.BoxGeometry(1.52, 0.45, 2.45);
      const winSide = new THREE.Mesh(winSideGeo, glassMat);
      winSide.position.set(0, 1.05, -0.45);
      this.chassis.add(winSide);

      // --- 4. TAMPONLAR & IZGARA ---
      // On Tampon
      this.frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.22, 0.20), plasticMat);
      this.frontBumper.position.set(0, 0.38, 2.15);
      this.chassis.add(this.frontBumper);

      // Arka Tampon
      this.rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.24, 0.20), plasticMat);
      this.rearBumper.position.set(0, 0.40, -2.15);
      this.chassis.add(this.rearBumper);

      // Tofas On Panjur & Logo
      const grille = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.16, 0.05), plasticMat);
      grille.position.set(0, 0.58, 2.14);
      this.chassis.add(grille);

      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.06), chromeMat);
      emblem.position.set(0, 0.58, 2.15);
      this.chassis.add(emblem);

      // --- 5. AYDINLATMA & DETAYLAR ---
      // On Farlar
      [-0.60, 0.60].forEach(x => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.06), headLightMat);
        hl.position.set(x, 0.58, 2.14);
        this.chassis.add(hl);

        const ind = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.06), new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0x663300 }));
        ind.position.set(x > 0 ? x + 0.22 : x - 0.22, 0.58, 2.13);
        this.chassis.add(ind);
      });

      // Arka Stoplar
      [-0.65, 0.65].forEach(x => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.06), tailLightMat);
        tl.position.set(x, 0.58, -2.14);
        this.chassis.add(tl);
      });

      // Kartal Portbagaj Tavan Raylari
      [-0.62, 0.62].forEach(x => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.30, 8), plasticMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(x, 1.38, -0.45);
        this.chassis.add(rail);
      });

      // Egzoz Borusu
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.40, 8), chromeMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(-0.55, 0.22, -2.15);
      this.chassis.add(exhaust);

      // Spot Farlar (Gorus Isigi)
      this.leftHeadlight = new THREE.SpotLight(0xfffae0, 2.5, 90, Math.PI / 5, 0.4);
      this.leftHeadlight.position.set(-0.60, 0.60, 2.20);
      this.chassis.add(this.leftHeadlight);
      this.leftHeadlight.target.position.set(-0.60, 0.0, 30.0);
      this.chassis.add(this.leftHeadlight.target);

      this.rightHeadlight = new THREE.SpotLight(0xfffae0, 2.5, 90, Math.PI / 5, 0.4);
      this.rightHeadlight.position.set(0.60, 0.60, 2.20);
      this.chassis.add(this.rightHeadlight);
      this.rightHeadlight.target.position.set(0.60, 0.0, 30.0);
      this.chassis.add(this.rightHeadlight.target);

      // --- 6. 4 ADET TEKERLEK ---
      const wheelGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, 0.22, 20);
      wheelGeo.rotateZ(Math.PI / 2);

      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3, metalness: 0.85 });

      const wheelPositions = [
        { x: -this.trackWidth / 2, z:  this.wheelbase / 2, isFront: true },  // On Sol
        { x:  this.trackWidth / 2, z:  this.wheelbase / 2, isFront: true },  // On Sag
        { x: -this.trackWidth / 2, z: -this.wheelbase / 2, isFront: false }, // Arka Sol
        { x:  this.trackWidth / 2, z: -this.wheelbase / 2, isFront: false }  // Arka Sag
      ];

      wheelPositions.forEach((wp) => {
        const wGroup = new THREE.Group();
        wGroup.position.set(wp.x, this.wheelRadius, wp.z);

        const tire = new THREE.Mesh(wheelGeo, tireMat);
        tire.castShadow = true;
        wGroup.add(tire);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(this.wheelRadius * 0.68, this.wheelRadius * 0.68, 0.23, 16), rimMat);
        rim.rotateZ(Math.PI / 2);
        wGroup.add(rim);

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
      // Egzoz ve Hasar Duman Partikulleri
      const smokeGeo = new THREE.SphereGeometry(0.12, 6, 6);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.4
      });

      this.smokeGroup = new THREE.Group();
      this.scene.add(this.smokeGroup);

      for (let i = 0; i < 20; i++) {
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
      p.scale.setScalar(isDamage ? 1.5 : 0.8);
      p.material.color.setHex(isDamage ? 0x111111 : 0x666666);
      p.material.opacity = isDamage ? 0.6 : 0.35;
      p.userData.life = 0;
      p.userData.maxLife = isDamage ? 1.4 : 0.8;
      p.userData.velocity.set(
        dir.x + (Math.random() - 0.5) * 1.5,
        dir.y + Math.random() * 2.0 + 1.0,
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
          p.scale.multiplyScalar(1.0 + dt * 1.5);
          p.material.opacity = Math.max(0, p.material.opacity - dt * 0.4);
        }
      });
    }

    // ------------------------------------------------------------ Web Audio Motor & Carpma Sesi
    _initAudio() {
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) return;
        this.audioCtx = new AudioClass();

        // 1. Tok Bas Tonu (Low rumble - Tempra sub-bass)
        this.bassOsc = this.audioCtx.createOscillator();
        this.bassOsc.type = 'triangle';

        // 2. Mekanik Devir Tonu (Harmonics)
        this.engineOsc = this.audioCtx.createOscillator();
        this.engineOsc.type = 'sawtooth';

        // 3. Low-Pass Filtre (Kulak tirmalamayan tok tork sesi)
        this.filter = this.audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 320;
        this.filter.Q.value = 2.0;

        // 4. Ses Seviyesi Kontrolu
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = 0.035; // Rahatsiz etmeyen tatli seviye

        this.bassGain = this.audioCtx.createGain();
        this.bassGain.gain.value = 0.7;

        this.engineGain = this.audioCtx.createGain();
        this.engineGain.gain.value = 0.3;

        this.bassOsc.connect(this.bassGain);
        this.engineOsc.connect(this.engineGain);

        this.bassGain.connect(this.filter);
        this.engineGain.connect(this.filter);
        this.filter.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);

        this.bassOsc.start();
        this.engineOsc.start();
      } catch (e) {
        console.warn('Audio init error:', e);
      }
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

      // Devire gore frekans (Rolanti 35Hz, 6500 RPM 190Hz)
      const baseFreq = 28 + (this.rpm / 6500) * 165;
      const throttleBonus = this.inputs.throttle ? 1.15 : 0.95;
      const now = this.audioCtx.currentTime;

      this.bassOsc.frequency.setTargetAtTime(baseFreq * 0.75, now, 0.04);
      this.engineOsc.frequency.setTargetAtTime(baseFreq * throttleBonus, now, 0.04);

      // Gaz verildiğinde filtrenin açılması (tok egzoz sesi)
      const filterCutoff = 220 + (this.rpm / 6500) * 550 + (this.inputs.throttle ? 300 : 0);
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

    // ------------------------------------------------------------ Zemin & Kopru Tespiti
    getSurfaceHeightAt(x, z, referenceY) {
      // 1. Dogal Arazi Yuksekligi (.bin verisi)
      let terrainH = this.map.getHeightAt(x, z);
      if (terrainH === null) terrainH = -100;

      // 2. Sahnedeki 3D Obje / Kopru / Mermer Platform Raycast
      // Yukaridan asagiya dikey isin atarak kopru ve binalarin ustune cikilmasini sagla
      const startY = (referenceY !== undefined && referenceY > terrainH) ? referenceY + 4.0 : terrainH + 12.0;
      this.raycaster.set(new THREE.Vector3(x, startY, z), this.downVector);
      this.raycaster.far = 40.0;

      let highestSurface = terrainH;

      // Map group altindaki tum nesneleri tara
      if (this.map && this.map.group) {
        const hits = this.raycaster.intersectObjects(this.map.group.children, true);
        for (const hit of hits) {
          // Kendi aracimiz ve zemin mesh'i disindaki katı kopru/bina yuzeyleri
          if (hit.object !== this.group && !hit.object.name.startsWith('terrain_') && !hit.object.name.startsWith('water_')) {
            if (hit.point.y > highestSurface) {
              highestSurface = hit.point.y;
            }
          }
        }
      }

      return highestSurface;
    }

    // ------------------------------------------------------------ Duvar & Engel Carpisma Tespiti
    checkObstacleCollisions() {
      if (!this.map || !this.map.group) return;

      const currentSpeed = this.velocity.length();
      if (currentSpeed < 0.5) return;

      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      // Arac tampon ve kose kontrol noktalari
      const checkPoints = [
        { pos: this.position.clone().addScaledVector(fwd, 2.2), isFront: true },  // On Tampon Merkez
        { pos: this.position.clone().addScaledVector(fwd, 2.1).addScaledVector(right, 0.8), isFront: true },  // On Sag Kose
        { pos: this.position.clone().addScaledVector(fwd, 2.1).addScaledVector(right, -0.8), isFront: true }, // On Sol Kose
        { pos: this.position.clone().addScaledVector(fwd, -2.2), isFront: false } // Arka Tampon
      ];

      // Yakindaki 3D modelleri tara
      for (const cp of checkPoints) {
        this.raycaster.set(cp.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), cp.isFront ? fwd : fwd.clone().negate());
        this.raycaster.far = 0.8;

        const hits = this.raycaster.intersectObjects(this.map.group.children, true);
        for (const hit of hits) {
          // Sutun, duvar, sur kapisi, kaya veya bina engeli
          if (hit.object !== this.group && !hit.object.name.startsWith('terrain_') && !hit.object.name.startsWith('water_')) {
            // Yuzeyin dikey olmasi (duvar) gerekiyor
            if (Math.abs(hit.face.normal.y) < 0.6) {
              this._resolveCollision(hit, currentSpeed);
              return;
            }
          }
        }
      }
    }

    _resolveCollision(hit, impactSpeed) {
      // 1. Carpma Tepkisi (Geri Sekme / Elastic Rebound)
      const normal = hit.face.normal.clone().normalize();
      
      // Hizi duvardan yansit ve enerjisini em
      this.velocity.reflect(normal).multiplyScalar(0.35);
      this.position.addScaledVector(normal, 0.45); // Duvarin icinden cikar

      // 2. Hasar ve Sarsinti
      const damage = Math.round(impactSpeed * 1.5);
      this.health = Math.max(0, this.health - damage);
      this.lastImpactSpeed = impactSpeed;
      this.cameraShakeIntensity = Math.min(1.2, impactSpeed / 15.0);

      // Gövde Sarsintisi (Pitch/Roll darbesi)
      this.pitch += (Math.random() - 0.5) * 0.25;
      this.roll += (Math.random() - 0.5) * 0.35;

      // 3. Carpma Sesi & Dumani
      this.playCrashSound(impactSpeed / 10.0);
      this._emitSmoke(hit.point, normal, true);

      // Kaput deformasyonu (Cok hizli carpmada on tampon hafif yamulur)
      if (impactSpeed > 20 && this.frontBumper) {
        this.frontBumper.rotation.z = (Math.random() - 0.5) * 0.15;
      }
    }

    // ------------------------------------------------------------ Spawn / Reset
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
    }

    // ------------------------------------------------------------ Ana Fizik Guncellemesi
    update(dt, inputKeys) {
      if (!dt || dt > 0.1) dt = 0.016;

      // 1. Girdileri Oku
      this.inputs.throttle = inputKeys.KeyW || inputKeys.ArrowUp ? 1 : 0;
      this.inputs.brake = inputKeys.KeyS || inputKeys.ArrowDown ? 1 : 0;
      this.inputs.handbrake = !!inputKeys.Space;

      // Direksiyon: A = SOL (-1), D = SAĞ (+1)
      let steerInput = 0;
      if (inputKeys.KeyA || inputKeys.ArrowLeft) steerInput -= 1.0;  // SOL
      if (inputKeys.KeyD || inputKeys.ArrowRight) steerInput += 1.0; // SAĞ

      // Hiza duyarli direksiyon yumusamasi (Speed-sensitive steering)
      const currentSpeed = this.velocity.length();
      const steerSpeedFactor = Math.max(0.28, 1.0 - (currentSpeed / 65));
      const targetAngle = steerInput * this.maxSteerAngle * steerSpeedFactor;
      this.steeringAngle += (targetAngle - this.steeringAngle) * Math.min(1.0, dt * 10.0);

      // 2. Vites & Geri Vites Mantigi
      if (this.inputs.brake > 0 && currentSpeed < 0.8 && this.gear >= 0) {
        this.gear = -1; // Geri vites
      } else if (this.inputs.throttle > 0 && currentSpeed < 0.8 && this.gear === -1) {
        this.gear = 1;  // 1. Vites
      }

      // Otomatik vites gecisleri (1..5)
      if (this.gear > 0) {
        if (this.rpm > 5400 && this.gear < 5) {
          this.gear++;
          this.rpm = 3100;
        } else if (this.rpm < 2100 && this.gear > 1) {
          this.gear--;
          this.rpm = 4100;
        }
      }

      // 3. Yon Vektorleri (Silkroad / Three.js Uyumlu)
      // Model burnu yerel +Z yonundedir.
      // rotation.y = yaw uygulandiginda burnun dunya vektorleri:
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      const forwardSpeed = this.velocity.dot(fwd);
      const lateralSpeed = this.velocity.dot(right);

      // 4. Motor Kuvveti & Tork (Arkadan Itis - RWD)
      let driveForce = 0;
      const ratio = this.gearRatios[this.gear] || 0;

      if (this.gear !== 0) {
        const targetRpm = Math.max(this.idleRpm, (Math.abs(forwardSpeed) / (this.wheelRadius * 2 * Math.PI)) * 60 * Math.abs(ratio) * this.finalDrive);
        this.rpm += (targetRpm - this.rpm) * Math.min(1.0, dt * 8.0);
        this.rpm = Math.min(this.maxRpm, Math.max(this.idleRpm, this.rpm));

        if (this.isGrounded) {
          if (this.gear > 0 && this.inputs.throttle > 0) {
            // Tofas SLX tork egrisi
            const torqueFactor = Math.sin((this.rpm / this.maxRpm) * Math.PI);
            driveForce = this.inputs.throttle * this.maxTorque * ratio * this.finalDrive * (0.65 + 0.35 * torqueFactor);
          } else if (this.gear === -1 && this.inputs.brake > 0) {
            // Geri vites cekisi
            driveForce = -this.inputs.brake * this.maxTorque * Math.abs(ratio) * this.finalDrive * 0.75;
          }
        }
      }

      // 5. Fren & El Freni (Drift)
      let brakeForce = 0;
      if (this.gear > 0 && this.inputs.brake > 0 && this.isGrounded) {
        brakeForce = 4600 * Math.sign(forwardSpeed);
      }
      let handbrakeFriction = 1.0;
      if (this.inputs.handbrake && this.isGrounded) {
        brakeForce += 5200 * Math.sign(forwardSpeed);
        handbrakeFriction = 0.28; // Arka lastikler kilitlenir -> DRIFT!
      }

      // 6. Yuvarlanma Direnci & Hava Direnci (Aero Drag)
      const rollResistance = this.isGrounded ? (240 * Math.sign(forwardSpeed)) : 10;
      const aeroDrag = 0.42 * 0.5 * 1.225 * 2.1 * forwardSpeed * Math.abs(forwardSpeed);

      const netForwardForce = driveForce - brakeForce - rollResistance - aeroDrag;
      const forwardAccel = netForwardForce / this.mass;

      // Yanal Yol Tutus (Lateral Grip)
      const corneringStiffness = 32000 * handbrakeFriction;
      let lateralForce = this.isGrounded ? (-lateralSpeed * corneringStiffness / this.mass) : (-lateralSpeed * 0.2);

      // Drift faktoru
      this.driftFactor = Math.min(1.0, Math.abs(lateralSpeed) / 7.5 + (this.inputs.handbrake ? 0.6 : 0.0));

      // Egzoz Dumani
      if (this.inputs.throttle > 0 && Math.random() < 0.3) {
        const exhaustPos = this.position.clone().addScaledVector(fwd, -2.15).addScaledVector(right, -0.55).add(new THREE.Vector3(0, 0.25, 0));
        this._emitSmoke(exhaustPos, fwd.clone().negate().multiplyScalar(2.0), this.health < 40);
      }

      // 7. Donus & Direksiyon Donus Hizi (Yaw Rate)
      // Direksiyon saga (D) kirildiginda: steeringAngle > 0 -> burnun saga donmesi icin yaw pozitif artar
      // Direksiyon sola (A) kirildiginda: steeringAngle < 0 -> burnun sola donmesi icin yaw negatif azalir
      const baseYawRate = (forwardSpeed / this.wheelbase) * Math.sin(this.steeringAngle);
      const oversteerBonus = this.inputs.handbrake ? (this.steeringAngle * 2.6) : (this.driftFactor * this.steeringAngle * 1.2);

      this.angularVelocity = baseYawRate + oversteerBonus;
      if (this.isGrounded) {
        this.yaw += this.angularVelocity * dt;
      } else {
        // Havada iken hafif gyroscopic yaw
        this.yaw += this.angularVelocity * 0.4 * dt;
      }

      // 8. Hiz Vektorunu Guncelle
      this.velocity.addScaledVector(fwd, forwardAccel * dt);
      this.velocity.addScaledVector(right, lateralForce * dt);

      // Pozisyon Yatay Hareket
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;

      this.speedKmh = Math.abs(this.velocity.length() * 3.6);

      // 9. GTA Tarzi Ziplama, Dusme ve Suspansiyon (Vertical Physics)
      const groundH = this.getSurfaceHeightAt(this.position.x, this.position.z, this.position.y);
      const targetY = groundH + this.wheelRadius;

      const gravity = -24.0; // m/s^2 sert yercekimi
      this.verticalVelocity += gravity * dt;
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= targetY) {
        // Zemine temas etti (Landing / Grounded)
        const impactY = Math.abs(this.verticalVelocity);
        if (!this.isGrounded && impactY > 8.0) {
          // Sert inis (GTA Suspansiyon sekmesi)
          this.cameraShakeIntensity = Math.min(1.0, impactY / 20.0);
          this.playCrashSound(impactY / 15.0);
        }

        this.position.y = targetY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
        this.airTime = 0;
      } else {
        // Arac havada! (Ziplama / Rampadan ucma)
        this.isGrounded = false;
        this.airTime += dt;
      }

      // Rampadan firlama (Arazide yuksek hizla tepeye cikarken firlasin)
      if (this.isGrounded && forwardSpeed > 15.0) {
        // Onumuzdeki 2 metrenin yukseklik farki
        const aheadH = this.getSurfaceHeightAt(this.position.x + fwd.x * 2.5, this.position.z + fwd.z * 2.5, this.position.y);
        const rampSlope = (aheadH - groundH) / 2.5;
        if (rampSlope > 0.35) {
          // Rampa yukari firlama kuvveti
          this.verticalVelocity = forwardSpeed * rampSlope * 0.65;
          this.isGrounded = false;
        }
      }

      // 10. Agirlik Transferi & Egim (Pitch & Roll)
      if (this.isGrounded) {
        const hFront = this.getSurfaceHeightAt(this.position.x + fwd.x * 1.5, this.position.z + fwd.z * 1.5, this.position.y);
        const hRear = this.getSurfaceHeightAt(this.position.x - fwd.x * 1.5, this.position.z - fwd.z * 1.5, this.position.y);
        const groundPitch = Math.atan2(hFront - hRear, 3.0);
        const accelPitch = (forwardAccel / 9.81) * -0.06;
        this.pitch += (groundPitch + accelPitch - this.pitch) * Math.min(1.0, dt * 12.0);

        const hRight = this.getSurfaceHeightAt(this.position.x + right.x * 1.0, this.position.z + right.z * 1.0, this.position.y);
        const hLeft = this.getSurfaceHeightAt(this.position.x - right.x * 1.0, this.position.z - right.z * 1.0, this.position.y);
        const groundRoll = Math.atan2(hRight - hLeft, 2.0);
        const cornerRoll = (lateralSpeed / 9.81) * 0.08;
        this.roll += (groundRoll + cornerRoll - this.roll) * Math.min(1.0, dt * 12.0);
      } else {
        // Havada iken burnun asagi dogru egilmesi (GTA air pitch)
        this.pitch += (-0.2 - this.pitch) * dt * 2.0;
        this.roll *= (1.0 - dt * 2.0);
      }

      // 11. Engel & Duvar Carpisma Kontrolu
      this.checkObstacleCollisions();

      // Kamera sarsintisini sonumle
      if (this.cameraShakeIntensity > 0) {
        this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 2.5);
      }

      // 12. 3D Model Matrislerini Guncelle
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.yaw, 0);
      this.chassis.rotation.set(this.pitch, 0, this.roll);

      // 13. Tekerlek Donusleri & Direksiyon Acisi
      const wheelSpin = (forwardSpeed / this.wheelRadius) * dt;
      this.wheels.forEach(w => {
        w.rotation += wheelSpin;
        w.tire.rotation.x = w.rotation;

        if (w.isFront) {
          // On tekerlekler donus yonune kirilsin
          w.group.rotation.y = this.steeringAngle;
        }
      });

      // 14. Ses & Partikul Guncelle
      this._updateAudio(dt);
      this._updateSmoke(dt);
    }
  }

  global.KartalVehicle = KartalVehicle;
})(window);
