// Solmar City — world configuration (Round 16, v16).
// Every district, landmark, price and tuning value the game reads lives here
// so districts, systems and the bootstrap all agree on one source of truth.

export const CONFIG = {
  // ---- City grid ---------------------------------------------------------
  grid: {
    blocks: 9,
    block: 44, // metres of buildable block between roads
    road: 14, // road width in metres
    pitch: 58, // block + road
    min: -261,
    max: 261,
  },
  // Road centre-lines on both axes (9 roads each way).
  roads: [-232, -174, -116, -58, 0, 58, 116, 174, 232],
  bounds: { minX: -261, maxX: 261, minZ: -261, maxZ: 261 },

  // ---- Districts (name -> footprint, flavour) ----------------------------
  districts: {
    downtown:     { name: 'Downtown',      minX: -58,  maxX: 116,  minZ: -58,  maxZ: 116,  vibe: 'towers' },
    oldTown:      { name: 'Old Town',      minX: -261, maxX: -145, minZ: -145, maxZ: 29,   vibe: 'brick' },
    littleHavana: { name: 'Little Havana', minX: -260, maxX: -170, minZ: 60,   maxZ: 200,  vibe: 'colourful' },
    docks:        { name: 'The Docks',     minX: -260, maxX: -170, minZ: -260, maxZ: -170, vibe: 'industrial' },
    northHills:   { name: 'North Hills',   minX: -100, maxX: 100,  minZ: -260, maxZ: -180, vibe: 'rich' },
    sunsetBeach:  { name: 'Sunset Beach',  minX: -260, maxX: -100, minZ: 280,  maxZ: 330,  vibe: 'beach' },
    marina:       { name: 'Marina',        minX: 261,  maxX: 400,  minZ: 60,   maxZ: 260,  vibe: 'yachts' },
    islands:      { name: 'The Islands',   minX: 300,  maxX: 450,  minZ: 300,  maxZ: 450,  vibe: 'resort' },
    vineyards:    { name: 'Vineyards',     minX: -100, maxX: 100,  minZ: -320, maxZ: -260, vibe: 'rural' },
    casinoStrip:  { name: 'Casino Strip',  minX: 58,   maxX: 232,  minZ: -58,  maxZ: 58,   vibe: 'neon' },
    airfield:     { name: 'Airfield',      minX: 174,  maxX: 261,  minZ: -261, maxZ: -174, vibe: 'runway' },
    boardwalk:    { name: 'Boardwalk',     minX: -58,  maxX: 58,   minZ: 261,  maxZ: 330,  vibe: 'pier' },
  },

  // ---- Landmarks (single source of truth for positions) ------------------
  landmarks: {
    coralClubTower: { x: 29,  z: 29,   height: 78, name: 'Coral Club Tower' },
    marinaBasin:    { minX: 261, maxX: 400, minZ: 60,  maxZ: 260 },
    yacht:          { x: 305, z: 175,  name: 'Yacht' },
    pier:           { x: 295, z: 168,  name: 'Marina Pier' },
    shop:           { x: 58,  z: 116,  name: 'Shop' },
    safehouse:      { x: -174, z: 232, name: 'Safehouse' },
    policeStation:  { x: 80,  z: -203, name: 'Police Station' },
    freightYard:    { x: -170, z: -260, name: 'Freight Yard' },
    boardwalk:      { x: 0,   z: 264,  name: 'Boardwalk' },
    boardwalkPier:  { x: 0,   z: 318,  name: 'Boardwalk Pier' },
    oldTownA:       { x: -203, z: -87, name: 'Old Town' },
    oldTownB:       { x: -203, z: -29, name: 'Old Town' },
    lighthouse:     { x: -270, z: 300, name: 'Lighthouse' },
    airfieldNE:     { x: 220, z: -220, name: 'Airfield NE' },
    casinoStrip:    { x: 145, z: 0,    name: 'Casino Strip' },
    docksNW:        { minX: -260, maxX: -170, minZ: -260, maxZ: -170 },
    northHills:     { minX: -100, maxX: 100,  minZ: -260, maxZ: -180 },
    islands:        { minX: 300,  maxX: 450,  minZ: 300,  maxZ: 450 },
    vineyards:      { minX: -100, maxX: 100,  minZ: -320, maxZ: -260 },
    littleHavana:   { minX: -260, maxX: -170, minZ: 60,   maxZ: 200 },
    sunsetBeach:    { minX: -260, maxX: -100, minZ: 280,  maxZ: 330 },
    surfShack:      { x: -180, z: 300, name: 'Surf Shack' },
    jetSkiDock:     { x: -150, z: 320, name: 'Jet Ski Dock' },
    cartelWarehouse:{ x: -215, z: -215, name: 'Cartel Warehouse' },
    helipad:        { x: 29,  z: 29,   roof: 78, name: 'Helipad' },
    racingStart:    { x: 200, z: -230, name: 'Racing Start' },
    dominoPark:     { x: -215, z: 130, name: 'Domino Park' },
    clubNeon:       { x: 120, z: 90,   name: 'Club Neon' },
    bikeShop:       { x: 60,  z: 270,  name: 'Bike Shop' },
    seaplaneDock:   { x: 320, z: 200,  name: 'Seaplane Dock' },
    islandsBeachBar:{ x: 370, z: 360,  name: 'Islands Beach Bar' },
    vineyardEstate: { x: 0,   z: -290, name: 'Vineyard Estate' },
    ricosGarage:    { x: -150, z: 200, name: "Rico's Garage" },
    anchorBar:      { x: 100, z: 60,   name: 'Anchor Bar' },
    taxiDepot:      { x: 80,  z: 140,  name: 'Taxi Depot' },
    beachfrontHouse:{ x: 30,  z: 280,  name: 'Beachfront House' },
  },

  // ---- Player / world tunables -------------------------------------------
  player: {
    startX: -174, startZ: 232, // safehouse
    startHeading: 0,
    walkSpeed: 6,
    runSpeed: 10,
    health: 100,
    startCash: 500,
  },
  camera: { fov: 62, near: 0.1, far: 1400, height: 9, distance: 14 },
  sun: { elevation: 38, azimuth: 135, intensity: 2.4, color: 0xffe0b3 },
  fog: { color: 0x9fc3e0, near: 180, far: 950 },
  sky: { top: '#3f7fd0', mid: '#8fc3ea', horizon: '#ffd9a0' },

  // ---- Vehicles ------------------------------------------------------------
  vehicles: {
    sedan:   { name: 'Sedan',    topSpeed: 34, accel: 14, brake: 30, handling: 1.0, seats: 4 },
    taxi:    { name: 'Taxi',     topSpeed: 32, accel: 13, brake: 30, handling: 1.0, seats: 4 },
    truck:   { name: 'Truck',    topSpeed: 26, accel: 9,  brake: 24, handling: 0.7, seats: 2 },
    sports:  { name: 'Sports',   topSpeed: 48, accel: 20, brake: 34, handling: 1.3, seats: 2 },
    bike:    { name: 'Bike',     topSpeed: 40, accel: 17, brake: 32, handling: 1.5, seats: 2 },
    boat:    { name: 'Boat',     topSpeed: 28, accel: 10, brake: 12, handling: 0.8, seats: 4 },
    jetSki:  { name: 'Jet Ski',  topSpeed: 32, accel: 16, brake: 14, handling: 1.4, seats: 1 },
    seaplane:{ name: 'Seaplane', topSpeed: 55, accel: 12, brake: 10, handling: 0.9, seats: 4 },
    heli:    { name: 'Helicopter', topSpeed: 42, accel: 11, brake: 10, handling: 1.0, seats: 4 },
  },
  traffic: { carCount: 26, pedCount: 40, bikeCount: 6, boatCount: 4, jetSkiCount: 3 },

  // ---- Missions, economy, heat --------------------------------------------
  missions: {
    basePayout: 800,
    payouts: {
      tutorial: 500, taxi: 600, delivery: 900, chase: 1200, heist: 5000,
      revenge: 3500, crown: 8000, legacy: 6000, gambit: 4500, vice: 2500,
      kingpin: 12000, fishing: 400, jetSkiRace: 1500, streetRace: 2000,
    },
  },
  properties: {
    list: [
      { id: 'safehouse',      name: 'Safehouse',       x: -174, z: 232, price: 0,     income: 0 },
      { id: 'shop',           name: 'Corner Shop',     x: 58,   z: 116, price: 12000, income: 150 },
      { id: 'beachfrontHouse',name: 'Beachfront House',x: 30,   z: 280, price: 45000, income: 500 },
      { id: 'ricosGarage',    name: "Rico's Garage",   x: -150, z: 200, price: 25000, income: 350 },
      { id: 'anchorBar',      name: 'Anchor Bar',      x: 100,  z: 60,  price: 30000, income: 400 },
      { id: 'vineyardEstate', name: 'Vineyard Estate', x: 0,    z: -290, price: 60000, income: 800 },
    ],
    payoutInterval: 60, // seconds between property income ticks
  },
  heat: {
    maxWanted: 5,
    decayPerSecond: 0.02,
    crimeHeat: { petty: 1, theft: 2, assault: 2, shootout: 3, heist: 4 },
    raidAfterSeconds: 240,
  },
  crew: { maxMembers: 5, hireCost: 2000, wagePerSecond: 0.5 },
  garage: { upgradePrices: { engine: 3000, armour: 2500, nitro: 4000, paint: 800 } },
  sea: { level: 0.4, westEdge: -330, southEdge: 330, eastBasinMinX: 261 },
  seed: 1337,
  // ---- Minigames -------------------------------------------------------------
  minigames: {
    casino: { minBet: 100, maxBet: 5000, blackjackPayout: 1.5 },
    fishing: { bestCast: 60, biteWindow: [0.8, 2.4] },
    streetRace: { checkpoints: 8, countdownSeconds: 3 },
  },
  dayLength: 600, // seconds per full day/night cycle (visual only)
};

export function createConfig() {
  // Deep-ish copy so a caller can tune without mutating the shared CONFIG.
  return JSON.parse(JSON.stringify(CONFIG));
}

export default CONFIG;
