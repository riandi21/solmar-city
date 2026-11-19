// Input for Solmar City: keyboard and mouse state, exposed on world.input.
// Movement is WASD or arrows, Shift sprints on foot, boosts NOS while
// driving and pops a wheelie on a bike, Space jumps, E enters or exits a
// vehicle, F punches, number keys swap weapons, C changes the radio,
// M mutes, P or Escape pauses, B buys a property, click shoots and
// right-click zooms the sniper scope.
export function createInput(world) {
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    justReleased: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    mouseX: 0,
    mouseY: 0,
    clicked: false,
    rightHeld: false,
    rightClicked: false,
    wheel: 0,
  };

  const GAME_KEYS = [
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'ShiftLeft', 'ShiftRight',
  ];

  function onKeyDown(event) {
    if (GAME_KEYS.includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      input.keys.add(event.code);
      input.justPressed.add(event.code);
    }
  }

  function onKeyUp(event) {
    input.keys.delete(event.code);
    input.justReleased.add(event.code);
  }

  function onMouseMove(event) {
    input.mouseDX += event.movementX || 0;
    input.mouseDY += event.movementY || 0;
    input.mouseX = event.clientX;
    input.mouseY = event.clientY;
  }

  function onMouseDown(event) {
    if (event.button === 0) input.clicked = true;
    if (event.button === 2) {
      input.rightHeld = true;
      input.rightClicked = true;
    }
  }

  function onMouseUp(event) {
    if (event.button === 2) input.rightHeld = false;
  }

  function onWheel(event) {
    input.wheel += event.deltaY;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onBlur() {
    input.keys.clear();
    input.rightHeld = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('blur', onBlur);
  if (world.renderer && world.renderer.domElement) {
    world.renderer.domElement.addEventListener('contextmenu', onContextMenu);
  } else if (world.canvas) {
    world.canvas.addEventListener('contextmenu', onContextMenu);
  }

  input.isDown = function isDown(code) {
    return input.keys.has(code);
  };

  input.wasPressed = function wasPressed(code) {
    return input.justPressed.has(code);
  };

  // Edge-triggered actions (buying, entering a car) should fire once
  // even if two systems both check the same press in one frame.
  input.consumePressed = function consumePressed(code) {
    if (!input.justPressed.has(code)) return false;
    input.justPressed.delete(code);
    return true;
  };

  input.moveX = function moveX() {
    let x = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    return x;
  };

  input.moveY = function moveY() {
    let y = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
    return y;
  };

  input.forwardAmount = function forwardAmount() {
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) return 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) return -1;
    return 0;
  };

  input.update = function update() {
    input.justPressed.clear();
    input.justReleased.clear();
    input.mouseDX = 0;
    input.mouseDY = 0;
    input.clicked = false;
    input.rightClicked = false;
    input.wheel = 0;
  };

  world.input = input;
  return input;
}
