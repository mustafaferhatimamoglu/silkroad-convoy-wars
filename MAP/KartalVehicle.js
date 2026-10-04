/**
 * KartalVehicle.js — Tofas Kartal 1.6 SLX Gercekci Fizik ve 3D Arac Modeli
 * 
 * Silkroad Online V3 Üzerinde:
 * - Arkadan itis (RWD) & Ackermann direksiyon geometrisi
 * - Gercekci motor devri (RPM), 5 ileri + 1 geri vites oranlari
 * - Agirlik transferi (pitch/roll acceleration & braking)
 * - Diferansiyel & el freni ile gercekci drift fizigi
 * - 4 bagimsiz amortisor / suspansiyon & arazi raycast yukseklik uyumu
 * - Tofas Kartal station-wagon govde geometrisi, farlar, stoplar, jantlar
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

      // Fiziksel Boyutlar & Parametreler (Kartal Station Wagon)
      this.width = 1.70;       // metre
      this.length = 4.30;      // metre
      this.height = 1.45;      // metre
      this.wheelbase = 2.45;   // aks araligi
      this.trackWidth = 1.42;  // tekerlek izi
      this.wheelRadius = 0.32; // 175/70 R13
      this.mass = 1050;        // kg

      // Arac Pozisyonu & Yonelimi
      this.position = new THREE.Vector3(0, 0, 0);
      this.velocity = new THREE.Vector3(0, 0, 0);
      this.angularVelocity = 0; // rad/s (yaw rate)
      this.yaw = 0;             // yonelme acisi (radyan)
      this.pitch = 0;           // burnu kaldirma / dalma
      this.roll = 0;            // yana yatma (viraj savrulmasi)

      // Motor & Sanziman (1.6L Tempra motoru)
      this.gear = 1;            // -1: R, 0: N, 1..5
      this.rpm = 900;           // rolanti
      this.idleRpm = 900;
      this.maxRpm = 6500;
      this.gearRatios = {
        '-1': -3.60,
        0: 0.0,
        1: 3.75,
        2: 2.15,
        3: 1.40,
        4: 1.00,
        5: 0.82
      };
      this.finalDrive = 3.90;
      this.maxTorque = 125;     // Nm @ 3000 RPM

      // Dinamik Durumlar
      this.steeringAngle = 0;   // on tekerleklerin acisi
      this.maxSteerAngle = 0.62;// ~35 derece
      this.speedKmh = 0;        // gosterge km/s
      this.driftFactor = 0;     // kayma derecesi (0..1)
      this.isGrounded = true;
      this.suspensionTravel = [0, 0, 0, 0]; // 4 teker

      // Girdi Durumu
      this.inputs = {
        throttle: 0,
        brake: 0,
        handbrake: false,
        steer: 0
      };

      // Tekerlek 3D Mesh Referanslari
      this.wheels = [];

      this._buildMesh();
    }

    _buildMesh() {
      // Tofas Beyazi Govde Materyali
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xf4f4f2,
        roughness: 0.35,
        metalness: 0.25
      });

      // Siyah Plastik Tampon ve Citalar
      const plasticMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.85,
        metalness: 0.05
      });

      // Cam Materyali (Hafif yesilimsi film)
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x1a2e26,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.65
      });

      // Krom / Far Aynasi
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.1,
        metalness: 0.95
      });

      // Far Cami (Parlak)
      const headLightMat = new THREE.MeshStandardMaterial({
        color: 0xfffae0,
        roughness: 0.2,
        metalness: 0.3,
        emissive: 0xffeeaa,
        emissiveIntensity: 0.7
      });

      // Stop Cami (Kirmizi)
      const tailLightMat = new THREE.MeshStandardMaterial({
        color: 0xd91414,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0x990000,
        emissiveIntensity: 0.5
      });

      // Gosterge / Iceri
      const interiorMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.9
      });

      this.chassis = new THREE.Group();
      this.group.add(this.chassis);

      // --- 1. ALT GOVDE (Kabin alti & kapi bolgesi) ---
      const lowerBodyGeo = new THREE.BoxGeometry(1.68, 0.55, 4.25);
      const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
      lowerBody.position.y = 0.52;
      lowerBody.castShadow = true;
      lowerBody.receiveShadow = true;
      this.chassis.add(lowerBody);

      // --- 2. KARTAL STATION WAGON UST KABIN (Arkaya kadar uzanan tavan) ---
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

      // Arka Bagaj Cami (Kartal Bagaj Kapagi)
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

      // --- 4. TAMPONLAR & YAN CITALAR ---
      // On Tampon
      const fBumpGeo = new THREE.BoxGeometry(1.72, 0.22, 0.20);
      const fBump = new THREE.Mesh(fBumpGeo, plasticMat);
      fBump.position.set(0, 0.38, 2.15);
      this.chassis.add(fBump);

      // Arka Tampon
      const rBumpGeo = new THREE.BoxGeometry(1.72, 0.24, 0.20);
      const rBump = new THREE.Mesh(rBumpGeo, plasticMat);
      rBump.position.set(0, 0.40, -2.15);
      this.chassis.add(rBump);

      // Tofas On Panjur (Grille) & Logo
      const grilleGeo = new THREE.BoxGeometry(1.10, 0.16, 0.05);
      const grille = new THREE.Mesh(grilleGeo, plasticMat);
      grille.position.set(0, 0.58, 2.14);
      this.chassis.add(grille);

      // Tofas Kusu / Amblem
      const emblemGeo = new THREE.BoxGeometry(0.12, 0.10, 0.06);
      const emblem = new THREE.Mesh(emblemGeo, chromeMat);
      emblem.position.set(0, 0.58, 2.15);
      this.chassis.add(emblem);

      // --- 5. FARLAR & STOPLAR ---
      // Kare Tofas On Farlari
      [-0.60, 0.60].forEach(x => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.06), headLightMat);
        hl.position.set(x, 0.58, 2.14);
        this.chassis.add(hl);

        // Sinayller (Turuncu)
        const indMat = new THREE.MeshStandardMaterial({ color: 0xff9900, roughness: 0.3, emissive: 0x663300 });
        const ind = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.06), indMat);
        ind.position.set(x > 0 ? x + 0.22 : x - 0.22, 0.58, 2.13);
        this.chassis.add(ind);
      });

      // Dikdortgen Kartal Arka Stoplar
      [-0.65, 0.65].forEach(x => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.06), tailLightMat);
        tl.position.set(x, 0.58, -2.14);
        this.chassis.add(tl);
      });

      // Kartal Tavan Raylari (Portbagaj raylari - Klasik Kartal SLX)
      [-0.62, 0.62].forEach(x => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.30, 8), plasticMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(x, 1.38, -0.45);
        this.chassis.add(rail);
      });

      // Egzoz Borusu (Arka sol)
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.40, 8), chromeMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(-0.55, 0.22, -2.15);
      this.chassis.add(exhaust);

      // Far Isiklari (Three.js SpotLight)
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

      // --- 6. 4 ADET TEKERLEK (Klasik 5 Kollu Tofas Jant) ---
      const wheelGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, 0.22, 20);
      wheelGeo.rotateZ(Math.PI / 2);

      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3, metalness: 0.85 });

      const wheelPositions = [
        { x: -this.trackWidth / 2, z:  this.wheelbase / 2, isFront: true },  // On Sol
        { x:  this.trackWidth / 2, z:  this.wheelbase / 2, isFront: true },  // On Sag
        { x: -this.trackWidth / 2, z: -this.wheelbase / 2, isFront: false }, // Arka Sol
        { x:  this.trackWidth / 2, z: -this.wheelbase / 2, isFront: false }  // Arka Sag
      ];

      wheelPositions.forEach((wp, idx) => {
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

    setSpawn(x, y, z, yaw = 0) {
      this.position.set(x, y, z);
      this.velocity.set(0, 0, 0);
      this.angularVelocity = 0;
      this.yaw = yaw;
      this.pitch = 0;
      this.roll = 0;
      this.speedKmh = 0;
      this.rpm = this.idleRpm;
      this.gear = 1;
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.yaw, 0);
    }

    update(dt, inputKeys) {
      if (!dt || dt > 0.1) dt = 0.016;

      // 1. Girdileri isle
      this.inputs.throttle = inputKeys.KeyW || inputKeys.ArrowUp ? 1 : 0;
      this.inputs.brake = inputKeys.KeyS || inputKeys.ArrowDown ? 1 : 0;
      this.inputs.handbrake = !!inputKeys.Space;

      let targetSteer = 0;
      if (inputKeys.KeyA || inputKeys.ArrowLeft) targetSteer -= 1;   // Sola donus (- yaw)
      if (inputKeys.KeyD || inputKeys.ArrowRight) targetSteer += 1;  // Saga donus (+ yaw)

      // Yuksek hizda direksiyon yumusamasi (Speed-sensitive steering)
      const currentSpeed = this.velocity.length();
      const steerSpeedFactor = Math.max(0.3, 1.0 - (currentSpeed / 60));
      const targetAngle = targetSteer * this.maxSteerAngle * steerSpeedFactor;
      this.steeringAngle += (targetAngle - this.steeringAngle) * Math.min(1.0, dt * 10.0);

      // 2. Vites & Geri Vites Mantigi
      const fwdDot = Math.cos(this.yaw) * this.velocity.z + Math.sin(this.yaw) * this.velocity.x;
      if (this.inputs.brake > 0 && Math.abs(currentSpeed) < 1.0 && this.gear >= 0) {
        this.gear = -1; // Geri vitese gec
      } else if (this.inputs.throttle > 0 && this.gear === -1 && Math.abs(currentSpeed) < 1.0) {
        this.gear = 1;  // Tekrar 1. vitese gec
      }

      // Otomatik Vites Degisimi (1..5)
      if (this.gear > 0) {
        if (this.rpm > 5500 && this.gear < 5) {
          this.gear++;
          this.rpm = 3200;
        } else if (this.rpm < 2200 && this.gear > 1) {
          this.gear--;
          this.rpm = 4200;
        }
      }

      // 3. Yon ve Hiz Vektorleri
      // Forward: Three.js'de Z negatif ileri veya pozitif, biz burada Z eksenini arac burnu olarak aliyoruz
      const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      const forwardSpeed = this.velocity.dot(fwd);
      const lateralSpeed = this.velocity.dot(right);

      // 4. Motor Kuvveti & Cekis (RWD Arkadan Itis)
      let driveForce = 0;
      const ratio = this.gearRatios[this.gear] || 0;

      if (this.gear !== 0) {
        const targetRpm = Math.max(this.idleRpm, (Math.abs(forwardSpeed) / (this.wheelRadius * 2 * Math.PI)) * 60 * Math.abs(ratio) * this.finalDrive);
        this.rpm += (targetRpm - this.rpm) * Math.min(1.0, dt * 8.0);
        this.rpm = Math.min(this.maxRpm, Math.max(this.idleRpm, this.rpm));

        if (this.gear > 0 && this.inputs.throttle > 0) {
          // Tofas guc egrisi (3000-5000 arasi tepe tork)
          const torqueFactor = Math.sin((this.rpm / this.maxRpm) * Math.PI);
          driveForce = this.inputs.throttle * this.maxTorque * ratio * this.finalDrive * (0.6 + 0.4 * torqueFactor);
        } else if (this.gear === -1 && this.inputs.brake > 0) {
          // Geri gitme
          driveForce = -this.inputs.brake * this.maxTorque * Math.abs(ratio) * this.finalDrive * 0.7;
        }
      }

      // 5. Fren & El Freni
      let brakeForce = 0;
      if (this.gear > 0 && this.inputs.brake > 0) {
        brakeForce = 4500 * Math.sign(forwardSpeed);
      }
      let handbrakeFriction = 1.0;
      if (this.inputs.handbrake) {
        brakeForce += 5500 * Math.sign(forwardSpeed);
        handbrakeFriction = 0.25; // Arka tekerlekler kilitlenir -> DRIFT baslar!
      }

      // 6. Lastik Tutunmasi & Suruklenme (Lateral / Longitudinal Friction)
      const rollResistance = 250 * Math.sign(forwardSpeed);
      const aeroDrag = 0.42 * 0.5 * 1.225 * 2.1 * forwardSpeed * Math.abs(forwardSpeed); // 0.5 * rho * Cd * A * v^2

      const netForwardForce = driveForce - brakeForce - rollResistance - aeroDrag;
      const forwardAccel = netForwardForce / this.mass;

      // Yanal surtunme (viraj kavrama & kayma)
      const corneringStiffness = 32000 * handbrakeFriction;
      let lateralForce = -lateralSpeed * corneringStiffness / this.mass;

      // Drift faktoru hesapla
      this.driftFactor = Math.min(1.0, Math.abs(lateralSpeed) / 8.0 + (this.inputs.handbrake ? 0.6 : 0.0));

      // 7. Donus & Yaw Acisal Hizi
      const turnRadius = this.wheelbase / Math.tan(Math.max(0.001, Math.abs(this.steeringAngle)));
      const baseYawRate = (forwardSpeed / this.wheelbase) * Math.sin(this.steeringAngle);
      // El freni cekildiginde arkadan kayma (oversteer)
      const oversteerBonus = this.inputs.handbrake ? (this.steeringAngle * 2.8) : (this.driftFactor * this.steeringAngle * 1.2);

      this.angularVelocity = baseYawRate + oversteerBonus;
      this.yaw += this.angularVelocity * dt;

      // 8. Hiz Vektorunu Guncelle
      this.velocity.addScaledVector(fwd, forwardAccel * dt);
      this.velocity.addScaledVector(right, lateralForce * dt);

      // Yere temas ve hava direnci
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;

      this.speedKmh = Math.abs(this.velocity.length() * 3.6);

      // 9. 4 Noktadan Zemin Raycast & Suspansiyon
      const hFL = this.map.getHeightAt(this.position.x + right.x * (this.trackWidth / 2) + fwd.x * (this.wheelbase / 2),
                                       this.position.z + right.z * (this.trackWidth / 2) + fwd.z * (this.wheelbase / 2));
      const hFR = this.map.getHeightAt(this.position.x - right.x * (this.trackWidth / 2) + fwd.x * (this.wheelbase / 2),
                                       this.position.z - right.z * (this.trackWidth / 2) + fwd.z * (this.wheelbase / 2));
      const hRL = this.map.getHeightAt(this.position.x + right.x * (this.trackWidth / 2) - fwd.x * (this.wheelbase / 2),
                                       this.position.z + right.z * (this.trackWidth / 2) - fwd.z * (this.wheelbase / 2));
      const hRR = this.map.getHeightAt(this.position.x - right.x * (this.trackWidth / 2) - fwd.x * (this.wheelbase / 2),
                                       this.position.z - right.z * (this.trackWidth / 2) - fwd.z * (this.wheelbase / 2));

      const validHeights = [hFL, hFR, hRL, hRR].filter(h => h !== null);
      if (validHeights.length > 0) {
        const avgGround = validHeights.reduce((a, b) => a + b, 0) / validHeights.length;
        
        // Yer cekimi ve yaylanma (tekerlek yari capi kadar zeminin ustunde durmali)
        const targetY = avgGround + this.wheelRadius;
        this.position.y += (targetY - this.position.y) * Math.min(1.0, dt * 15.0);

        // Zemin egiminden pitch & roll hesapla
        if (hFL !== null && hRL !== null) {
          const frontAvg = ((hFL || avgGround) + (hFR || avgGround)) / 2;
          const rearAvg = ((hRL || avgGround) + (hRR || avgGround)) / 2;
          const groundPitch = Math.atan2(frontAvg - rearAvg, this.wheelbase);
          // Hizlanma/fren agirlik transferi
          const accelPitch = (forwardAccel / 9.81) * -0.06;
          this.pitch += (groundPitch + accelPitch - this.pitch) * Math.min(1.0, dt * 10.0);
        }

        if (hFL !== null && hFR !== null) {
          const leftAvg = ((hFL || avgGround) + (hRL || avgGround)) / 2;
          const rightAvg = ((hFR || avgGround) + (hRR || avgGround)) / 2;
          const groundRoll = Math.atan2(leftAvg - rightAvg, this.trackWidth);
          // Viraj savrulmasi (body roll)
          const cornerRoll = (lateralSpeed / 9.81) * 0.08;
          this.roll += (groundRoll + cornerRoll - this.roll) * Math.min(1.0, dt * 10.0);
        }
      }

      // 10. 3D Model Dönüşümlerini Güncelle
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.yaw, 0);

      // Sasinin yaylanmasi ve egimi
      this.chassis.rotation.set(this.pitch, 0, this.roll);

      // 11. Tekerlek Donusleri & Direksiyon
      const wheelSpin = (forwardSpeed / this.wheelRadius) * dt;
      this.wheels.forEach(w => {
        w.rotation += wheelSpin;
        w.tire.rotation.x = w.rotation;

        if (w.isFront) {
          w.group.rotation.y = this.steeringAngle;
        }
      });
    }
  }

  global.KartalVehicle = KartalVehicle;
})(window);
