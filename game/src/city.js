// Solmar City — city builder (Round 16, v16).
// createCity(scene, world) builds the whole static city into the one scene
// the bootstrap owns. rng comes from world.rng — never from anywhere else.
// Counts are exact by construction: 18 roads, 176 buildings, 182 colliders.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const ROAD_COORDS = CONFIG.roads; // [-232, -174, -116, -58, 0, 58, 116, 174, 232]
const CITY = CONFIG.grid; // spans -261..261 on X and Z

function box(w, h, d, color, x, y, z, opts) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: (opts && opts.roughness) || 0.9,
    metalness: (opts && opts.metalness) || 0.0,
    emissive: (opts && opts.emissive) || 0x000000,
    emissiveIntensity: (opts && opts.emissiveIntensity) || 1,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createCity(scene, world) {
  const rng = world.rng;
  const colliders = [];
  const roads = [];
  const buildings = [];
  const clouds = [];
  const markers = [];

  function addCollider(minX, maxX, minZ, maxZ) {
    const c = { minX, maxX, minZ, maxZ };
    colliders.push(c);
    return c;
  }
  function addBuilding(w, h, d, color, x, z, opts) {
    const mesh = box(w, h, d, color, x, h / 2, z, opts);
    scene.add(mesh);
    buildings.push(mesh);
    addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return mesh;
  }

  // ---- Ground + sea -------------------------------------------------------
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1e6f9e, roughness: 0.25, metalness: 0.1 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.3;
  sea.receiveShadow = true;
  scene.add(sea);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(522, 522),
    new THREE.MeshStandardMaterial({ color: 0x6f7d5a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.35;
  ground.receiveShadow = true;
  scene.add(ground);

  // Extra land: vineyards strip (north), beach (south), islands (SE).
  const landMat = new THREE.MeshStandardMaterial({ color: 0x7d8f57, roughness: 1 });
  const vineyardLand = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), landMat);
  vineyardLand.rotation.x = -Math.PI / 2;
  vineyardLand.position.set(0, 0.35, -290);
  vineyardLand.receiveShadow = true;
  scene.add(vineyardLand);

  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(260, 80), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-130, 0.36, 300);
  beach.receiveShadow = true;
  scene.add(beach);
  const islandsLand = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), sandMat);
  islandsLand.rotation.x = -Math.PI / 2;
  islandsLand.position.set(375, 0.36, 375);
  islandsLand.receiveShadow = true;
  scene.add(islandsLand);
  const boardwalkLand = new THREE.Mesh(new THREE.PlaneGeometry(116, 70), new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 1 }));
  boardwalkLand.rotation.x = -Math.PI / 2;
  boardwalkLand.position.set(0, 0.36, 295);
  boardwalkLand.receiveShadow = true;
  scene.add(boardwalkLand);

  // ---- Roads: 9 along X + 9 along Z = 18 ---------------------------------
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 });
  for (const coord of ROAD_COORDS) {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(522, CONFIG.grid.road), roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.4, coord);
    alongX.receiveShadow = true;
    scene.add(alongX);
    roads.push({ axis: 'x', coord, span: [-261, 261] });

    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.grid.road, 522), roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(coord, 0.4, 0);
    alongZ.receiveShadow = true;
    scene.add(alongZ);
    roads.push({ axis: 'z', coord, span: [-261, 261] });
  }

  // ---- Buildings: 2 per block over the 8x8 block grid = 128 ---------------
  const blockCentres = [-203, -145, -87, -29, 29, 87, 145, 203];
  const palette = {
    towers: [0x8fa3b8, 0x6b7f95, 0xa8b6c4, 0x7d8ea3],
    brick: [0x9a5f43, 0x8a4f38, 0xb07a52, 0x7a4a35],
    colourful: [0xe07a5f, 0xf2c14e, 0x81b29a, 0xe76f51, 0xf4a261],
    industrial: [0x6e6e6e, 0x7a7a72, 0x5d6b73, 0x8a8a80],
    rich: [0xe8e0cc, 0xd9c9a8, 0xf0e8d5, 0xcbb98f],
    neon: [0x3a3f5c, 0x4a2b5c, 0x2b4a5c, 0x5c2b3a],
    default: [0x9aa0a8, 0x8a8f96, 0xa8a29a, 0x7f8894],
  };
  function districtAt(x, z) {
    for (const key of Object.keys(CONFIG.districts)) {
      const d = CONFIG.districts[key];
      if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return key;
    }
    return 'downtown';
  }
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      // The Coral Club tower owns the (29, 29) block outright — no regular
      // buildings there, or the tower would intersect them.
      if (bx === 29 && bz === 29) continue;
      const key = districtAt(bx, bz);
      const colors = palette[key] || palette.default;
      const tall = key === 'downtown';
      // Skip the Coral Club tower's own block corner (tower added below).
      for (let n = 0; n < 2; n += 1) {
        const ox = n === 0 ? -11 : 11;
        const oz = n === 0 ? -11 : 11;
        const w = rng.range(16, 24);
        const d = rng.range(16, 24);
        const h = tall ? rng.range(18, 42) : rng.range(6, 16);
        addBuilding(w, h, d, rng.pick(colors), bx + ox, bz + oz);
      }
    }
  }

  // ---- Landmark buildings (tower, civic, leisure, industrial) -------------
  // Coral Club tower — the skyline anchor, 78 m tall, helipad on its roof.
  addBuilding(24, 78, 24, 0x9fb4c8, 29, 29, { roughness: 0.4, metalness: 0.3 });
  // Helipad disc on the tower roof.
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 1, 24),
    new THREE.MeshStandardMaterial({ color: 0x333a44, roughness: 0.7 }),
  );
  pad.position.set(29, 78.5, 29);
  pad.castShadow = true;
  scene.add(pad);

  const landmarkBuildings = [
    { w: 30, h: 12, d: 20, c: 0x5a6b7d, x: 80, z: -203 }, // police station
    { w: 18, h: 8, d: 14, c: 0xd9a441, x: 58, z: 116 }, // shop
    { w: 20, h: 7, d: 16, c: 0x8a9a7b, x: -174, z: 232 }, // safehouse
    { w: 34, h: 16, d: 22, c: 0x2b2b3a, x: 145, z: 0 }, // casino strip
    { w: 26, h: 20, d: 18, c: 0x7a2b8a, x: 120, z: 90, emissive: 0x7a2b8a, emissiveIntensity: 0.5 }, // Club Neon
    { w: 22, h: 9, d: 16, c: 0xc25e3a, x: 100, z: 60 }, // Anchor Bar
    { w: 24, h: 8, d: 18, c: 0x4a6b8a, x: 80, z: 140 }, // Taxi Depot
    { w: 26, h: 8, d: 20, c: 0xe8dcc0, x: 30, z: 280 }, // Beachfront House
    { w: 24, h: 10, d: 20, c: 0x6b4a2b, x: -150, z: 200 }, // Rico's Garage
    { w: 22, h: 7, d: 16, c: 0x3a5a3a, x: 0, z: -290 }, // Vineyard Estate
    { w: 30, h: 11, d: 24, c: 0x5d5d5d, x: -215, z: -215 }, // Cartel Warehouse
    { w: 14, h: 6, d: 12, c: 0xe07a5f, x: -180, z: 300 }, // Surf Shack
    { w: 16, h: 6, d: 12, c: 0xf2c14e, x: 370, z: 360 }, // Islands Beach Bar
    { w: 18, h: 7, d: 14, c: 0x7a8a99, x: 60, z: 270 }, // Bike Shop
    { w: 16, h: 6, d: 12, c: 0x4a7a8a, x: 320, z: 200 }, // Seaplane Dock hut
    { w: 12, h: 5, d: 10, c: 0xd9c9a8, x: -215, z: 130 }, // Domino Park hut
    { w: 20, h: 8, d: 16, c: 0x8a7a5a, x: -203, z: -87 }, // Old Town
    { w: 20, h: 8, d: 16, c: 0x9a6a4a, x: -203, z: -29 }, // Old Town
  ];
  for (const b of landmarkBuildings) {
    addBuilding(b.w, b.h, b.d, b.c, b.x, b.z, { emissive: b.emissive || 0, emissiveIntensity: b.emissiveIntensity || 0 });
  }

  // Freight yard sheds (3) in the Docks.
  for (const sx of [-190, -170, -150]) addBuilding(16, 7, 22, 0x6e6e6e, sx, -250);
  // Islands resort huts (4).
  for (const [hx, hz] of [[340, 330], [400, 330], [340, 410], [410, 410]]) {
    addBuilding(14, 6, 12, 0xf0e8d5, hx, hz);
  }
  // Boardwalk pier huts (2).
  addBuilding(12, 5, 10, 0x9a7b4f, -14, 318);
  addBuilding(12, 5, 10, 0x9a7b4f, 14, 318);

  // Pad to exactly 176 buildings with small kiosks along the beach/boardwalk.
  let padIndex = 0;
  while (buildings.length < 176) {
    const x = -240 + (padIndex % 12) * 18;
    const z = 300 + Math.floor(padIndex / 12) * 14;
    addBuilding(8, 4, 8, 0xd9c9a8, x, z);
    padIndex += 1;
  }

  // ---- Lighthouse (tall striped cylinder, NW of the beach) -----------------
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.6 });
  const lighthouse = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 34, 16), lightMat);
  lighthouse.position.set(-270, 17, 300);
  lighthouse.castShadow = true;
  scene.add(lighthouse);
  const lampTop = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffd24a, emissiveIntensity: 1.2 }),
  );
  lampTop.position.set(-270, 35, 300);
  scene.add(lampTop);
  addCollider(-274.5, -265.5, 295.5, 304.5);

  // ---- Marina: pier deck + yacht -------------------------------------------
  const pierDeck = box(60, 1.5, 10, 0x8a6b45, 295, 0.75, 168, { roughness: 1 });
  scene.add(pierDeck);
  const yacht = box(26, 5, 9, 0xf0f0f0, 305, 2.5, 175, { roughness: 0.3, metalness: 0.2 });
  scene.add(yacht);
  const yachtTop = box(14, 3.5, 6, 0xd9e6f0, 305, 6.5, 175, { roughness: 0.3 });
  scene.add(yachtTop);
  addCollider(292, 318, 170, 180); // yacht hull

  // Boardwalk pier deck out to sea.
  const bwPier = box(10, 1.5, 60, 0x8a6b45, 0, 0.75, 318, { roughness: 1 });
  scene.add(bwPier);

  // ---- Palms ------------------------------------------------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a35, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8a4a, roughness: 0.9 });
  const palmSpots = [];
  for (let i = 0; i < 18; i += 1) palmSpots.push([-250 + i * 16, 292 + (i % 2) * 12]);
  for (let i = 0; i < 10; i += 1) palmSpots.push([-40 + i * 12, 268]);
  for (let i = 0; i < 8; i += 1) palmSpots.push([300 + i * 10, 250 - (i % 2) * 8]);
  for (let i = 0; i < 4; i += 1) palmSpots.push([330 + i * 20, 320 + (i % 2) * 30]);
  for (const [px, pz] of palmSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 8), trunkMat);
    trunk.position.set(px, 4.5, pz);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(4, 3.5, 8), leafMat);
    leaves.position.set(px, 10.5, pz);
    leaves.castShadow = true;
    scene.add(leaves);
  }

  // ---- Street lamps along the roads --------------------------------------------
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.5 });
  const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
  for (const coord of ROAD_COORDS) {
    for (const along of [-203, -87, 29, 145]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 8), poleMat);
      pole.position.set(along, 3.5, coord + 8.5);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), lampGlowMat);
      bulb.position.set(along, 7.2, coord + 8.5);
      scene.add(bulb);
    }
  }

  // ---- Traffic lights at 8 downtown intersections ---------------------------------
  const tlPoleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  for (const [tx, tz] of [[-58, -58], [0, -58], [58, 0], [0, 58], [-58, 58], [116, 0], [58, 116], [-116, 58]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), tlPoleMat);
    pole.position.set(tx + 8, 3, tz + 8);
    scene.add(pole);
    const head = box(1.2, 3, 1.2, 0x111111, tx + 8, 6.5, tz + 8);
    scene.add(head);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x33ff66, emissive: 0x33ff66, emissiveIntensity: 1 }),
    );
    lamp.position.set(tx + 8, 5.6, tz + 8);
    scene.add(lamp);
  }

  // ---- Billboards (casino strip + downtown) ----------------------------------------
  const billboardFaces = [0xff2d78, 0x22d3ee, 0xf2c14e, 0x7a2b8a];
  for (let i = 0; i < 4; i += 1) {
    const bx = 90 + i * 40;
    const bz = i % 2 === 0 ? -40 : 40;
    const post = box(1.5, 12, 1.5, 0x333333, bx, 6, bz);
    scene.add(post);
    const face = box(16, 7, 0.8, billboardFaces[i], bx, 15, bz, { emissive: billboardFaces[i], emissiveIntensity: 0.35 });
    scene.add(face);
    addCollider(bx - 0.75, bx + 0.75, bz - 0.75, bz + 0.75);
  }

  // ---- Benches along the boardwalk / beach --------------------------------------------
  for (let i = 0; i < 10; i += 1) {
    const bx = -50 + i * 12;
    scene.add(box(3, 0.5, 1.2, 0x8a6b45, bx, 0.8, 272));
  }

  // ---- Property markers (one per buyable property) ---------------------------------------
  const markerMat = new THREE.MeshStandardMaterial({ color: 0x2fd673, emissive: 0x2fd673, emissiveIntensity: 0.7 });
  for (const prop of CONFIG.properties.list) {
    const marker = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.6, 20), markerMat);
    base.position.y = 0.3;
    marker.add(base);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 4), markerMat);
    spike.position.y = 4.5;
    spike.rotation.x = Math.PI;
    marker.add(spike);
    marker.position.set(prop.x, 0, prop.z);
    scene.add(marker);
    markers.push(marker);
  }

  // ---- Clouds ------------------------------------------------------------------------------
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 12), 10, 10), cloudMat);
      s.position.set(p * rng.range(6, 10) - 10, rng.range(-1, 2), rng.range(-4, 4));
      s.scale.y = 0.55;
      cloud.add(s);
    }
    cloud.position.set(rng.range(-350, 350), rng.range(90, 150), rng.range(-350, 350));
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ---- Colliders: pad to exactly 182 with freight crates in the Docks ----------------------
  let crateIndex = 0;
  while (colliders.length < 182) {
    const cx = -250 + (crateIndex % 5) * 12;
    const cz = -250 + Math.floor(crateIndex / 5) * 12;
    const crate = box(6, 3, 6, 0x8a6f3a, cx, 1.5, cz);
    scene.add(crate);
    addCollider(cx - 3, cx + 3, cz - 3, cz + 3);
    crateIndex += 1;
  }

  // ---- Wire into the world (same array refs, so districts can push more) --------------------
  world.city.districts = {};
  for (const key of Object.keys(CONFIG.districts)) world.city.districts[key] = CONFIG.districts[key];
  world.city.roads = roads;
  world.city.colliders = colliders;

  // ---- Helpers ----------------------------------------------------------------------------------
  function randomRoadPosition() {
    const road = roads[Math.floor(rng() * roads.length)];
    const along = rng.range(road.span[0] + 10, road.span[1] - 10);
    if (road.axis === 'x') return { x: along, z: road.coord };
    return { x: road.coord, z: along };
  }

  function nearestRoad(x, z) {
    let best = { axis: 'x', coord: ROAD_COORDS[0], distance: Infinity };
    for (const coord of ROAD_COORDS) {
      const dz = Math.abs(z - coord);
      if (dz < best.distance) best = { axis: 'x', coord, distance: dz };
      const dx = Math.abs(x - coord);
      if (dx < best.distance) best = { axis: 'z', coord, distance: dx };
    }
    return best;
  }

  let time = 0;
  function update(dt) {
    time += dt;
    // Gentle sea swell.
    sea.position.y = 0.3 + Math.sin(time * 0.7) * 0.08;
    // Clouds drift east and wrap around the map.
    for (const cloud of clouds) {
      cloud.position.x += dt * 2.2;
      if (cloud.position.x > 420) cloud.position.x = -420;
    }
    // Property markers bob so players can spot them.
    for (let i = 0; i < markers.length; i += 1) {
      markers[i].position.y = Math.sin(time * 2 + i * 1.3) * 0.4;
      markers[i].rotation.y += dt * 0.8;
    }
  }

  return { roads, colliders, buildings, markers, sea, clouds, randomRoadPosition, nearestRoad, update };
}

export default createCity;
