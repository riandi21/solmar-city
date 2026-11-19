// The screenshot scenes behind ?shot=chase|drive|foot|mission. Each one plays the
// real game forward from a fixed seed for a few seconds, steered by scripted
// inputs (drive along a road, flee the police, race the Old Town Loop, head
// for a midnight drop), so the frame is what a short game really looks like
// and the same seed always gives the same frame. Every system call is
// guarded: if a system is missing the scene still stages with plain
// positions, and main.js paints the result twice and sets window.__shotReady.
//
// v3 staging — every shot shows new content:
//   chase   — a dusk police chase: 4 stars, the helicopter, and a spike
//             strip laid across the road ahead.
//   drive   — the Old Town Loop street race: the start gantry on the
//             quarter's edge, checkpoint rings, townhouses and cathedral.
//   foot    — midnight at the lighthouse: Rico on foot on the beach, the
//             rotating beam sweeping the coast, lamps lit, stars out.
//   mission — mission 10, Midnight Delivery: four glowing harbour rings
//             against the night, the clock reading past midnight.
import * as THREE from 'three';

const STEP = 1 / 60;
const DRIVE_SECONDS = 7;
const CHASE_SECONDS = 6;
const MISSION_SECONDS = 5;

/** Where the camera and the steering should look: the car when Rico drives,
 * Rico himself when he is on foot. (player.js keeps world.player.pos glued
 * to the car while driving, so it is the honest focus either way.) */
function focusPos(world) {
  if (world.player && world.player.car && world.player.car.pos) return world.player.car.pos;
  return world.player.pos;
}
function focusHeading(world) {
  if (world.player && world.player.car) return world.player.car.heading;
  return world.player.heading;
}

/** Call every system's update once, in world order; a missing system is skipped.
 * The order matches main.js stepOrder, so staged scenes play identically. */
function stepWorld(world, dt) {
  const systems = world.systems || {};
  const order = ['city', 'player', 'vehicles', 'traffic', 'police', 'missions', 'combat', 'helicopter', 'shops', 'daynight', 'oldtown', 'policeai', 'missions3', 'activities'];
  for (const name of order) {
    const system = systems[name];
    if (system && typeof system.update === 'function') {
      try {
        system.update(dt);
      } catch (error) {
        console.warn(`[shots] ${name}.update failed during staging`, error);
      }
    }
  }
  world.time = (world.time || 0) + dt;
}

/** Steer toward a waypoint: hold W, tap A/D to close the heading gap. */
function driveToward(world, target) {
  const keys = world.input && world.input.keys;
  if (!keys) return;
  const pos = focusPos(world);
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const want = Math.atan2(dx, dz);
  let gap = want - focusHeading(world);
  while (gap > Math.PI) gap -= Math.PI * 2;
  while (gap < -Math.PI) gap += Math.PI * 2;
  keys.add('KeyW');
  keys.delete('KeyA');
  keys.delete('KeyD');
  if (gap > 0.12) keys.add('KeyD');
  else if (gap < -0.12) keys.add('KeyA');
}

/** Put the player in a car at (x, z) facing heading, spawning one if needed. */
function putPlayerInCar(world, x, z, heading) {
  const systems = world.systems || {};
  const player = world.player;
  player.onFoot = false;
  player.heading = heading;
  player.pos.set(x, 0, z);
  player.speed = 0;
  try {
    if (systems.vehicles && typeof systems.vehicles.spawnCar === 'function') {
      const car = systems.vehicles.spawnCar('player', player.pos.clone(), heading, 0xd7263d);
      if (car) {
        player.car = car;
        if (systems.player && typeof systems.player.enterCar === 'function') {
          systems.player.enterCar(car);
        }
      }
    }
  } catch (error) {
    console.warn('[shots] spawnCar failed during staging', error);
  }
  // Fallback when no vehicle system exists yet: move the player mesh by hand.
  if (!player.car && player.mesh) {
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = heading;
  }
}

/** Put the player on foot at (x, z) facing heading. */
function putPlayerOnFoot(world, x, z, heading) {
  const systems = world.systems || {};
  const player = world.player;
  try {
    if (player.car && systems.player && typeof systems.player.exitCar === 'function') {
      systems.player.exitCar();
    }
  } catch (error) {
    console.warn('[shots] exitCar failed during staging', error);
  }
  player.car = null;
  player.onFoot = true;
  player.heading = heading;
  player.pos.set(x, 0, z);
  player.speed = 0;
  if (player.mesh) {
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = heading;
  }
}

/** Chase camera: behind the player, a little above, looking ahead of them. */
function placeCamera(world) {
  const pos = focusPos(world);
  const heading = focusHeading(world);
  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const behind = pos.clone().addScaledVector(forward, -13);
  behind.y = pos.y + 5.5;
  world.camera.position.copy(behind);
  const look = pos.clone().addScaledVector(forward, 8);
  look.y = pos.y + 1.5;
  world.camera.lookAt(look);
}

/** Seed the traffic and pedestrians by running the world a couple of seconds. */
function warmUp(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(world, STEP);
}

/** Jump the day/night clock when the system exists (guarded: no-op without it). */
function setClock(world, hours) {
  try {
    const dn = world.systems && world.systems.daynight;
    if (dn && typeof dn.setTime === 'function') dn.setTime(hours);
  } catch (error) {
    console.warn('[shots] setTime failed during staging', error);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Unknown names stage the plain drive scene.
 */
export function stageShot(name, world) {
  const systems = world.systems || {};
  world.mode = 'play';
  world.time = 0;
  world.wanted = 0;
  world.cash = 1250;
  if (world.player) world.player.health = 100;
  if (world.input && world.input.keys) world.input.keys.clear();
  if (world.events) world.events.length = 0;

  // Let the city, traffic and pedestrians settle before the scene starts.
  warmUp(world, 2);

  if (name === 'chase') {
    // Dusk chase: golden low sun, wanted 4, police closing in AND the
    // helicopter overhead, with a spike strip laid across the road ahead.
    // The police AI places the strip itself on the first step after the
    // heat goes up (its cooldown starts long expired).
    setClock(world, 17.6);
    putPlayerInCar(world, -180, 0, Math.PI / 2);
    try {
      if (systems.police && typeof systems.police.addWanted === 'function') systems.police.addWanted(4);
    } catch (error) {
      console.warn('[shots] addWanted failed during staging', error);
    }
    const target = new THREE.Vector3(232, 0, 0);
    const steps = Math.round(CHASE_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      driveToward(world, target);
      stepWorld(world, STEP);
    }
    // Foot off the gas before placing the police: with W still held the car
    // would coast away from them in the steps that sync their meshes.
    if (world.input && world.input.keys) world.input.keys.clear();
    // Park two police cars right on Rico's tail for the frame: the police
    // system (when it lands) chases for real; until then, place them where
    // a chase would have them — pulling alongside the player's car, in frame
    // at the edges, not hidden behind the chase camera.
    try {
      if (systems.vehicles && typeof systems.vehicles.spawnCar === 'function') {
        const pos = focusPos(world);
        const heading = focusHeading(world);
        const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
        const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
        const spots = [
          { along: -4, across: -6.5 },
          { along: 2, across: 6.5 },
        ];
        for (const spot of spots) {
          const at = pos.clone().addScaledVector(forward, spot.along).addScaledVector(side, spot.across);
          systems.vehicles.spawnCar('police', at, heading, 0x1a1a2e);
        }
      }
    } catch (error) {
      console.warn('[shots] police spawn failed during staging', error);
    }
    // Helicopter chase: the heli must be placed AFTER the last stepWorld
    // below — heli.update respawns an inactive heli 60 m above the player
    // (out of the camera frame), so placing it before the step is undone.
    // One step first, to sync the new meshes; then park the heli ~40 m
    // ahead of the player, 14 m up — low enough to sit inside the chase
    // camera's frame (the camera looks ~21° down, so 26 m up is above
    // the top edge) — and run one heli.update so its spotlight cone and
    // ground disc recompute at that altitude.
    stepWorld(world, STEP);
    try {
      const heli = systems.helicopter;
      if (heli) {
        const pos = focusPos(world);
        const heading = focusHeading(world);
        const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
        const ahead = pos.clone().addScaledVector(forward, 40);
        ahead.y = 14;
        if (heli.pos && typeof heli.pos.set === 'function') heli.pos.set(ahead.x, ahead.y, ahead.z);
        else heli.pos = ahead;
        if (heli.mesh) heli.mesh.position.copy(ahead);
        if (typeof heli.update === 'function') heli.update(STEP);
      }
    } catch (error) {
      console.warn('[shots] helicopter staging failed', error);
    }
  } else if (name === 'foot') {
    // Midnight at the lighthouse: Rico on foot on the south-west beach,
    // facing the striped tower while its beam sweeps the coast. The
    // clock is jumped to night first so the lamps, the beam and the
    // stars are all lit; the warm-up already ran, so peds are around.
    // Rico stands ~35 m back from the tower so the whole lighthouse
    // fits the frame instead of filling one corner of it.
    setClock(world, 23.2);
    putPlayerOnFoot(world, -242, 278, Math.atan2(-28, 22));
    for (let i = 0; i < 30; i += 1) stepWorld(world, STEP);
  } else if (name === 'mission') {
    // Mission 10, Midnight Delivery: the mission itself jumps the clock
    // to midnight and lights four blue harbour rings. Rico drives north
    // on road x = -174 toward the first drop at the yard gate, stopping
    // ~13 m short of the ring (outside its 10 m trigger) so the
    // delivery does not complete mid-stage.
    putPlayerInCar(world, -174, -196, Math.PI);
    try {
      if (systems.missions && typeof systems.missions.startMission === 'function') {
        systems.missions.startMission(10);
      }
    } catch (error) {
      console.warn('[shots] startMission failed during staging', error);
    }
    const stop = new THREE.Vector3(-174, 0, -220);
    const steps = Math.round(MISSION_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      driveToward(world, stop);
      stepWorld(world, STEP);
      if (focusPos(world).z <= -220) break;
    }
    // One step lets the mission system move its beacon onto the marker,
    // then pin the frame to the delivery stage: marker at the first drop
    // (the yard gate), ~13 m ahead of the car, outside the 10 m ring.
    stepWorld(world, STEP);
    if (world.mission) {
      world.mission.id = 10;
      world.mission.stage = 0;
      world.mission.objective = 'Midnight Delivery — drop 1 of 4';
      world.mission.marker = new THREE.Vector3(-170, 2, -232);
    }
  } else {
    // 'drive' (and any unknown name): the Old Town Loop street race.
    // Rico starts on road x = -174 just north of the quarter and races
    // south past the start gantry, the townhouses and the cathedral,
    // chasing the blue checkpoint rings down the west side of the city.
    setClock(world, 10);
    putPlayerInCar(world, -174, -96, 0);
    try {
      const acts = systems.activities;
      if (acts && typeof acts.startRace === 'function') {
        acts.startRace({
          id: 'oldtown',
          name: 'Old Town Loop',
          prize: 600,
          par: 75,
          start: { x: -174, z: -58 },
          checkpoints: [
            { x: -174, z: -58 },
            { x: -174, z: 116 },
            { x: 0, z: 116 },
            { x: 0, z: -58 },
            { x: -174, z: -58 },
          ],
        });
      }
    } catch (error) {
      console.warn('[shots] startRace failed during staging', error);
    }
    const target = new THREE.Vector3(-174, 0, 116);
    const steps = Math.round(DRIVE_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      driveToward(world, target);
      stepWorld(world, STEP);
      if (focusPos(world).z >= 116) break;
    }
  }

  if (world.input && world.input.keys) world.input.keys.clear();
  placeCamera(world);
  if (world.hud && typeof world.hud.update === 'function') {
    try {
      world.hud.update(world);
    } catch (error) {
      console.warn('[shots] hud.update failed during staging', error);
    }
  }
  return { screen: 'play' };
}
