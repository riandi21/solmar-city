// Garage: car customization at Rico's Garage (-150, 200).
// Paint, armor, engine, NOS and (Lowrider only) hydraulics are bought
// per car — each owned car keeps its own upgrade set, persisted in
// the save. Tire damage from spike strips is repaired free when the
// player owns Rico's Garage, otherwise $100.

export const GARAGE_POS = { x: -150, z: 200 };
export const GARAGE_RADIUS = 9;

export const UPGRADE_PRICES = { paint: 200, armor: 500, engine: 1000, nos: 400, hydraulics: 300 };
export const PAINT_COLORS = ['#d21f2b', '#1f6fd2', '#f2c200', '#22a55b', '#7b2fd2', '#e8e8e8', '#111111', '#ff6a00'];

function posOf(world) {
  const p = world.player || {};
  const q = p.position || p;
  return { x: Number(q.x ?? p.x ?? 0), z: Number(q.z ?? p.z ?? q.y ?? p.y ?? 0) };
}

function cashOf(world) { return Number(world.cash ?? world.player?.cash ?? 0); }

function setCash(world, value) {
  const v = Math.max(0, Math.floor(value));
  world.cash = v;
  if (world.player) world.player.cash = v;
  return v;
}

function toast(world, text) {
  if (typeof world.addToast === 'function') { world.addToast(text); return; }
  if (Array.isArray(world.events)) world.events.push({ type: 'toast', text, message: text });
}

function keyDown(world, ...codes) {
  const keys = world.input?.keys;
  if (!keys) return false;
  for (const c of codes) if (keys.has(c)) return true;
  return false;
}

export function createGarage(world) {
  if (!world.garage || typeof world.garage !== 'object') world.garage = {};
  const store = world.garage;
  if (!store.upgrades || typeof store.upgrades !== 'object') store.upgrades = {};
  if (!store.owned || typeof store.owned !== 'object') store.owned = {};

  let prevE = false;

  function currentCarId() {
    const car = world.player?.currentCar || world.player?.car || world.currentCar;
    if (car && typeof car === 'object') return String(car.id ?? car.name ?? 'default');
    if (typeof car === 'string' && car) return car;
    return 'default';
  }

  function currentCar() {
    const car = world.player?.currentCar || world.player?.car || world.currentCar;
    return (car && typeof car === 'object') ? car : null;
  }

  function carUpgrades(carId) {
    const id = carId || currentCarId();
    if (!store.upgrades[id] || typeof store.upgrades[id] !== 'object') {
      store.upgrades[id] = { paint: null, armor: false, engine: false, nos: false, hydraulics: false };
    }
    return store.upgrades[id];
  }

  function isLowrider() {
    const car = currentCar();
    const kind = String(car?.kind ?? car?.type ?? car?.name ?? '').toLowerCase();
    return kind.includes('lowrider') || kind.includes('low-rider');
  }

  function applyToCar(up) {
    const car = currentCar();
    if (!car) return;
    if (up.paint) car.color = up.paint;
    if (up.armor) car.armor = true; // halves crash damage (checked by the crash code)
    if (up.engine) car.topSpeed = Math.max(Number(car.topSpeed || 0), 52);
    if (up.nos) car.boostMax = Math.max(Number(car.boostMax || 100), 200); // doubles boost meter
    if (up.hydraulics) car.hydraulics = true; // enables the H bounce
  }

  // Price lookup for the HUD/menu, without buying anything.
  function upgradePrice(kind) {
    return UPGRADE_PRICES[kind] ?? null;
  }

  function openMenu() {
    const up = carUpgrades();
    if (Array.isArray(world.events)) {
      world.events.push({ type: 'garage-menu', car: currentCarId(), upgrades: { ...up } });
    }
    toast(world, "Rico's Garage — paint $200, armor $500, engine $1000, NOS $400" + (isLowrider() ? ', hydraulics $300.' : '.'));
    return { ...up };
  }

  function buyUpgrade(kind, color) {
    const up = carUpgrades();
    const price = UPGRADE_PRICES[kind];
    if (price === undefined) { toast(world, 'No such upgrade.'); return false; }
    if (kind === 'hydraulics' && !isLowrider()) {
      toast(world, 'Hydraulics only fit a Lowrider.');
      return false;
    }
    if (kind === 'paint') {
      if (cashOf(world) < price) { toast(world, 'Not enough cash for paint ($200).'); return false; }
      const picked = color || PAINT_COLORS[Math.floor(Math.random() * PAINT_COLORS.length)];
      setCash(world, cashOf(world) - price);
      up.paint = picked;
      applyToCar(up);
      toast(world, 'Painted your car ' + picked + ' (-$200).');
      return true;
    }
    if (up[kind]) { toast(world, 'Already fitted: ' + kind + '.'); return false; }
    if (cashOf(world) < price) { toast(world, 'Not enough cash for ' + kind + ' ($' + price + ').'); return false; }
    setCash(world, cashOf(world) - price);
    up[kind] = true;
    applyToCar(up);
    toast(world, 'Fitted ' + kind + ' (-$' + price + ').');
    return true;
  }

  function ownsGarageProperty() {
    const props = world.systemObjects?.properties;
    if (props && typeof props.isOwned === 'function') return props.isOwned('garage');
    return Boolean(world.properties?.owned?.garage);
  }

  function repairTires() {
    const p = world.player || {};
    const damaged = p.tireDamage || p.spikeDamage || p.flatTires;
    const free = ownsGarageProperty();
    const price = free ? 0 : 100;
    if (!damaged && !free) {
      // Still allow a paid check-up? No — nothing to fix, don't charge.
      toast(world, 'Tires look fine — no repair needed.');
      return true;
    }
    if (cashOf(world) < price) { toast(world, 'Tire repair costs $100 — not enough cash.'); return false; }
    if (price > 0) setCash(world, cashOf(world) - price);
    if (p) { p.tireDamage = 0; p.spikeDamage = 0; p.flatTires = 0; }
    toast(world, free ? 'Rico repairs your tires free — you own the garage.' : 'Tires repaired (-$100).');
    return true;
  }

  function update(dt) {
    const step = Math.max(0, Number(dt) || 0);
    void step;
    const p = posOf(world);
    const dx = p.x - GARAGE_POS.x, dz = p.z - GARAGE_POS.z;
    const near = Math.sqrt(dx * dx + dz * dz) <= GARAGE_RADIUS;
    const eDown = keyDown(world, 'KeyE', 'e', 'E');
    if (eDown && !prevE && near) openMenu();
    prevE = eDown;
  }

  return {
    update,
    openMenu,
    buyUpgrade,
    repairTires,
    upgradePrice,
    upgradesFor: (carId) => ({ ...carUpgrades(carId) }),
    currentCarId,
    isNear: () => {
      const p = posOf(world);
      const dx = p.x - GARAGE_POS.x, dz = p.z - GARAGE_POS.z;
      return Math.sqrt(dx * dx + dz * dz) <= GARAGE_RADIUS;
    },
  };
}
