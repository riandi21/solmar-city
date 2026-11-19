// Solmar City — player helicopter: Rico's flyable heli (after M38).
// Enter with E at the Coral Club rooftop helipad or the airfield.
// W climbs, S descends, A/D steer, Shift moves forward; lands on the
// helipad, the airfield runway, or any flat rooftop. Fragile: a hard
// landing costs a lot of health. Rotor spins up on entry, down on exit.
//
// MANDATORY FIX (v10/v11/v12): E is EDGE-triggered with a justEntered
// guard. Entering and then running the exit check in the same tick while
// E is still held causes an instant enter+exit. This module uses a press
// (not held) check and NEVER runs the exit check in the same tick as an
// entry — so the heli stays boarded while E is held, and M38/M40 fly
// stages can complete on their timers.
// world.playerHeli is plain state data (boarded flag included); the
// system object lives in world.systems / world.systemObjects.
import * as THREE from 'three';

export const HELIPAD = { x: 29, z: 29, roofY: 78 };
export const AIRFIELD_PAD = { x: 200, z: -230, roofY: 0 };
export const MAX_HELI_ALTITUDE = 120;

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

// Ground height under (x, z): the Coral Club roof is 78 m, elsewhere 0.
export function groundHeightAt(x, z) {
  if (Math.abs(x - HELIPAD.x) <= 13 && Math.abs(z - HELIPAD.z) <= 13) return HELIPAD.roofY;
  return 0;
}

// A legal landing zone: the Coral Club helipad, the airfield, or any flat
// rooftop / ground inside the city grid. Open sea is not a landing zone.
export function isLandingZone(x, z) {
  if (Math.abs(x - HELIPAD.x) <= 13 && Math.abs(z - HELIPAD.z) <= 13) return true;
  if (Math.abs(x - AIRFIELD_PAD.x) <= 40 && Math.abs(z - AIRFIELD_PAD.z) <= 40) return true;
  if (z >= 258) return false; // sea
  if (x >= 261) return false; // marina water
  return Math.abs(x) <= 261 && Math.abs(z) <= 261;
}

function buildPlayerHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd43a2a });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 5.2), bodyMat);
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.4, 4.4), whiteMat);
  stripe.position.y = 0.35;
  group.add(stripe);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }));
  nose.scale.set(1, 0.7, 0.8);
  nose.position.set(0, 0.2, 2.6);
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 4.6), bodyMat);
  tail.position.set(0, 0.35, -4.6);
  group.add(tail);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.5, 1.1), bodyMat);
  tailFin.position.set(0, 1.0, -6.6);
  group.add(tailFin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.09, 0.7), darkMat);
  rotor.position.y = 1.2;
  group.add(rotor);
  group.userData.rotor = rotor;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.2, 0.4), darkMat);
  tailRotor.position.set(0.35, 1.0, -6.6);
  group.add(tailRotor);
  group.userData.tailRotor = tailRotor;
  const skids = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 3.8), darkMat);
  skids.position.y = -1.05;
  group.add(skids);
  return group;
}

export function createPlayerHeli(scene, world) {
  ({ scene, world } = resolveArgs(scene, world));
  if (!world) throw new Error('createPlayerHeli needs a world');
  if (!Array.isArray(world.systems)) world.systems = [];
  world.systemObjects = world.systemObjects || {};
  if (!world.player) {
    world.player = { position: new THREE.Vector3(0, 0, 0), heading: 0, speed: 0, onFoot: true, health: 100, mesh: null };
  }
  if (!(world.player.position instanceof THREE.Vector3) && world.player.position) {
    const p = world.player.position;
    world.player.position = new THREE.Vector3(p.x, p.y || 0, p.z || 0);
  }

  const hasScene = scene && typeof scene.add === 'function';
  const mesh = hasScene ? buildPlayerHeliMesh() : null;
  const state = {
    mesh,
    position: new THREE.Vector3(HELIPAD.x, HELIPAD.roofY, HELIPAD.z),
    heading: 0,
    speed: 0,
    altitude: 0, // height above the ground/roof below
    rotorSpeed: 0,
    onGround: true,
    boarded: false, // the flag currentVehicle() must check before "aboard"
    unlocked: true, // granted by M38; missions call unlock() to gate it
    verticalSpeed: 0,
  };
  world.playerHeli = state;
  if (mesh) {
    mesh.position.copy(state.position);
    scene.add(mesh);
  }

  const pressE = makePressTracker();

  function nearHeli() {
    const pp = world.player.position;
    const dPad = Math.hypot(pp.x - HELIPAD.x, pp.z - HELIPAD.z);
    const dField = Math.hypot(pp.x - AIRFIELD_PAD.x, pp.z - AIRFIELD_PAD.z);
    const dHeli = Math.hypot(pp.x - state.position.x, pp.z - state.position.z);
    const yClose = Math.abs(pp.y - state.position.y) < 5;
    return yClose && (dPad < 10 || dField < 10 || dHeli < 9);
  }

  function playerFree() {
    const p = world.player;
    if (!p.onFoot) return false;
    if (world.playerBoat) return false;
    if (world.seaplane && world.seaplane.boarded) return false;
    if (p.currentCar || p.currentBike || p.currentJetSki) return false;
    return true;
  }

  function unlock() {
    state.unlocked = true;
    return true;
  }

  function lock() {
    if (state.boarded) return false;
    state.unlocked = false;
    return true;
  }

  function enter() {
    if (state.boarded || !state.unlocked || !playerFree() || !nearHeli()) return false;
    state.boarded = true;
    state.onGround = state.altitude <= 0.5;
    world.player.onFoot = false;
    world.player.helicopter = state;
    world.player.position.copy(state.position);
    world.player.heading = state.heading;
    if (world.events) world.events.push({ type: 'heli-board' });
    return true;
  }

  function exit() {
    if (!state.boarded || !state.onGround) return false;
    state.boarded = false;
    state.speed = 0;
    state.verticalSpeed = 0;
    world.player.onFoot = true;
    world.player.helicopter = null;
    const gy = groundHeightAt(state.position.x, state.position.z);
    world.player.position.set(state.position.x + 5, gy, state.position.z + 2);
    if (world.events) world.events.push({ type: 'heli-exit' });
    return true;
  }

  function damage(amount) {
    if (typeof world.player.health === 'number') {
      world.player.health = Math.max(0, world.player.health - amount);
    }
    if (world.events) world.events.push({ type: 'heli-damage', amount });
  }

  function fly(dt) {
    const climb = held(world, 'KeyW') || held(world, 'ArrowUp');
    const descend = held(world, 'KeyS') || held(world, 'ArrowDown');
    const forward = held(world, 'ShiftLeft') || held(world, 'ShiftRight');
    const steer = (held(world, 'KeyA') || held(world, 'ArrowLeft') ? 1 : 0) - (held(world, 'KeyD') || held(world, 'ArrowRight') ? 1 : 0);
    state.heading += steer * 1.4 * dt;
    if (climb) state.verticalSpeed += 12 * dt;
    else if (descend) state.verticalSpeed -= 12 * dt;
    else state.verticalSpeed -= state.verticalSpeed * 2.5 * dt;
    state.verticalSpeed = Math.max(-13, Math.min(9, state.verticalSpeed));
    const gy = groundHeightAt(state.position.x, state.position.z);
    state.position.y += state.verticalSpeed * dt;
    if (state.position.y <= gy + 0.4) {
      // Touchdown. Hard landings hurt; landing outside a landing zone
      // (open water, marina) is a rough ditching and hurts more.
      if (state.verticalSpeed < -10) damage(30); // hard landing
      if (!isLandingZone(state.position.x, state.position.z)) damage(15);
      state.position.y = gy;
      state.verticalSpeed = 0;
      state.onGround = true;
      state.altitude = 0;
    } else {
      state.onGround = false;
      state.altitude = state.position.y - gy;
      if (state.altitude > MAX_HELI_ALTITUDE) {
        state.altitude = MAX_HELI_ALTITUDE;
        state.position.y = gy + MAX_HELI_ALTITUDE;
        state.verticalSpeed = Math.min(0, state.verticalSpeed);
      }
    }
    // Forward flight on Shift; hover (no drift) otherwise.
    const targetSpeed = forward && !state.onGround ? 22 : 0;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 1.8);
    state.position.x += Math.sin(state.heading) * state.speed * dt;
    state.position.z += Math.cos(state.heading) * state.speed * dt;
    world.player.position.copy(state.position);
    world.player.heading = state.heading;
    world.player.speed = state.speed;
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    if (world.mode === 'pause' || world.mode === 'over') return;
    // Rotor spins up while boarded, down when parked.
    const targetRotor = state.boarded ? 26 : 0;
    state.rotorSpeed += (targetRotor - state.rotorSpeed) * Math.min(1, dt * (state.boarded ? 1.2 : 2.0));
    const ePressed = pressE(world, 'KeyE');
    // EDGE-triggered E with a justEntered guard: entry and exit are never
    // evaluated in the same tick, so holding E cannot enter+exit at once.
    let justEntered = false;
    if (ePressed && !state.boarded) justEntered = enter();
    if (ePressed && state.boarded && !justEntered) exit();
    if (state.boarded) fly(dt);
    if (mesh) {
      mesh.position.copy(state.position);
      mesh.rotation.y = state.heading;
      if (mesh.userData.rotor) mesh.userData.rotor.rotation.y += state.rotorSpeed * dt;
      if (mesh.userData.tailRotor) mesh.userData.tailRotor.rotation.x += state.rotorSpeed * 1.4 * dt;
    }
  }

  function isFlying() {
    return state.boarded && !state.onGround;
  }

  const system = { name: 'playerheli', state, update, enter, exit, unlock, lock, isFlying, groundHeightAt, isLandingZone };
  world.systems.push(system);
  world.systemObjects.playerheli = system;
  world.systemObjects.playerHeli = system;
  return system;
}

export default createPlayerHeli;
