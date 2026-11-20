// Missions 29-32 — Solmar Legacy arc ($45,000 total).
// The empire has to be held, not just taken: collect protection money, burn out the
// rival hideout in Old Town, run the marina blockade by boat to supply The Islands,
// then hold the Coral Club tower against a full rival assault and run the rival boss's
// seaplane down to The Islands airstrip.
//
// Contract: each mission is { id, name, payout, advance, stages, onComplete }.
// Stage kinds: reach | fight | deliver | survive | tail | escort | timed.
// The runner advances stages and calls mission.onComplete on completion; the runner
// pays out mission.payout. Fight stages complete only when the enemy list is empty.

const LOC = {
  downtown: { x: 0, z: 0 },
  marketStall: { x: -60, z: 40 },
  garage: { x: 90, z: -60 },
  pawnShop: { x: 30, z: 130 },
  oldTown: { x: -350, z: 250 },
  hideout: { x: -365, z: 265 },
  marina: { x: 350, z: -420 },
  islands: { x: 700, z: -500 },
  islandsAirstrip: { x: 720, z: -470 },
  coralClub: { x: -80, z: -120 },
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
  if (!world.legacy) world.legacy = {};
  world.legacy[key] = value;
}

function note(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'mission', text });
}

export const missions9 = [
  {
    id: 'M29',
    name: 'Protection',
    payout: 8000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Collect protection money from the market stall',
        marker: { x: LOC.marketStall.x, z: LOC.marketStall.z },
        radius: 10,
      },
      {
        kind: 'reach',
        objective: 'Collect protection money from the garage',
        marker: { x: LOC.garage.x, z: LOC.garage.z },
        radius: 10,
      },
      {
        kind: 'reach',
        objective: 'Collect protection money from the pawn shop',
        marker: { x: LOC.pawnShop.x, z: LOC.pawnShop.z },
        radius: 10,
      },
      {
        kind: 'deliver',
        objective: 'Bring the take back to the safehouse',
        marker: { x: LOC.safehouse.x, z: LOC.safehouse.z },
        radius: 10,
      },
    ],
    onComplete(world) {
      flag(world, 'protectionCollected', true);
      note(world, 'Protection money collected from all three businesses. The streets pay up.');
    },
  },
  {
    id: 'M30',
    name: 'Old Town Raid',
    payout: 10000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Reach the rival hideout in Old Town',
        marker: { x: LOC.hideout.x, z: LOC.hideout.z },
        radius: 12,
      },
      {
        kind: 'fight',
        objective: 'Clear the rival hideout',
        marker: { x: LOC.hideout.x, z: LOC.hideout.z },
        radius: 20,
        enemies: [
          { x: -373, z: 257 }, { x: -357, z: 257 }, { x: -373, z: 273 },
          { x: -357, z: 273 }, { x: -365, z: 252 }, { x: -365, z: 278 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: -373, z: 257 }, { x: -357, z: 257 }, { x: -373, z: 273 },
            { x: -357, z: 273 }, { x: -365, z: 252 }, { x: -365, z: 278 },
          ]);
        },
      },
      {
        kind: 'timed',
        objective: 'Torch the hideout and get out before the fire crews arrive',
        marker: { x: LOC.oldTown.x, z: LOC.oldTown.z },
        radius: 14,
        timer: 90,
      },
    ],
    onComplete(world) {
      flag(world, 'hideoutRaided', true);
      note(world, 'Rival hideout in Old Town burned out. Their street presence is gone.');
    },
  },
  {
    id: 'M31',
    name: 'The Blockade',
    payout: 12000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Get to the marina and take the supply boat',
        marker: { x: LOC.marina.x, z: LOC.marina.z },
        radius: 12,
        boatStage: true,
      },
      {
        kind: 'timed',
        objective: 'Break the marina blockade and run the supplies to The Islands',
        marker: { x: LOC.islands.x, z: LOC.islands.z },
        radius: 16,
        timer: 180,
        boatStage: true,
      },
      {
        kind: 'deliver',
        objective: 'Unload the supplies on The Islands',
        marker: { x: LOC.islands.x, z: LOC.islands.z },
        radius: 12,
      },
    ],
    onComplete(world) {
      flag(world, 'suppliesDelivered', true);
      flag(world, 'blockadeBroken', true);
      note(world, 'Supplies delivered to The Islands. The blockade is broken — the route is open.');
    },
  },
  {
    id: 'M32',
    name: 'The Tower Defense',
    payout: 15000,
    advance: true,
    stages: [
      {
        kind: 'survive',
        objective: 'Defend the Coral Club tower from the full rival assault — the crew fights beside you',
        marker: { x: LOC.coralClub.x, z: LOC.coralClub.z },
        radius: 18,
        timer: 120,
        crewSupport: true,
        enemies: [
          { x: -92, z: -132 }, { x: -68, z: -132 }, { x: -92, z: -108 },
          { x: -68, z: -108 }, { x: -80, z: -140 }, { x: -80, z: -100 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: -92, z: -132 }, { x: -68, z: -132 }, { x: -92, z: -108 },
            { x: -68, z: -108 }, { x: -80, z: -140 }, { x: -80, z: -100 },
          ]);
        },
      },
      {
        kind: 'timed',
        objective: 'Chase the rival boss\'s seaplane to The Islands airstrip',
        marker: { x: LOC.islandsAirstrip.x, z: LOC.islandsAirstrip.z },
        radius: 16,
        timer: 150,
      },
    ],
    onComplete(world) {
      flag(world, 'towerDefended', true);
      flag(world, 'bossChased', true);
      flag(world, 'legacyComplete', true);
      note(world, 'The tower held and the rival boss fled to The Islands. The legacy stands.');
    },
  },
];

export default missions9;

// Factory (integration): register this arc into world.missionRegistry so the
// shared runner in missions.js can start it. Registered under both the
// mission id ('M21') and the lowercase key ('m21') the M1-M20 factories use.
export function createMissions9(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;
  for (const m of missions9) {
    R[m.id] = m;
    R[m.id.toLowerCase()] = m;
  }
  return R;
}
