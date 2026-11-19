// Solmar City — central tuning and world constants.
// Every number that more than one system needs lives here, so the city,
// missions, shops, territories and HUD all agree on the same values.

export const CONFIG = Object.freeze({
  // City grid: 9 by 9 blocks, block 44 m, road 14 m, pitch 58 m.
  gridBlocks: 9,
  blockSize: 44,
  roadWidth: 14,
  pitch: 58,
  cityHalf: 261,
  roadLines: Object.freeze([-232, -174, -116, -58, 0, 58, 116, 174, 232]),

  // Landmarks.
  coralClub: Object.freeze({ x: 29, z: 29, height: 78 }),
  coralClubRoadside: Object.freeze({ x: 58, z: 29 }),
  marina: Object.freeze({ xMin: 261, xMax: 400, zMin: 60, zMax: 260 }),
  yacht: Object.freeze({ x: 305, z: 175 }),
  pierPoint: Object.freeze({ x: 295, z: 168 }),
  shop: Object.freeze({ x: 58, z: 116 }),
  safehouse: Object.freeze({ x: -174, z: 232 }),
  policeRespawn: Object.freeze({ x: 80, z: -203 }),
  freightYard: Object.freeze({ x: -170, z: -260 }),
  boardwalk: Object.freeze({ x: 0, z: 264 }),
  pier: Object.freeze({ x: 0, z: 318 }),
  oldTownBlocks: Object.freeze([
    Object.freeze({ x: -203, z: -87 }),
    Object.freeze({ x: -203, z: -29 }),
  ]),
  lighthouse: Object.freeze({ x: -270, z: 300 }),
  seaStartsAtZ: 330,
  docks: Object.freeze({ xMin: -260, xMax: -170, zMin: -260, zMax: -170 }),

  // The four buyable properties.
  properties: Object.freeze([
    Object.freeze({ id: 'garage', name: "Rico's Garage", x: -150, z: 200, price: 2000, incomePerHour: 50 }),
    Object.freeze({ id: 'bar', name: 'Anchor Bar', x: 100, z: 60, price: 5000, incomePerHour: 120 }),
    Object.freeze({ id: 'depot', name: 'Coral Taxi Depot', x: 80, z: 140, price: 8000, incomePerHour: 200 }),
    Object.freeze({ id: 'beachhouse', name: 'Beachfront House', x: 30, z: 280, price: 12000, incomePerHour: 300 }),
  ]),
  bikeShop: Object.freeze({ x: 60, z: 270 }),

  // Bikes for sale at the bike shop.
  bikes: Object.freeze([
    Object.freeze({ id: 'scooter', name: 'City Scooter', price: 800, topSpeed: 26, accel: 14 }),
    Object.freeze({ id: 'street', name: 'Street Bike', price: 2500, topSpeed: 38, accel: 20 }),
    Object.freeze({ id: 'superbike', name: 'Superbike', price: 6000, topSpeed: 52, accel: 28 }),
  ]),

  // Shop prices and fees.
  shopPrices: Object.freeze({ health: 150, ammo: 100, rifleAmmo: 150, nos: 80, armor: 250 }),
  safehouseFee: 300,
  safehouseCooldown: 60,
  bustedFine: 200,

  // Mission rewards for the arcs whose per-mission amounts are fixed.
  missionRewards: Object.freeze({
    1: 500, 2: 800, 3: 1200, 4: 2500,
    21: 4000, 22: 9000, 23: 8000, 24: 14000,
  }),

  // Territories: six districts, control 0-100, hourly income each.
  territories: Object.freeze([
    Object.freeze({ id: 'downtown', name: 'Downtown', incomePerHour: 150 }),
    Object.freeze({ id: 'oldtown', name: 'Old Town', incomePerHour: 90 }),
    Object.freeze({ id: 'marina', name: 'Marina', incomePerHour: 120 }),
    Object.freeze({ id: 'boardwalk', name: 'Boardwalk', incomePerHour: 100 }),
    Object.freeze({ id: 'freight', name: 'Freight Yard', incomePerHour: 80 }),
    Object.freeze({ id: 'airfield', name: 'Airfield', incomePerHour: 110 }),
  ]),
  territoryControlThreshold: 60,
  territoryAttackLoss: 20,

  // Police / wanted.
  wantedMax: 5,
  wantedDecaySeconds: 20,
  bustedTouchSeconds: 2,
  policeClearDistance: 40,

  // Player.
  playerWalkSpeed: 6,
  playerSprintSpeed: 10,
  playerHealth: 100,

  // Traffic counts.
  trafficCars: 10,
  pedestrians: 14,

  // Activities.
  hiddenPackageReward: 50,
  taxiFarePerMetre: 0.5,
  taxiDepotBonus: 0.25,

  // Full day/night cycle in real seconds.
  dayLengthSeconds: 600,
});
