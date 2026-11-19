// Police AI — coordination layer for the Solmar City police.
// Flanking pursuit, dynamic roadblocks ahead of the player's travel,
// spike strips (3+ stars) with lasting tire damage, and helicopter lead.
// Communicates only through the shared world object; never imports
// another system module. Called by the bootstrap as createPoliceAI(world).
import * as THREE from 'three';

const ROAD_LINES = [-232, -174, -116, -58, 0, 58, 116, 174, 232];
const SPIKE_SLOW_SECONDS = 4;
const ROADBLOCK_COOLDOWN = 25;
const ROADBLOCK_CLEAR_DISTANCE = 220;

function nearestRoadCoord(value) {
  let best = ROAD_LINES[0];
  let bestDist = Math.abs(value - ROAD_LINES[0]);
  for (const line of ROAD_LINES) {
    const d = Math.abs(value - line);
    if (d < bestDist) {
      bestDist = d;
      best = line;
    }
  }
  return best;
}

function snapToRoad(point) {
  const onXRoad = Math.abs(point.x - nearestRoadCoord(point.x));
  const onZRoad = Math.abs(point.z - nearestRoadCoord(point.z));
  if (onXRoad <= onZRoad) {
    return new THREE.Vector3(nearestRoadCoord(point.x), 0, point.z);
  }
  return new THREE.Vector3(point.x, 0, nearestRoadCoord(point.z));
}

function makeSpikeStripMesh() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.18, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.7, metalness: 0.4 })
  );
  base.position.y = 0.09;
  group.add(base);
  for (let i = 0; i < 9; i++) {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.9 })
    );
    spike.position.set(-3.2 + i * 0.8, 0.3, 0);
    spike.rotation.x = Math.PI / 3;
    group.add(spike);
  }
  return group;
}

export function createPoliceAI(world) {
  world.systems = world.systems || {};
  world.events = world.events || [];
  world.player = world.player || {};
  world.cars = world.cars || [];
  if (typeof world.player.tireDamage !== 'number') world.player.tireDamage = 0;
  if (typeof world.player.slowTimer !== 'number') world.player.slowTimer = 0;

  const strips = [];
  const roadblocks = [];
  let roadblockCooldown = 0;
  let spotlightHeat = 0;
  let lastWanted = world.wanted || 0;

  function playerPos() {
    const p = world.player.position;
    if (p) return p;
    return new THREE.Vector3(0, 0, 0);
  }

  function playerVelocity() {
    const p = world.player;
    const speed = p.speed || 0;
    const heading = p.heading || 0;
    return new THREE.Vector3(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
  }

  function policeCars() {
    return world.cars.filter((car) => car && car.kind === 'police');
  }

  function isNight() {
    if (typeof world.timeOfDay === 'number') {
      return world.timeOfDay >= 18 || world.timeOfDay < 6;
    }
    return !!world.isNight;
  }

  // Lead point: where the player WILL be, so the helicopter and the
  // intercept cars aim ahead instead of at the player's tail.
  function heliLeadTarget(leadSeconds) {
    const pos = playerPos();
    const vel = playerVelocity();
    const lead = leadSeconds == null ? 1.6 : leadSeconds;
    return new THREE.Vector3(pos.x + vel.x * lead, 0, pos.z + vel.z * lead);
  }

  // Assign pursuit roles: the first car chases from behind, the rest
  // split left and right to cut the player off from two sides.
  function assignRoles(cars) {
    const pos = playerPos();
    const heading = world.player.heading || 0;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    cars.forEach((car, index) => {
      if (index === 0) {
        car.aiRole = 'chase';
        car.aiTarget = pos.clone();
        return;
      }
      const side = index % 2 === 0 ? 1 : -1;
      const ahead = 55 + (index - 1) * 22;
      const flank = new THREE.Vector3(
        pos.x + forward.x * ahead + right.x * side * 42,
        0,
        pos.z + forward.z * ahead + right.z * side * 42
      );
      car.aiRole = side > 0 ? 'flank-right' : 'flank-left';
      car.aiTarget = snapToRoad(flank);
    });
  }

  function deploySpikeStrip() {
    const pos = playerPos();
    const heading = world.player.heading || 0;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const ahead = snapToRoad(new THREE.Vector3(
      pos.x + forward.x * 95,
      0,
      pos.z + forward.z * 95
    ));
    const mesh = makeSpikeStripMesh();
    mesh.position.copy(ahead);
    // Lay the strip across the road, perpendicular to travel.
    mesh.rotation.y = heading + Math.PI / 2;
    if (world.scene) world.scene.add(mesh);
    strips.push({ mesh, position: ahead.clone(), age: 0 });
    world.events.push({ type: 'spike-strip', position: ahead.clone() });
  }

  function deployRoadblock() {
    const pos = playerPos();
    const heading = world.player.heading || 0;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const centre = snapToRoad(new THREE.Vector3(
      pos.x + forward.x * 110,
      0,
      pos.z + forward.z * 110
    ));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const blockCars = [];
    for (let i = -1; i <= 1; i++) {
      const spot = new THREE.Vector3(
        centre.x + right.x * i * 6,
        0,
        centre.z + right.z * i * 6
      );
      const car = {
        kind: 'police',
        roadblock: true,
        position: spot,
        heading: heading + Math.PI / 2,
        speed: 0,
        maxSpeed: 0,
        color: 0x1a2a44,
        driver: 'police',
        mesh: null,
      };
      // A plain dark box stands in for the parked unit until the
      // vehicles system dresses it; the position is what matters.
      if (world.scene) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(4.4, 1.5, 2),
          new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.5, metalness: 0.5 })
        );
        box.position.set(spot.x, 0.8, spot.z);
        box.rotation.y = car.heading;
        world.scene.add(box);
        car.mesh = box;
      }
      world.cars.push(car);
      blockCars.push(car);
    }
    roadblocks.push({ cars: blockCars, centre, age: 0 });
    world.events.push({ type: 'roadblock', position: centre.clone() });
    // At 4 stars and above the block also lays spike strips.
    if ((world.wanted || 0) >= 4) deploySpikeStrip();
  }

  function clearRoadblock(block) {
    for (const car of block.cars) {
      const index = world.cars.indexOf(car);
      if (index >= 0) world.cars.splice(index, 1);
      if (car.mesh && world.scene) world.scene.remove(car.mesh);
    }
    const index = roadblocks.indexOf(block);
    if (index >= 0) roadblocks.splice(index, 1);
  }

  function updateSpikeStrips(dt) {
    const pos = playerPos();
    const inCar = !!world.player.car || !!world.player.bike;
    for (let i = strips.length - 1; i >= 0; i--) {
      const strip = strips[i];
      strip.age += dt;
      if (strip.age > 45) {
        if (world.scene) world.scene.remove(strip.mesh);
        strips.splice(i, 1);
        continue;
      }
      if (!inCar) continue;
      const dist = Math.hypot(pos.x - strip.position.x, pos.z - strip.position.z);
      if (dist < 4.5) {
        // Hit: speed is cut hard, a slow effect lingers, and the tires
        // take lasting damage until repaired at the garage or by waiting.
        const vehicle = world.player.car || world.player.bike;
        if (vehicle) vehicle.speed = (vehicle.speed || 0) * 0.35;
        world.player.speed = (world.player.speed || 0) * 0.35;
        world.player.slowTimer = SPIKE_SLOW_SECONDS;
        world.player.tireDamage = Math.min(1, (world.player.tireDamage || 0) + 0.35);
        world.events.push({ type: 'tire-damage', amount: 0.35 });
        if (world.scene) world.scene.remove(strip.mesh);
        strips.splice(i, 1);
      }
    }
  }

  function updateTireRecovery(dt) {
    // Waiting slowly wears the damage away; the garage (owned property)
    // repairs it instantly — that path lives in the properties system.
    if ((world.player.tireDamage || 0) > 0 && (world.player.speed || 0) < 1) {
      world.player.tireDamage = Math.max(0, world.player.tireDamage - dt * 0.01);
    }
    if ((world.player.slowTimer || 0) > 0) {
      world.player.slowTimer = Math.max(0, world.player.slowTimer - dt);
    }
  }

  function updateRoadblocks(dt) {
    roadblockCooldown = Math.max(0, roadblockCooldown - dt);
    const wanted = world.wanted || 0;
    const pos = playerPos();
    for (let i = roadblocks.length - 1; i >= 0; i--) {
      const block = roadblocks[i];
      block.age += dt;
      const dist = Math.hypot(pos.x - block.centre.x, pos.z - block.centre.z);
      if (dist > ROADBLOCK_CLEAR_DISTANCE || wanted < 3 || block.age > 90) {
        clearRoadblock(block);
      }
    }
    if (wanted >= 3 && roadblocks.length === 0 && roadblockCooldown <= 0) {
      deployRoadblock();
      roadblockCooldown = ROADBLOCK_COOLDOWN;
    }
  }

  function updateSpotlight(dt) {
    // The helicopter spotlight tracks the player. At night, being caught
    // in it while on foot raises wanted faster.
    const heli = world.systems.heli;
    const spotlightOn = !!(heli && heli.spotlightOn);
    const onFoot = !!world.player.onFoot;
    if (spotlightOn && isNight() && onFoot && (world.wanted || 0) > 0 && (world.wanted || 0) < 5) {
      spotlightHeat += dt;
      if (spotlightHeat >= 6) {
        world.wanted = Math.min(5, (world.wanted || 0) + 1);
        world.events.push({ type: 'crime', kind: 'spotted', wanted: world.wanted });
        spotlightHeat = 0;
      }
    } else {
      spotlightHeat = Math.max(0, spotlightHeat - dt * 2);
    }
  }

  function update(dt) {
    const wanted = world.wanted || 0;
    if (wanted <= 0) {
      for (let i = roadblocks.length - 1; i >= 0; i--) clearRoadblock(roadblocks[i]);
      for (const strip of strips) if (world.scene) world.scene.remove(strip.mesh);
      strips.length = 0;
      lastWanted = 0;
      return;
    }
    if (wanted >= 3 && lastWanted < 3) {
      // Fresh escalation: lay a strip ahead right away.
      deploySpikeStrip();
    }
    lastWanted = wanted;
    assignRoles(policeCars());
    updateRoadblocks(dt);
    updateSpikeStrips(dt);
    updateTireRecovery(dt);
    updateSpotlight(dt);
  }

  const api = {
    update,
    heliLeadTarget,
    deploySpikeStrip,
    deployRoadblock,
    // Called by the properties system when Rico repairs at his garage:
    // wipes tire damage instantly instead of waiting it out.
    repairTires() {
      world.player.tireDamage = 0;
      world.player.slowTimer = 0;
      world.events.push({ type: 'tires-repaired' });
    },
    clearRoadblocks() {
      for (let i = roadblocks.length - 1; i >= 0; i--) clearRoadblock(roadblocks[i]);
    },
    get roadblocks() { return roadblocks; },
    get strips() { return strips; },
  };
  world.systems.policeai = api;
  return api;
}
