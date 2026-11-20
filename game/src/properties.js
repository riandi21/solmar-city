// Properties: six buyable businesses / homes in Solmar City.
// Press B at a property marker to buy it (once per press). Owned
// properties pay passive income every in-game hour, show on the
// minimap/HUD, persist in the save, and unlock perks elsewhere:
// garage = free tire repair, depot = +25% taxi fares, bar = mission
// hints + crew hire / bribes, Club Neon = dance floor, Surf Shack =
// free jet-ski rental + a better fishing rod.

export const PROPERTY_DEFS = [
  { key: 'garage', name: "Rico's Garage", price: 2000, x: -150, z: 200, incomePerHour: 50, blurb: 'Free tire repairs.' },
  { key: 'bar', name: 'Anchor Bar', price: 5000, x: 100, z: 60, incomePerHour: 120, blurb: 'Crew hire, bribes, mission hints.' },
  { key: 'depot', name: 'Coral Taxi Depot', price: 8000, x: 80, z: 140, incomePerHour: 200, blurb: '+25% taxi fares.' },
  { key: 'beachHouse', name: 'Beachfront House', price: 12000, x: 30, z: 280, incomePerHour: 300, blurb: 'Safehouse on the beach.' },
  { key: 'neon', name: 'Club Neon', price: 15000, x: 120, z: 90, incomePerHour: 400, blurb: 'Dance floor tips.' },
  { key: 'surf', name: 'Surf Shack', price: 10000, x: -180, z: 300, incomePerHour: 150, blurb: 'Free jet skis, better fishing rod.' },
];

const HOUR_SECONDS = 60; // one in-game hour = 60 real seconds
const BUY_RADIUS = 7;
const DANCE_RADIUS = 9;

function posOf(world) {
  const p = world.player || {};
  const q = p.position || p;
  return { x: Number(q.x ?? p.x ?? 0), z: Number(q.z ?? p.z ?? q.y ?? p.y ?? 0) };
}

function cashOf(world) {
  return Number(world.cash ?? world.player?.cash ?? 0);
}

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

function dist(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function createProperties(world) {
  if (!world.properties || typeof world.properties !== 'object') world.properties = {};
  const store = world.properties;
  if (!store.owned || typeof store.owned !== 'object') store.owned = {};
  if (typeof store.income !== 'number') store.income = 0;
  if (typeof store.lastPayout !== 'number') store.lastPayout = 0;

  let hourTimer = 0;
  let prevB = false;
  let prevE = false;
  let danceCooldown = 0;

  function isOwned(name) {
    const def = PROPERTY_DEFS.find((d) => d.key === name || d.name === name);
    const key = def ? def.key : name;
    return Boolean(store.owned[key]);
  }

  function ownedList() {
    return PROPERTY_DEFS.filter((d) => store.owned[d.key]);
  }

  function buyProperty(name) {
    const def = PROPERTY_DEFS.find((d) => d.key === name || d.name === name);
    if (!def) { toast(world, 'No such property.'); return false; }
    if (store.owned[def.key]) { toast(world, def.name + ' is already yours.'); return false; }
    if (cashOf(world) < def.price) {
      toast(world, 'Not enough cash for ' + def.name + ' ($' + def.price + ').');
      return false;
    }
    setCash(world, cashOf(world) - def.price);
    store.owned[def.key] = true;
    toast(world, 'Bought ' + def.name + ' for $' + def.price + '! Pays $' + def.incomePerHour + '/hr.');
    return true;
  }

  function nearestMarker() {
    const p = posOf(world);
    let best = null, bestD = Infinity;
    for (const def of PROPERTY_DEFS) {
      const d = dist(p, def);
      if (d < bestD) { bestD = d; best = def; }
    }
    return bestD <= BUY_RADIUS ? best : null;
  }

  function payHourlyIncome() {
    const owned = ownedList();
    if (!owned.length) return;
    let total = 0;
    for (const def of owned) total += def.incomePerHour;
    if (total <= 0) return;
    setCash(world, cashOf(world) + total);
    store.income = (store.income || 0) + total;
    store.lastPayout = Number(world.elapsed || 0);
    toast(world, 'Property income: +$' + total + ' (' + owned.map((d) => d.name).join(', ') + ').');
  }

  function tryDance() {
    if (!isOwned('neon')) return;
    if (danceCooldown > 0) return;
    const p = posOf(world);
    const club = PROPERTY_DEFS.find((d) => d.key === 'neon');
    if (dist(p, club) > DANCE_RADIUS) return;
    danceCooldown = 5;
    const tip = 5 + Math.floor(Math.random() * 21); // $5-$25 in tips
    setCash(world, cashOf(world) + tip);
    toast(world, 'You dance at Club Neon — the crowd tips you $' + tip + '!');
  }

  function update(dt) {
    const step = Math.max(0, Number(dt) || 0);
    if (danceCooldown > 0) danceCooldown -= step;

    // Passive income: one payout per in-game hour while owning anything.
    if (ownedList().length) {
      hourTimer += step;
      if (hourTimer >= HOUR_SECONDS) {
        hourTimer -= HOUR_SECONDS;
        payHourlyIncome();
      }
    } else {
      hourTimer = 0;
    }

    const bDown = keyDown(world, 'KeyB', 'b', 'B');
    if (bDown && !prevB) {
      const near = nearestMarker();
      if (near) buyProperty(near.key);
    }
    prevB = bDown;

    const eDown = keyDown(world, 'KeyE', 'e', 'E');
    if (eDown && !prevE) tryDance();
    prevE = eDown;
  }

  // Total passive income per in-game hour from everything owned now.
  function hourlyIncome() {
    let total = 0;
    for (const def of ownedList()) total += def.incomePerHour;
    return total;
  }

  // Perks other systems read (guarded via world.systemObjects.properties).
  function taxiBonus() { return isOwned('depot') ? 0.25 : 0; }
  function hasBetterRod() { return isOwned('surf'); }
  function freeTireRepair() { return isOwned('garage'); }
  function missionHint() {
    if (!isOwned('bar')) return '';
    return 'Anchor Bar regulars whisper: check the next mission marker — the crew is ready when you are.';
  }

  return {
    update,
    buyProperty,
    isOwned,
    list: () => PROPERTY_DEFS.map((d) => ({ ...d, owned: Boolean(store.owned[d.key]) })),
    owned: ownedList,
    hourlyIncome,
    taxiBonus,
    hasBetterRod,
    freeTireRepair,
    missionHint,
    nearest: nearestMarker,
  };
}
