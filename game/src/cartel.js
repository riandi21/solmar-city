import * as THREE from 'three';

// Cartel: rival cartel threat meter 0-100, separate from wanted and Heat.
// Fresh implementation for Round 16 (NEW system).
export function createCartel(world) {
  if (!world.cartelHitmen) world.cartelHitmen = [];
  let threat = typeof world.cartelThreat === 'number' ? world.cartelThreat : 0;

  let lastHour = typeof world.hourOfDay === 'number' ? world.hourOfDay : 0;
  let ambushCooldown = 0;
  let raidCooldown = 0;
  let lastCartelCrime = 0;

  function addThreat(n) {
    threat = Math.max(0, Math.min(100, threat + n));
    world.cartelThreat = threat;
    lastCartelCrime = world.elapsed || 0;
    if (world.events) world.events.push({ type: 'cartel-threat', level: threat });
    return threat;
  }

  function dropThreat(n) {
    threat = Math.max(0, Math.min(100, threat - n));
    world.cartelThreat = threat;
    if (world.events) world.events.push({ type: 'cartel-threat', level: threat });
    return threat;
  }

  // Mission hooks: seizing a shipment (M41) -20, surviving a siege (M43) -30.
  function seizeShipment() { return dropThreat(20); }
  function surviveSiege() { return dropThreat(30); }

  function spawnHitSquad(x, z) {
    const combat = world.systemObjects && world.systemObjects.combat;
    // 2 hitmen in a black SUV.
    const suv = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.4, 5),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    );
    suv.position.set(x, 0.8, z);
    if (world.scene && world.scene.add) world.scene.add(suv);
    const squad = [];
    for (let i = 0; i < 2; i++) {
      const hx = x + (i === 0 ? -2 : 2);
      const hz = z + 2;
      let hitman = null;
      if (combat && combat.spawnShooter) hitman = combat.spawnShooter(hx, hz, 'hitman');
      if (!hitman) {
        hitman = { position: { x: hx, z: hz }, health: 140, kind: 'hitman', state: 'chase' };
        world.cartelHitmen.push(hitman);
        if (!world.enemies) world.enemies = [];
        world.enemies.push(hitman);
      }
      hitman.state = 'ambush';
      hitman.suv = suv;
      squad.push(hitman);
    }
    if (world.events) world.events.push({ type: 'toast', text: 'Cartel hit squad inbound!' });
    return squad;
  }

  function ambushOnRoad() {
    // Hit squad intercepts Rico on the road, ahead of his travel direction.
    const p = world.player.position;
    const vx = (world.player.velocity && world.player.velocity.x) || 0;
    const vz = (world.player.velocity && world.player.velocity.z) || 0;
    const heading = Math.atan2(vx, vz);
    const ahead = 25;
    const x = p.x + Math.sin(heading) * ahead;
    const z = p.z + Math.cos(heading) * ahead;
    const squad = spawnHitSquad(x, z);
    for (const h of squad) h.state = 'ambush';
    ambushCooldown = 90;
  }

  function raidLocation() {
    const p = world.player.position;
    const squad = spawnHitSquad(p.x + 15, p.z + 10);
    for (const h of squad) h.state = 'chase';
    raidCooldown = 150;
    if (world.events) world.events.push({ type: 'toast', text: 'CARTEL RAID! Hitmen are raiding your location!' });
  }

  function update(dt) {
    ambushCooldown = Math.max(0, ambushCooldown - dt);
    raidCooldown = Math.max(0, raidCooldown - dt);
    world.cartelThreat = threat;

    // Threat 60+: hit squads ambush Rico on the road.
    if (threat >= 60 && ambushCooldown <= 0) ambushOnRoad();
    // Threat 80+: a hit squad raids his current location.
    if (threat >= 80 && raidCooldown <= 0) raidLocation();

    // Hitmen coordinate in pairs: one advances while the other holds fire.
    const alive = world.cartelHitmen.filter(h => h && h.health > 0);
    alive.forEach((h, i) => {
      const p = world.player.position;
      if (!p) return;
      const dx = p.x - h.position.x;
      const dz = p.z - h.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const advance = (Math.floor((world.elapsed || 0) / 3) % 2 === 0) === (i % 2 === 0);
      if (h.state === 'chase' && d > 14 && advance) {
        h.position.x += (dx / d) * 5.5 * dt;
        h.position.z += (dz / d) * 5.5 * dt;
      } else if (h.state === 'ambush' && d > 20) {
        h.position.x += (dx / d) * 6 * dt;
        h.position.z += (dz / d) * 6 * dt;
      }
      if (h.mesh) h.mesh.lookAt(p.x, h.position.y || 0.9, p.z);
    });

    // Slow decay: 1 per in-game hour with no cartel crime.
    const h = typeof world.hourOfDay === 'number' ? world.hourOfDay : lastHour;
    if (h !== lastHour) {
      lastHour = h;
      const hourLen = world.secondsPerHour || 60;
      if ((world.elapsed || 0) - lastCartelCrime >= hourLen) {
        threat = Math.max(0, threat - 1);
        world.cartelThreat = threat;
      }
    }
  }

  return {
    update, addThreat, dropThreat, spawnHitSquad, seizeShipment, surviveSiege,
    get threat() { return threat; },
  };
}
