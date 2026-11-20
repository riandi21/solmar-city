import * as THREE from 'three';

// Wanted system: 1-2 stars = 1-2 police cars chasing and ramming, 3+ = 3
// faster cars plus roadblocks (spike strips at 4+). Touching the on-foot
// player for 2s = busted ($200 fine, wanted 0, respawn at the station).
// Wanted decays 1 star per 20s with no crime and no police within 40m.
const STATION = { x: 80, z: -203 };
const BUSTED_FINE = 200;
const DECAY_SECONDS = 20;

function makePoliceCarMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.8, 2.0),
    new THREE.MeshLambertMaterial({ color: 0x1565c0 }),
  );
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.55, 1.7),
    new THREE.MeshLambertMaterial({ color: 0x90caf9 }),
  );
  cabin.position.y = 1.05;
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.16, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xe53935 }),
  );
  bar.position.set(0, 1.45, 0);
  group.add(body, cabin, bar);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function createPolice(scene, world) {
  if (!Array.isArray(world.cars)) world.cars = [];
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const cops = [];
  const roadblocks = [];
  const spikes = [];
  let decayTimer = 0;
  let touchTimer = 0;
  let roadblockCooldown = 0;
  let roadblockActive = false;

  function spawnCop(fast) {
    const mesh = makePoliceCarMesh();
    const angle = rng() * Math.PI * 2;
    const dist = 35 + rng() * 20;
    const x = world.player.position.x + Math.sin(angle) * dist;
    const z = world.player.position.z + Math.cos(angle) * dist;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const cop = {
      mesh, kind: 'police', color: 0x1565c0,
      position: mesh.position, heading: 0, speed: 0,
      maxSpeed: fast ? 44 : 38, accel: 26, brake: 48, steer: 2.3,
      driver: 'police', upgrades: {}, armor: 0,
    };
    world.cars.push(cop);
    cops.push(cop);
    return cop;
  }

  function removeCop(cop) {
    scene.remove(cop.mesh);
    const i = cops.indexOf(cop);
    if (i >= 0) cops.splice(i, 1);
    const j = world.cars.indexOf(cop);
    if (j >= 0) world.cars.splice(j, 1);
  }

  function setCopCount(n, fast) {
    while (cops.length < n) spawnCop(fast);
    while (cops.length > n) removeCop(cops[cops.length - 1]);
  }

  function makeRoadblock() {
    clearRoadblock();
    roadblockActive = true;
    roadblockCooldown = 25;
    const p = world.player.position;
    const heading = world.player.heading || 0;
    // Parked cars across the road ahead of the player.
    for (let i = -1; i <= 1; i += 1) {
      const mesh = makePoliceCarMesh();
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const x = p.x + fx * 45 + Math.cos(heading) * i * 4;
      const z = p.z + fz * 45 - Math.sin(heading) * i * 4;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading + Math.PI / 2;
      scene.add(mesh);
      const block = { mesh, kind: 'police', position: mesh.position, heading: heading + Math.PI / 2, speed: 0 };
      world.cars.push(block);
      roadblocks.push(block);
    }
    if ((world.wanted || 0) >= 4) {
      // Spike strip on the road just before the block.
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.12, 1),
        new THREE.MeshLambertMaterial({ color: 0x37474f }),
      );
      strip.position.set(p.x + Math.sin(heading) * 38, 0.06, p.z + Math.cos(heading) * 38);
      strip.rotation.y = heading;
      scene.add(strip);
      spikes.push({ mesh: strip, position: strip.position, hit: false });
    }
  }

  function clearRoadblock() {
    for (const b of roadblocks) {
      scene.remove(b.mesh);
      const j = world.cars.indexOf(b);
      if (j >= 0) world.cars.splice(j, 1);
    }
    roadblocks.length = 0;
    for (const s of spikes) scene.remove(s.mesh);
    spikes.length = 0;
    roadblockActive = false;
  }

  function bustPlayer() {
    if (world.player.cash != null) world.player.cash = Math.max(0, world.player.cash - BUSTED_FINE);
    if (typeof world.cash === 'number' && world.player.cash != null) world.cash = world.player.cash; // keep the two cash stores in sync
    world.wanted = 0;
    decayTimer = 0;
    touchTimer = 0;
    clearRoadblock();
    setCopCount(0, false);
    const p = world.player;
    // Step out of any vehicle before respawning at the station.
    if (p.currentCar) p.currentCar.driver = null;
    p.currentCar = null; p.currentBike = null; p.currentBoat = null;
    p.currentJetSki = null; p.currentSeaplane = null; p.currentHeli = null;
    p.onFoot = true;
    p.position.set(STATION.x, 0, STATION.z);
    p.speed = 0;
    if (p.mesh) { p.mesh.visible = true; p.mesh.position.copy(p.position); }
  }

  function addWanted(n) {
    world.wanted = Math.min(5, (world.wanted || 0) + (n || 1));
    decayTimer = 0;
  }

  function clearWanted() {
    world.wanted = 0;
    decayTimer = 0;
    touchTimer = 0;
    clearRoadblock();
    setCopCount(0, false);
  }

  function update(dt) {
    const wanted = world.wanted || 0;
    const p = world.player;
    if (wanted <= 0) {
      if (cops.length) setCopCount(0, false);
      if (roadblockActive) clearRoadblock();
      return;
    }
    const fast = wanted >= 3;
    setCopCount(wanted <= 2 ? wanted : 3, fast);
    // Chase + ram: steer toward the player, ram speed into them.
    for (const cop of cops) {
      const dx = p.position.x - cop.position.x;
      const dz = p.position.z - cop.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - cop.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      cop.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh * 2.2 * dt * 3));
      const targetSpeed = dist > 8 ? cop.maxSpeed : cop.maxSpeed * 0.6;
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 1.2);
      cop.position.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.position.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.mesh.position.copy(cop.position);
      cop.mesh.rotation.y = cop.heading;
      // Ram the player's car: shove it and slow it.
      const car = p.currentCar;
      if (car && dist < 4.2) {
        car.speed *= 0.92;
        car.position.x += (dx / dist) * 1.5 * dt * 10;
        car.position.z += (dz / dist) * 1.5 * dt * 10;
      }
    }
    // Busted: a cop touching the on-foot player for 2s.
    if (p.onFoot) {
      let touching = false;
      for (const cop of cops) {
        if (Math.hypot(cop.position.x - p.position.x, cop.position.z - p.position.z) < 2.5) {
          touching = true;
          break;
        }
      }
      touchTimer = touching ? touchTimer + dt : 0;
      if (touchTimer >= 2) bustPlayer();
    } else {
      touchTimer = 0;
    }
    // Wanted decay: 1 star / 20s with no crime and no police within 40m.
    const anyNear = cops.some((c) => Math.hypot(c.position.x - p.position.x, c.position.z - p.position.z) < 40);
    const recentCrime = world.lastCrimeAt != null && (world.elapsed - world.lastCrimeAt) < 20;
    if (!anyNear && !recentCrime) {
      decayTimer += dt;
      if (decayTimer >= DECAY_SECONDS) {
        world.wanted = Math.max(0, (world.wanted || 0) - 1);
        decayTimer = 0;
      }
    } else {
      decayTimer = 0;
    }
    // Roadblocks at 3+ stars; clear when the player is far, with cooldown.
    if (roadblockCooldown > 0) roadblockCooldown -= dt;
    if (wanted >= 3 && !roadblockActive && roadblockCooldown <= 0) makeRoadblock();
    if (roadblockActive) {
      const d = Math.hypot(p.position.x - (roadblocks[0]?.position.x ?? 0), p.position.z - (roadblocks[0]?.position.z ?? 0));
      if (d > 120) clearRoadblock();
    }
    // Spike strips: hitting one cuts speed and damages tyres until repaired
    // at the garage or by waiting (slow recovery while parked / on foot).
    const car = p.currentCar;
    if (car) {
      for (const s of spikes) {
        if (s.hit) continue;
        if (Math.hypot(car.position.x - s.position.x, car.position.z - s.position.z) < 3) {
          s.hit = true;
          car.speed *= 0.35;
          car.tireDamage = Math.min(1, (car.tireDamage || 0) + 0.6);
          if (world.player.health != null) world.player.health = Math.max(0, world.player.health - 5);
        }
      }
    }
    // Waiting repair: tyre damage slowly heals when Rico is on foot, so a
    // spiked car is not permanently crippled if he walks away from it.
    if (p.onFoot && p.currentCar == null) {
      for (const c of world.cars) {
        if (c && c.tireDamage > 0) c.tireDamage = Math.max(0, c.tireDamage - dt * 0.02);
      }
    }
  }

  return { update, addWanted, clearWanted };
}
