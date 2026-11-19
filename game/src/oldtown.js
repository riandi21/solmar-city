// Old Town — the historic quarter around (-203, -87) and (-203, -29): old
// brick buildings around a plaza with a fountain, and the lighthouse with a
// rotating beam on the south-west beach at (-270, 300).
import * as THREE from 'three';

export function createOldTown(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const group = new THREE.Group();
  group.name = 'OldTown';
  scene.add(group);
  const colliders = [];
  let beam = null;
  let beamLight = null;

  function addCollider(x, z, w, d) {
    const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
    colliders.push(c);
    return c;
  }

  function box(x, y, z, w, h, d, color, collide = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) addCollider(x, z, w, d);
    return mesh;
  }

  // Plaza: a round stone square with a fountain at its heart.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, 0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0xb8ac96, roughness: 1 })
  );
  plaza.position.set(-203, 0.2, -58);
  plaza.receiveShadow = true;
  group.add(plaza);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.6, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1 })
  );
  basin.position.set(-203, 0.8, -58);
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a9ad8, roughness: 0.2 })
  );
  water.position.set(-203, 1.3, -58);
  group.add(water);
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 })
  );
  spout.position.set(-203, 1.8, -58);
  group.add(spout);
  addCollider(-203, -58, 11, 11);

  // Benches and lamps around the plaza.
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const x = -203 + Math.cos(a) * 15;
    const z = -58 + Math.sin(a) * 15;
    box(x, 0.4, z, 2.6, 0.5, 0.9, 0x6a4a2a, true);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 4.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    pole.position.set(x + 2.5, 2.6, z);
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdf80, emissiveIntensity: 0.9 })
    );
    lamp.position.set(x + 2.5, 5, z);
    group.add(lamp);
  }

  // Old brick buildings ringing the plaza and filling the two blocks.
  const brick = [0x9a5a44, 0x8a6a4a, 0xa87a52, 0x7a5a4a, 0x96684a];
  const spots = [
    { x: -232, z: -87, w: 16, d: 14, h: 11 },
    { x: -232, z: -29, w: 15, d: 13, h: 9 },
    { x: -174, z: -87, w: 17, d: 14, h: 13 },
    { x: -174, z: -29, w: 14, d: 12, h: 8 },
    { x: -203, z: -100, w: 18, d: 10, h: 10 },
    { x: -203, z: -16, w: 18, d: 10, h: 12 },
    { x: -246, z: -58, w: 12, d: 16, h: 9 },
    { x: -160, z: -58, w: 12, d: 16, h: 10 },
  ];
  for (let i = 0; i < spots.length; i += 1) {
    const s = spots[i];
    box(s.x, 0, s.z, s.w, s.h, s.d, brick[i % brick.length], true);
    // Shuttered windows and a striped awning over the ground floor.
    for (let w = 0; w < 3; w += 1) {
      box(s.x - s.w / 2 + 4 + w * 5, 5, s.z + s.d / 2 + 0.05, 1.8, 2, 0.1, 0x2a3a4a);
      box(s.x - s.w / 2 + 4 + w * 5, 8.5, s.z + s.d / 2 + 0.05, 1.8, 2, 0.1, 0x2a3a4a);
    }
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(s.w * 0.8, 0.3, 3),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd84a3a : 0x2a8a6a, roughness: 0.9 })
    );
    awning.position.set(s.x, 3.4, s.z + s.d / 2 + 1.4);
    awning.rotation.x = 0.25;
    group.add(awning);
    // Chimney.
    box(s.x + s.w / 3, s.h, s.z, 1.4, 2.4, 1.4, 0x6a4a3a);
  }

  // Cobble side streets between the blocks.
  const cobble = new THREE.MeshStandardMaterial({ color: 0x8a8074, roughness: 1 });
  for (const [x, z, w, d] of [[-203, -87, 10, 30], [-203, -29, 10, 30], [-218, -58, 30, 10]]) {
    const street = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), cobble);
    street.position.set(x, 0.15, z);
    street.receiveShadow = true;
    group.add(street);
  }
  // Sundial at the plaza edge and a clock face on the tallest plaza building.
  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.6, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 })
  );
  dial.position.set(-188, 0.7, -46);
  group.add(dial);
  box(-188, 1, -46, 0.2, 1.4, 1.2, 0xd8a82a);
  const clock = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 20),
    new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.8 })
  );
  clock.position.set(-174, 11, -79.8);
  group.add(clock);
  box(-174, 11, -79.7, 0.15, 2.6, 0.15, 0x222222);
  box(-174, 11, -79.7, 1.8, 0.15, 0.15, 0x222222);

  // Market stalls in the plaza corners.
  for (let i = 0; i < 4; i += 1) {
    const x = -216 + (i % 2) * 26;
    const z = -70 + Math.floor(i / 2) * 24;
    box(x, 0.4, z, 3, 1, 2, 0x7a5a38, true);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.2, 2.6),
      new THREE.MeshStandardMaterial({ color: [0xe8a82a, 0x2a8a3a, 0xd84a6a, 0x2a6ad8][i], roughness: 0.9 })
    );
    canopy.position.set(x, 2.6, z);
    group.add(canopy);
    for (let f = 0; f < 4; f += 1) {
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 6, 5),
        new THREE.MeshStandardMaterial({ color: [0xe84a2a, 0xf0c82a, 0x2a8a3a, 0xe8a82a][f], roughness: 0.7 })
      );
      fruit.position.set(x - 1 + f * 0.7, 1.2, z);
      group.add(fruit);
    }
  }

  // Lighthouse on the south-west beach at (-270, 300), sea starting near z 330.
  const sand = new THREE.Mesh(
    new THREE.BoxGeometry(70, 1, 60),
    new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 1 })
  );
  sand.position.set(-270, 0.4, 300);
  sand.receiveShadow = true;
  group.add(sand);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.4, 22, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0ede2, roughness: 0.8 })
  );
  tower.position.set(-270, 11.5, 300);
  tower.castShadow = true;
  group.add(tower);
  // Red bands around the tower.
  for (const y of [7, 15]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.8, 2.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xc82a2a, roughness: 0.8 })
    );
    band.position.set(-270, y, 300);
    group.add(band);
  }
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.5 })
  );
  lampRoom.position.set(-270, 23.5, 300);
  group.add(lampRoom);
  beamLight = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe680, emissiveIntensity: 3 })
  );
  beamLight.position.set(-270, 23.5, 300);
  group.add(beamLight);
  beam = new THREE.Mesh(
    new THREE.ConeGeometry(4, 34, 12, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xfff2b0, emissive: 0xffe680, emissiveIntensity: 0.7,
      transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  beam.position.set(-270, 23.5, 300);
  beam.rotation.z = Math.PI / 2;
  beam.translateY(-17);
  group.add(beam);
  addCollider(-270, 300, 9, 9);
  // Keeper's cottage beside the lighthouse.
  box(-252, 0.8, 312, 9, 5, 7, 0xe8d8b8, true);

  if (world.city) {
    if (!world.city.colliders) world.city.colliders = [];
    world.city.colliders.push(...colliders);
    if (!world.city.districts) world.city.districts = {};
    world.city.districts.oldtown = { name: 'Old Town', colliders };
  }
  if (!world.districts) world.districts = {};
  world.districts.oldtown = { name: 'Old Town', colliders };

  return {
    name: 'oldtown',
    group,
    colliders,
    plazaPosition() {
      return { x: -203, y: 0.4, z: -58 };
    },
    lighthousePosition() {
      return { x: -270, y: 23.5, z: 300 };
    },
    update(dt) {
      if (beam) beam.rotation.y += dt * 0.6;
    },
  };
}
