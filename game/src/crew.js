import * as THREE from 'three';

// Recruitable allies: hire at the Anchor Bar ($1000 each, up to 3). Each
// has a name, a health bar and a pistol. Crew follow Rico on foot and in
// missions, take cover near him, shoot enemies the player engages, can be
// downed (kneel, stop fighting; revive at the safehouse $200, or recover
// after a mission). A member can be POSTED to a district from the empire
// menu at the Anchor Bar: a posted member guards it (control decays slower,
// rival attacks weaker) and can be recalled to follow.
const ANCHOR_BAR = { x: -60, z: 140 };
const SAFEHOUSE = { x: 20, z: -40 };
const HIRE_COST = 1000;
const REVIVE_COST = 200;
const MAX_CREW = 3;
const NAMES = ['Marco', 'Tania', 'Vic', 'Lena', 'Dante', 'Mira'];
const COLORS = [0xef5350, 0x42a5f5, 0xffca28, 0x66bb6a, 0xab47bc, 0x26a69a];

function makeCrewMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.65, 4, 8), shirt);
  body.position.y = 1.0;
  body.name = 'body';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.8;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.4, 1.1, 0.3);
  gun.name = 'gun';
  // Health bar: green quad floating above the head, scaled by health.
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  barBg.position.y = 2.3;
  barBg.name = 'barBg';
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.08), new THREE.MeshBasicMaterial({ color: 0x4caf50 }));
  bar.position.set(0, 2.3, 0.01);
  bar.name = 'bar';
  group.add(body, head, gun, barBg, bar);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function createCrew(scene, world) {
  if (!Array.isArray(world.crew)) world.crew = [];
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;

  function hire(name) {
    if (world.crew.length >= MAX_CREW) return null;
    // Hiring happens at the Anchor Bar: the recruit must be hired near it.
    const nearBar = Math.hypot(world.player.position.x - ANCHOR_BAR.x, world.player.position.z - ANCHOR_BAR.z) < 25;
    if (!nearBar) return null;
    if (world.player.cash == null || world.player.cash < HIRE_COST) return null;
    const picked = name || NAMES.find((n) => !world.crew.some((c) => c.name === n));
    if (!picked) return null;
    world.player.cash -= HIRE_COST;
    if (typeof world.cash === 'number') world.cash = world.player.cash; // keep the two cash stores in sync
    const color = COLORS[world.crew.length % COLORS.length];
    const mesh = makeCrewMesh(color);
    const p = world.player.position;
    mesh.position.set(p.x + 2 + rng() * 2, 0, p.z + 2 + rng() * 2);
    scene.add(mesh);
    const member = {
      mesh, name: picked, color,
      position: mesh.position, health: 100, maxHealth: 100,
      state: 'follow', weapon: 'pistol', district: null,
      shootCooldown: 0,
    };
    world.crew.push(member);
    return member;
  }

  function postToDistrict(member, district) {
    if (!member || !district) return false;
    member.state = 'posted';
    member.district = district;
    // Posted member guards the district: record the guard on the empire
    // state so control decay / rival attacks can read it.
    if (!world.empire) world.empire = {};
    if (!world.empire.guards) world.empire.guards = {};
    world.empire.guards[district] = (world.empire.guards[district] || 0) + 1;
    return true;
  }

  function recall(member) {
    if (!member) return false;
    if (member.state === 'posted' && member.district && world.empire && world.empire.guards) {
      world.empire.guards[member.district] = Math.max(0, (world.empire.guards[member.district] || 1) - 1);
    }
    member.state = 'follow';
    member.district = null;
    return true;
  }

  function revive(member) {
    if (!member || member.state !== 'down') return false;
    const atSafehouse = Math.hypot(world.player.position.x - SAFEHOUSE.x, world.player.position.z - SAFEHOUSE.z) < 20;
    const afterMission = world.missionJustEnded === true;
    if (!atSafehouse && !afterMission) return false;
    if (!afterMission) {
      if (world.player.cash == null || world.player.cash < REVIVE_COST) return false;
      world.player.cash -= REVIVE_COST;
      if (typeof world.cash === 'number') world.cash = world.player.cash; // keep the two cash stores in sync
    }
    member.health = 50;
    member.state = 'follow';
    if (member.mesh) member.mesh.visible = true;
    return true;
  }

  function damage(member, amount) {
    if (!member || member.state === 'down') return;
    member.health -= amount;
    if (member.health <= 0) {
      member.health = 0;
      member.state = 'down';
      // Kneel: sink and tilt the mesh, stop fighting.
      if (member.mesh) {
        member.mesh.position.y = -0.4;
        member.mesh.rotation.x = 0.5;
      }
    }
  }

  function update(dt) {
    const p = world.player;
    const enemies = world.enemies || [];
    for (let i = 0; i < world.crew.length; i += 1) {
      const m = world.crew[i];
      if (!m || !m.mesh) continue;
      // Health bar follows health and always faces the camera.
      const bar = m.mesh.getObjectByName('bar');
      if (bar) {
        const frac = Math.max(0, m.health / (m.maxHealth || 100));
        bar.scale.x = frac;
        bar.position.x = -(1 - frac) * 0.48;
        bar.material.color.setHex(frac > 0.5 ? 0x4caf50 : frac > 0.25 ? 0xffc107 : 0xe53935);
      }
      if (world.camera) {
        m.mesh.lookAt(world.camera.position.x, m.mesh.position.y, world.camera.position.z);
      }
      if (m.state === 'down') continue;
      if (m.state === 'posted') {
        // Guarding: hold position near the district anchor, idle sway.
        m.mesh.position.y = 0;
        m.mesh.rotation.x = 0;
        continue;
      }
      // Follow Rico: slot behind him in formation, catch up if far.
      const slotAngle = p.heading + Math.PI + (i - 1) * 0.6;
      const tx = p.position.x + Math.sin(slotAngle) * 3;
      const tz = p.position.z + Math.cos(slotAngle) * 3;
      const dx = tx - m.position.x;
      const dz = tz - m.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.4) {
        const speed = d > 18 ? 9 : 5.5;
        m.position.x += (dx / d) * speed * dt;
        m.position.z += (dz / d) * speed * dt;
        m.state = d > 25 ? 'follow' : m.state;
      }
      // Take cover near Rico when he is in combat: crouch behind the
      // nearest low cover is approximated by kneeling in place briefly.
      const inCombat = (world.wanted || 0) > 0 || enemies.length > 0;
      if (inCombat && d < 6) m.mesh.position.y = -0.15;
      else m.mesh.position.y = 0;
      // Shoot enemies the player engages: nearest enemy within 30m.
      m.shootCooldown -= dt;
      let target = null;
      let bestD = 30;
      for (const e of enemies) {
        if (!e || !e.position || (e.health != null && e.health <= 0)) continue;
        const ed = Math.hypot(e.position.x - m.position.x, e.position.z - m.position.z);
        if (ed < bestD) { bestD = ed; target = e; }
      }
      if (target && m.shootCooldown <= 0) {
        m.shootCooldown = 0.8;
        m.state = 'fight';
        if (target.health != null) target.health -= 12;
        world.lastGunshotAt = world.elapsed;
      } else if (!target && m.state === 'fight') {
        m.state = 'follow';
      }
      m.mesh.position.copy(m.position);
    }
    // Mission-end recovery: downed members get back up after a mission.
    if (world.missionJustEnded === true) {
      for (const m of world.crew) {
        if (m.state === 'down') {
          m.health = 50;
          m.state = 'follow';
          if (m.mesh) { m.mesh.visible = true; m.mesh.position.y = 0; m.mesh.rotation.x = 0; }
        }
      }
      world.missionJustEnded = false;
    }
    void damage;
  }

  return { update, hire, postToDistrict, recall, revive, damage, anchorBar: ANCHOR_BAR, safehouse: SAFEHOUSE };
}
