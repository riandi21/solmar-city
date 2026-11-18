// Vehicles: low-poly car factory + arcade driving physics for Solmar City.
// One integration point owns every car: player cars, traffic cars and police
// cars all live in world.cars and are all stepped here (position, heading,
// building and car-vs-car collision, wheel spin, mesh sync). Traffic and
// police AI only steer their cars (they set speed / heading targets); they
// never move a car themselves, so nothing is ever integrated twice.
//
// Heading convention (shared with player.js / traffic.js / police.js):
// forward = (sin(heading), 0, cos(heading)); heading 0 faces +Z (south),
// heading PI/2 faces +X (east). Car meshes are built facing +Z, so
// mesh.rotation.y = heading puts the nose where the car is going.
import * as THREE from 'three';

export const CAR_LENGTH = 4.4;
export const CAR_WIDTH = 2.0;

const PLAYER_TOP_SPEED = 32;
const POLICE_TOP_SPEED = 34;
const TRAFFIC_TOP_SPEED = 14;

const ACCEL = 14; // m/s^2, player throttle
const BRAKE = 26; // m/s^2, player brake / reverse
const REVERSE_TOP = 9; // m/s
const ROLLING_DRAG = 0.35; // 1/s, gentle coast-down
const WHEEL_BASE = 2.6; // m, bicycle-model wheelbase
const MAX_LATERAL_ACCEL = 9; // m/s^2, caps yaw rate at speed
const MAX_STEER = 0.5; // rad at the wheels
const CITY_BOUND = 275; // m, cars stop at the edge of the map

const PAINT = [
  0xd94f3d, 0x3d7dd9, 0xe8b93c, 0x4fae5a, 0xe8e4da, 0x2b2f36,
  0x8a5fd0, 0xd97aa8, 0x3fb8a6, 0xc97b2d, 0x7a8899, 0xb8c4cc,
];

function pickPaint(rng) {
  const r = rng || Math.random;
  return PAINT[Math.floor(r() * PAINT.length)];
}

function box(w, h, d, color, x, y, z, opts) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.35,
    ...(opts || {}),
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** Build a low-poly car facing +Z. kind 'police' gets a black/white paint job and a light bar. */
export function buildCarMesh(color, kind) {
  const paint = color === undefined ? 0xd94f3d : color;
  const group = new THREE.Group();
  const isPolice = kind === 'police';

  // Body: dark under-skirt + painted shell, so the car reads at a glance.
  group.add(box(CAR_WIDTH, 0.32, CAR_LENGTH, 0x14161a, 0, 0.32, 0));
  const bodyColor = isPolice ? 0x14181f : paint;
  group.add(box(CAR_WIDTH, 0.55, CAR_LENGTH, bodyColor, 0, 0.62, 0));
  // Cabin + roof. Police cars get a white roof and doors band.
  const cabinColor = isPolice ? 0xe8e8e8 : paint;
  group.add(box(CAR_WIDTH - 0.24, 0.6, 2.2, cabinColor, 0, 1.18, -0.25));
  // Windows: a dark band across the cabin reads as glass from any angle.
  group.add(box(CAR_WIDTH - 0.18, 0.34, 2.0, 0x0e2233, 0, 1.22, -0.25));

  // Wheels: each wheel is a group so it can spin around the lateral (Z) axis.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.4, metalness: 0.6 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.rotation.x = Math.PI / 2; // cylinder axis -> Z (lateral), so it rolls forward
    tyre.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8), hubMat);
    hub.rotation.x = Math.PI / 2;
    pivot.add(tyre, hub);
    group.add(pivot);
    wheels.push(pivot);
  }

  // Headlights (front, +Z) and taillights (rear, -Z).
  group.add(box(0.42, 0.16, 0.06, 0xffffff, -0.62, 0.62, CAR_LENGTH / 2 + 0.01, { emissive: 0xffedb5, emissiveIntensity: 0.7 }));
  group.add(box(0.42, 0.16, 0.06, 0xffffff, 0.62, 0.62, CAR_LENGTH / 2 + 0.01, { emissive: 0xffedb5, emissiveIntensity: 0.7 }));
  group.add(box(0.5, 0.14, 0.06, 0x881111, -0.62, 0.62, -CAR_LENGTH / 2 - 0.01, { emissive: 0xcc2222, emissiveIntensity: 0.7 }));
  group.add(box(0.5, 0.14, 0.06, 0x881111, 0.62, 0.62, -CAR_LENGTH / 2 - 0.01, { emissive: 0xcc2222, emissiveIntensity: 0.7 }));

  let lightBar = null;
  if (isPolice) {
    // Roof light bar: red left, blue right. police.js flashes these.
    const bar = new THREE.Group();
    bar.position.set(0, 1.56, -0.25);
    bar.add(box(1.1, 0.12, 0.34, 0x222222, 0, 0, 0));
    const redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff0000, emissiveIntensity: 1.4 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0033cc, emissive: 0x2266ff, emissiveIntensity: 1.4 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.36), redMat);
    red.position.set(-0.28, 0.05, 0);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.36), blueMat);
    blue.position.set(0.28, 0.05, 0);
    bar.add(red, blue);
    group.add(bar);
    lightBar = { redMat, blueMat };
  }

  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  return group;
}

/** Top speed for a kind of car. */
export function topSpeedFor(kind) {
  if (kind === 'police') return POLICE_TOP_SPEED;
  if (kind === 'traffic') return TRAFFIC_TOP_SPEED;
  return PLAYER_TOP_SPEED;
}

/**
 * Create a car, add it to the scene and to world.cars, and return it.
 * pos is {x, z} or a THREE.Vector3. Standalone (no createVehicles instance
 * needed) so traffic.js and police.js spawn through the same path.
 */
export function makeCar(scene, world, kind, pos, heading, color) {
  if (!world.cars) world.cars = [];
  const mesh = buildCarMesh(color === undefined ? pickPaint(world.rng) : color, kind);
  const x = pos.x !== undefined ? pos.x : 0;
  const z = pos.z !== undefined ? pos.z : 0;
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading || 0;
  scene.add(mesh);
  const car = {
    mesh,
    pos: mesh.position, // same Vector3 object: external readers stay in sync
    heading: heading || 0,
    speed: 0,
    color: color === undefined ? 0xd94f3d : color,
    kind,
    maxSpeed: topSpeedFor(kind),
    driver: kind === 'traffic', // traffic cars have a driver to flee on theft
    steer: 0,
    drift: 0, // slip angle: travel direction lags the nose while drifting
    length: CAR_LENGTH,
    width: CAR_WIDTH,
    active: true,
    ai: null, // traffic / police state lives here when owned by those systems
  };
  world.cars.push(car);
  return car;
}

/** Read building footprints wherever the city system left them. */
export function readColliders(world) {
  if (world.city && Array.isArray(world.city.colliders)) return world.city.colliders;
  if (Array.isArray(world.colliders)) return world.colliders;
  return [];
}

function clampAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Bicycle-model yaw rate: no turn at standstill, capped by lateral grip at speed. */
export function yawRate(speed, steerInput, handbrake) {
  const steerAngle = MAX_STEER * steerInput;
  const byGeometry = Math.abs(speed * Math.tan(steerAngle)) / WHEEL_BASE;
  const byGrip = MAX_LATERAL_ACCEL / Math.max(Math.abs(speed), 1);
  const rate = Math.min(byGeometry, byGrip);
  const boost = handbrake ? 1.35 : 1;
  return Math.sign(speed * steerAngle) * rate * boost;
}

export function createVehicles(scene, world) {
  if (!world.cars) world.cars = [];
  const keys = () => (world.input && world.input.keys) || new Set();
  const playing = () => world.mode === undefined || world.mode === 'play';

  function spawnCar(kind, pos, heading, color) {
    return makeCar(scene, world, kind, pos, heading || 0, color);
  }

  function drivePlayerCar(car, dt) {
    const k = keys();
    const fwd = k.has('KeyW') || k.has('ArrowUp');
    const back = k.has('KeyS') || k.has('ArrowDown');
    const left = k.has('KeyA') || k.has('ArrowLeft');
    const right = k.has('KeyD') || k.has('ArrowRight');
    const handbrake = k.has('Space');
    const steerInput = (left ? -1 : 0) + (right ? 1 : 0);

    // Throttle / brake / reverse. S while rolling forward brakes; at a stop it reverses.
    if (fwd) car.speed += ACCEL * dt;
    if (back) {
      if (car.speed > 0.5) car.speed -= BRAKE * dt;
      else car.speed -= ACCEL * 0.7 * dt;
    }
    if (!fwd && !back) car.speed -= car.speed * ROLLING_DRAG * dt;
    if (handbrake) car.speed -= car.speed * 2.2 * dt;
    car.speed = Math.max(-REVERSE_TOP, Math.min(car.maxSpeed, car.speed));

    // Steering: smooth toward the held input, stronger at low speed.
    const steerTarget = steerInput * (0.55 + 0.45 * Math.min(1, Math.abs(car.speed) / 10));
    car.steer += (steerTarget - car.steer) * (1 - Math.exp(-dt / 0.12));
    car.heading += yawRate(car.speed, car.steer, handbrake) * dt;

    // Drift: while the handbrake is held the travel direction lags the nose,
    // then grip comes back smoothly once it is released.
    const driftTarget = handbrake ? 0.3 * steerInput * Math.min(Math.abs(car.speed) / 8, 1) : 0;
    car.drift += (driftTarget - car.drift) * (1 - Math.exp(-dt / 0.25));
  }

  /** Push a car out of any building footprint it overlaps; returns true on a hit. */
  function collideBuildings(car) {
    const colliders = readColliders(world);
    if (!colliders.length) return false;
    const r = 1.5; // car treated as a circle for building checks
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(car.pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(car.pos.z, c.maxZ));
      const dx = car.pos.x - cx;
      const dz = car.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        car.pos.x = cx + (dx / d) * r;
        car.pos.z = cz + (dz / d) * r;
      } else {
        // Centre inside the footprint: shove out along the shallowest side.
        const pushL = car.pos.x - c.minX + r;
        const pushR = c.maxX - car.pos.x + r;
        const pushT = car.pos.z - c.minZ + r;
        const pushB = c.maxZ - car.pos.z + r;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) car.pos.x = c.minX - r;
        else if (m === pushR) car.pos.x = c.maxX + r;
        else if (m === pushT) car.pos.z = c.minZ - r;
        else car.pos.z = c.maxZ + r;
      }
      car.speed *= 0.45; // a wall hit scrubs speed; heading is kept so the car slides along it
    }
    return hit;
  }

  /** Pairwise car-vs-car: push apart every frame, but scrub speed at most
   *  once per 0.3 s per car — otherwise a car that stays overlapped (a
   *  police ram, a traffic jam) would pin the other car's speed near zero. */
  function collideCars(dt) {
    const cars = world.cars;
    for (const car of cars) {
      if (car.bumpT === undefined) car.bumpT = 0;
      if (car.bumpT > 0) car.bumpT -= dt;
    }
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      if (!a.active) continue;
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        if (!b.active) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const minDist = 3.3;
        const d2 = dx * dx + dz * dz;
        if (d2 >= minDist * minDist || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (minDist - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        if (a.bumpT <= 0 || b.bumpT <= 0) {
          // The player car keeps most of its speed in a shunt (arcade hero
          // feel: a ram shoves you forward instead of gluing you down); the
          // other car takes the bigger hit. Traffic-vs-traffic stays even.
          let aFactor;
          let bFactor;
          if (a.kind === 'player') { aFactor = 0.92; bFactor = b.kind === 'police' ? 0.55 : 0.65; }
          else if (b.kind === 'player') { bFactor = 0.92; aFactor = a.kind === 'police' ? 0.55 : 0.65; }
          else {
            const aWasFaster = Math.abs(a.speed) >= Math.abs(b.speed);
            aFactor = aWasFaster ? 0.82 : 0.6;
            bFactor = aWasFaster ? 0.6 : 0.82;
          }
          a.speed *= aFactor;
          b.speed *= bFactor;
          a.bumpT = 0.3;
          b.bumpT = 0.3;
        }
        if (a.kind === 'player' || b.kind === 'player') {
          const other = a.kind === 'player' ? b : a;
          if (other.kind === 'traffic' || other.kind === 'police') {
            (world.events || (world.events = [])).push({ type: 'carHit', data: { kind: other.kind } });
          }
        }
      }
    }
  }

  function update(dt) {
    const capped = Math.min(dt, 0.05);
    if (playing()) {
      const playerCar = world.player && world.player.car;
      if (playerCar && playerCar.active) drivePlayerCar(playerCar, capped);
      for (const car of world.cars) {
        if (!car.active) continue;
        // Travel along the nose, offset by the drift slip angle.
        const travel = car.heading - (car.drift || 0);
        car.pos.x += Math.sin(travel) * car.speed * capped;
        car.pos.z += Math.cos(travel) * car.speed * capped;
        // City edge: clamp and scrub speed instead of letting cars escape.
        if (car.pos.x < -CITY_BOUND || car.pos.x > CITY_BOUND) {
          car.pos.x = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, car.pos.x));
          car.speed *= 0.5;
        }
        if (car.pos.z < -CITY_BOUND || car.pos.z > CITY_BOUND) {
          car.pos.z = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, car.pos.z));
          car.speed *= 0.5;
        }
        collideBuildings(car);
      }
      collideCars(capped);
    }
    // Mesh sync always runs, so a teleported or spawned car shows up at once.
    for (const car of world.cars) {
      if (!car.active) continue;
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.heading;
      const wheels = car.mesh.userData.wheels || [];
      const spin = (car.speed * capped) / 0.36;
      for (const w of wheels) w.rotation.z -= spin;
    }
  }

  return { spawnCar, update, buildCarMesh, makeCar: (kind, pos, heading, color) => makeCar(scene, world, kind, pos, heading, color) };
}
