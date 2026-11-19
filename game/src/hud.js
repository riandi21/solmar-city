// HUD for Solmar City: every readout on screen plus the minimap.
// Builds its own DOM under #hud, refreshes text and bars each frame,
// and exposes world.toast(text) so any system can flash a message.
// The minimap is a 200x200 canvas: roads, player arrow, cars, police,
// mission marker, property blips and a territory tint per district.
import * as THREE from 'three';

const DISTRICT_RECTS = [
  { name: 'Downtown', x0: -58, z0: -58, x1: 116, z1: 116 },
  { name: 'Old Town', x0: -261, z0: -174, x1: -116, z1: 0 },
  { name: 'Marina', x0: 232, z0: 0, x1: 400, z1: 261 },
  { name: 'Boardwalk', x0: -116, z0: 232, x1: 174, z1: 330 },
  { name: 'Freight Yard', x0: -261, z0: -261, x1: -58, z1: -174 },
  { name: 'Airfield', x0: 174, z0: -261, x1: 261, z1: -58 },
];

const PROPERTY_DEFS = [
  { id: 'garage', name: "Rico's Garage", x: -150, z: 200, price: 2000 },
  { id: 'bar', name: 'Anchor Bar', x: 100, z: 60, price: 5000 },
  { id: 'depot', name: 'Coral Taxi Depot', x: 80, z: 140, price: 8000 },
  { id: 'beach', name: 'Beachfront House', x: 30, z: 280, price: 12000 },
];

export function createHud(world) {
  const root = document.getElementById('hud') || document.body;
  root.innerHTML = '';

  function make(tag, id, parent, text) {
    const el = document.createElement(tag);
    if (id) el.id = id;
    if (text !== undefined) el.textContent = text;
    (parent || root).appendChild(el);
    return el;
  }

  const topBar = make('div', 'hud-top', root);
  const cashEl = make('div', 'hud-cash', topBar, '$0');
  const clockEl = make('div', 'hud-clock', topBar, '12:00');
  const districtEl = make('div', 'hud-district', topBar, 'Downtown');
  const wantedEl = make('div', 'hud-wanted', topBar, '');
  const healthWrap = make('div', 'hud-health-wrap', root);
  make('span', 'hud-health-label', healthWrap, 'HP');
  const healthBar = make('div', 'hud-health-bar', healthWrap);
  const healthFill = make('div', 'hud-health-fill', healthBar);
  const armorEl = make('div', 'hud-armor', root, '');
  const weaponEl = make('div', 'hud-weapon', root, 'Fists');
  const speedEl = make('div', 'hud-speed', root, '');
  const nosWrap = make('div', 'hud-nos-wrap', root);
  make('span', 'hud-nos-label', nosWrap, 'NOS');
  const nosBar = make('div', 'hud-nos-bar', nosWrap);
  const nosFill = make('div', 'hud-nos-fill', nosBar);
  const objectiveEl = make('div', 'hud-objective', root, '');
  const trackerEl = make('div', 'hud-mission-tracker', root, '');
  const activityEl = make('div', 'hud-activity', root, '');
  const heistEl = make('div', 'hud-heist', root, '');
  const revengeEl = make('div', 'hud-revenge', root, '');
  const territoryEl = make('div', 'hud-territory', root, '');
  const bikeEl = make('div', 'hud-bike', root, '');
  const tireEl = make('div', 'hud-tire', root, '');
  const propsEl = make('div', 'hud-properties', root, '');
  const toastEl = make('div', 'hud-toast', root, '');
  const minimap = make('canvas', 'hud-minimap', root);
  minimap.width = 200;
  minimap.height = 200;
  const mapCtx = minimap.getContext('2d');

  let toastTimer = 0;
  let lastCash = -1;
  let lastWanted = -1;

  world.toast = function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    toastTimer = 3.5;
  };

  function districtAt(x, z) {
    const districts = (world.city && world.city.districts) || null;
    if (Array.isArray(districts)) {
      for (const d of districts) {
        const name = d.name || d.id || '';
        const x0 = d.x0 !== undefined ? d.x0 : (d.x !== undefined ? d.x - 90 : -9999);
        const x1 = d.x1 !== undefined ? d.x1 : (d.x !== undefined ? d.x + 90 : 9999);
        const z0 = d.z0 !== undefined ? d.z0 : (d.z !== undefined ? d.z - 90 : -9999);
        const z1 = d.z1 !== undefined ? d.z1 : (d.z !== undefined ? d.z + 90 : 9999);
        if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return name;
      }
    }
    for (const r of DISTRICT_RECTS) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.name;
    }
    if (z > 261) return 'Beach';
    if (x < -261 || x > 261) return 'Outskirts';
    return 'Solmar City';
  }

  function formatClock() {
    const t = world.timeOfDay !== undefined ? world.timeOfDay : 12;
    const hours = Math.floor(t) % 24;
    const minutes = Math.floor((t - Math.floor(t)) * 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return hh + ':' + mm;
  }

  function ownedProperties() {
    const owned = [];
    const state = world.properties || {};
    const list = state.owned || state.list || world.ownedProperties || [];
    for (const def of PROPERTY_DEFS) {
      const has = Array.isArray(list)
        ? list.includes(def.id)
        : !!list[def.id];
      owned.push({ def, has });
    }
    return owned;
  }

  function drawMinimap() {
    const size = 200;
    const span = 700;
    const toMapX = (x) => ((x + span / 2) / span) * size;
    const toMapZ = (z) => ((z + span / 2) / span) * size;
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.fillStyle = 'rgba(12, 20, 28, 0.82)';
    mapCtx.fillRect(0, 0, size, size);
    const territories = world.territories || {};
    const control = territories.control || territories.districts || {};
    for (const rect of DISTRICT_RECTS) {
      const key = rect.name;
      const value = control[key] !== undefined ? control[key] : (control[key.toLowerCase()] || 0);
      if (value > 60) {
        mapCtx.fillStyle = 'rgba(64, 190, 120, 0.22)';
      } else if (value > 25) {
        mapCtx.fillStyle = 'rgba(240, 200, 80, 0.14)';
      } else {
        mapCtx.fillStyle = 'rgba(220, 80, 80, 0.10)';
      }
      mapCtx.fillRect(toMapX(rect.x0), toMapZ(rect.z0), toMapX(rect.x1) - toMapX(rect.x0), toMapZ(rect.z1) - toMapZ(rect.z0));
    }
    mapCtx.fillStyle = '#2e6f8e';
    mapCtx.fillRect(toMapX(261), 0, size - toMapX(261), size);
    mapCtx.fillRect(0, toMapZ(261), size, size - toMapZ(261));
    const roads = (world.city && world.city.roads) || [];
    mapCtx.strokeStyle = 'rgba(200, 200, 200, 0.55)';
    mapCtx.lineWidth = 2;
    if (roads.length > 0) {
      for (const road of roads) {
        const coord = road.coord !== undefined ? road.coord : road.position;
        const spanRoad = road.span !== undefined ? road.span : 522;
        mapCtx.beginPath();
        if (road.axis === 'x' || road.axis === 'horizontal') {
          mapCtx.moveTo(toMapX(-spanRoad / 2), toMapZ(coord));
          mapCtx.lineTo(toMapX(spanRoad / 2), toMapZ(coord));
        } else {
          mapCtx.moveTo(toMapX(coord), toMapZ(-spanRoad / 2));
          mapCtx.lineTo(toMapX(coord), toMapZ(spanRoad / 2));
        }
        mapCtx.stroke();
      }
    } else {
      for (const c of [-232, -174, -116, -58, 0, 58, 116, 174, 232]) {
        mapCtx.beginPath();
        mapCtx.moveTo(toMapX(c), 0);
        mapCtx.lineTo(toMapX(c), size);
        mapCtx.moveTo(0, toMapZ(c));
        mapCtx.lineTo(size, toMapZ(c));
        mapCtx.stroke();
      }
    }
    for (const entry of ownedProperties()) {
      mapCtx.fillStyle = entry.has ? '#3ddc84' : '#ffd23d';
      mapCtx.beginPath();
      mapCtx.arc(toMapX(entry.def.x), toMapZ(entry.def.z), entry.has ? 4 : 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    const marker = world.mission && world.mission.marker;
    if (marker) {
      const mx = marker.x !== undefined ? marker.x : (marker.position ? marker.position.x : 0);
      const mz = marker.z !== undefined ? marker.z : (marker.position ? marker.position.z : 0);
      const pulse = 5 + Math.sin(world.elapsed * 4) * 2;
      mapCtx.fillStyle = '#ff5a5a';
      mapCtx.beginPath();
      mapCtx.arc(toMapX(mx), toMapZ(mz), pulse, 0, Math.PI * 2);
      mapCtx.fill();
    }
    const cars = world.cars || [];
    for (const car of cars) {
      const pos = car.position || car.mesh?.position;
      if (!pos) continue;
      mapCtx.fillStyle = car.kind === 'police' ? '#3d8bff' : '#e8e8e8';
      mapCtx.fillRect(toMapX(pos.x) - 2, toMapZ(pos.z) - 2, 4, 4);
    }
    const player = world.player;
    if (player && player.position) {
      const px = toMapX(player.position.x);
      const pz = toMapZ(player.position.z);
      const heading = player.heading || 0;
      mapCtx.save();
      mapCtx.translate(px, pz);
      mapCtx.rotate(-heading);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -7);
      mapCtx.lineTo(5, 5);
      mapCtx.lineTo(-5, 5);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
    }
  }

  const hud = {
    update(dt) {
      const player = world.player || {};
      const cash = Math.floor((world.player && typeof world.player.cash === 'number') ? world.player.cash : (world.cash || 0));
      if (cash !== lastCash) {
        cashEl.textContent = '$' + cash.toLocaleString('en-US');
        lastCash = cash;
      }
      clockEl.textContent = formatClock();
      const pos = player.position;
      if (pos) districtEl.textContent = districtAt(pos.x, pos.z);
      const wanted = world.wanted || 0;
      if (wanted !== lastWanted) {
        wantedEl.textContent = wanted > 0 ? '★'.repeat(wanted) + '☆'.repeat(5 - wanted) : '';
        wantedEl.classList.toggle('hot', wanted >= 3);
        lastWanted = wanted;
      }
      const health = Math.max(0, Math.min(100, player.health !== undefined ? player.health : 100));
      healthFill.style.width = health + '%';
      healthFill.classList.toggle('low', health < 30);
      const armor = player.armor || world.armor || 0;
      armorEl.textContent = armor > 0 ? 'Armor ' + Math.floor(armor) : '';
      const weapon = world.weapon || player.weapon || 'Fists';
      // player.ammo is a per-weapon map ({ pistol: 60, ... }), not a count —
      // show the count for the current weapon only.
      const ammoMap = world.ammo !== undefined ? world.ammo : player.ammo;
      const ammo = (ammoMap && typeof ammoMap === 'object') ? ammoMap[weapon] : ammoMap;
      weaponEl.textContent = (ammo === '' || ammo === undefined || ammo === null) ? weapon : weapon + '  ·  ' + ammo;
      const speed = Math.abs(player.speed || 0);
      const inVehicle = player.car || player.bike;
      speedEl.textContent = inVehicle ? Math.round(speed * 3.6) + ' km/h' : '';
      const nos = world.nos !== undefined ? world.nos : 1;
      nosFill.style.width = Math.round(Math.max(0, Math.min(1, nos)) * 100) + '%';
      nosWrap.style.visibility = inVehicle ? 'visible' : 'hidden';
      const mission = world.mission || {};
      let objectiveText = mission.objective || 'Free roam — find work around Solmar City.';
      if (mission.timer && mission.timer > 0) {
        const remain = Math.ceil(mission.timer);
        const mm = Math.floor(remain / 60);
        const ss = String(remain % 60).padStart(2, '0');
        objectiveText += '  ·  ' + mm + ':' + ss;
      }
      objectiveEl.textContent = objectiveText;
      const completed = world.completedMissions || [];
      trackerEl.textContent = completed.length > 0
        ? 'Missions done: ' + completed.length + ' / 24' + (mission.id ? '  ·  Now: M' + mission.id : '')
        : (mission.id ? 'Mission M' + mission.id : 'No mission active — visit a marker');
      const acts = world.activities || {};
      const packages = acts.packagesFound !== undefined ? acts.packagesFound : (world.packagesFound || 0);
      const racesWon = acts.racesWon !== undefined ? acts.racesWon : 0;
      activityEl.textContent = 'Packages ' + packages + '/20   ·   Races won ' + racesWon;
      const heist = world.heist || {};
      if (heist.active || heist.scouted !== undefined) {
        const scouted = Array.isArray(heist.scouted) ? heist.scouted.length : (heist.scouted || 0);
        heistEl.textContent = 'Heist: scouted ' + scouted + '/3' +
          (heist.vaultCracked ? ' · vault cracked' : '') +
          (heist.lootAboard ? ' · loot aboard' : '');
        heistEl.style.display = 'block';
      } else {
        heistEl.style.display = 'none';
      }
      const revenge = world.revenge || {};
      if (revenge.active || revenge.courierTailed || revenge.ledgerStolen || revenge.convoyStopped || revenge.donDefeated) {
        const steps = [
          revenge.courierTailed ? 'courier tailed' : 'tail the courier',
          revenge.ledgerStolen ? 'ledger stolen' : 'raid the warehouse',
          revenge.convoyStopped ? 'convoy stopped' : 'ambush the convoy',
          revenge.donDefeated ? 'Don defeated' : 'storm the penthouse',
        ];
        const done = [revenge.courierTailed, revenge.ledgerStolen, revenge.convoyStopped, revenge.donDefeated].filter(Boolean).length;
        revengeEl.textContent = 'Dourado Revenge ' + done + '/4: ' + steps.join(' → ');
        revengeEl.style.display = 'block';
      } else {
        revengeEl.style.display = 'none';
      }
      const territories = world.territories || {};
      const control = territories.control || {};
      const names = ['Downtown', 'Old Town', 'Marina', 'Boardwalk', 'Freight Yard', 'Airfield'];
      const parts = names.map((name) => {
        const value = control[name] !== undefined ? control[name] : (control[name.toLowerCase().replace(' ', '')] || 0);
        return name.split(' ')[0] + ' ' + Math.round(value);
      });
      territoryEl.textContent = 'Territory: ' + parts.join('  ·  ');
      const bikes = world.bikes || [];
      const ownedBike = world.ownedBike || (player.bike ? (player.bike.kind || player.bike.name || 'Bike') : null);
      const wheelie = player.wheelie || world.wheelie;
      bikeEl.textContent = ownedBike
        ? 'Bike: ' + ownedBike + (wheelie ? '  ·  WHEELIE!' : '') + (player.bike ? ' (riding)' : ' (owned)')
        : 'Bike: none — visit the bike shop on the boardwalk';
      const tire = world.tireDamage || 0;
      if (tire > 0) {
        tireEl.textContent = '⚠ Tire damage — handling reduced. Repair at the garage.';
        tireEl.style.display = 'block';
      } else {
        tireEl.style.display = 'none';
      }
      const ownedList = ownedProperties();
      const ownedNames = ownedList.filter((o) => o.has).map((o) => o.def.name);
      const income = (world.properties && world.properties.incomePerHour) || 0;
      propsEl.textContent = ownedNames.length > 0
        ? 'Owned: ' + ownedNames.join(', ') + (income > 0 ? '  ·  +$' + income + '/hr' : '')
        : 'Properties for sale — press B at a $ marker';
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.classList.remove('show');
      }
      drawMinimap();
    },
  };

  world.hud = hud;
  return hud;
}
