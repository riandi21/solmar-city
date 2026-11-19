import * as THREE from 'three';

const ROAD_LINES = [-232, -174, -116, -58, 0, 58, 116, 174, 232];
const TARGET_CARS = 10;
const TARGET_PEDS = 14;

function rand(world, a, b) {
  const r = world.rng ? world.rng() : Math.random();
  return a + r * (b - a);
}
function pick(world, arr) {
  return arr[Math.floor((world.rng ? world.rng() : Math.random()) * arr.length)];
}

function roadLines(world) {
  if (world.city && world.city.roads && world.city.roads.length) {
    const xs = new Set(), zs = new Set();
    for (const r of world.city.roads) {
      if (r.axis === 'x') zs.add(r.coord);
      else xs.add(r.coord);
    }
    if (xs.size && zs.size) return { xs: [...xs], zs: [...zs] };
  }
  return { xs: ROAD_LINES, zs: ROAD_LINES };
}

function makePedMesh(world) {
  const g = new THREE.Group();
  const shirtC = pick(world, [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xe8e8e8]);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32),
    new THREE.MeshStandardMaterial({ color: shirtC, roughness: 0.9 }));
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 }));
  head.position.y = 1.68;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.9 }));
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  g.add(torso, head, legL, legR);
  g.userData.legs = [legL, legR];
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createTraffic(world) {
  world.pedestrians = world.pedestrians || [];
  world.cars = world.cars || [];
  const p = world.player;
  let pedPhase = 0;

  function spawnTrafficCar() {
    const { xs, zs } = roadLines(world);
    const alongX = (world.rng ? world.rng() : Math.random()) < 0.5;
    const line = alongX ? pick(world, zs) : pick(world, xs);
    const along = rand(world, -230, 230);
    const lane = pick(world, [-3.5, 3.5]);
    const x = alongX ? along : line + lane;
    const z = alongX ? line + lane : along;
    // Right-hand traffic: heading follows the lane side.
    let heading;
    if (alongX) heading = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
    else heading = lane > 0 ? Math.PI : 0;
    const kind = pick(world, ['sedan', 'sedan', 'sedan', 'taxi', 'truck']);
    const vehicles = world.systems && world.systems.vehicles;
    let car;
    if (vehicles && vehicles.spawnCar) {
      car = vehicles.spawnCar(kind, x, z, heading, 'traffic');
    } else {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.2),
        new THREE.MeshStandardMaterial({ color: 0x888888 }));
      body.position.y = 0.7;
      g.add(body);
      g.position.set(x, 0, z);
      if (world.scene) world.scene.add(g);
      car = { kind, driver: 'traffic', mesh: g, position: g.position, heading, speed: 0, maxSpeed: 12 };
      world.cars.push(car);
    }
    car.speed = rand(world, 7, 12);
    car.maxSpeed = rand(world, 10, 13);
    car.laneOffset = lane;
    car.targetLane = lane;
    car.blockedTimer = 0;
    car.stopTimer = 0;
    return car;
  }

  function spawnPedestrian() {
    const { xs, zs } = roadLines(world);
    const alongX = (world.rng ? world.rng() : Math.random()) < 0.5;
    const line = alongX ? pick(world, zs) : pick(world, xs);
    const along = rand(world, -240, 240);
    const side = pick(world, [-8.5, 8.5]);
    const x = alongX ? along : line + side;
    const z = alongX ? line + side : along;
    const mesh = makePedMesh(world);
    mesh.position.set(x, 0, z);
    if (world.scene) world.scene.add(mesh);
    const ped = {
      mesh, position: mesh.position,
      heading: alongX ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI),
      speed: rand(world, 1.2, 2.2), state: 'walk', walkPhase: rand(world, 0, 6),
      alongX, line,
    };
    world.pedestrians.push(ped);
    return ped;
  }

  function carAhead(car, dist) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let best = null, bestD = dist;
    for (const other of world.cars) {
      if (other === car) continue;
      const dx = other.position.x - car.position.x, dz = other.position.z - car.position.z;
      const forward = dx * fx + dz * fz;
      const lateral = Math.abs(dx * fz - dz * fx);
      if (forward > 0 && forward < bestD && lateral < 2.2) { best = other; bestD = forward; }
    }
    return best;
  }

  function laneClear(car, newLane) {
    // Is the neighbouring lane free for an overtake?
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    const side = Math.sign(newLane - car.laneOffset) || 1;
    for (const other of world.cars) {
      if (other === car) continue;
      const dx = other.position.x - car.position.x, dz = other.position.z - car.position.z;
      const forward = dx * fx + dz * fz;
      const lateral = dx * rx + dz * rz;
      if (forward > -6 && forward < 18 && Math.sign(lateral) === side && Math.abs(lateral) < 5) return false;
    }
    return true;
  }

  function updateTrafficCar(car, dt) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    // Yield at intersections when the player crosses fast.
    const playerSpeed = Math.abs(p.speed || 0);
    const playerNear = p.position && car.position.distanceTo(p.position) < 26;
    const atCrossing = ROAD_LINES.some((l) => Math.abs(car.position.x - l) < 9)
      && ROAD_LINES.some((l) => Math.abs(car.position.z - l) < 9);
    if (playerNear && atCrossing && playerSpeed > 14 && (p.car || p.bike)) {
      car.speed = Math.max(0, car.speed - 14 * dt);
      car.stopTimer = (car.stopTimer || 0) + dt;
    } else {
      car.stopTimer = 0;
      const ahead = carAhead(car, 11);
      if (ahead) {
        // Slow for the car ahead; after 1.5 s blocked, overtake instead
        // of queuing forever (new Round 6 behaviour).
        car.blockedTimer = (car.blockedTimer || 0) + dt;
        const gap = Math.hypot(ahead.position.x - car.position.x, ahead.position.z - car.position.z);
        const want = Math.min(car.maxSpeed, Math.max(0, (gap - 6) * 0.8));
        car.speed += (want - car.speed) * Math.min(1, dt * 3);
        if (car.blockedTimer > 1.5 && ahead.speed < car.maxSpeed - 2) {
          const otherLane = car.laneOffset > 0 ? -3.5 : 3.5;
          if (laneClear(car, otherLane)) {
            car.targetLane = otherLane;
            car.overtaking = true;
            car.blockedTimer = 0;
          }
        }
      } else {
        car.blockedTimer = 0;
        car.speed += (car.maxSpeed - car.speed) * Math.min(1, dt * 1.5);
        if (car.overtaking) {
          // Once past, drift back to the home lane.
          const passed = !carAhead(car, 16);
          if (passed) { car.targetLane = car.laneOffset > 0 ? 3.5 : -3.5; car.overtaking = false; }
        }
      }
    }
    // Lane offset easing: slide sideways toward the target lane.
    const currentLane = car.currentLane ?? car.laneOffset;
    const nextLane = currentLane + (car.targetLane - currentLane) * Math.min(1, dt * 1.2);
    car.currentLane = nextLane;
    const laneDelta = nextLane - currentLane;
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    car.position.x += (fx * car.speed + rx * laneDelta * 8) * dt;
    car.position.z += (fz * car.speed + rz * laneDelta * 8) * dt;
    // Wrap around the far edge so the flow never runs dry.
    if (car.position.x > 255 || car.position.x < -255 || car.position.z > 255 || car.position.z < -255) {
      car.position.x = THREE.MathUtils.clamp(-car.position.x, -240, 240);
      car.position.z = THREE.MathUtils.clamp(-car.position.z, -240, 240);
      car.currentLane = car.laneOffset;
      car.targetLane = car.laneOffset;
    }
    if (car.mesh) {
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;
    }
  }

  function updatePedestrian(ped, dt) {
    const threat = p.car && Math.abs(p.speed || 0) > 10
      ? p.car.position : null;
    let fleeing = false;
    if (threat && ped.position.distanceTo(threat) < 13) fleeing = true;
    const shots = (world.events || []).some((e) => e.type === 'gunshot');
    if (shots && ped.position.distanceTo(p.position) < 30) fleeing = true;
    if (fleeing) {
      ped.state = 'flee';
      const away = new THREE.Vector3().subVectors(ped.position, threat || p.position);
      away.y = 0;
      if (away.lengthSq() < 0.01) away.set(1, 0, 0);
      away.normalize();
      ped.heading = Math.atan2(away.x, away.z);
      ped.speed = 5.5;
    } else {
      ped.state = 'walk';
      ped.speed += (1.6 - ped.speed) * Math.min(1, dt * 2);
    }
    ped.position.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.position.z += Math.cos(ped.heading) * ped.speed * dt;
    ped.position.x = THREE.MathUtils.clamp(ped.position.x, -255, 255);
    ped.position.z = THREE.MathUtils.clamp(ped.position.z, -255, 300);
    ped.walkPhase += ped.speed * dt * 3;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    const legs = ped.mesh.userData.legs || [];
    if (legs[0]) legs[0].rotation.x = swing;
    if (legs[1]) legs[1].rotation.x = -swing;
    ped.mesh.position.copy(ped.position);
    ped.mesh.rotation.y = ped.heading;
  }

  function update(dt) {
    if (world.mode && world.mode !== 'play') return;
    pedPhase += dt;
    // Keep the street populated.
    const trafficCars = world.cars.filter((c) => c.driver === 'traffic');
    for (let i = trafficCars.length; i < TARGET_CARS; i++) spawnTrafficCar();
    for (let i = world.pedestrians.length; i < TARGET_PEDS; i++) spawnPedestrian();
    for (const car of trafficCars) updateTrafficCar(car, dt);
    for (const ped of world.pedestrians) updatePedestrian(ped, dt);
    // Gunshot events are read, not consumed here: other systems (police,
    // combat) may need the same event this frame, so leave the queue alone.
    void pedPhase;
  }

  return { update, spawnTrafficCar, spawnPedestrian, TARGET_CARS, TARGET_PEDS };
}
