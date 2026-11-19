import * as THREE from 'three';

// Shops and the safehouse. The corner shop sells supplies, the bike shop
// sells rides, and the safehouse saves the game, heals Rico and wipes his
// wanted level — for a price, and only once a minute.
const SHOP_POS = { x: 58, z: 116 };
const SAFEHOUSE_POS = { x: -174, z: 232 };
const BIKE_SHOP_POS = { x: 60, z: 270 };
const SAFEHOUSE_COST = 300;
const SAFEHOUSE_COOLDOWN = 60;

const SHOP_ITEMS = [
  { key: 'Digit1', id: 'health', name: 'Health', price: 150 },
  { key: 'Digit2', id: 'ammo', name: 'Ammo', price: 100 },
  { key: 'Digit3', id: 'rifle-ammo', name: 'Rifle ammo', price: 150 },
  { key: 'Digit4', id: 'nos', name: 'NOS refill', price: 80 },
  { key: 'Digit5', id: 'armor', name: 'Armor', price: 250 },
];

const BIKES_FOR_SALE = [
  { key: 'Digit7', id: 'scooter', name: 'City Scooter', price: 800 },
  { key: 'Digit8', id: 'street', name: 'Street Bike', price: 2500 },
  { key: 'Digit9', id: 'superbike', name: 'Superbike', price: 6000 },
];

function readCash(world) {
  if (world.player && typeof world.player.cash === 'number') return world.player.cash;
  return typeof world.cash === 'number' ? world.cash : 0;
}

function addCash(world, amount) {
  const next = readCash(world) + amount;
  if (world.player) world.player.cash = next;
  world.cash = next;
  return next;
}

function playerPos(world) {
  const p = world.player && world.player.position;
  if (!p) return null;
  return { x: p.x, y: p.y || 0, z: p.z };
}

function toast(world, text) {
  if (typeof world.toast === 'function') world.toast(text);
}

function keyDown(world, code) {
  const input = world.input;
  if (!input) return false;
  if (input.pressed && typeof input.pressed.has === 'function') return input.pressed.has(code);
  if (input.keys && typeof input.keys.has === 'function') return input.keys.has(code);
  return !!input[code];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createShops(world) {
  if (!Array.isArray(world.ownedBikes)) world.ownedBikes = [];
  let safehouseCooldown = 0;
  let nearShop = false;
  let nearSafehouse = false;
  let nearBikeShop = false;
  let wasNearShop = false;
  let wasNearSafehouse = false;
  let wasNearBikeShop = false;
  let prevKeys = new Set();

  if (world.scene) {
    const spots = [
      { pos: SHOP_POS, color: 0x2eff8c, label: 'SHOP' },
      { pos: SAFEHOUSE_POS, color: 0x2e86ff, label: 'HOME' },
      { pos: BIKE_SHOP_POS, color: 0xff8c2e, label: 'BIKES' },
    ];
    for (const spot of spots) {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 6, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: spot.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
        }),
      );
      marker.position.set(spot.pos.x, 3, spot.pos.z);
      world.scene.add(marker);
    }
  }

  function pressedNow(world, code) {
    const down = keyDown(world, code);
    const was = prevKeys.has(code);
    return down && !was;
  }

  function snapshotKeys(world) {
    const input = world.input;
    const next = new Set();
    if (input) {
      const source = input.pressed || input.keys;
      if (source && typeof source.forEach === 'function') source.forEach((k) => next.add(k));
    }
    prevKeys = next;
  }

  function buyItem(id) {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return false;
    if (readCash(world) < item.price) {
      toast(world, `Not enough cash for ${item.name} ($${item.price}).`);
      return false;
    }
    const player = world.player || {};
    if (id === 'health') {
      if ((player.health || 100) >= 100) { toast(world, 'Health is already full.'); return false; }
      player.health = clamp((player.health || 0) + 50, 0, 100);
    } else if (id === 'ammo') {
      player.ammo = (player.ammo || 0) + 30;
    } else if (id === 'rifle-ammo') {
      player.rifleAmmo = (player.rifleAmmo || 0) + 20;
    } else if (id === 'nos') {
      if ((player.nos || 0) >= 100) { toast(world, 'NOS tank is already full.'); return false; }
      player.nos = 100;
    } else if (id === 'armor') {
      if ((player.armor || 0) >= 100) { toast(world, 'Armor is already full.'); return false; }
      player.armor = clamp((player.armor || 0) + 50, 0, 100);
    }
    if (world.player) world.player = player;
    addCash(world, -item.price);
    toast(world, `Bought ${item.name} for $${item.price}.`);
    if (Array.isArray(world.events)) world.events.push({ type: 'shop-buy', item: id, price: item.price });
    return true;
  }

  function useSafehouse() {
    if (safehouseCooldown > 0) {
      toast(world, `Safehouse is cooling down (${Math.ceil(safehouseCooldown)}s).`);
      return false;
    }
    if (readCash(world) < SAFEHOUSE_COST) {
      toast(world, `Safehouse costs $${SAFEHOUSE_COST}.`);
      return false;
    }
    addCash(world, -SAFEHOUSE_COST);
    safehouseCooldown = SAFEHOUSE_COOLDOWN;
    if (world.player) world.player.health = 100;
    world.wanted = 0;
    if (world.player) world.player.wanted = 0;
    toast(world, 'Safehouse: saved, healed, wanted cleared.');
    if (Array.isArray(world.events)) world.events.push({ type: 'safehouse-use' });
    if (world.systems && world.systems.save && typeof world.systems.save.save === 'function') {
      world.systems.save.save();
    }
    return true;
  }

  function buyBike(id) {
    const bike = BIKES_FOR_SALE.find((b) => b.id === id);
    if (!bike) return false;
    if (world.ownedBikes.includes(id)) {
      toast(world, `You already own the ${bike.name}.`);
      return false;
    }
    if (readCash(world) < bike.price) {
      toast(world, `${bike.name} costs $${bike.price.toLocaleString()}.`);
      return false;
    }
    addCash(world, -bike.price);
    world.ownedBikes.push(id);
    toast(world, `You bought the ${bike.name} for $${bike.price.toLocaleString()}! Press 0 at the shop to call it.`);
    if (Array.isArray(world.events)) {
      world.events.push({ type: 'bike-bought', bike: id, price: bike.price });
    }
    return true;
  }

  function callBike(id) {
    const kind = id || world.ownedBikes[world.ownedBikes.length - 1];
    if (!kind) { toast(world, 'You own no bikes yet — visit the bike shop.'); return false; }
    if (!world.ownedBikes.includes(kind)) {
      toast(world, `You do not own a ${kind} yet.`);
      return false;
    }
    const p = playerPos(world);
    if (!p) return false;
    if (Array.isArray(world.events)) {
      world.events.push({ type: 'bike-call', bike: kind, x: p.x + 4, z: p.z + 4 });
    }
    toast(world, `Your ${kind} is on its way to you.`);
    return true;
  }

  function update(dt) {
    safehouseCooldown = Math.max(0, safehouseCooldown - dt);
    const p = playerPos(world);
    if (!p) { snapshotKeys(world); return; }

    nearShop = Math.hypot(SHOP_POS.x - p.x, SHOP_POS.z - p.z) < 10;
    nearSafehouse = Math.hypot(SAFEHOUSE_POS.x - p.x, SAFEHOUSE_POS.z - p.z) < 10;
    nearBikeShop = Math.hypot(BIKE_SHOP_POS.x - p.x, BIKE_SHOP_POS.z - p.z) < 10;

    if (nearShop && !wasNearShop) {
      toast(world, 'Corner Shop — 1 health $150, 2 ammo $100, 3 rifle ammo $150, 4 NOS $80, 5 armor $250.');
    }
    if (nearSafehouse && !wasNearSafehouse) {
      toast(world, `Safehouse — press H to save, heal and clear wanted ($${SAFEHOUSE_COST}).`);
    }
    if (nearBikeShop && !wasNearBikeShop) {
      toast(world, 'Bike Shop — 7 scooter $800, 8 street bike $2,500, 9 superbike $6,000. 0 calls your bike.');
    }
    wasNearShop = nearShop;
    wasNearSafehouse = nearSafehouse;
    wasNearBikeShop = nearBikeShop;

    // Edge-triggered buys: holding the key must not buy twice.
    if (nearShop) {
      for (const item of SHOP_ITEMS) {
        if (pressedNow(world, item.key)) buyItem(item.id);
      }
    }
    if (nearBikeShop) {
      for (const bike of BIKES_FOR_SALE) {
        if (pressedNow(world, bike.key)) buyBike(bike.id);
      }
      if (pressedNow(world, 'Digit0')) callBike();
    }
    if (nearSafehouse && pressedNow(world, 'KeyH')) useSafehouse();

    snapshotKeys(world);
  }

  return {
    update,
    shopItems: SHOP_ITEMS,
    bikesForSale: BIKES_FOR_SALE,
    buyItem,
    useSafehouse,
    buyBike,
    callBike,
    isNearShop() { return nearShop; },
    isNearSafehouse() { return nearSafehouse; },
    isNearBikeShop() { return nearBikeShop; },
    getSafehouseCooldown() { return safehouseCooldown; },
    getOwnedBikes() { return [...world.ownedBikes]; },
  };
}
