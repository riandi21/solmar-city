// Police: the wanted level and the cars that enforce it.
// Wanted 0-5 lives on world.wanted. addWanted(n) / clearWanted() are the
// direct API (missions use them for scripted heat); gameplay crimes arrive
// as world.events {type:'crime', level} and are picked up here. Wanted 1-2
// fields 1-2 pursuit cars; wanted 3+ fields 3 faster, more aggressive ones.
// A police car that touches the on-foot player for 2 s straight busts him:
// mode 'busted', $200 fine, wanted cleared, respawn at the police station.
// Wanted decays 1 star per 20 s with no crime and no police within 40 m.
//
// Events are read by index (seenEvents) and never removed: traffic.js reads
// the same queue for 'gunshot' / 'pedFlee' events.
// Heading convention: forward = (sin(heading), 0, cos(heading)).
import * as THREE from 'three';
import { makeCar } from './vehicles.js';

const POLICE_STATION = { x: 80, z: -203 }; // north-side station, inside a block
const BUSTED_FINE = 200;
const BUST_TOUCH_DIST = 2.5;
const BUST_TOUCH_TIME = 2.0;
const DECAY_SECONDS = 20;
const DECAY_CLEAR_DIST = 40;
const RESPAWN_DIST = 160; // a pursuit car this far away reappears near the player
const SIREN_PERIOD = 0.5; // s, red/blue light-bar flash cycle
// Roadblocks (wanted >= 3): one parked blockade ahead of the player.
const ROADBLOCK_MIN_WANTED = 3;
const ROADBLOCK_COOLDOWN = 25; // s between placements
const ROADBLOCK_AHEAD_MIN = 70; // m ahead of the player
const ROADBLOCK_AHEAD_MAX = 100;
const ROADBLOCK_CLEAR_DIST = 120; // m past it (or away from it) clears it

function clampAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function turnToward(current, target, maxStep) {
  const diff = clampAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function createPolice(scene, world) {
  const rng = world.rng || Math.random;
  const rand = (a, b) => a + rng() * (b - a);
  let policeCars = [];
  let seenEvents = 0;
  let clock = 0;
  let lastCrimeAt = -1e9;
  let touchTimer = 0;
  let sirenPhase = 0;
  // At most one roadblock: { cars: [car, car], barriers: [mesh, mesh], x, z }.
  let roadblock = null;
  let lastRoadblockAt = -1e9;

  const playerPos = () => (world.player && world.player.pos) || { x: 0, z: 0 };
  const wanted = () => Math.max(0, Math.min(5, world.wanted || 0));

  function desiredCount() {
    const w = wanted();
    if (w === 0) return 0;
    if (w <= 2) return w;
    return 3;
  }

  function spawnPoliceCar() {
    const pp = playerPos();
    // Spawn on a road 45-70 m from the player, in a random direction.
    const angle = rand(0, Math.PI * 2);
    const dist = rand(45, 70);
    let x = pp.x + Math.sin(angle) * dist;
    let z = pp.z + Math.cos(angle) * dist;
    // Snap onto the nearest road line so the car never spawns inside a block.
    const roads = (world.city && Array.isArray(world.city.roads))
      ? world.city.roads
      : null;
    if (roads && roads.length) {
      let best = null;
      let bestD = Infinity;
      for (const road of roads) {
        const d = road.axis === 'x' ? Math.abs(z - road.coord) : Math.abs(x - road.coord);
        if (d < bestD) { bestD = d; best = road; }
      }
      if (best) {
        if (best.axis === 'x') z = best.coord + (rng() < 0.5 ? 3.5 : -3.5);
        else x = best.coord + (rng() < 0.5 ? 3.5 : -3.5);
      }
    }
    x = Math.max(-250, Math.min(250, x));
    z = Math.max(-250, Math.min(250, z));
    const heading = Math.atan2(pp.x - x, pp.z - z);
    const car = makeCar(scene, world, 'police', { x, z }, heading);
    car.ai = { police: true, cruise: 30 };
    policeCars.push(car);
    return car;
  }

  function removePoliceCar(car) {
    scene.remove(car.mesh);
    const i = (world.cars || []).indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
    const j = policeCars.indexOf(car);
    if (j >= 0) policeCars.splice(j, 1);
  }

  function removeAllPolice() {
    for (const car of [...policeCars]) removePoliceCar(car);
  }

  function nearestPoliceDist() {
    const pp = playerPos();
    let best = Infinity;
    for (const car of policeCars) {
      best = Math.min(best, dist2(car.pos.x, car.pos.z, pp.x, pp.z));
    }
    return best;
  }

  // ---- Roadblocks ---------------------------------------------------------
  // One parked blockade 70-100 m ahead of the player, snapped to the nearest
  // road: 2 parked police cars across the road + 2 striped barriers between
  // them. The parked cars are NOT pursuit cars — they never enter the
  // policeCars chase array, keep ai null and speed 0, and only sit in
  // world.cars so the player can collide with them.
  function snapToRoad(x, z) {
    try {
      if (world.city && typeof world.city.nearestRoad === 'function') {
        return world.city.nearestRoad(x, z);
      }
    } catch (err) {
      // Fall through to the inline road scan below.
    }
    const roads = (world.city && Array.isArray(world.city.roads)) ? world.city.roads : null;
    if (!roads || !roads.length) return { road: null, x, z };
    let best = null;
    let bestD = Infinity;
    for (const road of roads) {
      const d = road.axis === 'x' ? Math.abs(z - road.coord) : Math.abs(x - road.coord);
      if (d < bestD) { bestD = d; best = road; }
    }
    if (!best) return { road: null, x, z };
    if (best.axis === 'x') return { road: best, x: Math.max(-250, Math.min(250, x)), z: best.coord };
    return { road: best, x: best.coord, z: Math.max(-250, Math.min(250, z)) };
  }

  function makeBarrier(x, z, heading) {
    const group = new THREE.Group();
    const orange = new THREE.MeshStandardMaterial({ color: 0xe8722a, roughness: 0.7 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2e8, roughness: 0.7 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.4), orange);
    base.position.y = 0.55;
    base.castShadow = true;
    group.add(base);
    for (const sx of [-0.8, 0.8]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.92, 0.42), white);
      stripe.position.set(sx, 0.55, 0);
      group.add(stripe);
    }
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    return group;
  }

  function placeRoadblock() {
    try {
      const pp = playerPos();
      const heading = (world.player && world.player.heading) || 0;
      const ahead = rand(ROADBLOCK_AHEAD_MIN, ROADBLOCK_AHEAD_MAX);
      const tx = pp.x + Math.sin(heading) * ahead;
      const tz = pp.z + Math.cos(heading) * ahead;
      const snap = snapToRoad(tx, tz);
      if (!snap.road) return;
      const cars = [];
      const barriers = [];
      if (snap.road.axis === 'x') {
        // Road runs along X: cars sit across it (facing +Z), 8 m apart.
        for (const ox of [-4, 4]) {
          const car = makeCar(scene, world, 'police', { x: snap.x + ox, z: snap.z }, 0);
          car.ai = null;
          car.speed = 0;
          cars.push(car);
        }
        barriers.push(makeBarrier(snap.x, snap.z - 4.5, 0));
        barriers.push(makeBarrier(snap.x, snap.z + 4.5, 0));
      } else {
        // Road runs along Z: cars sit across it (facing +X), 8 m apart.
        for (const oz of [-4, 4]) {
          const car = makeCar(scene, world, 'police', { x: snap.x, z: snap.z + oz }, Math.PI / 2);
          car.ai = null;
          car.speed = 0;
          cars.push(car);
        }
        barriers.push(makeBarrier(snap.x - 4.5, snap.z, Math.PI / 2));
        barriers.push(makeBarrier(snap.x + 4.5, snap.z, Math.PI / 2));
      }
      roadblock = { cars, barriers, x: snap.x, z: snap.z };
      lastRoadblockAt = clock;
    } catch (err) {
      // A failed placement just means no roadblock this time.
      roadblock = null;
    }
  }

  function removeRoadblock() {
    if (!roadblock) return;
    for (const car of roadblock.cars || []) {
      try {
        scene.remove(car.mesh);
        const i = (world.cars || []).indexOf(car);
        if (i >= 0) world.cars.splice(i, 1);
      } catch (err) {
        // Keep removing the rest even if one car is already gone.
      }
    }
    for (const barrier of roadblock.barriers || []) {
      try {
        scene.remove(barrier);
      } catch (err) {
        // Ignore a barrier that is already gone.
      }
    }
    roadblock = null;
  }

  function updateRoadblock() {
    try {
      if (wanted() >= ROADBLOCK_MIN_WANTED) {
        if (!roadblock && clock - lastRoadblockAt >= ROADBLOCK_COOLDOWN) placeRoadblock();
      } else if (roadblock) {
        removeRoadblock();
      }
      if (roadblock) {
        const pp = playerPos();
        if (dist2(pp.x, pp.z, roadblock.x, roadblock.z) > ROADBLOCK_CLEAR_DIST) {
          removeRoadblock();
        }
      }
    } catch (err) {
      // Roadblocks are cosmetic pressure, never a crash risk.
    }
  }

  function doBusted() {
    const cash = world.cash || 0;
    const fine = Math.min(BUSTED_FINE, cash);
    world.cash = cash - fine;
    if (world.player) world.player.cash = world.cash;
    world.wanted = 0;
    removeAllPolice();
    removeRoadblock();
    touchTimer = 0;
    // Leave the car where it was; Rico walks out of the station on foot.
    if (world.player) {
      world.player.car = null;
      world.player.onFoot = true;
      world.player.pos.set(POLICE_STATION.x, 0, POLICE_STATION.z);
      world.player.heading = 0;
      if (world.player.mesh) {
        world.player.mesh.visible = true;
        world.player.mesh.rotation.y = 0;
      }
    }
    world.mode = 'busted';
    if (!world.events) world.events = [];
    world.events.push({ type: 'busted', data: { fine } });
  }

  function stepChase(car, dt) {
    const pp = playerPos();
    const w = wanted();
    const aggressive = w >= 3;
    const dx = pp.x - car.pos.x;
    const dz = pp.z - car.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    // Steer at the player; the aggressive tier turns harder and runs faster.
    const wantHeading = Math.atan2(dx, dz);
    car.heading = turnToward(car.heading, wantHeading, (aggressive ? 3.0 : 2.2) * dt);
    // Close in, then hold: on an on-foot player the car pulls up and stops
    // on top of him (that is what makes the 2 s bust timer possible — a car
    // that keeps driving through would orbit him forever). On a car, ram.
    const onFoot = world.player && world.player.onFoot;
    let target;
    if (onFoot) {
      target = d < 3 ? 0 : Math.min(8, d * 1.5);
    } else {
      const top = aggressive ? car.maxSpeed : 30;
      target = d < 4 ? top * 0.55 : top;
    }
    const rate = target < car.speed ? 18 : 9;
    car.speed += Math.max(-rate * dt, Math.min(rate * dt, target - car.speed));
    // Lost the player far away: reappear on a road near him.
    if (d > RESPAWN_DIST) {
      removePoliceCar(car);
      spawnPoliceCar();
    }
  }

  function flashLightBars(dt) {
    sirenPhase += dt;
    const redOn = (sirenPhase % SIREN_PERIOD) < SIREN_PERIOD / 2;
    for (const car of policeCars) {
      const bar = car.mesh.userData.lightBar;
      if (!bar) continue;
      bar.redMat.emissiveIntensity = redOn ? 2.2 : 0.15;
      bar.blueMat.emissiveIntensity = redOn ? 0.15 : 2.2;
    }
  }

  function processEvents() {
    const events = world.events || [];
    for (; seenEvents < events.length; seenEvents += 1) {
      const ev = events[seenEvents];
      if (ev && ev.type === 'crime') {
        const level = (ev.data && ev.data.level) || 1;
        world.wanted = Math.max(0, Math.min(5, (world.wanted || 0) + level));
        lastCrimeAt = clock;
      }
    }
  }

  function addWanted(n) {
    world.wanted = Math.max(0, Math.min(5, (world.wanted || 0) + n));
    if (n > 0) lastCrimeAt = clock;
  }

  function clearWanted() {
    world.wanted = 0;
    touchTimer = 0;
    removeAllPolice();
    removeRoadblock();
  }

  function update(dt) {
    const capped = Math.min(dt, 0.05);
    clock += capped;
    processEvents();
    if (world.mode !== undefined && world.mode !== 'play') {
      flashLightBars(capped);
      return;
    }
    // Match the pursuit fleet to the wanted level.
    const want = desiredCount();
    while (policeCars.length < want) spawnPoliceCar();
    while (policeCars.length > want) removePoliceCar(policeCars[policeCars.length - 1]);
    for (const car of [...policeCars]) stepChase(car, capped);
    flashLightBars(capped);
    updateRoadblock();

    // Busted: a pursuit car on top of the on-foot player for 2 s straight.
    const onFoot = world.player && world.player.onFoot;
    if (onFoot && policeCars.length) {
      if (nearestPoliceDist() < BUST_TOUCH_DIST) {
        touchTimer += capped;
        if (touchTimer >= BUST_TOUCH_TIME) doBusted();
      } else {
        touchTimer = 0;
      }
    } else {
      touchTimer = 0;
    }

    // Decay: 1 star per 20 s with no crime and no police within 40 m.
    if (wanted() > 0 && clock - lastCrimeAt >= DECAY_SECONDS && nearestPoliceDist() > DECAY_CLEAR_DIST) {
      world.wanted = wanted() - 1;
      lastCrimeAt = clock;
    }
  }

  return { update, addWanted, clearWanted };
}
