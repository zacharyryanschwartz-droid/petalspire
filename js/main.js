// Petalspire v0.3 — game logic + UI
import * as THREE from 'three';
import { createWorld } from './world.js';
import { buildPlant } from './plants.js';
import { SPECIES, FEATURES, CARDS, RARITY, ITEMS, SELL_ORDER, TIPS, PACK_PRICE, DUP_COINS, RACK_SLOTS, DRY_S, WATER_PRICE, BARREL_PRICE,
  WOOD, BED_COSTS, STAND_CAP, MARKET_GOAL, WATER_REGEN_S, WATER_REGEN_MAX, STARTER, STARTER_JEWELS,
  BUILDS, FINDS, FIND_IDS, FIND_CHANCE, SAPLING_CHANCE, RESTORE_HURRY_JEWELS, ATMOS_STEP, ATMOS_MAX, TREE, SHOP, JEWEL_BUNDLES, NO_ADS_BUNDLE, ADS, ADS_MODE, OTHER_GAMES } from './data.js';
import { LOTS, SIGNS, LOT_FOR_SALE, LOT_PRICES, SITES, OBSTACLES, SPOTS, BED_N, SITE_HALF, siteById, obstacleById, inSite, lotCenter, lotAt } from './layout.js';
import { ICONS, itemIcon, FEATURE_ART, findIcon, decorIcon } from './icons.js';
import { Payments } from './payments.js';
import { createAds, gameArt } from './ads.js';

const SAVE_KEY = 'petalspire.v03', V02_KEY = 'petalspire.v02', OLD_KEYS = ['petalspire.v01'];
const QS = new URLSearchParams(location.search);
const TREE_MS = Math.max(0.05, +QS.get('treeMin') || TREE.growMin) * 60000;   // ?treeMin=1 for quick testing
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const now = () => Date.now();
const fillIcons = (root = document) => root.querySelectorAll('i[data-icon]').forEach((i) => { if (!i.firstChild) i.innerHTML = ICONS[i.dataset.icon] || ''; });
const coin = (n) => `<span class="price"><i data-icon="coin"></i>${n}</span>`;
const woodTag = (n) => `<span class="price"><i data-icon="wood"></i>${n}</span>`;
const jewelTag = (n) => `<span class="price"><i data-icon="jewel"></i>${n}</span>`;
const scrapTag = (n) => `<span class="price"><i data-icon="scrap"></i>${n}</span>`;
const fmtTime = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`; return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const PER_BED = BED_N * BED_N;
const frac = (v) => v - Math.floor(v);
const seeded = (k, salt) => frac(Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453);

// ---------------- State ----------------
function freshState() {
  return {
    v: 3, coins: 10, wood: 0, jewels: 0, scrap: 0,
    inv: { seed_heartvine: 0, seed_sunpetal: 0, seed_moonflower: 0, flower_heartvine: 0, flower_sunpetal: 0, flower_moonflower: 0, dried_heartvine: 0, water: 0, sapling: 0 },
    unlocked: { heartvine: true, sunpetal: true, moonflower: false, rainbarrel: false, beehive: false, sundial: false },
    owned: { beehive: false, sundial: false },
    discovered: {},
    lots: { home: true }, lotsBought: 0, obs: {}, beds: [], tiles: [],
    rack: Array(RACK_SLOTS).fill(null),
    stand: {}, starterOpened: false, waterAt: 0,
    // v0.3: things are built, not unlocked
    barrel: false, standBuilt: false, rackAvail: false, rackBuilt: false, marketAvail: false, marketBuilt: false, marketProj: null,
    finds: {}, restoring: [], decorInv: {}, bonus: { can: false, barrow: false, crate: false },
    decor: [], ground: [], trees: [], looted: {}, uid: 1, noAds: false, adRewardAt: 0,
    packs: 0, tips: {}, goal: 0, introDone: false,
    stats: { chopped: 0, stumps: 0, harvests: 0, watered: 0, stocked: 0, customers: 0, standEarned: 0, sold: 0,
      cleared: 0, finds: 0, restored: 0, recycled: 0, treesPlanted: 0, grownChopped: 0, jewelsBought: 0, adBreaks: 0, adRewards: 0 },
  };
}
function mergeState(o) {
  const f = freshState();
  return { ...f, ...o, v: 3, inv: { ...f.inv, ...o.inv }, stats: { ...f.stats, ...o.stats }, unlocked: { ...f.unlocked, ...o.unlocked }, bonus: { ...f.bonus, ...o.bonus } };
}
// v0.2 -> v0.3: whatever existed stays built; nothing is wiped. The v0.2 save is left in place as a backup.
function migrate02(o) {
  const s = mergeState(o);
  s.standBuilt = !!o.standOpen; s.barrel = !!o.standOpen || (o.beds || []).length > 0;
  s.rackAvail = s.rackBuilt = !!o.rackUnlocked;
  s.marketBuilt = !!o.market; s.marketAvail = !!o.market || (o.stats?.standEarned || 0) >= MARKET_GOAL;
  delete s.standOpen; delete s.rackUnlocked; delete s.market;
  s.goal = 0;                                   // goals re-check silently against the new list
  s.inv.sapling += 1; s.jewels += STARTER_JEWELS; // a small thank-you so the new systems are reachable
  return s;
}
let S, migrated = false, upgraded = false;
try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { S = null; }
if (!S || S.v !== 3) {
  let old = null; try { old = JSON.parse(localStorage.getItem(V02_KEY)); } catch {}
  if (old && old.v === 2) { S = migrate02(old); upgraded = true; }
  else { S = freshState(); for (const k of OLD_KEYS) if (localStorage.getItem(k)) { migrated = true; localStorage.removeItem(k); } }
} else S = mergeState(S);
let saveTimer = 0;
const writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} };
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeSave, 150); }
if (upgraded) writeSave();
window.addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); });
window.addEventListener('pagehide', writeSave);

// ---------------- Ads (placeholders only — see js/ads.js; ADS_MODE in js/data.js) ----------------
const Ads = createAds({ root: $('#ui'), noAds: () => S.noAds, onRemoveAds: () => openPanel('jewels'), onHouseAd: () => openPanel('settings'),
  onEvent: (e) => { if (e.startsWith('break:')) { S.stats.adBreaks++; save(); } } });
const adBlocked = () => !!placing || buildMode || !$('#reveal').classList.contains('hidden') || !$('#confirm').classList.contains('hidden') || !S.introDone;

function progress(p) { if (!p || !p.wateredAt) return 0; return Math.min(1, (now() - p.wateredAt) / p.growMs); }
function stageOf(p) { if (!p.wateredAt) return 0; const k = progress(p); return k >= 1 ? 3 : k >= 0.5 ? 2 : k >= 0.2 ? 1 : 0; }
const STAGES = ['Seed', 'Sprout', 'Bud', 'Bloom'];
const obsState = (id) => { const v = S.obs[id]; if (v === 'x') return 'gone'; if (v === 's') return 'stump'; return obstacleById(id).type === 'stump' ? 'stump' : 'full'; };
const SITE_OBS = Object.fromEntries(SITES.map((s) => [s.id, OBSTACLES.filter((o) => inSite(o, s)).map((o) => o.id)]));
const siteThings = (id) => { const s = siteById(id); return [...S.decor, ...S.trees].filter((d) => inSite(d, s)); };
const siteClear = (id) => SITE_OBS[id].every((o) => obsState(o) === 'gone') && !siteThings(id).length;
const siteLeft = (id) => SITE_OBS[id].filter((o) => obsState(o) !== 'gone').length + siteThings(id).length;
const bedCost = () => BED_COSTS[Math.min(S.beds.length, BED_COSTS.length - 1)];
const standCount = () => Object.values(S.stand).reduce((a, b) => a + b, 0);
const standCap = () => STAND_CAP + (S.bonus.crate ? 4 : 0);
const lotPrice = () => LOT_PRICES[Math.min(S.lotsBought, LOT_PRICES.length - 1)];
const tileName = (i) => { const b = Math.floor(i / PER_BED), k = i % PER_BED; return `Bed ${b + 1} · ${'ABC'[Math.floor(k / BED_N)]}${(k % BED_N) + 1}`; };
const regenS = () => (S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S), regenMax = () => (S.bonus.can ? 15 : WATER_REGEN_MAX);
const atmosphere = () => S.decor.reduce((a, d) => a + (Object.values(FINDS).find((f) => f.into.decor === d.type)?.into.atm || 0), 0);
const atmosMult = () => Math.max(1 - ATMOS_MAX, 1 - ATMOS_STEP * atmosphere());
const DECOR_INFO = Object.fromEntries(Object.entries(FINDS).filter(([, f]) => f.into.decor).map(([k, f]) => [f.into.decor, { name: f.into.name, atm: f.into.atm, from: k }]));
const treeStage = (t) => { if (t.st === 'stump') return 3; const k = Math.min(1, (now() - t.at) / t.ms); return k >= 1 ? 3 : k >= TREE.stageAt[2] ? 2 : k >= TREE.stageAt[1] ? 1 : 0; };
const treeById = (id) => S.trees.find((t) => t.id === id);
const marketK = () => (S.marketProj ? Math.min(1, (now() - S.marketProj.start) / S.marketProj.ms) : 0);

// ---------------- World ----------------
const building = {};   // structures whose build animation is playing
const W = createWorld($('#scene'));
W.makeBlueprint(W.stand, 'stand', `Blueprint · ${BUILDS.stand.wood} Wood`, 2.6, 1.7);
W.makeBlueprint(W.rack, 'rack', `Blueprint · ${BUILDS.rack.wood} Wood`, 2.0, 1.5);
for (const o of OBSTACLES) W.setObstacle(o.id, obsState(o.id));
for (const id of LOT_FOR_SALE) W.setLotOwned(id, !!S.lots[id]);
S.beds.forEach((id) => W.addBed(id, false));
while (S.tiles.length < S.beds.length * PER_BED) S.tiles.push(null);
if (S.standBuilt) W.appear(W.stand, false);
if (S.barrel) W.appear(W.barrel, false);
if (S.rackBuilt) W.appear(W.rack, false);
syncMarket();
for (const g of S.ground) W.addLoot(g.key, g.kind, g.x, g.z, false);
for (const d of S.decor) W.addDecor(d.key, d.type, d.x, d.z, d.r || 0, false);
for (const t of S.trees) W.addGrown(t.id, t.x, t.z, treeStage(t), t.st === 'stump' ? 'stump' : 'full');
syncBlueprints();
function syncBlueprints() {
  W.setBlueprint('stand', S.beds.length > 0 && !S.standBuilt && !building.stand);
  W.setBlueprint('rack', S.rackAvail && !S.rackBuilt && !building.rack);
}
function syncMarket() { W.setMarketState(S.marketBuilt ? 'open' : S.marketProj ? 'building' : 'closed', marketK()); }
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
document.fonts?.ready.then(() => W.relabel());

// ---------------- HUD ----------------
const shown = { coins: S.coins, wood: S.wood, water: S.inv.water, jewels: S.jewels };
function bump(id) { const p = $(id); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
function hud() {
  $('#coin-count').textContent = S.coins; $('#water-count').textContent = S.inv.water; $('#wood-count').textContent = S.wood; $('#jewel-count').textContent = S.jewels;
  if (S.coins !== shown.coins) { bump('#pill-coins'); shown.coins = S.coins; }
  if (S.wood !== shown.wood) { bump('#pill-wood'); shown.wood = S.wood; }
  if (S.inv.water !== shown.water) { bump('#pill-water'); shown.water = S.inv.water; }
  if (S.jewels !== shown.jewels) { bump('#pill-jewels'); shown.jewels = S.jewels; }
  const done = S.rack.filter((r) => r && now() - r.start >= r.ms).length;
  const b = $('#rack-badge'); b.classList.toggle('hidden', !done); b.textContent = done;
  $('#tab-stand').classList.toggle('hidden', !S.standBuilt);
  $('#tab-rack').classList.toggle('hidden', !S.rackBuilt);
  $('#tab-market').classList.toggle('locked', !S.marketBuilt);
  const sb = $('#stand-badge'); const n = standCount(); sb.classList.toggle('hidden', !n); sb.textContent = n;
  const nf = Object.values(S.finds).reduce((a, v) => a + v, 0) + (S.inv.sapling || 0) + Object.values(S.decorInv).reduce((a, v) => a + v, 0);
  const fb = $('#bag-badge'); fb.classList.toggle('hidden', !nf); fb.textContent = nf;
  $('#tab-build').classList.toggle('glow', buildReady());
  renderGoal();
}
function buildReady() {
  if (!S.beds.length) return S.wood >= bedCost() && SITES.some((s) => S.lots[s.lot] && !S.beds.includes(s.id) && siteClear(s.id));
  if (!S.standBuilt && !building.stand) return S.wood >= BUILDS.stand.wood;
  if (S.rackAvail && !S.rackBuilt && !building.rack) return S.wood >= BUILDS.rack.wood;
  if (S.marketAvail && !S.marketBuilt && !S.marketProj) return S.wood >= BUILDS.market.wood && S.coins >= marketCoins();
  return false;
}
function toast(msg) { const t = el('div', 'toast', msg); $('#ui').appendChild(t); fillIcons(t); setTimeout(() => t.remove(), 2300); }
function popAt(worldPos, html, cls = '') {
  const s = W.project(worldPos); const p = el('div', 'pop ' + cls, html); p.style.left = s.x + 'px'; p.style.top = s.y + 'px';
  $('#popups').appendChild(p); fillIcons(p); setTimeout(() => p.remove(), 1700);
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const spotV = (k, y = 2.4) => V3(SPOTS[k][0], y, SPOTS[k][1]);

// ---------------- Goals ----------------
const GOALS = [
  { id: 'clear', text: 'Clear 8 trees', n: () => S.stats.chopped, of: 8, icon: 'axe', hint: 'chop' },
  { id: 'bed', text: 'Build a raised bed', n: () => S.beds.length, of: 1, icon: 'build', hint: 'build' },
  { id: 'stand', text: 'Build your Farm Stand', n: () => +S.standBuilt, of: 1, icon: 'stand', hint: 'standbp' },
  { id: 'plant', text: 'Plant & water a seed', n: () => S.stats.watered, of: 1, icon: 'sprout', hint: 'water' },
  { id: 'harvest', text: 'Harvest a bloom', n: () => S.stats.harvests, of: 1, icon: 'sparkle', hint: 'bloom' },
  { id: 'stock', text: 'Stock your farm stand', n: () => S.stats.stocked, of: 1, icon: 'stand', hint: 'stand' },
  { id: 'sale', text: 'Sell to a customer', n: () => S.stats.customers, of: 1, icon: 'coin', hint: 'customer' },
  { id: 'find', text: 'Restore or recycle a find', n: () => S.stats.restored + S.stats.recycled, of: 1, icon: 'recycle', hint: 'finds' },
  { id: 'earn', text: `Earn ${MARKET_GOAL} coins at your stand`, n: () => S.stats.standEarned, of: MARKET_GOAL, icon: 'coin', hint: 'customer' },
  { id: 'market', text: 'Rebuild the Supply Market', n: () => +S.marketBuilt, of: 1, icon: 'market', hint: 'rebuild' },
  { id: 'tree', text: 'Plant a tree sapling', n: () => S.stats.treesPlanted, of: 1, icon: 'sapling', hint: 'sapling' },
  { id: 'plot', text: 'Buy a neighboring plot', n: () => S.lotsBought, of: 1, icon: 'sign', hint: 'plot' },
];
function checkGoals(silent = false) {
  if (!S.marketAvail && S.stats.standEarned >= MARKET_GOAL) {
    S.marketAvail = true; save();
    if (!silent) { toast('<i data-icon="market"></i> New project: Rebuild the Supply Market'); setTimeout(() => tip('rebuild'), 900); }
  }
  while (S.goal < GOALS.length && GOALS[S.goal].n() >= GOALS[S.goal].of) {
    const g = GOALS[S.goal]; S.goal++; save();
    if (silent) continue;
    const card = $('#goal'); card.classList.remove('done'); void card.offsetWidth; card.classList.add('done');
    toast(`<i data-icon="flag"></i> Goal complete · ${g.text}`);
    if (g.id === 'clear') setTimeout(() => tip('build'), 600);
    if (g.id === 'market') setTimeout(() => tip('plot'), 4000);
  }
}
checkGoals(true);
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

// ---------------- Clearing the woods (+ found items) ----------------
// Each wild obstacle has a fixed (seeded) roll, so the same spots always hide the same things.
function dropFor(def) {
  if (S.looted[def.id]) return null;
  const r = seeded(def.k, 1);
  if (r < FIND_CHANCE) return FIND_IDS[Math.floor(seeded(def.k, 2) * FIND_IDS.length)];
  if (def.type === 'tree' && r < FIND_CHANCE + SAPLING_CHANCE) return 'sapling';
  if (!S.stats.finds && !S.ground.some((g) => g.kind !== 'sapling') && S.stats.cleared >= 2) return 'watering_can'; // never wait too long for the first find
  return null;
}
function dropLoot(kind, x, z, delay = 0) {
  const key = 'l' + S.uid++; const d = Math.hypot(x, z - 30) || 1;
  const lx = x + (0 - x) / d * 0.45, lz = z + (30 - z) / d * 0.45;   // nudge toward the road/camera so it isn't hidden by the stump
  S.ground.push({ key, kind, x: lx, z: lz }); save();
  setTimeout(() => { W.addLoot(key, kind, lx, lz, true); tip(kind === 'sapling' ? 'sapling' : 'find'); }, delay);
  return key;
}
function collectLoot(key) {
  const g = S.ground.find((x) => x.key === key); if (!g) return;
  S.ground = S.ground.filter((x) => x.key !== key);
  if (g.kind === 'sapling') { S.inv.sapling++; popAt(V3(g.x, 1.2, g.z), `<i data-icon="sapling"></i>Tree sapling!`); tip('sapling'); }
  else { S.finds[g.kind] = (S.finds[g.kind] || 0) + 1; S.stats.finds++; popAt(V3(g.x, 1.2, g.z), `<i data-icon="sparkle"></i>${FINDS[g.kind].name}`); toast(`Found: <b>${FINDS[g.kind].name}</b> · Bag → Finds`); tip('finds'); }
  W.removeLoot(key); save(); hud(); checkGoals();
}
function tapObstacle(id) {
  if (id.startsWith('g:')) return tapGrown(id);
  const def = obstacleById(id);
  if (!S.lots[def.lot]) return openLot(def.lot);
  const st = obsState(id); const at = V3(def.x, 1.6, def.z);
  const drop = (def.type === 'tree' ? st === 'full' : true) ? dropFor(def) : null;
  if (st === 'full' && def.type === 'tree') {
    const w = WOOD.tree + (S.bonus.barrow ? 1 : 0);
    if (!W.chop(id, () => { popAt(at, `<i data-icon="wood"></i>+${w} Wood`); if (gotCoin) setTimeout(() => popAt(at.clone().setY(1.0), `<i data-icon="coin"></i>+1`), 250); })) return;
    const gotCoin = Math.random() < 0.35;
    S.obs[id] = 's'; S.wood += w; if (gotCoin) S.coins += 1; S.stats.chopped++;
    if (S.stats.chopped === 2) setTimeout(() => tip('stump'), 1300);
  } else if (st === 'stump') {
    if (!W.clearObstacle(id, () => popAt(at.clone().setY(0.8), `<i data-icon="wood"></i>+${WOOD.stump}`))) return;
    S.obs[id] = 'x'; S.wood += WOOD.stump; S.stats.stumps++;
  } else if (st === 'full') {
    const c = def.type === 'bush' ? 1 : 0;
    if (!W.clearObstacle(id, () => c && popAt(at.clone().setY(1), `<i data-icon="coin"></i>+${c}`))) return;
    S.obs[id] = 'x'; S.coins += c;
  } else return;
  S.stats.cleared++;
  if (drop) { S.looted[id] = 1; dropLoot(drop, def.x, def.z, def.type === 'tree' ? 1150 : 450); }
  save(); setTimeout(() => { hud(); checkGoals(); if (SITES.some((s) => S.lots[s.lot] && !S.beds.includes(s.id) && siteClear(s.id)) && !S.beds.length) tip('build'); }, 1150);
}

// ---------------- Trees you grow ----------------
function tapGrown(id) {
  const t = treeById(id); if (!t) return;
  const at = V3(t.x, 1.8, t.z);
  if (t.st === 'stump') {
    if (!W.clearObstacle(id, () => { popAt(at.clone().setY(0.8), `<i data-icon="wood"></i>+${TREE.stump}`); W.removeGrown(id); })) return;
    S.trees = S.trees.filter((x) => x !== t); S.wood += TREE.stump; S.stats.stumps++; save(); setTimeout(hud, 500); return;
  }
  if (treeStage(t) < 3) { focusThing({ kind: 'tree', id }); return; }
  const w = TREE.wood + (S.bonus.barrow ? 1 : 0);
  if (!W.chop(id, () => popAt(at, `<i data-icon="wood"></i>+${w} Wood`))) return;
  t.st = 'stump'; S.wood += w; S.stats.chopped++; S.stats.grownChopped++;
  if (Math.random() < TREE.saplingBack) dropLoot('sapling', t.x, t.z, 1150);
  deselect(); save(); setTimeout(() => { hud(); checkGoals(); }, 1150);
}
function plantSapling(x, z) {
  if (!(S.inv.sapling > 0)) return false;
  const id = 'g:' + S.uid++;
  S.inv.sapling--; S.trees.push({ id, x, z, at: now(), ms: TREE_MS, st: 'full' }); S.stats.treesPlanted++;
  W.addGrown(id, x, z, 0, 'full'); W.poof(V3(x, 0.3, z), '#8C6545', 10, 0.8); W.poof(V3(x, 0.6, z), '#B7D4B5', 10, 0.9, true);
  popAt(V3(x, 1.2, z), `<i data-icon="sapling"></i>Planted! Mature in ${fmtTime(TREE_MS)}`);
  save(); hud(); checkGoals(); return true;
}
function hurryTree(id) {
  const t = treeById(id); if (!t || t.st !== 'full') return; const st = treeStage(t); if (st >= 3) return;
  if (!spendJewels(TREE.hurryJewels)) return;
  t.at = Math.min(t.at, now() - t.ms * TREE.stageAt[st + 1]); save(); syncTrees(); renderFocus(); hud();
}
let grownToastFor = new Set();
function syncTrees() {
  for (const t of S.trees) {
    if (t.st !== 'full') continue; const st = treeStage(t); const o = W.obs.get(t.id);
    if (o && o.stage !== st && !o.busy) { W.setGrown(t.id, st, true); if (st === 3 && !grownToastFor.has(t.id)) { grownToastFor.add(t.id); toast('<i data-icon="sapling"></i> A tree you planted is fully grown — tap it to chop'); } }
  }
}

// ---------------- Placement (decor, saplings) ----------------
let placing = null; // { what: 'decor'|'sapling', type }
function placeProblem(x, z) {
  const lot = lotAt(x, z); if (!lot || !S.lots[lot]) return 'Place it on your own land';
  if (z > 4.3) return 'Too close to the road';
  for (const o of OBSTACLES) if (obsState(o.id) !== 'gone' && Math.hypot(o.x - x, o.z - z) < 0.9) return 'Clear the trees here first';
  for (const id of S.beds) { const s = siteById(id); if (Math.abs(s.x - x) < SITE_HALF - 0.1 && Math.abs(s.z - z) < SITE_HALF - 0.1) return 'That’s a raised bed';
  }
  for (const [k, [sx, sz]] of Object.entries(SPOTS)) if (Math.hypot(sx - x, sz - z) < (k === 'market' ? 2.1 : 1.6)) return 'Too close to a building';
  for (const d of [...S.decor, ...S.trees]) if (Math.hypot(d.x - x, d.z - z) < 0.9) return 'Too close to something else';
  for (const g of S.ground) if (Math.hypot(g.x - x, g.z - z) < 0.6) return 'Pick up the item here first';
  return null;
}
function enterPlace(what, type) {
  if (what === 'sapling' && !(S.inv.sapling > 0)) { toast('You have no saplings — find them while clearing, or buy one at the market'); return; }
  if (what === 'decor' && !(S.decorInv[type] > 0)) return;
  closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what, type };
  const name = what === 'sapling' ? 'your tree sapling' : DECOR_INFO[type].name;
  $('#buildbar-text').innerHTML = `Tap open ground on your land to place <b>${name}</b>${what === 'sapling' ? ' · not in beds' : ''}`;
  $('#buildbar').classList.remove('hidden');
}
function exitPlace() { placing = null; $('#buildbar').classList.add('hidden'); }
function placeAt(x, z) {
  const why = placeProblem(x, z); if (why) { toast(why); return false; }
  const p = placing; exitPlace();
  if (p.what === 'sapling') { plantSapling(x, z); if (S.goal >= 0) tip('decor'); return true; }
  const key = 'd' + S.uid++; S.decorInv[p.type]--; if (!S.decorInv[p.type]) delete S.decorInv[p.type];
  const r = Math.atan2(W.camera.position.x - x, W.camera.position.z - z);
  S.decor.push({ key, type: p.type, x, z, r }); W.addDecor(key, p.type, x, z, r, true);
  popAt(V3(x, 1.6, z), `<i data-icon="heart"></i>+${DECOR_INFO[p.type].atm} atmosphere`); tip('decor');
  save(); hud(); return true;
}
function storeDecor(key) {
  const d = S.decor.find((x) => x.key === key); if (!d) return;
  S.decor = S.decor.filter((x) => x !== d); S.decorInv[d.type] = (S.decorInv[d.type] || 0) + 1; W.removeDecor(key); deselect(); save(); hud();
  toast(`${DECOR_INFO[d.type].name} put back in your bag`);
}

// ---------------- Finds: restore / recycle ----------------
const canPay = (c) => S.wood >= (c.wood || 0) && S.coins >= (c.coins || 0) && S.scrap >= (c.scrap || 0);
const pay = (c) => { S.wood -= c.wood || 0; S.coins -= c.coins || 0; S.scrap -= c.scrap || 0; };
const costHTML = (c) => [c.wood && woodTag(c.wood), c.coins && coin(c.coins), c.scrap && scrapTag(c.scrap)].filter(Boolean).join(' ') || 'Free';
const gainHTML = (c) => [c.wood && woodTag('+' + c.wood), c.coins && coin('+' + c.coins), c.scrap && scrapTag('+' + c.scrap)].filter(Boolean).join(' ');
function restore(kind) {
  const f = FINDS[kind]; if (!(S.finds[kind] > 0) || !canPay(f.restore)) return false;
  pay(f.restore); S.finds[kind]--; if (!S.finds[kind]) delete S.finds[kind];
  S.restoring.push({ id: S.uid++, kind, start: now(), ms: f.restore.s * 1000 });
  save(); hud(); renderPanel(); toast(`Restoring ${f.name}… ${fmtTime(f.restore.s * 1000)}`); return true;
}
function recycle(kind) {
  const f = FINDS[kind]; if (!(S.finds[kind] > 0)) return false;
  S.finds[kind]--; if (!S.finds[kind]) delete S.finds[kind];
  const g = f.recycle; S.wood += g.wood || 0; S.coins += g.coins || 0; S.scrap += g.scrap || 0; S.stats.recycled++;
  save(); hud(); renderPanel(); toast(`Recycled ${f.name} · ${gainHTML(g)}`); checkGoals(); return true;
}
function finishRestore(r) {
  S.restoring = S.restoring.filter((x) => x !== r); const f = FINDS[r.kind]; S.stats.restored++;
  if (f.into.bonus) { S.bonus[f.into.bonus] = true; toast(`<i data-icon="sparkle"></i> Restored: <b>${f.into.name}</b> · ${f.into.blurb}`); }
  else { S.decorInv[f.into.decor] = (S.decorInv[f.into.decor] || 0) + 1; toast(`<i data-icon="sparkle"></i> Restored: <b>${f.into.name}</b> · place it from Bag → Finds`); }
  save(); hud(); checkGoals(); if (panel === 'bag') renderPanel();
}
function hurryRestore(id) { const r = S.restoring.find((x) => x.id === id); if (!r || !spendJewels(RESTORE_HURRY_JEWELS)) return; r.start = now() - r.ms; finishRestore(r); }
function spendJewels(n) {
  if (S.jewels < n) { toast(`You need ${n} Jewel${n > 1 ? 's' : ''} — get more in the Jewel Shop`); openPanel('jewels'); return false; }
  S.jewels -= n; save(); hud(); return true;
}

// ---------------- Build mode (raised beds) ----------------
let buildMode = false;
function enterBuild() {
  if (S.wood < bedCost()) { toast(`A raised bed needs ${bedCost()} Wood — chop more trees`); return; }
  closePanel(); deselect(); if (placing) exitPlace(); buildMode = true;
  const list = SITES.filter((s) => S.lots[s.lot] && !S.beds.includes(s.id)).map((s) => ({ id: s.id, ok: siteClear(s.id) }));
  W.setGhosts(list);
  const ready = list.filter((s) => s.ok).length;
  $('#buildbar-text').innerHTML = ready ? `Tap a <b>glowing patch</b> to build a raised bed · ${woodTag(bedCost())}` : `No patch is fully clear yet — clear the <b>trees &amp; stumps</b> inside a pink patch.`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  if (!ready) setTimeout(() => buildMode && exitBuild(), 4200);
}
function exitBuild() { buildMode = false; W.setGhosts(null); $('#buildbar').classList.add('hidden'); }
$('#buildbar-cancel').addEventListener('click', () => { if (placing) exitPlace(); else exitBuild(); });
function buildBed(siteId) {
  if (S.beds.includes(siteId) || !siteClear(siteId) || S.wood < bedCost()) return false;
  S.wood -= bedCost(); S.beds.push(siteId); for (let k = 0; k < PER_BED; k++) S.tiles.push(null);
  const s = siteById(siteId);
  for (const g of S.ground.filter((g) => inSite(g, s))) collectLoot(g.key);   // anything lying in the patch goes to your bag
  W.addBed(siteId, true); exitBuild(); save(); hud();
  popAt(V3(s.x, 1.2, s.z), `<i data-icon="build"></i>Raised bed built!`);
  if (S.beds.length === 1) firstBed();
  syncBlueprints(); checkGoals(); return true;
}
function firstBed() {
  // the rain barrel still arrives with the first bed, so you can never run out of water and get stuck
  S.barrel = true; S.waterAt = now(); save();
  setTimeout(() => { W.appear(W.barrel, true); syncBlueprints(); hud(); }, 700);
  setTimeout(openStarterPack, 1900);
}
function openStarterPack() {
  if (S.starterOpened) return;
  S.starterOpened = true;
  for (const [k, v] of Object.entries(STARTER)) S.inv[k] += v;
  S.jewels += STARTER_JEWELS;
  S.discovered.heartvine = S.discovered.sunpetal = S.discovered.rainbarrel = true; S.unlocked.rainbarrel = true;
  save(); hud();
  showReveal([{ id: 'heartvine', isNew: true }, { id: 'sunpetal', isNew: true }, { id: 'rainbarrel', isNew: true }], {
    title: 'Starter Seed Pack', done: `Added to your satchel: ${STARTER.seed_heartvine} Heartvine seeds · ${STARTER.seed_sunpetal} Sunpetal seeds · ${STARTER.water} water · ${STARTER_JEWELS} Jewels`,
    onCollect: () => { tip('standbp'); setTimeout(() => toast('Tap a soil tile in your new bed to plant'), 400); },
  });
}

// ---------------- Structures you build ----------------
const useOpt = { stand: true, market: true };
const marketCoins = () => BUILDS.market.coins - (useOpt.market && S.scrap >= BUILDS.market.opt.scrap ? BUILDS.market.opt.save : 0);
function glideTo(k) { W.ctl.moved = true; W.glide({ target: V3(SPOTS[k][0] * 0.85, 0.3, SPOTS[k][1] - 0.8), zoom: Math.min(W.ctl.zoom, 1.0) }, 0.8); }
function buildStand() {
  const B = BUILDS.stand;
  if (S.standBuilt || building.stand || !S.beds.length || S.wood < B.wood) return false;
  S.wood -= B.wood;
  let crate = false; if (useOpt.stand && S.finds.old_crate > 0 && !S.bonus.crate) { S.finds.old_crate--; if (!S.finds.old_crate) delete S.finds.old_crate; S.bonus.crate = true; crate = true; }
  S.standBuilt = true; building.stand = true; save(); closePanel(); syncBlueprints(); glideTo('stand');
  setTimeout(() => W.buildAnim(W.stand, [2.3, 2.2, 1.5], () => {
    building.stand = false; popAt(spotV('stand'), 'Farm Stand built!'); if (crate) setTimeout(() => toast('The Old Crate became a display shelf · +4 shelf space'), 600);
    tip('stand'); hud(); checkGoals();
  }), 500);
  hud(); return true;
}
function buildRack() {
  const B = BUILDS.rack;
  if (S.rackBuilt || building.rack || !S.rackAvail || S.wood < B.wood) return false;
  S.wood -= B.wood; S.rackBuilt = true; building.rack = true; save(); closePanel(); syncBlueprints(); glideTo('rack');
  setTimeout(() => W.buildAnim(W.rack, [1.9, 2.1, 1.3], () => { building.rack = false; popAt(spotV('rack'), 'Drying Rack built!'); hud(); }), 500);
  hud(); return true;
}
function startMarket() {
  const B = BUILDS.market; const c = marketCoins();
  if (S.marketBuilt || S.marketProj || !S.marketAvail || S.wood < B.wood || S.coins < c) return false;
  if (c < B.coins) S.scrap -= B.opt.scrap;
  S.wood -= B.wood; S.coins -= c; S.marketProj = { start: now(), ms: B.s * 1000 }; save(); closePanel(); glideTo('market');
  W.setMarketState('building', 0); W.poof(spotV('market', 1.2), '#EBD5AA', 26, 2.2);
  popAt(spotV('market', 3.2), 'Rebuilding has begun!'); hud(); return true;
}
function finishMarket() {
  if (!S.marketProj) return; S.marketProj = null; S.marketBuilt = true; save();
  W.setMarketState('open'); W.poof(spotV('market', 1.0).setZ(SPOTS.market[1] + 0.9), '#A8744A', 20, 1.6); W.poof(spotV('market', 1.6), '#F5D07A', 24, 2.2); W.poof(spotV('market', 2.2), '#F7C5C5', 14, 1.8);
  popAt(spotV('market', 2.8), 'Supply Market rebuilt!'); tip('market'); hud(); checkGoals(); if (panel === 'market' || panel === 'build') renderPanel();
}
function hurryMarket() { if (!S.marketProj || !spendJewels(BUILDS.market.hurryJewels)) return; S.marketProj.start = now() - S.marketProj.ms; finishMarket(); }

// ---------------- Tile sheet / focus sheet (plants, grown trees, decor) ----------------
let selected = null, focus = null;
function selectTile(i) { focus = null; selected = i; W.select(i); closePanel(); renderSheet(); }
function focusThing(f) { selected = null; W.select(null); closePanel(); focus = f; renderFocus(); }
function deselect() { selected = null; focus = null; W.select(null); $('#tile-sheet').classList.add('hidden'); }
function renderFocus() {
  const sh = $('#tile-sheet'); if (!focus) return;
  let head = '', body = '';
  if (focus.kind === 'tree') {
    const t = treeById(focus.id); if (!t) return deselect();
    const st = treeStage(t), k = Math.min(1, (now() - t.at) / t.ms);
    head = `<h3>${TREE.stageNames[st]} <small>Planted tree · gives ${TREE.wood} Wood when mature</small></h3>`;
    const dots = `<div class="stage-dots">${TREE.stageNames.map((s, n) => `<span class="${n <= st ? 'on' : ''}">${s.replace(' tree', '')}</span>`).join('')}</div>`;
    body = st < 3 ? `<div class="progress"><b id="sheet-prog" style="width:${(k * 100).toFixed(1)}%"></b></div>${dots}<p class="muted" id="sheet-left" style="margin-top:6px">Fully grown in ${fmtTime(t.ms * (1 - k))} · keeps growing while the game is closed</p>
      <div class="ts-actions"><button class="btn btn-blush" data-act="hurry-tree">Grow a stage · ${jewelTag(TREE.hurryJewels)}</button></div>`
      : `${dots}<div class="ts-actions"><button class="btn btn-gold" data-act="chop-tree"><i data-icon="axe"></i> Chop for ${TREE.wood} Wood</button></div>`;
  } else if (focus.kind === 'decor') {
    const d = S.decor.find((x) => x.key === focus.key); if (!d) return deselect(); const info = DECOR_INFO[d.type];
    head = `<h3>${info.name} <small>Garden decor · +${info.atm} atmosphere</small></h3>`;
    body = `<p class="muted">Atmosphere ${atmosphere()} · customers arrive ${Math.round((1 - atmosMult()) * 100)}% sooner.</p><div class="ts-actions"><button class="btn" data-act="store-decor">Put back in bag</button></div>`;
  }
  sh.innerHTML = `<div class="ts-head"><div class="ts-ico">${focus.kind === 'tree' ? ICONS.sapling : decorIcon(S.decor.find((x) => x.key === focus.key)?.type)}</div>${head}<button class="close-btn" data-act="close">×</button></div>${body}`;
  sh.dataset.st = focus.kind === 'tree' ? treeStage(treeById(focus.id)) : -1;
  fillIcons(sh); sh.classList.remove('hidden');
}
function renderSheet() {
  if (focus) return renderFocus();
  const sh = $('#tile-sheet');
  if (selected == null) { sh.classList.add('hidden'); return; }
  const i = selected, p = S.tiles[i];
  let head, body = '';
  if (!p) {
    head = `<h3>Empty plot <small>${tileName(i)} · choose a seed to plant</small></h3>`;
    const owned = Object.keys(SPECIES).filter((sp) => S.inv['seed_' + sp] > 0);
    if (!owned.length) body = S.marketBuilt ? `<p class="muted">You’re out of seeds.</p><div class="ts-actions"><button class="btn btn-primary" data-act="open-market">Visit Supply Market</button></div>` : `<p class="muted">You’re out of seeds — harvest blooms to collect more. (Rebuild the Supply Market to buy them.)</p>`;
    else body = `<div class="ts-row">${owned.map((sp) => `<button class="seed-chip" data-plant="${sp}"><img src="${SPECIES[sp].img}" alt=""/>${SPECIES[sp].name.replace('Spiral ', '')}<small>×${S.inv['seed_' + sp]} seeds</small></button>`).join('')}</div>`;
  } else {
    const sp = SPECIES[p.sp], st = stageOf(p), k = progress(p);
    head = `<h3>${sp.name} <small>${tileName(i)} · ${p.wateredAt ? STAGES[st] : 'Thirsty seed'}</small></h3>`;
    const dots = `<div class="stage-dots">${STAGES.map((s, n) => `<span class="${n <= st && p.wateredAt ? 'on' : ''}">${s}</span>`).join('')}</div>`;
    if (!p.wateredAt) body = `<p class="muted">This seed needs water before it can grow.${S.inv.water ? '' : ' The rain barrel refills your can over time.'}</p><div class="ts-actions"><button class="btn btn-primary" data-act="water" ${S.inv.water ? '' : 'disabled'}><i data-icon="water"></i> Water (${S.inv.water} left)</button>${!S.inv.water && S.marketBuilt ? '<button class="btn" data-act="open-market">Buy water</button>' : ''}</div>`;
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
  else if (a === 'hurry-tree') hurryTree(focus.id); else if (a === 'chop-tree') tapGrown(focus.id); else if (a === 'store-decor') storeDecor(focus.key);
});
function plant(i, sp) {
  if (S.tiles[i] || !(S.inv['seed_' + sp] > 0)) return;
  S.inv['seed_' + sp]--; S.tiles[i] = { sp, plantedAt: now(), wateredAt: null, growMs: SPECIES[sp].growS * 1000 };
  syncTile(i); save(); hud(); renderSheet(); tip('water');
}
function water(i) {
  const p = S.tiles[i]; if (!p || p.wateredAt || S.inv.water <= 0) return;
  if (S.inv.water >= regenMax()) S.waterAt = now();
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
  if (p.sp === 'heartvine' && !S.rackAvail) { S.rackAvail = true; save(); setTimeout(() => { syncBlueprints(); hud(); tip('heartvine'); }, 900); }
  checkGoals();
}
function onBloom(i) { tip('bloom'); if (selected === i) renderSheet(); }

// ---------------- Panels ----------------
let panel = null, marketTab = 'buy', bagTab = 'satchel', panelArg = null, panelAt = 0;
function openPanel(name, tab) {
  if (buildMode) exitBuild(); if (placing) exitPlace();
  panel = name; if (name === 'market' && tab) marketTab = tab; if (name === 'bag' && tab) bagTab = tab; if (name === 'lot') panelArg = tab;
  $('#tile-sheet').classList.add('hidden'); if (selected != null || focus) { selected = null; focus = null; W.select(null); }
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
  panelAt = performance.now(); $('#panel').classList.remove('hidden'); $('#panel').dataset.name = name; renderPanel(); $('#panel-body').scrollTop = 0;
}
function closePanel() { panel = null; $('#panel').classList.add('hidden'); document.querySelectorAll('#tabbar button').forEach((b) => b.classList.remove('on')); }
$('#panel-close').addEventListener('click', closePanel);
$('#panel').addEventListener('click', (e) => { if (e.target.id === 'panel' && performance.now() - panelAt > 450) closePanel(); });
document.querySelectorAll('#tabbar button').forEach((b) => b.addEventListener('click', () => (panel === b.dataset.panel ? closePanel() : openPanel(b.dataset.panel))));
$('#pill-jewels').addEventListener('click', () => (panel === 'jewels' ? closePanel() : openPanel('jewels')));

function itemSvg(id) { const it = ITEMS[id]; return it ? itemIcon(...it.icon) : itemIcon('water'); }
function renderPanel() {
  const body = $('#panel-body'), title = $('#panel-title'); const st = body.scrollTop;
  if (panel === 'bag') { title.innerHTML = 'Your Bag'; body.innerHTML = bagHTML(); }
  if (panel === 'build') { title.innerHTML = 'Build'; body.innerHTML = buildHTML(); }
  if (panel === 'stand') { title.innerHTML = 'Farm Stand'; body.innerHTML = standHTML(); }
  if (panel === 'market') { title.innerHTML = 'Supply Market'; body.innerHTML = marketHTML(); }
  if (panel === 'rack') { title.innerHTML = 'Drying Rack'; body.innerHTML = rackHTML(); }
  if (panel === 'lot') { title.innerHTML = LOTS[panelArg].name; body.innerHTML = lotHTML(panelArg); }
  if (panel === 'settings') { title.innerHTML = 'Settings'; body.innerHTML = settingsHTML(); }
  if (panel === 'jewels') { title.innerHTML = `Jewel Shop${Payments.isTest ? ' <span class="test-tag">Test mode</span>' : ''}`; body.innerHTML = jewelsHTML(); }
  fillIcons(body); fillIcons(title); body.scrollTop = st;
}
function settingsHTML() {
  const games = OTHER_GAMES.map((g) => `<div class="game-row" data-game="${g.id}"><div class="game-art">${gameArt(g.id)}</div>
    <div class="meta"><b>${g.name}${g.status === 'soon' ? ' <span class="soon-tag">Coming soon</span>' : ''}</b><small class="gr-tag">${g.tagline}</small><small>${g.blurb}</small></div>
    ${g.status === 'live' && g.url ? `<a class="btn btn-primary sm" href="${g.url}" target="_blank" rel="noopener">Play</a>` : ''}</div>`).join('');
  const adsRow = ADS_MODE === 'off' ? '' : S.noAds
    ? `<div class="row"><div class="ico"><i data-icon="heart" style="width:34px;height:34px"></i></div><div class="meta"><b>No More Ads · Owned</b><small>Thank you! Banners and partner ads are switched off.</small></div></div>`
    : `<div class="row"><div class="ico"><i data-icon="jewel" style="width:34px;height:34px"></i></div><div class="meta"><b>No More Ads + ${NO_ADS_BUNDLE.n} Jewels</b><small>Removes the banner and partner ads · ${NO_ADS_BUNDLE.price}</small></div><div class="acts"><button class="btn btn-blush sm" data-act="open-jewels">View</button></div></div>`;
  return `<div class="sec-title" id="play-other-games">Play Other Games</div><div class="list games">${games}</div>
    ${adsRow ? `<div class="sec-title">Ads</div><div class="list">${adsRow}</div>` : ''}
    <div class="sec-title">Help</div><div class="list"><button class="row set-btn" data-act="tips-again"><b>Show tips again</b><small>Replay the helpful hints from the start</small></button></div>
    <div class="sec-title">Your save</div><div class="list"><div class="row"><div class="meta"><b>Autosaves on this device</b><small>Progress is kept in this browser, even while the game is closed.</small></div></div>
    <button class="row set-btn danger" data-act="reset"><b>Reset garden…</b><small>Erase all progress and start again in the woods</small></button></div>
    <p class="muted" style="margin:14px 4px 0;text-align:center">Petalspire v0.3 · prototype${Payments.isTest ? ' · <span class="test-tag" style="margin:0">Test mode</span>' : ''}</p>`;
}
function bagHTML() {
  const nf = Object.values(S.finds).reduce((a, v) => a + v, 0) + S.restoring.length;
  const seg = `<div class="seg"><button data-bag="satchel" class="${bagTab === 'satchel' ? 'on' : ''}">Satchel</button><button data-bag="finds" class="${bagTab === 'finds' ? 'on' : ''}">Finds${nf ? ` · ${nf}` : ''}</button></div>`;
  const jewels = `<button class="jewel-strip" data-act="open-jewels"><i data-icon="jewel"></i><span><b>${S.jewels} Jewels</b><small>Finish restorations, grow trees and rebuilds instantly</small></span><em>Shop</em></button>`;
  return jewels + seg + (bagTab === 'finds' ? findsHTML() : satchelHTML());
}
function satchelHTML() {
  const ids = ['water', 'seed_heartvine', 'seed_sunpetal', 'seed_moonflower', 'flower_heartvine', 'flower_sunpetal', 'flower_moonflower', 'dried_heartvine'];
  const res = (icon, name, n) => `<div class="inv"><i data-icon="${icon}" style="width:38px;height:38px"></i><b>${name}</b><small>×${n}</small></div>`;
  const cells = res('wood', 'Wood', S.wood) + (S.scrap ? res('scrap', 'Scrap', S.scrap) : '') + (S.inv.sapling ? res('sapling', 'Tree sapling', S.inv.sapling) : '') +
    ids.filter((id) => S.inv[id] > 0 || id === 'water').map((id) => `<div class="inv">${itemSvg(id)}<b>${id === 'water' ? 'Water' : ITEMS[id].name}</b><small>×${S.inv[id]}</small></div>`).join('');
  const feats = Object.keys(S.owned).filter((k) => S.owned[k]).map((k) => `<div class="row"><div class="ico">${FEATURE_ART[k]}</div><div class="meta"><b>${FEATURES[k].name}</b><small>${FEATURES[k].blurb.replace('Once bought, ', '')}</small></div></div>`).join('');
  return `<div class="inv-grid">${cells}</div>
    ${S.inv.sapling ? `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="place-sapling"><i data-icon="sapling"></i> Plant a sapling</button></div>` : ''}
    ${feats ? `<div class="sec-title">Garden features</div><div class="list">${feats}</div>` : ''}
    <p class="muted" style="margin:14px 4px 0">Chop trees for Wood, build raised beds, and sell your harvest at the Farm Stand by the road.</p>`;
}
function findsHTML() {
  const atm = atmosphere();
  const head = `<div class="finds-head"><span class="chip"><i data-icon="heart"></i>Atmosphere <b>${atm}</b></span><span class="chip"><i data-icon="scrap"></i>Scrap <b>${S.scrap}</b></span><span class="chip"><i data-icon="wood"></i><b>${S.wood}</b></span></div>
    ${atm ? `<p class="muted" style="margin:0 4px 8px">Customers arrive ${Math.round((1 - atmosMult()) * 100)}% sooner thanks to your decor.</p>` : ''}`;
  const restoring = S.restoring.map((r) => { const f = FINDS[r.kind], k = Math.min(1, (now() - r.start) / r.ms);
    return `<div class="find-row working"><div class="ico">${findIcon(r.kind)}</div><div class="meta"><b>${f.into.name}</b><small>Restoring · <span data-rleft="${r.id}">${fmtTime(r.ms * (1 - k))}</span> left</small>
      <div class="progress slim"><b data-rprog="${r.id}" style="width:${(k * 100).toFixed(1)}%"></b></div></div>
      <div class="acts"><button class="btn btn-blush sm" data-hurry="${r.id}">Finish · ${jewelTag(RESTORE_HURRY_JEWELS)}</button></div></div>`; }).join('');
  const raw = FIND_IDS.filter((k) => S.finds[k] > 0).map((k) => { const f = FINDS[k]; const ok = canPay(f.restore);
    return `<div class="find-row"><div class="ico">${findIcon(k)}</div><div class="meta"><b>${f.name}${S.finds[k] > 1 ? ` ×${S.finds[k]}` : ''}</b>
      <small>Restore → <b>${f.into.name}</b> · ${f.into.bonus ? f.into.blurb : `decor, +${f.into.atm} atmosphere`}</small></div>
      <div class="find-acts"><button class="btn btn-primary sm" data-restore="${k}" ${ok ? '' : 'disabled'}>Restore ${costHTML(f.restore)} · ${fmtTime(f.restore.s * 1000)}</button>
      <button class="btn sm" data-recycle="${k}"><i data-icon="recycle"></i> Recycle ${gainHTML(f.recycle)}</button></div></div>`; }).join('');
  const decor = Object.entries(S.decorInv).filter(([, n]) => n > 0).map(([t, n]) => `<div class="find-row"><div class="ico">${decorIcon(t)}</div><div class="meta"><b>${DECOR_INFO[t].name}${n > 1 ? ` ×${n}` : ''}</b><small>Restored decor · +${DECOR_INFO[t].atm} atmosphere when placed</small></div><div class="acts"><button class="btn btn-gold sm" data-place="${t}">Place</button></div></div>`).join('');
  const bon = Object.values(FINDS).filter((f) => f.into.bonus && S.bonus[f.into.bonus]).map((f) => `<div class="row"><div class="ico">${findIcon(Object.keys(FINDS).find((k) => FINDS[k] === f))}</div><div class="meta"><b>${f.into.name}</b><small>${f.into.blurb}</small></div><span class="ok-tag">Active</span></div>`).join('');
  const placed = S.decor.length ? `<p class="muted" style="margin:10px 4px 0">${S.decor.length} decor placed in your garden — tap one to move it back to your bag.</p>` : '';
  if (!raw && !restoring && !decor && !bon) return head + `<div class="empty">Nothing found yet. About one in five trees, stumps, bushes and rocks hides something — watch for a <b>sparkle</b> when you clear.</div>${placed}`;
  return head + (restoring ? `<div class="sec-title">In the workshop</div><div class="list">${restoring}</div>` : '') +
    (raw ? `<div class="sec-title">Found while clearing</div><div class="list">${raw}</div>` : '') +
    (decor ? `<div class="sec-title">Ready to place</div><div class="list">${decor}</div>` : '') +
    (bon ? `<div class="sec-title">Garden upgrades</div><div class="list">${bon}</div>` : '') + placed;
}
const BIG = (icon) => `<i data-icon="${icon}" style="width:56px;height:56px"></i>`;
function projectCard(id) {
  const B = BUILDS[id];
  const status = (cls, txt) => `<span class="bstat ${cls}">${txt}</span>`;
  if (id === 'stand') {
    if (S.standBuilt) return card(BIG('stand'), 'Farm Stand', 'Sell flowers to passing drivers.', status('done', 'Built'));
    if (!S.beds.length) return card(BIG('stand'), 'Farm Stand', 'A roadside stand to sell your flowers.', status('lock', '<i data-icon="lock"></i> Build a raised bed first'), true);
    const crate = S.finds.old_crate > 0 && !S.bonus.crate;
    return card(BIG('stand'), 'Farm Stand', `A roadside stand to sell your flowers. ${S.wood < B.wood ? `<b>Need ${B.wood - S.wood} more Wood.</b>` : ''}`,
      `<div class="cost">${woodTag(B.wood)} <span class="${S.wood >= B.wood ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      ${crate ? `<button class="opt ${useOpt.stand ? 'on' : ''}" data-opt="stand"><span class="tick"></span>${findIcon('old_crate')}<span>${B.opt.label}</span></button>` : `<small class="opt-note">Optional: an <b>Old Crate</b> find becomes a display shelf (+4 space).</small>`}
      <button class="btn btn-gold" data-act="build-stand" ${S.wood >= B.wood ? '' : 'disabled'}><i data-icon="build"></i> Build Farm Stand</button>`);
  }
  if (id === 'rack') {
    if (S.rackBuilt) return card(BIG('rack'), 'Drying Rack', 'Dry Heartvine to sell for almost 3×.', status('done', 'Built'));
    if (!S.rackAvail) return card(BIG('rack'), 'Drying Rack', 'Dry Heartvine to sell for almost 3×.', status('lock', '<i data-icon="lock"></i> Harvest your first Heartvine'), true);
    return card(BIG('rack'), 'Drying Rack', 'Dry Heartvine to sell for almost 3×.', `<div class="cost">${woodTag(B.wood)} <span class="${S.wood >= B.wood ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-rack" ${S.wood >= B.wood ? '' : 'disabled'}><i data-icon="build"></i> Build Drying Rack</button>`);
  }
  if (id === 'market') {
    const pct = Math.min(100, (S.stats.standEarned / MARKET_GOAL) * 100);
    if (S.marketBuilt) return card(BIG('market'), 'Supply Market', 'Rebuilt and open for business.', status('done', 'Open'));
    if (S.marketProj) { const k = marketK();
      return card(BIG('market'), 'Rebuilding the Supply Market', 'Carpenters are at work on the old cottage.', `<div class="progress"><b data-mprog style="width:${(k * 100).toFixed(1)}%"></b></div><small class="muted" data-mleft>${fmtTime(S.marketProj.ms * (1 - k))} left</small>
        <button class="btn btn-blush" data-act="hurry-market">Finish now · ${jewelTag(B.hurryJewels)}</button>`); }
    if (!S.marketAvail) return card(BIG('market'), 'Rebuild the Supply Market', `The old market is boarded up. Earn <b>${MARKET_GOAL} coins</b> at your Farm Stand to start the project.`,
      `<div class="goal-mini"><span class="gbar"><em style="width:${pct}%"></em></span><small>${Math.min(S.stats.standEarned, MARKET_GOAL)} / ${MARKET_GOAL} coins earned</small></div>`, true);
    const c = marketCoins(); const ok = S.wood >= B.wood && S.coins >= c; const canScrap = S.scrap >= B.opt.scrap;
    return card(BIG('market'), 'Rebuild the Supply Market', `Fix the roof, walls and awning. Takes ${fmtTime(B.s * 1000)} once started.`,
      `<div class="cost">${woodTag(B.wood)} ${coin(c)} <span class="${ok ? 'ok' : 'no'}">you have ${S.wood} Wood · ${S.coins} coins</span></div>
      ${canScrap ? `<button class="opt ${useOpt.market ? 'on' : ''}" data-opt="market"><span class="tick"></span><i data-icon="scrap" style="width:26px;height:26px"></i><span>${B.opt.label}</span></button>` : `<small class="opt-note">Optional: <b>3 Scrap</b> (recycle finds) patches the roof and saves ${B.opt.save} coins.</small>`}
      <button class="btn btn-gold" data-act="build-market" ${ok ? '' : 'disabled'}><i data-icon="build"></i> Start rebuilding</button>`);
  }
}
function card(art, name, sub, extra, locked = false) { return `<div class="build-card${locked ? ' locked' : ''}"><div class="bc-art">${art}</div><div class="meta"><b>${name}</b><small>${sub}</small>${extra || ''}</div></div>`; }
function buildHTML() {
  const owned = SITES.filter((s) => S.lots[s.lot] && !S.beds.includes(s.id)); const ready = owned.filter((s) => siteClear(s.id)).length;
  const cost = bedCost(); const can = S.wood >= cost;
  const best = owned.map((s) => siteLeft(s.id)).sort((a, b) => a - b)[0];
  const note = !owned.length ? 'Every patch on your land has a bed. Buy a neighboring plot to expand.' : ready ? `${ready} patch${ready > 1 ? 'es are' : ' is'} cleared and ready.` : `Clear a patch first (closest patch: ${best} thing${best === 1 ? '' : 's'} left).`;
  const bed = card(bedSvg(), 'Raised Bed', `A cedar bed with 3×3 planting plots. ${note}`, `<div class="cost">${woodTag(cost)} <span class="${can ? 'ok' : 'no'}">you have ${S.wood}</span></div>
    <button class="btn btn-primary" data-act="place-bed" ${can && owned.length ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot</button>`);
  const tree = card(BIG('sapling'), 'Plant a tree', `Saplings grow into big trees in about ${fmtTime(TREE_MS)} (even while you’re away) and give ${TREE.wood} Wood. You have <b>${S.inv.sapling}</b>.`,
    `<button class="btn" data-act="place-sapling" ${S.inv.sapling ? '' : 'disabled'}><i data-icon="sapling"></i> Plant a sapling</button>`, !S.inv.sapling);
  return `<div class="build-list">${bed}${projectCard('stand')}${projectCard('rack')}${projectCard('market')}${tree}</div>
    <div class="sec-title">Your land</div><div class="list">${LOT_FOR_SALE.concat(['home']).filter((l) => S.lots[l]).map((l) => `<div class="row"><div class="ico"><i data-icon="sign" style="width:30px;height:30px"></i></div><div class="meta"><b>${LOTS[l].name}</b><small>${SITES.filter((s) => s.lot === l && S.beds.includes(s.id)).length}/4 beds · ${OBSTACLES.filter((o) => o.lot === l && obsState(o.id) !== 'gone').length} trees &amp; stumps left</small></div></div>`).join('')}</div>
    <p class="muted" style="margin:10px 4px 0">More land: tap a <b>For Sale</b> sign in the woods around you.</p>`;
}
function bedSvg() { return `<svg viewBox="0 0 64 44"><path d="M4 22h56v14H4z" fill="#C99A6B" stroke="#7C5634" stroke-width="2"/><path d="M8 22l4-8h40l4 8z" fill="#8C6545" stroke="#7C5634" stroke-width="2" stroke-linejoin="round"/><path d="M4 29h56" stroke="#B07D52" stroke-width="2"/><path d="M22 16c0-5 2-8 5-9M38 16c0-6 3-9 6-10" stroke="#5E825F" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M27 7c-3.5 0-5-2.6-5-5 3 0 5 2 5 5zM44 6c.5-3 2.4-4.6 5-4.6-.3 3-2.2 4.5-5 4.6z" fill="#B7D4B5" stroke="#3D5A40" stroke-width="1.4"/></svg>`; }

function rewardHTML() {
  if (!Ads.partner) return '';
  const wait = Math.max(0, S.adRewardAt + ADS.rewarded.cooldownMs - now());
  return `<div class="ad-reward"><span class="ad-tag">Ad</span><div class="meta"><b>Watch an ad for a bonus</b><small>Partner ad placeholder · ${wait ? `again in ${fmtTime(wait)}` : `+${ADS.rewarded.coins} coins`}</small></div>
    <button class="btn btn-gold sm" data-act="watch-ad" ${wait ? 'disabled' : ''}>${coin('+' + ADS.rewarded.coins)}</button></div>`;
}
function watchAd() {
  if (S.adRewardAt + ADS.rewarded.cooldownMs > now()) return;
  Ads.rewarded(() => { S.adRewardAt = now(); S.coins += ADS.rewarded.coins; S.stats.adRewards++; save(); hud(); toast(`<i data-icon="coin"></i> +${ADS.rewarded.coins} coins · thanks for watching`); if (panel === 'stand') renderPanel(); });
}
function standHTML() {
  const used = standCount(), cap = standCap();
  const onStand = SELL_ORDER.filter((id) => S.stand[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name} ×${S.stand[id]}</b><small>${ITEMS[id].sell} coins each</small></div><div class="acts"><button class="btn sm" data-unstock="${id}">Take back</button></div></div>`).join('');
  const fromBag = SELL_ORDER.filter((id) => S.inv[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>You have ${S.inv[id]} · sells for ${ITEMS[id].sell}</small></div>
    <div class="acts"><button class="btn sm" data-stock="${id}" data-n="1" ${used >= cap ? 'disabled' : ''}>+1</button><button class="btn btn-gold sm" data-stock="${id}" data-n="all" ${used >= cap ? 'disabled' : ''}>Stock all</button></div></div>`).join('');
  const status = customer ? `<b>A customer is at your stand!</b>` : used ? `Next customer in about ${fmtTime(Math.max(0, nextCust - now()))}` : 'Put items on the stand to attract customers.';
  const prog = !S.marketAvail ? `<div class="goal-mini"><small>Earn ${MARKET_GOAL} coins here to start rebuilding the Supply Market</small><span class="gbar"><em style="width:${Math.min(100, (S.stats.standEarned / MARKET_GOAL) * 100)}%"></em></span><small>${Math.min(S.stats.standEarned, MARKET_GOAL)} / ${MARKET_GOAL}</small></div>` : `<p class="muted" style="margin:0 4px 8px">Earned at your stand: ${coin(S.stats.standEarned)}${atmosphere() ? ` · atmosphere ${atmosphere()}` : ''}</p>`;
  return `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh flowers by the road</p></div>
    <div class="stand-status"><i data-icon="stand"></i><span id="stand-status">${status}</span></div>${prog}${rewardHTML()}
    <div class="sec-title">On your stand · ${used}/${cap}${S.bonus.crate ? ' · crate shelf' : ''}</div>
    ${onStand ? `<div class="list">${onStand}</div>` : '<div class="empty">The stand is empty.</div>'}
    <div class="sec-title">From your satchel</div>
    ${fromBag ? `<div class="list">${fromBag}</div>` : '<div class="empty">Nothing to sell yet — harvest some blooms first.</div>'}`;
}
function stock(id, n) {
  const space = standCap() - standCount(); const q = Math.min(space, n === 'all' ? S.inv[id] : 1, S.inv[id]); if (q <= 0) return;
  const wasEmpty = standCount() === 0;
  S.inv[id] -= q; S.stand[id] = (S.stand[id] || 0) + q; S.stats.stocked += q;
  if (wasEmpty && !customer) nextCust = Math.max(nextCust, now() + (S.stats.customers ? 6000 : 3500));
  syncStand(); save(); hud(); renderPanel(); checkGoals();
}
function unstock(id) { const q = S.stand[id] || 0; if (!q) return; S.inv[id] += q; delete S.stand[id]; syncStand(); save(); hud(); renderPanel(); }

function marketHTML() {
  if (!S.marketBuilt) {
    return `<div class="hero locked-hero"><img src="assets/market.jpg" alt=""/><p>${S.marketProj ? 'Being rebuilt…' : 'Boarded up — for now'}</p></div>
      <p class="muted" style="margin:4px 4px 12px">The old Supply Market sold seeds, water, Wood and Card Packs. It has to be <b>rebuilt</b> before it can open again.</p>
      <div class="build-list">${projectCard('market')}</div>
      <button class="jewel-strip" data-act="open-jewels" style="margin-top:12px"><i data-icon="jewel"></i><span><b>${S.jewels} Jewels</b><small>Jewel Shop</small></span><em>Shop</em></button>`;
  }
  let h = `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh seeds &amp; fair prices</p></div>
    <div class="seg"><button data-tab="buy" class="${marketTab === 'buy' ? 'on' : ''}">Supplies</button><button data-tab="packs" class="${marketTab === 'packs' ? 'on' : ''}">Card Packs</button></div>`;
  if (marketTab === 'packs') return h + packsHTML();
  const rows = [];
  rows.push(buyRow('wood5', `<i data-icon="wood" style="width:40px;height:40px"></i>`, 'Bundle of Wood', `+${SHOP.wood5.wood} Wood · you have ${S.wood}`, SHOP.wood5.price));
  rows.push(buyRow('sapling', `<i data-icon="sapling" style="width:40px;height:40px"></i>`, 'Tree sapling', `Grows in ~${fmtTime(TREE_MS)} into a big tree (${TREE.wood} Wood) · you have ${S.inv.sapling}`, SHOP.sapling.price));
  rows.push(buyRow('water5', itemIcon('water'), 'Watering can refill', '+5 water', WATER_PRICE));
  rows.push(S.unlocked.rainbarrel ? buyRow('water15', FEATURE_ART.rainbarrel, 'Rain Barrel water', '+15 water · best value', BARREL_PRICE) : lockedRow(FEATURE_ART.rainbarrel, 'Rain Barrel water'));
  for (const sp of Object.keys(SPECIES)) { const d = SPECIES[sp]; rows.push(S.unlocked[sp] ? buyRow('seed_' + sp, `<img src="${d.img}" alt=""/>`, `${d.name} Seeds`, `${RARITY[d.rarity].label} · blooms in ~${d.growS}s · you have ${S.inv['seed_' + sp]}`, d.seedPrice) : lockedRow(`<img src="${d.img}" alt=""/>`, `${d.name} Seeds`)); }
  for (const f of ['beehive', 'sundial']) {
    const d = FEATURES[f];
    if (S.owned[f]) rows.push(`<div class="row"><div class="ico">${FEATURE_ART[f]}</div><div class="meta"><b>${d.name}</b><small>Owned · ${d.blurb.replace('Once bought, ', '')}</small></div></div>`);
    else rows.push(S.unlocked[f] ? buyRow(f, FEATURE_ART[f], d.name, d.blurb.replace('Once bought, ', ''), d.price) : lockedRow(FEATURE_ART[f], d.name));
  }
  return h + `<button class="jewel-strip" data-act="open-jewels"><i data-icon="jewel"></i><span><b>${S.jewels} Jewels</b><small>Jewel Shop</small></span><em>Shop</em></button><div class="list">${rows.join('')}</div>`;
}
const buyRow = (id, icon, name, sub, price) => `<div class="row"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>${sub}</small></div><div class="acts"><button class="btn btn-primary sm" data-buy="${id}" data-price="${price}" ${S.coins < price ? 'disabled' : ''}>${coin(price)}</button></div></div>`;
const lockedRow = (icon, name) => `<div class="row locked"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>Discover it in a Card Pack to unlock</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`;
function buy(id, price) {
  if (S.coins < price || !S.marketBuilt) return;
  S.coins -= price;
  if (id === 'wood5') S.wood += SHOP.wood5.wood; else if (id === 'sapling') S.inv.sapling++;
  else if (id === 'water5') S.inv.water += 5; else if (id === 'water15') S.inv.water += 15; else if (id.startsWith('seed_')) S.inv[id]++; else if (FEATURES[id]) S.owned[id] = true;
  save(); hud(); renderPanel();
  toast(id === 'wood5' ? `+${SHOP.wood5.wood} Wood` : id === 'sapling' ? 'Bought a tree sapling — plant it from Build or your Bag' : id.startsWith('seed_') ? `Bought 1 ${ITEMS[id].name.replace(' Seeds', ' seed')}` : id.startsWith('water') ? 'Water topped up' : `${FEATURES[id].name} added to your garden`);
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

// ---------------- Jewel Shop (prototype: purchases are simulated, see js/payments.js) ----------------
function jewelsHTML() {
  const cards = JEWEL_BUNDLES.map((b) => `<button class="jewel-card${b.best ? ' best' : ''}" data-jewels="${b.id}">${b.best ? '<span class="best-tag">Best value</span>' : ''}
    <span class="jc-art">${'<i data-icon="jewel"></i>'.repeat(b.n >= 50 ? 3 : b.n >= 10 ? 2 : 1)}</span><b>${b.n} Jewel${b.n > 1 ? 's' : ''}</b><em>${b.price}</em></button>`).join('');
  return `<div class="jewel-hero"><i data-icon="jewel"></i><div><b>${S.jewels}</b><small>Jewels</small></div></div>
    <p class="muted" style="margin:6px 4px 12px">Jewels finish a restoration instantly (${RESTORE_HURRY_JEWELS}), grow a planted tree by a stage (${TREE.hurryJewels}) or complete the market rebuild (${BUILDS.market.hurryJewels}).</p>
    <div class="jewel-grid">${cards}</div>
    ${ADS_MODE !== 'off' ? `<button class="noads-card${S.noAds ? ' owned' : ''}" data-jewels="${NO_ADS_BUNDLE.id}" ${S.noAds ? 'disabled' : ''}>
      <span class="na-art"><svg viewBox="0 0 48 48"><rect x="5" y="11" width="38" height="26" rx="7" fill="#FFF9F0" stroke="#3D5A40" stroke-width="2.6"/><text x="24" y="29" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="12" fill="#3D5A40">AD</text><path d="M8 40L40 8" stroke="#E07F86" stroke-width="4.2" stroke-linecap="round"/></svg></span>
      <span class="na-meta"><b>No More Ads + ${NO_ADS_BUNDLE.n} Jewels</b><small>Removes every ad for good, and adds ${NO_ADS_BUNDLE.n} <i data-icon="jewel"></i></small></span>
      ${S.noAds ? '<em class="owned-tag">Owned</em>' : `<em>${NO_ADS_BUNDLE.price}</em>`}</button>` : ''}
    ${Payments.isTest ? `<p class="test-note"><span class="test-tag">Test mode</span> Prototype only — purchases are simulated and nothing is charged.</p>` : ''}`;
}
function confirmBox(html, okText, onOk) {
  const C = $('#confirm'); C.innerHTML = `<div class="confirm-card">${html}<div class="confirm-acts"><button class="btn" data-c="no">Cancel</button><button class="btn btn-gold" data-c="ok">${okText}</button></div></div>`;
  fillIcons(C); C.classList.remove('hidden');
  C.onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b && e.target !== C) return; C.classList.add('hidden'); C.innerHTML = ''; if (b?.dataset.c === 'ok') onOk(); };
}
function askBuyJewels(id) {
  const b = id === NO_ADS_BUNDLE.id ? NO_ADS_BUNDLE : JEWEL_BUNDLES.find((x) => x.id === id); if (!b || (b.noAds && S.noAds)) return;
  const test = Payments.isTest;
  confirmBox(`<i data-icon="jewel" class="confirm-ico"></i><h3>${b.noAds ? `No More Ads + ${b.n} Jewels` : `${b.n} Jewel${b.n > 1 ? 's' : ''}`} · ${b.price}</h3>
    ${test ? `<p class="confirm-proto"><b>Prototype: purchase simulated, no charge.</b></p><p class="muted">This is a test build. No payment is taken and no card is needed — the Jewels are simply added.</p>` : '<p class="muted">You’ll be asked to confirm with the App Store.</p>'}`,
    test ? 'Simulate purchase' : `Buy for ${b.price}`, async () => {
      const r = await Payments.purchase(b);
      if (!r.ok) { toast(r.reason || 'Purchase didn’t go through'); return; }
      S.jewels += b.n; S.stats.jewelsBought += b.n; if (b.noAds) { S.noAds = true; Ads.sync(); } save(); hud(); if (panel === 'jewels' || panel === 'stand') renderPanel();
      sparkles($('#ui'), window.innerWidth / 2, window.innerHeight * 0.35, 20);
      toast(`<i data-icon="jewel"></i> ${b.noAds ? 'Ads removed · ' : ''}+${b.n} Jewel${b.n > 1 ? 's' : ''}${r.simulated ? ' (simulated, no charge)' : ''}`);
    });
}

$('#panel-body').addEventListener('click', (e) => {
  const b = e.target.closest('button, .coll .card'); if (!b) return;
  if (b.dataset.tab) { marketTab = b.dataset.tab; renderPanel(); return; }
  if (b.dataset.bag) { bagTab = b.dataset.bag; renderPanel(); return; }
  if (b.dataset.stock) return stock(b.dataset.stock, b.dataset.n);
  if (b.dataset.unstock) return unstock(b.dataset.unstock);
  if (b.dataset.buy) return buy(b.dataset.buy, +b.dataset.price);
  if (b.dataset.restore) return restore(b.dataset.restore);
  if (b.dataset.recycle) return recycle(b.dataset.recycle);
  if (b.dataset.hurry) return hurryRestore(+b.dataset.hurry);
  if (b.dataset.place) return enterPlace('decor', b.dataset.place);
  if (b.dataset.jewels) return askBuyJewels(b.dataset.jewels);
  if (b.dataset.opt) { useOpt[b.dataset.opt] = !useOpt[b.dataset.opt]; renderPanel(); return; }
  if (b.dataset.slot != null) { const k = +b.dataset.slot; if (S.rack[k]) collect(k); else hang(k); afterRack(); return; }
  const a = b.dataset.act;
  if (a === 'fill-rack') { for (let k = 0; k < RACK_SLOTS; k++) hang(k); afterRack(); return; }
  if (a === 'buy-pack') return buyPack();
  if (a === 'place-bed') return enterBuild();
  if (a === 'place-sapling') return enterPlace('sapling');
  if (a === 'build-stand') return buildStand();
  if (a === 'build-rack') return buildRack();
  if (a === 'build-market') return startMarket();
  if (a === 'hurry-market') return hurryMarket();
  if (a === 'open-jewels') return openPanel('jewels');
  if (a === 'watch-ad') return watchAd();
  if (a === 'tips-again') { S.tips = {}; save(); closePanel(); const g = GOALS[S.goal]; tip(g ? g.hint : 'chop'); return; }
  if (a === 'reset') return confirmBox('<h3>Reset your garden?</h3><p class="muted">This erases all progress on this device and starts again in the woods.</p>', 'Reset', () => {
    clearTimeout(saveTimer); localStorage.removeItem(SAVE_KEY); localStorage.removeItem(V02_KEY); S = null; location.reload(); });
  if (a === 'buy-lot') return buyLot(b.dataset.lot);
  if (b.classList.contains('card') && b.dataset.card) zoomCard(b.dataset.card);
});

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
    if (S.stats.customers % ADS.interstitialEverySales === 0) setTimeout(() => Ads.maybeBreak('sales', adBlocked()), 2600);
    c.bubble.innerHTML = `<span class="thanks">♥ Thank you!</span>`;
    const p = c.car.group.position; popAt(new THREE.Vector3(p.x, 1.9, p.z), `<i data-icon="coin"></i>+${total}`, 'coinpop');
    for (let k = 0; k < Math.min(6, items + 2); k++) setTimeout(() => coinFly(c.car.group.position), k * 90);
  } else c.bubble.innerHTML = `<span class="thanks">Sold out… next time!</span>`;
  syncStand(); save(); hud(); checkGoals(); if (panel === 'stand') renderPanel();
  setTimeout(() => { c.car.leave(); c.bubble.remove(); customer = null; nextCust = now() + randInt(15000, 30000) * atmosMult(); if (panel === 'stand') renderPanel(); }, 1400);
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
  if (S.coins < PACK_PRICE || !S.marketBuilt) return;
  S.coins -= PACK_PRICE; S.packs++;
  const ids = [drawCard(), drawCard(), drawCard()];
  if (S.packs === 1 && !S.unlocked.moonflower) ids[1] = 'moonflower';
  if (forced) forced.forEach((f, k) => f && (ids[k] = f));
  const seen = new Set();
  const results = ids.map((id) => { const isNew = (!S.discovered[id] || !S.unlocked[id]) && !seen.has(id); seen.add(id); S.discovered[id] = true; if (isNew) S.unlocked[id] = true; else S.coins += DUP_COINS; return { id, isNew }; });
  save(); hud(); closePanel();
  showReveal(results, { title: 'Botanical Card Pack', onCollect: (news) => { tip('pack'); if (news.length) openPanel('market', 'buy'); if (ADS.interstitialAfterPack) setTimeout(() => Ads.maybeBreak('pack', adBlocked()), 700); } });
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
$('#btn-settings').addEventListener('click', (e) => { e.stopPropagation(); panel === 'settings' ? closePanel() : openPanel('settings'); });

// ---------------- Input: drag to pan, pinch to zoom, twist to turn, tap ----------------
const canvas = $('#scene');
const ptrs = new Map(); let gesture = null;
const PAN = { x0: -13, x1: 13, z0: -17, z1: 5 };
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture?.(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  W.ctl.auto = false;
  if (ptrs.size === 1) gesture = { tap: true, rotate: e.pointerType === 'mouse' && (e.button === 2 || e.shiftKey) };
  else gesture = { tap: false, pinch: pinchDist(), zoom: W.ctl.zoom, ang: pinchAng() };
});
function pinchDist() { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
function pinchAng() { const [a, b] = [...ptrs.values()]; return Math.atan2(b.y - a.y, b.x - a.x); }
function panBy(px, py, x, y) {
  const a = W.groundAt(px, py), b = W.groundAt(x, y); if (!a || !b) return;
  const t = W.ctl.target; t.x = THREE.MathUtils.clamp(t.x - (b.x - a.x), PAN.x0, PAN.x1); t.z = THREE.MathUtils.clamp(t.z - (b.z - a.z), PAN.z0, PAN.z1);
  W.ctl.moved = true; W.updateCamera();
}
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p || !gesture || W.ctl.glide) return;
  const px = p.x, py = p.y, dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9) gesture.tap = false;
  if (ptrs.size >= 2 && gesture.pinch) {
    W.ctl.zoom = THREE.MathUtils.clamp(gesture.zoom * gesture.pinch / pinchDist(), 0.5, 1.6);
    const ang = pinchAng(); let d = ang - gesture.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); W.ctl.az -= d; gesture.ang = ang;
    W.updateCamera();
  } else if (ptrs.size === 1 && !gesture.tap) {
    if (gesture.rotate) { W.ctl.az -= dx * 0.008; W.ctl.pol = THREE.MathUtils.clamp(W.ctl.pol - dy * 0.005, 0.55, 1.22); W.updateCamera(); }
    else panBy(px, py, p.x, p.y);
  }
});
const endPtr = (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (gesture?.tap && ptrs.size === 0 && e.type === 'pointerup' && performance.now() - p.t < 600) handleTap(e.clientX, e.clientY);
  if (ptrs.size === 0) gesture = null; else if (ptrs.size === 1) { const [q] = [...ptrs.values()]; q.sx = q.x; q.sy = q.y; gesture = { tap: false }; }
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
    if (h?.kind === 'site') { if (h.ok) buildBed(h.id); else toast(`Clear the ${siteLeft(h.id)} trees, stumps or decor in this patch first`); }
    return;
  }
  if (placing) { const g = W.pick(x, y, 'ground'); if (g) placeAt(g.point.x, g.point.z); return; }
  if (panel) return closePanel();
  const hit = W.pick(x, y);
  if (!hit || hit.kind === 'ground') { deselect(); return; }
  if (hit.kind === 'tile') {
    const p = S.tiles[hit.index];
    if (selected === hit.index && p) { if (!p.wateredAt && S.inv.water) return water(hit.index); if (stageOf(p) === 3) return harvest(hit.index); }
    selectTile(hit.index);
  } else if (hit.kind === 'obstacle') { if (!hit.id.startsWith('g:')) deselect(); tapObstacle(hit.id); }
  else if (hit.kind === 'loot') collectLoot(hit.key);
  else if (hit.kind === 'decor') focusThing({ kind: 'decor', key: hit.key });
  else if (hit.kind === 'blueprint') openPanel('build');
  else if (hit.kind === 'lot') openLot(hit.id);
  else if (hit.kind === 'stand') openPanel('stand');
  else if (hit.kind === 'market') openPanel('market');
  else if (hit.kind === 'rack') openPanel('rack');
}

// ---------------- Title & intro ----------------
if (S.introDone) $('#btn-start').textContent = 'Continue';
$('#btn-start').addEventListener('click', () => {
  $('#title').classList.add('out'); setTimeout(() => $('#title').classList.add('hidden'), 650);
  if (migrated) setTimeout(() => toast('Petalspire v0.3 — a fresh start in the woods!'), 900);
  if (upgraded) setTimeout(() => toast(`Welcome to v0.3! Your garden came along · +1 tree sapling · +${STARTER_JEWELS} Jewels`), 900);
  if (!S.introDone) playIntro(); else { Ads.sync(); const g = GOALS[S.goal]; if (g) tip(g.hint); }
});
function playIntro() {
  const F = $('#fade'); F.classList.remove('hidden'); F.classList.add('on');
  W.intro(() => { S.introDone = true; save(); hud(); Ads.sync(); tip('chop'); $('#story').classList.add('hidden'); });
  requestAnimationFrame(() => setTimeout(() => F.classList.remove('on'), 60));
  setTimeout(() => F.classList.add('hidden'), 1800);
  const St = $('#story'); St.classList.remove('hidden');
  St.innerHTML = '<p class="l1">An old wooded lot by the road…</p><p class="l2">Let’s make it bloom.</p>';
}
$('#story').addEventListener('click', () => { if (W.ctl.glide) { W.ctl.glide.dur = Math.min(W.ctl.glide.dur, performance.now() - W.ctl.glide.t0 + 400); } });

// ---------------- Loop ----------------
let lastTick = 0, lastSlow = 0;
function tick() {
  requestAnimationFrame(tick);
  const t = performance.now();
  if (t - lastTick > 250) {
    lastTick = t;
    for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i]) syncTile(i);
    syncRack(); syncTrees();
    for (const r of [...S.restoring]) if (now() - r.start >= r.ms) finishRestore(r);
    if (S.marketProj) { if (marketK() >= 1) finishMarket(); else W.setMarketState('building', marketK()); }
    if (S.barrel) {
      if (S.inv.water >= regenMax()) S.waterAt = now();
      else { const n = Math.floor((now() - S.waterAt) / (regenS() * 1000)); if (n > 0) { S.inv.water = Math.min(regenMax(), S.inv.water + n); S.waterAt += n * regenS() * 1000; if (selected != null) renderSheet(); } }
    }
    if (S.standBuilt && !building.stand) {
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
    if (focus?.kind === 'tree') {
      const tr = treeById(focus.id);
      if (!tr) deselect(); else { const k = Math.min(1, (now() - tr.at) / tr.ms), pr = $('#sheet-prog');
        if (treeStage(tr) !== +$('#tile-sheet').dataset.st) renderFocus(); else if (pr) { pr.style.width = (k * 100).toFixed(1) + '%'; $('#sheet-left').textContent = `Fully grown in ${fmtTime(tr.ms * (1 - k))} · keeps growing while the game is closed`; } }
    }
    if (panel === 'rack') {
      const needs = S.rack.some((r, k) => r && document.querySelector(`[data-left="${k}"]`) && now() - r.start >= r.ms);
      if (needs) renderPanel(); else S.rack.forEach((r, k) => { const n = document.querySelector(`[data-left="${k}"]`); if (r && n) { n.textContent = fmtTime(r.ms - (now() - r.start)); const ring = n.previousElementSibling.lastElementChild; const C = 2 * Math.PI * 22; ring.setAttribute('stroke-dashoffset', C * ((r.ms - (now() - r.start)) / r.ms)); } });
    }
    if (panel === 'bag' && bagTab === 'finds') for (const r of S.restoring) { const k = Math.min(1, (now() - r.start) / r.ms); const a = document.querySelector(`[data-rprog="${r.id}"]`), b = document.querySelector(`[data-rleft="${r.id}"]`); if (a) a.style.width = (k * 100).toFixed(1) + '%'; if (b) b.textContent = fmtTime(r.ms * (1 - k)); }
    if (S.marketProj && (panel === 'market' || panel === 'build')) { const k = marketK(); const a = document.querySelector('[data-mprog]'), b = document.querySelector('[data-mleft]'); if (a) a.style.width = (k * 100).toFixed(1) + '%'; if (b) b.textContent = `${fmtTime(S.marketProj.ms * (1 - k))} left`; }
  }
  W.render();
}
fillIcons(); hud(); tick();
setInterval(save, 5000);

// ---------------- Debug hooks (used by automated tests) ----------------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
window.__ps = {
  get state() { return S; }, get selected() { return selected; }, get focus() { return focus; }, get placing() { return placing; }, get panel() { return panel; },
  get customer() { return customer && { wants: customer.wants, parked: customer.car.state === 'park' }; }, get buildMode() { return buildMode; }, W, THREE, TREE_MS,
  skip(sec) { const ms = sec * 1000; S.tiles.forEach((p) => { if (p) { p.plantedAt -= ms; if (p.wateredAt) p.wateredAt -= ms; } }); S.rack.forEach((r) => r && (r.start -= ms)); S.restoring.forEach((r) => (r.start -= ms)); if (S.marketProj) S.marketProj.start -= ms; nextCust -= ms; save(); },
  growTrees(ms) { for (const t of S.trees) if (t.st === 'full') t.at -= ms; save(); syncTrees(); },
  obstacles(lot = 'home', state) { return OBSTACLES.filter((o) => o.lot === lot && (!state || obsState(o.id) === state)).map((o) => ({ id: o.id, type: o.type, x: o.x, z: o.z, state: obsState(o.id), drop: S.looted[o.id] ? null : dropFor(o) })); },
  siteObstacles(id) { return SITE_OBS[id].filter((o) => obsState(o) !== 'gone'); },
  obsScreen(id) { if (id.startsWith('g:')) { const t = treeById(id); return W.project(V(t.x, t.st === 'stump' ? 0.25 : 0.4 + treeStage(t) * 0.4, t.z)); } const o = obstacleById(id); const st = obsState(id); return W.project(V(o.x, st === 'stump' ? 0.25 : o.type === 'tree' ? 1.0 * o.s : 0.3, o.z)); },
  lootScreen(key) { const g = S.ground.find((x) => x.key === key); return g && W.project(V(g.x, 0.45, g.z)); },
  decorScreen(key) { const d = S.decor.find((x) => x.key === key); return d && W.project(V(d.x, 0.5, d.z)); },
  blueprintScreen(id) { const [x, z] = SPOTS[id]; return W.project(V(x, 0.9, z)); },
  worldScreen(x, y, z) { return W.project(V(x, y, z)); },
  placeProblem, findSpot(lot = 'home', avoid = []) { const L = LOTS[lot]; for (let z = L.z1 - 1.2; z > L.z0 + 0.6; z -= 0.35) for (let x = L.x0 + 0.6; x < L.x1 - 0.6; x += 0.35) { if (!placeProblem(x, z) && avoid.every(([ax, az]) => Math.hypot(ax - x, az - z) > 1.2)) { const s = W.project(V(x, 0, z)); if (s.x > 30 && s.x < innerWidth - 30 && s.y > 160 && s.y < innerHeight - 260) { const u = W.project(V(x, 0.9, z)); if (W.pick(s.x, s.y)?.kind === 'ground' && W.pick(u.x, u.y)?.kind === 'ground') return { x, z, sx: s.x, sy: s.y }; } } } return null; },
  siteScreen(id) { const s = siteById(id); return W.project(V(s.x, 0.1, s.z)); },
  tileScreen(i) { return W.project(W.tileWorld(i)); },
  iconScreen(i) { return W.tiles[i].icon.visible ? W.project(W.iconWorld(i)) : null; },
  objScreen(name) { if (name.startsWith('sign:')) { const [x, z] = SIGNS[name.slice(5)]; return W.project(V(x, 1.0, z)); } if (name.startsWith('tag:')) { const [x, z] = SIGNS[name.slice(4)]; return W.project(V(x, 2.75, z)); } const [x, z] = SPOTS[name]; return W.project(V(x, 1.2, z)); },
  carScreen() { const c = customer?.car; return c ? W.project(c.group.position.clone().setY(0.7)) : null; },
  nextCustomerIn(ms) { nextCust = now() + ms; }, spawnCustomer,
  grant(o) { for (const [k, v] of Object.entries(o)) { if (['coins', 'wood', 'jewels', 'scrap'].includes(k)) S[k] += v; else if (FINDS[k]) S.finds[k] = (S.finds[k] || 0) + v; else S.inv[k] += v; } save(); hud(); if (panel) renderPanel(); },
  tapObstacle, buildBed, enterBuild, exitBuild, selectTile, plant, water, harvest, openPanel, closePanel, buyPack, buy, stock, buyLot,
  buildStand, buildRack, startMarket, finishMarket, restore, recycle, collectLoot, enterPlace, placeAt, dropFor,
  camera(az, pol, zoom, tx, tz) { if (az != null) W.ctl.az = az; if (pol != null) W.ctl.pol = pol; if (zoom != null) W.ctl.zoom = zoom; if (tx != null) { W.ctl.target.set(tx, 0.3, tz); W.ctl.moved = true; } W.ctl.glide = null; W.updateCamera(); },
  Ads, get adsOn() { return Ads.enabled; },
  dismissTip() { clearTimeout(tipTimer); tipQueue.length = 0; $('#tip').classList.add('hidden'); },
};
