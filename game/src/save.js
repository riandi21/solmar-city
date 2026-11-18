// Save / load for Solmar City — one small JSON blob in localStorage.
//
// Key: 'solmar-city-save-v1'
// Shape: { cash, missionsDone: [ids], playerPos: { x, z }, wanted: 0 }
//
// A fresh load always starts unwated (wanted 0), however the last session
// ended. Every localStorage access is wrapped in try/catch: private
// windows and disabled storage must never crash the game — the save is
// simply lost for that visit.
//
// The missionsDone list comes from world.missionsDone, the array that
// missions.js publishes on the world object; if it is absent (e.g. the
// missions system has not run yet) an empty list is saved instead.
export const SAVE_KEY = 'solmar-city-save-v1';

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
  return true;
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
    };
  }

  function save(world) {
    const store = storage();
    if (!store || !world || !world.player || !world.player.pos) return false;
    const data = {
      cash: Math.floor(world.cash || 0),
      missionsDone: Array.isArray(world.missionsDone) ? [...world.missionsDone] : [],
      playerPos: { x: world.player.pos.x, z: world.player.pos.z },
      wanted: 0,
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
