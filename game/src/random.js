// Seeded randomness for Solmar City.
// createRng MUST return a CALLABLE function: districts and the city call
// rng() directly for a number in [0, 1). Helpers ride on the function
// object itself (range, int, pick, chance, shuffle). Same seed, same city.
export function createRng(seed = 1337) {
  let state = (seed | 0) || 1;
  function rng() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  rng.next = rng;
  rng.seed = seed;
  rng.range = function range(min, max) {
    return min + rng() * (max - min);
  };
  rng.int = function int(min, max) {
    return Math.floor(rng.range(min, max + 1));
  };
  rng.pick = function pick(list) {
    if (!list || list.length === 0) return undefined;
    return list[Math.floor(rng() * list.length)];
  };
  rng.choice = rng.pick;
  rng.chance = function chance(p) {
    return rng() < p;
  };
  rng.shuffle = function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };
  rng.sign = function sign() {
    return rng() < 0.5 ? -1 : 1;
  };
  // Bell-shaped draw around 0 (mean 0, roughly unit spread) for natural jitter.
  rng.gaussian = function gaussian() {
    return (rng() + rng() + rng() - 1.5) * 0.8;
  };
  rng.weighted = function weighted(pairs) {
    let total = 0;
    for (const [, w] of pairs) total += w;
    let roll = rng() * total;
    for (const [value, w] of pairs) {
      roll -= w;
      if (roll <= 0) return value;
    }
    return pairs[pairs.length - 1][0];
  };
  return rng;
}

// Back-compat alias: the starter used createRandom.
export const createRandom = createRng;
export default createRng;
