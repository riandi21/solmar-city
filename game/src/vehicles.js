import * as THREE from 'three';

// Arcade driving: accelerate / brake / reverse, steering that tightens at
// low speed and loosens at high speed, handbrake drift with tyre marks,
// NOS boost on Shift, garage upgrades, lowrider hydraulics (H) and the
// armored limo. The player's position syncs to the car every frame.
const KINDS = {
  sports: { maxSpeed: 42, accel: 26, brake: 42, steer: 2.4, color: 0xd32f2f, body: [4.4, 0.7, 2.0] },
  sedan: { maxSpeed: 32, accel: 20, brake: 34, steer: 2.1, color: 0x546e7a, body: [4.4, 0.8, 2.0] },
  taxi: { maxSpeed: 33, accel: 20, brake: 36, steer: 2.1, color: 0xffc107, body: [4.4, 0.8, 2.0] },
  truck: { maxSpeed: 24, accel: 12, brake: 26, steer: 1.5, color: 0x6d4c41, body: [5.6, 1.1, 2.4] },
  police: { maxSpeed: 38, accel: 24, brake: 48, steer: 2.3, color: 0x1565c0, body: [4.4, 0.8, 2.0] },
  lowrider: { maxSpeed: 26, accel: 16, brake: 30, steer: 2.0, color: 0x8e24aa, body: [4.6, 0.65, 2.0] },
  limo: { maxSpeed: 27, accel: 13, brake: 30, steer: 1.6, color: 0x111111, body: [7.2, 0.9, 2.1] },
};

function keyDown(world, code, letter) {
  const keys = world && world.input && world.input.keys;
  if (!keys) return false;
  return keys.has(code) || keys.has(letter);
}

function makeCarMesh(kind, color) {
  const spec = KINDS[kind] || KINDS.sedan;
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x90caf9 });
  const [bl, bh, bw] = spec.body;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bl, bh, bw), paint);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(bl * 0.5, 0.55, bw * 0.85), glass);
  cabin.position.set(-bl * 0.05, 1.05, 0);
  group.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[bl * 0.32, bw / 2], [bl * 0.32, -bw / 2], [-bl * 0.32, bw / 2], [-bl * 0.32, -bw / 2]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    wheels.push(w);
    group.add(w);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0xfff176 }));
    sign.position.set(0, 1.45, 0);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0xe53935 }));
    bar.position.set(0, 1.42, 0);
    group.add(bar);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.userData.wheels = wheels;
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
    if (x + radius > minX && x - radius < maxX && z + radius > minZ && z - radius < maxZ) return c;
  }
  return null;
}

export function createVehicles(scene, world) {
  if (!Array.isArray(world.cars)) world.cars = [];
  const marks = [];
  const markGeo = new THREE.PlaneGeometry(0.35, 1.4);
  const markMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 });
  let hWasDown = false;

  function addTyreMark(x, z, heading) {
    let mark = marks.find((m) => !m.visible);
    if (!mark) {
      if (marks.length >= 120) return;
      mark = new THREE.Mesh(markGeo, markMat);
      mark.rotation.x = -Math.PI / 2;
      scene.add(mark);
      marks.push(mark);
    }
    mark.visible = true;
    mark.position.set(x, 0.02, z);
    mark.rotation.z = -heading;
    mark.userData.life = 6;
  }

  function spawnCar(kind, x, z) {
    const spec = KINDS[kind] || KINDS.sedan;
    const color = spec.color;
    const mesh = makeCarMesh(kind, color);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const car = {
      mesh, kind, color,
      position: mesh.position,
      heading: 0, speed: 0,
      maxSpeed: spec.maxSpeed, accel: spec.accel, brake: spec.brake, steer: spec.steer,
      driver: null, upgrades: { engine: 0, armor: 0, nosTank: 0 }, armor: kind === 'limo' ? 3 : 0,
      hydraulics: kind === 'lowrider', nos: 100, tireDamage: 0, bounce: 0,
    };
    world.cars.push(car);
    return car;
  }

  function effectiveMax(car) {
    const engineBonus = (car.upgrades?.engine || 0) * 4;
    const nosBonus = 0;
    return (car.maxSpeed + engineBonus + nosBonus) * (1 - 0.35 * (car.tireDamage || 0));
  }

  function crashDamage(car, impact) {
    if (impact < 4) return;
    let dmg = Math.round((impact - 4) * 2);
    if (car.kind === 'limo') dmg = Math.ceil(dmg / 2);
    dmg = Math.max(0, dmg - (car.upgrades?.armor || 0) * 2);
    if (car === world.player.currentCar && world.player.health != null) {
      world.player.health = Math.max(0, world.player.health - dmg);
    }
  }

  function drive(car, dt) {
    const p = world.player;
    const fwd = keyDown(world, 'KeyW', 'W');
    const back = keyDown(world, 'KeyS', 'S');
    const left = keyDown(world, 'KeyA', 'A');
    const right = keyDown(world, 'KeyD', 'D');
    const handbrake = keyDown(world, 'Space', ' ');
    const nosKey = keyDown(world, 'ShiftLeft', 'Shift') || keyDown(world, 'ShiftRight', 'Shift');
    let top = effectiveMax(car);
    // NOS boost: drains while held, refills over time.
    if (nosKey && car.nos > 0 && car.speed > 2) {
      top *= 1.45;
      car.nos = Math.max(0, car.nos - 34 * dt);
    } else {
      const tank = 100 + (car.upgrades?.nosTank || 0) * 50;
      car.nos = Math.min(tank, car.nos + 7 * dt);
    }
    if (fwd) car.speed += car.accel * dt * (car.speed < top ? 1 : 0.2);
    if (back) {
      if (car.speed > 0.5) car.speed -= car.brake * dt;
      else car.speed = Math.max(-12, car.speed - car.accel * 0.6 * dt);
    }
    if (!fwd && !back) car.speed *= Math.max(0, 1 - 1.4 * dt);
    if (handbrake) car.speed *= Math.max(0, 1 - 2.2 * dt);
    car.speed = Math.max(-12, Math.min(top, car.speed));
    // Steering scales down with speed so fast cars stay controllable.
    const steerFactor = Math.max(0.35, 1 - Math.abs(car.speed) / (top * 1.6));
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    car.heading += steerInput * car.steer * steerFactor * dir * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.25);
    // Handbrake drift: rear slides, tyre marks, small speed kept.
    if (handbrake && Math.abs(car.speed) > 8) {
      car.heading += steerInput * 1.1 * dt * dir;
      addTyreMark(car.position.x - Math.sin(car.heading) * 1.8, car.position.z - Math.cos(car.heading) * 1.8, car.heading);
      car.speed *= Math.max(0, 1 - 0.25 * dt);
    }
    const nx = car.position.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.position.z + Math.cos(car.heading) * car.speed * dt;
    if (collidesWithBuildings(world, nx, nz, 1.6)) {
      crashDamage(car, Math.abs(car.speed));
      car.speed *= -0.25;
    } else {
      car.position.x = nx;
      car.position.z = nz;
    }
    // Car-car collision: simple push-apart + speed loss.
    for (const other of world.cars) {
      if (other === car || !other.position) continue;
      const dx = car.position.x - other.position.x;
      const dz = car.position.z - other.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 3.4) {
        const push = (3.4 - d) / 2;
        car.position.x += (dx / d) * push;
        car.position.z += (dz / d) * push;
        other.position.x -= (dx / d) * push;
        other.position.z -= (dz / d) * push;
        const impact = Math.abs(car.speed - (other.speed || 0));
        if (impact > 6) { crashDamage(car, impact); car.speed *= 0.6; other.speed = (other.speed || 0) * 0.6; }
      }
    }
    // Lowrider hydraulics: H bounces the suspension; at the domino park
    // (around -120, 180) a bounce earns a small cash bonus. Bouncing also
    // briefly lifts the body so the bounce is visible from the side.
    const hDown = keyDown(world, 'KeyH', 'H');
    if (car.hydraulics && hDown && !hWasDown) {
      car.bounce = 1;
      if (Math.hypot(car.position.x + 120, car.position.z - 180) < 25 && world.player.cash != null) {
        world.player.cash += 25;
        if (typeof world.cash === 'number') world.cash = world.player.cash; // keep the two cash stores in sync
      }
    }
    // Repair at the garage: the vehicle system clears tyre damage when the
    // player is parked at the garage (around 40, -120) and stationary.
    if (car.tireDamage > 0 && Math.abs(car.speed) < 0.5
      && Math.hypot(car.position.x - 40, car.position.z + 120) < 10) {
      car.tireDamage = 0;
    }
    hWasDown = hDown;
    if (car.bounce > 0) car.bounce = Math.max(0, car.bounce - dt * 2);
    const bounceY = car.bounce > 0 ? Math.sin(car.bounce * Math.PI) * 0.35 : 0;
    car.mesh.position.set(car.position.x, bounceY, car.position.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.5;
    for (const w of car.mesh.userData.wheels || []) w.rotation.y += spin;
    p.position.copy(car.position);
    p.heading = car.heading;
    p.speed = car.speed;
    if (p.mesh) p.mesh.visible = false;
  }

  function enterCar(car) {
    if (!car) return false;
    world.player.currentCar = car;
    world.player.onFoot = false;
    world.player.position.copy(car.position);
    car.driver = 'player';
    if (world.player.mesh) world.player.mesh.visible = false;
    return true;
  }

  function exitCar() {
    const car = world.player.currentCar;
    if (!car) return false;
    car.driver = null;
    world.player.currentCar = null;
    world.player.onFoot = true;
    world.player.position.set(car.position.x + 2.5, 0, car.position.z + 2.5);
    world.player.speed = 0;
    if (world.player.mesh) world.player.mesh.visible = true;
    return true;
  }

  function update(dt) {
    for (const m of marks) {
      if (!m.visible) continue;
      m.userData.life -= dt;
      if (m.userData.life <= 0) m.visible = false;
    }
    const car = world.player.currentCar;
    if (car) drive(car, dt);
    // Parked / AI cars sit still unless another system moves them.
    for (const c of world.cars) {
      if (c && c !== car && c.mesh) {
        c.mesh.position.set(c.position.x, 0, c.position.z);
        c.mesh.rotation.y = c.heading || 0;
      }
    }
  }

  return { update, spawnCar, enterCar, exitCar };
}
