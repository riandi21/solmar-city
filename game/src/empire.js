// Empire — Rico's protection racket for Solmar City.
// After the Coral Crown arc Rico runs the city: six businesses pay
// protection money, crew can be posted to guard districts, and a rival
// family's threat rises over time and after Legacy missions. At high
// threat, rival squads attack a controlled district.
import * as THREE from 'three';

export const BUSINESSES = [
  { name: 'Anchor Bar', x: 100, z: 60, payout: 150 },
  { name: 'Coral Taxi Depot', x: 80, z: 140, payout: 200 },
  { name: 'Beachfront House', x: 30, z: 280, payout: 300 },
  { name: 'Casino', x: 150, z: -60, payout: 400 },
  { name: 'Bike Shop', x: 60, z: 270, payout: 180 },
  { name: 'Islands Beach Bar', x: 370, z: 360, payout: 250 },
];
const COLLECT_COOLDOWN = 3600; // 1 in-game hour per business
const THREAT_ATTACK_AT = 70;

export function createEmpire(scene, world) {
  const w = world || {};
  if (!w.empire || typeof w.empire !== 'object' || Array.isArray(w.empire)) {
    w.empire = { income: 0, threat: 10, posts: {}, collectedAt: {}, lastAttackAt: 0 };
  }
  const e = w.empire;
  if (typeof e.income !== 'number') e.income = 0;
  if (typeof e.threat !== 'number') e.threat = 10;
  if (!e.posts || typeof e.posts !== 'object') e.posts = {};
  if (!e.collectedAt || typeof e.collectedAt !== 'object') e.collectedAt = {};
  if (typeof e.lastAttackAt !== 'number') e.lastAttackAt = 0;
  const state = { menuOpen: false, lastAttackDistrict: null };

  function businessAt(x, z, radius = 8) {
    let best = null; let bestD = Infinity;
    for (const b of BUSINESSES) {
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < radius && d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  // Press E at a business marker to collect its protection money.
  function collectProtection(name) {
    const b = BUSINESSES.find((item) => item.name === name);
    if (!b) return 0;
    const now = w.elapsed || 0;
    const last = e.collectedAt[name] || -COLLECT_COOLDOWN;
    if (now - last < COLLECT_COOLDOWN) return 0;
    e.collectedAt[name] = now;
    e.income += b.payout;
    w.cash = (w.cash || 0) + b.payout;
    if (typeof w.toast === 'function') w.toast(`Protection collected from ${name}: $${b.payout}.`);
    return b.payout;
  }

  // Post a hired crew member to guard a district: its control decays
  // slower and rival attacks on it are weaker. Recall to follow again.
  function postCrew(memberId, district) {
    e.posts[memberId] = district;
    const member = Array.isArray(w.crew) ? w.crew.find((m) => m && (m.id === memberId || m.name === memberId)) : null;
    if (member) { member.state = 'posted'; member.postedTo = district; }
    return true;
  }
  function recallCrew(memberId) {
    delete e.posts[memberId];
    const member = Array.isArray(w.crew) ? w.crew.find((m) => m && (m.id === memberId || m.name === memberId)) : null;
    if (member) { member.state = 'follow'; delete member.postedTo; }
    return true;
  }
  function postedIn(district) {
    return Object.entries(e.posts).filter(([, d]) => d === district).map(([id]) => id);
  }

  function raiseThreat(amount) {
    e.threat = Math.min(100, e.threat + amount);
    return e.threat;
  }
  function lowerThreat(amount) {
    e.threat = Math.max(0, e.threat - amount);
    return e.threat;
  }

  function rivalAttack() {
    const territories = w.systemObjects && w.systemObjects.territories;
    const controlled = territories && territories.control
      ? Object.keys(territories.control).filter((d) => territories.control[d] > 60)
      : [];
    // Attack the richest controlled district first, so losing it hurts.
    const incomeOf = (d) => (territories && territories.income ? territories.income[d] || 0 : 0);
    controlled.sort((a, b) => incomeOf(b) - incomeOf(a));
    const district = controlled.length > 0 ? controlled[0]
      : 'Downtown';
    state.lastAttackDistrict = district;
    e.lastAttackAt = w.elapsed || 0;
    if (territories && typeof territories.startAttack === 'function') territories.startAttack(district);
    else if (typeof w.toast === 'function') w.toast(`Rival family is attacking ${district}!`);
    return district;
  }

  function update(dt) {
    if (w.mode !== 'play') return;
    // Rival threat creeps up over time.
    e.threat = Math.min(100, e.threat + dt * 0.0012);
    // Posted crew slow control decay is handled by territories reading
    // empire.posts; here we trigger rival attacks at high threat.
    if (e.threat >= THREAT_ATTACK_AT && (w.elapsed || 0) - e.lastAttackAt > 300) {
      rivalAttack();
    }
    // Control decay: guarded districts decay slower.
    const territories = w.systemObjects && w.systemObjects.territories;
    if (territories && territories.control) {
      for (const d of Object.keys(territories.control)) {
        if (territories.control[d] <= 0) continue;
        const guarded = postedIn(d).length > 0;
        const rate = guarded ? 0.0004 : 0.0012;
        territories.control[d] = Math.max(0, territories.control[d] - rate * dt);
      }
    }
  }

  const api = {
    update, collectProtection, businessAt, postCrew, recallCrew, postedIn,
    raiseThreat, lowerThreat, rivalAttack, businesses: BUSINESSES,
    get threat() { return e.threat; },
    get income() { return e.income; },
    get posts() { return e.posts; },
    get lastAttackDistrict() { return state.lastAttackDistrict; },
  };
  if (Array.isArray(w.systems)) w.systems.push(api);
  if (scene) {
    // Visible markers for each business.
    for (const b of BUSINESSES) {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 0.15, 16),
        new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x664400 }),
      );
      marker.position.set(b.x, 0.1, b.z);
      scene.add(marker);
    }
  }
  return api;
}

export default createEmpire;
