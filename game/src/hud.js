// Solmar City HUD: DOM readouts plus a 200x200 minimap canvas. Cash, health,
// wanted stars, Heat bar (blue), cartel threat bar (red), objective line, speed,
// toast messages, weapon/armor labels, clock, district label, mission tracker,
// activity tracker, owned properties, arc progress lines (heist, revenge, crown,
// legacy, gambit, vice, kingpin), NOS meter, tire warning, territory bars,
// bike/jet-ski/heli indicators, crew panel, garage menu, empire panel, casino
// winnings, racing league board, and a fishing line (best catch).

function el(id) {
  return document.getElementById(id);
}

function fmtCash(n) {
  return '$' + Math.floor(n || 0).toLocaleString('en-US');
}

function fmtClock(hours) {
  const h = Math.floor(hours || 0) % 24;
  const m = Math.floor(((hours || 0) % 1) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return hh + ':' + mm;
}

function stars(n) {
  let out = '';
  for (let i = 0; i < 5; i += 1) out += i < n ? '★' : '☆';
  return out;
}

export function createHud(world) {
  const minimap = el('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;
  let toastTimer = 0;
  let toastText = '';

  function setText(id, text) {
    const node = el(id);
    if (node && node.textContent !== text) node.textContent = text;
  }

  function setWidth(id, pct) {
    const node = el(id);
    if (node) node.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  function drawMinimap() {
    if (!mctx || !minimap) return;
    const size = 200;
    const scale = size / 900;
    const toMap = (x, z) => [(x + 450) * scale, (z + 450) * scale];
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = 'rgba(10, 24, 38, 0.92)';
    mctx.fillRect(0, 0, size, size);
    // Sea to the south and east, plus the marina basin on the east edge.
    mctx.fillStyle = 'rgba(32, 96, 140, 0.9)';
    mctx.fillRect(0, (261 + 450) * scale, size, size - (261 + 450) * scale);
    mctx.fillRect((261 + 450) * scale, 0, size - (261 + 450) * scale, size);
    // Islands chain, south-east offshore.
    mctx.fillStyle = 'rgba(214, 196, 140, 0.9)';
    mctx.beginPath();
    mctx.arc((370 + 450) * scale, (360 + 450) * scale, 7, 0, Math.PI * 2);
    mctx.fill();
    mctx.beginPath();
    mctx.arc((420 + 450) * scale, (400 + 450) * scale, 5, 0, Math.PI * 2);
    mctx.fill();
    // Territory tints.
    const districts = world.territories && world.territories.districts
      ? world.territories.districts : [];
    districts.forEach((d, i) => {
      const [mx, mz] = toMap(d.x || 0, d.z || 0);
      mctx.fillStyle = (d.control || 0) > 60
        ? 'rgba(64, 220, 120, 0.25)' : 'rgba(220, 80, 80, 0.12)';
      mctx.beginPath();
      mctx.arc(mx, mz, 16, 0, Math.PI * 2);
      mctx.fill();
      void i;
    });
    // Roads.
    const roads = (world.city && world.city.roads) || [];
    mctx.strokeStyle = 'rgba(200, 200, 200, 0.55)';
    mctx.lineWidth = 1.5;
    roads.forEach((r) => {
      const [ax, az] = toMap(r.axis === 'x' ? -261 : r.coord, r.axis === 'x' ? r.coord : -261);
      const [bx, bz] = toMap(r.axis === 'x' ? 261 : r.coord, r.axis === 'x' ? r.coord : 261);
      mctx.beginPath();
      mctx.moveTo(ax, az);
      mctx.lineTo(bx, bz);
      mctx.stroke();
    });
    // Property blips: owned green, for sale amber.
    const props = world.properties && world.properties.list ? world.properties.list : [];
    props.forEach((p) => {
      const [mx, mz] = toMap(p.x || 0, p.z || 0);
      mctx.fillStyle = p.owned ? '#3ddc78' : '#ffb020';
      mctx.beginPath();
      mctx.arc(mx, mz, 3.5, 0, Math.PI * 2);
      mctx.fill();
    });
    // Crew blips.
    (world.crewMembers || []).forEach((c) => {
      const [mx, mz] = toMap(c.position.x, c.position.z);
      mctx.fillStyle = '#6ec6ff';
      mctx.fillRect(mx - 2, mz - 2, 4, 4);
    });
    // Police blips.
    (world.cars || []).filter((c) => c.kind === 'police').forEach((c) => {
      const [mx, mz] = toMap(c.position.x, c.position.z);
      mctx.fillStyle = '#4d7cff';
      mctx.beginPath();
      mctx.arc(mx, mz, 3, 0, Math.PI * 2);
      mctx.fill();
    });
    // Mission marker.
    const marker = world.mission && world.mission.marker;
    if (marker) {
      const [mx, mz] = toMap(marker.x, marker.z);
      mctx.fillStyle = '#ffdd33';
      mctx.beginPath();
      mctx.arc(mx, mz, 5, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = '#ffdd33';
      mctx.beginPath();
      mctx.arc(mx, mz, 8 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2);
      mctx.stroke();
    }
    // Player arrow.
    const p = world.player && world.player.position;
    if (p) {
      const [mx, mz] = toMap(p.x, p.z);
      const heading = world.player.heading || 0;
      mctx.save();
      mctx.translate(mx, mz);
      mctx.rotate(-heading);
      mctx.fillStyle = '#ffffff';
      mctx.beginPath();
      mctx.moveTo(0, -7);
      mctx.lineTo(5, 6);
      mctx.lineTo(-5, 6);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
    }
  }

  const hud = {
    toast(message, seconds) {
      toastText = message;
      toastTimer = seconds || 3;
      setText('toast', message);
      const node = el('toast');
      if (node) node.style.opacity = '1';
    },
    setObjective(text) { setText('objective', text); },
    update(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) {
          const node = el('toast');
          if (node) node.style.opacity = '0';
        }
      }
      const p = world.player || {};
      setText('cash', fmtCash(world.cash));
      setWidth('health-fill', p.health || 0);
      setText('health-num', Math.max(0, Math.ceil(p.health || 0)) + '');
      setText('wanted', stars(world.wanted || 0));
      setWidth('heat-fill', world.heat || 0);
      setWidth('cartel-fill', world.cartelThreat || 0);
      const speed = Math.abs(p.speed || 0) * 3.6;
      setText('speed', Math.round(speed) + ' km/h');
      const time = world.daynight && typeof world.daynight.hours === 'number'
        ? world.daynight.hours : (world.timeOfDay || 12);
      setText('clock', fmtClock(time));
      const mission = world.mission || {};
      setText('objective', mission.objective || 'Free roam — open the map and find work.');
      setText('mission-tracker', mission.id
        ? 'Mission ' + mission.id + ': ' + (mission.objective || '')
        : 'No active mission');
      const weapon = world.combat && world.combat.weapon ? world.combat.weapon : 'Pistol';
      const ammo = world.combat && typeof world.combat.ammo === 'number' ? world.combat.ammo : 0;
      setText('weapon', weapon + '  •  ' + ammo + ' rounds');
      setText('armor', 'Armor ' + Math.round(world.armor || 0));
      setWidth('nos-fill', world.nos || 0);
      const tire = world.tireDamage || 0;
      setText('tire-warning', tire > 0 ? 'TIRE DAMAGE — repair at the garage' : '');
      const kingpin = world.kingpin || {};
      setText('kingpin-line', kingpin.kingpinCrowned
        ? '👑 Kingpin of Solmar'
        : 'Kingpin: ' + (kingpin.shipmentSeized ? '✓ Shipment ' : '')
          + (kingpin.informantProtected ? '✓ Informant ' : '')
          + (kingpin.siegeSurvived ? '✓ Siege' : ''));
      setText('heist-line', world.heist && world.heist.progress
        ? 'Casino Heist: ' + world.heist.progress : '');
      setText('crown-line', world.crown && world.crown.progress
        ? 'Coral Crown: ' + world.crown.progress : '');
      setText('legacy-line', world.legacy && world.legacy.progress
        ? 'Solmar Legacy: ' + world.legacy.progress : '');
      setText('gambit-line', world.gambit && world.gambit.progress
        ? "Don's Gambit: " + world.gambit.progress : '');
      setText('vice-line', world.vice && world.vice.progress
        ? 'Vice King: ' + world.vice.progress : '');
      setText('revenge-line', world.revenge && world.revenge.progress
        ? 'Dourado Revenge: ' + world.revenge.progress : '');
      const owned = (world.properties && world.properties.list
        ? world.properties.list.filter((x) => x.owned) : []);
      setText('properties-line', owned.length
        ? 'Owned: ' + owned.map((x) => x.name).join(', ') : 'No properties yet — press B at a marker to buy');
      const terr = world.territories && world.territories.districts
        ? world.territories.districts : [];
      setText('territory-line', terr.length
        ? terr.map((d) => d.name + ' ' + Math.round(d.control || 0) + '%').join('  •  ') : '');
      const crew = world.crewMembers || [];
      setText('crew-line', crew.length
        ? 'Crew: ' + crew.map((c) => c.name + ' ' + Math.round(c.health || 0) + 'hp').join(', ')
        : 'No crew — hire at the Anchor Bar ($1,000)');
      setText('empire-line', world.empire
        ? 'Empire income $' + Math.round(world.empire.income || 0) + '/hr • Rival threat '
          + Math.round(world.empire.rivalThreat || 0) : '');
      setText('casino-line', world.vice
        ? 'Casino winnings: ' + fmtCash(world.vice.casinoWinnings || 0) : '');
      setText('league-line', world.vice
        ? 'Racing League: ' + (world.vice.leaguePoints || 0) + ' pts • '
          + (world.vice.leagueWins || 0) + ' wins' : '');
      const heli = world.playerHeli || {};
      setText('heli-line', heli.boarded
        ? 'Heli alt ' + Math.round(heli.altitude || 0) + ' m • rotor '
          + Math.round((heli.rotor || 0) * 100) + '%' : '');
      const ski = world.jetski || {};
      setText('jetski-line', ski.riding
        ? 'Jet Ski ' + Math.round(Math.abs(ski.speed || 0) * 3.6) + ' km/h • best '
          + (kingpin.jetSkiBestTime ? kingpin.jetSkiBestTime.toFixed(1) + 's' : '—')
        : (kingpin.jetSkiBestTime ? 'Jet Ski best ' + kingpin.jetSkiBestTime.toFixed(1) + 's' : ''));
      setText('bike-line', world.playerBike
        ? 'Bike: ' + (world.playerBike.kind || 'bike')
          + (world.playerBike.wheelie ? ' • WHEELIE!' : '') : '');
      setText('fishing-line', 'Best catch: ' + (kingpin.fishingBestCatch || 'none yet')
        + (world.fishing && world.fishing.waiting ? ' • ...bite coming...' : ''));
      setText('district', world.currentDistrict || 'Solmar City');
      setText('activity-line', world.activity && world.activity.text ? world.activity.text : '');
      setText('station-line', world.audioStation ? '♪ ' + world.audioStation : '');
      drawMinimap();
      void toastText;
    },
  };
  return hud;
}
