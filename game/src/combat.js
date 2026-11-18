// Combat for Solmar City — fists, a pistol, and the rival gang shooters
// who show up for the Marina Job (mission 4).
//
// Controls: keys 1 / 2 switch between fists and pistol, F punches, left
// mouse click shoots while the pistol is armed. Ammo is 24 and is refilled
// at the start of every mission (missions.js sets world.player.ammo).
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
export const PLAYER_MAX_HEALTH = 100;
export const ENEMY_HEALTH = 50;
export const PUNCH_RANGE = 2; // metres
export const PUNCH_DAMAGE = 25;
export const SHOT_DAMAGE = 25;
export const SHOT_RANGE = 60;
export const REGEN_DELAY = 10; // seconds without being hit before regen
export const REGEN_RATE = 5; // health per second

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
    weapon: 'fists', // 'fists' | 'pistol'
    ammo: PISTOL_AMMO,
    enemies: [], // { mesh, pos, health, shootTimer }
    enemiesSpawned: false,
    lastHitAt: -Infinity,
    punchCooldown: 0,
    tracers: [], // { line, life } — fade out fast
  };
  if (world.player) world.player.ammo = PISTOL_AMMO;

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
      });
    }
    state.enemiesSpawned = true;
    if (world.hud) world.hud.showMessage('Rival gang shooters at the marina — watch out!');
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
    for (const item of list) {
      const d = distXZ(world.player.pos, item.pos);
      if (d < bestD) {
        best = item;
        bestD = d;
      }
    }
    return best;
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
    const dx = target.pos.x - world.player.pos.x;
    const dz = target.pos.z - world.player.pos.z;
    const len = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
    target.pos.x += (dx / len) * 3;
    target.pos.z += (dz / len) * 3;
    if (target.mesh) {
      target.mesh.position.x = target.pos.x;
      target.mesh.position.z = target.pos.z;
    }
    if (state.enemies.includes(target)) {
      damageEnemy(target, PUNCH_DAMAGE);
    } else {
      target.state = 'flee';
      if (world.events) world.events.push({ type: 'crime', level: 1 });
    }
    if (world.audio) world.audio.punch();
    return true;
  }

  function aimPoint() {
    // The pistol fires along the player's facing direction, level with the
    // chest, out to SHOT_RANGE. Heading 0 faces -Z (north on the map).
    const h = world.player.heading || 0;
    const from = new THREE.Vector3(world.player.pos.x, 1.4, world.player.pos.z);
    const to = new THREE.Vector3(
      from.x - Math.sin(h) * SHOT_RANGE,
      1.4,
      from.z - Math.cos(h) * SHOT_RANGE,
    );
    return { from, to, heading: h };
  }

  function targetInCone(list, from, heading) {
    // Nearest thing roughly in front of the shooter: within ~10 degrees of
    // the aim line and inside SHOT_RANGE.
    let best = null;
    let bestD = SHOT_RANGE;
    for (const item of list) {
      const dx = item.pos.x - from.x;
      const dz = item.pos.z - from.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > SHOT_RANGE || d < 0.01) continue;
      const angle = Math.atan2(-dx, -dz) - heading;
      const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (Math.abs(wrapped) > 0.18) continue;
      if (d < bestD) {
        best = item;
        bestD = d;
      }
    }
    return { target: best, dist: bestD };
  }

  function shoot() {
    if (world.mode !== 'play' || state.weapon !== 'pistol') return false;
    if (state.ammo <= 0) {
      if (world.hud) world.hud.showMessage('Out of ammo — press 1 for fists.');
      return false;
    }
    state.ammo -= 1;
    if (world.player) world.player.ammo = state.ammo;
    const { from, to, heading } = aimPoint();
    const enemyHit = targetInCone(state.enemies, from, heading);
    const pedHit = targetInCone(world.peds, from, heading);
    let end = to;
    if (enemyHit.target && (!pedHit.target || enemyHit.dist <= pedHit.dist)) {
      damageEnemy(enemyHit.target, SHOT_DAMAGE);
      end = new THREE.Vector3(enemyHit.target.pos.x, 1.2, enemyHit.target.pos.z);
    } else if (pedHit.target) {
      pedHit.target.state = 'flee';
      if (world.events) world.events.push({ type: 'crime', level: 1 });
      end = new THREE.Vector3(pedHit.target.pos.x, 1.2, pedHit.target.pos.z);
    }
    addTracer(from, end, 0xffe08a);
    if (world.events) world.events.push({ type: 'gunshot' });
    if (world.audio) world.audio.shot();
    return true;
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
    if (world.mode !== 'play') return;

    // Mission 4 spawns its shooters the moment the crew is aboard.
    if (world.mission.id === 4 && world.mission.stage >= 2 && !state.enemiesSpawned) {
      spawnEnemies();
    }
    // If the mission is over or restarted, the shooters leave with it.
    if (world.mission.id !== 4 && state.enemies.length > 0) {
      for (const enemy of [...state.enemies]) removeEnemy(enemy);
      state.enemiesSpawned = false;
    }

    const keys = world.input ? world.input.keys : null;
    // Fists and pistol are on-foot weapons: no punching or shooting from a car.
    const onFoot = !world.player || world.player.onFoot !== false;
    if (keys) {
      if (keys.has('Digit1') || keys.has('Numpad1')) state.weapon = 'fists';
      if (keys.has('Digit2') || keys.has('Numpad2')) state.weapon = 'pistol';
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

  return { update, punch, shoot, state, hurtPlayer };
}
