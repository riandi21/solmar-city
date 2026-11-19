// Solmar City — the shared world state.
// One object, created in the bootstrap, passed to every system. State
// fields here hold DATA only; system objects live in world.systems (an
// ARRAY, never an object) or world.systemObjects. Nothing in this file
// overwrites a state field with a system.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRng } from './random.js';

function vec(x = 0, y = 0, z = 0) {
  return new THREE.Vector3(x, y, z);
}

function freshPlayer() {
  const player = {
    position: vec(0, 0, 60),
    heading: 0,
    speed: 0,
    onFoot: true,
    health: 100,
    maxHealth: 100,
    armor: 0,
    mesh: null,
    car: null,
    bike: null,
    boat: null,
    jetSki: null,
    cash: CONFIG.economy.startCash,
    weapon: 'pistol',
    ammo: { pistol: 60, smg: 0, shotgun: 0, rifle: 0, sniper: 0 },
    jumping: false,
    vy: 0,
  };
  // The vehicle Rico is actually aboard, or null. Boarded flags decide:
  // a heli/seaplane state object that merely EXISTS does not count as
  // aboard (v12 fix — treating it as aboard froze Rico at the helipad).
  player.currentVehicle = function currentVehicle(world) {
    const w = world || player._world;
    if (!w) return player.car || player.bike || player.boat || player.jetSki || null;
    if (w.playerHeli && w.playerHeli.boarded) return w.playerHeli;
    if (w.seaplane && w.seaplane.boarded) return w.seaplane;
    if (player.car) return player.car;
    if (player.bike) return player.bike;
    if (player.boat) return player.boat;
    if (player.jetSki) return player.jetSki;
    return null;
  };
  return player;
}

export function createWorld(options = {}) {
  const seed = options.seed !== undefined ? options.seed : CONFIG.seed;
  const rng = typeof options.rng === 'function' ? options.rng : createRng(seed);
  const world = {
    scene: options.scene || null,
    camera: options.camera || null,
    renderer: options.renderer || null,
    rng,
    config: CONFIG,
    seed,
    player: freshPlayer(),
    cars: [],
    bikes: [],
    boats: [],
    jetSkis: [],
    seaplane: {
      mesh: null, position: vec(320, 0, 200), heading: 0, speed: 0,
      altitude: 0, onWater: true, boarded: false, kind: 'seaplane',
    },
    playerHeli: {
      mesh: null, position: vec(29, 78, 29), heading: 0, speed: 0,
      altitude: 0, rotorSpeed: 0, onGround: true, boarded: false, kind: 'heli',
    },
    pedestrians: [],
    crew: [],
    enemies: [],
    gangShooters: [],
    federalAgents: [],
    cartelHitmen: [],
    wanted: 0,
    heat: 0,
    cartelThreat: 0,
    cash: CONFIG.economy.startCash,
    mission: { id: 0, stage: 0, objective: '', marker: null, timer: 0, active: false },
    missions: [],
    completedMissions: [],
    elapsed: 0,
    timeOfDay: 10,
    mode: 'menu',
    input: { keys: new Set(), pressed: new Set(), mouseDX: 0, mouseDY: 0, clicked: false, rightClicked: false },
    events: [],
    city: null,
    districts: [],
    properties: { owned: {}, income: 0, lastPayout: 0 },
    territories: {},
    heist: { cased: 0, vaultLoot: 0, done: false },
    revenge: { courierTailed: false, warehouseRaided: false, convoyAmbushed: false, donDefeated: false },
    crown: { informantMet: false, vaultCracked: false, betrayalSurvived: false, donDefeated: false },
    legacy: { protectionCollected: 0, ledgerStolen: false, blockadeBroken: false, legacySecured: false },
    gambit: { fedsEvaded: false, moneyMoved: false, moleExposed: false, gambitWon: false },
    vice: { casinoRigged: false, highRollerWon: false, havanaRunDone: false, viceKingCrowned: false, casinoWinnings: 0, leaguePoints: 0, leagueWins: 0, nightclubIncome: 0 },
    kingpin: {
      shipmentSeized: false, informantProtected: false, siegeSurvived: false,
      kingpinCrowned: false, cartelThreat: 0, fishingBest: null, jetSkiBestTime: null,
    },
    crewState: { hired: [], posted: {} },
    garage: { ownedCars: [], upgrades: {} },
    empire: { protectionIncome: 0, crewPosts: {}, rivalThreat: 10 },
    heatState: { level: 0, lastCrime: 0, raidTimer: 0 },
    daynight: { time: 10, isNight: false },
    weather: { kind: 'clear', rain: 0, fog: 0, grip: 1 },
    traffic: { cars: [], pedestrians: [] },
    systems: [],
    systemObjects: {},
    renderHandle: null,
    saveVersion: CONFIG.saveVersion,
  };
  world.player._world = world;
  for (const name of CONFIG.territories) world.territories[name] = { control: 20, income: 0, lookout: false };
  for (const p of CONFIG.properties) world.properties.owned[p.id] = false;

  world.emit = function emit(type, data) {
    world.events.push({ type, data: data || {}, at: world.elapsed });
  };
  world.addCash = function addCash(amount) {
    world.cash += amount;
    world.player.cash = world.cash;
    return world.cash;
  };
  world.spendCash = function spendCash(amount) {
    if (world.cash < amount) return false;
    world.cash -= amount;
    world.player.cash = world.cash;
    return true;
  };
  world.raiseWanted = function raiseWanted(n) {
    world.wanted = Math.min(CONFIG.wanted.max, world.wanted + n);
  };
  world.isNight = function isNight() {
    const t = world.timeOfDay;
    return t < 6 || t >= 19;
  };
  world.districtAt = function districtAt(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const d of CONFIG.districts) {
      const dx = x - d.x;
      const dz = z - d.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  };
  world.resetRun = function resetRun() {
    world.player.health = world.player.maxHealth;
    world.player.position.set(0, 0, 60);
    world.player.heading = 0;
    world.player.onFoot = true;
    world.player.car = null;
    world.player.bike = null;
    world.player.boat = null;
    world.player.jetSki = null;
    world.wanted = 0;
    world.heat = 0;
    world.elapsed = 0;
    world.events.length = 0;
    world.enemies.length = 0;
    world.gangShooters.length = 0;
    world.mode = 'menu';
  };
  world.registerSystem = function registerSystem(name, system) {
    world.systems.push(system);
    if (name) world.systemObjects[name] = system;
    return system;
  };
  return world;
}

export const createSharedState = createWorld;
export default createWorld;
