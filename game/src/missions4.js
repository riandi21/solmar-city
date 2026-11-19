// missions4.js — Missions 9-12, the Harbor War ($20,000 total).
// A rival crew is moving on the marina and the lighthouse. Rico escorts a
// truck through the Docks, runs a timed delivery, takes down their
// lookout, and ends the war at the lighthouse.
// Plain definitions only: the runner in missions.js owns stage flow,
// markers, timers, rewards and the onComplete call.
export const HARBOR_DEFS = [
  {
    id: 9, title: 'Harbor Escort', reward: 3000, arc: 'harbor', requires: 8,
    briefing: 'Escort the Coral truck from the Docks warehouse to the marina pier.',
    stages: [
      { kind: 'reach', at: { x: -215, z: -215 }, radius: 9, objective: 'Meet the truck at the Docks warehouse' },
      { kind: 'drive', at: { x: 0, z: 116 }, radius: 10, objective: 'Escort the truck through downtown' },
      { kind: 'drive', at: { x: 295, z: 168 }, radius: 9, objective: 'Deliver the truck to the marina pier' },
    ],
    onComplete(world) {
      world.harborState = world.harborState || {};
      world.harborState.escortDone = true;
    },
  },
  {
    id: 10, title: 'Timed Delivery', reward: 4000, arc: 'harbor', requires: 9,
    briefing: 'Three harbor drops, 180 seconds. The tide waits for no one.',
    stages: [
      { kind: 'reach', at: { x: 295, z: 168 }, radius: 7, timeLimit: 180, objective: 'Drop 1/3 at the marina pier' },
      { kind: 'reach', at: { x: 0, z: 318 }, radius: 7, timeLimit: 180, objective: 'Drop 2/3 at the boardwalk pier' },
      { kind: 'reach', at: { x: -270, z: 300 }, radius: 7, timeLimit: 180, objective: 'Drop 3/3 at the lighthouse' },
    ],
    onComplete(world) {
      world.harborState = world.harborState || {};
      world.harborState.deliveryDone = true;
      if (world.territories && world.territories.Marina !== undefined) {
        world.territories.Marina = Math.min(100, (world.territories.Marina || 0) + 12);
      }
    },
  },
  {
    id: 11, title: 'The Lookout', reward: 5000, arc: 'harbor', requires: 10,
    briefing: 'A rival lookout on the lighthouse is calling in every Coral move. Take him down.',
    stages: [
      { kind: 'reach', at: { x: -260, z: 290 }, radius: 10, objective: 'Reach the lighthouse beach' },
      {
        kind: 'fight', at: { x: -270, z: 300 }, radius: 14, enemyCount: 5, enemyHealth: 60,
        objective: 'Take down the lighthouse crew (5)',
      },
      { kind: 'reach', at: { x: -270, z: 300 }, radius: 9, objective: 'Search the lighthouse base' },
    ],
    onComplete(world) {
      world.harborState = world.harborState || {};
      world.harborState.lookoutDown = true;
    },
  },
  {
    id: 12, title: 'Lighthouse Finale', reward: 8000, arc: 'harbor', requires: 11,
    briefing: 'The rivals are storming the lighthouse. Hold the point for 60 seconds, then light the beam.',
    stages: [
      {
        kind: 'defend', at: { x: -270, z: 300 }, radius: 14, duration: 60,
        enemyCount: 5, enemyHealth: 70, objective: 'Defend the lighthouse for 60 seconds',
      },
      { kind: 'reach', at: { x: -270, z: 300 }, radius: 9, objective: 'Light the lighthouse beam — the harbor is yours' },
      { kind: 'reach', at: { x: 0, z: 318 }, radius: 9, objective: 'Return to the boardwalk pier' },
    ],
    onComplete(world) {
      world.harborState = world.harborState || {};
      world.harborState.finaleDone = true;
      world.harborState.arcComplete = true;
      if (world.territories && world.territories.Boardwalk !== undefined) {
        world.territories.Boardwalk = Math.min(100, (world.territories.Boardwalk || 0) + 15);
      }
      if (world.territories && world.territories.Marina !== undefined) {
        world.territories.Marina = Math.min(100, (world.territories.Marina || 0) + 10);
      }
    },
  },
];

export function getDefs() { return HARBOR_DEFS; }
