// missions3.js — Missions 5-8, the Dourado arc ($14,000 total).
// Rico collects what the Dourado family owes, tails their courier, hits
// their warehouse, and ends it on the Coral Club penthouse roof.
// Plain definitions only: the runner in missions.js owns stage flow,
// markers, timers, rewards and the onComplete call.
export const DOURADO_DEFS = [
  {
    id: 5, title: 'Dourado Debt', reward: 2000, arc: 'dourado', requires: 4,
    briefing: 'The Dourados owe the Coral crew. Collect from the shop, then report to the Club.',
    stages: [
      { kind: 'collect', at: { x: 58, z: 116 }, radius: 7, objective: 'Collect the debt at the shop' },
      { kind: 'reach', at: { x: 58, z: 29 }, radius: 8, objective: 'Deliver the cash to the Coral Club' },
    ],
    onComplete(world) {
      world.douradoState = world.douradoState || {};
      world.douradoState.debtCollected = true;
    },
  },
  {
    id: 6, title: 'The Courier', reward: 3000, arc: 'dourado', requires: 5,
    briefing: 'Tail the Dourado courier from Old Town to the freight yard. Stay close, stay unseen.',
    stages: [
      {
        kind: 'tail', objective: 'Tail the courier — close, but not too close',
        path: [
          { x: -203, z: -87 }, { x: -174, z: -116 }, { x: -116, z: -174 }, { x: -170, z: -232 },
        ],
        wpTime: 14, loseDistance: 60, spottedDistance: 10, finishDistance: 25,
      },
      { kind: 'reach', at: { x: -170, z: -260 }, radius: 9, objective: 'Watch where the courier drops the package' },
    ],
    onComplete(world) {
      world.douradoState = world.douradoState || {};
      world.douradoState.courierTailed = true;
    },
  },
  {
    id: 7, title: 'Warehouse Hit', reward: 4000, arc: 'dourado', requires: 6,
    briefing: 'The Dourado stash sits in the freight yard warehouse. Clear the guards, then grab it.',
    stages: [
      {
        kind: 'fight', at: { x: -170, z: -260 }, radius: 12, enemyCount: 4, enemyHealth: 60,
        objective: 'Clear the warehouse guards (4)',
      },
      { kind: 'collect', at: { x: -185, z: -245 }, radius: 7, objective: 'Grab the stash crates' },
      { kind: 'drive', at: { x: -174, z: 232 }, radius: 9, objective: 'Drive the stash to the safehouse' },
    ],
    onComplete(world) {
      world.douradoState = world.douradoState || {};
      world.douradoState.warehouseHit = true;
      if (world.territories && world.territories['Freight Yard'] !== undefined) {
        world.territories['Freight Yard'] = Math.min(100, (world.territories['Freight Yard'] || 0) + 15);
      }
    },
  },
  {
    id: 8, title: 'Penthouse Finale', reward: 5000, arc: 'dourado', requires: 7,
    briefing: 'The Dourado lieutenant is hiding at the Coral Club penthouse. End the arc.',
    stages: [
      {
        kind: 'fight', at: { x: 29, z: 29 }, radius: 16, enemyCount: 3, enemyHealth: 80,
        objective: 'Fight through the penthouse guards (3)',
      },
      // Tower collider is 26x26 m; closest approach is ~13.45 m, so the
      // reach radius here must exceed it (16 m, per the Round 12 fix).
      { kind: 'reach', at: { x: 58, z: 29 }, radius: 16, objective: 'Take the penthouse roof' },
      // The ledger sits on the roof edge, clear of the tower collider.
      { kind: 'reach', at: { x: 45, z: 29 }, radius: 8, objective: 'Claim the Dourado ledger' },
    ],
    onComplete(world) {
      world.douradoState = world.douradoState || {};
      world.douradoState.finaleDone = true;
      world.douradoState.arcComplete = true;
      if (world.territories && world.territories.Downtown !== undefined) {
        world.territories.Downtown = Math.min(100, (world.territories.Downtown || 0) + 15);
      }
    },
  },
];

export function getDefs() { return DOURADO_DEFS; }
