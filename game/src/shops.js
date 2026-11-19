// Shops and safehouse — buying supplies, bikes, and bribes.
// Shop (58, 116): health $150, ammo $100, rifle ammo $150, NOS $80,
// armor $250. Bike shop on the boardwalk (60, 270): scooter $800,
// street bike $2,500, superbike $6,000. Anchor Bar (100, 60): $500 bribe
// (Heat -30, 1 in-game-hour cooldown). Safehouse (-174, 232): save, heal,
// clear wanted $300, 60 s cooldown, revive a downed crew member $200.
// Buying is edge-triggered: one press buys once.
// Factory: createShops(scene, world) or createShops(world).

export const SHOP_POS = { x: 58, z: 116 };
export const BIKE_SHOP_POS = { x: 60, z: 270 };
export const BAR_POS = { x: 100, z: 60 };
export const SAFEHOUSE_POS = { x: -174, z: 232 };

export const SHOP_ITEMS = [
  { id: 'health', name: 'Health pack', price: 150, key: 'Digit1' },
  { id: 'ammo', name: 'Pistol ammo', price: 100, key: 'Digit2' },
  { id: 'rifleAmmo', name: 'Rifle ammo', price: 150, key: 'Digit3' },
  { id: 'nos', name: 'NOS refill', price: 80, key: 'Digit4' },
  { id: 'armor', name: 'Body armor', price: 250, key: 'Digit5' },
];

export const BIKES_FOR_SALE = [
  { id: 'scooter', name: 'City Scooter', price: 800, topSpeed: 22 },
  { id: 'streetbike', name: 'Street Bike', price: 2500, topSpeed: 34 },
  { id: 'superbike', name: 'Superbike', price: 6000, topSpeed: 46 },
];

export const BRIBE_PRICE = 500;
export const SAFEHOUSE_PRICE = 300;
export const REVIVE_PRICE = 200;

function normalizeArgs(scene, world) {
  if (world === undefined || world === null) {
    if (scene && (typeof scene.cash === 'number' || scene.player || scene.shops)) return { scene: null, world: scene };
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

function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export function createShops(scene, world) {
  const args = normalizeArgs(scene, world);
  scene = args.scene;
  world = args.world;

  if (typeof world.cash !== 'number') world.cash = 0;
  if (!Array.isArray(world.ownedBikes)) world.ownedBikes = [];
  if (typeof world.ammo !== 'number') world.ammo = 0;
  if (typeof world.rifleAmmo !== 'number') world.rifleAmmo = 0;
  if (typeof world.heat !== 'number' && !(world.heat && typeof world.heat.level === 'number')) {
    // Heat may live in world.heat.level; leave it alone if it is an object.
    if (world.heat === undefined) world.heat = 0;
  }
  const state = {
    lastBribeHour: -10,
    lastSafehouseAt: -1000,
    lastKey: null,
  };

  function inGameHour() {
    if (typeof world.timeHours === 'number') return world.timeHours;
    if (world.daynight && typeof world.daynight.hour === 'number') return world.daynight.hour;
    return (world.elapsed || 0) / 3600;
  }

  function buy(itemId) {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: 'unknown item' };
    if (world.cash < item.price) return { ok: false, reason: 'not enough cash' };
    world.cash -= item.price;
    const p = world.player || {};
    if (itemId === 'health') p.health = Math.min(100, (typeof p.health === 'number' ? p.health : 100) + 50);
    else if (itemId === 'ammo') world.ammo += 30;
    else if (itemId === 'rifleAmmo') world.rifleAmmo += 20;
    else if (itemId === 'nos') {
      const car = world.playerCar || (world.player && world.player.currentCar);
      if (car) car.nos = car.nosMax || 100;
      world.nos = world.nosMax || 100;
    } else if (itemId === 'armor') p.armor = Math.min(100, (typeof p.armor === 'number' ? p.armor : 0) + 50);
    toast(world, `Bought ${item.name} — $${item.price}`);
    return { ok: true, item };
  }

  function buyBike(bikeId) {
    const bike = BIKES_FOR_SALE.find((b) => b.id === bikeId);
    if (!bike) return { ok: false, reason: 'unknown bike' };
    if (world.ownedBikes.includes(bikeId)) return { ok: false, reason: 'already owned' };
    if (world.cash < bike.price) return { ok: false, reason: 'not enough cash' };
    world.cash -= bike.price;
    world.ownedBikes.push(bikeId);
    if (Array.isArray(world.bikes)) {
      world.bikes.push({ kind: bikeId, topSpeed: bike.topSpeed, owned: true, position: { x: BIKE_SHOP_POS.x, y: 0, z: BIKE_SHOP_POS.z } });
    }
    toast(world, `Bought the ${bike.name} — $${bike.price}. Call it from the bike shop.`);
    return { ok: true, bike };
  }

  function buyBribe() {
    if (world.cash < BRIBE_PRICE) return { ok: false, reason: 'not enough cash' };
    if (inGameHour() - state.lastBribeHour < 1) return { ok: false, reason: 'bribe on cooldown' };
    world.cash -= BRIBE_PRICE;
    state.lastBribeHour = inGameHour();
    if (typeof world.heat === 'number') world.heat = Math.max(0, world.heat - 30);
    else if (world.heat && typeof world.heat.level === 'number') world.heat.level = Math.max(0, world.heat.level - 30);
    toast(world, 'Bribe paid — Heat -30');
    return { ok: true };
  }

  function useSafehouse() {
    const now = world.elapsed || 0;
    if (now - state.lastSafehouseAt < 60) return { ok: false, reason: 'safehouse on cooldown' };
    if (world.cash < SAFEHOUSE_PRICE) return { ok: false, reason: 'not enough cash' };
    world.cash -= SAFEHOUSE_PRICE;
    state.lastSafehouseAt = now;
    const p = world.player || {};
    p.health = 100;
    world.wanted = 0;
    if (world.save && typeof world.save.save === 'function') world.save.save();
    else if (typeof world.saveGame === 'function') world.saveGame();
    toast(world, 'Safehouse: healed, wanted cleared, game saved — $300');
    return { ok: true };
  }

  // Call an owned bike to Rico's position from the bike shop menu.
  function callBike(bikeId) {
    if (!world.ownedBikes.includes(bikeId)) return { ok: false, reason: 'bike not owned' };
    const pos = playerPos(world);
    if (!pos) return { ok: false, reason: 'no player position' };
    const bike = (Array.isArray(world.bikes) ? world.bikes : []).find((b) => b.kind === bikeId);
    if (bike) {
      if (bike.position) { bike.position.x = pos.x + 2; bike.position.z = pos.z + 2; }
      else bike.position = { x: pos.x + 2, y: 0, z: pos.z + 2 };
      toast(world, `Your ${bikeId} was brought to you.`);
      return { ok: true, bike };
    }
    toast(world, `Your ${bikeId} is on its way to you.`);
    return { ok: true, bike: null };
  }

  function reviveCrew() {    const crew = Array.isArray(world.crew) ? world.crew : (world.crewState && world.crewState.members) || [];
    const downed = crew.find((m) => m.state === 'down' || m.health <= 0);
    if (!downed) return { ok: false, reason: 'no downed crew member' };
    if (world.cash < REVIVE_PRICE) return { ok: false, reason: 'not enough cash' };
    world.cash -= REVIVE_PRICE;
    downed.health = 100;
    downed.state = 'follow';
    toast(world, `${downed.name || 'Crew member'} revived — $200`);
    return { ok: true };
  }

  function nearestShop(pos) {
    const spots = [
      { id: 'shop', pos: SHOP_POS },
      { id: 'bikeshop', pos: BIKE_SHOP_POS },
      { id: 'bar', pos: BAR_POS },
      { id: 'safehouse', pos: SAFEHOUSE_POS },
    ];
    let best = null;
    let bestD = Infinity;
    for (const s of spots) {
      const d = dist(pos, s.pos);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best && bestD < 9 ? { ...best, distance: bestD } : null;
  }

  function update(dt) {
    const pos = playerPos(world);
    if (!pos) return;
    const near = nearestShop(pos);
    if (!near) { state.lastKey = null; return; }
    const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    let pressedKey = null;
    for (const k of keys) if (keyDown(world, k)) { pressedKey = k; break; }
    if (pressedKey && state.lastKey !== pressedKey) {
      const index = keys.indexOf(pressedKey);
      if (near.id === 'shop') buy(SHOP_ITEMS[index].id);
      else if (near.id === 'bikeshop' && index < BIKES_FOR_SALE.length) buyBike(BIKES_FOR_SALE[index].id);
      else if (near.id === 'bar' && index === 0) buyBribe();
      else if (near.id === 'safehouse' && index === 0) useSafehouse();
      else if (near.id === 'safehouse' && index === 1) reviveCrew();
    }
    state.lastKey = pressedKey;
  }

  const system = {
    items: SHOP_ITEMS,
    bikes: BIKES_FOR_SALE,
    shopPos: SHOP_POS,
    bikeShopPos: BIKE_SHOP_POS,
    barPos: BAR_POS,
    safehousePos: SAFEHOUSE_POS,
    buy,
    buyBike,
    callBike,
    buyBribe,
    useSafehouse,
    reviveCrew,
    revive: reviveCrew,
    nearestShop,
    update,
  };
  if (Array.isArray(world.systems) && !world.systems.includes(system.update)) world.systems.push(system.update);
  return system;
}

export default createShops;
