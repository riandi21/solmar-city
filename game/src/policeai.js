import * as THREE from 'three';

// Police AI: flanking pursuit, roadblocks, spike strips, helicopter lead.
// Fresh implementation for Round 16. Works off world state only; never
// overwrites world fields with this system object.
export function createPoliceAI(world) {
  const cars = [];
  const strips = [];
  let heli = null;
  let heli2 = null;
  let roadblockTimer = 0;
  let stripTimer = 0;
  let spotlightTimer = 0;
  let tireDamage = 0; // 0..1 handling penalty, cleared by repair/waiting
  let tireTimer = 0;

  function playerSpeed() {
    const p = world.player;
    if (!p || !p.velocity) return 0;
    return Math.hypot(p.velocity.x || 0, p.velocity.z || 0);
  }

  function playerHeading() {
    const p = world.player;
    if (!p || !p.velocity) return 0;
    return Math.atan2(p.velocity.x || 0, p.velocity.z || 0);
  }

  function isNight() {
    const h = world.hourOfDay;
    if (typeof h === 'number') return h < 6 || h >= 20;
    return false;
  }

  function nearestArmedAlly(pos) {
    let best = null;
    let bestD = Infinity;
    for (const m of world.crew || []) {
      if (!m || !m.position || m.health <= 0) continue;
      const d = Math.hypot(m.position.x - pos.x, m.position.z - pos.z);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  function spawnCar(angle) {
    const p = world.player.position;
    const d = 55 + Math.random() * 25;
    const x = p.x + Math.sin(angle) * d;
    const z = p.z + Math.cos(angle) * d;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.1, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x111827 })
    );
    mesh.position.set(x, 0.7, z);
    if (world.scene && world.scene.add) world.scene.add(mesh);
    const car = { mesh, position: mesh.position, speed: 0, angle, state: 'chase', target: null };
    cars.push(car);
    return car;
  }

  function spawnHeli(second) {
    const p = world.player.position;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x1f2937 })
    );
    mesh.position.set(p.x + 20, 42, p.z - 20);
    if (world.scene && world.scene.add) world.scene.add(mesh);
    const h = { mesh, position: mesh.position, second: !!second };
    if (second) heli2 = h; else heli = h;
    return h;
  }

  function dropSpikeStrip() {
    const p = world.player.position;
    const heading = playerHeading();
    const ahead = 18 + playerSpeed() * 0.6;
    const x = p.x + Math.sin(heading) * ahead;
    const z = p.z + Math.cos(heading) * ahead;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.15, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x6b7280 })
    );
    mesh.position.set(x, 0.1, z);
    mesh.rotation.y = heading;
    if (world.scene && world.scene.add) world.scene.add(mesh);
    strips.push({ mesh, position: mesh.position, life: 25 });
  }

  function formRoadblock() {
    // Two cars parked across the road ahead of the player's travel direction.
    const heading = playerHeading();
    const ahead = 30 + playerSpeed() * 0.8;
    const px = world.player.position.x + Math.sin(heading) * ahead;
    const pz = world.player.position.z + Math.cos(heading) * ahead;
    for (const side of [-1, 1]) {
      const ox = Math.cos(heading) * side * 3;
      const oz = -Math.sin(heading) * side * 3;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.1, 4.4),
        new THREE.MeshStandardMaterial({ color: 0x111827 })
      );
      mesh.position.set(px + ox, 0.7, pz + oz);
      mesh.rotation.y = heading + Math.PI / 2;
      if (world.scene && world.scene.add) world.scene.add(mesh);
      cars.push({ mesh, position: mesh.position, speed: 0, angle: 0, state: 'block', target: null });
    }
    if (world.events) world.events.push({ type: 'roadblock', x: px, z: pz });
  }

  function updateHeli(h, dt) {
    if (!h) return;
    const p = world.player.position;
    // Lead the target: aim where the player will be, not where they are.
    const lead = 0.9;
    const vx = (world.player.velocity && world.player.velocity.x) || 0;
    const vz = (world.player.velocity && world.player.velocity.z) || 0;
    const tx = p.x + vx * lead;
    const tz = p.z + vz * lead;
    const dx = tx - h.position.x;
    const dz = tz - h.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const spd = 26;
    h.position.x += (dx / d) * spd * dt;
    h.position.z += (dz / d) * spd * dt;
    h.position.y = 42 + Math.sin(world.elapsed * 0.7) * 1.5;
    h.mesh.lookAt(tx, 0, tz);
  }

  function update(dt) {
    const wanted = world.wanted || 0;
    const p = world.player;
    if (!p || !p.position) return;

    // Tire damage slowly heals if the player waits (no speed) or repairs.
    if (tireDamage > 0) {
      tireTimer += dt;
      if (playerSpeed() < 1 && tireTimer > 8) { tireDamage = Math.max(0, tireDamage - dt * 0.05); }
      if (world.player.repaired) { tireDamage = 0; world.player.repaired = false; }
    }

    // Wanted cleared: roadblock cars disperse instead of lingering forever.
    if (wanted === 0) {
      for (let i = cars.length - 1; i >= 0; i--) {
        if (cars[i].state === 'block') {
          if (world.scene && world.scene.remove) world.scene.remove(cars[i].mesh);
          cars.splice(i, 1);
        }
      }
    }

    // Desired pursuit size scales with wanted level.
    const wantCars = wanted === 0 ? 0 : Math.min(2 + wanted, 7);
    while (cars.filter(c => c.state === 'chase').length < wantCars && wanted > 0) {
      // Flank: new cars enter from different angles, not all from behind.
      const n = cars.length;
      const angle = playerHeading() + Math.PI + (n % 3 - 1) * (Math.PI / 2.2);
      spawnCar(angle);
    }
    while (cars.filter(c => c.state === 'chase').length > wantCars) {
      const c = cars.find(c => c.state === 'chase');
      if (!c) break;
      if (world.scene && world.scene.remove) world.scene.remove(c.mesh);
      cars.splice(cars.indexOf(c), 1);
    }

    // Helicopters: one from 3 stars, a second at 5 stars.
    if (wanted >= 3 && !heli) spawnHeli(false);
    if (wanted < 3 && heli) {
      if (world.scene && world.scene.remove) world.scene.remove(heli.mesh);
      heli = null;
    }
    if (wanted >= 5 && !heli2) spawnHeli(true);
    if (wanted < 5 && heli2) {
      if (world.scene && world.scene.remove) world.scene.remove(heli2.mesh);
      heli2 = null;
    }

    // Spike strips at 3+ stars, dropped ahead of the player.
    stripTimer += dt;
    if (wanted >= 3 && stripTimer > 14) {
      stripTimer = 0;
      dropSpikeStrip();
    }
    // Roadblocks form dynamically ahead of travel direction.
    roadblockTimer += dt;
    if (wanted >= 2 && roadblockTimer > 22 && playerSpeed() > 6) {
      roadblockTimer = 0;
      formRoadblock();
    }

    // Chase / flank steering: split cars to cut the player off from two sides.
    const heading = playerHeading();
    cars.forEach((car, i) => {
      if (car.state === 'block') return;
      // Half the cars aim ahead of the player (cut-off), half chase directly.
      const flank = i % 2 === 0;
      const leadDist = flank ? 10 + playerSpeed() * 0.7 : 0;
      const tx = p.x + Math.sin(heading) * leadDist;
      const tz = p.z + Math.cos(heading) * leadDist;
      const dx = tx - car.position.x;
      const dz = tz - car.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const top = 24 + wanted * 1.5;
      car.speed = Math.min(top, car.speed + 18 * dt);
      car.position.x += (dx / d) * car.speed * dt;
      car.position.z += (dz / d) * car.speed * dt;
      car.mesh.lookAt(tx, car.position.y, tz);
      // Bump / arrest pressure at close range.
      if (d < 3 && world.player.health > 0) {
        world.player.health = Math.max(0, world.player.health - 2 * dt);
      }
    });

    // Spike strip hits: cut speed + lasting tire damage.
    for (let i = strips.length - 1; i >= 0; i--) {
      const s = strips[i];
      s.life -= dt;
      const d = Math.hypot(s.position.x - p.x, s.position.z - p.z);
      if (d < 2.5) {
        if (world.player.velocity) {
          world.player.velocity.x *= 0.35;
          world.player.velocity.z *= 0.35;
        }
        tireDamage = Math.min(1, tireDamage + 0.4);
        tireTimer = 0;
        if (world.events) world.events.push({ type: 'spike-hit', tireDamage });
        if (world.scene && world.scene.remove) world.scene.remove(s.mesh);
        strips.splice(i, 1);
        continue;
      }
      if (s.life <= 0) {
        if (world.scene && world.scene.remove) world.scene.remove(s.mesh);
        strips.splice(i, 1);
      }
    }

    // Helicopter lead + spotlight. At night, being caught in it on foot
    // raises wanted faster.
    updateHeli(heli, dt);
    updateHeli(heli2, dt);
    if (heli && isNight()) {
      spotlightTimer += dt;
      const d = Math.hypot(heli.position.x - p.x, heli.position.z - p.z);
      const onFoot = !world.player.inVehicle;
      if (d < 14 && onFoot && spotlightTimer > 2) {
        spotlightTimer = 0;
        world.wanted = Math.min(5, (world.wanted || 0) + 0.2);
        if (world.events) world.events.push({ type: 'spotlight', wanted: world.wanted });
      }
    }

    // Police prioritize the player's crew in a fight: target nearest armed ally too.
    if (world.crew && world.crew.length) {
      for (const car of cars) {
        if (car.state !== 'chase') continue;
        const ally = nearestArmedAlly(car.position);
        if (ally) {
          const dAlly = Math.hypot(ally.position.x - car.position.x, ally.position.z - car.position.z);
          const dPlayer = Math.hypot(p.x - car.position.x, p.z - car.position.z);
          car.target = dAlly < dPlayer * 0.8 ? ally : null;
        }
      }
    }
  }

  return { update, get tireDamage() { return tireDamage; }, cars, strips };
}
