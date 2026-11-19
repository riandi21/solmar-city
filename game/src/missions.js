// missions.js — Solmar City mission runner + Missions 1-4 (intro jobs).
// The runner owns the active mission, stage advancement, floating beacon
// markers, timers, rewards and the onComplete hook. Arc files (missions3
// through missions11) only export plain mission definitions; the runner
// (or the bootstrap, via registerMissionDefs) collects them.
// Wiring contract: world.systems is an array, world.player keeps its
// .position vector, and the runner never overwrites world state fields.
import * as THREE from 'three';
import { getDefs as getDouradoDefs } from './missions3.js';
import { getDefs as getHarborDefs } from './missions4.js';
import { getDefs as getAirportDefs } from './missions5.js';
import { getDefs as getCasinoDefs } from './missions6.js';

// ---------------------------------------------------------------- helpers
export function playerXZ(world) {
  const p = world && world.player;
  if (p && p.position) return { x: p.position.x || 0, z: p.position.z || 0 };
  if (p && typeof p.x === 'number') return { x: p.x, z: p.z || 0 };
  return { x: 0, z: 0 };
}

export function distXZ(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dz * dz);
}

function toast(world, text) {
  if (!world) return;
  if (typeof world.showToast === 'function') { world.showToast(text); return; }
  if (typeof world.toast === 'function') { world.toast(text); return; }
  if (Array.isArray(world.events)) world.events.push({ type: 'toast', text });
  if (world.hud && typeof world.hud.toast === 'function') world.hud.toast(text);
}

function inVehicle(world, kinds) {
  const p = world && world.player;
  if (!p) return false;
  if (kinds.includes('car') && (p.car || p.currentCar)) return true;
  if (kinds.includes('boat') && (p.boat || p.currentBoat)) return true;
  if (kinds.includes('plane') && (p.seaplane || p.currentPlane || p.plane)) return true;
  if (kinds.includes('heli') && (p.helicopter || p.currentHeli || p.heli)) return true;
  if (kinds.includes('bike') && (p.bike || p.currentBike)) return true;
  if (kinds.includes('jetski') && (p.jetski || p.currentJetski)) return true;
  if (typeof p.currentVehicle === 'function') {
    const v = p.currentVehicle();
    if (v && kinds.includes(v.kind)) return true;
  }
  return false;
}

// ------------------------------------------------------- Missions 1-4
export const INTRO_DEFS = [
  {
    id: 1, title: 'First Wheels', reward: 500, arc: 'intro',
    briefing: 'Rico needs wheels. Steal a car and bring it to the Coral Club.',
    stages: [
      { kind: 'enterVehicle', vehicle: 'car', objective: 'Steal a car (press E near one)' },
      { kind: 'reach', at: { x: 58, z: 29 }, radius: 8, objective: 'Drive to the Coral Club' },
    ],
    onComplete(world) { world.introState = world.introState || {}; world.introState.firstWheels = true; },
  },
  {
    id: 2, title: 'Package Run', reward: 800, arc: 'intro',
    briefing: 'Three packages, 150 seconds. The Coral crew is counting on you.',
    stages: [
      { kind: 'reach', at: { x: 58, z: 116 }, radius: 7, timeLimit: 150, objective: 'Deliver package 1/3 to the shop' },
      { kind: 'reach', at: { x: -174, z: 232 }, radius: 7, timeLimit: 150, objective: 'Deliver package 2/3 to the safehouse' },
      { kind: 'reach', at: { x: 100, z: 60 }, radius: 7, timeLimit: 150, objective: 'Deliver package 3/3 to the Anchor Bar' },
    ],
    onComplete(world) { world.introState = world.introState || {}; world.introState.packagesDone = true; },
  },
  {
    id: 3, title: 'Heat Wave', reward: 1200, arc: 'intro',
    briefing: 'The cops are on you. Survive a 3-star wanted level for 60 seconds.',
    stages: [
      { kind: 'survive', wanted: 3, duration: 60, objective: 'Survive 3 stars for 60 seconds' },
    ],
    onComplete(world) { world.introState = world.introState || {}; world.introState.heatSurvived = true; },
  },
  {
    id: 4, title: 'Yacht Escape', reward: 2500, arc: 'intro',
    briefing: 'Pick up two crew at the Anchor Bar, reach the yacht, then vanish.',
    stages: [
      { kind: 'escort', at: { x: 100, z: 60 }, radius: 8, crewNeeded: 2, objective: 'Pick up 2 crew at the Anchor Bar' },
      { kind: 'reach', at: { x: 305, z: 175 }, radius: 9, objective: 'Reach the yacht at the marina' },
      { kind: 'reach', at: { x: -174, z: 232 }, radius: 8, objective: 'Escape to the safehouse' },
    ],
    onComplete(world) { world.introState = world.introState || {}; world.introState.yachtEscape = true; },
  },
];

// ------------------------------------------------------------- the runner
// The bootstrap's wire() calls factories as (scene, world) first, so the
// runner accepts both shapes: createMissionSystem(world) and
// createMissionSystem(scene, world). Without this the runner binds the
// wrong object and M1-20 can never run.
export function createMissionSystem(sceneOrWorld, maybeWorld) {
  const world = maybeWorld || sceneOrWorld;
  const defs = new Map();
  for (const d of INTRO_DEFS) defs.set(d.id, d);

  const state = {
    active: null, // { def, stageIndex, stageState, timeLeft }
    completed: [],
    marker: null, // THREE group for the floating beacon
    markerPos: null,
  };

  function allDefs() { return [...defs.values()].sort((a, b) => a.id - b.id); }

  function registerMissionDefs(list) {
    for (const d of list || []) {
      if (d && typeof d.id === 'number' && !defs.has(d.id)) defs.set(d.id, d);
    }
  }

  // Register the M1-20 arcs owned by this slice.
  registerMissionDefs(getDouradoDefs());
  registerMissionDefs(getHarborDefs());
  registerMissionDefs(getAirportDefs());
  registerMissionDefs(getCasinoDefs());

  function clearMarker() {
    if (state.marker && world.scene && typeof world.scene.remove === 'function') {
      world.scene.remove(state.marker);
    }
    state.marker = null;
    state.markerPos = null;
    if (world.mission) world.mission.marker = null;
  }

  function showMarker(at) {
    clearMarker();
    state.markerPos = { x: at.x, z: at.z };
    if (world.mission) world.mission.marker = { x: at.x, z: at.z };
    if (!world.scene || typeof THREE === 'undefined') return;
    try {
      const group = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, 0.5, 20),
        new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.85 }),
      );
      base.position.y = 0.3;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 42, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
      );
      beam.position.y = 21;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.14, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.1;
      group.add(base, beam, ring);
      group.position.set(at.x, 0, at.z);
      group.userData.isMissionMarker = true;
      world.scene.add(group);
      state.marker = group;
    } catch (err) { state.marker = null; }
  }

  function syncHud() {
    const a = state.active;
    if (!a) { if (world.mission) world.mission = { id: 0, stage: 0, objective: '', marker: null, timer: 0 }; return; }
    const stage = a.def.stages[a.stageIndex];
    world.mission = world.mission || {};
    world.mission.id = a.def.id;
    world.mission.title = a.def.title;
    world.mission.stage = a.stageIndex;
    world.mission.stageCount = a.def.stages.length;
    world.mission.objective = stage.objective || '';
    world.mission.timer = a.timeLeft || 0;
    world.mission.marker = state.markerPos;
  }

  function spawnStageEnemies(stage) {
    const count = stage.enemyCount || 0;
    if (count <= 0) return 0;
    world.enemies = world.enemies || [];
    world.gangShooters = world.gangShooters || [];
    const spawned = [];
    for (let i = 0; i < count; i++) {
      if (typeof world.spawnShooter === 'function') {
        const s = world.spawnShooter(stage.at || { x: 0, z: 0 }, stage.enemyHealth || 60);
        if (s) spawned.push(s);
      } else {
        const angle = (i / count) * Math.PI * 2;
        const foe = {
          kind: 'shooter', health: stage.enemyHealth || 60, maxHealth: stage.enemyHealth || 60,
          position: { x: (stage.at?.x || 0) + Math.cos(angle) * 6, z: (stage.at?.z || 0) + Math.sin(angle) * 6 },
          alive: true,
        };
        world.enemies.push(foe);
        world.gangShooters.push(foe);
        spawned.push(foe);
      }
    }
    return spawned.length;
  }

  function enterStage(index) {
    const a = state.active;
    const stage = a.def.stages[index];
    // Declare kind BEFORE reading it anywhere (TDZ guard, v10 M39 lesson).
    const kind = stage.kind || 'reach';
    a.stageIndex = index;
    a.stageState = { spawned: 0, spawnedIds: [], waited: 0, tailT: 0 };
    // Mission-wide timer comes ONLY from timeLimit. A stage's `duration`
    // is its own completion clock (survive / defend / wait count it down
    // themselves); using it as the abort timer too aborts survive and
    // defend stages on the exact tick they would complete (M3, M12).
    a.timeLeft = stage.timeLimit || 0;
    if (stage.at) showMarker(stage.at);
    else if (kind === 'survive' || kind === 'defend') clearMarker();
    else clearMarker();
    if (kind === 'survive' && typeof stage.wanted === 'number') {
      world.wanted = Math.max(world.wanted || 0, stage.wanted);
    }
    if (kind === 'fight' || kind === 'defend') {
      a.stageState.spawned = spawnStageEnemies(stage);
    }
    if (kind === 'tail' && stage.path && stage.path.length) {
      a.stageState.tailTarget = { ...stage.path[0] };
      a.stageState.tailWp = 0;
      showMarker(stage.path[0]);
    }
    syncHud();
  }

  function start(id) {
    const def = defs.get(id);
    if (!def) return false;
    if (state.active) return false;
    if (state.completed.includes(id)) return false;
    if (def.requires && !state.completed.includes(def.requires)) return false;
    state.active = { def, stageIndex: 0, stageState: {}, timeLeft: 0 };
    toast(world, `Mission ${def.id}: ${def.title} — ${def.briefing}`);
    if (typeof world.onMissionStart === 'function') world.onMissionStart(def);
    enterStage(0);
    return true;
  }

  function advanceStage() {
    const a = state.active;
    if (!a) return;
    if (a.stageIndex + 1 >= a.def.stages.length) { completeMission(); return; }
    enterStage(a.stageIndex + 1);
  }

  function completeMission() {
    const a = state.active;
    if (!a) return;
    const def = a.def;
    world.cash = (world.cash || 0) + (def.reward || 0);
    state.completed.push(def.id);
    world.completedMissions = world.completedMissions || [];
    if (!world.completedMissions.includes(def.id)) world.completedMissions.push(def.id);
    clearMarker();
    state.active = null;
    syncHud();
    toast(world, `Mission complete: ${def.title} — $${def.reward}`);
    if (typeof world.onMissionComplete === 'function') world.onMissionComplete(def);
    // The runner MUST call onComplete: arc flags live inside it.
    if (typeof def.onComplete === 'function') def.onComplete(world);
  }

  function abort(reason) {
    if (!state.active) return;
    const title = state.active.def.title;
    state.active = null;
    clearMarker();
    syncHud();
    toast(world, `Mission failed: ${title}${reason ? ' — ' + reason : ''}`);
  }

  function aliveEnemies(stageState) {
    const list = world.enemies || [];
    return list.filter((e) => e && (e.health === undefined || e.health > 0) && e.alive !== false);
  }

  function update(dt) {
    const a = state.active;
    if (!a) return;
    if (world.mode && world.mode !== 'play') return;
    const stage = a.def.stages[a.stageIndex];
    // Declare kind BEFORE reading it anywhere (TDZ guard).
    const kind = stage.kind || 'reach';
    const pos = playerXZ(world);

    // Mission-wide timer.
    if (a.timeLeft > 0) {
      a.timeLeft -= dt;
      if (a.timeLeft <= 0) { abort('Time ran out'); return; }
    }
    // Stage max-wanted gate (stealth stages): fail loudly, never silently.
    if (typeof stage.maxWanted === 'number' && (world.wanted || 0) > stage.maxWanted) {
      abort('Spotted — wanted level too high'); return;
    }
    // Marker beacon pulse.
    if (state.marker) {
      state.marker.rotation.y += dt * 0.8;
      state.marker.position.y = Math.sin((world.elapsed || 0) * 2) * 0.25;
    }

    if (kind === 'reach' || kind === 'deliver' || kind === 'collect') {
      if (stage.at && distXZ(pos, stage.at) <= (stage.radius || 9)) advanceStage();
    } else if (kind === 'enterVehicle') {
      if (inVehicle(world, [stage.vehicle || 'car'])) advanceStage();
    } else if (kind === 'drive') {
      if (stage.at && inVehicle(world, ['car', 'bike']) && distXZ(pos, stage.at) <= (stage.radius || 9)) advanceStage();
    } else if (kind === 'boat') {
      if (stage.at && inVehicle(world, ['boat', 'jetski']) && distXZ(pos, stage.at) <= (stage.radius || 9)) advanceStage();
    } else if (kind === 'fly') {
      const airborne = inVehicle(world, ['plane', 'heli']);
      if (stage.at && airborne && distXZ(pos, stage.at) <= (stage.radius || 12)) advanceStage();
    } else if (kind === 'survive') {
      if ((world.wanted || 0) >= (stage.wanted || 1)) {
        a.stageState.waited += dt;
        if (a.stageState.waited >= (stage.duration || 30)) advanceStage();
      }
    } else if (kind === 'defend') {
      a.stageState.waited += dt;
      const alive = aliveEnemies(a.stageState);
      if (a.stageState.spawned > 0 && alive.length === 0 && a.stageState.waited >= (stage.duration || 30)) advanceStage();
      else if (a.stageState.spawned === 0 && a.stageState.waited >= (stage.duration || 30)) advanceStage();
    } else if (kind === 'fight') {
      // Never auto-advance on an empty list that was never populated.
      if (a.stageState.spawned === 0) {
        a.stageState.spawned = spawnStageEnemies(stage);
        if (a.stageState.spawned === 0) return;
      }
      if (aliveEnemies(a.stageState).length === 0) advanceStage();
    } else if (kind === 'escort') {
      // Reaching the pickup point recruits the crew on the spot, so the
      // stage can complete even before any crew system has hired anyone.
      if (stage.at && distXZ(pos, stage.at) <= (stage.radius || 9)) {
        if (Array.isArray(world.crew)) {
          while (world.crew.filter((c) => c && c.state !== 'down').length < (stage.crewNeeded || 1)) {
            world.crew.push({ name: 'Crew', health: 100, state: 'follow', weapon: 'pistol' });
          }
        }
        advanceStage();
      }
    } else if (kind === 'tail') {
      const path = stage.path || [];
      const st = a.stageState;
      if (path.length) {
        const target = path[Math.min(st.tailWp, path.length - 1)];
        st.tailTarget = target;
        showMarkerThrottled(target);
        const d = distXZ(pos, target);
        if (d > (stage.loseDistance || 60)) { abort('Lost the target'); return; }
        if (d < (stage.spottedDistance || 12)) { abort('Spotted by the target'); return; }
        if (st.tailWp < path.length - 1) {
          st.tailT += dt;
          if (st.tailT > (stage.wpTime || 12)) { st.tailWp++; st.tailT = 0; }
        } else if (d <= (stage.finishDistance || 25)) advanceStage();
      }
    } else if (kind === 'wait') {
      a.stageState.waited += dt;
      if (a.stageState.waited >= (stage.duration || 10)) advanceStage();
    }
    syncHud();
  }

  let markerThrottle = 0;
  function showMarkerThrottled(at) {
    markerThrottle += 1;
    if (markerThrottle % 30 === 1) showMarker(at);
  }

  function available() {
    return allDefs().filter((d) => !state.completed.includes(d.id) && (!d.requires || state.completed.includes(d.requires)));
  }

  const api = {
    defs, state, registerMissionDefs, start, update, abort, advanceStage,
    completeMission, available, allDefs,
    get active() { return state.active; },
    get completed() { return state.completed; },
    nextMission() { const n = available()[0]; return n ? n.id : null; },
    startNext() { const n = available()[0]; return n ? start(n.id) : false; },
  };
  if (Array.isArray(world.systems)) world.systems.push(api);
  return api;
}

export function getDefs() { return [...INTRO_DEFS]; }

export default createMissionSystem;
