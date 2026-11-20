import * as THREE from 'three';

// Jet ski: fast, very agile on water, vulnerable — a hard hit on a wave or
// a dock costs health and can throw Rico off. Enter with E at the Sunset
// Beach jet ski dock (-150, 320) or the marina pier. Leaves a wake, jumps
// small waves, and is the craft for smuggling runs and racing; the best
// race time is tracked in world.kingpin.jetSkiBest.
const DOCK = { x: -150, z: 320 };
const MARINA = { x: 120, z: 300 };
const WATER_LEVEL = 0;

function keyDown(world, code, letter) {
  const keys = world && world.input && world.input.keys;
  if (!keys) return false;
  return keys.has(code) || keys.has(letter);
}

function makeJetSkiMesh(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x212121 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.9), paint);
  hull.position.y = 0.2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4), paint);
  nose.rotation.z = -Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(1.6, 0.2, 0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.6), dark);
  seat.position.set(-0.5, 0.45, 0);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.7), dark);
  bars.position.set(0.7, 0.6, 0);
  group.add(hull, nose, seat, bars);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function createJetSki(scene, world) {
  if (!Array.isArray(world.jetSkis)) world.jetSkis = [];
  if (!world.kingpin) world.kingpin = {};
  if (world.kingpin.jetSkiBest == null) world.kingpin.jetSkiBest = null;
  const wake = [];
  const wakeGeo = new THREE.PlaneGeometry(1.2, 2.2);
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
  let raceTimer = null;

  function spawnJetSki(x, z) {
    const color = 0x00acc1;
    const mesh = makeJetSkiMesh(color);
    mesh.position.set(x, WATER_LEVEL, z);
    scene.add(mesh);
    const js = {
      mesh, kind: 'jetski', color,
      position: mesh.position, heading: 0, speed: 0,
      maxSpeed: 46, accel: 32, steer: 3.4,
    };
    world.jetSkis.push(js);
    return js;
  }

  function addWake(x, z, heading) {
    let w = wake.find((m) => !m.visible);
    if (!w) {
      if (wake.length >= 60) return;
      w = new THREE.Mesh(wakeGeo, wakeMat);
      w.rotation.x = -Math.PI / 2;
      scene.add(w);
      wake.push(w);
    }
    w.visible = true;
    w.position.set(x, 0.05, z);
    w.rotation.z = -heading;
    w.userData.life = 2.5;
    w.scale.setScalar(0.7 + Math.random() * 0.5);
  }

  function enterJetSki(js) {
    if (!js) return false;
    world.player.currentJetSki = js;
    world.player.onFoot = false;
    world.player.position.copy(js.position);
    if (world.player.mesh) world.player.mesh.visible = false;
    // Starting a race run from a dock starts the timer.
    const nearDock = Math.hypot(js.position.x - DOCK.x, js.position.z - DOCK.z) < 12
      || Math.hypot(js.position.x - MARINA.x, js.position.z - MARINA.z) < 12;
    if (nearDock) raceTimer = 0;
    return true;
  }

  function exitJetSki() {
    const js = world.player.currentJetSki;
    if (!js) return false;
    if (raceTimer != null) {
      if (world.kingpin.jetSkiBest == null || raceTimer < world.kingpin.jetSkiBest) {
        world.kingpin.jetSkiBest = raceTimer;
      }
      raceTimer = null;
    }
    world.player.currentJetSki = null;
    world.player.onFoot = true;
    world.player.position.set(js.position.x + 2, 0, js.position.z + 2);
    world.player.speed = 0;
    if (world.player.mesh) world.player.mesh.visible = true;
    return true;
  }

  function throwOff(js) {
    js.speed = 0;
    if (raceTimer != null) raceTimer = null;
    world.player.currentJetSki = null;
    world.player.onFoot = true;
    world.player.position.set(js.position.x + 2, 0, js.position.z);
    world.player.speed = 0;
    if (world.player.mesh) world.player.mesh.visible = true;
  }

  function update(dt) {
    for (const w of wake) {
      if (!w.visible) continue;
      w.userData.life -= dt;
      w.material.opacity = Math.max(0, (w.userData.life / 2.5) * 0.4);
      if (w.userData.life <= 0) w.visible = false;
    }
    const js = world.player.currentJetSki;
    if (!js) {
      for (const j of world.jetSkis) {
        if (j && j.mesh) {
          const wave = Math.sin(world.elapsed * 1.5 + j.position.x * 0.05 + j.position.z * 0.05) * 0.12;
          j.mesh.position.set(j.position.x, WATER_LEVEL + wave, j.position.z);
          j.mesh.rotation.y = j.heading || 0;
        }
      }
      return;
    }
    const p = world.player;
    if (raceTimer != null) raceTimer += dt;
    const fwd = keyDown(world, 'KeyW', 'W');
    const back = keyDown(world, 'KeyS', 'S');
    const left = keyDown(world, 'KeyA', 'A');
    const right = keyDown(world, 'KeyD', 'D');
    if (fwd) js.speed += js.accel * dt;
    if (back) js.speed -= js.accel * 0.7 * dt;
    if (!fwd && !back) js.speed *= Math.max(0, 1 - 1.1 * dt);
    js.speed = Math.max(-6, Math.min(js.maxSpeed, js.speed));
    const steerFactor = Math.max(0.55, 1 - Math.abs(js.speed) / (js.maxSpeed * 1.8));
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const dir = js.speed >= 0 ? 1 : -1;
    js.heading += steerInput * js.steer * steerFactor * dir * dt * Math.min(1, Math.abs(js.speed) / 5 + 0.3);
    const nx = js.position.x + Math.sin(js.heading) * js.speed * dt;
    const nz = js.position.z + Math.cos(js.heading) * js.speed * dt;
    // Dock hit: a hard hit on the dock costs health and throws Rico off;
    // a slow approach just bumps the ski to a stop so docking is possible.
    const dockHit = Math.hypot(nx - DOCK.x, nz - DOCK.z) < 3 || Math.hypot(nx - MARINA.x, nz - MARINA.z) < 3;
    if (dockHit && Math.abs(js.speed) > 10) {
      if (p.health != null) p.health = Math.max(0, p.health - 15);
      throwOff(js);
      return;
    }
    if (dockHit) js.speed *= 0.3;
    js.position.x = nx;
    js.position.z = nz;
    // Wake behind the ski while moving fast.
    if (Math.abs(js.speed) > 6 && Math.random() < 0.7) {
      addWake(js.position.x - Math.sin(js.heading) * 1.6, js.position.z - Math.cos(js.heading) * 1.6, js.heading);
    }
    // Jump small waves: bob + a little air on wave crests at speed.
    const wavePhase = world.elapsed * 2 + js.position.x * 0.08 + js.position.z * 0.08;
    const waveH = Math.sin(wavePhase) * 0.25;
    const air = Math.abs(js.speed) > 28 && Math.sin(wavePhase) > 0.85 ? 0.5 : 0;
    js.mesh.position.set(js.position.x, WATER_LEVEL + waveH + air, js.position.z);
    js.mesh.rotation.y = js.heading;
    js.mesh.rotation.z = -steerInput * Math.min(0.25, Math.abs(js.speed) * 0.006);
    p.position.copy(js.position);
    p.heading = js.heading;
    p.speed = js.speed;
    if (p.mesh) p.mesh.visible = false;
  }

  return { update, spawnJetSki, enterJetSki, exitJetSki, dock: DOCK, marina: MARINA };
}
