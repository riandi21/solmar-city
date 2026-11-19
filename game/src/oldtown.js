import * as THREE from 'three';

// Old Town: the historic quarter around (-203, -87) and (-203, -29), with a
// cobbled plaza, a fountain, market stalls and old stone buildings, plus the
// lighthouse at (-270, 300) on the south-west beach with a rotating beam.
export function createOldTown(world) {
  const scene = world.scene;
  const group = new THREE.Group();
  group.name = 'old-town';
  scene.add(group);

  const colliders = [];
  function addCollider(x, z, hx, hz) {
    const box = { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
    colliders.push(box);
    if (world.city && Array.isArray(world.city.colliders)) {
      world.city.colliders.push(box);
    }
  }

  function box(w, h, d, color, x, y, z, parent) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02 })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (parent || group).add(mesh);
    return mesh;
  }

  function roofPrism(w, h, d, color, x, y, z) {
    // A triangular prism roof made from a 4-sided cylinder turned on its side.
    const geo = new THREE.CylinderGeometry(0.01, Math.max(w, d) * 0.72, h, 4, 1);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
    );
    mesh.rotation.y = Math.PI / 4;
    mesh.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    (group).add(mesh);
    return mesh;
  }

  // --- cobbled plaza ground between the two Old Town blocks
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(34, 28),
    new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 1 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(-203, 0.06, -58);
  plaza.receiveShadow = true;
  group.add(plaza);

  // Plaza ring of pale paving stones.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(26, 34, 28),
    new THREE.MeshStandardMaterial({ color: 0xb5a98d, roughness: 1 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-203, 0.07, -58);
  ring.receiveShadow = true;
  group.add(ring);

  // --- fountain at the plaza centre: basin, pillar, water disc, spray
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(6.5, 7, 1.4, 20),
    new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 0.85 })
  );
  basin.position.set(-203, 0.7, -58);
  basin.castShadow = true;
  group.add(basin);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3f8fbf, roughness: 0.15, metalness: 0.1,
    transparent: true, opacity: 0.85,
  });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 0.4, 20), waterMat);
  water.position.set(-203, 1.35, -58);
  group.add(water);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.1, 3.4, 10),
    new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 0.8 })
  );
  pillar.position.set(-203, 2.6, -58);
  pillar.castShadow = true;
  group.add(pillar);
  const spray = new THREE.Points(
    (() => {
      const n = 60;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 2.2;
        pos[i * 3] = -203 + Math.cos(a) * r;
        pos[i * 3 + 1] = 4.2 + Math.random() * 1.6;
        pos[i * 3 + 2] = -58 + Math.sin(a) * r;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return g;
    })(),
    new THREE.PointsMaterial({ color: 0xcfe8ff, size: 0.5, transparent: true, opacity: 0.8 })
  );
  group.add(spray);
  addCollider(-203, -58, 7.5, 7.5);

  // --- statue of the city's founder, facing the fountain
  const statueBase = box(3, 1.2, 3, 0x7d7466, -203, 0.6, -34);
  const statue = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.9, 4.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x5f7a68, roughness: 0.6, metalness: 0.4 })
  );
  statue.position.set(-203, 3.4, -34);
  statue.castShadow = true;
  group.add(statue);
  addCollider(-203, -34, 2, 2);

  // --- old stone buildings around the two blocks
  const stoneColors = [0xc9b18c, 0xbfae90, 0xd6c39a, 0xa8906c, 0xc2a878];
  const roofColors = [0x8a4a34, 0x6e3f2e, 0x94522f, 0x7a4433];
  const spots = [
    // block around (-203, -87)
    { x: -232, z: -108, w: 18, d: 14, h: 12 },
    { x: -203, z: -112, w: 20, d: 12, h: 16 },
    { x: -176, z: -108, w: 16, d: 14, h: 10 },
    { x: -232, z: -66, w: 16, d: 12, h: 14 },
    { x: -176, z: -64, w: 18, d: 14, h: 11 },
    // block around (-203, -29)
    { x: -232, z: -48, w: 18, d: 14, h: 13 },
    { x: -203, z: -52, w: 20, d: 12, h: 9 },
    { x: -176, z: -48, w: 16, d: 14, h: 15 },
    { x: -232, z: -8, w: 16, d: 12, h: 10 },
    { x: -203, z: -6, w: 20, d: 12, h: 17 },
    { x: -176, z: -8, w: 18, d: 14, h: 12 },
  ];
  const windowsMat = new THREE.MeshStandardMaterial({
    color: 0x2c3844, roughness: 0.3, metalness: 0.3,
    emissive: 0xffc46b, emissiveIntensity: 0,
  });
  const windowMeshes = [];
  spots.forEach((s, i) => {
    const stone = stoneColors[i % stoneColors.length];
    box(s.w, s.h, s.d, stone, s.x, s.h / 2, s.z);
    roofPrism(s.w + 1.5, 3.2, s.d + 1.5, roofColors[i % roofColors.length], s.x, s.h + 1.6, s.z);
    // Shuttered windows on the plaza-facing side.
    const rows = Math.max(1, Math.floor(s.h / 5));
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c <= 1; c++) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 2.2, 0.25),
          windowsMat
        );
        win.position.set(s.x + c * (s.w / 3.4), 3.4 + r * 4.6, s.z + s.d / 2 + 0.12);
        group.add(win);
        windowMeshes.push(win);
      }
    }
    // Awning over the ground-floor shopfront on some buildings.
    if (i % 3 === 0) {
      const awn = box(s.w * 0.6, 0.3, 3.2, 0x7a2e2e, s.x, 3.6, s.z + s.d / 2 + 1.4);
      awn.rotation.x = 0.18;
    }
    addCollider(s.x, s.z, s.w / 2 + 0.5, s.d / 2 + 0.5);
  });

  // --- chapel with a bell tower, anchoring the plaza's north side
  box(12, 9, 16, 0xd6c39a, -203, 4.5, -86);
  roofPrism(13.5, 3, 17.5, 0x6e3f2e, -203, 10.5, -86);
  const bellTower = box(4.5, 20, 4.5, 0xc9b18c, -194, 10, -86);
  roofPrism(5.5, 2.6, 5.5, 0x6e3f2e, -194, 21.3, -86);
  const bell = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1.3, 1.6, 10),
    new THREE.MeshStandardMaterial({ color: 0xc8a03c, roughness: 0.35, metalness: 0.8 })
  );
  bell.position.set(-194, 17.5, -86);
  group.add(bell);
  addCollider(-203, -86, 6.5, 8.5);
  addCollider(-194, -86, 2.8, 2.8);

  // --- market stalls on the plaza edge
  const stallColors = [0xc94f3d, 0x3d7ac9, 0x4fae5f, 0xd8a03c];
  for (let i = 0; i < 4; i++) {
    const sx = -226 + i * 15;
    const sz = -78;
    box(5, 2.4, 4, 0x8a6a4a, sx, 1.2, sz);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(4.4, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: stallColors[i], roughness: 0.9 })
    );
    canopy.position.set(sx, 3.6, sz);
    canopy.rotation.y = Math.PI / 4;
    canopy.castShadow = true;
    group.add(canopy);
    // Crates of fruit on the counter.
    box(1.2, 0.8, 1.2, 0xe07830, sx - 1.2, 2.8, sz);
    box(1.2, 0.8, 1.2, 0x7ac94f, sx + 1.2, 2.8, sz);
    addCollider(sx, sz, 3, 2.6);
  }

  // --- benches and old iron lamps around the plaza
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const bx = -203 + Math.cos(a) * 20;
    const bz = -58 + Math.sin(a) * 20;
    box(3.2, 0.5, 1.1, 0x6b4a2f, bx, 0.55, bz);
    box(0.3, 0.6, 1.1, 0x3a3a3a, bx - 1.3, 0.3, bz);
    box(0.3, 0.6, 1.1, 0x3a3a3a, bx + 1.3, 0.3, bz);
  }

  // ================= Lighthouse at (-270, 300) =================
  const lightGroup = new THREE.Group();
  lightGroup.name = 'lighthouse';
  lightGroup.position.set(-270, 0, 300);
  scene.add(lightGroup);

  const towerMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.8 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, 34, 16), towerMat);
  tower.position.y = 17;
  tower.castShadow = true;
  lightGroup.add(tower);
  // Red bands around the tower.
  for (const y of [9, 19, 29]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(4.55, 4.85, 3.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.8 })
    );
    band.position.y = y;
    lightGroup.add(band);
  }
  // Gallery deck and lamp room.
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 5, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 })
  );
  deck.position.y = 34.6;
  lightGroup.add(deck);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 4.4, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffe9a8, roughness: 0.2, metalness: 0.1,
      emissive: 0xffd76a, emissiveIntensity: 1.4, transparent: true, opacity: 0.92,
    })
  );
  lampRoom.position.y = 37.4;
  lightGroup.add(lampRoom);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(4, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.6 })
  );
  cap.position.y = 41;
  lightGroup.add(cap);
  addCollider(-270, 300, 6.5, 6.5);

  // Rotating beam: a long translucent cone plus a real spotlight.
  const beamPivot = new THREE.Group();
  beamPivot.position.set(-270, 37.4, 300);
  scene.add(beamPivot);
  const beamGeo = new THREE.ConeGeometry(7, 90, 12, 1, true);
  beamGeo.rotateX(Math.PI / 2); // point along +Z, apex at the pivot
  beamGeo.translate(0, 0, 45);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false, fog: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beamPivot.add(beam);
  const beam2 = new THREE.Mesh(beamGeo, beamMat.clone());
  beam2.rotation.y = Math.PI; // second beam, opposite direction
  beamPivot.add(beam2);
  const beamLight = new THREE.SpotLight(0xfff2b0, 0, 260, 0.16, 0.45, 1.2);
  beamLight.position.set(-270, 37.4, 300);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(-270, 30, 390);
  scene.add(beamTarget);
  beamLight.target = beamTarget;
  scene.add(beamLight);

  let beamAngle = 0;
  let beamOn = false;

  function update(dt) {
    // Fountain water shimmers.
    waterMat.opacity = 0.75 + Math.sin((world.elapsed || 0) * 2.2) * 0.1;
    spray.rotation.y += dt * 0.4;

    // Beam spins only at night (or when the day/night system says so).
    const night = world.night === true ||
      (world.dayNight && world.dayNight.isNight && world.dayNight.isNight());
    if (night !== beamOn) {
      beamOn = night;
      beamPivot.visible = night;
      beamLight.intensity = night ? 900 : 0;
      lampRoom.material.emissiveIntensity = night ? 2.2 : 0.4;
    }
    if (beamOn) {
      beamAngle += dt * 0.55;
      beamPivot.rotation.y = beamAngle;
      beamTarget.position.set(
        -270 + Math.sin(beamAngle) * 90,
        28,
        300 + Math.cos(beamAngle) * 90
      );
    }

    // Old Town windows glow warm at night.
    const glow = night ? 0.9 : 0;
    if (windowsMat.emissiveIntensity !== glow) {
      windowsMat.emissiveIntensity = glow;
    }
  }

  return {
    update,
    group,
    colliders,
    lighthouse: { group: lightGroup, beamPivot, beamLight },
    plazaCenter: { x: -203, z: -58 },
    getBeamAngle: () => beamAngle,
    // District summary for the HUD district label and the minimap.
    getInfo: () => ({
      name: 'Old Town',
      bounds: { minX: -245, maxX: -160, minZ: -120, maxZ: 0 },
      plaza: { x: -203, z: -58 },
      lighthouse: { x: -270, z: 300 },
      chapel: { x: -203, z: -86 },
    }),
  };
}
