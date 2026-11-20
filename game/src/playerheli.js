import * as THREE from 'three';

// Flyable helicopter Rico owns after M38. Enter with E at the Coral Club
// rooftop helipad (29,29 roof) or the airfield. W climb, S descend,
// A/D steer, Shift forward. Lands on helipad / runway / flat rooftop.
// Rotor spins up on entry, down on exit. Fragile: hard landing costs health.
// State lives in world.playerHeli.
// CRITICAL: E is EDGE-TRIGGERED. Entry uses a press (not held) check, and
// the exit check never runs in the same tick as an entry. Boarding sets
// world.playerHeli.boarded = true and it stays true while E is held.
export function createPlayerHeli(scene, world) {
  const HELIPAD = { x: 29, z: 29, y: 24 };
  const AIRFIELD = { x: 420, z: -260, y: 0 };
  let eWasDown = false;
  let rotorSpeed = 0;
  let parkedY = HELIPAD.y; // ground height under the heli (roof 24 / field 0)

  const mesh = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.7, 5),
    new THREE.MeshStandardMaterial({ color: 0xb23a2e, roughness: 0.4, metalness: 0.35 })
  );
  mesh.add(body);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 1.0, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.6 })
  );
  glass.position.set(0, 0.35, 1.9);
  mesh.add(glass);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 4.4),
    new THREE.MeshStandardMaterial({ color: 0xb23a2e })
  );
  tail.position.set(0, 0.3, -4.4);
  mesh.add(tail);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.08, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  rotor.position.y = 1.25;
  mesh.add(rotor);
  const tailRotor = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 2.2, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  tailRotor.position.set(0.35, 0.3, -6.4);
  mesh.add(tailRotor);
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 4.4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  skidL.position.set(-1.1, -1.05, 0);
  const skidR = skidL.clone(); skidR.position.x = 1.1;
  mesh.add(skidL, skidR);
  mesh.position.set(HELIPAD.x, HELIPAD.y, HELIPAD.z);
  scene.add(mesh);

  world.playerHeli = {
    mesh, position: mesh.position, heading: 0, speed: 0,
    altitude: 0, rotorSpeed: 0, onGround: true, boarded: false,
  };

  function nearPad() {
    const p = world.player.position;
    const onRoof = Math.hypot(p.x - HELIPAD.x, p.z - HELIPAD.z) < 6 && p.y > 18;
    const atField = Math.hypot(p.x - AIRFIELD.x, p.z - AIRFIELD.z) < 14;
    const atHeli = world.playerHeli.position.distanceTo(p) < 6;
    return onRoof || atField || atHeli;
  }

  function enter() {
    if (world.playerHeli.boarded || !world.player.onFoot || !nearPad()) return false;
    // Remember the ground height under the heli (roof vs airfield).
    parkedY = world.player.position.y > 18 ? HELIPAD.y : AIRFIELD.y;
    world.playerHeli.altitude = 0;
    world.playerHeli.onGround = true;
    world.playerHeli.position.y = parkedY;
    world.playerHeli.boarded = true;
    world.player.currentHeli = world.playerHeli;
    world.player.onFoot = false;
    return true;
  }

  function exit() {
    if (!world.playerHeli.boarded) return false;
    if (!world.playerHeli.onGround) return false; // can't bail mid-air
    world.playerHeli.boarded = false;
    world.player.currentHeli = null;
    world.player.onFoot = true;
    world.player.position.copy(world.playerHeli.position);
    world.player.position.x += 4;
    world.player.position.y = world.playerHeli.position.y <= 1 ? 0 : world.playerHeli.position.y;
    world.playerHeli.speed = 0;
    return true;
  }

  function boarded() { return !!world.playerHeli.boarded; }

  function update(dt) {
    const h = world.playerHeli;
    const keys = world.input ? world.input.keys : new Set();
    const eDown = keys.has('KeyE');
    const ePressed = eDown && !eWasDown;
    eWasDown = eDown;

    // Rotor spin-up on entry, spin-down on exit.
    const targetRotor = h.boarded ? 26 : 0;
    rotorSpeed += (targetRotor - rotorSpeed) * Math.min(1, dt * (h.boarded ? 0.9 : 1.6));
    h.rotorSpeed = rotorSpeed;
    rotor.rotation.y += rotorSpeed * dt;
    tailRotor.rotation.x += rotorSpeed * 1.4 * dt;

    if (!h.boarded) {
      // Edge-triggered entry only; no exit check in this branch at all.
      if (ePressed && world.player.onFoot) enter();
      return;
    }
    // Boarded: E stays latched — do NOT clear boarded while E is held.
    // Exit only on a fresh press, and never in the same tick as an entry
    // (entry returns early above, so this branch can't run on entry tick).
    if (ePressed) { exit(); return; }

    const liftReady = rotorSpeed > 14;
    if (keys.has('KeyW') && liftReady) {
      h.altitude = Math.min(h.altitude + 10 * dt, 180);
      h.onGround = false;
    }
    if (keys.has('KeyS')) {
      h.altitude = Math.max(h.altitude - 10 * dt, 0);
      if (h.altitude <= 0) h.onGround = true;
    }
    const turn = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    h.heading += turn * 1.1 * dt;
    const forward = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const targetSpeed = forward && !h.onGround ? 34 : forward ? 8 : 0;
    h.speed = THREE.MathUtils.lerp(h.speed, targetSpeed, Math.min(1, dt * 1.5));
    h.position.x += Math.sin(h.heading) * h.speed * dt;
    h.position.z += Math.cos(h.heading) * h.speed * dt;
    const prevAlt = h.altitude;
    h.position.y = parkedY + h.altitude;
    if (h.onGround && h.altitude === 0 && prevAlt > 0) {
      // Hard landing: touching down with forward speed costs health.
      if (h.speed > 20) {
        world.player.health = Math.max(0, (world.player.health ?? 100) - 25);
      }
      h.speed = 0;
    }
    mesh.rotation.y = h.heading;
    mesh.rotation.z = -turn * 0.06;
    mesh.rotation.x = forward && !h.onGround ? -0.06 : 0;
    world.player.position.copy(h.position);
    world.player.heading = h.heading;
    world.player.speed = h.speed;
    world.player.onFoot = false;
  }

  return { update, enter, exit, boarded };
}
