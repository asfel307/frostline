// Frostline — rounds: the match clock, the economy and the bomb.
// One job: decide when a round starts, ends, and who won it, and move
// money around. The per-tick simulation lives in main.js; this module
// owns the rules.
import {
  ROUND_WIN_SCORE,
  MAX_ROUNDS,
  BUY_SECONDS,
  ROUND_SECONDS,
  BOMB_FUSE,
  PLANT_SECONDS,
  DEFUSE_SECONDS,
  resetRound,
  addFeed,
} from './state.js';
import { SITES } from './navgraph.js';
import { BUY_LIST, GRENADE, VEST, equipWeapon } from './weapons.js';

export function startMatch(state) {
  state.round = 1;
  state.score = { north: 0, ice: 0 };
  state.money = 800;
  state.winner = null;
  resetRound(state);
}

function aliveCount(state, team) {
  return state.agents.filter((a) => a.team === team && a.alive).length;
}

function endRound(state, winner, reason) {
  state.roundWinner = winner;
  state.score[winner] += 1;
  state.phase = 'roundEnd';
  state.timer = 4;
  state.banner = { title: winner === 'north' ? 'Northwind takes the round' : 'Icefall takes the round', sub: reason };
  addFeed(state, state.banner.title, winner);
  const playerWon = state.player && state.player.team === winner;
  state.money += playerWon ? 3250 : 1900;
  if (state.score[winner] >= ROUND_WIN_SCORE || state.round >= MAX_ROUNDS) {
    state.phase = 'matchEnd';
    state.winner = state.score.north > state.score.ice ? 'north' : state.score.north < state.score.ice ? 'ice' : 'draw';
    state.timer = 0;
  }
}

export function nextRound(state) {
  if (state.phase === 'matchEnd') return;
  state.round += 1;
  resetRound(state);
}

// Buy during the buy phase. Returns a message for the HUD, or null.
export function buy(state, itemId) {
  if (state.phase !== 'buy' || !state.player || !state.player.alive) return null;
  const item = BUY_LIST.find((b) => b.id === itemId);
  if (!item) return null;
  if (state.money < item.price) return 'Not enough credits.';
  const p = state.player;
  if (itemId === 'rifle' || itemId === 'smg') {
    if (p.weapon === itemId) return 'Already carrying it.';
    equipWeapon(p, itemId);
  } else if (itemId === 'grenade') {
    p.grenades += 1;
  } else if (itemId === 'vest') {
    if (p.armor >= VEST.armor) return 'Vest already at full.';
    p.armor = VEST.armor;
  }
  state.money -= item.price;
  return `${item.label} — $${item.price}`;
}

// The bomb: planting, the fuse, defusing. Called every tick while live.
export function stepBomb(state, dt) {
  const bomb = state.bomb;
  // Planting: the planter must stand in the site and hold E.
  const planter = state.agents.find((a) => a.planting && a.alive);
  if (bomb.state === 'idle' && planter) {
    // The site is whichever one the planter is standing in.
    const entry = Object.entries(SITES).find(([, s]) => Math.hypot(s.x - planter.x, s.z - planter.z) < s.r);
    if (entry) {
      bomb.progress += dt;
      bomb.site = entry[0];
      bomb.x = planter.x;
      bomb.z = planter.z;
      if (bomb.progress >= PLANT_SECONDS) {
        bomb.state = 'planted';
        bomb.fuse = BOMB_FUSE;
        bomb.progress = 0;
        addFeed(state, `Charge planted at ${SITES[bomb.site].name}`, 'bomb');
      }
    } else {
      bomb.progress = 0;
    }
  } else if (bomb.state === 'idle') {
    bomb.progress = 0;
  }
  // Fuse.
  if (bomb.state === 'planted') {
    bomb.fuse -= dt;
    if (bomb.fuse <= 0) {
      bomb.state = 'detonated';
      endRound(state, 'north', 'The charge detonated.');
      return;
    }
    // Defusing: a defender standing at the planted charge, holding E.
    const defuser = state.agents.find((a) => a.defusing && a.alive);
    if (defuser && Math.hypot(bomb.x - defuser.x, bomb.z - defuser.z) < 2.5) {
      bomb.progress += dt;
      if (bomb.progress >= DEFUSE_SECONDS) {
        bomb.state = 'defused';
        addFeed(state, 'Charge defused', 'bomb');
        endRound(state, 'ice', 'The charge was defused.');
        return;
      }
    } else {
      bomb.progress = 0;
    }
  }
}

// The round clock and the elimination win. Called every tick.
export function stepRound(state, dt) {
  if (state.phase === 'buy') {
    state.timer -= dt;
    if (state.timer <= 0) {
      state.phase = 'live';
      state.timer = ROUND_SECONDS;
    }
    return;
  }
  if (state.phase === 'live') {
    state.timer -= dt;
    stepBomb(state, dt);
    if (state.phase !== 'live') return;
    const northAlive = aliveCount(state, 'north');
    const iceAlive = aliveCount(state, 'ice');
    if (northAlive === 0) {
      endRound(state, 'ice', state.bomb.state === 'planted' ? 'Northwind eliminated after the plant.' : 'Northwind eliminated.');
    } else if (iceAlive === 0) {
      endRound(state, 'north', state.bomb.state === 'planted' ? 'Icefall eliminated after the plant.' : 'Icefall eliminated.');
    } else if (state.timer <= 0) {
      endRound(state, 'ice', 'Time ran out before the charge went off.');
    }
    return;
  }
  if (state.phase === 'roundEnd') {
    state.timer -= dt;
    if (state.timer <= 0) nextRound(state);
  }
}

export { GRENADE };
