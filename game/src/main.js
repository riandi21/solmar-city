// Solmar City bootstrap: creates the world, wires every system in step order,
// runs the frame loop with a third-person follow camera, pause AND resume (P
// toggles both ways), and the menu/start flow.
//
// WIRING CONTRACTS (Round 12, proven): createCity takes (scene, world) —
// never (scene, rng). createRng returns a CALLABLE function. world.systems
// is an ARRAY, initialised as [] before any system is wired. wire() NEVER
// overwrites world state fields (player, traffic, crew, boats, seaplane,
// properties, territories, empire, weather, daynight, heat, garage) with
// system objects — systems live in world.systems or world.systemObjects.
// wire() tries (scene, world) first, then (world); traffic gets its 3rd
// arg: traffic(scene, world, city). The city is built FIRST. The bootstrap
// uses the renderer's scene and camera — never a second scene.

import * as THREE from 'three';
import { createAudio } from './audio.js';
import { createInput, ACTION_PAUSE, ACTION_CONFIRM } from './input.js';
import { createHud } from './hud.js';
import { createShots } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.random() * 4294967296) >>> 0;

// Step order from the Round 11 brief. The shots module mirrors this order.
const STEP_ORDER = [
  ['city', './city.js'],
  ['northhills', './northhills.js'],
  ['islands', './islands.js'],
  ['vineyards', './vineyards.js'],
  ['havana', './havana.js'],
  ['sunsetbeach', './sunsetbeach.js'],
  ['player', './player.js'],
  ['vehicles', './vehicles.js'],
  ['motorcycles', './motorcycles.js'],
  ['jetski', './jetski.js'],
  ['crew', './crew.js'],
  ['traffic', './traffic.js'],
  ['police', './police.js'],
  ['missions', './missions.js'],
  ['combat', './combat.js'],
  ['helicopter', './heli.js'],
  ['playerheli', './playerheli.js'],
  ['shops', './shops.js'],
  ['garage', './garage.js'],
  ['daynight', './daynight.js'],
  ['oldtown', './oldtown.js'],
  ['policeai', './policeai.js'],
  ['harborwar', './missions3.js'],
  ['activities', './activities.js'],
  ['airportjob', './missions4.js'],
  ['boats', './boats.js'],
  ['seaplane', './seaplane.js'],
  ['weather', './weather.js'],
  ['casino', './casino.js'],
  ['properties', './properties.js'],
  ['territories', './territories.js'],
  ['casinoheist', './missions5.js'],
  ['douradorevenge', './missions6.js'],
  ['coralcrown', './missions7.js'],
  ['solmarlegacy', './missions8.js'],
  ['donsgambit', './missions9.js'],
  ['viceking', './missions10.js'],
  ['kingpin', './missions11.js'],
  ['empire', './empire.js'],
  ['heat', './heat.js'],
  ['cartel', './cartel.js'],
  ['fishing', './fishing.js'],
];

function pascal(name) {
  return name.replace(/(^|[^a-zA-Z0-9])([a-zA-Z0-9])/g, (_, __, c) => c.toUpperCase());
}

// Fallback world builder, used only if world.js cannot be imported. Mirrors the
// shared-state section of the Round 11 brief. currentVehicle() checks the
// boarded flag first (v12 fix): a merely-present heli/seaplane state object
// must never count as "aboard".
function buildFallbackWorld(rng) {
  const player = {
    position: new THREE.Vector3(58, 0, 29),
    heading: 0,
    speed: 0,
    onFoot: true,
    health: 100,
    mesh: null,
    currentCar: null,
    currentBike: null,
    currentBoat: null,
    currentJetSki: null,
    currentVehicle() {
      if (this.currentCar) return this.currentCar;
      if (this.currentBike) return this.currentBike;
      if (this.currentBoat) return this.currentBoat;
      if (this.currentJetSki) return this.currentJetSki;
      return null;
    },
  };
  return {
    rng,
    config: { seed },
    scene: null,
    camera: null,
    renderer: null,
    player,
    cars: [],
    bikes: [],
    boats: [],
    jetSkis: [],
    seaplane: { mesh: null, position: new THREE.Vector3(320, 0, 200), heading: 0, speed: 0, altitude: 0, onWater: true, boarded: false },
    playerHeli: { mesh: null, position: new THREE.Vector3(29, 78, 29), heading: 0, speed: 0, altitude: 0, rotor: 0, onGround: true, boarded: false },
    playerBoat: null,
    playerBike: null,
    pedestrians: [],
    crewMembers: [],
    federalAgents: [],
    cartelHitmen: [],
    enemies: [],
    gangShooters: [],
    wanted: 0,
    heat: 0,
    cartelThreat: 0,
    cash: 500,
    armor: 0,
    nos: 100,
    tireDamage: 0,
    mission: { id: 0, stage: 0, objective: '', marker: null, timer: 0 },
    completedMissions: [],
    elapsed: 0,
    timeOfDay: 12,
    mode: 'menu',
    input: { keys: new Set(), justPressed: new Set(), mouseDown: false, muteToggle: false, radioNext: false },
    events: [],
    city: null,
    properties: { list: [], income: 0, lastPayout: 0 },
    territories: { districts: [] },
    heist: { progress: '' },
    revenge: { progress: '' },
    crown: { progress: '', informantMet: false, vaultCracked: false, betrayalSurvived: false, donDefeated: false },
    legacy: { progress: '', protectionCollected: 0, ledgerStolen: false, blockadeBroken: false, legacySecured: false },
    gambit: { progress: '', fedsEvaded: false, moneyMoved: false, moleExposed: false, gambitWon: false },
    vice: { progress: '', casinoRigged: false, highRollerWon: false, havanaRunDone: false, viceKingCrowned: false, casinoWinnings: 0, leaguePoints: 0, leagueWins: 0, nightclubIncome: 0 },
    kingpin: { progress: '', shipmentSeized: false, informantProtected: false, siegeSurvived: false, kingpinCrowned: false, cartelThreat: 0, fishingBestCatch: '', jetSkiBestTime: 0 },
    crew: { hired: [], posts: {} },
    garage: { ownedCars: [], upgrades: {} },
    empire: { income: 0, posts: {}, rivalThreat: 0 },
    heatState: { level: 0, lastCrime: 0, raidTimer: 0 },
    combat: { weapon: 'Pistol', ammo: 60 },
    fishing: { rodInHand: false, waiting: false, spots: [] },
    jetski: { riding: false, speed: 0 },
    vehicles: null,
    daynight: { hours: 12 },
    weather: { raining: false, fog: 0 },
    audioStation: 'Coral FM',
    currentDistrict: 'Downtown',
    activity: { text: '' },
    systems: [],
    systemObjects: {},
    saveVersion: 9,
  };
}

function fallbackRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3dd, 300, 900);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(58, 8, 45);
  const sun = new THREE.DirectionalLight(0xffe0b3, 2.2);
  sun.position.set(200, 300, 100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  return {
    renderer, scene, camera, sun, hemi,
    resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    },
    render() { renderer.render(scene, camera); },
    update() {},
  };
}

async function boot() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');

  // RNG: createRng must return a CALLABLE function (Round 12 contract).
  let rng = null;
  try {
    const randomMod = await import('./random.js');
    const makeRng = randomMod.createRandom || randomMod.createRng || randomMod.default;
    rng = makeRng ? makeRng(seed) : null;
  } catch { rng = null; }
  if (typeof rng !== 'function') {
    let s = seed >>> 0;
    const fallback = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    fallback.range = (a, b) => a + fallback() * (b - a);
    fallback.pick = (arr) => arr[Math.floor(fallback() * arr.length)];
    rng = fallback;
  }
  // Prove the rng is callable before anything else uses it.
  const probe = rng();
  if (typeof probe !== 'number') throw new Error('rng() did not return a number');

  // World: prefer W1's world.js; fall back to the inline builder.
  let world = null;
  try {
    const worldMod = await import('./world.js');
    const makeWorld = worldMod.createWorld || worldMod.default;
    if (makeWorld) world = makeWorld(rng);
  } catch { world = null; }
  if (!world || !world.player || !world.player.position) world = buildFallbackWorld(rng);
  world.rng = rng;
  world.systems = [];
  world.systemObjects = {};
  if (!world.input) world.input = { keys: new Set(), justPressed: new Set(), mouseDown: false };
  if (!Array.isArray(world.events)) world.events = [];

  // Renderer: use W1's render.js scene + camera; never a second scene.
  let renderHandle = null;
  try {
    const renderMod = await import('./render.js');
    const makeRenderer = renderMod.createRenderer || renderMod.default;
    if (makeRenderer) renderHandle = makeRenderer(canvas);
  } catch { renderHandle = null; }
  if (!renderHandle || !renderHandle.scene || !renderHandle.camera) {
    renderHandle = fallbackRenderer(canvas);
  }
  world.scene = renderHandle.scene;
  world.camera = renderHandle.camera;
  world.renderer = renderHandle.renderer;
  const scene = renderHandle.scene;
  const camera = renderHandle.camera;

  window.addEventListener('resize', () => {
    if (renderHandle.resize) renderHandle.resize();
  });

  const audio = createAudio(world);
  const input = createInput(world, canvas);
  const hud = createHud(world);
  world.input.keys = input.keys;
  world.input.justPressed = input.justPressed;

  // wire(): tries (scene, world) first, then (world). Traffic gets city as
  // 3rd arg. Results go to world.systems (array) / world.systemObjects —
  // NEVER onto a world state field.
  let city = null;
  async function wire(name, path) {
    let mod = null;
    try {
      mod = await import(path);
    } catch (err) {
      console.warn('[wire] missing module', name, path, err && err.message);
      return null;
    }
    const candidates = [
      mod['create' + pascal(name)],
      mod.default,
      mod[name],
    ];
    let factory = null;
    for (const c of candidates) if (typeof c === 'function') { factory = c; break; }
    if (!factory) {
      const fns = Object.values(mod).filter((v) => typeof v === 'function');
      if (fns.length === 1) factory = fns[0];
    }
    if (!factory) {
      console.warn('[wire] no factory in', name);
      return null;
    }
    let sys = null;
    try {
      if (name === 'traffic') sys = factory(scene, world, city);
      else sys = factory(scene, world);
    } catch (err1) {
      try {
        sys = name === 'traffic' ? factory(world, city) : factory(world);
      } catch (err2) {
        console.warn('[wire] factory failed', name, err2 && err2.message, '| first:', err1 && err1.message);
        return null;
      }
    }
    if (sys) {
      world.systems.push(sys);
      world.systemObjects[name] = sys;
    }
    return sys;
  }

  // City FIRST so world.city (roads + colliders) exists for every later system.
  const citySys = await wire('city', './city.js');
  city = citySys && citySys.roads ? citySys : (world.city || null);
  if (city) world.city = city;

  for (const [name, path] of STEP_ORDER) {
    if (name === 'city') continue;
    await wire(name, path);
  }

  // Re-assert the wiring contracts after every system has run.
  if (!Array.isArray(world.systems)) world.systems = [];
  if (!world.player || !world.player.position) {
    const fresh = buildFallbackWorld(rng);
    world.player = fresh.player;
  }
  // Keep the render handle reachable for later systems (weather, day/night).
  world.renderHandle = renderHandle;
  if (world.daynight && typeof world.daynight.hours !== 'number') {
    world.daynight.hours = world.timeOfDay || 12;
  }

  const shots = createShots(world, {
    canvas,
    render() { draw(); },
    step(dt) { stepWorld(dt); },
    setTime(hours) {
      world.timeOfDay = hours;
      // The day/night system owns the clock (state.timeOfDay); the old
      // hook only wrote world.timeOfDay, which the next step overwrote
      // back to morning — so sunset shots rendered at 10:00. Drive the
      // real clock so the shot's dusk/sunset actually shows.
      const dn = world.systemObjects && world.systemObjects.daynight;
      if (dn && typeof dn.setTime === 'function') dn.setTime(hours);
      if (world.daynight) {
        world.daynight.timeOfDay = hours;
        world.daynight.hours = hours;
      }
    },
  });
  window.__shots = shots;
  window.__solmar = { world, shots, audio, hud, input };

  function stepWorld(dt) {
    world.elapsed = (world.elapsed || 0) + dt;
    if (world.daynight && typeof world.daynight.hours === 'number') {
      world.daynight.hours = (world.daynight.hours + dt / 240) % 24;
      world.timeOfDay = world.daynight.hours;
    }
    for (const sys of world.systems) {
      if (!sys) continue;
      try {
        if (typeof sys.update === 'function') sys.update(dt);
        else if (typeof sys === 'function') sys(dt);
      } catch (err) {
        console.error('[system] update failed', err);
      }
    }
    if (audio) audio.update(dt);
  }

  function updateCamera(dt) {
    const p = world.player && world.player.position;
    if (!p) return;
    const heading = world.player.heading || 0;
    const back = 10;
    const up = 6;
    const tx = p.x - Math.sin(heading) * back;
    const tz = p.z - Math.cos(heading) * back;
    const ty = (p.y || 0) + up;
    const k = 1 - Math.pow(0.001, dt);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (ty - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    camera.lookAt(p.x, (p.y || 0) + 1.6, p.z);
  }

  function draw() {
    // Pass the world through: render.update(dt, world) is what runs the
    // follow camera (follow(world.player)) and the time-of-day sun. With
    // no args it never followed, so shot frames stayed at boot position.
    if (renderHandle.update) renderHandle.update(STEP, world);
    if (renderHandle.render) renderHandle.render();
    else if (renderHandle.renderer) renderHandle.renderer.render(scene, camera);
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  function showMenu(show) {
    const menu = document.getElementById('menu');
    if (menu) menu.style.display = show ? 'flex' : 'none';
  }

  function showPause(show) {
    const pause = document.getElementById('pause-overlay');
    if (pause) pause.style.display = show ? 'flex' : 'none';
  }

  function startGame() {
    world.mode = 'play';
    showMenu(false);
    showPause(false);
    audio.unlock();
    announce('Playing. Rico Vega is on the streets of Solmar City.');
    hud.toast('Welcome to Solmar City — steal a car, take a mission, become Kingpin.');
  }

  function togglePause() {
    if (world.mode === 'play') {
      world.mode = 'pause';
      showPause(true);
      announce('Paused.');
    } else if (world.mode === 'pause') {
      world.mode = 'play';
      showPause(false);
      announce('Playing.');
    }
  }

  function stepFrame(dt) {
    if (world.mode !== 'play') return;
    if (input.pressed('KeyM') || world.input.muteToggle) {
      audio.toggleMute();
      world.input.muteToggle = false;
    }
    if (input.pressed('KeyC') || world.input.radioNext) {
      world.audioStation = audio.nextStation();
      hud.toast('Radio: ' + world.audioStation);
      world.input.radioNext = false;
    }
    stepWorld(dt);
    hud.update(dt);
  }

  if (shotParam) {
    world.mode = 'play';
    showMenu(false);
    const result = shots.capture(shotParam);
    void result;
    // The shot path used to return before the frame loop ever ran, so the
    // follow camera never moved. Settle it onto the player now: the lerp
    // closes ~11% per STEP, so 60 settles land it on the target.
    // hud.update also never ran in shot mode, so the wanted stars,
    // objective line and minimap would have stayed at boot values.
    for (let i = 0; i < 60; i += 1) updateCamera(STEP);
    hud.update(STEP);
    draw();
    requestAnimationFrame(() => {
      for (let i = 0; i < 60; i += 1) updateCamera(STEP);
      hud.update(STEP);
      draw();
      window.__shotReady = true;
    });
    return;
  }

  // Menu / start flow.
  showMenu(true);
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', () => { audio.unlock(); startGame(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.mode === 'play') togglePause();
  });

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) togglePause();
    if ((actions & ACTION_CONFIRM) && world.mode === 'menu') startGame();
    else if ((actions & ACTION_CONFIRM) && world.mode === 'over') startGame();
    if (world.mode === 'menu' || world.mode === 'play') {
      while (accumulator >= STEP && (world.mode === 'menu' || world.mode === 'play')) {
        if (world.mode === 'play') stepFrame(STEP);
        else stepWorld(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    updateCamera(STEP);
    draw();
    input.endFrame();
  }

  announce('Solmar City. Press Space or click Start to play.');
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error('[boot] failed', err);
  const status = document.getElementById('status');
  if (status) status.textContent = 'Solmar City failed to start: ' + (err && err.message);
});
