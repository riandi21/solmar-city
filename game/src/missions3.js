import * as THREE from 'three';

// Missions 9-12: the Harbor War ($20,000 total).
// M9 escort, M10 timed delivery, M11 takedown, M12 lighthouse finale.
// Factory: createMissions3(world) -> { startMission(id), update(dt) }.

const LIGHTHOUSE = { x: -270, z: 300 };
const MARINA = { x: 295, z: 168 };
const FREIGHT_YARD = { x: -170, z: -230 };

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function nearPlayer(world, pos, radius) {
  if (!world.player || !world.player.position) return false;
  return dist2D(world.player.position, pos) <= radius;
}

export function createMissions3(world) {
  let marker = null;
  let enemies = [];
  let defeated = 0;
  let stageData = {};
  let escortCar = null;

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

  function clearEscort() {
    if (escortCar) {
      if (escortCar.mesh && world.scene) world.scene.remove(escortCar.mesh);
      if (world.cars) {
        const i = world.cars.indexOf(escortCar);
        if (i >= 0) world.cars.splice(i, 1);
      }
      escortCar = null;
    }
  }

  // Small shared marker helper: floating beacon (cylinder + light beam).
  function makeMarker(pos) {
    clearMarker();
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0x3fd2ff, transparent: true, opacity: 0.55 })
    );
    ring.position.y = 0.2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 36, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x3fd2ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
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
    clearEscort();
    if (world.mission) {
      world.mission.id = 0;
      world.mission.stage = 0;
      world.mission.objective = 'Harbor War job done. The next job is waiting.';
      world.mission.marker = null;
      world.mission.timer = 0;
    }
    stageData = {};
  }

  function fail(reason) {
    clearMarker();
    clearEnemies();
    clearEscort();
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
        new THREE.MeshStandardMaterial({ color: 0x1f4d8a })
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

  function spawnEscortCar() {
    clearEscort();
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.7, 4.4),
      new THREE.MeshStandardMaterial({ color: 0xe8c33a })
    );
    body.position.y = 0.7;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x222831 })
    );
    cabin.position.y = 1.3;
    mesh.add(body);
    mesh.add(cabin);
    mesh.position.set(MARINA.x, 0, MARINA.z);
    if (world.scene) world.scene.add(mesh);
    escortCar = { mesh, position: mesh.position, heading: 0, speed: 0, color: 0xe8c33a, kind: 'escort', maxSpeed: 9, driver: 'crew' };
    if (world.cars) world.cars.push(escortCar);
    return escortCar;
  }

  function startMission(id) {
    if (!world.mission) world.mission = {};
    clearMarker();
    clearEnemies();
    clearEscort();
    stageData = {};
    world.mission.id = id;
    world.mission.stage = 0;
    world.mission.timer = 0;
    if (world.systems && world.systems.combat && typeof world.systems.combat.refillAmmo === 'function') {
      try { world.systems.combat.refillAmmo(); } catch (err) { /* optional */ }
    }
    switch (id) {
      case 9:
        spawnEscortCar();
        stageData.route = [{ x: 232, z: 174 }, { x: 58, z: 232 }, { x: -116, z: 232 }, { x: -232, z: 232 }, LIGHTHOUSE];
        stageData.wp = 0;
        setObjective('Escort the crew car to the lighthouse. Stay within 40 m of it.', MARINA);
        break;
      case 10:
        stageData.stops = [{ x: 0, z: 264 }, { x: -203, z: -29 }, { x: 305, z: 175 }];
        stageData.stopIndex = 0;
        world.mission.timer = 120;
        setObjective('Harbor delivery: 3 drops in 120 seconds. First stop: the boardwalk pier.', stageData.stops[0]);
        break;
      case 11:
        spawnEnemies(3, FREIGHT_YARD, 18);
        setObjective('Takedown: clear all 3 harbor gang shooters at the freight yard.', FREIGHT_YARD);
        break;
      case 12:
        spawnEnemies(2, LIGHTHOUSE, 14);
        setObjective('Finale: fight through to the lighthouse and hold the point.', LIGHTHOUSE);
        break;
      default:
        return false;
    }
    return true;
  }

  function update(dt) {
    if (!world.mission || !world.mission.id) return;
    const id = world.mission.id;
    if (id < 9 || id > 12) return;
    if (world.mission.timer > 0) {
      world.mission.timer -= dt;
      if (world.mission.timer <= 0 && id === 10) { fail('Out of time.'); return; }
    }
    if (marker) marker.rotation.y += dt * 1.5;

    switch (id) {
      case 9: {
        if (!escortCar) { fail('The escort car is gone.'); return; }
        const target = stageData.route[stageData.wp];
        const d = dist2D(escortCar.position, target);
        if (d > 2) {
          const dx = target.x - escortCar.position.x;
          const dz = target.z - escortCar.position.z;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          escortCar.position.x += (dx / len) * dt * 9;
          escortCar.position.z += (dz / len) * dt * 9;
          escortCar.heading = Math.atan2(dx, dz);
          escortCar.mesh.rotation.y = escortCar.heading;
        } else if (stageData.wp < stageData.route.length - 1) {
          stageData.wp += 1;
        }
        const escortPos = { x: escortCar.position.x, z: escortCar.position.z };
        if (world.mission) world.mission.marker = new THREE.Vector3(escortPos.x, 0, escortPos.z);
        if (marker) marker.position.set(escortPos.x, 0, escortPos.z);
        const playerDist = world.player && world.player.position ? dist2D(world.player.position, escortPos) : 999;
        if (playerDist > 40) {
          stageData.farTime = (stageData.farTime || 0) + dt;
          if (stageData.farTime > 10) { fail('You lost the escort car.'); return; }
        } else {
          stageData.farTime = 0;
        }
        if (stageData.wp >= stageData.route.length - 1 && dist2D(escortCar.position, LIGHTHOUSE) < 6) {
          if (playerDist <= 40) finish(4000);
          else fail('You lost the escort car.');
        }
        break;
      }
      case 10: {
        const stop = stageData.stops[stageData.stopIndex];
        if (stop && nearPlayer(world, stop, 8)) {
          stageData.stopIndex += 1;
          if (stageData.stopIndex >= stageData.stops.length) finish(4000);
          else setObjective(`Harbor delivery: drop ${stageData.stopIndex + 1} of 3.`, stageData.stops[stageData.stopIndex]);
        }
        break;
      }
      case 11: {
        updateEnemies(dt, () => finish(5000));
        break;
      }
      case 12: {
        if (world.mission.stage === 0) {
          updateEnemies(dt, () => {
            world.mission.stage = 1;
            world.mission.timer = 20;
            setObjective('Point cleared! Hold the lighthouse for 20 seconds.', LIGHTHOUSE);
          });
        } else if (world.mission.timer <= 0) {
          finish(7000);
        } else if (!nearPlayer(world, LIGHTHOUSE, 15)) {
          // Give Rico a short grace period to step out and come back
          // before the hold timer resets — a hard instant reset felt unfair.
          stageData.outTime = (stageData.outTime || 0) + dt;
          if (stageData.outTime > 3) {
            world.mission.timer = 20;
            stageData.outTime = 0;
            setObjective('Hold the lighthouse — get back inside the circle!', LIGHTHOUSE);
          }
        } else {
          stageData.outTime = 0;
        }
        break;
      }
      default:
        break;
    }
  }

  return { startMission, update };
}
