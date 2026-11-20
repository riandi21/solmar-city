// Solmar City — world state (Round 16, v16).
// makeWorld() builds the ONE state object every district and system shares.
// It owns plain state only: no rendering, no input handling, no game rules
// beyond holding the fields systems read and write.
//
// Wiring contract:
// - world.systems is an ARRAY. System objects live in world.systems or in
//   world.systemObjects — never assigned onto a state field (never
//   `world.foo = someSystem`), so a system can never clobber state.
// - scene / camera / renderer start null: the bootstrap creates the single
//   scene+camera via createRender(canvas) and hands them in here (or passes
//   the render bundle to makeWorld) BEFORE createCity runs, so there is
//   exactly one scene in the whole game.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRng } from './random.js';

export function makeWorld(renderOrOpts) {
  const opts = renderOrOpts || {};
  // Accept either a render bundle {scene, camera, renderer} or bare opts
  // {scene, camera, renderer, seed, config}.
  const scene = opts.scene || null;
  const camera = opts.camera || null;
  const renderer = opts.renderer || null;
  const config = opts.config || CONFIG;
  const seed = opts.seed !== undefined ? opts.seed : config.seed;

  const world = {
    // --- three.js handles (wired by the bootstrap from createRender) -------
    scene,
    camera,
    renderer,

    // --- shared foundations -------------------------------------------------
    rng: createRng(seed),
    config,

    // --- player --------------------------------------------------------------
    player: {
      position: new THREE.Vector3(config.player.startX, 0, config.player.startZ),
      heading: config.player.startHeading,
      speed: 0,
      onFoot: true,
      health: config.player.health,
      mesh: null,
      currentCar: null,
      currentBike: null,
      currentBoat: null,
      currentSeaplane: null,
      currentHeli: null,
      currentJetSki: null,
      cash: config.player.startCash,
    },

    // --- vehicles -------------------------------------------------------------
    cars: [],
    bikes: [],
    boats: [],
    jetSkis: [],
    seaplane: {
      mesh: null,
      position: new THREE.Vector3(320, 0.4, 200),
      heading: 0,
      speed: 0,
      altitude: 0,
      onWater: true,
    },
    playerHeli: {
      mesh: null,
      position: new THREE.Vector3(29, 78, 29),
      heading: 0,
      speed: 0,
      altitude: 78,
      rotorSpeed: 0,
      onGround: true,
      boarded: false,
    },

    // --- actors ----------------------------------------------------------------
    pedestrians: [],
    crew: [],
    feds: [],
    cartelHitmen: [],
    enemies: [],
    gangShooters: [],

    // --- heat / economy ---------------------------------------------------------
    wanted: 0,
    heat: 0,
    cartelThreat: 0,
    cash: config.player.startCash,

    // --- mission ------------------------------------------------------------------
    mission: { id: null, stage: 0, objective: '', marker: null, timer: 0 },
    elapsed: 0,
    mode: 'menu',
    input: { keys: new Set(), mouseDX: 0, mouseDY: 0, clicked: false },
    events: [],
    completedMissions: [],

    // --- city -----------------------------------------------------------------------
    city: { districts: {}, roads: [], colliders: [] },

    // --- ownership / territory -------------------------------------------------------
    properties: { owned: {}, income: 0, lastPayout: 0 },
    territories: { control: {}, income: 0, attackTimers: {}, lookouts: {} },

    // --- story arcs (plain state buckets; systems fill them in) ----------------------
    heist: {},
    revenge: {},
    crown: {},
    legacy: {},
    gambit: {},
    vice: { casinoWinnings: 0, racePoints: 0, raceWins: 0 },
    kingpin: {
      shipmentSeized: false,
      informantProtected: false,
      siegeSurvived: false,
      kingpinCrowned: false,
      fishingBest: 0,
      jetSkiBest: 0,
    },
    crewState: { members: [] },
    garage: { owned: {}, upgrades: {} },
    empire: { protection: {}, crewPosts: {}, rivalThreat: 0 },
    heatState: { level: 0, lastCrime: 0, raidTimer: 0 },

    // --- systems (ARRAY — never an object; see contract above) ------------------------
    systems: [],
    systemObjects: {},

    // --- persistence --------------------------------------------------------------------
    save: null,
  };

  // Attach a render bundle after the fact (bootstrap path). Keeps exactly
  // one scene/camera: it adopts the bundle's, it never creates its own.
  world.attachRender = function attachRender(render) {
    if (!render) return world;
    if (render.scene) world.scene = render.scene;
    if (render.camera) world.camera = render.camera;
    if (render.renderer) world.renderer = render.renderer;
    return world;
  };

  // Timestamped event log helper (systems push here, HUD drains it).
  world.addEvent = function addEvent(type, data) {
    const event = { type, data: data || null, at: world.elapsed };
    world.events.push(event);
    return event;
  };

  return world;
}

// Alias — some callers use createWorld.
export function createWorld(renderOrOpts) {
  return makeWorld(renderOrOpts);
}

export default makeWorld;
