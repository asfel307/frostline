// Frostline — bots: nine opponents and teammates with one brain.
// Each bot is a small state machine: route to its objective, hold a
// position, engage what it sees, plant the charge or defuse it. Bots
// hear nearby gunfire, react after a human-like delay, and fire in
// bursts with an aim error that grows with range and target speed.
import { NODES, SITES, findPath, nearestNode, lineOfSight, segmentBlocked } from './navgraph.js';
import { WEAPONS, equipWeapon } from './weapons.js';
import { stepAgent, eyeHeight } from './player.js';
import { fireWeapon, startReload, finishReload } from './combat.js';

const BOT_NAMES = {
  north: ['Aurora', 'Boreas', 'Cirrus', 'Denali'],
  ice: ['Frost', 'Glacier', 'Hail', 'Tundra', 'Blizzard'],
};

const BOT_SPEED = 4.3;
const SEE_RANGE = 42;
const HEAR_RANGE = 25;

export function createBot(id, team, index) {
  return {
    id,
    team,
    isPlayer: false,
    name: BOT_NAMES[team][index % BOT_NAMES[team].length],
    x: 0,
    z: 0,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: 0,
    pitch: 0,
    hp: 100,
    armor: 0,
    armorKept: false,
    alive: true,
    crouch: false,
    speed: 0,
    onGround: true,
    weapon: 'pistol',
    mag: 12,
    reserve: 48,
    reloadUntil: 0,
    nextShotAt: 0,
    spread: 0,
    grenades: 0,
    // AI state.
    mode: 'route',
    path: null,
    pathIdx: 0,
    holdUntil: 0,
    holdX: 0,
    holdZ: 0,
    target: null,
    lastSeen: -10,
    reactAt: 0,
    burstLeft: 0,
    burstPauseUntil: 0,
    objective: null,
    planting: false,
    defusing: false,
    reaction: 0.35 + Math.random() * 0.35,
  };
}

function angleTo(a, x, z) {
  return Math.atan2(x - a.x, -(z - a.z));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function canSee(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d > SEE_RANGE) return false;
  const want = Math.atan2(dx, -dz);
  if (Math.abs(angleDiff(want, a.yaw)) > 1.05 && d > 6) return false;
  return lineOfSight(a.x, a.z, b.x, b.z);
}

function nearestEnemy(state, bot) {
  let best = null;
  let bestD = Infinity;
  for (const a of state.agents) {
    if (a.team === bot.team || !a.alive) continue;
    const d = Math.hypot(a.x - bot.x, a.z - bot.z);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function routeTo(bot, x, z) {
  const from = nearestNode(bot.x, bot.z).id;
  const to = nearestNode(x, z).id;
  const ids = findPath(from, to);
  bot.path = ids.map((id) => NODES[id]);
  bot.pathIdx = 0;
  bot.routeKey = null;
  bot.mode = 'route';
}

function followPath(bot, dt) {
  if (!bot.path || bot.pathIdx >= bot.path.length) return { x: 0, z: 0, arrived: true };
  const node = bot.path[bot.pathIdx];
  const dx = node.x - bot.x;
  const dz = node.z - bot.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.7) {
    bot.pathIdx += 1;
    return followPath(bot, dt);
  }
  const want = Math.atan2(dx, -dz);
  bot.yaw = turnToward(bot.yaw, want, 5 * dt);
  return { x: dx / d, z: dz / d, arrived: false };
}

function turnToward(yaw, want, maxStep) {
  const d = angleDiff(want, yaw);
  if (Math.abs(d) <= maxStep) return want;
  return yaw + Math.sign(d) * maxStep;
}

function assignObjectives(state) {
  const north = state.agents.filter((a) => a.team === 'north' && !a.isPlayer);
  const ice = state.agents.filter((a) => a.team === 'ice');
  // Attackers: carrier + one more to A, the rest to B.
  const carrier = state.agents.find((a) => a.id === state.carrierId);
  if (carrier) carrier.objective = 'A';
  let i = 0;
  for (const b of north) {
    b.objective = i % 3 === 0 ? 'A' : 'B';
    i += 1;
  }
  // Defenders: two hold A, three hold B.
  ice.forEach((b, k) => {
    b.objective = k < 2 ? 'A' : 'B';
  });
}

function botAimAt(bot, target) {
  const dx = target.x - bot.x;
  const dz = target.z - bot.z;
  const dy = target.y + 1.2 - (bot.y + eyeHeight(bot));
  const dist = Math.hypot(dx, dy, dz);
  const err = 0.03 + dist * 0.0012 + target.speed * 0.006;
  const yaw = Math.atan2(dx, -dz) + (Math.random() - 0.5) * err * 2;
  const pitch = Math.atan2(dy, Math.hypot(dx, dz)) + (Math.random() - 0.5) * err * 2;
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
    yaw,
    pitch,
  };
}

export function updateBot(state, bot, dt, hooks) {
  if (!bot.alive) return;
  const now = state.time;

  // Planting and defusing only count while the bot is actually doing
  // them this tick; anything else (a firefight, a rotation) pauses them.
  bot.planting = false;
  bot.defusing = false;

  // Finish a reload that came due.
  if (bot.reloadUntil > 0 && now >= bot.reloadUntil) finishReload(bot);

  // Vision: the nearest visible enemy becomes the target.
  const enemy = nearestEnemy(state, bot);
  if (enemy && canSee(bot, enemy)) {
    if (bot.target !== enemy) {
      bot.target = enemy;
      bot.reactAt = now + bot.reaction;
      bot.burstLeft = 0;
    }
    bot.lastSeen = now;
  } else if (bot.target && now - bot.lastSeen > 2.0) {
    bot.target = null;
  }
  // Hearing: a recent shot nearby gives the shooter away.
  if (!bot.target && state.lastShot && now - state.lastShot.at < 1.2) {
    const s = state.lastShot;
    if (s.team !== bot.team && Math.hypot(s.x - bot.x, s.z - bot.z) < HEAR_RANGE) {
      const shooter = state.agents.find((a) => a.id === s.by);
      if (shooter && shooter.alive) {
        bot.target = shooter;
        bot.reactAt = now + bot.reaction * 1.4;
        bot.lastSeen = now;
      }
    }
  }

  let wish = { x: 0, z: 0 };
  let firing = false;

  if (bot.target && bot.target.alive) {
    // Engage: face the target, strafe a little, fire in bursts.
    const aim = botAimAt(bot, bot.target);
    bot.yaw = turnToward(bot.yaw, aim.yaw, 7 * dt);
    bot.pitch += (aim.pitch - bot.pitch) * Math.min(1, 8 * dt);
    const d = Math.hypot(bot.target.x - bot.x, bot.target.z - bot.z);
    if (d > 16) {
      wish = { x: Math.sin(bot.yaw), z: -Math.cos(bot.yaw) };
    } else if (d < 5) {
      wish = { x: -Math.sin(bot.yaw), z: Math.cos(bot.yaw) };
    }
    if (now >= bot.reactAt) {
      if (bot.burstLeft <= 0 && now >= bot.burstPauseUntil) {
        bot.burstLeft = 3 + Math.floor(Math.random() * 3);
      }
      if (bot.burstLeft > 0) {
        firing = true;
        const dir = botAimAt(bot, bot.target);
        const res = fireWeapon(state, bot, dir, now, hooks.onKill, hooks.onShot);
        if (res) {
          bot.burstLeft -= 1;
          if (hooks.onShootResult) hooks.onShootResult(bot, res);
        }
        if (bot.burstLeft <= 0) bot.burstPauseUntil = now + 0.5 + Math.random() * 0.7;
      }
    }
    if (bot.mag === 0 && bot.reloadUntil === 0) startReload(bot, now);
  } else if (state.bomb.state === 'planted' && bot.team === 'ice') {
    // Bomb is down: defenders rotate to the planted site and defuse.
    const site = SITES[state.bomb.site];
    const d = Math.hypot(site.x - bot.x, site.z - bot.z);
    if (d < site.r) {
      bot.mode = 'defuse';
      bot.defusing = true;
    } else {
      bot.defusing = false;
      const key = `defuse:${state.bomb.site}`;
      if (bot.routeKey !== key) {
        bot.routeKey = key;
        routeTo(bot, site.x, site.z);
      }
      wish = followPath(bot, dt);
    }
  } else if (bot.mode === 'plant') {
    bot.planting = true;
  } else if (bot.mode === 'route' || bot.mode === 'hold') {
    if (!bot.path || bot.pathIdx >= bot.path.length) {
      if (bot.mode === 'route') {
        // Arrived: hold here and watch.
        bot.mode = 'hold';
        bot.holdUntil = now + 2 + Math.random() * 3;
        bot.holdX = bot.x;
        bot.holdZ = bot.z;
      }
    }
    if (bot.mode === 'route') {
      wish = followPath(bot, dt);
    } else if (now > bot.holdUntil) {
      // Finished holding: pick a nearby waypoint and wander to it.
      const options = NODES.filter((n) => Math.hypot(n.x - bot.x, n.z - bot.z) < 14);
      const pick = options[Math.floor(Math.random() * options.length)];
      if (pick) routeTo(bot, pick.x, pick.z);
    } else {
      // Scan: slowly turn while holding.
      bot.yaw += 0.5 * dt;
    }
  }

  // Planting: the carrier plants when it reaches its site.
  if (bot.team === 'north' && bot.id === state.carrierId && state.bomb.state === 'idle') {
    const site = SITES[bot.objective || 'A'];
    if (site && Math.hypot(site.x - bot.x, site.z - bot.z) < site.r - 0.5) {
      bot.mode = 'plant';
      bot.planting = true;
    }
  }

  const slow = firing ? 0.55 : 1;
  stepAgent(bot, wish.x, wish.z, dt, { slow });
}

export function planRound(state) {
  assignObjectives(state);
  for (const b of state.agents) {
    if (b.isPlayer || !b.alive) continue;
    const site = SITES[b.objective || (b.team === 'north' ? 'A' : 'B')];
    if (site) {
      // Attackers walk to their site; defenders walk to theirs and hold.
      routeTo(b, site.x + (Math.random() - 0.5) * 3, site.z + (Math.random() - 0.5) * 3);
    }
    // Bots arm up each round: rifle, SMG or pistol, by chance.
    const roll = Math.random();
    if (roll < 0.4) equipWeapon(b, 'rifle');
    else if (roll < 0.7) equipWeapon(b, 'smg');
  }
}

export { segmentBlocked };
