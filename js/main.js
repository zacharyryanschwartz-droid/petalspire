// Petalspire v0.1 — game logic + UI
import * as THREE from 'three';
import { createWorld, tileCenter, GRID } from './world.js';
import { buildPlant } from './plants.js';
import { SPECIES, FEATURES, CARDS, RARITY, ITEMS, SELL_ORDER, TIPS, PACK_PRICE, DUP_COINS, RACK_SLOTS, DRY_S, WATER_PRICE, BARREL_PRICE } from './data.js';
import { ICONS, itemIcon, FEATURE_ART } from './icons.js';

const SAVE_KEY = 'petalspire.v01';
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const now = () => Date.now();
const fillIcons = (root = document) => root.querySelectorAll('i[data-icon]').forEach((i) => { if (!i.firstChild) i.innerHTML = ICONS[i.dataset.icon] || ''; });
const coin = (n) => `<span class="price"><i data-icon="coin"></i>${n}</span>`;
const fmtTime = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const tileName = (i) => `${'ABCDEF'[Math.floor(i / GRID)]}${(i % GRID) + 1}`;

// ---------------- State ----------------
function freshState() {
  return {
    v: 1, coins: 60,
    inv: { seed_heartvine: 3, seed_sunpetal: 2, seed_moonflower: 0, flower_heartvine: 0, flower_sunpetal: 0, flower_moonflower: 0, dried_heartvine: 0, water: 8 },
    unlocked: { heartvine: true, sunpetal: true, moonflower: false, rainbarrel: false, beehive: false, sundial: false },
    owned: { beehive: false, sundial: false },
    discovered: { heartvine: true, sunpetal: true },
    tiles: Array(GRID * GRID).fill(null),
    rack: Array(RACK_SLOTS).fill(null),
    packs: 0, tips: {}, stats: { harvests: 0, sold: 0 },
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { S = null; }
if (!S || S.v !== 1) S = freshState();
else S = Object.assign(freshState(), S);
let saveTimer = 0;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} }, 150); }
window.addEventListener('visibilitychange', () => { if (document.hidden) try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} });

// plant model: {sp, plantedAt, wateredAt|null, growMs}
function progress(p) { if (!p || !p.wateredAt) return 0; return Math.min(1, (now() - p.wateredAt) / p.growMs); }
function stageOf(p) { if (!p.wateredAt) return 0; const k = progress(p); return k >= 1 ? 3 : k >= 0.5 ? 2 : k >= 0.2 ? 1 : 0; }
const STAGES = ['Seed', 'Sprout', 'Bud', 'Bloom'];

// ---------------- World ----------------
const W = createWorld($('#scene'));
const lastStage = [];
function syncTile(i, pop = true) {
  const p = S.tiles[i];
  if (!p) { if (W.setPlant(i, null, 0, false)) {} W.setIcon(i, null); lastStage[i] = null; return; }
  const st = stageOf(p);
  if (W.setPlant(i, p.sp, st, !!p.wateredAt)) W.attachPlant(i, buildPlant(p.sp, st), pop);
  W.setIcon(i, !p.wateredAt ? 'water' : st === 3 ? 'ready' : null);
  if (lastStage[i] != null && lastStage[i] !== st && st === 3) onBloom(i);
  lastStage[i] = st;
}
function syncAll(pop = false) { for (let i = 0; i < S.tiles.length; i++) syncTile(i, pop); W.setRack(S.rack.map((r) => r && { done: now() - r.start >= r.ms })); }
syncAll(false);
document.fonts?.ready.then(() => {
  for (const [obj, text] of [[W.stall, 'Market'], [W.rack, 'Drying Rack']]) {
    const fresh = W.textSprite(text, { h: obj === W.stall ? 0.55 : 0.5 }); const old = obj.userData.label;
    old.material.map = fresh.material.map; old.material.needsUpdate = true; old.scale.copy(fresh.scale);
  }
});

// ---------------- HUD ----------------
let shownCoins = S.coins;
function hud() {
  $('#coin-count').textContent = S.coins; $('#water-count').textContent = S.inv.water;
  const done = S.rack.filter((r) => r && now() - r.start >= r.ms).length;
  const b = $('#rack-badge'); b.classList.toggle('hidden', !done); b.textContent = done;
  if (S.coins !== shownCoins) { const p = $('#pill-coins'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); shownCoins = S.coins; }
}
function toast(msg) { const t = el('div', 'toast', msg); $('#ui').appendChild(t); fillIcons(t); setTimeout(() => t.remove(), 2300); }
function popAt(worldPos, html) {
  const s = W.project(worldPos); const p = el('div', 'pop', html); p.style.left = s.x + 'px'; p.style.top = s.y + 'px';
  $('#popups').appendChild(p); fillIcons(p); setTimeout(() => p.remove(), 1700);
}

// ---------------- Tips ----------------
const tipQueue = []; let tipTimer = 0;
function tip(key) {
  if (S.tips[key] || tipQueue.includes(key)) return;
  tipQueue.push(key); if (tipQueue.length === 1) showTip();
}
function showTip() {
  const key = tipQueue[0]; if (!key) return;
  S.tips[key] = 1; save();
  $('#tip-text').innerHTML = TIPS[key]; $('#tip').classList.remove('hidden');
  clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 7000);
}
function hideTip() { $('#tip').classList.add('hidden'); tipQueue.shift(); if (tipQueue.length) setTimeout(showTip, 350); }
$('#tip').addEventListener('click', () => { clearTimeout(tipTimer); hideTip(); });

// ---------------- Tile sheet ----------------
let selected = null;
function selectTile(i) {
  selected = i; W.select(i); W.ctl.auto = false;
  closePanel(); renderSheet();
}
function deselect() { selected = null; W.select(null); $('#tile-sheet').classList.add('hidden'); }
function seedImg(sp) { return SPECIES[sp].img; }
function renderSheet() {
  const sh = $('#tile-sheet');
  if (selected == null) { sh.classList.add('hidden'); return; }
  const i = selected, p = S.tiles[i];
  let head, body = '';
  if (!p) {
    head = `<h3>Empty plot <small>Plot ${tileName(i)} · choose a seed to plant</small></h3>`;
    const owned = Object.keys(SPECIES).filter((sp) => S.inv['seed_' + sp] > 0);
    if (!owned.length) body = `<p class="muted">You’re out of seeds. Buy more at the Market.</p><div class="ts-actions"><button class="btn btn-primary" data-act="open-market">Visit Market</button></div>`;
    else body = `<div class="ts-row">${owned.map((sp) => `<button class="seed-chip" data-plant="${sp}"><img src="${seedImg(sp)}" alt=""/>${SPECIES[sp].name.replace('Spiral ', '')}<small>×${S.inv['seed_' + sp]} seeds</small></button>`).join('')}</div>`;
  } else {
    const sp = SPECIES[p.sp], st = stageOf(p), k = progress(p);
    head = `<h3>${sp.name} <small>Plot ${tileName(i)} · ${p.wateredAt ? STAGES[st] : 'Thirsty seed'}</small></h3>`;
    const dots = `<div class="stage-dots">${STAGES.map((s, n) => `<span class="${n <= st && p.wateredAt ? 'on' : ''}">${s}</span>`).join('')}</div>`;
    if (!p.wateredAt) {
      body = `<p class="muted">This seed needs water before it can grow.</p><div class="ts-actions"><button class="btn btn-primary" data-act="water" ${S.inv.water ? '' : 'disabled'}><i data-icon="water"></i> Water (${S.inv.water} left)</button>${S.inv.water ? '' : '<button class="btn" data-act="open-market">Buy water</button>'}</div>`;
    } else if (st < 3) {
      body = `<div class="progress"><b id="sheet-prog" style="width:${(k * 100).toFixed(1)}%"></b></div>${dots}<p class="muted" id="sheet-left" style="margin-top:6px">Blooms in ${fmtTime(p.growMs * (1 - k))}</p>`;
    } else {
      body = `${dots}<div class="ts-actions"><button class="btn btn-gold" data-act="harvest"><i data-icon="sparkle"></i> Harvest</button></div>`;
    }
  }
  sh.innerHTML = `<div class="ts-head">${head}<button class="close-btn" data-act="close">×</button></div>${body}`;
  fillIcons(sh); sh.classList.remove('hidden');
}
$('#tile-sheet').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.plant) return plant(selected, b.dataset.plant);
  const a = b.dataset.act;
  if (a === 'close') deselect();
  else if (a === 'water') water(selected);
  else if (a === 'harvest') harvest(selected);
  else if (a === 'open-market') openPanel('market', 'buy');
});

function plant(i, sp) {
  if (S.tiles[i] || !(S.inv['seed_' + sp] > 0)) return;
  S.inv['seed_' + sp]--;
  S.tiles[i] = { sp, plantedAt: now(), wateredAt: null, growMs: SPECIES[sp].growS * 1000 };
  syncTile(i); save(); hud(); renderSheet(); tip('water');
}
function water(i) {
  const p = S.tiles[i]; if (!p || p.wateredAt || S.inv.water <= 0) return;
  S.inv.water--; p.wateredAt = now(); p.growMs = SPECIES[p.sp].growS * 1000 * (S.owned.sundial ? 0.75 : 1);
  W.splash(i); syncTile(i); save(); hud(); renderSheet(); tip('growing');
  popAt(tileCenter(i).setY(1), `<i data-icon="water"></i>Watered`);
}
function harvest(i) {
  const p = S.tiles[i]; if (!p || stageOf(p) < 3) return;
  const sp = SPECIES[p.sp];
  const f = randInt(...sp.yieldF) + (S.owned.beehive ? 1 : 0), s = randInt(...sp.yieldS);
  S.inv['flower_' + p.sp] += f; S.inv['seed_' + p.sp] += s; S.tiles[i] = null; S.stats.harvests++;
  syncTile(i); save(); hud();
  popAt(tileCenter(i).setY(1.2), `+${f} ${sp.name.replace('Spiral ', '')}`);
  setTimeout(() => popAt(tileCenter(i).setY(0.8), `+${s} seed${s > 1 ? 's' : ''}`), 350);
  renderSheet(); tip('harvested'); if (p.sp === 'heartvine') tip('heartvine');
}
function onBloom(i) { tip('bloom'); if (selected === i) renderSheet(); }

// ---------------- Panels ----------------
let panel = null, marketTab = 'sell';
function openPanel(name, tab) {
  panel = name; if (tab) marketTab = tab;
  $('#tile-sheet').classList.add('hidden'); if (selected != null) { selected = null; W.select(null); }
  $('#settings').classList.add('hidden');
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
  $('#panel').classList.remove('hidden'); renderPanel(); $('#panel-body').scrollTop = 0;
}
function closePanel() { panel = null; $('#panel').classList.add('hidden'); document.querySelectorAll('#tabbar button').forEach((b) => b.classList.remove('on')); }
$('#panel-close').addEventListener('click', closePanel);
$('#panel').addEventListener('click', (e) => { if (e.target.id === 'panel') closePanel(); });
document.querySelectorAll('#tabbar button').forEach((b) => b.addEventListener('click', () => (panel === b.dataset.panel ? closePanel() : openPanel(b.dataset.panel))));

function itemSvg(id) { const it = ITEMS[id]; return it ? itemIcon(...it.icon) : itemIcon('water'); }
function renderPanel() {
  const body = $('#panel-body'); const title = $('#panel-title');
  if (panel === 'bag') { title.textContent = 'Your Satchel'; body.innerHTML = bagHTML(); }
  if (panel === 'market') { title.textContent = 'Garden Market'; body.innerHTML = marketHTML(); }
  if (panel === 'packs') { title.textContent = 'Card Packs'; body.innerHTML = packsHTML(); }
  if (panel === 'rack') { title.textContent = 'Drying Rack'; body.innerHTML = rackHTML(); }
  fillIcons(body);
}
function bagHTML() {
  const ids = ['water', 'seed_heartvine', 'seed_sunpetal', 'seed_moonflower', 'flower_heartvine', 'flower_sunpetal', 'flower_moonflower', 'dried_heartvine'];
  const cells = ids.filter((id) => S.inv[id] > 0 || id === 'water').map((id) => `<div class="inv">${itemSvg(id)}<b>${id === 'water' ? 'Water' : ITEMS[id].name}</b><small>×${S.inv[id]}</small></div>`).join('');
  const feats = Object.keys(S.owned).filter((k) => S.owned[k]).map((k) => `<div class="row"><div class="ico">${FEATURE_ART[k]}</div><div class="meta"><b>${FEATURES[k].name}</b><small>${FEATURES[k].blurb.replace('Once bought, ', '')}</small></div></div>`).join('');
  return `<div class="inv-grid">${cells}</div>${feats ? `<div class="sec-title">Garden features</div><div class="list">${feats}</div>` : ''}
    <p class="muted" style="margin:14px 4px 0">Tip: tap an empty soil tile to plant. Harvested flowers and spare seeds can be sold at the Market.</p>`;
}
function marketHTML() {
  let h = `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh seeds &amp; fair prices</p></div>
    <div class="seg"><button data-tab="sell" class="${marketTab === 'sell' ? 'on' : ''}">Sell</button><button data-tab="buy" class="${marketTab === 'buy' ? 'on' : ''}">Buy</button></div>`;
  if (marketTab === 'sell') {
    const rows = SELL_ORDER.filter((id) => S.inv[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>You have ${S.inv[id]} · ${ITEMS[id].sell} each</small></div>
      <div class="acts"><button class="btn sm" data-sell="${id}" data-n="1">Sell 1</button><button class="btn btn-gold sm" data-sell="${id}" data-n="all">All ${coin(ITEMS[id].sell * S.inv[id])}</button></div></div>`).join('');
    h += rows ? `<div class="list">${rows}</div>` : `<div class="empty">Nothing to sell yet — harvest some blooms first.</div>`;
  } else {
    const rows = [];
    rows.push(buyRow('water5', itemIcon('water'), 'Watering can refill', '+5 water', WATER_PRICE));
    if (S.unlocked.rainbarrel) rows.push(buyRow('water15', FEATURE_ART.rainbarrel, 'Rain Barrel water', '+15 water · best value', BARREL_PRICE));
    else rows.push(lockedRow(FEATURE_ART.rainbarrel, 'Rain Barrel water'));
    for (const sp of Object.keys(SPECIES)) {
      const d = SPECIES[sp];
      if (S.unlocked[sp]) rows.push(buyRow('seed_' + sp, `<img src="${d.img}" alt=""/>`, `${d.name} Seeds`, `${RARITY[d.rarity].label} · blooms in ~${d.growS}s · you have ${S.inv['seed_' + sp]}`, d.seedPrice));
      else rows.push(lockedRow(`<img src="${d.img}" alt=""/>`, `${d.name} Seeds`));
    }
    for (const f of ['beehive', 'sundial']) {
      const d = FEATURES[f];
      if (S.owned[f]) rows.push(`<div class="row"><div class="ico">${FEATURE_ART[f]}</div><div class="meta"><b>${d.name}</b><small>Owned · ${d.blurb.replace('Once bought, ', '')}</small></div></div>`);
      else if (S.unlocked[f]) rows.push(buyRow(f, FEATURE_ART[f], d.name, d.blurb.replace('Once bought, ', ''), d.price));
      else rows.push(lockedRow(FEATURE_ART[f], d.name));
    }
    h += `<div class="list">${rows.join('')}</div>`;
  }
  return h;
}
function buyRow(id, icon, name, sub, price) {
  return `<div class="row"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>${sub}</small></div><div class="acts"><button class="btn btn-primary sm" data-buy="${id}" data-price="${price}" ${S.coins < price ? 'disabled' : ''}>${coin(price)}</button></div></div>`;
}
function lockedRow(icon, name) {
  return `<div class="row locked"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>Discover it in a Card Pack to unlock</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`;
}
function sell(id, n) {
  const have = S.inv[id]; if (!have) return;
  const q = n === 'all' ? have : 1; const gain = q * ITEMS[id].sell;
  S.inv[id] -= q; S.coins += gain; S.stats.sold += q;
  save(); hud(); renderPanel(); toast(`Sold ${q} ${ITEMS[id].name} for ${gain} coins`); tip('sold');
}
function buy(id, price) {
  if (S.coins < price) return;
  S.coins -= price;
  if (id === 'water5') S.inv.water += 5;
  else if (id === 'water15') S.inv.water += 15;
  else if (id.startsWith('seed_')) S.inv[id]++;
  else if (FEATURES[id]) S.owned[id] = true;
  save(); hud(); renderPanel();
  toast(id.startsWith('seed_') ? `Bought 1 ${ITEMS[id].name.replace(' Seeds', ' seed')}` : id.startsWith('water') ? 'Water topped up' : `${FEATURES[id].name} added to your garden`);
}

function packsHTML() {
  const disc = Object.keys(CARDS).filter((k) => S.discovered[k]);
  const odds = Object.entries(RARITY).map(([k, r]) => `<span style="border-color:${r.color};color:${r.color}">${r.label} ${r.w}%</span>`).join('');
  return `<div class="pack-hero"><div class="pack-art"><img src="assets/pack.jpg" alt="Botanical card pack"/></div>
    <div class="pack-info"><h4>Botanical Card Pack</h4><p>3 illustrated cards. New discoveries unlock seeds &amp; features in the Market.</p>
    <button class="btn btn-gold" data-act="buy-pack" ${S.coins < PACK_PRICE ? 'disabled' : ''}>Open pack · ${coin(PACK_PRICE)}</button></div></div>
    <div class="odds">${odds}</div>
    <div class="sec-title">Your collection · ${disc.length}/${Object.keys(CARDS).length}</div>
    <div class="coll">${Object.keys(CARDS).map((k) => (S.discovered[k] ? cardHTML(k) : `<div class="card"><div class="back" style="position:absolute;inset:0;border-radius:1.1em;opacity:.55"><img src="assets/emblem.png" alt=""/><span>?</span></div></div>`)).join('')}</div>`;
}
function rackHTML() {
  const slots = S.rack.map((r, k) => {
    if (!r) return `<button class="slot" data-slot="${k}">${itemIcon('bundle', '#EFE6D6').replace('<svg', '<svg class="bundle" opacity=".5"')}<span>${S.inv.flower_heartvine ? 'Tap to hang Heartvine' : 'Empty'}</span></button>`;
    const left = r.ms - (now() - r.start);
    if (left <= 0) return `<button class="slot done" data-slot="${k}">${itemIcon('bundle', '#C99A8E').replace('<svg', '<svg class="bundle"')}<span>Dried! Tap to collect</span></button>`;
    const k2 = 1 - left / r.ms, C = 2 * Math.PI * 22;
    return `<div class="slot drying"><svg class="ring" viewBox="0 0 54 54"><circle cx="27" cy="27" r="22" fill="none" stroke="#F3E3DA" stroke-width="5"/><circle cx="27" cy="27" r="22" fill="none" stroke="#F2AEB3" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - k2)}" transform="rotate(-90 27 27)"/></svg><span data-left="${k}">${fmtTime(left)}</span></div>`;
  }).join('');
  return `<div class="hero"><img src="assets/rack.jpg" alt=""/><p>Hang fresh Heartvine to dry</p></div>
    <div class="slots">${slots}</div>
    <div class="row"><div class="ico">${itemSvg('flower_heartvine')}</div><div class="meta"><b>Fresh Heartvine ×${S.inv.flower_heartvine}</b><small>Dries in ${DRY_S}s · sells for ${ITEMS.dried_heartvine.sell} (fresh: ${ITEMS.flower_heartvine.sell})</small></div>
    <div class="acts"><button class="btn btn-blush sm" data-act="fill-rack" ${S.inv.flower_heartvine && S.rack.includes(null) ? '' : 'disabled'}>Hang all</button></div></div>
    ${S.inv.dried_heartvine ? `<p class="muted" style="margin:10px 4px 0">You have ${S.inv.dried_heartvine} Dried Heartvine — sell it at the Market.</p>` : ''}`;
}
function hang(k) {
  if (S.rack[k] || !S.inv.flower_heartvine) return false;
  S.inv.flower_heartvine--; S.rack[k] = { start: now(), ms: DRY_S * 1000 }; return true;
}
function collect(k) {
  const r = S.rack[k]; if (!r || now() - r.start < r.ms) return;
  S.rack[k] = null; S.inv.dried_heartvine++; toast('+1 Dried Heartvine');
}
$('#panel-body').addEventListener('click', (e) => {
  const b = e.target.closest('button, .coll .card'); if (!b) return;
  if (b.dataset.tab) { marketTab = b.dataset.tab; renderPanel(); return; }
  if (b.dataset.sell) return sell(b.dataset.sell, b.dataset.n);
  if (b.dataset.buy) return buy(b.dataset.buy, +b.dataset.price);
  if (b.dataset.slot != null) { const k = +b.dataset.slot; if (S.rack[k]) collect(k); else hang(k); afterRack(); return; }
  if (b.dataset.act === 'fill-rack') { for (let k = 0; k < RACK_SLOTS; k++) hang(k); afterRack(); return; }
  if (b.dataset.act === 'buy-pack') return buyPack();
  if (b.classList.contains('card') && b.dataset.card) zoomCard(b.dataset.card);
});
function afterRack() { save(); hud(); renderPanel(); W.setRack(S.rack.map((r) => r && { done: now() - r.start >= r.ms })); }

// ---------------- Cards ----------------
function cardHTML(id, extra = '') {
  const c = CARDS[id]; const r = RARITY[c.rarity];
  const art = SPECIES[id] ? `<img src="${c.img}" alt=""/>` : FEATURE_ART[id];
  const stats = Object.entries(c.stats).map(([k, v]) => `<span>${k}</span><span class="pips">${[1, 2, 3, 4, 5].map((n) => `<b class="${n <= v ? 'on' : ''}"></b>`).join('')}</span>`).join('');
  return `<div class="card r-${c.rarity}" data-card="${id}">${extra}<div class="card-face"><div class="card-rar">${r.label}</div><div class="card-art">${art}</div>
    <div class="card-name">${c.name}</div><div class="card-type">${c.type}</div><div class="stats">${stats}</div></div></div>`;
}
function zoomCard(id) {
  const z = el('div', 'zoom', cardHTML(id) + `<p class="zoom-text">${CARDS[id].blurb}<br/><small>Tap anywhere to close</small></p>`);
  z.addEventListener('click', () => z.remove()); $('#ui').appendChild(z);
}
function drawCard(forceId) {
  if (forceId) return forceId;
  let roll = Math.random() * 100; let rar = 'common';
  for (const [k, r] of Object.entries(RARITY)) { if (roll < r.w) { rar = k; break; } roll -= r.w; }
  const pool = Object.keys(CARDS).filter((k) => CARDS[k].rarity === rar);
  return pool[Math.floor(Math.random() * pool.length)];
}
let revealCards = null;
function buyPack(forced) {
  if (S.coins < PACK_PRICE) return;
  S.coins -= PACK_PRICE; S.packs++;
  const ids = [drawCard(), drawCard(), drawCard()];
  if (S.packs === 1 && !S.unlocked.moonflower) ids[1] = 'moonflower'; // first pack always reveals the Moonflower
  if (forced) forced.forEach((f, k) => f && (ids[k] = f));
  const results = ids.map((id) => {
    const isNew = !S.discovered[id] || (!S.unlocked[id]);
    S.discovered[id] = true;
    if (isNew) S.unlocked[id] = true; else S.coins += DUP_COINS;
    return { id, isNew };
  });
  // later duplicates within same pack
  const seen = new Set(); results.forEach((r) => { if (r.isNew && seen.has(r.id)) { r.isNew = false; S.coins += DUP_COINS; } seen.add(r.id); });
  save(); hud(); closePanel(); showReveal(results);
}
function showReveal(results) {
  revealCards = results;
  const R = $('#reveal'); R.classList.remove('hidden');
  R.innerHTML = `<div class="rays"></div><h2>Botanical Card Pack</h2><p class="sub">Tap the pack to open</p><div class="big-pack" id="bigpack"><img src="assets/pack.jpg" alt=""/></div><div class="reveal-actions"></div>`;
  const bp = $('#bigpack');
  const open = () => {
    bp.removeEventListener('click', open); bp.classList.add('shake');
    setTimeout(() => { bp.classList.remove('shake'); bp.classList.add('burst'); R.appendChild(el('div', 'flash')); sparkles(R, window.innerWidth / 2, window.innerHeight * 0.45, 26); }, 850);
    setTimeout(() => deal(results), 1250);
  };
  bp.addEventListener('click', open);
  R.dataset.stage = 'pack';
}
function deal(results) {
  const R = $('#reveal'); R.dataset.stage = 'deal';
  R.innerHTML = `<div class="rays"></div><h2>Your new cards</h2><p class="sub">Tap each card to reveal it</p><div class="deal"></div><div class="reveal-actions"><button class="btn" data-act="reveal-all">Reveal all</button></div>`;
  const d = $('.deal', R);
  results.forEach((r, k) => {
    const rar = CARDS[r.id].rarity;
    const c = el('div', `card flip ${['rare', 'epic', 'legendary'].includes(rar) ? 'hint-' + rar : ''}`);
    const w = el('div', 'slotw'); w.style.animationDelay = `${k * 0.16}s`; w.appendChild(c);
    c.innerHTML = `<div class="flip-inner"><div class="back"><img src="assets/emblem.png" alt=""/><span>Petalspire</span></div><div class="front">${cardHTML(r.id, r.isNew ? '<span class="new-tag">NEW</span>' : `<span class="dup-tag">Duplicate · +${DUP_COINS}</span>`)}</div></div>`;
    const front = c.querySelector('.front > .card'); front.style.cssText = 'position:absolute;inset:0;width:auto;--cw:inherit';
    c.addEventListener('click', () => { if (!c.classList.contains('flipped')) flip(c, r); else zoomCard(r.id); });
    d.appendChild(w);
  });
  $('[data-act="reveal-all"]', R).addEventListener('click', () => {
    [...d.querySelectorAll('.flip')].forEach((c, k) => setTimeout(() => !c.classList.contains('flipped') && flip(c, results[k]), k * 280));
  });
}
function flip(c, r) {
  c.classList.add('flipped');
  const rar = CARDS[r.id].rarity; const b = c.getBoundingClientRect();
  if (rar !== 'common') sparkles($('#reveal'), b.left + b.width / 2, b.top + b.height / 2, rar === 'legendary' ? 30 : rar === 'epic' ? 22 : 14);
  const R = $('#reveal');
  if ([...R.querySelectorAll('.deal .flip')].every((x) => x.classList.contains('flipped'))) {
    const news = revealCards.filter((x) => x.isNew).map((x) => CARDS[x.id].name);
    $('.sub', R).textContent = news.length ? `Unlocked in the Market: ${news.join(', ')}` : 'All duplicates — coins added to your purse';
    $('.reveal-actions', R).innerHTML = `<button class="btn btn-primary big" data-act="collect">Collect</button>`;
    $('[data-act="collect"]', R).addEventListener('click', () => { R.classList.add('hidden'); R.innerHTML = ''; tip('pack'); if (news.length) openPanel('market', 'buy'); });
  }
}
function sparkles(root, x, y, n) {
  for (let i = 0; i < n; i++) {
    const s = el('div', 'sparkle'); const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 140;
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    s.style.width = s.style.height = 5 + Math.random() * 9 + 'px'; s.style.animationDelay = Math.random() * 0.15 + 's';
    root.appendChild(s); setTimeout(() => s.remove(), 1500);
  }
}

// ---------------- Settings ----------------
$('#btn-settings').addEventListener('click', (e) => { e.stopPropagation(); $('#settings').classList.toggle('hidden'); });
$('#btn-tips').addEventListener('click', () => { S.tips = {}; save(); $('#settings').classList.add('hidden'); tip('welcome'); });
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Reset your garden? This erases all progress on this device.')) return;
  localStorage.removeItem(SAVE_KEY); S = freshState(); save(); location.reload();
});

// ---------------- Input: orbit / pinch / tap ----------------
const canvas = $('#scene');
const ptrs = new Map(); let gesture = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture?.(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  W.ctl.auto = false; $('#settings').classList.add('hidden');
  if (ptrs.size === 1) gesture = { tap: true };
  else { gesture = { tap: false, pinch: pinchDist(), zoom: W.ctl.zoom }; }
});
function pinchDist() { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p || !gesture) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9) gesture.tap = false;
  if (ptrs.size >= 2 && gesture.pinch) {
    W.ctl.zoom = THREE.MathUtils.clamp(gesture.zoom * gesture.pinch / pinchDist(), 0.5, 1.3); W.updateCamera();
  } else if (ptrs.size === 1 && !gesture.tap) {
    W.ctl.az -= dx * 0.008; W.ctl.pol = THREE.MathUtils.clamp(W.ctl.pol - dy * 0.005, 0.55, 1.22); W.updateCamera();
  }
});
const endPtr = (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (gesture?.tap && ptrs.size === 0 && e.type === 'pointerup' && performance.now() - p.t < 600) handleTap(e.clientX, e.clientY);
  if (ptrs.size === 0) gesture = null;
  else if (ptrs.size === 1) gesture = { tap: false };
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); W.ctl.auto = false; W.ctl.zoom = THREE.MathUtils.clamp(W.ctl.zoom * Math.exp(e.deltaY * 0.001), 0.5, 1.3); W.updateCamera(); }, { passive: false });
['gesturestart', 'gesturechange', 'dblclick'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.panel-body')) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const t = performance.now(); if (t - lastTouchEnd < 320 && !e.target.closest('button')) e.preventDefault(); lastTouchEnd = t; }, { passive: false });

function handleTap(x, y) {
  if (panel) return closePanel();
  const hit = W.pick(x, y);
  if (!hit) return deselect();
  if (hit.kind === 'tile') {
    const p = S.tiles[hit.index];
    // quick actions: tap a selected thirsty / bloomed plant again to act
    if (selected === hit.index && p) { if (!p.wateredAt && S.inv.water) return water(hit.index); if (stageOf(p) === 3) return harvest(hit.index); }
    if (p && stageOf(p) === 3 && selected !== hit.index) { selectTile(hit.index); return; }
    selectTile(hit.index);
  } else if (hit.kind === 'market') openPanel('market');
  else if (hit.kind === 'rack') openPanel('rack');
}

// ---------------- Title ----------------
const hasSave = !!localStorage.getItem(SAVE_KEY);
if (hasSave) $('#btn-start').textContent = 'Continue';
$('#btn-start').addEventListener('click', () => {
  $('#title').classList.add('out'); setTimeout(() => $('#title').classList.add('hidden'), 650);
  W.ctl.auto = false; tip('welcome'); save();
});

// ---------------- Loop ----------------
let lastTick = 0;
function tick() {
  requestAnimationFrame(tick);
  const t = performance.now();
  if (t - lastTick > 250) {
    lastTick = t;
    for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i]) syncTile(i);
    W.setRack(S.rack.map((r) => r && { done: now() - r.start >= r.ms }));
    hud();
    if (selected != null && S.tiles[selected]?.wateredAt) {
      const p = S.tiles[selected], k = progress(p), pr = $('#sheet-prog');
      if (pr) { pr.style.width = (k * 100).toFixed(1) + '%'; $('#sheet-left').textContent = `Blooms in ${fmtTime(p.growMs * (1 - k))}`; }
      const st = stageOf(p); if (st !== +($('#tile-sheet').dataset.st ?? -1)) { $('#tile-sheet').dataset.st = st; renderSheet(); }
    }
    if (panel === 'rack') {
      const needs = S.rack.some((r, k) => r && document.querySelector(`[data-left="${k}"]`) && now() - r.start >= r.ms);
      if (needs) renderPanel(); else S.rack.forEach((r, k) => { const n = document.querySelector(`[data-left="${k}"]`); if (r && n) { n.textContent = fmtTime(r.ms - (now() - r.start)); const ring = n.previousElementSibling.lastElementChild; const C = 2 * Math.PI * 22; ring.setAttribute('stroke-dashoffset', C * ((r.ms - (now() - r.start)) / r.ms)); } });
    }
  }
  W.render();
}
fillIcons(); hud(); tick();
setInterval(save, 5000);

// ---------------- Debug hooks (used by automated tests) ----------------
window.__ps = {
  get state() { return S; }, get selected() { return selected; }, W, THREE,
  skip(sec) { const ms = sec * 1000; S.tiles.forEach((p) => { if (p) { p.plantedAt -= ms; if (p.wateredAt) p.wateredAt -= ms; } }); S.rack.forEach((r) => r && (r.start -= ms)); save(); },
  tileScreen(i) { return W.project(tileCenter(i).setY(0.3)); },
  iconScreen(i) { return W.tiles[i].icon.visible ? W.project(W.iconWorld(i)) : null; },
  selectTile, plant, water, harvest, openPanel, closePanel, buyPack, sell, buy,
  camera(az, pol, zoom) { if (az != null) W.ctl.az = az; if (pol != null) W.ctl.pol = pol; if (zoom != null) W.ctl.zoom = zoom; W.ctl.auto = false; W.updateCamera(); },
  dismissTip() { clearTimeout(tipTimer); tipQueue.length = 0; $('#tip').classList.add('hidden'); },
};
