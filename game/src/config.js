// Solmar City — every constant and tuning number in one place.
// World: Y up, X east, Z south. City grid 9x9 blocks, block 44 m, road 14 m,
// pitch 58 m. City spans about -261..+261 m on X and Z; beach + sea along the
// south edge (z > +261), marina on the east edge (x > +261). Downtown (tall
// buildings) near the centre, houses toward the edges.

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
};

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10,
  jumpSpeed: 7,
  health: 100,
  /** Radius used for building collision while on foot. */
  radius: 0.6,
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

export const MISSIONS = {
  debt: 5000,
  rewards: [500, 800, 1200, 2500],
  courierPackages: 3,
  courierTimeLimit: 150,
  pursuitSurvive: 60,
  marinaCrew: 2,
};

export const COMBAT = {
  pistolAmmo: 24,
  punchRange: 2.2,
  punchKnockback: 8,
  shootRange: 60,
};

export const SAVE_KEY = 'solmar-city-save-v1';
export const BEST_KEY = 'solmar-city-best';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
