// Shared pure helpers for Solmar City v3 — no drawing, no browser, no
// imports. Every system that needs angles, distances, clocks or waypoints
// uses these, so the same conventions hold everywhere: Y up, X east,
// Z south, heading 0 faces -Z (north), forward = (sin h, 0, cos h).
// The old Block Dodger world that lived in this file is gone; nothing in
// the game imported it, and the v3 systems below are its replacement.

/** Clamp v into [min, max]. */
export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Linear blend: 0 returns a, 1 returns b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Wrap an angle into (-PI, PI]. */
export function clampAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Shortest signed turn from `from` to `to`, in (-PI, PI]. */
export function angleDiff(from, to) {
  return clampAngle(to - from);
}

/**
 * Turn `current` toward `target` by at most `maxStep` radians.
 * Returns the new heading (the target itself when it is in reach).
 */
export function turnToward(current, target, maxStep) {
  const diff = angleDiff(current, target);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

/** Flat (XZ) distance between two {x, z} points. */
export function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Flat distance from raw coordinates — avoids allocating point objects. */
export function dist2XZ(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Heading from point `a` toward point `b` (0 faces -Z, see the header). */
export function headingToward(a, b) {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** True when `pos` is within `radius` metres of `spot` on the ground plane. */
export function nearSpot(pos, spot, radius) {
  return dist2XZ(pos.x, pos.z, spot.x, spot.z) <= radius;
}

/**
 * Step a point toward a target at `speed` m/s for `dt` seconds.
 * Mutates and returns `pos`; stops exactly on the target, never past it.
 */
export function moveToward(pos, target, speed, dt) {
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.001) return pos;
  const step = Math.min(d, speed * dt);
  pos.x += (dx / d) * step;
  pos.z += (dz / d) * step;
  return pos;
}

/**
 * A point on the segment from `a` to `b`, `t` of the way along
 * (0 = a, 1 = b). Used to place spike strips and race gates ahead of a
 * moving player without steering math.
 */
export function pointAlong(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

/** A random point inside a rectangle {minX, maxX, minZ, maxZ}. */
export function randomPointInRect(rng, rect) {
  const r = rng || Math.random;
  return {
    x: rect.minX + r() * (rect.maxX - rect.minX),
    z: rect.minZ + r() * (rect.maxZ - rect.minZ),
  };
}

/**
 * Fisher-Yates shuffle that returns a NEW array (the input is untouched),
 * driven by the game's seeded rng so layouts stay repeatable per seed.
 */
export function shuffle(rng, list) {
  const out = [...list];
  const r = rng || Math.random;
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Pick one element of a non-empty list with the seeded rng. */
export function pickOne(rng, list) {
  const r = rng || Math.random;
  return list[Math.floor(r() * list.length)];
}

/**
 * Weighted pick: entries are [value, weight]. Weights need not sum to 1;
 * a zero total falls back to the first entry.
 */
export function pickWeighted(rng, entries) {
  const r = rng || Math.random;
  let total = 0;
  for (const [, w] of entries) total += Math.max(0, w);
  if (total <= 0) return entries[0][0];
  let roll = r() * total;
  for (const [value, w] of entries) {
    roll -= Math.max(0, w);
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** 24-hour clock as "HH:MM" — 13.5 becomes "13:30". */
export function formatClock(hours) {
  const h = ((Math.floor(hours) % 24) + 24) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** A race / mission timer as "M:SS.t" — 75.4 becomes "1:15.4". */
export function formatDuration(seconds) {
  const s = Math.max(0, seconds);
  const minutes = Math.floor(s / 60);
  const rest = s - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** Total length in metres of a waypoint route ([{x, z}, ...]). */
export function routeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distXZ(points[i - 1], points[i]);
  return total;
}

/** Night hours for Solmar: the sun is down from 19:00 to 06:00. */
export function isNightHour(hours) {
  const h = ((hours % 24) + 24) % 24;
  return h >= 19 || h < 6;
}

/**
 * Daylight factor 0..1 for a given hour: 1 at noon, 0 in the deep night,
 * smooth ramps at dawn (06:00-08:00) and dusk (17:00-19:00). The
 * day/night system feeds this straight into the sun and sky.
 */
export function daylightFactor(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 8 && h < 17) return 1;
  if (h >= 19 || h < 6) return 0;
  if (h >= 6 && h < 8) return (h - 6) / 2;
  return (19 - h) / 2; // 17:00-19:00 dusk ramp
}

/**
 * The sun's compass angle for an hour: it rises in the east at 06:00,
 * stands south at noon and sets in the west at 19:00. The day/night
 * system turns this into a directional-light position.
 */
export function sunAngle(hours) {
  const h = clamp(hours, 6, 19);
  return ((h - 6) / 13) * Math.PI;
}

/** Names of the city districts, in the order the HUD lists them. */
export const DISTRICT_NAMES = [
  'Downtown',
  'Old Town',
  'Freight Yard',
  'Boardwalk',
  'Marina',
  'Safehouse Row',
];
