// Shops: general store, safehouse, bike shop and the Anchor Bar bribe.
// Buying is edge-triggered (one press = one purchase). The safehouse
// saves the game, heals the player and clears wanted for $300, with a
// 60s cooldown, and revives a downed crew member for $200.

export const BAR_POS = { x: 100, z: 60 };
export const BEACH_HOUSE_POS = { x: 30, z: 280 }; // safehouse when owned
export const SHOP_RADIUS = 8;

export const SHOP_PRICES = {
  health: 150, ammo: 100, rifleAmmo: 150, nos: 80, armor: 250,
  safehouse: 300, reviveCrew: 200, bribe: 500,
};
export const BIKE_PRICES = { scooter: 800, street: 2500, superbike: 6000 };

const SAFEHOUSE_COOLDOWN = 60; // seconds
const BRIBE_COOLDOWN = 60; // 1 in-game hour = 60 real seconds
const BRIBE_HEAT_DROP = 30;

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

function near(world, target, radius) {
  const p = posOf(world);
  const dx = p.x - target.x, dz = p.z - target.z;
  return Math.sqrt(dx * dx + dz * dz) <= radius;
}

function heatOf(world) {
  return Number(world.heat ?? world.player?.wanted ?? world.player?.heat ?? 0);
}

function setHeat(world, value) {
  const v = Math.max(0, Math.min(100, Math.floor(value)));
  world.heat = v;
  if (world.player) { world.player.wanted = v; world.player.heat = v; }
  return v;
}

export function createShops(world) {
  let safehouseCooldown = 0;
  let bribeCooldown = 0;
  let prevB = false;

  function spend(price, label) {
    if (cashOf(world) < price) { toast(world, 'Not enough cash for ' + label + ' ($' + price + ').'); return false; }
    setCash(world, cashOf(world) - price);
    return true;
  }

  function buyHealth() {
    const p = world.player || {};
    if (!spend(SHOP_PRICES.health, 'health')) return false;
    p.health = Math.min(100, Number(p.health ?? 100) + 50);
    toast(world, 'Health restored to ' + Math.floor(p.health) + ' (-$150).');
    return true;
  }

  function buyAmmo() {
    const p = world.player || {};
    if (!spend(SHOP_PRICES.ammo, 'ammo')) return false;
    p.ammo = Number(p.ammo ?? 0) + 30;
    toast(world, 'Ammo +30 (-$100).');
    return true;
  }

  function buyRifleAmmo() {
    const p = world.player || {};
    if (!spend(SHOP_PRICES.rifleAmmo, 'rifle ammo')) return false;
    p.rifleAmmo = Number(p.rifleAmmo ?? 0) + 30;
    toast(world, 'Rifle ammo +30 (-$150).');
    return true;
  }

  function buyNOS() {
    const p = world.player || {};
    if (!spend(SHOP_PRICES.nos, 'NOS')) return false;
    p.nos = Number(p.nos ?? 0) + 1;
    toast(world, 'NOS canister added (-$80).');
    return true;
  }

  function buyArmor() {
    const p = world.player || {};
    if (!spend(SHOP_PRICES.armor, 'armor')) return false;
    p.armor = Math.min(100, Number(p.armor ?? 0) + 50);
    toast(world, 'Armor +50 (-$250).');
    return true;
  }

  function crewList() {
    if (Array.isArray(world.crew)) return world.crew;
    if (Array.isArray(world.player?.crew)) return world.player.crew;
    return [];
  }

  function reviveCrew() {
    const crew = crewList();
    const downed = crew.find((m) => m && (m.health <= 0 || m.downed || m.status === 'down'));
    if (!downed) { toast(world, 'No crew member is down.'); return false; }
    if (!spend(SHOP_PRICES.reviveCrew, 'crew revive')) return false;
    downed.health = 100;
    downed.downed = false;
    if (downed.status === 'down') downed.status = 'active';
    toast(world, 'Revived ' + (downed.name || 'crew member') + ' (-$200).');
    return true;
  }

  function useSafehouse() {
    if (safehouseCooldown > 0) {
      toast(world, 'Safehouse is on cooldown (' + Math.ceil(safehouseCooldown) + 's left).');
      return false;
    }
    if (!spend(SHOP_PRICES.safehouse, 'safehouse')) return false;
    const p = world.player || {};
    p.health = 100;
    setHeat(world, 0);
    if (typeof world.save?.save === 'function') world.save.save();
    safehouseCooldown = SAFEHOUSE_COOLDOWN;
    // A downed crew member is revived here too, for the extra $200.
    const downed = crewList().find((m) => m && (m.health <= 0 || m.downed || m.status === 'down'));
    if (downed && cashOf(world) >= SHOP_PRICES.reviveCrew) {
      setCash(world, cashOf(world) - SHOP_PRICES.reviveCrew);
      downed.health = 100; downed.downed = false;
      if (downed.status === 'down') downed.status = 'active';
      toast(world, 'Safehouse: saved, healed, wanted cleared, ' + (downed.name || 'crew') + ' revived (-$500 total).');
    } else {
      toast(world, 'Safehouse: game saved, fully healed, wanted cleared (-$300).');
    }
    return true;
  }

  function ownedBikes() {
    if (!Array.isArray(world.ownedBikes)) world.ownedBikes = [];
    return world.ownedBikes;
  }

  function buyBike(kind) {
    const price = BIKE_PRICES[kind];
    if (price === undefined) { toast(world, 'No such bike.'); return false; }
    const bikes = ownedBikes();
    if (bikes.includes(kind)) { toast(world, 'You already own the ' + kind + '.'); return false; }
    if (!spend(price, kind + ' bike')) return false;
    bikes.push(kind);
    if (world.player) {
      if (!Array.isArray(world.player.bikes)) world.player.bikes = [];
      if (!world.player.bikes.includes(kind)) world.player.bikes.push(kind);
    }
    toast(world, 'Bought the ' + kind + ' bike (-$' + price + ').');
    return true;
  }

  function buyBribe() {
    if (bribeCooldown > 0) {
      toast(world, 'The bar will not take another bribe yet (' + Math.ceil(bribeCooldown) + 's left).');
      return false;
    }
    if (heatOf(world) <= 0) { toast(world, 'No heat to bribe away right now.'); return false; }
    if (!spend(SHOP_PRICES.bribe, 'bribe')) return false;
    setHeat(world, heatOf(world) - BRIBE_HEAT_DROP);
    bribeCooldown = BRIBE_COOLDOWN;
    toast(world, 'Bribe paid (-$500). Heat down 30, now ' + heatOf(world) + '.');
    return true;
  }

  // Cooldowns left (seconds) for the HUD: safehouse, then bribe.
  function cooldowns() {
    return { safehouse: Math.max(0, safehouseCooldown), bribe: Math.max(0, bribeCooldown) };
  }

  function update(dt) {
    const step = Math.max(0, Number(dt) || 0);
    if (safehouseCooldown > 0) safehouseCooldown -= step;
    if (bribeCooldown > 0) bribeCooldown -= step;
    // Edge-triggered bribe at the Anchor Bar (B = buy, once per press).
    const bDown = keyDown(world, 'KeyB', 'b', 'B');
    if (bDown && !prevB && near(world, BAR_POS, SHOP_RADIUS)) buyBribe();
    prevB = bDown;
  }

  return {
    update,
    buyHealth,
    buyAmmo,
    buyRifleAmmo,
    buyNOS,
    buyArmor,
    useSafehouse,
    reviveCrew,
    buyBike,
    buyBribe,
    cooldowns,
  };
}
