// hud.js — Solmar City HUD: cash, health, wanted stars, objective, speed,
// toasts, weapons, clock, districts, mission/activity trackers, properties,
// progress lines, NOS, tire damage, territory bar, bike/crew/garage/empire
// panels, Heat bar, casino, racing leaderboard, heli, kingpin arc, cartel
// threat, jet ski, fishing — plus a 200x200 minimap canvas, bottom-left.

const DISTRICTS = ['Downtown', 'Old Town', 'Little Havana', 'Sunset Beach', 'Vineyards', 'North Hills', 'The Islands'];

function el(tag, id, cls, parent) {
  const n = document.createElement(tag);
  if (id) n.id = id;
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}

function fmtCash(n) { return '$' + Math.floor(n || 0).toLocaleString('en-US'); }
function fmtClock(mins) {
  const h = Math.floor(((mins || 0) / 60) % 24);
  const m = Math.floor((mins || 0) % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function createHud(world) {
  let root = document.getElementById('hud');
  if (!root) { root = el('div', 'hud', null, document.body); }

  const cashEl = el('div', 'hud-cash', 'hud-cash', root);
  const healthWrap = el('div', 'hud-health-wrap', 'hud-bar-wrap', root);
  const healthBar = el('div', 'hud-health', 'hud-bar health', healthWrap);
  const armorEl = el('div', 'hud-armor', 'hud-label', root);
  const starsEl = el('div', 'hud-wanted', 'hud-wanted', root);
  const heatWrap = el('div', 'hud-heat-wrap', 'hud-bar-wrap heat', root);
  const heatBar = el('div', 'hud-heat', 'hud-bar heat', heatWrap);
  const heatLabel = el('div', 'hud-heat-label', 'hud-label', heatWrap);
  const cartelWrap = el('div', 'hud-cartel-wrap', 'hud-bar-wrap cartel', root);
  const cartelBar = el('div', 'hud-cartel', 'hud-bar cartel', cartelWrap);
  const cartelLabel = el('div', 'hud-cartel-label', 'hud-label', cartelWrap);
  const objectiveEl = el('div', 'hud-objective', 'hud-objective', root);
  const speedEl = el('div', 'hud-speed', 'hud-speed', root);
  const nosWrap = el('div', 'hud-nos-wrap', 'hud-bar-wrap nos', root);
  const nosBar = el('div', 'hud-nos', 'hud-bar nos', nosWrap);
  const weaponEl = el('div', 'hud-weapon', 'hud-label', root);
  const clockEl = el('div', 'hud-clock', 'hud-label', root);
  const districtEl = el('div', 'hud-district', 'hud-district', root);
  const missionEl = el('div', 'hud-mission', 'hud-tracker', root);
  const activityEl = el('div', 'hud-activity', 'hud-tracker', root);
  const propsEl = el('div', 'hud-properties', 'hud-panel', root);
  const progressEl = el('div', 'hud-progress', 'hud-panel', root);
  const territoryEl = el('div', 'hud-territory', 'hud-panel', root);
  const bikeEl = el('div', 'hud-bike', 'hud-label', root);
  const heliEl = el('div', 'hud-heli', 'hud-label', root);
  const jetskiEl = el('div', 'hud-jetski', 'hud-label', root);
  const fishingEl = el('div', 'hud-fishing', 'hud-label', root);
  const crewEl = el('div', 'hud-crew', 'hud-panel', root);
  const empireEl = el('div', 'hud-empire', 'hud-panel', root);
  const casinoEl = el('div', 'hud-casino', 'hud-label', root);
  const raceEl = el('div', 'hud-race', 'hud-panel', root);
  const tireEl = el('div', 'hud-tire', 'hud-warning', root);
  const garageEl = el('div', 'hud-garage', 'hud-panel garage', root);
  const toastEl = el('div', 'hud-toast', 'hud-toast', root);

  let minimap = document.getElementById('minimap');
  if (!minimap) {
    minimap = document.createElement('canvas');
    minimap.id = 'minimap';
    minimap.width = 200; minimap.height = 200;
    root.appendChild(minimap);
  }
  const mctx = minimap.getContext('2d');

  let toastTimer = 0;
  let objective = 'Welcome to Solmar City.';

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    toastTimer = 3;
  }

  function setObjective(text) { objective = text || objective; }

  // Briefly highlight the objective line when a mission stage changes.
  function flashObjective(text) {
    if (text) objective = text;
    objectiveEl.style.color = '#ffd94a';
    setTimeout(() => { objectiveEl.style.color = ''; }, 900);
  }

  function districtAt(x, z) {
    const d = (world.city && world.city.districtAt) ? world.city.districtAt(x, z) : null;
    if (d) return d;
    if (x == null) return 'Solmar City';
    if (z < -260) return 'North Hills';
    if (x > 260) return 'The Islands';
    if (x < -260) return 'Vineyards';
    if (z > 260) return 'Sunset Beach';
    if (x > 120 && z > 60) return 'Little Havana';
    if (z > 120) return 'Old Town';
    return 'Downtown';
  }

  function drawMinimap() {
    const S = 200;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(8, 20, 28, 0.85)';
    mctx.fillRect(0, 0, S, S);
    const city = world.city || {};
    const bounds = city.bounds || { min: -400, max: 400 };
    const span = (bounds.max - bounds.min) || 800;
    const toMap = (x, z) => [((x - bounds.min) / span) * S, ((z - bounds.min) / span) * S];
    // Territory tint per district.
    const terr = world.territories || {};
    const tint = { Downtown: 'rgba(60,120,255,0.10)', 'Old Town': 'rgba(255,200,60,0.10)', 'Little Havana': 'rgba(255,90,60,0.10)', 'Sunset Beach': 'rgba(60,220,200,0.10)', Vineyards: 'rgba(140,220,80,0.10)', 'North Hills': 'rgba(180,140,255,0.10)', 'The Islands': 'rgba(80,200,255,0.10)' };
    for (const d of DISTRICTS) {
      mctx.fillStyle = tint[d] || 'rgba(255,255,255,0.04)';
      mctx.fillRect(0, 0, S, S);
      void d;
    }
    // Roads.
    const roads = city.roads || [];
    mctx.strokeStyle = 'rgba(200,200,200,0.55)';
    mctx.lineWidth = 1;
    for (const r of roads) {
      if (!r || r.x1 === undefined) continue;
      const [ax, ay] = toMap(r.x1, r.z1);
      const [bx, by] = toMap(r.x2, r.z2);
      mctx.beginPath(); mctx.moveTo(ax, ay); mctx.lineTo(bx, by); mctx.stroke();
    }
    // Property blips: for sale gold, owned green (list via the properties system).
    const propsSys = (world.systemObjects && world.systemObjects.properties) || null;
    const list = (propsSys && typeof propsSys.list === 'function') ? propsSys.list() : [];
    for (const p of list) {
      const [mx, my] = toMap(p.x || 0, p.z || 0);
      mctx.fillStyle = p.owned ? '#3f6' : '#fc3';
      mctx.fillRect(mx - 2, my - 2, 4, 4);
    }
    // Crew blips (cyan). world.crew is an ARRAY of members with .position.
    const crewList = Array.isArray(world.crew) ? world.crew : ((world.crew && world.crew.members) || []);
    for (const c of crewList) {
      const pos = (c && c.position) || c;
      if (!pos || pos.x === undefined) continue;
      const [mx, my] = toMap(pos.x, pos.z || 0);
      mctx.fillStyle = '#4df';
      mctx.beginPath(); mctx.arc(mx, my, 2.5, 0, Math.PI * 2); mctx.fill();
    }
    // Cars (white) — world.cars entries carry .position — and feds (blue).
    for (const c of world.cars || []) {
      const pos = (c && c.position) || c;
      if (!pos || pos.x === undefined) continue;
      const [mx, my] = toMap(pos.x, pos.z || 0);
      mctx.fillStyle = '#ddd';
      mctx.fillRect(mx - 1, my - 1, 2, 2);
    }
    for (const c of world.feds || []) {
      const pos = (c && c.position) || c;
      if (!pos || pos.x === undefined) continue;
      const [mx, my] = toMap(pos.x, pos.z || 0);
      mctx.fillStyle = '#36f';
      mctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    // Mission marker (red diamond) — the runner drives world.mission.
    const marker = (world.mission && world.mission.marker) || null;
    if (marker && marker.x !== undefined) {
      const [mx, my] = toMap(marker.x, marker.z || 0);
      mctx.fillStyle = '#f33';
      mctx.beginPath(); mctx.moveTo(mx, my - 5); mctx.lineTo(mx + 5, my); mctx.lineTo(mx, my + 5); mctx.lineTo(mx - 5, my); mctx.closePath(); mctx.fill();
    }
    // Player arrow.
    const p = world.player || {};
    const px = (p.position && p.position.x) ?? p.x ?? 0;
    const pz = (p.position && p.position.z) ?? p.z ?? 0;
    const [mx, my] = toMap(px, pz);
    const heading = p.heading || 0;
    mctx.save();
    mctx.translate(mx, my);
    mctx.rotate(-heading);
    mctx.fillStyle = '#fff';
    mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4, 5); mctx.lineTo(-4, 5); mctx.closePath(); mctx.fill();
    mctx.restore();
    void terr;
  }

  function update(dt) {
    const p = world.player || {};
    const sysObj = world.systemObjects || {};
    const stats = world.stats || {};
    cashEl.textContent = fmtCash(p.cash ?? stats.cash ?? 0);
    const hp = Math.max(0, Math.min(100, p.health ?? 100));
    healthBar.style.width = hp + '%';
    armorEl.textContent = 'Armor ' + Math.floor(p.armor || 0);
    // Wanted is world.wanted (a number); p.wanted was never set.
    const wanted = Math.max(0, Math.min(5, world.wanted ?? p.wanted ?? 0));
    starsEl.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
    // Heat: world.heat is a number; the live level is heatState / the heat system.
    const heatLevel = (world.heatState && world.heatState.level)
      ?? (sysObj.heat && sysObj.heat.level)
      ?? (typeof world.heat === 'number' ? world.heat : 0);
    heatBar.style.width = Math.max(0, Math.min(100, heatLevel)) + '%';
    heatLabel.textContent = 'HEAT ' + Math.floor(heatLevel);
    // Cartel threat lives in world.cartelThreat (number) / the cartel system.
    const threat = (typeof world.cartelThreat === 'number' ? world.cartelThreat
      : (sysObj.cartel && sysObj.cartel.threat)) ?? 0;
    cartelBar.style.width = Math.max(0, Math.min(100, threat)) + '%';
    cartelLabel.textContent = 'CARTEL ' + Math.floor(threat);
    objectiveEl.textContent = objective;
    const speed = Math.abs(p.speed || 0);
    speedEl.textContent = Math.round(speed * 3.6) + ' km/h';
    const nos = p.nos ?? 100;
    nosBar.style.width = Math.max(0, Math.min(100, nos)) + '%';
    // Weapon/ammo live in the combat system, not on the player.
    const combat = sysObj.combat;
    const weapon = (combat && combat.weapon) || p.weapon || 'Fists';
    const ammo = combat && combat.ammo ? (combat.ammo[weapon] ?? combat.ammo.pistol ?? '∞') : (p.ammo ?? '∞');
    weaponEl.textContent = weapon + '  •  ' + ammo + '  •  ' + fmtCash(p.cash ?? 0);
    // Clock: daynight maintains world.timeOfDay (hours); world.daynight was never set.
    const tod = typeof world.timeOfDay === 'number' ? world.timeOfDay : 12;
    clockEl.textContent = fmtClock(tod * 60);
    const px = (p.position && p.position.x) ?? p.x ?? 0;
    const pz = (p.position && p.position.z) ?? p.z ?? 0;
    districtEl.textContent = districtAt(px, pz);
    // Mission tracker: the runner drives world.mission.
    const m = world.mission || {};
    missionEl.textContent = m.id ? ('◆ ' + (m.objective || m.id)) : '◆ No active mission';
    // Activities: race/taxi state lives in the activities system.
    const actSys = sysObj.activities;
    const raceNow = actSys && actSys.activeRace;
    const taxiNow = actSys && actSys.taxi;
    activityEl.textContent = raceNow ? ('▸ Race: ' + (raceNow.name || '')) : (taxiNow ? '▸ Taxi job running' : '');
    // Properties: owned lives in world.properties.owned; list() via the system.
    const propsSys = sysObj.properties;
    const ownedNames = propsSys && typeof propsSys.list === 'function'
      ? propsSys.list().filter((q) => q.owned).map((q) => q.name)
      : Object.keys((world.properties && world.properties.owned) || {});
    propsEl.textContent = ownedNames.length
      ? 'Properties: ' + ownedNames.join(', ')
      : 'Properties: none owned yet — press B near a for-sale blip';
    const lines = [];
    if (world.empire && typeof world.empire.rivalThreat === 'number' && world.empire.rivalThreat > 0) lines.push('Empire rival threat: ' + Math.floor(world.empire.rivalThreat));
    const arcDone = (o) => (o ? Object.keys(o).filter((k) => o[k] === true) : []);
    const done = [].concat(arcDone(world.revenge), arcDone(world.crown), arcDone(world.legacy), arcDone(world.gambit), arcDone(world.vice), arcDone(world.kingpin));
    if (done.length) lines.push('Done: ' + done.join(', '));
    if (world.completedMissions && world.completedMissions.length) lines.push('Missions: ' + world.completedMissions.length + '/44');
    progressEl.textContent = lines.join('  •  ');
    // Territory: control keys are the territories system's districts.
    const terr = world.territories || {};
    const ctrl = terr.control || {};
    const terrKeys = Object.keys(ctrl);
    territoryEl.textContent = terrKeys.length
      ? 'Territory — ' + terrKeys.map((d) => d + ' ' + Math.floor(ctrl[d] ?? 0) + '%').join('  ')
      : 'Territory — no districts yet';
    // Vehicle lines: read what Rico is actually aboard.
    const aboard = (typeof p.currentVehicle === 'function') ? p.currentVehicle() : null;
    bikeEl.textContent = aboard === 'bike' ? 'Bike: riding' : '';
    heliEl.textContent = aboard === 'heli' ? 'HELICOPTER — rise/fall with W/S' : '';
    const bestJs = world.kingpin && world.kingpin.jetSkiBest;
    jetskiEl.textContent = aboard === 'jetski' ? ('Jet Ski ' + Math.round(speed * 3.6) + ' km/h  •  Best ' + (bestJs != null ? bestJs.toFixed(1) + 's' : '—')) : '';
    // Fishing: state lives in the fishing system.
    const fishSys = sysObj.fishing;
    const fishState = fishSys ? fishSys.state : null;
    const fishBest = fishSys && typeof fishSys.best === 'function' ? fishSys.best() : null;
    fishingEl.textContent = fishState && fishState !== 'idle'
      ? ('Fishing: ' + fishState + ' — press E to ' + (fishState === 'bite' ? 'reel!' : 'cast'))
      : (fishBest ? ('Best catch: ' + fishBest.label + ' ($' + fishBest.value + ')') : '');
    // Crew: world.crew is an ARRAY of members.
    const crewMembers = Array.isArray(world.crew) ? world.crew : ((world.crew && world.crew.members) || []);
    crewEl.textContent = crewMembers.length
      ? 'Crew: ' + crewMembers.map((c) => (c.name || 'Mate') + ' ' + Math.floor(c.health ?? 100) + '%').join('  •  ')
      : '';
    const empire = world.empire || {};
    empireEl.textContent = (typeof empire.rivalThreat === 'number' && empire.rivalThreat > 0)
      ? ('Empire — rival threat ' + Math.floor(empire.rivalThreat))
      : '';
    const winnings = world.vice && world.vice.casinoWinnings;
    casinoEl.textContent = winnings ? ('Casino winnings: ' + fmtCash(winnings)) : '';
    const league = actSys && actSys.league;
    raceEl.textContent = (league && league.results && Object.keys(league.results).length)
      ? 'Racing League — ' + Object.entries(league.results).slice(0, 5).map(([n, r]) => n + ' ' + (r.points ?? r)).join('  ')
      : '';
    const tire = p.tireDamage ?? p.tires ?? 0;
    tireEl.textContent = tire > 50 ? '⚠ TIRE DAMAGE — handling reduced' : '';
    tireEl.style.display = tire > 50 ? 'block' : 'none';
    garageEl.textContent = (world.garage && world.garage.open)
      ? ('GARAGE — ' + (world.garage.cars || []).map((c) => c.name || c).join('  •  ') + '  (G to close)')
      : '';
    garageEl.style.display = (world.garage && world.garage.open) ? 'block' : 'none';
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.style.opacity = '0'; }
    drawMinimap();
  }

  const sys = { name: 'hud', update, toast, setObjective, flashObjective };
  return sys;
}
