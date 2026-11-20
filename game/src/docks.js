// docks.js — Container yard NW, x -260..-170, z -260..-170.
// Stacked containers, warehouses and gantry cranes. The cartel warehouse
// at (-215,-215) carries a visible marker.
import * as THREE from 'three';

function mat(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.15 });
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

export function createDocks(scene, world) {
  if (!world.city) world.city = { colliders: [] };
  if (!world.city.colliders) world.city.colliders = [];
  const colliders = world.city.colliders;
  const rng = () => world.rng();
  const group = new THREE.Group();
  group.name = 'docks';
  scene.add(group);

  // Concrete yard slab.
  const yard = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 90), mat(0x8a8a82, 1));
  yard.position.set(-215, 0, -215);
  yard.receiveShadow = true;
  group.add(yard);

  // Stacked containers in rows, with varied colours and stack heights.
  const contCols = [0xc93a2a, 0x2a6ac9, 0x2a9a4a, 0xd9a03a, 0x7a5a9a, 0x3a8a8a];
  const containers = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const x = -248 + col * 13;
      const z = -248 + row * 18;
      if (Math.abs(x + 215) < 16 && Math.abs(z + 215) < 14) continue; // cartel warehouse plot
      const stack = 1 + Math.floor(rng() * 3);
      for (let s = 0; s < stack; s += 1) {
        const c = box(group, colliders, 11, 2.6, 2.6, x, 1.6 + s * 2.6, z,
          mat(contCols[(row * 6 + col + s) % contCols.length]), s === 0);
        containers.push(c);
      }
    }
  }

  // Warehouses along the north edge.
  const warehouses = [];
  for (let i = 0; i < 3; i += 1) {
    const x = -246 + i * 31;
    const w = box(group, colliders, 24, 8, 14, x, 4, -252, mat(0x9a9a92), true);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 24, 8, 1, false, 0, Math.PI), mat(0x6a6a62));
    roof.position.set(x, 8, -252);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    group.add(roof);
    warehouses.push(w);
  }

  // Gantry cranes: two legs, a top beam and a hanging hook block.
  const cranes = [];
  const craneMat = mat(0xd9a03a, 0.6);
  for (let i = 0; i < 2; i += 1) {
    const x = -238 + i * 44;
    const z = -196;
    const legA = box(group, colliders, 2, 22, 2, x - 8, 11, z, craneMat, true);
    const legB = box(group, colliders, 2, 22, 2, x + 8, 11, z, craneMat, true);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 2.4), craneMat);
    beam.position.set(x, 22, z);
    group.add(beam);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 26), craneMat);
    jib.position.set(x, 22, z - 12);
    group.add(jib);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 6), mat(0x222222));
    cable.position.set(x + 4, 17, z - 20);
    group.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat(0x333333));
    hook.position.set(x + 4, 12.5, z - 20);
    group.add(hook);
    cranes.push({ legA, legB, beam, hook });
  }

  // Cartel warehouse at (-215,-215) with a visible red marker beacon.
  const cartel = box(group, colliders, 18, 9, 14, -215, 4.5, -215, mat(0x5a5a52), true);
  const cartelDoor = box(group, colliders, 6, 6, 0.4, -215, 3, -207.8, mat(0x2a2a26), false);
  const beaconPole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 6), mat(0xdddddd));
  beaconPole.position.set(-215, 10.5, -215);
  group.add(beaconPole);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  beacon.position.set(-215, 12.4, -215);
  group.add(beacon);
  // A forklift parked by the cartel warehouse door, mid-shift.
  const forkBody = box(group, colliders, 3, 1.6, 2, -206, 1.1, -212, mat(0xd9a03a, 0.5), true);
  const forkMast = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 1.8), mat(0x333333));
  forkMast.position.set(-204.4, 2, -212);
  group.add(forkMast);
  const sign = box(group, colliders, 10, 1.6, 0.3, -215, 8.2, -207.8, mat(0xff2222), false);

  function cartelWarehousePosition() { return new THREE.Vector3(-215, 0, -215); }

  return {
    group, containers, warehouses, cranes, cartel, cartelWarehousePosition,
    update(dt) { beacon.material.color.setHSL(0, 0.9, 0.45 + Math.sin(dt * 0.001) * 0.1); },
  };
}
