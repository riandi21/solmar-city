import * as THREE from 'three';

// Rico's four buyable properties. Stand on a marker, press B, and the
// deed is yours if the cash covers it. Owned properties pay rent every
// in-game hour and unlock small perks around the city.
const PROPERTY_DEFS = [
  {
    id: 'garage', name: "Rico's Garage", price: 2000, income: 50,
    x: -150, z: 200, color: 0x2e86ff,
    perk: 'Free tire repairs at the garage.',
  },
  {
    id: 'bar', name: 'Anchor Bar', price: 5000, income: 120,
    x: 100, z: 60, color: 0xff8c2e,
    perk: 'The bartender tips you off about the next objective.',
  },
  {
    id: 'depot', name: 'Coral Taxi Depot', price: 8000, income: 200,
    x: 80, z: 140, color: 0xffd72e,
    perk: '+25% on every taxi fare.',
  },
  {
    id: 'beachhouse', name: 'Beachfront House', price: 12000, income: 300,
    x: 30, z: 280, color: 0x2eff8c,
    perk: 'A quiet place on the boardwalk with the best view in Solmar.',
  },
];

// One in-game hour passes every 60 seconds of play.
const SECONDS_PER_HOUR = 60;

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

export function createProperties(world) {
  if (!world.properties || typeof world.properties !== 'object') {
    world.properties = { owned: [], incomeAccrued: 0, lastPayout: 0 };
  }
  if (!Array.isArray(world.properties.owned)) world.properties.owned = [];
  if (typeof world.properties.incomeAccrued !== 'number') world.properties.incomeAccrued = 0;

  const markers = new Map();
  let hourTimer = 0;
  let nearProperty = null;
  let wasNear = null;
  let bWasDown = false;

  if (world.scene) {
    for (const def of PROPERTY_DEFS) {
      const group = new THREE.Group();
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 5, 8),
        new THREE.MeshStandardMaterial({ color: 0xcccccc }),
      );
      post.position.y = 2.5;
      group.add(post);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.6, 0.2),
        new THREE.MeshBasicMaterial({ color: def.color }),
      );
      sign.position.y = 5.4;
      group.add(sign);
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 8, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: def.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
        }),
      );
      beacon.position.y = 4;
      group.add(beacon);
      group.position.set(def.x, 0, def.z);
      world.scene.add(group);
      markers.set(def.id, { group, sign, beacon });
    }
  }

  function owns(id) {
    return world.properties.owned.includes(id);
  }

  function refreshMarkers() {
    for (const def of PROPERTY_DEFS) {
      const mark = markers.get(def.id);
      if (!mark) continue;
      // Owned deeds turn green on the marker; for-sale ones keep their color.
      mark.sign.material.color.setHex(owns(def.id) ? 0x2eff8c : def.color);
      mark.beacon.material.opacity = owns(def.id) ? 0.1 : 0.22;
    }
  }

  function buyProperty(id) {
    const def = PROPERTY_DEFS.find((d) => d.id === id);
    if (!def) return false;
    if (owns(id)) return false;
    if (readCash(world) < def.price) {
      toast(world, `${def.name} costs $${def.price.toLocaleString()} — you have $${readCash(world).toLocaleString()}.`);
      return false;
    }
    addCash(world, -def.price);
    world.properties.owned.push(id);
    refreshMarkers();
    toast(world, `You bought ${def.name} for $${def.price.toLocaleString()}! It pays $${def.income}/hour. ${def.perk}`);
    if (Array.isArray(world.events)) {
      world.events.push({ type: 'property-bought', property: id, price: def.price });
    }
    return true;
  }

  function payHourlyIncome() {
    const ownedDefs = PROPERTY_DEFS.filter((d) => owns(d.id));
    if (ownedDefs.length === 0) return;
    const total = ownedDefs.reduce((sum, d) => sum + d.income, 0);
    addCash(world, total);
    world.properties.incomeAccrued += total;
    const names = ownedDefs.map((d) => d.name).join(', ');
    toast(world, `Property income: +$${total} from ${names}.`);
    if (Array.isArray(world.events)) {
      world.events.push({ type: 'property-income', amount: total });
    }
  }

  function update(dt) {
    const p = playerPos(world);
    if (!p) return;
    const bDown = keyDown(world, 'KeyB');
    const bPressed = bDown && !bWasDown;
    bWasDown = bDown;

    nearProperty = null;
    for (const def of PROPERTY_DEFS) {
      if (Math.hypot(def.x - p.x, def.z - p.z) < 9) nearProperty = def;
    }
    if (nearProperty && nearProperty.id !== wasNear) {
      const def = nearProperty;
      toast(world, owns(def.id)
        ? `${def.name} — yours. Pays $${def.income}/hour.`
        : `${def.name} — for sale $${def.price.toLocaleString()}. Press B to buy.`);
    }
    wasNear = nearProperty ? nearProperty.id : null;
    if (bPressed && nearProperty && !owns(nearProperty.id)) {
      buyProperty(nearProperty.id);
    }

    hourTimer += dt;
    if (hourTimer >= SECONDS_PER_HOUR) {
      hourTimer -= SECONDS_PER_HOUR;
      payHourlyIncome();
    }
  }

  refreshMarkers();

  return {
    update,
    properties: PROPERTY_DEFS,
    buyProperty,
    owns,
    // Re-read owned state after a save loads, so markers match the deed.
    refresh() { refreshMarkers(); },
    getProperty(id) { return PROPERTY_DEFS.find((d) => d.id === id) || null; },
    getOwned() { return [...world.properties.owned]; },
    getIncomeAccrued() { return world.properties.incomeAccrued; },
    getHourlyIncome() {
      return PROPERTY_DEFS.filter((d) => owns(d.id)).reduce((s, d) => s + d.income, 0);
    },
    // Perks other systems read through the world object.
    repairTiresFree() { return owns('garage'); },
    taxiFareMultiplier() { return owns('depot') ? 1.25 : 1; },
    barHint() {
      if (!owns('bar')) return null;
      const mission = world.mission;
      if (mission && mission.objective) return `Bartender: "${mission.objective}"`;
      if (world.completedMissions && world.completedMissions.length) {
        return 'Bartender: "Word is the Dourado crew is getting nervous. Keep pushing."';
      }
      return 'Bartender: "Madame Coral wants her money. Start with the Coral Club."';
    },
    getNearest() { return nearProperty; },
  };
}
