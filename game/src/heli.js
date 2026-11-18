// Police helicopter: shows up at 4+ wanted stars, spotlights the player.
//   createHelicopter(scene, world) -> { update(dt), active, pos }
// `pos` IS the heli group's THREE.Vector3, so staging code can move it
// directly. The spotlight cone hangs straight down from the belly (the heli
// always hovers right above the player) and a light disc marks the player
// on the ground. When the heat drops below 4 stars the heli climbs away
// and hides. Cheap on purpose: ~10 meshes in one Group + one ground disc.
import * as THREE from 'three';

const HOVER_HEIGHT = 50; // hover band 45-55 m; ease toward the middle
const SPAWN_HEIGHT = 60; // height above the player when it first appears
const FOLLOW_SPEED = 25; // m/s, horizontal chase speed
const VERTICAL_SPEED = 12; // m/s, ease toward the hover band
const CLIMB_AWAY_SPEED = 18; // m/s, leaving when the heat drops
const DEPART_HEIGHT = 130; // hide once it has climbed this high
const ROTOR_SPEED = 25; // rad/s, main rotor
const TAIL_ROTOR_SPEED = 30; // rad/s, tail rotor

export function createHelicopter(scene, world) {
  const group = new THREE.Group();
  group.visible = false;

  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5, metalness: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e2233, roughness: 0.2, metalness: 0.5 });
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });

  // Body: dark shell + white stripe + glass nose.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.2), darkMat);
  body.position.y = 0;
  body.castShadow = true;
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.4, 4.24), whiteMat);
  stripe.position.y = 0.1;
  group.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.2), glassMat);
  glass.position.set(0, 0.25, 1.6);
  group.add(glass);
  // Tail boom + fin, stretching back (-Z).
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5.5), darkMat);
  boom.position.set(0, 0.3, -4.6);
  boom.castShadow = true;
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 1.4), darkMat);
  fin.position.set(0, 1.0, -7.0);
  group.add(fin);
  // Main rotor on a short mast; spins fast around Y.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8), rotorMat);
  mast.position.y = 1.1;
  group.add(mast);
  const mainRotor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 0.6), rotorMat);
  mainRotor.position.y = 1.5;
  mainRotor.castShadow = true;
  group.add(mainRotor);
  // Tail rotor on the side of the fin; spins around X.
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.3), rotorMat);
  tailRotor.position.set(0.25, 1.0, -7.0);
  group.add(tailRotor);
  // Landing skids.
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3.6), rotorMat);
    skid.position.set(side * 0.95, -1.15, 0);
    group.add(skid);
  }
  // Spotlight cone: unit height, stretched to the ground each frame so the
  // apex stays at the belly and the wide end sits on the ground.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 1, 20, 1, true), coneMat);
  cone.position.y = -HOVER_HEIGHT / 2;
  cone.scale.y = HOVER_HEIGHT;
  group.add(cone);

  // Ground light disc: a scene-level mesh (not a child of the group) so it
  // stays flat on the ground while the heli moves.
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const groundDisc = new THREE.Mesh(new THREE.CircleGeometry(7, 24), discMat);
  groundDisc.rotation.x = -Math.PI / 2;
  groundDisc.position.y = 0.15;
  groundDisc.visible = false;
  scene.add(groundDisc);

  scene.add(group);

  const heli = { update, active: false, pos: group.position };

  function update(dt) {
    const capped = Math.min(dt || 0, 0.05);
    try {
      const pp = world && world.player && world.player.pos;
      const wanted = (world && world.wanted) || 0;
      if (wanted >= 4 && pp) {
        if (!heli.active) {
          // Spawn ~60 m above the player.
          group.position.set(pp.x, (pp.y || 0) + SPAWN_HEIGHT, pp.z);
          group.visible = true;
          heli.active = true;
        }
        // Follow the player at ~25 m/s horizontally.
        const dx = pp.x - group.position.x;
        const dz = pp.z - group.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01) {
          const step = Math.min(d, FOLLOW_SPEED * capped);
          group.position.x += (dx / d) * step;
          group.position.z += (dz / d) * step;
          // Nose follows the direction of travel.
          group.rotation.y = Math.atan2(dx, dz);
        }
        // Ease into the 45-55 m hover band.
        const dy = HOVER_HEIGHT - group.position.y;
        group.position.y += Math.max(-VERTICAL_SPEED * capped, Math.min(VERTICAL_SPEED * capped, dy));
      } else if (heli.active) {
        // Heat dropped: climb away, then hide.
        group.position.y += CLIMB_AWAY_SPEED * capped;
        if (group.position.y >= DEPART_HEIGHT) {
          group.visible = false;
          heli.active = false;
        }
      }
      if (group.visible) {
        mainRotor.rotation.y += ROTOR_SPEED * capped;
        tailRotor.rotation.x += TAIL_ROTOR_SPEED * capped;
      }
      // Spotlight cone + ground disc always track the player.
      if (group.visible && pp) {
        const alt = Math.max(1, group.position.y - (pp.y || 0));
        cone.scale.y = alt;
        cone.position.y = -alt / 2;
        cone.visible = true;
        groundDisc.visible = true;
        groundDisc.position.set(pp.x, 0.15, pp.z);
      } else {
        cone.visible = false;
        groundDisc.visible = false;
      }
    } catch (err) {
      // Never let a bad world read kill the frame loop.
    }
  }

  return heli;
}
