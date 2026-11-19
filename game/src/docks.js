import * as THREE from 'three';

// The Docks: Solmar City's north-west container yard (roughly x -260..-170,
// z -260..-170). Stacked shipping containers in drivable rows, warehouses
// with big doors, gantry cranes — one of them visibly hoists a container up
// and down on a loop — floodlights for night, and a street-race route that
// threads between the container rows.
export function createDocks(world) {
  const scene = world.scene;
  const group = new THREE.Group();
  group.name = 'docks';
  scene.add(group);

  const colliders = [];
  function addCollider(x, z, hx, hz) {
    const box = { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
    colliders.push(box);
    if (world.city && Array.isArray(world.city.colliders)) {
      world.city.colliders.push(box);
    }
  }

  function box(w, h, d, color, x, y, z, parent) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.35 })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (parent || group).add(mesh);
    return mesh;
  }

  // --- yard ground: dark asphalt slab over the district
  const yard = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 1 })
  );
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(-215, 0.05, -215);
  yard.receiveShadow = true;
  group.add(yard);

  // Painted lane guides down each driving gap.
  const laneMat = new THREE.MeshBasicMaterial({ color: 0xd8c84a });
  for (const gx of [-246, -215, -184]) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 88), laneMat);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(gx, 0.08, -215);
    group.add(lane);
  }

  // --- container rows: 3 rows, each two stacks wide, with 16 m gaps
  // between rows so a car can drive straight through the yard.
  const containerColors = [0xb8322a, 0x2a6db8, 0x3d8a4a, 0xd8a03c, 0x7a4a9e, 0x4a9e9e, 0xc95f2e];
  const rows = [-248, -215, -182]; // row centre x
  const rowZ = [-252, -232, -212, -192, -172];
  let colorIdx = 0;
  const CON_W = 12.2; // container length along z
  const CON_D = 2.6; // container width along x
  const CON_H = 2.6;
  for (const rx of rows) {
    for (const rz of rowZ) {
      const stack = 1 + Math.floor(Math.random() * 3); // 1..3 high
      const col = containerColors[colorIdx++ % containerColors.length];
      for (let level = 0; level < stack; level++) {
        const c = box(CON_D, CON_H, CON_W, col, rx, CON_H / 2 + level * CON_H, rz);
        // Corrugated look: thin darker ribs across the long side.
        for (let rib = -2; rib <= 2; rib++) {
          const ribMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, CON_H - 0.3, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.9, transparent: true, opacity: 0.18 })
          );
          ribMesh.position.set(rx + CON_D / 2 + 0.05, CON_H / 2 + level * CON_H, rz + rib * 2.2);
          group.add(ribMesh);
        }
        c.userData.container = true;
      }
      addCollider(rx, rz, CON_D / 2 + 0.4, CON_W / 2 + 0.4);
    }
  }

  // A few loose single containers near the gate, as race scenery.
  box(CON_D, CON_H, CON_W, 0xb8322a, -168, CON_H / 2, -258).rotation.y = Math.PI / 2;
  addCollider(-168, -258, CON_W / 2 + 0.4, CON_D / 2 + 0.4);

  // --- warehouses with big doors along the north edge
  const warehouses = [];
  for (const wx of [-242, -205, -168]) {
    const wh = 14;
    const shell = box(30, wh, 18, 0x8d9299, wx, wh / 2, -256);
    // Big sliding door facing the yard (south face).
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 9),
      new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.5, metalness: 0.6 })
    );
    door.position.set(wx, 4.5, -256 + 9.05);
    group.add(door);
    // Door frame and hazard stripes above the door.
    box(13.5, 0.7, 0.4, 0xd8c84a, wx, 9.4, -256 + 9.1);
    // Roof vents.
    box(3, 1.2, 3, 0x6a6f76, wx - 8, wh + 0.6, -256);
    box(3, 1.2, 3, 0x6a6f76, wx + 8, wh + 0.6, -256);
    warehouses.push(shell);
    addCollider(wx, -256, 15.5, 9.5);
  }

  // --- gantry cranes spanning the yard, legs on rails
  const cranes = [];
  function makeCrane(cx, cz, span, height, animated) {
    const crane = new THREE.Group();
    crane.position.set(cx, 0, cz);
    group.add(crane);
    const legMat = new THREE.MeshStandardMaterial({ color: 0xd8c84a, roughness: 0.6, metalness: 0.4 });
    const legGeo = new THREE.BoxGeometry(2.2, height, 2.2);
    for (const sx of [-span / 2, span / 2]) {
      for (const sz of [-9, 9]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(sx, height / 2, sz);
        leg.castShadow = true;
        crane.add(leg);
      }
    }
    // Top beam across the span.
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 6, 2.4, 3), legMat);
    beam.position.set(0, height + 1, 0);
    beam.castShadow = true;
    crane.add(beam);
    // Operator cab hanging under the beam.
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(4, 3, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x2e343c, roughness: 0.4, metalness: 0.5 })
    );
    cab.position.set(span / 4, height - 1.5, 0);
    crane.add(cab);
    // Rails along the ground under the legs.
    for (const sz of [-9, 9]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(span + 20, 0.3, 1),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.7 })
      );
      rail.position.set(0, 0.15, sz);
      crane.add(rail);
    }
    // Trolley + hoist cable + container (animated crane only lifts).
    const trolley = new THREE.Group();
    trolley.position.set(-span / 4, height - 0.4, 0);
    crane.add(trolley);
    const trolleyBox = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.6, 4), legMat);
    trolley.add(trolleyBox);
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    trolley.add(cable);
    const load = new THREE.Mesh(
      new THREE.BoxGeometry(CON_D, CON_H, CON_W),
      new THREE.MeshStandardMaterial({ color: 0x2a6db8, roughness: 0.75, metalness: 0.35 })
    );
    load.castShadow = true;
    trolley.add(load);
    const craneObj = { group: crane, trolley, cable, load, animated, height };
    cranes.push(craneObj);
    // Legs block driving: collider per leg pair.
    addCollider(cx - span / 2, cz - 9, 1.6, 1.6);
    addCollider(cx + span / 2, cz - 9, 1.6, 1.6);
    addCollider(cx - span / 2, cz + 9, 1.6, 1.6);
    addCollider(cx + span / 2, cz + 9, 1.6, 1.6);
    return craneObj;
  }
  const hoistCrane = makeCrane(-215, -215, 56, 26, true);
  makeCrane(-215, -262, 56, 22, false);

  // --- floodlight poles for night work
  const floodlights = [];
  const floodMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 0.2,
  });
  for (const [fx, fz] of [[-258, -168], [-172, -168], [-258, -262], [-172, -262]]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 16, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.5 })
    );
    pole.position.set(fx, 8, fz);
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 1.6), floodMat.clone());
    head.position.set(fx, 16.2, fz);
    head.lookAt(-215, 0, -215);
    group.add(head);
    const spot = new THREE.SpotLight(0xfff2c0, 0, 120, 0.5, 0.5, 1.4);
    spot.position.set(fx, 16, fz);
    spot.target.position.set(-215, 0, -215);
    group.add(spot.target);
    group.add(spot);
    floodlights.push({ head, spot, on: false });
    addCollider(fx, fz, 0.8, 0.8);
  }

  // --- gate arch with the yard's name, marking the race start/finish
  const gateMat = new THREE.MeshStandardMaterial({ color: 0xd8c84a, roughness: 0.6, metalness: 0.3 });
  for (const gx of [-176, -160]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.6, 12, 1.6), gateMat);
    post.position.set(gx, 6, -168);
    post.castShadow = true;
    group.add(post);
  }
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(17.6, 2, 1.6), gateMat);
  gateBeam.position.set(-168, 12, -168);
  gateBeam.castShadow = true;
  group.add(gateBeam);
  const gateSign = new THREE.Mesh(
    new THREE.BoxGeometry(12, 2.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.5 })
  );
  gateSign.position.set(-168, 10.4, -168);
  group.add(gateSign);
  addCollider(-176, -168, 1.2, 1.2);
  addCollider(-160, -168, 1.2, 1.2);

  // --- street-race route threading between the container rows
  const raceCheckpoints = [
    { x: -168, z: -168, r: 8, name: 'Gate' },
    { x: -184, z: -196, r: 7, name: 'Row One' },
    { x: -215, z: -178, r: 7, name: 'Crane Pass' },
    { x: -246, z: -204, r: 7, name: 'Row Three' },
    { x: -230, z: -240, r: 7, name: 'Warehouse Turn' },
    { x: -196, z: -252, r: 7, name: 'North Straight' },
    { x: -168, z: -226, r: 7, name: 'Home Stretch' },
    { x: -168, z: -168, r: 8, name: 'Finish' },
  ];
  const checkpointMeshes = [];
  const ringGeo = new THREE.TorusGeometry(5, 0.35, 8, 24);
  for (const cp of raceCheckpoints) {
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffc832, transparent: true, opacity: 0.85 })
    );
    ring.position.set(cp.x, 2.2, cp.z);
    ring.rotation.y = Math.PI / 2;
    ring.visible = false;
    group.add(ring);
    checkpointMeshes.push(ring);
  }

  function getRaceCheckpoints() {
    return raceCheckpoints.map((c) => ({ x: c.x, z: c.z, r: c.r, name: c.name }));
  }

  // Index of the race checkpoint nearest to a position (for the race
  // system to find where a driver rejoins the route after a wrong turn).
  function nearestCheckpointIndex(x, z) {
    let best = 0;
    let bestD = Infinity;
    raceCheckpoints.forEach((c, i) => {
      const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function showCheckpoint(index) {
    checkpointMeshes.forEach((m, i) => { m.visible = i === index; });
  }

  function hideCheckpoints() {
    checkpointMeshes.forEach((m) => { m.visible = false; });
  }

  // Hoist loop: the animated crane lifts its container up, pauses, lowers.
  let hoistTime = 0;
  function updateHoist(dt) {
    hoistTime += dt;
    const cycle = 14; // seconds per full up-hold-down-hold loop
    const t = hoistTime % cycle;
    let lift; // 0 = on the ground, 1 = fully raised
    if (t < 5) lift = t / 5; // rise
    else if (t < 7) lift = 1; // hold at the top
    else if (t < 12) lift = 1 - (t - 7) / 5; // lower
    else lift = 0; // rest on the ground
    // Ease the motion so it does not jerk at the ends.
    lift = lift * lift * (3 - 2 * lift);
    const maxDrop = hoistCrane.height - 6;
    const drop = 2 + lift * maxDrop;
    hoistCrane.cable.scale.y = drop;
    hoistCrane.cable.position.y = -drop / 2;
    hoistCrane.load.position.y = -drop - CON_H / 2;
    // The trolley creeps along the beam while the load is up.
    hoistCrane.trolley.position.x = -14 + Math.sin(hoistTime * 0.35) * 12;
  }

  function update(dt) {
    updateHoist(dt);

    // Floodlights follow the night.
    const night = world.night === true ||
      (world.dayNight && world.dayNight.isNight && world.dayNight.isNight());
    for (const fl of floodlights) {
      if (fl.on !== night) {
        fl.on = night;
        fl.spot.intensity = night ? 600 : 0;
        fl.head.material.emissiveIntensity = night ? 2.4 : 0.2;
      }
    }

    // Checkpoint rings spin slowly when shown.
    for (const ring of checkpointMeshes) {
      if (ring.visible) ring.rotation.x += dt * 0.8;
    }
  }

  return {
    update,
    group,
    colliders,
    warehouses,
    cranes,
    floodlights,
    getRaceCheckpoints,
    nearestCheckpointIndex,
    showCheckpoint,
    hideCheckpoints,
    bounds: { minX: -260, maxX: -170, minZ: -260, maxZ: -170 },
  };
}
