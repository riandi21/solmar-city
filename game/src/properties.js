// Properties — the six buyable businesses of Solmar City.
// Rico visits a property marker and presses B to buy it. Each owned
// property pays passive income every in-game hour, shows as owned on the
// minimap/HUD, and persists in the save (world.properties).
// Factory: createProperties(scene, world) or createProperties(world).
// Never overwrites world state fields: world.properties stays plain data.

export const PROPERTY_DEFS = [
  { id: 'garage', name: "Rico's Garage", price: 2000, incomePerHour: 50, x: -150, z: 200, perk: 'Free tire repairs' },
  { id: 'bar', name: 'Anchor Bar', price: 5000, incomePerHour: 120, x: 100, z: 60, perk: 'Hire crew, pay bribes, mission hints' },
  { id: 'depot', name: 'Coral Taxi Depot', price: 8000, incomePerHour: 200, x: 80, z: 140, perk: '+25% taxi fares' },
  { id: 'beachhouse', name: 'Beachfront House', price: 12000, incomePerHour: 300, x: 30, z: 280, perk: 'Safehouse on the boardwalk' },
  { id: 'neon', name: 'Club Neon', price: 15000, incomePerHour: 400, x: 120, z: 90, perk: 'Dance floor tips' },
  { id: 'surfshack', name: 'Surf Shack', price: 10000, incomePerHour: 150, x: -180, z: 300, perk: 'Free jet ski rental, better fishing rod' },
];

export const PROPERTIES = PROPERTY_DEFS;

function normalizeArgs(scene, world) {
  if (world === undefined || world === null) {
    // Called as createProperties(world).
    if (scene && (typeof scene.cash === 'number' || scene.player || scene.properties)) return { scene: null, world: scene };
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

export function createProperties(scene, world) {
  const args = normalizeArgs(scene, world);
  scene = args.scene;
  world = args.world;

  if (!world.properties || typeof world.properties !== 'object') {
    world.properties = { owned: {}, income: 0, totalEarned: 0, lastPayoutHour: 0 };
  }
  if (!world.properties.owned || typeof world.properties.owned !== 'object') world.properties.owned = {};
  if (typeof world.properties.totalEarned !== 'number') world.properties.totalEarned = 0;
  if (typeof world.cash !== 'number') world.cash = 0;
  if (!world.kingpin) world.kingpin = {};

  const state = world.properties;
  let hoursBanked = 0;
  let prevB = false;
  let markers = [];

  // Visual markers: only when a real THREE is handed to us; headless runs
  // (and the systems test) get plain marker records instead, never a crash.
  const THREE = world.THREE || (typeof window !== 'undefined' ? window.THREE : null);
  if (scene && typeof scene.add === 'function' && THREE) {
    for (const def of PROPERTY_DEFS) {
      const mat = new THREE.MeshBasicMaterial({ color: state.owned[def.id] ? 0x37d67a : 0xf2c94c });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.4), mat);
      mesh.position.set(def.x, 2.2, def.z);
      scene.add(mesh);
      markers.push({ def, mesh, x: def.x, z: def.z, owned: !!state.owned[def.id] });
    }
  } else {
    markers = PROPERTY_DEFS.map((def) => ({ def, mesh: null, x: def.x, z: def.z, owned: !!state.owned[def.id] }));
  }

  function ownedIds() {
    return PROPERTY_DEFS.filter((d) => state.owned[d.id]).map((d) => d.id);
  }

  function isOwned(id) {
    return !!state.owned[id];
  }

  function incomePerHour() {
    let total = 0;
    for (const def of PROPERTY_DEFS) if (state.owned[def.id]) total += def.incomePerHour;
    return total;
  }

  function nearest(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist === undefined ? Infinity : maxDist;
    for (const def of PROPERTY_DEFS) {
      const d = Math.hypot(def.x - x, def.z - z);
      if (d < bestDist) { bestDist = d; best = def; }
    }
    return best ? { def: best, distance: bestDist } : null;
  }

  function buy(id) {
    const def = PROPERTY_DEFS.find((d) => d.id === id);
    if (!def) return { ok: false, reason: 'unknown property' };
    if (state.owned[def.id]) return { ok: false, reason: 'already owned' };
    if (world.cash < def.price) return { ok: false, reason: 'not enough cash' };
    world.cash -= def.price;
    state.owned[def.id] = true;
    for (const m of markers) if (m.def.id === def.id) m.owned = true;
    refreshMarkerColors();
    toast(world, `Bought ${def.name} for $${def.price} — earns $${def.incomePerHour}/hr. ${def.perk}`);
    if (Array.isArray(world.events)) world.events.push({ type: 'property-bought', id: def.id });
    return { ok: true, def };
  }

  // Back-compat alias used by older callers.
  function tryBuy(id) { return buy(id); }

  function refreshMarkerColors() {
    if (!THREE) return;
    for (const m of markers) {
      if (m.mesh && m.mesh.material) m.mesh.material.color.setHex(m.owned ? 0x37d67a : 0xf2c94c);
    }
  }

  function update(dt) {
    // Passive income: one payout per owned-property-hour.
    const rate = incomePerHour();
    if (rate > 0 && dt > 0) {
      hoursBanked += dt / 3600;
      if (hoursBanked >= 1) {
        const hours = Math.floor(hoursBanked);
        hoursBanked -= hours;
        const payout = rate * hours;
        world.cash += payout;
        state.income = (state.income || 0) + payout;
        state.totalEarned += payout;
        toast(world, `Property income: +$${payout}`);
      }
    }
    // B to buy, edge-triggered, near a for-sale marker.
    const bDown = keyDown(world, 'KeyB') || keyDown(world, 'b') || keyDown(world, 'B');
    const pos = playerPos(world);
    if (bDown && !prevB && pos) {
      const near = nearest(pos.x, pos.z, 7);
      if (near && !state.owned[near.def.id]) {
        const result = buy(near.def.id);
        if (!result.ok && result.reason === 'not enough cash') {
          toast(world, `${near.def.name} costs $${near.def.price} — you have $${world.cash}`);
        }
      }
    }
    prevB = bDown;
  }

  const system = {
    defs: PROPERTY_DEFS,
    definitions: PROPERTY_DEFS,
    list: PROPERTY_DEFS,
    markers,
    owned: ownedIds,
    ownedIds,
    isOwned,
    buy,
    tryBuy,
    nearest,
    incomePerHour,
    forSale: () => PROPERTY_DEFS.filter((d) => !state.owned[d.id]),
    ownedCount: () => ownedIds().length,
    hudLines: () => PROPERTY_DEFS.filter((d) => state.owned[d.id]).map((d) => `${d.name}: $${d.incomePerHour}/hr`),
    refreshMarkerColors,
    update,
  };
  if (Array.isArray(world.systems) && !world.systems.includes(system.update)) world.systems.push(system.update);
  return system;
}

export default createProperties;
