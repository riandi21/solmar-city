// Combat — punching, shooting, enemy shooters for Solmar City.
// Weapons: pistol, SMG (3-round burst), shotgun (5 pellets), rifle,
// sniper (long range, scope zoom on right-click). Ammo is scarce: refill
// only at shops and on mission start, never free in the field.
import * as THREE from 'three';

const WEAPONS = {
  pistol: { damage: 25, range: 45, rate: 0.28, ammo: 60, pellets: 1, spread: 0.02, auto: false },
  smg: { damage: 14, range: 38, rate: 0.09, ammo: 90, pellets: 1, burst: 3, spread: 0.06, auto: true },
  shotgun: { damage: 12, range: 22, rate: 0.8, ammo: 24, pellets: 5, spread: 0.14, auto: false },
  rifle: { damage: 40, range: 70, rate: 0.16, ammo: 48, pellets: 1, spread: 0.01, auto: true },
  sniper: { damage: 95, range: 140, rate: 1.1, ammo: 12, pellets: 1, spread: 0.001, auto: false, zoom: true },
};
const ORDER = ['pistol', 'smg', 'shotgun', 'rifle', 'sniper'];

function vec(x = 0, y = 0, z = 0) { return new THREE.Vector3(x, y, z); }
function px(p) { return p && typeof p.x === 'number' ? p.x : 0; }
function pz(p) { return p && typeof p.z === 'number' ? p.z : 0; }
function dist3D(a, b) {
  return Math.hypot(px(a) - px(b), (a.y || 0) - (b.y || 0), pz(a) - pz(b));
}

export function createCombat(scene, world) {
  const w = world || {};
  // The mission runner reads these lists: they must be the live lists on
  // the world, never a private copy.
  if (!Array.isArray(w.enemies)) w.enemies = [];
  if (!Array.isArray(w.gangShooters)) w.gangShooters = [];
  if (!Array.isArray(w.federalAgents)) w.federalAgents = [];
  if (!Array.isArray(w.cartelHitmen)) w.cartelHitmen = [];
  const state = {
    weapon: 'pistol',
    ammo: { pistol: 60, smg: 90, shotgun: 24, rifle: 48, sniper: 12 },
    cooldown: 0,
    scoped: false,
    spawnedTotal: 0,
    defeatedTotal: 0,
    shooters: [],
    // A fight stage only counts as clear when a group was actually
    // populated and every member of it is now gone — never on a list
    // that started empty.
    fightPopulated: false,
  };
  if (!w.combat) w.combat = state;

  function makeShooterMesh(color, tough) {
    if (!scene) return null;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = 1.0;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9a066 }),
    );
    head.position.y = 1.85;
    group.add(head);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x222222 }),
    );
    gun.position.set(0.3, 1.2, 0.35);
    group.add(gun);
    if (tough) {
      const vest = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.6, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x111111 }),
      );
      vest.position.y = 1.05;
      group.add(vest);
    }
    scene.add(group);
    return group;
  }

  function nearestCover(pos, from) {
    // Gang shooters take cover behind cars and buildings and flank
    // instead of standing in the open.
    const cars = Array.isArray(w.cars) ? w.cars : [];
    let best = null; let bestD = Infinity;
    for (const car of cars) {
      if (!car || !car.position) continue;
      const d = dist3D(car.position, from);
      if (d < bestD && d > 4) { bestD = d; best = car.position; }
    }
    if (best) return { x: px(best), z: pz(best) };
    const dx = px(pos) - px(from); const dz = pz(pos) - pz(from);
    const len = Math.hypot(dx, dz) || 1;
    return { x: px(pos) + (dx / len) * 6, z: pz(pos) + (dz / len) * 6 };
  }

  // Mandatory: push to world.enemies AND world.gangShooters as well as
  // the internal list, so fight/defend stages advance on real kills.
  function spawnShooter(x, z, options = {}) {
    const kind = options.kind || 'gang';
    const tough = kind === 'federal' || kind === 'cartel';
    const shooter = {
      kind,
      position: vec(x, 0, z),
      heading: 0,
      health: options.health || (kind === 'cartel' ? 130 : kind === 'federal' ? 120 : 60),
      maxHealth: options.health || (kind === 'cartel' ? 130 : kind === 'federal' ? 120 : 60),
      accuracy: kind === 'cartel' ? 0.42 : kind === 'federal' ? 0.38 : 0.22,
      damage: kind === 'cartel' ? 14 : kind === 'federal' ? 13 : 8,
      shootTimer: 1 + Math.random() * 1.5,
      state: 'fight',
      cover: null,
      flankSide: Math.random() < 0.5 ? -1 : 1,
      alive: true,
      mesh: makeShooterMesh(kind === 'cartel' ? 0x881111 : kind === 'federal' ? 0x111111 : 0x335522, tough),
    };
    if (shooter.mesh) shooter.mesh.position.copy(shooter.position);
    state.shooters.push(shooter);
    w.enemies.push(shooter);
    w.gangShooters.push(shooter);
    if (kind === 'federal') w.federalAgents.push(shooter);
    if (kind === 'cartel') w.cartelHitmen.push(shooter);
    state.spawnedTotal += 1;
    state.fightPopulated = true;
    return shooter;
  }

  function spawnSquad(x, z, count, kind = 'gang') {
    const squad = [];
    for (let i = 0; i < count; i += 1) {
      squad.push(spawnShooter(x + (i - (count - 1) / 2) * 3, z + (i % 2) * 2, { kind }));
    }
    return squad;
  }

  function removeShooter(shooter) {
    for (const list of [state.shooters, w.enemies, w.gangShooters, w.federalAgents, w.cartelHitmen]) {
      const i = list.indexOf(shooter);
      if (i >= 0) list.splice(i, 1);
    }
    if (shooter.mesh && shooter.mesh.parent) shooter.mesh.parent.remove(shooter.mesh);
    state.defeatedTotal += 1;
  }

  function damageShooter(shooter, amount) {
    if (!shooter || !shooter.alive) return false;
    shooter.health -= amount;
    if (shooter.health <= 0) {
      shooter.alive = false;
      removeShooter(shooter);
      return true;
    }
    return false;
  }

  // True only when a fight was actually populated and nothing of it is
  // left alive. An empty list that was never populated returns false.
  function fightClear() {
    if (!state.fightPopulated) return false;
    return w.enemies.length === 0 && w.gangShooters.length === 0;
  }
  function allDefeated() { return fightClear(); }
  // How many shooters of a kind are still standing (for HUD / stages).
  function aliveCount(kind) {
    return state.shooters.filter((s) => s.alive && (!kind || s.kind === kind)).length;
  }
  function weaponInfo(name) {
    return WEAPONS[name || state.weapon] || null;
  }

  function playerPos() {
    return w.player && w.player.position ? w.player.position : { x: 0, y: 0, z: 0 };
  }

  function punch() {
    const p = playerPos();
    let hits = 0;
    for (const e of [...w.enemies]) {
      if (dist3D(e.position, p) < 2.2) {
        const dx = px(e.position) - px(p); const dz = pz(e.position) - pz(p);
        const len = Math.hypot(dx, dz) || 1;
        e.position.x += (dx / len) * 3; e.position.z += (dz / len) * 3;
        damageShooter(e, 20);
        hits += 1;
      }
    }
    for (const ped of Array.isArray(w.pedestrians) ? w.pedestrians : []) {
      if (ped && ped.position && dist3D(ped.position, p) < 2.2) {
        ped.state = 'flee';
        const dx = px(ped.position) - px(p); const dz = pz(ped.position) - pz(p);
        const len = Math.hypot(dx, dz) || 1;
        ped.position.x += (dx / len) * 4; ped.position.z += (dz / len) * 4;
      }
    }
    return hits;
  }

  function shoot(targetPoint) {
    const def = WEAPONS[state.weapon];
    if (state.cooldown > 0 || state.ammo[state.weapon] <= 0) return null;
    state.ammo[state.weapon] -= 1;
    state.cooldown = def.rate;
    const p = playerPos();
    const aim = targetPoint || { x: px(p), y: 1.2, z: pz(p) - 10 };
    let best = null; let bestD = Infinity;
    for (const e of [...w.enemies]) {
      const d = dist3D(e.position, aim);
      if (d < 3 && dist3D(e.position, p) <= def.range && d < bestD) { best = e; bestD = d; }
    }
    // Shotgun fires 5 pellets: extra close-range hits on the same target.
    let killed = false;
    if (best) {
      killed = damageShooter(best, def.damage * def.pellets);
    }
    return { weapon: state.weapon, hit: !!best, killed, ammoLeft: state.ammo[state.weapon] };
  }

  function switchWeapon(name) {
    if (WEAPONS[name]) { state.weapon = name; state.scoped = false; return true; }
    return false;
  }
  function cycleWeapon(dir = 1) {
    const i = ORDER.indexOf(state.weapon);
    state.weapon = ORDER[(i + dir + ORDER.length) % ORDER.length];
    state.scoped = false;
    return state.weapon;
  }
  function refillAmmo() {
    for (const name of ORDER) state.ammo[name] = WEAPONS[name].ammo;
  }
  function setScoped(on) {
    state.scoped = state.weapon === 'sniper' ? !!on : false;
    return state.scoped;
  }

  function update(dt) {
    if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);
    if (w.mode !== 'play') return;
    const p = playerPos();
    for (const s of [...state.shooters]) {
      if (!s.alive) continue;
      s.shootTimer -= dt;
      const d = dist3D(s.position, p);
      // Take cover, then flank: sidestep around the player instead of
      // standing in the open.
      if (!s.cover || d < 8) s.cover = nearestCover(s.position, p);
      const cx = s.cover.x - px(s.position);
      const cz = s.cover.z - pz(s.position);
      const cl = Math.hypot(cx, cz);
      if (cl > 1.5) {
        const sp = 3.2;
        s.position.x += (cx / cl) * sp * dt;
        s.position.z += (cz / cl) * sp * dt;
      } else {
        // Flank step sideways while holding cover.
        s.position.x += s.flankSide * 1.2 * dt;
      }
      s.heading = Math.atan2(px(p) - px(s.position), pz(p) - pz(s.position));
      if (s.mesh) { s.mesh.position.copy(s.position); s.mesh.rotation.y = s.heading; }
      if (s.shootTimer <= 0 && d < 55) {
        s.shootTimer = 1.4 + Math.random() * 1.2;
        // Simple inaccurate hitscan.
        if (Math.random() < s.accuracy) {
          if (w.player && typeof w.player.health === 'number') {
            w.player.health = Math.max(0, w.player.health - s.damage);
            if (typeof w.toast === 'function' && w.player.health <= 25) w.toast('Health critical!');
          }
        }
      }
      // Crew shoot back with pistols.
      for (const m of Array.isArray(w.crew) ? w.crew : []) {
        if (m && m.state === 'fight' && Math.random() < dt * 0.5) damageShooter(s, 10);
      }
    }
  }

  function resetFight() {
    for (const s of [...state.shooters]) removeShooter(s);
    state.fightPopulated = false;
  }

  const api = {
    update, spawnShooter, spawnSquad, damageShooter, removeShooter,
    punch, shoot, switchWeapon, cycleWeapon, refillAmmo, setScoped,
    fightClear, allDefeated, aliveCount, weaponInfo, resetFight, state, weapons: WEAPONS,
    get weapon() { return state.weapon; },
    get ammo() { return state.ammo; },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  return api;
}

export default createCombat;
