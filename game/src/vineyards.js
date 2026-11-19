// Vineyards — rural area north of North Hills. Winding country roads, a
// vineyard estate with rows of grapevines, a farmhouse, a wine cellar, and a
// hidden airstrip. Country roads are narrower than city roads, with fences
// and fields alongside.
import * as THREE from 'three';

export function createVineyards(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const group = new THREE.Group();
  group.name = 'Vineyards';
  scene.add(group);
  const colliders = [];

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

  // Rolling farmland base.
  const field = new THREE.Mesh(
    new THREE.BoxGeometry(220, 2, 62),
    new THREE.MeshStandardMaterial({ color: 0x6a8a3a, roughness: 1 })
  );
  field.position.set(0, 0.5, -290);
  field.receiveShadow = true;
  group.add(field);

  // Winding country roads: narrow (5 m) dirt-and-gravel strips.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 });
  const bends = [
    { x: -70, z: -268, rot: 0.3, len: 40 },
    { x: -30, z: -278, rot: 1.0, len: 44 },
    { x: 12, z: -272, rot: 1.9, len: 40 },
    { x: 48, z: -284, rot: 2.6, len: 42 },
    { x: 78, z: -300, rot: 0.9, len: 36 },
    { x: 0, z: -306, rot: 0, len: 90 },
  ];
  for (const b of bends) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(b.len, 0.25, 5), roadMat);
    road.position.set(b.x, 1.6, b.z);
    road.rotation.y = b.rot;
    road.receiveShadow = true;
    group.add(road);
  }

  // Fences alongside the country roads.
  for (let i = 0; i < 30; i += 1) {
    const x = -95 + i * 6.5;
    const z = -266 + Math.sin(i * 0.5) * 6;
    box(x, 1.6, z, 0.18, 1.1, 0.18, 0x6a4a2a);
    if (i % 2 === 0) box(x + 3, 2.3, z, 6.5, 0.14, 0.14, 0x8a6a42);
  }

  // Vine rows: posts with green vine canopies, in neat blocks either side
  // of the estate drive.
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 1 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 });
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 12; col += 1) {
      const x = -78 + col * 6 + (row % 2) * 2;
      const z = -312 + row * 5;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, 0.25), postMat);
      post.position.set(x, 2.4, z);
      group.add(post);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 3.4), vineMat);
      canopy.position.set(x, 2.9, z);
      group.add(canopy);
    }
  }
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const x = 34 + col * 6;
      const z = -312 + row * 5;
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 3.4), vineMat);
      canopy.position.set(x, 2.9, z);
      group.add(canopy);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, 0.25), postMat);
      post.position.set(x, 2.4, z);
      group.add(post);
    }
  }
  // Grape clusters: small purple spheres hanging under a few canopies.
  for (let i = 0; i < 14; i += 1) {
    const grape = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x6a2a8a, roughness: 0.6 })
    );
    grape.position.set(-78 + rng() * 70, 2.3, -312 + rng() * 35);
    group.add(grape);
  }

  // The estate house at (0, -290): white walls, terracotta roof, terrace.
  box(0, 1.6, -290, 20, 8, 14, 0xf2e8d0, true);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(15, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0xa84a30, roughness: 0.9 })
  );
  roof.position.set(0, 13.5, -290);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  box(0, 1.6, -282, 12, 0.6, 6, 0xc8b890);
  for (let w = 0; w < 5; w += 1) {
    box(-8 + w * 4, 4.2, -282.8, 1.5, 1.8, 0.1, 0xffe9a8);
  }
  box(0, 1.6, -282.8, 2.4, 4, 0.3, 0x4a2a1a);
  // Terrace tables with wine glasses.
  for (let i = 0; i < 3; i += 1) {
    box(-8 + i * 8, 2.2, -280, 2.4, 0.9, 2.4, 0x8a6a42, true);
    box(-8 + i * 8, 3.1, -280, 0.25, 0.5, 0.25, 0xd8e8f0);
  }

  // Farmhouse and barn to the west.
  box(-58, 1.6, -282, 10, 5, 8, 0xe8d8b8, true);
  const barnRoof = new THREE.Mesh(
    new THREE.ConeGeometry(8, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.9 })
  );
  barnRoof.position.set(-58, 9, -282);
  barnRoof.rotation.y = Math.PI / 4;
  group.add(barnRoof);
  box(-78, 1.6, -300, 12, 6, 9, 0x9a3a2a, true);
  box(-78, 1.6, -295.4, 3, 4, 0.3, 0x4a2a1a);

  // Wine cellar: low stone building half-sunk into the ground, east side.
  box(52, 1.6, -298, 12, 3.5, 8, 0x8a8578, true);
  box(52, 1.6, -293.8, 2.6, 3, 0.3, 0x2a2018);
  const cellarRoof = new THREE.Mesh(
    new THREE.BoxGeometry(13, 0.5, 9),
    new THREE.MeshStandardMaterial({ color: 0x5a5248, roughness: 1 })
  );
  cellarRoof.position.set(52, 5.4, -298);
  group.add(cellarRoof);
  // Oak barrels outside the cellar.
  for (let i = 0; i < 6; i += 1) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 })
    );
    barrel.position.set(44 + (i % 3) * 2.4, 2.4, -290 + Math.floor(i / 3) * 2.6);
    barrel.castShadow = true;
    group.add(barrel);
    addCollider(44 + (i % 3) * 2.4, -290 + Math.floor(i / 3) * 2.6, 1.8, 1.8);
  }

  // Hidden airstrip: a mown grass strip with a windsock and a small hangar.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.25, 60),
    new THREE.MeshStandardMaterial({ color: 0x8aa85a, roughness: 1 })
  );
  strip.position.set(88, 1.6, -292);
  strip.receiveShadow = true;
  group.add(strip);
  for (let i = 0; i < 4; i += 1) {
    box(88, 1.7, -316 + i * 16, 7, 0.15, 1, 0xf0f0e0);
  }
  box(98, 1.6, -312, 8, 4.5, 10, 0x9a9a92, true);
  box(98, 1.6, -306.8, 6, 3.6, 0.3, 0x4a4a50);

  // Hay bales and olive trees in the fields.
  for (let i = 0; i < 8; i += 1) {
    const bale = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 1.8, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8b85a, roughness: 1 })
    );
    bale.rotation.z = Math.PI / 2;
    bale.position.set(-95 + rng() * 180, 2.6, -268 - rng() * 10);
    group.add(bale);
  }
  // Scarecrow guarding the vine rows, and a tasting-room sign by the drive.
  box(-24, 1.6, -288, 0.2, 2.6, 0.2, 0x5a3a22);
  box(-24, 3.6, -288, 1.8, 0.7, 0.2, 0xd84a2a);
  const scareHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 1 })
  );
  scareHead.position.set(-24, 4.4, -288);
  group.add(scareHead);
  box(-12, 1.6, -284, 0.25, 2.2, 0.25, 0xdddddd);
  box(-12, 3.4, -284, 3.4, 1.4, 0.15, 0x2a6a4a);
  for (let i = 0; i < 10; i += 1) {
    const x = -90 + rng() * 180;
    const z = -318 + rng() * 8;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 1.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a })
    );
    trunk.position.set(x, 2.4, z);
    group.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 1 })
    );
    crown.position.set(x, 4, z);
    group.add(crown);
  }

  if (world.city) {
    if (!world.city.colliders) world.city.colliders = [];
    world.city.colliders.push(...colliders);
    if (!world.city.districts) world.city.districts = {};
    world.city.districts.vineyards = { name: 'Vineyards', colliders };
  }
  if (!world.districts) world.districts = {};
  world.districts.vineyards = { name: 'Vineyards', colliders };

  return {
    name: 'vineyards',
    group,
    colliders,
    estatePosition() {
      return { x: 0, y: 1.6, z: -290 };
    },
    cellarPosition() {
      return { x: 52, y: 1.6, z: -298 };
    },
    airstripPosition() {
      return { x: 88, y: 1.6, z: -292 };
    },
    update() {},
  };
}
