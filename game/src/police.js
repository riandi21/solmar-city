// Police: wanted-level response. 1-2 stars send 1-2 patrol cars that
// chase and ram; 3 and above send 3 faster cars. A police touch on the
// on-foot player for 2 seconds means busted (lose $200, wanted 0,
// respawn at the station). Wanted decays 1 star per 20 s with no crime
// and no police within 40 m. Roadblocks at 3+ stars; spike strips at 4+
// (a hit cuts speed and damages tires until repaired or waited out).
import * as THREE from 'three';
import { spawnCar } from './vehicles.js';

const STATION = { x: 80, z: -203 };
const WANTED_DECAY_SECONDS = 20;
const BUSTED_TOUCH_SECONDS = 2;
const BUSTED_FINE = 200;

function buildSpikeStrip(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  for (let i = 0; i < 5; i += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 4), mat);
    spike.position.set(-1 + i * 0.5, 0.18, 0);
    group.add(spike);
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.5), mat);
  base.position.y = 0.03;
  group.add(base);
  if (scene) scene.add(group);
  return group;
}

export function createPolice(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  if (!Array.isArray(world.cars)) world.cars = [];
  const policeCars = [];
  const roadblocks = [];
  const spikes = [];
  let decayTimer = 0;
  let bustTimer = 0;
  let roadblockTimer = 0;
  let spikeTimer = 0;
  let toastCooldown = 0;

  function toast(text) {
    if (toastCooldown > 0) return;
    toastCooldown = 2;
    if (Array.isArray(world.events)) world.events.push({ type: 'toast', text });
  }

  function spawnPoliceCar(x, z) {
    const car = spawnCar(scene, world, 'police', x, z, { driver: 'police' });
    car.police = { chase: true, ramTimer: 0 };
    car.maxSpeed = 40;
    policeCars.push(car);
    return car;
  }

  function removePoliceCar(car) {
    const idx = world.cars.indexOf(car);
    if (idx >= 0) world.cars.splice(idx, 1);
    const j = policeCars.indexOf(car);
    if (j >= 0) policeCars.splice(j, 1);
    if (scene && car.mesh) scene.remove(car.mesh);
  }

  function clearRoadblocks() {
    for (const rb of roadblocks) {
      const idx = world.cars.indexOf(rb);
      if (idx >= 0) world.cars.splice(idx, 1);
      if (scene && rb.mesh) scene.remove(rb.mesh);
    }
    roadblocks.length = 0;
    for (const s of spikes) if (scene && s.mesh) scene.remove(s.mesh);
    spikes.length = 0;
  }

  function addWanted(amount) {
    world.wanted = Math.max(0, Math.min(5, (world.wanted || 0) + amount));
    if (amount > 0) world.lastCrimeAt = world.elapsed || 0;
    return world.wanted;
  }

  function doBusted() {
    const p = world.player;
    world.cash = Math.max(0, (world.cash || 0) - BUSTED_FINE);
    world.wanted = 0;
    bustTimer = 0;
    for (const car of [...policeCars]) removePoliceCar(car);
    clearRoadblocks();
    if (p) {
      p.position.set(STATION.x, 0, STATION.z);
      p.heading = 0;
      p.speed = 0;
      p.onFoot = true;
      if (p.mesh) { p.mesh.visible = true; p.mesh.position.copy(p.position); }
    }
    world.mode = 'play';
    if (Array.isArray(world.events)) {
      world.events.push({ type: 'toast', text: `Busted! -$${BUSTED_FINE}` });
      world.events.push({ type: 'busted' });
    }
  }

  function update(dt) {
    if (!world || world.mode !== 'play') return;
    if (toastCooldown > 0) toastCooldown -= dt;
    const wanted = world.wanted || 0;
    const p = world.player;
    if (!p) return;
    const px = p.position.x;
    const pz = p.position.z;

    // Desired strength: 0 stars none, 1-2 stars 1-2 cars, 3+ stars 3 cars.
    const desired = wanted === 0 ? 0 : wanted <= 2 ? wanted : 3;
    while (policeCars.length < desired) {
      const angle = rng() * Math.PI * 2;
      const dist = 55 + rng() * 25;
      spawnPoliceCar(px + Math.sin(angle) * dist, pz + Math.cos(angle) * dist);
    }
    while (policeCars.length > desired) removePoliceCar(policeCars[policeCars.length - 1]);

    // Chase + ram. Police steer toward the player and accelerate; on foot
    // they close in, in a car they ram.
    let nearestPolice = Infinity;
    for (const car of policeCars) {
      if (!car.position) continue;
      const dx = px - car.position.x;
      const dz = pz - car.position.z;
      const d = Math.hypot(dx, dz) || 1;
      nearestPolice = Math.min(nearestPolice, d);
      // Shot staging: hold pursuit cars at a distance. Without this the
      // cars drive straight onto the subject (jet ski / Rico) and pile
      // on top of it before the shutter — the chase and mission shots
      // came back with police bodies burying the player.
      if (world.shotMode && d < 35) {
        car.speed = 0;
        car.mesh.position.copy(car.position);
        car.mesh.rotation.y = car.heading;
        continue;
      }
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = 2.6;
      car.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
      const top = wanted >= 3 ? 42 : 38;
      const desiredSpeed = d > 6 ? top : top * 0.4;
      car.speed += (desiredSpeed - car.speed) * Math.min(1, dt * 1.1);
      car.position.x += Math.sin(car.heading) * car.speed * dt;
      car.position.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;
      // Ram: shove the player's car and cost a little speed on impact.
      if (d < 3.6 && p.currentCar) {
        const pc = p.currentCar;
        pc.position.x += (dx / d) * 2.2 * dt * 10;
        pc.position.z += (dz / d) * 2.2 * dt * 10;
        car.speed *= 0.7;
      }
    }

    // Busted: a police touch on the on-foot player for 2 s.
    // Suppressed while a shot is being staged (world.shotMode); the
    // rule is unchanged in normal play.
    if (!world.shotMode && !world.shotStaging && wanted > 0 && p.onFoot && nearestPolice < 2.6) {
      bustTimer += dt;
      if (bustTimer >= BUSTED_TOUCH_SECONDS) doBusted();
    } else {
      bustTimer = 0;
    }

    // Wanted decays 1 star per 20 s with no recent crime and no police
    // within 40 m.
    const lastCrime = world.lastCrimeAt !== undefined ? world.lastCrimeAt : -1e9;
    const quietFor = (world.elapsed || 0) - lastCrime;
    if (wanted > 0 && quietFor > 5 && nearestPolice > 40) {
      decayTimer += dt;
      if (decayTimer >= WANTED_DECAY_SECONDS) {
        world.wanted = wanted - 1;
        decayTimer = 0;
      }
    } else {
      decayTimer = 0;
    }

    // Roadblocks at 3+ stars, ahead of the player's direction of travel.
    // Not while a shot is being staged — they would park cars in the scene.
    if (wanted >= 3 && !world.shotMode && !world.shotStaging) {
      roadblockTimer -= dt;
      if (roadblockTimer <= 0 && roadblocks.length < 3) {
        roadblockTimer = 28;
        const heading = p.heading || 0;
        const bx = px + Math.sin(heading) * 42;
        const bz = pz + Math.cos(heading) * 42;
        for (let i = -1; i <= 1; i += 1) {
          const rb = spawnCar(scene, world, 'police', bx + Math.cos(heading) * i * 4, bz - Math.sin(heading) * i * 4, {
            heading: heading + Math.PI / 2,
            driver: 'roadblock',
          });
          rb.speed = 0;
          roadblocks.push(rb);
        }
        toast('Roadblock ahead!');
      }
      // Clear roadblocks the player has left far behind.
      for (let i = roadblocks.length - 1; i >= 0; i -= 1) {
        const rb = roadblocks[i];
        if (Math.hypot(px - rb.position.x, pz - rb.position.z) > 150) {
          const idx = world.cars.indexOf(rb);
          if (idx >= 0) world.cars.splice(idx, 1);
          if (scene && rb.mesh) scene.remove(rb.mesh);
          roadblocks.splice(i, 1);
        }
      }
      // Spike strips at 4+ stars, laid across the road ahead.
      if (wanted >= 4) {
        spikeTimer -= dt;
        if (spikeTimer <= 0 && spikes.length < 2) {
          spikeTimer = 20;
          const heading = p.heading || 0;
          const mesh = buildSpikeStrip(scene);
          const sx = px + Math.sin(heading) * 30;
          const sz = pz + Math.cos(heading) * 30;
          mesh.position.set(sx, 0, sz);
          mesh.rotation.y = heading;
          spikes.push({ mesh, x: sx, z: sz, life: 40 });
        }
      }
    } else if (roadblocks.length > 0) {
      clearRoadblocks();
    }
    // Spike strip hits: cut speed, lasting tire damage until repaired.
    for (let i = spikes.length - 1; i >= 0; i -= 1) {
      const s = spikes[i];
      s.life -= dt;
      if (s.life <= 0) {
        if (scene) scene.remove(s.mesh);
        spikes.splice(i, 1);
        continue;
      }
      const car = p.currentCar;
      if (car && Math.hypot(car.position.x - s.x, car.position.z - s.z) < 2.2) {
        car.speed *= 0.55;
        car.tireDamage = 1;
        car.tireTimer = 0;
        toast('Spike strip! Tires damaged — repair at the garage.');
        if (scene) scene.remove(s.mesh);
        spikes.splice(i, 1);
      }
    }

    if (world.wanted === 0) bustTimer = 0;
  }

  const sys = {
    name: 'police',
    update,
    addWanted,
    spawnPoliceCar,
    clearRoadblocks,
    policeCars,
    roadblocks,
    spikes,
  };
  if (Array.isArray(world.systems)) world.systems.push(sys);
  return sys;
}

export default createPolice;
