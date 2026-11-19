// Traffic: about 10 cars cruising the road grid and about 14 pedestrians
// on the sidewalks. Cars stop for the car ahead, change lanes to overtake
// a slow car instead of queuing forever, and yield at intersections when
// the player crosses fast. Pedestrians flee a speeding player car and
// gunshots.
//
// WIRING (v12 contract): this factory takes (scene, world, city) — the
// city object is the 3rd argument, so roads are read from city.roads
// directly. It never writes world.traffic: the traffic state lives in the
// shared world.cars / world.pedestrians lists, and this system keeps only
// its own behaviour state in its closure.
import * as THREE from 'three';
import { spawnCar } from './vehicles.js';

const GRID_LINES = [-232, -174, -116, -58, 0, 58, 116, 174, 232];
const TRAFFIC_CARS = 10;
const PEDESTRIANS = 14;

function defaultRoads() {
  const roads = [];
  for (const c of GRID_LINES) {
    roads.push({ axis: 'x', coord: c, min: -261, max: 261 });
    roads.push({ axis: 'z', coord: c, min: -261, max: 261 });
  }
  return roads;
}

function buildPedestrianMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f3a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 4, 8), shirt);
  body.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.68;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.18), pants);
  legL.position.set(-0.14, 0.33, 0);
  legL.name = 'legL';
  const legR = legL.clone();
  legR.position.x = 0.14;
  legR.name = 'legR';
  group.add(body, head, legL, legR);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function createTraffic(scene, world, city) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  const roads = (city && Array.isArray(city.roads) && city.roads.length > 0)
    ? city.roads
    : (world.city && Array.isArray(world.city.roads) && world.city.roads.length > 0)
      ? world.city.roads
      : defaultRoads();
  if (!Array.isArray(world.cars)) world.cars = [];
  if (!Array.isArray(world.pedestrians)) world.pedestrians = [];

  const kinds = ['sedan', 'sedan', 'taxi', 'truck', 'sedan', 'sports'];
  const trafficCars = [];
  for (let i = 0; i < TRAFFIC_CARS; i += 1) {
    const road = roads[Math.floor(rng() * roads.length)];
    const along = -240 + rng() * 480;
    const x = road.axis === 'x' ? along : road.coord;
    const z = road.axis === 'x' ? road.coord : along;
    const car = spawnCar(scene, world, kinds[i % kinds.length], x, z, {
      heading: road.axis === 'x' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      driver: 'traffic',
    });
    car.traffic = {
      axis: road.axis,
      coord: road.coord,
      dir: rng() < 0.5 ? 1 : -1,
      lane: (rng() < 0.5 ? -1 : 1) * 3.2,
      targetLane: null,
      speed: 7 + rng() * 5,
      cruise: 8 + rng() * 5,
      blockedTimer: 0,
      yieldTimer: 0,
    };
    trafficCars.push(car);
  }

  const pedColors = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c44a, 0x9a4ad8, 0xdddddd];
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i += 1) {
    const road = roads[Math.floor(rng() * roads.length)];
    const along = -240 + rng() * 480;
    const off = (rng() < 0.5 ? -1 : 1) * (8.5 + rng() * 3);
    const x = road.axis === 'x' ? along : road.coord + off;
    const z = road.axis === 'x' ? road.coord + off : along;
    const mesh = buildPedestrianMesh(pedColors[i % pedColors.length]);
    mesh.position.set(x, 0, z);
    if (scene) scene.add(mesh);
    const ped = {
      mesh,
      position: mesh.position,
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 0.9,
      state: 'walk',
      axis: road.axis,
      coord: road.coord,
      dir: rng() < 0.5 ? 1 : -1,
      fleeTimer: 0,
      phase: rng() * Math.PI * 2,
    };
    world.pedestrians.push(ped);
    peds.push(ped);
  }

  function nearestRoadCoord(axis, value) {
    let best = GRID_LINES[0];
    let bestD = Infinity;
    for (const c of GRID_LINES) {
      const d = Math.abs(c - value);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function carAhead(car) {
    const t = car.traffic;
    let best = null;
    let bestD = 9;
    for (const other of world.cars) {
      if (other === car || !other.position || !other.traffic) continue;
      if (other.traffic.axis !== t.axis || other.traffic.coord !== t.coord) continue;
      const along = t.axis === 'x' ? other.position.x - car.position.x : other.position.z - car.position.z;
      if (Math.sign(along) !== t.dir || Math.abs(along) > 9) continue;
      const d = Math.abs(along);
      if (d < bestD) { bestD = d; best = other; }
    }
    // The player's car counts as a car ahead too.
    const p = world.player;
    if (p && p.currentCar && p.currentCar !== car) {
      const pc = p.currentCar;
      const along = t.axis === 'x' ? pc.position.x - car.position.x : pc.position.z - car.position.z;
      if (Math.sign(along) === t.dir && Math.abs(along) < 9 && Math.abs(along) < bestD) best = pc;
    }
    return best;
  }

  function update(dt) {
    if (!world || world.mode !== 'play') return;
    const p = world.player;
    const px = p ? p.position.x : 0;
    const pz = p ? p.position.z : 0;
    const playerSpeed = p ? Math.abs(p.speed || 0) : 0;

    for (const car of trafficCars) {
      if (!car.position || !car.traffic) continue;
      // Shot staging: freeze street cars near the subject so none drives
      // onto Rico before the shutter (the airfield start line sits on
      // road z=-232, so traffic rolled straight over the mission shot).
      // Cars farther out keep moving, so the street stays alive.
      if (world.shotMode && Math.hypot(px - car.position.x, pz - car.position.z) < 30) continue;
      const t = car.traffic;
      // Lane-change easing.
      if (t.targetLane !== null) {
        t.lane += (t.targetLane - t.lane) * Math.min(1, dt * 1.5);
        if (Math.abs(t.targetLane - t.lane) < 0.2) { t.lane = t.targetLane; t.targetLane = null; }
      }
      // Yield at intersections when the player crosses fast.
      const nearIntersection = Math.abs(car.position.x - nearestRoadCoord('x', car.position.x)) < 10
        && Math.abs(car.position.z - nearestRoadCoord('z', car.position.z)) < 10;
      const playerNear = Math.hypot(px - car.position.x, pz - car.position.z) < 26;
      let wantSpeed = t.cruise;
      if (nearIntersection && playerNear && playerSpeed > 8) {
        t.yieldTimer = 1.2;
        wantSpeed = 0;
      }
      if (t.yieldTimer > 0) { t.yieldTimer -= dt; wantSpeed = 0; }
      // Stop for the car ahead; overtake instead of queuing forever.
      const ahead = carAhead(car);
      if (ahead) {
        t.blockedTimer += dt;
        wantSpeed = 0;
        if (t.blockedTimer > 2 && t.targetLane === null) {
          t.targetLane = -t.lane; // pull into the other lane and pass
          t.blockedTimer = 0;
        }
      } else {
        t.blockedTimer = 0;
      }
      t.speed += (wantSpeed - t.speed) * Math.min(1, dt * 1.2);
      if (t.axis === 'x') {
        car.position.x += t.dir * t.speed * dt;
        car.position.z = t.coord + t.lane;
        if (car.position.x > 258) { car.position.x = -258; }
        if (car.position.x < -258) { car.position.x = 258; }
        car.heading = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.position.z += t.dir * t.speed * dt;
        car.position.x = t.coord + t.lane;
        if (car.position.z > 258) { car.position.z = -258; }
        if (car.position.z < -258) { car.position.z = 258; }
        car.heading = t.dir > 0 ? 0 : Math.PI;
      }
      car.speed = t.speed;
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;
    }

    // Pedestrians: stroll the sidewalks, flee a speeding player car and
    // any gunshot event this frame.
    let gunshot = null;
    if (Array.isArray(world.events)) {
      for (const ev of world.events) if (ev && ev.type === 'gunshot') gunshot = ev;
    }
    for (const ped of peds) {
      if (!ped.position) continue;
      const dPlayer = Math.hypot(px - ped.position.x, pz - ped.position.z);
      if (ped.state !== 'flee') {
        if ((dPlayer < 10 && playerSpeed > 10) || (gunshot && Math.hypot((gunshot.x || 0) - ped.position.x, (gunshot.z || 0) - ped.position.z) < 25)) {
          ped.state = 'flee';
          ped.fleeTimer = 2.5;
        }
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        const awayX = ped.position.x - px;
        const awayZ = ped.position.z - pz;
        const d = Math.hypot(awayX, awayZ) || 1;
        ped.position.x += (awayX / d) * 4.5 * dt;
        ped.position.z += (awayZ / d) * 4.5 * dt;
        ped.heading = Math.atan2(awayX / d, awayZ / d);
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      } else {
        const step = ped.dir * ped.speed * dt;
        if (ped.axis === 'x') {
          ped.position.x += step;
          ped.position.z = ped.coord + (ped.coord >= 0 ? 8.5 : -8.5);
          if (ped.position.x > 255) ped.dir = -1;
          if (ped.position.x < -255) ped.dir = 1;
        } else {
          ped.position.z += step;
          ped.position.x = ped.coord + (ped.coord >= 0 ? 8.5 : -8.5);
          if (ped.position.z > 255) ped.dir = -1;
          if (ped.position.z < -255) ped.dir = 1;
        }
        ped.heading = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
      }
      ped.position.x = Math.max(-258, Math.min(258, ped.position.x));
      ped.position.z = Math.max(-258, Math.min(258, ped.position.z));
      ped.phase += dt * (ped.state === 'flee' ? 10 : 4);
      ped.mesh.position.copy(ped.position);
      ped.mesh.rotation.y = ped.heading;
      const legL = ped.mesh.getObjectByName('legL');
      const legR = ped.mesh.getObjectByName('legR');
      const swing = Math.sin(ped.phase) * 0.45;
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    }
  }

  const sys = {
    name: 'traffic',
    update,
    cars: trafficCars,
    pedestrians: peds,
    roads,
  };
  if (Array.isArray(world.systems)) world.systems.push(sys);
  return sys;
}

export default createTraffic;
