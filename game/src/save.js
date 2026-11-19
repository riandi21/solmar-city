// Save system for Solmar City. One localStorage slot, versioned, so an
// older save still loads: any field it lacks falls back to a sane default
// instead of wiping Rico's progress.
const SAVE_KEY = 'solmar-city-save-v4';
const SAVE_VERSION = 4;
const AUTOSAVE_EVERY = 120;

function defaults() {
  return {
    version: SAVE_VERSION,
    cash: 500,
    health: 100,
    wanted: 0,
    completedMissions: [],
    ownedProperties: [],
    territoriesControl: {},
    ownedBikes: [],
    playerPosition: { x: 0, y: 0, z: 0 },
    playerHeading: 0,
    savedAt: 0,
  };
}

function readCash(world) {
  if (world.player && typeof world.player.cash === 'number') return world.player.cash;
  return typeof world.cash === 'number' ? world.cash : 500;
}

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (err) {
    return false;
  }
}

export function createSave(world) {
  let autosaveTimer = 0;
  let lastSavedAt = 0;

  function serialize() {
    const player = world.player || {};
    const pos = player.position || {};
    const properties = world.properties && Array.isArray(world.properties.owned)
      ? [...world.properties.owned] : [];
    const territories = world.territories && world.territories.control
      ? { ...world.territories.control } : {};
    const data = {
      version: SAVE_VERSION,
      cash: readCash(world),
      health: typeof player.health === 'number' ? player.health : 100,
      wanted: typeof world.wanted === 'number' ? world.wanted : 0,
      completedMissions: Array.isArray(world.completedMissions)
        ? [...world.completedMissions] : [],
      ownedProperties: properties,
      territoriesControl: territories,
      ownedBikes: Array.isArray(world.ownedBikes) ? [...world.ownedBikes] : [],
      playerPosition: {
        x: typeof pos.x === 'number' ? pos.x : 0,
        y: typeof pos.y === 'number' ? pos.y : 0,
        z: typeof pos.z === 'number' ? pos.z : 0,
      },
      playerHeading: typeof player.heading === 'number' ? player.heading : 0,
      savedAt: Date.now(),
    };
    return data;
  }

  function apply(data) {
    if (!data || typeof data !== 'object') return false;
    // Older saves (v1-v3) may miss the newer fields; defaults fill them in.
    // Clamp the numbers too: a hand-edited or corrupt save cannot grant
    // negative cash or more than full health.
    const merged = { ...defaults(), ...data };
    merged.cash = Math.max(0, Number(merged.cash) || 0);
    merged.health = Math.max(0, Math.min(100, Number(merged.health) || 100));
    merged.wanted = Math.max(0, Math.min(5, Number(merged.wanted) || 0));
    if (world.player) {
      world.player.cash = merged.cash;
      world.player.health = merged.health;
    }
    world.cash = merged.cash;
    world.wanted = merged.wanted;
    world.completedMissions = Array.isArray(merged.completedMissions)
      ? [...merged.completedMissions] : [];
    if (!world.properties || typeof world.properties !== 'object') {
      world.properties = { owned: [], incomeAccrued: 0, lastPayout: 0 };
    }
    world.properties.owned = Array.isArray(merged.ownedProperties)
      ? [...merged.ownedProperties] : [];
    if (!world.territories || typeof world.territories !== 'object') {
      world.territories = { control: {}, income: 0, lookouts: {}, attacks: [] };
    }
    world.territories.control = merged.territoriesControl || {};
    world.ownedBikes = Array.isArray(merged.ownedBikes) ? [...merged.ownedBikes] : [];
    if (world.player && world.player.position) {
      world.player.position.x = merged.playerPosition.x;
      world.player.position.y = merged.playerPosition.y;
      world.player.position.z = merged.playerPosition.z;
      world.player.heading = merged.playerHeading;
    }
    lastSavedAt = merged.savedAt || 0;
    return true;
  }

  function save() {
    const data = serialize();
    if (!storageAvailable()) return data;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      lastSavedAt = data.savedAt;
    } catch (err) {
      // Storage full or blocked: the in-memory snapshot is still returned.
    }
    return data;
  }

  function load() {
    if (!storageAvailable()) return null;
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return null;
    }
    return apply(data) ? data : null;
  }

  function hasSave() {
    if (!storageAvailable()) return false;
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch (err) {
      return false;
    }
  }

  function clearSave() {
    if (!storageAvailable()) return false;
    try {
      localStorage.removeItem(SAVE_KEY);
      return true;
    } catch (err) {
      return false;
    }
  }

  function update(dt) {
    autosaveTimer += dt;
    if (autosaveTimer >= AUTOSAVE_EVERY) {
      autosaveTimer = 0;
      if (world.mode === 'play') save();
    }
  }

  return {
    update,
    save,
    load,
    hasSave,
    clearSave,
    serialize,
    apply,
    exportSave() { return JSON.stringify(serialize()); },
    importSave(json) {
      try {
        return apply(JSON.parse(json));
      } catch (err) {
        return false;
      }
    },
    getKey() { return SAVE_KEY; },
    getVersion() { return SAVE_VERSION; },
    getLastSavedAt() { return lastSavedAt; },
  };
}
