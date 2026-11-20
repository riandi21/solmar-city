// missions4.js — M9-M12, the Harbor War ($20,000 total).
// An escort, a timed delivery, a takedown, and a finale at the lighthouse (-270, 300).
// Factory: createMissions4(world) registers M9-M12 into world.missionRegistry.

function logEvent(world, text) {
  if (Array.isArray(world.events)) world.events.push(text);
}

function addCrew(world, name) {
  world.crew = world.crew || [];
  if (!world.crew.includes(name)) world.crew.push(name);
}

export function createMissions4(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;

  R.m9 = {
    id: 'm9',
    name: 'Harbor Escort',
    payout: 4000,
    stages: [
      { kind: 'reach', objective: 'Meet the freighter captain at the east pier', marker: { x: 260, z: 260 }, radius: 6,
        onComplete(w) { addCrew(w, 'captain-ortiz'); } },
      { kind: 'escort', objective: 'Escort the freighter truck to the warehouse — stay close', marker: { x: 180, z: 200 }, radius: 10, timer: 150 },
      { kind: 'reach', objective: 'See the truck into the warehouse', marker: { x: 160, z: 180 }, radius: 8 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.harborEscort = true;
      logEvent(w, 'M9 done — the freighter cargo is safe in the warehouse.');
    },
  };

  R.m10 = {
    id: 'm10',
    name: 'Hot Cargo',
    payout: 5000,
    stages: [
      { kind: 'deliver', objective: 'Run the hot cargo to the north dock — 120s', marker: { x: -200, z: 260 }, radius: 8, timer: 120 },
      { kind: 'deliver', objective: 'Second drop at the fish market — 120s', marker: { x: -240, z: 180 }, radius: 8, timer: 120 },
      { kind: 'deliver', objective: 'Final drop at the lighthouse road — 120s', marker: { x: -270, z: 300 }, radius: 8, timer: 120 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.hotCargo = true;
      logEvent(w, 'M10 done — every drop landed before the clock did.');
    },
  };

  R.m11 = {
    id: 'm11',
    name: 'Harbor Takedown',
    payout: 6000,
    stages: [
      { kind: 'reach', objective: 'Reach the rival gang’s harbor stash', marker: { x: -180, z: 120 }, radius: 10 },
      {
        kind: 'fight',
        objective: 'Take down the harbor crew guarding the stash',
        marker: { x: -180, z: 120 },
        radius: 14,
        enemies: [
          { x: -180, z: 120, health: 100 },
          { x: -168, z: 128, health: 120 },
          { x: -192, z: 112, health: 100 },
          { x: -176, z: 136, health: 100 },
          { x: -188, z: 104, health: 150 },
          { x: -160, z: 116, health: 100 },
          { x: -172, z: 100, health: 120 },
        ],
      },
      { kind: 'reach', objective: 'Torch the stash and get clear', marker: { x: -150, z: 80 }, radius: 8 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.harborTakedown = true;
      logEvent(w, 'M11 done — the rival harbor crew is finished.');
    },
  };

  R.m12 = {
    id: 'm12',
    name: 'Lighthouse Finale',
    payout: 5000,
    stages: [
      { kind: 'reach', objective: 'Drive to the lighthouse', marker: { x: -270, z: 300 }, radius: 10,
        onComplete(w) { addCrew(w, 'marco'); addCrew(w, 'tessa'); } },
      {
        kind: 'fight',
        objective: 'Hold the lighthouse against the last harbor gang',
        marker: { x: -270, z: 300 },
        radius: 16,
        enemies: [
          { x: -270, z: 300, health: 120 },
          { x: -258, z: 308, health: 100 },
          { x: -282, z: 292, health: 100 },
          { x: -262, z: 288, health: 150 },
          { x: -278, z: 312, health: 100 },
        ],
      },
      { kind: 'reach', objective: 'Light the beacon — claim the harbor', marker: { x: -270, z: 300 }, radius: 6 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.harborWar = true;
      w.revenge.lighthouseTaken = true;
      logEvent(w, 'M12 done — the Harbor War is won. The lighthouse is yours.');
    },
  };

  return R;
}
