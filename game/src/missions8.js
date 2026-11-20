// Missions 25-28 — Coral Crown arc ($40,000 total).
// A crown that decides who rules Solmar's underworld. Meet the informant, crack the
// Coral Club vault, survive the betrayal, then take the crown off the rooftop in the
// North Hills — and get out by helicopter.
//
// Contract: each mission is { id, name, payout, advance, stages, onComplete }.
// Stage kinds: reach | fight | deliver | survive | tail | escort | timed.
// The runner advances stages and calls mission.onComplete on completion; the runner
// pays out mission.payout. Fight stages complete only when the enemy list is empty.

const LOC = {
  anchorBar: { x: -200, z: 100 },
  northHills: { x: 150, z: -520 },
  mansionGate: { x: 150, z: -480 },
  mansionRoof: { x: 150, z: -520 },
  helipad: { x: 175, z: -520 },
  coralClub: { x: -80, z: -120 },
  coralVault: { x: -80, z: -140 },
  freightYard: { x: 420, z: 300 },
  docks: { x: 480, z: 380 },
  safehouse: { x: -150, z: -50 },
};

function spawnShooters(world, list) {
  const combat = world.systemObjects && world.systemObjects.combat;
  if (!combat || typeof combat.spawnShooter !== 'function') return;
  for (const spec of list) {
    try { combat.spawnShooter(spec.x, spec.z, spec); } catch { /* combat unavailable */ }
  }
}

function flag(world, key, value) {
  if (!world.crown) world.crown = {};
  world.crown[key] = value;
}

function note(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'mission', text });
}

export const missions8 = [
  {
    id: 'M25',
    name: 'The Informant',
    payout: 7000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Meet the informant at the Anchor Bar',
        marker: { x: LOC.anchorBar.x, z: LOC.anchorBar.z },
        radius: 10,
      },
      {
        kind: 'tail',
        objective: 'Tail his contact to the North Hills mansion — do not lose him',
        marker: { x: LOC.mansionGate.x, z: LOC.mansionGate.z },
        radius: 14,
        timer: 240,
      },
    ],
    onComplete(world) {
      flag(world, 'informantMet', true);
      flag(world, 'mansionLocated', true);
      note(world, 'The contact led you to a mansion in the North Hills. The crown is there.');
    },
  },
  {
    id: 'M26',
    name: 'The Coral Vault',
    payout: 9000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Get into the Coral Club with the crew',
        marker: { x: LOC.coralClub.x, z: LOC.coralClub.z },
        radius: 12,
      },
      {
        kind: 'fight',
        objective: 'Take down the vault guards',
        marker: { x: LOC.coralVault.x, z: LOC.coralVault.z },
        radius: 18,
        enemies: [
          { x: -88, z: -148 }, { x: -72, z: -148 }, { x: -88, z: -132 }, { x: -72, z: -132 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: -88, z: -148 }, { x: -72, z: -148 }, { x: -88, z: -132 }, { x: -72, z: -132 },
          ]);
        },
      },
      {
        kind: 'timed',
        objective: 'Crack the vault before the silent alarm brings the cops',
        marker: { x: LOC.coralVault.x, z: LOC.coralVault.z },
        radius: 10,
        timer: 90,
      },
      {
        kind: 'deliver',
        objective: 'Get the vault loot to the safehouse',
        marker: { x: LOC.safehouse.x, z: LOC.safehouse.z },
        radius: 10,
        timer: 150,
      },
    ],
    onComplete(world) {
      flag(world, 'vaultHit', true);
      note(world, 'Coral Club vault cracked. The crew is paid — and the mansion job is funded.');
    },
  },
  {
    id: 'M27',
    name: 'The Betrayal',
    payout: 10000,
    advance: true,
    stages: [
      {
        kind: 'survive',
        objective: 'Survive the ambush at the freight yard — someone sold you out',
        marker: { x: LOC.freightYard.x, z: LOC.freightYard.z },
        radius: 20,
        timer: 90,
        waves: 2,
        enemies: [
          { x: 410, z: 290 }, { x: 430, z: 290 }, { x: 410, z: 310 },
          { x: 430, z: 310 }, { x: 420, z: 285 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: 410, z: 290 }, { x: 430, z: 290 }, { x: 410, z: 310 },
            { x: 430, z: 310 }, { x: 420, z: 285 },
          ]);
        },
      },
      {
        kind: 'timed',
        objective: 'Chase the traitor to the Docks before he slips away',
        marker: { x: LOC.docks.x, z: LOC.docks.z },
        radius: 12,
        timer: 120,
      },
    ],
    onComplete(world) {
      flag(world, 'traitorChased', true);
      flag(world, 'betrayalSurvived', true);
      note(world, 'The traitor ran for the Docks. You know his face now — and he knows you do.');
    },
  },
  {
    id: 'M28',
    name: 'The Crown',
    payout: 14000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Storm the North Hills mansion — breach the gate',
        marker: { x: LOC.mansionGate.x, z: LOC.mansionGate.z },
        radius: 12,
      },
      {
        kind: 'fight',
        objective: 'Fight through the mansion guards to the rooftop stair',
        marker: { x: LOC.northHills.x, z: LOC.northHills.z },
        radius: 20,
        enemies: [
          { x: 142, z: -528 }, { x: 158, z: -528 }, { x: 142, z: -512 },
          { x: 158, z: -512 }, { x: 150, z: -532 }, { x: 150, z: -508 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: 142, z: -528 }, { x: 158, z: -528 }, { x: 142, z: -512 },
            { x: 158, z: -512 }, { x: 150, z: -532 }, { x: 150, z: -508 },
          ]);
        },
      },
      {
        kind: 'reach',
        objective: 'Take the crown from the rooftop',
        marker: { x: LOC.mansionRoof.x, z: LOC.mansionRoof.z },
        radius: 10,
      },
      {
        kind: 'timed',
        objective: 'Escape by helicopter from the mansion helipad',
        marker: { x: LOC.helipad.x, z: LOC.helipad.z },
        radius: 12,
        timer: 60,
        heliStage: true,
      },
    ],
    onComplete(world) {
      flag(world, 'crownTaken', true);
      flag(world, 'coralCrownComplete', true);
      note(world, 'The Coral Crown is yours. Solmar bows to a new ruler.');
    },
  },
];

export default missions8;

// Factory (integration): register this arc into world.missionRegistry so the
// shared runner in missions.js can start it. Registered under both the
// mission id ('M21') and the lowercase key ('m21') the M1-M20 factories use.
export function createMissions8(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;
  for (const m of missions8) {
    R[m.id] = m;
    R[m.id.toLowerCase()] = m;
  }
  return R;
}
