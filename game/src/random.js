// Seeded deterministic random numbers (mulberry32).
// The same seed always gives the same sequence, which keeps the staged
// screenshot captures repeatable from run to run.

export function createRng(seed) {
  let state = (seed | 0) >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(a, b) {
    return a + next() * (b - a);
  }

  function int(a, b) {
    return Math.floor(range(a, b + 1));
  }

  function pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(next() * arr.length)];
  }

  // Fisher-Yates shuffle that consumes the same seeded stream, so a
  // shuffled order is repeatable for a given seed.
  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  // Callable as rng() (returns next()) and as rng.next/range/pick/int/shuffle:
  // some systems call world.rng() as a function, others use its methods.
  function rng() { return next(); }
  rng.next = next;
  rng.range = range;
  rng.int = int;
  rng.pick = pick;
  rng.shuffle = shuffle;
  return rng;
}
