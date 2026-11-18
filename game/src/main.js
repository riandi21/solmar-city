// Boot and the one loop for Solmar City: builds the world, loads every system,
// and moves between four screens — menu, play, pause, and over / busted.
//
// The loop advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one) and paints with a damped chase camera that looks ahead along the
// player's velocity. Every system is loaded with a guarded dynamic import, so
// a missing or broken module is logged and skipped instead of killing the boot;
// a tiny fallback city and player mesh keep the scene visible even then.
//
// ?seed=N fixes the random layout. ?shot=chase|drive|foot|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_SHOOT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
const STEP = 1 / 60;
/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
const SAVE_INTERVAL = 30;
const SAVE_KEY = 'solmar-city-save-v1';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

/** Mulberry32, the same shape as random.js: used only if that module is missing. */
function fallbackRandom(seedValue) {
  let a = seedValue | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Guarded dynamic import: returns the module, or null (and a console warning). */
async function loadModule(path) {
  try {
    return await import(path);
  } catch (error) {
    console.warn(`[main] could not load ${path}, continuing without it`, error);
    return null;
  }
}

/** Guarded factory call: returns the system, or null (and a console warning). */
function buildSystem(name, factory, ...args) {
  if (typeof factory !== 'function') return null;
  try {
    return factory(...args);
  } catch (error) {
    console.warn(`[main] ${name} failed to start, continuing without it`, error);
    return null;
  }
}

async function boot() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    if (status) status.textContent = message;
  }

  // --- Renderer, scene, camera: render.js owns all three when it can ---
  // createRenderer returns { renderer, scene, camera, update, render }; the
  // scene it builds already has the sky, sun and hemisphere light. Only when
  // it is missing or unusable does main.js build its own, with the same shape.
  let renderer = null;
  let renderHandle = null;
  let scene = null;
  let camera = null;
  const renderModule = await loadModule('./render.js');
  if (renderModule && typeof renderModule.createRenderer === 'function') {
    try {
      const made = renderModule.createRenderer(canvas);
      if (made && made.renderer && made.scene && made.camera) {
        renderHandle = made;
        renderer = made.renderer;
        scene = made.scene;
        camera = made.camera;
      } else console.warn('[main] render.js returned an incomplete handle, building a renderer directly');
    } catch (error) {
      console.warn('[main] createRenderer failed, building a renderer directly', error);
    }
  }
  if (!renderer) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b5d6);
    scene.fog = new THREE.Fog(0x9fc3dd, 120, 700);
    camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1500);
    camera.position.set(0, 40, 90);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Lights and sky, unless render.js already put some in the scene.
    if (!scene.children.some((child) => child.isLight)) {
      const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
      sun.position.set(120, 200, 60);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -280;
      sun.shadow.camera.right = 280;
      sun.shadow.camera.top = 280;
      sun.shadow.camera.bottom = -280;
      sun.shadow.camera.far = 600;
      scene.add(sun);
      scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9));
    }
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // --- Seeded random ---
  let rng = fallbackRandom(seed);
  const randomModule = await loadModule('./random.js');
  if (randomModule && typeof randomModule.createRandom === 'function') {
    try {
      rng = randomModule.createRandom(seed);
    } catch {
      // Keep the fallback rng.
    }
  }

  // --- The shared world object every system reads and writes ---
  const playerGroup = new THREE.Group();
  scene.add(playerGroup);
  const world = {
    scene,
    camera,
    renderer,
    rng,
    config: { seed },
    player: {
      pos: new THREE.Vector3(0, 0, 60),
      heading: 0,
      speed: 0,
      onFoot: true,
      health: 100,
      mesh: playerGroup,
      car: null,
      cash: 0,
    },
    cars: [],
    peds: [],
    wanted: 0,
    cash: 0,
    mission: { id: 0, stage: 0, objective: 'Steal a car and get moving', marker: null, timer: 0 },
    time: 0,
    mode: 'menu',
    input: null, // filled in below, once input exists
    events: [],
    systems: {},
    hud: null,
  };

  // --- Systems (each guarded: a missing one is skipped, never fatal) ---
  const cityModule = await loadModule('./city.js');
  const city = buildSystem('city', cityModule?.createCity, scene, rng);
  if (city) {
    world.systems.city = city;
    world.city = city; // missions resolve district spots from the city
  } else buildFallbackCity(scene);

  const playerModule = await loadModule('./player.js');
  const playerSystem = buildSystem('player', playerModule?.createPlayer, scene, world);
  if (playerSystem) world.systems.player = playerSystem;
  else buildFallbackPlayer(world);

  const vehiclesModule = await loadModule('./vehicles.js');
  const vehicles = buildSystem('vehicles', vehiclesModule?.createVehicles, scene, world);
  if (vehicles) world.systems.vehicles = vehicles;

  const trafficModule = await loadModule('./traffic.js');
  const traffic = buildSystem('traffic', trafficModule?.createTraffic, scene, world, city);
  if (traffic) world.systems.traffic = traffic;

  const policeModule = await loadModule('./police.js');
  const police = buildSystem('police', policeModule?.createPolice, scene, world);
  if (police) world.systems.police = police;

  // v2: police helicopter (4+ stars) and shops + safehouse. Both are
  // guarded like the rest: a missing module is skipped, never fatal.
  const heliModule = await loadModule('./heli.js');
  const helicopter = buildSystem('helicopter', heliModule?.createHelicopter, scene, world);
  if (helicopter) world.systems.helicopter = helicopter;

  const shopsModule = await loadModule('./shops.js');
  const shops = buildSystem('shops', shopsModule?.createShops, scene, world);
  if (shops) world.systems.shops = shops;

  const missionsModule = await loadModule('./missions.js');
  const missions = buildSystem('missions', missionsModule?.createMissions, world);
  if (missions) world.systems.missions = missions;

  const combatModule = await loadModule('./combat.js');
  const combat = buildSystem('combat', combatModule?.createCombat, scene, world);
  if (combat) world.systems.combat = combat;

  const hudModule = await loadModule('./hud.js');
  const hud = buildSystem('hud', hudModule?.createHud);
  if (hud) {
    world.systems.hud = hud;
    world.hud = hud;
  }

  const saveModule = await loadModule('./save.js');
  const save = buildSystem('save', saveModule?.createSave);
  // Shops reach the save system through world.systems.save (safehouse save).
  if (save) world.systems.save = save;

  // --- Input + audio ---
  const input = createInput(canvas);
  world.input = input;
  const audio = createAudio();
  world.audio = audio;

  // --- HUD: the hud system owns it when present, else this fallback ---
  const hudEls = {
    hud: document.getElementById('hud'),
    cash: document.getElementById('cash'),
    healthFill: document.getElementById('health-fill'),
    stars: document.getElementById('stars'),
    objective: document.getElementById('objective'),
    speed: document.getElementById('speed'),
    message: document.getElementById('message'),
    minimap: document.getElementById('minimap'),
  };
  let messageTimer = null;
  function showMessage(text) {
    if (hud) {
      try {
        hud.showMessage(text);
        return;
      } catch {
        // Fall through to the DOM fallback.
      }
    }
    if (!hudEls.message) return;
    hudEls.message.textContent = text;
    hudEls.message.style.opacity = '1';
    if (messageTimer) window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      hudEls.message.style.opacity = '0';
    }, 3500);
  }
  function drawMinimapFallback() {
    const map = hudEls.minimap;
    if (!map) return;
    const ctx2d = map.getContext('2d');
    if (!ctx2d) return;
    const size = 200;
    const scale = size / 560; // city spans about -280..280
    ctx2d.clearRect(0, 0, size, size);
    ctx2d.fillStyle = 'rgba(10, 24, 38, 0.85)';
    ctx2d.fillRect(0, 0, size, size);
    // Roads.
    ctx2d.strokeStyle = 'rgba(220, 225, 235, 0.55)';
    ctx2d.lineWidth = 2;
    for (let i = -4; i <= 4; i += 1) {
      const c = 100 + i * 29;
      ctx2d.beginPath(); ctx2d.moveTo(c, 0); ctx2d.lineTo(c, size); ctx2d.stroke();
      ctx2d.beginPath(); ctx2d.moveTo(0, c); ctx2d.lineTo(size, c); ctx2d.stroke();
    }
    // Sea along the south edge, marina on the east.
    ctx2d.fillStyle = 'rgba(64, 140, 200, 0.8)';
    ctx2d.fillRect(0, size - 8, size, 8);
    ctx2d.fillRect(size - 8, 0, 8, size);
    const dot = (x, z, color, r) => {
      ctx2d.fillStyle = color;
      ctx2d.beginPath();
      ctx2d.arc(100 + x * scale, 100 + z * scale, r, 0, Math.PI * 2);
      ctx2d.fill();
    };
    if (world.mission.marker) dot(world.mission.marker.x, world.mission.marker.z, '#ffd34d', 5);
    for (const car of world.cars) {
      dot(car.pos.x, car.pos.z, car.kind === 'police' ? '#5aa2ff' : '#e8e8e8', 2.5);
    }
    // Player arrow, pointing along the heading.
    const px = 100 + world.player.pos.x * scale;
    const pz = 100 + world.player.pos.z * scale;
    ctx2d.save();
    ctx2d.translate(px, pz);
    ctx2d.rotate(Math.atan2(Math.sin(world.player.heading), Math.cos(world.player.heading)) + Math.PI);
    ctx2d.fillStyle = '#ffd34d';
    ctx2d.beginPath();
    ctx2d.moveTo(0, -7);
    ctx2d.lineTo(5, 6);
    ctx2d.lineTo(-5, 6);
    ctx2d.closePath();
    ctx2d.fill();
    ctx2d.restore();
  }
  function updateHudFallback() {
    if (!hudEls.hud) return;
    if (hudEls.cash) hudEls.cash.textContent = `$${Math.floor(world.cash).toLocaleString('en-US')}`;
    if (hudEls.healthFill) {
      hudEls.healthFill.style.width = `${Math.max(0, Math.min(100, world.player.health))}%`;
      hudEls.healthFill.style.background = world.player.health > 50 ? '#58d68d' : world.player.health > 25 ? '#f2c94c' : '#e5534b';
    }
    if (hudEls.stars) {
      hudEls.stars.textContent = '★'.repeat(world.wanted) + '☆'.repeat(Math.max(0, 5 - world.wanted));
      hudEls.stars.style.color = world.wanted > 0 ? '#ffd34d' : 'rgba(255,255,255,0.35)';
    }
    if (hudEls.objective) hudEls.objective.textContent = world.mission.objective || '';
    if (hudEls.speed) {
      const kmh = Math.abs(world.player.speed || 0) * 3.6;
      hudEls.speed.textContent = world.player.onFoot ? 'On foot' : `${Math.round(kmh)} km/h`;
    }
    drawMinimapFallback();
  }
  function updateHud() {
    if (hud) {
      try {
        hud.update(world);
        return;
      } catch (error) {
        console.warn('[main] hud.update failed, using the fallback', error);
      }
    }
    updateHudFallback();
  }

  // --- Screens (DOM panels over the canvas) ---
  const screens = {
    menu: document.getElementById('menu'),
    pause: document.getElementById('pause-screen'),
    over: document.getElementById('over-screen'),
    busted: document.getElementById('busted-screen'),
  };
  function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) {
      if (el) el.classList.toggle('hidden', key !== name);
    }
    if (hudEls.hud) hudEls.hud.classList.toggle('hidden', name === 'menu');
  }
  function setMode(mode) {
    world.mode = mode;
    if (mode === 'menu') showScreen('menu');
    else if (mode === 'pause') showScreen('pause');
    else if (mode === 'over') showScreen('over');
    else if (mode === 'busted') showScreen('busted');
    else showScreen(null);
  }

  // --- Save / load ---
  function readSave() {
    try {
      if (save) return save.load();
    } catch {
      // Fall through to raw localStorage.
    }
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function writeSave() {
    try {
      if (save) {
        save.save(world);
        return;
      }
    } catch {
      // Fall through to raw localStorage.
    }
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: world.cash,
        missionsDone: world.missionsDone || [],
        playerPos: [world.player.pos.x, world.player.pos.y, world.player.pos.z],
      }));
    } catch {
      // Storage can be off (private windows): the save then lasts this visit only.
    }
  }
  function applySave(data) {
    if (!data) return;
    if (typeof data.cash === 'number') world.cash = data.cash;
    if (Array.isArray(data.missionsDone)) world.missionsDone = data.missionsDone;
    if (Array.isArray(data.playerPos) && data.playerPos.length >= 3) {
      world.player.pos.set(data.playerPos[0], data.playerPos[1], data.playerPos[2]);
      if (world.player.mesh) world.player.mesh.position.copy(world.player.pos);
    } else if (data.playerPos && typeof data.playerPos.x === 'number' && typeof data.playerPos.z === 'number') {
      world.player.pos.set(data.playerPos.x, 0, data.playerPos.z);
      if (world.player.mesh) world.player.mesh.position.copy(world.player.pos);
    }
  }

  // --- One fixed simulation step ---
  // Same order as shots.js staging, so staged scenes play identically.
  const stepOrder = ['city', 'player', 'vehicles', 'traffic', 'police', 'missions', 'combat', 'helicopter', 'shops'];
  function stepWorld(dt) {
    for (const name of stepOrder) {
      const system = world.systems[name];
      if (system && typeof system.update === 'function') {
        try {
          system.update(dt);
        } catch (error) {
          console.warn(`[main] ${name}.update failed`, error);
          delete world.systems[name];
        }
      }
    }
    world.time += dt;
  }

  // Cross-system events: crimes, mission results, busted, death.
  function drainEvents() {
    if (!world.events || world.events.length === 0) return;
    const batch = world.events.splice(0, world.events.length);
    for (const event of batch) {
      if (event.type === 'mission-complete') {
        const reward = (event.data && event.data.reward) || event.reward || 0;
        audio.jingle();
        showMessage(`Mission complete — $${reward} banked.`);
        announce(`Mission complete. ${world.mission.objective}`);
        writeSave();
      } else if (event.type === 'mission-failed') {
        showMessage('Mission failed.');
      } else if (event.type === 'busted') {
        enterBusted();
      } else if (event.type === 'crime') {
        audio.siren(true);
      }
    }
  }

  // --- Chase camera: damped, with drag orbit and look-ahead along velocity ---
  let camYaw = 0; // drag orbit, radians, eases back to 0
  let camPitch = 0;
  const camPos = new THREE.Vector3(0, 40, 90);
  function updateCamera(dt) {
    const player = world.player;
    camYaw -= (input.mouseDX * 0.005);
    camPitch = Math.max(-0.5, Math.min(0.45, camPitch + input.mouseDY * 0.003));
    camYaw *= Math.pow(0.02, dt); // ease the orbit back behind the player
    const heading = player.heading + camYaw;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const distance = player.onFoot ? 9 : 13;
    const height = player.onFoot ? 4 : 5.5;
    const wanted = player.pos.clone()
      .addScaledVector(forward, -distance)
      .add(new THREE.Vector3(0, height + camPitch * 6, 0));
    const damp = 1 - Math.exp(-dt * 5);
    camPos.lerp(wanted, damp);
    camera.position.copy(camPos);
    const look = player.pos.clone().addScaledVector(forward, player.onFoot ? 4 : 10);
    look.y = player.pos.y + 1.6;
    camera.lookAt(look);
  }

  // Slow orbit over the city behind the menu.
  let menuAngle = 0;
  function updateMenuCamera(dt) {
    menuAngle += dt * 0.05;
    camera.position.set(Math.sin(menuAngle) * 180, 90, Math.cos(menuAngle) * 180);
    camera.lookAt(0, 0, 0);
  }

  // --- Mode transitions ---
  let saveTimer = 0;
  function startGame(fromSave) {
    audio.start();
    if (fromSave) {
      applySave(readSave());
      // Pick up where the debt left off: the next mission not yet done.
      const done = world.missionsDone || [];
      const next = [1, 2, 3, 4, 5, 6, 7, 8].find((id) => !done.includes(id));
      if (next && missions && typeof missions.startMission === 'function') {
        try {
          missions.startMission(next);
        } catch {
          // Missions are optional at boot.
        }
      }
      showMessage('Welcome back to Solmar City.');
    } else {
      world.cash = 0;
      world.wanted = 0;
      world.missionsDone = [];
      world.player.health = 100;
      world.player.pos.set(0, 0, 60);
      world.player.heading = 0;
      if (world.player.mesh) world.player.mesh.position.copy(world.player.pos);
      if (missions && typeof missions.startMission === 'function') {
        try {
          missions.startMission(1);
        } catch {
          // Missions are optional at boot.
        }
      }
      showMessage('Rico Vega owes Madame Coral $5,000. Get to work.');
    }
    saveTimer = 0;
    setMode('play');
    announce('Playing. Steal a car, follow the marker, mind the police.');
  }
  function enterOver() {
    setMode('over');
    audio.engine(0);
    audio.siren(false);
    writeSave();
    announce(`Wasted. Rico is down. Cash $${Math.floor(world.cash)}.`);
  }
  function enterBusted() {
    const fine = Math.min(200, world.cash);
    world.cash -= fine;
    world.wanted = 0;
    if (police && typeof police.clearWanted === 'function') {
      try {
        police.clearWanted();
      } catch {
        // Already cleared above.
      }
    }
    audio.siren(false);
    setMode('busted');
    writeSave();
    announce(`Busted. The Solmar PD took $${fine} and dropped Rico at the station.`);
  }

  // --- Buttons ---
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', () => startGame(false));
  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn) {
    const hasSave = readSave() !== null;
    continueBtn.classList.toggle('hidden', !hasSave);
    continueBtn.addEventListener('click', () => startGame(true));
  }
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => startGame(false));
  const bustedRestartBtn = document.getElementById('busted-restart-btn');
  if (bustedRestartBtn) bustedRestartBtn.addEventListener('click', () => startGame(false));
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => setMode('play'));

  // --- The loop ---
  let accumulator = 0;
  let last = performance.now();
  let prevPause = false;
  let prevMute = false;
  let prevRadio = false;

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // One-shot keys, edge-detected against the previous frame.
    const pauseDown = input.any('KeyP', 'Escape');
    if (pauseDown && !prevPause) {
      if (world.mode === 'play') {
        setMode('pause');
        announce('Paused.');
      } else if (world.mode === 'pause') {
        setMode('play');
        announce('Playing.');
      }
    }
    prevPause = pauseDown;

    const muteDown = input.any('KeyM');
    if (muteDown && !prevMute) {
      audio.setMuted(!audio.muted);
      showMessage(audio.muted ? 'Sound off (M to turn back on).' : 'Sound on.');
    }
    prevMute = muteDown;

    // C switches the car radio station (edge-detected, play mode only).
    const radioDown = input.any('KeyC');
    if (radioDown && !prevRadio && world.mode === 'play') {
      if (audio && typeof audio.nextStation === 'function') {
        const name = audio.nextStation();
        showMessage(name ? `Radio: ${name}` : 'Radio switched.');
      }
    }
    prevRadio = radioDown;

    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (world.mode === 'menu') startGame(false);
      else if (world.mode === 'over' || world.mode === 'busted') startGame(false);
      else if (world.mode === 'pause') setMode('play');
    }

    if (world.mode === 'menu') {
      updateMenuCamera(frameDt);
      accumulator = 0;
    } else if (world.mode === 'play') {
      accumulator += frameDt;
      while (accumulator >= STEP) {
        // Combat owns its own one-shots (click to shoot, F to punch, 1/2 to
        // switch weapon) and reads world.input.clicked itself — main only
        // plays the shot sound when there is no combat system at all.
        if (!combat && input.consumeClick()) audio.shot();

        stepWorld(STEP);
        accumulator -= STEP;
        drainEvents();
        if (world.mode !== 'play') break; // a step ended the run (busted / over)
        if (world.player.health <= 0) {
          enterOver();
          break;
        }
        saveTimer += STEP;
        if (saveTimer >= SAVE_INTERVAL) {
          saveTimer = 0;
          writeSave();
        }
      }
      // The player system drives the chase camera itself (orbit + damping);
      // main's camera only runs when there is no player system to do it.
      if (!world.systems.player) updateCamera(frameDt);
      audio.engine(world.player.onFoot ? 0 : Math.min(1, Math.abs(world.player.speed || 0) / 55));
      audio.siren(world.wanted > 0);
    } else {
      accumulator = 0;
      audio.engine(0);
      audio.siren(false);
    }

    updateHud();
    input.update();
    if (renderHandle && typeof renderHandle.update === 'function') renderHandle.update();
    if (renderHandle && typeof renderHandle.render === 'function') renderHandle.render();
    else renderer.render(scene, camera);
  }

  // Leaving the tab pauses a running game rather than letting it run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.mode === 'play') {
      setMode('pause');
      announce('Paused.');
    }
  });

  // --- Shot mode: stage the scene, paint twice, flag it ready ---
  if (shotName) {
    setMode('play');
    try {
      stageShot(shotName, world);
    } catch (error) {
      console.warn('[main] stageShot failed, painting the world as-is', error);
    }
    updateHud();
    let painted = 0;
    const paint = () => {
      if (renderHandle && typeof renderHandle.render === 'function') renderHandle.render();
      else renderer.render(scene, camera);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    };
    requestAnimationFrame(paint);
    announce(`Solmar City screenshot scene: ${shotName}.`);
    return;
  }

  setMode('menu');
  announce('Solmar City. Press Enter or click Start to play.');
  requestAnimationFrame(frame);
}

/** Last-resort ground and roads when city.js is missing: the game still shows. */
function buildFallbackCity(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ color: 0x9aa78a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  for (let i = -4; i <= 4; i += 1) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 14), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) road.position.set(0, 0.01, i * 58);
      else {
        road.rotation.z = Math.PI / 2;
        road.position.set(i * 58, 0.01, 0);
      }
      road.receiveShadow = true;
      scene.add(road);
    }
  }
  // A few downtown blocks so the skyline is not empty.
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x7d8aa0 });
  const boxGeo = new THREE.BoxGeometry(30, 40, 30);
  for (const [x, z] of [[-58, -58], [58, -58], [-58, 58], [58, 58], [0, -116]]) {
    const block = new THREE.Mesh(boxGeo, boxMat);
    block.position.set(x, 20, z);
    block.castShadow = true;
    scene.add(block);
  }
}

/** Last-resort low-poly person when player.js is missing. */
function buildFallbackPlayer(world) {
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.9, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0xd7263d }),
  );
  body.position.y = 1.1;
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8b98a }),
  );
  head.position.y = 2.1;
  head.castShadow = true;
  world.player.mesh.add(body, head);
  world.player.mesh.position.copy(world.player.pos);
}

boot().catch((error) => {
  console.error('[main] boot failed', error);
  const status = document.getElementById('status');
  if (status) status.textContent = 'Solmar City could not start. Please reload the page.';
});
