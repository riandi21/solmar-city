// Street activities: races, hidden packages, taxi jobs, the Street Racing League
// championship, and the jet ski race from the marina to The Islands.
//
// export createActivities(world) -> { update(dt), startRace(name), collectPackage(id), startTaxi() }
// The world contract: player { position {x, z}, cash }, events [], vice { racePoints, raceWins },
// kingpin { jetSkiBest }. Cash is added to world.player.cash (falling back to world.cash).

const CHECKPOINT_RADIUS = 12;
const PACKAGE_RADIUS = 6;
const TAXI_RADIUS = 10;

const RACES = {
  'North Hills Switchbacks': {
    prize: 1500, parTime: 180, league: false,
    checkpoints: [
      { x: 120, z: -420 }, { x: 90, z: -480 }, { x: 150, z: -520 },
      { x: 200, z: -470 }, { x: 170, z: -400 }, { x: 120, z: -380 },
    ],
  },
  'Vineyard Country Run': {
    prize: 1200, parTime: 150, league: false,
    checkpoints: [
      { x: -420, z: -420 }, { x: -480, z: -480 }, { x: -420, z: -520 },
      { x: -350, z: -470 }, { x: -380, z: -400 },
    ],
  },
  'Downtown Sprint': {
    prize: 1000, parTime: 120, league: false,
    checkpoints: [
      { x: -100, z: 60 }, { x: 100, z: 60 }, { x: 100, z: -60 },
      { x: -100, z: -60 }, { x: 0, z: 0 },
    ],
  },
  'Strip Night Run': {
    prize: 1800, parTime: 150, league: false,
    checkpoints: [
      { x: 120, z: 180 }, { x: 60, z: 220 }, { x: 180, z: 240 },
      { x: 200, z: 140 }, { x: 120, z: 180 },
    ],
  },
  'Airfield Straight': {
    prize: 2000, parTime: 90, league: true,
    checkpoints: [
      { x: 280, z: 100 }, { x: 340, z: 140 }, { x: 420, z: 180 },
    ],
  },
  'Downtown Circuit': {
    prize: 2000, parTime: 150, league: true,
    checkpoints: [
      { x: -100, z: 60 }, { x: 100, z: 60 }, { x: 100, z: -60 },
      { x: -100, z: -60 }, { x: -100, z: 60 },
    ],
  },
  'Little Havana Night Run': {
    prize: 2000, parTime: 150, league: true,
    checkpoints: [
      { x: -300, z: -350 }, { x: -260, z: -300 }, { x: -340, z: -280 },
      { x: -300, z: -350 },
    ],
  },
  'Jet Ski: Marina to The Islands': {
    prize: 2500, parTime: 180, league: false, jetSki: true,
    checkpoints: [
      { x: 400, z: -450 }, { x: 500, z: -480 }, { x: 600, z: -500 },
      { x: 700, z: -500 },
    ],
  },
};

const LEAGUE_RACES = ['Airfield Straight', 'Downtown Circuit', 'Little Havana Night Run'];
const LEAGUE_PRIZE = 5000;

const PACKAGE_SPOTS = [
  { x: -120, z: 80 }, { x: 200, z: -80 }, { x: -350, z: 250 }, { x: 420, z: 300 },
  { x: 150, z: -520 }, { x: -300, z: -350 }, { x: 350, z: -420 }, { x: -500, z: -480 },
  { x: 60, z: 220 }, { x: -80, z: -120 }, { x: 480, z: 380 }, { x: -450, z: 420 },
  { x: 0, z: 0 }, { x: 300, z: 100 }, { x: -200, z: 100 }, { x: 120, z: 180 },
  { x: 700, z: -500 }, { x: -150, z: -50 }, { x: 90, z: -60 }, { x: 240, z: 290 },
];

const TAXI_STOPS = [
  { x: -200, z: 100 }, { x: 120, z: 180 }, { x: 60, z: 220 }, { x: -80, z: -120 },
  { x: 300, z: 100 }, { x: 420, z: 300 }, { x: -350, z: 250 }, { x: 0, z: 0 },
  { x: 350, z: -420 }, { x: -450, z: 420 },
];

function dist2d(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function playerPos(world) {
  const p = world.player && world.player.position;
  return p ? { x: p.x || 0, z: p.z || 0 } : { x: 0, z: 0 };
}

function addCash(world, amount) {
  // Keep world.cash in sync with player.cash (see casino.js).
  if (world.player && typeof world.player.cash === 'number') world.player.cash += amount;
  else if (typeof world.cash === 'number') world.cash += amount;
  if (world.player && typeof world.player.cash === 'number' && typeof world.cash === 'number') world.cash = world.player.cash;
}

function note(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'activity', text });
}

function pick(arr, except) {
  let choice = arr[Math.floor(Math.random() * arr.length)];
  while (except && choice.x === except.x && choice.z === except.z) {
    choice = arr[Math.floor(Math.random() * arr.length)];
  }
  return choice;
}

export function createActivities(world) {
  const packages = PACKAGE_SPOTS.map((spot, index) => ({
    id: index + 1, x: spot.x, z: spot.z, collected: false,
  }));
  let activeRace = null;
  let taxi = null;
  const league = { results: {}, points: 0, wins: 0 };

  function finishRace(won) {
    const def = RACES[activeRace.name];
    const elapsed = activeRace.elapsed;
    const name = activeRace.name;
    activeRace = null;
    if (!won) {
      note(world, `Race over — ${name} not finished in time.`);
      return { won: false, name, time: elapsed };
    }
    addCash(world, def.prize);
    let championship = false;
    if (def.league) {
      const leagueWon = elapsed <= def.parTime;
      league.results[name] = leagueWon;
      if (leagueWon) {
        league.wins += 1;
        league.points += 10;
        if (world.vice) {
          world.vice.raceWins = (world.vice.raceWins || 0) + 1;
          world.vice.racePoints = (world.vice.racePoints || 0) + 10;
        }
      } else {
        league.points += 4;
        if (world.vice) world.vice.racePoints = (world.vice.racePoints || 0) + 4;
      }
      if (LEAGUE_RACES.every((r) => league.results[r])) {
        addCash(world, LEAGUE_PRIZE);
        championship = true;
      }
    }
    if (def.jetSki && world.kingpin) {
      if (!world.kingpin.jetSkiBest || elapsed < world.kingpin.jetSkiBest) {
        world.kingpin.jetSkiBest = Math.round(elapsed * 10) / 10;
      }
    }
    note(world, championship
      ? `Street Racing League CHAMPION — all three league races won! $${LEAGUE_PRIZE} championship prize.`
      : `Race won: ${name} in ${Math.round(elapsed)}s — $${def.prize}.`);
    return { won: true, name, time: elapsed, prize: def.prize, championship };
  }

  function update(dt) {
    if (activeRace) {
      activeRace.elapsed += dt;
      const def = RACES[activeRace.name];
      const pos = playerPos(world);
      const next = def.checkpoints[activeRace.checkpoint];
      if (next && dist2d(pos, next) <= CHECKPOINT_RADIUS) {
        activeRace.checkpoint += 1;
        if (activeRace.checkpoint >= def.checkpoints.length) {
          finishRace(true);
          return;
        }
        note(world, `Checkpoint ${activeRace.checkpoint}/${def.checkpoints.length} — ${activeRace.name}`);
      }
      if (activeRace.elapsed > def.parTime + 60) finishRace(false);
    }

    for (const pkg of packages) {
      if (!pkg.collected && dist2d(playerPos(world), pkg) <= PACKAGE_RADIUS) {
        collectPackage(pkg.id);
      }
    }

    if (taxi) {
      const pos = playerPos(world);
      if (!taxi.pickedUp && dist2d(pos, taxi.pickup) <= TAXI_RADIUS) {
        taxi.pickedUp = true;
        note(world, 'Passenger picked up — drive to the marker.');
      } else if (taxi.pickedUp && dist2d(pos, taxi.destination) <= TAXI_RADIUS) {
        const fare = taxi.fare;
        addCash(world, fare);
        note(world, `Taxi fare paid: $${fare}.`);
        taxi = null;
      }
    }
  }

  function startRace(name) {
    const def = RACES[name];
    if (!def) return { ok: false, error: `Unknown race: ${name}` };
    if (activeRace) return { ok: false, error: 'A race is already running' };
    activeRace = { name, checkpoint: 0, elapsed: 0 };
    note(world, `Race started: ${name} — hit every checkpoint ring before the clock runs out.`);
    return { ok: true, name, checkpoints: def.checkpoints.length, prize: def.prize, parTime: def.parTime };
  }

  function collectPackage(id) {
    const pkg = packages.find((p) => p.id === id);
    if (!pkg) return { ok: false, error: `No package ${id}` };
    if (pkg.collected) return { ok: false, error: `Package ${id} already collected` };
    pkg.collected = true;
    addCash(world, 50);
    const remaining = packages.filter((p) => !p.collected).length;
    note(world, `Hidden package ${id} found: +$50. ${remaining} left out there.`);
    return { ok: true, id, collected: packages.filter((p) => p.collected).length, remaining };
  }

  function startTaxi() {
    if (taxi) return { ok: false, error: 'A taxi job is already running' };
    const pickup = pick(TAXI_STOPS);
    const destination = pick(TAXI_STOPS, pickup);
    const fare = 40 + Math.round(dist2d(pickup, destination) / 10) * 5;
    taxi = { pickup, destination, fare, pickedUp: false };
    note(world, `Taxi job: pick up the passenger at the marker. Fare $${fare}.`);
    return { ok: true, pickup, destination, fare };
  }

  function listRaces() {
    return Object.entries(RACES).map(([name, def]) => ({
      name, prize: def.prize, parTime: def.parTime,
      league: !!def.league, jetSki: !!def.jetSki, checkpoints: def.checkpoints.length,
    }));
  }

  return {
    update,
    startRace,
    listRaces,
    collectPackage,
    startTaxi,
    get packages() { return packages.map((p) => ({ ...p })); },
    get activeRace() { return activeRace ? { ...activeRace } : null; },
    get league() { return { ...league, results: { ...league.results } }; },
    get taxi() { return taxi ? { ...taxi } : null; },
  };
}

export default createActivities;
