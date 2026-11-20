// islands.js — Offshore island chain in the sea SE of the marina, x 300..450, z 300..450.
// Two small islands joined by a bridge, with a beach bar, palms, a hidden airstrip
// for the seaplane and a small lighthouse. Boats can dock at the pier.
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

export function createIslands(scene, world) {
  if (!world.city) world.city = { colliders: [] };
  if (!world.city.colliders) world.city.colliders = [];
  const colliders = world.city.colliders;
  const rng = () => world.rng();
  const group = new THREE.Group();
  group.name = 'islands';
  scene.add(group);

  const sandMat = mat(0xe6d3a3);
  const rockMat = mat(0x7a7a72);

  // Island A (west, larger) and Island B (east, smaller) as low sand discs on rock bases.
  const islandA = new THREE.Mesh(new THREE.CylinderGeometry(42, 48, 3, 18), sandMat);
  islandA.position.set(340, 0.6, 340);
  islandA.receiveShadow = true;
  group.add(islandA);
  const baseA = new THREE.Mesh(new THREE.CylinderGeometry(48, 54, 2, 18), rockMat);
  baseA.position.set(340, -0.6, 340);
  group.add(baseA);
  const islandB = new THREE.Mesh(new THREE.CylinderGeometry(26, 30, 3, 14), sandMat);
  islandB.position.set(420, 0.6, 405);
  islandB.receiveShadow = true;
  group.add(islandB);
  const baseB = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 2, 14), rockMat);
  baseB.position.set(420, -0.6, 405);
  group.add(baseB);
  // Islands are land in the sea: block walking/driving off their rims.
  colliders.push({ minX: 298, maxX: 382, minZ: 298, maxZ: 382 });
  colliders.push({ minX: 394, maxX: 446, minZ: 379, maxZ: 431 });

  // Bridge between the islands.
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(46, 0.8, 5), mat(0x9a7a55));
  bridge.position.set(381, 2.2, 373);
  bridge.rotation.y = -0.62;
  bridge.castShadow = true;
  group.add(bridge);
  for (let i = 0; i < 6; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.4, 6), mat(0xdddddd));
    post.position.set(364 + i * 6.8, 3.2, 361 + i * 4.6);
    group.add(post);
  }

  // Beach bar: counter, thatch roof, stools and a neon-ish sign board.
  const bar = box(group, colliders, 10, 3, 5, 330, 3, 330, mat(0xc98f4a), true);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 2.6, 4), mat(0xd9b36a));
  roof.position.set(330, 6, 330);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  for (let i = 0; i < 4; i += 1) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), mat(0x3a6a8a));
    stool.position.set(326 + i * 2.4, 2.6, 334.5);
    group.add(stool);
  }
  const sign = box(group, colliders, 6, 1.2, 0.3, 330, 6.4, 333.2, mat(0xff7a3c), false);

  // Palm trees on both islands.
  const trunkMat = mat(0x7a5a35);
  const leafMat = mat(0x3d8a3d);
  for (let i = 0; i < 22; i += 1) {
    const onB = i >= 14;
    const cx = onB ? 420 : 340;
    const cz = onB ? 405 : 340;
    const r = onB ? 20 : 34;
    const a = rng() * Math.PI * 2;
    const x = cx + Math.cos(a) * (r * (0.5 + rng() * 0.5));
    const z = cz + Math.sin(a) * (r * (0.5 + rng() * 0.5));
    if (Math.abs(x - 330) < 9 && Math.abs(z - 330) < 7) continue;
    const h = 5 + rng() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), trunkMat);
    trunk.position.set(x, 2 + h / 2, z);
    trunk.rotation.z = (rng() - 0.5) * 0.25;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 6), leafMat);
    crown.position.set(x, 2 + h + 0.6, z);
    group.add(crown);
  }

  // Hidden airstrip on island A: flat strip, edge markers, windsock.
  const strip = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 56), mat(0x555550));
  strip.position.set(352, 2.15, 348);
  strip.rotation.y = 0.35;
  strip.receiveShadow = true;
  group.add(strip);
  for (let i = 0; i < 8; i += 1) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), mat(0xffcc33));
    marker.position.set(347 + (i % 2) * 10, 2.4, 326 + i * 6.5);
    group.add(marker);
  }
  const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), mat(0xdddddd));
  sockPole.position.set(360, 4, 322);
  group.add(sockPole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 8), mat(0xff5533));
  sock.position.set(361, 5.6, 322);
  sock.rotation.z = -Math.PI / 2;
  group.add(sock);

  // Small lighthouse on island B, with a lamp that spins in update().
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.8, 10, 10), mat(0xf2f2e8));
  tower.position.set(428, 7, 412);
  group.add(tower);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2, 10), mat(0x222222));
  lampRoom.position.set(428, 12.6, 412);
  group.add(lampRoom);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 22, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  beam.position.set(428, 12.6, 412);
  beam.rotation.z = Math.PI / 2;
  group.add(beam);
  colliders.push({ minX: 425, maxX: 431, minZ: 409, maxZ: 415 });

  // Pier on the west side of island A where boats dock.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 26), mat(0x8a6a45));
  pier.position.set(302, 1.4, 340);
  group.add(pier);
  // Mooring buoys bobbing off the pier so boats can find the dock at night.
  for (let i = 0; i < 3; i += 1) {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), mat(0xff5533));
    buoy.position.set(296, 1.2, 328 + i * 12);
    group.add(buoy);
  }
  for (let i = 0; i < 4; i += 1) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), mat(0x5a4028));
    pile.position.set(300 + (i % 2) * 4, 0.8, 330 + i * 6.5);
    group.add(pile);
  }

  function beachBarPosition() { return new THREE.Vector3(330, 2, 330); }
  function airstripPosition() { return new THREE.Vector3(352, 2.3, 348); }

  return {
    group, bar, sign, beachBarPosition, airstripPosition,
    update(dt) { beam.rotation.y += dt * 0.9; },
  };
}
