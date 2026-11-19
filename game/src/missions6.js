import * as THREE from 'three';

// Missions 21-24: the Dourado Revenge ($35,000 total). NEW in v5.
// M21 tail the courier, M22 raid the warehouse, M23 ambush the convoy,
// M24 storm the Don's penthouse and escape by helicopter.
// Revenge state lives on world.revenge:
//   { courierTailed, ledgerStolen, convoyStopped, donDefeated }.
// Factory: createMissions6(world) -> { startMission(id), update(dt) }.

const CORAL_CLUB = { x: 58, z: 29 };
const PENTHOUSE = { x: 29, z: 29 };
const WAREHOUSE = { x: -185, z: -245 };
const LEDGER_OFFICE = { x: -200, z: -255 };
const DOCKS = { x: -215, z: -215 };
const AIRFIELD = { x: 200, z: -200 };
const RING_ROAD = { x: 0, z: -232 };

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function nearPlayer(world, pos, radius) {
  if (!world.player || !world.player.position) return false;
  return dist2D(world.player.position, pos) <= radius;
}

function ensureRevenge(world) {
  if (!world.revenge) world.revenge = { courierTailed: false, ledgerStolen: false, convoyStopped: 0, donDefeated: false };
  return world.revenge;
}

export function createMissions6(world) {
  let marker = null;
  let enemies = [];
  let defeated = 0;
  let stageData = {};
  let courierCar = null;
  let convoy = [];

  function clearMarker() {
    if (marker && world.scene) world.scene.remove(marker);
    marker = null;
  }

  function clearEnemies() {
    for (const e of enemies) {
      if (e.mesh && world.scene) world.scene.remove(e.mesh);
    }
    enemies = [];
    defeated = 0;
  }

  function clearCourier() {
    if (courierCar) {
      if (courierCar.mesh && world.scene) world.scene.remove(courierCar.mesh);
      if (world.cars) {
        const i = world.cars.indexOf(courierCar);
        if (i >= 0) world.cars.splice(i, 1);
      }
      courierCar = null;
    }
  }

  function clearConvoy() {
    for (const t of convoy) {
      if (t.mesh && world.scene) world.scene.remove(t.mesh);
      if (world.cars) {
        const i = world.cars.indexOf(t);
        if (i >= 0) world.cars.splice(i, 1);
      }
    }
    convoy = [];
  }

  // Small shared marker helper: floating beacon (cylinder + light beam).
  function makeMarker(pos) {
    clearMarker();
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xff3f2e, transparent: true, opacity: 0.55 })
    );
    ring.position.y = 0.2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 36, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff3f2e, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    beam.position.y = 18;
    group.add(ring);
    group.add(beam);
    group.position.set(pos.x, 0, pos.z);
    if (world.scene) world.scene.add(group);
    marker = group;
    return group;
  }

  function setObjective(text, markerPos) {
    if (!world.mission) world.mission = {};
    world.mission.objective = text;
    world.mission.marker = markerPos ? new THREE.Vector3(markerPos.x, 0, markerPos.z) : null;
    if (markerPos) makeMarker(markerPos);
    else clearMarker();
  }

  function finish(reward) {
    const id = world.mission ? world.mission.id : 0;
    if (world.player) world.player.cash = (world.player.cash || 0) + reward;
    if (world.completedMissions && !world.completedMissions.includes(id)) {
      world.completedMissions.push(id);
    }
    if (world.events) world.events.push({ type: 'missionComplete', id, reward });
    clearMarker();
    clearEnemies();
    clearCourier();
    clearConvoy();
    if (world.mission) {
      world.mission.id = 0;
      world.mission.stage = 0;
      world.mission.objective = 'Revenge job done. The Dourado story moves on.';
      world.mission.marker = null;
      world.mission.timer = 0;
    }
    stageData = {};
  }

  function fail(reason) {
    clearMarker();
    clearEnemies();
    clearCourier();
    clearConvoy();
    if (world.events) world.events.push({ type: 'missionFailed', id: world.mission ? world.mission.id : 0, reason });
    if (world.mission) {
      world.mission.id = 0;
      world.mission.stage = 0;
      world.mission.objective = reason + ' Mission failed — try again.';
      world.mission.marker = null;
      world.mission.timer = 0;
    }
    stageData = {};
  }

  function makeCarMesh(color, isTruck) {
    const g = new THREE.Group();
    const w = isTruck ? 2.4 : 2;
    const l = isTruck ? 7 : 4.4;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, isTruck ? 1.6 : 0.7, l),
      new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = isTruck ? 1.2 : 0.7;
    g.add(body);
    if (!isTruck) {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.6, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x222831 })
      );
      cabin.position.y = 1.3;
      g.add(cabin);
    }
    return g;
  }

  function spawnEnemies(count, center, spread, elite) {
    clearEnemies();
    if (world.systems && world.systems.combat && typeof world.systems.combat.spawnGangSquad === 'function') {
      try {
        const squad = world.systems.combat.spawnGangSquad(center, count) || [];
        enemies = squad.map((m) => ({ mesh: m, pos: m.position || center, hp: 3, dwell: 0 }));
        return;
      } catch (err) { /* fall through to simple markers */ }
    }
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.7, 0.5),
        new THREE.MeshStandardMaterial({ color: elite ? 0x111111 : 0x6a1a1a })
      );
      body.position.y = 0.85;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9a066 })
      );
      head.position.y = 1.95;
      g.add(body);
      g.add(head);
      const px = center.x + (i - count / 2) * 4;
      const pz = center.z + (i % 2) * 6;
      g.position.set(px, 0, pz);
      if (world.scene) world.scene.add(g);
      enemies.push({ mesh: g, pos: g.position, hp: 3, dwell: 0 });
    }
  }

  function updateEnemies(dt, onAllDown) {
    if (!enemies.length) return;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      // Combat-backed guard shot dead: the shooter's live health is the
      // source of truth — gunfire counts as a takedown just like the melee
      // dwell below (combat already removed the shooter's mesh).
      if (e.mesh && typeof e.mesh.health === 'number' && e.mesh.health <= 0) {
        e.hp = 0;
        defeated += 1;
        if (world.events) world.events.push({ type: 'enemyDown' });
        continue;
      }
      const d = world.player && world.player.position ? dist2D(world.player.position, e.pos) : 999;
      if (d < 4) {
        e.dwell += dt;
        if (e.dwell > 1.2) {
          e.hp = 0;
          defeated += 1;
          if (e.mesh && world.scene) world.scene.remove(e.mesh);
          if (world.events) world.events.push({ type: 'enemyDown' });
        }
      } else {
        e.dwell = 0;
      }
      if (d < 30 && d > 3 && e.mesh) {
        const dx = world.player.position.x - e.pos.x;
        const dz = world.player.position.z - e.pos.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        e.pos.x += (dx / len) * dt * 2.4;
        e.pos.z += (dz / len) * dt * 2.4;
      }
    }
    if (defeated >= enemies.length && enemies.length > 0) onAllDown();
  }

  function startMission(id) {
    if (!world.mission) world.mission = {};
    ensureRevenge(world);
    clearMarker();
    clearEnemies();
    clearCourier();
    clearConvoy();
    stageData = {};
    world.mission.id = id;
    world.mission.stage = 0;
    world.mission.timer = 0;
    if (world.systems && world.systems.combat && typeof world.systems.combat.refillAmmo === 'function') {
      try { world.systems.combat.refillAmmo(); } catch (err) { /* optional */ }
    }
    switch (id) {
      case 21: {
        const mesh = makeCarMesh(0x7a1010, false);
        mesh.position.set(-58, 0, 116);
        if (world.scene) world.scene.add(mesh);
        courierCar = { mesh, position: mesh.position, heading: 0, speed: 0, color: 0x7a1010, kind: 'courier', maxSpeed: 8, driver: 'dourado' };
        if (world.cars) world.cars.push(courierCar);
        stageData.route = [
          { x: -58, z: 58 }, { x: -58, z: 0 }, { x: 0, z: 0 },
          { x: 58, z: 0 }, { x: 116, z: 0 }, { x: 116, z: 58 },
          { x: 116, z: 116 }, { x: 58, z: 116 }, { x: -58, z: 116 },
        ];
        stageData.wp = 0;
        stageData.tailTime = 0;
        stageData.tooCloseTime = 0;
        stageData.tooFarTime = 0;
        setObjective('Tail the Dourado courier: stay 15-60 m behind him. Never get spotted, never raise wanted.', { x: -58, z: 116 });
        break;
      }
      case 22:
        spawnEnemies(4, WAREHOUSE, 20);
        setObjective('Raid the warehouse: take down all 4 guards, then steal the ledger from the office.', WAREHOUSE);
        break;
      case 23: {
        // Three trucks roll east along the northern ring road toward the airfield.
        for (let i = 0; i < 3; i++) {
          const mesh = makeCarMesh(0x5a4a2a, true);
          mesh.position.set(-232 + i * -14, 0, -232);
          if (world.scene) world.scene.add(mesh);
          const truck = { mesh, position: mesh.position, heading: Math.PI / 2, speed: 7, color: 0x5a4a2a, kind: 'convoyTruck', maxSpeed: 7, driver: 'dourado', hp: 3, stopped: false, hitCooldown: 0 };
          convoy.push(truck);
          if (world.cars) world.cars.push(truck);
        }
        stageData.stopped = 0;
        setObjective('Ambush the convoy: stop all 3 trucks before the lead truck reaches the airfield.', RING_ROAD);
        break;
      }
      case 24:
        spawnEnemies(5, PENTHOUSE, 16, true);
        setObjective("Storm the penthouse: defeat the Don's elite squad of 5, then escape by helicopter from the rooftop.", PENTHOUSE);
        break;
      default:
        return false;
    }
    return true;
  }

  function update(dt) {
    if (!world.mission || !world.mission.id) return;
    const id = world.mission.id;
    if (id < 21 || id > 24) return;
    const revenge = ensureRevenge(world);
    if (marker) marker.rotation.y += dt * 1.5;

    switch (id) {
      case 21: {
        if (!courierCar) { fail('The courier is gone.'); return; }
        const target = stageData.route[stageData.wp];
        const d = dist2D(courierCar.position, target);
        if (d > 2) {
          const dx = target.x - courierCar.position.x;
          const dz = target.z - courierCar.position.z;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          courierCar.position.x += (dx / len) * dt * 8;
          courierCar.position.z += (dz / len) * dt * 8;
          courierCar.heading = Math.atan2(dx, dz);
          courierCar.mesh.rotation.y = courierCar.heading;
        } else {
          stageData.wp = (stageData.wp + 1) % stageData.route.length;
        }
        const courierPos = { x: courierCar.position.x, z: courierCar.position.z };
        if (world.mission) world.mission.marker = new THREE.Vector3(courierPos.x, 0, courierPos.z);
        if (marker) marker.position.set(courierPos.x, 0, courierPos.z);
        if ((world.wanted || 0) > 0) { fail('You raised wanted — the courier made you.'); return; }
        const playerDist = world.player && world.player.position ? dist2D(world.player.position, courierPos) : 999;
        if (playerDist < 15) {
          stageData.tooCloseTime += dt;
          if (stageData.tooCloseTime > 5) { fail('Spotted! The courier saw you up close.'); return; }
        } else {
          stageData.tooCloseTime = 0;
        }
        if (playerDist > 60) {
          stageData.tooFarTime += dt;
          if (stageData.tooFarTime > 8) { fail('You lost the courier.'); return; }
        } else {
          stageData.tooFarTime = 0;
        }
        if (playerDist >= 15 && playerDist <= 60) {
          stageData.tailTime += dt;
          if (stageData.tailTime >= 45) {
            revenge.courierTailed = true;
            finish(4000);
          }
        } else if (playerDist < 15) {
          // Being spotted isn't instant, but hovering too close also
          // erodes the tail progress — Rico has to back off and re-settle.
          stageData.tailTime = Math.max(0, stageData.tailTime - dt * 2);
        }
        break;
      }
      case 22: {
        if (world.mission.stage === 0) {
          updateEnemies(dt, () => {
            world.mission.stage = 1;
            setObjective('Guards down. Steal the ledger from the warehouse office.', LEDGER_OFFICE);
          });
        } else if (world.mission.stage === 1) {
          // The office point sits inside the warehouse collider, so the
          // collision push-out leaves the player ~9 m away at the door;
          // the pickup radius has to cover that stand-off (10 m).
          if (nearPlayer(world, LEDGER_OFFICE, 10)) {
            revenge.ledgerStolen = true;
            world.mission.stage = 2;
            // Escape on a bike through the Docks if a bike is nearby;
            // otherwise the Docks marker itself is the escape point.
            const bike = (world.bikes || []).find((b) => b.position && world.player && world.player.position && dist2D(b.position, world.player.position) < 40);
            if (bike && !world.player.currentBike) {
              setObjective('Ledger stolen! Grab the getaway bike, then ride through the Docks.', { x: bike.position.x, z: bike.position.z });
              stageData.bikePos = { x: bike.position.x, z: bike.position.z };
            } else {
              setObjective('Ledger stolen! Escape on a bike through the Docks.', DOCKS);
            }
          }
        } else if (world.mission.stage === 2) {
          if (stageData.bikePos && !world.player.currentBike && nearPlayer(world, stageData.bikePos, 6)) {
            // Player reached the bike; now the Docks are the escape.
            stageData.bikePos = null;
            setObjective('Now ride through the Docks to lose them.', DOCKS);
          } else if (!stageData.bikePos && nearPlayer(world, DOCKS, 10)) {
            finish(9000);
          }
        }
        break;
      }
      case 23: {
        let leadReached = false;
        for (const truck of convoy) {
          if (truck.stopped) continue;
          truck.position.x += dt * truck.speed;
          truck.mesh.rotation.y = Math.PI / 2;
          truck.hitCooldown -= dt;
          const playerSpeed = world.player ? (world.player.speed || 0) : 0;
          if (world.player && world.player.position && dist2D(world.player.position, truck.position) < 6 && playerSpeed > 4 && truck.hitCooldown <= 0) {
            truck.hp -= 1;
            truck.hitCooldown = 1;
            truck.speed = Math.max(2, truck.speed - 2);
            if (world.events) world.events.push({ type: 'ramHit', target: 'convoyTruck' });
            if (truck.hp <= 0) {
              truck.stopped = true;
              truck.speed = 0;
              stageData.stopped += 1;
              revenge.convoyStopped = stageData.stopped;
              if (world.events) world.events.push({ type: 'truckStopped', stopped: stageData.stopped });
            }
          }
          if (truck.position.x >= AIRFIELD.x - 10) leadReached = true;
        }
        if (stageData.stopped >= 3) finish(8000);
        else if (leadReached) fail('The lead truck reached the airfield.');
        break;
      }
      case 24: {
        if (world.mission.stage === 0) {
          updateEnemies(dt, () => {
            revenge.donDefeated = true;
            world.mission.stage = 1;
            world.wanted = 5;
            setObjective("The Don is down! Escape by helicopter from the Coral Club rooftop — 5 stars on you!", CORAL_CLUB);
          });
        } else if (nearPlayer(world, CORAL_CLUB, 9)) {
          world.wanted = 0;
          if (world.events) world.events.push({ type: 'storyComplete', arc: 'douradoRevenge' });
          finish(14000);
        }
        break;
      }
      default:
        break;
    }
  }

  return { startMission, update };
}
