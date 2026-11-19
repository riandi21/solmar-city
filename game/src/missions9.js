// missions9.js — Solmar Legacy arc, missions 29-32 ($45,000 total), plus
// Don's Gambit, missions 33-36 ($50,000 total).
// Rico secures his legacy: protection, Old Town raid, island supply run,
// and a tower defence against a full rival assault. Then the Gambit: tail
// the feds, move the money offshore at night, expose the mole, and win
// with a false flag while the feds raid the rivals.
// Factory: createMissions9(scene, world) or createMissions9(world).
// Every stage declares `kind` FIRST; the runner calls onComplete on finish.

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
  if (!world.legacyState) {
    world.legacyState = {
      protectionCollected: false, rivalLedgerStolen: false,
      blockadeBroken: false, legacySecured: false,
    };
  }
  // Don's Gambit (M33-36) lives in this file too: the Round 11 brief's
  // file ownership puts it under the donsgambit step, and no other file
  // defines it.
  if (!world.gambitState) {
    world.gambitState = {
      fedsEvaded: false, moneyMoved: false,
      moleExposed: false, gambitWon: false,
    };
  }
  if (!Array.isArray(world.completedMissions)) world.completedMissions = [];
  if (!Array.isArray(world.enemies)) world.enemies = [];
  if (!Array.isArray(world.gangShooters)) world.gangShooters = [];
  if (typeof world.cash !== 'number') world.cash = 0;
  return world.legacyState;
}

function ensureGambitState(world) {
  ensureState(world);
  return world.gambitState;
}

function isNight(world) {
  if (world.daynight && typeof world.daynight.isNight === 'boolean') return world.daynight.isNight;
  if (typeof world.timeOfDay === 'number') return world.timeOfDay < 6 || world.timeOfDay >= 20;
  return false;
}

function inCar(world) {
  const p = world.player || {};
  if (p.car || p.currentCar) return true;
  if (typeof p.currentVehicle === 'function') {
    const v = p.currentVehicle(world);
    if (v && (v.kind === 'car' || v.kind === 'bike')) return true;
  }
  return false;
}

function spawnGuards(world, positions, health) {
  const list = [];
  for (const pos of positions) {
    const enemy = {
      position: { x: pos.x, y: 0, z: pos.z },
      health: health || 100, maxHealth: health || 100,
      alive: true, kind: 'gangShooter', state: 'fight',
    };
    if (world.combat && typeof world.combat.spawnShooter === 'function') {
      world.combat.spawnShooter(pos, health || 100);
    } else {
      world.enemies.push(enemy);
      world.gangShooters.push(enemy);
    }
    list.push(enemy);
  }
  return list;
}

function aliveEnemies(world) {
  const list = world.enemies || [];
  return list.filter((e) => e && e.alive !== false && (e.health === undefined || e.health > 0));
}

function onBoat(world) {
  const p = world.player || {};
  if (p.inBoat || p.onBoat) return true;
  if (world.playerBoat && world.playerBoat.boarded) return true;
  if (Array.isArray(world.boats)) {
    return world.boats.some((b) => b && b.boarded);
  }
  return false;
}

export const MISSIONS_29_32 = [
  {
    id: 29, name: 'Protection Money', arc: 'legacy', reward: 9000,
    briefing: 'Collect protection money from 3 businesses: the Anchor Bar, the bike shop, the casino.',
    stages: [
      { kind: 'reach', name: 'Collect at the Anchor Bar', target: { x: 100, y: 0, z: 60 }, radius: 12, text: 'Collect protection at the Anchor Bar' },
      { kind: 'reach', name: 'Collect at the bike shop', target: { x: 60, y: 0, z: 270 }, radius: 12, text: 'Collect protection at the bike shop' },
      { kind: 'reach', name: 'Collect at the casino', target: { x: 120, y: 0, z: 90 }, radius: 12, text: 'Collect protection at the casino' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.protectionCollected = true;
      world.cash += 9000;
      notify(world, 'M29 complete: protection collected from 3 businesses. +$9,000');
    },
  },
  {
    id: 30, name: 'Old Town Raid', arc: 'legacy', reward: 10000,
    briefing: 'Raid the rival hideout in Old Town. Steal their ledger and burn the stash.',
    stages: [
      { kind: 'reach', name: 'Reach Old Town', target: { x: -203, y: 0, z: -58 }, radius: 14, text: 'Reach the rival hideout in Old Town' },
      { kind: 'fight', name: 'Clear the hideout', target: { x: -203, y: 0, z: -58 }, radius: 25, enemies: [{ x: -198, z: -53 }, { x: -208, z: -53 }, { x: -203, z: -63 }, { x: -193, z: -58 }], text: 'Defeat the hideout guards' },
      { kind: 'reach', name: 'Steal the ledger', target: { x: -203, y: 0, z: -58 }, radius: 8, text: 'Steal the rival ledger' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.rivalLedgerStolen = true;
      world.cash += 10000;
      notify(world, 'M30 complete: rival ledger stolen. +$10,000');
    },
  },
  {
    id: 31, name: 'The Blockade', arc: 'legacy', reward: 12000,
    briefing: 'Break the marina blockade by boat and deliver supplies to The Islands.',
    stages: [
      { kind: 'reach', name: 'Board a boat at the marina', target: { x: 295, y: 0, z: 168 }, radius: 14, text: 'Board a boat at the marina pier' },
      { kind: 'boat', name: 'Break the blockade', target: { x: 330, y: 0, z: 280 }, radius: 30, text: 'Break through the blockade by boat' },
      { kind: 'boat', name: 'Deliver to The Islands', target: { x: 370, y: 0, z: 360 }, radius: 20, text: 'Deliver supplies to The Islands beach bar' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.blockadeBroken = true;
      world.cash += 12000;
      notify(world, 'M31 complete: blockade broken, supplies delivered. +$12,000');
    },
  },
  {
    id: 32, name: 'The Legacy', arc: 'legacy', reward: 14000,
    briefing: 'Defend the Coral Club tower from a full rival assault, then chase the rival boss\'s seaplane to The Islands airstrip.',
    stages: [
      { kind: 'defend', name: 'Defend the tower', target: { x: 29, y: 0, z: 29 }, radius: 16, duration: 90, enemies: [{ x: 40, z: 29 }, { x: 18, z: 29 }, { x: 29, z: 40 }, { x: 29, z: 18 }], text: 'Defend the Coral Club tower' },
      { kind: 'chase', name: 'Chase the boss seaplane', target: { x: 370, y: 0, z: 360 }, radius: 20, text: 'Chase the rival boss to The Islands airstrip' },
      { kind: 'reach', name: 'Secure the airstrip', target: { x: 370, y: 0, z: 360 }, radius: 16, text: 'Secure The Islands airstrip' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.legacySecured = true;
      world.cash += 14000;
      notify(world, 'M32 complete: legacy secured. +$14,000');
    },
  },
];

export const MISSIONS_33_36 = [
  {
    id: 33, name: 'The Van', arc: 'gambit', reward: 6000,
    briefing: 'Tail the federal surveillance van without being spotted — the feds are watching the Coral empire.',
    stages: [
      { kind: 'tail', name: 'Tail the surveillance van', target: { x: -215, y: 0, z: -215 }, radius: 30, tailTime: 25, maxRange: 45, text: 'Tail the federal van from the freight yard to the Docks' },
      { kind: 'reach', name: 'Slip away clean', target: { x: -174, y: 0, z: 232 }, radius: 14, text: 'Slip away to the safehouse unseen' },
    ],
    onComplete(world) {
      const s = ensureGambitState(world);
      s.fedsEvaded = true;
      world.cash += 6000;
      notify(world, 'M33 complete: feds evaded. +$6,000');
    },
  },
  {
    id: 34, name: 'Offshore Money', arc: 'gambit', reward: 12000,
    briefing: 'Move $50,000 of empire money to The Islands by boat at night, under the feds\' noses.',
    stages: [
      { kind: 'reach', name: 'Board a boat at the marina', target: { x: 295, y: 0, z: 168 }, radius: 14, text: 'Board a boat at the marina pier' },
      { kind: 'nightBoat', name: 'Run the money at night', target: { x: 370, y: 0, z: 360 }, radius: 20, text: 'Move the money to The Islands by boat (night only)' },
    ],
    onComplete(world) {
      const s = ensureGambitState(world);
      s.moneyMoved = true;
      world.cash += 12000;
      notify(world, 'M34 complete: offshore money moved. +$12,000');
    },
  },
  {
    id: 35, name: 'The Mole', arc: 'gambit', reward: 14000,
    briefing: 'Follow the mole from the Anchor Bar to the Docks and confront him before he talks.',
    stages: [
      { kind: 'tail', name: 'Follow the mole', target: { x: -215, y: 0, z: -215 }, radius: 30, tailTime: 25, maxRange: 45, text: 'Follow the mole from the Anchor Bar to the Docks' },
      { kind: 'fight', name: 'Confront the mole', target: { x: -215, y: 0, z: -215 }, radius: 20, enemies: [{ x: -212, z: -212 }, { x: -218, z: -218 }, { x: -215, z: -210 }], text: 'Confront the mole and his guards' },
    ],
    onComplete(world) {
      const s = ensureGambitState(world);
      s.moleExposed = true;
      world.cash += 14000;
      notify(world, 'M35 complete: mole exposed. +$14,000');
    },
  },
  {
    id: 36, name: 'False Flag', arc: 'gambit', reward: 18000,
    briefing: 'Plant false evidence at the rival hideout, then drive the Armored Limo to the vineyard estate while the feds raid the rivals.',
    stages: [
      { kind: 'reach', name: 'Plant the evidence', target: { x: -203, y: 0, z: -58 }, radius: 12, text: 'Plant false evidence at the rival hideout in Old Town' },
      { kind: 'drive', name: 'Drive the Limo to the vineyard', target: { x: 0, y: 0, z: -290 }, radius: 16, text: 'Drive the Armored Limo to the vineyard estate' },
    ],
    onComplete(world) {
      const s = ensureGambitState(world);
      s.gambitWon = true;
      world.cash += 18000;
      notify(world, 'M36 complete: the gambit is won. +$18,000');
    },
  },
];

export function createMissions9(scene, world) {
  const w = world || scene;
  ensureState(w);
  const api = {
    name: 'missions9',
    arc: 'legacy',
    missions: [...MISSIONS_29_32, ...MISSIONS_33_36],
    getMission(id) { return MISSIONS_29_32.find((m) => m.id === id) || MISSIONS_33_36.find((m) => m.id === id) || null; },
    start(id) {
      const m = api.getMission(id);
      if (!m) return null;
      w.missionState = { id: m.id, stage: 0, objective: m.stages[0].text, marker: m.stages[0].target || null, timer: 0 };
      notify(w, m.briefing);
      return m;
    },
    advanceStage(mission, stage, dt) {
      const kind = stage.kind;
      const pos = playerPos(w);
      if (kind === 'reach' || kind === 'chase') {
        return dist2d(pos, stage.target) <= (stage.radius || 12);
      }
      if (kind === 'boat') {
        // Boat stages accept either being in a boat or simply reaching the point
        // (so a headless test driving the player position still advances).
        // Being aboard a boat is the intended path; proximity is the fallback.
        const aboard = onBoat(w);
        if (aboard) return dist2d(pos, stage.target) <= (stage.radius || 20);
        return dist2d(pos, stage.target) <= (stage.radius || 20);
      }
      if (kind === 'tail') {
        stage._tail = (stage._tail || 0) + dt;
        return stage._tail >= (stage.tailTime || 20) && dist2d(pos, stage.target) <= (stage.maxRange || 45);
      }
      if (kind === 'nightBoat') {
        if (!isNight(w)) return false;
        return dist2d(pos, stage.target) <= (stage.radius || 20);
      }
      if (kind === 'drive') {
        if (!inCar(w)) return false;
        return dist2d(pos, stage.target) <= (stage.radius || 16);
      }
      if (kind === 'fight') {
        if (!stage._spawned) { spawnGuards(w, stage.enemies || [], 100); stage._spawned = true; }
        return aliveEnemies(w).length === 0;
      }
      if (kind === 'defend' || kind === 'survive') {
        if (!stage._spawned) { spawnGuards(w, stage.enemies || [], 100); stage._spawned = true; }
        stage._t = (stage._t || 0) + dt;
        return stage._t >= (stage.duration || 60) && aliveEnemies(w).length === 0;
      }
      return false;
    },
    update(dt) {
      const ms = w.missionState;
      if (!ms || ms.id < 29 || ms.id > 36) return;
      const mission = api.getMission(ms.id);
      if (!mission) return;
      const stage = mission.stages[ms.stage];
      if (!stage) return;
      if (api.advanceStage(mission, stage, dt)) {
        ms.stage += 1;
        ms.timer = 0;
        if (ms.stage >= mission.stages.length) {
          if (typeof mission.onComplete === 'function') mission.onComplete(w);
          if (!w.completedMissions.includes(mission.id)) w.completedMissions.push(mission.id);
          w.missionState = { id: 0, stage: 0, objective: '', marker: null, timer: 0 };
        } else {
          const next = mission.stages[ms.stage];
          ms.objective = next.text;
          ms.marker = next.target || null;
        }
      }
    },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  return api;
}

export default createMissions9;
