// Territories: six districts Rico can win over, earn from, and defend.
// Control runs 0-100 per district. Missions and activities raise it; a
// district above 60 is controlled — it pays rent and posts a lookout who
// marks nearby police. Rival gangs strike back at controlled turf.
const DISTRICT_DEFS = [
  { name: 'Downtown', x: 0, z: 0, income: 120 },
  { name: 'Old Town', x: -203, z: -58, income: 90 },
  { name: 'Marina', x: 300, z: 160, income: 150 },
  { name: 'Boardwalk', x: 0, z: 285, income: 110 },
  { name: 'Freight Yard', x: -185, z: -225, income: 80 },
  { name: 'Airfield', x: 200, z: -200, income: 140 },
];

const CONTROLLED_AT = 60;
const ATTACK_LOSS = 20;
const SECONDS_PER_HOUR = 60;
const ATTACK_EVERY_MIN = 100;
const ATTACK_EVERY_MAX = 170;

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

function pushEvent(world, event) {
  if (Array.isArray(world.events)) world.events.push(event);
}

export function createTerritories(world) {
  if (!world.territories || typeof world.territories !== 'object') {
    world.territories = { control: {}, income: 0, lookouts: {}, attacks: [] };
  }
  const state = world.territories;
  if (!state.control || typeof state.control !== 'object') state.control = {};
  if (typeof state.income !== 'number') state.income = 0;
  if (!state.lookouts || typeof state.lookouts !== 'object') state.lookouts = {};
  if (!Array.isArray(state.attacks)) state.attacks = [];

  for (const def of DISTRICT_DEFS) {
    if (typeof state.control[def.name] !== 'number') state.control[def.name] = 0;
    if (typeof state.lookouts[def.name] !== 'boolean') {
      state.lookouts[def.name] = state.control[def.name] > CONTROLLED_AT;
    }
  }

  let hourTimer = 0;
  let attackTimer = ATTACK_EVERY_MIN + Math.random() * 40;
  let attack = null; // { district, attackers, timer }

  function districtAt(x, z) {
    let best = DISTRICT_DEFS[0];
    let bestD = Infinity;
    for (const d of DISTRICT_DEFS) {
      const dd = (d.x - x) * (d.x - x) + (d.z - z) * (d.z - z);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best.name;
  }

  function isControlled(name) {
    return (state.control[name] || 0) > CONTROLLED_AT;
  }

  function gainControl(name, amount) {
    if (!(name in state.control)) return 0;
    const before = state.control[name];
    const after = Math.max(0, Math.min(100, before + amount));
    state.control[name] = after;
    if (before <= CONTROLLED_AT && after > CONTROLLED_AT) {
      state.lookouts[name] = true;
      toast(world, `${name} is yours now — a lookout is watching the streets for police.`);
      pushEvent(world, { type: 'territory-controlled', district: name });
    }
    if (before > CONTROLLED_AT && after <= CONTROLLED_AT) {
      state.lookouts[name] = false;
      toast(world, `You lost control of ${name}.`);
    }
    return after;
  }

  function payHourlyIncome() {
    let total = 0;
    const paid = [];
    for (const def of DISTRICT_DEFS) {
      if (isControlled(def.name)) {
        total += def.income;
        paid.push(def.name);
      }
    }
    if (total > 0) {
      addCash(world, total);
      state.income += total;
      toast(world, `Territory income: +$${total} (${paid.join(', ')}).`);
      pushEvent(world, { type: 'territory-income', amount: total, districts: paid });
    }
  }

  function startAttack() {
    const controlled = DISTRICT_DEFS.filter((d) => isControlled(d.name));
    if (controlled.length === 0 || attack) return false;
    const target = controlled[Math.floor(Math.random() * controlled.length)];
    attack = { district: target.name, attackers: 4, timer: 60 };
    state.attacks.push({ district: target.name, startedAt: world.elapsed || 0 });
    toast(world, `WARNING: a rival gang is hitting ${target.name}! Get there and drive them off.`);
    pushEvent(world, { type: 'territory-attack', district: target.name, attackers: 4 });
    return true;
  }

  function resolveAttack(won) {
    if (!attack) return false;
    const district = attack.district;
    if (won) {
      toast(world, `${district} defended! The gang scattered.`);
      pushEvent(world, { type: 'territory-defended', district });
      gainControl(district, 5);
    } else {
      gainControl(district, -ATTACK_LOSS);
      toast(world, `${district} was overrun — you lost ${ATTACK_LOSS} control.`);
      pushEvent(world, { type: 'territory-lost', district, loss: ATTACK_LOSS });
    }
    attack = null;
    return true;
  }

  // Called by combat when a rival attacker goes down near the player.
  function attackerDown() {
    if (!attack) return 0;
    attack.attackers -= 1;
    if (attack.attackers <= 0) resolveAttack(true);
    return attack.attackers;
  }

  function update(dt) {
    // Gains arrive on the shared events queue from missions and activities.
    // Mark each event once applied instead of removing it, so the HUD and
    // other systems can still read it this frame.
    if (Array.isArray(world.events)) {
      for (const ev of world.events) {
        if (!ev || ev._territoryApplied) continue;
        if ((ev.type === 'mission-complete' || ev.type === 'activity-complete') && ev.district) {
          gainControl(ev.district, ev.amount || 5);
          ev._territoryApplied = true;
        }
      }
    }

    hourTimer += dt;
    if (hourTimer >= SECONDS_PER_HOUR) {
      hourTimer -= SECONDS_PER_HOUR;
      payHourlyIncome();
    }

    // Rival gangs probe controlled turf on a slow timer.
    if (!attack) {
      attackTimer -= dt;
      if (attackTimer <= 0) {
        attackTimer = ATTACK_EVERY_MIN + Math.random() * (ATTACK_EVERY_MAX - ATTACK_EVERY_MIN);
        startAttack();
      }
    } else {
      attack.timer -= dt;
      // Fighting on home turf wears the squad down faster.
      const p = playerPos(world);
      if (p) {
        const def = DISTRICT_DEFS.find((d) => d.name === attack.district);
        if (def && Math.hypot(def.x - p.x, def.z - p.z) < 90) {
          attack.timer -= dt * 0.5;
        }
      }
      if (attack.timer <= 0) resolveAttack(false);
    }
  }

  return {
    update,
    districts: DISTRICT_DEFS,
    districtAt,
    gainControl,
    isControlled,
    getControl(name) { return state.control[name] || 0; },
    getAllControl() { return { ...state.control }; },
    getIncome() { return state.income; },
    getHourlyIncome() {
      return DISTRICT_DEFS.filter((d) => isControlled(d.name))
        .reduce((s, d) => s + d.income, 0);
    },
    hasLookout(name) { return !!state.lookouts[name]; },
    getAttack() { return attack; },
    startAttack,
    resolveAttack,
    attackerDown,
  };
}
