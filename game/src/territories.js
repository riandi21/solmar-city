// Territories: 6 districts, control 0-100, passive income, lookouts, attacks.
// Fresh implementation for Round 16.
export function createTerritories(world) {
  const DISTRICTS = ['Downtown', 'Old Town', 'Marina', 'Boardwalk', 'Freight Yard', 'Airfield'];
  // Passive income per in-game hour for a controlled district (>60).
  const INCOME = { 'Downtown': 150, 'Old Town': 100, 'Marina': 130, 'Boardwalk': 120, 'Freight Yard': 80, 'Airfield': 90 };

  if (!world.territories) world.territories = { control: {}, income: 0, attackTimers: {}, lookouts: {} };
  const t = world.territories;
  if (!t.control) t.control = {};
  if (!t.attackTimers) t.attackTimers = {};
  if (!t.lookouts) t.lookouts = {};
  for (const d of DISTRICTS) {
    if (typeof t.control[d] !== 'number') t.control[d] = 0;
    if (typeof t.attackTimers[d] !== 'number') t.attackTimers[d] = 120 + Math.random() * 180;
  }

  let hourAccum = 0;
  let lastHour = typeof world.hourOfDay === 'number' ? world.hourOfDay : 0;

  function addControl(district, n) {
    if (!DISTRICTS.includes(district)) return getControl(district);
    t.control[district] = Math.max(0, Math.min(100, (t.control[district] || 0) + n));
    if (world.events) world.events.push({ type: 'control-change', district, control: t.control[district] });
    return t.control[district];
  }

  function getControl(district) {
    return t.control[district] || 0;
  }

  function getIncome(district) {
    return isControlled(district) ? (INCOME[district] || 100) : 0;
  }

  function isControlled(district) {
    return getControl(district) > 60;
  }

  function spawnAttack(district) {
    const combat = world.systemObjects && world.systemObjects.combat;
    const count = 3 + Math.floor(Math.random() * 2);
    const p = world.player.position;
    for (let i = 0; i < count; i++) {
      const x = p.x + (Math.random() - 0.5) * 30;
      const z = p.z + (Math.random() - 0.5) * 30;
      if (combat && combat.spawnShooter) combat.spawnShooter(x, z, 'gang');
      else {
        if (!world.enemies) world.enemies = [];
        if (!world.gangShooters) world.gangShooters = [];
        const e = { position: { x, z }, health: 80, kind: 'gang', state: 'chase' };
        world.enemies.push(e);
        world.gangShooters.push(e);
      }
    }
    if (world.events) world.events.push({ type: 'toast', text: `Rival gang attacking ${district}! Defend it or lose 20 control.` });
    t.attackTimers[district] = 240 + Math.random() * 240;
    // Track the attack so a later check can apply the -20 penalty if lost.
    t._activeAttack = { district, remaining: count, resolved: false };
  }

  function update(dt) {
    // Passive income + lookout spawn, once per in-game hour.
    const h = typeof world.hourOfDay === 'number' ? world.hourOfDay : lastHour;
    if (h !== lastHour) {
      lastHour = h;
      for (const d of DISTRICTS) {
        if (isControlled(d)) {
          const pay = INCOME[d] || 100;
          world.cash = (world.cash || 0) + pay;
          if (world.player) world.player.cash = world.cash;
          t.income = (t.income || 0) + pay;
          // Friendly lookout marks nearby police on the minimap.
          t.lookouts[d] = { district: d, active: true, since: world.elapsed || 0 };
          if (world.events) world.events.push({ type: 'territory-income', district: d, amount: pay });
        } else {
          t.lookouts[d] = null;
        }
      }
    }
    hourAccum += dt;

    // Rival gangs periodically attack a controlled district.
    for (const d of DISTRICTS) {
      if (!isControlled(d)) continue;
      t.attackTimers[d] -= dt;
      if (t.attackTimers[d] <= 0) spawnAttack(d);
    }

    // Resolve an active attack: if the spawned squad is all dead, control holds.
    // If the player leaves / squad still alive after the window, control drops.
    const atk = t._activeAttack;
    if (atk && !atk.resolved) {
      const alive = (world.gangShooters || []).filter(e => e && e.health > 0 && e.kind === 'gang').length;
      const attackAge = (world.elapsed || 0) - (atk.startedAt || (atk.startedAt = world.elapsed || 0));
      if (alive === 0 && atk.spawned) {
        atk.resolved = true;
        if (world.events) world.events.push({ type: 'toast', text: `${atk.district} defended! Control holds.` });
      } else if (attackAge > 180) {
        atk.resolved = true;
        addControl(atk.district, -20);
        if (world.events) world.events.push({ type: 'toast', text: `${atk.district} lost 20 control to the rival gang.` });
      }
      if (alive > 0) atk.spawned = true;
    }
  }

  return {
    update, addControl, getControl, getIncome,
    districts: DISTRICTS,
    isControlled,
    get income() { return t.income || 0; },
  };
}
