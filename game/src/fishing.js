// Fishing mini-game (NEW): Sunset Beach pier and the marina pier.
// Press E at a spot to cast, wait for a bite (the bobber dips),
// press E again to reel in. Catches: small fish $20, big fish $80,
// junk $0. Best catch is tracked in world.kingpin.fishingBest and
// shown on the HUD. Fishing is calm — no wanted gain — and passes
// in-game time. CRITICAL: every spot in spots() includes a `bobber`.

export const FISHING_SPOTS = [
  { key: 'sunset', name: 'Sunset Beach Pier', x: -175, z: 305 },
  { key: 'marina', name: 'Marina Pier', x: 200, z: 180 },
];

const CAST_RADIUS = 10;
const BITE_MIN = 3;   // seconds until a bite can arrive
const BITE_MAX = 8;
const BITE_WINDOW = 2.5; // seconds the bobber stays dipped

function posOf(world) {
  const p = world.player || {};
  const q = p.position || p;
  return { x: Number(q.x ?? p.x ?? 0), z: Number(q.z ?? p.z ?? q.y ?? p.y ?? 0) };
}

function cashOf(world) { return Number(world.cash ?? world.player?.cash ?? 0); }

function setCash(world, value) {
  const v = Math.max(0, Math.floor(value));
  world.cash = v;
  if (world.player) world.player.cash = v;
  return v;
}

function toast(world, text) {
  if (typeof world.addToast === 'function') { world.addToast(text); return; }
  if (Array.isArray(world.events)) world.events.push({ type: 'toast', text, message: text });
}

function keyDown(world, ...codes) {
  const keys = world.input?.keys;
  if (!keys) return false;
  for (const c of codes) if (keys.has(c)) return true;
  return false;
}

function hasBetterRod(world) {
  const props = world.systemObjects?.properties;
  if (props && typeof props.hasBetterRod === 'function') return props.hasBetterRod();
  if (props && typeof props.isOwned === 'function') return props.isOwned('surf');
  return Boolean(world.properties?.owned?.surf);
}

export function createFishing(world) {
  if (!world.kingpin || typeof world.kingpin !== 'object') world.kingpin = {};
  // fishingBest: { kind, value, label } — null until the first catch.

  // One live bobber per spot; spots() always returns these objects,
  // so every entry carries a real `bobber` field.
  const bobbers = {};
  for (const spot of FISHING_SPOTS) {
    bobbers[spot.key] = {
      x: spot.x, z: spot.z, y: 0,
      visible: false, dipped: false, state: 'idle',
    };
  }

  let state = 'idle'; // idle | waiting | bite
  let activeSpot = null;
  let biteTimer = 0;
  let biteLeft = 0;
  let prevE = false;

  function spots() {
    return FISHING_SPOTS.map((s) => ({
      x: s.x, z: s.z, key: s.key, name: s.name,
      bobber: bobbers[s.key],
    }));
  }

  function nearestSpot() {
    const p = posOf(world);
    let best = null, bestD = Infinity;
    for (const s of FISHING_SPOTS) {
      const dx = p.x - s.x, dz = p.z - s.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = s; }
    }
    return bestD <= CAST_RADIUS ? best : null;
  }

  function cast(spot) {
    if (state !== 'idle') return false;
    const target = spot || nearestSpot();
    if (!target) { toast(world, 'Find a fishing spot — the Sunset Beach pier or the marina pier.'); return false; }
    const key = target.key || (FISHING_SPOTS.find((s) => s.x === target.x && s.z === target.z) || {}).key;
    if (!key || !bobbers[key]) return false;
    activeSpot = FISHING_SPOTS.find((s) => s.key === key);
    state = 'waiting';
    biteTimer = BITE_MIN + Math.random() * (BITE_MAX - BITE_MIN);
    biteLeft = 0;
    const bobber = bobbers[key];
    bobber.visible = true; bobber.dipped = false; bobber.state = 'waiting';
    toast(world, 'Line cast at ' + activeSpot.name + '… wait for the bobber to dip.');
    return true;
  }

  function rollCatch() {
    const betterRod = hasBetterRod(world);
    // Better rod (Surf Shack) doubles big-fish odds: 25% -> 50%.
    const roll = Math.random();
    if (betterRod) {
      if (roll < 0.50) return { kind: 'big', value: 80, label: 'Big fish!' };
      if (roll < 0.90) return { kind: 'small', value: 20, label: 'Small fish' };
      return { kind: 'junk', value: 0, label: 'Junk' };
    }
    if (roll < 0.25) return { kind: 'big', value: 80, label: 'Big fish!' };
    if (roll < 0.85) return { kind: 'small', value: 20, label: 'Small fish' };
    return { kind: 'junk', value: 0, label: 'Junk' };
  }

  function reelIn() {
    if (state === 'idle') return false;
    if (state === 'waiting') {
      // Reeled in too early — scared the fish off.
      const bobber = activeSpot ? bobbers[activeSpot.key] : null;
      if (bobber) { bobber.visible = false; bobber.dipped = false; bobber.state = 'idle'; }
      state = 'idle'; activeSpot = null;
      toast(world, 'Reeled in too early — no bite yet.');
      return false;
    }
    // state === 'bite': a catch!
    const fish = rollCatch();
    const bobber = activeSpot ? bobbers[activeSpot.key] : null;
    if (bobber) { bobber.visible = false; bobber.dipped = false; bobber.state = 'idle'; }
    state = 'idle'; activeSpot = null;
    if (fish.value > 0) {
      setCash(world, cashOf(world) + fish.value);
      const best = world.kingpin.fishingBest;
      if (!best || fish.value > Number(best.value ?? 0)) {
        world.kingpin.fishingBest = { kind: fish.kind, value: fish.value, label: fish.label };
      }
      toast(world, fish.label + ' Caught! Sold for $' + fish.value + '.');
    } else {
      toast(world, 'Just junk… nothing to sell. ($0)');
    }
    return fish.value > 0;
  }

  function update(dt) {
    const step = Math.max(0, Number(dt) || 0);
    if (state === 'waiting') {
      biteTimer -= step;
      if (biteTimer <= 0) {
        state = 'bite';
        biteLeft = BITE_WINDOW;
        if (activeSpot) {
          const bobber = bobbers[activeSpot.key];
          bobber.dipped = true; bobber.y = -0.25; bobber.state = 'bite';
        }
        toast(world, 'Bite! Reel in now (E)!');
      }
    } else if (state === 'bite') {
      biteLeft -= step;
      if (biteLeft <= 0) {
        // Fish got away.
        if (activeSpot) {
          const bobber = bobbers[activeSpot.key];
          bobber.visible = false; bobber.dipped = false; bobber.y = 0; bobber.state = 'idle';
        }
        state = 'idle'; activeSpot = null;
        toast(world, 'Too slow — the fish got away.');
      }
    }

    // E edge: cast at a spot, or reel in when waiting / on a bite.
    const eDown = keyDown(world, 'KeyE', 'e', 'E');
    if (eDown && !prevE) {
      if (state === 'idle') cast(nearestSpot());
      else reelIn();
    }
    prevE = eDown;
  }

  // Best catch so far, for the HUD (null until the first catch).
  function best() {
    return world.kingpin.fishingBest || null;
  }

  return {
    update,
    spots,
    cast,
    reelIn,
    best,
    get state() { return state; },
  };
}
