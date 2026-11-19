import * as THREE from 'three';

export const BIKE_SHOP = { x: 60, z: 270 };
export const BIKE_KINDS = {
  scooter: { price: 800, maxSpeed: 26, accel: 16, steer: 2.6, color: 0x4ad8a0, label: 'City Scooter' },
  street: { price: 2500, maxSpeed: 36, accel: 22, steer: 2.4, color: 0xd84a4a, label: 'Street Bike' },
  superbike: { price: 6000, maxSpeed: 46, accel: 30, steer: 2.2, color: 0x2222cc, label: 'Superbike' },
};

function keySet(input) {
  if (!input) return new Set();
  if (input.keys instanceof Set) return input.keys;
  if (Array.isArray(input.keys)) return new Set(input.keys);
  return new Set();
}

function collideBuildings(bike, colliders) {
  const r = 1.1;
  for (const c of colliders || []) {
    const minX = (c.minX ?? c.xMin ?? c.x0 ?? -Infinity) - r, maxX = (c.maxX ?? c.xMax ?? c.x1 ?? Infinity) + r;
    const minZ = (c.minZ ?? c.zMin ?? c.z0 ?? -Infinity) - r, maxZ = (c.maxZ ?? c.zMax ?? c.z1 ?? Infinity) + r;
    const px = bike.position.x, pz = bike.position.z;
    if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
      const dxl = px - minX, dxr = maxX - px, dzl = pz - minZ, dzr = maxZ - pz;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) bike.position.x = minX;
      else if (m === dxr) bike.position.x = maxX;
      else if (m === dzl) bike.position.z = minZ;
      else bike.position.z = maxZ;
      return true;
    }
  }
  return false;
}

export function createMotorcycles(world) {
  world.bikes = world.bikes || [];
  const p = world.player;
  world.ownedBikes = world.ownedBikes || [];
  p.cash = p.cash ?? 0;
  let wheelie = false;
  let shopOpen = false;
  let selectedKind = 'street';

  function makeBikeMesh(kind) {
    const spec = BIKE_KINDS[kind] || BIKE_KINDS.street;
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.35, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.85 });
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 1.1), paint);
    tank.position.set(0, 0.85, 0.1);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.7), dark);
    seat.position.set(0, 0.85, -0.6);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.7), dark);
    frame.position.set(0, 0.55, 0);
    g.add(tank, seat, frame);
    const wheelGeo = new THREE.TorusGeometry(0.34, 0.1, 8, 18);
    const front = new THREE.Mesh(wheelGeo, dark);
    front.position.set(0, 0.34, 0.95);
    const rear = new THREE.Mesh(wheelGeo, dark);
    rear.position.set(0, 0.34, -0.85);
    g.add(front, rear);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), dark);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.12, 0.75);
    g.add(bar);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffee88, emissiveIntensity: 0.9 }));
    lamp.position.set(0, 0.95, 1.02);
    g.add(lamp);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { group: g, frontWheel: front, rearWheel: rear };
  }

  function spawnBike(kind, x, z, heading = 0, driver = 'parked') {
    const spec = BIKE_KINDS[kind] || BIKE_KINDS.street;
    const { group, frontWheel, rearWheel } = makeBikeMesh(kind);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    if (world.scene) world.scene.add(group);
    const bike = {
      kind, driver, mesh: group, frontWheel, rearWheel, position: group.position,
      heading, speed: 0, maxSpeed: spec.maxSpeed, accel: spec.accel,
      steer: spec.steer, price: spec.price, label: spec.label, fallen: false,
    };
    world.bikes.push(bike);
    return bike;
  }

  // Parked bikes around the city plus the shop's display row.
  spawnBike('scooter', 58, 266, Math.PI / 2, 'parked');
  spawnBike('street', 62, 266, Math.PI / 2, 'parked');
  spawnBike('superbike', 66, 266, Math.PI / 2, 'parked');
  spawnBike('scooter', -168, 226, 0, 'parked');
  spawnBike('street', 100, 64, Math.PI, 'parked');

  function nearestBike(maxDist = 3.5) {
    let best = null, bestD = maxDist;
    for (const b of world.bikes) {
      if (b.driver === 'player') continue;
      const d = b.position.distanceTo(p.position);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function buyBike(kind) {
    const spec = BIKE_KINDS[kind];
    if (!spec) return { ok: false, reason: 'unknown bike' };
    if (world.ownedBikes.includes(kind)) return { ok: false, reason: 'already owned' };
    if ((p.cash || 0) < spec.price) return { ok: false, reason: 'not enough cash' };
    p.cash -= spec.price;
    world.ownedBikes.push(kind);
    (world.events = world.events || []).push({ type: 'bike-bought', kind, price: spec.price });
    return { ok: true, kind };
  }

  function callBike(kind) {
    if (!world.ownedBikes.includes(kind)) return { ok: false, reason: 'not owned' };
    let bike = world.bikes.find((b) => b.kind === kind && b.driver !== 'player');
    if (!bike) bike = spawnBike(kind, p.position.x + 3, p.position.z + 3, p.heading, 'parked');
    bike.position.set(p.position.x + 3, 0, p.position.z + 3);
    bike.heading = p.heading;
    bike.speed = 0;
    bike.fallen = false;
    if (bike.mesh) { bike.mesh.rotation.set(0, bike.heading, 0); bike.mesh.position.copy(bike.position); }
    (world.events = world.events || []).push({ type: 'bike-called', kind });
    return { ok: true, bike };
  }

  function throwOff(bike) {
    // Hard crash: Rico is thrown off and the bike tips over.
    const damage = Math.max(5, Math.round((Math.abs(bike.speed) - 10) * 1.5));
    p.health = Math.max(0, (p.health ?? 100) - damage);
    p.bike = null; p.onFoot = true; p.speed = 0;
    bike.driver = 'parked';
    bike.speed = 0;
    bike.fallen = true;
    if (bike.mesh) bike.mesh.rotation.z = Math.PI / 2 - 0.15;
    if (p.mesh) { p.mesh.visible = true; p.mesh.position.copy(p.position); }
    (world.events = world.events || []).push({ type: 'bike-crash', damage, health: p.health });
  }

  function driveBike(bike, dt) {
    const keys = keySet(world.input);
    const spec = BIKE_KINDS[bike.kind] || BIKE_KINDS.street;
    const gas = keys.has('KeyW') || keys.has('ArrowUp');
    const brakeKey = keys.has('KeyS') || keys.has('ArrowDown');
    const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const rain = world.weather && world.weather.raining ? 0.9 : 1;
    wheelie = shift && gas && bike.speed > 8;
    if (gas) bike.speed += spec.accel * (wheelie ? 1.18 : 1) * rain * dt;
    else if (brakeKey) {
      if (bike.speed > 0.5) bike.speed -= 34 * dt;
      else bike.speed -= spec.accel * 0.5 * dt;
    } else {
      bike.speed -= Math.sign(bike.speed) * 5 * dt;
      if (Math.abs(bike.speed) < 0.3) bike.speed = 0;
    }
    bike.speed = Math.max(-10, Math.min(spec.maxSpeed * (wheelie ? 1.12 : 1), bike.speed));
    // Agile steering, harder while wheelieing; rain loosens the rear.
    const speedFactor = 1 / (1 + Math.abs(bike.speed) * 0.04);
    let steerInput = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steerInput += 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steerInput -= 1;
    const steerScale = wheelie ? 0.55 : 1;
    bike.heading += steerInput * spec.steer * speedFactor * steerScale * dt * Math.sign(bike.speed || 1);
    bike.position.x += Math.sin(bike.heading) * bike.speed * dt;
    bike.position.z += Math.cos(bike.heading) * bike.speed * dt;
    if (bike.mesh) {
      bike.mesh.position.copy(bike.position);
      bike.mesh.rotation.y = bike.heading;
      // Wheelie lifts the front; lean into turns.
      bike.mesh.rotation.x = wheelie ? -0.35 : 0;
      bike.mesh.rotation.z = -steerInput * Math.min(0.3, Math.abs(bike.speed) * 0.008);
      if (bike.frontWheel) bike.frontWheel.rotation.y += bike.speed * dt * 2;
      if (bike.rearWheel) bike.rearWheel.rotation.y += bike.speed * dt * 2;
    }
    p.speed = bike.speed;
    p.heading = bike.heading;
    p.position.copy(bike.position);
  }

  function update(dt) {
    if (world.mode && world.mode !== 'play') return;
    // Shop proximity: open the shop menu when Rico is near the boardwalk shop.
    const shopDist = Math.hypot(p.position.x - BIKE_SHOP.x, p.position.z - BIKE_SHOP.z);
    const nearShop = shopDist < 7;
    world.bikeShopNear = nearShop;
    if (!nearShop) shopOpen = false;
    const bike = p.bike;
    if (!bike) { wheelie = false; return; }
    const speedBefore = Math.abs(bike.speed);
    driveBike(bike, dt);
    // Same collision as cars, plus a fall-off on hard impacts.
    const colliders = (world.city && world.city.colliders) || [];
    const hitWall = collideBuildings(bike, colliders);
    let hitCar = false;
    for (const car of world.cars || []) {
      const d = Math.hypot(car.position.x - bike.position.x, car.position.z - bike.position.z);
      if (d < 2.6) { hitCar = true; break; }
    }
    if ((hitWall || hitCar) && speedBefore > 12) {
      bike.speed = 0;
      throwOff(bike);
      return;
    }
    if (hitWall || hitCar) bike.speed *= 0.4;
    bike.position.x = Math.max(-300, Math.min(300, bike.position.x));
    bike.position.z = Math.max(-300, Math.min(330, bike.position.z));
  }

  return {
    update, spawnBike, buyBike, callBike, nearestBike,
    get wheelie() { return wheelie; },
    get shopOpen() { return shopOpen; },
    openShop() {
      // The shop menu only opens at the boardwalk shop; elsewhere the
      // call is ignored so a stray key press cannot open it mid-chase.
      const near = Math.hypot(p.position.x - BIKE_SHOP.x, p.position.z - BIKE_SHOP.z) < 7;
      if (near) shopOpen = true;
      return shopOpen ? BIKE_KINDS : null;
    },
    closeShop() { shopOpen = false; },
    selectBike(kind) { if (BIKE_KINDS[kind]) selectedKind = kind; return selectedKind; },
    get selectedKind() { return selectedKind; },
    BIKE_KINDS, BIKE_SHOP,
  };
}
