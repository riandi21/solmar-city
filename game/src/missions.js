import * as THREE from 'three';

// Missions 1-8: Rico's opening jobs and the first Dourado arc.
// Factory: createMissions(world) -> { startMission(id), update(dt) }.
// Mission state lives on world.mission; finished ids go to
// world.completedMissions; rewards land in world.player.cash.

const CORAL_CLUB = { x: 58, z: 29 };
const YACHT = { x: 295, z: 168 };
const SAFEHOUSE = { x: -174, z: 232 };
const ANCHOR_BAR = { x: 100, z: 60 };

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function nearPlayer(world, pos, radius) {
  if (!world.player || !world.player.position) return false;
  return dist2D(world.player.position, pos) <= radius;
}

function inVehicle(world) {
  if (!world.player) return false;
  return !!(world.player.currentCar || world.player.currentBike || world.player.car);
}

export function createMissions(world) {
  let marker = null;
  let enemies = [];
  let defeated = 0;
  let stageData = {};

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

  // Small shared marker helper: floating beacon (cylinder + light beam).
  function makeMarker(pos) {
    clearMarker();
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55 })
    );
    ring.position.y = 0.2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 36, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
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
    if (world.mission) {
      world.mission.id = 0;
      world.mission.stage = 0;
      world.mission.objective = 'No active mission. Visit a mission marker to start the next job.';
      world.mission.marker = null;
      world.mission.timer = 0;
    }
    stageData = {};
  }

  function fail(reason) {
    clearMarker();
    clearEnemies();
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
        new THREE.MeshStandardMaterial({ color: 0x8a1f1f })
      );
      body.position.y = 0.85;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9a066 })
      );
      head.position.y = 1.95;
      g.add(body);
      g.add(head);
      const px = center.x + (world.rng ? (world.rng() - 0.5) * spread : (i - count / 2) * 4);
      const pz = center.z + (world.rng ? (world.rng() - 0.5) * spread : (i % 2) * 5);
      g.position.set(px, 0, pz);
      if (world.scene) world.scene.add(g);
      enemies.push({ mesh: g, pos: g.position, hp: 3, dwell: 0 });
    }
  }

  // Close-quarters takedown: stand next to a guard briefly to beat him
  // down. Also honours combat kill events if the combat system reports them.
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
      // Guards shuffle toward Rico when he is close.
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
    stageData = {};
    world.mission.id = id;
    world.mission.stage = 0;
    world.mission.timer = 0;
    if (world.systems && world.systems.combat && typeof world.systems.combat.refillAmmo === 'function') {
      try { world.systems.combat.refillAmmo(); } catch (err) { /* ammo refill is optional */ }
    }
    switch (id) {
      case 1:
        setObjective('Steal a car (press E near one), then drive to the Coral Club.', CORAL_CLUB);
        break;
      case 2:
        stageData.stops = [{ x: 58, z: 116 }, { x: -58, z: -58 }, { x: 116, z: 174 }];
        stageData.stopIndex = 0;
        world.mission.timer = 150;
        setObjective('Deliver package 1 of 3 — 150 seconds on the clock.', stageData.stops[0]);
        break;
      case 3:
        world.wanted = 3;
        world.mission.timer = 60;
        setObjective('Survive a 3-star wanted level for 60 seconds. Keep moving!', null);
        break;
      case 4:
        stageData.crew = [{ x: SAFEHOUSE.x, z: SAFEHOUSE.z, got: false }, { x: ANCHOR_BAR.x, z: ANCHOR_BAR.z, got: false }];
        stageData.picked = 0;
        setObjective('Pick up your crew: first at the safehouse.', stageData.crew[0]);
        break;
      case 5:
        setObjective('Dourado job: pick up the crew at the Anchor Bar, then drive to the Coral Club.', ANCHOR_BAR);
        break;
      case 6:
        stageData.stops = [{ x: -116, z: 58 }, { x: 174, z: -116 }];
        stageData.stopIndex = 0;
        world.mission.timer = 120;
        setObjective('Dourado delivery: drop 1 of 2 — 120 seconds.', stageData.stops[0]);
        break;
      case 7:
        spawnEnemies(3, { x: -170, z: -200 }, 18);
        setObjective('Dourado ambush: take down all 3 guards at the freight yard.', { x: -170, z: -200 });
        break;
      case 8:
        spawnEnemies(2, CORAL_CLUB, 12);
        setObjective('Finale: clear the Coral Club entrance, then reach the penthouse marker.', CORAL_CLUB);
        break;
      default:
        return false;
    }
    return true;
  }

  function update(dt) {
    if (!world.mission || !world.mission.id) return;
    const id = world.mission.id;
    if (id < 1 || id > 8) return;
    if (world.mission.timer > 0) {
      world.mission.timer -= dt;
      if (world.mission.timer <= 0) {
        if (id === 2 || id === 6) { fail('Out of time.'); return; }
      }
    }
    if (marker) marker.rotation.y += dt * 1.5;

    switch (id) {
      case 1: {
        if (world.mission.stage === 0 && inVehicle(world)) {
          world.mission.stage = 1;
          setObjective('Drive to the Coral Club marker.', CORAL_CLUB);
        }
        if (world.mission.stage === 1 && inVehicle(world) && nearPlayer(world, CORAL_CLUB, 9)) {
          finish(500);
        }
        break;
      }
      case 2: {
        const stop = stageData.stops[stageData.stopIndex];
        if (stop && nearPlayer(world, stop, 8)) {
          stageData.stopIndex += 1;
          if (stageData.stopIndex >= stageData.stops.length) finish(800);
          else setObjective(`Deliver package ${stageData.stopIndex + 1} of 3.`, stageData.stops[stageData.stopIndex]);
        }
        break;
      }
      case 3: {
        if (world.mode === 'busted') { fail('Busted by the police.'); break; }
        if (world.mission.timer <= 0) {
          world.wanted = 0;
          finish(1200);
        }
        break;
      }
      case 4: {
        if (world.mission.stage === 0) {
          const next = stageData.crew.find((c) => !c.got);
          if (next && nearPlayer(world, next, 7)) {
            next.got = true;
            stageData.picked += 1;
            if (stageData.picked >= 2) {
              world.mission.stage = 1;
              setObjective('Crew aboard! Drive the yacht at the marina.', YACHT);
            } else {
              const other = stageData.crew.find((c) => !c.got);
              setObjective('One more crew member to pick up.', other);
            }
          }
        } else if (world.mission.stage === 1) {
          if (nearPlayer(world, YACHT, 10)) {
            world.mission.stage = 2;
            setObjective('Escape! Lose the heat — get to the boardwalk.', { x: 0, z: 264 });
          }
        } else if (nearPlayer(world, { x: 0, z: 264 }, 10)) {
          finish(2500);
        }
        break;
      }
      case 5: {
        if (world.mission.stage === 0 && nearPlayer(world, ANCHOR_BAR, 7)) {
          world.mission.stage = 1;
          setObjective('Crew picked up. Drive to the Coral Club.', CORAL_CLUB);
        } else if (world.mission.stage === 1 && nearPlayer(world, CORAL_CLUB, 9)) {
          finish(2000);
        }
        break;
      }
      case 6: {
        const stop = stageData.stops[stageData.stopIndex];
        if (stop && nearPlayer(world, stop, 8)) {
          stageData.stopIndex += 1;
          if (stageData.stopIndex >= stageData.stops.length) finish(3000);
          else setObjective('Dourado delivery: drop 2 of 2.', stageData.stops[stageData.stopIndex]);
        }
        break;
      }
      case 7: {
        updateEnemies(dt, () => finish(4000));
        break;
      }
      case 8: {
        if (world.mission.stage === 0) {
          updateEnemies(dt, () => {
            world.mission.stage = 1;
            setObjective('Entrance clear. Reach the penthouse marker at the Coral Club.', { x: 29, z: 29 });
          });
        } else if (nearPlayer(world, { x: 29, z: 29 }, 8)) {
          finish(5000);
        }
        break;
      }
      default:
        break;
    }
  }

  return { startMission, update };
}
