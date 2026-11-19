// City builder: the whole of Solmar City as three.js meshes.
// Roads on the 9x9 grid, downtown towers in the middle, houses toward the
// edges, beach and sea to the south, marina to the east, plus palms,
// clouds, street lamps, traffic lights, billboards, benches and the
// for-sale markers over the four buyable properties.

import * as THREE from 'three';

const ROAD_COLOR = 0x2e2e33;
const SIDEWALK_COLOR = 0x8a8a86;
const GROUND_COLOR = 0x3f7a4a;
const SAND_COLOR = 0xd9c28a;
const SEA_COLOR = 0x1d6f8f;

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createCity(world) {
  const scene = world.scene;
  const rng = world.rng;
  const cfg = world.config;
  const lines = cfg.roadLines;
  const half = cfg.cityHalf;

  const roads = [];
  const colliders = [];
  const animated = { sea: null, clouds: [] };

  // Ground slab under the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, half * 2 + 260),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads: one strip along every grid line on each axis (18 roads).
  const roadGeoX = new THREE.PlaneGeometry(half * 2, cfg.roadWidth);
  const roadGeoZ = new THREE.PlaneGeometry(cfg.roadWidth, half * 2);
  const roadMat = new THREE.MeshStandardMaterial({ color: ROAD_COLOR, roughness: 0.95 });
  for (const line of lines) {
    const alongX = new THREE.Mesh(roadGeoX, roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.01, line);
    alongX.receiveShadow = true;
    scene.add(alongX);
    roads.push({ axis: 'x', coord: line, span: half * 2 });

    const alongZ = new THREE.Mesh(roadGeoZ, roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(line, 0.01, 0);
    alongZ.receiveShadow = true;
    scene.add(alongZ);
    roads.push({ axis: 'z', coord: line, span: half * 2 });
  }

  // Centre-line dashes on the main roads.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d90a });
  const dashGeo = new THREE.PlaneGeometry(3, 0.5);
  for (const line of [-116, 0, 116]) {
    for (let d = -half; d < half; d += 12) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, 0.02, line);
      scene.add(dash);
    }
  }

  // Buildings: two per block, taller near the centre, houses at the edges.
  const wallColors = [0xb8a88f, 0x9fb4c4, 0xc4a29a, 0xa8b89a, 0xd0c4a8, 0x8f9fb0, 0xc9b8d0];
  const roofColors = [0x5a4a3a, 0x3a4a5a, 0x6a3a3a, 0x4a5a4a];
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x2a3a4a, roughness: 0.2, metalness: 0.6, emissive: 0x111820,
  });
  let buildingCount = 0;

  function placeBuilding(cx, cz, distCentre) {
    const tall = distCentre < 90;
    const height = tall
      ? rng.range(24, 62)
      : rng.range(6, distCentre < 180 ? 16 : 9);
    const w = rng.range(12, 18);
    const d = rng.range(12, 18);
    const color = rng.pick(wallColors);
    const body = box(w, height, d, color, cx, height / 2, cz);
    scene.add(body);
    // Rooftop detail: a small plant room / water tank.
    const roofBox = box(
      rng.range(3, 6), rng.range(2, 4), rng.range(3, 6),
      rng.pick(roofColors), cx + rng.range(-3, 3), height + 1.5, cz + rng.range(-3, 3)
    );
    scene.add(roofBox);
    // Window band on taller buildings.
    if (height > 14) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.3, height * 0.55, d + 0.3),
        windowMat
      );
      band.position.set(cx, height * 0.55, cz);
      scene.add(band);
    }
    // Shop awning on a few low buildings.
    if (height < 12 && rng.next() < 0.4) {
      const awning = box(w * 0.7, 0.4, 4, rng.pick([0xc0392b, 0x2e86c1, 0x27ae60]), cx, 3.4, cz + d / 2 + 2);
      scene.add(awning);
    }
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    buildingCount++;
  }

  for (let bx = 0; bx < cfg.gridBlocks; bx++) {
    for (let bz = 0; bz < cfg.gridBlocks; bz++) {
      const cx = -232 + bx * cfg.pitch;
      const cz = -232 + bz * cfg.pitch;
      const distCentre = Math.max(Math.abs(cx), Math.abs(cz));
      // Skip the Coral Club block — the tower stands there instead.
      if (Math.abs(cx - 29) < 30 && Math.abs(cz - 29) < 30) continue;
      placeBuilding(cx - 11, cz - 11, distCentre);
      placeBuilding(cx + 11, cz + 11, distCentre);
    }
  }

  // Small beach huts and marina shacks add the last few buildings.
  for (let i = 0; i < 12; i++) {
    const hx = rng.range(-240, 240);
    const hz = rng.range(272, 292);
    const hut = box(5, 3.5, 4, rng.pick([0xe67e22, 0x3498db, 0x2ecc71]), hx, 1.75, hz);
    scene.add(hut);
    colliders.push({ minX: hx - 2.5, maxX: hx + 2.5, minZ: hz - 2, maxZ: hz + 2 });
    buildingCount++;
  }
  for (let i = 0; i < 4; i++) {
    const sx = 280 + i * 10;
    const sz = 90 + i * 4;
    const shack = box(6, 4, 5, 0x9a8a7a, sx, 2, sz);
    scene.add(shack);
    colliders.push({ minX: sx - 3, maxX: sx + 3, minZ: sz - 2.5, maxZ: sz + 2.5 });
    buildingCount++;
  }

  // Coral Club tower: the landmark at (29, 29), 78 m tall.
  const tower = box(26, cfg.coralClub.height, 26, 0x3a6ea5, cfg.coralClub.x, cfg.coralClub.height / 2, cfg.coralClub.z);
  scene.add(tower);
  const crown = box(28, 3, 28, 0xf5d90a, cfg.coralClub.x, cfg.coralClub.height + 1.5, cfg.coralClub.z);
  scene.add(crown);
  colliders.push({ minX: 16, maxX: 42, minZ: 16, maxZ: 42 });

  // Beach and sea along the south edge (z above +261).
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, 70),
    new THREE.MeshStandardMaterial({ color: SAND_COLOR, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 296);
  sand.receiveShadow = true;
  scene.add(sand);

  const seaGeo = new THREE.PlaneGeometry(half * 2 + 400, 220, 24, 12);
  const seaMat = new THREE.MeshStandardMaterial({ color: SEA_COLOR, roughness: 0.35, metalness: 0.2 });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.1, 440);
  sea.receiveShadow = true;
  scene.add(sea);
  animated.sea = sea;

  // Boardwalk planks and pier at (0, 318).
  const walk = box(120, 0.4, 12, 0x8a6a42, 0, 0.2, 300);
  scene.add(walk);
  const pierDeck = box(10, 0.4, 60, 0x7a5a38, cfg.pier.x, 0.3, cfg.pier.z + 18);
  scene.add(pierDeck);

  // Ferris wheel on the boardwalk, slowly turning in update().
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(-40, 26, 288);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(16, 0.7, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.5 })
  );
  wheelGroup.add(rim);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const cabin = box(3, 3, 3, rng.pick([0xf1c40f, 0x3498db, 0x2ecc71, 0xe67e22]),
      Math.cos(angle) * 16, Math.sin(angle) * 16, 0);
    wheelGroup.add(cabin);
  }
  const legA = box(1.2, 30, 1.2, 0x888888, -8, -12, 0);
  const legB = box(1.2, 30, 1.2, 0x888888, 8, -12, 0);
  wheelGroup.add(legA, legB);
  scene.add(wheelGroup);
  animated.wheel = wheelGroup;

  // Marina basin east of the city, big yacht, piers.
  const marinaWater = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 200),
    new THREE.MeshStandardMaterial({ color: SEA_COLOR, roughness: 0.3, metalness: 0.2 })
  );
  marinaWater.rotation.x = -Math.PI / 2;
  marinaWater.position.set(330, 0.05, 160);
  scene.add(marinaWater);
  const yachtHull = box(10, 4, 34, 0xf5f5f5, cfg.yacht.x, 2, cfg.yacht.z);
  scene.add(yachtHull);
  const yachtTop = box(7, 3, 18, 0xdddddd, cfg.yacht.x, 5, cfg.yacht.z - 2);
  scene.add(yachtTop);
  const yachtMast = box(0.6, 12, 0.6, 0xcccccc, cfg.yacht.x, 10, cfg.yacht.z + 6);
  scene.add(yachtMast);
  for (let i = 0; i < 4; i++) {
    const slip = box(4, 0.5, 40, 0x6a4a2a, 275 + i * 6, 0.3, 150);
    scene.add(slip);
  }

  // Palm trees along the beach and boardwalk.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const px = rng.range(-250, 250);
    const pz = rng.range(268, 322);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.5, 7), leafMat);
    leaves.position.set(px, 8.2, pz);
    leaves.castShadow = true;
    scene.add(leaves);
  }

  // Clouds: soft white flattened spheres drifting in update().
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng.next() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(5, 9), 8, 6), cloudMat);
      puff.position.set(p * 7 - puffs * 3, rng.range(-1, 1), rng.range(-3, 3));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-300, 300), rng.range(70, 110), rng.range(-300, 300));
    scene.add(cloud);
    animated.clouds.push(cloud);
  }

  // Street lamps along the major roads.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdf80, emissiveIntensity: 0.6 });
  for (const line of [-116, 0, 116]) {
    for (let d = -220; d <= 220; d += 58) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), poleMat);
      pole.position.set(d, 3.5, line + 8);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(d, 7.1, line + 8);
      scene.add(lamp);
    }
  }

  // Traffic lights at the busiest intersections.
  const lightHousing = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  for (const [lx, lz] of [[0, 0], [58, 0], [0, 58], [-58, -58], [116, 116]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 6, 6), poleMat);
    post.position.set(lx + 8, 3, lz + 8);
    scene.add(post);
    const housing = box(0.8, 2.2, 0.8, 0x222222, lx + 8, 6.5, lz + 8);
    scene.add(housing);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 0.8 }));
    red.position.set(lx + 8, 7.2, lz + 8.4);
    scene.add(red);
  }

  // Billboards and benches.
  for (const [bx, bz, text] of [[-58, 116, 'SOLMAR'], [116, -58, 'CORAL'], [58, -174, 'DOCKS']]) {
    const board = box(14, 5, 0.6, 0x1a2a4a, bx, 9, bz);
    scene.add(board);
    const leg1 = box(0.8, 7, 0.8, 0x555555, bx - 5, 3.5, bz);
    const leg2 = box(0.8, 7, 0.8, 0x555555, bx + 5, 3.5, bz);
    scene.add(leg1, leg2);
  }
  for (let i = 0; i < 12; i++) {
    const bench = box(3, 0.5, 1, 0x6a4a2a, rng.range(-220, 220), 0.6, rng.pick(lines) + 9);
    scene.add(bench);
  }

  // Property markers: floating for-sale signs over the four properties.
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xf5d90a, emissive: 0xaa8800, emissiveIntensity: 0.5 });
  for (const prop of cfg.properties) {
    const sign = box(4, 2.4, 0.3, 0xf5d90a, prop.x, 5, prop.z);
    sign.material = markerMat;
    scene.add(sign);
    const post = box(0.3, 4, 0.3, 0x333333, prop.x, 2, prop.z);
    scene.add(post);
    colliders.push({ minX: prop.x - 1, maxX: prop.x + 1, minZ: prop.z - 1, maxZ: prop.z + 1 });
  }

  // Districts for the minimap and territory system.
  const districts = [
    { id: 'downtown', name: 'Downtown', xMin: -90, xMax: 90, zMin: -90, zMax: 90 },
    { id: 'oldtown', name: 'Old Town', xMin: -261, xMax: -145, zMin: -145, zMax: 30 },
    { id: 'marina', name: 'Marina', xMin: 145, xMax: 400, zMin: 30, zMax: 261 },
    { id: 'boardwalk', name: 'Boardwalk', xMin: -145, xMax: 145, zMin: 232, zMax: 330 },
    { id: 'freight', name: 'Freight Yard', xMin: -261, xMax: -145, zMin: -261, zMax: -145 },
    { id: 'airfield', name: 'Airfield', xMin: 145, xMax: 261, zMin: -261, zMax: -145 },
  ];

  world.city.roads = roads;
  world.city.colliders = colliders;
  world.city.districts = districts;

  function randomRoadPosition() {
    const road = rng.pick(roads);
    const along = rng.range(-half, half);
    if (road.axis === 'x') return { x: along, z: road.coord + rng.range(-3, 3) };
    return { x: road.coord + rng.range(-3, 3), z: along };
  }

  function nearestRoad(x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const road of roads) {
      const dist = road.axis === 'x' ? Math.abs(z - road.coord) : Math.abs(x - road.coord);
      if (dist < bestDist) { bestDist = dist; best = road; }
    }
    return best;
  }

  function update(dt, time) {
    // Gentle sea swell.
    if (animated.sea) {
      animated.sea.position.y = 0.1 + Math.sin(time * 0.6) * 0.15;
    }
    // Clouds drift east and wrap around the city.
    for (const cloud of animated.clouds) {
      cloud.position.x += dt * 2.5;
      if (cloud.position.x > 340) cloud.position.x = -340;
    }
    // Ferris wheel turns slowly.
    if (animated.wheel) animated.wheel.rotation.z += dt * 0.15;
  }

  return { roads, colliders, districts, buildingCount, randomRoadPosition, nearestRoad, update, sea: animated.sea };
}
