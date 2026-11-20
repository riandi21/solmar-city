// Missions 41-44 — The Kingpin arc ($59,000 total). The finale.
// The cartel comes for everything you built: intercept their shipment, protect the
// informant who can bury them, survive the siege of the Coral Club tower, then take
// down the cartel boss at the airfield and leave Solmar by seaplane as the sun sets.
//
// Contract: each mission is { id, name, payout, advance, stages, onComplete }.
// Stage kinds: reach | fight | deliver | survive | tail | escort | timed.
// The runner advances stages and calls mission.onComplete on completion; the runner
// pays out mission.payout. Fight stages complete only when the enemy list is empty.
//
// CRITICAL: M43 tower stages use a reach radius of 16m — the tower collider is 26x26m
// and the closest approach is 13.45m, so a 9m radius could never be reached.

const LOC = {
  freightYard: { x: 420, z: 300 },
  docks: { x: 480, z: 380 },
  docksWarehouse: { x: 505, z: 355 },
  safehouse: { x: -150, z: -50 },
  sunsetPier: { x: -450, z: 420 },
  coralClub: { x: -80, z: -120 },
  airfield: { x: 300, z: 100 },
  runway: { x: 340, z: 140 },
  runwayEnd: { x: 420, z: 180 },
  seaplane: { x: 430, z: 190 },
  islands: { x: 700, z: -500 },
  downtown: { x: 0, z: 0 },
};

function spawnShooters(world, list, opts) {
  const combat = world.systemObjects && world.systemObjects.combat;
  if (!combat || typeof combat.spawnShooter !== 'function') return;
  for (const spec of list) {
    try { combat.spawnShooter(spec.x, spec.z, { ...(opts || {}), ...spec }); } catch { /* combat unavailable */ }
  }
}

function spawnHitmen(world, list) {
  const cartel = world.systemObjects && world.systemObjects.cartel;
  if (cartel && typeof cartel.spawnHitman === 'function') {
    for (const spec of list) {
      try { cartel.spawnHitman(spec.x, spec.z, spec); } catch { /* cartel system unavailable */ }
    }
    return;
  }
  spawnShooters(world, list, { cartel: true });
}

function kingpinFlag(world, key, value) {
  if (!world.kingpin) {
    world.kingpin = {
      shipmentSeized: false, informantProtected: false, siegeSurvived: false,
      kingpinCrowned: false, fishingBest: 0, jetSkiBest: 0,
    };
  }
  world.kingpin[key] = value;
}

function note(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'mission', text });
}

export const missions11 = [
  {
    id: 'M41',
    name: 'The Shipment',
    payout: 9000,
    advance: true,
    stages: [
      {
        kind: 'tail',
        objective: 'Tail the cartel truck from the freight yard to the Docks warehouse',
        marker: { x: LOC.docksWarehouse.x, z: LOC.docksWarehouse.z },
        radius: 14,
        timer: 200,
      },
      {
        kind: 'fight',
        objective: 'Seize the cargo — 3-on-1 against the cartel guards',
        marker: { x: LOC.docksWarehouse.x, z: LOC.docksWarehouse.z },
        radius: 18,
        enemies: [
          { x: 498, z: 348 }, { x: 512, z: 348 }, { x: 505, z: 362 },
        ],
        onEnter(world) {
          spawnHitmen(world, [
            { x: 498, z: 348 }, { x: 512, z: 348 }, { x: 505, z: 362 },
          ]);
        },
      },
      {
        kind: 'deliver',
        objective: 'Drive the seized shipment to the safehouse',
        marker: { x: LOC.safehouse.x, z: LOC.safehouse.z },
        radius: 10,
        timer: 150,
      },
    ],
    onComplete(world) {
      kingpinFlag(world, 'shipmentSeized', true);
      if (typeof world.cartelThreat === 'number') {
        world.cartelThreat = Math.max(0, world.cartelThreat - 20);
      }
      note(world, 'Cartel shipment seized. Cartel threat down — they know your name now.');
    },
  },
  {
    id: 'M42',
    name: 'The Informant',
    payout: 14000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Pick up the informant at the Sunset Beach pier',
        marker: { x: LOC.sunsetPier.x, z: LOC.sunsetPier.z },
        radius: 10,
      },
      {
        kind: 'escort',
        objective: 'Escort the informant through the city — cartel hit squads are hunting him',
        marker: { x: LOC.safehouse.x, z: LOC.safehouse.z },
        radius: 12,
        protectTarget: 'informant',
        enemies: [
          { x: -300, z: 300 }, { x: -280, z: 320 },
        ],
        onEnter(world) {
          spawnHitmen(world, [
            { x: -300, z: 300 }, { x: -280, z: 320 },
          ]);
        },
      },
      {
        kind: 'escort',
        objective: 'Second hit squad on the route — keep the informant alive',
        marker: { x: LOC.safehouse.x, z: LOC.safehouse.z },
        radius: 12,
        protectTarget: 'informant',
        enemies: [
          { x: -200, z: 100 }, { x: -180, z: 80 },
        ],
        onEnter(world) {
          spawnHitmen(world, [
            { x: -200, z: 100 }, { x: -180, z: 80 },
          ]);
        },
      },
      {
        kind: 'survive',
        objective: 'Lose the 3-star wanted level with the informant safe',
        marker: { x: LOC.safehouse.x, z: LOC.safehouse.z },
        radius: 12,
        timer: 120,
        wantedToLose: 3,
      },
    ],
    onComplete(world) {
      kingpinFlag(world, 'informantProtected', true);
      note(world, 'Informant safe at the safehouse. His testimony can bury the cartel.');
    },
  },
  {
    id: 'M43',
    name: 'The Siege',
    payout: 16000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Get to the Coral Club tower — the cartel is laying siege',
        // 16m radius: the tower collider is 26x26m, closest approach 13.45m.
        marker: { x: LOC.coralClub.x, z: LOC.coralClub.z },
        radius: 16,
      },
      {
        kind: 'survive',
        objective: 'Defend the tower with the crew — wave 1 of the cartel siege',
        marker: { x: LOC.coralClub.x, z: LOC.coralClub.z },
        radius: 16,
        timer: 40,
        enemies: [
          { x: -96, z: -136 }, { x: -64, z: -136 }, { x: -96, z: -104 },
        ],
        onEnter(world) {
          spawnHitmen(world, [
            { x: -96, z: -136 }, { x: -64, z: -136 }, { x: -96, z: -104 },
          ]);
        },
      },
      {
        kind: 'survive',
        objective: 'Hold the tower — wave 2',
        marker: { x: LOC.coralClub.x, z: LOC.coralClub.z },
        radius: 16,
        timer: 40,
        enemies: [
          { x: -64, z: -104 }, { x: -96, z: -120 }, { x: -64, z: -120 }, { x: -80, z: -144 },
        ],
        onEnter(world) {
          spawnHitmen(world, [
            { x: -64, z: -104 }, { x: -96, z: -120 }, { x: -64, z: -120 }, { x: -80, z: -144 },
          ]);
        },
      },
      {
        kind: 'survive',
        objective: 'Hold the tower — final wave',
        marker: { x: LOC.coralClub.x, z: LOC.coralClub.z },
        radius: 16,
        timer: 40,
        enemies: [
          { x: -96, z: -136 }, { x: -64, z: -136 }, { x: -96, z: -104 },
          { x: -64, z: -104 }, { x: -80, z: -96 },
        ],
        onEnter(world) {
          spawnHitmen(world, [
            { x: -96, z: -136 }, { x: -64, z: -136 }, { x: -96, z: -104 },
            { x: -64, z: -104 }, { x: -80, z: -96 },
          ]);
        },
      },
      {
        kind: 'timed',
        objective: 'Chase the siege leader\'s car to the Docks',
        marker: { x: LOC.docks.x, z: LOC.docks.z },
        radius: 12,
        timer: 150,
      },
    ],
    onComplete(world) {
      kingpinFlag(world, 'siegeSurvived', true);
      if (typeof world.cartelThreat === 'number') {
        world.cartelThreat = Math.max(0, world.cartelThreat - 30);
      }
      note(world, 'The siege is broken and its leader ran for the Docks. One man left: the boss.');
    },
  },
  {
    id: 'M44',
    name: 'The Kingpin',
    payout: 20000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Reach the airfield — the cartel boss is leaving Solmar',
        marker: { x: LOC.airfield.x, z: LOC.airfield.z },
        radius: 14,
      },
      {
        kind: 'fight',
        objective: 'Fight through the boss\'s guards on the tarmac',
        marker: { x: LOC.runway.x, z: LOC.runway.z },
        radius: 22,
        enemies: [
          { x: 332, z: 132 }, { x: 348, z: 132 }, { x: 332, z: 148 },
          { x: 348, z: 148 }, { x: 340, z: 122 }, { x: 340, z: 158 },
        ],
        onEnter(world) {
          spawnHitmen(world, [
            { x: 332, z: 132 }, { x: 348, z: 132 }, { x: 332, z: 148 },
            { x: 348, z: 148 }, { x: 340, z: 122 }, { x: 340, z: 158 },
          ]);
        },
      },
      {
        kind: 'timed',
        objective: 'Chase the boss\'s plane down the runway',
        marker: { x: LOC.runwayEnd.x, z: LOC.runwayEnd.z },
        radius: 14,
        timer: 90,
      },
      {
        kind: 'timed',
        objective: 'Escape by seaplane to The Islands as the sun sets',
        marker: { x: LOC.islands.x, z: LOC.islands.z },
        radius: 16,
        timer: 120,
        seaplaneStage: true,
      },
    ],
    onComplete(world) {
      kingpinFlag(world, 'kingpinCrowned', true);
      kingpinFlag(world, 'kingpinComplete', true);
      if (!world.crown) world.crown = {};
      world.crown.kingpin = true;
      if (Array.isArray(world.events)) {
        world.events.push({ type: 'kingpin', text: 'Kingpin of Solmar' });
      }
      note(world, 'The cartel boss is finished. You are the Kingpin of Solmar.');
    },
  },
];

export default missions11;

// Factory (integration): register this arc into world.missionRegistry so the
// shared runner in missions.js can start it. Registered under both the
// mission id ('M21') and the lowercase key ('m21') the M1-M20 factories use.
export function createMissions11(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;
  for (const m of missions11) {
    R[m.id] = m;
    R[m.id.toLowerCase()] = m;
  }
  return R;
}
