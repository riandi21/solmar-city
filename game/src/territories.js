// Territories — district control for Solmar City.
// Six districts, control 0-100. Missions and activities in a district
// raise control; a controlled district (>60) pays passive income and
// spawns a friendly lookout who marks nearby police on the minimap.
// Rival gangs periodically attack a controlled district: defeat the
// squad or lose 20 control. Control persists in the save.
import * as THREE from 'three';

export const DISTRICTS = ['Downtown', 'Old Town', 'Marina', 'Boardwalk', 'Freight Yard', 'Airfield'];

const DISTRICT_CENTERS = {
  Downtown: { x: 0, z: 0 },
  'Old Town': { x: -203, z: -58 },
  Marina: { x: 320, z: 160 },
  Boardwalk: { x: 0, z: 264 },
  'Freight Yard': { x: -170, z: -260 },
  Airfield: { x: 200, z: -230 },
};
const INCOME = { Downtown: 150, 'Old Town': 100, Marina: 130, Boardwalk: 110, 'Freight Yard': 80, Airfield: 120 };

export function createTerritories(scene, world) {
  const w = world || {};
  if (!w.territories || typeof w.territories !== 'object' || Array.isArray(w.territories)) {
    w.territories = { control: {}, income: 0, attackTimers: {}, lookouts: {} };
  }
  const t = w.territories;
  if (!t.control || typeof t.control !== 'object') t.control = {};
  if (!t.attackTimers || typeof t.attackTimers !== 'object') t.attackTimers = {};
  if (!t.lookouts || typeof t.lookouts !== 'object') t.lookouts = {};
  for (const d of DISTRICTS) {
    if (typeof t.control[d] !== 'number') t.control[d] = 0;
    if (typeof t.attackTimers[d] !== 'number') t.attackTimers[d] = 90 + Math.random() * 120;
  }
  if (typeof t.income !== 'number') t.income = 0;
  const state = { underAttack: null, attackSquad: [] };
  if (!w.territoryState) w.territoryState = state;

  function districtAt(x, z) {
    let best = 'Downtown'; let bestD = Infinity;
    for (const d of DISTRICTS) {
      const c = DISTRICT_CENTERS[d];
      const dd = Math.hypot(x - c.x, z - c.z);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  function raiseControl(district, amount) {
    if (!DISTRICTS.includes(district)) return t.control[district];
    const before = t.control[district];
    t.control[district] = Math.min(100, before + amount);
    if (before <= 60 && t.control[district] > 60) {
      spawnLookout(district);
      if (typeof w.toast === 'function') w.toast(`${district} is now under your control — lookout posted.`);
    }
    return t.control[district];
  }

  function lowerControl(district, amount) {
    if (!DISTRICTS.includes(district)) return;
    t.control[district] = Math.max(0, t.control[district] - amount);
    if (t.control[district] <= 60 && t.lookouts[district]) removeLookout(district);
  }

  function spawnLookout(district) {
    const c = DISTRICT_CENTERS[district];
    let mesh = null;
    if (scene) {
      mesh = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.1, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2e7d32 }),
      );
      body.position.y = 1.0;
      mesh.add(body);
      mesh.position.set(c.x + 6, 0, c.z + 6);
      scene.add(mesh);
    }
    t.lookouts[district] = { district, position: { x: c.x + 6, y: 0, z: c.z + 6 }, mesh, friendly: true };
    if (!Array.isArray(w.lookouts)) w.lookouts = [];
    w.lookouts.push(t.lookouts[district]);
    return t.lookouts[district];
  }

  function removeLookout(district) {
    const l = t.lookouts[district];
    if (l && l.mesh && l.mesh.parent) l.mesh.parent.remove(l.mesh);
    if (Array.isArray(w.lookouts)) {
      const i = w.lookouts.indexOf(l);
      if (i >= 0) w.lookouts.splice(i, 1);
    }
    delete t.lookouts[district];
  }

  // A lookout marks nearby police on the minimap for its district.
  function lookoutMarksPolice(district) {
    if (!t.lookouts[district]) return [];
    const c = DISTRICT_CENTERS[district];
    const cars = Array.isArray(w.cars) ? w.cars.filter((car) => car && car.kind === 'police') : [];
    return cars.filter((car) => car.position && Math.hypot(car.position.x - c.x, car.position.z - c.z) < 120);
  }

  function startAttack(district) {
    const c = DISTRICT_CENTERS[district];
    state.underAttack = district;
    state.attackSquad = [];
    const combat = w.systemObjects && w.systemObjects.combat;
    for (let i = 0; i < 3; i += 1) {
      if (combat && typeof combat.spawnShooter === 'function') {
        state.attackSquad.push(combat.spawnShooter(c.x + (i - 1) * 4, c.z + 8, { kind: 'gang' }));
      } else {
        const s = { kind: 'gang', position: { x: c.x + (i - 1) * 4, y: 0, z: c.z + 8 }, health: 60, alive: true };
        state.attackSquad.push(s);
        if (!Array.isArray(w.enemies)) w.enemies = [];
        w.enemies.push(s);
      }
    }
    // A posted crew member fights the attackers, so the squad is weaker.
    const posted = w.empire && w.empire.posts ? Object.values(w.empire.posts).filter((p) => p === district).length : 0;
    if (posted > 0 && state.attackSquad.length > 0) {
      const weak = state.attackSquad[0];
      weak.health = Math.max(10, weak.health - 30);
    }
    if (typeof w.toast === 'function') w.toast(`Rival gang is attacking ${district}! Defend it or lose 20 control.`);
    t.attackTimers[district] = 150 + Math.random() * 120;
    return state.attackSquad;
  }

  function resolveAttack(won) {
    const district = state.underAttack;
    if (!district) return;
    if (!won) lowerControl(district, 20);
    else if (typeof w.toast === 'function') w.toast(`${district} defended!`);
    state.underAttack = null;
    state.attackSquad = [];
  }

  function hourlyIncome() {
    let total = 0;
    for (const d of DISTRICTS) if (t.control[d] > 60) total += INCOME[d];
    return total;
  }
  function controlledDistricts() {
    return DISTRICTS.filter((d) => t.control[d] > 60);
  }
  function totalControl() {
    return DISTRICTS.reduce((sum, d) => sum + t.control[d], 0);
  }

  function update(dt) {
    if (w.mode !== 'play') return;
    // Passive income accrues per in-game hour.
    const hourFrac = dt / 3600;
    const income = hourlyIncome() * hourFrac;
    if (income > 0) {
      t.income += income;
      w.cash = (w.cash || 0) + income;
    }
    // Rival attacks on controlled districts.
    for (const d of DISTRICTS) {
      if (t.control[d] <= 60) continue;
      t.attackTimers[d] -= dt;
      if (t.attackTimers[d] <= 0 && !state.underAttack) startAttack(d);
    }
    if (state.underAttack) {
      const alive = state.attackSquad.filter((s) => s && s.alive !== false && (s.health === undefined || s.health > 0));
      const stillListed = state.attackSquad.filter((s) => !Array.isArray(w.enemies) || w.enemies.includes(s));
      if (alive.length === 0 || stillListed.length === 0) resolveAttack(true);
    }
  }

  const api = {
    update, raiseControl, lowerControl, districtAt, spawnLookout, removeLookout,
    lookoutMarksPolice, startAttack, resolveAttack, hourlyIncome,
    controlledDistricts, totalControl,
    districts: DISTRICTS, centers: DISTRICT_CENTERS, income: INCOME,
    get control() { return t.control; },
    get underAttack() { return state.underAttack; },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  return api;
}

export default createTerritories;
