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
  'KeyE', 'KeyF', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'KeyQ', 'KeyR', 'KeyC',
  // v3: KeyT starts a street race at a start gantry (activities.js),
  // KeyN skips the day/night clock to dawn or dusk (daynight.js),
  // KeyB buys a NOS refill and KeyV an armour vest at the shop.
  'KeyT', 'KeyN', 'KeyB', 'KeyV',
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
    /**
     * v3 — edge detection for ordinary keys: true only on the frame the
     * key went down, so systems that poll (races on T, time-skip on N)
     * can use this instead of keeping their own prev-key state.
     * update() snapshots the held set each frame for this.
     */
    pressed(code) {
      return input.keys.has(code) && !prevKeys.has(code);
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
      // Snapshot the held keys AFTER the frame read them, so pressed()
      // above can tell a fresh press from a held key next frame.
      prevKeys = new Set(input.keys);
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
  // v3: the held-key set as of the last update() — pressed() diffs
  // against it. Seeded empty so the first frame never reports a press.
  let prevKeys = new Set();

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
