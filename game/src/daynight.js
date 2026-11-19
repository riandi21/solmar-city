// Day / night cycle for Solmar City — the sun actually moves.
//
// The clock starts at 10:00 on a sunny morning and runs one game hour
// every 30 real seconds, so a full day takes twelve minutes of play.
// Dawn (06:00-08:00) and dusk (17:00-19:00) ramp the light smoothly;
// at night the sun drops to a faint moon-blue, the sky goes dark, the
// street lamps come on, and the player's car grows headlights. The HUD
// clock reads this system, and mission 10 ("Midnight Delivery") jumps
// the clock to midnight when it starts.
//
//   createDayNight(scene, world, lights) -> { update, state, clockText,
//     isNight, nightFactor, setTime, skipToNight, skipToDay }
// `lights` is { sun, hemi } from the renderer when main.js has it;
// without them the system still runs the clock and the lamps, and the
// sky/fog still change. N (KeyN) skips to the next dawn or dusk.
import * as THREE from 'three';
import { clamp, daylightFactor, formatClock, isNightHour, lerp, sunAngle } from './world.js';

const HOURS_PER_SECOND = 1 / 30; // one game hour per 30 real seconds
const DAY_SUN_INTENSITY = 2.4;
const NIGHT_SUN_INTENSITY = 0.08;
const DAY_HEMI_INTENSITY = 0.85;
const NIGHT_HEMI_INTENSITY = 0.14;
const DAY_FOG = new THREE.Color(0xcfe8f2);
const NIGHT_FOG = new THREE.Color(0x0d1622);
const DAY_SUN_COLOR = new THREE.Color(0xfff2d0);
const NIGHT_SUN_COLOR = new THREE.Color(0x8fb0e8);
const NIGHT_SKY = new THREE.Color(0x0a1420);

// Street lamps stand at eight central crossings; their bulbs glow after dark.
const LAMP_SPOTS = [
  { x: -58, z: -58 },
  { x: 58, z: -58 },
  { x: -58, z: 58 },
  { x: 58, z: 58 },
  { x: -116, z: 0 },
  { x: 116, z: 0 },
  { x: 0, z: -116 },
  { x: 0, z: 116 },
];

export function createDayNight(scene, world, lights) {
  const sun = (lights && lights.sun) || null;
  const hemi = (lights && lights.hemi) || null;
  const daySky = scene ? scene.background : null;
  const dayFog = scene && scene.fog ? scene.fog.color.clone() : DAY_FOG.clone();

  const state = {
    hours: 10, // 10:00 — sunny morning, the game's opening light
    night: 0, // 0 = full day, 1 = deep night
    dayLengthSeconds: 720, // a full day-night loop, for the HUD
  };

  // --- street lamps -------------------------------------------------------
  const lamps = [];
  if (scene) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.6, metalness: 0.4 });
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5, 8);
    const armGeo = new THREE.BoxGeometry(1.4, 0.1, 0.1);
    const bulbGeo = new THREE.SphereGeometry(0.28, 10, 8);
    for (const spot of LAMP_SPOTS) {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2.5;
      pole.castShadow = false;
      group.add(pole);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(0.6, 4.9, 0);
      group.add(arm);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xffe9a0,
        emissive: 0xffd34d,
        emissiveIntensity: 0.1,
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(1.25, 4.8, 0);
      group.add(bulb);
      group.position.set(spot.x, 0, spot.z);
      scene.add(group);
      lamps.push({ group, bulbMat });
    }
  }

  // --- headlights: one spotlight that rides the player's car at night -----
  let headlight = null;
  let headTarget = null;
  if (scene) {
    headlight = new THREE.SpotLight(0xfff2c0, 0, 70, 0.55, 0.45, 1.2);
    headTarget = new THREE.Object3D();
    scene.add(headlight);
    scene.add(headTarget);
    headlight.target = headTarget;
  }

  function daylight() {
    return daylightFactor(state.hours);
  }

  function applyLight() {
    const day = daylight();
    state.night = 1 - day;
    if (sun) {
      const a = sunAngle(state.hours);
      sun.position.set(Math.cos(a) * -260, 40 + Math.sin(a) * 260, 180);
      sun.intensity = lerp(NIGHT_SUN_INTENSITY, DAY_SUN_INTENSITY, day);
      sun.color.copy(NIGHT_SUN_COLOR).lerp(DAY_SUN_COLOR, day);
    }
    if (hemi) hemi.intensity = lerp(NIGHT_HEMI_INTENSITY, DAY_HEMI_INTENSITY, day);
    if (scene) {
      if (state.night > 0.5) scene.background = NIGHT_SKY;
      else if (daySky) scene.background = daySky;
      if (scene.fog) scene.fog.color.copy(dayFog).lerp(NIGHT_FOG, state.night);
    }
    // Lamps glow after dark, dark in daylight.
    for (const lamp of lamps) {
      lamp.bulbMat.emissiveIntensity = lerp(0.1, 3.2, state.night);
    }
    // Moonlight fill is the sun at low intensity; the renderer module owns
    // the moon disc itself and reads nightFactor through world.render.
    try {
      if (world.render && typeof world.render.setCelestial === 'function') {
        world.render.setCelestial(state.night);
      }
      if (world.render && typeof world.render.setNightExposure === 'function') {
        world.render.setNightExposure(state.night);
      }
    } catch {
      // Celestial display is cosmetic; never let it break the frame.
    }
  }

  function updateHeadlights() {
    if (!headlight || !headTarget) return;
    const player = world.player;
    const driving = player && player.car && !player.onFoot && state.night > 0.25;
    if (!driving) {
      headlight.intensity = 0;
      return;
    }
    const car = player.car;
    const h = car.heading || 0;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    headlight.position.set(car.pos.x + fx * 2.2, 0.9, car.pos.z + fz * 2.2);
    headTarget.position.set(car.pos.x + fx * 26, 0.4, car.pos.z + fz * 26);
    headlight.intensity = 60 * state.night;
  }

  let prevN = false;
  let wasNight = isNightHour(state.hours);

  function update(dt) {
    const capped = Math.min(dt || 0, 0.1);
    // The clock runs while the game runs or idles on the menu; it freezes
    // on pause and on the wasted / busted screens.
    if (world.mode === undefined || world.mode === 'play' || world.mode === 'menu') {
      state.hours = (state.hours + capped * HOURS_PER_SECOND) % 24;
    }
    // Dawn and dusk get one toast each as the light turns: the player
    // should notice the city changing, not just find it dark.
    const nightNow = isNightHour(state.hours);
    if (nightNow !== wasNight && world.mode === 'play') {
      try {
        if (world.hud && typeof world.hud.showMessage === 'function') {
          world.hud.showMessage(
            nightNow
              ? 'Night falls over Solmar — lamps on, headlights out.'
              : 'Dawn breaks over Solmar — the city wakes up.',
          );
        }
      } catch {
        // Toast is cosmetic.
      }
    }
    wasNight = nightNow;
    // N skips time: at night it jumps to dawn, by day it jumps to dusk.
    // Edge-detected here so holding N does not strobe the clock.
    const keys = (world.input && world.input.keys) || null;
    const nDown = keys ? keys.has('KeyN') : false;
    if (nDown && !prevN) {
      if (isNightHour(state.hours)) state.hours = 6.5;
      else state.hours = 18.5;
      if (world.hud && typeof world.hud.showMessage === 'function') {
        world.hud.showMessage(isNightHour(state.hours) ? 'Night falls over Solmar…' : 'Dawn breaks over Solmar…');
      }
    }
    prevN = nDown;
    applyLight();
    updateHeadlights();
  }

  // Jump straight to a time of day (missions use this for night jobs).
  function setTime(hours) {
    state.hours = ((hours % 24) + 24) % 24;
    applyLight();
  }

  function skipToNight() {
    state.hours = 22;
    applyLight();
  }

  function skipToDay() {
    state.hours = 10;
    applyLight();
  }

  function clockText() {
    return formatClock(state.hours);
  }

  function isNight() {
    return isNightHour(state.hours);
  }

  function nightFactor() {
    return clamp(state.night, 0, 1);
  }

  applyLight();

  return {
    update,
    state,
    clockText,
    isNight,
    nightFactor,
    setTime,
    skipToNight,
    skipToDay,
  };
}
