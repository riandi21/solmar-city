// Empire: Rico runs the city after the Coral Crown arc. Protection money,
// crew posts, rival family threat. Fresh implementation for Round 16.
export function createEmpire(world) {
  const BUSINESSES = [
    { name: 'Anchor Bar', pay: 400, x: -20, z: 30 },
    { name: 'Coral Taxi Depot', pay: 300, x: 60, z: -40 },
    { name: 'Beachfront House', pay: 350, x: 90, z: 80 },
    { name: 'casino', pay: 400, x: -60, z: -70 },
    { name: 'bike shop', pay: 150, x: 30, z: 60 },
    { name: 'Islands beach bar', pay: 250, x: 120, z: -10 },
  ];

  if (!world.empire) world.empire = { protection: {}, crewPosts: {}, rivalThreat: 0 };
  const e = world.empire;
  if (!e.protection) e.protection = {};
  if (!e.crewPosts) e.crewPosts = {};
  if (typeof e.rivalThreat !== 'number') e.rivalThreat = 0;

  let lastHour = typeof world.hourOfDay === 'number' ? world.hourOfDay : 0;
  let threatTimer = 0;

  function businessByName(name) {
    return BUSINESSES.find(b => b.name === name);
  }

  function collectProtection(business) {
    const b = businessByName(business);
    if (!b) return 0;
    const now = world.elapsed || 0;
    const last = e.protection[business] || -Infinity;
    // Cooldown: 1 in-game hour. Tracked in elapsed seconds vs hour length.
    const hourLen = world.secondsPerHour || 60;
    if (now - last < hourLen) {
      if (world.events) world.events.push({ type: 'toast', text: `${business}: protection already collected this hour.` });
      return 0;
    }
    e.protection[business] = now;
    world.cash = (world.cash || 0) + b.pay;
    if (world.player) world.player.cash = world.cash;
    if (world.events) world.events.push({ type: 'toast', text: `Collected $${b.pay} protection from ${business}.` });
    return b.pay;
  }

  // Rival family threat rises after each Legacy mission; main calls this.
  function raiseThreat(n) {
    e.rivalThreat = Math.max(0, Math.min(100, e.rivalThreat + (n || 5)));
    return e.rivalThreat;
  }

  function postCrew(member, district) {    if (!member) return false;
    const id = member.id || member.name || String(world.crew ? world.crew.indexOf(member) : 0);
    e.crewPosts[id] = { memberId: id, district, postedAt: world.elapsed || 0 };
    member.posted = district;
    member.following = false;
    if (world.events) world.events.push({ type: 'toast', text: `${member.name || 'Crew'} posted to guard ${district}.` });
    return true;
  }

  function recallCrew(member) {
    if (!member) return false;
    const id = member.id || member.name || String(world.crew ? world.crew.indexOf(member) : 0);
    delete e.crewPosts[id];
    member.posted = null;
    member.following = true;
    if (world.events) world.events.push({ type: 'toast', text: `${member.name || 'Crew'} recalled to follow you.` });
    return true;
  }

  function postedIn(district) {
    return Object.values(e.crewPosts).filter(p => p.district === district).length;
  }

  function spawnRivalSquad(district) {
    const combat = world.systemObjects && world.systemObjects.combat;
    const guards = postedIn(district);
    const count = Math.max(2, 4 - guards); // posted crew weakens the attack
    const p = world.player.position;
    for (let i = 0; i < count; i++) {
      const x = p.x + (Math.random() - 0.5) * 28;
      const z = p.z + (Math.random() - 0.5) * 28;
      if (combat && combat.spawnShooter) combat.spawnShooter(x, z, 'gang');
      else {
        if (!world.enemies) world.enemies = [];
        if (!world.gangShooters) world.gangShooters = [];
        const s = { position: { x, z }, health: 80, kind: 'gang', state: 'chase' };
        world.enemies.push(s);
        world.gangShooters.push(s);
      }
    }
    if (world.events) world.events.push({ type: 'toast', text: `Rival family attacking ${district}! Defend it or lose 20 control.` });
    e._activeRivalAttack = { district, resolved: false, startedAt: world.elapsed || 0 };
  }

  function update(dt) {
    // Rival family threat rises over time.
    threatTimer += dt;
    if (threatTimer > 30) {
      threatTimer = 0;
      e.rivalThreat = Math.min(100, e.rivalThreat + 1);
    }
    // At high threat, rival squads attack a controlled district.
    const terr = world.systemObjects && world.systemObjects.territories;
    if (e.rivalThreat >= 70 && !e._activeRivalAttack) {
      const controlled = terr
        ? terr.districts.filter(d => terr.getControl(d) > 60)
        : Object.keys((world.territories && world.territories.control) || {}).filter(d => (world.territories.control[d] || 0) > 60);
      if (controlled.length) {
        const district = controlled[Math.floor(Math.random() * controlled.length)];
        spawnRivalSquad(district);
        e.rivalThreat = Math.max(40, e.rivalThreat - 25);
      }
    }
    // Resolve rival attack: squad wiped = held; timeout = -20 control.
    const atk = e._activeRivalAttack;
    if (atk && !atk.resolved) {
      const alive = (world.gangShooters || []).filter(s => s && s.health > 0 && s.kind === 'gang').length;
      const age = (world.elapsed || 0) - atk.startedAt;
      if (alive === 0) {
        atk.resolved = true;
        if (world.events) world.events.push({ type: 'toast', text: `${atk.district} defended from the rival family.` });
      } else if (age > 180) {
        atk.resolved = true;
        if (terr) terr.addControl(atk.district, -20);
        if (world.events) world.events.push({ type: 'toast', text: `${atk.district} lost 20 control to the rival family.` });
      }
    }
    // Posted crew slows control decay (handled by territories via this flag).
    const h = typeof world.hourOfDay === 'number' ? world.hourOfDay : lastHour;
    if (h !== lastHour) {
      lastHour = h;
      // Gentle decay of unguarded controlled districts, halved where posted.
      if (terr) {
        for (const d of terr.districts) {
          const c = terr.getControl(d);
          if (c > 60) {
            const guards = postedIn(d);
            const decay = guards > 0 ? 0.5 : 1;
            terr.addControl(d, -decay);
          }
        }
      }
    }
    // Empire menu hook: visiting Anchor Bar + E is handled by main via
    // collectProtection('Anchor Bar') and the menu flag below.
    if (world.input && world.input.keys && world.input.keys['KeyE']) {
      const b = businessByName('Anchor Bar');
      const p = world.player.position;
      if (b && Math.hypot(p.x - b.x, p.z - b.z) < 4) {
        world.empireMenuOpen = true;
      }
    }
  }

  return {
    update, collectProtection, postCrew, recallCrew, raiseThreat,
    businesses: BUSINESSES,
    postedIn,
    get rivalThreat() { return e.rivalThreat; },
  };
}
