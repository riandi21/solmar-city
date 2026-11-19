// Solmar City shots: four staged captures, each a real render of the live game
// stepped forward from a fixed seed with scripted inputs — chase (jet ski
// pursuit in the marina at sunset), drive (Lowrider hydraulics through Sunset
// Beach at dusk), foot (on foot at the Surf Shack, fishing rod in hand),
// mission (M44 finale at the airfield). Each reports ready after two paints.
// 1280x720 JPEG, quality ~0.8, at most 256 KiB. The integrator calls
// window.__shots.capture(name) and saves the returned data URL.

export const SHOT_NAMES = ['chase', 'drive', 'foot', 'mission'];
export const SHOT_FILES = ['1-chase.jpg', '2-drive.jpg', '3-foot.jpg', '4-mission.jpg'];

const SHOT_DEFS = {
  chase: {
    file: '1-chase.jpg', time: 18.2, wanted: 3, district: 'Marina',
    objective: 'M42 The Informant — lose the cartel pursuit on the water',
    // Open marina water, clear of the big yacht at (305, 175) — staging
    // on the yacht's footprint buried the jet ski inside its hull.
    place: { x: 340, z: 215 },
  },
  drive: {
    file: '2-drive.jpg', time: 18.3, wanted: 0, district: 'Sunset Beach',
    objective: 'Cruise Sunset Beach — hydraulics on, crowd watching',
    // Open sand, clear of the Surf Shack at (-180, 300) — staging on
    // the shack's footprint buried the Lowrider behind its walls.
    place: { x: -200, z: 310 },
  },
  foot: {
    file: '3-foot.jpg', time: 17.5, wanted: 0, district: 'Sunset Beach',
    objective: 'Fish at the Surf Shack pier — best catch so far: Big Marlin',
    // On the sand south of the pier, not on the pier deck — the deck
    // sits above the player's feet and swallowed him to the shoulders.
    place: { x: -150, z: 308 },
  },
  mission: {
    file: '4-mission.jpg', time: 17.9, wanted: 5, district: 'Airfield',
    objective: 'M44 The Kingpin — take the cartel boss at the airfield, escape by seaplane',
    // South of the hangar's face, clear of road z=-232 traffic; 17.9
    // keeps dusk light (18.8 rendered as full night).
    place: { x: 200, z: -220 },
  },
};

function setPlayerAt(world, x, z, heading) {
  if (!world.player || !world.player.position) return;
  world.player.position.x = x;
  world.player.position.y = 0;
  world.player.position.z = z;
  world.player.heading = heading || 0;
  world.player.onFoot = true;
  world.player.speed = 0;
}

export function createShots(world, hooks) {
  const render = hooks && hooks.render ? hooks.render : () => {};
  const step = hooks && hooks.step ? hooks.step : () => {};
  const setTime = hooks && hooks.setTime ? hooks.setTime : () => {};

  function stage(name) {
    const def = SHOT_DEFS[name] || SHOT_DEFS.chase;
    // Shot mode: police busting, roadblocks and spike strips are
    // suppressed while staging (see police.js / policeai.js). This flag
    // only ever exists on ?shot= pages, never in normal play.
    world.shotMode = true;
    world.shotStaging = true;
    world.mode = 'play';
    world.wanted = def.wanted;
    world.currentDistrict = def.district;
    if (world.mission) {
      world.mission.objective = def.objective;
      world.mission.marker = { x: def.place.x, z: def.place.z };
      if (name === 'mission') world.mission.id = 44;
      if (name === 'chase') world.mission.id = 42;
    }
    setTime(def.time);
    setPlayerAt(world, def.place.x, def.place.z, name === 'chase' ? 2.4 : 0.6);
    // Spawn helpers live on the system objects (world.systemObjects),
    // not on the world state fields — resolve them there first.
    const jetskiSys = (world.systemObjects && world.systemObjects.jetski) || world.jetski;
    const vehiclesSys = (world.systemObjects && world.systemObjects.vehicles) || world.vehicles;
    if (name === 'chase' && jetskiSys && typeof jetskiSys.spawnForShot === 'function') {
      jetskiSys.spawnForShot(def.place.x, def.place.z, 2.4);
    }
    if (name === 'drive' && vehiclesSys && typeof vehiclesSys.spawnLowriderForShot === 'function') {
      vehiclesSys.spawnLowriderForShot(def.place.x, def.place.z, 0.6);
    }
    if (name === 'foot' && world.fishing) {
      world.fishing.rodInHand = true;
      if (world.kingpin) world.kingpin.fishingBestCatch = 'Big Marlin ($80)';
    }
    if (name === 'mission' && world.kingpin) {
      world.kingpin.shipmentSeized = true;
      world.kingpin.informantProtected = true;
      world.kingpin.siegeSurvived = true;
    }
    // Step the real simulation forward so traffic, water and crowds are alive.
    // A longer settle for the mission shot: the airfield chase needs the
    // cartel plane and the seaplane to be in frame when the shutter fires.
    const settleSteps = name === 'mission' ? 150 : 90;
    for (let i = 0; i < settleSteps; i += 1) step(1 / 60);
    // Fill the cartel threat bar so it reads on camera in the foot shot.
    // Set AFTER staging: the cartel system owns state.threat and syncs
    // it over world.cartelThreat every tick, so an earlier write is lost.
    // After the steps, no ambush spawns before the shutter.
    if (name === 'foot') {
      const cartelSys = world.systemObjects && world.systemObjects.cartel;
      if (cartelSys && typeof cartelSys.addThreat === 'function') cartelSys.addThreat(65);
      else if (world.cartelState) world.cartelState.threat = 65;
      world.cartelThreat = 65;
    }
    // The Lowrider bounce decays during staging — re-trigger it at peak
    // lift (bounce 0.5, sin(PI/2) = 1) so the hydraulics are visibly up
    // when the shutter fires.
    if (name === 'drive' && world.player && world.player.currentCar) {
      const car = world.player.currentCar;
      car.bounce = 0.5;
      car.bounceTimer = 1.4;
      // No vehicle update runs after staging, so apply the lift to the
      // mesh here (mirrors vehicles.update): otherwise the value above
      // changes nothing on screen.
      const lift = Math.sin(car.bounce * Math.PI) * 0.22;
      if (car.mesh) {
        car.mesh.position.y = lift;
        const body = car.mesh.getObjectByName('body');
        if (body) body.position.y = 0.55 + lift * 0.6;
      }
    }
    return def;
  }

  function capture(name) {
    const def = stage(name);
    render();
    render();
    const canvas = hooks && hooks.canvas ? hooks.canvas : null;
    let dataUrl = '';
    if (canvas && typeof canvas.toDataURL === 'function') {
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      } catch {
        dataUrl = '';
      }
    }
    window.__shotReady = true;
    return { name, file: def.file, dataUrl, bytes: Math.round(dataUrl.length * 0.75) };
  }

  const shots = {
    names: SHOT_NAMES.slice(),
    files: SHOT_FILES.slice(),
    defs: SHOT_DEFS,
    stage,
    capture,
    // ?shot=chase|drive|foot|mission stages that scene, paints twice, sets ready.
    runShotParam(name) {
      const result = capture(name);
      return result;
    },
  };
  return shots;
}
