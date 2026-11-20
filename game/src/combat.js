import * as THREE from 'three';

// Combat: melee, weapons, ammo, rival shooters, crew fire, feds, hitmen.
// Fresh implementation for Round 16.
// CRITICAL: spawnShooter pushes to world.enemies AND world.gangShooters so
// fight/defend mission stages advance when enemies are defeated.
export function createCombat(scene, world) {
  const WEAPONS = {
    pistol: { name: 'pistol', damage: 25, range: 60, rate: 0.28, burst: 1, pellets: 1, spread: 0.02, zoom: 1, auto: false },
    smg: { name: 'smg', damage: 12, range: 45, rate: 0.09, burst: 3, pellets: 1, spread: 0.06, zoom: 1, auto: true },
    shotgun: { name: 'shotgun', damage: 14, range: 25, rate: 0.8, burst: 1, pellets: 5, spread: 0.12, zoom: 1, auto: false },
    rifle: { name: 'rifle', damage: 34, range: 90, rate: 0.16, burst: 1, pellets: 1, spread: 0.015, zoom: 1, auto: true },
    sniper: { name: 'sniper', damage: 90, range: 220, rate: 1.1, burst: 1, pellets: 1, spread: 0.001, zoom: 3, auto: false },
  };
  const AMMO_MAX = { pistol: 120, smg: 180, shotgun: 40, rifle: 150, sniper: 20 };

  let current = 'pistol';
  let ammo = { pistol: 60, smg: 90, shotgun: 16, rifle: 60, sniper: 8 };
  let cooldown = 0;
  let burstLeft = 0;
  let burstTimer = 0;
  let scoped = false;
  let punchCooldown = 0;
  let crewFireTimer = 0;
  const shooters = []; // internal list only; world lists are authoritative for stages

  function refillAmmo() {
    for (const k of Object.keys(AMMO_MAX)) ammo[k] = AMMO_MAX[k];
  }

  // Shops / mission start top ammo up; field pickups never refill for free.
  function addAmmo(name, n) {
    if (!AMMO_MAX[name] || typeof n !== 'number') return ammo[name] || 0;
    ammo[name] = Math.min(AMMO_MAX[name], (ammo[name] || 0) + n);
    return ammo[name];
  }

  function switchWeapon(name) {
    if (!WEAPONS[name]) return false;
    current = name;
    burstLeft = 0;
    if (world.events) world.events.push({ type: 'weapon-switch', weapon: name });
    return true;
  }

  function aimTarget(origin, dir, range, damage, shooter) {
    // Hitscan against enemies / feds / hitmen / gang shooters.
    const pools = [world.enemies, world.gangShooters, world.feds, world.cartelHitmen];
    let best = null;
    let bestT = range;
    for (const pool of pools) {
      if (!pool) continue;
      for (const e of pool) {
        if (!e || !e.position || e.health <= 0 || e === shooter) continue;
        const to = new THREE.Vector3(e.position.x - origin.x, (e.position.y || 1) - origin.y, e.position.z - origin.z);
        const t = to.dot(dir);
        if (t < 0 || t > bestT) continue;
        const perp = to.clone().addScaledVector(dir, -t).length();
        if (perp < 1.6) { best = e; bestT = t; }
      }
    }
    if (best) {
      best.health -= damage;
      if (best.health <= 0) {
        best.state = 'dead';
        if (world.events) world.events.push({ type: 'enemy-down', kind: best.kind || 'enemy' });
      }
      return best;
    }
    return null;
  }

  function fireOnce() {
    const w = WEAPONS[current];
    if (ammo[current] <= 0) {
      if (world.events) world.events.push({ type: 'dry-fire', weapon: current });
      return false;
    }
    ammo[current] -= 1;
    const p = world.player.position;
    const origin = new THREE.Vector3(p.x, 1.5, p.z);
    const yaw = world.player.heading || 0;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    for (let i = 0; i < w.pellets; i++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * w.spread * 2;
      d.z += (Math.random() - 0.5) * w.spread * 2;
      d.normalize();
      aimTarget(origin, d, w.range, w.damage, world.player);
    }
    if (world.events) world.events.push({ type: 'shot', weapon: current });
    return true;
  }

  function shoot() {
    if (cooldown > 0) return false;
    const w = WEAPONS[current];
    if (ammo[current] <= 0) return fireOnce();
    burstLeft = w.burst;
    burstTimer = 0;
    cooldown = w.rate;
    return fireOnce();
  }

  function punch() {
    if (punchCooldown > 0) return false;
    if (world.player.inVehicle) return false; // on foot only
    punchCooldown = 0.5;
    const p = world.player.position;
    const yaw = world.player.heading || 0;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    let hit = false;
    for (const pool of [world.enemies, world.gangShooters]) {
      if (!pool) continue;
      for (const e of pool) {
        if (!e || !e.position || e.health <= 0) continue;
        const dx = e.position.x - p.x;
        const dz = e.position.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.4) {
          e.health -= 20;
          // Knockback away from the player.
          const k = d > 0.01 ? 1 / d : 1;
          e.position.x += dx * k * 2.5;
          e.position.z += dz * k * 2.5;
          if (e.health <= 0) e.state = 'dead';
          hit = true;
        }
      }
    }
    if (world.events) world.events.push({ type: 'punch', hit });
    return hit;
  }

  function spawnShooter(x, z, kind = 'gang') {
    const health = kind === 'fed' ? 150 : kind === 'hitman' ? 140 : 80;
    const accuracy = kind === 'fed' ? 0.55 : kind === 'hitman' ? 0.5 : 0.28;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.8, 0.7),
      new THREE.MeshStandardMaterial({ color: kind === 'fed' ? 0x0f172a : kind === 'hitman' ? 0x7f1d1d : 0x3f6212 })
    );
    mesh.position.set(x, 0.9, z);
    if (scene && scene.add) scene.add(mesh);
    const s = {
      mesh, position: mesh.position, health, kind,
      accuracy, state: 'chase', fireTimer: 1 + Math.random(),
      cover: null, flankSide: Math.random() < 0.5 ? -1 : 1,
    };
    shooters.push(s);
    // Authoritative lists: fight/defend stages read these.
    if (!world.enemies) world.enemies = [];
    if (!world.gangShooters) world.gangShooters = [];
    world.enemies.push(s);
    world.gangShooters.push(s);
    if (kind === 'fed') {
      if (!world.feds) world.feds = [];
      world.feds.push(s);
    }
    if (kind === 'hitman') {
      if (!world.cartelHitmen) world.cartelHitmen = [];
      world.cartelHitmen.push(s);
    }
    return s;
  }

  function shooterFire(s, dt) {
    s.fireTimer -= dt;
    if (s.fireTimer > 0) return;
    s.fireTimer = s.kind === 'gang' ? 1.4 + Math.random() : 0.9 + Math.random() * 0.6;
    const p = world.player.position;
    const d = Math.hypot(s.position.x - p.x, s.position.z - p.z);
    if (d > 55) return;
    // Inaccurate hitscan for gang shooters; feds/hitmen are better.
    if (Math.random() < s.accuracy * Math.max(0.3, 1 - d / 90)) {
      const dmg = s.kind === 'gang' ? 6 : s.kind === 'fed' ? 12 : 11;
      world.player.health = Math.max(0, (world.player.health || 100) - dmg);
      if (world.events) world.events.push({ type: 'player-hit', by: s.kind, dmg });
    }
  }

  function shooterMove(s, dt) {
    const p = world.player.position;
    const dx = p.x - s.position.x;
    const dz = p.z - s.position.z;
    const d = Math.hypot(dx, dz) || 1;
    if (s.kind === 'gang') {
      // Gang shooters take cover / flank: strafe sideways while closing.
      if (d > 18) {
        s.position.x += (dx / d) * 4 * dt + s.flankSide * 2 * dt;
        s.position.z += (dz / d) * 4 * dt;
      } else {
        s.position.x += s.flankSide * 3 * dt;
        s.position.z += Math.sin(world.elapsed * 2 + s.flankSide) * 1.5 * dt;
      }
    } else {
      // Feds and hitmen coordinate in pairs: one advances, one holds fire.
      const pair = shooters.find(o => o !== s && o.kind === s.kind && o.health > 0);
      const advance = !pair || (Math.floor(world.elapsed / 3) % 2 === 0) === (shooters.indexOf(s) % 2 === 0);
      if (d > 14 && advance) {
        s.position.x += (dx / d) * 5 * dt;
        s.position.z += (dz / d) * 5 * dt;
      }
    }
    if (s.mesh) s.mesh.lookAt(p.x, s.position.y, p.z);
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    punchCooldown = Math.max(0, punchCooldown - dt);
    if (burstLeft > 0) {
      burstTimer -= dt;
      if (burstTimer <= 0) {
        burstTimer = 0.07;
        burstLeft -= 1;
        fireOnce();
      }
    }
    // Scope zoom on right-click (sniper).
    if (world.input) {
      const wantScope = !!world.input.rightMouse && current === 'sniper';
      if (wantScope !== scoped) {
        scoped = wantScope;
        if (world.events) world.events.push({ type: 'scope', on: scoped });
      }
      if (world.input.keys && world.input.keys['KeyF']) punch();
    }
    // Crew members shoot alongside the player with pistols.
    crewFireTimer -= dt;
    if (crewFireTimer <= 0) {
      crewFireTimer = 0.5;
      for (const m of world.crew || []) {
        if (!m || !m.position || m.health <= 0) continue;
        let target = null;
        let bestD = 40;
        for (const e of world.enemies || []) {
          if (!e || !e.position || e.health <= 0) continue;
          const d = Math.hypot(e.position.x - m.position.x, e.position.z - m.position.z);
          if (d < bestD) { bestD = d; target = e; }
        }
        if (target && Math.random() < 0.5) {
          target.health -= 12;
          if (target.health <= 0) target.state = 'dead';
        }
      }
    }
    // Move + fire live shooters; prune the dead from world lists.
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      if (!s || s.health <= 0) {
        if (s && s.mesh && scene && scene.remove) scene.remove(s.mesh);
        shooters.splice(i, 1);
        continue;
      }
      shooterMove(s, dt);
      shooterFire(s, dt);
    }
    // NOTE: a fight-kind stage must advance only when the enemy list for
    // that stage is genuinely empty — never auto-advance on an empty list
    // that was never populated. This system never emits stage-complete
    // events itself; mission code owns that check.
  }

  return {
    update, spawnShooter, shoot, switchWeapon, punch,
    refillAmmo, addAmmo,
    get weapon() { return current; },
    get ammo() { return ammo; },
    get scoped() { return scoped; },
    weapons: WEAPONS,
  };
}
