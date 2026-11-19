// Little Havana — Cuban quarter in the south-west (x -260 to -170, z 60 to
// 200): colorful row houses, a domino park with plaza and benches, a salsa
// club, a cigar shop, murals, palm trees, and narrow streets with parked
// lowriders and string lights.
import * as THREE from 'three';

export function createHavana(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const group = new THREE.Group();
  group.name = 'LittleHavana';
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
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) addCollider(x, z, w, d);
    return mesh;
  }

  function palm(x, z, lean = 0) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.38, 6, 7),
      new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 })
    );
    trunk.position.set(x, 3, z);
    trunk.rotation.z = lean;
    group.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 3.4, 4),
        new THREE.MeshStandardMaterial({ color: 0x2e8a3a, roughness: 1 })
      );
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.4 + lean * 3, 6.2, z + Math.sin(a) * 1.4);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      group.add(frond);
    }
    addCollider(x, z, 1, 1);
  }

  // Narrow streets: 8 m wide, running north-south and east-west.
  const streetMat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1 });
  for (const [x, z, w, d] of [[-215, 130, 8, 140], [-245, 130, 60, 8], [-185, 130, 60, 8], [-215, 90, 90, 8], [-215, 170, 90, 8]]) {
    const street = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), streetMat);
    street.position.set(x, 0.15, z);
    street.receiveShadow = true;
    group.add(street);
  }

  // Colorful row houses lining the streets.
  const houseColors = [0xe8a82a, 0x2a9ad8, 0xd84a6a, 0x2ad8a8, 0xf0e060, 0xe86a2a, 0x8a4ad8, 0x4ad82a];
  const houses = [
    { x: -248, z: 78, w: 12, d: 10, h: 7 }, { x: -228, z: 78, w: 12, d: 10, h: 9 },
    { x: -202, z: 78, w: 12, d: 10, h: 7 }, { x: -182, z: 78, w: 12, d: 10, h: 8 },
    { x: -248, z: 102, w: 12, d: 10, h: 8 }, { x: -182, z: 102, w: 12, d: 10, h: 7 },
    { x: -248, z: 158, w: 12, d: 10, h: 9 }, { x: -228, z: 158, w: 12, d: 10, h: 7 },
    { x: -202, z: 158, w: 12, d: 10, h: 8 }, { x: -182, z: 158, w: 12, d: 10, h: 9 },
    { x: -248, z: 182, w: 12, d: 10, h: 7 }, { x: -228, z: 182, w: 12, d: 10, h: 8 },
    { x: -202, z: 182, w: 12, d: 10, h: 7 }, { x: -182, z: 182, w: 12, d: 10, h: 9 },
  ];
  for (let i = 0; i < houses.length; i += 1) {
    const h = houses[i];
    box(h.x, 0, h.z, h.w, h.h, h.d, houseColors[i % houseColors.length], true);
    // Flat roof with a parapet and a water tank.
    box(h.x, h.h, h.z, h.w + 0.4, 0.6, h.d + 0.4, 0x6a5a4a);
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.6, metalness: 0.4 })
    );
    tank.position.set(h.x + h.w / 4, h.h + 1.4, h.z);
    group.add(tank);
    // Shutters and a door.
    for (let w = 0; w < 2; w += 1) {
      box(h.x - 3 + w * 6, 3.5, h.z + h.d / 2 + 0.05, 1.8, 2, 0.1, 0x2a4a3a);
    }
    box(h.x, 0, h.z + h.d / 2 + 0.05, 2, 3.4, 0.15, 0x4a2a1a);
  }

  // Domino park at (-215, 130): plaza, domino tables, benches, old men at play.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 14, 0.4, 20),
    new THREE.MeshStandardMaterial({ color: 0xc8b89a, roughness: 1 })
  );
  plaza.position.set(-215, 0.2, 130);
  plaza.receiveShadow = true;
  group.add(plaza);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = -215 + Math.cos(a) * 8;
    const z = 130 + Math.sin(a) * 8;
    box(x, 0.4, z, 3.4, 0.9, 3.4, 0x7a5a38, true);
    // Domino tiles on the table.
    for (let d = 0; d < 4; d += 1) {
      box(x - 1 + d * 0.7, 1.3, z - 0.5 + (d % 2) * 0.8, 0.6, 0.08, 1.1, 0xf0f0e8);
    }
    for (let b = 0; b < 4; b += 1) {
      const ba = (b / 4) * Math.PI * 2;
      box(x + Math.cos(ba) * 3, 0.4, z + Math.sin(ba) * 3, 1.2, 0.5, 1.2, 0x5a3a22, true);
    }
  }
  // Park sign.
  box(-215, 0.4, 117, 6, 1.4, 0.3, 0x2a6a4a);

  // Salsa club: bright pink building with a neon sign band and a dance floor.
  box(-196, 0, 112, 16, 9, 12, 0xd82a7a, true);
  const neon = new THREE.Mesh(
    new THREE.BoxGeometry(14, 1.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xff4aa8, emissive: 0xff2a9a, emissiveIntensity: 1.6 })
  );
  neon.position.set(-196, 8, 105.8);
  group.add(neon);
  box(-196, 0, 105.8, 4, 5, 0.3, 0x1a1a22);
  // Dance floor tiles inside the doorway glow.
  for (let i = 0; i < 6; i += 1) {
    box(-200 + (i % 3) * 4, 0.1, 108 + Math.floor(i / 3) * 3, 3, 0.1, 2.4, i % 2 ? 0x2a2a3a : 0xf0f0e8);
  }

  // Cigar shop next to the club.
  box(-178, 0, 118, 10, 6, 9, 0x6a4a2a, true);
  box(-178, 0, 113.4, 5, 1.2, 0.3, 0xd8b85a);
  box(-178, 3, 113.4, 2, 2, 0.1, 0x8a5a2a);

  // Murals on the walls: bright painted panels.
  const muralColors = [0xe82a2a, 0x2ad8d8, 0xf0c82a, 0x8a2ad8];
  for (let i = 0; i < 4; i += 1) {
    const mural = new THREE.Mesh(
      new THREE.BoxGeometry(6, 4, 0.15),
      new THREE.MeshStandardMaterial({ color: muralColors[i], roughness: 0.9 })
    );
    mural.position.set(-248 + i * 22, 4, 88.2);
    group.add(mural);
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe060, roughness: 0.9 })
    );
    sun.position.set(-248 + i * 22, 4.8, 88.3);
    group.add(sun);
  }

  // String lights across the main street.
  for (let s = 0; s < 3; s += 1) {
    const z = 96 + s * 34;
    for (let i = 0; i < 10; i += 1) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1 })
      );
      bulb.position.set(-238 + i * 4.8, 5.4 - Math.sin((i / 9) * Math.PI) * 1, z);
      group.add(bulb);
    }
  }

  // Parked lowriders along the narrow streets (decorative, W4 owns driving).
  for (const [x, z, color] of [[-228, 96, 0xd82a4a], [-202, 164, 0x2a8ad8], [-240, 176, 0xf0c82a]]) {
    box(x, 0.3, z, 4.6, 0.7, 2, color, true);
    box(x - 0.3, 0.9, z, 2.4, 0.6, 1.8, 0x222228);
    for (const [wx, wz] of [[-1.6, 0.95], [1.6, 0.95], [-1.6, -0.95], [1.6, -0.95]]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x + wx, 0.4, z + wz);
      group.add(wheel);
    }
  }

  // Palms along the streets.
  palm(-240, 84, 0.06);
  palm(-190, 84, -0.05);
  palm(-240, 196, 0.08);
  palm(-190, 196, -0.06);
  palm(-224, 130, 0.05);
  palm(-206, 130, -0.05);
  // Street vendor cart selling fruit and iced drinks on the main street.
  box(-208, 0.4, 100, 2.6, 1, 1.6, 0xe8a82a, true);
  const cartRoof = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.2, 2),
    new THREE.MeshStandardMaterial({ color: 0xd84a6a, roughness: 0.9 })
  );
  cartRoof.position.set(-208, 2.8, 100);
  group.add(cartRoof);
  for (const [px, pz] of [[-208.6, 99.4], [-207.4, 99.4], [-208.6, 100.6], [-207.4, 100.6]]) {
    box(px, 0.4, pz, 0.25, 0.25, 0.25, 0x111111);
  }
  for (let f = 0; f < 5; f += 1) {
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 6, 5),
      new THREE.MeshStandardMaterial({ color: [0xe84a2a, 0xf0c82a, 0x2a8a3a, 0xe8a82a, 0xd84a6a][f], roughness: 0.7 })
    );
    fruit.position.set(-209 + f * 0.5, 1.1, 100);
    group.add(fruit);
  }

  if (world.city) {
    if (!world.city.colliders) world.city.colliders = [];
    world.city.colliders.push(...colliders);
    if (!world.city.districts) world.city.districts = {};
    world.city.districts.havana = { name: 'Little Havana', colliders };
  }
  if (!world.districts) world.districts = {};
  world.districts.havana = { name: 'Little Havana', colliders };

  return {
    name: 'havana',
    group,
    colliders,
    dominoParkPosition() {
      return { x: -215, y: 0.4, z: 130 };
    },
    salsaClubPosition() {
      return { x: -196, y: 0, z: 112 };
    },
    cigarShopPosition() {
      return { x: -178, y: 0, z: 118 };
    },
    update() {},
  };
}
