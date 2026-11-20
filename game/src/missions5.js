// missions5.js — M13-M16, the Airport Job ($25,000 total).
// A hangar break-in, a runway chase, a cargo-plane loading job, and a finale escape by plane.
// Factory: createMissions5(world) registers M13-M16 into world.missionRegistry.

function logEvent(world, text) {
  if (Array.isArray(world.events)) world.events.push(text);
}

function addCrew(world, name) {
  world.crew = world.crew || [];
  if (!world.crew.includes(name)) world.crew.push(name);
}

export function createMissions5(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;

  R.m13 = {
    id: 'm13',
    name: 'Hangar Break-In',
    payout: 5000,
    stages: [
      { kind: 'reach', objective: 'Sneak to the airfield perimeter fence', marker: { x: 320, z: -120 }, radius: 8 },
      {
        kind: 'fight',
        objective: 'Silence the hangar guards — quietly, no alarm',
        marker: { x: 360, z: -160 },
        radius: 12,
        enemies: [
          { x: 360, z: -160, health: 100 },
          { x: 372, z: -152, health: 100 },
          { x: 348, z: -168, health: 120 },
        ],
      },
      { kind: 'reach', objective: 'Get inside the hangar', marker: { x: 380, z: -180 }, radius: 6 },
    ],
    onComplete(w) {
      w.heist = w.heist || {};
      w.heist.hangarBreached = true;
      logEvent(w, 'M13 done — the hangar is open and the guards are down.');
    },
  };

  R.m14 = {
    id: 'm14',
    name: 'Runway Chase',
    payout: 6000,
    stages: [
      { kind: 'timed', objective: 'Chase the courier van down the runway — 100s', marker: { x: 420, z: -220 }, radius: 8, timer: 100 },
      {
        kind: 'fight',
        objective: 'Stop the courier’s escort on the tarmac',
        marker: { x: 420, z: -220 },
        radius: 14,
        enemies: [
          { x: 420, z: -220, health: 100 },
          { x: 432, z: -212, health: 120 },
          { x: 408, z: -228, health: 100 },
          { x: 426, z: -232, health: 100 },
        ],
      },
      { kind: 'reach', objective: 'Grab the courier’s case', marker: { x: 430, z: -230 }, radius: 6 },
    ],
    onComplete(w) {
      w.heist = w.heist || {};
      w.heist.courierCase = true;
      logEvent(w, 'M14 done — the courier’s case is in your hands.');
    },
  };

  R.m15 = {
    id: 'm15',
    name: 'Cargo Loading',
    payout: 7000,
    stages: [
      { kind: 'reach', objective: 'Bring the crew to the cargo plane', marker: { x: 400, z: -200 }, radius: 8,
        onComplete(w) { addCrew(w, 'rico'); addCrew(w, 'marco'); addCrew(w, 'tessa'); } },
      { kind: 'timed', objective: 'Load crate 1 of 3 onto the plane — 150s', marker: { x: 395, z: -195 }, radius: 6, timer: 150 },
      { kind: 'timed', objective: 'Load crate 2 of 3 onto the plane — 150s', marker: { x: 405, z: -205 }, radius: 6, timer: 150 },
      { kind: 'timed', objective: 'Load crate 3 of 3 onto the plane — 150s', marker: { x: 400, z: -210 }, radius: 6, timer: 150 },
    ],
    onComplete(w) {
      w.heist = w.heist || {};
      w.heist.cargoLoaded = true;
      logEvent(w, 'M15 done — the cargo plane is loaded and ready.');
    },
  };

  R.m16 = {
    id: 'm16',
    name: 'Wheels Up',
    payout: 7000,
    stages: [
      { kind: 'reach', objective: 'Board the cargo plane with the crew', marker: { x: 400, z: -200 }, radius: 8 },
      {
        kind: 'survive',
        objective: 'Survive the airport lockdown — 45s at 3 stars',
        marker: { x: 400, z: -200 },
        radius: 16,
        timer: 45,
        minWanted: 3,
        onEnter(w) {
          w.wanted = Math.max(w.wanted || 0, 3);
          if (typeof w.heat === 'number') w.heat = Math.max(w.heat, 3);
        },
      },
      { kind: 'reach', objective: 'Taxi to the runway and escape by plane', marker: { x: 460, z: -260 }, radius: 10 },
    ],
    onComplete(w) {
      w.heist = w.heist || {};
      w.heist.airportJob = true;
      w.heist.escapedByPlane = true;
      logEvent(w, 'M16 done — the Airport Job is complete. Wheels up, Solmar behind you.');
    },
  };

  return R;
}
