// Old Town — Solmar's historic quarter — and the lighthouse.
//
// The quarter fills the two west blocks the city leaves empty
// (x -232..-174, z -116..0, around block centres (-203,-87) and
// (-203,-29)): a cobbled plaza with a fountain, the cathedral of Santa
// Marina at its heart, and narrow townhouse lanes around it. The
// lighthouse stands apart on the south-west beach (-270, 300), its beam
// sweeping the coast all night.
//
//   createOldTown(scene, world) -> { update, state }
// The factory registers the district spots on world.city.districts
// (oldTown, lighthouse) so missions and the HUD minimap can find them,
// and pushes the cathedral / townhouse footprints into the city's
// collider list so cars and the player cannot drive through the walls.
// city.js skips its own buildings on these two blocks; the sidewalks
// stay, and the plaza sits just above them.
import * as THREE from 'three';

export const OLD_TOWN_RECT = { minX: -232, maxX: -174, minZ: -116, maxZ: 0 };
export const OLD_TOWN_CENTRE = { x: -203, z: -58 };
export const CATHEDRAL_POS = { x: -203, z: -58 };
export const LIGHTHOUSE_POS = { x: -270, z: 300 };
export const PLAZA_RADIUS = 26;

const BEAM_SPEED = 0.55; // radians per second — one sweep every ~11 s
const FOUNTAIN_SPOTS = [
  { x: -203, z: -58 },
];

function cobbleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b8a888';
  ctx.fillRect(0, 0, 256, 256);
  // Rough cobbles: jittered rounded stones in two warm greys.
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const shade = 150 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgb(${shade}, ${shade - 12}, ${shade - 42})`;
      const jx = (Math.random() - 0.5) * 6;
      const jy = (Math.random() - 0.5) * 6;
      ctx.beginPath();
      ctx.ellipse(x * 32 + 16 + jx, y * 32 + 16 + jy, 13, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeTownhouse(w, h, d, color) {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x9a4a3a, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  // Pitched roof: a squashed prism from a rotated box, plus a chimney.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1.2, d + 0.6), roofMat);
  roof.position.y = h + 0.5;
  roof.rotation.z = 0.12;
  roof.castShadow = true;
  group.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), wallMat);
  chimney.position.set(w / 4, h + 1.4, 0);
  group.add(chimney);
  // Shuttered windows: dark inset boxes on the street face.
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.4 });
  const floors = Math.max(1, Math.floor(h / 4));
  for (let f = 0; f < floors; f += 1) {
    for (const sx of [-w / 4, w / 4]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.15), winMat);
      win.position.set(sx, 2.2 + f * 3.4, d / 2 + 0.05);
      group.add(win);
    }
  }
  return group;
}

export function createOldTown(scene, world) {
  const state = {
    beamAngle: 0,
    fountainPhase: 0,
    plaza: { ...OLD_TOWN_CENTRE },
    lighthouse: { ...LIGHTHOUSE_POS },
  };

  // District spots for the rest of the game (missions, HUD minimap).
  try {
    if (world.city) {
      world.city.districts = world.city.districts || {};
      world.city.districts.oldTown = { x: OLD_TOWN_CENTRE.x, z: OLD_TOWN_CENTRE.z };
      world.city.districts.lighthouse = { x: LIGHTHOUSE_POS.x, z: LIGHTHOUSE_POS.z };
    }
  } catch {
    // Districts are a convenience; a missing city never blocks the quarter.
  }

  function addCollider(minX, maxX, minZ, maxZ) {
    try {
      if (world.city && Array.isArray(world.city.colliders)) {
        world.city.colliders.push({ minX, maxX, minZ, maxZ });
      }
    } catch {
      // No collider list, no collision — the meshes still show.
    }
  }

  // --- cobbled plaza ------------------------------------------------------
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(58, 116),
    new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 1 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(OLD_TOWN_CENTRE.x, 0.32, OLD_TOWN_CENTRE.z);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // Narrow lanes: darker cobble strips crossing the plaza north-south and
  // east-west, so the quarter reads as streets, not one flat slab.
  const laneMat = new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 1 });
  const laneNS = new THREE.Mesh(new THREE.PlaneGeometry(7, 116), laneMat);
  laneNS.rotation.x = -Math.PI / 2;
  laneNS.position.set(-203, 0.34, -58);
  laneNS.receiveShadow = true;
  scene.add(laneNS);
  const laneEW = new THREE.Mesh(new THREE.PlaneGeometry(58, 7), laneMat);
  laneEW.rotation.x = -Math.PI / 2;
  laneEW.position.set(-203, 0.34, -58);
  laneEW.receiveShadow = true;
  scene.add(laneEW);

  // --- fountain -----------------------------------------------------------
  const fountain = new THREE.Group();
  const basinMat = new THREE.MeshStandardMaterial({ color: 0x9aa4a8, roughness: 0.6 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 1.1, 20), basinMat);
  basin.position.y = 0.55;
  basin.castShadow = true;
  fountain.add(basin);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3fa8c9,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.25, 20), waterMat);
  water.position.y = 1.0;
  fountain.add(water);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 10), basinMat);
  spout.position.y = 1.8;
  fountain.add(spout);
  const spoutTop = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), basinMat);
  spoutTop.position.y = 3.0;
  fountain.add(spoutTop);
  fountain.position.set(FOUNTAIN_SPOTS[0].x, 0.32, FOUNTAIN_SPOTS[0].z + 14);
  scene.add(fountain);
  addCollider(-208, -198, -47, -37);

  // --- cathedral of Santa Marina ------------------------------------------
  const cathedral = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.85 });
  const nave = new THREE.Mesh(new THREE.BoxGeometry(16, 14, 26), stoneMat);
  nave.position.y = 7;
  nave.castShadow = true;
  nave.receiveShadow = true;
  cathedral.add(nave);
  // Twin bell towers flanking the west face, with arched openings.
  for (const sx of [-9.5, 9.5]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 26, 5), stoneMat);
    tower.position.set(sx, 13, 11);
    tower.castShadow = true;
    cathedral.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.8, 5, 4), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.8 }));
    cap.position.set(sx, 28.5, 11);
    cap.rotation.y = Math.PI / 4;
    cathedral.add(cap);
    const bell = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.4 }),
    );
    bell.position.set(sx, 20, 13.6);
    cathedral.add(bell);
  }
  // Rose window: a gold-ringed disc on the west face.
  const rose = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 0.3, 20),
    new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.3, metalness: 0.4, emissive: 0x442200, emissiveIntensity: 0.4 }),
  );
  rose.rotation.x = Math.PI / 2;
  rose.position.set(0, 10.5, 13.2);
  cathedral.add(rose);
  // Stepped gable roof over the nave.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 2.5, 27), new THREE.MeshStandardMaterial({ color: 0x8a5a44, roughness: 0.85 }));
  roof.position.y = 15;
  cathedral.add(roof);
  cathedral.position.set(CATHEDRAL_POS.x, 0.32, CATHEDRAL_POS.z - 18);
  scene.add(cathedral);
  addCollider(CATHEDRAL_POS.x - 13, CATHEDRAL_POS.x + 13, CATHEDRAL_POS.z - 32, CATHEDRAL_POS.z - 4);

  // --- townhouses ringing the plaza ---------------------------------------
  const houseColors = [0xe8c9a0, 0xd8a0a0, 0xa8c8b0, 0xc8b8e0, 0xe8d8a8, 0xb0c8d8];
  const houseSpots = [
    { x: -224, z: -104, w: 12, h: 9, d: 10, ry: 0 },
    { x: -224, z: -78, w: 11, h: 12, d: 10, ry: 0 },
    { x: -224, z: -38, w: 12, h: 8, d: 10, ry: 0 },
    { x: -224, z: -12, w: 11, h: 11, d: 10, ry: 0 },
    { x: -182, z: -104, w: 12, h: 10, d: 10, ry: 0 },
    { x: -182, z: -78, w: 11, h: 8, d: 10, ry: 0 },
    { x: -182, z: -38, w: 12, h: 12, d: 10, ry: 0 },
    { x: -182, z: -12, w: 11, h: 9, d: 10, ry: 0 },
    { x: -214, z: -110, w: 10, h: 9, d: 9, ry: Math.PI / 2 },
    { x: -192, z: -110, w: 10, h: 11, d: 9, ry: Math.PI / 2 },
    { x: -214, z: -6, w: 10, h: 10, d: 9, ry: Math.PI / 2 },
    { x: -192, z: -6, w: 10, h: 8, d: 9, ry: Math.PI / 2 },
  ];
  houseSpots.forEach((spot, i) => {
    const house = makeTownhouse(spot.w, spot.h, spot.d, houseColors[i % houseColors.length]);
    house.position.set(spot.x, 0.32, spot.z);
    house.rotation.y = spot.ry;
    scene.add(house);
    const hw = spot.ry === 0 ? spot.w / 2 : spot.d / 2;
    const hd = spot.ry === 0 ? spot.d / 2 : spot.w / 2;
    addCollider(spot.x - hw, spot.x + hw, spot.z - hd, spot.z + hd);
  });

  // Old Town street lamps: warm globes on short posts, lit by daynight.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.6 });
  const globeMat = new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc94d, emissiveIntensity: 0.6 });
  const lampSpots = [
    { x: -216, z: -90 },
    { x: -190, z: -90 },
    { x: -216, z: -26 },
    { x: -190, z: -26 },
  ];
  for (const spot of lampSpots) {
    const lamp = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8), lampMat);
    post.position.y = 1.7;
    lamp.add(post);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), globeMat);
    globe.position.y = 3.55;
    lamp.add(globe);
    lamp.position.set(spot.x, 0.32, spot.z);
    scene.add(lamp);
  }

  // --- market stalls on the plaza's north edge ----------------------------
  // Four awning stalls selling fruit, flowers, bread and fish — the
  // quarter's morning market. Each one is a counter box, a striped
  // awning on poles, and a crate of coloured goods.
  const stallGoods = [0xe8533a, 0xff7fb0, 0xe8c860, 0x4dc3ff];
  const stallSpots = [
    { x: -216, z: -100, ry: 0.35 },
    { x: -208, z: -100, ry: -0.2 },
    { x: -198, z: -100, ry: 0.15 },
    { x: -190, z: -100, ry: -0.35 },
  ];
  stallSpots.forEach((spot, i) => {
    const stall = new THREE.Group();
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.9 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 1.6), counterMat);
    counter.position.y = 0.55;
    counter.castShadow = true;
    stall.add(counter);
    const goodsMat = new THREE.MeshStandardMaterial({ color: stallGoods[i], roughness: 0.7 });
    for (const gx of [-0.9, 0, 0.9]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.9), goodsMat);
      crate.position.set(gx, 1.35, 0);
      crate.castShadow = true;
      stall.add(crate);
    }
    // Striped awning: alternating cream / terracotta panels on poles.
    const poleMatStall = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
    for (const px of [-1.4, 1.4]) {
      for (const pz of [-0.7, 0.7]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), poleMatStall);
        pole.position.set(px, 1.2, pz);
        stall.add(pole);
      }
    }
    for (let s = 0; s < 6; s += 1) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.08, 1.9),
        new THREE.MeshStandardMaterial({ color: s % 2 === 0 ? 0xf2ede2 : 0xc25a3a, roughness: 0.85 }),
      );
      panel.position.set(-1.4 + s * 0.56, 2.45, 0);
      panel.rotation.z = 0.12;
      stall.add(panel);
    }
    stall.position.set(spot.x, 0.32, spot.z);
    stall.rotation.y = spot.ry;
    scene.add(stall);
    addCollider(spot.x - 1.8, spot.x + 1.8, spot.z - 1.2, spot.z + 1.2);
  });

  // --- lighthouse on the south-west beach ---------------------------------
  const lighthouse = new THREE.Group();
  const stripeRed = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.7 });
  const stripeWhite = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.7 });
  const segH = 4.5;
  for (let s = 0; s < 4; s += 1) {
    const rBottom = 3.4 - s * 0.55;
    const rTop = 3.4 - (s + 1) * 0.55;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, segH, 16),
      s % 2 === 0 ? stripeWhite : stripeRed,
    );
    seg.position.y = 2.25 + s * segH;
    seg.castShadow = true;
    lighthouse.add(seg);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.5, 16), stripeWhite);
  gallery.position.y = 18.6;
  lighthouse.add(gallery);
  const lampRoomMat = new THREE.MeshStandardMaterial({
    color: 0xffe9a0,
    emissive: 0xffd34d,
    emissiveIntensity: 1.6,
    transparent: true,
    opacity: 0.9,
  });
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 12), lampRoomMat);
  lampRoom.position.y = 20.2;
  lighthouse.add(lampRoom);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 2.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.5 }),
  );
  cap.position.y = 22.6;
  lighthouse.add(cap);
  // The rotating beam: a long translucent wedge pivoting at lamp height.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 20.2;
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 55, 12, 1, true), beamMat);
  beam.rotation.z = -Math.PI / 2; // cone apex at the pivot, base 55 m out along +X
  beam.position.x = 27.5;
  beamPivot.add(beam);
  const beamBack = beam.clone();
  beamBack.rotation.z = Math.PI / 2;
  beamBack.position.x = -27.5;
  beamPivot.add(beamBack);
  lighthouse.add(beamPivot);
  // Rocky base so the tower reads as standing on the shore, not floating.
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 7, 2.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x7a7a72, roughness: 1 }),
  );
  rock.position.y = 0.4;
  lighthouse.add(rock);
  lighthouse.position.set(LIGHTHOUSE_POS.x, 0, LIGHTHOUSE_POS.z);
  scene.add(lighthouse);
  addCollider(LIGHTHOUSE_POS.x - 7, LIGHTHOUSE_POS.x + 7, LIGHTHOUSE_POS.z - 7, LIGHTHOUSE_POS.z + 7);

  function update(dt) {
    const capped = Math.min(dt || 0, 0.1);
    state.beamAngle = (state.beamAngle + BEAM_SPEED * capped) % (Math.PI * 2);
    beamPivot.rotation.y = state.beamAngle;
    // The beam is brightest after dark and faintest at noon.
    const night = world.systems && world.systems.daynight
      ? world.systems.daynight.nightFactor()
      : 0;
    beamMat.opacity = 0.08 + night * 0.3;
    lampRoomMat.emissiveIntensity = 0.7 + night * 1.8;
    // Fountain water shimmers gently.
    state.fountainPhase += capped;
    water.position.y = 1.0 + Math.sin(state.fountainPhase * 1.4) * 0.05;
    waterMat.opacity = 0.8 + Math.sin(state.fountainPhase * 1.4) * 0.05;
  }

  return { update, state, plaza: state.plaza, lighthouse: state.lighthouse };
}
