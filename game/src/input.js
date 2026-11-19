// Solmar City input: keyboard + mouse. Held keys live in `keys` (a Set of
// event.code strings); one-shot presses live in `justPressed` until the frame
// loop consumes them with takePressed(), so a press between two frames is never
// lost and never counted twice. E is edge-triggered everywhere (entering the
// player helicopter, fishing casts, shop buys) — holding E must never double-fire.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const CONFIRM_KEYS = new Set(['Space', 'Enter']);

export function createInput(world, target) {
  const keys = new Set();
  const justPressed = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let rightDown = false;
  let rightClicked = false;
  let wheelDelta = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    justPressed.add(event.code);
    if (PAUSE_KEYS.has(event.code)) actions |= ACTION_PAUSE;
    if (CONFIRM_KEYS.has(event.code)) actions |= ACTION_CONFIRM;
    // world.input may be a plain state object until the bootstrap swaps in
    // the live key sets; guard so a stray keypress can never throw here.
    if (world.input) {
      if (event.code === 'KeyM') world.input.muteToggle = true;
      if (event.code === 'KeyC') world.input.radioNext = true;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
    rightDown = false;
  }

  function onMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    } else if (event.button === 2) {
      rightDown = true;
      rightClicked = true;
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
    if (event.button === 2) rightDown = false;
  }

  function onWheel(event) {
    wheelDelta += event.deltaY;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('wheel', onWheel);
  if (target) {
    target.addEventListener('contextmenu', onContextMenu);
    target.addEventListener('pointerdown', () => { mouseClicked = true; });
  }

  const input = {
    keys,
    justPressed,
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get mouseDown() { return mouseDown; },
    get rightDown() { return rightDown; },
    get wheelDelta() { return wheelDelta; },
    isDown(code) { return keys.has(code); },
    // Edge-triggered: true only on the frame the key went down.
    pressed(code) { return justPressed.has(code); },
    // Click edge: true once per mouse press, consumed by the caller.
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    takeRightClick() {
      const clicked = rightClicked;
      rightClicked = false;
      return clicked;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Called at the end of each frame: one-shot presses expire.
    endFrame() {
      justPressed.clear();
      wheelDelta = 0;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
      if (target) target.removeEventListener('contextmenu', onContextMenu);
    },
  };
  return input;
}
