// Solmar City — every constant and tuning number in one place.
// World: Y up, X east, Z south. City grid 9x9 blocks, block 44 m, road 14 m,
// pitch 58 m. City spans about -261..+261 m on X and Z; beach + sea along the
// south edge (z > +261), marina on the east edge (x > +261). Downtown (tall
// buildings) near the centre, houses toward the edges.
//
// v3 adds: a day/night cycle, the Old Town quarter + lighthouse, the Harbor
// War arc (missions 9-12), smarter police (flanking, spike strips), the
// rifle, and side activities (street races, hidden packages, taxi jobs).
// The v1/v2 numbers below are unchanged — the new sections only extend them.

export const STEP = 1 / 60;

/** Fixed-step cap: a longer stall (hidden tab) is dropped, not replayed. */
export const MAX_FRAME = 0.25;

/** City grid: block 44 m + road 14 m = 58 m pitch, 9 road lines each way. */
export const CITY = {
  /** 9 road lines per direction; 8x8 interior blocks between them. */
  blocks: 9,
  blockSize: 44,
  roadWidth: 14,
  pitch: 58,
  /** Half the city span: roads run from -half to +half. */
  half: 261,
  /** Road centre lines, same for X and Z. */
  roadCoords: [-232, -174, -116, -58, 0, 58, 116, 174, 232],
  /** Block centres (8x8 interior blocks between the road lines). */
  blockCentres: [-203, -145, -87, -29, 29, 87, 145, 203],
  /** Where the sand starts (south edge) and where the open sea starts. */
  beachStart: 261,
  seaStart: 330,
  /** Where the marina basin starts (east edge). */
  marinaStart: 261,
  /** Downtown radius: blocks closer than this get tall towers. */
  downtownRadius: 90,
  /** Midtown radius: blocks inside this get mid-rise buildings, outside get houses. */
  midtownRadius: 175,
};

export const ROADS = CITY.roadCoords;

/** Sun-soaked coastal palette: warm sand, turquoise sea, pastel buildings. */
export const PALETTE = {
  skyTop: '#7ec8e8',
  skyHorizon: '#ffe9c4',
  fog: '#cfe8f2',
  sun: '#fff2d0',
  ground: '#b7ac93',
  road: '#3a3f46',
  roadLine: '#f5f0dc',
  sidewalk: '#cfc4b0',
  sand: '#e8d5a4',
  sea: '#2fb3c9',
  seaDeep: '#1e7fa8',
  pierWood: '#8a6b45',
  palmTrunk: '#7a5a3a',
  palmLeaf: '#2f8f4e',
  lampPost: '#3c4148',
  // Pastel facades; the window texture is multiplied by these colours.
  buildings: ['#ffd9c0', '#ffe9a8', '#c8e8d8', '#ffc9d6', '#d6c8f0', '#f2f2e8', '#ffb08a', '#a8d8e8'],
  downtown: '#e8b4b8',
  coralClub: '#ff7f6b',
  roof: '#8a7a6a',
  cloud: '#ffffff',
  // v3: Old Town stone + cobble, the lighthouse stripes, night sky.
  oldTownStone: '#e8dcc0',
  oldTownRoof: '#9a4a3a',
  cobble: '#b8a888',
  lighthouseRed: '#c23a2e',
  nightSky: '#0a1420',
  nightFog: '#0d1622',
};

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10,
  jumpSpeed: 7,
  health: 100,
  /** Radius used for building collision while on foot. */
  radius: 0.6,
  /** v3: sprint stamina — drains while sprinting, refills while walking. */
  staminaMax: 100,
  staminaDrain: 25, // per second of sprinting
  staminaRegen: 15, // per second while not sprinting
  staminaMinSprint: 10, // need at least this much to start a sprint
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseMax: 9,
  /** Top speed (m/s) for a plain traffic car; the player's cars go faster. */
  topSpeed: 26,
  playerTopSpeed: 38,
  policeTopSpeed: 42,
  steer: 1.9,
  /** Steering weakens as speed rises so fast cars stay controllable. */
  steerFalloff: 0.45,
  handbrakeGrip: 0.35,
  radius: 1.6,
  /** v3: top speed (m/s) while the tyres are shredded by a spike strip. */
  spikeTopSpeed: 8,
};

export const TRAFFIC = {
  cars: 10,
  peds: 14,
  carSpeed: 9,
  pedSpeed: 1.4,
  /** A traffic car brakes when the car ahead is closer than this (m). */
  followGap: 9,
  /** Peds flee when the player's car comes closer than this (m). */
  fleeRadius: 12,
  /** v3: during a street race, traffic on the course slows to this (m/s). */
  raceSlowSpeed: 5,
};

export const POLICE = {
  /** Chase cars at each wanted level (index = stars). */
  chaseCars: [0, 1, 2, 3, 3, 4],
  /** Seconds a police car must touch the on-foot player to bust him. */
  bustTime: 2,
  /** Wanted decays 1 star per this many seconds with no crime nearby. */
  decaySeconds: 20,
  /** No police within this range (m) counts as "no heat" for decay. */
  decayRange: 40,
  bustFine: 200,
};

/** v3 police tactics: flanking at 3+ stars, spike strips, heli lead. */
export const POLICE_AI = {
  flankMinWanted: 3,
  flankAhead: 20,
  flankSide: 11,
  flankFar: 26,
  stripMinWanted: 3,
  stripCooldown: 20,
  stripAheadMin: 55,
  stripAheadMax: 80,
  stripLife: 25,
  spikeSlowSeconds: 2.5,
  extraSpeed4Stars: 4,
  extraSpeed3Stars: 2,
};

export const MISSIONS = {
  debt: 5000,
  /** All twelve rewards, in order: the debt arc (1-4), the Dourado arc
   * (5-8), and the Harbor War arc (9-12, $20,000 in all). */
  rewards: [500, 800, 1200, 2500, 1500, 2000, 2500, 3000, 4000, 4500, 5500, 6000],
  courierPackages: 3,
  courierTimeLimit: 150,
  pursuitSurvive: 60,
  marinaCrew: 2,
  /** Harbor War arc (missions 9-12). */
  harbor: {
    escortKeepDist: 45,
    escortLoseDist: 60,
    escortLoseSeconds: 8,
    escortTruckSpeed: 12,
    deliveryTime: 150,
    takedownHull: 100,
  },
};

export const COMBAT = {
  pistolAmmo: 24,
  punchRange: 2.2,
  punchKnockback: 8,
  shootRange: 60,
  /** v3: the rifle — long-range, slow, hard-hitting (key 5). */
  rifleAmmo: 30,
  rifleDamage: 40,
  rifleRange: 120,
  rifleCooldown: 1.1,
  /** v3: armour vest from the shop absorbs half of every hit. */
  armorAbsorb: 0.5,
};

export const DAYNIGHT = {
  /** One game hour per this many real seconds (a full day = 12 minutes). */
  secondsPerHour: 30,
  startHour: 10,
  nightStart: 19,
  nightEnd: 6,
  dawnStart: 6,
  dawnEnd: 8,
  duskStart: 17,
  duskEnd: 19,
  daySunIntensity: 2.4,
  nightSunIntensity: 0.08,
  dayHemiIntensity: 0.85,
  nightHemiIntensity: 0.14,
};

export const OLDTOWN = {
  /** The two west blocks the quarter occupies (city.js skips buildings here). */
  rect: { minX: -232, maxX: -174, minZ: -116, maxZ: 0 },
  centre: { x: -203, z: -58 },
  cathedral: { x: -203, z: -58 },
  lighthouse: { x: -270, z: 300 },
  beamSpeed: 0.55,
};

export const ACTIVITIES = {
  packageReward: 50,
  packageTotal: 20,
  taxiMinFare: 150,
  taxiPerMetre: 0.6,
  taxiRespawnSeconds: 20,
  raceStartRadius: 8,
};

export const SHOPS_V3 = {
  rifleAmmoPrice: 150,
  nosRefillPrice: 80,
  armorPrice: 250,
};

export const SAVE_KEY = 'solmar-city-save-v1';
export const SAVE_VERSION = 3;
export const BEST_KEY = 'solmar-city-best';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
