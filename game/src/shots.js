// Staged screenshot captures for Solmar City.
// Reads ?shot=chase|drive|foot|mission and ?seed= from the page URL.
// Each shot arranges the real game state (player, police, mission,
// bike, marker) from a fixed seed, steers it forward with scripted
// inputs for a couple of frames, then reports ready after two paints
// through world.shotReady, window.__shotReady and a body data flag,
// so the capture tool knows the frame is settled.
export function createShots(world) {
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot') || '';
  const seedValue = parseInt(params.get('seed') || '1', 10) || 1;
  const SHOTS = ['chase', 'drive', 'foot', 'mission'];
  const active = SHOTS.includes(shotName) ? shotName : null;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function placePlayer(x, z, heading, speed) {
    const player = world.player;
    if (!player) return;
    if (player.position && player.position.set) {
      player.position.set(x, 0, z);
    } else {
      player.position = { x, y: 0, z };
    }
    player.heading = heading;
    player.speed = speed;
    if (player.mesh && player.mesh.position && player.mesh.position.set) {
      player.mesh.position.set(x, 0, z);
    }
    if (player.mesh) player.mesh.rotation.y = heading;
  }

  function nearPolice(count, px, pz, heading) {
    const cars = world.cars || [];
    let placed = 0;
    for (const car of cars) {
      if (placed >= count) break;
      if (car.kind !== 'police') continue;
      const back = 18 + placed * 10;
      const side = (placed % 2 === 0 ? -1 : 1) * 6;
      const x = px - Math.sin(heading) * back + Math.cos(heading) * side;
      const z = pz - Math.cos(heading) * back - Math.sin(heading) * side;
      if (car.position && car.position.set) car.position.set(x, 0, z);
      else car.position = { x, y: 0, z };
      car.heading = heading;
      car.speed = 14 + placed * 2;
      if (car.mesh && car.mesh.position && car.mesh.position.set) car.mesh.position.set(x, 0, z);
      placed += 1;
    }
  }

  function nearTraffic(count, px, pz) {
    const cars = world.cars || [];
    const rng = mulberry32(seedValue + 77);
    let placed = 0;
    for (const car of cars) {
      if (placed >= count) break;
      if (car.kind === 'police' || car.kind === 'player') continue;
      const x = px + (rng() - 0.5) * 120;
      const z = pz + (rng() - 0.5) * 120;
      if (car.position && car.position.set) car.position.set(x, 0, z);
      else car.position = { x, y: 0, z };
      car.heading = rng() * Math.PI * 2;
      car.speed = 6 + rng() * 6;
      placed += 1;
    }
  }

  function stageChase() {
    world.mode = 'play';
    world.wanted = 3;
    world.cash = 2450;
    if (world.player) world.player.cash = 2450;
    world.mission = {
      id: 3,
      stage: 1,
      objective: 'Survive a 3-star wanted level for 60 seconds — lose the cops!',
      marker: { x: 58, z: 29 },
      timer: 42,
    };
    const player = world.player;
    if (player) {
      const car = (world.cars || []).find((c) => c.kind === 'player');
      if (car) {
        player.car = car;
        player.onFoot = false;
      }
      placePlayer(0, 116, Math.PI, 16);
    }
    nearPolice(3, 0, 116, Math.PI);
    nearTraffic(5, 0, 116);
    pressKeys(['KeyW']);
  }

  function stageDrive() {
    world.mode = 'play';
    world.wanted = 0;
    world.cash = 1850;
    if (world.player) world.player.cash = 1850;
    world.mission = {
      id: 0,
      stage: 0,
      objective: 'Street race: thread the Docks container rows to the finish line.',
      marker: { x: -180, z: -180 },
      timer: 0,
    };
    const player = world.player;
    if (player) {
      const bike = (world.bikes || [])[0] || null;
      if (bike) {
        player.bike = bike;
        player.onFoot = false;
      }
      placePlayer(-232, -232, Math.PI * 0.75, 17);
      player.wheelie = true;
    }
    nearTraffic(3, -215, -215);
    pressKeys(['KeyW', 'ShiftLeft']);
  }

  function stageFoot() {
    world.mode = 'play';
    world.wanted = 0;
    world.cash = 1200;
    if (world.player) world.player.cash = 1200;
    world.mission = {
      id: 1,
      stage: 1,
      objective: 'Steal a car and drive to the Coral Club marker.',
      marker: { x: 58, z: 29 },
      timer: 0,
    };
    placePlayer(-29, 58, Math.PI / 2, 3);
    const player = world.player;
    if (player) {
      player.onFoot = true;
      player.car = null;
      player.bike = null;
    }
    nearTraffic(6, -29, 58);
    const peds = world.peds || world.pedestrians || [];
    const rng = mulberry32(seedValue + 31);
    for (let i = 0; i < peds.length && i < 8; i += 1) {
      const ped = peds[i];
      const x = -29 + (rng() - 0.5) * 70;
      const z = 58 + (rng() - 0.5) * 70;
      if (ped.position && ped.position.set) ped.position.set(x, 0, z);
      else ped.position = { x, y: 0, z };
    }
    pressKeys(['KeyW']);
  }

  function stageMission() {
    world.mode = 'play';
    world.wanted = 2;
    world.cash = 5300;
    if (world.player) world.player.cash = 5300;
    world.mission = {
      id: 22,
      stage: 2,
      objective: 'M22 The Warehouse: defeat 4 guards, steal the ledger, escape on the bike.',
      marker: { x: -170, z: -260 },
      timer: 0,
    };
    world.revenge = {
      active: true,
      courierTailed: true,
      ledgerStolen: false,
      convoyStopped: false,
      donDefeated: false,
      guardsLeft: 4,
    };
    placePlayer(-186, -238, Math.PI, 2);
    const player = world.player;
    if (player) {
      player.onFoot = true;
      player.car = null;
      player.bike = null;
    }
    const bikes = world.bikes || [];
    if (bikes.length > 0) {
      const bike = bikes[0];
      if (bike.position && bike.position.set) bike.position.set(-178, 0, -232);
      else bike.position = { x: -178, y: 0, z: -232 };
      if (bike.mesh && bike.mesh.position && bike.mesh.position.set) bike.mesh.position.set(-178, 0, -232);
    }
    nearPolice(2, -186, -238, Math.PI);
    pressKeys(['KeyW']);
  }

  function pressKeys(codes) {
    const input = world.input;
    if (!input || !input.keys) return;
    for (const code of codes) input.keys.add(code);
  }

  function chaseCamera() {
    const camera = world.camera;
    const player = world.player;
    if (!camera || !player || !player.position) return;
    const heading = player.heading || 0;
    const dist = player.bike ? 9 : 12;
    const height = player.bike ? 4.5 : 5.5;
    const px = player.position.x;
    const pz = player.position.z;
    const cx = px - Math.sin(heading) * dist;
    const cz = pz - Math.cos(heading) * dist;
    if (camera.position && camera.position.set) camera.position.set(cx, height, cz);
    if (camera.lookAt) camera.lookAt(px, 1.5, pz);
  }

  const shots = {
    name: active,
    staged: false,
    frames: 0,
    ready: false,
    update() {
      if (!active) return;
      if (!shots.staged) {
        if (shotName === 'chase') stageChase();
        else if (shotName === 'drive') stageDrive();
        else if (shotName === 'foot') stageFoot();
        else if (shotName === 'mission') stageMission();
        shots.staged = true;
        world.shotName = shotName;
      }
      chaseCamera();
      shots.frames += 1;
      if (shots.frames >= 2 && !shots.ready) {
        shots.ready = true;
        world.shotReady = true;
        window.__shotReady = true;
        document.body.dataset.shotReady = 'true';
        document.title = 'Solmar City — shot ' + shotName;
        if (Array.isArray(world.events)) world.events.push({ type: 'shot-ready', shot: shotName });
      }
    },
  };

  world.shots = shots;
  return shots;
}
