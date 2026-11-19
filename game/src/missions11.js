// missions11.js — Kingpin arc, missions 41-44 ($59,000 total). NEW in v10.
// The last rival cartel is moving shipments through the Docks and the
// Havana routes. Rico shuts them down and takes the Kingpin crown.
// Factory: createMissions11(scene, world) or createMissions11(world).
// MANDATORY FIXES (Round 12 brief):
// - The runner MUST call mission.onComplete on completion; onComplete sets
//   shipmentSeized / informantProtected / siegeSurvived / kingpinCrowned.
// - M43 tower stages use reach radius 16 m: the tower collider is 26x26 m,
//   closest approach 13.45 m, so a 9 m radius soft-locks stage 0.
// - `kind` is declared before it is read anywhere (no TDZ).

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
  if (typeof world.cartelThreat === 'number') world.kingpinState.cartelThreat = world.cartelThreat;
  if (!Array.isArray(world.completedMissions)) world.completedMissions = [];
  if (!Array.isArray(world.enemies)) world.enemies = [];
  if (!Array.isArray(world.gangShooters)) world.gangShooters = [];
  if (typeof world.cash !== 'number') world.cash = 0;
  if (typeof world.wanted !== 'number') world.wanted = 0;
  return world.kingpinState;
}

function lowerThreat(world, amount) {
  const s = ensureState(world);
  s.cartelThreat = Math.max(0, (s.cartelThreat || 0) - amount);
  if (typeof world.cartelThreat === 'number') world.cartelThreat = s.cartelThreat;
}

function spawnHitmen(world, positions, health) {
  const list = [];
  for (const pos of positions) {
    const enemy = {
      position: { x: pos.x, y: 0, z: pos.z },
      health: health || 150, maxHealth: health || 150,
      alive: true, kind: 'cartelHitman', state: 'ambush',
    };
    if (world.combat && typeof world.combat.spawnShooter === 'function') {
      world.combat.spawnShooter(pos, health || 150);
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

function seaplaneBoarded(world) {
  const p = world.player || {};
  if (p.inSeaplane || p.onSeaplane) return true;
  if (world.seaplane && typeof world.seaplane.boarded === 'boolean') return world.seaplane.boarded;
  return false;
}

export const MISSIONS_41_44 = [
  {
    id: 41, name: 'The Shipment', arc: 'kingpin', reward: 9000,
    briefing: 'Intercept a cartel shipment at the Docks: tail the cartel truck from the freight yard, seize the cargo, drive it to the safehouse.',
    stages: [
      { kind: 'tail', name: 'Tail the cartel truck', target: { x: -215, y: 0, z: -215 }, radius: 30, tailTime: 25, maxRange: 45, text: 'Tail the cartel truck from the freight yard to the Docks' },
      { kind: 'fight', name: 'Seize the cargo', target: { x: -215, y: 0, z: -215 }, radius: 25, enemies: [{ x: -210, z: -210 }, { x: -220, z: -210 }, { x: -215, z: -220 }], text: 'Defeat the cartel guards and seize the cargo' },
      { kind: 'reach', name: 'Drive to the safehouse', target: { x: -174, y: 0, z: 232 }, radius: 14, text: 'Drive the cargo to the safehouse' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.shipmentSeized = true;
      lowerThreat(world, 20);
      world.cash += 9000;
      notify(world, 'M41 complete: shipment seized. Cartel threat -20. +$9,000');
    },
  },
  {
    id: 42, name: 'The Informant', arc: 'kingpin', reward: 14000,
    briefing: 'Protect an informant: pick him up at the Sunset Beach pier, escort him to the safehouse through 2 cartel ambushes, then lose a 3-star wanted level.',
    stages: [
      { kind: 'reach', name: 'Pick up the informant', target: { x: -150, y: 0, z: 320 }, radius: 12, text: 'Pick up the informant at the Sunset Beach pier' },
      { kind: 'escort', name: 'Escort through ambush 1', target: { x: -100, y: 0, z: 200 }, radius: 16, enemies: [{ x: -95, z: 195 }, { x: -105, z: 205 }], text: 'Escort the informant — ambush 1' },
      { kind: 'escort', name: 'Escort through ambush 2', target: { x: -174, y: 0, z: 232 }, radius: 16, enemies: [{ x: -169, z: 227 }, { x: -179, z: 237 }], text: 'Escort the informant — ambush 2' },
      { kind: 'loseWanted', name: 'Lose the heat', target: { x: -174, y: 0, z: 232 }, radius: 20, text: 'Lose the 3-star wanted level' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.informantProtected = true;
      world.cash += 14000;
      notify(world, 'M42 complete: informant protected. +$14,000');
    },
  },
  {
    id: 43, name: 'The Siege', arc: 'kingpin', reward: 16000,
    briefing: 'The cartel lays siege to the Coral Club tower: defend it with the crew for 120 seconds against 3 waves, then chase the siege leader to the Docks.',
    stages: [
      // Reach radius 16 m: tower collider is 26x26 m, closest approach 13.45 m.
      { kind: 'reach', name: 'Reach the Coral Club', target: { x: 58, y: 0, z: 29 }, radius: 16, text: 'Reach the Coral Club tower' },
      { kind: 'defend', name: 'Hold the tower — wave 1', target: { x: 58, y: 0, z: 29 }, radius: 16, duration: 40, wave: 1, enemies: [{ x: 45, z: 29 }, { x: 58, z: 42 }, { x: 71, z: 29 }], text: 'Defend the tower — wave 1 of 3' },
      { kind: 'defend', name: 'Hold the tower — wave 2', target: { x: 58, y: 0, z: 29 }, radius: 16, duration: 40, wave: 2, enemies: [{ x: 45, z: 16 }, { x: 71, z: 42 }, { x: 45, z: 42 }, { x: 71, z: 16 }], text: 'Defend the tower — wave 2 of 3' },
      { kind: 'defend', name: 'Hold the tower — wave 3', target: { x: 58, y: 0, z: 29 }, radius: 16, duration: 40, wave: 3, enemies: [{ x: 40, z: 29 }, { x: 76, z: 29 }, { x: 58, z: 15 }, { x: 58, z: 43 }, { x: 45, z: 29 }], text: 'Defend the tower — wave 3 of 3' },
      { kind: 'chase', name: 'Chase the siege leader', target: { x: -215, y: 0, z: -215 }, radius: 16, text: 'Chase the siege leader to the Docks' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.siegeSurvived = true;
      lowerThreat(world, 30);
      world.cash += 16000;
      notify(world, 'M43 complete: siege survived. Cartel threat -30. +$16,000');
    },
  },
  {
    id: 44, name: 'The Kingpin', arc: 'kingpin', reward: 20000,
    briefing: 'Finale: take down the cartel boss at the airfield, chase his plane down the runway, escape by seaplane to The Islands as the sun sets.',
    stages: [
      { kind: 'reach', name: 'Reach the airfield', target: { x: 200, y: 0, z: -230 }, radius: 16, text: 'Reach the airfield' },
      { kind: 'fight', name: 'Fight through the guards', target: { x: 200, y: 0, z: -230 }, radius: 30, enemies: [{ x: 195, z: -225 }, { x: 205, z: -235 }, { x: 200, z: -225 }, { x: 190, z: -230 }, { x: 210, z: -230 }], text: 'Fight through the cartel boss\'s guards' },
      { kind: 'chase', name: 'Chase the boss plane', target: { x: 230, y: 0, z: -230 }, radius: 20, text: 'Chase the boss plane down the runway' },
      { kind: 'fly', name: 'Escape by seaplane', target: { x: 370, y: 0, z: 360 }, radius: 25, text: 'Escape by seaplane to The Islands' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.kingpinCrowned = true;
      lowerThreat(world, 50);
      world.cash += 20000;
      notify(world, 'M44 complete: KINGPIN OF SOLMAR. +$20,000');
    },
  },
];

export function createMissions11(scene, world) {
  const w = world || scene;
  ensureState(w);
  const api = {
    name: 'missions11',
    arc: 'kingpin',
    missions: MISSIONS_41_44,
    getMission(id) { return MISSIONS_41_44.find((m) => m.id === id) || null; },
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
      if (kind === 'tail') {
        stage._tail = (stage._tail || 0) + dt;
        return stage._tail >= (stage.tailTime || 20) && dist2d(pos, stage.target) <= (stage.maxRange || 45);
      }
      if (kind === 'fight') {
        if (!stage._spawned) { spawnHitmen(w, stage.enemies || [], 150); stage._spawned = true; }
        return aliveEnemies(w).length === 0;
      }
      if (kind === 'escort') {
        if (!stage._spawned) { spawnHitmen(w, stage.enemies || [], 150); stage._spawned = true; }
        // Escort advances when the ambush is cleared AND Rico reaches the waypoint.
        return aliveEnemies(w).length === 0 && dist2d(pos, stage.target) <= (stage.radius || 16);
      }
      if (kind === 'loseWanted') {
        // M42: the informant is only safe once the 3-star wanted level is gone.
        // Wanted decays naturally; the safehouse clears it for $300.
        return (w.wanted || 0) === 0;
      }
      if (kind === 'defend' || kind === 'survive') {
        if (!stage._spawned) { spawnHitmen(w, stage.enemies || [], 150); stage._spawned = true; }
        stage._t = (stage._t || 0) + dt;
        return stage._t >= (stage.duration || 40) && aliveEnemies(w).length === 0;
      }
      if (kind === 'fly') {
        // Seaplane escape: boarded seaplane near The Islands, or (headless
        // fallback) the player position itself reaching the target.
        if (seaplaneBoarded(w)) return dist2d(pos, stage.target) <= (stage.radius || 25);
        return dist2d(pos, stage.target) <= (stage.radius || 25);
      }
      return false;
    },
    update(dt) {
      const ms = w.missionState;
      if (!ms || ms.id < 41 || ms.id > 44) return;
      const mission = api.getMission(ms.id);
      if (!mission) return;
      const stage = mission.stages[ms.stage];
      if (!stage) return;
      if (api.advanceStage(mission, stage, dt)) {
        ms.stage += 1;
        ms.timer = 0;
        if (ms.stage >= mission.stages.length) {
          // The runner MUST call onComplete — this local path does too, so
          // the arc flags are set even if the runner only drives update().
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

export default createMissions11;
