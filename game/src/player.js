// Frostline — movement: acceleration, crouch, jump and collision.
// One job: turn a wish (move direction, jump, crouch) into a new agent
// position that never ends up inside a solid. Colliders come from
// navgraph.js, so the walkable world is exactly the waypoint world.
import { COLLIDERS } from './navgraph.js';

export const AGENT_RADIUS = 0.34;
export const STAND_HEIGHT = 1.7;
export const CROUCH_HEIGHT = 1.1;
export const EYE_STAND = 1.62;
export const EYE_CROUCH = 1.05;
const WALK_SPEED = 5.2;
const CROUCH_SPEED = 2.6;
const ACCEL = 42;
const FRICTION = 10;

function hitsSolid(x, z, y, radius, height) {
  for (const c of COLLIDERS) {
    if (y + height <= 0.01 || y >= c.y1) continue;
    if (
      x > c.x0 - radius && x < c.x1 + radius &&
      z > c.z0 - radius && z < c.z1 + radius
    ) return true;
  }
  return false;
}

// Move an agent by (dx, dz) with per-axis sliding. Returns true if it moved.
export function moveAgent(a, dx, dz) {
  const h = a.crouch ? CROUCH_HEIGHT : STAND_HEIGHT;
  let moved = false;
  if (!hitsSolid(a.x + dx, a.z, a.y, AGENT_RADIUS, h)) {
    a.x += dx;
    moved = true;
  }
  if (!hitsSolid(a.x, a.z + dz, a.y, AGENT_RADIUS, h)) {
    a.z += dz;
    moved = true;
  }
  a.x = Math.max(-33.4, Math.min(33.4, a.x));
  a.z = Math.max(-23.4, Math.min(23.4, a.z));
  return moved;
}

// Advance one agent's velocity toward a wish direction for dt seconds.
// wishX/wishZ are a unit vector in world space; speed scales with crouch
// and with the weapon being fired (firing slows you, so stopping pays).
export function stepAgent(a, wishX, wishZ, dt, opts = {}) {
  const top = (a.crouch ? CROUCH_SPEED : WALK_SPEED) * (opts.slow ?? 1);
  const tx = wishX * top;
  const tz = wishZ * top;
  const k = 1 - Math.exp(-ACCEL * dt);
  a.vx += (tx - a.vx) * k;
  a.vz += (tz - a.vz) * k;
  if (wishX === 0 && wishZ === 0) {
    const f = Math.exp(-FRICTION * dt);
    a.vx *= f;
    a.vz *= f;
  }
  moveAgent(a, a.vx * dt, a.vz * dt);
  // Gravity and jumping. The floor is y = 0 everywhere (no steps).
  a.vy -= 22 * dt;
  a.y += a.vy * dt;
  if (a.y <= 0) {
    a.y = 0;
    a.vy = 0;
    a.onGround = true;
  } else {
    a.onGround = false;
  }
  a.speed = Math.hypot(a.vx, a.vz);
}

export function tryJump(a) {
  if (a.onGround && a.alive) {
    a.vy = 7.2;
    a.onGround = false;
  }
}

export function eyeHeight(a) {
  return a.crouch ? EYE_CROUCH : EYE_STAND;
}
