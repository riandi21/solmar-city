// Solmar City — the whole city, built once from a seeded rng and kept static
// afterwards, except for the sea shimmer and the drifting clouds.
//   createCity(scene, rng) -> { roads, colliders, update(dt), randomRoadPos, nearestRoad }
//
// Roads run along the grid lines in CITY.roadCoords. A road's `axis` is the
// direction it runs: axis 'x' runs along X (its z stays at `coord`), axis 'z'
// runs along Z (its x stays at `coord`). `from`/`to` are its ends along that
// axis. Colliders are building footprints { minX, maxX, minZ, maxZ } plus the
// sea / marina water edges and the world bounds, for car and on-foot collision.
//
// Draw calls are kept sane on purpose: one shared unit-box geometry and a
// handful of shared pastel materials for all buildings, one shared road
// texture (cloned once for the other direction), InstancedMesh for palms and
// streetlights, and a single canvas texture per facade height class.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

const HALF = CITY.half;
const ROAD_LEN = HALF * 2;

/** The Coral Club — Madame Coral's tower, the mission-1 destination. */
export const CORAL_CLUB_POS = { x: 29, z: 29 };

function makeCanvas(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Asphalt with a dashed centre line and pale edge lines, dashes along X. */
function makeRoadTexture() {
  const texture = makeCanvas(256, 64, (ctx, w, h) => {
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(0, 0, w, h);
    // Subtle tyre-wear bands.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 10, w, 10);
    ctx.fillRect(0, h - 20, w, 10);
    // Edge lines.
    ctx.fillStyle = PALETTE.roadLine;
    ctx.fillRect(0, 3, w, 2);
    ctx.fillRect(0, h - 5, w, 2);
    // Dashed centre line.
    for (let x = 0; x < w; x += 64) ctx.fillRect(x + 8, h / 2 - 2, 32, 4);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Facade: near-white base (tinted by the material colour) with a grid of dark
 * windows, a few of them lit. `rows` scales with building height class.
 */
function makeFacadeTexture(rows) {
  const texture = makeCanvas(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4f0e8';
    ctx.fillRect(0, 0, w, h);
    const cols = 4;
    const cellW = w / cols;
    const cellH = h / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lit = (r * 7 + c * 3) % 9 === 0;
        ctx.fillStyle = lit ? '#ffe9a0' : '#2c3542';
        ctx.fillRect(c * cellW + 7, r * cellH + 8, cellW - 14, cellH - 16);
      }
    }
    // Ground-floor shopfront band.
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(0, h - 22, w, 22);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** A simple white-hulled boat: hull + cabin + mast + triangular sail. */
function makeBoat(scene, x, z, heading, scale, sailColor) {
  const boat = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#f2f2e8', roughness: 0.5 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7 * scale, 1.4, 2.6 * scale), hullMat);
  hull.position.y = 0.4;
  boat.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3 * scale, 1.2, 2 * scale),
    new THREE.MeshStandardMaterial({ color: '#dfe8ee', roughness: 0.6 }),
  );
  cabin.position.set(-0.5 * scale, 1.6, 0);
  boat.add(cabin);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 6 * scale, 6),
    new THREE.MeshStandardMaterial({ color: '#6a5a44', roughness: 0.8 }),
  );
  mast.position.set(0.5 * scale, 4.4 * scale, 0);
  boat.add(mast);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(0, 5 * scale);
  sailShape.lineTo(2.8 * scale, 0.4);
  sailShape.closePath();
  const sail = new THREE.Mesh(
    new THREE.ShapeGeometry(sailShape),
    new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.7, side: THREE.DoubleSide }),
  );
  sail.position.set(0.6 * scale, 2 * scale, 0);
  boat.add(sail);
  boat.position.set(x, 0.15, z);
  boat.rotation.y = heading;
  boat.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(boat);
  return boat;
}

export function createCity(scene, rng) {
  const roads = [];
  const colliders = [];
  const clouds = [];
  let seaTexture = null;

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const facadeLow = makeFacadeTexture(3);
  const facadeMid = makeFacadeTexture(6);
  const facadeTall = makeFacadeTexture(12);
  const buildingMats = PALETTE.buildings.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        map: facadeMid,
        roughness: 0.85,
      }),
  );
  // Tall towers get the tall facade, houses the low one; same palette.
  const tallMats = PALETTE.buildings.map(
    (color) => new THREE.MeshStandardMaterial({ color, map: facadeTall, roughness: 0.85 }),
  );
  const houseMats = PALETTE.buildings.map(
    (color) => new THREE.MeshStandardMaterial({ color, map: facadeLow, roughness: 0.85 }),
  );
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.95 });
  const groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 });

  function addBuilding(cx, cz, w, d, h, mats, isCoralClub) {
    const mat = isCoralClub
      ? new THREE.MeshStandardMaterial({ color: PALETTE.coralClub, map: facadeTall, roughness: 0.8 })
      : mats[Math.floor(rng() * mats.length)];
    const mesh = new THREE.Mesh(unitBox, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, 0.3 + h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
  }

  // ---- Ground base -------------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Roads -------------------------------------------------------------
  const roadTexX = makeRoadTexture();
  roadTexX.repeat.set(9, 1);
  const roadTexZ = roadTexX.clone();
  roadTexZ.needsUpdate = true;
  roadTexZ.repeat.set(1, 9);
  const roadMatX = new THREE.MeshStandardMaterial({ map: roadTexX, roughness: 0.95 });
  const roadMatZ = new THREE.MeshStandardMaterial({ map: roadTexZ, roughness: 0.95 });
  const roadGeoX = new THREE.PlaneGeometry(ROAD_LEN, CITY.roadWidth);
  roadGeoX.rotateX(-Math.PI / 2);
  const roadGeoZ = new THREE.PlaneGeometry(CITY.roadWidth, ROAD_LEN);
  roadGeoZ.rotateX(-Math.PI / 2);
  for (const coord of CITY.roadCoords) {
    const alongX = new THREE.Mesh(roadGeoX, roadMatX);
    alongX.position.set(0, 0.02, coord);
    alongX.receiveShadow = true;
    scene.add(alongX);
    // Z-roads sit a hair higher so the crossing never z-fights.
    const alongZ = new THREE.Mesh(roadGeoZ, roadMatZ);
    alongZ.position.set(coord, 0.03, 0);
    alongZ.receiveShadow = true;
    scene.add(alongZ);
    roads.push({ axis: 'x', coord, from: -HALF, to: HALF });
    roads.push({ axis: 'z', coord, from: -HALF, to: HALF });
  }

  // ---- Blocks: sidewalks + buildings --------------------------------------
  // v3: the two west blocks at (-203,-87) and (-203,-29) belong to Old
  // Town — the quarter builds its own cathedral, plaza and townhouses
  // there (oldtown.js), so the generic blocks stay out. The sidewalk
  // slabs still go down; the cobbled plaza sits just above them.
  const isOldTownBlock = (cx, cz) => cx === -203 && (cz === -87 || cz === -29);
  let buildingCount = 0;
  for (const cx of CITY.blockCentres) {
    for (const cz of CITY.blockCentres) {
      const walk = new THREE.Mesh(unitBox, sidewalkMat);
      walk.scale.set(CITY.blockSize + 4, 0.3, CITY.blockSize + 4);
      walk.position.set(cx, 0.15, cz);
      walk.receiveShadow = true;
      scene.add(walk);

      if (isOldTownBlock(cx, cz)) continue;

      const dist = Math.hypot(cx, cz);
      const isCoralClub = cx === CORAL_CLUB_POS.x && cz === CORAL_CLUB_POS.z;
      if (isCoralClub) {
        addBuilding(cx, cz, 30, 30, 78, tallMats, true);
        buildingCount += 1;
        continue;
      }
      if (dist <= CITY.downtownRadius) {
        // One tall tower per downtown block.
        addBuilding(cx, cz, 30, 30, 28 + rng() * 42, tallMats, false);
        buildingCount += 1;
      } else if (dist <= CITY.midtownRadius) {
        // Two mid-rise buildings, split along the block's long side.
        const horizontal = rng() < 0.5;
        for (let i = 0; i < 2; i += 1) {
          const off = (i - 0.5) * 22;
          addBuilding(
            horizontal ? cx + off : cx,
            horizontal ? cz : cz + off,
            horizontal ? 18 : 36,
            horizontal ? 36 : 18,
            10 + rng() * 18,
            buildingMats,
            false,
          );
          buildingCount += 1;
        }
      } else {
        // Edge houses: a 2x2 row of small homes with jitter.
        for (let i = 0; i < 2; i += 1) {
          for (let j = 0; j < 2; j += 1) {
            if (buildingCount > 175) break;
            const hx = cx + (i - 0.5) * 20 + (rng() - 0.5) * 4;
            const hz = cz + (j - 0.5) * 20 + (rng() - 0.5) * 4;
            addBuilding(hx, hz, 10 + rng() * 4, 10 + rng() * 4, 5 + rng() * 6, houseMats, false);
            buildingCount += 1;
          }
        }
      }
    }
  }

  // ---- Palms (instanced) ---------------------------------------------------
  const palmSpots = [];
  for (let x = -240; x <= 240; x += 32) palmSpots.push([x + (rng() - 0.5) * 8, 272]);
  for (let z = 80; z <= 240; z += 40) palmSpots.push([252, z]);
  for (let i = 0; i < 28; i += 1) {
    const cx = CITY.blockCentres[Math.floor(rng() * CITY.blockCentres.length)];
    const cz = CITY.blockCentres[Math.floor(rng() * CITY.blockCentres.length)];
    palmSpots.push([cx + (rng() < 0.5 ? -21 : 21), cz + (rng() - 0.5) * 30]);
  }
  const dummy = new THREE.Object3D();
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 5.5, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmTrunk, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crownGeo = new THREE.ConeGeometry(2.6, 1.8, 7);
  crownGeo.scale(1, 0.5, 1);
  const crownMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmLeaf, roughness: 0.8 });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    const lean = (rng() - 0.5) * 0.16;
    const s = 0.85 + rng() * 0.4;
    dummy.position.set(x, 2.75 * s, z);
    dummy.rotation.set(lean, rng() * Math.PI * 2, lean);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 5.6 * s, z);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks);
  scene.add(crowns);

  // ---- Streetlights (instanced, on the main avenues) -----------------------
  const lampSpots = [];
  for (const coord of [-116, 0, 116]) {
    for (let t = -232; t <= 232; t += 58) {
      lampSpots.push([t, coord - 8.5]);
      lampSpots.push([coord + 8.5, t]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: PALETTE.lampPost, roughness: 0.6, metalness: 0.4 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headGeo = new THREE.BoxGeometry(0.5, 0.25, 1.4);
  const headMat = new THREE.MeshStandardMaterial({
    color: '#fff2c0',
    emissive: '#ffdf80',
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 6.05, z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  poles.castShadow = true;
  scene.add(poles);
  scene.add(heads);

  // ---- Beach + sea (south edge) --------------------------------------------
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(900, 70), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.beachStart + 35);
  sand.receiveShadow = true;
  scene.add(sand);
  // Boardwalk strip between the city and the sand.
  const boardwalk = new THREE.Mesh(
    unitBox,
    new THREE.MeshStandardMaterial({ color: PALETTE.pierWood, roughness: 0.9 }),
  );
  boardwalk.scale.set(522, 0.4, 6);
  boardwalk.position.set(0, 0.2, CITY.beachStart + 3);
  boardwalk.receiveShadow = true;
  scene.add(boardwalk);

  seaTexture = makeCanvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (let y = 16; y < h; y += 32) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 18) * 5);
      ctx.stroke();
    }
  });
  seaTexture.wrapS = THREE.RepeatWrapping;
  seaTexture.wrapT = THREE.RepeatWrapping;
  seaTexture.repeat.set(14, 6);
  const seaMat = new THREE.MeshStandardMaterial({ map: seaTexture, roughness: 0.25, metalness: 0.1 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1100, 420), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0, CITY.seaStart + 210);
  scene.add(sea);

  // ---- Marina + piers + boats (east edge) ----------------------------------
  const marinaWater = new THREE.Mesh(new THREE.PlaneGeometry(110, 200), seaMat);
  marinaWater.rotation.x = -Math.PI / 2;
  marinaWater.position.set(CITY.marinaStart + 55, 0.01, 160);
  scene.add(marinaWater);
  const pierMat = new THREE.MeshStandardMaterial({ color: PALETTE.pierWood, roughness: 0.9 });
  for (const pz of [100, 160, 220]) {
    const pier = new THREE.Mesh(unitBox, pierMat);
    pier.scale.set(36, 0.5, 4);
    pier.position.set(CITY.marinaStart + 18, 0.4, pz);
    pier.castShadow = true;
    pier.receiveShadow = true;
    scene.add(pier);
  }
  const sailColors = ['#ff8a70', '#ffd166', '#7ec8e8', '#ffffff'];
  makeBoat(scene, 292, 92, Math.PI / 2, 1, sailColors[0]);
  makeBoat(scene, 296, 152, -Math.PI / 2, 1, sailColors[1]);
  makeBoat(scene, 292, 212, Math.PI / 2, 1, sailColors[2]);
  // The big yacht at the marina — the mission-4 destination.
  makeBoat(scene, 305, 175, 0, 1.9, sailColors[3]);

  // ---- Freight yard / port-industrial district (north strip) ---------------
  // Empty ground just north of road z=-232: x -200..200, z -280..-240.
  // The patch around (-170,-260) stays open ground for driving.
  const containerMats = ['#c65a3a', '#3a6ec6', '#3f8f5a', '#d88a2e', '#2e9aa8'].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.25 }),
  );
  const craneMat = new THREE.MeshStandardMaterial({ color: '#e8b93a', roughness: 0.6, metalness: 0.4 });
  const craneDarkMat = new THREE.MeshStandardMaterial({ color: '#3c4148', roughness: 0.7, metalness: 0.3 });
  const warehouseMats = [
    new THREE.MeshStandardMaterial({ color: '#7a8ba0', roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: '#a08a6a', roughness: 0.85 }),
  ];
  const roofMat = new THREE.MeshStandardMaterial({ color: '#5a5148', roughness: 0.9 });
  function addCollider(cx, cz, w, d) {
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }
  // Shipping-container stacks, 2-3 high; the open spot (-170,-260) is kept
  // clear by the spacing (nearest stack centre is ~23 m away).
  const stackSpots = [
    [-190, -272], [-110, -272], [-30, -272], [50, -272], [130, -272],
    [-190, -248], [-30, -248], [130, -248],
  ];
  for (const [sx, sz] of stackSpots) {
    const levels = 2 + Math.floor(rng() * 2);
    const mat = containerMats[Math.floor(rng() * containerMats.length)];
    for (let l = 0; l < levels; l += 1) {
      const box = new THREE.Mesh(unitBox, mat);
      box.scale.set(6, 2.6, 2.6);
      box.position.set(sx, 1.3 + l * 2.6, sz);
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
    }
    addCollider(sx, sz, 6, 2.6);
  }
  // Two gantry cranes: portal frames with a crossbeam and a hanging hook.
  function addCrane(cx, cz) {
    for (const [lx, lz] of [[-6, -2.5], [6, -2.5], [-6, 2.5], [6, 2.5]]) {
      const leg = new THREE.Mesh(unitBox, craneMat);
      leg.scale.set(1, 14, 1);
      leg.position.set(cx + lx, 7, cz + lz);
      leg.castShadow = true;
      scene.add(leg);
      addCollider(cx + lx, cz + lz, 1.2, 1.2);
    }
    for (const bz of [-2.5, 2.5]) {
      const beam = new THREE.Mesh(unitBox, craneMat);
      beam.scale.set(13.5, 1, 1.2);
      beam.position.set(cx, 14.5, cz + bz);
      beam.castShadow = true;
      scene.add(beam);
    }
    const cable = new THREE.Mesh(unitBox, craneDarkMat);
    cable.scale.set(0.18, 5, 0.18);
    cable.position.set(cx, 11.5, cz);
    scene.add(cable);
    const hook = new THREE.Mesh(unitBox, craneDarkMat);
    hook.scale.set(1.6, 1.6, 1.6);
    hook.position.set(cx, 8.2, cz);
    hook.castShadow = true;
    scene.add(hook);
  }
  addCrane(-70, -260);
  addCrane(90, -260);
  // Two warehouses: big box + a distinct flat roof slab.
  function addWarehouse(cx, cz, w, h, d, mat) {
    const shed = new THREE.Mesh(unitBox, mat);
    shed.scale.set(w, h, d);
    shed.position.set(cx, h / 2, cz);
    shed.castShadow = true;
    shed.receiveShadow = true;
    scene.add(shed);
    const roof = new THREE.Mesh(unitBox, roofMat);
    roof.scale.set(w + 1, 0.8, d + 1);
    roof.position.set(cx, h + 0.4, cz);
    roof.castShadow = true;
    scene.add(roof);
    addCollider(cx, cz, w, d);
  }
  addWarehouse(-140, -258, 24, 9, 12, warehouseMats[0]);
  addWarehouse(150, -258, 24, 9, 12, warehouseMats[1]);
  // Static box trucks: cab + cargo box, parked in the yard.
  const truckCabMat = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.6 });
  const truckBoxMats = [
    new THREE.MeshStandardMaterial({ color: '#c65a3a', roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: '#3a6ec6', roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.8 }),
  ];
  function addBoxTruck(cx, cz, heading, boxMat) {
    const truck = new THREE.Group();
    const cab = new THREE.Mesh(unitBox, truckCabMat);
    cab.scale.set(2, 2.2, 2.4);
    cab.position.set(0, 1.1, 3.4);
    cab.castShadow = true;
    truck.add(cab);
    const cargo = new THREE.Mesh(unitBox, boxMat);
    cargo.scale.set(2.4, 2.6, 4.6);
    cargo.position.set(0, 1.3, -1);
    cargo.castShadow = true;
    truck.add(cargo);
    truck.position.set(cx, 0, cz);
    truck.rotation.y = heading;
    scene.add(truck);
    // Footprint along the truck's facing: ~2.6 wide, ~7.5 long.
    const alongX = Math.abs(Math.sin(heading)) > 0.5;
    addCollider(cx, cz, alongX ? 7.5 : 2.6, alongX ? 2.6 : 7.5);
  }
  addBoxTruck(-150, -246, Math.PI / 2, truckBoxMats[0]);
  addBoxTruck(10, -274, 0, truckBoxMats[1]);
  addBoxTruck(100, -246, -Math.PI / 2, truckBoxMats[2]);

  // ---- Boardwalk district (beach, z 261..296) ------------------------------
  const stallMats = ['#ff7f6b', '#ffd166', '#7ec8e8', '#c8e8d8', '#ffc9d6', '#d6c8f0', '#ffb08a'].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  const stripeTex = makeCanvas(64, 32, (ctx, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#d94f3d';
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
  stripeTex.wrapS = THREE.RepeatWrapping;
  stripeTex.wrapT = THREE.RepeatWrapping;
  const awningMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.85 });
  const stallXs = [-120, -80, -40, 0, 40, 80, 120];
  stallXs.forEach((sx, i) => {
    const stall = new THREE.Mesh(unitBox, stallMats[i % stallMats.length]);
    stall.scale.set(3.4, 2.4, 3);
    stall.position.set(sx, 1.6, 264);
    stall.castShadow = true;
    stall.receiveShadow = true;
    scene.add(stall);
    const awning = new THREE.Mesh(unitBox, awningMat);
    awning.scale.set(3.8, 0.15, 3.6);
    awning.position.set(sx, 2.9, 264);
    awning.castShadow = true;
    scene.add(awning);
    addCollider(sx, 264, 3.4, 3);
  });
  // Pier jutting south from (0,296) to (0,325): planks + posts + end platform.
  // No collider — the player can walk out onto it. Sea collider starts z=330.
  const boardwalkPierMat = new THREE.MeshStandardMaterial({ color: PALETTE.pierWood, roughness: 0.9 });
  const pierDeck = new THREE.Mesh(unitBox, boardwalkPierMat);
  pierDeck.scale.set(4.5, 0.4, 29);
  pierDeck.position.set(0, 0.35, 310.5);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  scene.add(pierDeck);
  const pierPlatform = new THREE.Mesh(unitBox, boardwalkPierMat);
  pierPlatform.scale.set(9, 0.5, 9);
  pierPlatform.position.set(0, 0.4, 322);
  pierPlatform.castShadow = true;
  pierPlatform.receiveShadow = true;
  scene.add(pierPlatform);
  const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.2, 6);
  const postSpots = [];
  for (let z = 298; z <= 324; z += 4) {
    postSpots.push([-2.4, z]);
    postSpots.push([2.4, z]);
  }
  const pierPosts = new THREE.InstancedMesh(postGeo, pierMat, postSpots.length);
  postSpots.forEach(([px, pz], i) => {
    dummy.position.set(px, 0.4, pz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    pierPosts.setMatrixAt(i, dummy.matrix);
  });
  scene.add(pierPosts);
  // Ferris wheel at (-60,285): rim + spokes + cabins on a support frame.
  // The whole wheel turns slowly; cabins counter-rotate so they stay upright.
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#ff5a7a', roughness: 0.5, metalness: 0.3 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.6 });
  const supportMat = new THREE.MeshStandardMaterial({ color: '#3c4148', roughness: 0.6, metalness: 0.4 });
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(-60, 14, 285);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(12, 0.4, 8, 40), wheelMat);
  rim.castShadow = true;
  wheelGroup.add(rim);
  const innerRim = new THREE.Mesh(new THREE.TorusGeometry(7, 0.3, 8, 32), wheelMat);
  wheelGroup.add(innerRim);
  const spokeGeo = new THREE.BoxGeometry(0.35, 24, 0.35);
  for (let s = 0; s < 4; s += 1) {
    const spoke = new THREE.Mesh(spokeGeo, supportMat);
    spoke.rotation.z = (s * Math.PI) / 4;
    wheelGroup.add(spoke);
  }
  const cabins = [];
  for (let c = 0; c < 6; c += 1) {
    const a = (c / 6) * Math.PI * 2;
    const cabin = new THREE.Mesh(unitBox, cabinMat);
    cabin.scale.set(2, 2, 2);
    cabin.position.set(Math.cos(a) * 12, Math.sin(a) * 12, 0);
    cabin.castShadow = true;
    wheelGroup.add(cabin);
    cabins.push(cabin);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10), supportMat);
  hub.rotation.x = Math.PI / 2;
  wheelGroup.add(hub);
  scene.add(wheelGroup);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(unitBox, supportMat);
    leg.scale.set(0.8, 16, 0.8);
    leg.position.set(-60 + side * 3.4, 7, 285);
    leg.rotation.z = -side * 0.22;
    leg.castShadow = true;
    scene.add(leg);
  }
  // String lights along the boardwalk: poles + warm glowing bulbs.
  const stringPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6);
  const stringPoleMat = new THREE.MeshStandardMaterial({ color: PALETTE.lampPost, roughness: 0.6 });
  const bulbGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: '#fff2c0',
    emissive: '#ffdf80',
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });
  const stringSpots = [];
  for (let x = -200; x <= 200; x += 20) stringSpots.push([x, 262]);
  const stringPoles = new THREE.InstancedMesh(stringPoleGeo, stringPoleMat, stringSpots.length);
  const stringBulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, stringSpots.length);
  stringSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 1.7, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    stringPoles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 3.5, z);
    dummy.updateMatrix();
    stringBulbs.setMatrixAt(i, dummy.matrix);
  });
  scene.add(stringPoles);
  scene.add(stringBulbs);

  // ---- Clouds ---------------------------------------------------------------
  const cloudMat = new THREE.MeshBasicMaterial({ color: PALETTE.cloud, transparent: true, opacity: 0.92 });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 2 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.scale.set(14 + rng() * 16, 4 + rng() * 3, 8 + rng() * 6);
      puff.position.set(p * 14 - puffs * 6, (rng() - 0.5) * 2, (rng() - 0.5) * 8);
      cloud.add(puff);
    }
    cloud.position.set(-350 + rng() * 700, 110 + rng() * 60, -320 + rng() * 480);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ---- Water + world bounds as colliders ------------------------------------
  colliders.push({ minX: -600, maxX: 600, minZ: CITY.seaStart, maxZ: 900 }); // open sea
  colliders.push({ minX: CITY.marinaStart, maxX: 400, minZ: 60, maxZ: 260 }); // marina basin
  colliders.push({ minX: -600, maxX: -290, minZ: -600, maxZ: 600 });
  colliders.push({ minX: 290, maxX: 600, minZ: -600, maxZ: 60 });
  colliders.push({ minX: -600, maxX: 600, minZ: -600, maxZ: -290 });
  colliders.push({ minX: -600, maxX: 600, minZ: 290, maxZ: 600 });

  /** A random point on a random road, on the right-hand lane for its direction. */
  function randomRoadPos(rngFn) {
    const road = roads[Math.floor(rngFn() * roads.length)];
    const along = road.from + 7 + rngFn() * (road.to - road.from - 14);
    const lane = (rngFn() < 0.5 ? -1 : 1) * 3.5;
    if (road.axis === 'x') return { x: along, z: road.coord + lane, axis: 'x', coord: road.coord };
    return { x: road.coord + lane, z: along, axis: 'z', coord: road.coord };
  }

  /** The road line closest to (x, z), plus the nearest point on it. */
  function nearestRoad(x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const road of roads) {
      const d = road.axis === 'x' ? Math.abs(z - road.coord) : Math.abs(x - road.coord);
      if (d < bestDist) {
        bestDist = d;
        best = road;
      }
    }
    if (best.axis === 'x') {
      return { road: best, distance: bestDist, x: Math.max(-HALF, Math.min(HALF, x)), z: best.coord };
    }
    return { road: best, distance: bestDist, x: best.coord, z: Math.max(-HALF, Math.min(HALF, z)) };
  }

  /** Sea shimmer + slow cloud drift + ferris wheel; everything else is static. */
  function update(dt) {
    if (seaTexture) seaTexture.offset.x += dt * 0.008;
    for (const cloud of clouds) {
      cloud.position.x += dt * 2.2;
      if (cloud.position.x > 420) cloud.position.x = -420;
    }
    // Ferris wheel turns slowly; cabins counter-rotate to stay upright.
    wheelGroup.rotation.z += dt * 0.12;
    for (const cabin of cabins) cabin.rotation.z = -wheelGroup.rotation.z;
  }

  return {
    roads,
    colliders,
    update,
    randomRoadPos,
    nearestRoad,
    buildingCount,
    districts: {
      freightYard: { x: -170, z: -260 },
      boardwalk: { x: 0, z: 264 },
      pier: { x: 0, z: 318 },
      // v3: the Old Town quarter (west blocks) and the lighthouse on the
      // south-west beach. oldtown.js re-asserts these when it builds.
      // coralClub / penthouse are the ROADSIDE markers (the tower itself
      // stands at block centre (29,29) inside a building collider).
      oldTown: { x: -203, z: -58 },
      lighthouse: { x: -270, z: 300 },
      coralClub: { x: 58, z: 29 },
      penthouse: { x: 51, z: 29 },
      safehouse: { x: -174, z: 232 },
    },
  };
}
