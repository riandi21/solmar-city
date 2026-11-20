// missions6.js — M17-M20, the Casino Heist ($30,000 total).
// M17 casing, M18 the vault, M19 the harbor run, M20 the big score.
// Factory: createMissions6(world) registers M17-M20 into world.missionRegistry.
// Heist arc flags are set in each mission's onComplete (world.heist.*).

function logEvent(world, text) {
  if (Array.isArray(world.events)) world.events.push(text);
}

function addCrew(world, name) {
  world.crew = world.crew || [];
  if (!world.crew.includes(name)) world.crew.push(name);
}

export function createMissions6(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;

  R.m17 = {
    id: 'm17',
    name: 'Casing the Casino',
    payout: 3000,
    stages: [
      { kind: 'reach', objective: 'Scout security point 1 — the front entrance (keep wanted at 1 star or less)', marker: { x: 90, z: 60 }, radius: 6, maxWanted: 1 },
      { kind: 'reach', objective: 'Scout security point 2 — the side garage (keep wanted at 1 star or less)', marker: { x: 110, z: 40 }, radius: 6, maxWanted: 1 },
      { kind: 'reach', objective: 'Scout security point 3 — the roof access (keep wanted at 1 star or less)', marker: { x: 100, z: 80 }, radius: 6, maxWanted: 1 },
    ],
    onComplete(w) {
      w.heist = w.heist || {};
      w.heist.cased = true;
      w.heist.securityPoints = 3;
      logEvent(w, 'M17 done — all three security points scouted, no heat raised.');
    },
  };

  R.m18 = {
    id: 'm18',
    name: 'The Vault',
    payout: 8000,
    stages: [
      { kind: 'reach', objective: 'Enter the casino through the side garage', marker: { x: 110, z: 40 }, radius: 6,
        onComplete(w) { addCrew(w, 'lena'); addCrew(w, 'marco'); } },
      {
        kind: 'fight',
        objective: 'Dodge the vault guards and clear the vault floor',
        marker: { x: 100, z: 60 },
        radius: 12,
        enemies: [
          { x: 100, z: 60, health: 120 },
          { x: 92, z: 66, health: 100 },
          { x: 108, z: 54, health: 100 },
          { x: 96, z: 50, health: 150 },
        ],
      },
      { kind: 'timed', objective: 'Grab the cash from the vault — 180s on the clock', marker: { x: 100, z: 70 }, radius: 6, timer: 180 },
      { kind: 'reach', objective: 'Escape to the getaway car at the marina pier', marker: { x: 305, z: 175 }, radius: 10 },
    ],
    onComplete(w) {
      w.heist = w.heist || {};
      w.heist.vaultHit = true;
      w.heist.lootSecured = true;
      logEvent(w, 'M18 done — the vault is empty and the loot is in the getaway car.');
    },
  };

  R.m19 = {
    id: 'm19',
    name: 'The Harbor Run',
    payout: 7000,
    stages: [
      { kind: 'reach', objective: 'Board the boat at the marina pier with the loot', marker: { x: 305, z: 175 }, radius: 8 },
      {
        kind: 'survive',
        objective: 'Outrun the police boats and helicopter — 60s at 4 stars',
        marker: { x: 280, z: 220 },
        radius: 20,
        timer: 60,
        minWanted: 4,
        onEnter(w) {
          w.wanted = Math.max(w.wanted || 0, 4);
          if (typeof w.heat === 'number') w.heat = Math.max(w.heat, 4);
        },
      },
      { kind: 'reach', objective: 'Deliver the loot to the yacht', marker: { x: 305, z: 175 }, radius: 10 },
    ],
    onComplete(w) {
      w.heist = w.heist || {};
      w.heist.harborRun = true;
      w.heist.lootOnYacht = true;
      logEvent(w, 'M19 done — the loot is stashed aboard the yacht.');
    },
  };

  R.m20 = {
    id: 'm20',
    name: 'The Big Score',
    payout: 12000,
    stages: [
      { kind: 'reach', objective: 'Drive the crew to the airfield', marker: { x: 400, z: -200 }, radius: 10,
        onComplete(w) { addCrew(w, 'rico'); addCrew(w, 'lena'); addCrew(w, 'marco'); addCrew(w, 'tessa'); } },
      {
        kind: 'survive',
        objective: 'Hold the airfield at 5 stars until the plane is ready — 60s',
        marker: { x: 400, z: -200 },
        radius: 18,
        timer: 60,
        minWanted: 5,
        onEnter(w) {
          w.wanted = Math.max(w.wanted || 0, 5);
          if (typeof w.heat === 'number') w.heat = Math.max(w.heat, 5);
        },
      },
      { kind: 'reach', objective: 'Board the plane and escape — the big score is yours', marker: { x: 460, z: -260 }, radius: 10 },
    ],
    onComplete(w) {
      w.heist = w.heist || {};
      w.heist.bigScore = true;
      w.heist.casinoHeist = true;
      w.heist.escapedByPlane = true;
      w.revenge = w.revenge || {};
      w.revenge.casinoHeistDone = true;
      logEvent(w, 'M20 done — THE BIG SCORE. The Casino Heist is complete.');
    },
  };

  return R;
}
