// Combat for Solmar City — fists, pistol, SMG, shotgun, and the rival
// gang shooters who show up for the Marina Job (mission 4) and the
// arc-2 squad fights (missions 5 and 8).
//
// Controls: keys 1 / 2 / 3 / 4 switch fists / pistol / SMG / shotgun,
// F punches, left mouse click shoots while a gun is armed. The SMG fires
// a 3-round burst per click; the shotgun fires 5 pellets with a slow
// cooldown. Ammo is kept per weapon (pistol 24, SMG 90, shotgun 12) and
// refilled at the start of every mission; world.player.ammo always
// mirrors the CURRENT weapon's ammo (0 for fists).
//
// The player has 100 health and slowly regains it after 10 quiet seconds.
// At 0 health the run ends: world.mode becomes 'over' and main.js shows
// the game-over screen.
//
// Enemies are simple hitscan shooters: they stand near the marina, fire
// at the player every couple of seconds, and usually miss. Hitting a
// pedestrian is a crime — it raises the wanted level through the shared
// events queue, which the police system reads.
//
// Shared state touched (see BUILD-NOTES.md):
//   world.player.health / .ammo / .pos / .heading, world.mode, world.time
//   world.input.keys (Set of KeyboardEvent.code strings) and .clicked
//   world.events — {type:'crime',level:1}, {type:'gunshot'}, {type:'player-dead'}
//   world.audio?.shot() / .punch() — optional sound hooks
//   world.mission.id / .stage — mission 4 stage 2 spawns the shooters
import * as THREE from 'three';

export const PISTOL_AMMO = 24;
export const SMG_AMMO = 90;
export const SMG_DAMAGE = 12;
export const SMG_RANGE = 45;
export const SHOTGUN_AMMO = 12;
export const SHOTGUN_DAMAGE = 10; // per pellet
export const SHOTGUN_RANGE = 25;
export const SHOTGUN_PELLETS = 5;
export const SHOTGUN_COOLDOWN = 0.9; // seconds between shotgun blasts
export const PLAYER_MAX_HEALTH = 100;
export const ENEMY_HEALTH = 50;
export const PUNCH_RANGE = 2; // metres
export const PUNCH_DAMAGE = 25;
export const SHOT_DAMAGE = 25;
export const SHOT_RANGE = 60;
export const REGEN_DELAY = 10; // seconds without being hit before regen
export const REGEN_RATE = 5; // health per second

// Full magazine per gun; the shop and the mission-start refill use these.
const WEAPON_AMMO = { pistol: PISTOL_AMMO, smg: SMG_AMMO, shotgun: SHOTGUN_AMMO };
// Per-weapon firing behaviour. The pistol keeps its v1 numbers exactly.
const WEAPON_STATS = {
  pistol: { damage: SHOT_DAMAGE, range: SHOT_RANGE, cone: 0.18, pellets: 1, knockback: 0 },
  smg: { damage: SMG_DAMAGE, range: SMG_RANGE, cone: 0.3, pellets: 1, knockback: 0 },
  shotgun: { damage: SHOTGUN_DAMAGE, range: SHOTGUN_RANGE, cone: 0.38, pellets: SHOTGUN_PELLETS, knockback: 4 },
};
const SMG_BURST_ROUNDS = 3;
const SMG_BURST_GAP = 0.06; // seconds (60 ms) between burst rounds

const PUNCH_COOLDOWN = 0.4;
const ENEMY_SHOT_MIN = 1.2; // seconds between enemy shots
const ENEMY_SHOT_MAX = 2.2;
const ENEMY_HIT_CHANCE = 0.25; // rivals are bad shots on purpose
const ENEMY_HIT_DAMAGE = 8;

function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function makeShooterMesh() {
  // Dark-red jacket, easy to tell apart from street peds at a glance.
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.95, 0.42),
    new THREE.MeshBasicMaterial({ color: 0x8a1a1a }),
  );
  body.position.y = 1.05;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xd9a066 }),
  );
  head.position.y = 1.78;
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.7, 0.35),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a }),
  );
  legs.position.y = 0.35;
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x111111 }),
  );
  gun.position.set(0.3, 1.25, 0.25);
  group.add(body);
  group.add(head);
  group.add(legs);
  group.add(gun);
  return group;
}

export function createCombat(scene, world) {
  const state = {
    weapon: 'fists', // 'fists' | 'pistol' | 'smg' | 'shotgun'
    ammo: 0, // the CURRENT weapon's ammo; fists carry none
    ammoByWeapon: { pistol: PISTOL_AMMO, smg: SMG_AMMO, shotgun: SHOTGUN_AMMO },
    enemies: [], // { mesh, pos, health, shootTimer, squad, spawnMission }
    enemiesSpawned: false,
    lastMissionId: world.mission ? world.mission.id : 0,
    lastHitAt: -Infinity,
    punchCooldown: 0,
    shotgunCooldown: 0,
    burstLeft: 0, // SMG burst rounds still to fire
    burstTimer: 0, // seconds until the next burst round
    tracers: [], // { line, life } — fade out fast
  };
  if (world.player) world.player.ammo = 0;

  // --- tracers ------------------------------------------------------------
  function addTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    scene.add(line);
    state.tracers.push({ line, life: 0.09 });
  }

  function updateTracers(dt) {
    for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
      const t = state.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        state.tracers.splice(i, 1);
      }
    }
  }

  // --- enemies ------------------------------------------------------------
  function spawnEnemies() {
    // Three rivals guarding the yacht, spread along the marina front
    // (on the promenade, on land — never out in the basin water).
    const spots = [
      { x: 250, z: 186 },
      { x: 254, z: 212 },
      { x: 248, z: 208 },
    ];
    for (const spot of spots) {
      const mesh = makeShooterMesh();
      mesh.position.set(spot.x, 0, spot.z);
      scene.add(mesh);
      state.enemies.push({
        mesh,
        pos: mesh.position,
        health: ENEMY_HEALTH,
        shootTimer: 0.8 + Math.random() * 1.2,
        squad: false,
        spawnMission: 4,
      });
    }
    state.enemiesSpawned = true;
    if (world.hud) world.hud.showMessage('Rival gang shooters at the marina — watch out!');
  }

  // Rival-squad API for the arc-2 missions (5 and 8): one shooter at each
  // spot, flagged so the mission can count them. Returns how many spawned.
  // Spots are {x, z} (a THREE.Vector3 works too — only .x/.z are read).
  function spawnRivalSquad(spots) {
    if (!Array.isArray(spots)) return 0;
    let spawned = 0;
    for (const spot of spots) {
      try {
        if (!spot || typeof spot.x !== 'number' || typeof spot.z !== 'number') continue;
        const mesh = makeShooterMesh();
        mesh.position.set(spot.x, 0, spot.z);
        scene.add(mesh);
        state.enemies.push({
          mesh,
          pos: mesh.position,
          health: ENEMY_HEALTH,
          shootTimer: 0.8 + Math.random() * 1.2,
          squad: true,
          spawnMission: world.mission ? world.mission.id : 0,
        });
        spawned += 1;
      } catch {
        // One bad spot never blocks the rest of the squad.
      }
    }
    return spawned;
  }

  // How many squad rivals are still standing.
  function rivalsRemaining() {
    let n = 0;
    for (const enemy of state.enemies) if (enemy.squad === true) n += 1;
    return n;
  }

  function removeEnemy(enemy) {
    scene.remove(enemy.mesh);
    const i = state.enemies.indexOf(enemy);
    if (i >= 0) state.enemies.splice(i, 1);
  }

  function damageEnemy(enemy, amount) {
    enemy.health -= amount;
    if (enemy.health <= 0) removeEnemy(enemy);
  }

  // --- player actions -----------------------------------------------------
  function nearestInRange(list, range) {
    let best = null;
    let bestD = range;
    for (const item of list || []) {
      const d = distXZ(world.player.pos, item.pos);
      if (d < bestD) {
        best = item;
        bestD = d;
      }
    }
    return best;
  }

  // Shove a ped or enemy away from a point (punch, shotgun blast).
  function shoveTarget(target, from, strength) {
    const dx = target.pos.x - from.x;
    const dz = target.pos.z - from.z;
    const len = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
    target.pos.x += (dx / len) * strength;
    target.pos.z += (dz / len) * strength;
    if (target.mesh) {
      target.mesh.position.x = target.pos.x;
      target.mesh.position.z = target.pos.z;
    }
  }

  function punch() {
    if (world.mode !== 'play' || state.punchCooldown > 0) return false;
    state.punchCooldown = PUNCH_COOLDOWN;
    const target = nearestInRange(state.enemies, PUNCH_RANGE)
      || nearestInRange(world.peds, PUNCH_RANGE);
    if (!target) {
      if (world.audio) world.audio.punch();
      return false;
    }
    // Knock the target away from the player and hurt it.
    shoveTarget(target, world.player.pos, 3);
    if (state.enemies.includes(target)) {
      damageEnemy(target, PUNCH_DAMAGE);
    } else {
      target.state = 'flee';
      if (world.events) world.events.push({ type: 'crime', level: 1 });
    }
    if (world.audio) world.audio.punch();
    return true;
  }

  // --- weapons ------------------------------------------------------------
  // Keep state.ammo / world.player.ammo on the current weapon's reserve.
  function syncAmmo() {
    if (state.weapon === 'fists') {
      state.ammo = 0;
    } else {
      state.ammo = state.ammoByWeapon[state.weapon] ?? 0;
    }
    if (world.player) world.player.ammo = state.ammo;
  }

  function switchWeapon(name) {
    if (state.weapon === name) return;
    state.weapon = name;
    // A half-fired burst does not follow the player to the next weapon.
    state.burstLeft = 0;
    state.burstTimer = 0;
    syncAmmo();
  }

  // Refill every gun to a full magazine (mission start).
  function refillAllAmmo() {
    for (const name of Object.keys(state.ammoByWeapon)) {
      state.ammoByWeapon[name] = WEAPON_AMMO[name];
    }
    syncAmmo();
  }

  // Shop buy: refill the CURRENT weapon to full. Fists carry no ammo, so
  // there is nothing to refill — still returns true.
  function buyAmmo() {
    if (state.weapon === 'fists') return true;
    const full = WEAPON_AMMO[state.weapon];
    if (full === undefined) return true;
    state.ammoByWeapon[state.weapon] = full;
    syncAmmo();
    return true;
  }

  function aimPoint(range) {
    // A gun fires along the player's facing direction, level with the
    // chest, out to its own range. Heading 0 faces -Z (north on the map).
    const h = world.player.heading || 0;
    const from = new THREE.Vector3(world.player.pos.x, 1.4, world.player.pos.z);
    const to = new THREE.Vector3(
      from.x - Math.sin(h) * range,
      1.4,
      from.z - Math.cos(h) * range,
    );
    return { from, to, heading: h };
  }

  function targetInCone(list, from, heading, range, cone) {
    // Nearest thing roughly in front of the shooter: within `cone`
    // radians of the aim line and inside `range`.
    let best = null;
    let bestD = range;
    for (const item of list || []) {
      const dx = item.pos.x - from.x;
      const dz = item.pos.z - from.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > range || d < 0.01) continue;
      const angle = Math.atan2(-dx, -dz) - heading;
      const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (Math.abs(wrapped) > cone) continue;
      if (d < bestD) {
        best = item;
        bestD = d;
      }
    }
    return { target: best, dist: bestD };
  }

  // One hitscan pellet along `heading`: nearest enemy or ped in the cone
  // takes the hit (and the knockback, for the shotgun); otherwise the
  // tracer runs out to max range. Returns the tracer end point.
  function firePellet(stats, from, heading) {
    const enemyHit = targetInCone(state.enemies, from, heading, stats.range, stats.cone);
    const pedHit = targetInCone(world.peds, from, heading, stats.range, stats.cone);
    let end = new THREE.Vector3(
      from.x - Math.sin(heading) * stats.range,
      1.4,
      from.z - Math.cos(heading) * stats.range,
    );
    if (enemyHit.target && (!pedHit.target || enemyHit.dist <= pedHit.dist)) {
      if (stats.knockback) shoveTarget(enemyHit.target, from, stats.knockback);
      damageEnemy(enemyHit.target, stats.damage);
      end = new THREE.Vector3(enemyHit.target.pos.x, 1.2, enemyHit.target.pos.z);
    } else if (pedHit.target) {
      if (stats.knockback) shoveTarget(pedHit.target, from, stats.knockback);
      pedHit.target.state = 'flee';
      if (world.events) world.events.push({ type: 'crime', level: 1 });
      end = new THREE.Vector3(pedHit.target.pos.x, 1.2, pedHit.target.pos.z);
    }
    addTracer(from, end, 0xffe08a);
    return end;
  }

  // One round from a single-shot gun (pistol, or one SMG burst round):
  // spend one ammo, trace it, play the shot. The pistol keeps its v1
  // behaviour exactly — dead straight, damage 25, range 60.
  function fireGunRound(weaponName) {
    const stats = WEAPON_STATS[weaponName];
    if (!stats) return false;
    if ((state.ammoByWeapon[weaponName] ?? 0) <= 0) {
      if (world.hud) world.hud.showMessage('Out of ammo — press 1 for fists.');
      return false;
    }
    state.ammoByWeapon[weaponName] -= 1;
    syncAmmo();
    const { from, heading } = aimPoint(stats.range);
    const spread = weaponName === 'pistol' ? 0 : (Math.random() * 2 - 1) * stats.cone;
    firePellet(stats, from, heading + spread);
    if (world.events) world.events.push({ type: 'gunshot' });
    if (world.audio) world.audio.shot();
    return true;
  }

  // SMG: one click starts a 3-round burst, rounds 60 ms apart. The timer
  // lives in update(), not in setTimeout, so it follows the fixed step.
  function startBurst() {
    if (state.burstLeft > 0) return false; // already bursting
    if ((state.ammoByWeapon.smg ?? 0) <= 0) {
      if (world.hud) world.hud.showMessage('Out of ammo — press 1 for fists.');
      return false;
    }
    state.burstLeft = SMG_BURST_ROUNDS;
    state.burstTimer = 0;
    return stepBurst();
  }

  function stepBurst() {
    if (state.burstLeft <= 0) return false;
    if (world.mode !== 'play') {
      state.burstLeft = 0;
      return false;
    }
    const fired = fireGunRound('smg');
    state.burstLeft -= 1;
    if (!fired) state.burstLeft = 0; // ran dry mid-burst: stop here
    state.burstTimer = SMG_BURST_GAP;
    return fired;
  }

  // Shotgun: one slow blast, 5 pellets in a spread cone, one loud shot.
  function fireShotgunBlast() {
    if (state.shotgunCooldown > 0) return false;
    if ((state.ammoByWeapon.shotgun ?? 0) <= 0) {
      if (world.hud) world.hud.showMessage('Out of ammo — press 1 for fists.');
      return false;
    }
    state.ammoByWeapon.shotgun -= 1;
    syncAmmo();
    state.shotgunCooldown = SHOTGUN_COOLDOWN;
    const stats = WEAPON_STATS.shotgun;
    const { from, heading } = aimPoint(stats.range);
    for (let i = 0; i < stats.pellets; i += 1) {
      const spread = (Math.random() * 2 - 1) * stats.cone;
      firePellet(stats, from, heading + spread);
    }
    if (world.events) world.events.push({ type: 'gunshot' });
    if (world.audio) world.audio.shot();
    return true;
  }

  function shoot() {
    if (world.mode !== 'play') return false;
    if (state.weapon === 'pistol') return fireGunRound('pistol');
    if (state.weapon === 'smg') return startBurst();
    if (state.weapon === 'shotgun') return fireShotgunBlast();
    return false; // fists: F punches, clicks do nothing
  }

  function hurtPlayer(amount) {
    if (world.mode !== 'play') return;
    world.player.health -= amount;
    state.lastHitAt = world.time || 0;
    if (world.player.health <= 0) {
      world.player.health = 0;
      world.mode = 'over';
      if (world.events) world.events.push({ type: 'player-dead' });
    }
  }

  function updateEnemies(dt) {
    for (const enemy of [...state.enemies]) {
      // Face the player and fire on a loose timer; most shots miss.
      const dx = world.player.pos.x - enemy.pos.x;
      const dz = world.player.pos.z - enemy.pos.z;
      enemy.mesh.rotation.y = Math.atan2(dx, dz);
      enemy.shootTimer -= dt;
      if (enemy.shootTimer > 0) continue;
      enemy.shootTimer = ENEMY_SHOT_MIN + Math.random() * (ENEMY_SHOT_MAX - ENEMY_SHOT_MIN);
      const from = new THREE.Vector3(enemy.pos.x, 1.3, enemy.pos.z);
      const to = new THREE.Vector3(world.player.pos.x, 1.2, world.player.pos.z);
      addTracer(from, to, 0xff5544);
      if (Math.random() < ENEMY_HIT_CHANCE) hurtPlayer(ENEMY_HIT_DAMAGE);
    }
  }

  function update(dt) {
    updateTracers(dt);
    if (state.punchCooldown > 0) state.punchCooldown -= dt;
    if (state.shotgunCooldown > 0) state.shotgunCooldown -= dt;
    if (world.mode !== 'play') return;

    // A new mission refills every gun (missions.js also sets
    // world.player.ammo; combat is the source of truth for its own state).
    const missionId = world.mission ? world.mission.id : undefined;
    if (missionId !== undefined && missionId !== state.lastMissionId) {
      if (missionId) refillAllAmmo();
      state.lastMissionId = missionId;
    }

    // Mission 4 spawns its shooters the moment the crew is aboard.
    if (missionId === 4 && world.mission.stage >= 2 && !state.enemiesSpawned) {
      spawnEnemies();
    }
    // Cleanup is per-enemy, by the mission that spawned it: the marina
    // squad leaves when mission 4 ends, and a rival squad spawned for
    // mission 5 or 8 stays until THAT mission ends. The old
    // `mission.id !== 4` check cleared every enemy on any mission change,
    // which would have wiped the 5/8 squads the moment they spawned.
    if (world.mission && state.enemies.length > 0) {
      const mid = world.mission.id;
      let marinaLeft = false;
      for (const enemy of [...state.enemies]) {
        if (enemy.spawnMission !== mid) {
          if (enemy.spawnMission === 4) marinaLeft = true;
          removeEnemy(enemy);
        }
      }
      if (marinaLeft && !state.enemies.some((e) => e.spawnMission === 4)) {
        state.enemiesSpawned = false;
      }
    }

    const keys = world.input ? world.input.keys : null;
    // Guns are on-foot weapons: no punching or shooting from a car.
    const onFoot = !world.player || world.player.onFoot !== false;
    if (!onFoot) state.burstLeft = 0; // getting in a car cancels a burst
    // Step an in-flight SMG burst BEFORE new input, so a click that starts
    // one never fires two rounds in the same frame.
    if (state.burstLeft > 0 && onFoot) {
      state.burstTimer -= dt;
      if (state.burstTimer <= 0) stepBurst();
    }
    if (keys) {
      if (keys.has('Digit1') || keys.has('Numpad1')) switchWeapon('fists');
      if (keys.has('Digit2') || keys.has('Numpad2')) switchWeapon('pistol');
      if (keys.has('Digit3') || keys.has('Numpad3')) switchWeapon('smg');
      if (keys.has('Digit4') || keys.has('Numpad4')) switchWeapon('shotgun');
      // Edge-triggered punch: only fire once per key press, not per frame.
      const fDown = keys.has('KeyF') || keys.has('Keyf');
      if (fDown && !state._fWasDown && onFoot) punch();
      state._fWasDown = fDown;
    }
    if (world.input && world.input.clicked) {
      world.input.clicked = false;
      if (onFoot) shoot();
    }

    updateEnemies(dt);

    // Slow health regen after 10 seconds without taking a hit.
    if (
      world.player.health < PLAYER_MAX_HEALTH
      && (world.time || 0) - state.lastHitAt > REGEN_DELAY
    ) {
      world.player.health = Math.min(
        PLAYER_MAX_HEALTH,
        world.player.health + REGEN_RATE * dt,
      );
    }
  }

  return { update, punch, shoot, state, hurtPlayer, spawnRivalSquad, rivalsRemaining, buyAmmo };
}
