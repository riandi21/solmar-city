// Solmar City — day/night cycle: sun and moon, sky colour, lamps, clock.
// One full day lasts DAY_LENGTH_SECONDS; 06:00 is sunrise, 19:00 is dusk.
// The state lives on world.daynight (plain data); the system object goes
// into world.systems and world.systemObjects, never onto a state field.
import * as THREE from 'three';
import { DAY_LENGTH_SECONDS } from './config.js';

const DAY_SKY = new THREE.Color(0x87b5e0);
const DUSK_SKY = new THREE.Color(0xff9a5c);
const NIGHT_SKY = new THREE.Color(0x0a1026);
const DAY_FOG = new THREE.Color(0xa8c4de);
const NIGHT_FOG = new THREE.Color(0x0c1226);

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerpColor(out, a, b, t) {
  out.copy(a).lerp(b, t);
  return out;
}

function resolveArgs(scene, world) {
  if (!world) {
    world = scene;
    scene = (world && world.scene) || null;
  }
  return { scene, world };
}

function ensurePlayer(world) {
  if (!world.player) {
    world.player = {
      position: new THREE.Vector3(0, 0, 0),
      heading: 0,
      speed: 0,
      onFoot: true,
      health: 100,
      mesh: null,
      currentCar: null,
    };
  }
  const p = world.player.position;
  if (p && typeof p.x === 'number' && !(p instanceof THREE.Vector3)) {
    world.player.position = new THREE.Vector3(p.x, p.y || 0, p.z || 0);
  }
  return world.player;
}

export function createDayNight(scene, world) {
  ({ scene, world } = resolveArgs(scene, world));
  if (!world) throw new Error('createDayNight needs a world');
  if (!Array.isArray(world.systems)) world.systems = [];
  world.systemObjects = world.systemObjects || {};
  ensurePlayer(world);

  const dayLength = (world.config && world.config.dayLengthSeconds) || DAY_LENGTH_SECONDS;
  const state = {
    timeOfDay: 10.0, // hours, 0-24; morning start
    dayLength,
    isNight: false,
    phase: 'day', // dawn | day | dusk | night
    lampsOn: false,
    headlightsOn: false,
    sunElevation: 1,
    nightFactor: 0,
  };
  world.daynight = state;
  world.timeOfDay = state.timeOfDay;
  world.isNight = false;

  const hasScene = scene && typeof scene.add === 'function';
  let sun = null;
  let hemi = null;
  let moon = null;
  let stars = null;
  let starsMat = null;
  const skyColor = new THREE.Color().copy(DAY_SKY);
  const fogColor = new THREE.Color().copy(DAY_FOG);

  if (hasScene) {
    // Reuse the renderer's sun / hemisphere light when one is already in
    // the scene instead of adding a second sun.
    for (const child of scene.children) {
      if (!sun && child.isDirectionalLight) sun = child;
      if (!hemi && child.isHemisphereLight) hemi = child;
    }
    if (!sun) {
      sun = new THREE.DirectionalLight(0xffe6b0, 1.6);
      sun.castShadow = true;
      scene.add(sun);
    }
    if (!hemi) {
      hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f28, 0.7);
      scene.add(hemi);
    }
    // Stars: a dome of points, faded in at night.
    const starCount = 420;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.45 + 0.08;
      const r = 780;
      positions[i * 3] = Math.cos(a) * Math.cos(e) * r;
      positions[i * 3 + 1] = Math.sin(e) * r;
      positions[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, sizeAttenuation: false });
    stars = new THREE.Points(starGeo, starsMat);
    scene.add(stars);
    // Moon: a pale disc that crosses the sky opposite the sun.
    moon = new THREE.Mesh(
      new THREE.SphereGeometry(14, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe8ecf5 }),
    );
    moon.visible = false;
    scene.add(moon);
    if (!scene.fog) scene.fog = new THREE.Fog(0xa8c4de, 120, 900);
    scene.background = skyColor;
  }

  function hourOf() {
    return Math.floor(state.timeOfDay) % 24;
  }

  function isNight() {
    const h = state.timeOfDay;
    return h >= 19 || h < 6;
  }

  function isDay() {
    return !isNight();
  }

  function clockText() {
    const h = Math.floor(state.timeOfDay) % 24;
    const m = Math.floor((state.timeOfDay % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function skipToNight() {
    state.timeOfDay = 20.5;
  }

  function setTime(hours) {
    state.timeOfDay = ((hours % 24) + 24) % 24;
  }

  function applySky() {
    // Sun angle: 06:00 sunrise (0), 12:00 noon (PI/2), 18:00 sunset (PI).
    const angle = ((state.timeOfDay - 6) / 12) * Math.PI;
    const elev = Math.sin(angle);
    state.sunElevation = elev;
    // Smooth day factor: 1 at noon, 0 deep at night, no snap at dusk/dawn.
    const dayF = clamp01(elev * 2.2 + 0.25);
    const duskF = clamp01(1 - Math.abs(elev) * 4) * (elev > -0.25 ? 1 : 0);
    state.nightFactor = 1 - dayF;
    state.isNight = isNight();
    state.phase = state.isNight ? 'night' : duskF > 0.35 ? (state.timeOfDay < 12 ? 'dawn' : 'dusk') : 'day';
    state.lampsOn = state.nightFactor > 0.45;
    state.headlightsOn = state.lampsOn;
    world.isNight = state.isNight;
    world.timeOfDay = state.timeOfDay;

    if (!hasScene) return;
    const px = world.player.position.x;
    const pz = world.player.position.z;
    const sunDist = 420;
    sun.position.set(px + Math.cos(angle) * sunDist, Math.max(elev, -0.15) * sunDist + 40, pz + Math.sin(angle) * sunDist * 0.4);
    sun.target.position.set(px, 0, pz);
    if (sun.target.updateMatrixWorld) sun.target.updateMatrixWorld();
    sun.intensity = 0.12 + dayF * 1.5;
    sun.color.setHSL(0.09, 0.55, 0.55 + dayF * 0.2);
    if (hemi) hemi.intensity = 0.12 + dayF * 0.6;
    // Sky: day blue -> dusk orange near the horizon line -> night navy.
    lerpColor(skyColor, NIGHT_SKY, DAY_SKY, dayF);
    if (duskF > 0) skyColor.lerp(DUSK_SKY, duskF * 0.55);
    scene.background = skyColor;
    lerpColor(fogColor, NIGHT_FOG, DAY_FOG, dayF);
    if (scene.fog) {
      scene.fog.color.copy(fogColor);
      scene.fog.near = 140 - state.nightFactor * 40;
      scene.fog.far = 900 - state.nightFactor * 250;
    }
    if (starsMat) starsMat.opacity = state.nightFactor * 0.9;
    if (stars) stars.visible = state.nightFactor > 0.05;
    if (moon) {
      const moonAngle = angle + Math.PI;
      moon.position.set(px + Math.cos(moonAngle) * 500, Math.max(Math.sin(moonAngle), 0.05) * 380 + 30, pz + Math.sin(moonAngle) * 200);
      moon.visible = state.nightFactor > 0.25;
    }
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    if (world.mode === 'pause' || world.mode === 'over') return;
    state.timeOfDay = (state.timeOfDay + (dt / state.dayLength) * 24) % 24;
    applySky();
  }

  applySky();
  const system = { name: 'daynight', state, update, isNight, isDay, clockText, skipToNight, setTime, hour: hourOf };
  world.systems.push(system);
  world.systemObjects.daynight = system;
  return system;
}

export default createDayNight;
