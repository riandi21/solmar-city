import * as THREE from 'three';

// POLICE helicopter: active at wanted 4+ (a second heli at 5 stars).
// Follows the player from above with lead (anticipates player direction),
// spotlight cone tracking the player; hides at 0 stars.
// At night, being caught in the spotlight on foot raises wanted faster.
export function createHeli(scene, world) {
  function makePoliceHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.6, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x1c2f6e, roughness: 0.4, metalness: 0.4 })
    );
    g.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x1c2f6e })
    );
    tail.position.set(0, 0.3, -4);
    g.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    rotor.position.y = 1.1;
    g.add(rotor);
    const spot = new THREE.SpotLight(0xfff6c8, 0, 90, 0.32, 0.45, 1.1);
    spot.position.set(0, -0.8, 1.5);
    const target = new THREE.Object3D();
    g.add(target);
    spot.target = target;
    g.add(spot);
    // Visible cone.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(9, 55, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.rotation.x = Math.PI;
    cone.position.y = -28;
    g.add(cone);
    g.visible = false;
    scene.add(g);
    return { group: g, rotor, spot, spotTarget: target, cone, active: false };
  }

  const helis = [makePoliceHeli(), makePoliceHeli()];
  let spotTimer = 0;

  function update(dt) {
    // world.wanted is a plain number 0-5 everywhere (police.js); accept an
    // object with .stars/.level too, but never read .stars off the number.
    const w = world.wanted;
    const stars = typeof w === 'number' ? w : (w ? (w.stars ?? w.level ?? 0) : 0);
    const wantCount = stars >= 5 ? 2 : stars >= 4 ? 1 : 0;
    const p = world.player.position;
    const night = world.timeOfDay !== undefined && (world.timeOfDay < 5.5 || world.timeOfDay >= 19);

    helis.forEach((h, i) => {
      const active = i < wantCount;
      h.active = active;
      h.group.visible = active;
      if (!active) return;
      h.rotor.rotation.y += 28 * dt;
      // Lead: aim at where the player will be, not where they are.
      const lead = new THREE.Vector3(
        Math.sin(world.player.heading ?? 0), 0, Math.cos(world.player.heading ?? 0)
      ).multiplyScalar((world.player.speed ?? 0) * 1.6);
      const dest = new THREE.Vector3(p.x + lead.x, 0, p.z + lead.z);
      // Second heli trails from the opposite side.
      if (i === 1) { dest.x += 26; dest.z -= 26; }
      const hover = new THREE.Vector3(dest.x, 42 + i * 8, dest.z);
      h.group.position.lerp(hover, Math.min(1, dt * 1.1));
      h.group.lookAt(p.x, h.group.position.y, p.z);
      // Spotlight tracks the player.
      h.spotTarget.position.copy(p).sub(h.group.position);
      h.spotTarget.position.y -= 1;
      h.spot.intensity = night ? 260 : 120;
      h.cone.material.opacity = night ? 0.10 : 0.045;
      // Spotlight on foot at night raises wanted faster.
      if (night && world.player.onFoot) {
        spotTimer += dt;
        if (spotTimer > 4) {
          spotTimer = 0;
          const heat = world.systemObjects && world.systemObjects.heat;
          if (heat && typeof heat.addHeat === 'function') heat.addHeat(0.5);
          else if (typeof world.heat === 'number') world.heat += 0.5;
        }
      }
    });
    if (!night || world.player.onFoot === false) spotTimer = 0;
  }

  return { update };
}
