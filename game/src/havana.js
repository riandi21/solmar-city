// havana.js — Cuban quarter SW, x -260..-170, z 60..200.
// Colourful row houses, domino park with plaza and benches at (-215,130),
// a salsa club, cigar shop, murals, palm trees and narrow streets.
// Parked lowriders and string lights.
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

export function createHavana(scene, world) {
  if (!world.city) world.city = { colliders: [] };
  if (!world.city.colliders) world.city.colliders = [];
  const colliders = world.city.colliders;
  const rng = () => world.rng();
  const group = new THREE.Group();
  group.name = 'havana';
  scene.add(group);

  // Narrow streets: two crossing asphalt strips, narrower than city roads.
  const streetMat = mat(0x3a3a3e, 0.95);
  const streetA = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 140), streetMat);
  streetA.position.set(-215, 0.1, 130);
  streetA.receiveShadow = true;
  group.add(streetA);
  const streetB = new THREE.Mesh(new THREE.BoxGeometry(90, 0.2, 6), streetMat);
  streetB.position.set(-215, 0.1, 130);
  streetB.receiveShadow = true;
  group.add(streetB);

  // Colourful row houses lining both streets.
  const houseCols = [0xff7a5a, 0xffc93a, 0x3ad9a0, 0x3a9ad9, 0xd95ab0, 0x9ad93a, 0xff9a3a];
  const houses = [];
  for (let i = 0; i < 14; i += 1) {
    const along = i < 7;
    const t = i % 7;
    const x = along ? -252 + t * 12 : -252 + (t % 2) * 74;
    const z = along ? 78 + (t % 2) * 104 : 78 + t * 15;
    if (Math.abs(x + 215) < 10 && Math.abs(z - 130) < 12) continue; // domino park plot
    const h = 6 + rng() * 4;
    const house = box(group, colliders, 10, h, 8, x, h / 2, z, mat(houseCols[i % houseCols.length]), true);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.5, 8.6), mat(0x8a4a2a));
    roof.position.set(x, h + 0.3, z);
    group.add(roof);
    // Shutter windows as thin bright panels.
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.15), mat(0xf2f2e8));
    win.position.set(x - 2.5, h * 0.6, z + 4.1);
    group.add(win);
    houses.push(house);
  }

  // Domino park at (-215,130): plaza, benches, domino tables, palms.
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 22), mat(0xc9b890));
  plaza.position.set(-215, 0.15, 130);
  plaza.receiveShadow = true;
  group.add(plaza);
  const tables = [];
  for (let i = 0; i < 4; i += 1) {
    const tx = -224 + (i % 2) * 18;
    const tz = 124 + Math.floor(i / 2) * 12;
    const table = box(group, colliders, 4, 1, 2.4, tx, 0.8, tz, mat(0x6a4a2a), true);
    tables.push(table);
    for (let s = 0; s < 2; s += 1) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 0.9), mat(0x8a6a45));
      bench.position.set(tx, 0.6, tz + (s === 0 ? -2 : 2));
      group.add(bench);
    }
    // Domino tiles on the table: two white slabs with black dots.
    for (let d = 0; d < 2; d += 1) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.6), mat(0xf2f2e8));
      tile.position.set(tx - 0.8 + d * 1.6, 1.4, tz);
      tile.rotation.y = (rng() - 0.5) * 0.6;
      group.add(tile);
    }
  }
  for (let i = 0; i < 6; i += 1) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), mat(0x6a4a2a));
    bench.position.set(-226 + i * 4.4, 0.7, 139);
    group.add(bench);
  }
  colliders.push({ minX: -228, maxX: -202, minZ: 119, maxZ: 141 });

  // Salsa club: pink facade, glowing sign band, dance floor glow inside the door.
  const club = box(group, colliders, 16, 8, 12, -240, 4, 168, mat(0xd95ab0), true);
  const clubSign = box(group, colliders, 12, 1.6, 0.3, -240, 7.4, 174.2, mat(0xffc93a), false);
  const clubDoor = box(group, colliders, 3, 4.5, 0.3, -240, 2.3, 174.2,
    new THREE.MeshBasicMaterial({ color: 0xff7ad9 }), false);

  // Cigar shop next door, with a humidor counter visible through the window band.
  const cigar = box(group, colliders, 10, 6, 9, -226, 3, 168, mat(0x7a4a2a), true);
  const cigarSign = box(group, colliders, 8, 1.2, 0.3, -226, 5.6, 172.7, mat(0x3a6a2a), false);

  // Murals: big flat colour panels on house walls.
  const muralCols = [0xff5a3a, 0x3ad9d9, 0xffd93a, 0x9a3ad9];
  for (let i = 0; i < 4; i += 1) {
    const mural = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.2), mat(muralCols[i]));
    mural.position.set(-252 + i * 24, 4, 96);
    group.add(mural);
  }

  // Palm trees along the streets.
  const trunkMat = mat(0x7a5a35);
  const leafMat = mat(0x3d8a3d);
  for (let i = 0; i < 16; i += 1) {
    const x = -254 + rng() * 78;
    const z = 66 + rng() * 128;
    if (Math.abs(x + 215) < 5 || Math.abs(z - 130) < 5) continue;
    const h = 5 + rng() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), trunkMat);
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = (rng() - 0.5) * 0.2;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2, 6), leafMat);
    crown.position.set(x, h + 0.6, z);
    group.add(crown);
  }

  // Parked lowriders: low boxy bodies with chrome bumpers and whitewall wheels.
  const lowriderCols = [0xc93a8a, 0x3ac9a0, 0xd9a03a];
  const lowriders = [];
  for (let i = 0; i < 3; i += 1) {
    const x = -222 + i * 14;
    const z = 96 + (i % 2) * 68;
    const body = box(group, colliders, 4.6, 0.9, 2, x, 0.7, z, mat(lowriderCols[i], 0.35), true);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.8), mat(0x222831, 0.3));
    cabin.position.set(x - 0.3, 1.5, z);
    group.add(cabin);
    for (const wx of [-1.5, 1.5]) {
      for (const wz of [-0.9, 0.9]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10), mat(0xf2f2e8));
        wheel.position.set(x + wx, 0.45, z + wz);
        wheel.rotation.x = Math.PI / 2;
        group.add(wheel);
      }
    }
    lowriders.push(body);
  }

  // String lights strung across the park: catenary-ish line of small glowing bulbs.
  const bulbs = [];
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
    bulb.position.set(-228 + t * 26, 6 - Math.sin(t * Math.PI) * 1.2, 130);
    group.add(bulb);
    bulbs.push(bulb);
  }
  // Conga drums by the club door for the street musicians.
  for (let i = 0; i < 3; i += 1) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.1, 8), mat(0x7a4a2a));
    drum.position.set(-234 + i * 1.4, 0.9, 176);
    group.add(drum);
    const drumTop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8), mat(0xf2e8d0));
    drumTop.position.set(-234 + i * 1.4, 1.5, 176);
    group.add(drumTop);
  }

  function dominoParkPosition() { return new THREE.Vector3(-215, 0, 130); }
  function salsaClubPosition() { return new THREE.Vector3(-240, 0, 168); }

  return {
    group, houses, tables, club, cigar, lowriders, dominoParkPosition, salsaClubPosition,
    update(dt) {
      for (let i = 0; i < bulbs.length; i += 1) {
        bulbs[i].material.color.setHSL(0.12, 0.9, 0.6 + Math.sin(dt * 2 + i) * 0.15);
      }
    },
  };
}
