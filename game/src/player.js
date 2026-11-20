import * as THREE from 'three';

// Rico on foot: WASD relative to the camera, Shift sprint, Space jump,
// E (edge-triggered) to enter / exit cars, bikes, boats, seaplanes,
// helicopters and jet skis. While Rico is in a vehicle this system only
// keeps his mesh hidden and his position synced to the vehicle.
const WALK_SPEED = 5;
const SPRINT_SPEED = 9;
const JUMP_SPEED = 8;
const GRAVITY = 22;
const ENTER_RANGE = 4;

function keyDown(world, code, letter) {
  const keys = world && world.input && world.input.keys;
  if (!keys) return false;
  return keys.has(code) || keys.has(letter);
}

function makePersonMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x263238 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), shirt);
  body.position.y = 1.05;
  body.name = 'body';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.85;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), pants);
  legL.position.set(-0.16, 0.35, 0);
  legL.name = 'legL';
  const legR = legL.clone();
  legR.position.x = 0.16;
  legR.name = 'legR';
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), shirt);
  armL.position.set(-0.45, 1.15, 0);
  armL.name = 'armL';
  const armR = armL.clone();
  armR.position.x = 0.45;
  armR.name = 'armR';
  group.add(body, head, legL, legR, armL, armR);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

function nearestEnterable(world) {
  const p = world.player.position;
  let best = null;
  let bestD = ENTER_RANGE;
  const lists = [
    ['car', world.cars || []],
    ['bike', world.bikes || []],
    ['boat', world.boats || []],
    ['jetSki', world.jetSkis || []],
  ];
  // Seaplanes / helicopters live on the same vehicle lists when present.
  if (world.seaplanes) lists.push(['seaplane', world.seaplanes]);
  if (world.helis) lists.push(['heli', world.helis]);
  for (const [kind, list] of lists) {
    for (const v of list) {
      if (!v || !v.position) continue;
      const d = p.distanceTo(v.position);
      if (d < bestD) { bestD = d; best = { kind, vehicle: v }; }
    }
  }
  return best;
}

export function createPlayer(scene, world) {
  const mesh = makePersonMesh();
  const p = world.player;
  if (p.position) mesh.position.copy(p.position);
  mesh.visible = !!p.onFoot;
  scene.add(mesh);
  p.mesh = mesh;
  let vy = 0;
  let grounded = true;
  let eWasDown = false;
  let walkPhase = 0;

  function syncMesh() {
    mesh.position.copy(p.position);
    mesh.rotation.y = p.heading || 0;
  }

  function enterVehicle(v) {
    if (!v) return false;
    const sys = world.systemObjects || {};
    if (v.kind === 'bike' || (world.bikes && world.bikes.includes(v))) {
      if (sys.motorcycles) return sys.motorcycles.enterBike(v);
      p.currentBike = v; p.onFoot = false;
    } else if (v.kind === 'jetSki' || (world.jetSkis && world.jetSkis.includes(v))) {
      if (sys.jetski) return sys.jetski.enterJetSki(v);
      p.currentJetSki = v; p.onFoot = false;
    } else if (world.boats && world.boats.includes(v)) {
      if (sys.boats) return sys.boats.enter(v);
      p.currentBoat = v; p.onFoot = false;
    } else if (world.seaplanes && world.seaplanes.includes(v)) {
      if (sys.seaplane) return sys.seaplane.enter(v);
      p.currentSeaplane = v; p.onFoot = false;
    } else if (world.helis && world.helis.includes(v)) {
      // The flyable heli is owned by playerheli (sys.heli is the police heli,
      // which has no enter/exit). playerheli.enter() is edge-triggered on E.
      if (sys.playerheli) return sys.playerheli.enter();
      p.currentHeli = v; p.onFoot = false;
    } else {
      if (sys.vehicles) return sys.vehicles.enterCar(v);
      p.currentCar = v; p.onFoot = false;
    }
    p.position.copy(v.position);
    mesh.visible = false;
    return true;
  }

  function exitVehicle() {
    const sys = world.systemObjects || {};
    if (p.currentCar && sys.vehicles) return sys.vehicles.exitCar();
    if (p.currentBike && sys.motorcycles) return sys.motorcycles.exitBike();
    if (p.currentJetSki && sys.jetski) return sys.jetski.exitJetSki();
    if (p.currentBoat && sys.boats) return sys.boats.exit();
    if (p.currentSeaplane && sys.seaplane) return sys.seaplane.exit();
    if (p.currentHeli && sys.playerheli) return sys.playerheli.exit();
    // Fallback: step out beside whatever vehicle Rico is in.
    const v = p.currentCar || p.currentBike || p.currentBoat || p.currentJetSki
      || p.currentSeaplane || p.currentHeli;
    if (v && v.position) {
      p.position.set(v.position.x + 2.5, v.position.y || 0, v.position.z + 2.5);
    }
    p.currentCar = null; p.currentBike = null; p.currentBoat = null;
    p.currentJetSki = null; p.currentSeaplane = null; p.currentHeli = null;
    p.onFoot = true;
    mesh.visible = true;
    syncMesh();
    return true;
  }

  function update(dt) {
    if (!p.onFoot) {
      // The vehicle system owns the position; mirror it onto the mesh.
      const v = p.currentCar || p.currentBike || p.currentBoat || p.currentJetSki
        || p.currentSeaplane || p.currentHeli;
      if (v && v.position) { p.position.copy(v.position); mesh.position.copy(v.position); }
      mesh.visible = false;
      // E-exit is owned by the vehicle system for boats, seaplanes and the
      // heli (each edge-detects E itself): exiting here too would re-enter
      // on the same press when that system runs later in the frame.
      // Only cars, bikes and jet skis exit through the player system.
      const aboardOwned = p.currentBoat || p.currentSeaplane || p.currentHeli;
      const eDownInVehicle = keyDown(world, 'KeyE', 'E');
      if (!aboardOwned && eDownInVehicle && !eWasDown) exitVehicle();
      eWasDown = eDownInVehicle;
      return;
    }
    mesh.visible = true;
    const cam = world.camera;
    const camYaw = cam ? Math.atan2(cam.position.x - p.position.x, cam.position.z - p.position.z) : 0;
    // Camera-relative WASD: forward is away from the camera.
    let fx = 0; let fz = 0;
    if (keyDown(world, 'KeyW', 'W')) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
    if (keyDown(world, 'KeyS', 'S')) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
    if (keyDown(world, 'KeyA', 'A')) { fx -= Math.cos(camYaw); fz += Math.sin(camYaw); }
    if (keyDown(world, 'KeyD', 'D')) { fx += Math.cos(camYaw); fz -= Math.sin(camYaw); }
    const len = Math.hypot(fx, fz);
    const sprint = keyDown(world, 'ShiftLeft', 'Shift') || keyDown(world, 'ShiftRight', 'Shift');
    const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
    if (len > 0) {
      fx /= len; fz /= len;
      p.position.x += fx * speed * dt;
      p.position.z += fz * speed * dt;
      p.heading = Math.atan2(fx, fz);
      p.speed = speed;
      walkPhase += dt * (sprint ? 13 : 9);
      const swing = Math.sin(walkPhase) * (sprint ? 0.7 : 0.45);
      const legL = mesh.getObjectByName('legL');
      const legR = mesh.getObjectByName('legR');
      const armL = mesh.getObjectByName('armL');
      const armR = mesh.getObjectByName('armR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (armL) armL.rotation.x = -swing * 0.8;
      if (armR) armR.rotation.x = swing * 0.8;
    } else {
      p.speed = 0;
      for (const n of ['legL', 'legR', 'armL', 'armR']) {
        const o = mesh.getObjectByName(n);
        if (o) o.rotation.x *= 0.8;
      }
    }
    // Jump + gravity, ground at y = 0.
    if (grounded && (keyDown(world, 'Space', ' ') || (world.input && world.input.keys && world.input.keys.has('Space')))) {
      vy = JUMP_SPEED; grounded = false;
    }
    if (!grounded) {
      vy -= GRAVITY * dt;
      p.position.y += vy * dt;
      if (p.position.y <= 0) { p.position.y = 0; vy = 0; grounded = true; }
    }
    // Building colliders: push Rico out of AABBs.
    const colliders = (world.city && world.city.colliders) || [];
    for (const c of colliders) {
      if (!c) continue;
      const minX = c.minX ?? c.x - (c.w ?? c.width ?? 4) / 2;
      const maxX = c.maxX ?? c.x + (c.w ?? c.width ?? 4) / 2;
      const minZ = c.minZ ?? c.z - (c.d ?? c.depth ?? 4) / 2;
      const maxZ = c.maxZ ?? c.z + (c.d ?? c.depth ?? 4) / 2;
      if (p.position.x > minX && p.position.x < maxX && p.position.z > minZ && p.position.z < maxZ) {
        const dxl = p.position.x - minX; const dxr = maxX - p.position.x;
        const dzl = p.position.z - minZ; const dzr = maxZ - p.position.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) p.position.x = minX;
        else if (m === dxr) p.position.x = maxX;
        else if (m === dzl) p.position.z = minZ;
        else p.position.z = maxZ;
      }
    }
    syncMesh();
    // E is edge-triggered: enter the nearest vehicle, or nothing.
    const eDown = keyDown(world, 'KeyE', 'E');
    if (eDown && !eWasDown) {
      const target = nearestEnterable(world);
      if (target) enterVehicle(target.vehicle);
    }
    eWasDown = eDown;
  }

  // What Rico is aboard, or null on foot. Heli and seaplane only count when
  // their boarded flag agrees — a stale currentHeli/currentSeaplane left over
  // after an exit must not read as aboard.
  p.currentVehicle = function currentVehicle() {
    if (p.currentCar) return 'car';
    if (p.currentBike) return 'bike';
    if (p.currentJetSki) return 'jetski';
    if (p.currentBoat) return 'boat';
    if (p.currentHeli && world.playerHeli && world.playerHeli.boarded) return 'heli';
    if (p.currentSeaplane && world.seaplane && p.currentSeaplane === world.seaplane) return 'seaplane';
    return null;
  };

  return { update, enterVehicle, exitVehicle };
}
