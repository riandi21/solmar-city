// Sunset Beach — beach resort on the south-west beach (x -260 to -100,
// z 280 to 330): beach bars, surf shops, a bonfire pit, a beach volleyball
// court, surfboards stuck in the sand, palm trees, and a wooden pier. The
// Surf Shack property is here at (-180, 300) and the jet ski dock is at the
// pier (-150, 320). Sand is walkable and drivable at low speed.
import * as THREE from 'three';

export function createSunsetBeach(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const group = new THREE.Group();
  group.name = 'SunsetBeach';
  scene.add(group);
  const colliders = [];
  let fire = null;
  let fireLight = null;

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

  // Sand: one broad walkable/drivable beach slab. No collider — sand is open.
  const sand = new THREE.Mesh(
    new THREE.BoxGeometry(165, 1, 55),
    new THREE.MeshStandardMaterial({ color: 0xe8cf9a, roughness: 1 })
  );
  sand.position.set(-180, 0.4, 305);
  sand.receiveShadow = true;
  group.add(sand);
  // Wet sand strip near the waterline.
  const wet = new THREE.Mesh(
    new THREE.BoxGeometry(165, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.7 })
  );
  wet.position.set(-180, 0.8, 330);
  group.add(wet);

  // Boardwalk strip along the north edge of the beach.
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(165, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 1 })
  );
  walk.position.set(-180, 0.9, 281);
  group.add(walk);

  // Surf Shack property at (-180, 300): shack, board racks, for-sale sign.
  box(-180, 0.9, 300, 10, 4.5, 7, 0x2a8ad8, true);
  const shackRoof = new THREE.Mesh(
    new THREE.ConeGeometry(8, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0xf0e060, roughness: 0.9 })
  );
  shackRoof.position.set(-180, 8.4, 300);
  shackRoof.rotation.y = Math.PI / 4;
  group.add(shackRoof);
  box(-180, 0.9, 296.2, 4, 3, 0.3, 0x4a2a1a);
  // For-sale sign until bought.
  box(-172, 0.9, 295, 0.25, 2.6, 0.25, 0xdddddd);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.6, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.9 })
  );
  sign.position.set(-172, 3.6, 295);
  group.add(sign);
  box(-172, 3.6, 294.9, 2.2, 0.3, 0.05, 0xd82a2a);
  // Board rack beside the shack.
  for (let i = 0; i < 4; i += 1) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 2.6, 0.12),
      new THREE.MeshStandardMaterial({ color: [0xe82a6a, 0x2ad8a8, 0xf0a82a, 0x2a6ad8][i], roughness: 0.7 })
    );
    board.position.set(-174 + i * 1.4, 2.4, 304.5);
    board.rotation.x = -0.25;
    group.add(board);
  }

  // Beach bar (west) and surf shop (east), both open-front huts.
  box(-232, 0.9, 302, 9, 4, 6, 0xf0e0b8, true);
  const barRoof = new THREE.Mesh(
    new THREE.ConeGeometry(7, 2.6, 4),
    new THREE.MeshStandardMaterial({ color: 0xc8a85a, roughness: 1 })
  );
  barRoof.position.set(-232, 7.4, 302);
  barRoof.rotation.y = Math.PI / 4;
  group.add(barRoof);
  box(-232, 0.9, 298.8, 10, 1, 1, 0x7a4a28, true);
  for (let i = 0; i < 4; i += 1) {
    box(-235 + i * 2, 1.9, 298.8, 0.3, 0.8, 0.3, [0x2a8a3a, 0xd8a82a, 0x8a2a2a, 0x2a6ad8][i]);
  }
  box(-128, 0.9, 298, 11, 4.5, 7, 0xe86a2a, true);
  const shopRoof = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 })
  );
  shopRoof.position.set(-128, 5.7, 298);
  group.add(shopRoof);
  box(-128, 0.9, 294.2, 6, 1.2, 0.3, 0x2ad8d8);

  // Bonfire pit: stone ring, logs, and a flickering flame cone.
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const stone = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1 })
    );
    stone.position.set(-205 + Math.cos(a) * 2.2, 1.2, 316 + Math.sin(a) * 2.2);
    group.add(stone);
  }
  for (let i = 0; i < 4; i += 1) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 1 })
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 4) * Math.PI;
    log.position.set(-205, 1.3, 316);
    group.add(log);
  }
  fire = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a00, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 })
  );
  fire.position.set(-205, 2.4, 316);
  group.add(fire);
  fireLight = new THREE.PointLight(0xff8a2a, 12, 18);
  fireLight.position.set(-205, 3, 316);
  group.add(fireLight);
  // Log seats around the pit.
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    box(-205 + Math.cos(a) * 4.6, 0.9, 316 + Math.sin(a) * 4.6, 2.2, 0.6, 0.9, 0x6a4a2a, true);
  }

  // Beach volleyball court: sand lines, net, poles.
  const court = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0xdec488, roughness: 1 })
  );
  court.position.set(-150, 1, 292);
  court.receiveShadow = true;
  group.add(court);
  for (const [x, z, w, d] of [[-150, 288.2, 16, 0.3], [-150, 295.8, 16, 0.3], [-158, 292, 0.3, 8], [-142, 292, 0.3, 8]]) {
    box(x, 1.1, z, w, 0.08, d, 0xf0f0e8);
  }
  box(-150, 1, 290, 0.18, 2.6, 0.18, 0xdddddd);
  box(-150, 1, 294, 0.18, 2.6, 0.18, 0xdddddd);
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.9, transparent: true, opacity: 0.7 })
  );
  net.position.set(-150, 2.6, 292);
  group.add(net);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.8 })
  );
  ball.position.set(-146, 1.6, 294);
  group.add(ball);

  // Surfboards stuck upright in the sand, scattered along the beach.
  const boardColors = [0xe82a6a, 0x2ad8a8, 0xf0a82a, 0x2a6ad8, 0x8a2ad8, 0xe84a2a];
  for (let i = 0; i < 10; i += 1) {
    const x = -250 + rng() * 140;
    const z = 306 + rng() * 18;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 2.8, 0.1),
      new THREE.MeshStandardMaterial({ color: boardColors[i % boardColors.length], roughness: 0.7 })
    );
    board.position.set(x, 2.2, z);
    board.rotation.x = -0.18;
    board.rotation.z = (rng() - 0.5) * 0.3;
    board.castShadow = true;
    group.add(board);
  }

  // Wooden pier running south into the sea from (-150, 320).
  for (let i = 0; i < 12; i += 1) {
    box(-150, 1.2, 318 + i * 2.4, 5, 0.4, 2.6, 0x9a7a52);
    if (i % 3 === 0) {
      box(-152.2, 0.4, 318 + i * 2.4, 0.5, 1.6, 0.5, 0x6a4a2a);
      box(-147.8, 0.4, 318 + i * 2.4, 0.5, 1.6, 0.5, 0x6a4a2a);
    }
  }
  // Fishing spot marker at the pier end.
  box(-150, 1.4, 346, 2, 0.5, 2, 0x2a8ad8);
  // Jet ski dock: floating dock beside the pier end, with a rental sign.
  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x6a8a9a, roughness: 0.8 })
  );
  dock.position.set(-143, 1.2, 340);
  group.add(dock);
  box(-143, 1.4, 338, 0.25, 2.4, 0.25, 0xdddddd);
  const dockSign = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.4, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x2ad8d8, roughness: 0.8 })
  );
  dockSign.position.set(-143, 3.2, 338);
  group.add(dockSign);

  // Beach umbrellas and towels.
  for (let i = 0; i < 5; i += 1) {
    const ux = -240 + i * 28 + rng() * 6;
    const uz = 310 + rng() * 10;
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: [0xe84a6a, 0x2a8ad8, 0xf0a82a, 0x2ad8a8, 0xd82a2a][i], roughness: 0.9 })
    );
    shade.position.set(ux, 3.6, uz);
    group.add(shade);
    box(ux, 0.9, uz, 0.15, 2.6, 0.15, 0xdddddd);
    box(ux + 2.5, 1, uz + 1, 2.2, 0.15, 1.2, [0xf0a8c8, 0xa8d8f0, 0xf0e060, 0xa8f0c8, 0xd8a8f0][i]);
  }

  // Palms along the boardwalk edge.
  palm(-252, 286, 0.07);
  palm(-220, 286, -0.06);
  palm(-196, 286, 0.05);
  palm(-164, 286, -0.07);
  palm(-132, 286, 0.06);
  palm(-108, 286, -0.05);
  palm(-246, 322, 0.08);
  palm(-112, 322, -0.06);
  // Lifeguard tower at the waterline, white with a red roof.
  box(-118, 0.9, 318, 0.4, 5, 0.4, 0xf0f0e8);
  box(-114, 0.9, 318, 0.4, 5, 0.4, 0xf0f0e8);
  box(-116, 5.7, 318, 4.4, 0.5, 3.4, 0xf0f0e8, true);
  const lgRoof = new THREE.Mesh(
    new THREE.ConeGeometry(3.4, 1.6, 4),
    new THREE.MeshStandardMaterial({ color: 0xe82a2a, roughness: 0.9 })
  );
  lgRoof.position.set(-116, 7.4, 318);
  lgRoof.rotation.y = Math.PI / 4;
  group.add(lgRoof);
  box(-116, 6.2, 316.4, 3, 1, 0.2, 0x2ad8d8);

  if (world.city) {
    if (!world.city.colliders) world.city.colliders = [];
    world.city.colliders.push(...colliders);
    if (!world.city.districts) world.city.districts = {};
    world.city.districts.sunsetbeach = { name: 'Sunset Beach', colliders };
  }
  if (!world.districts) world.districts = {};
  world.districts.sunsetbeach = { name: 'Sunset Beach', colliders };

  return {
    name: 'sunsetbeach',
    group,
    colliders,
    // Sand is open ground: walkable and drivable at low speed.
    surface: 'sand',
    driveSpeedFactor: 0.4,
    surfShackPosition() {
      return { x: -180, y: 0.9, z: 300 };
    },
    jetSkiDockPosition() {
      return { x: -150, y: 1.2, z: 320 };
    },
    fishingSpotPosition() {
      return { x: -150, y: 1.4, z: 346 };
    },
    update(dt, t = 0) {
      if (fire) {
        const s = 1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.06;
        fire.scale.set(s, 1 + Math.sin(t * 13) * 0.15, s);
      }
      if (fireLight) fireLight.intensity = 11 + Math.sin(t * 11) * 2;
    },
  };
}
