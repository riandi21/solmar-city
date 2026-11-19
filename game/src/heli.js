// Helicopter — the police air unit for Solmar City.
// Active at 4 wanted stars and above: follows the player from above,
// leads the player's direction of travel, and keeps a spotlight cone
// locked on them. Hides (parked out of sight) at 0 stars.
// Communicates only through the shared world object.
import * as THREE from 'three';

const CRUISE_HEIGHT = 55;
const HIDE_POSITION = new THREE.Vector3(0, -80, -700);

function buildHeliMesh() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x14203a, roughness: 0.45, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.15, metalness: 0.2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.2, 2.4), dark);
  body.position.y = 0;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 2.2), glass);
  nose.position.set(2.6, -0.1, 0);
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.9, 0.7), dark);
  tail.position.set(-4.4, 0.5, 0);
  group.add(tail);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.25), dark);
  tailFin.position.set(-7, 1.2, 0);
  group.add(tailFin);
  const skidA = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.15, 0.25), dark);
  skidA.position.set(0, -1.5, 1.1);
  group.add(skidA);
  const skidB = skidA.clone();
  skidB.position.z = -1.1;
  group.add(skidB);
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x30343c, roughness: 0.4, metalness: 0.6 });
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), bladeMat);
    blade.rotation.y = angle;
    rotor.add(blade);
  }
  rotor.position.y = 1.5;
  group.add(rotor);
  group.userData.rotor = rotor;

  // Spotlight cone (visual) — a translucent cone hanging under the heli.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(9, CRUISE_HEIGHT, 20, 1, true), coneMat);
  cone.position.y = -CRUISE_HEIGHT / 2;
  cone.rotation.x = Math.PI;
  group.add(cone);
  group.userData.cone = cone;

  // Real spotlight so the ground under the player lights up at night.
  const spot = new THREE.SpotLight(0xfff2b0, 3.2, 130, 0.32, 0.45, 1.1);
  spot.position.set(0, -1, 0);
  group.add(spot);
  group.userData.spot = spot;

  return group;
}

export function createHeli(world) {
  world.systems = world.systems || {};
  world.player = world.player || {};

  const mesh = buildHeliMesh();
  mesh.position.copy(HIDE_POSITION);
  mesh.visible = false;
  if (world.scene) world.scene.add(mesh);

  const state = {
    active: false,
    spotlightOn: false,
    // Smooth chase state so the heli eases in and out instead of popping.
    hover: mesh.position.clone(),
  };

  function playerPos() {
    return world.player.position || new THREE.Vector3(0, 0, 0);
  }

  function leadTarget() {
    const policeai = world.systems.policeai;
    if (policeai && typeof policeai.heliLeadTarget === 'function') {
      return policeai.heliLeadTarget(1.6);
    }
    const pos = playerPos();
    const speed = world.player.speed || 0;
    const heading = world.player.heading || 0;
    return new THREE.Vector3(
      pos.x + Math.sin(heading) * speed * 1.6,
      0,
      pos.z + Math.cos(heading) * speed * 1.6
    );
  }

  function update(dt) {
    const wanted = world.wanted || 0;
    const shouldBeActive = wanted >= 4;
    state.active = shouldBeActive;
    state.spotlightOn = shouldBeActive;

    const rotor = mesh.userData.rotor;
    if (rotor) rotor.rotation.y += dt * (shouldBeActive ? 22 : 4);

    if (!shouldBeActive) {
      // Sink back to the hidden parking spot and switch off.
      mesh.visible = mesh.position.y > -60;
      mesh.position.lerp(HIDE_POSITION, Math.min(1, dt * 1.5));
      mesh.userData.cone.visible = false;
      mesh.userData.spot.visible = false;
      state.hover.copy(mesh.position);
      return;
    }

    mesh.visible = true;
    const target = leadTarget();
    // On foot the heli drops lower and tightens its cone — a runner is
    // easier to pin down than a speeding car.
    const altitude = world.player.onFoot ? 38 : CRUISE_HEIGHT;
    const desired = new THREE.Vector3(target.x - 6, altitude, target.z - 6);
    state.hover.lerp(desired, Math.min(1, dt * 1.2));
    mesh.position.copy(state.hover);
    // Face the player's direction of travel.
    const heading = world.player.heading || 0;
    mesh.rotation.y = -heading + Math.PI / 2;

    // Spotlight cone tracks the player on the ground.
    const pos = playerPos();
    mesh.userData.cone.visible = true;
    mesh.userData.spot.visible = true;
    const spot = mesh.userData.spot;
    spot.target.position.set(pos.x - mesh.position.x, -CRUISE_HEIGHT, pos.z - mesh.position.z);
    // The spot target must be in the scene graph to take effect.
    if (!spot.target.parent) mesh.add(spot.target);
    const cone = mesh.userData.cone;
    cone.lookAt(new THREE.Vector3(pos.x, 0, pos.z));
    cone.rotateX(Math.PI / 2);
  }

  const api = {
    update,
    get mesh() { return mesh; },
    get active() { return state.active; },
    get spotlightOn() { return state.spotlightOn; },
    get position() { return mesh.position; },
  };
  world.systems.heli = api;
  return api;
}
