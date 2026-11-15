// Frostline — combat: hitscan shots, damage and grenades.
// Geometry only: given a shooter and a direction, find what the bullet
// hits first — a body, a head, or a wall. Damage and death live here;
// the economy and the feed are updated by the caller through `onKill`.
import { COLLIDERS, lineOfSight } from './navgraph.js';
import { WEAPONS, GRENADE } from './weapons.js';
import { AGENT_RADIUS, STAND_HEIGHT, CROUCH_HEIGHT, eyeHeight } from './player.js';

// Distance from a ray origin along `dir` to the first solid, or Infinity.
export function rayWall(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = maxDist;
  // Sample the ray; walls are axis-aligned boxes, sampling at 0.25 m is
  // far finer than any wall is thin.
  const steps = Math.ceil(maxDist / 0.25);
  for (let i = 1; i <= steps; i += 1) {
    const t = (i / steps) * maxDist;
    const x = ox + dx * t;
    const y = oy + dy * t;
    const z = oz + dz * t;
    for (const c of COLLIDERS) {
      if (x >= c.x0 && x <= c.x1 && y >= 0 && y <= c.y1 && z >= c.z0 && z <= c.z1) {
        return Math.min(best, t);
      }
    }
    if (y <= 0 || y > 30) return Math.min(best, t);
  }
  return best;
}

// Ray against one agent: a body cylinder plus a head sphere. Returns
// { t, part } or null.
function rayAgent(ox, oy, oz, dx, dy, dz, target, maxDist) {
  const h = target.crouch ? CROUCH_HEIGHT : STAND_HEIGHT;
  const feet = target.y;
  const headY = feet + h - 0.24;
  // Head sphere.
  const hx = target.x - ox;
  const hy = headY - oy;
  const hz = target.z - oz;
  const b = hx * dx + hy * dy + hz * dz;
  if (b > 0) {
    const d2 = hx * hx + hy * hy + hz * hz - b * b;
    const r = 0.24;
    if (d2 < r * r) {
      const t = b - Math.sqrt(r * r - d2);
      if (t > 0 && t < maxDist) return { t, part: 'head' };
    }
  }
  // Body: closest approach of the ray to the vertical segment.
  // Solve in the horizontal plane, then check the height at that point.
  const px = target.x - ox;
  const pz = target.z - oz;
  const denom = dx * dx + dz * dz;
  if (denom < 1e-8) return null;
  const t = (px * dx + pz * dz) / denom;
  if (t <= 0 || t >= maxDist) return null;
  const cx = ox + dx * t - target.x;
  const cz = oz + dz * t - target.z;
  const rr = AGENT_RADIUS + 0.06;
  if (cx * cx + cz * cz > rr * rr) return null;
  const yAt = oy + dy * t;
  if (yAt < feet || yAt > feet + h - 0.2) return null;
  return { t, part: 'body' };
}

export function shoot(state, shooter, dir, onKill) {
  const w = WEAPONS[shooter.weapon];
  const ox = shooter.x;
  const oy = shooter.y + eyeHeight(shooter);
  const oz = shooter.z;
  const wallT = rayWall(ox, oy, oz, dir.x, dir.y, dir.z, w.range);
  let best = null;
  let bestTarget = null;
  for (const a of state.agents) {
    if (a === shooter || !a.alive) continue;
    const hit = rayAgent(ox, oy, oz, dir.x, dir.y, dir.z, a, Math.min(wallT, w.range));
    if (hit && (!best || hit.t < best.t)) {
      best = hit;
      bestTarget = a;
    }
  }
  const endT = best ? best.t : wallT;
  const end = { x: ox + dir.x * endT, y: oy + dir.y * endT, z: oz + dir.z * endT };
  let killed = null;
  if (bestTarget) {
    const dmg = Math.round(w.damage * (best.part === 'head' ? w.headMult : 1));
    killed = damageAgent(state, bestTarget, dmg, shooter, onKill, best.part);
  }
  return { end, hit: bestTarget, part: best ? best.part : null, killed };
}

export function damageAgent(state, target, dmg, attacker, onKill, part) {
  // Shot modes make the player invulnerable so a screenshot can be
  // staged; normal play never sets the flag.
  if (target.invulnerable) return null;
  let left = dmg;
  if (target.armor > 0) {
    const absorbed = Math.min(target.armor, Math.round(left * 0.5));
    target.armor -= absorbed;
    left -= absorbed;
  }
  target.hp -= left;
  target.lastHurtBy = attacker ? attacker.id : null;
  target.lastHurtAt = state.time;
  if (target.hp <= 0 && target.alive) {
    target.hp = 0;
    target.alive = false;
    target.deathAt = state.time;
    if (onKill) onKill(target, attacker, part);
    return target;
  }
  return null;
}

// Grenades: thrown, they fly with gravity, then burst.
export function throwGrenade(state, thrower) {
  const dir = {
    x: Math.sin(thrower.yaw) * Math.cos(thrower.pitch),
    y: Math.sin(thrower.pitch) + 0.35,
    z: -Math.cos(thrower.yaw) * Math.cos(thrower.pitch),
  };
  state.grenades.push({
    x: thrower.x,
    y: thrower.y + eyeHeight(thrower) - 0.2,
    z: thrower.z,
    vx: dir.x * 13,
    vy: dir.y * 13,
    vz: dir.z * 13,
    fuse: GRENADE.fuse,
    owner: thrower,
  });
}

export function stepGrenades(state, dt, onKill) {
  const bursts = [];
  for (const g of state.grenades) {
    g.vy -= 14 * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.z += g.vz * dt;
    g.fuse -= dt;
    if (g.y <= 0.1) {
      g.y = 0.1;
      g.vy = Math.abs(g.vy) * 0.35;
      g.vx *= 0.6;
      g.vz *= 0.6;
    }
    if (g.fuse <= 0) {
      bursts.push(g);
      for (const a of state.agents) {
        if (!a.alive) continue;
        const d = Math.hypot(a.x - g.x, a.z - g.z, a.y + 0.9 - g.y);
        if (d < GRENADE.radius) {
          const dmg = Math.round(GRENADE.maxDamage * (1 - d / GRENADE.radius));
          damageAgent(state, a, Math.max(8, dmg), g.owner, onKill);
        }
      }
    }
  }
  state.grenades = state.grenades.filter((g) => g.fuse > 0);
  return bursts;
}

// Shared trigger pull for the player and the bots: ammo, fire rate,
// spread growth and the shot itself. Returns the shoot result or null.
export function fireWeapon(state, agent, dir, now, onKill, onShot) {
  const w = WEAPONS[agent.weapon];
  if (!agent.alive || agent.reloadUntil > now || agent.mag <= 0) return null;
  if (now < agent.nextShotAt) return null;
  agent.mag -= 1;
  agent.nextShotAt = now + w.fireInterval;
  agent.spread = Math.min(w.spreadMax, (agent.spread || 0) + w.spreadShot);
  const result = shoot(state, agent, dir, onKill);
  if (onShot) onShot(agent, result.end, w.tracer);
  return result;
}

export function startReload(agent, now) {
  const w = WEAPONS[agent.weapon];
  if (agent.mag >= w.mag || agent.reserve <= 0 || agent.reloadUntil > now) return false;
  agent.reloadUntil = now + w.reloadTime;
  return true;
}

export function finishReload(agent) {
  const w = WEAPONS[agent.weapon];
  const need = w.mag - agent.mag;
  const take = Math.min(need, agent.reserve);
  agent.mag += take;
  agent.reserve -= take;
  agent.reloadUntil = 0;
}

export { lineOfSight };
