// northhills.js — Hillside residential district, x -100..100, z -260..-180.
// Winding curved roads climb to a hilltop viewpoint; mansions with pools and
// driveways, pine trees, stone walls and a scenic overlook.
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

export function createNorthHills(scene, world) {
  if (!world.city) world.city = { colliders: [] };
  if (!world.city.colliders) world.city.colliders = [];
  const colliders = world.city.colliders;
  const rng = () => world.rng();
  const group = new THREE.Group();
  group.name = 'northhills';
  scene.add(group);

  const groundMat = mat(0x5a7a4a);
  const hill = new THREE.Mesh(new THREE.ConeGeometry(95, 26, 24, 1), groundMat);
  hill.position.set(0, 2, -220);
  hill.scale.set(1, 1, 0.55);
  hill.receiveShadow = true;
  group.add(hill);
  const terrace = new THREE.Mesh(new THREE.CylinderGeometry(34, 46, 8, 20), mat(0x6b8a55));
  terrace.position.set(0, 8, -220);
  terrace.receiveShadow = true;
  group.add(terrace);

  // Winding climbing road: a chain of dark slabs following an S-curve up the hill.
  const roadMat = mat(0x333338, 0.95);
  const roadPts = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const x = Math.sin(t * Math.PI * 1.6) * 52;
    const z = -180 - t * 72;
    const y = 0.3 + t * 13;
    roadPts.push([x, y, z]);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 9), roadMat);
    seg.position.set(x, y, z);
    seg.rotation.y = Math.cos(t * Math.PI * 1.6) * 0.7;
    seg.receiveShadow = true;
    group.add(seg);
  }

  // Mansions with pools and driveways, placed along the road.
  const wallCols = [0xe8dcc0, 0xd9c9a8, 0xcfd8dc, 0xe6b8a2];
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x2fa8c8, roughness: 0.15, metalness: 0.1 });
  const mansions = [];
  for (let i = 0; i < 7; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (34 + rng() * 34);
    const z = -192 - i * 9 - rng() * 4;
    const y = 2 + (z + 260) * 0.12;
    const c = wallCols[i % wallCols.length];
    const house = box(group, colliders, 12, 6, 9, x, y + 3, z, mat(c), true);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 3, 4), mat(0x8a4a3a));
    roof.position.set(x, y + 7.5, z);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 4), poolMat);
    pool.position.set(x + side * 10, y + 0.4, z + 2);
    group.add(pool);
    const drive = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 10), mat(0x777777));
    drive.position.set(x, y + 0.15, z + 9);
    group.add(drive);
    mansions.push(house);
  }

  // Pine trees scattered on the slopes.
  const trunkMat = mat(0x5a3a22);
  const pineMat = mat(0x2d5a2d);
  for (let i = 0; i < 42; i += 1) {
    const x = -95 + rng() * 190;
    const z = -258 + rng() * 76;
    if (Math.abs(x) < 14 && z > -235) continue; // keep the road clear
    const h = 4 + rng() * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 6), trunkMat);
    trunk.position.set(x, 1 + Math.max(0, (z + 260) * 0.1), z);
    group.add(trunk);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, h, 7), pineMat);
    cone.position.set(x, 2 + h / 2 + Math.max(0, (z + 260) * 0.1), z);
    group.add(cone);
  }

  // Stone walls along the lower edge and around the viewpoint.
  const stoneMat = mat(0x8d8d85);
  for (let x = -90; x <= 90; x += 12) {
    box(group, colliders, 11, 1.4, 1, x, 0.7, -182, stoneMat, true);
  }
  for (let a = 0; a < 10; a += 1) {
    const ang = (a / 10) * Math.PI * 2;
    box(group, colliders, 6, 1.2, 1, Math.cos(ang) * 26, 12.6, -238 + Math.sin(ang) * 12, stoneMat, true);
  }

  // Scenic overlook: deck, railing posts and a telescope.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 0.6, 10), mat(0x9a7a55));
  deck.position.set(0, 13.2, -248);
  deck.receiveShadow = true;
  group.add(deck);
  for (let i = 0; i < 9; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6), mat(0xdddddd));
    post.position.set(-9 + i * 2.25, 14.1, -252.5);
    group.add(post);
  }
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 8), mat(0x2b2b30, 0.4));
  scope.position.set(4, 14.6, -248);
  scope.rotation.z = Math.PI / 2 - 0.5;
  group.add(scope);
  // Overlook sign naming the viewpoint for drivers coming up the hill.
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 6), mat(0xdddddd));
  signPost.position.set(-7, 14.2, -246);
  group.add(signPost);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.2), mat(0x2a5a3a));
  signBoard.position.set(-7, 15.4, -246);
  group.add(signBoard);
  colliders.push({ minX: -10, maxX: 10, minZ: -253, maxZ: -243 });

  function viewpointPosition() {
    return new THREE.Vector3(0, 14, -248);
  }

  return { group, mansions, viewpointPosition, update() {} };
}
