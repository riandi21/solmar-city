// Jet Ski: a fast, agile watercraft — quicker than the marina boats,
// but a hard hit on a wave or a dock costs health and can throw Rico
// off. Enter with E at the Sunset Beach jet ski dock or the marina pier
// (the player module owns the E press; this module only drives). It
// leaves a wake, jumps small waves, and tracks a best race time in the
// kingpin state for the marina-to-Islands jet ski race.
import * as THREE from 'three';
import { isDown } from './player.js';

export const JET_SKI_DOCK = { x: -150, z: 320 };
export const MARINA_PIER = { x: 295, z: 168 };
export const TOP_SPEED = 24;
export const RACE_BUOYS = [
  { x: 300, z: 200 },
  { x: 340, z: 280 },
  { x: 370, z: 360 },
];

function isWaterAt(x, z) {
  if (z >= 312) return true; // open sea south of the beach
  if (x >= 261 && x <= 400 && z >= 60 && z <= 260) return true; // marina basin
  if (x >= 290 && x <= 460 && z >= 290 && z <= 460) return true; // Islands lagoon
  return false;
}

function waveHeight(x, z, t) {
  return Math.sin(x * 0.08 + t * 1.7) * 0.16 + Math.sin(z * 0.11 - t * 1.3) * 0.13;
}

function buildJetSkiMesh(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 2.4), paint);
  hull.position.y = 0.22;
  hull.name = 'hull';
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 4), paint);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(0, 0.24, 1.5);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.9), dark);
  seat.position.set(0, 0.46, -0.45);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), dark);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 0.72, 0.55);
  group.add(hull, nose, seat, bars);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function enterJetSki(world, ski) {
  const p = world.player;
  if (!p || !ski) return false;
  p.currentJetSki = ski;
  p.currentCar = null;
  p.currentBike = null;
  p.onFoot = false;
  ski.driver = 'player';
  if (ski.position) p.position.copy(ski.position);
  return true;
}

export function exitJetSki(world) {
  const p = world.player;
  const ski = p && p.currentJetSki;
  if (!p || !ski) return false;
  p.currentJetSki = null;
  ski.driver = null;
  ski.speed = 0;
  p.onFoot = true;
  p.speed = 0;
  // Step off onto the nearest shore side of the ski.
  p.position.set(ski.position.x + 1.4, 0, ski.position.z + 1.0);
  if (p.mesh) { p.mesh.visible = true; p.mesh.position.copy(p.position); }
  return true;
}

export function createJetSki(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  if (!Array.isArray(world.jetSkis)) world.jetSkis = [];
  if (!world.kingpin) world.kingpin = {};
  if (world.kingpin.jetSkiBestTime === undefined) world.kingpin.jetSkiBestTime = null;

  // Wake pool: fading foam quads dropped behind the ski while moving.
  const wakePool = [];
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 28; i += 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), wakeMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    if (scene) scene.add(m);
    wakePool.push({ mesh: m, life: 0 });
  }
  let wakeIdx = 0;
  let wakeTimer = 0;

  function spawnJetSki(x, z, opts = {}) {
    const color = opts.color !== undefined ? opts.color : 0x2ec8d8;
    const mesh = buildJetSkiMesh(color);
    mesh.position.set(x, waveHeight(x, z, 0), z);
    mesh.rotation.y = opts.heading !== undefined ? opts.heading : rng() * Math.PI * 2;
    if (scene) scene.add(mesh);
    const ski = {
      kind: 'jetski',
      mesh,
      position: mesh.position,
      heading: mesh.rotation.y,
      speed: 0,
      color,
      driver: opts.driver || null,
      vy: 0,
      airborne: false,
      race: null,
    };
    world.jetSkis.push(ski);
    return ski;
  }

  // One ski at the Sunset Beach dock, one at the marina pier. A third ski
  // sits beached by the Surf Shack so a race can start from the beach.
  // Dock skis face the open water (heading 0 = south, into the sea);
  // a ski facing the beach would beach itself on the first throttle.
  spawnJetSki(JET_SKI_DOCK.x, JET_SKI_DOCK.z + 4, { heading: 0 });
  spawnJetSki(MARINA_PIER.x + 2, MARINA_PIER.z + 4, { heading: Math.PI / 2 });
  spawnJetSki(-180, 318, { heading: 0, color: 0xe8b93a });

  function startRace() {
    const p = world.player;
    const ski = p && p.currentJetSki;
    if (!ski) return { ok: false, reason: 'board a jet ski first' };
    ski.race = { buoy: 0, time: 0, running: true };
    return { ok: true };
  }

  function update(dt) {
    if (!world || world.mode !== 'play') return;
    const t = world.elapsed || 0;
    const p = world.player;
    const ski = p && p.currentJetSki;
    // Idle skis bob on the waves even when nobody rides them.
    for (const s of world.jetSkis) {
      if (s === ski) continue;
      s.mesh.position.y = waveHeight(s.position.x, s.position.z, t);
      s.mesh.rotation.z = Math.sin(t * 1.2 + s.position.x) * 0.05;
    }
    if (!ski || !ski.position) return;

    const fwd = isDown(world, 'KeyW', 'ArrowUp');
    const back = isDown(world, 'KeyS', 'ArrowDown');
    const left = isDown(world, 'KeyA', 'ArrowLeft');
    const right = isDown(world, 'KeyD', 'ArrowRight');

    if (fwd) ski.speed += 20 * dt;
    if (back) ski.speed -= 16 * dt;
    if (!fwd && !back) ski.speed -= Math.sign(ski.speed) * Math.min(Math.abs(ski.speed), 7 * dt);
    ski.speed = Math.max(-6, Math.min(TOP_SPEED, ski.speed));

    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const speedFactor = Math.min(1, Math.abs(ski.speed) / 9);
    ski.heading += steerInput * 3.1 * speedFactor * (ski.speed >= 0 ? 1 : -1) * dt;
    const prevX = ski.position.x;
    const prevZ = ski.position.z;
    ski.position.x += Math.sin(ski.heading) * ski.speed * dt;
    ski.position.z += Math.cos(ski.heading) * ski.speed * dt;

    // Stay on the water: beaching slows the ski hard and can throw Rico.
    if (!isWaterAt(ski.position.x, ski.position.z)) {
      ski.position.x = prevX;
      ski.position.z = prevZ;
      if (Math.abs(ski.speed) > 14) {
        const dmg = 12;
        p.health = Math.max(0, (p.health == null ? 100 : p.health) - dmg);
        if (rng() < 0.5) {
          exitJetSki(world);
          if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: 'Beached the jet ski — thrown off!' });
          if (p.health <= 0) world.mode = 'over';
          return;
        }
        if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: 'Too shallow — turn back to open water!' });
      }
      ski.speed *= 0.4;
    }
    ski.position.x = Math.max(-420, Math.min(470, ski.position.x));
    ski.position.z = Math.max(-340, Math.min(470, ski.position.z));

    // Waves: ride the swell, and jump small waves at speed.
    const wave = waveHeight(ski.position.x, ski.position.z, t);
    const waveAhead = waveHeight(
      ski.position.x + Math.sin(ski.heading) * 2,
      ski.position.z + Math.cos(ski.heading) * 2,
      t,
    );
    if (!ski.airborne && ski.speed > 15 && waveAhead > wave + 0.12) {
      ski.vy = 3.2 + ski.speed * 0.06;
      ski.airborne = true;
    }
    if (ski.airborne) {
      ski.vy -= 12 * dt;
      ski.position.y += ski.vy * dt;
      if (ski.position.y <= wave) {
        ski.position.y = wave;
        ski.airborne = false;
        ski.vy = 0;
        if (Math.abs(ski.speed) > 20) ski.speed *= 0.96; // hard landing scrubs speed
      }
    } else {
      ski.position.y = wave;
    }

    // Hard dock hit: slamming a pier at speed hurts.
    for (const dock of [JET_SKI_DOCK, MARINA_PIER]) {
      const d = Math.hypot(ski.position.x - dock.x, ski.position.z - dock.z);
      if (d < 2.5 && Math.abs(ski.speed) > 12) {
        p.health = Math.max(0, (p.health == null ? 100 : p.health) - 10);
        ski.speed *= 0.3;
        if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: 'Slammed the dock!' });
        if (p.health <= 0) world.mode = 'over';
      }
    }

    // Wake trail while moving.
    wakeTimer -= dt;
    if (Math.abs(ski.speed) > 4 && wakeTimer <= 0) {
      wakeTimer = 0.09;
      const slot = wakePool[wakeIdx % wakePool.length];
      wakeIdx += 1;
      slot.mesh.visible = true;
      slot.mesh.position.set(
        ski.position.x - Math.sin(ski.heading) * 1.4,
        Math.max(0.05, ski.position.y + 0.05),
        ski.position.z - Math.cos(ski.heading) * 1.4,
      );
      slot.mesh.material.opacity = 0.5;
      slot.life = 1.6;
    }
    for (const slot of wakePool) {
      if (slot.life > 0) {
        slot.life -= dt;
        slot.mesh.material.opacity = Math.max(0, slot.life / 1.6) * 0.5;
        const s = 0.9 + (1.6 - slot.life) * 0.9;
        slot.mesh.scale.set(s, s, 1);
        if (slot.life <= 0) slot.mesh.visible = false;
      }
    }

    // Jet ski race: marina to the Islands, checkpoint buoys in order.
    if (ski.race && ski.race.running) {
      ski.race.time += dt;
      const buoy = RACE_BUOYS[ski.race.buoy];
      if (buoy && Math.hypot(ski.position.x - buoy.x, ski.position.z - buoy.z) < 8) {
        ski.race.buoy += 1;
        if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: `Buoy ${ski.race.buoy} of ${RACE_BUOYS.length}!` });
        if (ski.race.buoy >= RACE_BUOYS.length) {
          ski.race.running = false;
          const time = ski.race.time;
          if (world.kingpin.jetSkiBestTime === null || time < world.kingpin.jetSkiBestTime) {
            world.kingpin.jetSkiBestTime = time;
          }
          if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: `Jet ski race done in ${time.toFixed(1)}s!` });
        }
      }
    }

    ski.mesh.position.copy(ski.position);
    ski.mesh.rotation.y = ski.heading;
    ski.mesh.rotation.z = -steerInput * speedFactor * 0.18;
    ski.mesh.rotation.x = ski.airborne ? -0.12 : Math.sin(t * 2) * 0.03;
    p.position.copy(ski.position);
    p.position.y = Math.max(0, ski.position.y);
    p.heading = ski.heading;
    p.speed = ski.speed;
    p.onFoot = false;
  }

  function spawnForShot(x, z, heading = 2.4) {
    // Shot staging: a fresh jet ski at the marina, Rico boarded at once,
    // so the chase shot shows the pursuit on the water, not an empty pier.
    const ski = spawnJetSki(x, z, { heading, color: 0x2ec8d8 });
    enterJetSki(world, ski);
    ski.speed = 10;
    if (world.player) world.player.jetSki = ski;
    return ski;
  }

  const sys = {
    name: 'jetski',
    update,
    spawnJetSki,
    spawnForShot,
    startRace,
    isWaterAt,
    waveHeight,
    buoys: RACE_BUOYS,
  };
  if (Array.isArray(world.systems)) world.systems.push(sys);
  return sys;
}

export default createJetSki;
