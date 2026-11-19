// Motorcycles: faster and far more agile than cars, but vulnerable — a
// crash at speed costs health and can throw Rico off. Wheelie on Shift
// while accelerating (small speed boost, harder steering). The bike shop
// on the boardwalk sells three bikes; an owned bike can be called to
// Rico's position. Entry is E at a parked bike or at the shop (the player
// module owns the E press; this module only drives and sells).
import * as THREE from 'three';
import { isDown } from './player.js';

export const BIKE_SHOP = { x: 60, z: 270 };
export const BIKE_KINDS = {
  scooter: { price: 800, topSpeed: 30, accel: 20, turn: 3.0, color: 0x4ad8c2 },
  street: { price: 2500, topSpeed: 40, accel: 28, turn: 3.2, color: 0xd83a3a },
  superbike: { price: 6000, topSpeed: 52, accel: 36, turn: 3.4, color: 0x222831 },
};

function buildBikeMesh(kind, color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.25 });
  const wheelGeo = new THREE.TorusGeometry(0.34, 0.09, 8, 16);
  const wheelF = new THREE.Mesh(wheelGeo, dark);
  wheelF.position.set(0, 0.34, 0.75);
  const wheelR = new THREE.Mesh(wheelGeo, dark);
  wheelR.position.set(0, 0.34, -0.75);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 1.5), paint);
  body.position.y = 0.62;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.6), dark);
  seat.position.set(0, 0.82, -0.35);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.5), paint);
  tank.position.set(0, 0.82, 0.25);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), chrome);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 1.0, 0.68);
  group.add(wheelF, wheelR, body, seat, tank, bars);
  if (kind === 'scooter') {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.7), dark);
    floor.position.set(0, 0.42, 0.1);
    group.add(floor);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.userData.wheelF = wheelF;
  group.userData.wheelR = wheelR;
  return group;
}

function collideBuildings(world, pos, radius) {
  const colliders = (world.city && world.city.colliders) || world.colliders || [];
  for (const c of colliders) {
    if (!c) continue;
    let minX; let maxX; let minZ; let maxZ;
    if (c.minX !== undefined) { minX = c.minX; maxX = c.maxX; minZ = c.minZ; maxZ = c.maxZ; }
    else if (c.x !== undefined) {
      const hw = c.halfW !== undefined ? c.halfW : (c.width || 0) / 2;
      const hd = c.halfD !== undefined ? c.halfD : (c.depth || 0) / 2;
      minX = c.x - hw; maxX = c.x + hw; minZ = c.z - hd; maxZ = c.z + hd;
    } else continue;
    if (pos.x > minX - radius && pos.x < maxX + radius && pos.z > minZ - radius && pos.z < maxZ + radius) return true;
  }
  return false;
}

export function enterBike(world, bike) {
  const p = world.player;
  if (!p || !bike) return false;
  p.currentBike = bike;
  p.currentCar = null;
  p.currentJetSki = null;
  p.onFoot = false;
  bike.driver = 'player';
  if (bike.position) p.position.copy(bike.position);
  return true;
}

export function exitBike(world) {  const p = world.player;
  const bike = p && p.currentBike;
  if (!p || !bike) return false;
  p.currentBike = null;
  bike.driver = null;
  p.onFoot = true;
  p.speed = 0;
  p.position.set(bike.position.x + 1.6, 0, bike.position.z + 1.2);
  if (p.mesh) { p.mesh.visible = true; p.mesh.position.copy(p.position); }
  return true;
}

export function createMotorcycles(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  if (!Array.isArray(world.bikes)) world.bikes = [];
  if (!Array.isArray(world.ownedBikes)) world.ownedBikes = [];

  function spawnBike(kind, x, z, opts = {}) {
    const spec = BIKE_KINDS[kind] || BIKE_KINDS.street;
    const mesh = buildBikeMesh(kind, opts.color !== undefined ? opts.color : spec.color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = opts.heading !== undefined ? opts.heading : rng() * Math.PI * 2;
    if (scene) scene.add(mesh);
    const bike = {
      kind,
      mesh,
      position: mesh.position,
      heading: mesh.rotation.y,
      speed: 0,
      color: spec.color,
      maxSpeed: spec.topSpeed,
      accel: spec.accel,
      turn: spec.turn,
      driver: opts.driver || null,
      wheelie: 0,
      owned: !!opts.owned,
    };
    world.bikes.push(bike);
    return bike;
  }

  // A few parked bikes around the city, including one at the bike shop.
  spawnBike('scooter', BIKE_SHOP.x + 3, BIKE_SHOP.z + 2);
  spawnBike('street', 120, 90);
  spawnBike('scooter', -58, -174);
  spawnBike('superbike', 200, -230);

  function buyBike(kind) {
    const spec = BIKE_KINDS[kind];
    if (!spec) return { ok: false, reason: 'unknown bike' };
    if (world.ownedBikes.includes(kind)) return { ok: false, reason: 'already owned' };
    if ((world.cash || 0) < spec.price) return { ok: false, reason: 'not enough cash' };
    world.cash -= spec.price;
    world.ownedBikes.push(kind);
    const p = world.player;
    const bike = spawnBike(kind, p ? p.position.x + 3 : BIKE_SHOP.x, p ? p.position.z + 3 : BIKE_SHOP.z, { owned: true });
    if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: `Bought a ${kind} for $${spec.price}` });
    return { ok: true, bike };
  }

  function callBike() {
    const p = world.player;
    if (!p) return null;
    let best = null;
    for (const bike of world.bikes) {
      if (bike.owned || world.ownedBikes.includes(bike.kind)) { best = bike; break; }
    }
    if (!best) return null;
    best.position.set(p.position.x + 3, 0, p.position.z + 2);
    best.mesh.position.copy(best.position);
    return best;
  }

  function throwOff(bike) {
    const p = world.player;
    if (!p) return;
    exitBike(world);
    p.position.y = 0;
    p.health = Math.max(0, (p.health == null ? 100 : p.health) - 15);
    if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: 'Thrown off the bike!' });
    if (p.health <= 0) world.mode = 'over';
  }

  function update(dt) {
    if (!world || world.mode !== 'play') return;
    const p = world.player;
    const bike = p && p.currentBike;
    if (!bike || !bike.position) return;

    const fwd = isDown(world, 'KeyW', 'ArrowUp');
    const back = isDown(world, 'KeyS', 'ArrowDown');
    const left = isDown(world, 'KeyA', 'ArrowLeft');
    const right = isDown(world, 'KeyD', 'ArrowRight');
    const wheelie = isDown(world, 'ShiftLeft', 'ShiftRight') && fwd && bike.speed > 8;

    if (fwd) bike.speed += bike.accel * dt * (wheelie ? 1.15 : 1);
    if (back) {
      if (bike.speed > 0.5) bike.speed -= 26 * dt;
      else bike.speed -= 10 * dt;
    }
    if (!fwd && !back) bike.speed -= Math.sign(bike.speed) * Math.min(Math.abs(bike.speed), 10 * dt);
    bike.speed = Math.max(-12, Math.min(bike.maxSpeed * (wheelie ? 1.1 : 1), bike.speed));

    // Wheelie: faster, but steering gets twitchy.
    bike.wheelie = wheelie ? Math.min(1, bike.wheelie + dt * 4) : Math.max(0, bike.wheelie - dt * 4);
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const turnScale = wheelie ? 0.55 : 1;
    const speedFactor = Math.min(1, Math.abs(bike.speed) / 10);
    bike.heading += steerInput * bike.turn * speedFactor * turnScale * (bike.speed >= 0 ? 1 : -1) * dt;
    const prevX = bike.position.x;
    const prevZ = bike.position.z;
    bike.position.x += Math.sin(bike.heading) * bike.speed * dt;
    bike.position.z += Math.cos(bike.heading) * bike.speed * dt;
    bike.position.x = Math.max(-420, Math.min(470, bike.position.x));
    bike.position.z = Math.max(-340, Math.min(470, bike.position.z));

    // Hard crash: building or another vehicle at speed hurts and can
    // throw Rico off the bike.
    let crashed = false;
    if (collideBuildings(world, bike.position, 1.0)) {
      bike.position.x = prevX;
      bike.position.z = prevZ;
      crashed = Math.abs(bike.speed) > 12;
      bike.speed *= -0.2;
    }
    for (const car of world.cars || []) {
      if (!car.position) continue;
      const d = Math.hypot(bike.position.x - car.position.x, bike.position.z - car.position.z);
      if (d < 2.6 && d > 0.01) {
        if (Math.abs(bike.speed) > 12) crashed = true;
        bike.speed *= 0.4;
        bike.position.x = prevX;
        bike.position.z = prevZ;
      }
    }
    if (crashed) {
      const dmg = 10 + Math.round(Math.abs(bike.speed));
      p.health = Math.max(0, (p.health == null ? 100 : p.health) - dmg);
      if (rng() < 0.55) { throwOff(bike); return; }
      if (p.health <= 0) world.mode = 'over';
    }

    bike.mesh.position.copy(bike.position);
    bike.mesh.rotation.y = bike.heading;
    // Wheelie lifts the front wheel; lean into turns.
    bike.mesh.rotation.x = -bike.wheelie * 0.45;
    bike.mesh.rotation.z = -steerInput * speedFactor * 0.22;
    p.position.copy(bike.position);
    p.heading = bike.heading;
    p.speed = bike.speed;
    p.onFoot = false;
  }

  const sys = {
    name: 'motorcycles',
    update,
    spawnBike,
    buyBike,
    callBike,
    enterBike: (b) => enterBike(world, b),
    exitBike: () => exitBike(world),
  };
  if (Array.isArray(world.systems)) world.systems.push(sys);
  return sys;
}

export default createMotorcycles;
