// input.js — Solmar City input: keyboard + mouse for the full key set.
// CRITICAL: every movement key is stored in BOTH forms — 'KeyW' and 'W',
// 'KeyA'/'A', 'KeyS'/'S', 'KeyD'/'D', 'Space', 'ShiftLeft'/'Shift' —
// because the game reads both forms in different systems.

const DUAL_KEYS = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift',
};

export function createInput(world) {
  if (!world.input) world.input = { keys: new Set(), pressed: new Set(), mouse: { x: 0, y: 0, dx: 0, dy: 0, right: false, left: false } };
  if (!world.input.keys) world.input.keys = new Set();
  if (!world.input.pressed) world.input.pressed = new Set();
  if (!world.input.mouse) world.input.mouse = { x: 0, y: 0, dx: 0, dy: 0, right: false, left: false };

  const keys = world.input.keys;
  const pressed = world.input.pressed;
  const mouse = world.input.mouse;

  function addKey(code) {
    keys.add(code);
    const dual = DUAL_KEYS[code];
    if (dual) keys.add(dual);
    // A bare single-letter code also gets its Key form, so 'W' adds 'KeyW'.
    if (/^[WASD]$/.test(code)) keys.add('Key' + code);
    if (code === 'Shift') { keys.add('ShiftLeft'); keys.add('ShiftRight'); }
  }

  function deleteKey(code) {
    keys.delete(code);
    const dual = DUAL_KEYS[code];
    if (dual) keys.delete(dual);
    if (/^[WASD]$/.test(code)) keys.delete('Key' + code);
    if (code === 'Shift') { keys.delete('ShiftLeft'); keys.delete('ShiftRight'); }
  }

  function onKeyDown(e) {
    if (e.repeat) { addKey(e.code); return; }
    addKey(e.code);
    pressed.add(e.code);
    const dual = DUAL_KEYS[e.code];
    if (dual) pressed.add(dual);
    if (/^[WASD]$/.test(e.code)) pressed.add('Key' + e.code);
    // Game keys must not scroll the page or trigger browser shortcuts.
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }

  function onKeyUp(e) {
    deleteKey(e.code);
    pressed.delete(e.code);
    const dual = DUAL_KEYS[e.code];
    if (dual) pressed.delete(dual);
  }

  function onMouseMove(e) {
    mouse.dx = e.movementX || 0;
    mouse.dy = e.movementY || 0;
    mouse.x = e.clientX; mouse.y = e.clientY;
  }

  function onMouseDown(e) {
    if (e.button === 0) { mouse.left = true; pressed.add('MouseLeft'); keys.add('MouseLeft'); }
    if (e.button === 2) { mouse.right = true; pressed.add('MouseRight'); keys.add('MouseRight'); } // right-click: sniper zoom
  }

  function onMouseUp(e) {
    if (e.button === 0) { mouse.left = false; keys.delete('MouseLeft'); }
    if (e.button === 2) { mouse.right = false; keys.delete('MouseRight'); }
  }

  function onContextMenu(e) { e.preventDefault(); }
  function onBlur() { keys.clear(); pressed.clear(); mouse.left = false; mouse.right = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('blur', onBlur);

  function isPressed(code) { return keys.has(code); }
  function wasPressed(code) { return pressed.has(code); }
  function axis() {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('W') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('S') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('D') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('A') || keys.has('ArrowLeft')) x -= 1;
    return { x, y };
  }

  function update(dt) {
    void dt;
    // Edge-triggered presses live for exactly one frame.
    pressed.clear();
    mouse.dx = 0; mouse.dy = 0;
    world.input.isPressed = isPressed;
    world.input.wasPressed = wasPressed;
    world.input.axis = axis;
  }

  // Full reset (used on respawn and when the menu re-opens).
  function reset() {
    keys.clear();
    pressed.clear();
    mouse.left = false; mouse.right = false;
    mouse.dx = 0; mouse.dy = 0;
  }

  const sys = {
    name: 'input',
    update,
    isPressed,
    wasPressed,
    axis,
    reset,
    get keys() { return keys; },
    get mouse() { return mouse; },
    // Full key reference for the help screen / HUD.
    bindings: {
      move: 'W A S D / arrows', sprint: 'Shift', jump: 'Space',
      enterVehicle: 'F / E', punch: 'Q', weapons: '1-5, R reload',
      radio: 'C', mute: 'M', pause: 'P', nos: 'Shift while driving',
      wheelie: 'Shift while biking', hydraulics: 'H in a Lowrider',
      buyProperty: 'B', garage: 'G', interact: 'E', sniperZoom: 'Right-click',
    },
  };
  world.input.isPressed = isPressed;
  world.input.wasPressed = wasPressed;
  world.input.axis = axis;
  return sys;
}
