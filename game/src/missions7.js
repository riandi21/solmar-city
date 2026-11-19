// missions7.js — Dourado Revenge arc, missions 21-24 ($35,000 total).
// Rico hunts the Dourado family that betrayed the Coral empire.
// Factory: createMissions7(scene, world) or createMissions7(world).
// Every stage declares `kind` FIRST and never reads a const before it.
// The mission runner calls mission.onComplete when a mission finishes;
// onComplete sets the revenge arc flags and pays the reward.

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
  if (!world.revengeState) {
    world.revengeState = {
      courierTailed: false, warehouseRaided: false,
      convoyAmbushed: false, donDefeated: false,
    };
  }
  if (!Array.isArray(world.completedMissions)) world.completedMissions = [];
  if (!Array.isArray(world.enemies)) world.enemies = [];
  if (!Array.isArray(world.gangShooters)) world.gangShooters = [];
  if (typeof world.cash !== 'number') world.cash = 0;
  return world.revengeState;
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

export const MISSIONS_21_24 = [
  {
    id: 21, name: 'The Courier', arc: 'revenge', reward: 6000,
    briefing: 'Tail the Dourado courier from the freight yard to the Docks. Stay close, stay unseen.',
    stages: [
      { kind: 'tail', name: 'Tail the courier', target: { x: -215, y: 0, z: -215 }, radius: 30, tailTime: 25, maxRange: 45, text: 'Tail the courier to the Docks warehouse' },
      { kind: 'reach', name: 'Reach the warehouse', target: { x: -215, y: 0, z: -215 }, radius: 12, text: 'Reach the Docks warehouse' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.courierTailed = true;
      world.cash += 6000;
      notify(world, 'M21 complete: courier tailed. +$6,000');
    },
  },
  {
    id: 22, name: 'Warehouse Raid', arc: 'revenge', reward: 8000,
    briefing: 'Raid the Dourado warehouse at the Docks. Clear the guards, grab the ledger.',
    stages: [
      { kind: 'reach', name: 'Reach the warehouse', target: { x: -215, y: 0, z: -215 }, radius: 14, text: 'Reach the Dourado warehouse' },
      { kind: 'fight', name: 'Clear the guards', target: { x: -215, y: 0, z: -215 }, radius: 25, enemies: [{ x: -210, z: -210 }, { x: -220, z: -210 }, { x: -215, z: -220 }, { x: -205, z: -215 }], text: 'Defeat the warehouse guards' },
      { kind: 'reach', name: 'Grab the ledger', target: { x: -215, y: 0, z: -215 }, radius: 8, text: 'Grab the Dourado ledger' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.warehouseRaided = true;
      world.cash += 8000;
      notify(world, 'M22 complete: warehouse raided, ledger stolen. +$8,000');
    },
  },
  {
    id: 23, name: 'Convoy Ambush', arc: 'revenge', reward: 9000,
    briefing: 'Ambush the Dourado convoy on the north road. Stop the trucks, take the cash.',
    stages: [
      { kind: 'chase', name: 'Chase the convoy', target: { x: 0, y: 0, z: -232 }, radius: 18, text: 'Catch the convoy on the north road' },
      { kind: 'fight', name: 'Stop the convoy', target: { x: 0, y: 0, z: -232 }, radius: 25, enemies: [{ x: -5, z: -228 }, { x: 5, z: -236 }, { x: 0, z: -224 }], text: 'Defeat the convoy guards' },
      { kind: 'reach', name: 'Take the cash', target: { x: 0, y: 0, z: -232 }, radius: 10, text: 'Collect the convoy cash' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.convoyAmbushed = true;
      world.cash += 9000;
      notify(world, 'M23 complete: convoy ambushed. +$9,000');
    },
  },
  {
    id: 24, name: "The Don's Penthouse", arc: 'revenge', reward: 12000,
    briefing: 'Storm the Dourado Don\'s penthouse at the Coral Club. End the family.',
    stages: [
      { kind: 'reach', name: 'Reach the Coral Club', target: { x: 58, y: 0, z: 29 }, radius: 16, text: 'Reach the Coral Club tower' },
      { kind: 'fight', name: 'Storm the penthouse', target: { x: 29, y: 0, z: 29 }, radius: 25, enemies: [{ x: 24, z: 24 }, { x: 34, z: 24 }, { x: 24, z: 34 }, { x: 34, z: 34 }, { x: 29, z: 29 }], text: 'Defeat the Don\'s guards' },
      { kind: 'reach', name: 'Confront the Don', target: { x: 29, y: 0, z: 29 }, radius: 16, text: 'Confront the Dourado Don' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.donDefeated = true;
      world.cash += 12000;
      notify(world, 'M24 complete: Dourado Don defeated. Revenge done. +$12,000');
    },
  },
];

export function createMissions7(scene, world) {
  const w = world || scene;
  ensureState(w);
  const api = {
    name: 'missions7',
    arc: 'revenge',
    missions: MISSIONS_21_24,
    getMission(id) { return MISSIONS_21_24.find((m) => m.id === id) || null; },
    start(id) {
      const m = api.getMission(id);
      if (!m) return null;
      w.missionState = { id: m.id, stage: 0, objective: m.stages[0].text, marker: m.stages[0].target || null, timer: 0 };
      notify(w, m.briefing);
      return m;
    },
    // Advance one stage for the active mission; returns true when a stage advanced.
    advanceStage(mission, stage, dt) {
      const kind = stage.kind;
      const pos = playerPos(w);
      if (kind === 'reach' || kind === 'chase') {
        return dist2d(pos, stage.target) <= (stage.radius || 12);
      }
      if (kind === 'tail') {
        stage._tail = (stage._tail || 0) + dt;
        // Tail fails back to the start if Rico falls too far behind.
        if (dist2d(pos, stage.target) > (stage.maxRange || 45) * 1.5) stage._tail = 0;
        return stage._tail >= (stage.tailTime || 20) && dist2d(pos, stage.target) <= (stage.maxRange || 45);
      }
      if (kind === 'fight') {
        if (!stage._spawned) { spawnGuards(w, stage.enemies || [], 100); stage._spawned = true; }
        return aliveEnemies(w).length === 0;
      }
      if (kind === 'defend' || kind === 'survive') {
        stage._t = (stage._t || 0) + dt;
        return stage._t >= (stage.duration || 60);
      }
      return false;
    },
    update(dt) {
      const ms = w.missionState;
      if (!ms || ms.id < 21 || ms.id > 24) return;
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

export default createMissions7;
