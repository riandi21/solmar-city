// missions6.js — Missions 17-20, the Casino Heist ($30,000 total).
// Rico cases the casino, cracks the vault, runs the loot out by boat,
// and makes the big score: out by plane at 5 stars.
// Plain definitions only: the runner in missions.js owns stage flow,
// markers, timers, rewards and the onComplete call.
export const CASINO_DEFS = [
  {
    id: 17, title: 'Casing the Joint', reward: 3000, arc: 'heist', requires: 16,
    briefing: 'Scout three security points around the casino without raising wanted above 1 star.',
    stages: [
      { kind: 'reach', at: { x: 116, z: 58 }, radius: 7, maxWanted: 1, objective: 'Scout security point 1/3 — casino front' },
      { kind: 'reach', at: { x: 116, z: 116 }, radius: 7, maxWanted: 1, objective: 'Scout security point 2/3 — side door' },
      { kind: 'reach', at: { x: 58, z: 116 }, radius: 7, maxWanted: 1, objective: 'Scout security point 3/3 — rear alley' },
    ],
    onComplete(world) {
      world.heistState = world.heistState || {};
      world.heistState.cased = true;
    },
  },
  {
    id: 18, title: 'The Vault', reward: 8000, arc: 'heist', requires: 17,
    briefing: '180 seconds. Dodge the guards, grab the cash, and get to the getaway car at the marina pier.',
    stages: [
      { kind: 'reach', at: { x: 116, z: 87 }, radius: 8, timeLimit: 180, objective: 'Get inside the casino' },
      { kind: 'collect', at: { x: 116, z: 87 }, radius: 6, timeLimit: 180, objective: 'Crack the vault and grab the cash' },
      { kind: 'drive', at: { x: 295, z: 168 }, radius: 9, timeLimit: 180, objective: 'Escape to the getaway car at the marina pier' },
    ],
    onComplete(world) {
      world.heistState = world.heistState || {};
      world.heistState.vaultDone = true;
      world.heistState.loot = (world.heistState.loot || 0) + 8000;
    },
  },
  {
    id: 19, title: 'Harbor Run', reward: 7000, arc: 'heist', requires: 18,
    briefing: 'Deliver the loot by boat to the yacht. Police boats are out — keep moving.',
    stages: [
      { kind: 'boat', at: { x: 295, z: 168 }, radius: 9, objective: 'Board the boat at the marina pier' },
      { kind: 'boat', at: { x: 320, z: 240 }, radius: 10, objective: 'Run the loot out past the harbor mouth' },
      { kind: 'boat', at: { x: 305, z: 175 }, radius: 9, objective: 'Deliver the loot to the yacht' },
    ],
    onComplete(world) {
      world.heistState = world.heistState || {};
      world.heistState.harborRunDone = true;
      world.heistState.loot = (world.heistState.loot || 0) + 7000;
    },
  },
  {
    id: 20, title: 'The Big Score', reward: 12000, arc: 'heist', requires: 19,
    briefing: 'Finale: drive to the airfield and escape by plane at 5 stars. The whole city is watching.',
    stages: [
      { kind: 'drive', at: { x: 200, z: -230 }, radius: 10, objective: 'Drive to the airfield' },
      {
        kind: 'survive', wanted: 5, duration: 20,
        objective: 'Hold out at 5 stars while the plane is readied',
      },
      { kind: 'fly', at: { x: 370, z: 360 }, radius: 14, objective: 'Escape by plane to The Islands' },
    ],
    onComplete(world) {
      world.heistState = world.heistState || {};
      world.heistState.bigScoreDone = true;
      world.heistState.arcComplete = true;
      world.heistState.loot = (world.heistState.loot || 0) + 12000;
      if (world.territories && world.territories.Airfield !== undefined) {
        world.territories.Airfield = Math.min(100, (world.territories.Airfield || 0) + 10);
      }
    },
  },
];

export function getDefs() { return CASINO_DEFS; }
