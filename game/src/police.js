import * as THREE from 'three';

const STATION = new THREE.Vector3(80, 0, -203);
const BUST_FINE = 200;
const DECAY_SECONDS = 20;
const ROADBLOCK_COOLDOWN = 30;

function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function createPolice(world) {
  world.cars = world.cars || [];
  const p = world.player;
  world.wanted = world.wanted ?? 0;
  let decayTimer = 0;
  let lastCrimeAt = -100;
  let bustedTimer = 0;
  let roadblockTimer = ROADBLOCK_COOLDOWN;
  let roadblocks = [];
  let spikeStrips = [];
  let lastWanted = world.wanted;

  function policeCars() {
    return world.cars.filter((c) => c.driver === 'police');
  }

  function spawnPoliceCar(x, z, heading) {
    const vehicles = world.systems && world.systems.vehicles;
    if (vehicles && vehicles.spawnCar) {
      const car = vehicles.spawnCar('police', x, z, heading, 'police');
      car.maxSpeed = world.wanted >= 3 ? 36 : 32;
      car.speed = 12;
      return car;
    }
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x1c1c22 }));
    body.position.y = 0.7;
    g.add(body);
    g.position.set(x, 0, z);
    if (world.scene) world.scene.add(g);
    const car = { kind: 'police', driver: 'police', mesh: g, position: g.position, heading, speed: 12, maxSpeed: 32 };
    world.cars.push(car);
    return car;
  }

  function desiredPoliceCount() {
    if (world.wanted <= 0) return 0;
    if (world.wanted <= 2) return world.wanted;
    return 3;
  }

  function nearestPoliceDist() {
    let best = Infinity;
    for (const c of policeCars()) best = Math.min(best, dist2(c.position, p.position));
    return best;
  }

  function clearRoadblocks() {
    for (const c of roadblocks) {
      const i = world.cars.indexOf(c);
      if (i >= 0) world.cars.splice(i, 1);
      if (world.scene && c.mesh) world.scene.remove(c.mesh);
    }
    roadblocks = [];
    for (const s of spikeStrips) if (world.scene) world.scene.remove(s.mesh);
    spikeStrips = [];
  }

  function makeSpikeStrip(x, z, heading) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.8), mat);
    base.position.y = 0.06;
    g.add(base);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.25 });
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 6), spikeMat);
      spike.position.set(i * 1.1, 0.25, 0);
      g.add(spike);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    if (world.scene) world.scene.add(g);
    return { mesh: g, position: g.position, heading, hit: false };
  }

  function layRoadblock() {
    clearRoadblocks();
    // Parked cars ahead of the player's direction of travel.
    const dir = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    if (p.car) dir.set(Math.sin(p.car.heading), 0, Math.cos(p.car.heading));
    const ahead = p.position.clone().addScaledVector(dir, 42);
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    const vehicles = world.systems && world.systems.vehicles;
    for (let i = -1; i <= 1; i++) {
      const pos = ahead.clone().addScaledVector(side, i * 3.2);
      let car;
      if (vehicles && vehicles.spawnCar) {
        car = vehicles.spawnCar('sedan', pos.x, pos.z, p.heading + Math.PI / 2, 'roadblock');
      } else {
        continue;
      }
      car.speed = 0;
      car.maxSpeed = 0;
      roadblocks.push(car);
    }
    // NEW Round 6: at 4 stars and above the roadblock also lays spikes.
    if (world.wanted >= 4) {
      const stripPos = p.position.clone().addScaledVector(dir, 30);
      spikeStrips.push(makeSpikeStrip(stripPos.x, stripPos.z, p.heading));
      const stripPos2 = p.position.clone().addScaledVector(dir, 34).addScaledVector(side, 4);
      spikeStrips.push(makeSpikeStrip(stripPos2.x, stripPos2.z, p.heading));
    }
    roadblockTimer = ROADBLOCK_COOLDOWN;
    (world.events = world.events || []).push({ type: 'roadblock', wanted: world.wanted });
  }

  function checkSpikes() {
    const veh = p.car || p.bike;
    if (!veh) return;
    for (const strip of spikeStrips) {
      if (strip.hit) continue;
      if (dist2(veh.position, strip.position) < 3.2) {
        strip.hit = true;
        veh.speed *= 0.35;
        p.tireDamage = Math.min(1, (p.tireDamage || 0) + 0.35);
        (world.events = world.events || []).push({ type: 'spike-hit', tireDamage: p.tireDamage });
        if (world.scene) world.scene.remove(strip.mesh);
      }
    }
  }

  function chasePolice(car, dt) {
    const toPlayer = new THREE.Vector3().subVectors(p.position, car.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const targetHeading = Math.atan2(toPlayer.x, toPlayer.z);
    let diff = targetHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const fast = world.wanted >= 3 ? 1.15 : 1;
    car.heading += THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);
    const wantSpeed = dist > 6 ? car.maxSpeed * fast : car.maxSpeed * 0.4;
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
    // Ram: keep pushing into the player when close.
    if (dist < 4 && (p.car || p.bike)) car.speed = Math.max(car.speed, 14);
    car.position.x += Math.sin(car.heading) * car.speed * dt;
    car.position.z += Math.cos(car.heading) * car.speed * dt;
    if (car.mesh) {
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;
    }
  }

  function bustPlayer() {
    p.cash = Math.max(0, (p.cash || 0) - BUST_FINE);
    world.wanted = 0;
    decayTimer = 0;
    bustedTimer = 0;
    clearRoadblocks();
    for (const c of policeCars()) {
      const i = world.cars.indexOf(c);
      if (i >= 0) world.cars.splice(i, 1);
      if (world.scene && c.mesh) world.scene.remove(c.mesh);
    }
    p.car = null; p.bike = null; p.onFoot = true;
    p.position.copy(STATION);
    p.heading = Math.PI;
    p.speed = 0;
    if (p.mesh) { p.mesh.visible = true; p.mesh.position.copy(p.position); }
    world.mode = 'play';
    (world.events = world.events || []).push({ type: 'busted', fine: BUST_FINE });
  }

  function addWanted(n) {
    world.wanted = Math.max(0, Math.min(5, (world.wanted || 0) + n));
    decayTimer = 0;
    lastCrimeAt = world.elapsed || 0;
    (world.events = world.events || []).push({ type: 'crime', wanted: world.wanted });
  }

  function update(dt) {
    if (world.mode && world.mode !== 'play') return;
    // Crimes queued by other systems raise the wanted level once each.
    if (world.events) {
      for (const e of world.events) {
        if (e.type === 'crime' && e.source !== 'police' && e.counted !== true) {
          e.counted = true;
          // addWanted pushes its own event, so raise the level directly
          // here to avoid re-counting the event we just created.
          world.wanted = Math.max(0, Math.min(5, (world.wanted || 0) + (e.stars || 1)));
          lastCrimeAt = world.elapsed || 0;
          decayTimer = 0;
        }
      }
    }
    if (world.wanted !== lastWanted) {
      // A jump to 0 (busted / cleared) resets the decay clock.
      if (world.wanted === 0) decayTimer = 0;
      lastWanted = world.wanted;
    }

    // Spawn / despawn pursuit cars to match the wanted level.
    const want = desiredPoliceCount();
    const cops = policeCars();
    if (cops.length < want) {
      const angle = (world.rng ? world.rng() : Math.random()) * Math.PI * 2;
      spawnPoliceCar(
        p.position.x + Math.sin(angle) * 45,
        p.position.z + Math.cos(angle) * 45,
        angle,
      );
    } else if (cops.length > want) {
      const extra = cops[cops.length - 1];
      const i = world.cars.indexOf(extra);
      if (i >= 0) world.cars.splice(i, 1);
      if (world.scene && extra.mesh) world.scene.remove(extra.mesh);
    }

    for (const car of policeCars()) chasePolice(car, dt);

    // Busted: a police touch on the on-foot player for 2 seconds.
    if (p.onFoot && world.wanted > 0) {
      const near = nearestPoliceDist();
      if (near < 2.6) {
        bustedTimer += dt;
        if (bustedTimer >= 2) bustPlayer();
      } else {
        bustedTimer = 0;
      }
    } else {
      bustedTimer = 0;
    }

    // Wanted decay: 1 star per 20 s with no crime and no police within 40 m.
    if (world.wanted > 0) {
      const quiet = (world.elapsed || 0) - lastCrimeAt > 5 && nearestPoliceDist() > 40;
      if (quiet) {
        decayTimer += dt;
        if (decayTimer >= DECAY_SECONDS) {
          world.wanted = Math.max(0, world.wanted - 1);
          decayTimer = 0;
        }
      } else {
        decayTimer = 0;
      }
    }

    // Roadblocks at 3 stars and above, with a cooldown; clear when far.
    roadblockTimer -= dt;
    if (world.wanted >= 3 && roadblockTimer <= 0 && roadblocks.length === 0) {
      layRoadblock();
    }
    if (roadblocks.length > 0 && dist2(p.position, roadblocks[0].position) > 130) {
      clearRoadblocks();
      roadblockTimer = 8; // short pause before the next one can form
    }
    checkSpikes();
  }

  return {
    update, addWanted, clearRoadblocks, bustPlayer, policeCars,
    clearWanted() { world.wanted = 0; decayTimer = 0; },
    get roadblocks() { return roadblocks; },
    get spikeStrips() { return spikeStrips; },
  };
}
