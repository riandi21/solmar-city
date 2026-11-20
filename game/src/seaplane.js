import * as THREE from 'three';

// Small seaplane: takes off from water (marina, sea, Islands lagoon),
// lands on water or the airfield runway. W/S altitude, A/D steering.
// Faster than a car, fragile: hard landing / crash costs health.
// State lives in world.seaplane: {mesh, position, heading, speed, altitude, onWater}.
export function createSeaplane(scene, world) {
  const DOCK = { x: 320, z: 200 };
  const AIRSTRIP = { x: 420, z: -260 };
  const WATER_Y = 0.4;
  let eWasDown = false;
  let flying = false;

  const mesh = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.5, 5.4, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5, metalness: 0.3 })
  );
  body.rotation.x = Math.PI / 2;
  mesh.add(body);
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 0.18, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x2f6fb2, roughness: 0.5 })
  );
  wing.position.y = 0.55;
  mesh.add(wing);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.16, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x2f6fb2, roughness: 0.5 })
  );
  tail.position.set(0, 0.4, -2.4);
  mesh.add(tail);
  const prop = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.6, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  prop.position.z = 2.9;
  mesh.add(prop);
  const floatL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
  );
  floatL.rotation.x = Math.PI / 2; floatL.position.set(-1.1, -0.85, 0.4);
  const floatR = floatL.clone(); floatR.position.x = 1.1;
  mesh.add(floatL, floatR);
  mesh.position.set(DOCK.x, WATER_Y, DOCK.z);
  scene.add(mesh);

  world.seaplane = {
    mesh, position: mesh.position, heading: 0, speed: 0, altitude: 0, onWater: true,
  };
  world.player.currentSeaplane = null;

  function nearDock() {
    const p = world.player.position;
    return Math.hypot(p.x - DOCK.x, p.z - DOCK.z) < 8 ||
      Math.hypot(p.x - AIRSTRIP.x, p.z - AIRSTRIP.z) < 14;
  }

  function enter() {
    if (world.player.currentSeaplane || !world.player.onFoot || !nearDock()) return false;
    world.player.currentSeaplane = world.seaplane;
    world.player.onFoot = false;
    flying = false;
    world.seaplane.onWater = true;
    return true;
  }

  function exit() {
    if (!world.player.currentSeaplane) return false;
    if (flying && world.seaplane.altitude > 3) return false; // can't bail mid-air
    world.player.currentSeaplane = null;
    world.player.onFoot = true;
    world.player.position.copy(world.seaplane.position);
    world.player.position.x += 4;
    world.player.position.y = 0;
    world.seaplane.speed = 0;
    flying = false;
    return true;
  }

  function takeOff() {
    if (!world.player.currentSeaplane || flying) return false;
    if (world.seaplane.speed < 14) return false; // needs runway/water speed first
    flying = true;
    world.seaplane.onWater = false;
    return true;
  }

  function land() {
    if (!flying) return false;
    flying = false;
    world.seaplane.altitude = 0;
    world.seaplane.onWater = true;
    return true;
  }

  function crashCheck(vSpeed) {
    // Hard landing / crash costs health.
    if (vSpeed > 9) {
      world.player.health = Math.max(0, (world.player.health ?? 100) - 35);
      world.player.speed = 0;
      world.seaplane.speed = 0;
    }
  }

  function update(dt) {
    const sp = world.seaplane;
    const keys = world.input ? world.input.keys : new Set();
    const eDown = keys.has('KeyE');
    const ePressed = eDown && !eWasDown;
    eWasDown = eDown;
    prop.rotation.z += (world.player.currentSeaplane ? 22 : 0.5) * dt;

    if (!world.player.currentSeaplane) {
      if (ePressed && world.player.onFoot) enter();
      return;
    }
    const boarded = world.player.currentSeaplane === sp;
    if (!boarded) return;

    const grip = world.weatherGrip ?? 1;
    if (!flying) {
      // Taxi on water / runway.
      if (keys.has('KeyW')) sp.speed = Math.min(sp.speed + 8 * grip * dt, 20);
      if (keys.has('KeyS')) sp.speed = Math.max(sp.speed - 10 * dt, 0);
      sp.speed *= Math.max(0, 1 - 0.1 * dt);
      if (keys.has('Space') || (keys.has('KeyW') && sp.speed > 14)) takeOff();
    } else {
      if (keys.has('KeyW')) sp.altitude = Math.min(sp.altitude + 9 * dt, 160);
      if (keys.has('KeyS')) sp.altitude = Math.max(sp.altitude - 9 * dt, 0);
      sp.speed = THREE.MathUtils.clamp(sp.speed + (keys.has('ShiftLeft') ? 6 : 2) * dt, 12, 42);
      if (sp.altitude <= 0.5) {
        // Touchdown: a fast descent onto water/runway is a hard landing.
        if (sp.speed > 26) crashCheck(12);
        land();
      }
    }
    const turn = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    sp.heading += turn * (flying ? 0.9 : 0.4) * dt;
    sp.position.x += Math.sin(sp.heading) * sp.speed * dt;
    sp.position.z += Math.cos(sp.heading) * sp.speed * dt;
    const targetY = flying ? WATER_Y + sp.altitude : WATER_Y + Math.sin(world.elapsed * 1.4) * 0.1;
    sp.position.y = targetY;
    mesh.rotation.y = sp.heading;
    mesh.rotation.z = -turn * 0.12;
    mesh.rotation.x = flying && keys.has('KeyW') ? -0.08 : 0;
    world.player.position.copy(sp.position);
    world.player.heading = sp.heading;
    world.player.speed = sp.speed;
    world.player.onFoot = false;

    // Crash into terrain/water at speed while flying low.
    if (flying && sp.altitude < 2 && sp.speed > 30) {
      world.player.health = Math.max(0, (world.player.health ?? 100) - 20);
      sp.speed *= 0.5;
    }
    if (ePressed) exit();
  }

  return { update, enter, exit, takeOff, land };
}
