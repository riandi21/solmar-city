// activities.js — side activities: street races, hidden packages, taxi
// jobs, the Street Racing League, and the NEW jet ski race.
// Factory: createActivities(scene, world) or createActivities(world).
// Jet ski best time is tracked in world.kingpinState.jetSkiBestTime;
// league points/wins live in world.viceState.

function dist2d(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dz * dz);
}

function playerPos(world) {
  const p = world.player && world.player.position;
  return p || { x: 0, y: 0, z: 0 };
}

function notify(world, text) {
  if (!world) return;
  if (typeof world.toast === 'function') { world.toast(text); return; }
  if (Array.isArray(world.events)) world.events.push({ type: 'toast', text });
  if (world.hud && typeof world.hud.toast === 'function') world.hud.toast(text);
}

function ensureState(world) {
  if (!world.kingpinState) {
    world.kingpinState = {
      shipmentSeized: false, informantProtected: false,
      siegeSurvived: false, kingpinCrowned: false,
      cartelThreat: 50, fishingBestCatch: null, jetSkiBestTime: null,
    };
  }
  if (!world.viceState) {
    world.viceState = {
      casinoRigged: false, highRollerWon: false,
      havanaRunDone: false, viceKingCrowned: false,
      casinoWinnings: 0, leaguePoints: 0, leagueWins: 0, nightclubIncome: 0,
    };
  }
  if (typeof world.cash !== 'number') world.cash = 0;
  if (!Array.isArray(world.completedMissions)) world.completedMissions = [];
  return world;
}

export const STREET_RACES = [
  {
    id: 'race-downtown', name: 'Downtown Circuit', prize: 1500,
    checkpoints: [{ x: 0, z: 0 }, { x: 116, z: 0 }, { x: 116, z: 116 }, { x: 0, z: 116 }, { x: 0, z: 0 }],
  },
  {
    id: 'race-hills', name: 'North Hills Switchbacks', prize: 2000,
    checkpoints: [{ x: 0, z: -174 }, { x: -58, z: -232 }, { x: 0, z: -260 }, { x: 58, z: -232 }, { x: 0, z: -174 }],
  },
  {
    id: 'race-vineyards', name: 'Vineyards Country Run', prize: 2000,
    checkpoints: [{ x: 0, z: -260 }, { x: -58, z: -290 }, { x: 58, z: -290 }, { x: 0, z: -320 }, { x: 0, z: -260 }],
  },
  {
    id: 'race-airfield', name: 'Airfield Straight', prize: 2500,
    checkpoints: [{ x: 200, z: -230 }, { x: 230, z: -230 }, { x: 230, z: -200 }, { x: 200, z: -200 }, { x: 200, z: -230 }],
  },
];

export const LEAGUE_RACES = [
  { id: 'league-airfield', name: 'League: Airfield Straight', prize: 1000, checkpoints: STREET_RACES[3].checkpoints },
  { id: 'league-downtown', name: 'League: Downtown Circuit', prize: 1000, checkpoints: STREET_RACES[0].checkpoints },
  { id: 'league-havana', name: 'League: Little Havana Night Run', prize: 1000, checkpoints: [{ x: -232, z: 116 }, { x: -174, z: 174 }, { x: -232, z: 232 }, { x: -174, z: 116 }, { x: -232, z: 116 }] },
];

export const JET_SKI_RACE = {
  id: 'jetski-islands', name: 'Jet Ski: Marina to The Islands', prize: 1200,
  start: { x: 320, y: 0, z: 200 },
  buoys: [
    { x: 330, y: 0, z: 250 }, { x: 350, y: 0, z: 300 },
    { x: 360, y: 0, z: 340 }, { x: 370, y: 0, z: 360 },
  ],
  finish: { x: 370, y: 0, z: 360 },
};

export const HIDDEN_PACKAGES = [
  { x: -232, z: -232 }, { x: 232, z: -232 }, { x: -232, z: 232 }, { x: 232, z: 232 },
  { x: 0, z: -232 }, { x: 0, z: 232 }, { x: -232, z: 0 }, { x: 232, z: 0 },
  { x: -174, z: -174 }, { x: 174, z: -174 }, { x: -174, z: 174 }, { x: 174, z: 174 },
  { x: 29, z: 29 }, { x: -270, z: 300 }, { x: 0, z: 318 }, { x: 305, z: 175 },
  { x: -215, z: 130 }, { x: 0, z: -290 }, { x: 370, z: 360 }, { x: -180, z: 300 },
];

export function createActivities(scene, world) {
  const w = world || scene;
  ensureState(w);
  const state = {
    activeRace: null,
    raceCheckpoint: 0,
    raceTime: 0,
    jetSkiRace: null,
    jetSkiCheckpoint: 0,
    jetSkiTime: 0,
    taxiJob: null,
    packagesFound: new Set(),
    leagueDone: new Set(),
  };

  function startRace(race) {
    state.activeRace = race;
    state.raceCheckpoint = 0;
    state.raceTime = 0;
    notify(w, 'Race started: ' + race.name + ' — hit every checkpoint ring.');
    return race;
  }

  function startLeagueRace(race) {
    return startRace(race);
  }

  function startJetSkiRace() {
    state.jetSkiRace = JET_SKI_RACE;
    state.jetSkiCheckpoint = 0;
    state.jetSkiTime = 0;
    notify(w, 'Jet ski race started: marina to The Islands — hit every buoy.');
    return JET_SKI_RACE;
  }

  function finishJetSkiRace() {
    const time = state.jetSkiTime;
    const best = w.kingpinState.jetSkiBestTime;
    if (best === null || best === undefined || time < best) {
      w.kingpinState.jetSkiBestTime = time;
      notify(w, 'New jet ski best time: ' + time.toFixed(1) + 's! +$' + JET_SKI_RACE.prize);
    } else {
      notify(w, 'Jet ski race finished in ' + time.toFixed(1) + 's (best ' + best.toFixed(1) + 's). +$' + JET_SKI_RACE.prize);
    }
    w.cash += JET_SKI_RACE.prize;
    state.jetSkiRace = null;
    state.jetSkiCheckpoint = 0;
    state.jetSkiTime = 0;
  }

  function startTaxiJob() {
    const pickups = [{ x: 58, z: 116 }, { x: 100, z: 60 }, { x: 0, z: 264 }, { x: -215, z: 130 }];
    const drops = [{ x: -174, z: 232 }, { x: 120, z: 90 }, { x: 305, z: 175 }, { x: 29, z: 29 }];
    const i = Math.floor(Math.random() * pickups.length);
    // Fare scales with trip length so long cross-town fares pay more.
    const fare = 120 + Math.round(dist2d(pickups[i], drops[(i + 1) % drops.length]) / 10) * 5;
    state.taxiJob = { pickup: pickups[i], drop: drops[(i + 1) % drops.length], stage: 'pickup', fare };
    notify(w, 'Taxi job: pick up a passenger at the marker.');
    return state.taxiJob;
  }

  const api = {
    name: 'activities',
    races: STREET_RACES,
    leagueRaces: LEAGUE_RACES,
    jetSkiRace: JET_SKI_RACE,
    packages: HIDDEN_PACKAGES,
    state,
    startRace,
    startLeagueRace,
    startJetSkiRace,
    startTaxiJob,
    packagesFoundCount() { return state.packagesFound.size; },
    jetSkiBestTime() { return w.kingpinState.jetSkiBestTime; },
    leaguePoints() { return w.viceState.leaguePoints; },
    update(dt) {
      const pos = playerPos(w);
      // Street race / league progress.
      if (state.activeRace) {
        state.raceTime += dt;
        const cp = state.activeRace.checkpoints[state.raceCheckpoint];
        if (cp && dist2d(pos, cp) <= 14) {
          state.raceCheckpoint += 1;
          if (state.raceCheckpoint >= state.activeRace.checkpoints.length) {
            const race = state.activeRace;
            const isLeague = LEAGUE_RACES.some((r) => r.id === race.id);
            w.cash += race.prize;
            if (isLeague) {
              w.viceState.leaguePoints += 10;
              w.viceState.leagueWins += 1;
              state.leagueDone.add(race.id);
              notify(w, 'League race won: ' + race.name + ' (+10 pts). +$' + race.prize);
              if (state.leagueDone.size >= 3) {
                w.cash += 5000;
                w.viceState.leaguePoints += 25;
                notify(w, 'STREET RACING LEAGUE CHAMPION! +$5,000 championship prize.');
              }
            } else {
              notify(w, 'Race won: ' + race.name + ' in ' + state.raceTime.toFixed(1) + 's. +$' + race.prize);
            }
            state.activeRace = null;
            state.raceCheckpoint = 0;
            state.raceTime = 0;
          }
        }
      }
      // Jet ski race: checkpoint buoys, then the finish at The Islands.
      if (state.jetSkiRace) {
        state.jetSkiTime += dt;
        const buoy = state.jetSkiRace.buoys[state.jetSkiCheckpoint];
        if (buoy && dist2d(pos, buoy) <= 12) {
          state.jetSkiCheckpoint += 1;
          if (state.jetSkiCheckpoint >= state.jetSkiRace.buoys.length) {
            if (dist2d(pos, state.jetSkiRace.finish) <= 14) finishJetSkiRace();
          }
        } else if (!buoy && dist2d(pos, state.jetSkiRace.finish) <= 14) {
          finishJetSkiRace();
        }
      }
      // Hidden packages: +$50 each, one per spot.
      HIDDEN_PACKAGES.forEach((pkg, i) => {
        if (!state.packagesFound.has(i) && dist2d(pos, pkg) <= 6) {
          state.packagesFound.add(i);
          w.cash += 50;
          notify(w, 'Hidden package found (' + state.packagesFound.size + '/20). +$50');
        }
      });
      // Taxi jobs: pickup, then drop-off; depot ownership adds 25%.
      if (state.taxiJob) {
        const job = state.taxiJob;
        if (job.stage === 'pickup' && dist2d(pos, job.pickup) <= 10) {
          job.stage = 'drop';
          notify(w, 'Passenger aboard — drive to the marker.');
        } else if (job.stage === 'drop' && dist2d(pos, job.drop) <= 10) {
          let fare = job.fare;
          const ownsDepot = w.properties && w.properties.owned && w.properties.owned.includes('depot');
          if (ownsDepot) fare = Math.round(fare * 1.25);
          w.cash += fare;
          notify(w, 'Taxi fare paid. +$' + fare);
          state.taxiJob = null;
        }
      }
    },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  return api;
}

export default createActivities;
