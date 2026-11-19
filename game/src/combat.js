// Combat — punching and shooting for Solmar City.
// Punch (F, on foot only) knocks back nearby pedestrians and enemies.
// Shooting is hitscan on click: pistol, SMG (3-round burst), shotgun
// (5 pellets), rifle, and sniper rifle (long range, scope zoom on
// right-click). Digit keys switch weapons; ammo is tracked per weapon.
// Ammo is SCARCE: it refills only at shops and on mission start —
// never free in the field. Rival gang shooters spawn for later missions,
// take cover behind cars and buildings, and flank instead of standing
// in the open. Communicates only through the shared world object.
import * as THREE from 'three';

const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, range: 55, rate: 0.28, spread: 0.03, pellets: 1, magSize: 12, startAmmo: 60, zoom: 1 },
  smg: { name: 'SMG', damage: 16, range: 45, rate: 0.09, spread: 0.07, pellets: 1, burst: 3, magSize: 30, startAmmo: 90, zoom: 1 },
  shotgun: { name: 'Shotgun', damage: 14, range: 22, rate: 0.85, spread: 0.16, pellets: 5, magSize: 6, startAmmo: 24, zoom: 1 },
  rifle: { name: 'Rifle', damage: 42, range: 90, rate: 0.14, spread: 0.02, pellets: 1, magSize: 30, startAmmo: 90, zoom: 1 },
  sniper: { name: 'Sniper', damage: 95, range: 180, rate: 1.1, spread: 0.004, pellets: 1, magSize: 5, startAmmo: 15, zoom: 3 },
};
const WEAPON_KEYS = {
  Digit1: 'pistol',
  Digit2: 'smg',
  Digit3: 'shotgun',
  Digit4: 'rifle',
  Digit5: 'sniper',
};
const PUNCH_RANGE = 2.4;
const PUNCH_DAMAGE = 25;
const PUNCH_KNOCKBACK = 6;
const SHOOTER_HEALTH = 100;
const SHOOTER_FIRE_INTERVAL = 1.4;
const SHOOTER_HIT_CHANCE = 0.22;

function buildShooterMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x8a2a1e, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9976b, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), jacket);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 1.95;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.14, 12), dark);
  cap.position.y = 2.18;
  group.add(cap);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), dark);
  gun.position.set(0.3, 1.25, 0.35);
  group.add(gun);
  return group;
}

export function createCombat(world) {
  world.systems = world.systems || {};
  world.events = world.events || [];
  world.player = world.player || {};
  world.peds = world.peds || [];
  world.cars = world.cars || [];
  world.gangShooters = world.gangShooters || [];
  world.city = world.city || {};
  if (!world.player.ammo) {
    world.player.ammo = {};
    for (const key of Object.keys(WEAPONS)) world.player.ammo[key] = WEAPONS[key].startAmmo;
  }
  if (!world.player.weapon) world.player.weapon = 'pistol';
  if (typeof world.player.armor !== 'number') world.player.armor = 0;
  if (typeof world.player.scopeZoom !== 'number') world.player.scopeZoom = 1;

  const shooters = world.gangShooters;
  const tracers = [];
  let fireCooldown = 0;
  let burstLeft = 0;
  let burstTimer = 0;
  let fWasDown = false;
  let lastMissionId = world.mission ? world.mission.id : null;
  let lastWeapon = world.player.weapon;

  function playerPos() {
    return world.player.position || new THREE.Vector3(0, 0, 0);
  }

  function aimDirection() {
    const heading = world.player.heading || 0;
    const spreadJitter = (Math.random() - 0.5) * 2;
    const weapon = WEAPONS[world.player.weapon] || WEAPONS.pistol;
    const jitter = weapon.spread * spreadJitter;
    return new THREE.Vector3(Math.sin(heading + jitter), 0, Math.cos(heading + jitter));
  }

  function spawnTracer(from, to) {
    if (!world.scene) return;
    const length = from.distanceTo(to);
    const tracer = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, length),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 })
    );
    tracer.position.copy(from).lerp(to, 0.5);
    tracer.lookAt(to);
    world.scene.add(tracer);
    tracers.push({ mesh: tracer, age: 0 });
  }

  function updateTracers(dt) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const tracer = tracers[i];
      tracer.age += dt;
      tracer.mesh.material.opacity = Math.max(0, 0.9 - tracer.age * 9);
      if (tracer.age > 0.1) {
        if (world.scene) world.scene.remove(tracer.mesh);
        tracers.splice(i, 1);
      }
    }
  }

  function nearestCoverPoint(from, target) {
    // Pick a car or building corner near the shooter that sits between
    // the shooter and the player — real cover, not open ground.
    const candidates = [];
    for (const car of world.cars) {
      if (!car || !car.position) continue;
      candidates.push(car.position);
    }
    const colliders = world.city.colliders || [];
    for (const box of colliders) {
      candidates.push(new THREE.Vector3(box.minX ?? box.xMin ?? box.x0 ?? 0, 0, box.minZ ?? box.zMin ?? box.z0 ?? 0));
      candidates.push(new THREE.Vector3(box.maxX ?? box.xMax ?? box.x1 ?? 0, 0, box.maxZ ?? box.zMax ?? box.z1 ?? 0));
    }
    let best = null;
    let bestScore = Infinity;
    for (const point of candidates) {
      const toShooter = Math.hypot(point.x - from.x, point.z - from.z);
      const toTarget = Math.hypot(point.x - target.x, point.z - target.z);
      if (toShooter > 30) continue;
      // Cover should be close to the shooter and roughly on the line
      // toward the player, so the shooter can duck behind it.
      const score = toShooter + toTarget * 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = point;
      }
    }
    return best;
  }

  function spawnGangSquad(position, count) {
    const squad = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const spawn = new THREE.Vector3(
        position.x + Math.cos(angle) * (6 + i * 2),
        0,
        position.z + Math.sin(angle) * (6 + i * 2)
      );
      const mesh = buildShooterMesh();
      mesh.position.copy(spawn);
      if (world.scene) world.scene.add(mesh);
      const shooter = {
        mesh,
        position: spawn,
        heading: angle,
        health: SHOOTER_HEALTH,
        state: 'cover',
        coverPoint: null,
        fireTimer: 0.6 + Math.random() * 0.8,
        flankSide: i % 2 === 0 ? 1 : -1,
        alive: true,
      };
      shooters.push(shooter);
      squad.push(shooter);
    }
    // Callers may pass a plain {x, z} point (missions) or a Vector3.
    const eventPos = (position && typeof position.clone === 'function')
      ? position.clone()
      : new THREE.Vector3(position ? position.x || 0 : 0, 0, position ? position.z || 0 : 0);
    world.events.push({ type: 'gang-squad', position: eventPos, count });
    return squad;
  }

  function removeShooter(shooter) {
    shooter.alive = false;
    if (world.scene && shooter.mesh) world.scene.remove(shooter.mesh);
    const index = shooters.indexOf(shooter);
    if (index >= 0) shooters.splice(index, 1);
  }

  function damageShooter(shooter, amount, fromPos) {
    shooter.health -= amount;
    // A hit knocks them back a step.
    const away = new THREE.Vector3().subVectors(shooter.position, fromPos);
    away.y = 0;
    if (away.lengthSq() > 0.001) {
      away.normalize();
      shooter.position.addScaledVector(away, 0.8);
    }
    if (shooter.health <= 0) {
      world.events.push({ type: 'gang-down', position: shooter.position.clone() });
      removeShooter(shooter);
    }
  }

  function updateShooters(dt) {
    // Shooters only act while the game is actually being played.
    if (world.mode && world.mode !== 'play') return;
    const pos = playerPos();
    for (let i = shooters.length - 1; i >= 0; i--) {
      const shooter = shooters[i];
      if (!shooter.alive) continue;
      const dist = Math.hypot(pos.x - shooter.position.x, pos.z - shooter.position.z);
      shooter.fireTimer -= dt;

      if (dist > 70) {
        // Too far: close in, but off to a flank, not straight at the player.
        shooter.state = 'advance';
        const side = new THREE.Vector3(-Math.cos(shooter.heading), 0, Math.sin(shooter.heading));
        const flankTarget = new THREE.Vector3(
          pos.x + side.x * shooter.flankSide * 25,
          0,
          pos.z + side.z * shooter.flankSide * 25
        );
        moveToward(shooter, flankTarget, 5.5, dt);
      } else if (shooter.state === 'cover' || !shooter.coverPoint) {
        // Find cover near the line to the player, then hold behind it.
        shooter.coverPoint = nearestCoverPoint(shooter.position, pos);
        if (shooter.coverPoint) {
          shooter.state = 'in-cover';
          moveToward(shooter, shooter.coverPoint, 5, dt);
        } else {
          shooter.state = 'flank';
        }
      } else if (shooter.state === 'in-cover') {
        // Peek out and fire inaccurately; reposition to a new flank
        // every few seconds instead of camping one spot.
        shooter.state = 'flank';
        shooter.flankTimer = 2 + Math.random() * 2;
      } else {
        // Flanking: strafe sideways around the player while firing.
        shooter.flankTimer = (shooter.flankTimer || 0) - dt;
        const side = new THREE.Vector3(
          -(pos.z - shooter.position.z), 0, pos.x - shooter.position.x
        ).normalize();
        const flankTarget = new THREE.Vector3(
          shooter.position.x + side.x * shooter.flankSide * 12,
          0,
          shooter.position.z + side.z * shooter.flankSide * 12
        );
        moveToward(shooter, flankTarget, 4, dt);
        if (shooter.flankTimer <= 0) {
          shooter.state = 'cover';
          shooter.coverPoint = null;
        }
      }

      // Face the player and fire inaccurate hitscan.
      shooter.heading = Math.atan2(pos.x - shooter.position.x, pos.z - shooter.position.z);
      shooter.mesh.position.copy(shooter.position);
      shooter.mesh.rotation.y = -shooter.heading;
      if (shooter.fireTimer <= 0 && dist < 60 && world.player.onFoot !== false) {
        shooter.fireTimer = SHOOTER_FIRE_INTERVAL + Math.random() * 0.6;
        spawnTracer(
          shooter.position.clone().setY(1.4),
          pos.clone().setY(1.2)
        );
        if (Math.random() < SHOOTER_HIT_CHANCE) {
          damagePlayer(8 + Math.floor(Math.random() * 6));
        }
      }
    }
  }

  function moveToward(shooter, target, speed, dt) {
    const dx = target.x - shooter.position.x;
    const dz = target.z - shooter.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) return;
    const step = Math.min(dist, speed * dt);
    shooter.position.x += (dx / dist) * step;
    shooter.position.z += (dz / dist) * step;
  }

  function damagePlayer(amount) {
    let remaining = amount;
    if ((world.player.armor || 0) > 0) {
      const absorbed = Math.min(world.player.armor, remaining);
      world.player.armor -= absorbed;
      remaining -= absorbed;
    }
    world.player.health = Math.max(0, (world.player.health ?? 100) - remaining);
    world.events.push({ type: 'player-hit', amount: remaining });
    if (world.player.health <= 0 && world.mode !== 'over') {
      world.mode = 'over';
      world.events.push({ type: 'player-down' });
    }
  }

  function punch() {
    if (!world.player.onFoot) return;
    const pos = playerPos();
    const heading = world.player.heading || 0;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const hit = (target, targetPos) => {
      const to = new THREE.Vector3().subVectors(targetPos, pos);
      to.y = 0;
      const dist = to.length();
      if (dist > PUNCH_RANGE) return false;
      if (dist > 0.01 && to.normalize().dot(forward) < 0.2) return false;
      to.multiplyScalar(PUNCH_KNOCKBACK);
      targetPos.add(to);
      return true;
    };
    for (const ped of world.peds) {
      if (ped && ped.position && hit(ped, ped.position)) {
        ped.state = 'flee';
        if (ped.mesh) ped.mesh.position.copy(ped.position);
      }
    }
    for (const shooter of [...shooters]) {
      if (shooter.position && hit(shooter, shooter.position)) {
        damageShooter(shooter, PUNCH_DAMAGE, pos);
      }
    }
    world.events.push({ type: 'punch' });
  }

  function fireWeapon() {
    const weaponKey = world.player.weapon || 'pistol';
    const weapon = WEAPONS[weaponKey];
    if (!weapon) return;
    if (fireCooldown > 0) return;
    if ((world.player.ammo[weaponKey] || 0) <= 0) {
      world.events.push({ type: 'dry-fire', weapon: weaponKey });
      fireCooldown = 0.3;
      return;
    }
    world.player.ammo[weaponKey] -= 1;
    fireCooldown = weapon.rate;
    if (weapon.burst) {
      burstLeft = weapon.burst - 1;
      burstTimer = 0.09;
    }
    shootPellet(weapon);
    world.events.push({ type: 'shot-fired', weapon: weaponKey });
  }

  function shootPellet(weapon) {
    const from = playerPos().clone();
    from.y = 1.4;
    const pellets = weapon.pellets || 1;
    let end = null;
    for (let p = 0; p < pellets; p++) {
      const dir = aimDirection();
      end = from.clone().addScaledVector(dir, weapon.range);
      // Hit the nearest shooter inside the cone.
      let bestShooter = null;
      let bestDist = weapon.range;
      for (const shooter of [...shooters]) {
        const to = new THREE.Vector3().subVectors(shooter.position, from);
        to.y = 0;
        const along = to.dot(dir);
        if (along < 1 || along > weapon.range) continue;
        const side = Math.abs(to.x * dir.z - to.z * dir.x);
        if (side < 1.6 && along < bestDist) {
          bestDist = along;
          bestShooter = shooter;
        }
      }
      if (bestShooter) {
        end = bestShooter.position.clone().setY(1.2);
        damageShooter(bestShooter, weapon.damage, from);
        continue;
      }
      // Otherwise a pedestrian caught in the line of fire flees.
      for (const ped of world.peds) {
        if (!ped || !ped.position) continue;
        const to = new THREE.Vector3().subVectors(ped.position, from);
        to.y = 0;
        const along = to.dot(dir);
        if (along < 1 || along > weapon.range) continue;
        const side = Math.abs(to.x * dir.z - to.z * dir.x);
        if (side < 1.4) {
          ped.state = 'flee';
          if (Math.random() < 0.5) {
            world.events.push({ type: 'crime', kind: 'ped-shot', wanted: world.wanted });
          }
          break;
        }
      }
    }
    if (end) spawnTracer(from, end);
  }

  function refillAmmo(source) {
    // Only shops and mission starts may refill — never the field.
    if (source !== 'shop' && source !== 'mission') return false;
    for (const key of Object.keys(WEAPONS)) {
      world.player.ammo[key] = WEAPONS[key].startAmmo;
    }
    world.events.push({ type: 'ammo-refill', source });
    return true;
  }

  function update(dt) {
    // Ammo refill on a fresh mission start.
    const missionId = world.mission ? world.mission.id : null;
    if (missionId !== null && missionId !== lastMissionId) {
      refillAmmo('mission');
    }
    lastMissionId = missionId;

    fireCooldown = Math.max(0, fireCooldown - dt);
    if (burstLeft > 0) {
      burstTimer -= dt;
      if (burstTimer <= 0) {
        burstLeft -= 1;
        burstTimer = 0.09;
        const weapon = WEAPONS[world.player.weapon] || WEAPONS.pistol;
        if ((world.player.ammo[world.player.weapon] || 0) > 0) {
          world.player.ammo[world.player.weapon] -= 1;
          shootPellet(weapon);
        }
      }
    }

    const keys = (world.input && world.input.keys) || new Set();
    for (const [key, weapon] of Object.entries(WEAPON_KEYS)) {
      if (keys.has(key) && world.player.weapon !== weapon) {
        world.player.weapon = weapon;
        world.events.push({ type: 'weapon-switch', weapon });
      }
    }

    // Sniper scope zoom on right-click.
    const rightDown = !!(world.input && world.input.rightClicked);
    const weapon = WEAPONS[world.player.weapon] || WEAPONS.pistol;
    world.player.scopeZoom = rightDown && world.player.weapon === 'sniper' ? weapon.zoom : 1;

    // Punch on F, edge-triggered, on foot only.
    const fDown = keys.has('KeyF');
    if (fDown && !fWasDown) punch();
    fWasDown = fDown;

    // Fire on click (mouse held, rate-limited by the weapon).
    if (world.input && world.input.clicked && world.player.onFoot) {
      fireWeapon();
    }

    updateTracers(dt);
    updateShooters(dt);

    // Keep the HUD-facing weapon label fresh.
    if (world.player.weapon !== lastWeapon) {
      lastWeapon = world.player.weapon;
    }
  }

  const api = {
    update,
    spawnGangSquad,
    refillAmmo,
    damagePlayer,
    // Mission cleanup: pull every live shooter off the board at once.
    clearShooters() {
      for (const shooter of [...shooters]) removeShooter(shooter);
    },
    get weapons() { return WEAPONS; },
    get shooters() { return shooters; },
    get currentWeapon() { return WEAPONS[world.player.weapon] || WEAPONS.pistol; },
  };
  world.systems.combat = api;
  return api;
}
