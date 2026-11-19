// Cartel — the rival cartel threat meter for Solmar City (NEW).
// Separate from wanted and Heat: 0-100. Cartel shipments and hits raise
// it. At 60+, cartel hit squads (2 hitmen in a black SUV) ambush Rico on
// the road; at 80+, a hit squad raids his current location. Threat drops
// on seizing a shipment (M41, -20) and surviving a siege (M43, -30), and
// decays 1 per in-game hour with no cartel crime. Cartel hitmen are
// tougher than gang shooters and coordinate in pairs. HUD: red bar under
// the Heat bar.
import * as THREE from 'three';

const SQUAD_AT = 60;
const RAID_AT = 80;
const AMBUSH_COOLDOWN = 45;
const RAID_COOLDOWN = 120;

export function createCartel(scene, world) {
  const w = world || {};
  if (!w.kingpinState || typeof w.kingpinState !== 'object') w.kingpinState = {};
  if (typeof w.cartelThreat !== 'number') w.cartelThreat = 0;
  if (!Array.isArray(w.cartelHitmen)) w.cartelHitmen = [];
  if (!Array.isArray(w.enemies)) w.enemies = [];
  const state = {
    threat: w.cartelThreat,
    ambushTimer: 0,
    raidTimer: 0,
    raiding: false,
    lastCartelCrimeAt: 0,
    squadsSent: 0,
    raidsSent: 0,
  };
  if (!w.cartelState) w.cartelState = state;

  function sync() { w.cartelThreat = state.threat; if (w.kingpinState) w.kingpinState.cartelThreat = state.threat; }

  function addThreat(amount) {
    state.threat = Math.min(100, state.threat + amount);
    state.lastCartelCrimeAt = w.elapsed || 0;
    sync();
    return state.threat;
  }
  function shipmentSpotted() { return addThreat(12); }
  function hitOrdered() { return addThreat(18); }
  // HUD label for the threat bar: calm / hunted / siege.
  function threatLevel() {
    if (state.threat >= RAID_AT) return 'siege';
    if (state.threat >= SQUAD_AT) return 'hunted';
    if (state.threat >= 30) return 'watched';
    return 'calm';
  }

  // M41: seizing a shipment drops threat by 20.
  function seizeShipment() {
    state.threat = Math.max(0, state.threat - 20);
    sync();
    if (w.kingpinState) w.kingpinState.shipmentSeized = true;
    return state.threat;
  }
  // M43: surviving the siege drops threat by 30.
  function surviveSiege() {
    state.threat = Math.max(0, state.threat - 30);
    sync();
    if (w.kingpinState) w.kingpinState.siegeSurvived = true;
    return state.threat;
  }

  function spawnHitman(x, z, partner) {
    const combat = w.systemObjects && w.systemObjects.combat;
    let hitman;
    if (combat && typeof combat.spawnShooter === 'function') {
      hitman = combat.spawnShooter(x, z, { kind: 'cartel', health: 130 });
    } else {
      hitman = {
        kind: 'cartel', position: { x, y: 0, z }, heading: 0, health: 130, maxHealth: 130,
        accuracy: 0.42, damage: 14, alive: true, mesh: null,
      };
      if (scene) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 1.1, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x881111 }),
        );
        body.position.y = 1.0;
        g.add(body);
        g.position.set(x, 0, z);
        scene.add(g);
        hitman.mesh = g;
      }
      w.cartelHitmen.push(hitman);
      w.enemies.push(hitman);
    }
    // Hitmen coordinate in pairs: each knows its partner and they flank
    // opposite sides of the player.
    hitman.partner = partner || null;
    hitman.flankSide = partner ? -partner.flankSide : 1;
    if (partner) partner.partner = hitman;
    return hitman;
  }

  function spawnHitSquad(atPlayer = true) {
    const p = w.player && w.player.position ? w.player.position : { x: 0, y: 0, z: 0 };
    const bx = atPlayer ? p.x + 18 : -215;
    const bz = atPlayer ? p.z + 12 : -215;
    // The black SUV the squad arrives in.
    const suv = {
      kind: 'cartel', position: { x: bx, y: 0, z: bz }, heading: 0, speed: 0, maxSpeed: 32, mesh: null,
    };
    if (scene) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1, 4.6),
        new THREE.MeshStandardMaterial({ color: 0x111111 }),
      );
      body.position.y = 0.8;
      g.add(body);
      g.position.set(bx, 0, bz);
      scene.add(g);
      suv.mesh = g;
    }
    if (Array.isArray(w.cars)) w.cars.push(suv);
    const first = spawnHitman(bx - 2, bz + 3, null);
    const second = spawnHitman(bx + 2, bz + 3, first);
    state.squadsSent += 1;
    state.ambushTimer = AMBUSH_COOLDOWN;
    if (typeof w.toast === 'function') w.toast('Cartel hit squad ambush!');
    return { suv, hitmen: [first, second] };
  }

  function startRaid() {
    state.raiding = true;
    state.raidTimer = RAID_COOLDOWN;
    state.raidsSent += 1;
    // A raid is two squads at once on Rico's current location.
    const a = spawnHitSquad(true);
    const b = spawnHitSquad(true);
    if (typeof w.toast === 'function') w.toast('CARTEL RAID! Hit squads are storming your location!');
    return [a, b];
  }

  function update(dt) {
    if (w.mode !== 'play') return;
    state.ambushTimer -= dt;
    // Slow decay: 1 per in-game hour with no cartel crime.
    if (state.threat > 0) state.threat = Math.max(0, state.threat - (dt / 3600) * 1);
    sync();
    // Hit squads ambush on the road at 60+.
    if (state.threat >= SQUAD_AT && state.ambushTimer <= 0 && !state.raiding) {
      spawnHitSquad(true);
    }
    // Raids at 80+.
    if (state.threat >= RAID_AT && !state.raiding) startRaid();
    if (state.raiding) {
      state.raidTimer -= dt;
      const alive = w.cartelHitmen.filter((m) => m && m.alive !== false && (m.health === undefined || m.health > 0)).length;
      if (alive === 0 || state.raidTimer <= 0) {
        state.raiding = false;
        if (alive === 0 && typeof w.toast === 'function') w.toast('Cartel raid beaten back.');
      }
    }
    // Paired hitmen flank opposite sides: keep their flank sides opposed.
    for (const m of w.cartelHitmen) {
      if (m && m.partner && m.flankSide === m.partner.flankSide) m.flankSide = -m.partner.flankSide;
    }
  }

  const api = {
    update, addThreat, shipmentSpotted, hitOrdered, seizeShipment, surviveSiege,
    spawnHitman, spawnHitSquad, startRaid, threatLevel,
    get threat() { return state.threat; },
    get raiding() { return state.raiding; },
    get squadsSent() { return state.squadsSent; },
    get raidsSent() { return state.raidsSent; },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  return api;
}

export default createCartel;
