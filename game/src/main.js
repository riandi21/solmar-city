// main.js — Solmar City bootstrap. Builds the world, wires every system in
// STEP_ORDER, runs the frame loop, the follow camera, pause, the menu/start
// flow, and save stats. Written fresh for Round 16 (v16).
//
// HARD RULES (the v10 lesson):
// - One scene only: the renderer's scene. Never create a second scene.
// - wire() detects each factory's arity: (scene, world) first, else (world).
//   traffic gets a 3rd arg, the city object. createCity takes (scene, world).
// - wire() NEVER overwrites world state fields with system objects. State
//   fields (player, traffic, crew, boats, ...) keep their DATA; systems go
//   into world.systems (an ARRAY) and/or world.systemObjects[name].
// - world.save must exist before any system that calls world.save.save().
//   So the save system is created FIRST, right after the city, and it also
//   stays in STEP_ORDER (last) where it is re-used, never re-created.

import * as THREE from 'three';
import { createRender } from './render.js';
import { makeWorld } from './world.js';
import { createCity } from './city.js';
import { createNorthHills } from './northhills.js';
import { createIslands } from './islands.js';
import { createVineyards } from './vineyards.js';
import { createHavana } from './havana.js';
import { createSunsetBeach } from './sunsetbeach.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createMotorcycles } from './motorcycles.js';
import { createJetSki } from './jetski.js';
import { createCrew } from './crew.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createMissionRunner } from './missions.js';
import { createCombat } from './combat.js';
import { createPlayerHeli } from './playerheli.js';
import { createHeli } from './heli.js';
import { createShops } from './shops.js';
import { createGarage } from './garage.js';
import { createDayNight } from './daynight.js';
import { createOldTown } from './oldtown.js';
import { createPoliceAI } from './policeai.js';
import { createActivities } from './activities.js';
import { createBoats } from './boats.js';
import { createSeaplane } from './seaplane.js';
import { createWeather } from './weather.js';
import { createCasino } from './casino.js';
import { createProperties } from './properties.js';
import { createTerritories } from './territories.js';
import { createMissions3 } from './missions3.js';
import { createMissions4 } from './missions4.js';
import { createMissions5 } from './missions5.js';
import { createMissions6 } from './missions6.js';
import { createMissions7 } from './missions7.js';
import { createMissions8 } from './missions8.js';
import { createMissions9 } from './missions9.js';
import { createMissions10 } from './missions10.js';
import { createMissions11 } from './missions11.js';
import { createEmpire } from './empire.js';
import { createHeat } from './heat.js';
import { createCartel } from './cartel.js';
import { createFishing } from './fishing.js';
import { createSave } from './save.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createShots } from './shots.js';

const STEP_ORDER = [
  'city', 'northhills', 'islands', 'vineyards', 'havana', 'sunsetbeach',
  'player', 'vehicles', 'motorcycles', 'jetski', 'crew', 'traffic', 'police',
  'missions', 'combat', 'playerheli', 'shops', 'garage',
  'daynight', 'oldtown', 'policeai', 'activities', 'boats', 'seaplane',
  'weather', 'casino', 'properties', 'territories',
  'missions3', 'missions4', 'missions5', 'missions6', 'missions7',
  'missions8', 'missions9', 'missions10', 'missions11',
  'empire', 'heat', 'cartel', 'fishing', 'save',
];

const FACTORIES = {
  northhills: createNorthHills, islands: createIslands, vineyards: createVineyards,
  havana: createHavana, sunsetbeach: createSunsetBeach, player: createPlayer,
  vehicles: createVehicles, motorcycles: createMotorcycles, jetski: createJetSki,
  crew: createCrew, traffic: createTraffic, police: createPolice,
  missions: createMissions, combat: createCombat,
  playerheli: createPlayerHeli, heli: createHeli, shops: createShops,
  garage: createGarage, daynight: createDayNight, oldtown: createOldTown,
  policeai: createPoliceAI, activities: createActivities, boats: createBoats,
  seaplane: createSeaplane, weather: createWeather, casino: createCasino,
  properties: createProperties, territories: createTerritories,
  missions3: createMissions3, missions4: createMissions4, missions5: createMissions5,
  missions6: createMissions6, missions7: createMissions7, missions8: createMissions8,
  missions9: createMissions9, missions10: createMissions10, missions11: createMissions11,
  empire: createEmpire, heat: createHeat, cartel: createCartel,
  fishing: createFishing, save: createSave,
};

export function boot() {
  const world = makeWorld();
  // Systems live here. world.systems MUST stay an array, never an object.
  world.systems = [];
  world.systemObjects = world.systemObjects || {};

  const renderer = createRender(document.getElementById('game'));
  const scene = renderer.scene;
  const camera = renderer.camera;
  world.scene = scene;
  world.camera = camera;
  world.renderer = renderer;
  world.THREE = THREE;

  // City FIRST so world.city exists with roads and colliders.
  const city = createCity(scene, world);
  world.city = city;

  // Save FIRST among systems so world.save exists before anyone calls it.
  const wired = {};
  function wire(name, factory) {
    if (wired[name]) return wired[name];
    let sys;
    if (name === 'traffic') {
      sys = factory.length >= 3 ? factory(scene, world, city) : factory(scene, world);
    } else if (factory.length >= 2) {
      sys = factory(scene, world);
    } else {
      sys = factory(world);
    }
    wired[name] = sys;
    if (sys) {
      if (!sys.name) sys.name = name;
      world.systemObjects[name] = sys;
      if (typeof sys.update === 'function') world.systems.push(sys);
    }
    return sys;
  }

  const save = wire('save', createSave);
  world.save = save;

  // Core shell systems: input, audio, hud, shots.
  const input = createInput(world);
  world.systemObjects.input = input;
  if (typeof input.update === 'function') world.systems.push(input);
  const audio = createAudio(world);
  world.systemObjects.audio = audio;
  if (typeof audio.update === 'function') world.systems.push(audio);
  const hud = createHud(world);
  world.systemObjects.hud = hud;
  world.hud = hud;
  if (typeof hud.update === 'function') world.systems.push(hud);
  const shots = createShots(world);
  world.systemObjects.shots = shots;
  world.shots = shots;
  if (typeof shots.update === 'function') world.systems.push(shots);

  // Police helicopter (heli.js) rides alongside the helicopter systems.
  wire('heli', createHeli);

  // Wire the rest in STEP_ORDER. 'save' is already wired; re-use it.
  for (const name of STEP_ORDER) {
    if (name === 'city') continue;
    if (name === 'save') { world.save = wired.save; continue; }
    const factory = FACTORIES[name];
    if (factory) wire(name, factory);
  }

  // The mission runner: without it no mission can ever start. Created after
  // every missions factory has registered, so startMission sees M1-M44.
  // (No helicopter.js exists: the flyable heli is 'playerheli' and the
  // police heli is 'heli'; there is no separate 'helicopter' step.)
  createMissionRunner(world);

  // Menu / start flow.
  const menu = document.getElementById('menu');
  const startBtn = document.getElementById('start-btn');
  const pauseEl = document.getElementById('pause');
  let started = false;
  let paused = false;
  let over = false;

  function show(el2, on) { if (el2) el2.style.display = on ? 'flex' : 'none'; }

  function startGame() {
    if (started) return;
    started = true;
    show(menu, false);
    if (world.save && world.save.load) world.save.load();
    hud.setObjective('Welcome to Solmar City — follow the marker.');
    hud.toast('Welcome to Solmar City');
  }

  function togglePause() {
    if (!started || over) return;
    paused = !paused;
    show(pauseEl, paused);
  }

  if (startBtn) startBtn.addEventListener('click', startGame);
  if (menu) menu.addEventListener('click', (e) => { if (e.target === menu) startGame(); });

  // Third-person follow camera: 10m back, 6m up, travel-direction tracking.
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  function updateCamera(dt) {
    const p = world.player || {};
    const pos = p.position || { x: p.x || 0, y: 0, z: p.z || 0 };
    const heading = p.heading || 0;
    const inAir = !!(p.heli || p.helicopter || p.seaplane);
    const dist = inAir ? 16 : 10;
    const height = inAir ? 8 : 6;
    const bx = Math.sin(heading) * dist;
    const bz = Math.cos(heading) * dist;
    camTarget.set(pos.x, (pos.y || 0) + 1.5, pos.z);
    camPos.set(pos.x + bx, (pos.y || 0) + height, pos.z + bz);
    const k = 1 - Math.exp(-dt * 5);
    camera.position.lerp(camPos, k);
    camera.lookAt(camTarget);
  }

  // Save stats: cash, missions done, time played, wanted level.
  let saveTimer = 0;
  function saveStats() {
    if (!world.save || !world.save.save) return;
    const p = world.player || {};
    world.save.save({
      cash: p.cash || 0,
      missionsDone: (world.missions && world.missions.done) || 0,
      playSeconds: Math.floor(world.time || 0),
      wanted: p.wanted || 0,
    });
  }

  const clock = new THREE.Clock();
  let raf = 0;
  let frames = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    // P toggles pause BOTH ways; Enter/click starts from the menu.
    if (world.input && world.input.wasPressed && world.input.wasPressed('KeyP')) togglePause();
    if (world.input && world.input.wasPressed && world.input.wasPressed('Enter') && !started) startGame();
    if (!started || paused || over) {
      renderer.render(scene, camera);
      return;
    }
    world.time = (world.time || 0) + dt;
    // Snapshot edge presses BEFORE the systems loop: input.update() clears
    // the pressed set each frame, so C/M must be read before it runs.
    const pressedC = world.input && world.input.wasPressed ? world.input.wasPressed('KeyC') : false;
    const pressedM = world.input && world.input.wasPressed ? world.input.wasPressed('KeyM') : false;
    for (const sys of world.systems) {
      try { sys.update(dt); } catch (e) { /* one broken system must not kill the loop */ void e; }
    }
    // Radio station cycle (C) and mute (M) live here so they work even if
    // the audio system is mid-init.
    if (pressedC) {
      const name = audio.setStation((audio.stationIndex + 1) % 6);
      hud.toast('Radio: ' + name);
    }
    if (pressedM) hud.toast(audio.toggleMute() ? 'Muted' : 'Sound on');
    updateCamera(dt);
    renderer.render(scene, camera);
    frames++;
    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; saveStats(); }
    // Shots mode: ?shot=1-chase etc. stages, simulates, captures, reports.
    const params = new URLSearchParams(window.location.search);
    const shotId = params.get('shot');
    if (shotId && frames === 2 && shots.captureOne) {
      const shot = shots.captureOne(shotId, renderer);
      if (shot) {
        document.title = 'SHOT READY ' + shotId;
        window.__shotReady = shot;
      }
    }
  }

  window.addEventListener('beforeunload', saveStats);
  frame();

  return { world, renderer, scene, camera, startGame, togglePause, saveStats, STEP_ORDER };
}

// Auto-boot when loaded as the page's module script.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot());
  } else {
    boot();
  }
}
