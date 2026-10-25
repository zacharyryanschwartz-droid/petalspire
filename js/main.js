// Petalspire v0.2 — game logic + UI
import * as THREE from 'three';
import { createWorld } from './world.js';
import { buildPlant } from './plants.js';
import { SPECIES, FEATURES, CARDS, RARITY, ITEMS, SELL_ORDER, TIPS, PACK_PRICE, DUP_COINS, RACK_SLOTS, DRY_S, WATER_PRICE, BARREL_PRICE,
  WOOD, BED_COSTS, STAND_CAP, MARKET_GOAL, WATER_REGEN_S, WATER_REGEN_MAX, STARTER } from './data.js';
import { LOTS, SIGNS, LOT_FOR_SALE, LOT_PRICES, SITES, OBSTACLES, SPOTS, BED_N, siteById, obstacleById, inSite, lotCenter, lotAt } from './layout.js';
import { ICONS, itemIcon, FEATURE_ART } from './icons.js';

const SAVE_KEY = 'petalspire.v02', OLD_KEYS = ['petalspire.v01'];
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const now = () => Date.now();
const fillIcons = (root = document) => root.querySelectorAll('i[data-icon]').forEach((i) => { if (!i.firstChild) i.innerHTML = ICONS[i.dataset.icon] || ''; });
const coin = (n) => `<span class="price"><i data-icon="coin"></i>${n}</span>`;
const woodTag = (n) => `<span class="price"><i data-icon="wood"></i>${n}</span>`;
const fmtTime = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const PER_BED = BED_N * BED_N;

// ---------------- State ----------------
function freshState() {
  return {
    v: 2, coins: 10, wood: 0,
    inv: { seed_heartvine: 0, seed_sunpetal: 0, seed_moonflower: 0, flower_heartvine: 0, flower_sunpetal: 0, flower_moonflower: 0, dried_heartvine: 0, water: 0 },
    unlocked: { heartvine: true, sunpetal: true, moonflower: false, rainbarrel: false, beehive: false, sundial: false },
    owned: { beehive: false, sundial: false },
    discovered: {},
    lots: { home: true }, lotsBought: 0, obs: {}, beds: [], tiles: [],
    rack: Array(RACK_SLOTS).fill(null), rackUnlocked: false,
    stand: {}, standOpen: false, market: false, starterOpened: false, waterAt: 0,
    packs: 0, tips: {}, goal: 0, introDone: false,
    stats: { chopped: 0, stumps: 0, harvests: 0, watered: 0, stocked: 0, customers: 0, standEarned: 0, sold: 0 },
  };
}
let S, migrated = false;
try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { S = null; }
if (!S || S.v !== 2) {
  S = freshState();
  for (const k of OLD_KEYS) if (localStorage.getItem(k)) { migrated = true; localStorage.removeItem(k); }
} else {
  const f = freshState(); S = { ...f, ...S, inv: { ...f.inv, ...S.inv }, stats: { ...f.stats, ...S.stats }, unlocked: { ...f.unlocked, ...S.unlocked } };
}
let saveTimer = 0;
const writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} };
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeSave, 150); }
window.addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); });

function progress(p) { if (!p || !p.wateredAt) return 0; return Math.min(1, (now() - p.wateredAt) / p.growMs); }
function stageOf(p) { if (!p.wateredAt) return 0; const k = progress(p); return k >= 1 ? 3 : k >= 0.5 ? 2 : k >= 0.2 ? 1 : 0; }
const STAGES = ['Seed', 'Sprout', 'Bud', 'Bloom'];
const obsState = (id) => { const v = S.obs[id]; if (v === 'x') return 'gone'; if (v === 's') return 'stump'; return obstacleById(id).type === 'stump' ? 'stump' : 'full'; };
const SITE_OBS = Object.fromEntries(SITES.map((s) => [s.id, OBSTACLES.filter((o) => inSite(o, s)).map((o) => o.id)]));
const siteClear = (id) => SITE_OBS[id].every((o) => obsState(o) === 'gone');
const siteLeft = (id) => SITE_OBS[id].filter((o) => obsState(o) !== 'gone').length;
const bedCost = () => BED_COSTS[Math.min(S.beds.length, BED_COSTS.length - 1)];
const standCount = () => Object.values(S.stand).reduce((a, b) => a + b, 0);
const lotPrice = () => LOT_PRICES[Math.min(S.lotsBought, LOT_PRICES.length - 1)];
const tileName = (i) => { const b = Math.floor(i / PER_BED), k = i % PER_BED; return `Bed ${b + 1} · ${'ABC'[Math.floor(k / BED_N)]}${(k % BED_N) + 1}`; };

// ---------------- World ----------------
const W = createWorld($('#scene'));
for (const o of OBSTACLES) W.setObstacle(o.id, obsState(o.id));
for (const id of LOT_FOR_SALE) W.setLotOwned(id, !!S.lots[id]);
S.beds.forEach((id) => W.addBed(id, false));
while (S.tiles.length < S.beds.length * PER_BED) S.tiles.push(null);
if (S.standOpen) { W.appear(W.stand, false); W.appear(W.barrel, false); }
if (S.rackUnlocked) W.appear(W.rack, false);
W.setMarketOpen(S.market);
const lastStage = [];
function syncTile(i, pop = true) {
  const p = S.tiles[i];
  if (!p) { W.setPlant(i, null, 0, false); W.setIcon(i, null); lastStage[i] = null; return; }
  const st = stageOf(p);
  if (W.setPlant(i, p.sp, st, !!p.wateredAt)) W.attachPlant(i, buildPlant(p.sp, st), pop);
  W.setIcon(i, !p.wateredAt ? 'water' : st === 3 ? 'ready' : null);
  if (lastStage[i] != null && lastStage[i] !== st && st === 3) onBloom(i);
  lastStage[i] = st;
}
function syncRack() { W.setRack(S.rack.map((r) => r && { done: now() - r.start >= r.ms })); }
function syncStand() { W.setStandStock({ heart: S.stand.flower_heartvine || S.stand.dried_heartvine || S.stand.seed_heartvine, sun: S.stand.flower_sunpetal || S.stand.seed_sunpetal, moon: S.stand.flower_moonflower || S.stand.seed_moonflower || S.stand.dried_heartvine }); }
for (let i = 0; i < S.tiles.length; i++) syncTile(i, false);
syncRack(); syncStand();
document.fonts?.ready.then(() => {
  for (const obj of [W.stand, W.rack, W.market]) {
    const L = obj.userData.label; const fresh = W.textSprite(L.userData.text, { h: L.userData.h, ...(L.userData.text.includes('Closed') ? { color: '#7C6A4C', border: '#D9C9A4' } : {}) });
    L.material.map = fresh.material.map; L.material.needsUpdate = true; L.scale.copy(fresh.scale);
  }
});

// ---------------- HUD ----------------
const shown = { coins: S.coins, wood: S.wood, water: S.inv.water };
function bump(id) { const p = $(id); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
function hud() {
  $('#coin-count').textContent = S.coins; $('#water-count').textContent = S.inv.water; $('#wood-count').textContent = S.wood;
  if (S.coins !== shown.coins) { bump('#pill-coins'); shown.coins = S.coins; }
  if (S.wood !== shown.wood) { bump('#pill-wood'); shown.wood = S.wood; }
  if (S.inv.water !== shown.water) { bump('#pill-water'); shown.water = S.inv.water; }
  const done = S.rack.filter((r) => r && now() - r.start >= r.ms).length;
  const b = $('#rack-badge'); b.classList.toggle('hidden', !done); b.textContent = done;
  $('#tab-stand').classList.toggle('hidden', !S.standOpen);
  $('#tab-rack').classList.toggle('hidden', !S.rackUnlocked);
  $('#tab-market').classList.toggle('locked', !S.market);
  const sb = $('#stand-badge'); const n = standCount(); sb.classList.toggle('hidden', !n); sb.textContent = n;
  const canBuild = S.wood >= bedCost() && SITES.some((s) => S.lots[s.lot] && !S.beds.includes(s.id) && siteClear(s.id));
  $('#tab-build').classList.toggle('glow', canBuild && S.beds.length < 2);
  renderGoal();
}
function toast(msg) { const t = el('div', 'toast', msg); $('#ui').appendChild(t); fillIcons(t); setTimeout(() => t.remove(), 2300); }
function popAt(worldPos, html, cls = '') {
  const s = W.project(worldPos); const p = el('div', 'pop ' + cls, html); p.style.left = s.x + 'px'; p.style.top = s.y + 'px';
  $('#popups').appendChild(p); fillIcons(p); setTimeout(() => p.remove(), 1700);
}

// ---------------- Goals ----------------
const GOALS = [
  { id: 'clear', text: 'Clear 8 trees', n: () => S.stats.chopped, of: 8, icon: 'axe', hint: 'chop' },
  { id: 'bed', text: 'Build a raised bed', n: () => S.beds.length, of: 1, icon: 'build', hint: 'build' },
  { id: 'plant', text: 'Plant & water a seed', n: () => S.stats.watered, of: 1, icon: 'sprout', hint: 'water' },
  { id: 'harvest', text: 'Harvest a bloom', n: () => S.stats.harvests, of: 1, icon: 'sparkle', hint: 'bloom' },
  { id: 'stock', text: 'Stock your farm stand', n: () => S.stats.stocked, of: 1, icon: 'stand', hint: 'stand' },
  { id: 'sale', text: 'Sell to a customer', n: () => S.stats.customers, of: 1, icon: 'coin', hint: 'customer' },
  { id: 'earn', text: `Earn ${MARKET_GOAL} coins to reopen the Supply Market`, n: () => S.stats.standEarned, of: MARKET_GOAL, icon: 'market', hint: 'customer' },
  { id: 'plot', text: 'Buy a neighboring plot', n: () => S.lotsBought, of: 1, icon: 'sign', hint: 'plot' },
];
function checkGoals() {
  if (!S.market && S.stats.standEarned >= MARKET_GOAL) unlockMarket();
  while (S.goal < GOALS.length && GOALS[S.goal].n() >= GOALS[S.goal].of) {
    const g = GOALS[S.goal]; S.goal++; save();
    const card = $('#goal'); card.classList.remove('done'); void card.offsetWidth; card.classList.add('done');
    toast(`<i data-icon="flag"></i> Goal complete · ${g.text}`);
    if (g.id === 'clear') setTimeout(() => tip('build'), 600);
    if (g.id === 'earn') setTimeout(() => tip('plot'), 2500);
  }
}
let goalKey = '';
function renderGoal() {
  const G = $('#goal'); if (!S.introDone) { G.classList.add('hidden'); return; }
  G.classList.remove('hidden');
  const g = GOALS[S.goal];
  const key = g ? `${S.goal}:${Math.min(g.n(), g.of)}` : 'done'; if (key === goalKey) return; goalKey = key;
  if (!g) { G.innerHTML = `<i data-icon="flag"></i><div><b>All goals done</b><small>Keep growing — expand into the woods!</small></div>`; fillIcons(G); return; }
  const n = Math.min(g.n(), g.of);
  G.innerHTML = `<i data-icon="${g.icon}"></i><div><small>Goal ${S.goal + 1} of ${GOALS.length}</small><b>${g.text}</b>${g.of > 1 ? `<span class="gbar"><em style="width:${(n / g.of) * 100}%"></em></span><small class="gn">${n} / ${g.of}</small>` : ''}</div>`;
  fillIcons(G);
}
$('#goal').addEventListener('click', () => { const g = GOALS[S.goal]; if (g) { delete S.tips[g.hint]; tip(g.hint); } });

// ---------------- Tips ----------------
const tipQueue = []; let tipTimer = 0;
function tip(key) { if (S.tips[key] || tipQueue.includes(key) || !TIPS[key]) return; tipQueue.push(key); if (tipQueue.length === 1) showTip(); }
function showTip() {
  const key = tipQueue[0]; if (!key) return;
  S.tips[key] = 1; save();
  $('#tip-text').innerHTML = TIPS[key]; $('#tip').classList.remove('hidden');
  clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 7000);
}
function hideTip() { $('#tip').classList.add('hidden'); tipQueue.shift(); if (tipQueue.length) setTimeout(showTip, 350); }
$('#tip').addEventListener('click', () => { clearTimeout(tipTimer); hideTip(); });

// ---------------- Clearing the woods ----------------
function tapObstacle(id) {
  const def = obstacleById(id);
  if (!S.lots[def.lot]) return openLot(def.lot);
  const st = obsState(id); const at = new THREE.Vector3(def.x, 1.6, def.z);
  if (st === 'full' && def.type === 'tree') {
    if (!W.chop(id, () => { popAt(at, `<i data-icon="wood"></i>+${WOOD.tree} Wood`); if (gotCoin) setTimeout(() => popAt(at.clone().setY(1.0), `<i data-icon="coin"></i>+1`), 250); })) return;
    const gotCoin = Math.random() < 0.35;
    S.obs[id] = 's'; S.wood += WOOD.tree; if (gotCoin) S.coins += 1; S.stats.chopped++;
    if (S.stats.chopped === 2) setTimeout(() => tip('stump'), 1300);
  } else if (st === 'stump') {
    if (!W.clearObstacle(id, () => popAt(at.clone().setY(0.8), `<i data-icon="wood"></i>+${WOOD.stump}`))) return;
    S.obs[id] = 'x'; S.wood += WOOD.stump; S.stats.stumps++;
  } else if (st === 'full') {
    const c = def.type === 'bush' ? 1 : 0;
    if (!W.clearObstacle(id, () => c && popAt(at.clone().setY(1), `<i data-icon="coin"></i>+${c}`))) return;
    S.obs[id] = 'x'; S.coins += c;
  }
  save(); setTimeout(() => { hud(); checkGoals(); if (SITES.some((s) => S.lots[s.lot] && !S.beds.includes(s.id) && siteClear(s.id)) && !S.beds.length) tip('build'); }, 1150);
}

// ---------------- Build mode ----------------
let buildMode = false;
function enterBuild() {
  if (S.wood < bedCost()) { toast(`A raised bed needs ${bedCost()} Wood — chop more trees`); return; }
  closePanel(); deselect(); buildMode = true;
  const list = SITES.filter((s) => S.lots[s.lot] && !S.beds.includes(s.id)).map((s) => ({ id: s.id, ok: siteClear(s.id) }));
  W.setGhosts(list);
  const ready = list.filter((s) => s.ok).length;
  $('#buildbar-text').innerHTML = ready ? `Tap a <b>glowing patch</b> to build a raised bed · ${woodTag(bedCost())}` : `No patch is fully clear yet — clear the <b>trees &amp; stumps</b> inside a pink patch.`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  if (!ready) setTimeout(() => buildMode && exitBuild(), 4200);
}
function exitBuild() { buildMode = false; W.setGhosts(null); $('#buildbar').classList.add('hidden'); }
$('#buildbar-cancel').addEventListener('click', exitBuild);
function buildBed(siteId) {
  if (S.beds.includes(siteId) || !siteClear(siteId) || S.wood < bedCost()) return false;
  S.wood -= bedCost(); S.beds.push(siteId); for (let k = 0; k < PER_BED; k++) S.tiles.push(null);
  W.addBed(siteId, true); exitBuild(); save(); hud();
  const s = siteById(siteId); popAt(new THREE.Vector3(s.x, 1.2, s.z), `<i data-icon="build"></i>Raised bed built!`);
  if (S.beds.length === 1) firstBed();
  checkGoals(); return true;
}
function firstBed() {
  S.standOpen = true; S.waterAt = now(); save();
  setTimeout(() => { W.appear(W.stand, true); W.appear(W.barrel, true); popAt(new THREE.Vector3(SPOTS.stand[0], 2.4, SPOTS.stand[1]), 'Farm Stand open!'); hud(); }, 700);
  setTimeout(openStarterPack, 1900);
}
function openStarterPack() {
  if (S.starterOpened) return;
  S.starterOpened = true;
  for (const [k, v] of Object.entries(STARTER)) S.inv[k] += v;
  S.discovered.heartvine = S.discovered.sunpetal = S.discovered.rainbarrel = true; S.unlocked.rainbarrel = true;
  save(); hud();
  showReveal([{ id: 'heartvine', isNew: true }, { id: 'sunpetal', isNew: true }, { id: 'rainbarrel', isNew: true }], {
    title: 'Starter Seed Pack', done: `Added to your satchel: ${STARTER.seed_heartvine} Heartvine seeds · ${STARTER.seed_sunpetal} Sunpetal seeds · ${STARTER.water} water`,
    onCollect: () => { tip('stand'); setTimeout(() => toast('Tap a soil tile in your new bed to plant'), 400); },
  });
}

// ---------------- Tile sheet ----------------
let selected = null;
function selectTile(i) { selected = i; W.select(i); closePanel(); renderSheet(); }
function deselect() { selected = null; W.select(null); $('#tile-sheet').classList.add('hidden'); }
function renderSheet() {
  const sh = $('#tile-sheet');
  if (selected == null) { sh.classList.add('hidden'); return; }
  const i = selected, p = S.tiles[i];
  let head, body = '';
  if (!p) {
    head = `<h3>Empty plot <small>${tileName(i)} · choose a seed to plant</small></h3>`;
    const owned = Object.keys(SPECIES).filter((sp) => S.inv['seed_' + sp] > 0);
    if (!owned.length) body = S.market ? `<p class="muted">You’re out of seeds.</p><div class="ts-actions"><button class="btn btn-primary" data-act="open-market">Visit Supply Market</button></div>` : `<p class="muted">You’re out of seeds — harvest blooms to collect more. (The Supply Market reopens later.)</p>`;
    else body = `<div class="ts-row">${owned.map((sp) => `<button class="seed-chip" data-plant="${sp}"><img src="${SPECIES[sp].img}" alt=""/>${SPECIES[sp].name.replace('Spiral ', '')}<small>×${S.inv['seed_' + sp]} seeds</small></button>`).join('')}</div>`;
  } else {
    const sp = SPECIES[p.sp], st = stageOf(p), k = progress(p);
    head = `<h3>${sp.name} <small>${tileName(i)} · ${p.wateredAt ? STAGES[st] : 'Thirsty seed'}</small></h3>`;
    const dots = `<div class="stage-dots">${STAGES.map((s, n) => `<span class="${n <= st && p.wateredAt ? 'on' : ''}">${s}</span>`).join('')}</div>`;
    if (!p.wateredAt) body = `<p class="muted">This seed needs water before it can grow.${S.inv.water ? '' : ' The rain barrel refills your can over time.'}</p><div class="ts-actions"><button class="btn btn-primary" data-act="water" ${S.inv.water ? '' : 'disabled'}><i data-icon="water"></i> Water (${S.inv.water} left)</button>${!S.inv.water && S.market ? '<button class="btn" data-act="open-market">Buy water</button>' : ''}</div>`;
    else if (st < 3) body = `<div class="progress"><b id="sheet-prog" style="width:${(k * 100).toFixed(1)}%"></b></div>${dots}<p class="muted" id="sheet-left" style="margin-top:6px">Blooms in ${fmtTime(p.growMs * (1 - k))}</p>`;
    else body = `${dots}<div class="ts-actions"><button class="btn btn-gold" data-act="harvest"><i data-icon="sparkle"></i> Harvest</button></div>`;
  }
  sh.innerHTML = `<div class="ts-head">${head}<button class="close-btn" data-act="close">×</button></div>${body}`;
  sh.dataset.st = p ? stageOf(p) : -1;
  fillIcons(sh); sh.classList.remove('hidden');
}
$('#tile-sheet').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.plant) return plant(selected, b.dataset.plant);
  const a = b.dataset.act;
  if (a === 'close') deselect(); else if (a === 'water') water(selected); else if (a === 'harvest') harvest(selected); else if (a === 'open-market') openPanel('market', 'buy');
});
function plant(i, sp) {
  if (S.tiles[i] || !(S.inv['seed_' + sp] > 0)) return;
  S.inv['seed_' + sp]--; S.tiles[i] = { sp, plantedAt: now(), wateredAt: null, growMs: SPECIES[sp].growS * 1000 };
  syncTile(i); save(); hud(); renderSheet(); tip('water');
}
function water(i) {
  const p = S.tiles[i]; if (!p || p.wateredAt || S.inv.water <= 0) return;
  if (S.inv.water >= WATER_REGEN_MAX) S.waterAt = now();
  S.inv.water--; p.wateredAt = now(); p.growMs = SPECIES[p.sp].growS * 1000 * (S.owned.sundial ? 0.75 : 1); S.stats.watered++;
  W.splash(i); syncTile(i); save(); hud(); renderSheet(); tip('growing'); if (S.stats.watered === 3) tip('barrel');
  popAt(W.tileWorld(i).setY(1), `<i data-icon="water"></i>Watered`); checkGoals();
}
function harvest(i) {
  const p = S.tiles[i]; if (!p || stageOf(p) < 3) return;
  const sp = SPECIES[p.sp];
  const f = randInt(...sp.yieldF) + (S.owned.beehive ? 1 : 0), s = randInt(...sp.yieldS);
  S.inv['flower_' + p.sp] += f; S.inv['seed_' + p.sp] += s; S.tiles[i] = null; S.stats.harvests++;
  syncTile(i); save(); hud();
  const at = W.tileWorld(i);
  popAt(at.clone().setY(1.2), `+${f} ${sp.name.replace('Spiral ', '')}`);
  setTimeout(() => popAt(at.clone().setY(0.8), `+${s} seed${s > 1 ? 's' : ''}`), 350);
  renderSheet(); tip('harvested');
  if (p.sp === 'heartvine' && !S.rackUnlocked) { S.rackUnlocked = true; save(); setTimeout(() => { W.appear(W.rack, true); hud(); tip('heartvine'); }, 900); }
  checkGoals();
}
function onBloom(i) { tip('bloom'); if (selected === i) renderSheet(); }

// ---------------- Panels ----------------
let panel = null, marketTab = 'buy', panelArg = null, panelAt = 0;
function openPanel(name, tab) {
  if (buildMode) exitBuild();
  panel = name; if (name === 'market' && tab) marketTab = tab; if (name === 'lot') panelArg = tab;
  $('#tile-sheet').classList.add('hidden'); if (selected != null) { selected = null; W.select(null); }
  $('#settings').classList.add('hidden');
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
  panelAt = performance.now(); $('#panel').classList.remove('hidden'); renderPanel(); $('#panel-body').scrollTop = 0;
}
function closePanel() { panel = null; $('#panel').classList.add('hidden'); document.querySelectorAll('#tabbar button').forEach((b) => b.classList.remove('on')); }
$('#panel-close').addEventListener('click', closePanel);
$('#panel').addEventListener('click', (e) => { if (e.target.id === 'panel' && performance.now() - panelAt > 450) closePanel(); });
document.querySelectorAll('#tabbar button').forEach((b) => b.addEventListener('click', () => (panel === b.dataset.panel ? closePanel() : openPanel(b.dataset.panel))));

function itemSvg(id) { const it = ITEMS[id]; return it ? itemIcon(...it.icon) : itemIcon('water'); }
function renderPanel() {
  const body = $('#panel-body'), title = $('#panel-title');
  if (panel === 'bag') { title.textContent = 'Your Satchel'; body.innerHTML = bagHTML(); }
  if (panel === 'build') { title.textContent = 'Build'; body.innerHTML = buildHTML(); }
  if (panel === 'stand') { title.textContent = 'Farm Stand'; body.innerHTML = standHTML(); }
  if (panel === 'market') { title.textContent = 'Supply Market'; body.innerHTML = marketHTML(); }
  if (panel === 'rack') { title.textContent = 'Drying Rack'; body.innerHTML = rackHTML(); }
  if (panel === 'lot') { title.textContent = LOTS[panelArg].name; body.innerHTML = lotHTML(panelArg); }
  fillIcons(body);
}
function bagHTML() {
  const ids = ['water', 'seed_heartvine', 'seed_sunpetal', 'seed_moonflower', 'flower_heartvine', 'flower_sunpetal', 'flower_moonflower', 'dried_heartvine'];
  const cells = `<div class="inv"><i data-icon="wood" style="width:38px;height:38px"></i><b>Wood</b><small>×${S.wood}</small></div>` +
    ids.filter((id) => S.inv[id] > 0 || id === 'water').map((id) => `<div class="inv">${itemSvg(id)}<b>${id === 'water' ? 'Water' : ITEMS[id].name}</b><small>×${S.inv[id]}</small></div>`).join('');
  const feats = Object.keys(S.owned).filter((k) => S.owned[k]).map((k) => `<div class="row"><div class="ico">${FEATURE_ART[k]}</div><div class="meta"><b>${FEATURES[k].name}</b><small>${FEATURES[k].blurb.replace('Once bought, ', '')}</small></div></div>`).join('');
  return `<div class="inv-grid">${cells}</div>${feats ? `<div class="sec-title">Garden features</div><div class="list">${feats}</div>` : ''}
    <p class="muted" style="margin:14px 4px 0">Chop trees for Wood, build raised beds, and sell your harvest at the Farm Stand by the road.</p>`;
}
function buildHTML() {
  const owned = SITES.filter((s) => S.lots[s.lot] && !S.beds.includes(s.id)); const ready = owned.filter((s) => siteClear(s.id)).length;
  const cost = bedCost(); const can = S.wood >= cost;
  const best = owned.map((s) => siteLeft(s.id)).sort((a, b) => a - b)[0];
  let note = !owned.length ? 'Every patch on your land has a bed. Buy a neighboring plot to expand.' : ready ? `${ready} patch${ready > 1 ? 'es are' : ' is'} cleared and ready.` : `Clear the trees &amp; stumps inside a patch first (closest patch: ${best} left).`;
  return `<div class="build-card"><div class="bc-art">${bedSvg()}</div><div class="meta"><b>Raised Bed</b><small>A cedar bed with 3×3 planting plots. Planting only works in raised beds.</small>
    <div class="cost">${woodTag(cost)} <span class="${can ? 'ok' : 'no'}">you have ${S.wood}</span></div></div></div>
    <p class="muted" style="margin:10px 4px">${note}</p>
    <div class="ts-actions"><button class="btn btn-primary" data-act="place-bed" ${can && owned.length ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot</button></div>
    <div class="sec-title">Your land</div><div class="list">${LOT_FOR_SALE.concat(['home']).filter((l) => S.lots[l]).map((l) => `<div class="row"><div class="ico"><i data-icon="sign" style="width:30px;height:30px"></i></div><div class="meta"><b>${LOTS[l].name}</b><small>${SITES.filter((s) => s.lot === l && S.beds.includes(s.id)).length}/4 beds · ${OBSTACLES.filter((o) => o.lot === l && obsState(o.id) !== 'gone').length} trees &amp; stumps left</small></div></div>`).join('')}</div>
    <p class="muted" style="margin:10px 4px 0">More land: tap a <b>For Sale</b> sign in the woods around you.</p>`;
}
function bedSvg() { return `<svg viewBox="0 0 64 44"><path d="M4 22h56v14H4z" fill="#C99A6B" stroke="#7C5634" stroke-width="2"/><path d="M8 22l4-8h40l4 8z" fill="#8C6545" stroke="#7C5634" stroke-width="2" stroke-linejoin="round"/><path d="M4 29h56" stroke="#B07D52" stroke-width="2"/><path d="M22 16c0-5 2-8 5-9M38 16c0-6 3-9 6-10" stroke="#5E825F" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M27 7c-3.5 0-5-2.6-5-5 3 0 5 2 5 5zM44 6c.5-3 2.4-4.6 5-4.6-.3 3-2.2 4.5-5 4.6z" fill="#B7D4B5" stroke="#3D5A40" stroke-width="1.4"/></svg>`; }

function standHTML() {
  const used = standCount();
  const onStand = SELL_ORDER.filter((id) => S.stand[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name} ×${S.stand[id]}</b><small>${ITEMS[id].sell} coins each</small></div><div class="acts"><button class="btn sm" data-unstock="${id}">Take back</button></div></div>`).join('');
  const fromBag = SELL_ORDER.filter((id) => S.inv[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>You have ${S.inv[id]} · sells for ${ITEMS[id].sell}</small></div>
    <div class="acts"><button class="btn sm" data-stock="${id}" data-n="1" ${used >= STAND_CAP ? 'disabled' : ''}>+1</button><button class="btn btn-gold sm" data-stock="${id}" data-n="all" ${used >= STAND_CAP ? 'disabled' : ''}>Stock all</button></div></div>`).join('');
  const status = customer ? `<b>A customer is at your stand!</b>` : used ? `Next customer in about ${fmtTime(Math.max(0, nextCust - now()))}` : 'Put items on the stand to attract customers.';
  const prog = !S.market ? `<div class="goal-mini"><small>Supply Market reopens at ${MARKET_GOAL} coins earned here</small><span class="gbar"><em style="width:${Math.min(100, (S.stats.standEarned / MARKET_GOAL) * 100)}%"></em></span><small>${Math.min(S.stats.standEarned, MARKET_GOAL)} / ${MARKET_GOAL}</small></div>` : `<p class="muted" style="margin:0 4px 8px">Earned at your stand: ${coin(S.stats.standEarned)}</p>`;
  return `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh flowers by the road</p></div>
    <div class="stand-status"><i data-icon="stand"></i><span id="stand-status">${status}</span></div>${prog}
    <div class="sec-title">On your stand · ${used}/${STAND_CAP}</div>
    ${onStand ? `<div class="list">${onStand}</div>` : '<div class="empty">The stand is empty.</div>'}
    <div class="sec-title">From your satchel</div>
    ${fromBag ? `<div class="list">${fromBag}</div>` : '<div class="empty">Nothing to sell yet — harvest some blooms first.</div>'}`;
}
function stock(id, n) {
  const space = STAND_CAP - standCount(); const q = Math.min(space, n === 'all' ? S.inv[id] : 1, S.inv[id]); if (q <= 0) return;
  const wasEmpty = standCount() === 0;
  S.inv[id] -= q; S.stand[id] = (S.stand[id] || 0) + q; S.stats.stocked += q;
  if (wasEmpty && !customer) nextCust = Math.max(nextCust, now() + (S.stats.customers ? 6000 : 3500));
  syncStand(); save(); hud(); renderPanel(); checkGoals();
}
function unstock(id) { const q = S.stand[id] || 0; if (!q) return; S.inv[id] += q; delete S.stand[id]; syncStand(); save(); hud(); renderPanel(); }

function marketHTML() {
  if (!S.market) {
    return `<div class="hero locked-hero"><img src="assets/market.jpg" alt=""/><p>Boarded up — for now</p></div>
      <p class="muted" style="margin:4px 4px 12px">The old Supply Market sells seeds, water and Card Packs. Earn <b>${MARKET_GOAL} coins</b> at your Farm Stand and it will reopen.</p>
      <div class="goal-mini"><span class="gbar"><em style="width:${Math.min(100, (S.stats.standEarned / MARKET_GOAL) * 100)}%"></em></span><small>${Math.min(S.stats.standEarned, MARKET_GOAL)} / ${MARKET_GOAL} coins earned</small></div>`;
  }
  let h = `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh seeds &amp; fair prices</p></div>
    <div class="seg"><button data-tab="buy" class="${marketTab === 'buy' ? 'on' : ''}">Seeds &amp; Water</button><button data-tab="packs" class="${marketTab === 'packs' ? 'on' : ''}">Card Packs</button></div>`;
  if (marketTab === 'packs') return h + packsHTML();
  const rows = [];
  rows.push(buyRow('water5', itemIcon('water'), 'Watering can refill', '+5 water', WATER_PRICE));
  rows.push(S.unlocked.rainbarrel ? buyRow('water15', FEATURE_ART.rainbarrel, 'Rain Barrel water', '+15 water · best value', BARREL_PRICE) : lockedRow(FEATURE_ART.rainbarrel, 'Rain Barrel water'));
  for (const sp of Object.keys(SPECIES)) { const d = SPECIES[sp]; rows.push(S.unlocked[sp] ? buyRow('seed_' + sp, `<img src="${d.img}" alt=""/>`, `${d.name} Seeds`, `${RARITY[d.rarity].label} · blooms in ~${d.growS}s · you have ${S.inv['seed_' + sp]}`, d.seedPrice) : lockedRow(`<img src="${d.img}" alt=""/>`, `${d.name} Seeds`)); }
  for (const f of ['beehive', 'sundial']) {
    const d = FEATURES[f];
    if (S.owned[f]) rows.push(`<div class="row"><div class="ico">${FEATURE_ART[f]}</div><div class="meta"><b>${d.name}</b><small>Owned · ${d.blurb.replace('Once bought, ', '')}</small></div></div>`);
    else rows.push(S.unlocked[f] ? buyRow(f, FEATURE_ART[f], d.name, d.blurb.replace('Once bought, ', ''), d.price) : lockedRow(FEATURE_ART[f], d.name));
  }
  return h + `<div class="list">${rows.join('')}</div>`;
}
const buyRow = (id, icon, name, sub, price) => `<div class="row"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>${sub}</small></div><div class="acts"><button class="btn btn-primary sm" data-buy="${id}" data-price="${price}" ${S.coins < price ? 'disabled' : ''}>${coin(price)}</button></div></div>`;
const lockedRow = (icon, name) => `<div class="row locked"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>Discover it in a Card Pack to unlock</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`;
function buy(id, price) {
  if (S.coins < price || !S.market) return;
  S.coins -= price;
  if (id === 'water5') S.inv.water += 5; else if (id === 'water15') S.inv.water += 15; else if (id.startsWith('seed_')) S.inv[id]++; else if (FEATURES[id]) S.owned[id] = true;
  save(); hud(); renderPanel();
  toast(id.startsWith('seed_') ? `Bought 1 ${ITEMS[id].name.replace(' Seeds', ' seed')}` : id.startsWith('water') ? 'Water topped up' : `${FEATURES[id].name} added to your garden`);
}
function packsHTML() {
  const disc = Object.keys(CARDS).filter((k) => S.discovered[k]);
  const odds = Object.entries(RARITY).map(([k, r]) => `<span style="border-color:${r.color};color:${r.color}">${r.label} ${r.w}%</span>`).join('');
  return `<div class="pack-hero"><div class="pack-art"><img src="assets/pack.jpg" alt="Botanical card pack"/></div>
    <div class="pack-info"><h4>Botanical Card Pack</h4><p>3 illustrated cards. New discoveries unlock seeds &amp; features here at the market.</p>
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
  return `<div class="hero"><img src="assets/rack.jpg" alt=""/><p>Hang fresh Heartvine to dry</p></div><div class="slots">${slots}</div>
    <div class="row"><div class="ico">${itemSvg('flower_heartvine')}</div><div class="meta"><b>Fresh Heartvine ×${S.inv.flower_heartvine}</b><small>Dries in ${DRY_S}s · sells for ${ITEMS.dried_heartvine.sell} (fresh: ${ITEMS.flower_heartvine.sell})</small></div>
    <div class="acts"><button class="btn btn-blush sm" data-act="fill-rack" ${S.inv.flower_heartvine && S.rack.includes(null) ? '' : 'disabled'}>Hang all</button></div></div>
    ${S.inv.dried_heartvine ? `<p class="muted" style="margin:10px 4px 0">You have ${S.inv.dried_heartvine} Dried Heartvine — put it on your Farm Stand.</p>` : ''}`;
}
const hang = (k) => { if (S.rack[k] || !S.inv.flower_heartvine) return false; S.inv.flower_heartvine--; S.rack[k] = { start: now(), ms: DRY_S * 1000 }; return true; };
function collect(k) { const r = S.rack[k]; if (!r || now() - r.start < r.ms) return; S.rack[k] = null; S.inv.dried_heartvine++; toast('+1 Dried Heartvine'); }
function afterRack() { save(); hud(); renderPanel(); syncRack(); }

function lotHTML(id) {
  const owned = !!S.lots[id]; const price = lotPrice();
  const trees = OBSTACLES.filter((o) => o.lot === id && o.type === 'tree').length;
  return `<div class="lot-card"><i data-icon="sign" style="width:54px;height:54px"></i><div><b>${owned ? 'Your land' : 'Wooded plot · For sale'}</b>
    <small>${trees} trees (about ${trees * WOOD.tree + trees * WOOD.stump} Wood) · room for 4 raised beds</small></div></div>
    ${owned ? '<p class="muted" style="margin:10px 4px">Tap its trees to clear them.</p>' : `<p class="muted" style="margin:10px 4px">Buy this neighboring plot to chop its trees and build more beds. Each plot costs more than the last.</p>
    <div class="ts-actions"><button class="btn btn-gold" data-act="buy-lot" data-lot="${id}" ${S.coins >= price ? '' : 'disabled'}>Buy plot · ${coin(price)}</button></div>
    ${S.coins < price ? `<p class="muted" style="margin:8px 4px 0;text-align:center">You need ${price - S.coins} more coins.</p>` : ''}`}`;
}
function openLot(id) { openPanel('lot', id); }
function buyLot(id) {
  const price = lotPrice(); if (S.lots[id] || S.coins < price) return false;
  S.coins -= price; S.lots[id] = true; S.lotsBought++; save();
  closePanel(); W.setLotOwned(id, true);
  const [cx, cz] = lotCenter(id); W.poof(new THREE.Vector3(cx, 0.6, cz), '#F5D07A', 26, 3);
  W.ctl.moved = true; W.glide({ target: new THREE.Vector3(cx * 0.6, 0.3, cz * 0.6 + 0.6), zoom: 1.15 }, 1.4);
  toast(`${LOTS[id].name} is yours!`); tip('plotbought'); hud(); checkGoals(); return true;
}

$('#panel-body').addEventListener('click', (e) => {
  const b = e.target.closest('button, .coll .card'); if (!b) return;
  if (b.dataset.tab) { marketTab = b.dataset.tab; renderPanel(); return; }
  if (b.dataset.stock) return stock(b.dataset.stock, b.dataset.n);
  if (b.dataset.unstock) return unstock(b.dataset.unstock);
  if (b.dataset.buy) return buy(b.dataset.buy, +b.dataset.price);
  if (b.dataset.slot != null) { const k = +b.dataset.slot; if (S.rack[k]) collect(k); else hang(k); afterRack(); return; }
  const a = b.dataset.act;
  if (a === 'fill-rack') { for (let k = 0; k < RACK_SLOTS; k++) hang(k); afterRack(); return; }
  if (a === 'buy-pack') return buyPack();
  if (a === 'place-bed') return enterBuild();
  if (a === 'buy-lot') return buyLot(b.dataset.lot);
  if (b.classList.contains('card') && b.dataset.card) zoomCard(b.dataset.card);
});

// ---------------- Supply Market unlock ----------------
function unlockMarket() {
  if (S.market) return; S.market = true; save();
  W.setMarketOpen(true); W.poof(new THREE.Vector3(SPOTS.market[0], 1.0, SPOTS.market[1] + 0.9), '#A8744A', 20, 1.6); W.poof(new THREE.Vector3(SPOTS.market[0], 1.6, SPOTS.market[1]), '#F5D07A', 24, 2.2);
  popAt(new THREE.Vector3(SPOTS.market[0], 2.6, SPOTS.market[1]), 'Supply Market reopened!');
  tip('market'); hud();
}

// ---------------- Customers ----------------
let customer = null, nextCust = now() + 4000, nextPass = now() + 9000;
function pickWants() {
  const avail = SELL_ORDER.filter((id) => S.stand[id] > 0); if (!avail.length) return [];
  const types = avail.sort(() => Math.random() - 0.5).slice(0, avail.length > 1 && Math.random() < 0.4 ? 2 : 1);
  return types.map((id) => ({ id, n: randInt(1, Math.min(3, S.stand[id])) }));
}
function spawnCustomer() {
  const wants = pickWants(); if (!wants.length) return null;
  const bubble = el('div', 'bubble hidden'); $('#popups').appendChild(bubble);
  customer = { wants, bubble, car: null };
  customer.car = W.spawnCar({ stopX: SPOTS.stand[0], onPark: () => {
    bubble.innerHTML = `<span class="think">${wants.map((w) => `<span class="want">${itemSvg(w.id)}<b>×${w.n}</b></span>`).join('')}</span>`;
    bubble.classList.remove('hidden'); tip('customer'); if (panel === 'stand') renderPanel();
    setTimeout(purchase, 1900);
  } });
  return customer;
}
function purchase() {
  const c = customer; if (!c) return;
  let total = 0, items = 0;
  for (const w of c.wants) { const q = Math.min(w.n, S.stand[w.id] || 0); if (!q) continue; S.stand[w.id] -= q; if (!S.stand[w.id]) delete S.stand[w.id]; total += q * ITEMS[w.id].sell; items += q; }
  if (total) {
    S.coins += total; S.stats.standEarned += total; S.stats.sold += items; S.stats.customers++;
    c.bubble.innerHTML = `<span class="thanks">♥ Thank you!</span>`;
    const p = c.car.group.position; popAt(new THREE.Vector3(p.x, 1.9, p.z), `<i data-icon="coin"></i>+${total}`, 'coinpop');
    for (let k = 0; k < Math.min(6, items + 2); k++) setTimeout(() => coinFly(c.car.group.position), k * 90);
  } else c.bubble.innerHTML = `<span class="thanks">Sold out… next time!</span>`;
  syncStand(); save(); hud(); checkGoals(); if (panel === 'stand') renderPanel();
  setTimeout(() => { c.car.leave(); c.bubble.remove(); customer = null; nextCust = now() + randInt(15000, 30000); if (panel === 'stand') renderPanel(); }, 1400);
}
function coinFly(pos) {
  const s = W.project(new THREE.Vector3(pos.x, 1.4, pos.z)); const t = $('#pill-coins').getBoundingClientRect();
  const c = el('div', 'coin-fly', ICONS.coin); c.style.left = s.x + 'px'; c.style.top = s.y + 'px'; c.style.setProperty('--tx', (t.left + t.width * 0.25 - s.x) + 'px'); c.style.setProperty('--ty', (t.top + t.height / 2 - s.y) + 'px');
  $('#popups').appendChild(c); setTimeout(() => c.remove(), 900);
}
W.frameHooks.push(() => {
  if (customer?.bubble && customer.car) { const p = customer.car.group.position; const s = W.project(new THREE.Vector3(p.x, 2.15, p.z)); customer.bubble.style.left = s.x + 'px'; customer.bubble.style.top = s.y + 'px'; }
});

// ---------------- Cards ----------------
function cardHTML(id, extra = '') {
  const c = CARDS[id]; const r = RARITY[c.rarity];
  const art = SPECIES[id] ? `<img src="${c.img}" alt=""/>` : FEATURE_ART[id];
  const stats = Object.entries(c.stats).map(([k, v]) => `<span>${k}</span><span class="pips">${[1, 2, 3, 4, 5].map((n) => `<b class="${n <= v ? 'on' : ''}"></b>`).join('')}</span>`).join('');
  return `<div class="card r-${c.rarity}" data-card="${id}">${extra}<div class="card-face"><div class="card-rar">${r.label}</div><div class="card-art">${art}</div>
    <div class="card-name">${c.name}</div><div class="card-type">${c.type}</div><div class="stats">${stats}</div></div></div>`;
}
function zoomCard(id) { const z = el('div', 'zoom', cardHTML(id) + `<p class="zoom-text">${CARDS[id].blurb}<br/><small>Tap anywhere to close</small></p>`); z.addEventListener('click', () => z.remove()); $('#ui').appendChild(z); }
function drawCard() {
  let roll = Math.random() * 100; let rar = 'common';
  for (const [k, r] of Object.entries(RARITY)) { if (roll < r.w) { rar = k; break; } roll -= r.w; }
  const pool = Object.keys(CARDS).filter((k) => CARDS[k].rarity === rar); return pool[Math.floor(Math.random() * pool.length)];
}
function buyPack(forced) {
  if (S.coins < PACK_PRICE || !S.market) return;
  S.coins -= PACK_PRICE; S.packs++;
  const ids = [drawCard(), drawCard(), drawCard()];
  if (S.packs === 1 && !S.unlocked.moonflower) ids[1] = 'moonflower';
  if (forced) forced.forEach((f, k) => f && (ids[k] = f));
  const seen = new Set();
  const results = ids.map((id) => { const isNew = (!S.discovered[id] || !S.unlocked[id]) && !seen.has(id); seen.add(id); S.discovered[id] = true; if (isNew) S.unlocked[id] = true; else S.coins += DUP_COINS; return { id, isNew }; });
  save(); hud(); closePanel();
  showReveal(results, { title: 'Botanical Card Pack', onCollect: (news) => { tip('pack'); if (news.length) openPanel('market', 'buy'); } });
}
let revealCards = null, revealOpts = {};
function showReveal(results, opts = {}) {
  revealCards = results; revealOpts = opts;
  const R = $('#reveal'); R.classList.remove('hidden');
  R.innerHTML = `<div class="rays"></div><h2>${opts.title || 'Card Pack'}</h2><p class="sub">Tap the pack to open</p><div class="big-pack" id="bigpack"><img src="assets/pack.jpg" alt=""/>${opts.title?.startsWith('Starter') ? '<span class="pack-ribbon">Starter Seeds</span>' : ''}</div><div class="reveal-actions"></div>`;
  const bp = $('#bigpack');
  const open = () => {
    bp.removeEventListener('click', open); bp.classList.add('shake');
    setTimeout(() => { bp.classList.remove('shake'); bp.classList.add('burst'); R.appendChild(el('div', 'flash')); sparkles(R, window.innerWidth / 2, window.innerHeight * 0.45, 26); }, 850);
    setTimeout(() => deal(results), 1250);
  };
  bp.addEventListener('click', open); R.dataset.stage = 'pack';
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
  $('[data-act="reveal-all"]', R).addEventListener('click', () => { [...d.querySelectorAll('.flip')].forEach((c, k) => setTimeout(() => !c.classList.contains('flipped') && flip(c, results[k]), k * 280)); });
}
function flip(c, r) {
  c.classList.add('flipped');
  const rar = CARDS[r.id].rarity; const b = c.getBoundingClientRect();
  if (rar !== 'common') sparkles($('#reveal'), b.left + b.width / 2, b.top + b.height / 2, rar === 'legendary' ? 30 : rar === 'epic' ? 22 : 14);
  const R = $('#reveal');
  if ([...R.querySelectorAll('.deal .flip')].every((x) => x.classList.contains('flipped'))) {
    const news = revealCards.filter((x) => x.isNew).map((x) => CARDS[x.id].name);
    $('.sub', R).textContent = revealOpts.done || (news.length ? `Unlocked in the Supply Market: ${news.join(', ')}` : 'All duplicates — coins added to your purse');
    $('.reveal-actions', R).innerHTML = `<button class="btn btn-primary big" data-act="collect">Collect</button>`;
    $('[data-act="collect"]', R).addEventListener('click', () => { R.classList.add('hidden'); R.innerHTML = ''; revealOpts.onCollect?.(news); });
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
$('#btn-tips').addEventListener('click', () => { S.tips = {}; save(); $('#settings').classList.add('hidden'); const g = GOALS[S.goal]; tip(g ? g.hint : 'chop'); });
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Reset your garden? This erases all progress on this device and starts again in the woods.')) return;
  clearTimeout(saveTimer); localStorage.removeItem(SAVE_KEY); S = null; location.reload();
});

// ---------------- Input: orbit / pinch / tap ----------------
const canvas = $('#scene');
const ptrs = new Map(); let gesture = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture?.(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  W.ctl.auto = false; $('#settings').classList.add('hidden');
  if (ptrs.size === 1) gesture = { tap: true }; else gesture = { tap: false, pinch: pinchDist(), zoom: W.ctl.zoom };
});
function pinchDist() { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p || !gesture || W.ctl.glide) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9) gesture.tap = false;
  if (ptrs.size >= 2 && gesture.pinch) { W.ctl.zoom = THREE.MathUtils.clamp(gesture.zoom * gesture.pinch / pinchDist(), 0.5, 1.6); W.updateCamera(); }
  else if (ptrs.size === 1 && !gesture.tap) { W.ctl.az -= dx * 0.008; W.ctl.pol = THREE.MathUtils.clamp(W.ctl.pol - dy * 0.005, 0.55, 1.22); W.updateCamera(); }
});
const endPtr = (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (gesture?.tap && ptrs.size === 0 && e.type === 'pointerup' && performance.now() - p.t < 600) handleTap(e.clientX, e.clientY);
  if (ptrs.size === 0) gesture = null; else if (ptrs.size === 1) gesture = { tap: false };
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); W.ctl.zoom = THREE.MathUtils.clamp(W.ctl.zoom * Math.exp(e.deltaY * 0.001), 0.5, 1.6); W.updateCamera(); }, { passive: false });
['gesturestart', 'gesturechange', 'dblclick'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.panel-body')) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const t = performance.now(); if (t - lastTouchEnd < 320 && !e.target.closest('button')) e.preventDefault(); lastTouchEnd = t; }, { passive: false });

function handleTap(x, y) {
  if (!S.introDone && W.ctl.glide) return;
  if (buildMode) {
    const h = W.pick(x, y, 'build');
    if (h?.kind === 'site') { if (h.ok) buildBed(h.id); else toast(`Clear the ${siteLeft(h.id)} trees &amp; stumps in this patch first`); }
    return;
  }
  if (panel) return closePanel();
  const hit = W.pick(x, y);
  if (!hit || hit.kind === 'ground') {
    deselect();
    if (hit && S.beds.length) { const l = lotAt(hit.point.x, hit.point.z); const d = Math.hypot(hit.point.x - W.ctl.target.x, hit.point.z - W.ctl.target.z);
      if (l && S.lots[l] && d > 6) { W.ctl.moved = true; W.glide({ target: new THREE.Vector3(hit.point.x, 0.3, hit.point.z) }, 0.9); } }
    return;
  }
  if (hit.kind === 'tile') {
    const p = S.tiles[hit.index];
    if (selected === hit.index && p) { if (!p.wateredAt && S.inv.water) return water(hit.index); if (stageOf(p) === 3) return harvest(hit.index); }
    selectTile(hit.index);
  } else if (hit.kind === 'obstacle') { deselect(); tapObstacle(hit.id); }
  else if (hit.kind === 'lot') openLot(hit.id);
  else if (hit.kind === 'stand') openPanel('stand');
  else if (hit.kind === 'market') openPanel('market');
  else if (hit.kind === 'rack') openPanel('rack');
}

// ---------------- Title & intro ----------------
if (S.introDone) $('#btn-start').textContent = 'Continue';
$('#btn-start').addEventListener('click', () => {
  $('#title').classList.add('out'); setTimeout(() => $('#title').classList.add('hidden'), 650);
  if (migrated) setTimeout(() => toast('Petalspire v0.2 — a fresh start in the woods!'), 900);
  if (!S.introDone) playIntro(); else { const g = GOALS[S.goal]; if (g) tip(g.hint); }
});
function playIntro() {
  const F = $('#fade'); F.classList.remove('hidden'); F.classList.add('on');
  W.intro(() => { S.introDone = true; save(); hud(); tip('chop'); $('#story').classList.add('hidden'); });
  requestAnimationFrame(() => setTimeout(() => F.classList.remove('on'), 60));
  setTimeout(() => F.classList.add('hidden'), 1800);
  const St = $('#story'); St.classList.remove('hidden');
  St.innerHTML = '<p class="l1">An old wooded lot by the road…</p><p class="l2">Let’s make it bloom.</p>';
}
$('#story').addEventListener('click', () => { if (W.ctl.glide) { W.ctl.glide.dur = Math.min(W.ctl.glide.dur, performance.now() - W.ctl.glide.t0 + 400); } });

// ---------------- Loop ----------------
let lastTick = 0;
function tick() {
  requestAnimationFrame(tick);
  const t = performance.now();
  if (t - lastTick > 250) {
    lastTick = t;
    for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i]) syncTile(i);
    syncRack();
    if (S.standOpen) {
      if (S.inv.water >= WATER_REGEN_MAX) S.waterAt = now();
      else { const n = Math.floor((now() - S.waterAt) / (WATER_REGEN_S * 1000)); if (n > 0) { S.inv.water = Math.min(WATER_REGEN_MAX, S.inv.water + n); S.waterAt += n * WATER_REGEN_S * 1000; if (selected != null) renderSheet(); } }
      if (!customer && standCount() > 0 && now() >= nextCust && S.introDone) spawnCustomer();
      if (panel === 'stand' && !customer) { const n = $('#stand-status'); if (n && standCount()) n.textContent = `Next customer in about ${fmtTime(Math.max(0, nextCust - now()))}`; }
    }
    if (S.introDone && now() >= nextPass) { if (!W.cars.some((c) => c.dir < 0)) W.spawnCar({ dir: -1 }); nextPass = now() + randInt(14000, 32000); }
    hud(); checkGoals();
    if (selected != null && S.tiles[selected]?.wateredAt) {
      const p = S.tiles[selected], k = progress(p), pr = $('#sheet-prog');
      if (pr) { pr.style.width = (k * 100).toFixed(1) + '%'; $('#sheet-left').textContent = `Blooms in ${fmtTime(p.growMs * (1 - k))}`; }
      if (stageOf(p) !== +$('#tile-sheet').dataset.st) renderSheet();
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
const V = (x, y, z) => new THREE.Vector3(x, y, z);
window.__ps = {
  get state() { return S; }, get selected() { return selected; }, get customer() { return customer && { wants: customer.wants, parked: customer.car.state === 'park' }; }, get buildMode() { return buildMode; }, W, THREE,
  skip(sec) { const ms = sec * 1000; S.tiles.forEach((p) => { if (p) { p.plantedAt -= ms; if (p.wateredAt) p.wateredAt -= ms; } }); S.rack.forEach((r) => r && (r.start -= ms)); nextCust -= ms; save(); },
  obstacles(lot = 'home', state) { return OBSTACLES.filter((o) => o.lot === lot && (!state || obsState(o.id) === state)).map((o) => ({ id: o.id, type: o.type, x: o.x, z: o.z, state: obsState(o.id) })); },
  siteObstacles(id) { return SITE_OBS[id].filter((o) => obsState(o) !== 'gone'); },
  obsScreen(id) { const o = obstacleById(id); const st = obsState(id); return W.project(V(o.x, st === 'stump' ? 0.25 : o.type === 'tree' ? 1.0 * o.s : 0.3, o.z)); },
  siteScreen(id) { const s = siteById(id); return W.project(V(s.x, 0.1, s.z)); },
  tileScreen(i) { return W.project(W.tileWorld(i)); },
  iconScreen(i) { return W.tiles[i].icon.visible ? W.project(W.iconWorld(i)) : null; },
  objScreen(name) { if (name.startsWith('sign:')) { const [x, z] = SIGNS[name.slice(5)]; return W.project(V(x, 1.0, z)); } const [x, z] = SPOTS[name]; return W.project(V(x, 1.2, z)); },
  carScreen() { const c = customer?.car; return c ? W.project(c.group.position.clone().setY(0.7)) : null; },
  nextCustomerIn(ms) { nextCust = now() + ms; }, spawnCustomer,
  grant(o) { for (const [k, v] of Object.entries(o)) { if (k === 'coins' || k === 'wood') S[k] += v; else S.inv[k] += v; } save(); hud(); },
  tapObstacle, buildBed, enterBuild, exitBuild, selectTile, plant, water, harvest, openPanel, closePanel, buyPack, buy, stock, buyLot,
  camera(az, pol, zoom, tx, tz) { if (az != null) W.ctl.az = az; if (pol != null) W.ctl.pol = pol; if (zoom != null) W.ctl.zoom = zoom; if (tx != null) { W.ctl.target.set(tx, 0.3, tz); W.ctl.moved = true; } W.ctl.glide = null; W.updateCamera(); },
  dismissTip() { clearTimeout(tipTimer); tipQueue.length = 0; $('#tip').classList.add('hidden'); },
};
