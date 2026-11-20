// Missions 33-40 — Don's Gambit (M33-36, $50,000) and Vice King (M37-40, $55,000).
// The feds are watching, the mole is talking, and the rival casino has to be beaten at
// its own tables. Gambit is shadows and paperwork; Vice King is felt, dice and speed.
//
// Contract: each mission is { id, name, payout, advance, stages, onComplete }.
// Stage kinds: reach | fight | deliver | survive | tail | escort | timed.
// The runner advances stages and calls mission.onComplete on completion; the runner
// pays out mission.payout. Fight stages complete only when the enemy list is empty.
//
// CRITICAL: M37 has advance=false — it is staged and advances only on its own
// trigger, never auto-advance. M38/M40 heli stages complete on their timers once boarded.

const LOC = {
  anchorBar: { x: -200, z: 100 },
  docks: { x: 480, z: 380 },
  docksWarehouse: { x: 505, z: 355 },
  marina: { x: 350, z: -420 },
  islands: { x: 700, z: -500 },
  oldTown: { x: -350, z: 250 },
  hideout: { x: -365, z: 265 },
  vineyard: { x: -500, z: -480 },
  vineyardGate: { x: -470, z: -460 },
  casino: { x: 120, z: 180 },
  highRollerTable: { x: 132, z: 172 },
  rouletteTable: { x: 112, z: 188 },
  littleHavana: { x: -300, z: -350 },
  clubNeon: { x: 60, z: 220 },
  coralClub: { x: -80, z: -120 },
  coralRoof: { x: -80, z: -120 },
  helipad: { x: 60, z: 205 },
  downtown: { x: 0, z: 0 },
  fedVanRoute: { x: 150, z: 60 },
};

function spawnShooters(world, list) {
  const combat = world.systemObjects && world.systemObjects.combat;
  if (!combat || typeof combat.spawnShooter !== 'function') return;
  for (const spec of list) {
    try { combat.spawnShooter(spec.x, spec.z, spec); } catch { /* combat unavailable */ }
  }
}

function gambitFlag(world, key, value) {
  if (!world.gambit) world.gambit = {};
  world.gambit[key] = value;
}

function viceFlag(world, key, value) {
  if (!world.vice) world.vice = { casinoWinnings: 0, racePoints: 0, raceWins: 0 };
  world.vice[key] = value;
}

function note(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'mission', text });
}

export const missions10 = [
  {
    id: 'M33',
    name: 'Eyes on the Feds',
    payout: 6000,
    advance: true,
    stages: [
      {
        kind: 'tail',
        objective: 'Tail the federal surveillance van without being spotted',
        marker: { x: LOC.fedVanRoute.x, z: LOC.fedVanRoute.z },
        radius: 16,
        timer: 180,
        stealth: true,
        failOnSpotted: true,
      },
      {
        kind: 'reach',
        objective: 'Note the van\'s drop point and slip away',
        marker: { x: LOC.downtown.x, z: LOC.downtown.z },
        radius: 12,
      },
    ],
    onComplete(world) {
      gambitFlag(world, 'vanTailed', true);
      note(world, 'Federal surveillance van tailed clean. You know their routes now.');
    },
  },
  {
    id: 'M34',
    name: 'Night Crossing',
    payout: 12000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Load $50,000 of empire money onto the boat at the marina — after dark',
        marker: { x: LOC.marina.x, z: LOC.marina.z },
        radius: 12,
        boatStage: true,
        nightOnly: true,
      },
      {
        kind: 'timed',
        objective: 'Run the money to The Islands by boat, lights off',
        marker: { x: LOC.islands.x, z: LOC.islands.z },
        radius: 16,
        timer: 240,
        boatStage: true,
      },
      {
        kind: 'deliver',
        objective: 'Hand the money to the island contact',
        marker: { x: LOC.islands.x, z: LOC.islands.z },
        radius: 12,
      },
    ],
    onComplete(world) {
      gambitFlag(world, 'moneyMoved', true);
      note(world, '$50,000 moved to The Islands by night boat. The feds never saw a wake.');
    },
  },
  {
    id: 'M35',
    name: 'The Mole',
    payout: 14000,
    advance: true,
    stages: [
      {
        kind: 'tail',
        objective: 'Follow the mole from the Anchor Bar to the Docks',
        marker: { x: LOC.docks.x, z: LOC.docks.z },
        radius: 14,
        timer: 200,
        stealth: true,
      },
      {
        kind: 'fight',
        objective: 'Confront the mole and his backup at the Docks',
        marker: { x: LOC.docksWarehouse.x, z: LOC.docksWarehouse.z },
        radius: 18,
        enemies: [
          { x: 498, z: 348 }, { x: 512, z: 348 }, { x: 505, z: 362 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: 498, z: 348 }, { x: 512, z: 348 }, { x: 505, z: 362 },
          ]);
        },
      },
    ],
    onComplete(world) {
      gambitFlag(world, 'moleConfronted', true);
      note(world, 'The mole is dealt with. Nobody in the crew talks to the feds anymore.');
    },
  },
  {
    id: 'M36',
    name: 'False Flag',
    payout: 18000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Reach the rival hideout in Old Town',
        marker: { x: LOC.hideout.x, z: LOC.hideout.z },
        radius: 12,
      },
      {
        kind: 'timed',
        objective: 'Plant the false evidence before the hideout crew returns',
        marker: { x: LOC.hideout.x, z: LOC.hideout.z },
        radius: 10,
        timer: 90,
      },
      {
        kind: 'timed',
        objective: 'Drive the Armored Limo to the vineyard estate while the feds raid the rivals',
        marker: { x: LOC.vineyardGate.x, z: LOC.vineyardGate.z },
        radius: 14,
        timer: 180,
        vehicle: 'armoredLimo',
      },
    ],
    onComplete(world) {
      gambitFlag(world, 'evidencePlanted', true);
      gambitFlag(world, 'gambitComplete', true);
      note(world, 'The feds raided the rivals on your planted evidence. The Gambit paid off.');
    },
  },
  {
    id: 'M37',
    name: 'Loaded Dice',
    payout: 8000,
    // Staged mission: advances only on its own trigger, NEVER auto-advance.
    advance: false,
    stages: [
      {
        kind: 'reach',
        objective: 'Get inside the rival casino on the strip',
        marker: { x: LOC.casino.x, z: LOC.casino.z },
        radius: 12,
      },
      {
        kind: 'timed',
        objective: 'Rig the rival casino\'s roulette table — keep wanted at 2 stars or less',
        marker: { x: LOC.rouletteTable.x, z: LOC.rouletteTable.z },
        radius: 10,
        timer: 120,
        maxWanted: 2,
        silent: true,
      },
    ],
    onComplete(world) {
      viceFlag(world, 'casinoRigged', true);
      note(world, 'Rival roulette table rigged, no heat raised. Their house edge is yours now.');
    },
  },
  {
    id: 'M38',
    name: 'High Roller',
    payout: 13000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Take a seat at the high-roller table',
        marker: { x: LOC.highRollerTable.x, z: LOC.highRollerTable.z },
        radius: 10,
      },
      {
        kind: 'timed',
        objective: 'Win $20,000 at the high-roller table',
        marker: { x: LOC.highRollerTable.x, z: LOC.highRollerTable.z },
        radius: 10,
        timer: 300,
        winTarget: 20000,
      },
      {
        kind: 'timed',
        objective: 'Escape the rival ambush in your helicopter',
        marker: { x: LOC.helipad.x, z: LOC.helipad.z },
        radius: 14,
        timer: 90,
        heliStage: true,
      },
    ],
    onComplete(world) {
      viceFlag(world, 'highRollerWon', true);
      note(world, '$20,000 won at the high-roller table — and out by helicopter before they could take it back.');
    },
  },
  {
    id: 'M39',
    name: 'Havana Run',
    payout: 15000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Pick up the goods in Little Havana',
        marker: { x: LOC.littleHavana.x, z: LOC.littleHavana.z },
        radius: 12,
      },
      {
        kind: 'timed',
        objective: 'Smuggle the goods to The Islands by boat at night',
        marker: { x: LOC.islands.x, z: LOC.islands.z },
        radius: 16,
        timer: 240,
        boatStage: true,
        nightOnly: true,
      },
      {
        kind: 'deliver',
        objective: 'Deliver the goods to the island buyer',
        marker: { x: LOC.islands.x, z: LOC.islands.z },
        radius: 12,
      },
    ],
    onComplete(world) {
      viceFlag(world, 'smuggled', true);
      note(world, 'Havana goods delivered to The Islands. The night route is yours.');
    },
  },
  {
    id: 'M40',
    name: 'Vice King',
    payout: 19000,
    advance: true,
    stages: [
      {
        kind: 'survive',
        objective: 'Defend Club Neon from the rival assault',
        marker: { x: LOC.clubNeon.x, z: LOC.clubNeon.z },
        radius: 18,
        timer: 120,
        enemies: [
          { x: 52, z: 212 }, { x: 68, z: 212 }, { x: 52, z: 228 },
          { x: 68, z: 228 }, { x: 60, z: 205 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: 52, z: 212 }, { x: 68, z: 212 }, { x: 52, z: 228 },
            { x: 68, z: 228 }, { x: 60, z: 205 },
          ]);
        },
      },
      {
        kind: 'timed',
        objective: 'Fly the helicopter to the Coral Club rooftop',
        marker: { x: LOC.coralRoof.x, z: LOC.coralRoof.z },
        radius: 16,
        timer: 90,
        heliStage: true,
      },
      {
        kind: 'reach',
        objective: 'Claim the Vice King crown on the Coral Club rooftop',
        marker: { x: LOC.coralRoof.x, z: LOC.coralRoof.z },
        radius: 16,
      },
    ],
    onComplete(world) {
      viceFlag(world, 'viceKingCrowned', true);
      viceFlag(world, 'viceComplete', true);
      note(world, 'Vice King crowned on the Coral Club rooftop. The strip answers to you.');
    },
  },
];

export default missions10;

// Factory (integration): register this arc into world.missionRegistry so the
// shared runner in missions.js can start it. Registered under both the
// mission id ('M21') and the lowercase key ('m21') the M1-M20 factories use.
export function createMissions10(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;
  for (const m of missions10) {
    R[m.id] = m;
    R[m.id.toLowerCase()] = m;
  }
  return R;
}
