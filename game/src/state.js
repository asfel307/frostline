// Frostline — one place for all game state.
// Every module reads and writes this single object; nothing keeps its
// own copy of the round, the score or the bomb. The fixed-step loop in
// main.js advances `time` and `tick`; the rest of the game is pure
// functions over this state.
import { SPAWNS } from './navgraph.js';

export const ROUND_WIN_SCORE = 5;
export const MAX_ROUNDS = 9;
export const BUY_SECONDS = 15;
export const ROUND_SECONDS = 100;
export const BOMB_FUSE = 40;
export const PLANT_SECONDS = 3;
export const DEFUSE_SECONDS = 5;

export function createState() {
  return {
    time: 0,
    tick: 0,
    // menu | buy | live | roundEnd | matchEnd
    phase: 'menu',
    round: 1,
    score: { north: 0, ice: 0 },
    timer: BUY_SECONDS,
    // idle | planted | detonated | defused
    bomb: { state: 'idle', site: null, x: 0, z: 0, fuse: BOMB_FUSE, progress: 0, planter: null, defuser: null },
    money: 800,
    agents: [],
    grenades: [],
    player: null,
    feed: [],
    banner: null,
    winner: null,
    roundWinner: null,
    // Who carries the charge this round (player or a north bot).
    carrierId: null,
    stats: { shots: 0, hits: 0, kills: 0 },
    // Time of day, refreshed every frame by the day/night cycle:
    // { hour, label, dayFactor, clock }. The HUD timeline reads it.
    day: { hour: 5.5, label: 'MALAM', dayFactor: 0, clock: '05:30' },
  };
}

export function resetRound(state) {
  state.phase = 'buy';
  state.timer = BUY_SECONDS;
  state.bomb = { state: 'idle', site: null, x: 0, z: 0, fuse: BOMB_FUSE, progress: 0, planter: null, defuser: null };
  state.roundWinner = null;
  state.banner = null;
  state.grenades = [];
  const northSpawns = SPAWNS.north;
  const iceSpawns = SPAWNS.ice;
  let ni = 0;
  let ii = 0;
  for (const a of state.agents) {
    const spawn = a.team === 'north' ? northSpawns[ni++ % northSpawns.length] : iceSpawns[ii++ % iceSpawns.length];
    a.x = spawn.x;
    a.z = spawn.z;
    a.y = 0;
    a.vy = 0;
    a.yaw = spawn.yaw;
    a.pitch = 0;
    a.hp = 100;
    // The player keeps their loadout between rounds; bots re-arm fresh.
    if (a.isPlayer) {
      a.armorKept = a.armor > 0;
    } else {
      a.weapon = 'pistol';
      a.mag = 12;
      a.reserve = 48;
      a.grenades = 0;
      a.armorKept = false;
    }
    a.armor = a.armorKept ? a.armor : 0;
    a.armorKept = false;
    a.alive = true;
    a.crouch = false;
    a.path = null;
    a.pathIdx = 0;
    a.holdUntil = 0;
    a.target = null;
    a.lastSeen = 0;
    a.burstLeft = 0;
    a.nextShotAt = 0;
    a.reactAt = 0;
    a.reloadUntil = 0;
    a.spread = 0;
    a.planting = false;
    a.defusing = false;
  }
  // The charge goes to the player when they are on the attack side,
  // otherwise to the first living north bot.
  state.carrierId = state.player ? state.player.id : state.agents.find((a) => a.team === 'north')?.id ?? null;
}

export function addFeed(state, text, kind = 'info') {
  state.feed.unshift({ text, kind, at: state.time });
  if (state.feed.length > 6) state.feed.pop();
}
