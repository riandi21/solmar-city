// Shared state: the one world object every system reads and writes.
// The bootstrap creates it, fills scene/camera/renderer through the
// renderer module, and passes it to each system factory. Systems talk to
// each other only through these fields (plus world.systems and
// world.events) — no system imports another system module.

import { CONFIG } from './config.js';
import { createRng } from './random.js';
import * as THREE from 'three';

export function createWorld(seed) {
  const rng = createRng(seed === undefined ? 1337 : seed);

  const world = {
    // Render handles — null until the bootstrap wires the renderer in.
    scene: null,
    camera: null,
    renderer: null,
    renderHandle: null,
    rng,
    config: CONFIG,

    // Player: Rico Vega.
    player: {
      position: new THREE.Vector3(-174, 0, 232),
      cash: 0,
      heading: 0,
      speed: 0,
      onFoot: true,
      health: CONFIG.playerHealth,
      armor: 0,
      mesh: null,
      car: null,
      bike: null,
      wheelie: false,
    },

    // Actors.
    cars: [],
    bikes: [],
    pedestrians: [],

    // Crime and money.
    wanted: 0,
    cash: 0,
    elapsed: 0,
    mode: 'menu',
    timeOfDay: 0.35,

    // Mission state.
    mission: {
      id: 0,
      stage: 0,
      objective: '',
      marker: null,
      timer: 0,
      active: false,
    },
    completedMissions: [],

    // Input: keys held, mouse movement since last frame, click flag.
    input: {
      keys: new Set(),
      mouseDX: 0,
      mouseDY: 0,
      clicked: false,
      rightClicked: false,
    },

    // Cross-system message queue (crimes, pickups, payouts, warnings).
    events: [],

    // City data, filled by the city builder.
    city: {
      districts: [],
      roads: [],
      colliders: [],
    },

    // Properties: which of the 4 Rico owns, income accrued, last payout.
    properties: {
      owned: [],
      incomeAccrued: 0,
      lastPayoutAt: 0,
    },

    // Territories: control 0-100 per district, income, attack timers.
    territories: {
      control: {},
      income: 0,
      attackTimers: {},
      lookouts: {},
    },

    // Casino Heist arc state.
    heist: {
      scouted: [],
      vaultCracked: false,
      lootAboard: false,
    },

    // Dourado Revenge arc state (missions 21-24).
    revenge: {
      courierTailed: false,
      ledgerStolen: false,
      convoyTrucksStopped: 0,
      donDefeated: false,
    },

    // Systems registry and render handle, filled by the bootstrap.
    systems: {},

    // Save format version (v4 fields: cash, missions, properties,
    // territories, bikes, position). Older saves load with defaults.
    saveVersion: 4,

    // Lifetime stats for the HUD and the save file.
    stats: { distanceDriven: 0, crimes: 0, packagesFound: 0 },
  };

  // Every territory district starts uncontrolled.
  for (const district of CONFIG.territories) {
    world.territories.control[district.id] = 0;
    world.territories.attackTimers[district.id] = 0;
    world.territories.lookouts[district.id] = false;
  }

  return world;
}
