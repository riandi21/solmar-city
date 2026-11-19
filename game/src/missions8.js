// missions8.js — Coral Crown arc, missions 25-28 ($40,000 total).
// Rico takes the crown: informant, vault, betrayal, mansion rooftop.
// Factory: createMissions8(scene, world) or createMissions8(world).
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
  if (!world.crownState) {
    world.crownState = {
      informantMet: false, vaultCracked: false,
      betrayalSurvived: false, donDefeated: false,
    };
  }
  if (!Array.isArray(world.completedMissions)) world.completedMissions = [];
  if (!Array.isArray(world.enemies)) world.enemies = [];
  if (!Array.isArray(world.gangShooters)) world.gangShooters = [];
  if (typeof world.cash !== 'number') world.cash = 0;
  return world.crownState;
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

export const MISSIONS_25_28 = [
  {
    id: 25, name: 'The Informant', arc: 'crown', reward: 8000,
    briefing: 'Meet the informant at the Anchor Bar, then tail his contact to the North Hills mansion.',
    stages: [
      { kind: 'reach', name: 'Meet the informant', target: { x: 100, y: 0, z: 60 }, radius: 12, text: 'Meet the informant at the Anchor Bar' },
      { kind: 'tail', name: 'Tail the contact', target: { x: 0, y: 0, z: -220 }, radius: 30, tailTime: 25, maxRange: 45, text: 'Tail the contact to the North Hills mansion' },
      { kind: 'reach', name: 'Reach the mansion', target: { x: 0, y: 0, z: -220 }, radius: 14, text: 'Reach the North Hills mansion' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.informantMet = true;
      world.cash += 8000;
      notify(world, 'M25 complete: informant met, mansion found. +$8,000');
    },
  },
  {
    id: 26, name: 'The Vault', arc: 'crown', reward: 10000,
    briefing: 'Break into the Coral Club vault with the crew. Crack it, grab the crown jewels.',
    stages: [
      { kind: 'reach', name: 'Reach the Coral Club', target: { x: 58, y: 0, z: 29 }, radius: 16, text: 'Reach the Coral Club tower' },
      { kind: 'fight', name: 'Clear the vault guards', target: { x: 29, y: 0, z: 29 }, radius: 25, enemies: [{ x: 24, z: 24 }, { x: 34, z: 24 }, { x: 29, z: 34 }], text: 'Defeat the vault guards' },
      { kind: 'reach', name: 'Crack the vault', target: { x: 29, y: 0, z: 29 }, radius: 16, text: 'Crack the Coral Club vault' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.vaultCracked = true;
      world.cash += 10000;
      notify(world, 'M26 complete: vault cracked. +$10,000');
    },
  },
  {
    id: 27, name: 'The Betrayal', arc: 'crown', reward: 10000,
    briefing: 'Survive the betrayal ambush at the freight yard, then chase the traitor to the Docks.',
    stages: [
      { kind: 'survive', name: 'Survive the ambush', target: { x: -170, y: 0, z: -260 }, radius: 30, duration: 45, enemies: [{ x: -165, z: -255 }, { x: -175, z: -255 }, { x: -170, z: -250 }], text: 'Survive the freight yard ambush' },
      { kind: 'chase', name: 'Chase the traitor', target: { x: -215, y: 0, z: -215 }, radius: 16, text: 'Chase the traitor to the Docks' },
      { kind: 'fight', name: 'Deal with the traitor', target: { x: -215, y: 0, z: -215 }, radius: 20, enemies: [{ x: -212, z: -212 }, { x: -218, z: -218 }], text: 'Defeat the traitor and his guards' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.betrayalSurvived = true;
      world.cash += 10000;
      notify(world, 'M27 complete: betrayal survived, traitor dealt with. +$10,000');
    },
  },
  {
    id: 28, name: 'The Crown', arc: 'crown', reward: 12000,
    briefing: 'Storm the North Hills mansion, take the crown from the rooftop, escape by helicopter.',
    stages: [
      { kind: 'reach', name: 'Reach the mansion', target: { x: 0, y: 0, z: -220 }, radius: 14, text: 'Storm the North Hills mansion' },
      { kind: 'fight', name: 'Clear the rooftop', target: { x: 0, y: 0, z: -220 }, radius: 25, enemies: [{ x: -5, z: -215 }, { x: 5, z: -225 }, { x: 0, z: -218 }, { x: -8, z: -222 }], text: 'Defeat the rooftop guards' },
      { kind: 'reach', name: 'Take the crown', target: { x: 0, y: 0, z: -220 }, radius: 12, text: 'Take the crown from the rooftop' },
      { kind: 'fly', name: 'Escape by helicopter', target: { x: 29, y: 0, z: 29 }, radius: 20, text: 'Escape by helicopter to the Coral Club helipad' },
    ],
    onComplete(world) {
      const s = ensureState(world);
      s.donDefeated = true;
      world.cash += 12000;
      notify(world, 'M28 complete: the crown is yours. +$12,000');
    },
  },
];

export function createMissions8(scene, world) {
  const w = world || scene;
  ensureState(w);
  const api = {
    name: 'missions8',
    arc: 'crown',
    missions: MISSIONS_25_28,
    getMission(id) { return MISSIONS_25_28.find((m) => m.id === id) || null; },
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
      if (kind === 'tail') {
        stage._tail = (stage._tail || 0) + dt;
        return stage._tail >= (stage.tailTime || 20) && dist2d(pos, stage.target) <= (stage.maxRange || 45);
      }
      if (kind === 'fight') {
        if (!stage._spawned) { spawnGuards(w, stage.enemies || [], 100); stage._spawned = true; }
        return aliveEnemies(w).length === 0;
      }
      if (kind === 'survive') {
        if (!stage._spawned) { spawnGuards(w, stage.enemies || [], 100); stage._spawned = true; }
        stage._t = (stage._t || 0) + dt;
        // Survive: the timer alone clears the stage once the ambush is beaten back.
        return stage._t >= (stage.duration || 45) && aliveEnemies(w).length === 0;
      }
      if (kind === 'defend') {
        stage._t = (stage._t || 0) + dt;
        return stage._t >= (stage.duration || 60);
      }
      if (kind === 'fly') {
        // Fly stage: needs the player helicopter boarded AND near the target.
        if (!heliBoarded(w)) return false;
        return dist2d(pos, stage.target) <= (stage.radius || 20);
      }
      return false;
    },
    update(dt) {
      const ms = w.missionState;
      if (!ms || ms.id < 25 || ms.id > 28) return;
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

export default createMissions8;
