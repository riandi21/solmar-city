import * as THREE from 'three';

// Street races, hidden packages and taxi jobs for Solmar City.
// A race is a chain of checkpoint rings: drive through them in order
// before the timer runs out and the prize lands in Rico's cash.
const RACE_DEFS = [
  {
    id: 'strip-sprint',
    name: 'Strip Sprint',
    prize: 600,
    limit: 75,
    points: [
      { x: 58, z: 0 }, { x: 116, z: 0 }, { x: 174, z: 0 },
      { x: 174, z: 58 }, { x: 116, z: 58 }, { x: 58, z: 58 },
      { x: 0, z: 58 }, { x: 0, z: 0 },
    ],
  },
  {
    id: 'marina-loop',
    name: 'Marina Loop',
    prize: 900,
    limit: 95,
    points: [
      { x: 232, z: 116 }, { x: 232, z: 174 }, { x: 261, z: 232 },
      { x: 295, z: 168 }, { x: 232, z: 232 }, { x: 174, z: 232 },
      { x: 174, z: 174 }, { x: 232, z: 116 },
    ],
  },
  {
    id: 'old-town-dash',
    name: 'Old Town Dash',
    prize: 750,
    limit: 85,
    points: [
      { x: -174, z: -58 }, { x: -232, z: -58 }, { x: -232, z: -116 },
      { x: -174, z: -116 }, { x: -116, z: -116 }, { x: -116, z: -58 },
      { x: -174, z: -29 }, { x: -203, z: -87 },
    ],
  },
  {
    id: 'docks-gauntlet',
    name: 'Docks Gauntlet',
    prize: 1200,
    limit: 110,
    points: [
      { x: -232, z: -232 }, { x: -203, z: -232 }, { x: -203, z: -203 },
      { x: -232, z: -203 }, { x: -232, z: -174 }, { x: -203, z: -174 },
      { x: -174, z: -203 }, { x: -174, z: -232 }, { x: -232, z: -261 },
      { x: -174, z: -261 },
    ],
  },
];

// Twenty stashes tucked around the city. Each one is worth fifty dollars.
const PACKAGE_SPOTS = [
  { x: 58, z: 29 }, { x: -58, z: 116 }, { x: 116, z: -58 },
  { x: -116, z: -174 }, { x: 232, z: 0 }, { x: -232, z: 58 },
  { x: 0, z: 232 }, { x: 174, z: 174 }, { x: -174, z: 232 },
  { x: 29, z: -203 }, { x: -203, z: -29 }, { x: 116, z: 232 },
  { x: -58, z: -232 }, { x: 295, z: 168 }, { x: -270, z: 300 },
  { x: 0, z: 318 }, { x: 100, z: 60 }, { x: -150, z: 200 },
  { x: 200, z: -200 }, { x: -232, z: -232 },
];

const DISTRICT_CENTERS = [
  { name: 'Downtown', x: 0, z: 0 },
  { name: 'Old Town', x: -203, z: -58 },
  { name: 'Marina', x: 300, z: 160 },
  { name: 'Boardwalk', x: 0, z: 285 },
  { name: 'Freight Yard', x: -185, z: -225 },
  { name: 'Airfield', x: 200, z: -200 },
];

function districtAt(x, z) {
  let best = DISTRICT_CENTERS[0];
  let bestD = Infinity;
  for (const d of DISTRICT_CENTERS) {
    const dd = (d.x - x) * (d.x - x) + (d.z - z) * (d.z - z);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best.name;
}

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

function makeRing(color) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(4, 0.35, 8, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  mesh.rotation.y = Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

export function createActivities(world) {
  const races = RACE_DEFS.map((def) => ({ ...def, best: null }));
  const packages = PACKAGE_SPOTS.map((spot, i) => ({
    id: i, x: spot.x, z: spot.z, taken: false, mesh: null,
  }));
  const rings = [];
  let activeRace = null;
  let raceClock = 0;
  let ringIndex = 0;
  let taxi = { state: 'idle', px: 0, pz: 0, dx: 0, dz: 0, fare: 0 };
  let packageMeshes = [];

  if (world.scene) {
    for (let i = 0; i < 10; i++) {
      const ring = makeRing(0xffc233);
      world.scene.add(ring);
      rings.push(ring);
    }
    packageMeshes = packages.map((pkg) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshBasicMaterial({ color: 0x33ff88 }),
      );
      mesh.position.set(pkg.x, 1.2, pkg.z);
      world.scene.add(mesh);
      pkg.mesh = mesh;
      return mesh;
    });
  }

  function showRing(i, point) {
    rings.forEach((ring, n) => { ring.visible = n === i; });
    if (point && rings[i]) rings[i].position.set(point.x, 2.2, point.z);
  }

  function hideRings() {
    rings.forEach((ring) => { ring.visible = false; });
  }

  function startRace(index) {
    if (activeRace) return false;
    const race = races[index];
    if (!race) return false;
    const p = playerPos(world);
    if (p) {
      const start = race.points[0];
      if (Math.hypot(start.x - p.x, start.z - p.z) > 25) {
        toast(world, `${race.name}: drive to the start ring first (within 25 m).`);
        return false;
      }
    }
    activeRace = race;
    ringIndex = 0;
    raceClock = race.limit;
    showRing(0, race.points[0]);
    toast(world, `Race started: ${race.name} — ${race.points.length} checkpoints, ${race.limit}s!`);
    pushEvent(world, { type: 'race-start', race: race.id });
    return true;
  }

  function finishRace() {
    const race = activeRace;
    const used = race.limit - raceClock;
    if (race.best === null || used < race.best) race.best = used;
    addCash(world, race.prize);
    toast(world, `${race.name} complete in ${used.toFixed(1)}s! Prize $${race.prize}.`);
    pushEvent(world, {
      type: 'activity-complete', kind: 'race', race: race.id,
      district: districtAt(race.points[0].x, race.points[0].z), amount: 6,
    });
    activeRace = null;
    hideRings();
  }

  function failRace(reason) {
    toast(world, `Race failed: ${reason}.`);
    pushEvent(world, { type: 'race-fail', race: activeRace.id, reason });
    activeRace = null;
    hideRings();
  }

  function startTaxi() {
    if (taxi.state !== 'idle') return false;
    const p = playerPos(world);
    if (!p) return false;
    // A passenger waits on a nearby road; the fare grows with the trip.
    const spots = [
      { x: 58, z: 116 }, { x: -58, z: 0 }, { x: 116, z: 174 },
      { x: -174, z: 58 }, { x: 0, z: -116 }, { x: 232, z: -58 },
    ];
    const pick = spots[Math.floor(Math.random() * spots.length)];
    const drops = [
      { x: 295, z: 168 }, { x: 0, z: 318 }, { x: -270, z: 300 },
      { x: 200, z: -200 }, { x: 29, z: 29 }, { x: -203, z: -87 },
    ];
    const drop = drops[Math.floor(Math.random() * drops.length)];
    const dist = Math.hypot(drop.x - pick.x, drop.z - pick.z);
    taxi = { state: 'pickup', px: pick.x, pz: pick.z, dx: drop.x, dz: drop.z, fare: 40 + Math.round(dist * 0.6) };
    toast(world, 'Taxi job: pick up the passenger at the marker.');
    pushEvent(world, { type: 'taxi-start', fare: taxi.fare });
    return true;
  }

  function taxiBonus() {
    const owned = world.properties && world.properties.owned;
    const hasDepot = Array.isArray(owned)
      ? owned.includes('depot') || owned.includes('Coral Taxi Depot')
      : owned && owned.depot;
    return hasDepot ? 1.25 : 1;
  }

  function update(dt) {
    const p = playerPos(world);
    if (!p) return;

    // Hidden packages: walk or drive within a few metres to grab one.
    for (const pkg of packages) {
      if (pkg.taken) continue;
      const d = Math.hypot(pkg.x - p.x, pkg.z - p.z);
      if (d < 3.5) {
        pkg.taken = true;
        if (pkg.mesh) pkg.mesh.visible = false;
        addCash(world, 50);
        const found = packages.filter((q) => q.taken).length;
        toast(world, `Hidden package found! +$50 (${found}/20).`);
        pushEvent(world, {
          type: 'activity-complete', kind: 'package', district: districtAt(pkg.x, pkg.z), amount: 2,
        });
      }
    }

    // Street race: timer ticks down, rings advance as Rico passes them.
    if (activeRace) {
      raceClock -= dt;
      if (raceClock <= 0) { failRace('time ran out'); return; }
      const point = activeRace.points[ringIndex];
      const d = Math.hypot(point.x - p.x, point.z - p.z);
      if (d < 6) {
        ringIndex += 1;
        if (ringIndex >= activeRace.points.length) { finishRace(); return; }
        showRing(ringIndex, activeRace.points[ringIndex]);
        toast(world, `Checkpoint ${ringIndex}/${activeRace.points.length} — ${Math.ceil(raceClock)}s left.`);
      }
    }

    // Taxi job: collect the passenger, then reach the destination.
    if (taxi.state === 'pickup') {
      if (Math.hypot(taxi.px - p.x, taxi.pz - p.z) < 5) {
        taxi.state = 'dropoff';
        toast(world, 'Passenger aboard — drive to the destination marker.');
      }
    } else if (taxi.state === 'dropoff') {
      if (Math.hypot(taxi.dx - p.x, taxi.dz - p.z) < 6) {
        const fare = Math.round(taxi.fare * taxiBonus());
        addCash(world, fare);
        toast(world, `Fare paid: $${fare}${taxiBonus() > 1 ? ' (depot bonus!)' : ''}.`);
        pushEvent(world, {
          type: 'activity-complete', kind: 'taxi', district: districtAt(taxi.dx, taxi.dz), amount: 3,
        });
        taxi = { state: 'idle', px: 0, pz: 0, dx: 0, dz: 0, fare: 0 };
      }
    }
  }

  return {
    update,
    races,
    packages,
    startRace,
    cancelRace() {
      if (!activeRace) return false;
      activeRace = null;
      hideRings();
      return true;
    },
    startTaxi,
    getRace() { return activeRace; },
    getRaceTime() { return raceClock; },
    getNextCheckpoint() {
      if (!activeRace) return null;
      return { ...activeRace.points[ringIndex], index: ringIndex, total: activeRace.points.length };
    },
    getRaceProgress() {
      if (!activeRace) return 0;
      return ringIndex / activeRace.points.length;
    },
    getTaxi() { return taxi; },
    getPackagesFound() { return packages.filter((q) => q.taken).length; },
    districtAt,
  };
}
