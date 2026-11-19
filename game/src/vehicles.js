import * as THREE from 'three';

export const CAR_SPECS = {
  sports: { maxSpeed: 40, accel: 24, brake: 42, reverse: 12, steer: 2.1, color: 0xd8232a, bodyH: 0.55 },
  sedan: { maxSpeed: 30, accel: 17, brake: 34, reverse: 10, steer: 1.7, color: 0x3a6fd8, bodyH: 0.62 },
  taxi: { maxSpeed: 31, accel: 18, brake: 36, reverse: 10, steer: 1.8, color: 0xf2b705, bodyH: 0.62 },
  truck: { maxSpeed: 22, accel: 10, brake: 26, reverse: 8, steer: 1.05, color: 0x7a7f85, bodyH: 0.9 },
  police: { maxSpeed: 37, accel: 25, brake: 50, reverse: 12, steer: 1.9, color: 0x1c1c22, bodyH: 0.6 },
};

function keySet(input) {
  if (!input) return new Set();
  if (input.keys instanceof Set) return input.keys;
  if (Array.isArray(input.keys)) return new Set(input.keys);
  return new Set();
}

function boxColliders(world) {
  return (world.city && world.city.colliders) || [];
}

function collideBuildings(car, colliders) {
  const r = 1.6;
  for (const c of colliders) {
    const minX = c.minX ?? c.xMin ?? c.x0 ?? -Infinity, maxX = c.maxX ?? c.xMax ?? c.x1 ?? Infinity;
    const minZ = c.minZ ?? c.zMin ?? c.z0 ?? -Infinity, maxZ = c.maxZ ?? c.zMax ?? c.z1 ?? Infinity;
    const px = car.position.x, pz = car.position.z;
    if (px > minX - r && px < maxX + r && pz > minZ - r && pz < maxZ + r) {
      const dxl = px - (minX - r), dxr = (maxX + r) - px;
      const dzl = pz - (minZ - r), dzr = (maxZ + r) - pz;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) car.position.x = minX - r;
      else if (m === dxr) car.position.x = maxX + r;
      else if (m === dzl) car.position.z = minZ - r;
      else car.position.z = maxZ + r;
      car.speed *= 0.35;
      car.crashed = true;
      return true;
    }
  }
  return false;
}

export function createVehicles(world) {
  world.cars = world.cars || [];
  const p = world.player;
  p.nos = p.nos ?? 100;
  p.tireDamage = p.tireDamage ?? 0;

  const tireMarks = [];
  const markMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 });

  function makeCarMesh(kind) {
    const spec = CAR_SPECS[kind] || CAR_SPECS.sedan;
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.35, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.6 });
    const long = kind === 'truck' ? 5.6 : 4.4;
    const wide = kind === 'truck' ? 2.3 : 2.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(wide, spec.bodyH, long), paint);
    body.position.y = 0.65;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.82, 0.55, long * 0.45), glass);
    cabin.position.set(0, 1.2, kind === 'truck' ? 0.9 : -0.2);
    g.add(body, cabin);
    if (kind === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x111111 }));
      sign.position.set(0, 1.6, -0.2);
      g.add(sign);
    }
    if (kind === 'police') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2244ff, emissiveIntensity: 0.8 }));
      bar.position.set(0, 1.58, -0.2);
      g.add(bar);
    }
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
    const wheels = [];
    for (const [wx, wz] of [[-wide / 2, long / 2 - 0.9], [wide / 2, long / 2 - 0.9],
      [-wide / 2, -long / 2 + 0.9], [wide / 2, -long / 2 + 0.9]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      wheels.push(w);
      g.add(w);
    }
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffee88, emissiveIntensity: 0.9 });
    for (const sx of [-0.6, 0.6]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lampMat);
      lamp.position.set(sx, 0.7, long / 2 + 0.02);
      g.add(lamp);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { group: g, wheels };
  }

  function spawnCar(kind, x, z, heading = 0, driver = 'traffic') {
    const spec = CAR_SPECS[kind] || CAR_SPECS.sedan;
    const { group, wheels } = makeCarMesh(kind);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    if (world.scene) world.scene.add(group);
    const car = {
      kind, driver, mesh: group, wheels, position: group.position,
      heading, speed: 0, maxSpeed: spec.maxSpeed, accel: spec.accel,
      brake: spec.brake, steer: spec.steer, color: spec.color,
      crashed: false, drift: 0, laneOffset: 0, targetLane: 0,
    };
    world.cars.push(car);
    return car;
  }

  function dropTireMark(car) {
    if (!world.scene) return;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1.4), markMat);
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = car.heading;
    mark.position.set(car.position.x, 0.03, car.position.z);
    world.scene.add(mark);
    tireMarks.push(mark);
    if (tireMarks.length > 90) {
      const old = tireMarks.shift();
      world.scene.remove(old);
    }
  }

  function drivePlayerCar(car, dt) {
    const keys = keySet(world.input);
    const spec = CAR_SPECS[car.kind] || CAR_SPECS.sedan;
    const damage = Math.min(0.6, p.tireDamage || 0);
    const top = spec.maxSpeed * (1 - damage * 0.55);
    const rain = world.weather && world.weather.raining ? 0.88 : 1;
    const gas = keys.has('KeyW') || keys.has('ArrowUp');
    const brakeKey = keys.has('KeyS') || keys.has('ArrowDown');
    const handbrake = keys.has('Space');
    const nosKey = keys.has('ShiftLeft') || keys.has('ShiftRight');

    // NOS boost: Shift while driving, meter refills over time.
    let boost = 1;
    if (nosKey && gas && (p.nos || 0) > 0) {
      boost = 1.45;
      p.nos = Math.max(0, (p.nos || 0) - 34 * dt);
    } else {
      p.nos = Math.min(100, (p.nos || 0) + 7 * dt);
    }
    if (gas) car.speed += spec.accel * boost * rain * dt;
    else if (brakeKey) {
      if (car.speed > 0.5) car.speed -= spec.brake * dt;
      else car.speed -= spec.accel * 0.55 * dt; // reverse
    } else {
      car.speed -= Math.sign(car.speed) * 6 * dt;
      if (Math.abs(car.speed) < 0.3) car.speed = 0;
    }
    car.speed = Math.max(-(spec.reverse || 12), Math.min(top * boost, car.speed));
    if (handbrake && Math.abs(car.speed) > 6) {
      car.drift = Math.min(1, (car.drift || 0) + dt * 3);
      car.speed *= (1 - 0.12 * dt); // drift keeps most speed
      if (Math.random() < 0.5) dropTireMark(car);
    } else {
      car.drift = Math.max(0, (car.drift || 0) - dt * 2.5);
    }

    // Steering scales down as speed rises; drift loosens the rear.
    const speedFactor = 1 / (1 + Math.abs(car.speed) * 0.045);
    let steerInput = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steerInput += 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steerInput -= 1;
    const steerAmount = steerInput * spec.steer * speedFactor * (1 + (car.drift || 0) * 0.5) * dt;
    car.heading += steerAmount * Math.sign(car.speed || 1);
    const slide = (car.drift || 0) * 0.35;
    const hx = Math.sin(car.heading), hz = Math.cos(car.heading);
    const px = Math.cos(car.heading), pz = -Math.sin(car.heading);
    car.position.x += (hx * car.speed + px * slide * car.speed * 0.25) * dt;
    car.position.z += (hz * car.speed + pz * slide * car.speed * 0.25) * dt;
    car.mesh.rotation.y = car.heading;
    if (car.wheels) for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
    p.speed = car.speed;
    p.heading = car.heading;
    p.position.copy(car.position);
  }

  function collideCars(dt) {
    const cars = world.cars;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 3.4) {
          const push = (3.4 - d) / 2;
          const nx = dx / d, nz = dz / d;
          a.position.x -= nx * push; a.position.z -= nz * push;
          b.position.x += nx * push; b.position.z += nz * push;
          const avg = (a.speed + b.speed) / 2;
          a.speed = avg * 0.6; b.speed = avg * 0.6;
          a.crashed = true; b.crashed = true;
          if (a.driver === 'player' || b.driver === 'player') {
            (world.events = world.events || []).push({ type: 'crash', speed: Math.abs(avg) });
          }
        }
      }
    }
    void dt;
  }

  function update(dt) {
    if (world.mode && world.mode !== 'play') return;
    const colliders = boxColliders(world);
    if (p.car) {
      drivePlayerCar(p.car, dt);
      collideBuildings(p.car, colliders);
      p.car.position.x = Math.max(-300, Math.min(300, p.car.position.x));
      p.car.position.z = Math.max(-300, Math.min(330, p.car.position.z));
      p.car.crashed = false;
    }
    // Non-player cars are steered by traffic / police; here they only
    // get building collision and bounds so they never clip through walls.
    for (const car of world.cars) {
      if (car === p.car) continue;
      if (car.mesh) {
        car.mesh.position.copy(car.position);
        car.mesh.rotation.y = car.heading;
      }
      collideBuildings(car, colliders);
    }
    collideCars(dt);
    // Tire damage slowly heals only by waiting (garage repair is instant).
    if ((p.tireDamage || 0) > 0 && !(p.car)) {
      p.tireDamage = Math.max(0, p.tireDamage - dt * 0.004);
    }
  }

  function repairTires() {
    p.tireDamage = 0;
    if (p.car) p.car.speed = Math.min(p.car.speed, p.car.maxSpeed);
  }

  function despawnCar(car) {
    const i = world.cars.indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
    if (world.scene && car.mesh) world.scene.remove(car.mesh);
  }

  return { update, spawnCar, repairTires, despawnCar, dropTireMark, CAR_SPECS };
}
