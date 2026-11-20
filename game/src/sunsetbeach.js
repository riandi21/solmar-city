// sunsetbeach.js — Beach resort on the SW beach, x -260..-100, z 280..330.
// Beach bars, surf shops, a bonfire pit, a beach volleyball court, surfboards
// stuck in the sand, palm trees and a wooden pier into the sea.
// Surf Shack property at (-180,300) with a visible marker and for-sale sign.
// Jet ski dock at the pier (-150,320). Sand is walkable/drivable at low speed.
import * as THREE from 'three';

function mat(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

function box(scene, colliders, w, h, d, x, y, z, material, collide = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  if (collide) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  return m;
}

export function createSunsetBeach(scene, world) {
  if (!world.city) world.city = { colliders: [] };
  if (!world.city.colliders) world.city.colliders = [];
  const colliders = world.city.colliders;
  const rng = () => world.rng();
  const group = new THREE.Group();
  group.name = 'sunsetbeach';
  scene.add(group);

  // Sand base, walkable/drivable at low speed (no collider: sand is open ground).
  const sand = new THREE.Mesh(new THREE.BoxGeometry(160, 0.6, 50), mat(0xe6d3a3, 1));
  sand.position.set(-180, 0, 305);
  sand.receiveShadow = true;
  group.add(sand);
  // Boardwalk along the north edge of the sand.
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(150, 0.3, 5), mat(0x9a7a55));
  boardwalk.position.set(-180, 0.5, 282);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);

  // Surf Shack property at (-180,300): hut, marker beacon and for-sale sign.
  const shack = box(group, colliders, 10, 4.5, 8, -180, 2.6, 300, mat(0x3a9ad9), true);
  const shackRoof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 2.6, 4), mat(0xd9b36a));
  shackRoof.position.set(-180, 6.1, 300);
  shackRoof.rotation.y = Math.PI / 4;
  group.add(shackRoof);
  const shackDoor = box(group, colliders, 2.2, 3.2, 0.3, -180, 1.9, 304.2, mat(0x4a2f1d), false);
  const saleSign = box(group, colliders, 2.6, 1.6, 0.2, -174, 2.6, 304.5, mat(0xffc93a), false);
  const salePost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 6), mat(0xdddddd));
  salePost.position.set(-174, 1.2, 304.5);
  group.add(salePost);
  const beaconPole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3, 6), mat(0xdddddd));
  beaconPole.position.set(-180, 6.4, 300);
  group.add(beaconPole);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x3aff7a }));
  beacon.position.set(-180, 8.2, 300);
  group.add(beacon);

  // Beach bars and surf shops along the boardwalk.
  const bar = box(group, colliders, 9, 3.2, 5, -220, 2.1, 292, mat(0xff7a3c), true);
  const barRoof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 2.2, 4), mat(0xd9b36a));
  barRoof.position.set(-220, 4.8, 292);
  barRoof.rotation.y = Math.PI / 4;
  group.add(barRoof);
  const surfShop = box(group, colliders, 10, 4, 7, -140, 2.5, 292, mat(0xffc93a), true);
  const shopSign = box(group, colliders, 8, 1.4, 0.3, -140, 4.8, 295.7, mat(0x3a9ad9), false);
  const shop2 = box(group, colliders, 8, 3.6, 6, -110, 2.3, 292, mat(0x3ad9a0), true);

  // Bonfire pit: stone ring, logs and a flame that flickers in update().
  const pitStones = [];
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), mat(0x7a7a72));
    stone.position.set(-200 + Math.cos(a) * 1.8, 0.6, 312 + Math.sin(a) * 1.8);
    group.add(stone);
    pitStones.push(stone);
  }
  for (let i = 0; i < 3; i += 1) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 6), mat(0x5a3a22));
    log.position.set(-200, 0.9, 312);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    group.add(log);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 }));
  flame.position.set(-200, 1.8, 312);
  group.add(flame);
  colliders.push({ minX: -202, maxX: -198, minZ: 310, maxZ: 314 });

  // Beach volleyball court: sand court, net and poles.
  const court = new THREE.Mesh(new THREE.BoxGeometry(16, 0.25, 8), mat(0xf0e0b0, 1));
  court.position.set(-160, 0.45, 312);
  court.receiveShadow = true;
  group.add(court);
  for (const px of [-168, -152]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), mat(0xdddddd));
    pole.position.set(px, 1.7, 312);
    group.add(pole);
  }
  const net = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  net.position.set(-160, 2.2, 312);
  group.add(net);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), mat(0xffffff));
  ball.position.set(-158, 0.8, 314);
  group.add(ball);

  // Surfboards stuck upright in the sand, in bright colours.
  const boardCols = [0xff5a3a, 0x3ad9d9, 0xffd93a, 0x9a3ad9, 0x3a9a5a];
  for (let i = 0; i < 8; i += 1) {
    const x = -248 + i * 18 + rng() * 4;
    const z = 296 + rng() * 22;
    if (Math.abs(x + 180) < 8 && Math.abs(z - 300) < 7) continue;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.4, 1.1), mat(boardCols[i % boardCols.length]));
    board.position.set(x, 1.9, z);
    board.rotation.z = (rng() - 0.5) * 0.35;
    board.castShadow = true;
    group.add(board);
  }

  // Palm trees scattered across the sand.
  const trunkMat = mat(0x7a5a35);
  const leafMat = mat(0x3d8a3d);
  for (let i = 0; i < 18; i += 1) {
    const x = -254 + rng() * 148;
    const z = 284 + rng() * 42;
    if (Math.abs(x + 180) < 9 && Math.abs(z - 300) < 8) continue;
    if (Math.abs(x + 200) < 4 && Math.abs(z - 312) < 4) continue;
    const h = 5 + rng() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), trunkMat);
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = (rng() - 0.5) * 0.25;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 6), leafMat);
    crown.position.set(x, h + 0.6, z);
    group.add(crown);
  }

  // Wooden pier extending into the sea, with a jet ski dock at (-150,320).
  const pier = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 34), mat(0x8a6a45));
  pier.position.set(-150, 1, 322);
  pier.receiveShadow = true;
  group.add(pier);
  for (let i = 0; i < 5; i += 1) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 6), mat(0x5a4028));
    pile.position.set(-152.5 + (i % 2) * 5, 0.6, 310 + i * 6);
    group.add(pile);
  }
  // Jet ski dock: floating platform + a jet ski at the pier end.
  const dock = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 8), mat(0x3a6a8a));
  dock.position.set(-150, 0.8, 336);
  group.add(dock);
  const ski = box(group, colliders, 3, 0.7, 1.4, -150, 1.4, 336, mat(0xff2222, 0.4), true);
  const skiSeat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1), mat(0x222222));
  skiSeat.position.set(-150, 1.9, 336);
  group.add(skiSeat);
  colliders.push({ minX: -153, maxX: -147, minZ: 332, maxZ: 340 });

  // Beach umbrellas and towels.
  for (let i = 0; i < 5; i += 1) {
    const x = -236 + i * 24;
    const z = 306 + (i % 2) * 10;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 6), mat(0xdddddd));
    pole.position.set(x, 1.5, z);
    group.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8), mat([0xff5a3a, 0x3ad9d9, 0xffd93a][i % 3]));
    canopy.position.set(x, 2.9, z);
    group.add(canopy);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 1), mat(0xffffff));
    towel.position.set(x + 1.5, 0.5, z + 1.5);
    group.add(towel);
  }
  // Lifeguard tower watching the swim zone by the pier.
  const towerLegs = box(group, colliders, 3, 3.4, 3, -128, 2, 306, mat(0xffffff), true);
  const towerCab = box(group, colliders, 3.6, 2, 3.6, -128, 4.6, 306, mat(0xff5a3a), true);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.2, 4), mat(0xffc93a));
  towerRoof.position.set(-128, 6.2, 306);
  towerRoof.rotation.y = Math.PI / 4;
  group.add(towerRoof);

  function surfShackPosition() { return new THREE.Vector3(-180, 0, 300); }
  function jetSkiDockPosition() { return new THREE.Vector3(-150, 0, 320); }

  return {
    group, shack, bar, surfShop, ski, surfShackPosition, jetSkiDockPosition,
    update(dt) {
      flame.scale.y = 1 + Math.sin(dt * 6) * 0.18;
      flame.material.opacity = 0.75 + Math.sin(dt * 9) * 0.15;
      beacon.material.color.setHSL(0.33, 0.9, 0.45 + Math.sin(dt * 2) * 0.12);
    },
  };
}
