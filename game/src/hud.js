// Frostline — HUD: the DOM layer. One job: mirror the state into the
// page. No game logic here; main.js calls updateHUD once per frame.
import { WEAPONS, BUY_LIST } from './weapons.js';
import { SITES } from './navgraph.js';

export function collectUI() {
  const byId = (id) => document.getElementById(id);
  return {
    health: byId('health-value'),
    armor: byId('armor-value'),
    ammoMag: byId('ammo-mag'),
    ammoReserve: byId('ammo-reserve'),
    weapon: byId('weapon-name'),
    grenades: byId('grenade-count'),
    timer: byId('timer-value'),
    round: byId('round-value'),
    scoreNorth: byId('score-north'),
    scoreIce: byId('score-ice'),
    money: byId('money-value'),
    bomb: byId('bomb-status'),
    feed: byId('killfeed'),
    banner: byId('banner'),
    bannerTitle: byId('banner-title'),
    bannerSub: byId('banner-sub'),
    again: byId('again'),
    crosshair: byId('crosshair'),
    hitmarker: byId('hitmarker'),
    buyMenu: byId('buy-menu'),
    buyItems: byId('buy-items'),
    buyMoney: byId('buy-money'),
    overlay: byId('overlay'),
    hint: byId('hint'),
    plantBar: byId('plant-bar'),
    plantFill: byId('plant-fill'),
    plantLabel: byId('plant-label'),
  };
}

function fmtTime(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function updateHUD(state, ui) {
  const p = state.player;
  if (!p) return;
  const w = WEAPONS[p.weapon];
  ui.health.textContent = String(Math.max(0, Math.ceil(p.hp)));
  ui.armor.textContent = String(Math.max(0, Math.ceil(p.armor)));
  ui.ammoMag.textContent = String(p.mag);
  ui.ammoReserve.textContent = `/ ${p.reserve}`;
  ui.weapon.textContent = w.name;
  ui.grenades.textContent = `◉ ${p.grenades}`;
  ui.timer.textContent = state.phase === 'live' || state.phase === 'buy' ? fmtTime(state.timer) : '--:--';
  ui.round.textContent = `Round ${state.round} / 9`;
  ui.scoreNorth.textContent = String(state.score.north);
  ui.scoreIce.textContent = String(state.score.ice);
  ui.money.textContent = `$${state.money}`;
  ui.buyMoney.textContent = `$${state.money}`;

  // Bomb line: where the charge is and how long is left on the fuse.
  const b = state.bomb;
  if (b.state === 'planted') {
    ui.bomb.textContent = `CHARGE @ ${SITES[b.site].name} — ${Math.ceil(b.fuse)}s`;
    ui.bomb.className = 'hot';
  } else if (b.state === 'idle' && p.planting) {
    ui.bomb.textContent = 'PLANTING…';
    ui.bomb.className = 'hot';
  } else {
    ui.bomb.textContent = b.state === 'detonated' ? 'CHARGE DETONATED' : 'No charge planted';
    ui.bomb.className = '';
  }

  // Crosshair opens up with spread: stopping to aim pays.
  const spreadPx = 3 + (p.spread || 0) * 260 + p.speed * 1.6;
  ui.crosshair.style.setProperty('--gap', `${spreadPx.toFixed(1)}px`);

  // Kill feed, newest first.
  const feedHtml = state.feed.slice(0, 6).map((f) => `<div class="feed-${f.kind}">${f.text}</div>`).join('');
  if (ui.feed.dataset.html !== feedHtml) {
    ui.feed.innerHTML = feedHtml;
    ui.feed.dataset.html = feedHtml;
  }

  // Banner for round and match ends.
  if (state.banner) {
    ui.banner.hidden = false;
    ui.bannerTitle.textContent = state.banner.title;
    ui.bannerSub.textContent = state.banner.sub;
    ui.again.hidden = state.phase !== 'matchEnd';
  } else {
    ui.banner.hidden = true;
  }

  // Buy menu only during the buy phase.
  ui.buyMenu.hidden = state.phase !== 'buy';
  if (state.phase === 'buy') {
    const html = BUY_LIST.map((item) => {
      const afford = state.money >= item.price ? '' : ' disabled';
      return `<button type="button" class="buy-item${afford}" data-buy="${item.id}"><b>[${item.key}] ${item.label}</b><span>$${item.price}</span></button>`;
    }).join('');
    if (ui.buyItems.dataset.html !== html) {
      ui.buyItems.innerHTML = html;
      ui.buyItems.dataset.html = html;
    }
  }

  // Plant / defuse progress bar.
  const showBar = b.state === 'idle' && p.planting;
  const showDefuse = b.state === 'planted' && p.defusing;
  if (showBar || showDefuse) {
    ui.plantBar.hidden = false;
    ui.plantLabel.textContent = showBar ? 'Planting the charge…' : 'Defusing the charge…';
    ui.plantFill.style.width = `${Math.min(100, (b.progress / (showBar ? 3 : 5)) * 100).toFixed(0)}%`;
  } else {
    ui.plantBar.hidden = true;
  }

  // Context hint.
  let hint = '';
  if (state.phase === 'buy') hint = 'Buy phase — press B to open the shop, or wait for the round.';
  else if (state.phase === 'live' && b.state === 'idle' && state.carrierId === p.id) {
    const inSite = Object.entries(SITES).find(([, s]) => Math.hypot(s.x - p.x, s.z - p.z) < s.r);
    hint = inSite ? 'Hold E to plant the charge.' : `Carry the charge to ${SITES.A.name} or ${SITES.B.name}.`;
  } else if (state.phase === 'live' && b.state === 'planted' && p.team === 'ice') {
    hint = `Charge at ${SITES[b.site].name} — reach it and hold E to defuse.`;
  }
  ui.hint.textContent = hint;
}

export function flashHitmarker(ui) {
  ui.hitmarker.classList.add('on');
  setTimeout(() => ui.hitmarker.classList.remove('on'), 90);
}
