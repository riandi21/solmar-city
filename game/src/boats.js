import * as THREE from 'three';

// Marina boats, drivable on the water. Enter/exit at the pier with E.
// Islands are reachable by boat from the marina pier.
// world.boats entries: {mesh, position, heading, speed, kind}.
// world.playerBoat is the boat the player currently drives (or null).
export function createBoats(scene, world) {
  if (!Array.isArray(world.boats)) world.boats = [];
  world.playerBoat = world.playerBoat ?? null;
  const WATER_Y = 0.4;
  const PIER = { x: 300, z: 210 };
  let eWasDown = false;
  let wakeTimer = 0;

  const hullColors = { speedboat: 0xd8433a, yacht: 0xe8e4da, fishing: 0x3a7d5c, dinghy: 0xe0a53a };

  function makeBoatMesh(kind) {
    const g = new THREE.Group();
    const color = hullColors[kind] ?? 0xcccccc;
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(kind === 'yacht' ? 7 : 4.4, 0.9, kind === 'yacht' ? 2.6 : 1.8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25 })
    );
    hull.position.y = 0.45;
    g.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 })
    );
    cabin.position.set(kind === 'yacht' ? -0.5 : 0.3, 1.4, 0);
    g.add(cabin);
    // Wake emitter marker (visual wake spawned in update).
    return g;
  }

  function spawnBoat(kind, x, z) {
    const mesh = makeBoatMesh(kind);
    mesh.position.set(x, WATER_Y, z);
    scene.add(mesh);
    const boat = { mesh, position: mesh.position, heading: world.rng() * Math.PI * 2, speed: 0, kind };
    world.boats.push(boat);
    return boat;
  }

  // Marina fleet.
  spawnBoat('speedboat', 296, 218);
  spawnBoat('yacht', 308, 224);
  spawnBoat('fishing', 292, 206);
  spawnBoat('dinghy', 312, 212);

  function nearestBoat(maxDist = 5) {
    let best = null; let bestD = maxDist;
    for (const b of world.boats) {
      const d = b.position.distanceTo(world.player.position);
      if (d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  function enter(boat) {
    const b = boat ?? nearestBoat();
    if (!b || world.player.onFoot === false) return false;
    world.playerBoat = b;
    world.player.currentBoat = b;
    world.player.onFoot = false;
    world.player.position.copy(b.position);
    return true;
  }

  function exit() {
    const b = world.playerBoat;
    if (!b) return false;
    // Step off toward the nearest shore: pier side if near the marina,
    // otherwise the side facing the closest land is approximated by the
    // pier direction from the boat.
    const toPier = new THREE.Vector3(PIER.x - b.position.x, 0, PIER.z - b.position.z);
    if (toPier.lengthSq() < 1) toPier.set(1, 0, 0);
    toPier.normalize();
    world.player.position.copy(b.position).addScaledVector(toPier, 3);
    world.player.position.y = 0;
    world.player.onFoot = true;
    world.player.currentBoat = null;
    world.playerBoat = null;
    b.speed = 0;
    return true;
  }

  function update(dt) {
    const keys = world.input ? world.input.keys : new Set();
    const eDown = keys.has('KeyE');
    const ePressed = eDown && !eWasDown;
    eWasDown = eDown;

    if (world.playerBoat) {
      const b = world.playerBoat;
      const grip = world.weatherGrip ?? 1;
      const accel = keys.has('KeyW') ? 9 * grip : keys.has('KeyS') ? -5 : 0;
      const maxSpeed = b.kind === 'speedboat' ? 26 : b.kind === 'yacht' ? 16 : 12;
      b.speed = THREE.MathUtils.clamp(b.speed + accel * dt, -6, maxSpeed);
      b.speed *= Math.max(0, 1 - 0.25 * dt); // water drag
      // Slower turn than a car, and turn rate scales with speed.
      const turn = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
      b.heading += turn * 0.55 * Math.min(1, Math.abs(b.speed) / 8) * dt * Math.sign(b.speed || 1);
      b.position.x += Math.sin(b.heading) * b.speed * dt;
      b.position.z += Math.cos(b.heading) * b.speed * dt;
      b.position.y = WATER_Y + Math.sin(world.elapsed * 1.4 + b.position.x * 0.05) * 0.12;
      b.mesh.rotation.y = b.heading;
      b.mesh.rotation.z = -turn * 0.04 * Math.min(1, Math.abs(b.speed) / 10);
      world.player.position.copy(b.position);
      world.player.heading = b.heading;
      world.player.speed = b.speed;
      world.player.onFoot = false;

      // Wake behind the boat.
      wakeTimer -= dt;
      if (Math.abs(b.speed) > 6 && wakeTimer <= 0) {
        wakeTimer = 0.12;
        const wake = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 2.4),
          new THREE.MeshBasicMaterial({ color: 0xdfeef5, transparent: true, opacity: 0.45, depthWrite: false })
        );
        wake.rotation.x = -Math.PI / 2;
        wake.position.copy(b.position).addScaledVector(new THREE.Vector3(-Math.sin(b.heading), 0, -Math.cos(b.heading)), 3);
        wake.position.y = WATER_Y + 0.05;
        scene.add(wake);
        setTimeout(() => scene.remove(wake), 900);
      }
      if (ePressed) exit();
    } else {
      // Idle bob for moored boats.
      for (const b of world.boats) {
        if (b === world.playerBoat) continue;
        b.mesh.position.y = WATER_Y + Math.sin(world.elapsed * 1.2 + b.position.x * 0.05) * 0.1;
        b.mesh.rotation.y = b.heading;
      }
      if (ePressed && world.player.onFoot) {
        const p = world.player.position;
        const nearPier = Math.hypot(p.x - PIER.x, p.z - PIER.z) < 40;
        if (nearPier) enter(nearestBoat(6));
      }
    }
  }

  return { update, enter, exit, spawnBoat };
}
