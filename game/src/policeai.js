// Smarter police AI for Solmar City — flanking, spike strips, heli work.
//
// The base police system chases the player head-on. This module layers
// tactics on top of it, reading only the shared world (never the police
// system's private fleet):
//
//   * Flanking — at 3+ stars the two nearest pursuit cars stop tailing
//     Rico and swing to points ahead-left / ahead-right of him, so the
//     chase closes from three sides. police.js asks for the flank point
//     with flankTarget() and steers for it while far away.
//   * Spike strips — at 3+ stars a strip is laid across the road ahead
//     of the player every 20 s. Driving over one shreds the tyres:
//     world.player.spikeSlow counts down and vehicles.js caps the top
//     speed while it runs.
//   * Heli coordination — heliLead() is a point ahead of the player's
//     velocity; the helicopter hovers over the lead, not over Rico's
//     bumper, so it stays in frame during a fast chase.
//   * Pursuit boost — at 4+ stars pursuit cars run a little faster.
//
//   createPoliceAI(scene, world) -> { update, state, flankTarget,
//     heliLead, extraSpeed, strips }
import * as THREE from 'three';
import { clampAngle, dist2XZ, headingToward, pointAlong } from './world.js';

const FLANK_MIN_WANTED = 3;
const FLANK_AHEAD = 20; // metres ahead of the player the flankers aim for
const FLANK_SIDE = 11; // metres to each side of the player's line
const FLANK_FAR = 26; // flank only while the car is further than this
const STRIP_MIN_WANTED = 3;
const STRIP_COOLDOWN = 20; // seconds between strips
const STRIP_AHEAD_MIN = 55; // metres ahead of the player
const STRIP_AHEAD_MAX = 80;
const STRIP_LIFE = 25; // seconds a strip stays on the road
const STRIP_HIT_RADIUS = 5; // metres from the strip centre that shreds tyres
const SPIKE_SLOW_SECONDS = 2.5;
const SPIKE_SPEED_MULT = 0.45; // instant speed cut on contact

export function createPoliceAI(scene, world) {
  const state = {
    heat: 0,
    strips: [], // { group, x, z, life, hit }
    lastStripAt: -1e9,
    clock: 0,
    flankAssignments: 0,
  };

  function playerPos() {
    return (world.player && world.player.pos) || { x: 0, z: 0 };
  }

  function playerHeading() {
    return (world.player && world.player.heading) || 0;
  }

  /** Police cars, in fleet order (the order police.js spawned them). */
  function pursuitCars() {
    const cars = [];
    for (const car of world.cars || []) {
      if (car.kind === 'police' && car.ai) cars.push(car);
    }
    return cars;
  }

  /**
   * Where pursuit car `index` should steer when it is far from the
   * player: car 0 swings ahead-left, car 1 ahead-right, the rest chase
   * head-on. Returns null below 3 stars or when the car is already
   * close (then the normal chase takes over).
   */
  function flankTarget(index, carPos) {
    const w = world.wanted || 0;
    if (w < FLANK_MIN_WANTED || index > 1) return null;
    const pp = playerPos();
    if (dist2XZ(carPos.x, carPos.z, pp.x, pp.z) < FLANK_FAR) return null;
    const h = playerHeading();
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const side = index === 0 ? -1 : 1;
    // Right vector of the heading: (cos h, -sin h).
    const sx = Math.cos(h) * side;
    const sz = -Math.sin(h) * side;
    return {
      x: pp.x + fx * FLANK_AHEAD + sx * FLANK_SIDE,
      z: pp.z + fz * FLANK_AHEAD + sz * FLANK_SIDE,
    };
  }

  /** Extra pursuit top speed (m/s) the police get at high heat. */
  function extraSpeed() {
    const w = world.wanted || 0;
    if (w >= 4) return 4;
    if (w >= 3) return 2;
    return 0;
  }

  /**
   * The point the helicopter should hover over: the player's position
   * led by his velocity, so the heli stays ahead of a fast car instead
   * of lagging over the rear bumper. Falls back to the player position
   * on foot or at low speed.
   */
  function heliLead() {
    const pp = playerPos();
    const player = world.player || {};
    const speed = Math.abs(player.speed || 0);
    if (!player.car || speed < 6) return { x: pp.x, z: pp.z };
    const h = playerHeading();
    const lead = Math.min(30, speed * 1.2);
    return { x: pp.x + Math.sin(h) * lead, z: pp.z + Math.cos(h) * lead };
  }

  // --- spike strips -------------------------------------------------------
  function snapToRoad(x, z) {
    try {
      if (world.city && typeof world.city.nearestRoad === 'function') {
        return world.city.nearestRoad(x, z);
      }
    } catch {
      // Fall through: place the strip where the player is heading.
    }
    return { road: null, x, z };
  }

  function makeStripMesh(x, z, acrossHeading) {
    const group = new THREE.Group();
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.3, metalness: 0.8 });
    // A low black bar across the road with three rows of steel teeth.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 1.2), stripMat);
    bar.position.y = 0.15;
    bar.castShadow = true;
    group.add(bar);
    for (let row = -1; row <= 1; row += 1) {
      for (let i = -5; i <= 5; i += 1) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6), spikeMat);
        spike.position.set(i * 0.95, 0.45, row * 0.35);
        group.add(spike);
      }
    }
    // A small warning triangle on a post at the roadside end.
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888 }),
    );
    post.position.set(6.5, 0.8, 0);
    group.add(post);
    const sign = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.9, 3),
      new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.6 }),
    );
    sign.position.set(6.5, 2.0, 0);
    sign.rotation.z = Math.PI;
    group.add(sign);
    group.position.set(x, 0, z);
    group.rotation.y = acrossHeading;
    scene.add(group);
    return group;
  }

  function placeStrip() {
    try {
      const pp = playerPos();
      const h = playerHeading();
      const ahead = STRIP_AHEAD_MIN + Math.random() * (STRIP_AHEAD_MAX - STRIP_AHEAD_MIN);
      const tx = pp.x + Math.sin(h) * ahead;
      const tz = pp.z + Math.cos(h) * ahead;
      const snap = snapToRoad(tx, tz);
      const x = snap.x;
      const z = snap.z;
      // Across the road: if the road runs along X, the strip lies along Z.
      const road = snap.road;
      const acrossHeading = road && road.axis === 'x' ? Math.PI / 2 : 0;
      const group = makeStripMesh(x, z, acrossHeading);
      state.strips.push({ group, x, z, life: STRIP_LIFE, hit: false });
      state.lastStripAt = state.clock;
      // Warn the player the moment the strip goes down: a strip the
      // player never sees is a gotcha, not a tactic.
      try {
        if (world.hud && typeof world.hud.showMessage === 'function') {
          world.hud.showMessage('Police report: spike strip ahead — slow down or swerve!');
        }
      } catch {
        // Toast is cosmetic.
      }
    } catch {
      // A failed placement just means no strip this time.
    }
  }

  function removeStrip(strip) {
    try {
      scene.remove(strip.group);
    } catch {
      // Already gone.
    }
    const i = state.strips.indexOf(strip);
    if (i >= 0) state.strips.splice(i, 1);
  }

  function updateStrips(dt) {
    const w = world.wanted || 0;
    if (w >= STRIP_MIN_WANTED && state.clock - state.lastStripAt >= STRIP_COOLDOWN) {
      placeStrip();
    }
    const player = world.player || {};
    const inCar = player.car && !player.onFoot;
    for (const strip of [...state.strips]) {
      strip.life -= dt;
      if (strip.life <= 0 || w < 2) {
        removeStrip(strip);
        continue;
      }
      // Driving over the teeth: instant speed cut + a slow timer the
      // vehicle system reads to cap the top speed while the tyres are gone.
      if (!strip.hit && inCar && player.car) {
        const d = dist2XZ(player.car.pos.x, player.car.pos.z, strip.x, strip.z);
        if (d < STRIP_HIT_RADIUS) {
          strip.hit = true;
          player.car.speed *= SPIKE_SPEED_MULT;
          player.spikeSlow = SPIKE_SLOW_SECONDS;
          try {
            if (world.hud && typeof world.hud.showMessage === 'function') {
              world.hud.showMessage('Spike strip! Tyres shredded — speed cut!');
            }
          } catch {
            // Toast is cosmetic.
          }
        }
      }
    }
  }

  function update(dt) {
    const capped = Math.min(dt || 0, 0.05);
    state.clock += capped;
    state.heat = world.wanted || 0;
    // Count live flank assignments for the HUD tracker.
    const cars = pursuitCars();
    let assigned = 0;
    for (let i = 0; i < Math.min(2, cars.length); i += 1) {
      if (flankTarget(i, cars[i].pos)) assigned += 1;
    }
    state.flankAssignments = assigned;
    updateStrips(capped);
  }

  return {
    update,
    state,
    flankTarget,
    heliLead,
    extraSpeed,
    strips: state.strips,
  };
}
