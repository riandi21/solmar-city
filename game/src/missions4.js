import * as THREE from 'three';

// Missions 13-16: the Airport Job ($25,000 total).
// M13 hangar break-in, M14 runway chase, M15 cargo loading, M16 escape by plane.
// Factory: createMissions4(world) -> { startMission(id), update(dt) }.

const AIRFIELD = { x: 200, z: -200 };
const HANGAR = { x: 174, z: -203 };
const RUNWAY_END = { x: 232, z: -232 };
const PLANE = { x: 220, z: -180 };

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function nearPlayer(world, pos, radius) {
  if (!world.player || !world.player.position) return false;
  return dist2D(world.player.position, pos) <= radius;
}

export function createMissions4(world) {
  let marker = null;
  let enemies = [];
  let defeated = 0;
  let stageData = {};
  let chaseCar = null;

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

  function clearChase() {
    if (chaseCar) {
      if (chaseCar.mesh && world.scene) world.scene.remove(chaseCar.mesh);
      if (world.cars) {
        const i = world.cars.indexOf(chaseCar);
        if (i >= 0) world.cars.splice(i, 1);
      }
      chaseCar = null;
    }
  }

  // Small shared marker helper: floating beacon (cylinder + light beam).
  function makeMarker(pos) {
    clearMarker();
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0x7dff5a, transparent: true, opacity: 0.55 })
    );
    ring.position.y = 0.2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 36, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7dff5a, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
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
    clearChase();
    if (world.mission) {
      world.mission.id = 0;
      world.mission.stage = 0;
      world.mission.objective = 'Airport job done. The next job is waiting.';
      world.mission.marker = null;
      world.mission.timer = 0;
    }
    stageData = {};
  }

  function fail(reason) {
    clearMarker();
    clearEnemies();
    clearChase();
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

  function spawnEnemies(count, center, spread) {
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
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a })
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
        e.pos.x += (dx / len) * dt * 2.2;
        e.pos.z += (dz / len) * dt * 2.2;
      }
    }
    if (defeated >= enemies.length && enemies.length > 0) onAllDown();
  }

  function startMission(id) {
    if (!world.mission) world.mission = {};
    clearMarker();
    clearEnemies();
    clearChase();
    stageData = {};
    world.mission.id = id;
    world.mission.stage = 0;
    world.mission.timer = 0;
    if (world.systems && world.systems.combat && typeof world.systems.combat.refillAmmo === 'function') {
      try { world.systems.combat.refillAmmo(); } catch (err) { /* optional */ }
    }
    switch (id) {
      case 13:
        spawnEnemies(2, HANGAR, 12);
        setObjective('Break into the hangar: take down the 2 guards, then grab the cargo.', HANGAR);
        break;
      case 14: {
        const mesh = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(2, 0.7, 4.4),
          new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        body.position.y = 0.7;
        mesh.add(body);
        mesh.position.set(116, 0, -232);
        if (world.scene) world.scene.add(mesh);
        chaseCar = { mesh, position: mesh.position, heading: 0, speed: 0, color: 0x222222, kind: 'flee', maxSpeed: 11, driver: 'rival', hp: 3 };
        if (world.cars) world.cars.push(chaseCar);
        stageData.hits = 0;
        setObjective('Runway chase: ram the black getaway car to a halt before it reaches the runway end.', { x: 116, z: -232 });
        break;
      }
      case 15:
        stageData.stops = [{ x: 174, z: -174 }, { x: 203, z: -203 }, { x: 174, z: -232 }];
        stageData.stopIndex = 0;
        world.mission.timer = 120;
        setObjective('Load the cargo plane: 3 crates in 120 seconds.', stageData.stops[0]);
        break;
      case 16:
        world.wanted = 5;
        setObjective('Finale: 5 stars on you. Reach the cargo plane and get out of Solmar!', PLANE);
        break;
      default:
        return false;
    }
    return true;
  }

  function update(dt) {
    if (!world.mission || !world.mission.id) return;
    const id = world.mission.id;
    if (id < 13 || id > 16) return;
    if (world.mission.timer > 0) {
      world.mission.timer -= dt;
      if (world.mission.timer <= 0 && id === 15) { fail('Out of time.'); return; }
    }
    if (marker) marker.rotation.y += dt * 1.5;

    switch (id) {
      case 13: {
        if (world.mission.stage === 0) {
          updateEnemies(dt, () => {
            world.mission.stage = 1;
            setObjective('Guards down. Grab the cargo inside the hangar.', { x: 180, z: -210 });
          });
        } else if (nearPlayer(world, { x: 180, z: -210 }, 6)) {
          finish(5000);
        }
        break;
      }
      case 14: {
        if (!chaseCar) { fail('The getaway car is gone.'); return; }
        // The flee car runs east along the runway toward the far end.
        chaseCar.position.x += dt * 11;
        chaseCar.position.z += Math.sin((world.elapsed || 0) * 0.5) * dt * 0.5;
        chaseCar.mesh.rotation.y = Math.PI / 2;
        const chasePos = { x: chaseCar.position.x, z: chaseCar.position.z };
        if (world.mission) world.mission.marker = new THREE.Vector3(chasePos.x, 0, chasePos.z);
        if (marker) marker.position.set(chasePos.x, 0, chasePos.z);
        const playerSpeed = world.player
          ? ((world.player.currentCar && world.player.currentCar.speed) || (world.player.currentBike && world.player.currentBike.speed) || world.player.speed || 0)
          : 0;
        if (world.player && world.player.position && dist2D(world.player.position, chasePos) < 5.5 && playerSpeed > 4) {
          stageData.hitCooldown = (stageData.hitCooldown || 0) - dt;
          if ((stageData.hitCooldown || 0) <= 0) {
            stageData.hits = (stageData.hits || 0) + 1;
            stageData.hitCooldown = 1;
            if (world.events) world.events.push({ type: 'ramHit', target: 'fleeCar' });
          }
        } else {
          stageData.hitCooldown = (stageData.hitCooldown || 0) - dt;
        }
        if ((stageData.hits || 0) >= 3) finish(6000);
        else if (chaseCar.position.x >= RUNWAY_END.x) fail('The getaway car reached the runway end.');
        break;
      }
      case 15: {
        const stop = stageData.stops[stageData.stopIndex];
        if (stop && nearPlayer(world, stop, 8)) {
          stageData.stopIndex += 1;
          if (stageData.stopIndex >= stageData.stops.length) finish(6000);
          else setObjective(`Load the plane: crate ${stageData.stopIndex + 1} of 3.`, stageData.stops[stageData.stopIndex]);
        }
        break;
      }
      case 16: {
        if (nearPlayer(world, PLANE, 9)) {
          world.wanted = 0;
          finish(8000);
        }
        break;
      }
      default:
        break;
    }
  }

  return { startMission, update };
}
