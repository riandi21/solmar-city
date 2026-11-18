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
const FOOT_SECONDS = 6;
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
  const order = ['city', 'player', 'vehicles', 'traffic', 'police', 'missions', 'combat'];
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
    // Wanted 3, police closing in, Rico fleeing east along the main road.
    putPlayerInCar(world, -180, 0, Math.PI / 2);
    try {
      if (systems.police && typeof systems.police.addWanted === 'function') systems.police.addWanted(3);
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
    // One step to sync the new meshes, no more: the player car is already
    // where the frame wants it.
    stepWorld(world, STEP);
  } else if (name === 'foot') {
    // On foot in a busy street downtown, pedestrians around, traffic passing.
    putPlayerOnFoot(world, 0, 58, 0);
    if (world.input && world.input.keys) world.input.keys.add('KeyW');
    const steps = Math.round(FOOT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) stepWorld(world, STEP);
    if (world.input && world.input.keys) world.input.keys.delete('KeyW');
  } else if (name === 'mission') {
    // The Marina Job: the yacht marker waits on land at the marina entrance
    // (missions.js SPOTS.yacht, 255,160). Rico drives in from the west
    // along road z = 174 and stops just short of it, beacon ahead in frame.
    putPlayerInCar(world, 150, 174, Math.PI / 2);
    try {
      if (systems.missions && typeof systems.missions.startMission === 'function') {
        systems.missions.startMission(4);
      }
    } catch (error) {
      console.warn('[shots] startMission failed during staging', error);
    }
    const stop = new THREE.Vector3(238, 0, 174);
    const steps = Math.round(MISSION_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      driveToward(world, stop);
      stepWorld(world, STEP);
      if (focusPos(world).x >= 238) break;
    }
    // Pin the frame to the yacht stage: marker 20 m ahead of the car, outside
    // the 12 m arrival radius so the mission does not complete during staging.
    // One step lets the mission system move its beacon onto the marker.
    if (world.mission) {
      world.mission.id = 4;
      world.mission.stage = 2;
      world.mission.objective = 'Reach the yacht at the marina';
      world.mission.marker = new THREE.Vector3(255, 2, 160);
    }
    stepWorld(world, STEP);
  } else {
    // 'drive' (and any unknown name): a clean cruise downtown, no heat.
    putPlayerInCar(world, 0, -200, 0);
    const target = new THREE.Vector3(0, 0, 180);
    const steps = Math.round(DRIVE_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      driveToward(world, target);
      stepWorld(world, STEP);
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
