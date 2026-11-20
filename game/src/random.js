// Seeded RNG for Solmar City (Round 16, v16).
// createRng(seed) returns a CALLABLE function: rng() -> [0, 1).
// Helpers ride on the function object itself, so districts can call
// rng() directly and also use rng.chance / rng.int / rng.pick / rng.range.

export function createRng(seed = 1337) {
  // mulberry32 — small, fast, deterministic across runs and browsers.
  let a = (seed | 0) >>> 0;
  function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // True with probability p (p in [0, 1]).
  rng.chance = function chance(p) {
    return rng() < p;
  };
  // Integer in [min, max] inclusive.
  rng.int = function int(min, max) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi < lo) return lo;
    return lo + Math.floor(rng() * (hi - lo + 1));
  };
  // Uniform float in [min, max).
  rng.range = function range(min, max) {
    return min + rng() * (max - min);
  };
  // Random element of a non-empty array (undefined for an empty one).
  rng.pick = function pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(rng() * arr.length)];
  };
  // Extra helpers districts may use; harmless if unused.
  rng.shuffle = function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  };
  // Approximately normal (mean 0, stddev 1) via Box-Muller.
  rng.normal = function normal() {
    const u = Math.max(rng(), 1e-9);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  rng.seed = seed | 0;
  return rng;
}

export default createRng;
