// missions5.js — Missions 13-16, the Airport Job ($25,000 total).
// Rico breaks into the airfield hangar, runs a runway chase, loads a
// cargo plane, and escapes by seaplane to The Islands.
// Plain definitions only: the runner in missions.js owns stage flow,
// markers, timers, rewards and the onComplete call.
export const AIRPORT_DEFS = [
  {
    id: 13, title: 'Hangar Break-In', reward: 4000, arc: 'airport', requires: 12,
    briefing: 'Slip into the airfield hangar and lift the cargo manifest. Keep wanted at 1 star or less.',
    stages: [
      { kind: 'reach', at: { x: 200, z: -230 }, radius: 9, maxWanted: 1, objective: 'Reach the airfield hangar, unseen' },
      { kind: 'collect', at: { x: 210, z: -220 }, radius: 7, maxWanted: 1, objective: 'Lift the cargo manifest' },
      { kind: 'reach', at: { x: 174, z: -203 }, radius: 9, maxWanted: 1, objective: 'Slip out past the fence' },
    ],
    onComplete(world) {
      world.airportState = world.airportState || {};
      world.airportState.hangarDone = true;
    },
  },
  {
    id: 14, title: 'Runway Chase', reward: 6000, arc: 'airport', requires: 13,
    briefing: 'A courier plane is taxiing out. Chase it down the runway in 90 seconds.',
    stages: [
      { kind: 'drive', at: { x: 200, z: -230 }, radius: 10, timeLimit: 90, objective: 'Get onto the runway, fast' },
      { kind: 'drive', at: { x: 232, z: -230 }, radius: 10, timeLimit: 90, objective: 'Chase the plane down the runway' },
      { kind: 'wait', duration: 5, objective: 'Let the plane roll to a stop' },
      { kind: 'reach', at: { x: 240, z: -210 }, radius: 9, objective: 'Cut the plane off at the runway end' },
    ],
    onComplete(world) {
      world.airportState = world.airportState || {};
      world.airportState.chaseDone = true;
    },
  },
  {
    id: 15, title: 'Cargo Loading', reward: 7000, arc: 'airport', requires: 14,
    briefing: 'Three crates need to be on that plane before it leaves. Load them all.',
    stages: [
      { kind: 'collect', at: { x: 190, z: -240 }, radius: 7, objective: 'Load crate 1/3' },
      { kind: 'collect', at: { x: 210, z: -240 }, radius: 7, objective: 'Load crate 2/3' },
      { kind: 'collect', at: { x: 220, z: -220 }, radius: 7, objective: 'Load crate 3/3' },
      { kind: 'reach', at: { x: 200, z: -230 }, radius: 9, objective: 'Signal the plane it is loaded' },
    ],
    onComplete(world) {
      world.airportState = world.airportState || {};
      world.airportState.cargoDone = true;
      if (world.territories && world.territories.Airfield !== undefined) {
        world.territories.Airfield = Math.min(100, (world.territories.Airfield || 0) + 12);
      }
    },
  },
  {
    id: 16, title: 'Escape by Plane', reward: 8000, arc: 'airport', requires: 15,
    briefing: 'The job is done and the cops are coming. Get to the seaplane and fly to The Islands.',
    stages: [
      { kind: 'reach', at: { x: 320, z: 200 }, radius: 9, objective: 'Reach the seaplane dock' },
      { kind: 'fly', at: { x: 370, z: 360 }, radius: 14, objective: 'Fly the seaplane to The Islands airstrip' },
      { kind: 'reach', at: { x: 370, z: 360 }, radius: 9, objective: 'Land at the beach bar — job done' },
    ],
    onComplete(world) {
      world.airportState = world.airportState || {};
      world.airportState.finaleDone = true;
      world.airportState.arcComplete = true;
      if (world.territories && world.territories.Airfield !== undefined) {
        world.territories.Airfield = Math.min(100, (world.territories.Airfield || 0) + 15);
      }
    },
  },
];

export function getDefs() { return AIRPORT_DEFS; }
