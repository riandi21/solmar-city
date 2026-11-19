// Player: Rico Vega on foot — third-person character, camera, carjacking.
// WASD moves relative to the camera heading, Shift sprints, Space jumps,
// E enters the nearest car within 3 m (stealing a driven car is a crime)
// and E again (or F) steps back out. While driving the character hides and
// the camera chases the car instead; driving itself lives in vehicles.js.
//
// Heading convention: forward = (sin(heading), 0, cos(heading)); the mesh
// is built facing +Z so mesh.rotation.y = heading. The camera orbits on
// world.input.mouseDX / mouseDY (fed by input.js from pointer drag); if the
// input system never provides those fields, this module listens for drags
// itself as a fallback.
import * as THREE from 'three';
import { topSpeedFor } from './vehicles.js';

const WALK_SPEED = 4.5;
const SPRINT_SPEED = 8.0;
const ACCEL = 30; // m/s^2 toward the target velocity
const GRAVITY = 22;
const JUMP_SPEED = 8.5;
const ENTER_RANGE = 3.2;
const EYE_HEIGHT = 1.6;

const SHIRTS = [0x2e8b8b, 0xc94f3d, 0x3d6fd9, 0xe8b93c, 0x7a4fd0];
const PANTS = [0x2b3242, 0x3a2e26, 0x24382a];

function pick(rng, list) {
  const r = rng || Math.random;
  return list[Math.floor(r() * list.length)];
}

function limbMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
}

/** Low-poly person facing +Z: capsule torso, head, swinging arms and legs. */
export function buildPersonMesh(rng) {
  const group = new THREE.Group();
  const shirt = pick(rng, SHIRTS);
  const pants = pick(rng, PANTS);
  const skin = 0xc98d64;

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.55, 4, 10),
    limbMat(shirt),
  );
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), limbMat(skin));
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  // Hair cap so the head reads at a distance.
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
    limbMat(0x1c1410),
  );
  hair.position.y = 1.82;
  group.add(hair);

  // One geometry per limb: each pivots at its shoulder/hip, so the
  // geometry is shifted once so rotation swings from the top.
  function limb(w, h, mat, x, y) {
    const g = new THREE.BoxGeometry(w, h, w === 0.16 ? 0.16 : 0.2);
    g.translate(0, -h / 2, 0); // pivot at the top of the box
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, 0);
    m.castShadow = true;
    group.add(m);
    return m;
  }
  const armL = limb(0.16, 0.62, limbMat(skin), -0.46, 1.38);
  const armR = limb(0.16, 0.62, limbMat(skin), 0.46, 1.38);
  const legL = limb(0.2, 0.72, limbMat(pants), -0.16, 0.72);
  const legR = limb(0.2, 0.72, limbMat(pants), 0.16, 0.72);
  // Legs pivot at the hip (0.72 high); arms at the shoulder (1.38 high).

  group.userData.limbs = { armL, armR, legL, legR };
  return group;
}

function clampAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function angleLerp(from, to, t) {
  return from + clampAngle(to - from) * t;
}

export function createPlayer(scene, world) {
  const rng = world.rng || Math.random;
  const mesh = buildPersonMesh(rng);
  const spawn = world.player && world.player.pos
    ? { x: world.player.pos.x || 0, z: world.player.pos.z || 0 }
    : { x: 0, z: 60 };
  mesh.position.set(spawn.x, 0, spawn.z);
  scene.add(mesh);

  // Share the mesh position object with the world so every system reads the
  // same live position; same for heading / car / onFoot below.
  if (!world.player) world.player = {};
  world.player.pos = mesh.position;
  world.player.mesh = mesh;
  world.player.heading = world.player.heading || 0;
  world.player.onFoot = true;
  world.player.car = null;
  if (world.player.health === undefined) world.player.health = 100;
  // v3 — sprint stamina (0..100): Shift sprints only while there is
  // stamina to spend. It drains fast, refills while walking, and a
  // fully drained Rico cannot sprint again until it recovers past 10.
  if (world.player.stamina === undefined) world.player.stamina = 100;
  let staminaExhausted = false;

  const camera = world.camera;
  let camYaw = world.player.heading; // orbit angle: camera sits behind this heading
  let camPitch = 0.34;
  let camDist = 7;
  let velX = 0;
  let velZ = 0;
  let vy = 0;
  let grounded = true;
  let walkPhase = 0;
  let prevE = false;
  let prevJump = false;
  let dragFallbackArmed = false;

  const keys = () => (world.input && world.input.keys) || new Set();
  const playing = () => world.mode === undefined || world.mode === 'play';

  // Fallback orbit: only arm this if the input system never supplies mouse
  // deltas (it leaves mouseDX undefined). input.js normally owns the drag.
  function armDragFallback() {
    if (dragFallbackArmed) return;
    dragFallbackArmed = true;
    const target = (world.renderer && world.renderer.domElement) || null;
    if (!target || typeof target.addEventListener !== 'function') return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    target.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    target.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      camYaw -= (e.clientX - lastX) * 0.004;
      camPitch = Math.max(0.06, Math.min(1.0, camPitch + (e.clientY - lastY) * 0.003));
      lastX = e.clientX;
      lastY = e.clientY;
    });
    target.addEventListener('pointerup', () => { dragging = false; });
  }

  function pushEvent(type, data) {
    if (!world.events) world.events = [];
    world.events.push({ type, data: data || {} });
  }

  function nearestCar(maxDist) {
    const cars = world.cars || [];
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (!car.active) continue;
      const dx = car.pos.x - mesh.position.x;
      const dz = car.pos.z - mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    if (!car) return false;
    if (car.driver) {
      // The driver bails out on foot and the theft is a crime.
      car.driver = false;
      pushEvent('pedFlee', { pos: { x: car.pos.x + 2, z: car.pos.z }, heading: car.heading });
      pushEvent('crime', { level: 1 });
    }
    car.kind = 'player';
    car.maxSpeed = topSpeedFor('player'); // a stolen sedan is no longer a 14 m/s taxi
    car.speed = 0;
    world.player.car = car;
    world.player.onFoot = false;
    mesh.visible = false;
    velX = 0;
    velZ = 0;
    return true;
  }

  function exitCar() {
    const car = world.player.car;
    if (!car) return false;
    // Step out on the driver's side (left of the car's forward axis).
    const sideX = Math.cos(car.heading);
    const sideZ = -Math.sin(car.heading);
    mesh.position.set(car.pos.x + sideX * 2.4, 0, car.pos.z + sideZ * 2.4);
    mesh.visible = true;
    world.player.heading = car.heading;
    mesh.rotation.y = car.heading;
    world.player.car = null;
    world.player.onFoot = true;
    car.speed = 0;
    vy = 0;
    grounded = true;
    return true;
  }

  function stepFoot(dt) {
    const k = keys();
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const shiftHeld = k.has('ShiftLeft') || k.has('ShiftRight');
    const jump = k.has('Space');

    // v3 — sprint stamina: Shift only sprints while stamina lasts.
    // Moving while sprinting drains 25/s; walking refills 15/s. Hitting
    // zero locks sprinting out until stamina recovers past 10, so the
    // player cannot feather Shift to sprint forever on fumes.
    const moving = fwd !== 0 || strafe !== 0;
    let sprint = false;
    if (shiftHeld && moving && !staminaExhausted && world.player.stamina > 0) {
      sprint = true;
      world.player.stamina = Math.max(0, world.player.stamina - 25 * dt);
      if (world.player.stamina === 0) {
        staminaExhausted = true;
        if (world.hud && typeof world.hud.showMessage === 'function') {
          world.hud.showMessage('Winded! Catch your breath before sprinting again.');
        }
      }
    } else if (!sprint) {
      world.player.stamina = Math.min(100, world.player.stamina + 15 * dt);
      if (staminaExhausted && world.player.stamina >= 10) staminaExhausted = false;
    }

    // Move relative to where the camera looks, not where the body faces.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    let mx = sin * fwd + cos * strafe;
    let mz = cos * fwd - sin * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const targetSpeed = sprint ? SPRINT_SPEED : WALK_SPEED;
    const tx = mx * targetSpeed;
    const tz = mz * targetSpeed;
    const blend = 1 - Math.exp(-ACCEL * dt / targetSpeed);
    velX += (tx - velX) * blend;
    velZ += (tz - velZ) * blend;
    mesh.position.x += velX * dt;
    mesh.position.z += velZ * dt;
    // Keep Rico inside the map.
    mesh.position.x = Math.max(-258, Math.min(258, mesh.position.x));
    mesh.position.z = Math.max(-258, Math.min(258, mesh.position.z));

    const speed = Math.hypot(velX, velZ);
    if (speed > 0.4) {
      const targetHeading = Math.atan2(velX, velZ);
      world.player.heading = angleLerp(world.player.heading, targetHeading, 1 - Math.exp(-dt / 0.08));
      mesh.rotation.y = world.player.heading;
    }
    world.player.speed = speed;

    // Jump: simple gravity, land back on y = 0.
    if (jump && !prevJump && grounded) {
      vy = JUMP_SPEED;
      grounded = false;
    }
    prevJump = jump;
    if (!grounded) {
      vy -= GRAVITY * dt;
      mesh.position.y += vy * dt;
      if (mesh.position.y <= 0) {
        mesh.position.y = 0;
        vy = 0;
        grounded = true;
      }
    }

    // Walk / run swing; idle breathing when still.
    walkPhase += speed * dt * 1.7;
    const swing = Math.min(1, speed / WALK_SPEED) * 0.65;
    const { armL, armR, legL, legR } = mesh.userData.limbs;
    const s = Math.sin(walkPhase);
    legL.rotation.x = s * swing;
    legR.rotation.x = -s * swing;
    armL.rotation.x = -s * swing * 0.8;
    armR.rotation.x = s * swing * 0.8;
    if (!grounded) {
      legL.rotation.x = 0.45;
      legR.rotation.x = -0.3;
      armL.rotation.x = -0.6;
      armR.rotation.x = -0.6;
    }
  }

  function stepCamera(dt) {
    if (!camera) return;
    const target = world.player.car ? world.player.car.pos : mesh.position;
    const wantDist = world.player.car ? 10.5 : 7;
    camDist += (wantDist - camDist) * (1 - Math.exp(-dt / 0.3));
    // Camera sits behind the orbit yaw, slightly above, looking at the target.
    const cx = target.x - Math.sin(camYaw) * camDist * Math.cos(camPitch);
    const cz = target.z - Math.cos(camYaw) * camDist * Math.cos(camPitch);
    const cy = target.y + EYE_HEIGHT + Math.sin(camPitch) * camDist;
    const snap = 1 - Math.exp(-dt / 0.18);
    camera.position.x += (cx - camera.position.x) * snap;
    camera.position.y += (cy - camera.position.y) * snap;
    camera.position.z += (cz - camera.position.z) * snap;
    camera.lookAt(target.x, target.y + 1.5, target.z);
  }

  function update(dt) {
    const capped = Math.min(dt, 0.05);
    // Orbit from the input system's drag deltas; consume them each frame.
    if (world.input && typeof world.input.mouseDX === 'number') {
      camYaw -= world.input.mouseDX * 0.004;
      camPitch = Math.max(0.06, Math.min(1.0, camPitch + (world.input.mouseDY || 0) * 0.003));
      world.input.mouseDX = 0;
      world.input.mouseDY = 0;
    } else {
      armDragFallback();
    }

    if (playing()) {
      const k = keys();
      const eNow = k.has('KeyE');
      if (world.player.onFoot) {
        stepFoot(capped);
        if (eNow && !prevE) {
          const car = nearestCar(ENTER_RANGE);
          if (car) enterCar(car);
        }
      } else {
        // Driving: keep the player record glued to the car, so missions,
        // the minimap, police and traffic all see where Rico really is.
        // (vehicles.js drives the car itself; the mesh stays hidden.)
        const car = world.player.car;
        if (car) {
          mesh.position.set(car.pos.x, 0, car.pos.z);
          world.player.speed = Math.abs(car.speed);
          world.player.heading = car.heading;
        }
        if (eNow && !prevE) exitCar();
      }
      prevE = eNow;
    }
    stepCamera(capped);
  }

  return {
    mesh,
    pos: mesh.position,
    get heading() { return world.player.heading; },
    get onFoot() { return world.player.onFoot; },
    get car() { return world.player.car; },
    update,
    enterCar,
    exitCar,
  };
}
