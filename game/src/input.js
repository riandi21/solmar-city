// Keyboard and pointer input for Solmar City. Held keys live in a Set the game
// reads every step; one-shot presses (click = shoot) are latched and taken once.
// Dragging with the mouse orbits the chase camera; the deltas are read by the
// loop and cleared each frame, so a drag between frames is never lost twice.
// Game keys never scroll the page: their defaults are prevented.
//
// The fields are plain mutable properties, on purpose: the player system
// zeroes mouseDX/mouseDY after steering the camera with them, and combat
// clears `clicked` after firing — both write straight to world.input.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SHOOT = 4;

// Keys the game uses at all (held or one-shot). Anything here gets preventDefault.
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space',
  'KeyE', 'KeyF', 'Digit1', 'Digit2',
  'KeyM', 'KeyP', 'Escape', 'Enter',
]);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const CONFIRM_KEYS = new Set(['Enter', 'Space']);

export function createInput(canvas) {
  const input = {
    /** Held keys, by KeyboardEvent.code ('KeyW', 'Space', 'ShiftLeft', ...). */
    keys: new Set(),
    /** Mouse movement since the last update(), in pixels. */
    mouseDX: 0,
    mouseDY: 0,
    /** True if the player clicked since the last consumeClick(). */
    clicked: false,

    /** Take the latched click (true once per click, then false until the next). */
    consumeClick() {
      const was = input.clicked;
      input.clicked = false;
      return was;
    },
    /** One-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Call once per frame after reading the deltas: clears them for next frame. */
    update() {
      input.mouseDX = 0;
      input.mouseDY = 0;
    },
    /** Convenience: is any of these codes held? */
    any(...codes) {
      for (const code of codes) if (input.keys.has(code)) return true;
      return false;
    },
  };

  let actions = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat) {
      if (PAUSE_KEYS.has(event.code)) actions |= ACTION_PAUSE;
      else if (CONFIRM_KEYS.has(event.code)) actions |= ACTION_CONFIRM;
    }
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of all of
  // them on blur so the player never drives off on their own.
  window.addEventListener('blur', () => {
    input.keys.clear();
    dragging = false;
  });

  // Drag orbits the camera; a plain click (no drag) fires the pistol.
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    input.mouseDX += event.clientX - lastX;
    input.mouseDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    // A click is a press that barely moved: that is a shot, not a camera drag.
    if (Math.abs(input.mouseDX) < 6 && Math.abs(input.mouseDY) < 6) {
      input.clicked = true;
      actions |= ACTION_SHOOT;
    }
    input.mouseDX = 0;
    input.mouseDY = 0;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    input.mouseDX = 0;
    input.mouseDY = 0;
  });
  // Right-click should not open a menu over the game.
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return input;
}
