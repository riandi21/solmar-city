// Traffic: cars that drive the grid and pedestrians that walk its sidewalks.
// Cars follow directed lanes (right-hand traffic, ~3.5 m lane offset), pick
// their next move at each intersection (70% straight, 15% left, 15% right),
// and brake for a car ahead within 12 m. Pedestrians stroll the sidewalks,
// flee a speeding player car or a gunshot, and go down if the player runs
// one over (a crime). Cars and peds far from the player are recycled near
// the player so the counts stay at ~10 cars and ~14 peds.
//
// Events are read by index (seenEvents) and never removed: police.js reads
// the same queue for 'crime' events, so no system may drain it.
// Heading convention: forward = (sin(heading), 0, cos(heading)).
import * as THREE from 'three';
import { makeCar } from './vehicles.js';
import { buildPersonMesh } from './player.js';

const GRID = [-232, -174, -116, -58, 0, 58, 116, 174, 232];
const LANE = 3.5; // right-hand lane offset from the road centreline
const WALK_OFFSET = 8.5; // sidewalks sit just outside the 14 m road
const TARGET_CARS = 10;
const TARGET_PEDS = 14;
const DESPAWN_CAR = 135;
const DESPAWN_PED = 105;
const STOP_GAP = 12; // brake for a car ahead within this distance

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

export function createTraffic(scene, world, city) {
  const rng = world.rng || Math.random;
  const rand = (a, b) => a + rng() * (b - a);
  const pickGrid = () => GRID[Math.floor(rng() * GRID.length)];
  const playerPos = () => (world.player && world.player.pos) || { x: 0, z: 0 };

  // Roads: prefer the city's own list, fall back to the known 9x9 grid.
  const roads = (city && Array.isArray(city.roads) && city.roads.length)
    ? city.roads
    : [...GRID.map((c) => ({ axis: 'x', coord: c })), ...GRID.map((c) => ({ axis: 'z', coord: c }))];

  let seenEvents = 0;
  let trafficCars = [];
  let peds = [];

  /** Right-hand lane coordinate for a road: the car's lateral position. */
  function laneCoord(axis, coord, dir) {
    if (axis === 'x') return coord + (dir > 0 ? LANE : -LANE); // eastbound: south side
    return coord + (dir > 0 ? -LANE : LANE); // southbound: west side
  }

  /** Next grid crossing along a road from `along`, or null at the edge. */
  function nextCrossing(along, dir) {
    if (dir > 0) {
      for (const g of GRID) if (g > along + 1) return g;
    } else {
      for (let i = GRID.length - 1; i >= 0; i -= 1) if (GRID[i] < along - 1) return GRID[i];
    }
    return null;
  }

  /** Waypoint: the next intersection on this car's road, or the road's end. */
  function waypointFor(ai) {
    const along = ai.axis === 'x' ? ai.x : ai.z;
    const next = nextCrossing(along, ai.dir);
    const end = ai.dir > 0 ? 250 : -250;
    const target = next === null ? end : next;
    if (ai.axis === 'x') return { x: target, z: laneCoord('x', ai.coord, ai.dir) };
    return { x: laneCoord('z', ai.coord, ai.dir), z: target };
  }

  /** At an intersection: 70% straight, 15% left, 15% right (never a U-turn). */
  function chooseNextLeg(ai) {
    const along = ai.axis === 'x' ? ai.x : ai.z;
    const cross = nextCrossing(along, ai.dir);
    const atEdge = cross === null;
    const roll = rng();
    if (!atEdge && roll < 0.7) {
      ai.wp = waypointFor(ai); // straight on: next intersection
      ai.turning = false;
      return;
    }
    // Turn onto the crossing road. Left/right are relative to travel:
    // east->left is north, east->right is south; south->left is east, etc.
    const left = roll < 0.85; // 15% left of the remaining 30%, else right
    let newDir;
    if (ai.axis === 'x') newDir = ai.dir > 0 ? (left ? -1 : 1) : (left ? 1 : -1);
    else newDir = ai.dir > 0 ? (left ? 1 : -1) : (left ? -1 : 1);
    const crossCoord = atEdge ? (ai.dir > 0 ? 232 : -232) : cross;
    ai.axis = ai.axis === 'x' ? 'z' : 'x';
    ai.coord = crossCoord;
    ai.dir = newDir;
    ai.wp = waypointFor(ai);
    ai.turning = true;
  }

  function spawnTrafficCar(nearPlayer) {
    const pp = playerPos();
    let x = 0;
    let z = 0;
    let axis = 'x';
    let coord = 0;
    let dir = 1;
    for (let tries = 0; tries < 10; tries += 1) {
      const road = roads[Math.floor(rng() * roads.length)];
      axis = road.axis;
      coord = road.coord;
      dir = rng() < 0.5 ? 1 : -1;
      const along = rand(-220, 220);
      if (axis === 'x') { x = along; z = laneCoord('x', coord, dir); }
      else { x = laneCoord('z', coord, dir); z = along; }
      const d = dist2(x, z, pp.x, pp.z);
      if (nearPlayer ? (d > 45 && d < 95) : d > 30) break;
    }
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeCar(scene, world, 'traffic', { x, z }, heading);
    car.ai = {
      axis, coord, dir,
      x, z,
      cruise: rand(8, 13),
      wp: null,
      turning: false,
    };
    car.ai.wp = waypointFor(car.ai);
    car.speed = car.ai.cruise;
    trafficCars.push(car);
    return car;
  }

  function removeTrafficCar(car) {
    scene.remove(car.mesh);
    const i = (world.cars || []).indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
    const j = trafficCars.indexOf(car);
    if (j >= 0) trafficCars.splice(j, 1);
  }

  function carAhead(car) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let nearest = Infinity;
    for (const other of world.cars || []) {
      if (other === car || !other.active) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d >= STOP_GAP || d < 0.5) continue;
      const forward = (dx * fx + dz * fz) / d;
      if (forward < 0.6) continue; // not ahead of us
      const lateral = Math.abs(-dx * fz + dz * fx);
      if (lateral > 2.6) continue; // different lane
      nearest = Math.min(nearest, d);
    }
    return nearest;
  }

  function stepTrafficCar(car, dt) {
    const ai = car.ai;
    if (!ai) return;
    ai.x = car.pos.x;
    ai.z = car.pos.z;
    const wp = ai.wp;
    const dWp = dist2(car.pos.x, car.pos.z, wp.x, wp.z);
    if (dWp < 5) {
      chooseNextLeg(ai);
    }
    // Steer toward the waypoint; slow down for a sharp turn.
    const wantHeading = Math.atan2(wp.x - car.pos.x, wp.z - car.pos.z);
    const headingError = Math.abs(clampAngle(wantHeading - car.heading));
    car.heading = turnToward(car.heading, wantHeading, 2.0 * dt);
    let target = ai.cruise;
    if (headingError > 0.6) target = Math.min(target, 5.5);
    if (ai.turning && dWp < 25) target = Math.min(target, 6);
    // Brake for the car ahead: full stop under a 4 m gap, easing off by 12 m.
    const gap = carAhead(car);
    if (gap < STOP_GAP) {
      target = gap < 4 ? 0 : ai.cruise * ((gap - 4) / (STOP_GAP - 4));
    }
    // Ease the speed toward the target; braking is harder than accelerating.
    const rate = target < car.speed ? 14 : 5;
    car.speed += Math.max(-rate * dt, Math.min(rate * dt, target - car.speed));
    if (car.speed < 0.05 && target === 0) car.speed = 0;
    // Keep the car glued to its lane laterally (waypoint steering does the
    // rest); the gain is strong so a car shoved off-lane by a collision
    // recovers within a second or two.
    const lateral = ai.axis === 'x' ? car.pos.z : car.pos.x;
    const wantLateral = laneCoord(ai.axis, ai.coord, ai.dir);
    const correction = (wantLateral - lateral) * 1.0 * dt;
    if (ai.axis === 'x') car.pos.z += correction;
    else car.pos.x += correction;
  }

  // ---- Pedestrians -------------------------------------------------------

  function sidewalkWaypoint() {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const coord = pickGrid();
    const side = rng() < 0.5 ? 1 : -1;
    const along = rand(-240, 240);
    if (axis === 'x') return { x: along, z: coord + side * WALK_OFFSET };
    return { x: coord + side * WALK_OFFSET, z: along };
  }

  function spawnPed(nearPlayer, fleeFrom) {
    const pp = playerPos();
    let wp = sidewalkWaypoint();
    let tries = 0;
    while (nearPlayer && dist2(wp.x, wp.z, pp.x, pp.z) > 95 && tries < 8) {
      wp = sidewalkWaypoint();
      tries += 1;
    }
    const mesh = buildPersonMesh(rng);
    mesh.position.set(wp.x + rand(-4, 4), 0, wp.z + rand(-4, 4));
    scene.add(mesh);
    const ped = {
      mesh,
      pos: mesh.position,
      heading: rand(0, Math.PI * 2),
      speed: rand(1.1, 1.6),
      state: fleeFrom ? 'flee' : 'walk',
      wp: sidewalkWaypoint(),
      wait: 0,
      fleeT: fleeFrom ? 3 : 0,
      threatX: fleeFrom ? fleeFrom.x : 0,
      threatZ: fleeFrom ? fleeFrom.z : 0,
      downT: 0,
      phase: rand(0, Math.PI * 2),
    };
    mesh.rotation.y = ped.heading;
    peds.push(ped);
    if (!world.peds) world.peds = [];
    world.peds.push(ped);
    return ped;
  }

  function removePed(ped) {
    scene.remove(ped.mesh);
    const i = peds.indexOf(ped);
    if (i >= 0) peds.splice(i, 1);
    const j = (world.peds || []).indexOf(ped);
    if (j >= 0) world.peds.splice(j, 1);
  }

  function stepPed(ped, dt) {
    const pp = playerPos();
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        removePed(ped);
        spawnPed(true);
      }
      return;
    }
    // Flee: a fast player car close by, or a gunshot the events brought in.
    const playerCar = world.player && world.player.car;
    if (ped.state !== 'flee' && playerCar && Math.abs(playerCar.speed) > 8) {
      if (dist2(ped.pos.x, ped.pos.z, playerCar.pos.x, playerCar.pos.z) < 10) {
        ped.state = 'flee';
        ped.fleeT = 3;
        ped.threatX = playerCar.pos.x;
        ped.threatZ = playerCar.pos.z;
      }
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const dx = ped.pos.x - ped.threatX;
      const dz = ped.pos.z - ped.threatZ;
      const d = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx / d, dz / d);
      ped.heading = turnToward(ped.heading, want, 6 * dt);
      ped.speed = 4.2;
      ped.pos.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.pos.z += Math.cos(ped.heading) * ped.speed * dt;
      if (ped.fleeT <= 0) {
        ped.state = 'walk';
        ped.wp = sidewalkWaypoint();
      }
    } else {
      if (ped.wait > 0) {
        ped.wait -= dt;
        ped.speed = 0;
      } else {
        const dWp = dist2(ped.pos.x, ped.pos.z, ped.wp.x, ped.wp.z);
        if (dWp < 2) {
          if (rng() < 0.25) ped.wait = rand(1, 4); // pause and look around
          ped.wp = sidewalkWaypoint();
        } else {
          const want = Math.atan2(ped.wp.x - ped.pos.x, ped.wp.z - ped.pos.z);
          ped.heading = turnToward(ped.heading, want, 4 * dt);
          ped.speed = rand(1.1, 1.6);
          ped.pos.x += Math.sin(ped.heading) * ped.speed * dt;
          ped.pos.z += Math.cos(ped.heading) * ped.speed * dt;
        }
      }
    }
    // Peds stay on land: out of the open sea and out of the marina basin.
    // (Fleeing peds otherwise run straight into the water.)
    ped.pos.x = Math.max(-258, Math.min(258, ped.pos.x));
    ped.pos.z = Math.max(-258, Math.min(258, ped.pos.z));
    // Run over by the player's car: down, and a crime for the player.
    if (playerCar && Math.abs(playerCar.speed) > 3) {
      if (dist2(ped.pos.x, ped.pos.z, playerCar.pos.x, playerCar.pos.z) < 2.2) {
        ped.state = 'down';
        ped.downT = 4;
        ped.mesh.rotation.z = Math.PI / 2;
        if (!world.events) world.events = [];
        world.events.push({ type: 'crime', data: { level: 1, kind: 'pedHit' } });
        playerCar.speed *= 0.6;
        return;
      }
    }
    // Walk-cycle swing; lying flat stays flat.
    ped.phase += ped.speed * dt * 4;
    const swing = Math.min(1, ped.speed / 1.6) * 0.5;
    const limbs = ped.mesh.userData.limbs;
    if (limbs) {
      const s = Math.sin(ped.phase);
      limbs.legL.rotation.x = s * swing;
      limbs.legR.rotation.x = -s * swing;
      limbs.armL.rotation.x = -s * swing * 0.8;
      limbs.armR.rotation.x = s * swing * 0.8;
    }
    ped.mesh.rotation.y = ped.heading;
  }

  function processEvents() {
    const events = world.events || [];
    for (; seenEvents < events.length; seenEvents += 1) {
      const ev = events[seenEvents];
      if (!ev) continue;
      if (ev.type === 'gunshot') {
        const gx = ev.data && ev.data.pos ? ev.data.pos.x : 0;
        const gz = ev.data && ev.data.pos ? ev.data.pos.z : 0;
        for (const ped of peds) {
          if (ped.state === 'down') continue;
          if (dist2(ped.pos.x, ped.pos.z, gx, gz) < 25) {
            ped.state = 'flee';
            ped.fleeT = 3;
            ped.threatX = gx;
            ped.threatZ = gz;
          }
        }
      } else if (ev.type === 'pedFlee' && ev.data && ev.data.pos) {
        spawnPed(false, { x: ev.data.pos.x, z: ev.data.pos.z });
      }
    }
  }

  // Seed the streets at boot so the first frame already has life in it.
  for (let i = 0; i < TARGET_CARS; i += 1) spawnTrafficCar(false);
  for (let i = 0; i < TARGET_PEDS; i += 1) spawnPed(false);

  function update(dt) {
    const capped = Math.min(dt, 0.05);
    processEvents();
    if (world.mode !== undefined && world.mode !== 'play') return;
    const pp = playerPos();
    for (const car of [...trafficCars]) {
      stepTrafficCar(car, capped);
      if (dist2(car.pos.x, car.pos.z, pp.x, pp.z) > DESPAWN_CAR) {
        removeTrafficCar(car);
        spawnTrafficCar(true);
      }
    }
    // Top the count back up if something else removed a traffic car.
    while (trafficCars.length < TARGET_CARS) spawnTrafficCar(true);
    for (const ped of [...peds]) {
      stepPed(ped, capped);
      if (ped.state !== 'down' && dist2(ped.pos.x, ped.pos.z, pp.x, pp.z) > DESPAWN_PED) {
        removePed(ped);
        spawnPed(true);
      }
    }
    while (peds.length < TARGET_PEDS) spawnPed(true);
  }

  return { update };
}
