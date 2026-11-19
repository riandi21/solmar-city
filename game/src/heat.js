// Heat — the federal investigation meter for Solmar City.
// Separate from wanted: 0-100. High-profile crimes raise it (a violent
// mission stage +10, killing a cop +15, a big heist +20). At 80+,
// federal agents raid Rico's location: a squad of 3 agents in black SUVs
// plus 2 agents on foot — tougher than gang shooters, coordinating in
// pairs. Heat decays 1 per in-game hour with no crime, -20 for laying
// low (no crime for 2 in-game hours), -30 for a $500 bribe at the Anchor
// Bar (cooldown 1 in-game hour). Persists in the save. HUD: blue bar.
import * as THREE from 'three';

const RAID_AT = 80;
const BRIBE_COST = 500;
const BRIBE_COOLDOWN = 3600;
const LAY_LOW_HOURS = 2;

export function createHeat(scene, world) {
  const w = world || {};
  if (!w.heatState || typeof w.heatState !== 'object' || Array.isArray(w.heatState)) {
    w.heatState = { level: 0, lastCrimeAt: 0, raidTimer: 0, lastBribeAt: -BRIBE_COOLDOWN, raiding: false };
  }
  const h = w.heatState;
  if (typeof h.level !== 'number') h.level = 0;
  if (typeof h.lastCrimeAt !== 'number') h.lastCrimeAt = 0;
  if (typeof h.raidTimer !== 'number') h.raidTimer = 0;
  if (typeof h.lastBribeAt !== 'number') h.lastBribeAt = -BRIBE_COOLDOWN;
  if (typeof w.heat !== 'number') w.heat = h.level;
  if (!Array.isArray(w.federalAgents)) w.federalAgents = [];

  function sync() { w.heat = h.level; }

  function addHeat(amount, kind = 'crime') {
    h.level = Math.min(100, h.level + amount);
    h.lastCrimeAt = w.elapsed || 0;
    sync();
    if (h.level >= RAID_AT && !h.raiding) startRaid();
    return h.level;
  }
  function missionViolence() { return addHeat(10, 'mission'); }
  function copKilled() { return addHeat(15, 'copKill'); }
  function bigHeist() { return addHeat(20, 'heist'); }

  function startRaid() {
    h.raiding = true;
    h.raidTimer = 90;
    const p = w.player && w.player.position ? w.player.position : { x: 0, y: 0, z: 0 };
    const combat = w.systemObjects && w.systemObjects.combat;
    const squad = [];
    // 2 agents on foot, coordinated in pairs.
    for (let i = 0; i < 2; i += 1) {
      if (combat && typeof combat.spawnShooter === 'function') {
        squad.push(combat.spawnShooter(p.x + (i === 0 ? -6 : 6), p.z + 10, { kind: 'federal' }));
      }
    }
    // 3 agents in black SUVs.
    for (let i = 0; i < 3; i += 1) {
      const suv = {
        kind: 'federal', position: { x: p.x + (i - 1) * 8, y: 0, z: p.z - 14 },
        heading: 0, speed: 0, maxSpeed: 30, mesh: null,
      };
      if (scene) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 1, 4.6),
          new THREE.MeshStandardMaterial({ color: 0x0a0a0a }),
        );
        body.position.y = 0.8;
        g.add(body);
        g.position.set(suv.position.x, 0, suv.position.z);
        scene.add(g);
        suv.mesh = g;
      }
      squad.push(suv);
      if (Array.isArray(w.cars)) w.cars.push(suv);
      if (combat && typeof combat.spawnShooter === 'function') {
        squad.push(combat.spawnShooter(suv.position.x + 2, suv.position.z + 2, { kind: 'federal' }));
      }
    }
    if (typeof w.toast === 'function') w.toast('FEDERAL RAID! Agents are on you — break contact or fight them off.');
    return squad;
  }

  function endRaid(won) {
    h.raiding = false;
    h.raidTimer = 0;
    if (won && typeof w.toast === 'function') w.toast('Raid survived. The feds pull back — for now.');
  }

  // $500 bribe at the Anchor Bar: -30 heat, cooldown 1 in-game hour.
  function payBribe() {
    const now = w.elapsed || 0;
    if (now - h.lastBribeAt < BRIBE_COOLDOWN) return false;
    if ((w.cash || 0) < BRIBE_COST) return false;
    w.cash -= BRIBE_COST;
    h.lastBribeAt = now;
    h.level = Math.max(0, h.level - 30);
    sync();
    return true;
  }

  function update(dt) {
    if (w.mode !== 'play') return;
    const now = w.elapsed || 0;
    const sinceCrime = now - h.lastCrimeAt;
    // Slow decay: 1 per in-game hour with no crime.
    if (sinceCrime > 0) h.level = Math.max(0, h.level - (dt / 3600) * 1);
    // Laying low: no crime for 2 in-game hours drops 20.
    if (sinceCrime >= LAY_LOW_HOURS * 3600 && h.level > 0) {
      h.level = Math.max(0, h.level - 20);
      h.lastCrimeAt = now; // bank the bonus once per quiet stretch
    }
    sync();
    if (h.raiding) {
      h.raidTimer -= dt;
      const agentsAlive = w.federalAgents.filter((a) => a && a.alive !== false && (a.health === undefined || a.health > 0)).length;
      if (agentsAlive === 0 || h.raidTimer <= 0) endRaid(agentsAlive === 0);
    } else if (h.level >= RAID_AT) {
      startRaid();
    }
  }

  const api = {
    update, addHeat, missionViolence, copKilled, bigHeist,
    startRaid, endRaid, payBribe,
    get level() { return h.level; },
    get raiding() { return h.raiding; },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  return api;
}

export default createHeat;
