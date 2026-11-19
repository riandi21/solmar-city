import * as THREE from 'three';

// Missions 17-20: the Casino Heist ($30,000 total).
// M17 casing, M18 the vault, M19 the harbor run, M20 the big score.
// Heist state lives on world.heist: { scouted: [], vaultCracked, lootAboard }.
// Factory: createMissions5(world) -> { startMission(id), update(dt) }.

const CASINO = { x: 116, z: 58 };
const MARINA_PIER = { x: 295, z: 168 };
const YACHT = { x: 305, z: 175 };
const AIRFIELD_PLANE = { x: 220, z: -180 };

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function nearPlayer(world, pos, radius) {
  if (!world.player || !world.player.position) return false;
  return dist2D(world.player.position, pos) <= radius;
}

function ensureHeist(world) {
  if (!world.heist) world.heist = { scouted: [], vaultCracked: false, lootAboard: false };
  if (!Array.isArray(world.heist.scouted)) world.heist.scouted = [];
  return world.heist;
}

export function createMissions5(world) {
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
      new THREE.MeshBasicMaterial({ color: 0xff5ad2, transparent: true, opacity: 0.55 })
    );
    ring.position.y = 0.2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 36, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff5ad2, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
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
      world.mission.objective = 'Heist job done. The next job is waiting.';
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
        new THREE.MeshStandardMaterial({ color: 0x111111 })
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
    ensureHeist(world);
    clearMarker();
    clearEnemies();
    stageData = {};
    world.mission.id = id;
    world.mission.stage = 0;
    world.mission.timer = 0;
    if (world.systems && world.systems.combat && typeof world.systems.combat.refillAmmo === 'function') {
      try { world.systems.combat.refillAmmo(); } catch (err) { /* optional */ }
    }
    switch (id) {
      case 17:
        stageData.points = [
          { x: 116, z: 29, name: 'front doors' },
          { x: 145, z: 58, name: 'side entrance' },
          { x: 116, z: 87, name: 'roof cameras' },
        ];
        stageData.scouted = 0;
        setObjective('Case the casino: scout the front doors. Stay quiet — wanted must stay at 1 star or less.', stageData.points[0]);
        break;
      case 18:
        spawnEnemies(3, CASINO, 18);
        world.mission.timer = 180;
        setObjective('The vault: dodge the guards, crack the vault, grab the cash. 180 seconds!', CASINO);
        break;
      case 19:
        world.wanted = Math.max(world.wanted || 0, 3);
        setObjective('Harbor run: get the loot to the yacht at the marina. Police boats are out there.', MARINA_PIER);
        break;
      case 20:
        world.wanted = 5;
        setObjective('The big score: drive to the airfield and escape by plane at 5 stars!', AIRFIELD_PLANE);
        break;
      default:
        return false;
    }
    return true;
  }

  function update(dt) {
    if (!world.mission || !world.mission.id) return;
    const id = world.mission.id;
    if (id < 17 || id > 20) return;
    const heist = ensureHeist(world);
    if (world.mission.timer > 0) {
      world.mission.timer -= dt;
      // The vault timer only matters while cracking it: once the cash is
      // grabbed (stage 2) the escape is untimed, so don't fail then.
      if (world.mission.timer <= 0 && id === 18 && world.mission.stage < 2) { fail('Out of time — the vault sealed itself.'); return; }
    }
    if (marker) marker.rotation.y += dt * 1.5;

    switch (id) {
      case 17: {
        if ((world.wanted || 0) > 1) { fail('You raised too much heat while casing the joint.'); return; }
        const point = stageData.points[stageData.scouted];
        if (point && nearPlayer(world, point, 8)) {
          heist.scouted.push(point.name);
          stageData.scouted += 1;
          if (stageData.scouted >= stageData.points.length) finish(3000);
          else setObjective(`Casing: scout the ${stageData.points[stageData.scouted].name}. Stay quiet.`, stageData.points[stageData.scouted]);
        }
        break;
      }
      case 18: {
        if (world.mission.stage === 0) {
          // Guards patrol the vault floor; getting past them means taking
          // them down, then the vault itself is the next marker.
          updateEnemies(dt, () => {
            world.mission.stage = 1;
            setObjective('Guards down. Crack the vault — reach the vault door.', { x: 122, z: 64 });
          });
        } else if (world.mission.stage === 1) {
          if (nearPlayer(world, { x: 122, z: 64 }, 6)) {
            heist.vaultCracked = true;
            world.mission.stage = 2;
            setObjective('Cash grabbed! Escape to the getaway car at the marina pier.', MARINA_PIER);
          }
        } else if (nearPlayer(world, MARINA_PIER, 9)) {
          finish(8000);
        }
        break;
      }
      case 19: {
        if (world.mission.stage === 0 && nearPlayer(world, MARINA_PIER, 9)) {
          world.mission.stage = 1;
          setObjective('Loot aboard the boat. Sail it to the yacht!', YACHT);
        } else if (world.mission.stage === 1 && nearPlayer(world, YACHT, 10)) {
          heist.lootAboard = true;
          finish(7000);
        }
        break;
      }
      case 20: {
        if (nearPlayer(world, AIRFIELD_PLANE, 9)) {
          world.wanted = 0;
          finish(12000);
        }
        break;
      }
      default:
        break;
    }
  }

  return { startMission, update };
}
