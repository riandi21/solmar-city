// missions3.js — M5-M8, the Dourado arc ($14,000 total).
// Crew and driving jobs ending in a finale at the Coral Club penthouse.
// Factory: createMissions3(world) registers M5-M8 into world.missionRegistry.

function logEvent(world, text) {
  if (Array.isArray(world.events)) world.events.push(text);
}

function addCrew(world, name) {
  world.crew = world.crew || [];
  if (!world.crew.includes(name)) world.crew.push(name);
}

export function createMissions3(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;

  R.m5 = {
    id: 'm5',
    name: 'Dourado Introduction',
    payout: 2500,
    stages: [
      { kind: 'reach', objective: 'Meet Dourado’s fixer at the docks', marker: { x: -120, z: 210 }, radius: 6 },
      { kind: 'deliver', objective: 'Drive the fixer’s car to the Coral Club — 120s', marker: { x: 29, z: 29 }, radius: 8, timer: 120 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.douradoMet = true;
      addCrew(w, 'dourado-fixer');
      logEvent(w, 'M5 done — Dourado knows you can drive.');
    },
  };

  R.m6 = {
    id: 'm6',
    name: 'Muscle for Hire',
    payout: 3500,
    stages: [
      { kind: 'reach', objective: 'Pick up the crew at the garage', marker: { x: -60, z: -90 }, radius: 6,
        onComplete(w) { addCrew(w, 'marco'); addCrew(w, 'tessa'); } },
      {
        kind: 'fight',
        objective: 'Clear Dourado’s rivals from the warehouse yard',
        marker: { x: -140, z: -160 },
        radius: 12,
        enemies: [
          { x: -140, z: -160, health: 100 },
          { x: -128, z: -168, health: 100 },
          { x: -152, z: -148, health: 100 },
          { x: -135, z: -175, health: 120 },
        ],
      },
      { kind: 'reach', objective: 'Regroup at the safehouse', marker: { x: -40, z: -40 }, radius: 8 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.warehouseCleared = true;
      logEvent(w, 'M6 done — the warehouse yard belongs to Dourado now.');
    },
  };

  R.m7 = {
    id: 'm7',
    name: 'The Long Haul',
    payout: 4000,
    stages: [
      { kind: 'deliver', objective: 'Haul the shipment north — stop 1 of 2, 150s', marker: { x: 180, z: -180 }, radius: 8, timer: 150 },
      { kind: 'deliver', objective: 'Haul the shipment north — stop 2 of 2, 150s', marker: { x: 240, z: -240 }, radius: 8, timer: 150 },
      {
        kind: 'fight',
        objective: 'Ambush on the road — take out the hijackers',
        marker: { x: 240, z: -240 },
        radius: 14,
        enemies: [
          { x: 248, z: -232, health: 100 },
          { x: 232, z: -248, health: 100 },
          { x: 256, z: -244, health: 120 },
          { x: 240, z: -236, health: 100 },
        ],
      },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.haulDone = true;
      logEvent(w, 'M7 done — the shipment arrived, hijackers didn’t.');
    },
  };

  R.m8 = {
    id: 'm8',
    name: 'Penthouse Finale',
    payout: 4000,
    stages: [
      { kind: 'reach', objective: 'Drive to the Coral Club penthouse entrance', marker: { x: 29, z: 29 }, radius: 8,
        onComplete(w) { addCrew(w, 'rico'); addCrew(w, 'lena'); } },
      {
        kind: 'fight',
        objective: 'Fight through Dourado’s betrayers in the penthouse',
        marker: { x: 35, z: 35 },
        radius: 12,
        enemies: [
          { x: 35, z: 35, health: 120 },
          { x: 42, z: 28, health: 100 },
          { x: 24, z: 40, health: 100 },
          { x: 38, z: 44, health: 150 },
          { x: 30, z: 24, health: 100 },
        ],
      },
      { kind: 'reach', objective: 'Take the penthouse — reach the rooftop', marker: { x: 45, z: 45 }, radius: 6 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.douradoArc = true;
      w.revenge.penthouseTaken = true;
      logEvent(w, 'M8 done — the Dourado arc is closed. The penthouse is yours.');
    },
  };

  return R;
}
