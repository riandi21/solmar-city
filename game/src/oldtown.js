// oldtown.js — Old town district around blocks (-203,-87) and (-203,-29), with a plaza.
// The lighthouse stands at (-270,300) on the SW beach (sea starts ~z 330) and its
// beam rotates in update().
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

export function createOldTown(scene, world) {
  if (!world.city) world.city = { colliders: [] };
  if (!world.city.colliders) world.city.colliders = [];
  const colliders = world.city.colliders;
  const rng = () => world.rng();
  const group = new THREE.Group();
  group.name = 'oldtown';
  scene.add(group);

  // Cobble plaza between the two blocks.
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(46, 0.3, 34), mat(0xb0a890));
  plaza.position.set(-203, 0.15, -58);
  plaza.receiveShadow = true;
  group.add(plaza);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 1.2, 12), mat(0x9a9a92));
  fountain.position.set(-203, 0.9, -58);
  group.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x3fa8c8, roughness: 0.15 }));
  water.position.set(-203, 1.4, -58);
  group.add(water);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2.2, 8), mat(0x8d8d85));
  spout.position.set(-203, 2.2, -58);
  group.add(spout);
  colliders.push({ minX: -208, maxX: -198, minZ: -63, maxZ: -53 });

  // Old buildings around both blocks: stucco walls, tile roofs, balconies, awnings.
  const wallCols = [0xe8dcc0, 0xd9b36a, 0xc9a06a, 0xe6c8a2, 0xcfb8a0];
  const blocks = [[-203, -87], [-203, -29]];
  const buildings = [];
  for (const [bx, bz] of blocks) {
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2;
      const x = bx + Math.cos(ang) * 24;
      const z = bz + Math.sin(ang) * 15;
      if (Math.abs(x + 203) < 8 && Math.abs(z + 58) < 8) continue;
      const w = 9 + rng() * 4;
      const h = 7 + rng() * 6;
      const d = 8 + rng() * 3;
      const b = box(group, colliders, w, h, d, x, h / 2, z, mat(wallCols[(i + (bx > -100 ? 1 : 0)) % wallCols.length]), true);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.6, 4), mat(0x8a4a2a));
      roof.position.set(x, h + 1.3, z);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.3, 2.4), mat(0x7a3a3a));
      awning.position.set(x, 3.2, z + d / 2 + 1);
      awning.rotation.x = 0.25;
      group.add(awning);
      buildings.push(b);
    }
  }

  // Church with a bell tower on the north block.
  const church = box(group, colliders, 12, 9, 16, -203, 4.5, -100, mat(0xf0e8d8), true);
  const tower = box(group, colliders, 4, 16, 4, -209, 8, -104, mat(0xf0e8d8), true);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 5, 4), mat(0x5a6a7a));
  spire.position.set(-209, 18.5, -104);
  spire.rotation.y = Math.PI / 4;
  group.add(spire);
  // Clock face on the bell tower so the plaza can tell the hour.
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.2, 16),
    new THREE.MeshBasicMaterial({ color: 0xf2f2e8 }));
  clock.position.set(-209, 13, -101.8);
  clock.rotation.x = Math.PI / 2;
  group.add(clock);

  // Plaza benches, lamps and market stalls.
  const benchMat = mat(0x6a4a2a);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
    bench.position.set(-203 + Math.cos(a) * 13, 0.8, -58 + Math.sin(a) * 10);
    bench.rotation.y = -a;
    group.add(bench);
  }
  for (let i = 0; i < 4; i += 1) {
    const stall = box(group, colliders, 4, 2.6, 3, -218 + i * 10, 1.6, -44, mat([0xc95a3a, 0x3a7a4a, 0x3a5a9a, 0xd9a03a][i]), true);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 3.6), mat(0xf2f2e8));
    canopy.position.set(-218 + i * 10, 3.2, -44);
    group.add(canopy);
  }

  // Lighthouse at (-270,300) on the SW beach.
  const lightBase = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 3, 12), mat(0x8d8d85));
  lightBase.position.set(-270, 1.5, 300);
  group.add(lightBase);
  const lightTower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.2, 18, 12), mat(0xf2f2e8));
  lightTower.position.set(-270, 12, 300);
  lightTower.castShadow = true;
  group.add(lightTower);
  for (let i = 0; i < 3; i += 1) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.5 - i * 0.3, 3.6 - i * 0.3, 1.6, 12), mat(0xc93a3a));
    band.position.set(-270, 7 + i * 5, 300);
    group.add(band);
  }
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.6, 12), mat(0x222222));
  lampRoom.position.set(-270, 22.2, 300);
  group.add(lampRoom);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.set(-270, 22.2, 300);
  group.add(lamp);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(3, 34, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
  beam.position.set(-270, 22.2, 300);
  beam.rotation.z = Math.PI / 2;
  group.add(beam);
  colliders.push({ minX: -277, maxX: -263, minZ: 293, maxZ: 307 });

  function lighthousePosition() { return new THREE.Vector3(-270, 0, 300); }

  return {
    group, buildings, church, lighthousePosition,
    update(dt) { beam.rotation.y += dt * 0.7; },
  };
}
