// Arcade cars: per-kind handling, NOS boost, handbrake drift, hydraulics,
// garage upgrades, car-car and car-building collision. The player car is
// driven here whenever world.player.currentCar is set; entry/exit are
// pure state functions owned by the player module's E handling.
import * as THREE from 'three';
import { isDown } from './player.js';

export const HANDLING = {
  sports: { topSpeed: 42, accel: 26, brake: 34, turn: 2.4, grip: 1.0, color: 0xc22e2e },
  sedan: { topSpeed: 32, accel: 18, brake: 28, turn: 2.0, grip: 1.0, color: 0x3a6fd8 },
  truck: { topSpeed: 24, accel: 11, brake: 20, turn: 1.4, grip: 1.0, color: 0x8a7a5a },
  taxi: { topSpeed: 33, accel: 19, brake: 30, turn: 2.1, grip: 1.0, color: 0xe8b93a },
  police: { topSpeed: 40, accel: 24, brake: 38, turn: 2.3, grip: 1.0, color: 0x1c2733 },
  lowrider: { topSpeed: 28, accel: 14, brake: 24, turn: 1.9, grip: 1.0, color: 0x7a2ea6 },
  limo: { topSpeed: 30, accel: 13, brake: 26, turn: 1.5, grip: 1.0, color: 0x14161c },
};

const COLORS = [0xc22e2e, 0x3a6fd8, 0xe8b93a, 0x2e8f5a, 0xd8d8d8, 0x7a2ea6, 0x222222, 0xdd7a2e];

function buildCarMesh(kind, color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a33, metalness: 0.6, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const longBody = kind === 'limo';
  const bodyLen = kind === 'truck' ? 5.4 : longBody ? 6.4 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, bodyLen), paint);
  body.position.y = 0.55;
  body.name = 'body';
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, kind === 'truck' ? 1.6 : 2.1), glass);
  cabin.position.set(0, 1.12, kind === 'truck' ? 1.2 : -0.2);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const wz = bodyLen / 2 - 0.8;
  for (const [wx, wzz] of [[-0.85, wz], [0.85, wz], [-0.85, -wz], [0.85, -wz]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.36, wzz);
    wheels.push(w);
    group.add(w);
  }
  group.add(body, cabin);
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0xf5d020, emissive: 0x554400 }));
    sign.position.set(0, 1.5, -0.2);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.48, -0.2);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.32), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0x880000 }));
    red.position.set(-0.22, 1.58, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.32), new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x000088 }));
    blue.position.set(0.22, 1.58, -0.2);
    group.add(bar, red, blue);
  }
  if (kind === 'lowrider') {
    const chrome = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.1, bodyLen + 0.06), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9, roughness: 0.2 }));
    chrome.position.y = 0.3;
    group.add(chrome);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.userData.wheels = wheels;
  return group;
}

function collideBuildings(world, pos, radius) {
  const colliders = (world.city && world.city.colliders) || world.colliders || [];
  let hit = false;
  for (const c of colliders) {
    if (!c) continue;
    let minX; let maxX; let minZ; let maxZ;
    if (c.minX !== undefined) { minX = c.minX; maxX = c.maxX; minZ = c.minZ; maxZ = c.maxZ; }
    else if (c.x !== undefined) {
      const hw = c.halfW !== undefined ? c.halfW : (c.width || 0) / 2;
      const hd = c.halfD !== undefined ? c.halfD : (c.depth || 0) / 2;
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
      hit = true;
    }
  }
  return hit;
}

export function enterCar(world, car) {
  const p = world.player;
  if (!p || !car) return false;
  p.currentCar = car;
  p.currentBike = null;
  p.currentJetSki = null;
  p.onFoot = false;
  car.driver = 'player';
  if (car.position) p.position.copy(car.position);
  return true;
}

export function exitCar(world) {
  const p = world.player;
  const car = p && p.currentCar;
  if (!p || !car) return false;
  p.currentCar = null;
  car.driver = null;
  p.onFoot = true;
  p.speed = 0;
  const side = Math.cos(p.heading || 0) >= 0 ? 1 : -1;
  p.position.set(car.position.x + side * 2.2, 0, car.position.z + 1.2);
  if (p.mesh) { p.mesh.visible = true; p.mesh.position.copy(p.position); }
  return true;
}

// Module-level spawn so traffic and police can build their cars too.
// Pure world-state work: it only pushes onto world.cars, never onto a
// system object, so it is safe to call before createVehicles runs.
export function spawnCar(scene, world, kind, x, z, opts = {}) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  if (!Array.isArray(world.cars)) world.cars = [];
  const handling = HANDLING[kind] || HANDLING.sedan;
  const color = opts.color !== undefined ? opts.color : (opts.colorIndex !== undefined ? COLORS[opts.colorIndex % COLORS.length] : COLORS[Math.floor(rng() * COLORS.length)]);
  const mesh = buildCarMesh(kind, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = opts.heading !== undefined ? opts.heading : rng() * Math.PI * 2;
  if (scene) scene.add(mesh);
  const car = {
    kind,
    mesh,
    position: mesh.position,
    heading: mesh.rotation.y,
    speed: 0,
    color,
    maxSpeed: handling.topSpeed,
    accel: handling.accel,
    brake: handling.brake,
    turn: handling.turn,
    driver: opts.driver || null,
    upgrades: opts.upgrades || { engine: 0, armor: 0, nosTank: 0, paint: null },
    armor: 0,
    hydraulics: kind === 'lowrider',
    nos: 100,
    nosMax: 100,
    tireDamage: 0,
    tireTimer: 0,
    bounce: 0,
    bounceTimer: 0,
    steer: 0,
  };
  world.cars.push(car);
  return car;
}

export function createVehicles(scene, world) {
  if (!Array.isArray(world.cars)) world.cars = [];

  // Parked street cars so Rico always has something to steal.
  const parked = [
    ['sedan', 58, 40], ['sports', -58, 116], ['taxi', 116, 58],
    ['lowrider', -203, 116], ['sedan', 0, -116], ['truck', -174, -58],
  ];
  for (const [kind, x, z] of parked) spawnCar(scene, world, kind, x, z);

  // Skid-mark pool for handbrake drifts.
  const skidPool = [];
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 40; i += 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.4), skidMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.visible = false;
    if (scene) scene.add(m);
    skidPool.push({ mesh: m, life: 0 });
  }
  let skidIdx = 0;
  let skidTimer = 0;

  function topSpeedOf(car) {
    let top = car.maxSpeed * (1 + 0.18 * (car.upgrades.engine || 0));
    if (car.tireDamage > 0) top *= 1 - 0.4 * car.tireDamage;
    return top;
  }

  function update(dt) {
    if (!world || world.mode !== 'play') return;
    const p = world.player;
    const car = p && p.currentCar;
    if (!car || !car.position) return;

    const fwd = isDown(world, 'KeyW', 'ArrowUp');
    const back = isDown(world, 'KeyS', 'ArrowDown');
    const left = isDown(world, 'KeyA', 'ArrowLeft');
    const right = isDown(world, 'KeyD', 'ArrowRight');
    const handbrake = isDown(world, 'Space');
    const boosting = isDown(world, 'ShiftLeft', 'ShiftRight') && car.nos > 1;

    const top = topSpeedOf(car);
    if (fwd) car.speed += car.accel * dt * (boosting ? 1.7 : 1);
    if (back) {
      if (car.speed > 0.5) car.speed -= car.brake * dt;
      else car.speed -= car.accel * 0.55 * dt; // reverse
    }
    if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 20 * dt);
    if (boosting) {
      car.nos = Math.max(0, car.nos - 34 * dt);
      if (car.speed > 0) car.speed = Math.min(top * 1.35, car.speed + 14 * dt);
    } else {
      car.nos = Math.min(car.nosMax, car.nos + 6 * dt);
    }
    car.speed = Math.max(-top * 0.4, Math.min(top * (boosting ? 1.35 : 1), car.speed));

    // Steering scales with speed; handbrake loosens the grip for drifts.
    const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
    const dir = car.speed >= 0 ? 1 : -1;
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    car.steer += (steerInput - car.steer) * Math.min(1, dt * 8);
    const grip = handbrake ? 0.45 : 1;
    car.heading += car.steer * car.turn * speedFactor * grip * dir * dt;
    const nx = Math.sin(car.heading);
    const nz = Math.cos(car.heading);
    car.position.x += nx * car.speed * dt;
    car.position.z += nz * car.speed * dt;
    car.position.x = Math.max(-420, Math.min(470, car.position.x));
    car.position.z = Math.max(-340, Math.min(470, car.position.z));

    // Building collision: bounce off, crash damage at speed (armor halves it).
    if (collideBuildings(world, car.position, 1.3)) {
      if (Math.abs(car.speed) > 12) {
        const dmg = Math.round((Math.abs(car.speed) - 12) * (car.upgrades.armor ? 0.5 : 1));
        if (dmg > 0 && p.health !== undefined) {
          p.health = Math.max(0, p.health - dmg);
          if (Array.isArray(world.events)) world.events.push({ type: 'crash', damage: dmg });
          if (p.health <= 0) world.mode = 'over';
        }
      }
      car.speed *= -0.25;
    }

    // Car-car collision: push apart, trade a little speed.
    for (const other of world.cars) {
      if (other === car || !other.position) continue;
      const dx = car.position.x - other.position.x;
      const dz = car.position.z - other.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 3.4) {
        const push = (3.4 - d) / 2;
        const ux = dx / d;
        const uz = dz / d;
        car.position.x += ux * push;
        car.position.z += uz * push;
        other.position.x -= ux * push;
        other.position.z -= uz * push;
        const exchange = car.speed * 0.25;
        car.speed -= exchange;
        other.speed = (other.speed || 0) + exchange * 0.5;
      }
    }

    // Tire damage from spike strips recovers slowly by waiting.
    if (car.tireDamage > 0) {
      car.tireTimer += dt;
      if (car.tireTimer > 45) { car.tireDamage = 0; car.tireTimer = 0; }
    }

    // Lowrider hydraulics: H bounces the suspension; a bounce at the
    // domino park in Little Havana pleases the crowd (+$25, cooldown).
    if (car.kind === 'lowrider' && car.hydraulics && isDown(world, 'KeyH') && car.bounceTimer <= 0) {
      car.bounceTimer = 1.4;
      car.bounce = 1;
      const nearDomino = Math.hypot(car.position.x + 215, car.position.z - 130) < 25;
      if (nearDomino) {
        world.cash = (world.cash || 0) + 25;
        if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: 'Crowd loves the bounce! +$25' });
      }
    }
    if (car.bounceTimer > 0) car.bounceTimer -= dt;
    if (car.bounce > 0) car.bounce = Math.max(0, car.bounce - dt * 1.6);

    // Skid marks while drifting.
    skidTimer -= dt;
    if (handbrake && Math.abs(car.speed) > 8 && skidTimer <= 0) {
      skidTimer = 0.12;
      const slot = skidPool[skidIdx % skidPool.length];
      skidIdx += 1;
      slot.mesh.visible = true;
      slot.mesh.position.set(car.position.x - nx * 1.4, 0.02, car.position.z - nz * 1.4);
      slot.mesh.rotation.z = car.heading;
      slot.mesh.material.opacity = 0.55;
      slot.life = 4;
    }
    for (const slot of skidPool) {
      if (slot.life > 0) {
        slot.life -= dt;
        slot.mesh.material.opacity = Math.max(0, slot.life / 4) * 0.55;
        if (slot.life <= 0) slot.mesh.visible = false;
      }
    }

    // Mesh + player sync.
    car.mesh.position.copy(car.position);
    const bounceY = car.bounce > 0 ? Math.sin(car.bounce * Math.PI) * 0.22 : 0;
    car.mesh.position.y = bounceY;
    car.mesh.rotation.y = car.heading;
    const body = car.mesh.getObjectByName('body');
    if (body) body.position.y = 0.55 + bounceY * 0.6;
    p.position.copy(car.position);
    p.heading = car.heading;
    p.speed = car.speed;
    p.onFoot = false;
  }

  function spawnLowriderForShot(x, z, heading = 0.6) {
    // Shot staging: a fresh Lowrider with hydraulics, Rico boarded at
    // once, suspension bouncing, so the drive shot shows the car, not an
    // empty street.
    const car = spawnCar(scene, world, 'lowrider', x, z, { heading, driver: 'player', color: 0x7a2ea6 });
    car.hydraulics = true;
    // Bounce phase 0.5 is peak lift (mesh lift = sin(bounce * PI) * 0.22),
    // so the hydraulics read at the shutter instead of at rest.
    car.bounce = 0.5;
    car.bounceTimer = 1.4;
    enterCar(world, car);
    if (world.player) world.player.car = car;
    return car;
  }

  const sys = {
    name: 'vehicles',
    update,
    spawnCar,
    spawnLowriderForShot,
    enterCar: (c) => enterCar(world, c),
    exitCar: () => exitCar(world),
    topSpeedOf,
  };
  if (Array.isArray(world.systems)) world.systems.push(sys);
  return sys;
}

export default createVehicles;
