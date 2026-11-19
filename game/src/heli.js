// Solmar City — police helicopter: one heli at 4+ stars, a second at 5.
// Follows the player from above with lead (it anticipates where Rico is
// heading), a spotlight cone, and hides at 0-3 stars. At night, being
// caught in the spotlight on foot raises wanted faster.
// world.policeHelis is the list of heli state; the system lives in
// world.systems / world.systemObjects.
import * as THREE from 'three';

export const HELI_ALTITUDE = 38;
export const HELI_SPEED = 34;

function resolveArgs(scene, world) {
  if (!world) {
    world = scene;
    scene = (world && world.scene) || null;
  }
  return { scene, world };
}

function buildPoliceHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 4.6), bodyMat);
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.4, 4.0), whiteMat);
  stripe.position.y = 0.3;
  group.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), bodyMat);
  tail.position.set(0, 0.3, -4.2);
  group.add(tail);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 1.0), bodyMat);
  tailFin.position.set(0, 0.9, -6.0);
  group.add(tailFin);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1;
  group.add(rotor);
  group.userData.rotor = rotor;
  // Spotlight cone: a visible beam from the belly to the ground.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(7, HELI_ALTITUDE, 16, 1, true), beamMat);
  beam.position.y = -HELI_ALTITUDE / 2;
  beam.visible = false;
  group.add(beam);
  group.userData.beam = beam;
  const skids = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 3.4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  skids.position.y = -1.0;
  group.add(skids);
  return group;
}

export function createHeli(scene, world) {
  ({ scene, world } = resolveArgs(scene, world));
  if (!world) throw new Error('createHeli needs a world');
  if (!Array.isArray(world.systems)) world.systems = [];
  world.systemObjects = world.systemObjects || {};
  if (!Array.isArray(world.policeHelis)) world.policeHelis = [];
  if (!world.player) {
    world.player = { position: new THREE.Vector3(0, 0, 0), heading: 0, speed: 0, onFoot: true, health: 100, mesh: null };
  }
  if (!(world.player.position instanceof THREE.Vector3) && world.player.position) {
    const p = world.player.position;
    world.player.position = new THREE.Vector3(p.x, p.y || 0, p.z || 0);
  }

  const hasScene = scene && typeof scene.add === 'function';
  const helis = world.policeHelis;
  let spotTimer = 0;

  function spawnHeli(index) {
    const mesh = hasScene ? buildPoliceHeliMesh() : null;
    const heli = {
      index,
      mesh,
      position: new THREE.Vector3(80, 120, -203),
      heading: 0,
      speed: 0,
      altitude: HELI_ALTITUDE,
      rotorSpeed: 0,
      active: false,
      spotlightOnPlayer: false,
    };
    if (mesh) {
      mesh.visible = false;
      mesh.position.copy(heli.position);
      scene.add(mesh);
    }
    helis.push(heli);
    return heli;
  }

  spawnHeli(0);
  spawnHeli(1);

  function wantedLevel() {
    return Math.max(0, Math.min(5, world.wanted || 0));
  }

  function isNight() {
    if (world.daynight && typeof world.daynight.isNight === 'boolean') return world.daynight.isNight;
    return !!world.isNight;
  }

  function activeCount() {
    return helis.filter((h) => h.active).length;
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    if (world.mode === 'pause' || world.mode === 'over') return;
    const wanted = wantedLevel();
    const wantActive = wanted >= 5 ? 2 : wanted >= 4 ? 1 : 0;
    const pp = world.player.position;
    // Player velocity, for the heli's lead: it aims ahead of Rico.
    const pSpeed = world.player.speed || 0;
    const pHeading = world.player.heading || 0;
    const leadTime = 1.2;
    const leadX = pp.x + Math.sin(pHeading) * pSpeed * leadTime;
    const leadZ = pp.z + Math.cos(pHeading) * pSpeed * leadTime;
    const night = isNight();
    let anySpot = false;

    for (let i = 0; i < helis.length; i += 1) {
      const heli = helis[i];
      const shouldBeActive = i < wantActive;
      if (shouldBeActive && !heli.active) {
        heli.active = true;
        // Spawn in above the player instead of flying in from the station.
        heli.position.set(pp.x, HELI_ALTITUDE + 40, pp.z - 30);
        if (heli.mesh) heli.mesh.visible = true;
      } else if (!shouldBeActive && heli.active) {
        heli.active = false;
        heli.spotlightOnPlayer = false;
        if (heli.mesh) heli.mesh.visible = false;
      }
      if (!heli.active) continue;
      heli.rotorSpeed = Math.min(30, heli.rotorSpeed + 20 * dt);
      // Hover point: above the lead point, offset so the heli does not sit
      // exactly on top of the player.
      const hoverX = leadX + (i === 0 ? -14 : 14);
      const hoverZ = leadZ - 10;
      const dx = hoverX - heli.position.x;
      const dz = hoverZ - heli.position.z;
      const dist = Math.hypot(dx, dz);
      const step = Math.min(dist, HELI_SPEED * dt);
      if (dist > 0.01) {
        heli.position.x += (dx / dist) * step;
        heli.position.z += (dz / dist) * step;
        heli.heading = Math.atan2(dx, dz);
      }
      heli.position.y += (HELI_ALTITUDE - heli.position.y) * Math.min(1, dt * 1.5);
      // Standoff: never hover directly on top of the player — keep a
      // minimum horizontal gap so the rotor wash reads on screen.
      const gap = Math.hypot(pp.x - heli.position.x, pp.z - heli.position.z);
      if (gap > 0.01 && gap < 8) {
        const push = (8 - gap) * dt * 2;
        heli.position.x -= ((pp.x - heli.position.x) / gap) * push;
        heli.position.z -= ((pp.z - heli.position.z) / gap) * push;
      }
      // Spotlight tracks the player; the beam is visible at night.
      const groundDist = Math.hypot(pp.x - heli.position.x, pp.z - heli.position.z);
      heli.spotlightOnPlayer = groundDist < 12;
      if (heli.mesh) {
        heli.mesh.position.copy(heli.position);
        heli.mesh.rotation.y = heli.heading;
        if (heli.mesh.userData.rotor) heli.mesh.userData.rotor.rotation.y += heli.rotorSpeed * dt;
        if (heli.mesh.userData.beam) {
          heli.mesh.userData.beam.visible = night || heli.spotlightOnPlayer;
          heli.mesh.userData.beam.material.opacity = night ? 0.28 : 0.12;
          // Aim the beam at the player on the ground.
          const beam = heli.mesh.userData.beam;
          beam.lookAt(pp.x - heli.position.x, -HELI_ALTITUDE, pp.z - heli.position.z);
          beam.rotateX(Math.PI);
        }
      }
      if (heli.spotlightOnPlayer) anySpot = true;
    }

    // Night spotlight: caught on foot in the beam, wanted climbs faster.
    if (anySpot && night && world.player.onFoot && wanted > 0 && wanted < 5) {
      spotTimer += dt;
      if (spotTimer >= 3) {
        spotTimer = 0;
        world.wanted = Math.min(5, wanted + 1);
        if (world.events) world.events.push({ type: 'spotlight-spotted' });
      }
    } else {
      spotTimer = Math.max(0, spotTimer - dt);
    }
    world.heliSpotlight = anySpot;
  }

  const system = { name: 'heli', update, activeCount, helis, wantedLevel };
  world.systems.push(system);
  world.systemObjects.heli = system;
  world.systemObjects.policeHeli = system;
  return system;
}

export const createPoliceHeli = createHeli;
export default createHeli;
