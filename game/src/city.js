// Solmar City — the city builder.
// createCity(scene, world): the world object is the second argument, and
// the rng is read from it (world.rng, a CALLABLE function). Builds the
// 9x9 grid (~18 roads, ~176 buildings, ~182 colliders), beach, sea,
// marina, palms, lamps, traffic lights, billboards, benches and the
// property markers. Returns roads, colliders, helpers and an update step.
import * as THREE from 'three';
import { CITY, CONFIG, DISTRICTS, LANDMARKS, PROPERTIES } from './config.js';

const PALETTE = [0x8a7f74, 0x9c8f80, 0x7d8a96, 0xb09a7a, 0x6f7d8a, 0xa88f6a, 0x948a7e, 0x7a6f8a];

export function createCity(scene, world) {
  const rng = world.rng;
  const roads = [];
  const colliders = [];
  const buildings = [];
  const clouds = [];
  const lamps = [];
  const group = new THREE.Group();
  group.name = 'solmar-city';
  scene.add(group);

  const materials = new Map();
  function mat(color) {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshLambertMaterial({ color }));
    }
    return materials.get(color);
  }
  function box(w, h, d, color, x, y, z, parent) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = h > 10;
    mesh.receiveShadow = true;
    (parent || group).add(mesh);
    return mesh;
  }
  function addCollider(minX, maxX, minZ, maxZ, height = 10, id = '') {
    const c = { minX, maxX, minZ, maxZ, height, id };
    colliders.push(c);
    return c;
  }

  // Ground slab, beach strip and sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), mat(0x5d7a4a));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(560, 80), mat(0xe0c98f));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-40, 0, 300);
  beach.receiveShadow = true;
  group.add(beach);
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x1e6f8f, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1100, 320), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.1, 470);
  group.add(sea);
  const marinaWater = new THREE.Mesh(new THREE.PlaneGeometry(150, 210), seaMat);
  marinaWater.rotation.x = -Math.PI / 2;
  marinaWater.position.set(330, 0.1, 160);
  group.add(marinaWater);

  // Roads: 9 along X (varying z) and 9 along Z (varying x) = 18.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e33 });
  for (const c of CITY.roadCoords) {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(560, CITY.roadWidth), roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.02, c);
    alongX.receiveShadow = true;
    group.add(alongX);
    roads.push({ axis: 'x', coord: c, span: 560, min: -280, max: 280 });
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, 560), roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(c, 0.02, 0);
    alongZ.receiveShadow = true;
    group.add(alongZ);
    roads.push({ axis: 'z', coord: c, span: 560, min: -280, max: 280 });
  }
  // Centre dashes on the two main avenues.
  const dashMat = mat(0xd8d8d8);
  for (let i = -8; i <= 8; i += 1) {
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 0.6), dashMat);
    d1.position.set(i * 30, 0.05, 0);
    group.add(d1);
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 4), dashMat);
    d2.position.set(0, 0.05, i * 30);
    group.add(d2);
  }

  // Buildings: 8x8 blocks between the roads, 2-3 per block, taller downtown.
  const blockCentres = [-203, -145, -87, -29, 29, 87, 145, 203];
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      const distCentre = Math.sqrt(bx * bx + bz * bz);
      const count = rng.int(2, 3);
      for (let i = 0; i < count; i += 1) {
        const ox = rng.range(-13, 13);
        const oz = rng.range(-13, 13);
        const x = bx + ox;
        const z = bz + oz;
        // Keep the Coral Club plot and the shop plot clear for landmarks.
        if (Math.abs(x - 29) < 24 && Math.abs(z - 29) < 24) continue;
        if (Math.abs(x - 58) < 10 && Math.abs(z - 116) < 10) continue;
        const w = rng.range(10, 18);
        const d = rng.range(10, 18);
        let h;
        if (distCentre < 90) h = rng.range(26, 68);
        else if (distCentre < 170) h = rng.range(12, 30);
        else h = rng.range(6, 14);
        const color = rng.pick(PALETTE);
        box(w, h, d, color, x, h / 2, z);
        // Rooftop detail on taller blocks.
        if (h > 20 && rng.chance(0.6)) {
          box(w * 0.3, 2.5, d * 0.3, 0x555555, x + w * 0.2, h + 1.2, z);
        }
        if (rng.chance(0.35)) {
          box(w + 1.5, 0.8, 2, 0x3a3a3a, x, 3.2, z + d / 2 + 0.5);
        }
        buildings.push({ x, z, w, d, h, color });
        addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h, 'building');
      }
    }
  }

  // Top up small edge houses so the count lands near the ~176 target
  // even when landmark plots skipped a few block slots.
  let fillGuard = 0;
  while (buildings.length < 176 && fillGuard < 40) {
    fillGuard += 1;
    const x = rng.pick([-232, -203, 203, 232]) + rng.range(-6, 6);
    const z = rng.range(-200, 200);
    if (pointInCollider(x, z, 8)) continue;
    const w = rng.range(9, 13);
    const d = rng.range(9, 13);
    const h = rng.range(6, 11);
    box(w, h, d, rng.pick(PALETTE), x, h / 2, z);
    buildings.push({ x, z, w, d, h, color: 0x8a7f74 });
    addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h, 'house');
  }

  // Coral Club tower: 78 m, the tallest landmark, at (29, 29).
  box(26, 78, 26, 0x4a6a8a, LANDMARKS.coralClub.x, 39, LANDMARKS.coralClub.z);
  box(20, 6, 20, 0x2e4a5a, 29, 81, 29);
  box(8, 4, 8, 0xffd34d, 29, 86, 29);
  buildings.push({ x: 29, z: 29, w: 26, d: 26, h: 78, color: 0x4a6a8a });
  addCollider(16, 42, 16, 42, 78, 'coral-club');

  // Casino building on the strip, shop, safehouse and police station shells.
  box(34, 16, 24, 0x8a2a4a, 150, 8, -58);
  buildings.push({ x: 150, z: -58, w: 34, d: 24, h: 16, color: 0x8a2a4a });
  addCollider(133, 167, -70, -46, 16, 'casino');
  box(14, 7, 12, 0xc9a227, LANDMARKS.shop.x, 3.5, LANDMARKS.shop.z);
  addCollider(51, 65, 110, 122, 7, 'shop');
  box(16, 8, 12, 0x7a8a6a, LANDMARKS.safehouse.x, 4, LANDMARKS.safehouse.z);
  addCollider(-182, -166, 226, 238, 8, 'safehouse');
  box(20, 10, 16, 0x3a5a8a, LANDMARKS.policeStation.x, 5, LANDMARKS.policeStation.z);
  addCollider(70, 90, -211, -195, 10, 'police-station');

  // Airfield runway strip in the north-east.
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(30, 180), roadMat);
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(230, 0.03, -230);
  group.add(runway);
  box(24, 9, 16, 0x9a9a9a, 190, 4.5, -250);
  addCollider(178, 202, -258, -242, 9, 'hangar');

  // Boardwalk pier at (0, 318) and a ferris wheel frame.
  box(10, 1, 70, 0x8a6a4a, 0, 1.5, 318);
  addCollider(-5, 5, 283, 353, 2, 'pier');
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(16, 0.8, 6, 24), mat(0xff6a5a));
  wheel.position.set(-30, 22, 300);
  group.add(wheel);
  box(2, 8, 2, 0x555555, -30, 4, 300);
  addCollider(-32, -28, 298, 302, 8, 'ferris-wheel');

  // Marina yacht and pier-side pontoons.
  box(10, 4, 26, 0xf0f0f0, LANDMARKS.yacht.x, 2, LANDMARKS.yacht.z);
  box(6, 3, 18, 0x2a4a6a, 305, 5, 175);
  addCollider(300, 310, 162, 188, 6, 'yacht');
  box(4, 1, 40, 0x8a6a4a, 285, 1, 180);
  addCollider(283, 287, 160, 200, 1, 'marina-pier');

  // Palm trees along the beach and marina.
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 9, 6), mat(0x7a5a3a));
    trunk.position.set(x, 4.5, z);
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3, 6), mat(0x2a8a4a));
    top.position.set(x, 10, z);
    group.add(top);
  }
  for (let i = 0; i < 22; i += 1) palm(rng.range(-260, 260), rng.range(272, 322));
  for (let i = 0; i < 8; i += 1) palm(rng.range(265, 330), rng.range(80, 250));

  // Street lamps along the two main avenues.
  for (let i = -4; i <= 4; i += 1) {
    for (const [lx, lz] of [[i * 58, 8], [8, i * 58]]) {
      box(0.5, 7, 0.5, 0x222222, lx, 3.5, lz);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mat(0xffe9a0));
      bulb.position.set(lx, 7.2, lz);
      group.add(bulb);
      lamps.push(bulb);
    }
  }

  // Traffic lights at the busiest intersections.
  for (const [tx, tz] of [[0, 0], [58, 0], [0, 58], [-58, 0], [0, -58], [116, 116]]) {
    box(0.6, 6, 0.6, 0x222222, tx + 8, 3, tz + 8);
    box(1.4, 3, 1.4, 0x111111, tx + 8, 6.5, tz + 8);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mat(0x33cc33));
    light.position.set(tx + 8, 7.2, tz + 8);
    group.add(light);
  }

  // Billboards and benches.
  for (const [bx, bz, text] of [[-58, 8, 0], [116, -8, 0], [8, -116, 0]]) {
    box(12, 5, 0.6, 0xeeeeee, bx, 8, bz);
    box(0.8, 6, 0.8, 0x333333, bx - 5, 3, bz);
    box(0.8, 6, 0.8, 0x333333, bx + 5, 3, bz);
    void text;
  }
  for (let i = 0; i < 10; i += 1) {
    box(3, 1, 1, 0x6a4a2a, rng.range(-200, 200), 0.8, rng.pick([-58, 0, 58]) + 8);
  }

  // Clouds: soft white blobs drifting above the city.
  for (let i = 0; i < 10; i += 1) {
    const cloud = new THREE.Group();
    const puffs = rng.int(3, 5);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(rng.range(6, 12), 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      );
      puff.position.set(p * 8 - 12, rng.range(-1, 1), rng.range(-3, 3));
      puff.scale.y = 0.5;
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-300, 300), rng.range(90, 130), rng.range(-300, 300));
    group.add(cloud);
    clouds.push(cloud);
  }

  // Property markers: a floating sign at each buyable property.
  const markers = [];
  for (const p of PROPERTIES) {
    const sign = box(4, 2.5, 0.4, 0xffd34d, p.x, 6, p.z);
    const pole = box(0.4, 5, 0.4, 0x333333, p.x, 2.5, p.z);
    markers.push({ id: p.id, name: p.name, x: p.x, z: p.z, price: p.price, sign, pole });
  }

  function randomRoadPosition() {
    const road = rng.pick(roads);
    const along = rng.range(road.min, road.max);
    if (road.axis === 'x') return { x: along, z: road.coord + rng.range(-3, 3) };
    return { x: road.coord + rng.range(-3, 3), z: along };
  }
  function nearestRoad(x, z) {
    let best = roads[0];
    let bestD = Infinity;
    for (const road of roads) {
      const d = road.axis === 'x' ? Math.abs(z - road.coord) : Math.abs(x - road.coord);
      if (d < bestD) { bestD = d; best = road; }
    }
    return best;
  }
  function pointInCollider(x, z, pad = 0) {
    for (const c of colliders) {
      if (x >= c.minX - pad && x <= c.maxX + pad && z >= c.minZ - pad && z <= c.maxZ + pad) return c;
    }
    return null;
  }
  function collide(x, z, radius = 1) {
    return pointInCollider(x, z, radius);
  }

  const city = {
    roads,
    colliders,
    buildings,
    districts: DISTRICTS,
    markers,
    lamps,
    clouds,
    group,
    sea,
    randomRoadPosition,
    randomRoadPos: randomRoadPosition,
    nearestRoad,
    pointInCollider,
    collide,
    addCollider,
    update(dt, time) {
      sea.position.y = 0.1 + Math.sin(time * 0.6) * 0.15;
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.5;
        if (cloud.position.x > 340) cloud.position.x = -340;
      }
      for (const m of markers) {
        m.sign.position.y = 6 + Math.sin(time * 2 + m.x) * 0.3;
      }
    },
  };
  world.city = city;
  world.districts = DISTRICTS;
  return city;
}

export const createCityBuilder = createCity;
export default createCity;
