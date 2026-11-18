// Missions for Solmar City — Rico Vega owes $5,000 to Madame Coral.
// Missions 1-4 pay the debt down exactly ($500 + $800 + $1,200 + $2,500).
// Missions 5-8 are the second arc: the debt is paid, but the rival Dourado
// gang moves on Coral's turf, and Coral hires Rico to defend it and take
// the city for himself. Missions run in order, one after another: mission 1
// starts when the game starts, and finishing one starts the next after a
// short celebration pause.
//
// The factory owns the 3D beacon (a gold disc + a vertical light beam) and
// keeps world.mission up to date; the HUD and the minimap read that object
// directly, so no other system needs to know about mission internals.
//
// Shared state this module touches (see BUILD-NOTES.md):
//   world.mission = { id, stage, objective, marker, timer }
//   world.cash / world.player.cash — paid on completion
//   world.wanted — set by missions 3 and 4
//   world.player.ammo — refilled to 24 at every mission start
//   world.missionsDone — array of finished mission ids, shared with save.js
//   world.hud?.showMessage(text), world.audio?.jingle() — optional hooks
//   world.peds — the two crew members for mission 4 are added here
import * as THREE from 'three';

export const DEBT_TOTAL = 5000;

// Fixed mission spots, all on (or just off) roads so the player can reach
// them by car. The Coral Club tower stands at block centre (29,29), so its
// marker waits on the road along its east face, and its penthouse door is on
// that same face a few metres closer in. The yacht itself floats in
// the marina basin (a car collider), so its marker waits on land at the
// marina entrance, beside the middle pier. The freight yard sits at the
// north-west corner of the city; the boardwalk and pier run along the south
// beach edge; the safehouse is on the road at the south-west corner.
// District spots below are fallbacks: at mission start each named spot is
// re-resolved from world.systems.city.districts when the city system
// exposes it, so the markers follow the city worker's layout.
export const SPOTS = {
  coralClub: { x: 58, z: 29 },
  penthouse: { x: 51, z: 29 },
  courierDrops: [
    { x: -174, z: 116 },
    { x: 116, z: -174 },
    { x: 0, z: 174 },
  ],
  crew: [
    { x: 232, z: 58 },
    { x: 174, z: 232 },
  ],
  yacht: { x: 255, z: 160 },
  freightYard: { x: -170, z: -260 },
  boardwalk: { x: 0, z: 264 },
  pier: { x: 0, z: 318 },
  safehouse: { x: -174, z: 232 },
};

const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    reward: 500,
    intro: 'First Wheels — steal a car, then drive to the Coral Club.',
  },
  {
    id: 2,
    name: 'Courier Run',
    reward: 800,
    timeLimit: 150,
    intro: 'Courier Run — deliver 3 packages in 150 seconds.',
  },
  {
    id: 3,
    name: 'Hot Pursuit',
    reward: 1200,
    timeLimit: 60,
    intro: 'Hot Pursuit — survive 60 seconds at 3 stars.',
  },
  {
    id: 4,
    name: 'The Marina Job',
    reward: 2500,
    intro: 'The Marina Job — pick up your crew, then reach the yacht.',
  },
  {
    id: 5,
    name: 'Dourado Moves In',
    reward: 1500,
    intro: 'Dourado Moves In — the rival gang is at the freight yard. Drive there and run them off.',
  },
  {
    id: 6,
    name: 'The Port Run',
    reward: 2000,
    timeLimit: 180,
    intro: 'The Port Run — 3 drops in 180 seconds: the yard, the boardwalk, the marina.',
  },
  {
    id: 7,
    name: 'Five-Star Heat',
    reward: 2500,
    timeLimit: 75,
    intro: 'Five-Star Heat — survive 75 seconds at 5 stars. Don\'t lose the heat.',
  },
  {
    id: 8,
    name: 'The Coral Takeover',
    reward: 3000,
    intro: 'The Coral Takeover — gather your crew, take the tower, take the city.',
  },
];

const ARRIVE_DIST = 12; // metres from a marker that count as "arrived"
const PICKUP_DIST = 4; // metres from a crew member that count as "picked up"
const CELEBRATE_SECS = 3; // pause between missions

function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function atSpot(pos, spot) {
  return distXZ(pos, spot) <= ARRIVE_DIST;
}

function makeBeaconMesh() {
  // A flat gold disc on the ground plus a tall translucent beam, grouped so
  // the whole beacon can be moved to the active marker in one step.
  const group = new THREE.Group();
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xffd34d,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 24), discMat);
  disc.position.y = 0.15;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd34d,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 32, 12, 1, true), beamMat);
  beam.position.y = 16.25;
  group.add(disc);
  group.add(beam);
  group.visible = false;
  return { group, discMat, beamMat };
}

function makeCrewMesh() {
  // A simple orange-shirted figure, clearly different from street peds.
  const group = new THREE.Group();
  const shirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.9, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a }),
  );
  shirt.position.y = 1.05;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.75;
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.7, 0.35),
    new THREE.MeshBasicMaterial({ color: 0x223344 }),
  );
  legs.position.y = 0.35;
  group.add(shirt);
  group.add(head);
  group.add(legs);
  return group;
}

export function createMissions(world) {
  const defs = new Map(MISSIONS.map((m) => [m.id, m]));
  const beacon = makeBeaconMesh();
  if (world.scene) world.scene.add(beacon.group);

  const state = {
    current: 0, // id of the running mission, 0 = none yet
    stage: 0,
    missionsDone: [],
    debtLeft: DEBT_TOTAL,
    allDone: false,
    celebrate: 0, // seconds left in the post-mission pause
    failMessage: '',
  };
  // Save.js reads this same array reference; keep it on the world so the
  // save system never needs to import this module.
  world.missionsDone = state.missionsDone;

  function setObjective(text) {
    world.mission.objective = text;
    try {
      if (world.hud) world.hud.setObjective(text);
    } catch (err) {
      // The HUD is optional; a broken HUD hook never blocks the mission.
    }
  }

  function setMarker(spot) {
    if (!spot) {
      world.mission.marker = null;
      return;
    }
    if (world.mission.marker) {
      world.mission.marker.set(spot.x, 0, spot.z);
    } else {
      world.mission.marker = new THREE.Vector3(spot.x, 0, spot.z);
    }
  }

  function announce(text) {
    try {
      if (world.hud) world.hud.showMessage(text);
    } catch (err) {
      // The HUD is optional; a broken HUD hook never blocks the mission.
    }
  }

  function refillAmmo() {
    if (world.player) world.player.ammo = 24;
  }

  // Named spots prefer the city system's district table when it exists,
  // otherwise the hardcoded SPOTS fallbacks above. Every cross-system read
  // here is guarded: a missing city system just means the fallbacks win.
  function districtSpot(name) {
    try {
      const districts = world.systems && world.systems.city && world.systems.city.districts;
      const hit = districts && districts[name];
      if (hit && typeof hit.x === 'number' && typeof hit.z === 'number') {
        return { x: hit.x, z: hit.z };
      }
    } catch (err) {
      // Fall through to the hardcoded spot below.
    }
    return SPOTS[name];
  }

  function squadAround(centre, offsets) {
    return offsets.map(([dx, dz]) => ({ x: centre.x + dx, z: centre.z + dz }));
  }

  // The rival-squad combat API lives in another worker's file and may not
  // exist yet. Every call is guarded; a missing API means the mission falls
  // back to its drive-to objective instead of soft-locking.
  function combatSystem() {
    try {
      return (world.systems && world.systems.combat) || null;
    } catch (err) {
      return null;
    }
  }

  function trySpawnRivals(spots) {
    const combat = combatSystem();
    if (!combat || typeof combat.spawnRivalSquad !== 'function') return false;
    try {
      combat.spawnRivalSquad(spots);
      return true;
    } catch (err) {
      return false;
    }
  }

  // How many rivals are still standing, or null when the combat system
  // cannot answer (no API, or a bad return value).
  function rivalsLeft() {
    const combat = combatSystem();
    if (!combat || typeof combat.rivalsRemaining !== 'function') return null;
    try {
      const n = combat.rivalsRemaining();
      return typeof n === 'number' ? n : null;
    } catch (err) {
      return null;
    }
  }

  function startMission(id) {
    const def = defs.get(id);
    if (!def) return false;
    state.current = id;
    state.stage = 0;
    state.celebrate = 0;
    refillAmmo();
    // Resolve the arc-2 spots fresh for this mission so markers follow the
    // city layout whenever the city system exposes its district table.
    state.yardSpot = districtSpot('freightYard');
    state.clubSpot = districtSpot('coralClub');
    state.penthouseSpot = districtSpot('penthouse');
    state.safehouseSpot = districtSpot('safehouse');
    state.portDrops = [
      districtSpot('freightYard'),
      districtSpot('boardwalk'),
      districtSpot('yacht'),
    ];
    state.yardSquad = squadAround(state.yardSpot, [[8, 8], [-8, -8], [16, 0]]);
    state.towerSquad = squadAround(state.clubSpot, [[0, -9], [0, 11], [-18, 29]]);
    state.safehouseCrewSpots = [
      { x: state.safehouseSpot.x, z: state.safehouseSpot.z - 6 },
      { x: state.safehouseSpot.x + 6, z: state.safehouseSpot.z },
    ];
    world.mission.id = id;
    world.mission.stage = 0;
    world.mission.timer = def.timeLimit || 0;
    if (id === 1) {
      setMarker(null);
      setObjective('Steal a car — walk up to one and press E.');
    } else if (id === 2) {
      setMarker(SPOTS.courierDrops[0]);
      setObjective('Courier Run — deliver package 1 of 3.');
    } else if (id === 3) {
      world.wanted = 3;
      setMarker(null);
      setObjective('Hot Pursuit — survive 60s with the cops on you!');
    } else if (id === 4) {
      spawnCrew();
      setMarker(SPOTS.crew[0]);
      setObjective('The Marina Job — pick up crew member 1 of 2.');
    } else if (id === 5) {
      setMarker(state.yardSpot);
      setObjective('Dourado Moves In — drive to the freight yard.');
    } else if (id === 6) {
      setMarker(state.portDrops[0]);
      setObjective('The Port Run — drop 1 of 3. 180 seconds!');
    } else if (id === 7) {
      world.wanted = 5;
      setMarker(null);
      setObjective('Five-Star Heat — survive 75s at 5 stars!');
    } else if (id === 8) {
      spawnCrew(state.safehouseCrewSpots);
      setMarker(state.safehouseCrewSpots[0]);
      setObjective('The Coral Takeover — pick up crew member 1 of 2 at the safehouse.');
    }
    announce(`${def.name}: ${def.intro}`);
    return true;
  }

  function spawnCrew(spots) {
    // Crew members wait on the street as peds with a crew flag; walking up
    // to one collects them. They are removed from world.peds on pickup.
    // Defaults to the mission-4 crew spots; mission 8 passes its own list.
    const list = spots || SPOTS.crew;
    for (const spot of list) {
      const mesh = makeCrewMesh();
      mesh.position.set(spot.x, 0, spot.z);
      if (world.scene) world.scene.add(mesh);
      const ped = {
        mesh,
        pos: mesh.position,
        heading: 0,
        speed: 0,
        state: 'idle',
        crew: true,
        pickedUp: false,
      };
      world.peds.push(ped);
    }
    state.crewList = world.peds.filter((p) => p.crew && !p.pickedUp);
  }

  function removeCrewPed(ped) {
    ped.pickedUp = true;
    if (world.scene && ped.mesh) world.scene.remove(ped.mesh);
    const i = world.peds.indexOf(ped);
    if (i >= 0) world.peds.splice(i, 1);
  }

  function completeMission() {
    const def = defs.get(state.current);
    if (!def) return;
    world.cash += def.reward;
    if (world.player) world.player.cash = world.cash;
    state.debtLeft = Math.max(0, state.debtLeft - def.reward);
    state.missionsDone.push(def.id);
    // Missions 1-4 pay the debt down; from mission 5 on the debt is gone
    // and the reward just adds to Rico's cash.
    let doneText = `MISSION COMPLETE +$${def.reward}`;
    if (def.id <= 4) {
      doneText += ` — debt left: $${state.debtLeft}`;
      if (def.id === 4) {
        doneText += `. Debt paid — but the Dourado gang is moving on Coral's turf, and she needs you again.`;
      }
    } else {
      doneText += ` — cash: $${world.cash}`;
    }
    announce(doneText);
    try {
      if (world.audio) world.audio.jingle();
    } catch (err) {
      // Sound is optional; a missing or broken audio hook never blocks play.
    }
    if (world.events) world.events.push({ type: 'mission-complete', data: { id: def.id, reward: def.reward } });
    world.mission.id = 0;
    world.mission.stage = 0;
    world.mission.objective = '';
    world.mission.timer = 0;
    setMarker(null);
    if (state.missionsDone.length >= MISSIONS.length) {
      state.allDone = true;
      state.current = 0;
      announce('THE CORAL TAKEOVER — the Dourado are finished and Solmar City is yours, Rico.');
      return;
    }
    state.current = 0;
    state.celebrate = CELEBRATE_SECS;
  }

  function failMission(reason) {
    const def = defs.get(state.current);
    announce(`${reason} — ${def ? def.name : 'mission'} restarts.`);
    if (world.events) world.events.push({ type: 'mission-failed', data: { id: state.current, reason } });
    // Clean up anything the failed attempt left behind before restarting.
    if (state.current === 4 || state.current === 8) {
      for (const ped of [...world.peds]) if (ped.crew) removeCrewPed(ped);
      if (world.wanted > 0) world.wanted = 0;
    }
    if (state.current === 7 && world.wanted > 0) world.wanted = 0;
    const id = state.current;
    state.celebrate = CELEBRATE_SECS;
    state.current = 0;
    world.mission.id = 0;
    state.nextAfterCelebrate = id;
  }

  function updateMission1(dt) {
    if (state.stage === 0) {
      // Waiting for Rico to get into any car.
      if (world.player && world.player.car) {
        state.stage = 1;
        world.mission.stage = 1;
        setMarker(SPOTS.coralClub);
        setObjective('Drive to the Coral Club.');
      }
      return;
    }
    if (atSpot(world.player.pos, SPOTS.coralClub)) completeMission();
  }

  function updateMission2(dt) {
    world.mission.timer -= dt;
    if (world.mission.timer <= 0) {
      failMission("Time's up — the packages went cold");
      return;
    }
    const drop = SPOTS.courierDrops[state.stage];
    if (drop && atSpot(world.player.pos, drop)) {
      state.stage += 1;
      world.mission.stage = state.stage;
      if (state.stage >= SPOTS.courierDrops.length) {
        completeMission();
        return;
      }
      setMarker(SPOTS.courierDrops[state.stage]);
      setObjective(`Courier Run — deliver package ${state.stage + 1} of 3.`);
    }
  }

  function updateMission3(dt) {
    world.mission.timer -= dt;
    if (world.wanted < 1) {
      failMission('You lost the cops too fast — the heat has to stay on');
      return;
    }
    if (world.mission.timer <= 0) completeMission();
  }

  function beginYachtRun() {
    state.stage = 2;
    world.mission.stage = 2;
    world.wanted = 2;
    setMarker(SPOTS.yacht);
    setObjective('Drive to the yacht at the marina — lose the cops there!');
    announce('Crew aboard — the cops are coming. Get to the yacht!');
  }

  function updateMission4(dt) {
    if (state.stage <= 1) {
      // Walk up to each crew member in turn; they join once collected.
      const crew = (state.crewList || []).filter((p) => !p.pickedUp);
      const target = crew[0];
      if (!target) {
        beginYachtRun();
        return;
      }
      setMarker({ x: target.pos.x, z: target.pos.z });
      if (distXZ(world.player.pos, target.pos) <= PICKUP_DIST) {
        removeCrewPed(target);
        state.stage += 1;
        world.mission.stage = state.stage;
        if (state.stage <= 1) {
          setObjective('The Marina Job — pick up crew member 2 of 2.');
        } else {
          beginYachtRun();
        }
      }
      return;
    }
    // Stage 2: reach the yacht while wanted level 2 chases the player.
    if (atSpot(world.player.pos, SPOTS.yacht)) completeMission();
  }

  function updateMission5(dt) {
    if (state.stage === 0) {
      // Drive to the freight yard; the Dourado squad is waiting there.
      if (atSpot(world.player.pos, state.yardSpot)) {
        const spawned = trySpawnRivals(state.yardSquad);
        if (!spawned || rivalsLeft() === null) {
          // No rival-squad system: reaching the yard is the job.
          completeMission();
          return;
        }
        state.stage = 1;
        world.mission.stage = 1;
        setMarker(state.yardSpot);
        setObjective('Dourado Moves In — defeat the rival squad at the yard!');
        announce('Dourado crew at the freight yard — take them down!');
      }
      return;
    }
    // Stage 1: the fight — done when no rivals are left standing.
    const left = rivalsLeft();
    if (left === null || left <= 0) completeMission();
  }

  function updateMission6(dt) {
    // Timed courier, same pattern as mission 2: one stage per drop.
    world.mission.timer -= dt;
    if (world.mission.timer <= 0) {
      failMission("Time's up — the port drops went cold");
      return;
    }
    const drops = state.portDrops || [SPOTS.freightYard, SPOTS.boardwalk, SPOTS.yacht];
    const drop = drops[state.stage];
    if (drop && atSpot(world.player.pos, drop)) {
      state.stage += 1;
      world.mission.stage = state.stage;
      if (state.stage >= drops.length) {
        completeMission();
        return;
      }
      setMarker(drops[state.stage]);
      setObjective(`The Port Run — drop ${state.stage + 1} of 3.`);
    }
  }

  function updateMission7(dt) {
    // Same pattern as mission 3, but at 5 stars for 75 seconds — and the
    // job is blown if the heat drops below 3 stars.
    world.mission.timer -= dt;
    if (world.wanted < 3) {
      failMission('You lost the heat too fast — the five-star show needs the cops on you');
      return;
    }
    if (world.mission.timer <= 0) completeMission();
  }

  function updateMission8(dt) {
    if (state.stage === 0) {
      // Walk up to each crew member waiting at the safehouse; they join
      // once collected. Same walk-up pattern as mission 4.
      const crew = (state.crewList || []).filter((p) => !p.pickedUp);
      const target = crew[0];
      if (!target) {
        state.stage = 1;
        world.mission.stage = 1;
        setMarker(state.clubSpot);
        setObjective('The Coral Takeover — drive to the Coral Club.');
        return;
      }
      setMarker({ x: target.pos.x, z: target.pos.z });
      if (distXZ(world.player.pos, target.pos) <= PICKUP_DIST) {
        removeCrewPed(target);
        const stillWaiting = (state.crewList || []).filter((p) => !p.pickedUp).length;
        if (stillWaiting === 0) {
          state.stage = 1;
          world.mission.stage = 1;
          setMarker(state.clubSpot);
          setObjective('The Coral Takeover — drive to the Coral Club.');
        } else {
          setObjective('The Coral Takeover — pick up crew member 2 of 2.');
        }
      }
      return;
    }
    if (state.stage === 1) {
      // Drive to the Coral Club; the Dourado squad holds the tower.
      if (atSpot(world.player.pos, state.clubSpot)) {
        const spawned = trySpawnRivals(state.towerSquad);
        if (!spawned || rivalsLeft() === null) {
          // No rival-squad system: head straight for the penthouse.
          state.stage = 3;
          world.mission.stage = 3;
          setMarker(state.penthouseSpot);
          setObjective('The Coral Takeover — reach the penthouse at the tower door!');
        } else {
          state.stage = 2;
          world.mission.stage = 2;
          setMarker(state.clubSpot);
          setObjective('The Coral Takeover — defeat the Dourado squad at the tower!');
          announce('Dourado squad at the Coral Club — take the tower back!');
        }
      }
      return;
    }
    if (state.stage === 2) {
      // The fight — done when no rivals are left standing.
      const left = rivalsLeft();
      if (left === null || left <= 0) {
        state.stage = 3;
        world.mission.stage = 3;
        setMarker(state.penthouseSpot);
        setObjective('The Coral Takeover — reach the penthouse at the tower door!');
        announce('Tower clear — get to the penthouse!');
      }
      return;
    }
    // Stage 3: reach the penthouse marker at the tower door to take the city.
    if (atSpot(world.player.pos, state.penthouseSpot)) completeMission();
  }

  function update(dt) {
    // The beacon always follows the live marker, pulsing gently so it reads
    // from across the city. It hides when there is no marker.
    const marker = world.mission.marker;
    if (marker && world.mode === 'play') {
      const t = world.time || 0;
      const pulse = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 1.5);
      beacon.group.visible = true;
      beacon.group.position.set(marker.x, 1.2 + 0.25 * Math.sin((2 * Math.PI * t) / 3), marker.z);
      beacon.beamMat.opacity = 0.18 + 0.3 * pulse;
      beacon.discMat.opacity = 0.6 + 0.35 * pulse;
      const s = 1 + 0.15 * pulse;
      beacon.group.scale.set(s, 1, s);
    } else {
      beacon.group.visible = false;
    }

    if (world.mode !== 'play' || state.allDone) return;

    if (state.celebrate > 0) {
      state.celebrate -= dt;
      if (state.celebrate <= 0) {
        const next = state.nextAfterCelebrate || Math.max(...state.missionsDone, 0) + 1;
        state.nextAfterCelebrate = 0;
        startMission(next);
      }
      return;
    }

    if (state.current === 0) {
      // First frame of a run: mission 1 starts automatically.
      startMission(state.missionsDone.length + 1);
      return;
    }

    if (state.current === 1) updateMission1(dt);
    else if (state.current === 2) updateMission2(dt);
    else if (state.current === 3) updateMission3(dt);
    else if (state.current === 4) updateMission4(dt);
    else if (state.current === 5) updateMission5(dt);
    else if (state.current === 6) updateMission6(dt);
    else if (state.current === 7) updateMission7(dt);
    else if (state.current === 8) updateMission8(dt);
  }

  return { update, startMission, state, beacon: beacon.group };
}
