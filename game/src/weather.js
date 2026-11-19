// Solmar City — weather: rain and fog events, storms at night, wet grip.
// Rain cuts driving grip; fog shortens view distance. The state lives on
// world.weather (plain data); the system object goes into world.systems.
import * as THREE from 'three';

const RAIN_DROPS = 500;
const RAIN_AREA = 90;
const RAIN_HEIGHT = 45;

function resolveArgs(scene, world) {
  if (!world) {
    world = scene;
    scene = (world && world.scene) || null;
  }
  return { scene, world };
}

function rngOf(world) {
  const r = world.rng;
  if (typeof r === 'function') return r;
  if (r && typeof r.next === 'function') return () => r.next();
  return Math.random;
}

export function createWeather(scene, world) {
  ({ scene, world } = resolveArgs(scene, world));
  if (!world) throw new Error('createWeather needs a world');
  if (!Array.isArray(world.systems)) world.systems = [];
  world.systemObjects = world.systemObjects || {};
  const rng = rngOf(world);

  const state = {
    kind: 'clear', // clear | rain | fog | storm
    rain: 0, // 0-1 current rain intensity (smoothed)
    fog: 0, // 0-1 current fog amount (smoothed)
    grip: 1, // driving grip multiplier: 1 dry, 0.72 in rain
    storm: false,
    lightning: 0, // 0-1 flash brightness; spikes during a storm
    targetRain: 0,
    targetFog: 0,
  };
  world.weather = state;
  world.grip = 1;

  const hasScene = scene && typeof scene.add === 'function';
  let rainPoints = null;
  let rainMat = null;
  let rainPos = null;
  let rainVel = null;

  if (hasScene) {
    rainPos = new Float32Array(RAIN_DROPS * 3);
    rainVel = new Float32Array(RAIN_DROPS);
    for (let i = 0; i < RAIN_DROPS; i += 1) {
      rainPos[i * 3] = (rng() - 0.5) * RAIN_AREA;
      rainPos[i * 3 + 1] = rng() * RAIN_HEIGHT;
      rainPos[i * 3 + 2] = (rng() - 0.5) * RAIN_AREA;
      rainVel[i] = 28 + rng() * 14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    rainMat = new THREE.PointsMaterial({ color: 0xaec6e8, size: 0.35, transparent: true, opacity: 0 });
    rainPoints = new THREE.Points(geo, rainMat);
    rainPoints.visible = false;
    scene.add(rainPoints);
    if (!scene.fog) scene.fog = new THREE.Fog(0xa8c4de, 120, 900);
  }

  let changeTimer = 55 + rng() * 60; // seconds until the next weather roll

  function isNight() {
    if (world.daynight && typeof world.daynight.isNight === 'boolean') return world.daynight.isNight;
    if (world.isNight !== undefined) return !!world.isNight;
    return false;
  }

  function setWeather(kind) {
    if (kind === 'rain') {
      state.kind = 'rain';
      state.targetRain = 0.85;
      state.targetFog = 0.15;
      state.storm = false;
    } else if (kind === 'fog') {
      state.kind = 'fog';
      state.targetRain = 0;
      state.targetFog = 0.9;
      state.storm = false;
    } else if (kind === 'storm') {
      state.kind = 'storm';
      state.targetRain = 1;
      state.targetFog = 0.45;
      state.storm = true;
    } else {
      state.kind = 'clear';
      state.targetRain = 0;
      state.targetFog = 0;
      state.storm = false;
    }
  }

  function startRain() {
    setWeather('rain');
  }

  function clear() {
    setWeather('clear');
  }

  function isRaining() {
    return state.rain > 0.25;
  }

  function rollWeather() {
    const roll = rng();
    if (roll < 0.55) setWeather('clear');
    else if (roll < 0.78) setWeather('rain');
    else if (roll < 0.92) setWeather('fog');
    else if (isNight()) setWeather('storm');
    else setWeather('rain');
    changeTimer = 50 + rng() * 90;
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    if (world.mode === 'pause' || world.mode === 'over') return;
    changeTimer -= dt;
    if (changeTimer <= 0) rollWeather();
    // Smooth transitions so rain/fog fade in and out instead of snapping.
    const k = Math.min(1, dt * 0.5);
    state.rain += (state.targetRain - state.rain) * k;
    state.fog += (state.targetFog - state.fog) * k;
    state.grip = 1 - state.rain * 0.28;
    world.grip = state.grip;
    // Storm lightning: a random flash every few seconds, decaying fast.
    if (state.storm && rng() < dt * 0.35) state.lightning = 1;
    else state.lightning = Math.max(0, state.lightning - dt * 2.5);
    if (!hasScene) return;
    const px = world.player && world.player.position ? world.player.position.x : 0;
    const pz = world.player && world.player.position ? world.player.position.z : 0;
    if (rainPoints) {
      rainPoints.visible = state.rain > 0.03;
      rainMat.opacity = state.rain * 0.75;
      rainPoints.position.set(px, 0, pz);
      for (let i = 0; i < RAIN_DROPS; i += 1) {
        rainPos[i * 3 + 1] -= rainVel[i] * dt;
        if (rainPos[i * 3 + 1] < 0) {
          rainPos[i * 3 + 1] = RAIN_HEIGHT;
          rainPos[i * 3] = (rng() - 0.5) * RAIN_AREA;
          rainPos[i * 3 + 2] = (rng() - 0.5) * RAIN_AREA;
        }
      }
      rainPoints.geometry.attributes.position.needsUpdate = true;
    }
    if (scene.fog) {
      // Fog closes in: near plane pulls closer as fog thickens.
      scene.fog.near = 140 - state.fog * 105;
      scene.fog.far = 900 - state.fog * 620;
    }
  }

  const system = { name: 'weather', state, update, setWeather, startRain, clear, isRaining, rollWeather };
  world.systems.push(system);
  world.systemObjects.weather = system;
  return system;
}

export default createWeather;
