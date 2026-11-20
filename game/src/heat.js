import * as THREE from 'three';

// Heat: federal investigation meter 0-100, separate from wanted.
// Fresh implementation for Round 16.
export function createHeat(world) {
  if (!world.heatState) world.heatState = { level: 0, lastCrime: 0, raidTimer: 0 };
  const hs = world.heatState;
  if (typeof hs.level !== 'number') hs.level = 0;
  if (typeof hs.raidTimer !== 'number') hs.raidTimer = 0;

  let lastHour = typeof world.hourOfDay === 'number' ? world.hourOfDay : 0;
  let quietHours = 0;
  let bribeCooldownUntil = -Infinity;

  function addHeat(n) {
    hs.level = Math.max(0, Math.min(100, hs.level + n));
    hs.lastCrime = world.elapsed || 0;
    quietHours = 0;
    if (world.events) world.events.push({ type: 'heat-change', level: hs.level });
    return hs.level;
  }

  // Mission hooks: violent stage +10, killing a cop +15, big heist +20.
  function violentStage() { return addHeat(10); }
  function copKilled() { return addHeat(15); }
  function bigHeist() { return addHeat(20); }

  function payBribe() {
    const now = world.elapsed || 0;
    const hourLen = world.secondsPerHour || 60;
    if (now < bribeCooldownUntil) return false;
    if ((world.cash || 0) < 500) {
      if (world.events) world.events.push({ type: 'toast', text: 'Bribe needs $500 cash.' });
      return false;
    }
    world.cash -= 500;
    if (world.player) world.player.cash = world.cash;
    hs.level = Math.max(0, hs.level - 30);
    bribeCooldownUntil = now + hourLen;
    if (world.events) world.events.push({ type: 'toast', text: 'Bribed a federal contact: Heat -30.' });
    return true;
  }

  function spawnRaid() {
    const p = world.player.position;
    const combat = world.systemObjects && world.systemObjects.combat;
    // Squad of 3 agents in black SUVs + 2 on foot.
    const suvs = [];
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.4, 5),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
      );
      const a = (i / 3) * Math.PI * 2;
      mesh.position.set(p.x + Math.sin(a) * 22, 0.8, p.z + Math.cos(a) * 22);
      if (world.scene && world.scene.add) world.scene.add(mesh);
      suvs.push({ mesh, position: mesh.position });
    }
    if (!world.feds) world.feds = [];
    for (let i = 0; i < 2; i++) {
      const x = p.x + (Math.random() - 0.5) * 20;
      const z = p.z + (Math.random() - 0.5) * 20;
      let agent = null;
      if (combat && combat.spawnShooter) agent = combat.spawnShooter(x, z, 'fed');
      if (!agent) {
        agent = { position: { x, z }, health: 150, kind: 'fed', state: 'chase' };
        world.feds.push(agent);
        if (!world.enemies) world.enemies = [];
        world.enemies.push(agent);
      }
      agent.state = 'raid';
      agent.suvs = suvs;
    }
    hs.raidTimer = 120; // don't chain raids back-to-back
    if (world.events) world.events.push({ type: 'toast', text: 'FEDERAL RAID! Agents are moving on your location!' });
  }

  function update(dt) {
    hs.raidTimer = Math.max(0, hs.raidTimer - dt);
    // Heat 80+: federal agents raid Rico's location.
    if (hs.level >= 80 && hs.raidTimer <= 0) spawnRaid();

    // Decay: 1 per in-game hour with no crime.
    const h = typeof world.hourOfDay === 'number' ? world.hourOfDay : lastHour;
    if (h !== lastHour) {
      lastHour = h;
      const sinceCrime = (world.elapsed || 0) - (hs.lastCrime || 0);
      const hourLen = world.secondsPerHour || 60;
      if (sinceCrime >= hourLen) {
        hs.level = Math.max(0, hs.level - 1);
        quietHours += 1;
        // Laying low: no crime for 2 in-game hours drops Heat by 20.
        if (quietHours >= 2) {
          hs.level = Math.max(0, hs.level - 20);
          quietHours = 0;
          if (world.events) world.events.push({ type: 'toast', text: 'Laying low paid off: Heat -20.' });
        }
      } else {
        quietHours = 0;
      }
    }
    // Keep world.heat in sync for HUD readers.
    world.heat = hs.level;
  }

  return {
    update, addHeat, payBribe, violentStage, copKilled, bigHeist,
    get level() { return hs.level; },
  };
}
