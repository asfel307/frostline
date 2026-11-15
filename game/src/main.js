// Frostline — main: bootstrap, the fixed-step loop and rendering.
// The simulation runs at 60 Hz, apart from rendering: each tick moves
// the player, the bots, the grenades and the round clock; each frame
// draws the state and mirrors it into the HUD.
import * as THREE from 'three';
import { buildStation } from './station.js';
import { createState, addFeed } from './state.js';
import { startMatch } from './rounds.js';
import { SITES } from './navgraph.js';
import { createInput, bindInput, wasPressed, endTick, wishDirection } from './input.js';
import { stepAgent, tryJump, eyeHeight } from './player.js';
import { WEAPONS, equipWeapon } from './weapons.js';
import { fireWeapon, startReload, finishReload, throwGrenade, stepGrenades } from './combat.js';
import { createBot, updateBot, planRound } from './bots.js';
import { stepRound, buy } from './rounds.js';
import { collectUI, updateHUD, flashHitmarker } from './hud.js';
import { sfx, unlockAudio } from './audio.js';
import { createEffects } from './effects.js';
import { TEAM } from './palette.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || '';

window.__shotReady = false;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050914);
scene.fog = new THREE.Fog(0x0a1328, 42, 150);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 320);
camera.rotation.order = 'YXZ';
scene.add(camera);

const station = buildStation(scene);
const effects = createEffects(scene);

// First-person viewmodel: a dark gun shape at the bottom-right of the view.
const viewGun = new THREE.Group();
const viewGunBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.09, 0.12, 0.45),
  new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.45, metalness: 0.4, emissive: 0x141a24 }),
);
const viewGunBarrel = new THREE.Mesh(
  new THREE.BoxGeometry(0.04, 0.04, 0.22),
  new THREE.MeshStandardMaterial({ color: 0x2c3442, roughness: 0.4, metalness: 0.5, emissive: 0x0d1117 }),
);
viewGunBarrel.position.set(0, 0.03, -0.32);
viewGun.add(viewGunBody, viewGunBarrel);
viewGun.position.set(0.3, -0.27, -0.55);
camera.add(viewGun);

const state = createState();
const input = createInput();
const ui = collectUI();

// ---- Agents -------------------------------------------------------------
function makeAgentMesh(team) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: team === 'north' ? 0x2a9fd8 : 0xd84a3a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.34), bodyMat);
  body.position.y = 0.85;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xd9c1a3, roughness: 0.8 }),
  );
  head.position.y = 1.52;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.08, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x111418 }),
  );
  visor.position.set(0, 1.54, 0.19);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.12, 0.75),
    new THREE.MeshStandardMaterial({ color: 0x1c222c, roughness: 0.5, metalness: 0.4 }),
  );
  gun.position.set(0.28, 1.25, 0.35);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshBasicMaterial({ color: team === 'north' ? 0x35c4ff : 0xff6b57 }),
  );
  marker.position.y = 1.98;
  group.add(body, head, visor, gun, marker);
  scene.add(group);
  return { group, body, head, marker };
}

function makeAgent(id, team, isPlayer, index) {
  const base = isPlayer
    ? { id, team, isPlayer: true, name: 'You' }
    : createBot(id, team, index);
  return {
    ...base,
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
    owned: ['pistol'],
    ammo: {},
    mesh: isPlayer ? null : makeAgentMesh(team),
  };
}

const player = makeAgent('p0', 'north', true, 0);
state.player = player;
state.agents.push(player);
for (let i = 0; i < 4; i += 1) state.agents.push(makeAgent(`n${i}`, 'north', false, i));
for (let i = 0; i < 5; i += 1) state.agents.push(makeAgent(`i${i}`, 'ice', false, i));

// ---- Hooks: sound, feed, economy ----------------------------------------
function onKill(victim, attacker, part) {
  const atkName = attacker ? attacker.name : 'The storm';
  const line = `${atkName} ▸ ${victim.name}${part === 'head' ? ' (headshot)' : ''}`;
  addFeed(state, line, 'kill');
  if (attacker === player) {
    state.money += 300;
    state.stats.kills += 1;
    sfx.kill();
  }
  if (victim === player) sfx.hurt();
}

function onShot(agent, end, tracerColor) {
  const from = {
    x: agent.x + Math.sin(agent.yaw) * 0.3,
    y: agent.y + eyeHeight(agent) - 0.15,
    z: agent.z - Math.cos(agent.yaw) * 0.3,
  };
  effects.addTracer(from, end, tracerColor);
  state.lastShot = { x: agent.x, z: agent.z, team: agent.team, by: agent.id, at: state.time };
  if (agent === player) {
    state.stats.shots += 1;
    sfx.shot(WEAPONS[agent.weapon].kind);
    const fwd = {
      x: Math.sin(agent.yaw) * Math.cos(agent.pitch),
      y: Math.sin(agent.pitch),
      z: -Math.cos(agent.yaw) * Math.cos(agent.pitch),
    };
    effects.muzzle({
      x: agent.x + fwd.x * 0.7,
      y: agent.y + eyeHeight(agent) + fwd.y * 0.7,
      z: agent.z + fwd.z * 0.7,
    });
  } else {
    sfx.enemyShot();
  }
}

function onShootResult(agent, result) {
  if (!result) return;
  if (result.hit) {
    effects.addSparks(result.end);
    if (agent === player) {
      flashHitmarker(ui);
      if (result.killed) sfx.kill();
      else sfx.hit();
    } else if (result.hit === player) {
      sfx.hurt();
    }
  }
}

// ---- Player --------------------------------------------------------------
let prevFiring = false;
let recoilKick = 0;
let bobPhase = 0;

function switchWeapon(id) {
  const p = player;
  if (!p.owned.includes(id) || p.weapon === id || !p.alive) return;
  p.ammo[p.weapon] = { mag: p.mag, reserve: p.reserve };
  const saved = p.ammo[id];
  p.weapon = id;
  if (saved) {
    p.mag = saved.mag;
    p.reserve = saved.reserve;
  } else {
    equipWeapon(p, id);
  }
  p.reloadUntil = 0;
  p.spread = 0;
}

function updatePlayer(dt) {
  const p = player;
  if (!p.alive) return;
  // Look.
  p.yaw -= input.lookDX * 0.0022;
  p.pitch -= input.lookDY * 0.0022;
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
  recoilKick = Math.max(0, recoilKick - dt * 0.25);
  // Crouch and jump.
  p.crouch = input.keys.has('ControlLeft') || input.keys.has('KeyC');
  if (wasPressed(input, 'Space')) tryJump(p);
  // Move.
  const wish = wishDirection(input, p.yaw);
  const firing = input.firing;
  stepAgent(p, wish.x, wish.z, dt, { slow: firing ? 0.6 : 1 });
  if (p.speed > 0.5 && p.onGround) bobPhase += dt * p.speed * 1.6;
  // Reload.
  if (p.reloadUntil > 0 && state.time >= p.reloadUntil) finishReload(p);
  if (wasPressed(input, 'KeyR')) {
    if (startReload(p, state.time)) sfx.reload();
  }
  // Fire.
  const w = WEAPONS[p.weapon];
  const wantFire = w.auto ? firing : firing && !prevFiring;
  if (wantFire && p.reloadUntil === 0) {
    if (p.mag === 0) {
      if (!prevFiring) sfx.dry();
      if (startReload(p, state.time)) sfx.reload();
    } else {
      const spread = w.spreadBase + w.spreadMove * Math.min(1, p.speed / 5) + (p.spread || 0);
      const dir = {
        x: Math.sin(p.yaw) * Math.cos(p.pitch) + (Math.random() - 0.5) * spread * 2,
        y: Math.sin(p.pitch) + (Math.random() - 0.5) * spread * 2,
        z: -Math.cos(p.yaw) * Math.cos(p.pitch) + (Math.random() - 0.5) * spread * 2,
      };
      const len = Math.hypot(dir.x, dir.y, dir.z);
      dir.x /= len;
      dir.y /= len;
      dir.z /= len;
      const res = fireWeapon(state, p, dir, state.time, onKill, onShot);
      if (res) {
        onShootResult(p, res);
        p.pitch += w.recoil;
        recoilKick = Math.min(0.09, recoilKick + w.recoil * 1.4);
      }
    }
  }
  prevFiring = firing;
  // Spread decays when not firing.
  if (!firing) p.spread = Math.max(0, (p.spread || 0) - dt * 0.09);
  // Grenade.
  if (wasPressed(input, 'KeyG') && p.grenades > 0) {
    p.grenades -= 1;
    throwGrenade(state, p);
    sfx.reload();
  }
  // Weapon switch.
  if (wasPressed(input, 'Digit1')) switchWeapon('pistol');
  if (wasPressed(input, 'Digit2')) switchWeapon('rifle');
  if (wasPressed(input, 'Digit3')) switchWeapon('smg');
  // Plant / defuse: hold E.
  p.planting = false;
  p.defusing = false;
  if (input.keys.has('KeyE') && state.phase === 'live') {
    if (state.bomb.state === 'idle' && state.carrierId === p.id) {
      const inSite = Object.values(SITES).some((s) => Math.hypot(s.x - p.x, s.z - p.z) < s.r);
      if (inSite) p.planting = true;
    } else if (state.bomb.state === 'planted' && p.team === 'ice') {
      if (Math.hypot(state.bomb.x - p.x, state.bomb.z - p.z) < 2.5) p.defusing = true;
    }
  }
}

// ---- Buy menu --------------------------------------------------------------
function handleBuyKeys() {
  if (state.phase !== 'buy') return;
  for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4']) {
    if (wasPressed(input, key)) {
      const item = { Digit1: 'rifle', Digit2: 'smg', Digit3: 'grenade', Digit4: 'vest' }[key];
      const msg = buy(state, item);
      if (msg) {
        sfx.buy();
        if (item === 'rifle' || item === 'smg') {
          if (!player.owned.includes(item)) player.owned.push(item);
        }
        addFeed(state, msg, 'info');
      }
    }
  }
}

document.getElementById('buy-items').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-buy]');
  if (!btn) return;
  const msg = buy(state, btn.dataset.buy);
  if (msg) {
    sfx.buy();
    const id = btn.dataset.buy;
    if ((id === 'rifle' || id === 'smg') && !player.owned.includes(id)) player.owned.push(id);
    addFeed(state, msg, 'info');
  }
});

// ---- Round flow -------------------------------------------------------------
let prevPhase = state.phase;
let prevBombState = state.bomb.state;

function tick(dt) {
  state.time += dt;
  state.tick += 1;

  // The carrier passes to a living north bot if the player goes down.
  if (state.bomb.state === 'idle' && state.carrierId) {
    const carrier = state.agents.find((a) => a.id === state.carrierId);
    if (carrier && !carrier.alive) {
      const next = state.agents.find((a) => a.team === 'north' && a.alive);
      state.carrierId = next ? next.id : null;
    }
  }

  if (state.phase === 'live') {
    updatePlayer(dt);
    for (const a of state.agents) {
      if (!a.isPlayer) updateBot(state, a, dt, { onKill, onShot, onShootResult });
    }
    const bursts = stepGrenades(state, dt, onKill);
    for (const b of bursts) {
      effects.addSparks(b);
      sfx.explosion();
    }
  }

  stepRound(state, dt);

  // Entering a buy phase: plan the bots' routes and loadouts.
  if (state.phase === 'buy' && prevPhase !== 'buy') planRound(state);
  // Round / match end jingles.
  if (state.phase === 'roundEnd' && prevPhase !== 'roundEnd') {
    if (state.roundWinner === player.team) sfx.roundWin();
    else sfx.roundLose();
  }
  if (state.phase === 'matchEnd' && prevPhase !== 'matchEnd') {
    state.banner = {
      title: state.winner === 'draw' ? 'Draw' : `${TEAM[state.winner].name} wins the match`,
      sub: `${state.score.north} — ${state.score.ice} after ${state.round} rounds. Click Play again to run it back.`,
    };
  }
  // Bomb transitions.
  if (state.bomb.state === 'planted' && prevBombState !== 'planted') sfx.planted();
  if (state.bomb.state === 'detonated' && prevBombState !== 'detonated') {
    sfx.explosion();
    effects.addSparks({ x: state.bomb.x, y: 1, z: state.bomb.z });
    effects.addSparks({ x: state.bomb.x, y: 2, z: state.bomb.z });
  }
  prevPhase = state.phase;
  prevBombState = state.bomb.state;

  handleBuyKeys();
  endTick(input);
}

// ---- Render -----------------------------------------------------------------
function updateMeshes() {
  for (const a of state.agents) {
    if (a.isPlayer || !a.mesh) continue;
    const m = a.mesh;
    if (!a.alive) {
      m.group.visible = false;
      continue;
    }
    m.group.visible = true;
    m.group.position.set(a.x, a.y, a.z);
    m.group.rotation.y = a.yaw;
    const s = a.crouch ? 0.78 : 1;
    m.group.scale.set(1, s, 1);
  }
}

function render() {
  const p = player;
  if (state.phase === 'menu') {
    const t = state.time * 0.06;
    camera.position.set(Math.sin(t) * 20, 9, Math.cos(t) * 20);
    camera.lookAt(0, 1, 0);
  } else if (!p.alive) {
    // Spectate the first living teammate.
    const mate = state.agents.find((a) => a.team === p.team && a.alive && !a.isPlayer);
    if (mate) {
      camera.position.set(mate.x, mate.y + eyeHeight(mate), mate.z);
      camera.rotation.set(mate.pitch, mate.yaw, 0);
    }
  } else {
    const bob = Math.sin(bobPhase) * 0.035 * Math.min(1, p.speed / 5);
    camera.position.set(p.x, p.y + eyeHeight(p) + bob, p.z);
    camera.rotation.set(p.pitch + recoilKick, p.yaw, 0);
  }
  viewGun.position.z = -0.55 + recoilKick * 1.1;
  viewGun.position.y = -0.27 + Math.sin(bobPhase) * 0.006;
  updateMeshes();
  station.update(state.time);
  effects.update(1 / 60, state.time);
  const b = state.bomb;
  effects.setBomb(b.x, b.z, b.state === 'planted', state.time);
  renderer.render(scene, camera);
  updateHUD(state, ui);
}

// ---- Start / restart ----------------------------------------------------------
document.getElementById('play').addEventListener('click', () => {
  unlockAudio();
  document.getElementById('overlay').hidden = true;
  startMatch(state);
  if (state.phase === 'buy') planRound(state);
  renderer.domElement.requestPointerLock?.();
});
document.getElementById('again').addEventListener('click', () => {
  unlockAudio();
  document.getElementById('overlay').hidden = true;
  startMatch(state);
  if (state.phase === 'buy') planRound(state);
  renderer.domElement.requestPointerLock?.();
});

bindInput(input, renderer.domElement, () => {});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Shot modes (for screenshots) --------------------------------------------
function applyShotMode() {
  if (SHOT === 'play' || SHOT === 'bomb' || SHOT === 'end') {
    document.getElementById('overlay').hidden = true;
    startMatch(state);
    state.phase = 'live';
    state.timer = 90;
    equipWeapon(player, 'rifle');
    player.owned = ['pistol', 'rifle'];
    player.mag = 30;
    player.reserve = 90;
    // Staged shots: the player cannot die before the capture.
    player.invulnerable = true;
    planRound(state);
  }
  if (SHOT === 'play') {
    player.x = 0;
    player.z = 10;
    player.yaw = 0;
    const b0 = state.agents.find((a) => a.id === 'i0');
    const b1 = state.agents.find((a) => a.id === 'i1');
    if (b0) {
      b0.x = 0;
      b0.z = -2;
      b0.yaw = Math.PI;
      b0.mode = 'hold';
      b0.holdUntil = 1e9;
    }
    if (b1) {
      b1.x = 4;
      b1.z = -5;
      b1.yaw = Math.PI + 0.3;
      b1.mode = 'hold';
      b1.holdUntil = 1e9;
    }
  }
  if (SHOT === 'bomb') {
    state.bomb.state = 'planted';
    state.bomb.site = 'B';
    state.bomb.x = SITES.B.x;
    state.bomb.z = SITES.B.z;
    state.bomb.fuse = 30;
    player.x = 10;
    player.z = 2;
    player.yaw = Math.atan2(SITES.B.x - 10, -(SITES.B.z - 2));
    const b0 = state.agents.find((a) => a.id === 'i0');
    if (b0) {
      b0.x = 20;
      b0.z = -6;
      b0.yaw = Math.PI - 0.4;
      b0.mode = 'hold';
      b0.holdUntil = 1e9;
    }
    effects.addTracer({ x: 20, y: 1.6, z: -6 }, { x: 14.5, y: 1.4, z: -2.5 }, 0xff8a7a);
  }
  if (SHOT === 'end') {
    state.score.north = 1;
    state.score.ice = 0;
    state.round = 2;
    state.phase = 'roundEnd';
    state.timer = 4;
    state.money = 4050;
    state.banner = { title: 'Northwind takes the round', sub: 'Icefall eliminated.' };
    player.x = 0;
    player.z = 6;
    player.yaw = 0.5;
  }
  if (SHOT === 'start') {
    // Menu orbit view; nothing to start.
  }
}

applyShotMode();

// ---- Loop ----------------------------------------------------------------------
let last = performance.now();
let acc = 0;
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.phase !== 'menu') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      tick(STEP);
      acc -= STEP;
      n += 1;
    }
    if (n === 5) acc = 0;
  } else {
    state.time += dt;
  }
  render();
  frames += 1;
  if (frames === 30) {
    window.__shotReady = true;
  }
}

requestAnimationFrame(frame);
