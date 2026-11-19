// Side activities for Solmar City — street races, hidden packages,
// and taxi jobs. Free-roam money for Rico between story missions.
//
//   * Street races (T) — three courses with checkpoint rings and cash
//     prizes. Stand on a start gantry and press T; the clock runs and
//     the rings light up in order. Beat your best time and the HUD
//     tracker remembers it.
//   * Hidden packages — 20 gold parcels stashed around the city (Old
//     Town, the lighthouse, the pier, the freight yard…). Walk over one
//     to pocket $50. The HUD tracker counts them.
//   * Taxi jobs — a fare waves you down at the roadside; pull up in a
//     car, drive them to the gold marker, and get paid by the distance.
//
//   createActivities(scene, world) -> { update, state, startRace,
//     raceStatus, packagesFound, taxiEarned }
// Progress lives on world.activitiesProgress so save.js can persist it
// without importing this module.
import * as THREE from 'three';
import { dist2XZ } from './world.js';

export const RACES = [
  {
    id: 'boardwalk',
    name: 'Boardwalk Sprint',
    prize: 300,
    par: 60,
    start: { x: 0, z: 232 },
    checkpoints: [
      { x: 0, z: 232 },
      { x: 116, z: 232 },
      { x: 232, z: 232 },
      { x: 232, z: 116 },
    ],
  },
  {
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
  },
  {
    id: 'harbor',
    name: 'Harbor Grand Prix',
    prize: 1200,
    par: 150,
    start: { x: -170, z: -232 },
    checkpoints: [
      { x: -170, z: -232 },
      { x: 232, z: -232 },
      { x: 232, z: 232 },
      { x: -232, z: 232 },
      { x: -170, z: -232 },
    ],
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse Dash',
    prize: 900,
    par: 90,
    start: { x: -232, z: 232 },
    checkpoints: [
      { x: -232, z: 232 },
      { x: -232, z: 0 },
      { x: -232, z: -232 },
      { x: 0, z: -232 },
      { x: 232, z: -232 },
    ],
  },
];

// Twenty stash spots, spread so every district hides at least one.
export const PACKAGE_SPOTS = [
  { x: -203, z: -58 }, // Old Town plaza, by the fountain
  { x: -224, z: -104 }, // Old Town, north-west lane
  { x: -182, z: -12 }, // Old Town, south-east lane
  { x: -270, z: 300 }, // lighthouse base
  { x: -232, z: 290 }, // south-west beach
  { x: 0, z: 318 }, // pier end
  { x: 0, z: 264 }, // boardwalk centre
  { x: 116, z: 264 }, // boardwalk east
  { x: -116, z: 264 }, // boardwalk west
  { x: -170, z: -260 }, // freight yard gate
  { x: -203, z: -232 }, // freight yard, north fence
  { x: 232, z: 160 }, // marina entrance
  { x: 255, z: 100 }, // marina, north pier
  { x: -174, z: 232 }, // safehouse
  { x: 58, z: 116 }, // shop
  { x: 58, z: 29 }, // Coral Club door
  { x: -58, z: -174 }, // north residential
  { x: 174, z: -116 }, // east residential
  { x: 0, z: 0 }, // downtown crossing
  { x: 116, z: 58 }, // midtown east
];

const PACKAGE_REWARD = 50;
const TAXI_MIN_FARE = 150;
const TAXI_PER_METRE = 0.6;
const TAXI_RESPAWN_SECONDS = 20;
const RACE_START_RADIUS = 8;
const RACE_RING_RADIUS = 9;

function makeCheckeredGantry(color) {
  // A start gantry: two posts + a checkered beam across the road.
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.6 });
  for (const sx of [-5, 5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.5, 8), postMat);
    post.position.set(sx, 2.75, 0);
    post.castShadow = true;
    group.add(post);
  }
  const beam = new THREE.Group();
  for (let i = 0; i < 10; i += 1) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 0.15),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x111111 : 0xf2f2f2, roughness: 0.5 }),
    );
    tile.position.set(-4.5 + i, 0, 0);
    beam.add(tile);
  }
  beam.position.y = 5.2;
  group.add(beam);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.9, 0.1),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.25 }),
  );
  banner.position.y = 4.4;
  group.add(banner);
  return group;
}

function makeRing(color) {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RACE_RING_RADIUS, 0.4, 8, 28), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.4;
  group.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(RACE_RING_RADIUS, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.15;
  group.add(disc);
  group.visible = false;
  return { group, ringMat };
}

function makePackageMesh() {
  // A gold parcel: a small wrapped box with a ribbon cross, bobbing and
  // spinning so it catches the eye from down the street.
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd34d, roughness: 0.3, metalness: 0.5, emissive: 0x664400, emissiveIntensity: 0.5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), gold);
  box.position.y = 0.7;
  box.castShadow = true;
  group.add(box);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.5 });
  const ribbonA = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.2), ribbonMat);
  ribbonA.position.y = 0.7;
  group.add(ribbonA);
  const ribbonB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.95), ribbonMat);
  ribbonB.position.y = 0.7;
  group.add(ribbonB);
  return group;
}

function makePassengerMesh() {
  // A waiting fare: a plain figure with a raised arm, ringed in gold.
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.0, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.8 }),
  );
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 }),
  );
  head.position.y = 1.75;
  group.add(head);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.9, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.8 }),
  );
  arm.position.set(0.45, 1.6, 0);
  arm.rotation.z = -0.9;
  group.add(arm);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.15, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  group.add(ring);
  return group;
}

export function createActivities(scene, world) {
  const progress = {
    packagesFound: [], // indices into PACKAGE_SPOTS
    raceBest: {}, // race id -> seconds
    taxiEarned: 0,
    raceWins: 0,
    // v3 — the last three finished races, newest first, for the HUD
    // tracker: { race, seconds, won }.
    raceHistory: [],
  };
  world.activitiesProgress = progress;

  const state = {
    race: null, // { def, index, timer, rings }
    racePrompt: '',
    taxi: { phase: 'idle', passenger: null, mesh: null, dest: null, fare: 0, respawnIn: 5 },
    packages: [], // { spot, mesh, found }
  };

  // --- race gantries (permanent, at each start line) -----------------------
  for (const race of RACES) {
    const gantry = makeCheckeredGantry(0xffd34d);
    gantry.position.set(race.start.x, 0, race.start.z);
    gantry.rotation.y = Math.PI / 2;
    scene.add(gantry);
  }

  // --- hidden packages ------------------------------------------------------
  for (let i = 0; i < PACKAGE_SPOTS.length; i += 1) {
    const spot = PACKAGE_SPOTS[i];
    const mesh = makePackageMesh();
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    state.packages.push({ spot, mesh, found: false, phase: Math.random() * Math.PI * 2 });
  }

  function announce(text) {
    try {
      if (world.hud) world.hud.showMessage(text);
    } catch {
      // Toast is cosmetic.
    }
  }

  function pay(amount) {
    world.cash = (world.cash || 0) + amount;
    if (world.player) world.player.cash = world.cash;
  }

  // --- races ---------------------------------------------------------------
  function nearestRaceStart(maxDist) {
    const pp = world.player ? world.player.pos : { x: 0, z: 0 };
    let best = null;
    let bestD = maxDist;
    for (const race of RACES) {
      const d = dist2XZ(pp.x, pp.z, race.start.x, race.start.z);
      if (d < bestD) {
        bestD = d;
        best = race;
      }
    }
    return best;
  }

  function startRace(def) {
    if (state.race) return false;
    const rings = [];
    for (const spot of def.checkpoints) {
      const ring = makeRing(0x4dc3ff);
      ring.group.position.set(spot.x, 0, spot.z);
      scene.add(ring.group);
      rings.push(ring);
    }
    rings[0].group.visible = true;
    state.race = { def, index: 0, timer: 0, rings };
    announce(`${def.name} — GO! ${def.checkpoints.length - 1} checkpoints, $${def.prize} to win.`);
    return true;
  }

  function finishRace() {
    const race = state.race;
    if (!race) return;
    const t = race.timer;
    const best = progress.raceBest[race.def.id];
    const isBest = best === undefined || t < best;
    if (isBest) progress.raceBest[race.def.id] = t;
    pay(race.def.prize);
    progress.raceWins += 1;
    // v3 — keep the last three results (newest first) for the HUD tracker.
    progress.raceHistory.unshift({ race: race.def.id, seconds: t, won: true });
    if (progress.raceHistory.length > 3) progress.raceHistory.length = 3;
    announce(
      `${race.def.name} finished in ${t.toFixed(1)}s — $${race.def.prize} won!` +
      (isBest ? ' New best time!' : ` Best: ${best.toFixed(1)}s.`),
    );
    for (const ring of race.rings) {
      try {
        scene.remove(ring.group);
      } catch {
        // Already gone.
      }
    }
    state.race = null;
  }

  function failRace(reason) {
    const race = state.race;
    if (!race) return;
    for (const ring of race.rings) {
      try {
        scene.remove(ring.group);
      } catch {
        // Already gone.
      }
    }
    state.race = null;
    announce(`Race over — ${reason}`);
  }

  function updateRace(dt) {
    const race = state.race;
    if (!race) return;
    race.timer += dt;
    if (race.timer > race.def.par * 2) {
      failRace('too slow — the streets moved on');
      return;
    }
    const spot = race.def.checkpoints[race.index];
    if (!spot) {
      finishRace();
      return;
    }
    const pp = world.player ? world.player.pos : { x: 0, z: 0 };
    if (dist2XZ(pp.x, pp.z, spot.x, spot.z) <= RACE_RING_RADIUS + 2) {
      race.rings[race.index].group.visible = false;
      race.index += 1;
      if (race.index >= race.def.checkpoints.length) {
        finishRace();
        return;
      }
      race.rings[race.index].group.visible = true;
    }
    const live = race.rings[race.index];
    if (live) live.ringMat.opacity = 0.55 + 0.35 * Math.sin((world.time || 0) * 6);
  }

  function raceStatus() {
    if (!state.race) return 'idle';
    return `racing:${state.race.def.id}:${state.race.index}/${state.race.def.checkpoints.length}`;
  }

  // --- packages ---------------------------------------------------------------
  function updatePackages(dt) {
    const pp = world.player ? world.player.pos : { x: 0, z: 0 };
    for (let i = 0; i < state.packages.length; i += 1) {
      const pkg = state.packages[i];
      if (pkg.found) continue;
      pkg.phase += dt;
      pkg.mesh.position.y = Math.sin(pkg.phase * 2) * 0.15;
      pkg.mesh.rotation.y += dt * 1.5;
      if (dist2XZ(pp.x, pp.z, pkg.spot.x, pkg.spot.z) <= 3) {
        pkg.found = true;
        progress.packagesFound.push(i);
        pay(PACKAGE_REWARD);
        try {
          scene.remove(pkg.mesh);
        } catch {
          // Already gone.
        }
        announce(
          `Hidden package found! +$${PACKAGE_REWARD} — ` +
          `${progress.packagesFound.length}/${PACKAGE_SPOTS.length} collected.`,
        );
        try {
          if (world.audio && typeof world.audio.collect === 'function') world.audio.collect();
        } catch {
          // Sound is optional.
        }
      }
    }
  }

  // --- taxi jobs --------------------------------------------------------------
  function randomRoadsideSpot() {
    // A roadside point 60-110 m from the player, snapped to the nearest road.
    const pp = world.player ? world.player.pos : { x: 0, z: 0 };
    const angle = Math.random() * Math.PI * 2;
    const d = 60 + Math.random() * 50;
    let x = pp.x + Math.sin(angle) * d;
    let z = pp.z + Math.cos(angle) * d;
    x = Math.max(-240, Math.min(240, x));
    z = Math.max(-240, Math.min(240, z));
    try {
      if (world.city && typeof world.city.nearestRoad === 'function') {
        const snap = world.city.nearestRoad(x, z);
        return { x: snap.x, z: snap.z };
      }
    } catch {
      // Fall through with the raw point.
    }
    return { x, z };
  }

  function spawnPassenger() {
    const spot = randomRoadsideSpot();
    const mesh = makePassengerMesh();
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    state.taxi = { phase: 'waiting', passenger: spot, mesh, dest: null, fare: 0, respawnIn: 0 };
  }

  function updateTaxi(dt) {
    const taxi = state.taxi;
    const player = world.player || {};
    const pp = player.pos || { x: 0, z: 0 };
    if (taxi.phase === 'idle') {
      taxi.respawnIn -= dt;
      if (taxi.respawnIn <= 0 && player.car) spawnPassenger();
      return;
    }
    if (taxi.phase === 'waiting') {
      // Pull up in a car within 6 m and the fare hops in.
      if (player.car && !player.onFoot && dist2XZ(pp.x, pp.z, taxi.passenger.x, taxi.passenger.z) <= 6) {
        const dest = randomRoadsideSpot();
        const d = dist2XZ(taxi.passenger.x, taxi.passenger.z, dest.x, dest.z);
        taxi.dest = dest;
        taxi.fare = Math.round(TAXI_MIN_FARE + d * TAXI_PER_METRE);
        taxi.phase = 'riding';
        try {
          scene.remove(taxi.mesh);
        } catch {
          // Already gone.
        }
        taxi.mesh = null;
        if (world.mission) {
          world.mission.marker = null; // taxi dest rides the mission marker slot briefly
        }
        announce(`Fare aboard — drop them off for $${taxi.fare}. Follow the gold marker.`);
        // Reuse the mission beacon for the taxi destination.
        try {
          if (world.systems && world.systems.missions && world.mission) {
            world.mission.marker = new THREE.Vector3(dest.x, 0, dest.z);
          }
        } catch {
          // Marker is a nicety.
        }
      }
      return;
    }
    if (taxi.phase === 'riding') {
      if (dist2XZ(pp.x, pp.z, taxi.dest.x, taxi.dest.z) <= 10) {
        pay(taxi.fare);
        progress.taxiEarned += taxi.fare;
        announce(`Fare complete — $${taxi.fare} earned. Total taxi money: $${progress.taxiEarned}.`);
        state.taxi = { phase: 'idle', passenger: null, mesh: null, dest: null, fare: 0, respawnIn: TAXI_RESPAWN_SECONDS };
      } else if (!player.car) {
        // Rico walked away mid-fare: the passenger bails, no pay.
        announce('The fare walked off — no tip for a driver on foot.');
        state.taxi = { phase: 'idle', passenger: null, mesh: null, dest: null, fare: 0, respawnIn: TAXI_RESPAWN_SECONDS };
      }
    }
  }

  let prevT = false;

  function update(dt) {
    if (world.mode !== 'play') return;
    const capped = Math.min(dt || 0, 0.1);
    // T starts the nearest race when Rico stands on its gantry.
    const keys = (world.input && world.input.keys) || null;
    const tDown = keys ? keys.has('KeyT') : false;
    if (tDown && !prevT && !state.race) {
      const race = nearestRaceStart(RACE_START_RADIUS);
      if (race) startRace(race);
    }
    prevT = tDown;
    // Prompt when a race is available and none is running.
    if (!state.race) {
      const race = nearestRaceStart(RACE_START_RADIUS);
      state.racePrompt = race ? `Press T — ${race.name} ($${race.prize})` : '';
    } else {
      state.racePrompt = '';
    }
    updateRace(capped);
    updatePackages(capped);
    updateTaxi(capped);
  }

  return {
    update,
    state,
    progress,
    startRace,
    raceStatus,
    packagesFound: () => progress.packagesFound.length,
    taxiEarned: () => progress.taxiEarned,
  };
}
