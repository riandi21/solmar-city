import * as THREE from 'three';

// Ambient traffic: ~10 cars cruising the roads, ~14 pedestrians on the
// sidewalks. Pedestrians flee a speeding player car and gunshots; traffic
// cars stop for the car ahead, overtake slow cars, and yield at
// intersections when the player crosses fast.
const TARGET_CARS = 10;
const TARGET_PEDS = 14;

function makeTrafficCarMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.75, 1.9),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.5, 1.7),
    new THREE.MeshLambertMaterial({ color: 0x90caf9 }),
  );
  cabin.position.y = 1.05;
  group.add(body, cabin);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

function makePedMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), shirt);
  body.position.y = 1.0;
  body.name = 'body';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin);
  head.position.y = 1.75;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), new THREE.MeshLambertMaterial({ color: 0x37474f }));
  legL.position.set(-0.14, 0.32, 0);
  legL.name = 'legL';
  const legR = legL.clone();
  legR.position.x = 0.14;
  legR.name = 'legR';
  group.add(body, head, legL, legR);
  return group;
}

function roadPoint(roads, rng, out) {
  const road = roads[Math.floor(rng() * roads.length)];
  if (!road) return null;
  if (road.x1 != null && road.x2 != null) {
    const t = rng();
    out.x = road.x1 + (road.x2 - road.x1) * t;
    out.z = road.z1 + (road.z2 - road.z1) * t;
    out.heading = Math.atan2(road.x2 - road.x1, road.z2 - road.z1);
  } else if (road.start && road.end) {
    const t = rng();
    out.x = road.start.x + (road.end.x - road.start.x) * t;
    out.z = road.start.z + (road.end.z - road.start.z) * t;
    out.heading = Math.atan2(road.end.x - road.start.x, road.end.z - road.start.z);
  } else {
    out.x = road.x ?? 0;
    out.z = road.z ?? 0;
    out.heading = road.heading ?? road.angle ?? 0;
  }
  return out;
}

export function createTraffic(scene, world, city) {
  // Read the city passed in as the 3rd arg; only use world.city if the
  // caller did not pass one.
  const cityObj = city || world.city || {};
  const roads = cityObj.roads || [];
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const palette = [0x90a4ae, 0xef5350, 0x66bb6a, 0xffca28, 0xab47bc, 0x42a5f5, 0xec407a];
  const cars = [];
  const peds = [];
  if (!Array.isArray(world.pedestrians)) world.pedestrians = [];
  const tmp = { x: 0, z: 0, heading: 0 };

  function spawnCar() {
    if (roads.length === 0) return null;
    if (!roadPoint(roads, rng, tmp)) return null;
    const mesh = makeTrafficCarMesh(palette[Math.floor(rng() * palette.length)]);
    mesh.position.set(tmp.x, 0, tmp.z);
    scene.add(mesh);
    const car = {
      mesh, position: mesh.position, heading: tmp.heading,
      speed: 7 + rng() * 5, cruise: 8 + rng() * 5, lane: (rng() - 0.5) * 3,
      road: null, t: rng(),
    };
    cars.push(car);
    return car;
  }

  function spawnPed() {
    if (roads.length === 0) return null;
    if (!roadPoint(roads, rng, tmp)) return null;
    // Sidewalk: offset perpendicular to the road direction.
    const px = tmp.x + Math.cos(tmp.heading) * 4.5;
    const pz = tmp.z - Math.sin(tmp.heading) * 4.5;
    const mesh = makePedMesh(palette[Math.floor(rng() * palette.length)]);
    mesh.position.set(px, 0, pz);
    scene.add(mesh);
    const ped = {
      mesh, position: mesh.position, heading: tmp.heading + Math.PI / 2,
      speed: 1.2 + rng() * 0.8, fleeing: false, phase: rng() * 6,
    };
    peds.push(ped);
    world.pedestrians.push(ped);
    return ped;
  }

  function update(dt) {
    if (world.elapsed == null) world.elapsed = 0;
    // Keep the counts topped up (only while roads exist).
    while (cars.length < TARGET_CARS && roads.length) {
      if (!spawnCar()) break;
    }
    while (peds.length < TARGET_PEDS && roads.length) {
      if (!spawnPed()) break;
    }
    const playerCar = world.player.currentCar;
    const playerSpeed = Math.abs(world.player.speed || 0);
    const gunshot = world.lastGunshotAt != null
      && (world.elapsed - world.lastGunshotAt) < 2;
    // --- Traffic cars ---
    for (const car of cars) {
      let target = car.cruise;
      // Stop for the car ahead (traffic + player car).
      const ahead = [];
      if (playerCar) ahead.push(playerCar);
      for (const o of cars) if (o !== car) ahead.push(o);
      let nearestGap = Infinity;
      let slowAhead = null;
      for (const o of ahead) {
        if (!o.position) continue;
        const dx = o.position.x - car.position.x;
        const dz = o.position.z - car.position.z;
        const forward = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const lateral = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (forward > 0 && forward < 14 && lateral < 3) {
          if (forward < nearestGap) { nearestGap = forward; slowAhead = o; }
        }
      }
      if (slowAhead) {
        const aheadSpeed = Math.abs(slowAhead.speed || 0);
        if (nearestGap < 7) target = 0;
        else if (aheadSpeed < car.cruise * 0.7) {
          // Overtake a slow car: swing into the next lane.
          car.lane = car.lane > 0 ? -1.8 : 1.8;
          target = car.cruise;
        } else target = aheadSpeed;
      } else {
        car.lane += (0 - car.lane) * dt * 0.2;
      }
      // Yield at intersections when the player crosses fast — but only
      // when the player is actually crossing in front, not just nearby
      // behind the traffic car.
      if (playerCar && playerSpeed > 18) {
        const dx = playerCar.position.x - car.position.x;
        const dz = playerCar.position.z - car.position.z;
        const d = Math.hypot(dx, dz);
        const inFront = dx * Math.sin(car.heading) + dz * Math.cos(car.heading) > 0;
        if (d < 22 && inFront) target = 0;
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
      car.position.x += Math.sin(car.heading) * car.speed * dt;
      car.position.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;
      // Wrap far-away cars back onto a random road near the player.
      const pd = Math.hypot(car.position.x - world.player.position.x, car.position.z - world.player.position.z);
      if (pd > 260 && roads.length) {
        if (roadPoint(roads, rng, tmp)) {
          car.position.set(tmp.x, 0, tmp.z);
          car.heading = tmp.heading;
          car.speed = car.cruise;
        }
      }
    }
    // --- Pedestrians ---
    for (const ped of peds) {
      const dx = ped.position.x - world.player.position.x;
      const dz = ped.position.z - world.player.position.z;
      const d = Math.hypot(dx, dz);
      const playerCarNear = playerCar && d < 14 && playerSpeed > 8;
      if (playerCarNear || (gunshot && d < 30)) ped.fleeing = true;
      if (ped.fleeing && d > 45) ped.fleeing = false;
      let heading = ped.heading;
      let speed = ped.speed;
      if (ped.fleeing) {
        heading = Math.atan2(dx, dz);
        speed = 4.5;
      } else {
        heading += Math.sin(world.elapsed * 0.5 + ped.phase) * dt * 0.4;
      }
      ped.heading = heading;
      ped.position.x += Math.sin(heading) * speed * dt;
      ped.position.z += Math.cos(heading) * speed * dt;
      ped.mesh.position.copy(ped.position);
      ped.mesh.rotation.y = heading;
      ped.phase += dt * (ped.fleeing ? 14 : 7);
      const swing = Math.sin(ped.phase) * 0.5;
      const legL = ped.mesh.getObjectByName('legL');
      const legR = ped.mesh.getObjectByName('legR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    }
  }

  return { update };
}
