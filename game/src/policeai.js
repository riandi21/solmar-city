// Police AI — coordinated pursuit for Solmar City.
// Flanking cars, dynamic roadblocks ahead of the player, spike strips at
// 3+ stars, helicopter lead prediction, crew targeting, second heli at 5.
import * as THREE from 'three';

const ROADBLOCK_COOLDOWN = 25;
const SPIKE_SLOW_TIME = 12;

function vec(x = 0, y = 0, z = 0) { return new THREE.Vector3(x, y, z); }
function px(p) { return p && typeof p.x === 'number' ? p.x : 0; }
function pz(p) { return p && typeof p.z === 'number' ? p.z : 0; }
function dist2D(a, b) {
  const dx = px(a) - px(b); const dz = pz(a) - pz(b);
  return Math.hypot(dx, dz);
}
function playerPos(world) {
  return world.player && world.player.position ? world.player.position : { x: 0, y: 0, z: 0 };
}
function playerHeading(world) {
  return (world.player && typeof world.player.heading === 'number') ? world.player.heading : 0;
}
function policeCars(world) {
  if (Array.isArray(world.policeCars)) return world.policeCars;
  if (Array.isArray(world.cars)) return world.cars.filter((c) => c && c.kind === 'police');
  return [];
}

export function createPoliceAI(scene, world) {
  const w = world || {};
  if (!Array.isArray(w.roadblocks)) w.roadblocks = [];
  if (!Array.isArray(w.spikeStrips)) w.spikeStrips = [];
  if (typeof w.tireDamage !== 'number') w.tireDamage = 0;
  if (!w.policeAI) w.policeAI = {};
  const state = {
    roadblockTimer: 0,
    spikeTimer: 0,
    heliLead: { x: 0, z: 0 },
    secondHeliActive: false,
    flankSide: 1,
    bustedTimer: 0,
  };
  w.policeAI = state;

  function meshFor(kind, color) {
    if (!scene) return null;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.7, 4.4),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = 0.6;
    group.add(body);
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.25, 0.6),
      new THREE.MeshStandardMaterial({ color: kind === 'spike' ? 0x888888 : 0x2244ff, emissive: 0x112266 }),
    );
    light.position.set(0, 1.05, -0.4);
    group.add(light);
    scene.add(group);
    return group;
  }

  // Split the pursuit: half the cars cut across from the left, half from
  // the right, instead of every car chasing from behind.
  function assignFlank(cars) {
    cars.forEach((car, i) => {
      car.flank = i % 2 === 0 ? -1 : 1;
      car.flankAngle = car.flank * (Math.PI / 3.5);
    });
    state.flankSide *= -1;
    return cars;
  }

  function flankTarget(car, target) {
    const h = Math.atan2(px(target) - px(car.position), pz(target) - pz(car.position));
    const a = h + (car.flankAngle || 0);
    const d = 26;
    return { x: px(target) + Math.sin(a) * d, z: pz(target) + Math.cos(a) * d };
  }

  function spawnRoadblock() {
    const target = playerPos(w);
    const h = playerHeading(w);
    // Roadblock forms ahead of the player's direction of travel.
    const ahead = 55;
    const cx = px(target) + Math.sin(h) * ahead;
    const cz = pz(target) + Math.cos(h) * ahead;
    const block = { position: vec(cx, 0, cz), heading: h, cars: [], createdAt: w.elapsed || 0 };
    for (let i = -1; i <= 1; i += 1) {
      const car = {
        kind: 'police', position: vec(cx + Math.cos(h) * i * 5, 0, cz - Math.sin(h) * i * 5),
        heading: h + Math.PI / 2, speed: 0, maxSpeed: 0, parked: true, roadblock: true,
        mesh: meshFor('roadblock', 0x111144),
      };
      block.cars.push(car);
      if (Array.isArray(w.cars)) w.cars.push(car);
    }
    w.roadblocks.push(block);
    state.roadblockTimer = ROADBLOCK_COOLDOWN;
    if (typeof w.toast === 'function') w.toast('Roadblock ahead!');
    return block;
  }

  function laySpikeStrip() {
    const target = playerPos(w);
    const h = playerHeading(w);
    const strip = {
      position: vec(px(target) + Math.sin(h) * 38, 0, pz(target) + Math.cos(h) * 38),
      heading: h, active: true, mesh: meshFor('spike', 0x333333),
    };
    w.spikeStrips.push(strip);
    state.spikeTimer = 18;
    return strip;
  }

  // A spike hit cuts speed and leaves a lasting handling penalty until
  // repaired at the garage or by waiting it out.
  function checkSpikeHit() {
    const p = playerPos(w);
    for (const strip of w.spikeStrips) {
      if (!strip.active) continue;
      if (dist2D(p, strip.position) < 3.5) {
        strip.active = false;
        if (strip.mesh && strip.mesh.parent) strip.mesh.parent.remove(strip.mesh);
        w.tireDamage = Math.min(1, (w.tireDamage || 0) + 0.5);
        w.spikeSlowUntil = (w.elapsed || 0) + SPIKE_SLOW_TIME;
        if (w.player && typeof w.player.speed === 'number') w.player.speed *= 0.35;
        if (typeof w.toast === 'function') w.toast('Spike strip! Tires damaged — repair at the garage.');
        return true;
      }
    }
    return false;
  }

  // Predict where the player is heading so the helicopter stays ahead of
  // them instead of trailing behind.
  function heliLead(dt) {
    const p = playerPos(w);
    const speed = (w.player && typeof w.player.speed === 'number') ? w.player.speed : 0;
    const h = playerHeading(w);
    const lead = Math.min(40, speed * 1.6);
    state.heliLead.x = px(p) + Math.sin(h) * lead;
    state.heliLead.z = pz(p) + Math.cos(h) * lead;
    if (w.helicopter) {
      w.helicopter.target = { x: state.heliLead.x, z: state.heliLead.z };
      w.helicopter.lead = { x: state.heliLead.x, z: state.heliLead.z };
    }
    // Spotlight on foot at night raises wanted faster.
    const night = w.daynight && w.daynight.isNight;
    if (night && w.mode === 'play' && !w.playerCar && (w.wanted || 0) > 0) {
      w.spotlightExposure = (w.spotlightExposure || 0) + dt;
      if (w.spotlightExposure > 6) { w.wanted = Math.min(5, (w.wanted || 0) + 1); w.spotlightExposure = 0; }
    }
    return state.heliLead;
  }

  // Police target the nearest armed ally too, not just Rico.
  function nearestTarget(fromPos) {
    let best = { kind: 'player', pos: playerPos(w), dist: dist2D(fromPos, playerPos(w)) };
    const crew = Array.isArray(w.crew) ? w.crew : [];
    for (const m of crew) {
      if (!m || m.state === 'down' || !m.position) continue;
      const d = dist2D(fromPos, m.position);
      if (d < best.dist) best = { kind: 'crew', member: m, pos: m.position, dist: d };
    }
    return best;
  }

  function update(dt) {
    const wanted = w.wanted || 0;
    if (w.mode !== 'play') return;
    // Shot staging never accumulates a bust timer.
    if (w.shotMode || w.shotStaging) state.bustedTimer = 0;
    const cars = policeCars(w);
    if (wanted >= 1 && cars.length > 0) assignFlank(cars);
    // Steer each police car toward its flank offset around its target.
    for (const car of cars) {
      if (!car || car.parked || !car.position) continue;
      // Shot staging: hold pursuit cars at a distance so they never pile
      // onto the subject (the bust rule is already suppressed in shot
      // mode; this stops the cars themselves burying the player).
      if ((w.shotMode || w.shotStaging) && dist2D(car.position, playerPos(w)) < 35) {
        if (car.mesh) { car.mesh.position.copy(car.position); car.mesh.rotation.y = car.heading; }
        continue;
      }
      const target = nearestTarget(car.position);
      const goal = flankTarget(car, target.pos);
      const dx = goal.x - px(car.position);
      const dz = goal.z - pz(car.position);
      car.heading = Math.atan2(dx, dz);
      const speed = Math.min(car.maxSpeed || 34, 26 + wanted * 3);
      car.position.x += Math.sin(car.heading) * speed * dt;
      car.position.z += Math.cos(car.heading) * speed * dt;
      if (car.mesh) { car.mesh.position.copy(car.position); car.mesh.rotation.y = car.heading; }
      // Busted: a police touch on the on-foot player for 2 s.
      // Shot mode suppresses the bust: staging a wanted-level shot must
      // not respawn Rico at the station mid-capture. Normal play is
      // untouched — the guard only fires while world.shotMode is set.
      if (!w.shotMode && !w.shotStaging && !w.playerCar && target.kind === 'player' && dist2D(car.position, playerPos(w)) < 2.5) {
        state.bustedTimer += dt;
        if (state.bustedTimer >= 2) {
          state.bustedTimer = 0;
          w.cash = Math.max(0, (w.cash || 0) - 200);
          w.wanted = 0;
          if (w.player && w.player.position) { w.player.position.x = 80; w.player.position.z = -203; }
          w.mode = 'busted';
          if (typeof w.toast === 'function') w.toast('Busted! -$200, back at the station.');
        }
      } else if (target.kind === 'player') state.bustedTimer = 0;
    }
    // Roadblocks at 3+ stars, clearing when the player is far away.
    // No roadblocks or spike strips while a shot is being staged.
    state.roadblockTimer -= dt;
    if (wanted >= 3 && !w.shotMode && !w.shotStaging && state.roadblockTimer <= 0 && w.roadblocks.length < 2) spawnRoadblock();
    for (let i = w.roadblocks.length - 1; i >= 0; i -= 1) {
      if (dist2D(playerPos(w), w.roadblocks[i].position) > 160) {
        for (const c of w.roadblocks[i].cars) {
          if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
          if (Array.isArray(w.cars)) {
            const ci = w.cars.indexOf(c);
            if (ci >= 0) w.cars.splice(ci, 1);
          }
        }
        w.roadblocks.splice(i, 1);
      }
    }
    // Spike strips at 3+ stars (not while staging a shot).
    state.spikeTimer -= dt;
    if (wanted >= 3 && !w.shotMode && !w.shotStaging && state.spikeTimer <= 0) laySpikeStrip();
    checkSpikeHit();
    // Tire damage slowly heals by waiting.
    if ((w.tireDamage || 0) > 0 && wanted === 0) w.tireDamage = Math.max(0, w.tireDamage - dt * 0.02);
    // Helicopter lead + second heli at 5 stars.
    if (wanted >= 4) heliLead(dt);
    state.secondHeliActive = wanted >= 5;
    if (w.secondHelicopter) w.secondHelicopter.active = state.secondHeliActive;
  }

  function reset() {
    state.roadblockTimer = 0; state.spikeTimer = 0; state.bustedTimer = 0;
    state.secondHeliActive = false;
    w.roadblocks.length = 0; w.spikeStrips.length = 0;
  }

  const api = {
    update, assignFlank, flankTarget, spawnRoadblock, laySpikeStrip,
    checkSpikeHit, heliLead, nearestTarget, reset, state,
    get secondHeliActive() { return state.secondHeliActive; },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  return api;
}

export default createPoliceAI;
