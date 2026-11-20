import * as THREE from 'three';

// Bikes: faster than cars, far more agile, vulnerable — a hard crash costs
// health and can throw Rico off. Wheelie on Shift while accelerating
// (small speed boost, harder steering). Bike shop at (60, 270) sells three
// bikes; an owned bike can be called to Rico from the shop menu.
const SHOP = { x: 60, z: 270 };
const KINDS = {
  scooter: { price: 800, maxSpeed: 28, accel: 18, steer: 3.2, color: 0x26a69a },
  street: { price: 2500, maxSpeed: 40, accel: 26, steer: 3.4, color: 0xef5350 },
  superbike: { price: 6000, maxSpeed: 50, accel: 34, steer: 3.6, color: 0xab47bc },
};
const SHOP_STOCK = [
  { kind: 'scooter', price: 800 },
  { kind: 'street', price: 2500 },
  { kind: 'superbike', price: 6000 },
];

function keyDown(world, code, letter) {
  const keys = world && world.input && world.input.keys;
  if (!keys) return false;
  return keys.has(code) || keys.has(letter);
}

function makeBikeMesh(kind, color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x212121 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 0.45), paint);
  body.position.y = 0.65;
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.4), paint);
  tank.position.set(0.35, 0.9, 0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.38), dark);
  seat.position.set(-0.45, 0.85, 0);
  const wheelGeo = new THREE.TorusGeometry(0.34, 0.09, 8, 14);
  const wheelF = new THREE.Mesh(wheelGeo, dark);
  wheelF.position.set(0.85, 0.34, 0);
  wheelF.rotation.y = Math.PI / 2;
  const wheelB = wheelF.clone();
  wheelB.position.x = -0.85;
  group.add(body, tank, seat, wheelF, wheelB);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

function collidesWithBuildings(world, x, z, radius) {
  const colliders = (world.city && world.city.colliders) || [];
  for (const c of colliders) {
    if (!c) continue;
    const minX = c.minX ?? c.x - (c.w ?? c.width ?? 8) / 2;
    const maxX = c.maxX ?? c.x + (c.w ?? c.width ?? 8) / 2;
    const minZ = c.minZ ?? c.z - (c.d ?? c.depth ?? 8) / 2;
    const maxZ = c.maxZ ?? c.z + (c.d ?? c.depth ?? 8) / 2;
    if (x + radius > minX && x - radius < maxX && z + radius > minZ && z - radius < maxZ) return true;
  }
  return false;
}

export function createMotorcycles(scene, world) {
  if (!Array.isArray(world.bikes)) world.bikes = [];
  const owned = [];
  let wheelie = 0;

  function spawnBike(kind, x, z) {
    const spec = KINDS[kind] || KINDS.street;
    const mesh = makeBikeMesh(kind, spec.color);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const bike = {
      mesh, kind, color: spec.color,
      position: mesh.position, heading: 0, speed: 0,
      maxSpeed: spec.maxSpeed, accel: spec.accel, steer: spec.steer,
    };
    world.bikes.push(bike);
    return bike;
  }

  function buyBike(kind) {
    const spec = KINDS[kind];
    if (!spec) return null;
    if (owned.includes(kind)) return spawnBike(kind, world.player.position.x + 3, world.player.position.z + 3);
    if (world.player.cash == null || world.player.cash < spec.price) return null;
    world.player.cash -= spec.price;
    if (typeof world.cash === 'number') world.cash = world.player.cash; // keep the two cash stores in sync
    owned.push(kind);
    return spawnBike(kind, SHOP.x + 4, SHOP.z + 4);
  }

  function callBike(kind) {
    const k = kind || owned[owned.length - 1];
    if (!k || !owned.includes(k)) return null;
    // Only call from near the shop: the shop phones the bike over, so the
    // call only works within 40m of (60, 270).
    const nearShop = Math.hypot(world.player.position.x - SHOP.x, world.player.position.z - SHOP.z) < 40;
    if (!nearShop) return null;
    let bike = world.bikes.find((b) => b.kind === k);
    if (!bike) bike = spawnBike(k, world.player.position.x + 3, world.player.position.z);
    bike.position.set(world.player.position.x + 3, 0, world.player.position.z + 3);
    bike.speed = 0;
    return bike;
  }

  function enterBike(bike) {
    if (!bike) return false;
    world.player.currentBike = bike;
    world.player.onFoot = false;
    world.player.position.copy(bike.position);
    if (world.player.mesh) world.player.mesh.visible = false;
    return true;
  }

  function exitBike() {
    const bike = world.player.currentBike;
    if (!bike) return false;
    world.player.currentBike = null;
    world.player.onFoot = true;
    world.player.position.set(bike.position.x + 2, 0, bike.position.z + 2);
    world.player.speed = 0;
    if (world.player.mesh) world.player.mesh.visible = true;
    return true;
  }

  function throwOff(bike) {
    // Hard impact throws Rico off: bike stops, Rico lands on foot beside it.
    bike.speed = 0;
    world.player.currentBike = null;
    world.player.onFoot = true;
    world.player.position.set(bike.position.x + 2, 0, bike.position.z);
    world.player.speed = 0;
    if (world.player.mesh) world.player.mesh.visible = true;
  }

  function update(dt) {
    const bike = world.player.currentBike;
    if (!bike) {
      for (const b of world.bikes) {
        if (b && b.mesh) { b.mesh.position.set(b.position.x, 0, b.position.z); b.mesh.rotation.y = b.heading || 0; }
      }
      return;
    }
    const p = world.player;
    const fwd = keyDown(world, 'KeyW', 'W');
    const back = keyDown(world, 'KeyS', 'S');
    const left = keyDown(world, 'KeyA', 'A');
    const right = keyDown(world, 'KeyD', 'D');
    const shift = keyDown(world, 'ShiftLeft', 'Shift') || keyDown(world, 'ShiftRight', 'Shift');
    // Wheelie: Shift while accelerating — small boost, harder steering.
    const doingWheelie = shift && fwd && bike.speed > 5;
    wheelie = doingWheelie ? 1 : Math.max(0, wheelie - dt * 3);
    let top = bike.maxSpeed * (doingWheelie ? 1.12 : 1);
    if (fwd) bike.speed += bike.accel * dt;
    if (back) bike.speed -= bike.accel * 0.8 * dt;
    if (!fwd && !back) bike.speed *= Math.max(0, 1 - 1.8 * dt);
    bike.speed = Math.max(-8, Math.min(top, bike.speed));
    const steerFactor = doingWheelie ? 0.45 : Math.max(0.5, 1 - Math.abs(bike.speed) / (top * 1.8));
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const dir = bike.speed >= 0 ? 1 : -1;
    bike.heading += steerInput * bike.steer * steerFactor * dir * dt * Math.min(1, Math.abs(bike.speed) / 5 + 0.3);
    const nx = bike.position.x + Math.sin(bike.heading) * bike.speed * dt;
    const nz = bike.position.z + Math.cos(bike.heading) * bike.speed * dt;
    if (collidesWithBuildings(world, nx, nz, 1)) {
      const impact = Math.abs(bike.speed);
      if (impact > 12) {
        if (p.health != null) p.health = Math.max(0, p.health - Math.round((impact - 12) * 1.5));
        throwOff(bike);
        return;
      }
      bike.speed *= -0.2;
    } else {
      bike.position.x = nx;
      bike.position.z = nz;
    }
    // Car collision: a hard hit also throws Rico off.
    for (const car of world.cars || []) {
      if (!car || !car.position) continue;
      const d = Math.hypot(bike.position.x - car.position.x, bike.position.z - car.position.z);
      if (d < 2.6) {
        const impact = Math.abs(bike.speed - (car.speed || 0));
        bike.speed *= 0.4;
        if (impact > 14) {
          if (p.health != null) p.health = Math.max(0, p.health - Math.round((impact - 14) * 1.5));
          throwOff(bike);
          return;
        }
      }
    }
    bike.mesh.position.set(bike.position.x, 0, bike.position.z);
    bike.mesh.rotation.y = bike.heading;
    // Wheelie lifts the front: tilt the mesh back a touch.
    bike.mesh.rotation.x = doingWheelie ? -0.35 : 0;
    p.position.copy(bike.position);
    p.heading = bike.heading;
    p.speed = bike.speed;
    if (p.mesh) p.mesh.visible = false;
  }

  return { update, spawnBike, enterBike, exitBike, buyBike, callBike, shop: SHOP_STOCK, shopAt: SHOP };
}
