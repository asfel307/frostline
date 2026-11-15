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
import { createDayNight } from './daynight.js';
import { TEAM, PALETTE } from './palette.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || '';

window.__shotReady = false;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Soft shadows from the sun (day) and the moon (night): one 1024
// shadow map per key light, only the main structures and the soldiers
// cast, so it stays light on low-end GPUs.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050914);
// Fog starts past the playable map (60 m) so the station stays crisp
// while the mountain ring fades into a soft haze.
scene.fog = new THREE.Fog(0x0a1328, 60, 320);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);

const station = buildStation(scene);
const dayNight = createDayNight(scene, station.handles);
// ?time=HH:MM pins the clock (used by the screenshot shots); without
// it the match opens just before dawn and the day rolls on from there.
const TIME_PARAM = params.get('time') || '';
{
  const m = /^(\d{1,2}):(\d{2})$/.exec(TIME_PARAM);
  if (m) dayNight.setStartHour(Number(m[1]) + Number(m[2]) / 60);
}
const effects = createEffects(scene);

// First-person viewmodel: one detailed gun per weapon kind, built from
// primitives (receiver, barrel, handguard, stock, grip, magazine,
// sights). Only the group matching the player's current weapon is
// shown; the shape switches when the weapon switches. Position, recoil
// kick and bob are applied to the shared `viewGun` group exactly as
// before — only the visible shape changes.
function vmMat(color, rough = 0.42, metal = 0.5) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: 0x0d1117 });
}
function vmBox(w, h, d, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  return m;
}
function vmCyl(r, len, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
// Forward for a viewmodel gun is -z (away from the camera).
function buildViewGunModel(kind) {
  const g = new THREE.Group();
  const metal = vmMat(0x2c3442);
  const dark = vmMat(0x1c222c, 0.5, 0.4);
  const gripMat = vmMat(0x232a33, 0.7, 0.2);
  const sightMat = vmMat(0x3a4550, 0.5, 0.4);
  if (kind === 'pistol') {
    // P-9 Frostbite: short, compact slide + grip.
    g.add(vmBox(0.05, 0.055, 0.24, metal, 0, 0.02, -0.04));
    g.add(vmBox(0.052, 0.012, 0.05, dark, 0, 0.035, 0.05));
    g.add(vmBox(0.045, 0.05, 0.16, dark, 0, -0.01, 0));
    g.add(vmBox(0.042, 0.11, 0.055, gripMat, 0, -0.065, 0.055, 0.28));
    g.add(vmBox(0.04, 0.012, 0.05, dark, 0, -0.042, -0.02));
    g.add(vmCyl(0.014, 0.03, dark, 0, 0.02, -0.17));
    g.add(vmBox(0.008, 0.02, 0.01, sightMat, 0, 0.055, -0.15));
    g.add(vmBox(0.03, 0.015, 0.01, sightMat, 0, 0.055, 0.06));
  } else if (kind === 'rifle') {
    // NK-77 Northstar: long barrel, stock, curved magazine, tube scope.
    g.add(vmBox(0.065, 0.09, 0.30, metal, 0, 0, 0));
    g.add(vmCyl(0.016, 0.28, dark, 0, 0.018, -0.28));
    g.add(vmCyl(0.024, 0.06, dark, 0, 0.018, -0.43));
    g.add(vmBox(0.058, 0.075, 0.20, dark, 0, 0.008, -0.22));
    g.add(vmBox(0.062, 0.008, 0.18, metal, 0, 0.05, -0.22));
    g.add(vmBox(0.008, 0.03, 0.18, metal, 0.031, 0.008, -0.22));
    g.add(vmBox(0.008, 0.03, 0.18, metal, -0.031, 0.008, -0.22));
    g.add(vmBox(0.055, 0.085, 0.15, dark, 0, -0.008, 0.20));
    g.add(vmBox(0.06, 0.10, 0.02, gripMat, 0, -0.008, 0.28));
    g.add(vmBox(0.038, 0.085, 0.045, gripMat, 0, -0.075, 0.09, 0.3));
    g.add(vmBox(0.045, 0.13, 0.06, dark, 0, -0.095, -0.04, -0.28));
    g.add(vmBox(0.035, 0.012, 0.06, dark, 0, -0.05, 0.02));
    g.add(vmCyl(0.02, 0.13, dark, 0, 0.07, -0.03));
    g.add(vmBox(0.02, 0.03, 0.02, metal, 0, 0.05, 0.02));
    g.add(vmBox(0.02, 0.03, 0.02, metal, 0, 0.05, -0.08));
    g.add(vmBox(0.01, 0.025, 0.012, sightMat, 0, 0.05, -0.30));
  } else {
    // V-4 Blizzard: short barrel, boxy body, straight magazine,
    // folding stock, vertical foregrip.
    g.add(vmBox(0.065, 0.095, 0.26, metal, 0, 0, 0));
    g.add(vmCyl(0.018, 0.12, dark, 0, 0.018, -0.18));
    g.add(vmCyl(0.026, 0.04, dark, 0, 0.018, -0.25));
    g.add(vmBox(0.05, 0.06, 0.13, dark, 0, -0.005, 0.18, -0.08));
    g.add(vmBox(0.038, 0.08, 0.045, gripMat, 0, -0.07, 0.07, 0.28));
    g.add(vmBox(0.04, 0.15, 0.055, dark, 0, -0.105, -0.01));
    g.add(vmBox(0.035, 0.06, 0.04, gripMat, 0, -0.06, -0.10));
    g.add(vmBox(0.01, 0.025, 0.012, sightMat, 0, 0.055, -0.12));
    g.add(vmBox(0.028, 0.015, 0.012, sightMat, 0, 0.055, 0.08));
    g.add(vmBox(0.005, 0.02, 0.18, metal, 0.035, 0.01, -0.05));
  }
  // Held slightly angled inward, like a real grip.
  g.rotation.y = 0.06;
  return g;
}
const viewGun = new THREE.Group();
const viewGunModels = {
  pistol: buildViewGunModel('pistol'),
  rifle: buildViewGunModel('rifle'),
  smg: buildViewGunModel('smg'),
};
for (const m of Object.values(viewGunModels)) viewGun.add(m);
viewGun.userData.current = null;
function updateViewGun() {
  const w = player.weapon;
  if (viewGun.userData.current === w) return;
  viewGun.userData.current = w;
  for (const [id, m] of Object.entries(viewGunModels)) m.visible = id === w;
}
viewGun.position.set(0.3, -0.27, -0.55);
camera.add(viewGun);

const state = createState();
const input = createInput();
const ui = collectUI();

// ---- Agents -------------------------------------------------------------
// Cylinder between two points, for the soldier's arms.
function limb(from, to, r, mat) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 8), mat);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// The rifle a bot carries: receiver, barrel + muzzle, handguard, stock,
// curved magazine, grip and iron sights — held in both hands, pointing
// at the bot's facing direction (+z in the bot's local frame).
function buildBotRifle() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c222c, roughness: 0.5, metalness: 0.4 });
  const mid = new THREE.MeshStandardMaterial({ color: 0x2c3442, roughness: 0.45, metalness: 0.5 });
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.34), mid);
  g.add(receiver);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, 0.28);
  g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 8), dark);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.015, 0.42);
  g.add(muzzle);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.18), dark);
  guard.position.set(0, 0.01, 0.2);
  g.add(guard);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.14), dark);
  stock.position.set(0, -0.005, -0.22);
  g.add(stock);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.07), dark);
  mag.position.set(0, -0.09, 0.03);
  mag.rotation.x = 0.25;
  g.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.05), dark);
  grip.position.set(0, -0.075, -0.09);
  grip.rotation.x = 0.3;
  g.add(grip);
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, 0.02), dark);
  frontSight.position.set(0, 0.06, 0.3);
  g.add(frontSight);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), dark);
  rearSight.position.set(0, 0.055, -0.12);
  g.add(rearSight);
  return g;
}

function makeAgentMesh(team) {
  const group = new THREE.Group();
  const accent = team === 'north' ? PALETTE.teamNorth : PALETTE.teamIce;
  const uniform = new THREE.MeshStandardMaterial({ color: team === 'north' ? 0x2a9fd8 : 0xd84a3a, roughness: 0.7 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x2e3742, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.8 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x1c222c, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9c1a3, roughness: 0.8 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3a4550, roughness: 0.6, metalness: 0.2 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.3, metalness: 0.4 });
  const parts = [];
  const add = (mesh) => {
    parts.push(mesh);
    return mesh;
  };
  // Legs: thigh, shin and boot, one per side.
  for (const sx of [-1, 1]) {
    const thigh = add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.17), trousers));
    thigh.position.set(0.11 * sx, 0.62, 0);
    const shin = add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.38, 0.15), trousers));
    shin.position.set(0.11 * sx, 0.22, 0.01);
    const boot = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.26), bootMat));
    boot.position.set(0.11 * sx, 0.045, 0.04);
  }
  // Torso with plate carrier, belt and shoulder pads.
  const body = add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.3), uniform));
  body.position.y = 1.1;
  const vestFront = add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.06), dark));
  vestFront.position.set(0, 1.12, 0.17);
  const vestBack = add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.06), dark));
  vestBack.position.set(0, 1.12, -0.17);
  const belt = add(new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.06, 0.31), dark));
  belt.position.set(0, 0.86, 0);
  for (const sx of [-1, 1]) {
    const pad = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.28), accentMat));
    pad.position.set(0.27 * sx, 1.36, 0);
  }
  const patch = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.015), accentMat));
  patch.position.set(0, 1.22, 0.205);
  // Backpack with a bedroll on top.
  const pack = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.13), dark));
  pack.position.set(0, 1.12, -0.235);
  const roll = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 10), helmetMat));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 1.35, -0.235);
  // Head: neck, face, helmet dome + brim, goggles visor.
  const neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 8), skin));
  neck.position.set(0, 1.4, 0);
  const head = add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skin));
  head.position.y = 1.53;
  const helmet = add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), helmetMat));
  helmet.position.set(0, 1.53, -0.01);
  const brim = add(new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.025, 14), helmetMat));
  brim.position.set(0, 1.545, 0);
  const visor = add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.05), visorMat));
  visor.position.set(0, 1.54, 0.175);
  // Held rifle, angled slightly down-forward across the chest.
  const rifle = buildBotRifle();
  rifle.position.set(0.05, 1.18, 0.3);
  rifle.rotation.x = 0.06;
  parts.push(rifle);
  // Arms: two segments each, reaching from the shoulders to the rifle —
  // right hand on the grip, left hand on the handguard.
  const glove = new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.8 });
  const shoulderR = new THREE.Vector3(0.29, 1.33, 0);
  const shoulderL = new THREE.Vector3(-0.29, 1.33, 0);
  const elbowR = new THREE.Vector3(0.3, 1.13, 0.1);
  const elbowL = new THREE.Vector3(-0.28, 1.15, 0.22);
  const handR = new THREE.Vector3(0.1, 1.1, 0.22);
  const handL = new THREE.Vector3(-0.1, 1.16, 0.48);
  parts.push(limb(shoulderR, elbowR, 0.06, uniform));
  parts.push(limb(elbowR, handR, 0.055, uniform));
  parts.push(limb(shoulderL, elbowL, 0.06, uniform));
  parts.push(limb(elbowL, handL, 0.055, uniform));
  for (const h of [handR, handL]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glove);
    hand.position.copy(h);
    parts.push(hand);
  }
  // Team marker above the helmet (soft palette colour, not neon).
  const marker = add(new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 6),
    new THREE.MeshBasicMaterial({ color: accent }),
  ));
  marker.position.y = 1.98;
  // Soldiers cast soft shadows; the floating team marker does not.
  for (const p of parts) {
    if (p !== marker) p.castShadow = true;
  }
  for (const p of parts) group.add(p);
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
    // The model faces local +z, but the game's yaw convention points
    // the aim at (sin yaw, -cos yaw); rotation.y = PI - yaw lines the
    // soldier's face and rifle up with where it actually looks and
    // shoots. Hit detection is positional and unaffected.
    m.group.rotation.y = Math.PI - a.yaw;
    const s = a.crouch ? 0.78 : 1;
    m.group.scale.set(1, s, 1);
  }
}

function render() {
  const p = player;
  if (state.phase === 'menu') {
    // Wide slow orbit over the whole station: the mountains, the lake
    // and the crashed plane all read from up here.
    const t = state.time * 0.06;
    camera.position.set(Math.sin(t) * 48, 24, Math.cos(t) * 48);
    camera.lookAt(0, 0, 0);
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
  updateViewGun();
  updateMeshes();
  station.update(state.time);
  dayNight.update(state.time);
  state.day = dayNight.state;
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
    // Player north of the bot, looking south: the bot faces the
    // player (north), so the moonlight falls on its front and the new
    // soldier model (helmet, vest, rifle) reads clearly.
    player.x = 0;
    player.z = 0;
    player.yaw = Math.PI;
    const b0 = state.agents.find((a) => a.id === 'i0');
    const b1 = state.agents.find((a) => a.id === 'i1');
    if (b0) {
      // Close-up: 5 m ahead, facing the player, so the new soldier
      // model (helmet, vest, rifle) reads clearly. Invulnerable, like
      // the player, so the other bots cannot kill it before the shot.
      b0.x = 0;
      b0.z = 5;
      b0.yaw = 0;
      b0.mode = 'hold';
      b0.holdUntil = 1e9;
      b0.invulnerable = true;
    }
    if (b1) {
      b1.x = 3;
      b1.z = 7;
      b1.yaw = -0.4;
      b1.mode = 'hold';
      b1.holdUntil = 1e9;
      b1.invulnerable = true;
    }
  }
  if (SHOT === 'bomb') {
    state.bomb.state = 'planted';
    state.bomb.site = 'B';
    state.bomb.x = SITES.B.x;
    state.bomb.z = SITES.B.z;
    state.bomb.fuse = 30;
    player.x = 28;
    player.z = -4;
    player.yaw = Math.atan2(SITES.B.x - 28, -(SITES.B.z + 4));
    const b0 = state.agents.find((a) => a.id === 'i0');
    if (b0) {
      b0.x = 38;
      b0.z = -14;
      b0.yaw = Math.PI - 0.4;
      b0.mode = 'hold';
      b0.holdUntil = 1e9;
      b0.invulnerable = true;
    }
    effects.addTracer({ x: 38, y: 1.6, z: -14 }, { x: 33, y: 1.4, z: -10 }, 0xff8a7a);
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
