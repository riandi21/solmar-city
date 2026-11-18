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
