import * as THREE from 'three';

// The casino on the strip: a glowing building plus a slots side game.
// Slots are pure in-game fun — spend a little cash, spin, win a little back.
const CASINO_POS = { x: 174, z: -116 };
const SPIN_COST = 20;
const SLOT_SYMBOLS = ['7', 'BAR', 'CHERRY', 'BELL', 'LEMON', 'STAR'];

function readCash(world) {
  if (world.player && typeof world.player.cash === 'number') return world.player.cash;
  return typeof world.cash === 'number' ? world.cash : 0;
}

function addCash(world, amount) {
  const next = readCash(world) + amount;
  if (world.player) world.player.cash = next;
  world.cash = next;
  return next;
}

function playerPos(world) {
  const p = world.player && world.player.position;
  if (!p) return null;
  return { x: p.x, y: p.y || 0, z: p.z };
}

function toast(world, text) {
  if (typeof world.toast === 'function') world.toast(text);
}

function keyDown(world, code) {
  const input = world.input;
  if (!input) return false;
  if (input.pressed && typeof input.pressed.has === 'function') return input.pressed.has(code);
  if (input.keys && typeof input.keys.has === 'function') return input.keys.has(code);
  return !!input[code];
}

export function createCasino(world) {
  let spins = 0;
  let won = 0;
  let spent = 0;
  let biggestWin = 0;
  let near = false;
  let wasNear = false;
  let spinCooldown = 0;
  let lastResult = null;
  let signMesh = null;
  let lightTimer = 0;

  if (world.scene) {
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(36, 26, 24),
      new THREE.MeshStandardMaterial({ color: 0x7a1f5c, roughness: 0.6, metalness: 0.2 }),
    );
    building.position.set(CASINO_POS.x, 13, CASINO_POS.z);
    world.scene.add(building);
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(14, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.5 }),
    );
    tower.position.set(CASINO_POS.x, 35, CASINO_POS.z);
    world.scene.add(tower);
    signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(20, 4, 1),
      new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
    );
    signMesh.position.set(CASINO_POS.x, 27, CASINO_POS.z + 13);
    world.scene.add(signMesh);
    const doorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd76a }),
    );
    doorGlow.position.set(CASINO_POS.x, 3, CASINO_POS.z + 12.2);
    world.scene.add(doorGlow);
  }

  function rollSlots() {
    const pick = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    const reels = [pick(), pick(), pick()];
    let payout = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      payout = reels[0] === '7' ? 200 : 100;
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      payout = 30;
    } else if (reels.includes('STAR')) {
      payout = 10;
    }
    return { reels, payout };
  }

  function spin() {
    if (spinCooldown > 0) return null;
    if (readCash(world) < SPIN_COST) {
      toast(world, 'Not enough cash to spin the slots ($20).');
      return null;
    }
    addCash(world, -SPIN_COST);
    spent += SPIN_COST;
    spins += 1;
    const result = rollSlots();
    lastResult = result;
    if (result.payout > 0) {
      addCash(world, result.payout);
      won += result.payout;
      const isRecord = result.payout > biggestWin;
      if (isRecord) biggestWin = result.payout;
      toast(world, `Slots: ${result.reels.join(' | ')} — you win $${result.payout}!${isRecord && result.payout >= 100 ? ' New biggest win!' : ''}`);
    } else {
      toast(world, `Slots: ${result.reels.join(' | ')} — no luck this time.`);
    }
    if (Array.isArray(world.events)) {
      world.events.push({ type: 'casino-spin', payout: result.payout, reels: result.reels });
    }
    spinCooldown = 0.8;
    return result;
  }

  function update(dt) {
    spinCooldown = Math.max(0, spinCooldown - dt);
    lightTimer += dt;
    if (signMesh) {
      // The neon sign pulses gently so the casino reads at a glance.
      const pulse = 0.75 + Math.sin(lightTimer * 3) * 0.25;
      signMesh.material.color.setRGB(1 * pulse, 0.18 * pulse, 0.53 * pulse);
    }
    const p = playerPos(world);
    if (!p) return;
    const d = Math.hypot(CASINO_POS.x - p.x, CASINO_POS.z - p.z);
    near = d < 16;
    if (near && !wasNear) {
      toast(world, 'Solmar Casino — press G to play the slots ($20 a spin).');
    }
    wasNear = near;
    if (near && keyDown(world, 'KeyG')) {
      spin();
    }
  }

  return {
    update,
    spin,
    isNear() { return near; },
    getPosition() { return { ...CASINO_POS }; },
    getStats() { return { spins, won, spent, biggestWin, lastResult }; },
    getSpinCost() { return SPIN_COST; },
  };
}
