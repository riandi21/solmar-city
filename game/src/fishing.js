// Fishing — the calm mini-game at the Sunset Beach pier and the marina pier.
// Press E at a fishing spot to cast, wait for the bobber to dip, press E
// again to reel in. Catches: small fish $20, big fish $80, junk $0.
// The best catch is tracked in the kingpin state and shown on the HUD.
// Fishing is calm: no wanted gain, and it passes in-game time.
// Every entry in spots[] includes a bobber field (v10 fix).
// Factory: createFishing(scene, world) or createFishing(world).

export const FISHING_SPOTS = [
  { id: 'sunset', name: 'Sunset Beach Pier', x: -150, z: 320 },
  { id: 'marina', name: 'Marina Pier', x: 295, z: 168 },
  { id: 'islands', name: 'Islands Beach Bar', x: 370, z: 360 },
];

export const CATCH_VALUES = { small: 20, big: 80, junk: 0 };

function normalizeArgs(scene, world) {
  if (world === undefined || world === null) {
    if (scene && (typeof scene.cash === 'number' || scene.player || scene.kingpin)) return { scene: null, world: scene };
    return { scene: null, world: scene || {} };
  }
  return { scene, world };
}

function playerPos(world) {
  const p = world.player;
  if (!p) return null;
  if (p.position && typeof p.position.x === 'number') return { x: p.position.x, z: p.position.z || 0 };
  if (typeof p.x === 'number') return { x: p.x, z: p.z || 0 };
  return null;
}

function toast(world, text) {
  if (Array.isArray(world.events)) world.events.push({ type: 'toast', text });
  else if (typeof world.toast === 'function') world.toast(text);
  else if (Array.isArray(world.messages)) world.messages.push(text);
}

function keyDown(world, key) {
  const input = world.input;
  if (!input) return false;
  if (input.pressed && typeof input.pressed.has === 'function') return input.pressed.has(key);
  if (input.keys && typeof input.keys.has === 'function') return input.keys.has(key);
  if (input[key] === true) return true;
  return false;
}

function rngOf(world) {
  if (typeof world.rng === 'function') return world.rng;
  return Math.random;
}

export function createFishing(scene, world) {
  const args = normalizeArgs(scene, world);
  scene = args.scene;
  world = args.world;

  if (!world.kingpin) world.kingpin = {};
  if (typeof world.cash !== 'number') world.cash = 0;

  // Every spot carries its own bobber object — never a bare constant.
  const spots = FISHING_SPOTS.map((s) => ({
    id: s.id,
    name: s.name,
    x: s.x,
    z: s.z,
    bobber: { x: s.x, y: 0.4, z: s.z + 2, dipped: false, visible: false, dipTime: 0 },
  }));

  const state = {
    fishing: false,
    casting: false,
    waiting: false,
    bite: false,
    spot: null,
    biteTimer: 0,
    biteWindow: 0,
    bestCatch: world.kingpin.fishingBestCatch || null,
  };
  world.fishing = state;

  let prevE = false;

  function ownsSurfShack() {
    return !!(world.properties && world.properties.owned && world.properties.owned.surfshack);
  }

  function hasBetterRod() {
    // The Surf Shack sells a better rod: doubles big-fish odds.
    return ownsSurfShack();
  }

  function nearestSpot(pos, maxDist) {
    let best = null;
    let bestD = maxDist === undefined ? Infinity : maxDist;
    for (const spot of spots) {
      const d = Math.hypot(spot.x - pos.x, spot.z - pos.z);
      if (d < bestD) { bestD = d; best = spot; }
    }
    return best ? { spot: best, distance: bestD } : null;
  }

  function cast(spot) {
    const target = spot || state.spot;
    if (!target) return { ok: false, reason: 'no spot' };
    state.fishing = true;
    state.casting = true;
    state.waiting = true;
    state.bite = false;
    state.spot = target;
    state.biteTimer = 2 + rngOf(world)() * 3;
    state.biteWindow = 0;
    target.bobber.visible = true;
    target.bobber.dipped = false;
    target.bobber.y = 0.4;
    toast(world, `Cast at ${target.name}… wait for the bobber to dip.`);
    return { ok: true, spot: target };
  }

  function rollCatch() {
    const rng = rngOf(world);
    const bigChance = hasBetterRod() ? 0.5 : 0.25;
    const roll = rng();
    if (roll < bigChance) return { kind: 'big', value: CATCH_VALUES.big, label: 'Big fish' };
    if (roll < bigChance + 0.55) return { kind: 'small', value: CATCH_VALUES.small, label: 'Small fish' };
    return { kind: 'junk', value: CATCH_VALUES.junk, label: 'Junk' };
  }

  function reelIn() {
    if (!state.fishing || !state.waiting) return { ok: false, reason: 'nothing to reel' };
    const spot = state.spot;
    const caughtBite = state.bite;
    state.fishing = false;
    state.casting = false;
    state.waiting = false;
    state.bite = false;
    if (spot) { spot.bobber.visible = false; spot.bobber.dipped = false; spot.bobber.y = 0.4; }
    if (!caughtBite) {
      toast(world, 'Reeled in too early — the fish got away.');
      return { ok: false, reason: 'too early' };
    }
    const fish = rollCatch();
    world.cash += fish.value;
    const record = { kind: fish.kind, value: fish.value, label: fish.label, at: world.elapsed || 0 };
    if (!state.bestCatch || fish.value > state.bestCatch.value) {
      state.bestCatch = record;
      world.kingpin.fishingBestCatch = record;
    }
    toast(world, fish.value > 0 ? `Caught a ${fish.label.toLowerCase()}! +$${fish.value}` : 'Caught junk — nothing but an old boot.');
    if (Array.isArray(world.events)) world.events.push({ type: 'fish-caught', catch: record });
    return { ok: true, catch: record };
  }

  function cancel() {
    if (state.spot) { state.spot.bobber.visible = false; state.spot.bobber.dipped = false; }
    state.fishing = false;
    state.casting = false;
    state.waiting = false;
    state.bite = false;
    state.spot = null;
  }

  // Cast at the nearest spot to a position (used by scripted shots/tests).
  function castAt(x, z) {
    const near = nearestSpot({ x, z }, 8);
    if (!near) return { ok: false, reason: 'no spot nearby' };
    return cast(near.spot);
  }

  function update(dt) {
    // Bite timing while a line is in the water.
    if (state.fishing && state.waiting && !state.bite) {
      state.biteTimer -= dt;
      if (state.biteTimer <= 0) {
        state.bite = true;
        state.biteWindow = 2.5;
        if (state.spot) {
          state.spot.bobber.dipped = true;
          state.spot.bobber.y = 0.05;
          state.spot.bobber.dipTime = world.elapsed || 0;
        }
      }
    } else if (state.bite) {
      state.biteWindow -= dt;
      if (state.biteWindow <= 0) {
        // The fish got away.
        if (state.spot) { state.spot.bobber.dipped = false; state.spot.bobber.y = 0.4; }
        state.bite = false;
        state.biteTimer = 2 + rngOf(world)() * 3;
      }
    }
    // E is edge-triggered: cast at a spot, reel in on a bite.
    const eDown = keyDown(world, 'KeyE') || keyDown(world, 'e') || keyDown(world, 'E');
    const pos = playerPos(world);
    if (eDown && !prevE && pos) {
      const onFoot = !world.playerCar && !(world.player && world.player.currentCar) && !(world.player && world.player.inVehicle);
      if (state.fishing) {
        reelIn();
      } else if (onFoot) {
        const near = nearestSpot(pos, 6);
        if (near) cast(near.spot);
      }
    }
    prevE = eDown;
  }

  const system = {
    spots,
    state,
    isFishing: () => state.fishing,
    hasBite: () => state.bite,
    bestCatch: () => state.bestCatch,
    nearestSpot,
    cast,
    castAt,
    reelIn,
    cancel,
    hasBetterRod,
    ownsSurfShack,
    update,
  };
  if (Array.isArray(world.systems) && !world.systems.includes(system.update)) world.systems.push(system.update);
  return system;
}

export default createFishing;
