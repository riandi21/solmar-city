// Garage — car customization at Rico's Garage (-150, 200).
// Press G near the garage to open the menu, then 1-5 to buy upgrades for
// the player's current car. Upgrades belong to the car (each owned car
// keeps its own set) and persist in the save (world.garage).
// Factory: createGarage(scene, world) or createGarage(world).

export const GARAGE_POS = { x: -150, z: 200 };

export const GARAGE_UPGRADES = [
  { id: 'paint', name: 'Paint job', price: 200, desc: 'Fresh paint, pick a color' },
  { id: 'armor', name: 'Armor plating', price: 500, desc: 'Halves crash damage' },
  { id: 'engine', name: 'Engine tune', price: 1000, desc: 'Raises top speed' },
  { id: 'nos', name: 'NOS tank', price: 400, desc: 'Doubles the boost meter' },
  { id: 'hydraulics', name: 'Hydraulics', price: 300, desc: 'Lowrider bounce (H)' },
];

export const PAINT_COLORS = [0xe5534b, 0x4fc3f7, 0xf2c94c, 0x37d67a, 0x9b59b6, 0xe8e8e8, 0x222222];

function normalizeArgs(scene, world) {
  if (world === undefined || world === null) {
    if (scene && (typeof scene.cash === 'number' || scene.player || scene.garage)) return { scene: null, world: scene };
    return { scene: null, world: scene || {} };
  }
  return { scene, world };
}

function playerPos(world) {
  const p = world.player;
  if (!p) return null;
  if (p.position && typeof p.position.x === 'number') return { x: p.position.x, z: p.position.z || 0 };
  if (typeof p.x === 'number') return { x: p.x, z: p.z || 0 };
  return null;
}

function toast(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'toast', text });
  else if (typeof world.toast === 'function') world.toast(text);
  else if (Array.isArray(world.messages)) world.messages.push(text);
}

function keyDown(world, key) {
  const input = world.input;
  if (!input) return false;
  if (input.pressed && typeof input.pressed.has === 'function') return input.pressed.has(key);
  if (input.keys && typeof input.keys.has === 'function') return input.keys.has(key);
  if (input[key] === true) return true;
  return false;
}

function currentCar(world) {
  if (world.playerCar) return world.playerCar;
  if (world.player && world.player.currentCar) return world.player.currentCar;
  if (world.player && world.player.car) return world.player.car;
  if (Array.isArray(world.cars)) return world.cars.find((c) => c.isPlayer || c.driver === 'player') || null;
  return null;
}

export function createGarage(scene, world) {
  const args = normalizeArgs(scene, world);
  scene = args.scene;
  world = args.world;

  if (!world.garage || typeof world.garage !== 'object') {
    world.garage = { cars: {}, ownedCars: [], tireDamage: 0, menuOpen: false };
  }
  const state = world.garage;
  if (!state.cars || typeof state.cars !== 'object') state.cars = {};
  if (!Array.isArray(state.ownedCars)) state.ownedCars = [];
  if (typeof state.tireDamage !== 'number') state.tireDamage = 0;
  if (typeof world.cash !== 'number') world.cash = 0;

  let menuOpen = !!state.menuOpen;
  let prevG = false;
  let paintIndex = 0;

  function carIdFor(car) {
    if (!car) return 'default';
    if (car.id !== undefined && car.id !== null) return String(car.id);
    if (car.kind) return `kind-${car.kind}`;
    return 'default';
  }

  function getUpgrades(car) {
    const id = carIdFor(car);
    if (!state.cars[id]) state.cars[id] = { paint: null, armor: false, engine: 0, nos: false, hydraulics: false };
    return state.cars[id];
  }

  function hasUpgrade(kind, car) {
    const up = getUpgrades(car);
    if (kind === 'paint') return up.paint !== null && up.paint !== undefined;
    if (kind === 'engine') return up.engine > 0;
    return !!up[kind];
  }

  function topSpeedBonus(car) {
    return getUpgrades(car).engine * 8;
  }

  // Re-apply a car's stored upgrades after a load (engine speed, armor,
  // NOS capacity, hydraulics flag, paint color).
  function applyUpgrades(car) {
    if (!car) return null;
    const up = getUpgrades(car);
    if (up.armor) car.armor = true;
    if (up.nos) car.nosMax = Math.max(car.nosMax || 100, 200);
    if (up.hydraulics) car.hydraulics = true;
    if (up.paint !== null && up.paint !== undefined) car.color = up.paint;
    if (up.engine > 0) car.maxSpeed = (car.baseMaxSpeed || car.maxSpeed || 30) + up.engine * 8;
    return up;
  }

  function buyUpgrade(kind, car) {
    const def = GARAGE_UPGRADES.find((u) => u.id === kind);
    if (!def) return { ok: false, reason: 'unknown upgrade' };
    const target = car || currentCar(world);
    const up = getUpgrades(target);
    if (kind === 'paint') {
      if (world.cash < def.price) return { ok: false, reason: 'not enough cash' };
      world.cash -= def.price;
      paintIndex = (paintIndex + 1) % PAINT_COLORS.length;
      up.paint = PAINT_COLORS[paintIndex];
      if (target) target.color = up.paint;
      toast(world, `Paint job done — $${def.price}`);
      return { ok: true, def, color: up.paint };
    }
    if (kind === 'engine') {
      if (up.engine >= 3) return { ok: false, reason: 'engine fully tuned' };
      if (world.cash < def.price) return { ok: false, reason: 'not enough cash' };
      world.cash -= def.price;
      up.engine += 1;
      if (target) target.maxSpeed = (target.maxSpeed || 30) + 8;
      toast(world, `Engine tuned (level ${up.engine}) — $${def.price}`);
      return { ok: true, def };
    }
    if (up[kind]) return { ok: false, reason: 'already installed' };
    if (world.cash < def.price) return { ok: false, reason: 'not enough cash' };
    world.cash -= def.price;
    up[kind] = true;
    if (kind === 'armor' && target) target.armor = true;
    if (kind === 'nos' && target) target.nosMax = (target.nosMax || 100) * 2;
    if (kind === 'hydraulics' && target) target.hydraulics = true;
    toast(world, `${def.name} installed — $${def.price}`);
    return { ok: true, def };
  }

  function repairTires() {
    if (state.tireDamage <= 0) return { ok: false, reason: 'no tire damage' };
    const ownsGarage = !!(world.properties && world.properties.owned && world.properties.owned.garage);
    const cost = ownsGarage ? 0 : 100;
    if (world.cash < cost) return { ok: false, reason: 'not enough cash' };
    world.cash -= cost;
    state.tireDamage = 0;
    const car = currentCar(world);
    if (car) { car.tireDamage = 0; car.slowed = false; }
    toast(world, cost === 0 ? 'Tires repaired free — you own the garage' : `Tires repaired — $${cost}`);
    return { ok: true, cost };
  }

  function openMenu() { menuOpen = true; state.menuOpen = true; }
  function closeMenu() { menuOpen = false; state.menuOpen = false; }
  function toggleMenu() { if (menuOpen) closeMenu(); else openMenu(); }

  function nearGarage() {
    const pos = playerPos(world);
    if (!pos) return false;
    return Math.hypot(pos.x - GARAGE_POS.x, pos.z - GARAGE_POS.z) < 9;
  }

  function update(dt) {
    const gDown = keyDown(world, 'KeyG') || keyDown(world, 'g') || keyDown(world, 'G');
    if (gDown && !prevG && nearGarage()) toggleMenu();
    prevG = gDown;
    if (menuOpen) {
      const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
      for (let i = 0; i < GARAGE_UPGRADES.length; i += 1) {
        if (keyDown(world, keys[i])) {
          // Edge-trigger via a per-key latch stored on the system state.
          if (!state._lastKey || state._lastKey !== keys[i]) buyUpgrade(GARAGE_UPGRADES[i].id);
          state._lastKey = keys[i];
        }
      }
      if (!keys.some((k) => keyDown(world, k))) state._lastKey = null;
      if (keyDown(world, 'Escape')) closeMenu();
    }
    // Tire damage on the current car mirrors into garage state.
    const car = currentCar(world);
    if (car && typeof car.tireDamage === 'number' && car.tireDamage > 0) state.tireDamage = car.tireDamage;
  }

  const system = {
    upgrades: GARAGE_UPGRADES,
    position: GARAGE_POS,
    menuOpen: () => menuOpen,
    isOpen: () => menuOpen,
    openMenu,
    closeMenu,
    toggleMenu,
    buyUpgrade,
    buy: buyUpgrade,
    getUpgrades,
    hasUpgrade,
    topSpeedBonus,
    applyUpgrades,
    repairTires,
    repair: repairTires,
    nearGarage,
    currentCar: () => currentCar(world),
    update,
  };
  if (Array.isArray(world.systems) && !world.systems.includes(system.update)) world.systems.push(system.update);
  return system;
}

export default createGarage;
