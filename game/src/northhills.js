// North Hills — hillside residential district in the north-centre of Solmar City.
// Winding banked roads climb to a hilltop viewpoint; mansions with pools and
// driveways, pine trees and stone walls line the climb.
import * as THREE from 'three';

export function createNorthHills(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const group = new THREE.Group();
  group.name = 'NorthHills';
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

  function pine(x, z, s = 1) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 2.2 * s, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 })
    );
    trunk.position.set(x, 1.1 * s, z);
    group.add(trunk);
    for (let i = 0; i < 3; i += 1) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry((2.4 - i * 0.6) * s, 2.4 * s, 8),
        new THREE.MeshStandardMaterial({ color: 0x1e5c2e, roughness: 1 })
      );
      cone.position.set(x, (2.4 + i * 1.6) * s, z);
      cone.castShadow = true;
      group.add(cone);
    }
    addCollider(x, z, 1.2 * s, 1.2 * s);
  }

  // Hillside base: a broad grassy rise, higher toward the north edge.
  const hill = new THREE.Mesh(
    new THREE.BoxGeometry(210, 6, 90),
    new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 1 })
  );
  hill.position.set(0, 2, -220);
  hill.receiveShadow = true;
  group.add(hill);
  const crest = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 30, 16, 24),
    new THREE.MeshStandardMaterial({ color: 0x557f3e, roughness: 1 })
  );
  crest.position.set(0, 8, -248);
  crest.receiveShadow = true;
  group.add(crest);

  // Winding switchback road climbing to the viewpoint: curved segments of
  // narrow (7 m) banked asphalt, each segment slightly higher than the last.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 1 });
  const climb = [
    { x: -80, z: -182, rot: 0.15, y: 5.2 },
    { x: -45, z: -196, rot: 0.55, y: 7.5 },
    { x: -5, z: -206, rot: 1.1, y: 10 },
    { x: 38, z: -200, rot: 1.7, y: 12.5 },
    { x: 62, z: -218, rot: 2.3, y: 14.5 },
    { x: 30, z: -234, rot: 2.9, y: 16 },
    { x: 0, z: -246, rot: 0, y: 16.5 },
  ];
  for (const seg of climb) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(46, 0.3, 7), roadMat);
    road.position.set(seg.x, seg.y, seg.z);
    road.rotation.y = seg.rot;
    road.receiveShadow = true;
    group.add(road);
  }

  // Stone retaining walls along the outer edge of the climb.
  for (let i = 0; i < 6; i += 1) {
    const t = i / 5;
    box(-88 + t * 150, 5.5 + t * 11, -176 - t * 62, 14, 1.2, 1, 0x8a8a80, true);
  }

  // Mansions with pools and driveways, scattered on terraces off the road.
  const mansionColors = [0xf2e6c8, 0xe8d8b0, 0xdfe8f0, 0xf0d8c8, 0xe6e0d0];
  const plots = [
    { x: -72, z: -205, w: 18, d: 14, h: 9 },
    { x: -28, z: -222, w: 22, d: 16, h: 12 },
    { x: 52, z: -210, w: 16, d: 13, h: 8 },
    { x: 74, z: -236, w: 20, d: 15, h: 11 },
    { x: -58, z: -240, w: 17, d: 13, h: 9 },
    { x: 14, z: -232, w: 19, d: 14, h: 10 },
  ];
  for (let i = 0; i < plots.length; i += 1) {
    const p = plots[i];
    const baseY = 6 + rng() * 6;
    box(p.x, baseY, p.z, p.w, p.h, p.d, mansionColors[i % mansionColors.length], true);
    // Pyramid roof.
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(p.w, p.d) * 0.75, 3.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.9 })
    );
    roof.position.set(p.x, baseY + p.h + 1.7, p.z);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    // Lit windows.
    for (let w = 0; w < 4; w += 1) {
      box(p.x - p.w / 2 + 3 + w * 4, baseY + 2.5, p.z + p.d / 2 + 0.05, 1.6, 1.8, 0.1, 0xffe9a8);
    }
    // Pool beside the mansion.
    const pool = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.5, 5),
      new THREE.MeshStandardMaterial({ color: 0x2fa8d8, roughness: 0.2 })
    );
    pool.position.set(p.x + p.w / 2 + 7, baseY + 0.3, p.z + 2);
    group.add(pool);
    box(p.x + p.w / 2 + 7, baseY, p.z + 2, 9, 0.4, 6, 0xd8d0c0);
    // Driveway slab down toward the road.
    box(p.x, baseY - 0.2, p.z + p.d / 2 + 6, 5, 0.3, 10, 0x9a9a92);
  }

  // Pine forest fringe around the mansions.
  for (let i = 0; i < 26; i += 1) {
    const x = -100 + rng() * 200;
    const z = -258 + rng() * 74;
    if (Math.abs(x) < 12 && z < -235) continue;
    pine(x, z, 0.8 + rng() * 0.9);
  }

  // Hilltop viewpoint: scenic overlook platform with railing and a telescope.
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 1, 20),
    new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 })
  );
  deck.position.set(0, 16.5, -248);
  deck.receiveShadow = true;
  group.add(deck);
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    box(Math.cos(a) * 8.4, 16.8, -248 + Math.sin(a) * 8.4, 0.25, 1.2, 0.25, 0x6a6a62);
  }
  const scope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.4, metalness: 0.6 })
  );
  scope.position.set(0, 18.4, -248);
  scope.rotation.x = Math.PI / 2 - 0.35;
  group.add(scope);
  box(0, 16.8, -248, 1, 1.6, 1, 0x4a4a50, true);
  // Scenic bench and a coin box for the telescope, facing the city view.
  box(-4, 16.8, -244, 2.6, 0.5, 0.9, 0x6a4a2a, true);
  box(-4, 17.2, -243.6, 2.6, 0.9, 0.15, 0x6a4a2a);
  box(2.5, 16.8, -245.5, 0.5, 1, 0.5, 0xd8a82a);
  // Viewpoint sign.
  box(-7, 17, -242, 3, 0.1, 1.6, 0x2f6a4a);
  addCollider(0, -248, 18, 18);

  // Street lamps along the climb.
  for (const seg of climb) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 5, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    pole.position.set(seg.x + 4, seg.y + 2.5, seg.z - 3.4);
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdf80, emissiveIntensity: 0.8 })
    );
    lamp.position.set(seg.x + 4, seg.y + 5.1, seg.z - 3.4);
    group.add(lamp);
  }

  if (world.city) {
    if (!world.city.colliders) world.city.colliders = [];
    world.city.colliders.push(...colliders);
    if (!world.city.districts) world.city.districts = {};
    world.city.districts.northhills = { name: 'North Hills', colliders };
  }
  if (!world.districts) world.districts = {};
  world.districts.northhills = { name: 'North Hills', colliders };

  return {
    name: 'northhills',
    group,
    colliders,
    viewpointPosition() {
      return { x: 0, y: 17.5, z: -248 };
    },
    update() {},
  };
}
