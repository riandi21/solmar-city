// Bootstrap for Solmar City: builds the world, wires every system in
// step order, runs the frame loop, and owns the menu / start / pause
// flow. Every system is guarded, so a missing or failed system can
// never crash the loop, and the game stays playable while the city
// is still being built. window.__game exposes the world for tests.
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createCity } from './city.js';
import { createDocks } from './docks.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createMotorcycles } from './motorcycles.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHeli } from './heli.js';
import { createShops } from './shops.js';
import { createDayNight } from './daynight.js';
import { createOldTown } from './oldtown.js';
import { createPoliceAI } from './policeai.js';
import { createMissions3 } from './missions3.js';
import { createActivities } from './activities.js';
import { createMissions4 } from './missions4.js';
import { createBoats } from './boats.js';
import { createWeather } from './weather.js';
import { createCasino } from './casino.js';
import { createProperties } from './properties.js';
import { createTerritories } from './territories.js';
import { createMissions5 } from './missions5.js';
import { createMissions6 } from './missions6.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createShots } from './shots.js';
import { createSave } from './save.js';

// The wiring order from the brief: city first, Dourado Revenge last.
const STEP_ORDER = [
  'city', 'docks', 'player', 'vehicles', 'motorcycles', 'traffic',
  'police', 'missions', 'combat', 'heli', 'shops', 'daynight',
  'oldtown', 'policeai', 'missions3', 'activities', 'missions4',
  'boats', 'weather', 'casino', 'properties', 'territories',
  'missions5', 'missions6',
];

const FACTORIES = {
  city: createCity,
  docks: createDocks,
  player: createPlayer,
  vehicles: createVehicles,
  motorcycles: createMotorcycles,
  traffic: createTraffic,
  police: createPolice,
  missions: createMissions,
  combat: createCombat,
  heli: createHeli,
  shops: createShops,
  daynight: createDayNight,
  oldtown: createOldTown,
  policeai: createPoliceAI,
  missions3: createMissions3,
  activities: createActivities,
  missions4: createMissions4,
  boats: createBoats,
  weather: createWeather,
  casino: createCasino,
  properties: createProperties,
  territories: createTerritories,
  missions5: createMissions5,
  missions6: createMissions6,
};

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot') || '';

const canvas = document.getElementById('game');
const world = createWorld();
const renderHandle = createRenderer(canvas);

world.canvas = canvas;
world.scene = renderHandle.scene;
world.camera = renderHandle.camera;
world.renderer = renderHandle.renderer;
if (renderHandle.sun) world.sun = renderHandle.sun;
if (renderHandle.hemi) world.hemi = renderHandle.hemi;
world.systems = {};
world.mode = 'menu';
world.elapsed = world.elapsed || 0;
world.stats = { frames: 0, seconds: 0, startedAt: Date.now() };

function wireSystem(name, factory) {
  if (typeof factory !== 'function') return null;
  try {
    const system = factory(world);
    if (system) world.systems[name] = system;
    return system || null;
  } catch (error) {
    console.warn('Solmar City: system failed to start:', name, error);
    return null;
  }
}

function updateSystem(name, dt) {
  const system = world.systems[name];
  if (system && typeof system.update === 'function') {
    try {
      system.update(dt);
    } catch (error) {
      console.warn('Solmar City: system update failed:', name, error);
    }
  }
}

// Input, audio and HUD first: other systems read world.input and
// call world.toast from their first frame onward.
wireSystem('input', createInput);
wireSystem('audio', createAudio);
wireSystem('hud', createHud);
for (const name of STEP_ORDER) wireSystem(name, FACTORIES[name]);
wireSystem('save', createSave);
wireSystem('shots', createShots);

window.__game = world;

const menuEl = document.getElementById('menu');
const menuTitle = document.getElementById('menu-title');
const menuText = document.getElementById('menu-text');
const startButton = document.getElementById('start-button');
const pauseNote = document.getElementById('pause-note');

function showMenu(title, text) {
  if (menuTitle && title) menuTitle.textContent = title;
  if (menuText && text) menuText.textContent = text;
  if (menuEl) menuEl.classList.remove('hidden');
  if (startButton) startButton.textContent = world.mode === 'menu' ? 'Start Game' : 'Play Again';
}

function hideMenu() {
  if (menuEl) menuEl.classList.add('hidden');
}

function startGame() {
  if (world.mode === 'over' || world.mode === 'busted') {
    window.location.reload();
    return;
  }
  world.mode = 'play';
  world.stats.startedAt = Date.now();
  hideMenu();
  const audio = world.systems.audio;
  if (audio && typeof audio.resume === 'function') audio.resume();
  if (world.toast) world.toast('Welcome to Solmar City, Rico. Madame Coral is waiting.');
}

function togglePause() {
  if (world.mode === 'play') {
    world.mode = 'pause';
    if (pauseNote) pauseNote.classList.remove('hidden');
    const save = world.systems.save;
    if (save && typeof save.save === 'function') {
      try { save.save(); } catch (error) { console.warn('Save on pause failed:', error); }
    }
  } else if (world.mode === 'pause') {
    world.mode = 'play';
    if (pauseNote) pauseNote.classList.add('hidden');
  }
}

function renderFrame() {
  if (renderHandle && typeof renderHandle.render === 'function') {
    try { renderHandle.render(); } catch (error) { console.warn('Render failed:', error); }
  } else if (world.renderer && world.scene && world.camera) {
    try { world.renderer.render(world.scene, world.camera); } catch (error) { console.warn('Render failed:', error); }
  }
  if (renderHandle && typeof renderHandle.update === 'function') {
    try { renderHandle.update(); } catch (error) { console.warn('Renderer update failed:', error); }
  }
}

let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000 || 0, MAX_FRAME);
  last = now;
  fpsFrames += 1;
  fpsTime += dt;
  if (fpsTime >= 1) {
    world.stats.fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0;
    fpsTime = 0;
  }
  const input = world.input;

  if (world.mode === 'menu' && input && input.justPressed) {
    if (input.justPressed.has('Enter') || input.justPressed.has('Space')) startGame();
  }
  if ((world.mode === 'play' || world.mode === 'pause') && input && input.justPressed) {
    if (input.justPressed.has('KeyP') || input.justPressed.has('Escape')) togglePause();
  }
  if ((world.mode === 'over' || world.mode === 'busted') && input && input.justPressed) {
    if (input.justPressed.has('Enter')) startGame();
  }

  if (world.mode === 'play') {
    world.elapsed += dt;
    world.stats.seconds += dt;
    world.stats.frames += 1;
    for (const name of STEP_ORDER) updateSystem(name, dt);
    updateSystem('save', dt);
    updateSystem('audio', dt);
    updateSystem('hud', dt);
    updateSystem('shots', dt);
  } else if (world.mode === 'menu') {
    updateSystem('city', dt);
    updateSystem('daynight', dt);
    updateSystem('weather', dt);
    updateSystem('hud', dt);
    updateSystem('shots', dt);
    if (world.camera && world.player && world.player.position) {
      const t = world.elapsed;
      world.elapsed += dt;
      const cx = Math.sin(t * 0.05) * 180;
      const cz = Math.cos(t * 0.05) * 180;
      if (world.camera.position && world.camera.position.set) world.camera.position.set(cx, 90, cz);
      if (world.camera.lookAt) world.camera.lookAt(0, 10, 0);
    }
  } else if (world.mode === 'pause') {
    updateSystem('hud', dt);
  } else if (world.mode === 'over' || world.mode === 'busted') {
    updateSystem('hud', dt);
    showMenu(world.mode === 'busted' ? 'BUSTED' : 'WASTED',
      world.mode === 'busted'
        ? 'The Solmar PD caught up with Rico. $200 bail, back on the streets.'
        : 'Rico is down. The city keeps moving without him.');
  }

  renderFrame();
  if (input && typeof input.update === 'function') input.update();
}

if (startButton) startButton.addEventListener('click', startGame);
window.addEventListener('resize', () => {
  if (renderHandle && typeof renderHandle.resize === 'function') {
    try { renderHandle.resize(); } catch (error) { console.warn('Resize failed:', error); }
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && world.mode === 'play') togglePause();
});
window.addEventListener('beforeunload', () => {
  const save = world.systems.save;
  if (save && typeof save.save === 'function') {
    try { save.save(); } catch (error) { /* storage may be unavailable */ }
  }
});

if (shotParam) {
  // Staged captures skip the menu and play at once.
  hideMenu();
  world.mode = 'play';
  const audio = world.systems.audio;
  if (audio && typeof audio.resume === 'function') {
    try { audio.resume(); } catch (error) { /* audio needs a gesture; shots run silent */ }
  }
} else {
  showMenu('SOLMAR CITY', 'Rico Vega owes Madame Coral $5,000. Drive, fight and hustle your way out — and settle the score with the Dourado cartel.');
}

requestAnimationFrame(frame);
