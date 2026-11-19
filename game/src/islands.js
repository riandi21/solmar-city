// Islands — offshore island chain south-east of the marina. Two small islands
// connected by a bridge, a beach bar, palm trees, a hidden airstrip for the
// seaplane, and a small lighthouse. Boats can dock at the pier.
import * as THREE from 'three';

export function createIslands(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const group = new THREE.Group();
  group.name = 'Islands';
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

  // Island land: two low sand discs rising out of the sea.
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 1 });
  const islandA = new THREE.Mesh(new THREE.CylinderGeometry(52, 58, 3, 24), sandMat);
  islandA.position.set(360, 0.5, 350);
  islandA.receiveShadow = true;
  group.add(islandA);
  const islandB = new THREE.Mesh(new THREE.CylinderGeometry(38, 44, 3, 20), sandMat);
  islandB.position.set(425, 0.5, 415);
  islandB.receiveShadow = true;
  group.add(islandB);
  // Grassy centres.
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d8a3a, roughness: 1 });
  const lawnA = new THREE.Mesh(new THREE.CylinderGeometry(34, 36, 0.6, 20), grassMat);
  lawnA.position.set(360, 2.2, 350);
  group.add(lawnA);
  const lawnB = new THREE.Mesh(new THREE.CylinderGeometry(24, 26, 0.6, 16), grassMat);
  lawnB.position.set(425, 2.2, 415);
  group.add(lawnB);

  // Wooden bridge between the islands.
  for (let i = 0; i < 10; i += 1) {
    const t = i / 9;
    const x = 385 + t * 22;
    const z = 372 + t * 22;
    box(x, 2.4, z, 5, 0.4, 3.4, 0x9a7a52);
  }
  box(385, 2.4, 372, 2, 1, 30, 0x7a5a38);
  box(407, 2.4, 394, 2, 1, 30, 0x7a5a38);

  // Beach bar on island A, with counter, stools and a thatch roof.
  box(370, 2.4, 360, 10, 4, 6, 0xf0e0b8, true);
  const thatch = new THREE.Mesh(
    new THREE.ConeGeometry(8, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0xc8a85a, roughness: 1 })
  );
  thatch.position.set(370, 8.2, 360);
  thatch.rotation.y = Math.PI / 4;
  group.add(thatch);
  box(370, 2.4, 354.5, 11, 1.1, 1.2, 0x7a4a28, true);
  for (let i = 0; i < 4; i += 1) {
    const stool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: 0xd84a6a, roughness: 0.8 })
    );
    stool.position.set(366 + i * 2.6, 2.9, 352.5);
    group.add(stool);
  }
  // Bottles and glasses on the counter.
  for (let i = 0; i < 5; i += 1) {
    box(366 + rng() * 8, 3.5, 354.5, 0.3, 0.7 + rng() * 0.5, 0.3, [0x2a8a3a, 0xd8a82a, 0x8a2a2a][i % 3]);
  }
  // String lights over the bar.
  for (let i = 0; i < 8; i += 1) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1 })
    );
    bulb.position.set(364 + i * 1.7, 6.4 - Math.sin((i / 7) * Math.PI) * 0.8, 356);
    group.add(bulb);
  }

  // Hidden airstrip on island B: flat grass strip with a windsock and a hut.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.3, 70),
    new THREE.MeshStandardMaterial({ color: 0x6a7a4a, roughness: 1 })
  );
  strip.position.set(425, 2.4, 415);
  strip.receiveShadow = true;
  group.add(strip);
  for (let i = 0; i < 5; i += 1) {
    box(425, 2.5, 385 + i * 15, 8, 0.15, 1.2, 0xf0f0e0);
  }
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xe84a2a, roughness: 0.8 })
  );
  sock.position.set(432, 6, 388);
  sock.rotation.z = Math.PI / 2;
  group.add(sock);
  box(432, 2.4, 388, 0.3, 6, 0.3, 0x888888);
  box(418, 2.4, 440, 6, 3.5, 5, 0x8a7a5a, true);

  // Small lighthouse on the far tip of island B.
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.2, 11, 10),
    new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.8 })
  );
  tower.position.set(448, 8, 438);
  tower.castShadow = true;
  group.add(tower);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 2, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5 })
  );
  lampRoom.position.set(448, 14, 438);
  group.add(lampRoom);
  const beamLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe680, emissiveIntensity: 2 })
  );
  beamLight.position.set(448, 14, 438);
  group.add(beamLight);
  addCollider(448, 438, 5, 5);

  // Wooden pier where boats dock, on the west shore of island A.
  for (let i = 0; i < 8; i += 1) {
    box(312 - i * 2.2, 1.6, 350, 2.4, 0.4, 5, 0x9a7a52);
  }
  box(308, 1.6, 350, 4, 1, 6, 0x7a5a38, true);

  // Palms and beach umbrellas.
  palm(340, 330, 0.08);
  palm(382, 372, -0.06);
  palm(352, 388, 0.1);
  palm(410, 400, -0.08);
  palm(438, 392, 0.05);
  // Lifeguard tower on the main beach, watching the lagoon.
  box(336, 2.4, 372, 0.4, 5, 0.4, 0xf0f0e8);
  box(340, 2.4, 372, 0.4, 5, 0.4, 0xf0f0e8);
  box(338, 7.2, 372, 4.4, 0.5, 3.4, 0xf0f0e8, true);
  box(338, 7.7, 372, 4.8, 0.3, 3.8, 0xe82a2a);
  box(338, 7.7, 370.4, 3, 1.2, 0.2, 0x2ad8d8);
  for (let i = 0; i < 4; i += 1) {
    const ux = 330 + rng() * 60;
    const uz = 330 + rng() * 40;
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: [0xe84a6a, 0x2a8ad8, 0xf0a82a, 0x2ad8a8][i], roughness: 0.9 })
    );
    shade.position.set(ux, 3.8, uz);
    group.add(shade);
    box(ux, 2.4, uz, 0.15, 2.6, 0.15, 0xdddddd);
  }

  if (world.city) {
    if (!world.city.colliders) world.city.colliders = [];
    world.city.colliders.push(...colliders);
    if (!world.city.districts) world.city.districts = {};
    world.city.districts.islands = { name: 'Islands', colliders };
  }
  if (!world.districts) world.districts = {};
  world.districts.islands = { name: 'Islands', colliders };

  return {
    name: 'islands',
    group,
    colliders,
    land: [
      { minX: 308, maxX: 412, minZ: 298, maxZ: 402 },
      { minX: 387, maxX: 463, minZ: 377, maxZ: 453 },
    ],
    beachBarPosition() {
      return { x: 370, y: 2.4, z: 360 };
    },
    airstripPosition() {
      return { x: 425, y: 2.4, z: 415 };
    },
    pierPosition() {
      return { x: 308, y: 2, z: 350 };
    },
    update() {},
  };
}
