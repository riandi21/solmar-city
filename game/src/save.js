// Save / load for Solmar City — one small JSON blob in localStorage.
//
// Key: 'solmar-city-save-v1'
// Shape: { cash, missionsDone: [ids], playerPos: { x, z }, wanted: 0,
//   version: 3, packagesFound: [indices], raceBest: { id: seconds },
//   taxiEarned: 0, armor: 0 }
//
// A fresh load always starts unwated (wanted 0), however the last session
// ended. Every localStorage access is wrapped in try/catch: private
// windows and disabled storage must never crash the game — the save is
// simply lost for that visit.
//
// The missionsDone list comes from world.missionsDone, the array that
// missions.js publishes on the world object; if it is absent (e.g. the
// missions system has not run yet) an empty list is saved instead.
// v3 fields are optional on load (a v1/v2 save just loads with zeroes)
// and are written from world.activitiesProgress, which activities.js
// publishes, and world.player.armor, which the shop maintains.
export const SAVE_KEY = 'solmar-city-save-v1';
export const SAVE_VERSION = 3;

function storage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

function validSave(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.cash !== 'number' || !Number.isFinite(data.cash)) return false;
  if (!Array.isArray(data.missionsDone)) return false;
  if (!data.missionsDone.every((id) => Number.isInteger(id))) return false;
  if (
    !data.playerPos
    || typeof data.playerPos.x !== 'number'
    || typeof data.playerPos.z !== 'number'
    || !Number.isFinite(data.playerPos.x)
    || !Number.isFinite(data.playerPos.z)
  ) {
    return false;
  }
  // v3 fields are optional (v1/v2 saves do not have them) but must be
  // well-formed when present, so a hand-edited save cannot smuggle in
  // nonsense the game then trusts.
  if (data.packagesFound !== undefined) {
    if (!Array.isArray(data.packagesFound)) return false;
    if (!data.packagesFound.every((i) => Number.isInteger(i) && i >= 0 && i < 20)) return false;
  }
  if (data.raceBest !== undefined) {
    if (!data.raceBest || typeof data.raceBest !== 'object') return false;
    for (const t of Object.values(data.raceBest)) {
      if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) return false;
    }
  }
  if (data.taxiEarned !== undefined && (typeof data.taxiEarned !== 'number' || !Number.isFinite(data.taxiEarned))) return false;
  if (data.armor !== undefined && (typeof data.armor !== 'number' || !Number.isFinite(data.armor) || data.armor < 0)) return false;
  return true;
}

/** v3 defaults for a save that predates them (or a fresh game). */
function v3Defaults(data) {
  return {
    packagesFound: Array.isArray(data.packagesFound) ? [...data.packagesFound] : [],
    raceBest: data.raceBest && typeof data.raceBest === 'object' ? { ...data.raceBest } : {},
    taxiEarned: typeof data.taxiEarned === 'number' ? data.taxiEarned : 0,
    armor: typeof data.armor === 'number' ? data.armor : 0,
  };
}

export function createSave() {
  function load() {
    const store = storage();
    if (!store) return null;
    let raw = null;
    try {
      raw = store.getItem(SAVE_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      return null; // corrupt JSON: treat as no save, never throw
    }
    if (!validSave(data)) return null;
    return {
      cash: data.cash,
      missionsDone: [...data.missionsDone],
      playerPos: { x: data.playerPos.x, z: data.playerPos.z },
      wanted: 0,
      version: SAVE_VERSION,
      ...v3Defaults(data),
    };
  }

  function save(world) {
    const store = storage();
    if (!store || !world || !world.player || !world.player.pos) return false;
    const progress = world.activitiesProgress || {};
    const data = {
      cash: Math.floor(world.cash || 0),
      missionsDone: Array.isArray(world.missionsDone) ? [...world.missionsDone] : [],
      playerPos: { x: world.player.pos.x, z: world.player.pos.z },
      wanted: 0,
      version: SAVE_VERSION,
      packagesFound: Array.isArray(progress.packagesFound) ? [...progress.packagesFound] : [],
      raceBest: progress.raceBest && typeof progress.raceBest === 'object' ? { ...progress.raceBest } : {},
      taxiEarned: typeof progress.taxiEarned === 'number' ? progress.taxiEarned : 0,
      armor: typeof world.player.armor === 'number' ? world.player.armor : 0,
    };
    try {
      store.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      return false;
    }
    return true;
  }

  return { load, save };
}
