// The Harbor War — missions 9-12 mechanics for Solmar City.
//
// After the Coral Takeover (mission 8) the Dourado gang makes one last
// play for the harbor, and Madame Coral sends Rico to end it. This
// module owns the three new mission mechanics; missions.js owns the
// mission flow (stages, markers, rewards) and calls in here:
//
//   * Escort (mission 9) — a Coral truck drives itself along a road
//     route from the freight yard to the marina. Rico must stay within
//     45 m of it; drifting past 60 m for 8 s straight loses the truck.
//   * Timed delivery (mission 10) — four harbour checkpoints in 150 s,
//     run at midnight. Each checkpoint is a glowing ring on the road.
//   * Takedown (mission 11) — three Dourado cars cruise the pier road.
//     Ram them (or shoot them from the car window is not possible, so
//     ram them) until each one's hull gives out.
//   * Finale (mission 12) — a rival squad at the pier plus a run to the
//     lighthouse; the squad part reuses the combat system's
//     spawnRivalSquad, the lighthouse run is a plain drive-to.
//
//   createHarborWar(world) -> { update, state, beginEscort,
//     escortStatus, beginDelivery, deliveryStatus, beginTakedown,
//     takedownStatus, abort, harborSpots }
// Status strings: 'idle' | 'running' | 'done' | 'failed'. Missions 9-12
// pay $4,000 + $4,500 + $5,500 + $6,000 = $20,000.
import * as THREE from 'three';
import { dist2XZ, headingToward, moveToward, turnToward } from './world.js';

export const HARBOR_REWARDS = [4000, 4500, 5500, 6000];
export const ESCORT_KEEP_DIST = 45; // metres: stay inside this of the truck
export const ESCORT_LOSE_DIST = 60; // metres: past this the timer starts
export const ESCORT_LOSE_SECONDS = 8;
export const ESCORT_TRUCK_SPEED = 12; // m/s, steady harbour-truck pace
export const ESCORT_TRUCK_HULL = 100; // hull points; the ambush rams it down
export const ESCORT_AMBUSH_WAYPOINT = 3; // the Dourado hit at the third turn
export const ESCORT_RAM_DAMAGE = 22; // hull lost per hard ram on the truck
export const DELIVERY_TIME = 150; // seconds for the four checkpoints
export const TAKEDOWN_HULL = 100; // hull points per Dourado car
export const TAKEDOWN_RAM_DAMAGE = 55; // hull lost per hard ram (per second of contact)

export const HARBOR_SPOTS = {
  yardGate: { x: -170, z: -232 },
  marinaGate: { x: 232, z: 160 },
  pierRoad: { x: 0, z: 290 },
  lighthouseRoad: { x: -232, z: 232 },
  deliveryDrops: [
    { x: -170, z: -232 },
    { x: -58, z: 116 },
    { x: 116, z: 232 },
    { x: 0, z: 290 },
  ],
  takedownCruise: [
    { x: -58, z: 264 },
    { x: 0, z: 290 },
    { x: 58, z: 264 },
  ],
};

const ESCORT_ROUTE = [
  { x: -174, z: -232 },
  { x: -174, z: 0 },
  { x: -174, z: 232 },
  { x: 0, z: 232 },
  { x: 174, z: 232 },
  { x: 232, z: 232 },
  { x: 232, z: 160 },
];

function makeRingMesh(color) {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 32), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.2;
  group.add(ring);
  const discMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5, 24), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.15;
  group.add(disc);
  group.visible = false;
  return { group, ringMat, discMat };
}

function makeTruckBeacon() {
  // A gold diamond floating over the escort truck so Rico can find it
  // in traffic at a glance.
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), mat);
  return diamond;
}

export function createHarborWar(world) {
  const state = {
    mode: 'idle', // 'escort' | 'delivery' | 'takedown' | 'idle'
    status: 'idle', // 'idle' | 'running' | 'done' | 'failed'
    failReason: '',
    escort: { truck: null, beacon: null, waypoint: 0, lostTimer: 0, dist: 0, hull: ESCORT_TRUCK_HULL, ambush: [], ambushed: false },
    delivery: { checkpoints: [], index: 0, timer: 0, rings: [] },
    takedown: { targets: [] }, // { car, hull, mesh }
  };

  function vehiclesSystem() {
    try {
      return (world.systems && world.systems.vehicles) || null;
    } catch {
      return null;
    }
  }

  function combatSystem() {
    try {
      return (world.systems && world.systems.combat) || null;
    } catch {
      return null;
    }
  }

  function announce(text) {
    try {
      if (world.hud) world.hud.showMessage(text);
    } catch {
      // Toast is cosmetic.
    }
  }

  function clearMeshes(list) {
    for (const item of list) {
      try {
        if (item && item.group) world.scene.remove(item.group);
        else if (item) world.scene.remove(item);
      } catch {
        // Already gone.
      }
    }
  }

  // --- escort -------------------------------------------------------------
  function beginEscort() {
    abort();
    const vehicles = vehiclesSystem();
    let truck = null;
    try {
      if (vehicles && typeof vehicles.spawnCar === 'function') {
        truck = vehicles.spawnCar('traffic', { x: ESCORT_ROUTE[0].x, z: ESCORT_ROUTE[0].z }, 0, 0x2a7a3a);
      }
    } catch {
      truck = null;
    }
    if (!truck) {
      // No vehicle system: the escort still runs as a virtual truck — a
      // marker the player follows — so the mission never soft-locks.
      truck = {
        pos: new THREE.Vector3(ESCORT_ROUTE[0].x, 0, ESCORT_ROUTE[0].z),
        heading: 0,
        speed: 0,
        virtual: true,
      };
    }
    truck.ai = null; // traffic.js must not steer it; harborWar drives it
    truck.speed = 0;
    const beacon = makeTruckBeacon();
    beacon.position.set(truck.pos.x, 4.2, truck.pos.z);
    if (world.scene) world.scene.add(beacon);
    state.mode = 'escort';
    state.status = 'running';
    state.failReason = '';
    state.escort = { truck, beacon, waypoint: 1, lostTimer: 0, dist: 0, hull: ESCORT_TRUCK_HULL, ambush: [], ambushed: false };
    announce('Escort the Coral truck to the marina — stay close!');
    return true;
  }

  // The ambush: two Dourado cars waiting at the third turn of the route
  // (x -174, z 232). They steer straight at the truck and ram it; each
  // hard ram costs the truck hull. Rico can ram them off or let the
  // truck's hull ride it out — but a dead truck fails the mission.
  function spawnAmbush(truck) {
    const vehicles = vehiclesSystem();
    const rammers = [];
    const spots = [
      { x: -150, z: 232 },
      { x: -198, z: 232 },
    ];
    for (const spot of spots) {
      let car = null;
      try {
        if (vehicles && typeof vehicles.spawnCar === 'function') {
          car = vehicles.spawnCar('traffic', { x: spot.x, z: spot.z }, 0, 0x8a1a1a);
        }
      } catch {
        car = null;
      }
      if (!car) continue;
      car.ai = null;
      car.speed = 0;
      car.rammer = true;
      car.ramCooldown = 0;
      rammers.push(car);
    }
    state.escort.ambush = rammers;
    state.escort.ambushed = true;
    announce('Ambush! Dourado cars are ramming the truck — protect it!');
  }

  function updateAmbush(dt) {
    const esc = state.escort;
    const truck = esc.truck;
    if (!truck || esc.ambush.length === 0) return;
    for (const rammer of [...esc.ambush]) {
      if (!rammer.active) {
        esc.ambush.splice(esc.ambush.indexOf(rammer), 1);
        continue;
      }
      if (rammer.ramCooldown > 0) rammer.ramCooldown -= dt;
      // Steer at the truck and floor it.
      const want = headingToward(rammer.pos, truck.pos);
      rammer.heading = turnToward(rammer.heading, want, 3.0 * dt);
      rammer.speed = 24;
      // A hard ram: close, fast, and off cooldown — the truck loses hull.
      const d = dist2XZ(rammer.pos.x, rammer.pos.z, truck.pos.x, truck.pos.z);
      if (d < 4.5 && Math.abs(rammer.speed) > 10 && rammer.ramCooldown <= 0) {
        rammer.ramCooldown = 1.2;
        rammer.speed *= 0.4; // the ram costs the rammer its own speed
        esc.hull -= ESCORT_RAM_DAMAGE;
        announce(`The truck took a hit! Hull ${Math.max(0, esc.hull)}%.`);
        if (esc.hull <= 0) {
          state.status = 'failed';
          state.failReason = 'The truck was rammed apart — the cargo is gone';
          return;
        }
      }
    }
  }

  function updateEscort(dt) {
    const esc = state.escort;
    const truck = esc.truck;
    if (!truck) {
      state.status = 'failed';
      state.failReason = 'The truck is gone.';
      return;
    }
    // Drive the route waypoint by waypoint, along the roads.
    const target = ESCORT_ROUTE[esc.waypoint];
    if (target) {
      const want = headingToward(truck.pos, target);
      truck.heading = turnToward(truck.heading, want, 2.2 * dt);
      truck.speed = ESCORT_TRUCK_SPEED;
      if (dist2XZ(truck.pos.x, truck.pos.z, target.x, target.z) < 6) {
        esc.waypoint += 1;
        // The Dourado hit the convoy at the third turn: two rammers
        // waiting on the south road. Only once per escort.
        if (esc.waypoint === ESCORT_AMBUSH_WAYPOINT && !esc.ambushed) spawnAmbush(truck);
      }
    } else {
      truck.speed = 0;
    }
    // The vehicles system moves real cars from heading + speed; a
    // virtual truck (no vehicle system) moves here instead.
    if (truck.virtual) moveToward(truck.pos, target || truck.pos, ESCORT_TRUCK_SPEED, dt);
    if (esc.beacon) {
      esc.beacon.position.set(truck.pos.x, 4.2 + Math.sin((world.time || 0) * 3) * 0.3, truck.pos.z);
      esc.beacon.rotation.y += dt * 2;
    }
    // Proximity: too far for too long loses the truck.
    const pp = world.player ? world.player.pos : { x: 0, z: 0 };
    esc.dist = dist2XZ(pp.x, pp.z, truck.pos.x, truck.pos.z);
    if (esc.dist > ESCORT_LOSE_DIST) {
      esc.lostTimer += dt;
      if (esc.lostTimer >= ESCORT_LOSE_SECONDS) {
        state.status = 'failed';
        state.failReason = 'You lost the truck — the Dourado got to it first';
        return;
      }
    } else {
      esc.lostTimer = 0;
    }
    if (!target && truck.speed === 0) {
      state.status = 'done';
      announce('Truck delivered — the marina is Coral\'s again.');
    }
    // The ambush rammers chase the truck from the third turn on.
    if (esc.ambushed) updateAmbush(dt);
  }

  function escortStatus() {
    return state.mode === 'escort' ? state.status : 'idle';
  }

  // --- timed delivery -------------------------------------------------------
  function beginDelivery() {
    abort();
    const rings = [];
    for (const spot of HARBOR_SPOTS.deliveryDrops) {
      const ring = makeRingMesh(0x4dc3ff);
      ring.group.position.set(spot.x, 0, spot.z);
      ring.group.visible = false;
      if (world.scene) world.scene.add(ring.group);
      rings.push(ring);
    }
    if (rings[0]) rings[0].group.visible = true;
    state.mode = 'delivery';
    state.status = 'running';
    state.failReason = '';
    state.delivery = {
      checkpoints: [...HARBOR_SPOTS.deliveryDrops],
      index: 0,
      timer: DELIVERY_TIME,
      rings,
    };
    announce('Midnight Delivery — 4 drops in 150 seconds!');
    return true;
  }

  function updateDelivery(dt) {
    const del = state.delivery;
    del.timer -= dt;
    if (del.timer <= 0) {
      state.status = 'failed';
      state.failReason = 'Time\'s up — the harbour drops went cold';
      return;
    }
    const spot = del.checkpoints[del.index];
    if (!spot) {
      state.status = 'done';
      return;
    }
    const pp = world.player ? world.player.pos : { x: 0, z: 0 };
    if (dist2XZ(pp.x, pp.z, spot.x, spot.z) <= 10) {
      if (del.rings[del.index]) del.rings[del.index].group.visible = false;
      del.index += 1;
      if (del.index >= del.checkpoints.length) {
        state.status = 'done';
        announce('All four drops delivered — clean run!');
        return;
      }
      if (del.rings[del.index]) del.rings[del.index].group.visible = true;
      announce(`Drop ${del.index + 1} of 4 — keep moving!`);
    }
    // Pulse the live ring so it reads from across the harbour.
    const live = del.rings[del.index];
    if (live) {
      const pulse = 0.6 + 0.4 * Math.sin((world.time || 0) * 5);
      live.ringMat.opacity = 0.55 + 0.35 * pulse;
    }
  }

  function deliveryStatus() {
    return state.mode === 'delivery' ? state.status : 'idle';
  }

  // --- takedown -------------------------------------------------------------
  function beginTakedown() {
    abort();
    const vehicles = vehiclesSystem();
    const targets = [];
    for (const spot of HARBOR_SPOTS.takedownCruise) {
      let car = null;
      try {
        if (vehicles && typeof vehicles.spawnCar === 'function') {
          car = vehicles.spawnCar('traffic', { x: spot.x, z: spot.z }, Math.PI / 2, 0x8a1a1a);
        }
      } catch {
        car = null;
      }
      if (!car) continue;
      car.ai = null;
      car.speed = 9;
      car.takedown = true;
      targets.push({ car, hull: TAKEDOWN_HULL });
    }
    if (targets.length === 0) {
      // No vehicle system: nothing to ram, so the leg is already done.
      state.mode = 'takedown';
      state.status = 'done';
      return true;
    }
    state.mode = 'takedown';
    state.status = 'running';
    state.failReason = '';
    state.takedown = { targets };
    announce('Take down the three Dourado cars on the pier road — ram them!');
    return true;
  }

  function updateTakedown(dt) {
    const tk = state.takedown;
    const playerCar = world.player ? world.player.car : null;
    const combat = combatSystem();
    for (const target of [...tk.targets]) {
      const car = target.car;
      if (!car.active) {
        tk.targets.splice(tk.targets.indexOf(target), 1);
        continue;
      }
      // Cruise the pier road back and forth: turn around at the ends.
      if (car.pos.z > 300 || car.pos.z < 250) {
        car.heading = car.heading > 0 ? -Math.PI / 2 : Math.PI / 2;
        car.pos.z = Math.max(250, Math.min(300, car.pos.z));
      }
      car.speed = 9;
      // A hard ram from the player's car shreds hull; so does a bullet
      // (the combat system only shoots on foot, so rams do the work).
      if (playerCar && !world.player.onFoot) {
        const d = dist2XZ(playerCar.pos.x, playerCar.pos.z, car.pos.x, car.pos.z);
        const closing = Math.abs(playerCar.speed || 0);
        if (d < 4.2 && closing > 6) {
          target.hull -= TAKEDOWN_RAM_DAMAGE * dt * (closing / 10);
          if (target.hull <= 0) {
            // The car gives out: stop it dead and smoke it out of the run.
            car.speed = 0;
            car.active = false;
            try {
              if (car.mesh) world.scene.remove(car.mesh);
              const i = (world.cars || []).indexOf(car);
              if (i >= 0) world.cars.splice(i, 1);
            } catch {
              // Removal is best-effort.
            }
            tk.targets.splice(tk.targets.indexOf(target), 1);
            announce(`Dourado car down — ${tk.targets.length} left!`);
            continue;
          }
        }
      }
      // Hull also drops when a rival is shot (combat tracks enemies, not
      // cars — this hook lets a future combat change feed in).
      void combat;
    }
    if (tk.targets.length === 0) {
      state.status = 'done';
      announce('Pier road clear — the Dourado are running scared.');
    }
  }

  function takedownStatus() {
    return state.mode === 'takedown' ? state.status : 'idle';
  }

  function takedownsLeft() {
    if (state.mode !== 'takedown') return 0;
    return state.takedown.targets.length;
  }

  // --- lifecycle ------------------------------------------------------------
  function abort() {
    if (state.escort.truck) {
      try {
        const truck = state.escort.truck;
        if (!truck.virtual && truck.mesh) world.scene.remove(truck.mesh);
        if (!truck.virtual) {
          const i = (world.cars || []).indexOf(truck);
          if (i >= 0) world.cars.splice(i, 1);
        }
      } catch {
        // Cleanup is best-effort.
      }
    }
    if (state.escort.beacon) {
      try {
        world.scene.remove(state.escort.beacon);
      } catch {
        // Already gone.
      }
    }
    clearMeshes(state.delivery.rings.map((r) => r.group));
    // Takedown cars stay where they died; live ones are parked, not deleted,
    // so a failed mission leaves the harbour looking lived-in.
    state.mode = 'idle';
    state.status = 'idle';
    state.failReason = '';
    state.escort = { truck: null, beacon: null, waypoint: 0, lostTimer: 0, dist: 0, hull: ESCORT_TRUCK_HULL, ambush: [], ambushed: false };
    state.delivery = { checkpoints: [], index: 0, timer: 0, rings: [] };
    state.takedown = { targets: [] };
  }

  function update(dt) {
    if (world.mode !== 'play') return;
    if (state.mode === 'escort' && state.status === 'running') updateEscort(dt);
    else if (state.mode === 'delivery' && state.status === 'running') updateDelivery(dt);
    else if (state.mode === 'takedown' && state.status === 'running') updateTakedown(dt);
  }

  return {
    update,
    state,
    beginEscort,
    escortStatus,
    beginDelivery,
    deliveryStatus,
    beginTakedown,
    takedownStatus,
    takedownsLeft,
    abort,
    harborSpots: HARBOR_SPOTS,
  };
}
