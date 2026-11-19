// Rico Vega on foot: WASD movement relative to the camera, sprint, jump,
// and the single owner of the E key for cars, bikes and jet skis.
//
// E OWNERSHIP (v12 fix): this module is the only place that consumes an E
// press for a car, a bike or a jet ski. Boats, the seaplane and the player
// helicopter own their own E handling in their own modules. When this
// module consumes a press it stamps world._eClaim = { kind, at } with the
// current world.elapsed, so a later system in the same frame can see the
// press is taken; a claim is only valid for the frame whose elapsed it
// carries, so it never leaks into the next frame. Entering one vehicle can
// never trigger another vehicle's exit in the same tick: exactly one
// enter/exit happens per E press, and the exit check never runs in the
// same tick as an entry.
import * as THREE from 'three';
import { enterCar, exitCar } from './vehicles.js';
import { enterBike, exitBike } from './motorcycles.js';
import { enterJetSki, exitJetSki } from './jetski.js';

const WALK_SPEED = 6;
const SPRINT_SPEED = 10.5;
const WATER_SPEED = 3;
const JUMP_SPEED = 8.5;
const GRAVITY = 24;
const ENTER_RADIUS = 4;

export function isDown(world, ...codes) {
  const keys = world && world.input && world.input.keys;
  if (!keys) return false;
  if (typeof keys.has === 'function') return codes.some((c) => keys.has(c));
  if (Array.isArray(keys)) return codes.some((c) => keys.includes(c));
  return codes.some((c) => !!keys[c]);
}

function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function isWaterAt(x, z) {
  if (z >= 312) return true; // open sea south of the beach
  if (x >= 261 && x <= 400 && z >= 60 && z <= 260) return true; // marina basin
  if (x >= 290 && x <= 460 && z >= 290 && z <= 460) return true; // Islands lagoon
  return false;
}

// MANDATORY v12 FIX: never treat an always-present state object as
// "aboard". The helicopter and seaplane state objects exist from boot,
// so only their boarded flag decides. Boats are different: world.playerBoat
// is only ever claimed on entry (boats.enter sets it), so its presence
// alone means aboard.
export function currentVehicle(world) {
  const p = world && world.player;
  if (!p) return null;
  if (p.currentCar) return { kind: 'car', ref: p.currentCar };
  if (p.currentBike) return { kind: 'bike', ref: p.currentBike };
  if (p.currentJetSki) return { kind: 'jetski', ref: p.currentJetSki };
  const boat = p.currentBoat || world.playerBoat;
  if (boat) return { kind: 'boat', ref: boat };
  if (world.playerHeli && world.playerHeli.boarded === true) {
    return { kind: 'heli', ref: world.playerHeli };
  }
  if (p.currentHeli && p.currentHeli.boarded === true) {
    return { kind: 'heli', ref: p.currentHeli };
  }
  if (world.seaplane && world.seaplane.boarded === true) {
    return { kind: 'seaplane', ref: world.seaplane };
  }
  return null;
}

export function damagePlayer(world, amount) {
  const p = world && world.player;
  if (!p || world.mode === 'over') return;
  p.health = Math.max(0, (p.health == null ? 100 : p.health) - amount);
  if (p.health <= 0) {
    world.mode = 'over';
    if (Array.isArray(world.events)) world.events.push({ type: 'wasted' });
  }
}

function buildPlayerMesh() {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2e8f86 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f3a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.62, 4, 10), shirt);
  body.position.y = 1.05;
  body.name = 'body';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.78;
  head.name = 'head';
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x1a1210 }));
  hair.position.y = 1.82;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pants);
  legL.position.set(-0.16, 0.36, 0);
  legL.name = 'legL';
  const legR = legL.clone();
  legR.position.x = 0.16;
  legR.name = 'legR';
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), shirt);
  armL.position.set(-0.46, 1.12, 0);
  armL.name = 'armL';
  const armR = armL.clone();
  armR.position.x = 0.46;
  armR.name = 'armR';
  group.add(body, head, hair, legL, legR, armL, armR);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

function nearestOf(list, x, z, radius) {
  let best = null;
  let bestD = radius;
  if (!Array.isArray(list)) return null;
  for (const item of list) {
    if (!item || !item.position) continue;
    if (item.driver === 'player') continue;
    const d = dist2d(x, z, item.position.x, item.position.z);
    if (d < bestD) { bestD = d; best = item; }
  }
  return best;
}

function resolveColliders(world, pos, radius) {
  const colliders = (world.city && world.city.colliders) || world.colliders || [];
  for (const c of colliders) {
    if (!c) continue;
    let minX; let maxX; let minZ; let maxZ;
    if (c.minX !== undefined) { minX = c.minX; maxX = c.maxX; minZ = c.minZ; maxZ = c.maxZ; }
    else if (c.x !== undefined) {
      const hw = (c.halfW !== undefined ? c.halfW : (c.width || 0) / 2);
      const hd = (c.halfD !== undefined ? c.halfD : (c.depth || 0) / 2);
      minX = c.x - hw; maxX = c.x + hw; minZ = c.z - hd; maxZ = c.z + hd;
    } else continue;
    if (pos.x > minX - radius && pos.x < maxX + radius && pos.z > minZ - radius && pos.z < maxZ + radius) {
      const pushL = pos.x - (minX - radius);
      const pushR = (maxX + radius) - pos.x;
      const pushU = pos.z - (minZ - radius);
      const pushD = (maxZ + radius) - pos.z;
      const m = Math.min(pushL, pushR, pushU, pushD);
      if (m === pushL) pos.x = minX - radius;
      else if (m === pushR) pos.x = maxX + radius;
      else if (m === pushU) pos.z = minZ - radius;
      else pos.z = maxZ + radius;
    }
  }
}

export function createPlayer(scene, world) {
  if (!world.player) {
    world.player = {
      position: new THREE.Vector3(-174, 0, 232),
      heading: 0,
      speed: 0,
      onFoot: true,
      health: 100,
      cash: world.cash || 0,
      currentCar: null,
      currentBike: null,
      currentJetSki: null,
      currentBoat: null,
      mesh: null,
      vy: 0,
      grounded: true,
    };
  }
  const p = world.player;
  if (!p.position) p.position = new THREE.Vector3(-174, 0, 232);
  if (p.health == null) p.health = 100;
  if (p.onFoot === undefined) p.onFoot = !currentVehicle(world);
  if (!p.mesh) {
    p.mesh = buildPlayerMesh();
    p.mesh.position.copy(p.position);
    if (scene) scene.add(p.mesh);
  }

  let prevE = false;
  let walkPhase = 0;
  let toastCooldown = 0;

  function toast(text) {
    if (toastCooldown > 0) return;
    toastCooldown = 1.2;
    if (Array.isArray(world.events)) world.events.push({ type: 'toast', text });
  }

  // One E press, one vehicle action. Returns true when this press was used.
  function handleEnterPress() {
    if (world._eClaim && world._eClaim.at === world.elapsed) return false;
    const aboard = currentVehicle(world);
    if (aboard) {
      // Only exit vehicles this module owns. Boats, heli and seaplane
      // keep their own E handling; exiting them here would double-exit.
      if (aboard.kind === 'car') exitCar(world);
      else if (aboard.kind === 'bike') exitBike(world);
      else if (aboard.kind === 'jetski') exitJetSki(world);
      else return false;
      world._eClaim = { kind: aboard.kind, at: world.elapsed };
      return true;
    }
    const x = p.position.x;
    const z = p.position.z;
    const car = nearestOf(world.cars, x, z, ENTER_RADIUS);
    if (car) {
      enterCar(world, car);
      world._eClaim = { kind: 'car', at: world.elapsed };
      return true;
    }
    const bike = nearestOf(world.bikes, x, z, ENTER_RADIUS);
    if (bike) {
      enterBike(world, bike);
      world._eClaim = { kind: 'bike', at: world.elapsed };
      return true;
    }
    const ski = nearestOf(world.jetSkis, x, z, ENTER_RADIUS);
    if (ski) {
      enterJetSki(world, ski);
      world._eClaim = { kind: 'jetski', at: world.elapsed };
      return true;
    }
    return false;
  }

  function update(dt) {
    if (!world || world.mode !== 'play') {
      prevE = isDown(world, 'KeyE');
      return;
    }
    if (toastCooldown > 0) toastCooldown -= dt;
    const eDown = isDown(world, 'KeyE');
    const ePressed = eDown && !prevE;
    prevE = eDown;

    const aboard = currentVehicle(world);
    if (aboard) {
      // While riding, the vehicle systems move the player; mirror the
      // vehicle position here as a safety net so the HUD minimap and
      // anything keyed off the player position stay live even if a
      // vehicle system runs before this one in the frame.
      if (aboard.ref && aboard.ref.position) {
        p.position.copy(aboard.ref.position);
        if (aboard.ref.heading !== undefined) p.heading = aboard.ref.heading;
      }
      p.onFoot = false;
      p.speed = (aboard.ref && aboard.ref.speed) || 0;
      if (ePressed) handleEnterPress();
      if (p.mesh) {
        p.mesh.visible = false; // driver sits inside the vehicle mesh
        p.mesh.position.copy(p.position);
      }
      return;
    }

    p.onFoot = true;
    if (ePressed) handleEnterPress();
    if (currentVehicle(world)) return; // just boarded; vehicle drives now

    if (p.mesh) p.mesh.visible = true;
    const inWater = isWaterAt(p.position.x, p.position.z);
    const sprint = isDown(world, 'ShiftLeft', 'ShiftRight');
    const speed = inWater ? WATER_SPEED : (sprint ? SPRINT_SPEED : WALK_SPEED);

    // Movement relative to the camera yaw.
    let fx = 0;
    let fz = -1;
    const cam = world.camera;
    if (cam) {
      const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
      fx = -Math.sin(e.y);
      fz = -Math.cos(e.y);
    }
    const rx = -fz;
    const rz = fx;
    let mx = 0;
    let mz = 0;
    if (isDown(world, 'KeyW', 'ArrowUp')) { mx += fx; mz += fz; }
    if (isDown(world, 'KeyS', 'ArrowDown')) { mx -= fx; mz -= fz; }
    if (isDown(world, 'KeyD', 'ArrowRight')) { mx += rx; mz += rz; }
    if (isDown(world, 'KeyA', 'ArrowLeft')) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      p.position.x += mx * speed * dt;
      p.position.z += mz * speed * dt;
      p.heading = Math.atan2(mx, mz);
      p.speed = speed;
      walkPhase += dt * speed * 1.6;
    } else {
      p.speed = 0;
      walkPhase *= 0.9;
    }

    // Jump + gravity. No jumping while swimming.
    if (isDown(world, 'Space') && p.grounded && !inWater) {
      p.vy = JUMP_SPEED;
      p.grounded = false;
    }
    if (!p.grounded) {
      p.vy -= GRAVITY * dt;
      p.position.y += p.vy * dt;
      if (p.position.y <= 0) { p.position.y = 0; p.vy = 0; p.grounded = true; }
    }
    if (inWater) p.position.y = Math.max(0, p.position.y - dt * 2);

    resolveColliders(world, p.position, 0.5);
    p.position.x = Math.max(-420, Math.min(470, p.position.x));
    p.position.z = Math.max(-340, Math.min(470, p.position.z));

    if (p.mesh) {
      p.mesh.position.copy(p.position);
      p.mesh.rotation.y = p.heading;
      const swing = len > 0 ? Math.sin(walkPhase) * 0.55 : 0;
      const legL = p.mesh.getObjectByName('legL');
      const legR = p.mesh.getObjectByName('legR');
      const armL = p.mesh.getObjectByName('armL');
      const armR = p.mesh.getObjectByName('armR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (armL) armL.rotation.x = -swing;
      if (armR) armR.rotation.x = swing;
    }
  }

  const sys = {
    name: 'player',
    update,
    currentVehicle: () => currentVehicle(world),
    damage: (amount) => damagePlayer(world, amount),
    teleport: (x, z) => {
      p.position.set(x, 0, z);
      if (p.mesh) p.mesh.position.copy(p.position);
    },
  };
  if (Array.isArray(world.systems)) world.systems.push(sys);
  return sys;
}

export default createPlayer;
