// Boats — drivable marina boats for Solmar City.
// The marina basin runs x 261-400, z 60-260, with the pier at (295, 168).
// Boats handle like slow, heavy watercraft: lazy turning, a wake trailing
// behind, and a top speed well below a sports car. Enter and exit at the
// pier with E. Communicates only through the shared world object.
import * as THREE from 'three';

const BASIN = { xMin: 261, xMax: 400, zMin: 60, zMax: 260 };
const PIER = new THREE.Vector3(295, 0, 168);
const ENTER_RADIUS = 9;
const MAX_SPEED = 26;
const ACCEL = 9;
const TURN_RATE = 0.55;
const WAKE_LIFE = 1.6;

function buildBoatMesh(color) {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.5, metalness: 0.1 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.1, 2.8), hullMat);
  hull.position.y = 0.35;
  group.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 4), hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(4.6, 0.35, 0);
  group.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 2.2), white);
  cabin.position.set(-0.6, 1.4, 0);
  group.add(cabin);
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.9, 2),
    new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.15, metalness: 0.2 })
  );
  windshield.position.set(1.1, 1.5, 0);
  group.add(windshield);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.12), white);
  rail.position.set(0, 1.1, 1.35);
  group.add(rail);
  const railB = rail.clone();
  railB.position.z = -1.35;
  group.add(railB);
  return group;
}

function buildWakeMesh() {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 5),
    new THREE.MeshBasicMaterial({
      color: 0xdff4ff, transparent: true, opacity: 0.5, depthWrite: false,
    })
  );
}

export function createBoats(world) {
  world.systems = world.systems || {};
  world.events = world.events || [];
  world.player = world.player || {};
  world.boats = world.boats || [];

  const boats = world.boats;
  const wakes = [];
  let eWasDown = false;
  let spawned = false;

  function spawnMarinaBoats() {
    if (spawned) return;
    spawned = true;
    const slots = [
      { x: 305, z: 120, color: 0xd8433c, heading: Math.PI / 2 },
      { x: 320, z: 175, color: 0x2a6fd8, heading: -Math.PI / 2 },
      { x: 295, z: 225, color: 0xe8b93a, heading: Math.PI / 2 },
      { x: 350, z: 150, color: 0x2fae6e, heading: 0 },
    ];
    for (const slot of slots) {
      const mesh = buildBoatMesh(slot.color);
      mesh.position.set(slot.x, 0.4, slot.z);
      mesh.rotation.y = -slot.heading;
      if (world.scene) world.scene.add(mesh);
      boats.push({
        mesh,
        position: new THREE.Vector3(slot.x, 0.4, slot.z),
        heading: slot.heading,
        speed: 0,
        color: slot.color,
        kind: 'boat',
        maxSpeed: MAX_SPEED,
        occupied: false,
      });
    }
  }

  function clampToBasin(position) {
    position.x = Math.max(BASIN.xMin + 4, Math.min(BASIN.xMax - 4, position.x));
    position.z = Math.max(BASIN.zMin + 4, Math.min(BASIN.zMax - 4, position.z));
    position.y = 0.4;
  }

  function spawnWake(boat) {
    const wake = buildWakeMesh();
    const back = new THREE.Vector3(-Math.sin(boat.heading), 0, -Math.cos(boat.heading));
    wake.position.set(
      boat.position.x + back.x * 5,
      0.55,
      boat.position.z + back.z * 5
    );
    wake.rotation.x = -Math.PI / 2;
    wake.rotation.z = -boat.heading;
    if (world.scene) world.scene.add(wake);
    wakes.push({ mesh: wake, age: 0 });
  }

  function updateWakes(dt) {
    for (let i = wakes.length - 1; i >= 0; i--) {
      const wake = wakes[i];
      wake.age += dt;
      const fade = 1 - wake.age / WAKE_LIFE;
      wake.mesh.material.opacity = Math.max(0, fade * 0.5);
      wake.mesh.scale.set(1 + wake.age * 0.7, 1 + wake.age * 1.1, 1);
      if (wake.age >= WAKE_LIFE) {
        if (world.scene) world.scene.remove(wake.mesh);
        wakes.splice(i, 1);
      }
    }
  }

  function nearestFreeBoat(maxDist) {
    const pos = world.player.position;
    if (!pos) return null;
    let best = null;
    let bestDist = maxDist;
    for (const boat of boats) {
      if (boat.occupied) continue;
      const d = Math.hypot(pos.x - boat.position.x, pos.z - boat.position.z);
      if (d < bestDist) {
        bestDist = d;
        best = boat;
      }
    }
    return best;
  }

  function enterBoat(boat) {
    boat.occupied = true;
    world.player.boat = boat;
    world.player.onFoot = false;
    world.player.car = null;
    world.player.position.copy(boat.position);
    world.player.heading = boat.heading;
    world.player.speed = 0;
    world.events.push({ type: 'enter-boat', boat });
  }

  function exitBoat() {
    const boat = world.player.boat;
    if (!boat) return;
    boat.occupied = false;
    boat.speed = 0;
    world.player.boat = null;
    world.player.onFoot = true;
    // Step off at the pier if close, otherwise at the boat's side.
    const nearPier = Math.hypot(boat.position.x - PIER.x, boat.position.z - PIER.z) < 40;
    if (nearPier) {
      world.player.position.set(PIER.x, 0, PIER.z);
    } else {
      world.player.position.set(boat.position.x - 4, 0, boat.position.z);
    }
    world.player.speed = 0;
    world.events.push({ type: 'exit-boat', boat });
  }

  function driveBoat(boat, dt) {
    const keys = (world.input && world.input.keys) || new Set();
    const forward = keys.has('KeyW') || keys.has('ArrowUp');
    const back = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');

    if (forward) boat.speed = Math.min(MAX_SPEED, boat.speed + ACCEL * dt);
    else if (back) boat.speed = Math.max(-6, boat.speed - ACCEL * 0.7 * dt);
    else boat.speed *= Math.max(0, 1 - dt * 0.45); // water drag

    // Slower turn than a car, and the turn only bites while moving.
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    const moving = Math.abs(boat.speed) > 0.5;
    if (moving) {
      const turnScale = Math.min(1, Math.abs(boat.speed) / 12);
      boat.heading += steer * TURN_RATE * turnScale * dt * Math.sign(boat.speed);
    }

    boat.position.x += Math.sin(boat.heading) * boat.speed * dt;
    boat.position.z += Math.cos(boat.heading) * boat.speed * dt;
    clampToBasin(boat.position);
    // Docking speed limit: crawling near the pier keeps the boat from
    // ramming the moored yachts when Rico threads back in.
    const pierDist = Math.hypot(boat.position.x - PIER.x, boat.position.z - PIER.z);
    if (pierDist < 25) boat.speed = Math.min(boat.speed, 8);
    boat.mesh.position.copy(boat.position);
    boat.mesh.rotation.y = -boat.heading;
    // Gentle bob on the water.
    boat.mesh.position.y = 0.4 + Math.sin((world.elapsed || 0) * 1.4 + boat.position.x * 0.05) * 0.12;
    boat.mesh.rotation.z = Math.sin((world.elapsed || 0) * 1.1) * 0.02;

    world.player.position.copy(boat.position);
    world.player.heading = boat.heading;
    world.player.speed = boat.speed;

    if (Math.abs(boat.speed) > 6 && Math.random() < dt * 14) spawnWake(boat);
  }

  function update(dt) {
    spawnMarinaBoats();
    updateWakes(dt);
    const keys = (world.input && world.input.keys) || new Set();
    const eDown = keys.has('KeyE');
    const ePressed = eDown && !eWasDown;
    eWasDown = eDown;

    const boat = world.player.boat;
    if (boat) {
      driveBoat(boat, dt);
      if (ePressed) exitBoat();
      return;
    }
    if (ePressed && world.player.onFoot) {
      const near = nearestFreeBoat(ENTER_RADIUS);
      if (near) enterBoat(near);
    }
  }

  const api = {
    update,
    enterBoat,
    exitBoat,
    get boats() { return boats; },
    get pier() { return PIER; },
    get basin() { return BASIN; },
  };
  world.systems.boats = api;
  return api;
}
