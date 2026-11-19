// Solmar City — seaplane: takes off from water, lands on water or the
// airfield runway. Enter with E at the marina seaplane dock or the Islands
// airstrip. W/S throttle and climb/descent, A/D steer. Fragile: a hard
// landing or a crash ashore costs a lot of health.
// world.seaplane is plain state data (boarded flag included); the system
// object lives in world.systems / world.systemObjects.
import * as THREE from 'three';
import { WATER_Y, isWater } from './boats.js';

export const SEAPLANE_DOCK = { x: 320, z: 200 };
export const ISLANDS_AIRSTRIP = { x: 375, z: 375 };
export const RUNWAY = { minX: 150, maxX: 260, minZ: -260, maxZ: -200 };
export const MAX_ALTITUDE = 120;
export const TAKEOFF_SPEED = 24;

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

function onRunway(x, z) {
  return x >= RUNWAY.minX && x <= RUNWAY.maxX && z >= RUNWAY.minZ && z <= RUNWAY.maxZ;
}

function buildSeaplaneMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8b13a });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 7, 10), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 1.1;
  group.add(fuselage);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 1.8), whiteMat);
  wing.position.set(0, 1.7, 0.4);
  group.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 1.1), whiteMat);
  tail.position.set(0, 1.5, -3.2);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 1.2), bodyMat);
  fin.position.set(0, 2.1, -3.2);
  group.add(fin);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.3), darkMat);
  prop.position.set(0, 1.1, 3.7);
  group.add(prop);
  group.userData.prop = prop;
  for (const side of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.5, 8), whiteMat);
    float.rotation.x = Math.PI / 2;
    float.position.set(side * 1.6, 0.1, 0.3);
    group.add(float);
  }
  const windowMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.4), windowMat);
  windshield.position.set(0, 1.5, 2.2);
  group.add(windshield);
  return group;
}

export function createSeaplane(scene, world) {
  ({ scene, world } = resolveArgs(scene, world));
  if (!world) throw new Error('createSeaplane needs a world');
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
  const mesh = hasScene ? buildSeaplaneMesh() : null;
  const state = {
    mesh,
    position: new THREE.Vector3(SEAPLANE_DOCK.x, WATER_Y, SEAPLANE_DOCK.z),
    heading: Math.PI,
    speed: 0,
    altitude: 0, // height above the surface (water or runway)
    onWater: true,
    onGround: false,
    airborne: false,
    boarded: false, // the flag currentVehicle() must check before "aboard"
    verticalSpeed: 0,
  };
  world.seaplane = state;
  if (mesh) {
    mesh.position.copy(state.position);
    scene.add(mesh);
  }

  const pressE = makePressTracker();

  function nearDock() {
    const pp = world.player.position;
    const dDock = Math.hypot(pp.x - SEAPLANE_DOCK.x, pp.z - SEAPLANE_DOCK.z);
    const dStrip = Math.hypot(pp.x - ISLANDS_AIRSTRIP.x, pp.z - ISLANDS_AIRSTRIP.z);
    const dPlane = Math.hypot(pp.x - state.position.x, pp.z - state.position.z);
    return dDock < 9 || dStrip < 9 || dPlane < 8;
  }

  function playerFree() {
    const p = world.player;
    if (!p.onFoot) return false;
    if (world.playerBoat) return false;
    if (world.playerHeli && world.playerHeli.boarded) return false;
    if (p.currentCar || p.currentBike || p.currentJetSki) return false;
    return true;
  }

  function enter() {
    if (state.boarded || !playerFree() || !nearDock()) return false;
    state.boarded = true;
    world.player.onFoot = false;
    world.player.seaplane = state;
    world.player.position.copy(state.position);
    world.player.heading = state.heading;
    return true;
  }

  function exit() {
    if (!state.boarded || state.airborne) return false;
    state.boarded = false;
    state.speed = 0;
    world.player.onFoot = true;
    world.player.seaplane = null;
    const px = state.position.x;
    const pz = state.position.z;
    world.player.position.set(px + 4, state.onWater ? WATER_Y : 0, pz + 2);
    return true;
  }

  function damage(amount) {
    if (typeof world.player.health === 'number') {
      world.player.health = Math.max(0, world.player.health - amount);
    }
    if (world.events) world.events.push({ type: 'seaplane-damage', amount });
  }

  function fly(dt) {
    const throttleUp = held(world, 'KeyW') || held(world, 'ArrowUp');
    const throttleDown = held(world, 'KeyS') || held(world, 'ArrowDown');
    if (throttleUp) state.speed += 14 * dt;
    if (throttleDown) state.speed -= 16 * dt;
    state.speed = Math.max(0, Math.min(55, state.speed));
    if (!state.airborne) state.speed -= state.speed * 0.12 * dt;
    const steer = (held(world, 'KeyA') || held(world, 'ArrowLeft') ? 1 : 0) - (held(world, 'KeyD') || held(world, 'ArrowRight') ? 1 : 0);
    const steerAuthority = state.airborne ? 1.1 : Math.min(1, state.speed / 12);
    state.heading += steer * steerAuthority * dt;
    // Takeoff: enough speed on the water lifts the plane off.
    if (!state.airborne && state.onWater && state.speed >= TAKEOFF_SPEED) {
      state.airborne = true;
      state.onWater = false;
      state.altitude = 0.5;
    }
    if (state.airborne) {
      if (throttleUp) state.verticalSpeed += 7 * dt;
      if (throttleDown) state.verticalSpeed -= 9 * dt;
      state.verticalSpeed = Math.max(-14, Math.min(10, state.verticalSpeed));
      state.altitude += state.verticalSpeed * dt;
      if (state.altitude > MAX_ALTITUDE) {
        state.altitude = MAX_ALTITUDE;
        state.verticalSpeed = Math.min(0, state.verticalSpeed);
      }
      if (state.altitude <= 0) {
        // Touchdown: water and runway are safe, dry land is a crash.
        state.altitude = 0;
        const x = state.position.x;
        const z = state.position.z;
        const hard = state.verticalSpeed < -9 || state.speed > 40;
        state.airborne = false;
        state.verticalSpeed = 0;
        if (isWater(x, z)) {
          state.onWater = true;
          state.onGround = false;
          if (hard) damage(20);
        } else if (onRunway(x, z)) {
          state.onWater = false;
          state.onGround = true;
          if (hard) damage(25);
        } else {
          state.onWater = false;
          state.onGround = true;
          damage(40);
          state.speed = 0;
        }
      }
    } else if (state.onWater || state.onGround) {
      state.altitude = 0;
      state.verticalSpeed = 0;
    }
    state.position.x += Math.sin(state.heading) * state.speed * dt;
    state.position.z += Math.cos(state.heading) * state.speed * dt;
    state.position.y = (state.onWater ? WATER_Y : 0) + state.altitude;
    world.player.position.copy(state.position);
    world.player.heading = state.heading;
    world.player.speed = state.speed;
  }

  function isFlying() {
    return state.boarded && state.airborne;
  }

  function takeoffReady() {
    return state.boarded && state.onWater && state.speed >= TAKEOFF_SPEED;
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    if (world.mode === 'pause' || world.mode === 'over') return;
    const ePressed = pressE(world, 'KeyE');
    let enteredThisTick = false;
    if (ePressed && !state.boarded) enteredThisTick = enter();
    // Never exit in the same tick as an entry (E is still held down).
    if (ePressed && state.boarded && !enteredThisTick) exit();
    if (state.boarded) fly(dt);
    if (mesh) {
      const bob = state.onWater && !state.boarded
        ? Math.sin(world.elapsed * 1.3 + state.position.x * 0.05) * 0.1
        : 0;
      mesh.position.set(state.position.x, state.position.y + bob, state.position.z);
      mesh.rotation.y = state.heading;
      mesh.rotation.z = state.airborne ? 0 : Math.sin((world.elapsed || 0) * 0.8) * 0.015;
      if (mesh.userData.prop) mesh.userData.prop.rotation.z += (state.boarded ? 18 : 2) * dt;
    }
  }

  const system = { name: 'seaplane', state, update, enter, exit, onRunway, isWater, isFlying, takeoffReady };
  world.systems.push(system);
  world.systemObjects.seaplane = system;
  return system;
}

export default createSeaplane;
