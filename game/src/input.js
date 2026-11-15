// Frostline — input: keyboard state and pointer-lock mouse look.
// Keeps no game state of its own; main.js polls the flags each tick.
export function createInput() {
  return {
    keys: new Set(),
    locked: false,
    lookDX: 0,
    lookDY: 0,
    firing: false,
    pressed: new Set(),
  };
}

export function bindInput(input, canvas, onLockChange) {
  const down = (e) => {
    if (e.code === 'Space') e.preventDefault();
    input.keys.add(e.code);
    input.pressed.add(e.code);
  };
  const up = (e) => input.keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => input.keys.clear());

  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (onLockChange) onLockChange(input.locked);
  });
  document.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.lookDX += e.movementX;
    input.lookDY += e.movementY;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.firing = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.firing = false;
  });
  canvas.addEventListener('click', () => {
    if (!input.locked) canvas.requestPointerLock();
  });
}

// True once for the tick after the key went down, then cleared by the loop.
export function wasPressed(input, code) {
  return input.pressed.has(code);
}

export function endTick(input) {
  input.pressed.clear();
  input.lookDX = 0;
  input.lookDY = 0;
}

// Wish direction in world space from the keys and the view yaw.
// yaw 0 faces north (-z); forward is (sin yaw, -cos yaw).
export function wishDirection(input, yaw) {
  let f = 0;
  let s = 0;
  if (input.keys.has('KeyW')) f += 1;
  if (input.keys.has('KeyS')) f -= 1;
  if (input.keys.has('KeyD')) s += 1;
  if (input.keys.has('KeyA')) s -= 1;
  if (f === 0 && s === 0) return { x: 0, z: 0 };
  const len = Math.hypot(f, s);
  f /= len;
  s /= len;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return { x: sin * f + cos * s, z: -cos * f + sin * s };
}
