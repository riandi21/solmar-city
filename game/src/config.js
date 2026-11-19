// Solmar City — central tuning and world constants.
// One place for every number the other systems share: grid, districts,
// economy, vehicles, wanted/heat/cartel scales and mission rewards.
export const CITY = {
  blocks: 9,
  blockSize: 44,
  roadWidth: 14,
  pitch: 58,
  halfExtent: 261,
  roadCoords: [-232, -174, -116, -58, 0, 58, 116, 174, 232],
  seaStartZ: 330,
  marinaMinX: 261,
  marinaMaxX: 400,
  marinaMinZ: 60,
  marinaMaxZ: 260,
};

export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', x: 0, z: 0, radius: 120 },
  { id: 'oldtown', name: 'Old Town', x: -203, z: -58, radius: 70 },
  { id: 'marina', name: 'Marina', x: 320, z: 160, radius: 90 },
  { id: 'boardwalk', name: 'Boardwalk', x: 0, z: 270, radius: 80 },
  { id: 'freight', name: 'Freight Yard', x: -170, z: -260, radius: 70 },
  { id: 'airfield', name: 'Airfield', x: 200, z: -230, radius: 90 },
  { id: 'northhills', name: 'North Hills', x: 0, z: -220, radius: 80 },
  { id: 'islands', name: 'The Islands', x: 375, z: 375, radius: 90 },
  { id: 'vineyards', name: 'Vineyards', x: 0, z: -290, radius: 70 },
  { id: 'havana', name: 'Little Havana', x: -215, z: 130, radius: 70 },
  { id: 'sunsetbeach', name: 'Sunset Beach', x: -180, z: 305, radius: 80 },
  { id: 'docks', name: 'Docks', x: -215, z: -215, radius: 70 },
];

export const LANDMARKS = {
  coralClub: { x: 29, z: 29, height: 78 },
  coralClubPoint: { x: 58, z: 29 },
  yacht: { x: 305, z: 175 },
  pierPoint: { x: 295, z: 168 },
  shop: { x: 58, z: 116 },
  safehouse: { x: -174, z: 232 },
  policeStation: { x: 80, z: -203 },
  lighthouse: { x: -270, z: 300 },
  pier: { x: 0, z: 318 },
  surfShack: { x: -180, z: 300 },
  jetSkiDock: { x: -150, z: 320 },
  cartelWarehouse: { x: -215, z: -215 },
  raceStart: { x: 200, z: -230 },
  dominoPark: { x: -215, z: 130 },
  clubNeon: { x: 120, z: 90 },
  bikeShop: { x: 60, z: 270 },
  seaplaneDock: { x: 320, z: 200 },
  islandsBar: { x: 370, z: 360 },
  vineyardEstate: { x: 0, z: -290 },
  garage: { x: -150, z: 200 },
  anchorBar: { x: 100, z: 60 },
  taxiDepot: { x: 80, z: 140 },
  beachHouse: { x: 30, z: 280 },
};

export const PROPERTIES = [
  { id: 'garage', name: "Rico's Garage", price: 2000, income: 50, x: -150, z: 200 },
  { id: 'anchorBar', name: 'Anchor Bar', price: 5000, income: 120, x: 100, z: 60 },
  { id: 'taxiDepot', name: 'Coral Taxi Depot', price: 8000, income: 200, x: 80, z: 140 },
  { id: 'beachHouse', name: 'Beachfront House', price: 12000, income: 300, x: 30, z: 280 },
  { id: 'clubNeon', name: 'Club Neon', price: 15000, income: 400, x: 120, z: 90 },
  { id: 'surfShack', name: 'Surf Shack', price: 10000, income: 150, x: -180, z: 300 },
];

export const TERRITORIES = ['Downtown', 'Old Town', 'Marina', 'Boardwalk', 'Freight Yard', 'Airfield'];

export const ECONOMY = {
  startCash: 500,
  bustedFine: 200,
  safehouseFee: 300,
  crewHire: 1000,
  crewRevive: 200,
  bribe: 500,
  healthPrice: 150,
  ammoPrice: 100,
  rifleAmmoPrice: 150,
  nosPrice: 80,
  armorPrice: 250,
  paintPrice: 200,
  carArmorPrice: 500,
  enginePrice: 1000,
  nosTankPrice: 400,
  hydraulicsPrice: 300,
  tireRepair: 100,
  packageReward: 50,
};

export const VEHICLES = {
  sports: { topSpeed: 52, accel: 26, brake: 34, steer: 1.9 },
  sedan: { topSpeed: 40, accel: 19, brake: 28, steer: 1.5 },
  truck: { topSpeed: 30, accel: 12, brake: 22, steer: 1.0 },
  taxi: { topSpeed: 42, accel: 20, brake: 30, steer: 1.6 },
  police: { topSpeed: 50, accel: 24, brake: 40, steer: 1.8 },
  limo: { topSpeed: 34, accel: 14, brake: 26, steer: 1.1 },
  lowrider: { topSpeed: 36, accel: 16, brake: 26, steer: 1.4 },
};

export const WANTED = {
  max: 5,
  decaySeconds: 20,
  bustedHoldSeconds: 2,
  bustedRadius: 40,
};

export const MISSION_REWARDS = {
  1: 500, 2: 800, 3: 1200, 4: 2500,
  41: 9000, 42: 14000, 43: 16000, 44: 20000,
};

export const KINGPIN_ARC = {
  total: 59000,
  missions: [41, 42, 43, 44],
  threatDropOnSeizure: 20,
  threatDropOnSiege: 30,
  siegeSeconds: 120,
  siegeWaves: 3,
};

export const DAY_LENGTH_SECONDS = 480;
export const SAVE_KEY = 'solmar-city-save-v9';
export const SAVE_VERSION = 9;

export const CONFIG = {
  city: CITY,
  districts: DISTRICTS,
  landmarks: LANDMARKS,
  properties: PROPERTIES,
  territories: TERRITORIES,
  economy: ECONOMY,
  vehicles: VEHICLES,
  wanted: WANTED,
  dayLengthSeconds: DAY_LENGTH_SECONDS,
  missionRewards: MISSION_REWARDS,
  kingpinArc: KINGPIN_ARC,
  saveKey: SAVE_KEY,
  saveVersion: SAVE_VERSION,
  seed: 1337,
  trafficCars: 10,
  pedestrians: 14,
  maxWanted: 5,
  title: 'Solmar City',
  hero: 'Rico Vega',
};

export default CONFIG;
