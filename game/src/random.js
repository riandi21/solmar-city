// A small seeded random number generator (mulberry32): the same seed gives the
// same city, which is what makes the game and the screenshot scenes repeatable.
//
// createRandom(seed) returns a function rng() -> [0, 1) with helpers attached,
// so systems can call rng() for a raw float or rng.range(a, b) / rng.pick(list)
// / rng.chance(p) / rng.int(a, b) for the common cases. The helpers are also
// exported standalone for modules that only receive a bare rng function.

export function createRandom(seed) {
  let a = (seed | 0) >>> 0;
  function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  rng.range = (min, max) => min + rng() * (max - min);
  rng.int = (min, max) => Math.floor(min + rng() * (max - min + 1));
  rng.pick = (list) => list[Math.floor(rng() * list.length)];
  rng.chance = (p) => rng() < p;
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  return rng;
}

/** Float in [min, max). Works with a bare rng() function or a createRandom one. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Integer in [min, max] inclusive. */
export function int(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

/** One element of a list, uniformly at random. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** True with probability p (0..1). */
export function chance(rng, p) {
  return rng() < p;
}

/**
 * v3 — a normally-distributed float (Box-Muller): mean with the given
 * spread, clamped to [mean - 3*std, mean + 3*std] so a rare roll never
 * throws a value off the map. Used for building heights and ped speeds.
 */
export function gaussian(rng, mean, std) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  const value = mean + z * std;
  return Math.max(mean - 3 * std, Math.min(mean + 3 * std, value));
}

/**
 * v3 — n distinct elements of a list, in random order (partial
 * Fisher-Yates). Asking for more than the list holds returns the whole
 * list shuffled. Used to deal out package spots and race checkpoints.
 */
export function sample(rng, list, n) {
  const out = [...list];
  const take = Math.max(0, Math.min(n, out.length));
  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(rng() * (out.length - i));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out.slice(0, take);
}

/** v3 — value plus or minus up to `amount`, uniformly. */
export function jitter(rng, value, amount) {
  return value + (rng() * 2 - 1) * amount;
}

/**
 * v3 — pick a key from a { key: weight } table. Weights need not sum
 * to 1; a zero total returns the first key. Used for weighted spawns
 * (which district a taxi fare waits in, which ped model walks by).
 */
export function weightedKey(rng, table) {
  const keys = Object.keys(table);
  let total = 0;
  for (const key of keys) total += Math.max(0, table[key]);
  if (total <= 0 || keys.length === 0) return keys[0];
  let roll = rng() * total;
  for (const key of keys) {
    roll -= Math.max(0, table[key]);
    if (roll <= 0) return key;
  }
  return keys[keys.length - 1];
}

/** v3 — a random angle in radians, uniform over the full circle. */
export function angle(rng) {
  return rng() * Math.PI * 2;
}
