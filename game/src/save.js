// Save — localStorage persistence for Solmar City.
// Saves cash, completed missions, owned properties, territory control,
// owned bikes, crew (health + posts), garage upgrades per car, empire
// income and threat, heat, cartel threat, casino winnings, racing league
// points and wins, nightclub income, fishing best catch, jet ski best
// time, and the player position.
// CRITICAL (v12 fix): load() MUST skip when no save exists — loading a
// nonexistent save used to break startup. It returns false and changes
// nothing in that case. Older saves load with defaults for new fields.
// Factory: createSave(world) or createSave(scene, world).

export const SAVE_KEY = 'solmar-city-save';
export const SAVE_VERSION = 9;

function normalizeArgs(scene, world) {
  if (world === undefined || world === null) {
    if (scene && (typeof scene.cash === 'number' || scene.player || scene.save)) return { scene: null, world: scene };
    return { scene: null, world: scene || {} };
  }
  return { scene, world };
}

function storage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (e) { /* no localStorage (headless) — fall through to memory */ }
  return null;
}

// In-memory fallback so headless tests can still round-trip a save.
const memoryStore = {};

// JSON.stringify replacer that drops live scene objects (meshes, groups)
// so a save never throws on circular crew/car state.
function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value, (key, v) => {
      if (key === 'mesh' || key === 'group' || key === 'scene' || key === 'material') return undefined;
      return v;
    }));
  } catch (e) {
    return undefined;
  }
}

function storeGet(key) {
  const s = storage();
  if (s) { try { return s.getItem(key); } catch (e) { return memoryStore[key] || null; } }
  return key in memoryStore ? memoryStore[key] : null;
}

function storeSet(key, value) {
  const s = storage();
  if (s) { try { s.setItem(key, value); return; } catch (e) { /* fall through */ } }
  memoryStore[key] = value;
}

function storeRemove(key) {
  const s = storage();
  if (s) { try { s.removeItem(key); } catch (e) { /* ignore */ } }
  delete memoryStore[key];
}

function playerPosition(world) {
  const p = world.player;
  if (!p) return { x: 0, z: 0 };
  if (p.position && typeof p.position.x === 'number') return { x: p.position.x, z: p.position.z || 0 };
  if (typeof p.x === 'number') return { x: p.x, z: p.z || 0 };
  return { x: 0, z: 0 };
}

function heatLevel(world) {
  if (typeof world.heat === 'number') return world.heat;
  if (world.heat && typeof world.heat.level === 'number') return world.heat.level;
  return 0;
}

function cartelThreat(world) {
  if (typeof world.cartelThreat === 'number') return world.cartelThreat;
  if (world.cartel && typeof world.cartel.threat === 'number') return world.cartel.threat;
  if (world.kingpin && typeof world.kingpin.cartelThreat === 'number') return world.kingpin.cartelThreat;
  return 0;
}

export function createSave(scene, world) {
  const args = normalizeArgs(scene, world);
  world = args.world;

  function serialize() {
    const kingpin = world.kingpin || {};
    return {
      version: SAVE_VERSION,
      cash: typeof world.cash === 'number' ? world.cash : 0,
      completedMissions: Array.isArray(world.completedMissions) ? world.completedMissions.slice() : [],
      properties: safeClone(world.properties) || { owned: {} },
      territories: safeClone(world.territories) || {},
      ownedBikes: Array.isArray(world.ownedBikes) ? world.ownedBikes.slice() : [],
      crew: safeClone(world.crew) || [],
      crewState: safeClone(world.crewState),
      garage: safeClone(world.garage) || {},
      empire: safeClone(world.empire) || {},
      heat: heatLevel(world),
      cartelThreat: cartelThreat(world),
      casinoWinnings: (world.vice && typeof world.vice.casinoWinnings === 'number') ? world.vice.casinoWinnings : (world.casinoWinnings || 0),
      racingPoints: (world.vice && world.vice.racingPoints) || world.racingPoints || 0,
      racingWins: (world.vice && world.vice.racingWins) || world.racingWins || 0,
      nightclubIncome: (world.vice && world.vice.nightclubIncome) || world.nightclubIncome || 0,
      fishingBestCatch: kingpin.fishingBestCatch || world.fishingBestCatch || null,
      jetSkiBestTime: kingpin.jetSkiBestTime || world.jetSkiBestTime || null,
      kingpin: safeClone(kingpin) || {},
      playerPosition: playerPosition(world),
      playerHealth: world.player && typeof world.player.health === 'number' ? world.player.health : 100,
      playerArmor: world.player && typeof world.player.armor === 'number' ? world.player.armor : 0,
      savedAt: Date.now(),
    };
  }

  function save() {
    try {
      storeSet(SAVE_KEY, JSON.stringify(serialize()));
      return true;
    } catch (e) {
      return false;
    }
  }

  function hasSave() {
    return storeGet(SAVE_KEY) !== null && storeGet(SAVE_KEY) !== undefined;
  }

  function load() {
    // No save on disk: skip entirely, change nothing, do not throw.
    const raw = storeGet(SAVE_KEY);
    if (raw === null || raw === undefined) return false;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    if (!data || typeof data !== 'object') return false;
    // Apply with defaults for older saves (missing fields stay as-is).
    if (typeof data.cash === 'number') world.cash = data.cash;
    if (Array.isArray(data.completedMissions)) world.completedMissions = data.completedMissions.slice();
    if (data.properties && typeof data.properties === 'object') {
      if (!world.properties) world.properties = { owned: {} };
      world.properties.owned = { ...(world.properties.owned || {}), ...(data.properties.owned || {}) };
      if (typeof data.properties.totalEarned === 'number') world.properties.totalEarned = data.properties.totalEarned;
      if (typeof data.properties.income === 'number') world.properties.income = data.properties.income;
    }
    if (data.territories && typeof data.territories === 'object') world.territories = data.territories;
    if (Array.isArray(data.ownedBikes)) world.ownedBikes = data.ownedBikes.slice();
    if (Array.isArray(data.crew)) world.crew = data.crew;
    if (data.crewState) world.crewState = data.crewState;
    if (data.garage && typeof data.garage === 'object') {
      if (!world.garage) world.garage = { cars: {} };
      world.garage.cars = { ...(world.garage.cars || {}), ...(data.garage.cars || {}) };
      if (Array.isArray(data.garage.ownedCars)) world.garage.ownedCars = data.garage.ownedCars.slice();
      if (typeof data.garage.tireDamage === 'number') world.garage.tireDamage = data.garage.tireDamage;
    }
    if (data.empire && typeof data.empire === 'object') world.empire = data.empire;
    if (typeof data.heat === 'number') {
      if (typeof world.heat === 'number') world.heat = data.heat;
      else if (world.heat && typeof world.heat.level === 'number') world.heat.level = data.heat;
      else world.heat = data.heat;
    }
    if (typeof data.cartelThreat === 'number') {
      if (typeof world.cartelThreat === 'number') world.cartelThreat = data.cartelThreat;
      else if (world.cartel && typeof world.cartel.threat === 'number') world.cartel.threat = data.cartelThreat;
      else world.cartelThreat = data.cartelThreat;
    }
    if (typeof data.casinoWinnings === 'number') {
      if (!world.vice) world.vice = {};
      world.vice.casinoWinnings = data.casinoWinnings;
    }
    if (typeof data.racingPoints === 'number') {
      if (!world.vice) world.vice = {};
      world.vice.racingPoints = data.racingPoints;
    }
    if (typeof data.racingWins === 'number') {
      if (!world.vice) world.vice = {};
      world.vice.racingWins = data.racingWins;
    }
    if (typeof data.nightclubIncome === 'number') {
      if (!world.vice) world.vice = {};
      world.vice.nightclubIncome = data.nightclubIncome;
    }
    if (data.kingpin && typeof data.kingpin === 'object') {
      if (!world.kingpin) world.kingpin = {};
      Object.assign(world.kingpin, data.kingpin);
    }
    if (data.fishingBestCatch) {
      if (!world.kingpin) world.kingpin = {};
      world.kingpin.fishingBestCatch = data.fishingBestCatch;
    }
    if (data.jetSkiBestTime !== null && data.jetSkiBestTime !== undefined) {
      if (!world.kingpin) world.kingpin = {};
      world.kingpin.jetSkiBestTime = data.jetSkiBestTime;
    }
    if (data.playerPosition && typeof data.playerPosition.x === 'number') {
      const p = world.player;
      if (p) {
        if (p.position && typeof p.position.x === 'number') {
          p.position.x = data.playerPosition.x;
          p.position.z = data.playerPosition.z || 0;
        } else if (typeof p.x === 'number') {
          p.x = data.playerPosition.x;
          p.z = data.playerPosition.z || 0;
        }
        if (typeof data.playerHealth === 'number') p.health = data.playerHealth;
        if (typeof data.playerArmor === 'number') p.armor = data.playerArmor;
      }
    }
    return true;
  }

  function clear() {
    storeRemove(SAVE_KEY);
    return true;
  }

  const system = { key: SAVE_KEY, version: SAVE_VERSION, save, load, hasSave, clear, serialize };
  // Expose on the world for the safehouse (shops) — as the save SYSTEM,
  // not as state data, so wire() never mistakes it for a state field.
  world.save = system;
  return system;
}

export default createSave;
