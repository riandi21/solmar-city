// shots.js — Solmar City staged captures. Four shots, each one simulated
// forward from a fixed seed with scripted inputs through the REAL game,
// then POSED (subject + camera set explicitly), re-rendered and photographed
// so the frame is the staged shot, not the spawn-point view:
//   1-chase  — jet ski pursuit in the marina at sunset (crew beside Rico)
//   2-drive  — Lowrider with hydraulics bouncing through Sunset Beach at dusk
//   3-foot   — on foot at the Surf Shack, fishing rod in hand, cartel bar up
//   4-mission — M44 finale at the airfield: boss plane, seaplane, Kingpin beacon
// Staging rules: the subject is always clearly visible, the rider figure sits
// ON the jet ski, no palm tree blocks the 1-chase camera, the rod is in the
// player's hand with pedestrians and traffic in frame, and the "Kingpin of
// Solmar" beacon (cylinder + beam) is in frame for 4-mission.
// NOTE: the wanted stars, minimap, objective and cartel bar are DOM HUD —
// they are set live by staging (wanted, objective, threat) but a canvas
// capture cannot contain DOM, so they do not appear in the JPEG itself.
// Output: 1280x720 JPEG, quality ~0.8, each at most 256 KiB.

import * as THREE from 'three';

const SHOT_DEFS = [
  { id: '1-chase', name: '1-chase.jpg', seed: 1601, seconds: 6, vehicle: 'jetski', wanted: 2, crew: true, time: 17.6, place: 'marina' },
  { id: '2-drive', name: '2-drive.jpg', seed: 1602, seconds: 6, vehicle: 'lowrider', hydraulics: true, time: 18.8, place: 'sunsetbeach' },
  { id: '3-foot', name: '3-foot.jpg', seed: 1603, seconds: 5, vehicle: null, fishing: true, cartel: 62, time: 15.2, place: 'surfshack' },
  { id: '4-mission', name: '4-mission.jpg', seed: 1604, seconds: 8, vehicle: 'seaplane', mission: 'M44', time: 19.4, place: 'airfield' },
];

// Staging spots, chosen against the real map geometry:
// - marina pier deck is at (295,168) with the yacht at (305,175); the water
//   there is open sea, no palms nearby, sunset to the north-west.
// - Surf Shack hut + Sunset pier are at (-180,300); road x=-174 runs past.
// - The only real runway is the islands airstrip (strip centre 352,348,
//   top y≈2.25, island surface y≈2.1); M44's own coords are open sea.
const SPOTS = {
  marina: { x: 298, z: 195, heading: 0.9 },
  sunsetbeach: { x: -40, z: 330, heading: 1.57 },
  surfshack: { x: -205, z: 320, heading: -0.90 },
  airfield: { x: 348, z: 318, heading: -2.85, y: 2.1 },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small person figure (same build as the player/crew meshes) for staging.
function makePersonMesh(shirtColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x263238 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), shirt);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.85;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), pants);
  legL.position.set(-0.16, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), shirt);
  armL.position.set(-0.45, 1.15, 0);
  const armR = armL.clone();
  armR.position.x = 0.45;
  group.add(body, head, legL, legR, armL, armR);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

export function createShots(world) {
  const results = {};
  let ready = false;
  let paints = 0;
  // Staging props, built once and toggled per shot.
  let beacon = null;      // gold cylinder + light beam, 4-mission only
  let bossPlane = null;   // dark cartel plane prop on the runway, 4-mission only
  let crewRiders = [];    // { mesh, ski } — crew on jet skis, 1-chase only
  let rod = null;         // fishing rod, child of the player mesh, 3-foot only
  let stagedCars = [];    // parked cars by the Surf Shack road, 3-foot only
  let stagedSki = null;   // Rico's jet ski, 1-chase only

  function getBeacon() {
    if (beacon) return beacon;
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffb300, emissiveIntensity: 1.4 });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 8, 12), gold);
    cyl.position.y = 4;
    g.add(cyl);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 46, 12, 1, true), beamMat);
    beam.position.y = 8 + 23;
    g.add(beam);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    tip.position.y = 8.4;
    g.add(tip);
    world.scene.add(g);
    beacon = g;
    return g;
  }

  function getBossPlane() {
    if (bossPlane) return bossPlane;
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5, metalness: 0.2 });
    const red = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 7, 10), dark);
    body.rotation.x = Math.PI / 2;
    body.position.y = 1.0;
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 6.4), red);
    stripe.position.set(0.95, 1.0, 0);
    g.add(stripe);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 1.6), dark);
    wing.position.y = 1.3;
    g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.0), dark);
    tail.position.set(0, 1.4, -3.1);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 1.2), red);
    fin.position.set(0, 2.0, -3.1);
    g.add(fin);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    world.scene.add(g);
    bossPlane = g;
    return g;
  }

  function getRod() {
    if (rod) return rod;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 3.0, 6),
      new THREE.MeshLambertMaterial({ color: 0xc9a86a }),
    );
    pole.position.y = 1.5;
    g.add(pole);
    const reel = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.16),
      new THREE.MeshLambertMaterial({ color: 0x37474f }),
    );
    reel.position.set(0, 0.35, 0.12);
    g.add(reel);
    // Held diagonally forward from the right hand, tip well above the head.
    g.position.set(0.55, 1.0, 0.1);
    g.rotation.set(-0.7, 0, 0.35);
    rod = g;
    return g;
  }

  function hideStagingProps() {
    if (beacon) beacon.visible = false;
    if (bossPlane) bossPlane.visible = false;
    for (const c of crewRiders) { if (c.mesh) c.mesh.visible = false; if (c.ski && c.ski.mesh) c.ski.mesh.visible = false; }
    if (rod && rod.parent) rod.parent.remove(rod);
  }

  function stageShot(def) {
    const rng = mulberry32(def.seed);
    const p = world.player || {};
    // Systems live in world.systemObjects (main.js wiring), not on world
    // directly — resolve them there first so staging actually applies.
    const sysObj = world.systemObjects || {};
    const dn = sysObj.daynight || world.daynight || {};
    const cartelSys = sysObj.cartel || null;
    const vehiclesSys = sysObj.vehicles || world.vehicles || {};
    const fish = world.fishing || {};
    const sys = world.systemObjects || {};
    hideStagingProps();
    // Sunset / dusk time of day per shot.
    if (dn.setTime) dn.setTime(def.time);
    else dn.time = def.time * 60;
    // Scripted inputs from the fixed seed: throttle + steer pattern.
    const keys = world.input && world.input.keys;
    if (keys) {
      keys.clear();
      keys.add('KeyW'); keys.add('W');
      if (rng() > 0.5) { keys.add('KeyA'); keys.add('A'); }
      if (def.hydraulics) { keys.add('KeyH'); keys.add('H'); }
    }
    // Place the player for this shot.
    const spot = SPOTS[def.place] || { x: 0, z: 0, heading: 0 };
    // Leave any vehicle behind first so on-foot shots really are on foot.
    p.currentCar = null; p.currentBike = null; p.currentBoat = null;
    p.currentJetSki = null; p.currentSeaplane = null; p.currentHeli = null;
    p.onFoot = true;
    if (p.position) { p.position.x = spot.x; p.position.y = spot.y || 0; p.position.z = spot.z; }
    p.x = spot.x; p.z = spot.z; p.heading = spot.heading;
    p.vehicle = def.vehicle || null;
    p.jetski = def.vehicle === 'jetski';
    p.fishingRod = !!def.fishing;
    p.rodInHand = !!def.fishing;
    if (p.mesh) { p.mesh.visible = true; p.mesh.position.copy(p.position); p.mesh.rotation.y = spot.heading; }
    if (def.wanted) p.wanted = def.wanted;
    if (def.fishing) { fish.active = true; fish.state = 'casting'; }
    if (def.cartel != null && cartelSys && typeof cartelSys.addThreat === 'function') {
      // threat is getter-only on the cartel system: reach the target by delta.
      cartelSys.addThreat(def.cartel - (cartelSys.threat || 0));
    }
    if (def.mission) {
      const m = world.missions || {};
      m.current = 'M44 — Kingpin of Solmar: stop the boss plane';
      m.marker = { x: spot.x + 60, z: spot.z };
      if (world.hud && world.hud.setObjective) world.hud.setObjective('M44 — Kingpin of Solmar: stop the boss plane, take the seaplane');
    }
    if (def.id === '1-chase' && sys.jetski) {
      // Rico's jet ski, right under him, plus two crew skis flanking him.
      stagedSki = sys.jetski.spawnJetSki(spot.x, spot.z);
      sys.jetski.enterJetSki(stagedSki);
      stagedSki.heading = spot.heading;
      if (!crewRiders.length) {
        for (const color of [0x8e24aa, 0x1565c0]) {
          const mesh = makePersonMesh(color);
          world.scene.add(mesh);
          const ski = sys.jetski.spawnJetSki(spot.x, spot.z);
          crewRiders.push({ mesh, ski });
        }
      }
      for (const c of crewRiders) { c.mesh.visible = true; if (c.ski && c.ski.mesh) c.ski.mesh.visible = true; }
    }
    if (def.id === '2-drive' && sys.vehicles) {
      const car = sys.vehicles.spawnCar('lowrider', spot.x, spot.z);
      car.heading = spot.heading;
      sys.vehicles.enterCar(car);
      if (sys.vehicles && world.player.currentCar) world.player.currentCar.bounce = 1;
    }
    if (def.id === '3-foot') {
      // Rod in the player's hand.
      if (p.mesh) p.mesh.add(getRod());
      // Pedestrians onto the sidewalk by the Surf Shack road (x=-174),
      // in front of the player so they are in frame.
      const peds = world.pedestrians || [];
      const pedSpots = [
        { x: -205, z: 327 }, { x: -211, z: 319 }, { x: -209, z: 326 }, { x: -212, z: 323 },
      ];
      for (let i = 0; i < Math.min(peds.length, pedSpots.length); i++) {
        peds[i].position.set(pedSpots[i].x, 0, pedSpots[i].z);
        if (peds[i].mesh) { peds[i].mesh.position.copy(peds[i].position); peds[i].mesh.rotation.y = rng() * Math.PI * 2; }
      }
      // Parked cars on the road by the shack (real game cars, standing),
      // plus a yellow taxi at the road's south end, in the clear sightline.
      if (sys.vehicles && !stagedCars.length) {
        stagedCars.push(sys.vehicles.spawnCar('sedan', -174, 298));
        stagedCars.push(sys.vehicles.spawnCar('sedan', -174, 308));
        stagedCars.push(sys.vehicles.spawnCar('taxi', -176, 326));
        stagedCars[0].heading = 0; stagedCars[1].heading = Math.PI; stagedCars[2].heading = 0;
      }
      for (const c of stagedCars) { if (c.mesh) c.mesh.visible = true; }
    }
    if (def.id === '4-mission') {
      // Kingpin beacon on the airstrip approach, boss plane on the strip,
      // the real seaplane waiting on the water just off the island.
      const b = getBeacon();
      b.position.set(358, 2.25, 338);
      b.visible = true;
      const bp = getBossPlane();
      bp.position.set(356, 2.25, 362);
      bp.rotation.y = 0.35;
      bp.visible = true;
      const sp = world.seaplane;
      if (sp && sp.position) {
        sp.position.set(388, 0.4, 352);
        sp.heading = 2.6;
        if (sp.mesh) sp.mesh.rotation.y = 2.6;
      }
      if (p.mesh) { p.mesh.visible = true; }
    }
    if (def.hydraulics && vehiclesSys && vehiclesSys.bounce) vehiclesSys.bounce();
    return def;
  }

  function simulate(def) {
    // Run the real game forward with the scripted inputs.
    const steps = Math.round(def.seconds * 60);
    const systems = world.systems || [];
    for (let i = 0; i < steps; i++) {
      for (const s of systems) {
        if (s && typeof s.update === 'function' && s.name !== 'shots') s.update(1 / 60);
      }
    }
  }

  // After the simulation, put the subject exactly where the shot needs it
  // and point the follow camera at it — the sim moves things, the pose
  // is what the photograph shows. Then re-render before the snap.
  function poseShot(def, renderer) {
    const p = world.player || {};
    const spot = SPOTS[def.place] || { x: 0, z: 0, heading: 0 };
    const cam = world.camera;
    let subject = p.position || { x: spot.x, y: spot.y || 0, z: spot.z };
    let heading = spot.heading;
    let groundY = spot.y || 0;
    if (def.id === '1-chase') {
      // Rider ON the jet ski, crew flanking on theirs, pier + yacht ahead.
      const ski = (p.currentJetSki || stagedSki);
      if (ski && ski.position) {
        ski.position.set(spot.x, 0.2, spot.z);
        ski.heading = spot.heading;
        if (ski.mesh) { ski.mesh.position.set(spot.x, 0.2, spot.z); ski.mesh.rotation.y = spot.heading; }
        subject = ski.position;
      }
      if (p.mesh) {
        p.mesh.visible = true;
        p.mesh.position.set(spot.x, 0.55, spot.z);
        p.mesh.rotation.y = spot.heading;
      }
      if (p.position) p.position.set(spot.x, 0, spot.z);
      p.heading = spot.heading;
      const fwd = { x: Math.sin(spot.heading), z: Math.cos(spot.heading) };
      const right = { x: Math.cos(spot.heading), z: -Math.sin(spot.heading) };
      crewRiders.forEach((c, i) => {
        const side = i === 0 ? -1 : 1;
        const cx = spot.x + right.x * 4.5 * side - fwd.x * 3;
        const cz = spot.z + right.z * 4.5 * side - fwd.z * 3;
        if (c.ski && c.ski.position) {
          c.ski.position.set(cx, 0.2, cz);
          c.ski.heading = spot.heading;
          if (c.ski.mesh) { c.ski.mesh.position.set(cx, 0.2, cz); c.ski.mesh.rotation.y = spot.heading; }
        }
        if (c.mesh) {
          c.mesh.visible = true;
          c.mesh.position.set(cx, 0.55, cz);
          c.mesh.rotation.y = spot.heading;
        }
      });
    } else if (def.id === '2-drive') {
      const car = p.currentCar;
      if (car && car.position) {
        car.position.set(spot.x, 0, spot.z);
        car.heading = spot.heading;
        car.bounce = 0.5; // mid-bounce: body visibly lifted
        if (car.mesh) {
          car.mesh.position.set(spot.x, Math.sin(0.5 * Math.PI) * 0.35, spot.z);
          car.mesh.rotation.y = spot.heading;
        }
        subject = car.position;
      }
      if (p.position) p.position.copy(subject);
      p.heading = spot.heading;
    } else if (def.id === '3-foot') {
      if (p.position) p.position.set(spot.x, 0, spot.z);
      p.heading = spot.heading;
      if (p.mesh) {
        p.mesh.visible = true;
        p.mesh.position.set(spot.x, 0, spot.z);
        p.mesh.rotation.y = spot.heading;
      }
      // Pedestrians back in front of the player after their simulated walk.
      const peds = world.pedestrians || [];
      const pedSpots = [
        { x: -205, z: 327 }, { x: -211, z: 319 }, { x: -209, z: 326 }, { x: -212, z: 323 },
      ];
      for (let i = 0; i < Math.min(peds.length, pedSpots.length); i++) {
        peds[i].position.set(pedSpots[i].x, 0, pedSpots[i].z);
        if (peds[i].mesh) { peds[i].mesh.position.copy(peds[i].position); }
      }
      subject = p.position;
    } else if (def.id === '4-mission') {
      if (p.position) p.position.set(spot.x, groundY, spot.z);
      p.heading = spot.heading;
      if (p.mesh) {
        p.mesh.visible = true;
        p.mesh.position.set(spot.x, groundY, spot.z);
        p.mesh.rotation.y = spot.heading;
      }
      subject = p.position;
    }
    // Follow camera: 10m back, 6m up, same math as the main loop
    // (13m/7m for the chase, so the pier and sunset fit around the skis;
    // 12m/8m for the finale, looking down the runway;
    // 14m/9m on foot, so the shack, peds and road all fit).
    if (cam && subject) {
      const dist = def.id === '1-chase' ? 13 : def.id === '4-mission' ? 12 : def.id === '3-foot' ? 14 : 10;
      const height = def.id === '1-chase' ? 7 : def.id === '4-mission' ? 8 : def.id === '3-foot' ? 9 : 6;
      const sx = subject.x || 0;
      const sy = subject.y || 0;
      const sz = subject.z || 0;
      cam.position.set(
        sx + Math.sin(heading) * dist,
        sy + height,
        sz + Math.cos(heading) * dist,
      );
      cam.lookAt(sx, sy + 1.5, sz);
    }
    // Debug hook for the capture harness: where the camera/subject ended up
    // and whether the staging props are in the scene and visible.
    try {
      window.__shotDebug = {
        id: def.id,
        camera: cam ? [cam.position.x, cam.position.y, cam.position.z] : null,
        subject: subject ? [subject.x || 0, subject.y || 0, subject.z || 0] : null,
        beacon: beacon ? { visible: beacon.visible, pos: [beacon.position.x, beacon.position.y, beacon.position.z] } : null,
        bossPlane: bossPlane ? { visible: bossPlane.visible, pos: [bossPlane.position.x, bossPlane.position.y, bossPlane.position.z] } : null,
        seaplane: world.seaplane && world.seaplane.position
          ? [world.seaplane.position.x, world.seaplane.position.y, world.seaplane.position.z] : null,
        peds: (world.pedestrians || []).slice(0, 4).map((q) => [Math.round(q.position.x), Math.round(q.position.z)]),
        stagedCars: stagedCars.map((c) => [Math.round(c.position.x), Math.round(c.position.z)]),
      };
    } catch (e) { void e; }
    if (renderer && typeof renderer.render === 'function') renderer.render();
  }

  function snap(renderer, def) {
    const canvas = renderer && renderer.domElement;
    if (!canvas) return null;
    // Two paints before the capture counts as ready.
    paints = 0;
    let dataUrl = null;
    const tryQuality = (q) => {
      try {
        const c = document.createElement('canvas');
        c.width = 1280; c.height = 720;
        const g = c.getContext('2d');
        g.drawImage(canvas, 0, 0, 1280, 720);
        return c.toDataURL('image/jpeg', q);
      } catch (e) { return null; }
    };
    dataUrl = tryQuality(0.8);
    if (!dataUrl) return null;
    let bytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
    let q = 0.8;
    while (bytes > 256 * 1024 && q > 0.3) { q -= 0.1; dataUrl = tryQuality(q); if (!dataUrl) break; bytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4); }
    return { name: def.name, id: def.id, dataUrl, bytes, quality: q, width: 1280, height: 720, stagedAt: new Date().toISOString() };
  }

  function getShot(id) { return results[id] || null; }

  function captureAll(renderer) {
    for (const def of SHOT_DEFS) {
      stageShot(def);
      simulate(def);
      poseShot(def, renderer);
      const shot = snap(renderer, def);
      if (shot) results[def.id] = shot;
    }
    ready = true;
    return results;
  }

  function captureOne(id, renderer) {
    const def = SHOT_DEFS.find((d) => d.id === id);
    if (!def) return null;
    stageShot(def);
    simulate(def);
    poseShot(def, renderer);
    const shot = snap(renderer, def);
    if (shot) results[def.id] = shot;
    return shot;
  }

  function update(dt) {
    void dt;
    paints++;
    if (paints >= 2 && !ready && world.shots && world.shots.auto) {
      // Auto-run only when the page asked for shots (?shot=... handled in main).
    }
  }

  const sys = {
    name: 'shots',
    update,
    captureAll,
    captureOne,
    getShot,
    stageShot,
    simulate,
    defs: SHOT_DEFS,
    get results() { return results; },
    get ready() { return ready; },
    get paints() { return paints; },
  };
  return sys;
}
