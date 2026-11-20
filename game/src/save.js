// Save: localStorage persistence for Solmar City (save v9).
// load() SKIPS cleanly when no save exists — it never crashes on a
// missing save. Older saves load with defaults for any v9 field
// they lack. Exposed as world.save = { save, load, hasSave }.

export const SAVE_KEY = 'solmar-city-save-v9';
export const SAVE_VERSION = 9;

let memoryFallback = null; // used when localStorage is unavailable

function storageAvailable() {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; }
  catch { return false; }
}

function readRaw() {
  if (storageAvailable()) {
    try { return localStorage.getItem(SAVE_KEY); } catch { return memoryFallback; }
  }
  return memoryFallback;
}

function writeRaw(text) {
  if (storageAvailable()) {
    try { localStorage.setItem(SAVE_KEY, text); return; } catch { /* fall through */ }
  }
  memoryFallback = text;
}

function clone(value, fallback) {
  if (value === undefined || value === null) return fallback;
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

function posOf(world) {
  const p = world.player || {};
  const q = p.position || p;
  return { x: Number(q.x ?? p.x ?? 0), y: Number(q.y ?? 0), z: Number(q.z ?? p.z ?? q.y ?? p.y ?? 0) };
}

export function createSave(world) {
  function collect() {
    const p = world.player || {};
    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      cash: Number(world.cash ?? p.cash ?? 0),
      completedMissions: clone(world.completedMissions ?? world.missions?.completed ?? [], []),
      properties: clone(world.properties?.owned ?? {}, {}),
      propertyIncome: Number(world.properties?.income ?? 0),
      territories: clone(world.territories ?? world.territoryControl ?? {}, {}),
      ownedBikes: clone(world.ownedBikes ?? p.bikes ?? [], []),
      crew: clone(world.crew ?? p.crew ?? [], []),
      garageUpgrades: clone(world.garage?.upgrades ?? {}, {}),
      garageOwned: clone(world.garage?.owned ?? {}, {}),
      empireIncome: Number(world.empire?.income ?? world.empireIncome ?? 0),
      empireThreat: Number(world.empire?.threat ?? world.empireThreat ?? 0),
      heat: Number(world.heat ?? p.wanted ?? p.heat ?? 0),
      cartelThreat: Number(world.cartelThreat ?? world.cartel?.threat ?? 0),
      casinoWinnings: Number(world.casinoWinnings ?? world.casino?.winnings ?? 0),
      racingPoints: Number(world.racing?.points ?? world.racingPoints ?? 0),
      racingWins: Number(world.racing?.wins ?? world.racingWins ?? 0),
      nightclubIncome: Number(world.nightclubIncome ?? world.clubIncome ?? 0),
      fishingBest: clone(world.kingpin?.fishingBest ?? world.fishingBest ?? null, null),
      jetSkiBest: clone(world.kingpin?.jetSkiBest ?? world.jetSkiBest ?? null, null),
      playerPosition: posOf(world),
      playerHealth: Number(p.health ?? 100),
    };
  }

  function save() {
    const data = collect();
    try {
      writeRaw(JSON.stringify(data));
    } catch {
      return false;
    }
    if (Array.isArray(world.events)) world.events.push({ type: 'saved', at: data.savedAt });
    return true;
  }

  function apply(data) {
    if (!data || typeof data !== 'object') return false;
    const p = world.player || {};
    const cash = Number(data.cash ?? 0);
    world.cash = cash;
    if (world.player) world.player.cash = cash;

    world.completedMissions = clone(data.completedMissions, []);
    if (world.missions) world.missions.completed = clone(data.completedMissions, []);

    if (!world.properties || typeof world.properties !== 'object') world.properties = {};
    world.properties.owned = clone(data.properties, {});
    world.properties.income = Number(data.propertyIncome ?? 0);

    world.territories = clone(data.territories, {});
    world.territoryControl = clone(data.territories, {});

    world.ownedBikes = clone(data.ownedBikes, []);
    if (world.player) world.player.bikes = clone(data.ownedBikes, []);

    world.crew = clone(data.crew, []);
    if (world.player) world.player.crew = clone(data.crew, []);

    if (!world.garage || typeof world.garage !== 'object') world.garage = {};
    world.garage.upgrades = clone(data.garageUpgrades, {});
    world.garage.owned = clone(data.garageOwned, {});

    if (!world.empire || typeof world.empire !== 'object') world.empire = {};
    world.empire.income = Number(data.empireIncome ?? 0);
    world.empire.threat = Number(data.empireThreat ?? 0);

    world.heat = Number(data.heat ?? 0);
    if (world.player) { world.player.wanted = world.heat; world.player.heat = world.heat; }

    world.cartelThreat = Number(data.cartelThreat ?? 0);
    world.casinoWinnings = Number(data.casinoWinnings ?? 0);
    if (!world.racing || typeof world.racing !== 'object') world.racing = {};
    world.racing.points = Number(data.racingPoints ?? 0);
    world.racing.wins = Number(data.racingWins ?? 0);
    world.nightclubIncome = Number(data.nightclubIncome ?? 0);

    if (!world.kingpin || typeof world.kingpin !== 'object') world.kingpin = {};
    world.kingpin.fishingBest = clone(data.fishingBest, null);
    world.kingpin.jetSkiBest = clone(data.jetSkiBest, null);

    const pos = data.playerPosition || {};
    if (world.player) {
      if (world.player.position && typeof world.player.position === 'object') {
        world.player.position.x = Number(pos.x ?? 0);
        world.player.position.z = Number(pos.z ?? pos.y ?? 0);
        if ('y' in world.player.position) world.player.position.y = Number(pos.y ?? 0);
      } else {
        world.player.x = Number(pos.x ?? 0);
        world.player.z = Number(pos.z ?? pos.y ?? 0);
      }
      world.player.health = Number(data.playerHealth ?? 100);
    }
    return true;
  }

  function load() {
    // CRITICAL: no save yet is normal — skip, do not crash.
    let raw = null;
    try { raw = readRaw(); } catch { return false; }
    if (!raw) return false;
    let data = null;
    try { data = JSON.parse(raw); } catch { return false; }
    if (!data || typeof data !== 'object') return false;
    // v9 defaults: any field an older save lacks stays at its default
    // because apply() falls back with ?? / clone() fallbacks.
    return apply(data);
  }

  function hasSave() {
    try { return Boolean(readRaw()); } catch { return false; }
  }

  // Delete the save entirely (new-game reset); never called by load().
  function clear() {
    try {
      if (storageAvailable()) localStorage.removeItem(SAVE_KEY);
    } catch { /* ignore */ }
    memoryFallback = null;
    return true;
  }

  const api = { save, load, hasSave, clear };
  world.save = api;
  return api;
}
