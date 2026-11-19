// Shops for Solmar City — a roadside store (health + ammo) and a safehouse
// (save + heal + lose the cops). Both are on-foot only: walk within 6 m and
// the HUD prompt tells you the keys. Q buys, R buys ammo at the shop.
//
// Prices: health $150 (full heal), ammo $100 (refill to 24), safehouse
// $300 (save + full heal + wanted cleared) with a 60 s cooldown.
// Cash comes from world.cash and is synced back to world.player.cash.
// Every cross-system call is guarded: no combat system, no save system,
// no HUD — the shop still shows its sign and never throws.
import * as THREE from 'three';

export const SHOP_POS = { x: 58, z: 116 };
export const SAFEHOUSE_POS = { x: -174, z: 232 };
export const SHOP_RANGE = 6; // metres: close enough to buy
export const HEALTH_PRICE = 150;
export const AMMO_PRICE = 100;
export const SAFEHOUSE_PRICE = 300;
export const SAFEHOUSE_COOLDOWN = 60; // seconds between safehouse uses
export const AMMO_FULL = 24;
// v3 — the shop's new stock. Rifle rounds cost more than pistol rounds
// (the R key charges by the weapon Rico is holding); a NOS canister
// refills the boost tank outright, and the vest soaks half of every
// hit until its 100 durability runs out (combat.js spends it).
export const RIFLE_AMMO_PRICE = 150;
export const NOS_PRICE = 80;
export const ARMOR_PRICE = 250;
export const ARMOR_DURABILITY = 100;
const AMMO_PRICES = { pistol: 100, smg: 100, shotgun: 100, rifle: 150 };

const SAVE_KEY = 'solmar-city-save-v1';

function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function makeBeaconDisc(color) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 24), mat);
  disc.position.y = 0.12;
  return { disc, mat };
}

function makeShopSign(scene, pos) {
  const group = new THREE.Group();
  // Pole.
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 3.2, 0.25),
    new THREE.MeshBasicMaterial({ color: 0x333333 }),
  );
  pole.position.y = 1.6;
  group.add(pole);
  // Green cross: two boxes, the classic pharmacy / clinic sign.
  const crossMat = new THREE.MeshBasicMaterial({ color: 0x2ecc40 });
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.2), crossMat);
  barV.position.y = 3.6;
  const barH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.2), crossMat);
  barH.position.y = 3.6;
  group.add(barV, barH);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  return group;
}

function makeSafehouseSign(scene, pos) {
  // A small blue roof-sign box on the house side of the safehouse spot.
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x2f7de1 }),
  );
  box.position.set(pos.x, 2.8, pos.z);
  scene.add(box);
  return box;
}

export function createShops(scene, world) {
  const shopPos = new THREE.Vector3(SHOP_POS.x, 0, SHOP_POS.z);
  const safehousePos = new THREE.Vector3(SAFEHOUSE_POS.x, 0, SAFEHOUSE_POS.z);

  // Shop dressing: sign + cyan beacon disc on the ground.
  makeShopSign(scene, shopPos);
  const shopBeacon = makeBeaconDisc(0x22d3ee);
  shopBeacon.disc.position.set(shopPos.x, 0.12, shopPos.z);
  scene.add(shopBeacon.disc);
  // Safehouse dressing: blue beacon disc + roof sign.
  const safeBeacon = makeBeaconDisc(0x2f7de1);
  safeBeacon.disc.position.set(safehousePos.x, 0.12, safehousePos.z);
  scene.add(safeBeacon.disc);
  makeSafehouseSign(scene, safehousePos);

  const state = {
    shopPos,
    safehousePos,
    lastSafehouseAt: -Infinity,
  };

  // Edge-trigger memory: holding Q must buy once, not once per frame.
  let qWasDown = false;
  let rWasDown = false;
  // v3: the same edge memory for the new stock — B (NOS) and V (vest).
  let bWasDown = false;
  let vWasDown = false;

  function say(text) {
    try {
      if (world.hud && typeof world.hud.showMessage === 'function') world.hud.showMessage(text);
    } catch {
      // HUD is optional.
    }
  }

  function setPrompt(text) {
    try {
      if (world.hud && typeof world.hud.setPrompt === 'function') world.hud.setPrompt(text);
    } catch {
      // HUD is optional.
    }
  }

  function jingle() {
    try {
      if (world.audio && typeof world.audio.jingle === 'function') world.audio.jingle();
    } catch {
      // Audio is optional.
    }
  }

  function pay(price) {
    if ((world.cash || 0) < price) {
      say(`Not enough cash — $${price} needed.`);
      return false;
    }
    world.cash -= price;
    if (world.player) world.player.cash = world.cash;
    return true;
  }

  function buyHealth() {
    if (!pay(HEALTH_PRICE)) return;
    if (world.player) world.player.health = 100;
    jingle();
    say('Patched up — full health.');
  }

  function buyAmmo() {
    // v3 — rifle rounds cost more: the price follows the weapon Rico
    // is holding (pistol / SMG / shotgun $100, rifle $150).
    let price = AMMO_PRICE;
    try {
      const combat = world.systems && world.systems.combat;
      const weapon = combat && combat.state ? combat.state.weapon : null;
      if (weapon && AMMO_PRICES[weapon] !== undefined) price = AMMO_PRICES[weapon];
    } catch {
      price = AMMO_PRICE;
    }
    if (!pay(price)) return;
    let refilled = false;
    try {
      const combat = world.systems && world.systems.combat;
      if (combat && typeof combat.buyAmmo === 'function') {
        combat.buyAmmo();
        refilled = true;
      }
    } catch {
      refilled = false;
    }
    // Fallback when combat has no buyAmmo yet: refill the player's count.
    if (!refilled) {
      if (world.player) world.player.ammo = AMMO_FULL;
      try {
        const combat = world.systems && world.systems.combat;
        if (combat && combat.state) combat.state.ammo = AMMO_FULL;
      } catch {
        // Combat state is optional.
      }
    }
    jingle();
    say(`Ammo restocked — $${price}.`);
  }

  // v3 — NOS canister: refills the boost tank to full on the spot.
  function buyNos() {
    if (!pay(NOS_PRICE)) return;
    if (world.player) world.player.nos = 1;
    jingle();
    say('NOS tank full — go burn it.');
  }

  // v3 — armour vest: 100 durability, soaks half of every hit until it
  // breaks (combat.js spends it in hurtPlayer). Buying a fresh vest
  // while one is worn replaces it.
  function buyArmor() {
    if (!pay(ARMOR_PRICE)) return;
    if (world.player) world.player.armor = ARMOR_DURABILITY;
    jingle();
    say('Armour vest on — half of every hit, until it breaks.');
  }

  function saveGame() {
    // Prefer the real save system; fall back to writing the same blob by hand.
    try {
      const saveSystem = world.systems && world.systems.save;
      if (saveSystem && typeof saveSystem.save === 'function') return saveSystem.save(world);
    } catch {
      // Fall through to the direct write.
    }
    try {
      if (world.save && typeof world.save.save === 'function') return world.save.save(world);
    } catch {
      // Fall through to the direct write.
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify({
          cash: Math.floor(world.cash || 0),
          missionsDone: Array.isArray(world.missionsDone) ? [...world.missionsDone] : [],
          playerPos: { x: world.player.pos.x, z: world.player.pos.z },
          wanted: 0,
        }));
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function useSafehouse() {
    const now = world.time || 0;
    const left = SAFEHOUSE_COOLDOWN - (now - state.lastSafehouseAt);
    if (left > 0) {
      say(`Safehouse cooling down — ${Math.ceil(left)}s left.`);
      return;
    }
    if (!pay(SAFEHOUSE_PRICE)) return;
    state.lastSafehouseAt = now;
    if (world.player) world.player.health = 100;
    world.wanted = 0;
    try {
      const police = world.systems && world.systems.police;
      if (police && typeof police.clearWanted === 'function') police.clearWanted();
    } catch {
      // Wanted is already 0 above.
    }
    const saved = saveGame();
    jingle();
    say(saved ? 'Safehouse — saved, healed, heat gone.' : 'Safehouse — healed, heat gone. (Save did not stick.)');
  }

  function update(dt) {
    // Pulse the beacon discs so the two spots read from down the street.
    try {
      const t = world.time || 0;
      const pulse = 0.55 + 0.3 * Math.sin((2 * Math.PI * t) / 1.5);
      shopBeacon.mat.opacity = pulse;
      safeBeacon.mat.opacity = pulse;
    } catch {
      // Cosmetic only.
    }

    const player = world.player;
    const keys = world.input && world.input.keys;
    if (!player || !player.pos || !keys) {
      qWasDown = false;
      rWasDown = false;
      bWasDown = false;
      vWasDown = false;
      return;
    }

    // On foot only: no shopping from the driver's seat.
    if (!player.onFoot) {
      setPrompt('');
      qWasDown = keys.has('KeyQ');
      rWasDown = keys.has('KeyR');
      bWasDown = keys.has('KeyB');
      vWasDown = keys.has('KeyV');
      return;
    }

    const nearShop = distXZ(player.pos, shopPos) <= SHOP_RANGE;
    const nearSafe = distXZ(player.pos, safehousePos) <= SHOP_RANGE;
    const qDown = keys.has('KeyQ');
    const rDown = keys.has('KeyR');
    const bDown = keys.has('KeyB');
    const vDown = keys.has('KeyV');

    if (nearShop) {
      // v3 — the full shelf: health, ammo (priced by weapon), NOS, vest.
      setPrompt('Q: Health $150 · R: Ammo $100 · B: NOS $80 · V: Vest $250');
      if (qDown && !qWasDown) buyHealth();
      if (rDown && !rWasDown) buyAmmo();
      if (bDown && !bWasDown) buyNos();
      if (vDown && !vWasDown) buyArmor();
    } else if (nearSafe) {
      const now = world.time || 0;
      const left = SAFEHOUSE_COOLDOWN - (now - state.lastSafehouseAt);
      setPrompt(left > 0
        ? `Safehouse — cooling down (${Math.ceil(left)}s)`
        : 'Q: Save + Heal $300');
      if (qDown && !qWasDown) useSafehouse();
    } else {
      setPrompt('');
    }

    qWasDown = qDown;
    rWasDown = rDown;
    bWasDown = bDown;
    vWasDown = vDown;
  }

  return { update, state };
}
