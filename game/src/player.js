import * as THREE from 'three';

const ROADS = [-232, -174, -116, -58, 0, 58, 116, 174, 232];
const BOUND = 262;

function keySet(input) {
  if (!input) return new Set();
  if (input.keys instanceof Set) return input.keys;
  if (Array.isArray(input.keys)) return new Set(input.keys);
  if (input.pressed instanceof Set) return input.pressed;
  return new Set();
}

function clampToCity(p) {
  p.x = Math.max(-BOUND, Math.min(BOUND, p.x));
  p.z = Math.max(-BOUND, Math.min(BOUND + 60, p.z));
}

function pushOutOfColliders(p, colliders, radius) {
  if (!colliders) return;
  for (const c of colliders) {
    const minX = (c.minX ?? c.xMin ?? c.x0 ?? -Infinity) - radius;
    const maxX = (c.maxX ?? c.xMax ?? c.x1 ?? Infinity) + radius;
    const minZ = (c.minZ ?? c.zMin ?? c.z0 ?? -Infinity) - radius;
    const maxZ = (c.maxZ ?? c.zMax ?? c.z1 ?? Infinity) + radius;
    if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ) {
      const dxl = p.x - minX, dxr = maxX - p.x;
      const dzl = p.z - minZ, dzr = maxZ - p.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x = minX;
      else if (m === dxr) p.x = maxX;
      else if (m === dzl) p.z = minZ;
      else p.z = maxZ;
    }
  }
}

function nearestVehicle(world, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of world.cars || []) {
    if (!car || !car.position) continue;
    const d = car.position.distanceTo(world.player.position);
    if (d < bestD) { bestD = d; best = { kind: 'car', ref: car, dist: d }; }
  }
  for (const bike of world.bikes || []) {
    if (!bike || !bike.position) continue;
    const d = bike.position.distanceTo(world.player.position);
    if (d < bestD) { bestD = d; best = { kind: 'bike', ref: bike, dist: d }; }
  }
  return best;
}

export function createPlayer(world) {
  const p = world.player;
  p.position = p.position || new THREE.Vector3(-170, 0, 228);
  p.heading = p.heading ?? Math.PI;
  p.speed = p.speed ?? 0;
  p.onFoot = p.onFoot !== false;
  p.health = p.health ?? 100;
  p.cash = p.cash ?? 0;
  p.nos = p.nos ?? 100;
  p.tireDamage = p.tireDamage ?? 0;

  const mesh = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x0e7a6b, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x22304a, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 4, 10), shirt);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin);
  head.position.y = 1.78;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8a020, roughness: 0.7 }));
  cap.position.y = 1.98;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
  legL.position.set(-0.16, 0.42, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.68, 0.17), shirt);
  armL.position.set(-0.48, 1.1, 0);
  const armR = armL.clone();
  armR.position.x = 0.48;
  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.34), shoe);
  footL.position.set(-0.16, 0.05, 0.05);
  const footR = footL.clone();
  footR.position.x = 0.16;
  mesh.add(torso, head, cap, legL, legR, armL, armR, footL, footR);
  mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  mesh.position.copy(p.position);
  if (world.scene) world.scene.add(mesh);
  p.mesh = mesh;

  let vy = 0, grounded = true, walkPhase = 0, eWasDown = false;
  let prevX = p.position.x, prevZ = p.position.z;

  function enterVehicle(found) {
    if (!found) return false;
    if (found.kind === 'car') {
      p.car = found.ref; p.bike = null;
      found.ref.driver = 'player';
    } else {
      p.bike = found.ref; p.car = null;
      found.ref.driver = 'player';
    }
    p.currentCar = p.car;
    p.currentBike = p.bike;
    p.onFoot = false;
    p.speed = 0;
    mesh.visible = false;
    return true;
  }

  function exitVehicle() {
    const veh = p.car || p.bike;
    if (veh && veh.position) {
      const side = new THREE.Vector3(Math.cos(veh.heading || 0), 0, -Math.sin(veh.heading || 0));
      p.position.copy(veh.position).addScaledVector(side, 2.4);
      p.position.y = 0;
      p.heading = veh.heading || p.heading;
    }
    p.car = null; p.bike = null;
    p.currentCar = null; p.currentBike = null;
    p.onFoot = true;
    p.speed = 0;
    mesh.visible = true;
    mesh.position.copy(p.position);
  }

  function update(dt) {
    if (world.mode && world.mode !== 'play') return;
    if (!p.onFoot) {
      // Riding: E exits the vehicle, the mesh reappears beside it.
      const keys = keySet(world.input);
      const eDown = keys.has('KeyE') || keys.has('e');
      if (eDown && !eWasDown) exitVehicle();
      eWasDown = eDown;
      if (!p.onFoot) {
        if (p.car && p.car.position) mesh.position.copy(p.car.position);
        else if (p.bike && p.bike.position) mesh.position.copy(p.bike.position);
        mesh.visible = false;
      }
      return;
    }
    mesh.visible = true;
    const keys = keySet(world.input);
    const eDown = keys.has('KeyE') || keys.has('e');
    if (eDown && !eWasDown) {
      const found = nearestVehicle(world, 4.2);
      if (found) enterVehicle(found);
    }
    eWasDown = eDown;
    if (!p.onFoot) return;

    // Camera-relative WASD.
    const cam = world.camera;
    let fwd = new THREE.Vector3(0, 0, -1);
    let right = new THREE.Vector3(1, 0, 0);
    if (cam) {
      cam.getWorldDirection(fwd);
      fwd.y = 0; fwd.normalize();
      // fwd x up is the camera's right hand side (facing -Z gives +X).
      right.crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    }
    const move = new THREE.Vector3();
    if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const targetSpeed = move.lengthSq() > 0 ? (sprint ? 10.5 : 5.8) : 0;
    if (move.lengthSq() > 0) {
      move.normalize();
      p.heading = Math.atan2(move.x, move.z);
    }
    p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 10);
    p.position.addScaledVector(move, p.speed * dt);

    // Jump with gravity.
    if ((keys.has('Space')) && grounded) { vy = 7.5; grounded = false; }
    if (!grounded) {
      vy -= 22 * dt;
      p.position.y += vy * dt;
      if (p.position.y <= 0) { p.position.y = 0; vy = 0; grounded = true; }
    }

    const colliders = world.city && world.city.colliders;
    pushOutOfColliders(p.position, colliders, 0.45);
    clampToCity(p.position);

    // Walk / run swing.
    walkPhase += p.speed * dt * 1.6;
    const swing = Math.sin(walkPhase) * Math.min(1, p.speed / 5) * 0.65;
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8;
    footL.position.z = 0.05 + Math.max(0, Math.sin(walkPhase)) * 0.08;
    footR.position.z = 0.05 + Math.max(0, -Math.sin(walkPhase)) * 0.08;
    torso.position.y = 1.05 + Math.abs(Math.sin(walkPhase)) * 0.05;

    mesh.position.copy(p.position);
    mesh.rotation.y = p.heading;
    // Track real displacement so the HUD speed reads true movement.
    const dx = p.position.x - prevX, dz = p.position.z - prevZ;
    p.actualSpeed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    prevX = p.position.x; prevZ = p.position.z;
  }

  function teleport(x, z) {
    p.position.set(x, 0, z);
    p.car = null; p.bike = null; p.currentCar = null; p.currentBike = null; p.onFoot = true;
    mesh.visible = true;
    mesh.position.copy(p.position);
  }

  return { update, mesh, enterVehicle, exitVehicle, teleport, nearestVehicle: () => nearestVehicle(world, 4.2) };
}
