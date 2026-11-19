// Crew: recruitable allies. Rico hires crew at the Anchor Bar ($1,000
// each, up to 3). They follow him on foot and in missions, take cover
// near him, shoot at enemies he engages, and can be downed (they kneel
// and stop fighting; revive one at the safehouse for $200, or they
// recover after a mission ends). A crew member can be POSTED to a
// district from the empire menu: a posted member guards that district.
// Health, gear and posts persist via the save system (world.crew is the
// state list; this system never replaces it with a system object).
import * as THREE from 'three';

export const ANCHOR_BAR = { x: 100, z: 60 };
export const SAFEHOUSE = { x: -174, z: 232 };
export const HIRE_COST = 1000;
export const REVIVE_COST = 200;
export const MAX_CREW = 3;

export const DISTRICT_CENTERS = {
  Downtown: { x: 0, z: 0 },
  'Old Town': { x: -203, z: -58 },
  Marina: { x: 320, z: 160 },
  Boardwalk: { x: 0, z: 264 },
  'Freight Yard': { x: -170, z: -260 },
  Airfield: { x: 200, z: -230 },
};

const CREW_NAMES = ['Marco', 'Dante', 'Lena', 'Vico', 'Sofia', 'Rocco'];
const CREW_COLORS = [0x4a7ad8, 0xd84a4a, 0xd8a24a, 0x4ad87a, 0x9a4ad8, 0xdddddd];

function buildCrewMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f3a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.58, 4, 10), shirt);
  body.position.y = 1.02;
  body.name = 'body';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.74;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.19), pants);
  legL.position.set(-0.15, 0.34, 0);
  legL.name = 'legL';
  const legR = legL.clone();
  legR.position.x = 0.15;
  legR.name = 'legR';
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.34), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 1.15, 0.2);
  gun.name = 'gun';
  group.add(body, head, legL, legR, gun);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

function enemyLists(world) {
  const lists = [];
  if (Array.isArray(world.enemies)) lists.push(world.enemies);
  if (Array.isArray(world.gangShooters)) lists.push(world.gangShooters);
  if (Array.isArray(world.cartelHitmen)) lists.push(world.cartelHitmen);
  if (Array.isArray(world.federalAgents)) lists.push(world.federalAgents);
  return lists;
}

export function createCrew(scene, world) {
  const rng = typeof world.rng === 'function' ? world.rng : Math.random;
  if (!Array.isArray(world.crew)) world.crew = [];
  let nameIdx = 0;

  function hireCrew() {
    const p = world.player;
    if (!p) return { ok: false, reason: 'no player' };
    const nearBar = Math.hypot(p.position.x - ANCHOR_BAR.x, p.position.z - ANCHOR_BAR.z) < 8;
    if (!nearBar) return { ok: false, reason: 'go to the Anchor Bar to hire' };
    if (world.crew.length >= MAX_CREW) return { ok: false, reason: 'crew is full' };
    if ((world.cash || 0) < HIRE_COST) return { ok: false, reason: 'not enough cash' };
    world.cash -= HIRE_COST;
    const name = CREW_NAMES[nameIdx % CREW_NAMES.length];
    const color = CREW_COLORS[nameIdx % CREW_COLORS.length];
    nameIdx += 1;
    const mesh = buildCrewMesh(color);
    mesh.position.set(p.position.x + 2, 0, p.position.z + 2);
    if (scene) scene.add(mesh);
    const member = {
      name,
      mesh,
      position: mesh.position,
      heading: 0,
      health: 100,
      maxHealth: 100,
      state: 'follow', // follow | fight | down | posted
      weapon: 'pistol',
      posted: null,
      followOffset: { x: 2 + rng() * 2, z: 2 + rng() * 2 },
      shootCooldown: 0,
    };
    world.crew.push(member);
    if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: `${name} joined the crew!` });
    return { ok: true, member };
  }

  function reviveCrew(member) {
    const p = world.player;
    if (!member || member.state !== 'down') return { ok: false, reason: 'not down' };
    if (!p) return { ok: false, reason: 'no player' };
    const nearHouse = Math.hypot(p.position.x - SAFEHOUSE.x, p.position.z - SAFEHOUSE.z) < 8;
    if (!nearHouse) return { ok: false, reason: 'go to the safehouse to revive' };
    if ((world.cash || 0) < REVIVE_COST) return { ok: false, reason: 'not enough cash' };
    world.cash -= REVIVE_COST;
    member.health = 100;
    member.state = 'follow';
    member.position.set(p.position.x + 2, 0, p.position.z + 2);
    if (member.mesh) { member.mesh.rotation.x = 0; member.mesh.position.copy(member.position); member.mesh.visible = true; }
    return { ok: true, member };
  }

  function postCrew(member, district) {
    if (!member) return { ok: false, reason: 'no member' };
    if (!DISTRICT_CENTERS[district]) return { ok: false, reason: 'unknown district' };
    member.posted = district;
    member.state = 'posted';
    const c = DISTRICT_CENTERS[district];
    member.position.set(c.x + 4, 0, c.z + 4);
    if (member.mesh) member.mesh.position.copy(member.position);
    if (Array.isArray(world.events)) world.events.push({ type: 'toast', text: `${member.name} posted to ${district}` });
    return { ok: true, member };
  }

  function recallCrew(member) {
    if (!member) return { ok: false, reason: 'no member' };
    member.posted = null;
    member.state = 'follow';
    const p = world.player;
    if (p) member.position.set(p.position.x + 2, 0, p.position.z + 2);
    if (member.mesh) member.mesh.position.copy(member.position);
    return { ok: true, member };
  }

  function nearestEnemy(x, z, range) {
    let best = null;
    let bestD = range;
    for (const list of enemyLists(world)) {
      for (const e of list) {
        if (!e || !e.position || (e.health !== undefined && e.health <= 0)) continue;
        const d = Math.hypot(e.position.x - x, e.position.z - z);
        if (d < bestD) { bestD = d; best = e; }
      }
    }
    return best;
  }

  function update(dt) {
    if (!world || world.mode !== 'play') return;
    const p = world.player;
    if (!p) return;

    // A finished mission lets downed crew get back on their feet.
    if (Array.isArray(world.events)) {
      for (const ev of world.events) {
        if (ev && ev.type === 'missionComplete') {
          for (const m of world.crew) {
            if (m.state === 'down') { m.health = 50; m.state = 'follow'; if (m.mesh) m.mesh.rotation.x = 0; }
          }
        }
      }
    }

    for (const m of world.crew) {
      if (!m.position) continue;
      if (m.shootCooldown > 0) m.shootCooldown -= dt;
      if (m.state === 'down') {
        if (m.mesh) { m.mesh.rotation.x = -Math.PI / 2; m.mesh.position.copy(m.position); }
        continue;
      }
      if (m.state === 'posted') {
        // Guard the district: stand watch, shoot attackers in range.
        const enemy = nearestEnemy(m.position.x, m.position.z, 26);
        if (enemy && m.shootCooldown <= 0) {
          m.shootCooldown = 0.6;
          enemy.health = (enemy.health === undefined ? 50 : enemy.health) - 10;
          if (Array.isArray(world.events)) world.events.push({ type: 'gunshot', x: m.position.x, z: m.position.z });
        }
        if (m.mesh) { m.mesh.position.copy(m.position); }
        continue;
      }
      // Follow Rico: close the gap when far, hold a loose offset near him.
      const tx = p.position.x + m.followOffset.x;
      const tz = p.position.z + m.followOffset.z;
      const dx = tx - m.position.x;
      const dz = tz - m.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 60) {
        // Teleport back: the player drove off without them.
        m.position.set(tx, 0, tz);
      } else if (d > 2.2) {
        const speed = d > 12 ? 9 : 5.2;
        m.position.x += (dx / d) * speed * dt;
        m.position.z += (dz / d) * speed * dt;
        m.heading = Math.atan2(dx / d, dz / d);
      }
      // Take cover + fight: if an enemy is near Rico, shoot at it.
      const enemy = nearestEnemy(p.position.x, p.position.z, 30);
      if (enemy) {
        m.state = 'fight';
        const edx = enemy.position.x - m.position.x;
        const edz = enemy.position.z - m.position.z;
        const ed = Math.hypot(edx, edz) || 1;
        m.heading = Math.atan2(edx / ed, edz / ed);
        // Step sideways to cover instead of standing in the open.
        m.position.x -= (edz / ed) * 0.6 * dt;
        m.position.z += (edx / ed) * 0.6 * dt;
        if (m.shootCooldown <= 0) {
          m.shootCooldown = 0.55;
          enemy.health = (enemy.health === undefined ? 50 : enemy.health) - 10;
          if (Array.isArray(world.events)) world.events.push({ type: 'gunshot', x: m.position.x, z: m.position.z });
        }
      } else if (m.state === 'fight') {
        m.state = 'follow';
      }
      if (m.mesh) {
        m.mesh.position.copy(m.position);
        m.mesh.rotation.y = m.heading;
        m.mesh.rotation.x = 0;
      }
    }
  }

  const sys = {
    name: 'crew',
    update,
    hireCrew,
    reviveCrew,
    postCrew,
    recallCrew,
    nearestEnemy,
  };
  if (Array.isArray(world.systems)) world.systems.push(sys);
  return sys;
}

export default createCrew;
