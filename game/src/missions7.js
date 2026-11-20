// Missions 21-24 — Dourado Revenge arc ($35,000 total).
// The Dourado family wiped out the player's first crew. Four hits to pay it back:
// tail the courier, raid the warehouse, ambush the convoy, storm the Don's penthouse.
//
// Contract: each mission is { id, name, payout, advance, stages, onComplete }.
// Stage kinds: reach | fight | deliver | survive | tail | escort | timed.
// The runner advances stages and calls mission.onComplete on completion; the runner
// pays out mission.payout. Fight stages complete only when the enemy list is empty,
// so onEnter spawns shooters through world.systemObjects.combat (guarded).

const LOC = {
  freightYard: { x: 420, z: 300 },
  docks: { x: 480, z: 380 },
  docksWarehouse: { x: 505, z: 355 },
  warehouse: { x: 380, z: 180 },
  safehouse: { x: -150, z: -50 },
  highway: { x: 200, z: 250 },
  highwayAmbush: { x: 240, z: 290 },
  penthouse: { x: 40, z: -40 },
  downtown: { x: 0, z: 0 },
};

function spawnShooters(world, list) {
  const combat = world.systemObjects && world.systemObjects.combat;
  if (!combat || typeof combat.spawnShooter !== 'function') return;
  for (const spec of list) {
    try { combat.spawnShooter(spec.x, spec.z, spec); } catch { /* combat unavailable */ }
  }
}

function flag(world, key, value) {
  if (!world.revenge) world.revenge = {};
  world.revenge[key] = value;
}

function note(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'mission', text });
}

export const missions7 = [
  {
    id: 'M21',
    name: 'The Courier',
    payout: 6000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Find the Dourado courier at the freight yard',
        marker: { x: LOC.freightYard.x, z: LOC.freightYard.z },
        radius: 12,
      },
      {
        kind: 'tail',
        objective: 'Tail the courier to the Docks warehouse — stay back, do not get spotted',
        marker: { x: LOC.docksWarehouse.x, z: LOC.docksWarehouse.z },
        radius: 14,
        timer: 180,
      },
      {
        kind: 'reach',
        objective: 'Photograph the handoff from cover',
        marker: { x: LOC.docks.x, z: LOC.docks.z },
        radius: 10,
      },
    ],
    onComplete(world) {
      flag(world, 'courierTailed', true);
      note(world, 'Dourado courier tailed — the warehouse and the convoy route are exposed.');
    },
  },
  {
    id: 'M22',
    name: 'The Warehouse',
    payout: 8000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Reach the Dourado warehouse on the east side',
        marker: { x: LOC.warehouse.x, z: LOC.warehouse.z },
        radius: 12,
      },
      {
        kind: 'fight',
        objective: 'Clear the warehouse guards',
        marker: { x: LOC.warehouse.x, z: LOC.warehouse.z },
        radius: 20,
        enemies: [
          { x: 372, z: 172 }, { x: 388, z: 172 }, { x: 372, z: 188 },
          { x: 388, z: 188 }, { x: 380, z: 165 }, { x: 380, z: 195 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: 372, z: 172 }, { x: 388, z: 172 }, { x: 372, z: 188 },
            { x: 388, z: 188 }, { x: 380, z: 165 }, { x: 380, z: 195 },
          ]);
        },
      },
      {
        kind: 'deliver',
        objective: 'Take the stolen ledger back to the safehouse',
        marker: { x: LOC.safehouse.x, z: LOC.safehouse.z },
        radius: 10,
      },
    ],
    onComplete(world) {
      flag(world, 'warehouseRaided', true);
      note(world, 'Dourado warehouse raided — the ledger names every buyer on the convoy route.');
    },
  },
  {
    id: 'M23',
    name: 'The Convoy',
    payout: 9000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Get to the ambush point on the highway',
        marker: { x: LOC.highwayAmbush.x, z: LOC.highwayAmbush.z },
        radius: 12,
      },
      {
        kind: 'fight',
        objective: 'Ambush the convoy escort and take the trucks',
        marker: { x: LOC.highway.x, z: LOC.highway.z },
        radius: 22,
        enemies: [
          { x: 195, z: 245 }, { x: 205, z: 255 }, { x: 190, z: 258 }, { x: 210, z: 242 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: 195, z: 245 }, { x: 205, z: 255 }, { x: 190, z: 258 }, { x: 210, z: 242 },
          ]);
        },
      },
      {
        kind: 'deliver',
        objective: 'Drive the seized goods to the safehouse',
        marker: { x: LOC.safehouse.x, z: LOC.safehouse.z },
        radius: 10,
        timer: 150,
      },
    ],
    onComplete(world) {
      flag(world, 'convoyHit', true);
      note(world, 'Dourado convoy hit — their supply line is cut and the Don is exposed.');
    },
  },
  {
    id: 'M24',
    name: "The Don's Penthouse",
    payout: 12000,
    advance: true,
    stages: [
      {
        kind: 'reach',
        objective: 'Storm the downtown tower — reach the penthouse elevator',
        marker: { x: LOC.penthouse.x, z: LOC.penthouse.z },
        radius: 12,
      },
      {
        kind: 'fight',
        objective: 'Fight through the Don\'s personal guard',
        marker: { x: LOC.penthouse.x, z: LOC.penthouse.z },
        radius: 20,
        enemies: [
          { x: 32, z: -48 }, { x: 48, z: -48 }, { x: 32, z: -32 },
          { x: 48, z: -32 }, { x: 40, z: -52 }, { x: 40, z: -28 },
        ],
        onEnter(world) {
          spawnShooters(world, [
            { x: 32, z: -48 }, { x: 48, z: -48 }, { x: 32, z: -32 },
            { x: 48, z: -32 }, { x: 40, z: -52 }, { x: 40, z: -28 },
          ]);
        },
      },
      {
        kind: 'survive',
        objective: 'Hold the penthouse while the Don\'s last men rush you',
        marker: { x: LOC.penthouse.x, z: LOC.penthouse.z },
        radius: 16,
        timer: 60,
      },
    ],
    onComplete(world) {
      flag(world, 'donDown', true);
      flag(world, 'revengeComplete', true);
      note(world, 'The Don is finished. The Dourado Revenge is complete — Solmar is yours to take.');
    },
  },
];

export default missions7;

// Factory (integration): register this arc into world.missionRegistry so the
// shared runner in missions.js can start it. Registered under both the
// mission id ('M21') and the lowercase key ('m21') the M1-M20 factories use.
export function createMissions7(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;
  for (const m of missions7) {
    R[m.id] = m;
    R[m.id.toLowerCase()] = m;
  }
  return R;
}
