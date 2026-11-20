// vineyards.js — Rural area north of North Hills, x -100..100, z -320..-260.
// Winding country roads, a vineyard estate with rows of grapevines, a farmhouse,
// a wine cellar and a hidden airstrip.
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

export function createVineyards(scene, world) {
  if (!world.city) world.city = { colliders: [] };
  if (!world.city.colliders) world.city.colliders = [];
  const colliders = world.city.colliders;
  const rng = () => world.rng();
  const group = new THREE.Group();
  group.name = 'vineyards';
  scene.add(group);

  // Rolling field base.
  const field = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 60), mat(0x7a9a4a));
  field.position.set(0, 0, -290);
  field.receiveShadow = true;
  group.add(field);

  // Winding country road: narrow dirt slabs snaking through the fields.
  const dirtMat = mat(0x9a7a55, 1);
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    const x = Math.sin(t * Math.PI * 2.2) * 46;
    const z = -318 + t * 56;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 7), dirtMat);
    seg.position.set(x, 0.65, z);
    seg.rotation.y = Math.cos(t * Math.PI * 2.2) * 0.8;
    seg.receiveShadow = true;
    group.add(seg);
  }

  // Vineyard estate at (0, -290): farmhouse, cellar, barn and vine rows.
  const farmhouse = box(group, colliders, 14, 6, 10, 0, 3.5, -290, mat(0xe8dcc0), true);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 3.4, 4), mat(0x7a3a2a));
  roof.position.set(0, 8.2, -290);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  const cellar = box(group, colliders, 9, 3.5, 7, -14, 2.2, -296, mat(0x8d8d85), true);
  const cellarDoor = box(group, colliders, 2.4, 2.6, 0.3, -14, 1.8, -292.3, mat(0x4a2f1d), false);
  const barn = box(group, colliders, 10, 5, 8, 16, 3, -296, mat(0xa03a2a), true);
  const barnRoof = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 10, 8, 1, false, 0, Math.PI), mat(0x6a6a62));
  barnRoof.position.set(16, 5.5, -296);
  barnRoof.rotation.z = Math.PI / 2;
  barnRoof.rotation.y = Math.PI / 2;
  group.add(barnRoof);

  // Rows of grapevines: posts + leafy canopies + grape clusters.
  const postMat = mat(0x5a4028);
  const vineMat = mat(0x3d7a2d);
  const grapeMat = mat(0x5a2a6a);
  for (let row = 0; row < 9; row += 1) {
    const x0 = -78 + row * 13;
    for (let i = 0; i < 7; i += 1) {
      const z = -312 + i * 6;
      if (Math.abs(x0) < 24 && Math.abs(z + 290) < 12) continue; // keep the estate yard clear
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.8, 5), postMat);
      post.position.set(x0, 1.4, z);
      group.add(post);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 4.6), vineMat);
      canopy.position.set(x0, 2.1, z);
      group.add(canopy);
      if (i % 2 === 0) {
        const grapes = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 6), grapeMat);
        grapes.position.set(x0 + 0.5, 1.5, z + 1);
        group.add(grapes);
      }
    }
  }

  // Fences and fields alongside the country road.
  const fenceMat = mat(0x8a6a45);
  for (let i = 0; i < 24; i += 1) {
    const t = i / 24;
    const x = Math.sin(t * Math.PI * 2.2) * 46 + 4.5;
    const z = -318 + t * 56;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3.4), fenceMat);
    rail.position.set(x, 1.1, z);
    rail.rotation.y = Math.cos(t * Math.PI * 2.2) * 0.8;
    group.add(rail);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.3, 0.25), fenceMat);
    post.position.set(x, 0.9, z - 1.6);
    group.add(post);
  }
  // Hay bales in the open fields.
  for (let i = 0; i < 8; i += 1) {
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.6, 10), mat(0xd9b36a));
    bale.position.set(-88 + rng() * 176, 1.3, -316 + rng() * 52);
    bale.rotation.z = Math.PI / 2;
    group.add(bale);
  }
  // Wine barrels stacked by the cellar door, ready for the next pressing.
  for (let i = 0; i < 5; i += 1) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 10), mat(0x6a4028));
    barrel.position.set(-20 + (i % 3) * 2, 1.2 + Math.floor(i / 3) * 1.5, -292);
    barrel.rotation.z = Math.PI / 2;
    group.add(barrel);
  }

  // Hidden airstrip at the far north edge: grass strip with windsock.
  const strip = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 44), mat(0x6a8a4a));
  strip.position.set(-62, 0.65, -300);
  strip.rotation.y = 0.12;
  strip.receiveShadow = true;
  group.add(strip);
  for (let i = 0; i < 6; i += 1) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 6), mat(0xffcc33));
    cone.position.set(-66 + (i % 2) * 8, 0.9, -318 + i * 7);
    group.add(cone);
  }
  const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), mat(0xdddddd));
  sockPole.position.set(-54, 2.5, -318);
  group.add(sockPole);

  function estatePosition() { return new THREE.Vector3(0, 1, -290); }

  return { group, farmhouse, cellar, barn, estatePosition, update() {} };
}
