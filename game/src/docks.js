// Docks — container yard in the north-west (x -260 to -170, z -260 to -170):
// stacked shipping containers, warehouses, gantry cranes, and the cartel
// warehouse at (-215, -215) used by the Kingpin arc.
import * as THREE from 'three';

export function createDocks(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const group = new THREE.Group();
  group.name = 'Docks';
  scene.add(group);
  const colliders = [];
  const cranes = [];

  function addCollider(x, z, w, d) {
    const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
    colliders.push(c);
    return c;
  }

  function box(x, y, z, w, h, d, color, collide = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.15 })
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) addCollider(x, z, w, d);
    return mesh;
  }

  // Concrete yard slab.
  const yard = new THREE.Mesh(
    new THREE.BoxGeometry(96, 0.5, 96),
    new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: 1 })
  );
  yard.position.set(-215, 0.2, -215);
  yard.receiveShadow = true;
  group.add(yard);

  // Stacked shipping containers in rows, with gaps as driving lanes.
  const containerColors = [0xc84a2a, 0x2a6ac8, 0x2a8a3a, 0xd8a82a, 0x6a4a8a, 0x3a9a9a];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const x = -252 + col * 18;
      const z = -250 + row * 16;
      if (col === 2 && row === 1) continue; // lane through the yard
      const stack = 1 + Math.floor(rng() * 3);
      const color = containerColors[(row * 5 + col) % containerColors.length];
      for (let s = 0; s < stack; s += 1) {
        const c = box(x, s * 2.7, z, 12, 2.6, 2.6, color, s === 0);
        c.rotation.y = row % 2 ? 0 : Math.PI / 2;
      }
      // Corrugated ribs on the top container.
      for (let r = 0; r < 6; r += 1) {
        box(x - 5 + r * 2, stack * 2.7, z, 0.3, 0.15, 2.7, 0x000000);
      }
    }
  }

  // Warehouses along the north edge.
  box(-245, 0.4, -178, 26, 9, 12, 0x9a9488, true);
  box(-245, 9.4, -178, 27, 1, 13, 0x6a6458);
  box(-245, 0.4, -172.2, 8, 7, 0.4, 0x4a4a50);
  box(-195, 0.4, -178, 22, 8, 12, 0x8a8a80, true);
  box(-195, 8.4, -178, 23, 1, 13, 0x5a5a52);
  box(-195, 0.4, -172.2, 7, 6, 0.4, 0x3a6a8a);

  // Cartel warehouse at (-215, -215): dark, windowless, with a red door.
  box(-215, 0.4, -215, 24, 10, 16, 0x2e2a30, true);
  const cwRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(8.5, 8.5, 25, 3, 1),
    new THREE.MeshStandardMaterial({ color: 0x3a3438, roughness: 0.9 })
  );
  cwRoof.rotation.z = Math.PI / 2;
  cwRoof.rotation.y = Math.PI / 2;
  cwRoof.position.set(-215, 10.6, -215);
  group.add(cwRoof);
  box(-215, 0.4, -206.8, 6, 7, 0.4, 0x8a1a1a);
  // Warning sign above the door.
  box(-215, 8.2, -206.8, 5, 1.6, 0.2, 0xd8a82a);
  // Crates piled by the cartel warehouse.
  for (let i = 0; i < 8; i += 1) {
    box(-232 + (i % 4) * 3, 0.4 + Math.floor(i / 4) * 1.6, -200 + (i % 2) * 3, 2.4, 1.5, 2.4, 0x8a6a42, true);
  }

  // Gantry cranes: two portal cranes straddling the container lanes.
  for (const cx of [-238, -192]) {
    const crane = new THREE.Group();
    crane.position.set(cx, 0, -230);
    const legMat = new THREE.MeshStandardMaterial({ color: 0xd8a82a, roughness: 0.7, metalness: 0.3 });
    for (const [lx, lz] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 22, 1.4), legMat);
      leg.position.set(lx, 11, lz);
      leg.castShadow = true;
      crane.add(leg);
    }
    const beamTop = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 14), legMat);
    beamTop.position.set(0, 22, 0);
    crane.add(beamTop);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 34), legMat);
    jib.position.set(0, 23.5, 6);
    crane.add(jib);
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 12, 4),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    cable.position.set(0, 17, 14);
    crane.add(cable);
    const hook = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.6, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    hook.position.set(0, 10.5, 14);
    crane.add(hook);
    crane.userData.hook = hook;
    crane.userData.cable = cable;
    group.add(crane);
    cranes.push(crane);
    addCollider(cx, -230, 16, 14);
  }

  // Perimeter fence and gate on the south side.
  for (let i = 0; i < 16; i += 1) {
    box(-258 + i * 6, 0.4, -168, 0.2, 3, 0.2, 0x5a5a52);
  }
  box(-215, 1.8, -168, 90, 0.15, 0.15, 0x7a7a72);
  box(-215, 1.8, -168, 90, 0.15, 0.15, 0x7a7a72);
  // Dock office: a converted container with windows and a radio mast.
  box(-176, 0.4, -246, 10, 3, 3, 0x3a6a8a, true);
  for (let w = 0; w < 3; w += 1) {
    box(-179 + w * 3, 1.6, -244.4, 1.4, 1.2, 0.1, 0xffe9a8);
  }
  box(-172, 3.4, -246, 0.15, 8, 0.15, 0x888888);
  const mastTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0xe82a2a, emissive: 0xe82a2a, emissiveIntensity: 1 })
  );
  mastTop.position.set(-172, 11.6, -246);
  group.add(mastTop);

  // Floodlight poles so the yard is workable at night.
  for (const [x, z] of [[-250, -180], [-180, -180], [-250, -250], [-180, -250]]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 12, 6),
      new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    pole.position.set(x, 6, z);
    group.add(pole);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe680, emissiveIntensity: 1.2 })
    );
    head.position.set(x, 12.2, z);
    group.add(head);
    addCollider(x, z, 0.6, 0.6);
  }

  if (world.city) {
    if (!world.city.colliders) world.city.colliders = [];
    world.city.colliders.push(...colliders);
    if (!world.city.districts) world.city.districts = {};
    world.city.districts.docks = { name: 'Docks', colliders };
  }
  if (!world.districts) world.districts = {};
  world.districts.docks = { name: 'Docks', colliders };

  return {
    name: 'docks',
    group,
    colliders,
    warehousePosition() {
      return { x: -245, y: 0.4, z: -178 };
    },
    cartelWarehousePosition() {
      return { x: -215, y: 0.4, z: -215 };
    },
    update(dt, t = 0) {
      // Crane hooks sway gently while the yard works.
      for (let i = 0; i < cranes.length; i += 1) {
        const hook = cranes[i].userData.hook;
        if (hook) hook.position.x = Math.sin(t * 0.5 + i * 2) * 1.2;
      }
    },
  };
}
