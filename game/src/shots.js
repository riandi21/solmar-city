// The screenshot scenes behind ?shot=chase|drive|foot|mission. Each one plays the
// real game forward from a fixed seed for a few seconds, steered by scripted
// inputs (drive along a road, flee the police, walk a busy street, head for the
// marina marker), so the frame is what a short game really looks like and the
// same seed always gives the same frame. Every system call is guarded: if a
// system is missing the scene still stages with plain positions, and main.js
// paints the result twice and sets window.__shotReady.
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

/** Call every system's update once, in world order; a missing system is skipped. */
function stepWorld(world, dt) {
  const systems = world.systems || {};
  const order = ['city', 'player', 'vehicles', 'traffic', 'police', 'missions', 'combat', 'helicopter', 'shops'];
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
    // Wanted 4, police closing in AND the helicopter overhead: Rico flees
    // east along the main road, the heli hanging ahead in frame.
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
    // Shop moment: Rico on foot next to the store at (58,116), facing its
    // green-cross sign, with the buy prompt on the HUD. Warm-up already ran
    // at the top of stageShot, so peds and traffic are around.
    putPlayerOnFoot(world, 58, 121, Math.PI);
    // A few steps so the shops system sees Rico in range and raises its own
    // prompt; the explicit setPrompt below is the backup if it has not.
    for (let i = 0; i < 30; i += 1) stepWorld(world, STEP);
    try {
      if (world.hud && typeof world.hud.setPrompt === 'function') {
        world.hud.setPrompt('Q: Health $150 · R: Ammo $100');
      }
    } catch (error) {
      console.warn('[shots] setPrompt failed during staging', error);
    }
  } else if (name === 'mission') {
    // Mission 8 finale: take the Coral Club. Rico drives south on road
    // x = 58 toward the tower, then the frame is pinned to the tower
    // stage — marker at (58,29), rival shooters at the tower.
    putPlayerInCar(world, 58, -120, 0);
    try {
      if (systems.missions && typeof systems.missions.startMission === 'function') {
        systems.missions.startMission(8);
      }
    } catch (error) {
      console.warn('[shots] startMission failed during staging', error);
    }
    const stop = new THREE.Vector3(58, 0, 10);
    const steps = Math.round(MISSION_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      driveToward(world, stop);
      stepWorld(world, STEP);
      if (focusPos(world).z >= 10) break;
    }
    // Pin the frame to the tower stage: marker at the Coral Club roadside
    // point, ~19 m ahead of the car, outside the arrival radius so the
    // mission does not complete during staging. One step lets the mission
    // system move its beacon onto the marker (and the combat system spawn
    // its rival shooters for this stage, when it supports mission 8).
    if (world.mission) {
      world.mission.id = 8;
      world.mission.stage = 2;
      world.mission.objective = 'Take the Coral Club';
      world.mission.marker = new THREE.Vector3(58, 2, 29);
    }
    stepWorld(world, STEP);
  } else {
    // 'drive' (and any unknown name): a new-district showcase — south down
    // road x = 0 from (0,60) to (0,252), ending facing the beach and
    // boardwalk head-on, stalls + pier + sea filling the frame. The start
    // is far south on purpose: 7 s at ~32 m/s only covers ~200 m, so
    // starting at z = -100 never got the car close to the boardwalk.
    putPlayerInCar(world, 0, 60, 0);
    const target = new THREE.Vector3(0, 0, 252);
    const steps = Math.round(DRIVE_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      driveToward(world, target);
      stepWorld(world, STEP);
      if (focusPos(world).z >= 252) break;
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
