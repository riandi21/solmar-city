// missions.js — M1-M4 (opening arc) + the shared mission runner.
// Factory: createMissions(world) registers M1-M4.
// Runner: createMissionRunner(world) returns { update(dt), startMission(id) }.
// The runner advances stages, drives world.mission, pays out, and MUST call
// mission.onComplete so arc flags land.

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function playerPos(world) {
  const p = world.player && world.player.position;
  return p ? { x: p.x || 0, z: p.z || 0 } : { x: 0, z: 0 };
}

function logEvent(world, text) {
  if (Array.isArray(world.events)) world.events.push(text);
}

function payOut(world, amount) {
  if (world.player && typeof world.player.cash === 'number') world.player.cash += amount;
  if (typeof world.cash === 'number') world.cash += amount;
}

function spawnStageEnemies(world, stage) {
  const combat = world.systemObjects && world.systemObjects.combat;
  const list = Array.isArray(stage.enemies) ? stage.enemies : [];
  stage._spawned = true;
  stage._alive = [];
  for (const spec of list) {
    const pos = { x: spec.x || 0, z: spec.z || 0 };
    let enemy = null;
    if (combat && typeof combat.spawnShooter === 'function') {
      enemy = combat.spawnShooter(pos.x, pos.z, spec);
    }
    if (!enemy) {
      enemy = { position: { x: pos.x, z: pos.z }, health: spec.health || 100, kind: 'shooter' };
      if (Array.isArray(world.enemies)) world.enemies.push(enemy);
      if (Array.isArray(world.gangShooters)) world.gangShooters.push(enemy);
    }
    stage._alive.push(enemy);
  }
}

function stageEnemiesRemaining(world, stage) {
  if (!stage._spawned) return -1; // not populated yet: never auto-advance
  if (!Array.isArray(stage._alive) || stage._alive.length === 0) return -1;
  // Genuine emptiness = every spawned enemy is dead or gone from the world.
  // Judge by the spawned objects themselves: a shooter the combat system
  // spawned counts as alive until its health hits 0, even if it was never
  // pushed into a world list.
  return stage._alive.filter((e) => {
    if (!e) return false;
    if (typeof e.health === 'number') return e.health > 0;
    return true;
  }).length;
}

function setWorldMission(world, mission, stageIndex) {
  const stage = mission.stages[stageIndex];
  world.mission = {
    id: mission.id,
    stage: stageIndex,
    objective: stage.objective,
    marker: stage.marker ? { x: stage.marker.x, z: stage.marker.z } : null,
    timer: typeof stage.timer === 'number' ? stage.timer : null,
  };
}

function boardedInHeli(world) {
  if (world.playerHeli && world.playerHeli.boarded) return true;
  const p = world.player || {};
  if (typeof p.currentVehicle === 'function') {
    try { return p.currentVehicle() === 'heli'; } catch { return false; }
  }
  return !!p.currentHeli;
}

export function createMissionRunner(world) {
  world.missionRegistry = world.missionRegistry || {};
  world.completedMissions = world.completedMissions || [];

  let active = null; // { mission, stageIndex }

  function failMission(reason) {
    if (!active) return;
    logEvent(world, `Mission failed: ${active.mission.name} — ${reason}`);
    active = null;
    world.mission = { id: null, stage: 0, objective: '', marker: null, timer: null };
  }

  function completeMission() {
    const mission = active.mission;
    payOut(world, mission.payout);
    if (!world.completedMissions.includes(mission.id)) world.completedMissions.push(mission.id);
    logEvent(world, `Mission complete: ${mission.name} (+$${mission.payout})`);
    active = null;
    world.mission = { id: null, stage: 0, objective: '', marker: null, timer: null };
    if (typeof mission.onComplete === 'function') mission.onComplete(world);
  }

  function enterStage(mission, stageIndex) {
    const stage = mission.stages[stageIndex];
    if (typeof stage.timer === 'number') stage._remaining = stage.timer;
    if (typeof stage.onEnter === 'function') stage.onEnter(world);
    if (stage.kind === 'fight') spawnStageEnemies(world, stage);
    setWorldMission(world, mission, stageIndex);
  }

  function advanceStage() {
    const mission = active.mission;
    const stage = mission.stages[active.stageIndex];
    if (typeof stage.onComplete === 'function') stage.onComplete(world);
    if (active.stageIndex + 1 >= mission.stages.length) {
      completeMission();
    } else {
      active.stageIndex += 1;
      enterStage(mission, active.stageIndex);
    }
  }

  function startMission(id) {
    const mission = world.missionRegistry[id];
    if (!mission) {
      logEvent(world, `Mission not found: ${id}`);
      return false;
    }
    if (active) {
      logEvent(world, `Already on mission: ${active.mission.name}`);
      return false;
    }
    active = { mission, stageIndex: 0 };
    logEvent(world, `Mission started: ${mission.name}`);
    enterStage(mission, 0);
    return true;
  }

  function update(dt) {
    if (!active) return;
    const mission = active.mission;
    // advance === false (M37 'Loaded Dice') is staged: it NEVER auto-advances
    // on reach/timer/fight — only its own trigger moves it.
    if (mission.advance === false) return;
    const stage = mission.stages[active.stageIndex];
    const kind = stage.kind; // declared before any read (no TDZ)
    const pos = playerPos(world);

    // maxWanted stages (casing): raising heat above the cap fails the stage.
    if (typeof stage.maxWanted === 'number' && (world.wanted || 0) > stage.maxWanted) {
      failMission('spotted — wanted level too high');
      return;
    }

    // Win-target stages (M38 high-roller table): complete when the tracked
    // winnings reach the target — standing at the table alone must not do it.
    if (typeof stage.winTarget === 'number') {
      const won = (world.vice && world.vice.casinoWinnings) || 0;
      if (won >= stage.winTarget) { advanceStage(); return; }
    }

    // Timed stages: count down, fail on expiry (survive counts only while hot).
    if (typeof stage._remaining === 'number') {
      if (kind === 'survive') {
        const need = stage.minWanted || 1;
        if (world.wanted >= need) stage._remaining -= dt;
      } else {
        stage._remaining -= dt;
      }
      if (world.mission) world.mission.timer = Math.max(0, Math.ceil(stage._remaining));
      if (stage._remaining <= 0) {
        if (kind === 'survive') {
          advanceStage();
          return;
        }
        // Heli stages (M38/M40/M28 escape legs): once boarded in the heli,
        // the stage COMPLETES on its timer — it does not fail for running out
        // the clock while flying.
        if (stage.heliStage && boardedInHeli(world)) {
          advanceStage();
          return;
        }
        failMission('time ran out');
        return;
      }
    }

    if (kind === 'reach' || kind === 'deliver' || kind === 'timed' || kind === 'tail' || kind === 'escort') {
      // Win-target stages never auto-advance by proximity (handled above).
      if (typeof stage.winTarget === 'number') return;
      if (stage.marker && dist2D(pos, stage.marker) <= (stage.radius || 6)) {
        advanceStage();
        return;
      }
    } else if (kind === 'fight') {
      const remaining = stageEnemiesRemaining(world, stage);
      if (remaining === 0) {
        advanceStage();
        return;
      }
    } else if (kind === 'survive') {
      // Completion handled by the timer branch above.
    }
  }

  const runner = { update, startMission, get active() { return active; } };
  world.startMission = startMission;
  world.missionRunner = runner;
  if (Array.isArray(world.systems)) world.systems.push(runner);
  return runner;
}

export function createMissions(world) {
  world.missionRegistry = world.missionRegistry || {};
  const R = world.missionRegistry;

  R.m1 = {
    id: 'm1',
    name: 'Joyride',
    payout: 500,
    stages: [
      {
        kind: 'reach',
        objective: 'Steal a car and drive to the Coral Club',
        marker: { x: 29, z: 29 },
        radius: 8,
      },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      logEvent(w, 'M1 done — the Coral Club knows your name now.');
    },
  };

  R.m2 = {
    id: 'm2',
    name: 'Package Run',
    payout: 800,
    stages: [
      { kind: 'deliver', objective: 'Deliver package 1 of 3', marker: { x: 60, z: -40 }, radius: 6, timer: 150 },
      { kind: 'deliver', objective: 'Deliver package 2 of 3', marker: { x: -80, z: 90 }, radius: 6, timer: 150 },
      { kind: 'deliver', objective: 'Deliver package 3 of 3', marker: { x: 120, z: 140 }, radius: 6, timer: 150 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      logEvent(w, 'M2 done — all three packages delivered clean.');
    },
  };

  R.m3 = {
    id: 'm3',
    name: 'Heat Wave',
    payout: 1200,
    stages: [
      {
        kind: 'survive',
        objective: 'Survive 60s at 3 stars — stay hot, stay moving',
        marker: { x: 0, z: 0 },
        radius: 10,
        timer: 60,
        minWanted: 3,
        onEnter(w) {
          w.wanted = Math.max(w.wanted || 0, 3);
          if (typeof w.heat === 'number') w.heat = Math.max(w.heat, 3);
        },
      },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      logEvent(w, 'M3 done — you outlasted the heat.');
    },
  };

  R.m4 = {
    id: 'm4',
    name: 'Yacht Party',
    payout: 2500,
    stages: [
      { kind: 'reach', objective: 'Pick up crew member 1', marker: { x: 150, z: 60 }, radius: 6,
        onComplete(w) { w.crew = w.crew || []; if (!w.crew.includes('rico')) w.crew.push('rico'); } },
      { kind: 'reach', objective: 'Pick up crew member 2', marker: { x: 210, z: 110 }, radius: 6,
        onComplete(w) { w.crew = w.crew || []; if (!w.crew.includes('lena')) w.crew.push('lena'); } },
      { kind: 'reach', objective: 'Reach the yacht at the marina', marker: { x: 305, z: 175 }, radius: 10 },
      { kind: 'reach', objective: 'Escape — lose the tail and clear the marina', marker: { x: 340, z: 230 }, radius: 10 },
    ],
    onComplete(w) {
      w.revenge = w.revenge || {};
      w.revenge.yachtParty = true;
      logEvent(w, 'M4 done — the crew is aboard and the yacht is yours.');
    },
  };

  return R;
}
