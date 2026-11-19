// missions10.js — Vice King arc, missions 37-40 ($55,000 total).
// NOTE: missions 33-36 (Don's Gambit) live in missions9 (W7, donsgambit
// step); this file covers 37-40 only, per the Round 11 brief's file ownership.
// Rico rigs the rival casino, wins the high-roller table, runs the
// Havana smuggle, and claims the Vice King crown at Club Neon.
// Factory: createMissions10(scene, world) or createMissions10(world).
// Every stage declares `kind` FIRST; the runner calls onComplete on finish.
// M39: `kind` is declared before it is read — no TDZ anywhere.

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
  if (!world.viceState) {
    world.viceState = {
      casinoRigged: false, highRollerWon: false,
      havanaRunDone: false, viceKingCrowned: false,
      casinoWinnings: 0, leaguePoints: 0, leagueWins: 0, nightclubIncome: 0,
    };
  }
  if (!Array.isArray(world.completedMissions)) world.completedMissions = [];
  if (!Array.isArray(world.enemies)) world.enemies = [];
  if (!Array.isArray(world.gangShooters)) world.gangShooters = [];
  if (typeof world.cash !== 'number') world.cash = 0;
  if (typeof world.wanted !== 'number') world.wanted = 0;
  return world.viceState;
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

function heliBoarded(world) {
  const h = world.playerHeli || world.heli;
  if (!h) return false;
  if (typeof h.boarded === 'boolean') return h.boarded;
  if (world.player && world.player.inHeli) return true;
  return false;
}

function isNight(world) {
  if (world.daynight && typeof world.daynight.isNight === 'boolean') return world.daynight.isNight;
  if (typeof world.timeOfDay === 'number') return world.timeOfDay < 6 || world.timeOfDay >= 20;
  if (typeof world.hour === 'number') return world.hour < 6 || world.hour >= 20;
  return false;
}

export const MISSIONS_37_40 = [
  {
    id: 37, name: 'Rigged Wheel', arc: 'vice', reward: 8000,
    briefing: 'Rig the rival casino\'s roulette table. Keep wanted at 2 stars or below.',
    stages: [
      { kind: 'reach', name: 'Enter the casino', target: { x: 120, y: 0, z: 90 }, radius: 14, text: 'Enter the rival casino' },
      { kind: 'maxWanted', name: 'Rig the roulette', target: { x: 120, y: 0, z: 90 }, radius: 10, duration: 20, maxWanted: 2, text: 'Rig the roulette table (stay under 3 stars)' },
      { kind: 'reach', name: 'Slip out', target: { x: 100, y: 0, z: 60 }, radius: 12, text: 'Slip out to the Anchor Bar' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.casinoRigged = true;
      world.cash += 8000;
      notify(world, 'M37 complete: roulette rigged. +$8,000');
    },
  },
  {
    id: 38, name: 'High Roller', arc: 'vice', reward: 13000,
    briefing: 'Win $20,000 at the high-roller table, then escape a rival ambush in the player helicopter.',
    stages: [
      { kind: 'reach', name: 'Reach the high-roller table', target: { x: 120, y: 0, z: 90 }, radius: 12, text: 'Reach the high-roller table' },
      { kind: 'casino', name: 'Win $20,000', target: { x: 120, y: 0, z: 90 }, radius: 12, winTarget: 20000, text: 'Win $20,000 at the high-roller table' },
      { kind: 'fly', name: 'Escape by helicopter', target: { x: 29, y: 0, z: 29 }, radius: 20, text: 'Escape the ambush by helicopter to the Coral Club' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.highRollerWon = true;
      world.cash += 13000;
      notify(world, 'M38 complete: high-roller won, ambush escaped. +$13,000');
    },
  },
  {
    id: 39, name: 'Havana Run', arc: 'vice', reward: 15000,
    briefing: 'Smuggle goods from Little Havana to The Islands by boat at night.',
    stages: [
      { kind: 'reach', name: 'Pick up the goods', target: { x: -215, y: 0, z: 130 }, radius: 12, text: 'Pick up the goods in Little Havana' },
      { kind: 'nightBoat', name: 'Smuggle by boat at night', target: { x: 370, y: 0, z: 360 }, radius: 20, text: 'Smuggle the goods to The Islands by boat (night only)' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.havanaRunDone = true;
      world.cash += 15000;
      notify(world, 'M39 complete: Havana run done. +$15,000');
    },
  },
  {
    id: 40, name: 'Vice King', arc: 'vice', reward: 19000,
    briefing: 'Defend Club Neon from a rival assault, then fly the helicopter to the Coral Club rooftop and claim the Vice King crown.',
    stages: [
      { kind: 'defend', name: 'Defend Club Neon', target: { x: 120, y: 0, z: 90 }, radius: 16, duration: 60, enemies: [{ x: 115, z: 85 }, { x: 125, z: 85 }, { x: 120, z: 95 }, { x: 110, z: 90 }], text: 'Defend Club Neon from the rival assault' },
      { kind: 'fly', name: 'Fly to the Coral Club', target: { x: 29, y: 0, z: 29 }, radius: 20, text: 'Fly the helicopter to the Coral Club rooftop' },
      { kind: 'reach', name: 'Claim the crown', target: { x: 29, y: 0, z: 29 }, radius: 16, text: 'Claim the Vice King crown' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.viceKingCrowned = true;
      world.cash += 19000;
      notify(world, 'M40 complete: Vice King crowned. +$19,000');
    },
  },
];

export function createMissions10(scene, world) {
  const w = world || scene;
  ensureState(w);
  const api = {
    name: 'missions10',
    arc: 'vice',
    missions: MISSIONS_37_40,
    getMission(id) { return MISSIONS_37_40.find((m) => m.id === id) || null; },
    start(id) {
      const m = api.getMission(id);
      if (!m) return null;
      w.missionState = { id: m.id, stage: 0, objective: m.stages[0].text, marker: m.stages[0].target || null, timer: 0 };
      notify(w, m.briefing);
      return m;
    },
    advanceStage(mission, stage, dt) {
      // `kind` is declared BEFORE any read of it (no TDZ).
      const kind = stage.kind;
      const pos = playerPos(w);
      if (kind === 'reach' || kind === 'chase') {
        return dist2d(pos, stage.target) <= (stage.radius || 12);
      }
      if (kind === 'maxWanted') {
        // Fail-safe: if wanted exceeds the cap, the stage stalls (runner/HUD warns).
        // The timer only ticks while Rico stays under the cap, so a spike
        // does not silently bank progress.
        if ((w.wanted || 0) > (stage.maxWanted || 2)) { stage._t = Math.max(0, (stage._t || 0) - dt); return false; }
        stage._t = (stage._t || 0) + dt;
        return stage._t >= (stage.duration || 20);
      }
      if (kind === 'casino') {
        const s = ensureState(w);
        return (s.casinoWinnings || 0) >= (stage.winTarget || 20000);
      }
      if (kind === 'nightBoat') {
        if (!isNight(w)) return false;
        return dist2d(pos, stage.target) <= (stage.radius || 20);
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
      if (kind === 'fly') {
        if (!heliBoarded(w)) return false;
        return dist2d(pos, stage.target) <= (stage.radius || 20);
      }
      return false;
    },
    update(dt) {
      const ms = w.missionState;
      if (!ms || ms.id < 37 || ms.id > 40) return;
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

export default createMissions10;
