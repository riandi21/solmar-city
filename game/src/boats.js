// Solmar City — boats: drivable marina boats with water handling and wake.
// Enter with E at the pier. boats.enter() MUST claim world.playerBoat so
// the player module (and the v12 currentVehicle fix) see who is aboard.
// world.boats stays the LIST of boats; the system object lives in
// world.systems / world.systemObjects, never on top of the list.
import * as THREE from 'three';

export const WATER_Y = 0.15;
export const MARINA = { minX: 261, maxX: 400, minZ: 60, maxZ: 260 };
export const PIER_POINT = { x: 295, z: 168 };
export const ISLANDS_PIER = { x: 350, z: 330 };

function resolveArgs(scene, world) {
  if (!world) {
    world = scene;
    scene = (world && world.scene) || null;
  }
  return { scene, world };
}

function held(world, code) {
  const keys = world.input && world.input.keys;
  if (!keys) return false;
  if (keys instanceof Set) return keys.has(code);
  return !!keys[code];
}

// Edge detector: true only on the frame a key goes down. Falls back to
// held-edge tracking when the input module has no `pressed` set.
function makePressTracker() {
  const prev = {};
  return function pressed(world, code) {
    const pressedSet = world.input && world.input.pressed;
    if (pressedSet instanceof Set) return pressedSet.has(code);
    const now = held(world, code);
    const edge = now && !prev[code];
    prev[code] = now;
    return edge;
  };
}

export function isWater(x, z) {
  if (z >= 258) return true; // open sea along the south edge
  if (x >= MARINA.minX && x <= MARINA.maxX && z >= MARINA.minZ - 20 && z <= MARINA.maxZ + 20) return true; // marina basin
  if (x >= 300 && x <= 450 && z >= 300 && z <= 450) return true; // islands lagoon
  return false;
}

const BOAT_DEFS = {
  speedboat: { topSpeed: 26, accel: 12, turn: 1.15, color: 0xe8e8e8, trim: 0xd43a2a, length: 6, beam: 2.2 },
  fishing: { topSpeed: 18, accel: 8, turn: 0.9, color: 0x3a6ea8, trim: 0xf2e6c8, length: 5.5, beam: 2.4 },
  yacht: { topSpeed: 16, accel: 6, turn: 0.6, color: 0xf5f2e8, trim: 0x1c3a5e, length: 11, beam: 3.6 },
};

function buildBoatMesh(def) {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color: def.color });
  const trimMat = new THREE.MeshLambertMaterial({ color: def.trim });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(def.beam, 0.9, def.length), hullMat);
  hull.position.y = 0.45;
  group.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(def.beam * 0.5, 1.6, 4), hullMat);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.45, def.length / 2 + 0.7);
  group.add(bow);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(def.beam + 0.06, 0.22, def.length * 0.9), trimMat);
  stripe.position.y = 0.95;
  group.add(stripe);
  if (def.length >= 6) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(def.beam * 0.7, 0.8, def.length * 0.32), trimMat);
    cabin.position.set(0, 1.3, -def.length * 0.08);
    group.add(cabin);
  }
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 9),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, -0.05, -def.length * 0.8);
  group.add(wake);
  group.userData.wake = wake;
  return group;
}

export function createBoats(scene, world) {
  ({ scene, world } = resolveArgs(scene, world));
  if (!world) throw new Error('createBoats needs a world');
  if (!Array.isArray(world.systems)) world.systems = [];
  world.systemObjects = world.systemObjects || {};
  if (!Array.isArray(world.boats)) world.boats = [];
  if (!world.player) {
    world.player = { position: new THREE.Vector3(0, 0, 0), heading: 0, speed: 0, onFoot: true, health: 100, mesh: null };
  }
  if (!(world.player.position instanceof THREE.Vector3) && world.player.position) {
    const p = world.player.position;
    world.player.position = new THREE.Vector3(p.x, p.y || 0, p.z || 0);
  }
  world.playerBoat = world.playerBoat || null;

  const hasScene = scene && typeof scene.add === 'function';
  const pressE = makePressTracker();
  let bobTime = 0;

  function spawnBoat(x, z, kind = 'speedboat') {
    const def = BOAT_DEFS[kind] || BOAT_DEFS.speedboat;
    const mesh = hasScene ? buildBoatMesh(def) : null;
    const boat = {
      kind,
      mesh,
      position: new THREE.Vector3(x, WATER_Y, z),
      heading: 0,
      speed: 0,
      topSpeed: def.topSpeed,
      accel: def.accel,
      turn: def.turn,
      boarded: false,
      wake: mesh ? mesh.userData.wake : null,
    };
    if (mesh) {
      mesh.position.copy(boat.position);
      scene.add(mesh);
    }
    world.boats.push(boat);
    return boat;
  }

  function nearestBoat(maxDist) {
    const pp = world.player.position;
    let best = null;
    let bestD = maxDist;
    for (const boat of world.boats) {
      const d = Math.hypot(boat.position.x - pp.x, boat.position.z - pp.z);
      if (d < bestD) {
        bestD = d;
        best = boat;
      }
    }
    return best;
  }

  function playerFree() {
    const p = world.player;
    if (!p.onFoot) return false;
    if (world.playerBoat) return false;
    if (world.playerHeli && world.playerHeli.boarded) return false;
    if (world.seaplane && world.seaplane.boarded) return false;
    if (p.currentCar || p.currentBike || p.currentJetSki) return false;
    return true;
  }

  // Claim the boat: world.playerBoat is the single source of truth for
  // "Rico is aboard a boat" (see the v12 currentVehicle fix).
  function enter(boat) {
    const target = boat || nearestBoat(7);
    if (!target || !playerFree()) return false;
    target.boarded = true;
    world.playerBoat = target;
    world.player.currentBoat = target;
    world.player.onFoot = false;
    world.player.boat = target;
    world.player.position.copy(target.position);
    world.player.heading = target.heading;
    return true;
  }

  function exit() {
    const boat = world.playerBoat;
    if (!boat) return false;
    if (Math.abs(boat.speed) > 2) return false;
    boat.boarded = false;
    boat.speed = 0;
    world.playerBoat = null;
    world.player.currentBoat = null;
    world.player.boat = null;
    world.player.onFoot = true;
    // Step Rico off onto the nearest dry side: try each direction and
    // take the first spot that is not water.
    const px = boat.position.x;
    const pz = boat.position.z;
    const tries = [[-4, 0], [4, 0], [0, -4], [0, 4], [-6, -6], [6, 6]];
    let landed = false;
    for (const [dx, dz] of tries) {
      if (!isWater(px + dx, pz + dz)) {
        world.player.position.set(px + dx, 0, pz + dz);
        landed = true;
        break;
      }
    }
    if (!landed) world.player.position.set(px - 4, 0, pz - 4);
    return true;
  }

  function drive(dt, boat) {
    const def = BOAT_DEFS[boat.kind] || BOAT_DEFS.speedboat;
    const grip = (world.weather && world.weather.grip) || world.grip || 1;
    if (held(world, 'KeyW') || held(world, 'ArrowUp')) boat.speed += boat.accel * grip * dt;
    if (held(world, 'KeyS') || held(world, 'ArrowDown')) boat.speed -= boat.accel * 0.8 * dt;
    boat.speed = Math.max(-6, Math.min(def.topSpeed, boat.speed));
    // Water drag: speed bleeds off without throttle.
    boat.speed -= boat.speed * 0.35 * dt;
    const steer = (held(world, 'KeyA') || held(world, 'ArrowLeft') ? 1 : 0) - (held(world, 'KeyD') || held(world, 'ArrowRight') ? 1 : 0);
    const speedF = Math.min(1, Math.abs(boat.speed) / 8);
    boat.heading += steer * boat.turn * speedF * dt * (boat.speed < 0 ? -1 : 1);
    const nx = boat.position.x + Math.sin(boat.heading) * boat.speed * dt;
    const nz = boat.position.z + Math.cos(boat.heading) * boat.speed * dt;
    // Stay on the water: a shore blocks the boat instead of beaching it.
    if (isWater(nx, nz)) {
      boat.position.x = nx;
      boat.position.z = nz;
    } else {
      boat.speed *= 0.4;
    }
    world.player.position.copy(boat.position);
    world.player.heading = boat.heading;
    world.player.speed = boat.speed;
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    if (world.mode === 'pause' || world.mode === 'over') return;
    bobTime += dt;
    const ePressed = pressE(world, 'KeyE');
    let enteredThisTick = false;
    if (ePressed && !world.playerBoat) {
      enteredThisTick = enter();
    }
    // Never exit in the same tick as an entry (E is still held down).
    if (ePressed && world.playerBoat && !enteredThisTick) exit();
    for (const boat of world.boats) {
      if (boat.boarded) drive(dt, boat);
      // Gentle bob on the swell, plus a wake that grows with speed.
      const bob = Math.sin(bobTime * 1.4 + boat.position.x * 0.05 + boat.position.z * 0.07) * 0.12;
      if (boat.mesh) {
        boat.mesh.position.set(boat.position.x, WATER_Y + bob, boat.position.z);
        boat.mesh.rotation.y = boat.heading;
        boat.mesh.rotation.z = Math.sin(bobTime * 0.9 + boat.position.z * 0.1) * 0.02;
        if (boat.wake) {
          boat.wake.material.opacity = Math.min(0.5, Math.abs(boat.speed) / 26 * 0.5);
          boat.wake.scale.set(1 + Math.abs(boat.speed) * 0.03, 1 + Math.abs(boat.speed) * 0.12, 1);
        }
      }
    }
  }

  // Starter fleet: pier speedboat, fishing boat, and the big yacht.
  spawnBoat(PIER_POINT.x, PIER_POINT.z, 'speedboat');
  spawnBoat(330, 220, 'fishing');
  spawnBoat(305, 175, 'yacht');

  const system = { name: 'boats', update, enter, exit, spawnBoat, nearestBoat, isWater, boats: world.boats };
  world.systems.push(system);
  world.systemObjects.boats = system;
  return system;
}

export default createBoats;
