// Petalspire v0.51 — game logic + UI (v0.5: the full 21-plant catalog · v0.51: feature cards use the plant tier names)
import * as THREE from 'three';
import { createWorld } from './world.js';
import { buildPlant } from './plants.js';
import { SPECIES, FANTASY_SPECIES, PLANT_TIERS, cardTier, FEATURE_TIER_FROM_OLD, TIER_ORDER, PACK_W, DRYING, rollSeeds, FEATURES, CARDS, RARITY, ITEMS, SELL_ORDER, TIPS, RESALE, PACKS, PACK_JEWELS, JEWEL_EXCHANGE, JEWEL_DROP, PARKING, BILLBOARD, WINDMILL, DUP_COINS, CARD_LEVELS, RACK_SLOTS, DRY_S, BARREL, BASES, TINCTURE, STILL, oilId, tinctureId, TINCTURE_NAMES,
  WOOD, BED_COSTS, STAND_CAP, MARKET_GOAL, WATER_REGEN_S, WATER_REGEN_MAX, STARTER, STARTER_FILL, STARTER_JEWELS,
  BUILDS, FINDS, FIND_IDS, FIND_CHANCE, SAPLING_CHANCE, RESTORE_HURRY_JEWELS, ATMOS_STEP, ATMOS_MAX, TREE, SHOP, JEWEL_BUNDLES, NO_ADS_BUNDLE, ADS, ADS_MODE, OTHER_GAMES, SHADE } from './data.js';
import { LOTS, SIGNS, LOT_FOR_SALE, LOT_PRICES, SITES, OBSTACLES, SPOTS, PARK_X, BED_N, TILE, SITE_HALF, siteById, obstacleById, inSite, lotCenter, lotAt } from './layout.js';
import { ICONS, itemIcon, FEATURE_ART, findIcon, decorIcon } from './icons.js';
import { Payments } from './payments.js';
import { createAds, gameArt } from './ads.js';
import { shadeAt, speedFor, sunLabel, rebaseStart } from './shade.js';

// Save format: v0.3, v0.31 and v0.4 share one localStorage key (schema v: 3). `build` records which prototype build last wrote the save;
// v0.3 / v0.31 saves (no `build`, no per-plot barrels) are migrated on load (migrate04 below); v0.4 saves load as-is and are re-tagged. Prototype builds stay below 1.0.
export const BUILD = '0.51';
const SAVE_KEY = 'petalspire.v03', V02_KEY = 'petalspire.v02', OLD_KEYS = ['petalspire.v01'];
const QS = new URLSearchParams(location.search);
const TREE_MS = Math.max(0.05, +QS.get('treeMin') || TREE.growMin) * 60000;   // ?treeMin=1 for quick testing
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const now = () => Date.now();
const fillIcons = (root = document) => root.querySelectorAll('i[data-icon]').forEach((i) => { if (!i.firstChild) i.innerHTML = ICONS[i.dataset.icon] || ''; });
const jewelPrice = (n) => `<span class="price"><i data-icon="jewel"></i>${n}</span>`;
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
    v: 3, build: BUILD, coins: 10, wood: 0, jewels: 0, scrap: 0,
    // v0.5: one slot for every plant item (seeds, flowers, dried, tinctures, oils), generated from the catalog
    inv: { ...Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])), water: 0, sapling: 0, glycerin: 0, vinegar: 0 },
    unlocked: { ...Object.fromEntries(Object.keys(SPECIES).map((k) => [k, false])), lavender: true, calendula: true, rainbarrel: false, beehive: false, sundial: false },
    owned: { beehive: false, sundial: false, tincture: false, still: false, sickle: false, plow: false, parking: false, billboard: false, windmill: false }, toolAt: {},
    cards: {},   // v0.4: card stacks { id: { n: copies, lv } }
    hives: {}, hiveInv: 0,   // v0.4: placeable Honeybee Skeps, one per plot ({ lot: { x, z } }); the boost only reaches beds on that plot
    discovered: {},
    lots: { home: true }, lotsBought: 0, obs: {}, beds: [], tiles: [],
    rack: Array(RACK_SLOTS).fill(null),
    stand: {}, starterOpened: false, waterAt: 0,
    // v0.3: things are built, not unlocked
    barrel: false, standBuilt: false, rackAvail: false, rackBuilt: false, marketAvail: false, marketBuilt: false, marketProj: null,
    finds: {}, restoring: [], decorInv: {}, bonus: { can: false, barrow: false, crate: false },
    decor: [], ground: [], trees: [], looted: {}, uid: 1, noAds: false, adRewardAt: 0, irrigN: 0, irrigBeds: [],
    // v0.4: one rain barrel per plot ({ lot: { x, z, w, at } }), Tincture Stand
    barrels: {}, barrelInv: 0, tinctureBuilt: false, tinc: Array(TINCTURE.slots).fill(null), tincBase: 'glycerin',
    stillBuilt: false, stills: Array(STILL.slots).fill(null), stillPos: null,   // v0.41 Essential Oil Stand
    windmillBuilt: false, windmillPos: null,   // v0.41 Windmill (global barrel boost)
    parkingBuilt: false, billboardBuilt: false, bb: { until: 0, readyAt: 0, runs: 0, jewelRuns: 0 },   // v0.41 Parking Lot + Billboard (timestamps, so they keep counting while closed)
    packs: 0, tips: {}, goal: 0, introDone: false,
    stats: { chopped: 0, stumps: 0, harvests: 0, watered: 0, stocked: 0, customers: 0, standEarned: 0, sold: 0,
      cleared: 0, finds: 0, restored: 0, recycled: 0, treesPlanted: 0, grownChopped: 0, jewelsBought: 0, jewelsFound: 0, jewelsTraded: 0, adBreaks: 0, adRewards: 0, irrigated: 0, tinctures: 0, oils: 0 },
  };
}
function mergeState(o) {
  const f = freshState();
  return { ...f, ...o, v: 3, build: BUILD, inv: { ...f.inv, ...o.inv }, stats: { ...f.stats, ...o.stats }, unlocked: { ...f.unlocked, ...o.unlocked }, owned: { ...f.owned, ...o.owned }, bonus: { ...f.bonus, ...o.bonus } };
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
let fromBuild = null, S, migrated = false, upgraded = false, needs04 = false, migrated04 = null, plantsMigrated = false;
// v0.4: real plants only. Old (fantasy) plant ids in a save are mapped to their real replacements everywhere —
// inventory, seeds, flowers, dried goods, tinctures, planted tiles, stand stock, cards, unlocks, goals.
const PLANT_MAP = { heartvine: 'lavender', sunpetal: 'calendula', moonflower: 'chamomile', crystalrose: 'chamomile', crystal_rose: 'chamomile' };
const PLANT_NAME_MAP = { heartvine: 'Lavender', sunpetal: 'Calendula', moonflower: 'Chamomile', crystalrose: 'Chamomile', crystal_rose: 'Chamomile' };
function realPlants(raw) {
  if (!raw || !/heartvine|sunpetal|moonflower|crystal_?rose/i.test(raw)) return raw;
  plantsMigrated = true;
  return raw.replace(/Spiral Sunpetal|Crystal Rose/g, (m) => (m === 'Crystal Rose' ? 'Chamomile' : 'Calendula'))
    .replace(/heartvine|sunpetal|moonflower|crystal_?rose/gi, (m) => (m[0] === m[0].toUpperCase() ? PLANT_NAME_MAP : PLANT_MAP)[m.toLowerCase()]);
}
// v0.5: Moonflower, Spiral Sunpetal and Crystal Rose are real catalog plants again (Other World tier), so the old-id
// mapping only runs on saves written BEFORE v0.5 (no build, or build < 0.5). v0.5+ saves are loaded untouched.
const preCatalog = (raw) => { if (!raw) return false; const m = /"build":"([^"]*)"/.exec(raw); return !m || !(parseFloat(m[1]) >= 0.5); };
try { const raw = localStorage.getItem(SAVE_KEY); S = JSON.parse(preCatalog(raw) ? realPlants(raw) : raw); } catch { S = null; }
if (!S || S.v !== 3) {
  let old = null; try { old = JSON.parse(realPlants(localStorage.getItem(V02_KEY))); } catch {}
  if (old && old.v === 2) { S = migrate02(old); upgraded = true; needs04 = true; }
  else { S = freshState(); for (const k of OLD_KEYS) if (localStorage.getItem(k)) { migrated = true; localStorage.removeItem(k); } }
} else { fromBuild = S.build || (S.barrels ? '0.4-dev' : S.irrigBeds ? '0.31' : '0.3'); needs04 = !S.barrels; S = mergeState(S); }
let saveTimer = 0;
let frozen = false;
const writeSave = () => { if (frozen) return; try { S.savedAt = now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} };
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeSave, 150); }
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
// v0.41 Windmill: every connected barrel refills faster (60 → 40 s at Lv1, 36/33/30 s at Lv2–4); multiplies with the Brass Watering Can (×½)
const windK = () => (S.windmillBuilt ? WINDMILL.regenS[Math.min(WINDMILL.regenS.length, S.cards.windmill?.lv || 1) - 1] / WATER_REGEN_S : 1);
const regenS = () => (S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S) * windK(), regenMax = () => (S.bonus.can ? 15 : WATER_REGEN_MAX);
const atmosphere = () => S.decor.reduce((a, d) => a + (Object.values(FINDS).find((f) => f.into.decor === d.type)?.into.atm || 0), 0);
const atmosMult = () => Math.max(1 - ATMOS_MAX, 1 - ATMOS_STEP * atmosphere());
const DECOR_INFO = Object.fromEntries(Object.entries(FINDS).filter(([, f]) => f.into.decor).map(([k, f]) => [f.into.decor, { name: f.into.name, atm: f.into.atm, from: k }]));
const treeStage = (t) => { if (t.st === 'stump') return 3; const k = Math.min(1, (now() - t.at) / t.ms); return k >= 1 ? 3 : k >= TREE.stageAt[2] ? 2 : k >= TREE.stageAt[1] ? 1 : 0; };
const treeById = (id) => S.trees.find((t) => t.id === id);
const marketK = () => (S.marketProj ? Math.min(1, (now() - S.marketProj.start) / S.marketProj.ms) : 0);

// ---------------- v0.31: irrigation (one card per raised bed; waters thirsty plants from barrel water) ----------------
const bedOfTile = (i) => S.beds[Math.floor(i / PER_BED)];
const irrigFree = () => S.irrigN - S.irrigBeds.length;
const irrigTiles = () => { const out = []; S.beds.forEach((id, b) => { if (S.irrigBeds.includes(id)) for (let k = 0; k < PER_BED; k++) out.push(b * PER_BED + k); }); return out; };
const thirstyIrrig = () => irrigTiles().filter((i) => S.tiles[i] && !S.tiles[i].wateredAt);
// v0.4: each plot has its own rain barrel. Irrigated beds drink only from their own plot's barrel; a barrel feeds at most BARREL.maxBeds beds.
const lotOfSite = (id) => siteById(id)?.lot;
const barrelBeds = (lot) => S.irrigBeds.filter((id) => lotOfSite(id) === lot);
const barrelOf = (siteId) => S.barrels[lotOfSite(siteId)];
const barrelXZ = (lot) => { const b = S.barrels[lot]; return [b.x, b.z]; };
const totalWater = () => Object.values(S.barrels).reduce((a, b) => a + b.w, 0);   // v0.4: water only lives in rain barrels
const lotName = (lot) => (lot === 'home' ? 'Home plot' : LOTS[lot].name);
const clock = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const barrelLeft = (b) => Math.max(0, b.at + regenS() * 1000 - now());
const barrelText = (lot, withWm = false) => { const b = S.barrels[lot], max = regenMax(); if (!barrelRoof(lot)) return `${b.w}/${max} · ${NOT_COLLECTING}`; const wm = S.windmillBuilt && withWm ? ' · Windmill: faster refill' : ''; return b.w >= max ? `${b.w}/${max} · Full${wm}` : `${b.w}/${max} · next in ${clock(barrelLeft(b))}${wm}`; };
function takeFromBarrel(b) { if (b.w >= regenMax()) b.at = now(); b.w--; }
// Hand watering (v0.4 rule): the bed's own plot barrel first, then the nearest other barrel with water.
function handSource(i) {
  const lot = lotOfSite(bedOfTile(i)), own = S.barrels[lot];
  if (own && own.w > 0) return { b: own, lot };
  const xz = tileXZ(i) || [0, 0]; let best = null, bd = Infinity;
  for (const [l, b] of Object.entries(S.barrels)) if (b.w > 0) { const d = Math.hypot(b.x - xz[0], b.z - xz[1]); if (d < bd) { bd = d; best = { b, lot: l }; } }
  return best;
}
// v0.41: a barrel only collects rain through a gutter from a roof on the SAME plot. Connection is automatic: any roofed
// building on that plot (Farm Stand, Supply Market — even boarded up —, Tincture Stand, Essential Oil Stand). The Home
// barrel uses the Farm Stand once built, and the Market roof before that, so the starter barrel always works.
const ROOF_NAMES = { stand: 'Farm Stand', market: 'Supply Market', tincture: 'Tincture Stand', still: 'Essential Oil Stand' };
function lotRoofs(lot) {
  const out = [];
  if (lot === 'home') { if (S.standBuilt) out.push('stand'); out.push('market'); }
  if (S.tinctureBuilt && (S.tincPos?.lot || 'home') === lot) out.push('tincture');
  if (S.stillBuilt && S.stillPos?.lot === lot) out.push('still');
  return out;
}
function barrelRoof(lot) {
  const b = S.barrels[lot]; if (!b) return null; const rs = lotRoofs(lot); if (!rs.length) return null;
  if (rs.includes('stand')) return 'stand';
  return rs.sort((p, q) => Math.hypot(SPOTS[p][0] - b.x, SPOTS[p][1] - b.z) - Math.hypot(SPOTS[q][0] - b.x, SPOTS[q][1] - b.z))[0];
}
const NOT_COLLECTING = 'Not collecting: connect to a stand on this plot';
function regenBarrels() {
  let ch = false; const rs = regenS() * 1000, max = regenMax();
  for (const [lot, b] of Object.entries(S.barrels)) {
    if (!barrelRoof(lot)) { b.at = now(); continue; }   // no gutter, no rain: the countdown is frozen
    if (b.w >= max) { b.at = now(); continue; }
    const n = Math.floor((now() - b.at) / rs);
    if (n > 0) { b.w = Math.min(max, b.w + n); b.at += n * rs; if (b.w >= max) b.at = now(); ch = true; }
  }
  return ch;
}
function autoIrrigate() { if (!S.irrigBeds.length) return; for (const i of thirstyIrrig()) { const b = barrelOf(bedOfTile(i)); if (b && b.w > 0) water(i, true); } }
// Offline: per plot, each thirsty irrigated plant gets watered at the moment its barrel had (or regained) a drop for it.
function catchUpIrrigation() {
  if (!S.irrigBeds.length) return;
  const t0 = S.savedAt || now(), end = now(), rs = regenS() * 1000, max = regenMax();
  const sundial = S.owned.sundial ? 0.75 : 1;
  const give = (i, at) => { const p = S.tiles[i]; p.wateredAt = at; p.baseMs = SPECIES[p.sp].growS * 1000 * sundial * growK(p.sp); p.sun = 1; p.growMs = p.baseMs; p.irrigated = true; S.stats.watered++; S.stats.irrigated = (S.stats.irrigated || 0) + 1; };
  for (const [lot, b] of Object.entries(S.barrels)) {
    const q = thirstyIrrig().filter((i) => lotOfSite(bedOfTile(i)) === lot); if (!q.length) continue;
    let w = b.w, wAt = w >= max ? t0 : b.at || t0;
    while (q.length && w > 0) { give(q.shift(), t0); w--; }
    if (q.length && w < max && barrelRoof(lot)) { let next = wAt + rs; while (q.length && next <= end) { give(q.shift(), next); wAt = next; next += rs; } }
    b.w = w; b.at = wAt;   // regenBarrels() in tick() adds whatever is left over
  }
}
function assignIrrigation(siteId) {
  if (!S.beds.includes(siteId)) return false;
  if (S.irrigBeds.includes(siteId)) { toast('This bed is already irrigated'); return false; }
  if (irrigFree() <= 0) { toast('Every Irrigation card is in use — buy another in the Supply Market'); return false; }
  const lot = lotOfSite(siteId), b = S.barrels[lot];
  if (!b) { toast(`${lotName(lot)} has no rain barrel yet — buy a Rain Barrel at the Supply Market and place it there`); tip('plotbarrel'); return false; }
  if (barrelBeds(lot).length >= BARREL.maxBeds) { toast(`This barrel already feeds ${BARREL.maxBeds} beds. Build another plot's barrel or unhook a bed`); return false; }
  S.irrigBeds.push(siteId); W.setIrrigation(siteId, true, barrelXZ(lot)); W.irrigPulse(siteId);
  const s = siteById(siteId); popAt(V3(s.x, 1.4, s.z), `<i data-icon="water"></i>Irrigated! ${barrelBeds(lot).length}/${BARREL.maxBeds} on this barrel`);
  save(); autoIrrigate(); return true;
}
function unhookIrrigation(siteId) {
  const k = S.irrigBeds.indexOf(siteId); if (k < 0) return false;
  S.irrigBeds.splice(k, 1); W.setIrrigation(siteId, false);
  toast('Bed unhooked · the Irrigation card is spare again'); save(); if (selected != null || focus) renderSheet(); if (panel) renderPanel(); return true;
}
// v0.3/v0.31 -> v0.4: the single barrel becomes the home plot's barrel; irrigation outside home (or past the cap) is unhooked.
function migrate04() {
  S.barrels = {}; let moved = 0;
  if (S.barrel) S.barrels.home = { x: SPOTS.barrel[0], z: SPOTS.barrel[1], w: 0, at: S.waterAt || now() };
  const keep = [], drop = [];
  for (const id of S.irrigBeds) { const lot = lotOfSite(id); if (lot === 'home' && S.barrels.home && keep.length < BARREL.maxBeds) keep.push(id); else drop.push(id); }
  S.irrigBeds = keep; const p = pourBagWater(); migrated04 = { moved: p.moved, lost: p.lost, dropped: drop.length };
}
// v0.4: water is no longer kept in the bag. Any banked bag water is poured into the home barrel (up to its cap); the rest is lost.
function pourBagWater() {
  const h = S.barrels.home, bag = S.inv.water || 0; if (!h || !bag) return { moved: 0, lost: 0 };
  const max = regenMax(), moved = Math.max(0, Math.min(bag, max - h.w)); h.w += moved; if (h.w >= max) h.at = now(); S.inv.water = 0; return { moved, lost: bag - moved };
}
if (needs04) migrate04();
if (upgraded || needs04 || plantsMigrated || (fromBuild && fromBuild !== BUILD)) writeSave();   // v0.4: also write the real-plant-mapped save straight away
const irrigHTML = () => {
  if (!S.irrigN && !S.unlocked.irrigation) return '';
  return `<div class="row irrig-row"><button class="ico" data-card="irrigation" aria-label="Irrigation card">${FEATURE_ART.irrigation}</button><div class="meta"><b>Irrigation ×${S.irrigN}</b><small>${S.irrigBeds.length} of ${S.irrigN} bed${S.irrigN === 1 ? '' : 's'} covered · each uses its plot’s barrel (max ${BARREL.maxBeds} beds per barrel)${S.irrigN ? '' : ' · buy cards in the Supply Market'}</small></div>${irrigFree() > 0 && S.beds.length > S.irrigBeds.length ? `<div class="acts"><button class="btn btn-primary sm" data-act="assign-irrig">Assign</button></div>` : ''}</div>`;
};

// ---------------- v0.31: shade slows growth ----------------
// Plants keep their full-sun duration in baseMs and the sun they last saw in .sun; growMs / tree.ms are baseMs / speed.
// When shade changes we keep the current progress and stretch/shrink the remaining time (rebase), so the
// timestamp formula (now − start) / ms still works for offline catch-up.
const treeStageAt = (t, at) => { if (t.st === 'stump') return 3; const k = Math.min(1, (at - t.at) / t.ms); return k >= 1 ? 3 : k >= TREE.stageAt[2] ? 2 : k >= TREE.stageAt[1] ? 1 : 0; };
function tileXZ(i) { const s = siteById(S.beds[Math.floor(i / PER_BED)]); if (!s) return null; const k = i % PER_BED, off = (BED_N - 1) / 2; return [s.x + (k % BED_N - off) * TILE, s.z + (Math.floor(k / BED_N) - off) * TILE]; }
let bgCasters = [];
function casters(at = now()) {
  const out = [];
  for (const o of OBSTACLES) if (o.type === 'tree' && obsState(o.id) === 'full') out.push({ id: o.id, x: o.x, z: o.z, w: SHADE.tree.w * o.s, reach: SHADE.tree.reach * o.s });
  for (const t of S.trees) if (t.st === 'full') { const f = SHADE.grownStage[treeStageAt(t, at)]; out.push({ id: t.id, x: t.x, z: t.z, w: SHADE.tree.w * 1.08 * f, reach: SHADE.tree.reach * 1.08 * (0.4 + 0.6 * f) }); }
  const B = SHADE.buildings, add = (k) => out.push({ id: 'b:' + k, x: SPOTS[k][0], z: SPOTS[k][1], w: B[k].w, reach: B[k].reach });
  add('market'); if (S.standBuilt) add('stand'); if (S.rackBuilt) add('rack'); if (S.tinctureBuilt) add('tincture'); if (S.stillBuilt) add('still');
  return out.concat(bgCasters);
}
const sunAtXZ = (x, z, cs, exclude) => 1 - shadeAt(x, z, exclude ? cs.filter((c) => c.id !== exclude) : cs);
const tileSun = [];
function siteSun(id, cs = casters()) { const s = siteById(id), off = (BED_N - 1) / 2; let a = 0; for (let k = 0; k < PER_BED; k++) a += sunAtXZ(s.x + (k % BED_N - off) * TILE, s.z + (Math.floor(k / BED_N) - off) * TILE, cs); return a / PER_BED; }
function normalizeGrowth() {   // v0.3 saves: what was there grew in full sun until now
  for (const p of S.tiles) if (p && p.wateredAt && p.baseMs == null) { p.baseMs = p.growMs; p.sun = 1; }
  for (const t of S.trees) if (t.baseMs == null) { t.baseMs = t.ms; t.sun = 1; }
}
let worldReady = false, shadeSig = '';
function applyShade(at = now()) {
  const cs = casters(at); let changed = false;
  for (let i = 0; i < S.tiles.length; i++) {
    const xz = tileXZ(i); if (!xz) continue; const sun = sunAtXZ(xz[0], xz[1], cs); tileSun[i] = sun;
    if (worldReady) W.setShade(i, 1 - sun);
    const p = S.tiles[i];
    if (p && p.wateredAt && Math.abs((p.sun ?? 1) - sun) > 0.002 && (at - p.wateredAt) < p.growMs) {
      const ms = p.baseMs / speedFor(sun); p.wateredAt = rebaseStart(p.wateredAt, p.growMs, ms, at); p.growMs = ms; p.sun = sun; changed = true;
    } else if (p && p.wateredAt) p.sun = sun;
  }
  for (const t of S.trees) {
    if (t.st !== 'full') continue; const sun = sunAtXZ(t.x, t.z, cs, t.id);
    if (Math.abs((t.sun ?? 1) - sun) > 0.002 && (at - t.at) < t.ms) { const ms = t.baseMs / speedFor(sun); t.at = rebaseStart(t.at, t.ms, ms, at); t.ms = ms; changed = true; }
    t.sun = sun;
  }
  return changed;
}
function catchUpShade() {   // offline: re-apply shade each time a planted tree grew a stage while the game was closed
  normalizeGrowth();
  let cur = S.savedAt || now(); const end = now();
  for (let n = 0; n < 400; n++) {
    let next = Infinity;
    for (const t of S.trees) if (t.st === 'full') for (const f of TREE.stageAt.slice(1)) { const te = t.at + t.ms * f + 1; if (te > cur && te < next) next = te; }
    if (next > end) break; applyShade(next); cur = next;
  }
  applyShade(end);
}
const shadeSignature = () => `${S.beds.length}|${S.standBuilt}|${S.rackBuilt}|${S.tinctureBuilt}|${S.stillBuilt}|${OBSTACLES.filter((o) => o.type === 'tree' && obsState(o.id) === 'full').length}|${S.trees.map((t) => t.id + (t.st === 'full' ? treeStageAt(t, now()) : 's')).join(',')}`;
function refreshShade(force = false) {
  const sig = shadeSignature(); if (!force && sig === shadeSig) return; shadeSig = sig;
  applyShade(); save(); if (selected != null || focus) renderSheet();
}
const irrigLine = (i) => { const bed = bedOfTile(i); if (!S.irrigBeds.includes(bed)) return ''; const p = S.tiles[i], lot = lotOfSite(bed), b = S.barrels[lot];
  const paused = p && !p.wateredAt && (!b || b.w <= 0);
  return `<p class="irrig-line${paused ? ' paused' : ''}"><i data-icon="water"></i> <span>${paused ? `Irrigation paused · this plot’s barrel is empty, ${b && !barrelRoof(lot) ? 'and it isn’t collecting (connect it to a stand on this plot)' : `next water in ${clock(b ? barrelLeft(b) : 0)}`}` : `Irrigated · drinks from the ${lotName(lot)} barrel (${barrelBeds(lot).length}/${BARREL.maxBeds})`}</span> <button class="btn sm" data-unhook="${bed}">Unhook</button></p>`; };
const sunHTML = (sun, extra = '') => { const L = sunLabel(sun); return `<p class="sun-line ${sun < SHADE.slowerBelow ? 'shady' : 'sunny'}" data-sun="${L.pct}"><i data-icon="sun"></i> ${L.text}${sun < SHADE.slowerBelow ? ` <small>(${Math.round(L.speed * 100)}% speed)</small>` : ''}${extra}</p>`; };

// ---------------- World ----------------
const building = {};   // structures whose build animation is playing
const W = createWorld($('#scene'));
W.makeBlueprint(W.stand, 'stand', `Blueprint · ${BUILDS.stand.wood} Wood`, 2.6, 1.7);
W.makeBlueprint(W.rack, 'rack', `Blueprint · ${BUILDS.rack.wood} Wood`, 2.0, 1.5);
// v0.41: the Tincture Stand is placed by the player on a bought neighbouring plot. A stand built before v0.41 on the
// Roadside Lot is grandfathered where it is (it keeps working; nothing moves, no flask is lost).
let tincGrandfathered = false;
if (S.tinctureBuilt && !S.tincPos) { S.tincPos = { x: SPOTS.tincture[0], z: SPOTS.tincture[1], lot: 'home', legacy: true }; tincGrandfathered = true; writeSave(); }
if (S.tincPos) { SPOTS.tincture = [S.tincPos.x, S.tincPos.z]; W.tincture.position.set(S.tincPos.x, 0, S.tincPos.z); }
if (!Array.isArray(S.stills) || S.stills.length !== STILL.slots) S.stills = Array(STILL.slots).fill(null);
if (S.stillPos) { SPOTS.still = [S.stillPos.x, S.stillPos.z]; W.still.position.set(S.stillPos.x, 0, S.stillPos.z); }
W.makeBlueprint(W.tincture, 'tincture', `Blueprint · ${BUILDS.tincture.wood} Wood`, 2.2, 1.4);
for (const o of OBSTACLES) W.setObstacle(o.id, obsState(o.id));
for (const id of LOT_FOR_SALE) W.setLotOwned(id, !!S.lots[id]);
S.beds.forEach((id) => W.addBed(id, false));
while (S.tiles.length < S.beds.length * PER_BED) S.tiles.push(null);
if (S.standBuilt) W.appear(W.stand, false);
for (const [lot, b] of Object.entries(S.barrels)) { if (lot === 'home') W.appear(W.barrel, false); else W.addBarrel(lot, b.x, b.z, false); }
// v0.4: the Honeybee Skep used to boost every harvest everywhere. An old global hive becomes a placed hive on the home plot.
let hiveMigrated = false;
// v0.4: card stacks — every card already discovered becomes a stack of 1 at Lv1 (extra Irrigation cards already owned count as copies).
if (!Object.keys(S.cards).length) { for (const id of Object.keys(CARDS)) if (S.discovered[id]) S.cards[id] = { n: id === 'irrigation' ? Math.max(1, S.irrigN || 0) : 1, lv: 1 }; }
if (S.owned.beehive && !S.hivesSold && !Object.keys(S.hives).length && !(S.hiveInv > 0)) { const sp = freeSpot('home', S.barrels.home); if (sp) { S.hives.home = sp; hiveMigrated = true; } else S.hiveInv = 1; writeSave(); }
for (const [lot, h] of Object.entries(S.hives)) W.addHive(lot, h.x, h.z, false);
if (S.tinctureBuilt) W.appear(W.tincture, false);
if (S.stillBuilt && S.stillPos) W.appear(W.still, false);
if (S.windmillPos) { SPOTS.windmill = [S.windmillPos.x, S.windmillPos.z]; W.windmill.position.set(S.windmillPos.x, 0, S.windmillPos.z); if (S.windmillBuilt) W.appear(W.windmill, false); }
setTimeout(() => { if (S.parkingBuilt) { W.setParking(parkCap()); W.appear(W.parking, false); } if (S.billboardBuilt) { W.appear(W.billboard, false); syncBillboard(); } }, 0);   // after the traffic helpers are defined
if (S.rackBuilt) W.appear(W.rack, false);
syncMarket();
for (const g of S.ground) W.addLoot(g.key, g.kind, g.x, g.z, false);
for (const d of S.decor) W.addDecor(d.key, d.type, d.x, d.z, d.r || 0, false);
for (const t of S.trees) W.addGrown(t.id, t.x, t.z, treeStage(t), t.st === 'stump' ? 'stump' : 'full');
syncBlueprints();
function syncBlueprints() {
  W.setBlueprint('stand', S.beds.length > 0 && !S.standBuilt && !building.stand);
  W.setBlueprint('rack', S.rackAvail && !S.rackBuilt && !building.rack);
  W.setBlueprint('tincture', false);   // v0.41: no fixed blueprint — the player picks the spot
}
function syncMarket() { W.setMarketState(S.marketBuilt ? 'open' : S.marketProj ? 'building' : 'closed', marketK()); }
const lastStage = [];
function syncTile(i, pop = true) {
  const p = S.tiles[i];
  if (!p) { W.setPlant(i, null, 0, false); W.setIcon(i, null); lastStage[i] = null; return; }
  if (p.hold && now() - p.plantedAt < 3000) return;   // v0.4: the plow reveals seedlings as its furrow passes
  const st = stageOf(p);
  if (W.setPlant(i, p.sp, st, !!p.wateredAt)) W.attachPlant(i, buildPlant(p.sp, st), pop);
  W.setIcon(i, !p.wateredAt ? 'water' : st === 3 ? 'ready' : null);
  if (lastStage[i] != null && lastStage[i] !== st && st === 3) onBloom(i);
  lastStage[i] = st;
}
function syncStill() { W.setStill(S.stills.map((t) => t && { done: now() - t.start >= t.ms })); }
function syncTinc() { W.setTincture(S.tinc.map((t) => t && { base: t.base, done: now() - t.start >= t.ms })); }
function syncBarrels() {
  for (const [lot, b] of Object.entries(S.barrels)) { const roof = barrelRoof(lot); W.setGutter(lot, roof ? SPOTS[roof] : null);
    if (roof) W.setBarrelInfo(lot, barrelText(lot, false), S.windmillBuilt ? `Windmill: faster refill · ${barrelBeds(lot).length}/${BARREL.maxBeds} beds` : `Feeds ${barrelBeds(lot).length}/${BARREL.maxBeds} beds`, b.w >= regenMax(), b.w / regenMax());
    else W.setBarrelInfo(lot, `${b.w}/${regenMax()} · Not collecting`, 'Connect to a stand on this plot', false, b.w / regenMax()); }
}
function syncRack() { W.setRack(S.rack.map((r) => r && { done: now() - r.start >= r.ms })); }
// v0.5: the stand's three crates show any plant goods — plants cycle through the heart / sun / moon crates in catalog
// order (Lavender → heart, Calendula → sun, Chamomile → moon, exactly as before; then Peppermint → heart, …).
const SP_IDX = Object.fromEntries(Object.keys(SPECIES).map((k, i) => [k, i]));
function syncStand() {
  const box = { heart: 0, sun: 0, moon: 0 }, names = ['heart', 'sun', 'moon'];
  for (const [id, n] of Object.entries(S.stand)) { if (!n) continue; const m = /^(seed|flower|dried)_(.+)$/.exec(id); if (!m || SP_IDX[m[2]] == null) continue;
    box[names[SP_IDX[m[2]] % 3]] += n; if (id === 'dried_lavender') box.moon += n; }
  W.setStandStock(box);
}
bgCasters = W.bgTrees.map((b, n) => ({ id: 'bg' + n, x: b.x, z: b.z, w: SHADE.bgTree.w * b.s, reach: SHADE.bgTree.reach * b.s }));
catchUpIrrigation(); catchUpShade(); worldReady = true; applyShade(); shadeSig = shadeSignature();
for (const id of S.irrigBeds) W.setIrrigation(id, true, barrelXZ(lotOfSite(id)));
for (let i = 0; i < S.tiles.length; i++) syncTile(i, false);
syncRack(); syncStand(); syncTinc(); syncStill(); syncBarrels(); setTimeout(syncBees, 0);   // after the module has defined the bee helpers
document.fonts?.ready.then(() => W.relabel());

// ---------------- HUD ----------------
const shown = { coins: S.coins, wood: S.wood, water: totalWater(), jewels: S.jewels };
function bump(id) { const p = $(id); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
function hud() {
  $('#coin-count').textContent = S.coins; const tw = totalWater(); $('#water-count').textContent = tw; $('#wood-count').textContent = S.wood; $('#jewel-count').textContent = S.jewels;
  if (S.coins !== shown.coins) { bump('#pill-coins'); shown.coins = S.coins; }
  if (S.wood !== shown.wood) { bump('#pill-wood'); shown.wood = S.wood; }
  if (tw !== shown.water) { bump('#pill-water'); shown.water = tw; }
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
  renderGoal(); syncTools();
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
  { id: 'plotbarrel', text: 'Give a bought plot its own Rain Barrel', n: () => Object.keys(S.barrels).filter((l) => l !== 'home').length, of: 1, icon: 'water', hint: 'plotbarrel' },
  { id: 'tincture', text: 'Make a tincture', n: () => S.stats.tinctures || 0, of: 1, icon: 'sparkle', hint: 'tincture' },
  { id: 'pack', text: 'Open a Card Pack (1 Jewel)', n: () => S.packs || 0, of: 1, icon: 'sparkle', hint: 'packs' },
  { id: 'oil', text: 'Distill an essential oil', n: () => S.stats.oils || 0, of: 1, icon: 'sparkle', hint: 'oils' },
];
function checkGoals(silent = false) {
  if (!S.marketAvail && S.stats.standEarned >= MARKET_GOAL) {
    S.marketAvail = true; save();
    if (!silent) { toast('<i data-icon="market"></i> New project: Rebuild the Supply Market'); setTimeout(() => tip('rebuild'), 900); }
  }
  while (S.goal < GOALS.length && GOALS[S.goal].n() >= GOALS[S.goal].of) {
    const g = GOALS[S.goal]; S.goal++; save();
    if (silent) continue;
    const card = $('#goal'); card.classList.remove('done'); void card.offsetWidth; card.classList.add('done'); goalPeek(4500);
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
  if (!g) { G.innerHTML = `<i data-icon="flag"></i><span class="gp">${GOALS.length}/${GOALS.length} ✓</span><div class="gfull"><b>All goals done</b><small>Keep growing — expand into the woods!</small></div>`; fillIcons(G); return; }
  const n = Math.min(g.n(), g.of);
  G.innerHTML = `<i data-icon="${g.icon}"></i><span class="gp">${S.goal + 1}/${GOALS.length}${g.of > 1 ? `<em class="gpbar"><em style="width:${(n / g.of) * 100}%"></em></em>` : ''}</span><div class="gfull"><small>Goal ${S.goal + 1} of ${GOALS.length}</small><b>${g.text}</b>${g.of > 1 ? `<span class="gbar"><em style="width:${(n / g.of) * 100}%"></em></span><small class="gn">${n} / ${g.of}</small>` : ''}<button class="g-hint" type="button">Hint</button></div>`;
  fillIcons(G);
}
// v0.41: the goal tracker is a small pill; tap to expand, it collapses on the next tap or after a few seconds
let goalTimer = 0;
function goalCollapse() { clearTimeout(goalTimer); $('#goal').classList.add('collapsed'); }
function goalPeek(ms = 5000) { if (document.body.classList.contains('modal-open')) return; const G = $('#goal'); G.classList.remove('collapsed'); clearTimeout(goalTimer); goalTimer = setTimeout(goalCollapse, ms); }
$('#goal').classList.add('collapsed');
$('#goal').addEventListener('click', (e) => {
  const G = $('#goal');
  if (e.target.closest('.g-hint')) { const g = GOALS[S.goal]; if (g) { delete S.tips[g.hint]; tip(g.hint); } goalCollapse(); return; }
  if (G.classList.contains('collapsed')) goalPeek(5000); else goalCollapse();
});
// v0.41: floating HUD items (tool dock, goal pill, speech bubbles) step aside while any menu, sheet or overlay is open
function syncOverlay() {
  const vis = (q) => { const e = $(q); return !!e && !e.classList.contains('hidden'); };
  const open = vis('#panel') || vis('#confirm') || vis('#reveal') || vis('#tile-sheet') || !!document.querySelector('#ui > .ad-break, #ui > .zoom');
  if (document.body.classList.contains('modal-open') !== open) document.body.classList.toggle('modal-open', open);
  if (open && !$('#goal').classList.contains('collapsed')) goalCollapse();
}
new MutationObserver(syncOverlay).observe($('#ui'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

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
  if (!drop && Math.random() < JEWEL_DROP.clear) { S.jewels++; S.stats.jewelsFound = (S.stats.jewelsFound || 0) + 1; setTimeout(() => { popAt(at.clone().setY(1.4), '<i data-icon="jewel"></i>+1 Jewel'); toast('A Jewel was hiding here! +1 Jewel — spend it on a Card Pack'); hud(); }, 1000); }
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
  const sun = sunAtXZ(x, z, casters()), ms = TREE_MS / speedFor(sun);
  S.inv.sapling--; S.trees.push({ id, x, z, at: now(), ms, baseMs: TREE_MS, sun, st: 'full' }); S.stats.treesPlanted++;
  W.addGrown(id, x, z, 0, 'full'); W.poof(V3(x, 0.3, z), '#8C6545', 10, 0.8); W.poof(V3(x, 0.6, z), '#B7D4B5', 10, 0.9, true);
  popAt(V3(x, 1.2, z), `<i data-icon="sapling"></i>Planted! Sun ${Math.round(sun * 100)}% · mature in ${fmtTime(ms)}`);
  refreshShade(true);
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
  for (const b of Object.values(S.barrels || {})) if (Math.hypot(b.x - x, b.z - z) < 1.0) return 'Too close to a rain barrel';
  for (const b of Object.values(S.hives || {})) if (Math.hypot(b.x - x, b.z - z) < 1.0) return 'Too close to a beehive';
  return null;
}
function enterPlace(what, type) {
  if (what === 'sapling' && !(S.inv.sapling > 0)) { toast('You have no saplings — find them while clearing, or buy one at the market'); return; }
  if (what === 'decor' && !(S.decorInv[type] > 0)) return;
  if (what === 'irrigation') { if (irrigFree() <= 0) { toast('No spare Irrigation card'); return; } closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Irrigation</b> · tap a raised bed to run a drip line to it (${irrigFree()} card${irrigFree() > 1 ? 's' : ''} free)`; $('#buildbar').classList.remove('hidden'); return; }
  if (what === 'hive') { const need = hiveLots(); if (!need.length) { toast('Every plot you own already has a beehive (one per plot)'); return; } if (!(S.hiveInv > 0)) { toast(`Buy a Honeybee Skep at the Supply Market first (${FEATURES.beehive.price} coins)`); return; }
    closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Honeybee Skep</b> · tap clear ground (not a bed) in ${need.map(lotName).join(' or ')} · its bees only help that plot`; $('#buildbar').classList.remove('hidden'); return; }
  if (what === 'windmill') { if (S.windmillBuilt || !S.owned.windmill) return; if (S.wood < BUILDS.windmill.wood) { toast(`The Windmill needs ${BUILDS.windmill.wood} Wood`); return; }
    closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Windmill</b> · tap clear ground anywhere on your land (not a bed) · it speeds up every connected rain barrel`; $('#buildbar').classList.remove('hidden'); return; }
  if (what === 'barrel') { const need = barrelLots(); if (!need.length) { toast('Every plot already has its rain barrel'); return; } if (!(S.barrelInv > 0)) { toast(`Buy a Rain Barrel at the Supply Market first (${BARREL.price} coins)`); return; }
    closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Rain Barrel</b> · tap open ground in ${need.map(lotName).join(' or ')} to place it`; $('#buildbar').classList.remove('hidden'); return; }
  closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what, type };
  const name = what === 'sapling' ? 'your tree sapling' : DECOR_INFO[type].name;
  $('#buildbar-text').innerHTML = `Tap open ground on your land to place <b>${name}</b>${what === 'sapling' ? ' · not in beds · sunny spots grow faster' : ''}`;
  $('#buildbar').classList.remove('hidden');
}
function exitPlace() { if (placing?.spots) W.setSpotGhosts(null); placing = null; syncBedTargets(); $('#buildbar').classList.add('hidden'); }
function placeAt(x, z) {
  if (placing?.what === 'tincture' || placing?.what === 'still') {
    const near = placing.spots.filter((p) => Math.hypot(p.x - x, p.z - z) < 0.75).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    if (near?.ok) { x = near.x; z = near.z; }
    const why = tincProblem(x, z); if (why) { toast(why); return false; }
    const w = placing.what; exitPlace(); return w === 'still' ? placeStill(x, z) : placeTincture(x, z);
  }
  if (placing?.what === 'barrel') { const lot = lotAt(x, z); if (lot && S.lots[lot] && S.barrels[lot]) { toast('This plot already has its rain barrel (one per plot)'); return false; } if (lot === 'home' && !S.barrel) { toast('The home plot’s barrel comes free with your first bed'); return false; } }
  if (placing?.what === 'hive') { const lot = lotAt(x, z); if (lot && S.lots[lot] && S.hives[lot]) { toast('This plot already has a beehive (one per plot)'); return false; } }
  const why = placeProblem(x, z); if (why) { toast(why); return false; }
  const p = placing; exitPlace();
  if (p.what === 'hive') return buildHive(lotAt(x, z), x, z);
  if (p.what === 'windmill') return placeWindmill(x, z);
  if (p.what === 'barrel') return buildBarrel(lotAt(x, z), x, z);
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
// ---------------- v0.41: selling restored finds & garden items ----------------
const kindOfDecor = (t) => FIND_IDS.find((k) => FINDS[k].into.decor === t);
const kindOfBonus = (b) => FIND_IDS.find((k) => FINDS[k].into.bonus === b);
const buyback = (v) => Math.max(1, Math.round(v * RESALE.buyback));
const restoredCount = (k) => { const f = FINDS[k]; return f.into.decor ? S.decorInv[f.into.decor] || 0 : S.bonus[f.into.bonus] ? 1 : 0; };
function giveRestored(k) { const f = FINDS[k]; if (f.into.decor) S.decorInv[f.into.decor] = (S.decorInv[f.into.decor] || 0) + 1; else S.bonus[f.into.bonus] = true; }
// Remove one restored (unplaced) item from the bag / active upgrades. Refuses when that would break something.
function takeRestored(k) {
  const f = FINDS[k];
  if (f.into.decor) { if (!(S.decorInv[f.into.decor] > 0)) return false; if (!--S.decorInv[f.into.decor]) delete S.decorInv[f.into.decor]; return true; }
  if (!S.bonus[f.into.bonus]) return false;
  if (f.into.bonus === 'crate' && standCount() > STAND_CAP) { toast(`Take ${standCount() - STAND_CAP} item${standCount() - STAND_CAP > 1 ? 's' : ''} off your stand first — without the Crate Shelf it holds ${STAND_CAP}`); return false; }
  S.bonus[f.into.bonus] = false;
  if (f.into.bonus === 'can') { const max = regenMax(); for (const b of Object.values(S.barrels)) if (b.w > max) b.w = max; }
  return true;
}
function stockAntique(k) {
  if (standCount() >= standCap()) { toast('Your stand is full'); return false; }
  if (!takeRestored(k)) return false;
  const wasEmpty = standCount() === 0, id = 'antique_' + k;
  S.stand[id] = (S.stand[id] || 0) + 1; S.stats.stocked++;
  if (wasEmpty && !custs.length) nextCust = Math.max(nextCust, now() + (S.stats.customers ? 6000 : 3500));
  syncStand(); save(); hud(); renderPanel(); checkGoals();
  toast(`${ITEMS[id].name} is on your stand · a collector will pay ${ITEMS[id].sell} coins`); return true;
}
function antiquesHTML(full) {
  const ks = FIND_IDS.filter((k) => restoredCount(k) > 0); if (!ks.length) return '';
  return `<div class="sec-title">Restored finds · antiques</div><div class="list">${ks.map((k) => { const f = FINDS[k], n = restoredCount(k);
    return `<div class="row"><div class="ico">${findIcon(k)}</div><div class="meta"><b>${f.into.name}${n > 1 ? ` ×${n}` : ''}</b><small>Collectors pay ${RESALE.antique[k]} coins${f.into.bonus ? ' · its upgrade stops while it’s on the stand' : ''}</small></div>
      <div class="acts"><button class="btn btn-gold sm" data-stock-antique="${k}" ${full ? 'disabled' : ''}>Stock · ${coin(RESALE.antique[k])}</button></div></div>`; }).join('')}</div>`;
}
function sellRestored(k) {
  const f = FINDS[k], v = buyback(RESALE.antique[k]); if (!restoredCount(k)) return;
  confirmBox(`<h3>Sell ${f.into.name}?</h3><p class="muted">Instant buyback: <b>${v} coins</b> (half its ${RESALE.antique[k]}-coin antique value — a collector at your Farm Stand pays the full price).${f.into.bonus ? ` You lose its upgrade: ${f.into.blurb}.` : ''}</p>`, `Sell for ${v}`, () => {
    if (!takeRestored(k)) return; S.coins += v; S.stats.sold = (S.stats.sold || 0) + 1; save(); hud(); renderPanel(); toast(`Sold ${f.into.name} · +${v} coins`); });
}
function sellPlaced(f) {
  if (f.kind === 'stand') { toast('Your Farm Stand can’t be sold — it’s how customers buy from you'); return false; }
  if (f.kind === 'barrel' && f.lot === 'home') { toast('The Home plot’s rain barrel can’t be sold — it’s your free water, so you can never run dry'); return false; }
  let name, v, gone, note = '';
  if (f.kind === 'decor') { const d = S.decor.find((x) => x.key === f.key); if (!d) return false; const k = kindOfDecor(d.type); name = DECOR_INFO[d.type].name; v = buyback(RESALE.antique[k]); note = ` Atmosphere −${DECOR_INFO[d.type].atm}.`;
    gone = () => { S.decor = S.decor.filter((x) => x !== d); W.removeDecor(d.key); }; }
  else if (f.kind === 'hive') { if (!S.hives[f.lot]) return false; name = `Honeybee Skep (${lotName(f.lot)})`; v = buyback(RESALE.placed.beehive); note = ` ${lotName(f.lot)} loses its +${HIVE_BONUS} flower bee boost.`;
    gone = () => { delete S.hives[f.lot]; S.hivesSold = true; W.removeHive(f.lot); syncBees(); }; }
  else if (f.kind === 'barrel') { if (!S.barrels[f.lot]) return false; const beds = barrelBeds(f.lot); name = `Rain Barrel (${lotName(f.lot)})`; v = buyback(RESALE.placed.barrel);
    note = ` Its water goes with it${beds.length ? ` and ${beds.length} irrigated bed${beds.length > 1 ? 's are' : ' is'} unhooked` : ''}. Hand watering here will use another barrel.`;
    gone = () => { for (const id of beds) { const k = S.irrigBeds.indexOf(id); if (k >= 0) { S.irrigBeds.splice(k, 1); W.setIrrigation(id, false); } } delete S.barrels[f.lot]; W.removeBarrel(f.lot); }; }
  else return false;
  confirmBox(`<h3>Sell ${name}?</h3><p class="muted">Instant buyback: <b>${v} coins</b>. It leaves your garden.${note}</p>`, `Sell for ${v}`, () => {
    gone(); S.coins += v; S.stats.sold = (S.stats.sold || 0) + 1; deselect(); save(); hud(); if (panel) renderPanel(); syncBlueprints?.(); toast(`Sold ${name} · +${v} coins`); });
  return true;
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
  const cs = casters(); const list = SITES.filter((s) => S.lots[s.lot] && !S.beds.includes(s.id)).map((s) => ({ id: s.id, ok: siteClear(s.id), sun: siteSun(s.id, cs) }));
  W.setGhosts(list);
  const ready = list.filter((s) => s.ok).length;
  $('#buildbar-text').innerHTML = ready ? `Tap a <b>glowing patch</b> to build a raised bed · ${woodTag(bedCost())}<small class="bb-sun"><i data-icon="sun"></i> Labels show sun · sunnier beds grow faster</small>` : `No patch is fully clear yet — clear the <b>trees &amp; stumps</b> inside a pink patch.`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  if (!ready) setTimeout(() => buildMode && exitBuild(), 4200);
  else tip('shade');
}
function exitBuild() { buildMode = false; W.setGhosts(null); $('#buildbar').classList.add('hidden'); }
$('#buildbar-cancel').addEventListener('click', () => { if (placing) exitPlace(); else exitBuild(); });
function buildBed(siteId) {
  if (S.beds.includes(siteId) || !siteClear(siteId) || S.wood < bedCost()) return false;
  S.wood -= bedCost(); S.beds.push(siteId); for (let k = 0; k < PER_BED; k++) S.tiles.push(null); setTimeout(syncBees, 1200);
  const s = siteById(siteId);
  for (const g of S.ground.filter((g) => inSite(g, s))) collectLoot(g.key);   // anything lying in the patch goes to your bag
  W.addBed(siteId, true); exitBuild(); save(); hud();
  popAt(V3(s.x, 1.2, s.z), `<i data-icon="build"></i>Raised bed built!`);
  if (S.beds.length === 1) firstBed();
  syncBlueprints(); checkGoals(); return true;
}
function firstBed() {
  // the rain barrel still arrives with the first bed, so you can never run out of water and get stuck
  S.barrel = true; S.waterAt = now(); S.barrels.home = { x: SPOTS.barrel[0], z: SPOTS.barrel[1], w: 0, at: now() }; pourBagWater(); syncBarrels(); save();
  setTimeout(() => { W.appear(W.barrel, true); syncBlueprints(); hud(); }, 700);
  setTimeout(openStarterPack, 1900);
}
function openStarterPack() {
  if (S.starterOpened) return;
  S.starterOpened = true;
  for (const [k, v] of Object.entries(STARTER)) S.inv[k] += v;
  const h = S.barrels.home; if (h) { h.w = Math.max(h.w, Math.min(regenMax(), STARTER_FILL)); if (h.w >= regenMax()) h.at = now(); syncBarrels(); }
  S.jewels += STARTER_JEWELS;
  S.discovered.lavender = S.discovered.calendula = S.discovered.rainbarrel = true; S.unlocked.rainbarrel = true; for (const id of ['lavender', 'calendula', 'rainbarrel']) if (!S.cards[id]) addCard(id);
  save(); hud();
  showReveal([{ id: 'lavender', isNew: true }, { id: 'calendula', isNew: true }, { id: 'rainbarrel', isNew: true }], {
    title: 'Starter Seed Pack', done: `Added to your satchel: ${STARTER.seed_lavender} Lavender seeds · ${STARTER.seed_calendula} Calendula seeds · ${STARTER_JEWELS} Jewels · your home rain barrel is filled to ${STARTER_FILL}`,
    onCollect: () => { tip('standbp'); setTimeout(() => toast('Tap a soil tile in your new bed to plant'), 400); },
  });
}

// ---------------- Structures you build ----------------
const useOpt = { stand: true, market: true, tincture: true };
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
    body = (st < 3 ? sunHTML(t.sun ?? 1) : '') + (st < 3 ? `<div class="progress"><b id="sheet-prog" style="width:${(k * 100).toFixed(1)}%"></b></div>${dots}<p class="muted" id="sheet-left" style="margin-top:6px">Fully grown in ${fmtTime(t.ms * (1 - k))} · keeps growing while the game is closed</p>
      <div class="ts-actions"><button class="btn btn-blush" data-act="hurry-tree">Grow a stage · ${jewelTag(TREE.hurryJewels)}</button></div>`
      : `${dots}<div class="ts-actions"><button class="btn btn-gold" data-act="chop-tree"><i data-icon="axe"></i> Chop for ${TREE.wood} Wood</button></div>`);
  } else if (focus.kind === 'barrel') {
    const b = S.barrels[focus.lot]; if (!b) return deselect(); const beds = barrelBeds(focus.lot), max = regenMax();
    const spare = S.beds.some((id) => lotOfSite(id) === focus.lot && !S.irrigBeds.includes(id));
    head = `<h3>Rain Barrel <small>${lotName(focus.lot)} · feeds ${beds.length}/${BARREL.maxBeds} beds</small></h3>`;
    body = `<p class="barrel-line${b.w >= max ? ' full' : ''}"><i data-icon="water"></i> <b id="barrel-txt">${barrelText(focus.lot)}</b></p>
      <p class="muted gutter-line">${barrelRoof(focus.lot) ? `<i data-icon="water"></i> Gutter from the <b>${ROOF_NAMES[barrelRoof(focus.lot)]}</b> roof` : `<b class="warn">${NOT_COLLECTING}.</b> Build a Tincture or Essential Oil Stand on ${lotName(focus.lot)} — its roof gutter connects automatically.`}</p>
      ${S.windmillBuilt && barrelRoof(focus.lot) ? `<p class="wm-line"><b>Windmill: faster refill</b> <small>(every ${regenS()} s instead of ${S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S} s)</small></p>` : ''}<p class="muted">Refills 1 water every ${regenS() >= 60 ? 'minute' : regenS() + ' s'} (up to ${max}), even while the game is closed. Irrigated beds in this plot drink only from this barrel; hand watering here uses it first.</p>`
      + (beds.length ? `<div class="list barrel-beds">${beds.map((id) => `<div class="row"><div class="ico">${FEATURE_ART.irrigation}</div><div class="meta"><b>Bed ${S.beds.indexOf(id) + 1}</b><small>Irrigated from this barrel</small></div><div class="acts"><button class="btn sm" data-unhook="${id}">Unhook</button></div></div>`).join('')}</div>` : `<p class="muted">No irrigated beds yet${S.irrigN ? '' : ' · Irrigation cards come from Card Packs and the Supply Market'}.</p>`)
      + `<div class="ts-actions">${irrigFree() > 0 && spare && beds.length < BARREL.maxBeds ? `<button class="btn btn-primary" data-act="assign-irrig">Hook up a bed</button>` : ''}<button class="btn btn-blush" data-act="sell-placed">${focus.lot === 'home' ? 'Sell…' : `Sell ${coin(buyback(RESALE.placed.barrel))}`}</button></div>`;
  } else if (focus.kind === 'hive') {
    const h = S.hives[focus.lot]; if (!h) return deselect(); const n = S.beds.filter((id) => lotOfSite(id) === focus.lot).length;
    head = `<h3>Honeybee Skep <small>${lotName(focus.lot)} · one hive per plot</small></h3>`;
    body = `<p class="bee-line">🐝 +${HIVE_BONUS} flower per harvest on this plot’s ${n} bed${n === 1 ? '' : 's'} (only this plot)</p>
      <div class="ts-actions"><button class="btn btn-blush" data-act="sell-placed">Sell ${coin(buyback(RESALE.placed.beehive))}</button></div>`;
  } else if (focus.kind === 'decor') {
    const d = S.decor.find((x) => x.key === focus.key); if (!d) return deselect(); const info = DECOR_INFO[d.type];
    head = `<h3>${info.name} <small>Garden decor · +${info.atm} atmosphere</small></h3>`;
    body = `<p class="muted">Atmosphere ${atmosphere()} · customers arrive ${Math.round((1 - atmosMult()) * 100)}% sooner.</p><div class="ts-actions"><button class="btn" data-act="store-decor">Put back in bag</button><button class="btn btn-blush" data-act="sell-placed">Sell ${coin(buyback(RESALE.antique[kindOfDecor(d.type)]))}</button></div>`;
  }
  sh.innerHTML = `<div class="ts-head"><div class="ts-ico">${focus.kind === 'tree' ? ICONS.sapling : focus.kind === 'barrel' ? FEATURE_ART.rainbarrel : focus.kind === 'hive' ? '<span style="font-size:30px;line-height:1">🐝</span>' : decorIcon(S.decor.find((x) => x.key === focus.key)?.type)}</div>${head}<button class="close-btn" data-act="close">×</button></div>${body}`;
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
    head = `<h3>Empty plot <small>${tileName(i)} · choose a seed to plant</small></h3>`; body = sunHTML(tileSun[i] ?? 1) + irrigLine(i) + (beeBonus(i) ? `<p class="bee-line">🐝 Bees: +${HIVE_BONUS} flower per harvest here</p>` : '');
    const owned = Object.keys(SPECIES).filter((sp) => S.inv['seed_' + sp] > 0);
    if (!owned.length) body += S.marketBuilt ? `<p class="muted">You’re out of seeds.</p><div class="ts-actions"><button class="btn btn-primary" data-act="open-market">Visit Supply Market</button></div>` : `<p class="muted">You’re out of seeds — harvest blooms to collect more. (Rebuild the Supply Market to buy them.)</p>`;
    else body += `<div class="ts-row">${owned.map((sp) => `<button class="seed-chip" data-plant="${sp}"><img src="${SPECIES[sp].img}" alt=""/>${SPECIES[sp].name}<small>×${S.inv['seed_' + sp]} seeds</small></button>`).join('')}</div>`;
  } else {
    const sp = SPECIES[p.sp], st = stageOf(p), k = progress(p);
    head = `<h3>${sp.name}${cardLv(p.sp) > 1 ? ` <em class="lv-badge inline">Lv${cardLv(p.sp)}</em>` : ''} <small>${tileName(i)} · ${p.wateredAt ? STAGES[st] : 'Thirsty seed'}</small></h3>`;
    const dots = `<div class="stage-dots">${STAGES.map((s, n) => `<span class="${n <= st && p.wateredAt ? 'on' : ''}">${s}</span>`).join('')}</div>`;
    body = sunHTML(p.wateredAt ? p.sun ?? 1 : tileSun[i] ?? 1) + irrigLine(i) + (beeBonus(i) ? `<p class="bee-line">🐝 Bees: +${beePct(p.sp)}% flowers <small>(+${HIVE_BONUS} per harvest · hive on this plot)</small></p>` : '') + (cardLv(p.sp) > 1 ? `<p class="lv-line">✨ Card Lv${cardLv(p.sp)}: +${Math.round(CARD_LEVELS.plant.sell * (cardLv(p.sp) - 1) * 100)}% sell price · −${Math.round(CARD_LEVELS.plant.grow * (cardLv(p.sp) - 1) * 100)}% grow time${lvFlower(p.sp) ? ' · +1 flower' : ''}</p>` : '');
    if (!p.wateredAt) { const tw = totalWater(), src = tw ? handSource(i) : null, wait = Object.entries(S.barrels).filter(([l, b]) => b.w < regenMax() && barrelRoof(l)).map(([, b]) => barrelLeft(b));
      body += `<p class="muted">This seed needs water before it can grow.${tw ? ` <small>From: the ${lotName(src.lot)} barrel</small>` : ` Rain barrels refill by 1 water every ${regenS() >= 60 ? 'minute' : regenS() + ' s'}${wait.length ? ` · next in ${clock(Math.min(...wait))}` : ''}.`}</p><div class="ts-actions"><button class="btn btn-primary" data-act="water" ${tw ? '' : 'disabled'}><i data-icon="water"></i> Water (${tw} in barrels)</button></div>`; }
    else if (st < 3) body += `<div class="progress"><b id="sheet-prog" style="width:${(k * 100).toFixed(1)}%"></b></div>${dots}<p class="muted" id="sheet-left" style="margin-top:6px">Blooms in ${fmtTime(p.growMs * (1 - k))}</p>`;
    else body += `${dots}<div class="ts-actions"><button class="btn btn-gold" data-act="harvest"><i data-icon="sparkle"></i> Harvest</button></div>`;
  }
  sh.innerHTML = `<div class="ts-head">${head}<button class="close-btn" data-act="close">×</button></div>${body}`;
  sh.dataset.st = p ? stageOf(p) : -1;
  fillIcons(sh); sh.classList.remove('hidden');
}
$('#tile-sheet').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.plant) return plant(selected, b.dataset.plant);
  if (b.dataset.unhook) return unhookIrrigation(b.dataset.unhook);
  const a = b.dataset.act;
  if (a === 'assign-irrig') { deselect(); return enterPlace('irrigation'); }
  if (a === 'close') deselect(); else if (a === 'water') water(selected); else if (a === 'harvest') harvest(selected); else if (a === 'open-market') openPanel('market', 'buy');
  else if (a === 'hurry-tree') hurryTree(focus.id); else if (a === 'chop-tree') tapGrown(focus.id); else if (a === 'store-decor') storeDecor(focus.key); else if (a === 'sell-placed') sellPlaced(focus);
});
function plant(i, sp) {
  if (S.tiles[i] || !(S.inv['seed_' + sp] > 0)) return;
  S.inv['seed_' + sp]--; S.tiles[i] = { sp, plantedAt: now(), wateredAt: null, growMs: SPECIES[sp].growS * 1000 * growK(sp) };
  syncTile(i); save(); hud(); renderSheet(); tip('water');
}
function water(i, auto = false) {
  const p = S.tiles[i]; if (!p || p.wateredAt) return;
  const src = auto ? { b: barrelOf(bedOfTile(i)) } : handSource(i); if (!(src?.b?.w > 0)) return;
  takeFromBarrel(src.b); syncBarrels();
  p.wateredAt = now(); if (auto) { p.irrigated = true; S.stats.irrigated = (S.stats.irrigated || 0) + 1; } p.baseMs = SPECIES[p.sp].growS * 1000 * (S.owned.sundial ? 0.75 : 1) * growK(p.sp); applyShade(); p.sun = tileSun[i] ?? 1; p.growMs = p.baseMs / speedFor(p.sun); S.stats.watered++;
  W.splash(i); syncTile(i); save(); hud(); if (selected === i || !auto) renderSheet();
  if (auto) { W.irrigPulse(bedOfTile(i)); popAt(W.tileWorld(i).setY(1), `<i data-icon="water"></i>Irrigated`); checkGoals(); return; }
  tip('growing'); if (p.sun < 0.85) tip('shade'); if (S.stats.watered === 3) tip('barrel');
  popAt(W.tileWorld(i).setY(1), `<i data-icon="water"></i>Watered`); checkGoals();
}
// ---------------- v0.4: card stacks & levels ----------------
const cardLv = (id) => S.cards[id]?.lv || 1;
const nextAt = (id) => CARD_LEVELS.thresholds[cardLv(id) - 1];   // copies needed for the next level (undefined at max)
const canUpgrade = (id) => CARD_LEVELS.upgradable(id, CARDS[id]) && nextAt(id) != null && (S.cards[id]?.n || 0) >= nextAt(id);
const growK = (sp) => 1 - CARD_LEVELS.plant.grow * (cardLv(sp) - 1);
const spOfItem = (id) => Object.keys(SPECIES).find((sp) => id.endsWith('_' + sp));
const sellOf = (id) => { const sp = spOfItem(id); return sp ? Math.round(ITEMS[id].sell * (1 + CARD_LEVELS.plant.sell * (cardLv(sp) - 1))) : ITEMS[id].sell; };
const lvFlower = (sp) => (cardLv(sp) >= CARD_LEVELS.plant.bonusFlowerAt ? 1 : 0);
function addCard(id, n = 1) { const c = S.cards[id] || (S.cards[id] = { n: 0, lv: 1 }); c.n += n; return c; }
function upgradeCard(id) {
  if (!canUpgrade(id)) return false; const c = S.cards[id]; c.lv++; S.stats.upgrades = (S.stats.upgrades || 0) + 1; save(); hud(); if (panel) renderPanel();
  const L = CARD_LEVELS.plant, lv = c.lv;
  toast(CARDS[id].tier ? `✨ ${CARDS[id].name} reached Lv${lv}: +${Math.round(L.sell * (lv - 1) * 100)}% sell price · ${Math.round(L.grow * (lv - 1) * 100)}% faster growth${lv >= L.bonusFlowerAt ? ' · +1 flower per harvest' : ''}` : id === 'windmill' ? `✨ Windmill reached Lv${lv}: barrels refill every ${regenS()} s` : id === 'parking' ? `✨ Parking Lot reached Lv${lv}: room for ${parkCap()} cars · ${Math.round(extraItemChance() * 100)}% buy an extra item` : `✨ ${CARDS[id].name} reached Lv${lv}: rests ${Math.round(CARD_LEVELS.tool.cooldown * (lv - 1) * 100)}% shorter`);
  if (id === 'parking' && S.parkingBuilt) W.setParking(parkCap());
  return true;
}
function harvestCore(i) {   // normal yields/seeds rules, shared by the hand harvest and the Sickle
  const p = S.tiles[i]; if (!p || stageOf(p) < 3) return null;
  const sp = SPECIES[p.sp];
  const f = randInt(...sp.yieldF) + beeBonus(i) + lvFlower(p.sp), s = rollSeeds(sp.tier);
  S.inv['flower_' + p.sp] += f; S.inv['seed_' + p.sp] += s; S.tiles[i] = null; S.stats.harvests++;
  if (p.sp === 'lavender' && !S.rackAvail) { S.rackAvail = true; setTimeout(() => { syncBlueprints(); hud(); tip('lavender'); }, 900); }
  return { sp: p.sp, f, s };
}
function harvest(i) {
  const p = S.tiles[i]; if (!p || stageOf(p) < 3) return;
  const sp = SPECIES[p.sp]; const { f, s } = harvestCore(i);
  syncTile(i); save(); hud();
  const at = W.tileWorld(i);
  popAt(at.clone().setY(1.2), `+${f} ${sp.name}`);
  setTimeout(() => popAt(at.clone().setY(0.8), `+${s} seed${s > 1 ? 's' : ''}`), 350);
  renderSheet(); tip('harvested');
  checkGoals();
}
// ---------------- v0.4: tools — Harvest Sickle (v0.41: one raised bed) and Hand Plow (v0.41: one raised bed) ----------------
const toolCd = (t) => FEATURES[t].cooldownS * (1 - CARD_LEVELS.tool.cooldown * (cardLv(t) - 1));
const toolLeft = (t) => Math.max(0, (S.toolAt?.[t] || 0) + toolCd(t) * 1000 - now());
const lotTiles = (lot) => { const out = []; S.beds.forEach((id, b) => { if (lotOfSite(id) === lot) for (let k = 0; k < PER_BED; k++) out.push(b * PER_BED + k); }); return out; };
const bedCenter = (b) => { const s = siteById(S.beds[b]); return { x: s.x, z: s.z }; };
function itemFly(worldPos, html, delay = 0) {
  setTimeout(() => { const s = W.project(worldPos), t = $('#tab-bag').getBoundingClientRect();
    const c = el('div', 'item-fly', html); c.style.left = s.x + 'px'; c.style.top = s.y + 'px'; c.style.setProperty('--tx', (t.left + t.width / 2 - s.x) + 'px'); c.style.setProperty('--ty', (t.top + t.height / 2 - s.y) + 'px');
    $('#popups').appendChild(c); setTimeout(() => { c.remove(); bump('#tab-bag'); }, 900); }, delay);
}
const bedTiles = (b) => { const out = []; for (let k = 0; k < PER_BED; k++) out.push(b * PER_BED + k); return out; };
const bedLabel = (b) => { const id = S.beds[b]; return `this bed on ${lotName(lotOfSite(id))}`; };
// v0.41: the Sickle harvests ONE raised bed (every ripe plant in it)
function sickleBed(b) {
  if (!S.owned.sickle) return { n: 0 };
  if (b == null || b < 0 || !S.beds[b]) { toast('Tap one of your raised beds'); return { n: 0 }; }
  if (toolLeft('sickle') > 0) { toast(`The sickle is resting · ready in ${clock(toolLeft('sickle'))}`); return { n: 0 }; }
  const ripe = bedTiles(b).filter((i) => S.tiles[i] && stageOf(S.tiles[i]) >= 3);
  if (!ripe.length) { toast('Nothing is ripe in this bed yet — the sickle skips growing plants'); return { n: 0 }; }
  exitPlace(); S.toolAt.sickle = now();
  W.sickleSweep([bedCenter(b)]);
  const got = {}, spOf = {}; let seeds = 0;
  for (const i of ripe) { const r = harvestCore(i); got[r.sp] = (got[r.sp] || 0) + r.f; seeds += r.s; spOf[i] = r.sp; }
  save(); hud();
  setTimeout(() => { for (const i of ripe) { const at = W.tileWorld(i); syncTile(i); itemFly(at.clone().setY(1), itemSvg('flower_' + spOf[i]), Math.random() * 160); } }, 380);
  const c = bedCenter(b);
  setTimeout(() => popAt(V3(c.x, 1.6, c.z), Object.entries(got).map(([sp, f]) => `+${f} ${SPECIES[sp].name}`).join(' · ') + ` · +${seeds} seeds`), 500);
  toast(`Sickle: harvested ${ripe.length} ripe plant${ripe.length > 1 ? 's' : ''} in ${bedLabel(b)}`);
  checkGoals(); return { n: ripe.length, got, seeds };
}
// v0.41: the Plow plants ONE raised bed (every empty tile in it, as far as the seeds go)
function plowBed(b, sp) {
  if (!S.owned.plow) return { n: 0 };
  if (!sp || !SPECIES[sp]) { toast('Pick a seed for the plow first'); return { n: 0 }; }
  if (b == null || b < 0 || !S.beds[b]) { toast('Tap one of your raised beds — the plow only plants beds'); return { n: 0 }; }
  if (toolLeft('plow') > 0) { toast(`The plow is resting · ready in ${clock(toolLeft('plow'))}`); return { n: 0 }; }
  const empty = bedTiles(b).filter((i) => !S.tiles[i]);
  if (!empty.length) { toast('Every tile in this bed is already planted'); return { n: 0 }; }
  const have = S.inv['seed_' + sp] || 0; if (!have) { toast(`No ${SPECIES[sp].name} seeds — buy some at the Market`); return { n: 0 }; }
  exitPlace(); S.toolAt.plow = now();
  const go = empty.slice(0, have), n = go.length;
  const rows = []; for (let r = 0; r < BED_N; r++) rows.push([W.tileWorld(b * PER_BED + r * BED_N), W.tileWorld(b * PER_BED + r * BED_N + BED_N - 1)]);
  W.plowFurrows(rows);
  for (const i of go) { S.inv['seed_' + sp]--; S.tiles[i] = { sp, plantedAt: now(), wateredAt: null, growMs: SPECIES[sp].growS * 1000 * growK(sp), hold: true }; }
  S.stats.plowed = (S.stats.plowed || 0) + n; save(); hud();
  go.forEach((i) => { const r = Math.floor((i % PER_BED) / BED_N); setTimeout(() => { if (S.tiles[i]) { delete S.tiles[i].hold; syncTile(i); } }, r * 140 + 700); });
  setTimeout(() => save(), BED_N * 140 + 900);
  toast(`Planted ${n} / ${empty.length}${n < empty.length ? ' (out of seeds)' : ''} · ${SPECIES[sp].name}`); tip('water');
  return { n, of: empty.length };
}
// bed targets while a tool is out: green frame = something to do in that bed
let bedTargetKey = '';
function syncBedTargets() {
  const t = placing?.what; if (t !== 'sickle' && t !== 'plow') { if (bedTargetKey) { W.setBedTargets(null); bedTargetKey = ''; } return; }
  const list = S.beds.map((id, b) => { const c = bedCenter(b); const ts = bedTiles(b);
    const ok = t === 'sickle' ? ts.some((i) => S.tiles[i] && stageOf(S.tiles[i]) >= 3) : ts.some((i) => !S.tiles[i]); return { x: c.x, z: c.z, ok, b }; });
  const key = t + ':' + list.map((l) => +l.ok).join(''); if (key === bedTargetKey) return; bedTargetKey = key; W.setBedTargets(list);
}
function toolBar() {
  const plowSeeds = Object.keys(SPECIES).filter((k) => S.inv['seed_' + k] > 0);
  if (placing?.what === 'sickle') $('#buildbar-text').innerHTML = `<b>Harvest Sickle</b> · tap a glowing raised bed to harvest every ripe plant in it`;
  if (placing?.what === 'plow') $('#buildbar-text').innerHTML = `<b>Hand Plow</b> · ${placing.sp ? `tap a glowing raised bed to plant its empty tiles` : 'pick a seed:'}<span class="seed-chips">${plowSeeds.map((k) => `<button class="chip ${placing.sp === k ? 'on' : ''}" data-plowseed="${k}"><img src="${SPECIES[k].img}" alt=""/>${SPECIES[k].name} ×${S.inv['seed_' + k]}</button>`).join('')}</span>`;
}
function useTool(t) {
  if (!S.owned[t]) return;
  if (toolLeft(t) > 0) { toast(`The ${t} is resting · ready in ${clock(toolLeft(t))}`); return; }
  if (t === 'plow' && !Object.keys(SPECIES).some((k) => S.inv['seed_' + k] > 0)) { toast('No seeds for the plow — buy some at the Market'); return; }
  closePanel(); deselect(); if (buildMode) exitBuild(); if (placing) exitPlace();
  placing = { what: t, sp: null };
  if (t === 'plow') { const have = Object.keys(SPECIES).filter((k) => S.inv['seed_' + k] > 0); if (have.length === 1) placing.sp = have[0]; }
  toolBar(); $('#buildbar').classList.remove('hidden'); syncBedTargets();
}
$('#buildbar').addEventListener('click', (e) => { const b = e.target.closest('[data-plowseed]'); if (!b || placing?.what !== 'plow') return; placing.sp = b.dataset.plowseed; toolBar(); });
function syncTools() {
  syncBedTargets();
  const d = $('#tooldock'); const any = S.owned.sickle || S.owned.plow; d.classList.toggle('hidden', !any || !S.introDone);
  if (any) { const tb = $('#tabbar').getBoundingClientRect(); if (tb.height) d.style.bottom = Math.round(innerHeight - tb.top + 56) + 'px'; }  // sit above the tab bar and the toast line
  for (const t of ['sickle', 'plow']) { const b = $('#tool-' + t); b.classList.toggle('hidden', !S.owned[t]); const l = toolLeft(t); b.classList.toggle('resting', l > 0); b.classList.toggle('on', placing?.what === t); b.querySelector('em').textContent = l > 0 ? clock(l) : ''; }
}
for (const t of ['sickle', 'plow']) $('#tool-' + t + ' .tool-art').innerHTML = FEATURE_ART[t];
for (const t of ['sickle', 'plow']) $('#tool-' + t).addEventListener('click', () => (placing?.what === t ? exitPlace() : useTool(t)));
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

// v0.4: plots (owned, with no barrel yet) that can get a barrel. Home's arrives free with the first bed.
const barrelLots = () => Object.keys(LOTS).filter((l) => S.lots[l] && !S.barrels[l] && (l !== 'home' || S.barrel));
function buildBarrel(lot, x, z) {
  if (!lot || !S.lots[lot] || S.barrels[lot] || !(S.barrelInv > 0)) return false;
  S.barrelInv--; S.barrels[lot] = { x, z, w: 0, at: now() };
  W.addBarrel(lot, x, z, true); syncBarrels(); save(); hud();
  setTimeout(() => { if (barrelRoof(lot)) { popAt(V3(x, 1.6, z), `<i data-icon="water"></i>Rain barrel placed! Gutter from the ${ROOF_NAMES[barrelRoof(lot)]} · 1 water a minute`); tip('barrel'); } else toast(`Rain barrel placed — ${NOT_COLLECTING.toLowerCase()} (a Tincture or Essential Oil Stand there; its gutter connects automatically)`); }, 900);
  return true;
}
// ---------------- v0.4: Honeybee Skep — placed on a plot, boosts only that plot's beds ----------------
const HIVE_BONUS = 1;   // the hive's original effect, kept: +1 flower per harvest (now only for beds on the hive's plot)
const hiveLots = () => Object.keys(LOTS).filter((l) => S.lots[l] && !S.hives[l]);
const beeBonus = (i) => (S.hives[lotOfSite(S.beds[Math.floor(i / PER_BED)])] ? HIVE_BONUS : 0);
const beePct = (sp) => Math.round((HIVE_BONUS / ((SPECIES[sp].yieldF[0] + SPECIES[sp].yieldF[1]) / 2)) * 100);
function syncBees() { W.setBeeBeds(S.beds.map((id, b) => (S.hives[lotOfSite(id)] ? bedCenter(b) : null)).filter(Boolean)); }
function freeSpot(lot, near) {   // a clear spot on the plot (not a bed, building, tree or path), nearest to `near` if given
  const L = LOTS[lot]; let best = null, bd = 1e9;
  for (let z = L.z1 - 1.2; z > L.z0 + 0.8; z -= 0.35) for (let x = L.x0 + 0.9; x < L.x1 - 0.9; x += 0.35) { if (lotAt(x, z) !== lot || placeProblem(x, z)) continue;
    if (!near) return { x: +x.toFixed(2), z: +z.toFixed(2) }; const d = Math.hypot(x - near.x, z - near.z); if (d > 1.3 && d < bd) { bd = d; best = { x: +x.toFixed(2), z: +z.toFixed(2) }; } }
  return best;
}
function buildHive(lot, x, z) {
  if (!lot || !S.lots[lot] || S.hives[lot] || !(S.hiveInv > 0)) return false;
  S.hiveInv--; S.hives[lot] = { x, z }; W.addHive(lot, x, z, true); syncBees(); save(); hud();
  setTimeout(() => popAt(V3(x, 1.8, z), `🐝 Bees on ${lotName(lot)}: +${HIVE_BONUS} flower per harvest`), 900);
  toast(`Honeybee Skep placed — its bees boost only the beds on ${lotName(lot)}`);
  return true;
}
// ---------------- v0.4: Tincture Stand ----------------
const tincBase = () => { const b = S.tincBase === 'vinegar' ? 'vinegar' : 'glycerin', o = b === 'glycerin' ? 'vinegar' : 'glycerin'; return S.inv[b] > 0 || !(S.inv[o] > 0) ? b : o; };
const tincCost = () => BUILDS.tincture.wood - (useOpt.tincture && S.decorInv.chime > 0 ? BUILDS.tincture.opt.save : 0);
const tincLots = () => LOT_FOR_SALE.filter((l) => S.lots[l]);
// Can the Tincture Stand go here? Whole footprint must be on cleared ground of one bought neighbouring plot.
const BED_HALF = TILE * BED_N / 2;   // v0.41: stands may not cover a bed patch
function tincProblem(x, z) {
  const lot = lotAt(x, z); if (!lot || !S.lots[lot]) return 'Build it on a plot you own';
  if (lot === 'home') return 'Build it on one of your other plots — not the Roadside Lot';
  for (const [dx, dz] of [[0, 0], [0.8, 0.5], [-0.8, 0.5], [0.8, -0.5], [-0.8, -0.5]]) { if (lotAt(x + dx, z + dz) !== lot) return 'Too close to the edge of the plot'; const w = placeProblem(x + dx, z + dz); if (w) return w;
    for (const st of SITES) if (st.lot === lot && Math.abs(st.x - x - dx) < BED_HALF + 0.1 && Math.abs(st.z - z - dz) < BED_HALF + 0.1) return 'That’s a bed patch — keep it free for a raised bed'; }
  return null;
}
function tincSpots() {
  const out = [];
  for (const lot of ['home', ...tincLots()]) { const L = LOTS[lot], st = lot === 'home' ? 2.2 : 1.5;
    for (let z = Math.min(L.z1, 4.3) - 1.0; z > L.z0 + 0.9; z -= st) for (let x = L.x0 + 1.1; x < L.x1 - 1.0; x += st) out.push({ x: +x.toFixed(2), z: +z.toFixed(2), lot, ok: !tincProblem(x, z) }); }
  return out;
}
function buildTincture() {
  const c = tincCost();
  if (S.tinctureBuilt || building.tincture || !S.owned.tincture) return false;
  if (!tincLots().length) { toast('Buy a neighbouring plot first — the Tincture Stand is built on one of your other plots'); return false; }
  if (S.wood < c) { toast(`The Tincture Stand needs ${c} Wood`); return false; }
  return startStandPlace('tincture', 'Tincture Stand', c);
}
function buildStill() {
  const c = BUILDS.still.wood;
  if (S.stillBuilt || building.still || !S.owned.still) return false;
  if (!tincLots().length) { toast('Buy a neighbouring plot first — the Essential Oil Stand is built on one of your other plots'); return false; }
  if (S.wood < c) { toast(`The Essential Oil Stand needs ${c} Wood`); return false; }
  return startStandPlace('still', 'Essential Oil Stand', c);
}
// Tincture & Essential Oil Stands: the player picks a spot (green ghosts) on cleared ground of a bought neighbouring plot.
function startStandPlace(what, title, c) {
  closePanel(); deselect(); if (buildMode) exitBuild(); if (placing) exitPlace();
  const spots = tincSpots(), ok = spots.filter((p) => p.ok);
  placing = { what, spots }; W.setSpotGhosts(spots);
  $('#buildbar-text').innerHTML = ok.length ? `<b>${title}</b> · tap a <b>green spot</b> on ${tincLots().map(lotName).join(' or ')} · ${woodTag(c)}` : `<b>${title}</b> · no clear spot yet — clear trees on ${tincLots().map(lotName).join(' or ')} first`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  const L = LOTS[tincLots()[0]]; W.ctl.moved = true; W.glide({ target: V3((L.x0 + L.x1) / 2, 0.3, (L.z0 + L.z1) / 2), zoom: Math.max(W.ctl.zoom, 1.0) }, 0.8);
  return true;
}
function placeTincture(x, z) {
  const c = tincCost();
  if (S.tinctureBuilt || building.tincture || !S.owned.tincture || S.wood < c) return false;
  const lot = lotAt(x, z); S.tincPos = { x, z, lot }; SPOTS.tincture = [x, z]; W.tincture.position.set(x, 0, z);
  S.wood -= c; let bottles = false;
  if (c < BUILDS.tincture.wood) { S.decorInv.chime--; if (!S.decorInv.chime) delete S.decorInv.chime; bottles = true; }
  S.tinctureBuilt = true; building.tincture = true; save(); closePanel(); syncBlueprints(); glideTo('tincture');
  setTimeout(() => W.buildAnim(W.tincture, [2.1, 2.6, 1.3], () => {
    building.tincture = false; popAt(spotV('tincture', 2.6), 'Tincture Stand built!'); if (bottles) setTimeout(() => toast('Your restored Glass Bottles now line the shelves'), 600);
    tip('tincture'); hud(); checkGoals(); refreshShade(true);
  }), 500);
  hud(); return true;
}
function placeStill(x, z) {
  const c = BUILDS.still.wood;
  if (S.stillBuilt || building.still || !S.owned.still || S.wood < c) return false;
  S.stillPos = { x, z, lot: lotAt(x, z) }; SPOTS.still = [x, z]; W.still.position.set(x, 0, z);
  S.wood -= c; S.stillBuilt = true; building.still = true; save(); closePanel(); syncBlueprints(); glideTo('still');
  setTimeout(() => W.buildAnim(W.still, [2.1, 2.6, 1.3], () => {
    building.still = false; popAt(spotV('still', 2.6), 'Essential Oil Stand built!'); tip('still'); hud(); checkGoals(); refreshShade(true);
  }), 500);
  hud(); return true;
}
function distill(sp) {
  const r = STILL.recipes[sp], k = S.stills.findIndex((t) => !t), seed = 'seed_' + sp;
  if (!S.stillBuilt || building.still || !r || k < 0 || !(S.inv[seed] >= r.n)) return false;
  S.inv[seed] -= r.n; S.stills[k] = { sp, start: now(), ms: r.s * 1000 };
  syncStill(); save(); hud(); renderPanel(); toast(`Distilling ${ITEMS[oilId(sp)].name} · ${fmtTime(r.s * 1000)}`); return true;
}
function collectOil(k) {
  const t = S.stills[k]; if (!t || now() - t.start < t.ms) return false;
  const id = oilId(t.sp); S.inv[id] = (S.inv[id] || 0) + 1; S.stills[k] = null; S.stats.oils = (S.stats.oils || 0) + 1;
  syncStill(); save(); hud(); renderPanel(); popAt(spotV('still', 2.2), `+1 ${ITEMS[id].name}`); checkGoals(); return true;
}
// v0.5: Basic recipes are always listed (as before); higher-tier recipes appear once that plant is unlocked (or you hold some).
const recipeOpen = (sp) => SPECIES[sp]?.tier === 'basic' || S.unlocked[sp] || S.inv['flower_' + sp] > 0 || S.inv['seed_' + sp] > 0;
function stillHTML() {
  const free = S.stills.some((t) => !t);
  const slots = S.stills.map((t, k) => { if (!t) return `<div class="tslot empty">Empty still</div>`; const id = oilId(t.sp), left = t.start + t.ms - now();
    return left <= 0 ? `<button class="tslot done" data-scollect="${k}">${itemSvg(id)}<span><b>${ITEMS[id].name}</b><small>Ready! Tap to collect</small></span></button>`
      : `<div class="tslot">${itemSvg(id)}<span><b>${ITEMS[id].name}</b><small>Distilling · <em data-sleft="${k}">${fmtTime(left)}</em></small></span></div>`; }).join('');
  const rows = Object.entries(STILL.recipes).filter(([sp]) => recipeOpen(sp)).map(([sp, r]) => { const id = oilId(sp), have = S.inv['seed_' + sp] || 0, ok = free && have >= r.n, sd = SPECIES[sp];
    return `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>${r.n} ${sd.name} seeds · ${fmtTime(r.s * 1000)} · sells for ${sellOf(id)} <span class="oil-vs">(seeds sell for ${r.n * sd.seedSell}, cost ${r.n * sd.seedPrice} new)</span> · you have ${have}</small></div><div class="acts"><button class="btn btn-gold sm" data-distill="${sp}" ${ok ? '' : 'disabled'}>Distill</button></div></div>`; }).join('');
  return `<div class="hero"><img src="assets/still.jpg" alt=""/><p>Essential oils from your seeds</p></div>
    <div class="sec-title">Stills · ${S.stills.filter(Boolean).length}/${S.stills.length}</div><div class="tslots">${slots}</div>
    <div class="sec-title">Recipes · seeds only</div><div class="list">${rows}</div>
    <p class="muted" style="margin:10px 4px 0">Each oil is worth far more than selling its seeds — but those seeds won’t be planted. Stills keep running while the game is closed. Sell oils at the Farm Stand.</p>`;
}
function craftTincture(sp) {
  const r = TINCTURE.recipes[sp], base = tincBase(), k = S.tinc.findIndex((t) => !t);
  if (!S.tinctureBuilt || building.tincture || !r || k < 0 || !(S.inv[base] > 0) || S.inv['flower_' + sp] < r.n) return false;
  S.inv['flower_' + sp] -= r.n; S.inv[base]--; S.tinc[k] = { sp, base, start: now(), ms: r.s * 1000 };
  syncTinc(); save(); hud(); renderPanel(); toast(`Steeping ${ITEMS[tinctureId(sp, base)].name} · ${fmtTime(r.s * 1000)}`); return true;
}
function collectTincture(k) {
  const t = S.tinc[k]; if (!t || now() - t.start < t.ms) return false;
  const id = tinctureId(t.sp, t.base); S.inv[id]++; S.tinc[k] = null; S.stats.tinctures++;
  syncTinc(); save(); hud(); renderPanel(); popAt(spotV('tincture', 2.2), `+1 ${ITEMS[id].name}`); checkGoals(); return true;
}
function tinctureHTML() {
  const base = tincBase(), has = S.inv.glycerin > 0 || S.inv.vinegar > 0, free = S.tinc.some((t) => !t);
  const seg = `<div class="seg base-seg">${['glycerin', 'vinegar'].map((b) => `<button data-base="${b}" class="${base === b ? 'on' : ''}" ${S.inv[b] > 0 ? '' : 'aria-disabled="true"'}>${itemIcon('bottle', BASES[b].color)}${BASES[b].name} ×${S.inv[b]}</button>`).join('')}</div>`;
  const slots = S.tinc.map((t, k) => { if (!t) return `<div class="tslot empty">Empty flask</div>`; const id = tinctureId(t.sp, t.base), left = t.start + t.ms - now();
    return left <= 0 ? `<button class="tslot done" data-tcollect="${k}">${itemSvg(id)}<span><b>${ITEMS[id].name}</b><small>Ready! Tap to collect</small></span></button>`
      : `<div class="tslot">${itemSvg(id)}<span><b>${ITEMS[id].name}</b><small>Steeping · <em data-tleft="${k}">${fmtTime(left)}</em></small></span></div>`; }).join('');
  const rows = Object.entries(TINCTURE.recipes).filter(([sp]) => recipeOpen(sp)).map(([sp, r]) => { const id = tinctureId(sp, base), have = S.inv['flower_' + sp], ok = has && free && have >= r.n;
    return `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>${r.n} ${TINCTURE_NAMES[sp]} + 1 ${BASES[base].name} · ${fmtTime(r.s * 1000)} · sells for ${r.sell[base]} · you have ${have}</small></div><div class="acts"><button class="btn btn-gold sm" data-craft="${sp}" ${ok ? '' : 'disabled'}>Steep</button></div></div>`; }).join('');
  return `<div class="hero"><img src="assets/tincture.jpg" alt=""/><p>Tinctures &amp; dried herbs</p></div>
    <div class="sec-title">Base</div>${seg}
    ${has ? '' : `<p class="need-base">Needs Glycerin or Vinegar: buy at the Market</p>${S.marketBuilt ? '<div class="ts-actions" style="margin:0 0 8px"><button class="btn" data-act="open-market">Visit Supply Market</button></div>' : ''}`}
    <div class="sec-title">Flasks · ${S.tinc.filter(Boolean).length}/${S.tinc.length}</div><div class="tslots">${slots}</div>
    <div class="sec-title">Recipes</div><div class="list">${rows}</div>
    <p class="muted" style="margin:10px 4px 0">Glycerites (Glycerin) sell a little higher than Vinegar Tinctures. Flasks keep steeping while the game is closed. Sell tinctures at the Farm Stand.</p>`;
}
function itemSvg(id) { const it = ITEMS[id]; if (it?.antique) return findIcon(it.antique); if (it) return itemIcon(...it.icon); if (BASES[id]) return itemIcon('bottle', BASES[id].color); return itemIcon('water'); }
function renderPanel() {
  const body = $('#panel-body'), title = $('#panel-title'); const st = body.scrollTop;
  if (panel === 'bag') { title.innerHTML = 'Your Bag'; body.innerHTML = bagHTML(); }
  if (panel === 'build') { title.innerHTML = 'Build'; body.innerHTML = buildHTML(); }
  if (panel === 'stand') { title.innerHTML = 'Farm Stand'; body.innerHTML = standHTML(); }
  if (panel === 'market') { title.innerHTML = 'Supply Market'; body.innerHTML = marketHTML(); }
  if (panel === 'rack') { title.innerHTML = 'Drying Rack'; body.innerHTML = rackHTML(); }
  if (panel === 'tincture') { title.innerHTML = 'Tincture Stand'; body.innerHTML = tinctureHTML(); }
  if (panel === 'still') { title.innerHTML = 'Essential Oil Stand'; body.innerHTML = stillHTML(); }
  if (panel === 'billboard') { title.innerHTML = 'Roadside Billboard'; body.innerHTML = billboardHTML(); }
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
    <p class="muted" style="margin:14px 4px 0;text-align:center">Petalspire v${BUILD} · prototype${Payments.isTest ? ' · <span class="test-tag" style="margin:0">Test mode</span>' : ''}</p>`;
}
function bagHTML() {
  const nf = Object.values(S.finds).reduce((a, v) => a + v, 0) + S.restoring.length;
  const seg = `<div class="seg"><button data-bag="satchel" class="${bagTab === 'satchel' ? 'on' : ''}">Satchel</button><button data-bag="finds" class="${bagTab === 'finds' ? 'on' : ''}">Finds${nf ? ` · ${nf}` : ''}</button><button data-bag="cards" class="${bagTab === 'cards' ? 'on' : ''}">Cards${Object.keys(CARDS).some(canUpgrade) ? ' ✨' : ''}</button></div>`;
  const jewels = `<button class="jewel-strip" data-act="open-jewels"><i data-icon="jewel"></i><span><b>${S.jewels} Jewels</b><small>Open Card Packs, finish restorations, grow trees and rebuilds instantly</small></span><em>Shop</em></button>`;
  return jewels + seg + (bagTab === 'finds' ? findsHTML() : bagTab === 'cards' ? cardsHTML() : satchelHTML());
}
function cardsHTML() {   // v0.4: card stacks + upgrades
  const T = CARD_LEVELS.thresholds, ids = Object.keys(CARDS).filter((k) => S.cards[k]);
  const L = CARD_LEVELS.plant;
  const rows = ids.map((id) => { const c = S.cards[id], up = CARD_LEVELS.upgradable(id, CARDS[id]), nx = nextAt(id);
    const fx = CARDS[id].tier ? (c.lv > 1 ? `+${Math.round(L.sell * (c.lv - 1) * 100)}% sell · −${Math.round(L.grow * (c.lv - 1) * 100)}% grow time${c.lv >= L.bonusFlowerAt ? ' · +1 flower' : ''}` : 'Level up for better prices and faster growth')
      : id === 'sickle' || id === 'plow' ? (c.lv > 1 ? `Rests ${Math.round(toolCd(id))} s` : 'Level up for a shorter rest') : id === 'windmill' ? `Barrels refill every ${WINDMILL.regenS[Math.min(4, c.lv) - 1]} s (base 60)` : id === 'parking' ? `${(c.lv >= 2 ? PARKING.capLv2 : PARKING.cap)} bays · ${Math.round((PARKING.extraItem + CARD_LEVELS.parking.extraItem * (c.lv - 1)) * 100)}% extra-item chance` : id === 'irrigation' ? `${c.n} card${c.n > 1 ? 's' : ''} · every copy irrigates one more bed` : 'Copies stack here';
    const prog = up ? (nx != null ? `<div class="lv-prog"><b style="width:${Math.min(100, (c.n / nx) * 100)}%"></b></div><small>${c.n}/${nx} copies to Lv${c.lv + 1}</small>` : '<small>Max level</small>') : '';
    return `<div class="stack-row${canUpgrade(id) ? ' glow' : ''}">${cardHTML(id)}<div class="meta"><b>${CARDS[id].name}${up ? ` · Lv${c.lv}` : ''}</b><small>×${c.n} collected · ${fx}</small>${prog}
      ${canUpgrade(id) ? `<button class="btn btn-gold sm" data-upgrade="${id}">✨ Upgrade to Lv${c.lv + 1}</button>` : ''}</div></div>`; }).join('');
  return `<p class="muted" style="margin:8px 2px">Duplicate cards stack. At ${T.join(' / ')} copies a plant (or tool) card can be upgraded — copies are kept, never spent. Seeds per harvest always follow the plant’s tier.</p><div class="stacks">${rows || '<p class="muted">Open a Card Pack to start your collection.</p>'}</div>`;
}
function satchelHTML() {
  const ids = ['seed_', 'flower_', 'dried_'].flatMap((p) => Object.keys(SPECIES).map((sp) => p + sp)).filter((id) => ITEMS[id]);   // v0.5: every plant
  const res = (icon, name, n) => `<div class="inv"><i data-icon="${icon}" style="width:38px;height:38px"></i><b>${name}</b><small>×${n}</small></div>`;
  const cells = res('wood', 'Wood', S.wood) + (S.scrap ? res('scrap', 'Scrap', S.scrap) : '') + (S.inv.sapling ? res('sapling', 'Tree sapling', S.inv.sapling) : '') +
    ids.filter((id) => S.inv[id] > 0).map((id) => `<div class="inv">${itemSvg(id)}<b>${ITEMS[id].name}</b><small>×${S.inv[id]}</small></div>`).join('') +
    Object.entries(S.barrels).map(([l, b]) => `<div class="inv">${FEATURE_ART.rainbarrel}<b>${lotName(l)} barrel</b><small>${b.w}/${regenMax()}</small></div>`).join('') +
    ['glycerin', 'vinegar'].filter((id) => S.inv[id] > 0 || S.owned.tincture).map((id) => `<div class="inv">${itemSvg(id)}<b>${BASES[id].name}</b><small>×${S.inv[id]}</small></div>`).join('') +
    SELL_ORDER.filter((id) => (id.startsWith('tinc_') || id.startsWith('oil_')) && S.inv[id] > 0).map((id) => `<div class="inv">${itemSvg(id)}<b>${ITEMS[id].name}</b><small>×${S.inv[id]}</small></div>`).join('');
  const feats = Object.keys(S.owned).filter((k) => S.owned[k]).map((k) => `<div class="row"><div class="ico">${FEATURE_ART[k]}</div><div class="meta"><b>${FEATURES[k].name}</b><small>${k === 'beehive' ? `${Object.keys(S.hives).length} placed (${Object.keys(S.hives).map(lotName).join(', ') || 'none yet'}) · +${HIVE_BONUS} flower per harvest on that plot only` : k === 'tincture' ? (S.tinctureBuilt ? 'Built · steep flowers with Glycerin or Vinegar' : 'Bought · build it from the Build menu') : FEATURES[k].blurb.replace('Once bought, ', '').replace('A reusable tool. ', '')}</small></div>${FEATURES[k].cooldownS ? `<div class="acts"><button class="btn btn-primary sm" data-act="use-${k}">Use</button></div>` : ''}</div>`).join('');
  return `<div class="inv-grid">${cells}</div>
    ${S.hiveInv > 0 ? `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="place-hive">🐝 Place your Honeybee Skep (${S.hiveInv})</button></div>` : ''}
    ${S.barrelInv > 0 ? `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="place-barrel"><i data-icon="water"></i> Place your Rain Barrel (${S.barrelInv})</button></div>` : ''}
    ${S.inv.sapling ? `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="place-sapling"><i data-icon="sapling"></i> Plant a sapling</button></div>` : ''}
    ${feats || irrigHTML() ? `<div class="sec-title">Garden features</div><div class="list">${irrigHTML()}${feats}</div>` : ''}
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
  const decor = Object.entries(S.decorInv).filter(([, n]) => n > 0).map(([t, n]) => `<div class="find-row"><div class="ico">${decorIcon(t)}</div><div class="meta"><b>${DECOR_INFO[t].name}${n > 1 ? ` ×${n}` : ''}</b><small>Restored decor · +${DECOR_INFO[t].atm} atmosphere when placed</small></div><div class="acts"><button class="btn btn-gold sm" data-place="${t}">Place</button><button class="btn sm" data-sell-restored="${kindOfDecor(t)}">Sell ${coin(buyback(RESALE.antique[kindOfDecor(t)]))}</button></div></div>`).join('');
  const bon = Object.values(FINDS).filter((f) => f.into.bonus && S.bonus[f.into.bonus]).map((f) => `<div class="row"><div class="ico">${findIcon(Object.keys(FINDS).find((k) => FINDS[k] === f))}</div><div class="meta"><b>${f.into.name}</b><small>${f.into.blurb} · <span class="ok-tag">Active</span></small></div><div class="acts"><button class="btn sm" data-sell-restored="${kindOfBonus(f.into.bonus)}">Sell ${coin(buyback(RESALE.antique[kindOfBonus(f.into.bonus)]))}</button></div></div>`).join('');
  const placed = S.decor.length ? `<p class="muted" style="margin:10px 4px 0">${S.decor.length} decor placed in your garden — tap one to move it back to your bag or sell it. Restored finds can also go on your <b>Farm Stand</b> as antiques (collectors pay more).</p>` : '';
  if (!raw && !restoring && !decor && !bon) return head + `<div class="empty">Nothing found yet. About one in five trees, stumps, bushes and rocks hides something — watch for a <b>sparkle</b> when you clear.</div>${placed}`;
  return head + (restoring ? `<div class="sec-title">In the workshop</div><div class="list">${restoring}</div>` : '') +
    (raw ? `<div class="sec-title">Found while clearing</div><div class="list">${raw}</div>` : '') +
    (decor ? `<div class="sec-title">Ready to place</div><div class="list">${decor}</div>` : '') +
    (bon ? `<div class="sec-title">Garden upgrades</div><div class="list">${bon}</div>` : '') + placed;
}
const BIG = (icon) => `<i data-icon="${icon}" style="width:56px;height:56px"></i>`;
// v0.41: Parking Lot (painted bays on the near lane by the Farm Stand) and Roadside Billboard (across the road) — fixed roadside spots
function placeWindmill(x, z) {
  const c = BUILDS.windmill.wood;
  if (S.windmillBuilt || building.windmill || !S.owned.windmill || S.wood < c) return false;
  S.windmillPos = { x, z, lot: lotAt(x, z) }; SPOTS.windmill = [x, z]; W.windmill.position.set(x, 0, z);
  S.wood -= c; S.windmillBuilt = true; building.windmill = true; save(); hud(); glideTo('windmill');
  setTimeout(() => W.buildAnim(W.windmill, [1.6, 3.4, 1.6], () => {
    building.windmill = false;   // barrels keep their progress; the next drop just arrives at the faster rate
    popAt(spotV('windmill', 3.6), `Windmill built! Barrels refill every ${regenS()} s`); tip('windmill'); hud(); checkGoals(); syncBarrels(); if (selected != null || focus) renderSheet();
  }), 500);
  return true;
}
function buildTraffic(id) {
  const c = BUILDS[id].wood, key = id + 'Built', nm = BUILDS[id].name;
  if (S[key] || building[id] || !S.owned[id]) return false;
  if (id === 'parking' && !S.standBuilt) { toast('Build the Farm Stand first — the Parking Lot goes beside it'); return false; }
  if (S.wood < c) { toast(`The ${nm} needs ${c} Wood`); return false; }
  S.wood -= c; S[key] = true; building[id] = true; save(); closePanel(); syncBlueprints(); hud();
  const obj = id === 'parking' ? W.parking : W.billboard; if (id === 'parking') W.setParking(parkCap());
  glideTo(id === 'parking' ? 'stand' : 'billboard');
  setTimeout(() => W.buildAnim(obj, id === 'parking' ? [7.8, 1.0, 1.6] : [3.6, 4.2, 0.9], () => {
    building[id] = false; popAt(id === 'parking' ? V3(W.parking.position.x, 1.4, W.parking.position.z) : spotV('billboard', 4.6), `${nm} built!`); tip(id); hud(); checkGoals();
    if (id === 'parking') nextCust = Math.min(nextCust, now() + 3000);
  }), 500);
  return true;
}
function bbStatusText() { return bbActive() ? `Ad running · ${fmtTime(S.bb.until - now())}` : bbReadyIn() > 0 ? `Free again in ${fmtTime(bbReadyIn())}` : 'Tap to Run ad'; }
function syncBillboard() {
  if (!S.billboardBuilt || building.billboard) return;
  const txt = bbStatusText(); W.setBillboard(bbActive(), txt);
  if (panel === 'billboard') { const n = $('#bb-status'); if (n && n.dataset.mode === (bbActive() ? 'on' : bbReadyIn() > 0 ? 'wait' : 'ready')) n.textContent = txt; else renderPanel(); }
}
function runAd(withJewel = false) {
  if (!S.billboardBuilt || bbActive()) return false;
  const wait = bbReadyIn();
  if (wait > 0 && !withJewel) return false;
  if (withJewel) { if (S.jewels < BILLBOARD.jewels) { toast('You need 1 Jewel'); openPanel('jewels'); return false; } S.jewels -= BILLBOARD.jewels; S.bb.jewelRuns = (S.bb.jewelRuns || 0) + 1; }
  const t = now(); S.bb.until = t + BILLBOARD.boostMs; S.bb.readyAt = t + BILLBOARD.cooldownMs; S.bb.runs = (S.bb.runs || 0) + 1;
  nextCust = Math.min(nextCust, t + 4000); nextPass = Math.min(nextPass, t + 2500);
  save(); hud(); syncBillboard(); if (panel === 'billboard') renderPanel();
  popAt(spotV('billboard', 4.8), `Ad running! ${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min`);
  return true;
}
function askRunAdJewel() {
  if (bbActive() || !bbReadyIn()) return runAd(false);
  confirmBox(`<i data-icon="jewel" class="confirm-ico"></i><h3>Run the ad now?</h3><p>Spend <b>${BILLBOARD.jewels} Jewel</b> to skip the ${fmtTime(bbReadyIn())} wait and run the ad now (${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min). You have ${S.jewels}.</p>`, `Run now · ${BILLBOARD.jewels} <i data-icon="jewel"></i>`, () => runAd(true));
  return true;
}
function billboardHTML() {
  const on = bbActive(), wait = bbReadyIn(), mode = on ? 'on' : wait > 0 ? 'wait' : 'ready';
  const btn = on ? `<button class="btn" disabled>Ad running…</button>`
    : wait > 0 ? `<button class="btn btn-gold" data-act="bb-jewel">Run now · ${BILLBOARD.jewels} <i data-icon="jewel"></i></button><small class="opt-note">The free ad is resting. You have ${S.jewels} Jewel${S.jewels === 1 ? '' : 's'}.</small>`
    : `<button class="btn btn-gold" data-act="bb-run">Run ad · free</button>`;
  return `<div class="row" style="align-items:center"><div class="ico" style="width:64px;height:64px">${FEATURE_ART.billboard}</div><div class="meta"><b>Roadside Billboard</b><small>${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} minutes: customers stop twice as often and twice as many cars pass. Free once an hour.</small></div></div>
    <div class="stand-status"><i data-icon="${on ? 'sun' : 'stand'}"></i><span id="bb-status" data-mode="${mode}">${bbStatusText()}</span></div>
    <div class="ts-actions" style="flex-direction:column;align-items:stretch;gap:6px">${btn}</div>
    <small class="muted">Ads run so far: ${S.bb.runs || 0}${S.bb.jewelRuns ? ` (${S.bb.jewelRuns} with a Jewel)` : ''}</small>`;
}
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
    if (S.rackBuilt) return card(BIG('rack'), 'Drying Rack', 'Dry Lavender to sell for almost 3×.', status('done', 'Built'));
    if (!S.rackAvail) return card(BIG('rack'), 'Drying Rack', 'Dry Lavender to sell for almost 3×.', status('lock', '<i data-icon="lock"></i> Harvest your first Lavender'), true);
    return card(BIG('rack'), 'Drying Rack', 'Dry Lavender to sell for almost 3×.', `<div class="cost">${woodTag(B.wood)} <span class="${S.wood >= B.wood ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-rack" ${S.wood >= B.wood ? '' : 'disabled'}><i data-icon="build"></i> Build Drying Rack</button>`);
  }
  if (id === 'windmill') {
    const art = FEATURE_ART.windmill, nm = 'Windmill', c = BUILDS.windmill.wood, sub = `Every connected rain barrel refills every ${WINDMILL.regenS[0]} s instead of ${WATER_REGEN_S} s (faster with card levels).`;
    if (S.windmillBuilt) return card(art, nm, sub, status('done', `Built · ${lotName(S.windmillPos?.lot || 'home')}`));
    if (!S.unlocked.windmill) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Find the Windmill card in a Card Pack'), true);
    if (!S.owned.windmill) return card(art, nm, sub, status('lock', `<i data-icon="lock"></i> ${S.marketBuilt ? `Buy it at the Supply Market (${FEATURES.windmill.price} coins)` : `Rebuild the Supply Market, then buy it there (${FEATURES.windmill.price} coins)`}`), true);
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-windmill" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button>`);
  }
  if (id === 'parking' || id === 'billboard') {
    const F = FEATURES[id], nm = F.name, c = BUILDS[id].wood, art = FEATURE_ART[id];
    const sub = id === 'parking' ? `Bays for ${parkCap() > 1 ? parkCap() : PARKING.cap} cars by your stand · customers come 30% more often · some buy one extra item.` : `Across the road · Run ad for ${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min, free once an hour.`;
    if (S[id + 'Built']) return card(art, nm, sub, status('done', 'Built'));
    if (!S.unlocked[id]) return card(art, nm, sub, status('lock', `<i data-icon="lock"></i> Find the ${nm} card in a Card Pack`), true);
    if (!S.owned[id]) return card(art, nm, sub, status('lock', `<i data-icon="lock"></i> ${S.marketBuilt ? `Buy it at the Supply Market (${F.price} coins)` : `Rebuild the Supply Market, then buy it there (${F.price} coins)`}`), true);
    if (id === 'parking' && !S.standBuilt) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Build the Farm Stand first'), true);
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-${id}" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Build ${id === 'parking' ? 'by the stand' : 'by the road'}</button>`);
  }
  if (id === 'still') {
    const art = `<img src="assets/card-still.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px"/>`, sub = 'Distill seeds in copper stills into essential oils that sell for a premium.', nm = 'Essential Oil Stand', c = BUILDS.still.wood;
    if (S.stillBuilt) return card(art, nm, sub, status('done', `Built · ${lotName(S.stillPos?.lot || 'home')}`));
    if (!S.unlocked.still) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Find the Essential Oil Stand card in a Card Pack'), true);
    if (!S.owned.still) return card(art, nm, sub, status('lock', `<i data-icon="lock"></i> ${S.marketBuilt ? `Buy it at the Supply Market (${FEATURES.still.price} coins)` : `Rebuild the Supply Market, then buy it there (${FEATURES.still.price} coins)`}`), true);
    if (!tincLots().length) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Buy a neighbouring plot first — it’s built on one of your other plots'), true);
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-still" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">Goes on one of your other plots (${tincLots().map(lotName).join(', ')})</small>`);
  }
  if (id === 'tincture') {
    const art = `<img src="assets/card-tincture.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px"/>`, sub = 'Steep flowers with Glycerin or Vinegar into tinctures that sell for far more.';
    if (S.tinctureBuilt) return card(art, 'Tincture Stand', sub, status('done', 'Built'));
    if (!S.unlocked.tincture) return card(art, 'Tincture Stand', sub, status('lock', '<i data-icon="lock"></i> Find the Tincture Stand card in a Card Pack'), true);
    if (!S.owned.tincture) return card(art, 'Tincture Stand', sub, status('lock', `<i data-icon="lock"></i> ${S.marketBuilt ? `Buy it at the Supply Market (${FEATURES.tincture.price} coins)` : `Rebuild the Supply Market, then buy it there (${FEATURES.tincture.price} coins)`}`), true);
    if (!tincLots().length) return card(art, 'Tincture Stand', sub, status('lock', '<i data-icon="lock"></i> Buy a neighbouring plot first — it’s built on one of your other plots'), true);
    const c = tincCost(), chime = S.decorInv.chime > 0;
    return card(art, 'Tincture Stand', sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      ${chime ? `<button class="opt ${useOpt.tincture ? 'on' : ''}" data-opt="tincture"><span class="tick"></span>${decorIcon('chime')}<span>${B.opt.label}</span></button>` : `<small class="opt-note">Optional: restored <b>Glass Bottles</b> (Bottle Chime) stock the shelves and save ${B.opt.save} Wood.</small>`}
      <button class="btn btn-gold" data-act="build-tincture" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">Goes on one of your other plots (${tincLots().map(lotName).join(', ')})</small>`);
  }
  if (id === 'barrel') {
    const need = barrelLots(), n = Object.keys(S.barrels).length, sub = `Its own water for one plot: 1 a minute (up to ${regenMax()}), feeds up to ${BARREL.maxBeds} irrigated beds in that plot.`;
    if (!S.barrel) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', sub, status('lock', '<i data-icon="lock"></i> Your first one comes free with your first raised bed'), true);
    if (S.barrelInv > 0 && need.length) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', `${sub} You have <b>${S.barrelInv}</b> to place in: <b>${need.map(lotName).join(', ')}</b>.`, `<button class="btn btn-primary" data-act="place-barrel"><i data-icon="build"></i> Place Rain Barrel</button>`);
    if (!need.length) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', `${sub} One per plot · ${n} placed.`, status('done', LOT_FOR_SALE.every((l) => S.lots[l]) ? 'Every plot has one' : 'Every plot you own has one · buy more land for another'));
    return card(FEATURE_ART.rainbarrel, 'Rain Barrel', `${sub} Needed in: <b>${need.map(lotName).join(', ')}</b>.`, S.marketBuilt ? `<div class="cost">${coin(BARREL.price)} at the Supply Market</div><button class="btn" data-act="open-market">Buy one at the Market</button>` : status('lock', `<i data-icon="lock"></i> Rebuild the Supply Market to buy one (${BARREL.price} coins)`), !S.marketBuilt);
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
  return `<div class="build-list">${bed}${projectCard('barrel')}${projectCard('stand')}${projectCard('rack')}${projectCard('market')}${projectCard('tincture')}${projectCard('still')}${projectCard('windmill')}${projectCard('parking')}${projectCard('billboard')}${tree}</div>
    <div class="sec-title">Your land</div><div class="list">${LOT_FOR_SALE.concat(['home']).filter((l) => S.lots[l]).map((l) => `<div class="row"><div class="ico"><i data-icon="sign" style="width:30px;height:30px"></i></div><div class="meta"><b>${LOTS[l].name}</b><small>${SITES.filter((s) => s.lot === l && S.beds.includes(s.id)).length}/4 beds · ${S.barrels[l] ? `barrel ${S.barrels[l].w}/${regenMax()}` : 'no barrel'} · ${OBSTACLES.filter((o) => o.lot === l && obsState(o.id) !== 'gone').length} trees &amp; stumps left</small></div></div>`).join('')}</div>
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
  const onStand = SELL_ORDER.filter((id) => S.stand[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name} ×${S.stand[id]}</b><small>${sellOf(id)} coins each</small></div><div class="acts"><button class="btn sm" data-unstock="${id}">Take back</button></div></div>`).join('');
  const fromBag = SELL_ORDER.filter((id) => S.inv[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>You have ${S.inv[id]} · sells for ${sellOf(id)}</small></div>
    <div class="acts"><button class="btn sm" data-stock="${id}" data-n="1" ${used >= cap ? 'disabled' : ''}>+1</button><button class="btn btn-gold sm" data-stock="${id}" data-n="all" ${used >= cap ? 'disabled' : ''}>Stock all</button></div></div>`).join('');
  const status = custs.length ? `<b>${custs.length > 1 ? `${custs.length} customers are` : 'A customer is'} at your stand!</b>` : used ? `Next customer in about ${fmtTime(Math.max(0, nextCust - now()))}` : 'Put items on the stand to attract customers.';
  const prog = !S.marketAvail ? `<div class="goal-mini"><small>Earn ${MARKET_GOAL} coins here to start rebuilding the Supply Market</small><span class="gbar"><em style="width:${Math.min(100, (S.stats.standEarned / MARKET_GOAL) * 100)}%"></em></span><small>${Math.min(S.stats.standEarned, MARKET_GOAL)} / ${MARKET_GOAL}</small></div>` : `<p class="muted" style="margin:0 4px 8px">Earned at your stand: ${coin(S.stats.standEarned)}${atmosphere() ? ` · atmosphere ${atmosphere()}` : ''}</p>`;
  return `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh flowers by the road</p></div>
    <div class="stand-status"><i data-icon="stand"></i><span id="stand-status">${status}</span></div>${prog}${rewardHTML()}
    <div class="sec-title">On your stand · ${used}/${cap}${S.bonus.crate ? ' · crate shelf' : ''}</div>
    ${onStand ? `<div class="list">${onStand}</div>` : '<div class="empty">The stand is empty.</div>'}
    ${antiquesHTML(used >= cap)}
    <div class="sec-title">From your satchel</div>
    ${fromBag ? `<div class="list">${fromBag}</div>` : '<div class="empty">Nothing to sell yet — harvest some blooms first.</div>'}
    <p class="muted" style="margin:14px 4px 0;text-align:center"><button class="link-btn" data-act="sell-stand">Sell the Farm Stand?</button></p>`;
}
function stock(id, n) {
  const space = standCap() - standCount(); const q = Math.min(space, n === 'all' ? S.inv[id] : 1, S.inv[id]); if (q <= 0) return;
  const wasEmpty = standCount() === 0;
  S.inv[id] -= q; S.stand[id] = (S.stand[id] || 0) + q; S.stats.stocked += q;
  if (wasEmpty && !custs.length) nextCust = Math.max(nextCust, now() + (S.stats.customers ? 6000 : 3500));
  syncStand(); save(); hud(); renderPanel(); checkGoals();
}
function unstock(id) { const q = S.stand[id] || 0; if (!q) return; if (ITEMS[id]?.antique) { for (let n = 0; n < q; n++) giveRestored(ITEMS[id].antique); } else S.inv[id] += q; delete S.stand[id]; syncStand(); save(); hud(); renderPanel(); }

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
  { const need = barrelLots(), more = need.length - (S.barrelInv || 0);   // v0.4: no water for sale — buy a placeable Rain Barrel for a plot instead
    rows.push(!S.unlocked.rainbarrel ? lockedRow(FEATURE_ART.rainbarrel, 'Rain Barrel')
      : more > 0 ? buyRow('barrel', FEATURE_ART.rainbarrel, 'Rain Barrel', `Place it in ${need.map(lotName).join(' or ')} · collects 1 water a minute only when that plot has a stand (roof gutter) · feeds up to ${BARREL.maxBeds} beds`, BARREL.price)
      : `<div class="row"><div class="ico">${FEATURE_ART.rainbarrel}</div><div class="meta"><b>Rain Barrel</b><small>${S.barrelInv > 0 ? `You have ${S.barrelInv} to place` : 'Every plot you own has its barrel · buy more land for another'}</small></div>${S.barrelInv > 0 ? '<div class="acts"><button class="btn btn-primary sm" data-act="place-barrel">Place</button></div>' : ''}</div>`); }
  // v0.5: every unlocked plant is for sale (tier-coloured label, grow time, flower price). Locked Basic plants keep their own row;
  // locked higher-tier plants are folded into one compact row per tier so the list stays short.
  for (const t of TIER_ORDER) { const sps = Object.keys(SPECIES).filter((sp) => SPECIES[sp].tier === t), T = PLANT_TIERS[t];
    for (const sp of sps) { const d = SPECIES[sp]; if (S.unlocked[sp]) rows.push(buyRow('seed_' + sp, `<img src="${d.img}" alt=""/>`, `${d.name} Seeds`, `<em class="tier-tag t-${t}">${T.label}</em> · blooms in ~${fmtTime(d.growS * 1000)} · flowers sell for ${d.flowerSell} · you have ${S.inv['seed_' + sp]}`, d.seedPrice));
      else if (t === 'basic') rows.push(lockedRow(`<img src="${d.img}" alt=""/>`, `${d.name} Seeds`)); }
    const locked = sps.filter((sp) => !S.unlocked[sp]);
    if (t !== 'basic' && locked.length) rows.push(`<div class="row locked tier-locked" data-tier-locked="${t}"><div class="ico"><span class="tier-gem t-${t}"></span></div><div class="meta"><b><em class="tier-tag t-${t}">${T.label}</em> ${locked.length === sps.length ? `${sps.length} plants` : `${locked.length} more`}</b><small>Discover ${locked.map((sp) => SPECIES[sp].name).join(', ')} in Card Packs (${T.pack}% a card)</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`); }
  rows.push(S.unlocked.irrigation ? buyRow('irrigation', FEATURE_ART.irrigation, `Irrigation card${S.irrigN ? ` · you have ${S.irrigN}` : ''}`, 'Waters one raised bed from your rain barrel. One card per bed.', FEATURES.irrigation.price) + (irrigFree() > 0 && S.beds.length > S.irrigBeds.length ? `<div class="ts-actions" style="margin:-4px 0 6px"><button class="btn sm" data-act="assign-irrig">Assign a spare card to a bed</button></div>` : '') : lockedRow(FEATURE_ART.irrigation, 'Irrigation'));
  const tf = FEATURES.tincture;
  rows.push(S.owned.tincture ? `<div class="row"><div class="ico">${FEATURE_ART.tincture}</div><div class="meta"><b>${tf.name}</b><small>${S.tinctureBuilt ? `Owned · built on ${lotName(S.tincPos?.lot || 'home')}` : tincLots().length ? 'Owned · build it on one of your other plots (Build menu)' : 'Owned · buy a neighbouring plot, then build it there'}</small></div></div>`
    : S.unlocked.tincture ? buyRow('tincture', FEATURE_ART.tincture, tf.name, `${ftag('tincture')} · then build it (${BUILDS.tincture.wood} Wood) to make tinctures`, tf.price) : lockedRow(FEATURE_ART.tincture, tf.name));
  { const sf = FEATURES.still;
    rows.push(S.owned.still ? `<div class="row"><div class="ico">${FEATURE_ART.still}</div><div class="meta"><b>${sf.name}</b><small>${S.stillBuilt ? `Owned · built on ${lotName(S.stillPos?.lot || 'home')}` : tincLots().length ? 'Owned · build it on one of your other plots (Build menu)' : 'Owned · buy a neighbouring plot, then build it there'}</small></div></div>`
      : S.unlocked.still ? buyRow('still', FEATURE_ART.still, sf.name, `${ftag('still')} · then build it (${BUILDS.still.wood} Wood) on another plot to distill seeds into oils`, sf.price) : lockedRow(FEATURE_ART.still, sf.name)); }
  { const F = FEATURES.windmill;   // v0.41 Windmill
    rows.push(S.owned.windmill ? `<div class="row"><div class="ico">${FEATURE_ART.windmill}</div><div class="meta"><b>${F.name}</b><small>${S.windmillBuilt ? `Owned · turning on ${lotName(S.windmillPos?.lot || 'home')} · barrels refill every ${regenS()} s` : 'Owned · build it anywhere on your land (Build menu)'}</small></div></div>`
      : S.unlocked.windmill ? buyRow('windmill', FEATURE_ART.windmill, F.name, `${ftag('windmill')} · build once anywhere (${BUILDS.windmill.wood} Wood) · all connected barrels refill every ${WINDMILL.regenS[0]} s instead of ${WATER_REGEN_S} s`, F.price) : lockedRow(FEATURE_ART.windmill, F.name)); }
  for (const id of ['parking', 'billboard']) { const F = FEATURES[id], B = BUILDS[id];   // v0.41 traffic cards
    rows.push(S.owned[id] ? `<div class="row"><div class="ico">${FEATURE_ART[id]}</div><div class="meta"><b>${F.name}</b><small>${S[id + 'Built'] ? 'Owned · built by the road' : 'Owned · build it by the road (Build menu)'}</small></div></div>`
      : S.unlocked[id] ? buyRow(id, FEATURE_ART[id], F.name, `${ftag(id)} · then build it by the road (${B.wood} Wood) · ${id === 'parking' ? '2–3 cars at once, 30% shorter gaps, +1 item sometimes' : `Run ad: ${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min, free hourly`}`, F.price) : lockedRow(FEATURE_ART[id], F.name)); }
  for (const b of ['glycerin', 'vinegar']) { const d = BASES[b];
    rows.push(buyRow(b, itemSvg(b), d.name, `${d.blurb} · you have ${S.inv[b]}`, d.price) + buyRow(b + '5', itemSvg(b), `${d.name} ×${d.pack.n}`, `Pack of ${d.pack.n} · save ${d.price * d.pack.n - d.pack.price} coins`, d.pack.price)); }
  { const d = FEATURES.beehive, need = hiveLots(), more = need.length - (S.hiveInv || 0);
    rows.push(!S.unlocked.beehive ? lockedRow(FEATURE_ART.beehive, d.name)
      : more > 0 ? buyRow('beehive', FEATURE_ART.beehive, d.name, `${ftag('beehive')} · place it on ${need.map(lotName).join(' or ')} · +${HIVE_BONUS} flower per harvest on that plot only · one per plot`, d.price)
      : `<div class="row"><div class="ico">${FEATURE_ART.beehive}</div><div class="meta"><b>${d.name}</b><small>${S.hiveInv > 0 ? `You have ${S.hiveInv} to place` : `${Object.keys(S.hives).length} placed · every plot you own has one`}</small></div>${S.hiveInv > 0 ? '<div class="acts"><button class="btn btn-primary sm" data-act="place-hive">Place</button></div>' : ''}</div>`); }
  for (const f of ['sundial', 'sickle', 'plow']) {
    const d = FEATURES[f];
    if (S.owned[f]) rows.push(`<div class="row"><div class="ico">${FEATURE_ART[f]}</div><div class="meta"><b>${d.name}</b><small>Owned · ${d.blurb.replace('Once bought, ', '').replace('A reusable tool. ', '')}</small></div>${d.cooldownS ? `<div class="acts"><button class="btn btn-primary sm" data-act="use-${f}">Use</button></div>` : ''}</div>`);
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
  else if (id === 'barrel') { if (barrelLots().length <= (S.barrelInv || 0)) { S.coins += price; return; } S.barrelInv = (S.barrelInv || 0) + 1; } else if (id.startsWith('seed_')) S.inv[id]++; else if (id === 'irrigation') S.irrigN++; else if (BASES[id]) S.inv[id]++; else if (BASES[id.slice(0, -1)]) S.inv[id.slice(0, -1)] += BASES[id.slice(0, -1)].pack.n; else if (id === 'beehive') { if (hiveLots().length <= (S.hiveInv || 0)) { S.coins += price; return; } S.hiveInv = (S.hiveInv || 0) + 1; S.owned.beehive = true; } else if (FEATURES[id]) S.owned[id] = true;
  save(); hud(); renderPanel();
  if (id === 'beehive') { toast('Honeybee Skep bought — tap clear ground on the plot it should help'); setTimeout(() => enterPlace('hive'), 500); return; }
  if (id === 'barrel') { toast('Rain Barrel bought — tap open ground in the plot that needs it'); setTimeout(() => enterPlace('barrel'), 500); return; }
  if (id === 'sickle' || id === 'plow') { toast(`${FEATURES[id].name} bought — tap its button on the left to use it`); setTimeout(() => tip(id), 600); return; }
  if (id === 'windmill') { toast('Windmill bought — build it anywhere on your land from the Build menu (20 Wood)'); return; }
  if (id === 'parking' || id === 'billboard') { syncBlueprints(); toast(`${FEATURES[id].name} bought — build it by the road from the Build menu (${BUILDS[id].wood} Wood)`); return; }
  if (id === 'still') { toast(tincLots().length ? 'Essential Oil Stand bought — build it on one of your other plots (Build menu)' : 'Essential Oil Stand bought — buy a neighbouring plot first, then build it there'); return; }
  if (id === 'tincture') { syncBlueprints(); toast(tincLots().length ? 'Tincture Stand bought — build it on one of your other plots (Build menu)' : 'Tincture Stand bought — buy a neighbouring plot first, then build it there'); return; }
  if (BASES[id] || BASES[id.slice(0, -1)]) { const b = BASES[id] ? id : id.slice(0, -1); toast(`+${BASES[id] ? 1 : BASES[b].pack.n} ${BASES[b].name} · you have ${S.inv[b]}`); return; }
  if (id === 'irrigation') { toast('Irrigation card bought — now tap a raised bed to irrigate it'); setTimeout(() => enterPlace('irrigation'), 500); return; }
  toast(id === 'wood5' ? `+${SHOP.wood5.wood} Wood` : id === 'sapling' ? 'Bought a tree sapling — plant it from Build or your Bag' : id.startsWith('seed_') ? `Bought 1 ${ITEMS[id].name.replace(' Seeds', ' seed')}` : `${FEATURES[id].name} added to your garden`);
}
function packsHTML() {
  const disc = Object.keys(CARDS).filter((k) => S.discovered[k]);
  // v0.5: odds per card, by plant tier (plus all feature cards together)
  // v0.51: one tier system for every card. Each chip is that tier's share of a card slot (its plants + its feature cards).
  const odds = TIER_ORDER.map((t) => `<span class="t-${t}" style="border-color:${PLANT_TIERS[t].color};color:${PLANT_TIERS[t].color}">${PLANT_TIERS[t].label} ${+tierOdds(t).toFixed(2)}%</span>`).join('');
  const group = (title, ids, cls = '') => `<div class="sec-title coll-tier ${cls}">${title} · ${ids.filter((k) => S.discovered[k]).length}/${ids.length}</div><div class="coll">${ids.map((k) => (S.discovered[k] ? cardHTML(k) : `<div class="card"><div class="back" style="position:absolute;inset:0;border-radius:1.1em;opacity:.55"><img src="assets/emblem.png" alt=""/><span>?</span></div></div>`)).join('')}</div>`;
  return `<div class="pack-hero"><div class="pack-art"><img src="assets/pack.jpg" alt="Botanical card pack"/></div>
    <div class="pack-info"><h4>Botanical Card Pack</h4><p>3 illustrated cards. New discoveries unlock seeds &amp; features here at the market.</p>
    ${S.jewels >= PACK_JEWELS ? `<button class="btn btn-gold" data-act="buy-pack">Open pack · ${jewelPrice(PACK_JEWELS)}</button>`
      : `<button class="btn btn-gold need-jewels" data-act="open-jewels">Need ${PACK_JEWELS} Jewel${PACK_JEWELS > 1 ? 's' : ''} · Jewel Shop</button>`}
    <small class="pack-note">You have ${S.jewels} <i data-icon="jewel"></i> · Jewels come from the Jewel Shop or, rarely, the woods</small></div></div>
    <div class="odds">${odds}</div>
    <div class="sec-title">Your collection · ${disc.length}/${Object.keys(CARDS).length}</div>
    ${TIER_ORDER.map((t) => { const pl = Object.keys(SPECIES).filter((k) => SPECIES[k].tier === t), fe = Object.keys(FEATURES).filter((k) => FEATURES[k].rarity === t);
      return group(`<em class="tier-tag t-${t}">${PLANT_TIERS[t].label}</em> ${+tierOdds(t).toFixed(2)}% a card · ${pl.length} plants${fe.length ? ` + ${fe.length} feature${fe.length > 1 ? 's' : ''}` : ''}`, [...pl, ...fe], 't-' + t); }).join('')}`;
}

// v0.5 Drying Rack: any dryable herb (DRYING). Each slot remembers its plant (old slots without one are Lavender).
const dryables = () => Object.keys(DRYING).filter((sp) => sp === 'lavender' || S.unlocked[sp] || S.inv['flower_' + sp] > 0 || S.inv['dried_' + sp] > 0);
const rackPick = () => Object.keys(DRYING).find((sp) => S.inv['flower_' + sp] > 0);
function rackHTML() {
  const pick = rackPick();
  const slots = S.rack.map((r, k) => {
    if (!r) return `<button class="slot" data-slot="${k}">${itemIcon('bundle', '#EFE6D6').replace('<svg', '<svg class="bundle" opacity=".5"')}<span>${pick ? `Tap to hang ${SPECIES[pick].name}` : 'Empty'}</span></button>`;
    const sp = r.sp || 'lavender', left = r.ms - (now() - r.start);
    if (left <= 0) return `<button class="slot done" data-slot="${k}">${itemSvg('dried_' + sp).replace('<svg', '<svg class="bundle"')}<span>Dried ${SPECIES[sp].name}! Tap to collect</span></button>`;
    const k2 = 1 - left / r.ms, C = 2 * Math.PI * 22;
    return `<div class="slot drying"><svg class="ring" viewBox="0 0 54 54"><circle cx="27" cy="27" r="22" fill="none" stroke="#F3E3DA" stroke-width="5"/><circle cx="27" cy="27" r="22" fill="none" stroke="#F2AEB3" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - k2)}" transform="rotate(-90 27 27)"/></svg><span data-left="${k}">${fmtTime(left)}</span></div>`;
  }).join('');
  const rows = dryables().map((sp) => { const d = SPECIES[sp], f = 'flower_' + sp;
    return `<div class="row"><div class="ico">${itemSvg(f)}</div><div class="meta"><b>Fresh ${d.name} ×${S.inv[f]}</b><small>Dries in ${DRYING[sp].s}s · sells for ${sellOf('dried_' + sp)} (fresh: ${sellOf(f)})</small></div>
    <div class="acts"><button class="btn btn-blush sm" data-act="fill-rack" data-sp="${sp}" ${S.inv[f] && S.rack.includes(null) ? '' : 'disabled'}>Hang all</button></div></div>`; }).join('');
  const dried = dryables().filter((sp) => S.inv['dried_' + sp] > 0).map((sp) => `${S.inv['dried_' + sp]} Dried ${SPECIES[sp].name}`);
  return `<div class="hero"><img src="assets/rack.jpg" alt=""/><p>Hang fresh ${dryables().length > 1 ? 'herbs' : 'Lavender'} to dry</p></div><div class="slots">${slots}</div>
    ${rows}
    ${dried.length ? `<p class="muted" style="margin:10px 4px 0">You have ${dried.join(', ')} — put it on your Farm Stand.</p>` : ''}`;
}
const hang = (k, sp = rackPick()) => { const f = 'flower_' + sp; if (S.rack[k] || !sp || !DRYING[sp] || !(S.inv[f] > 0)) return false; S.inv[f]--; S.rack[k] = { start: now(), ms: DRYING[sp].s * 1000, sp }; return true; };
function collect(k) { const r = S.rack[k]; if (!r || now() - r.start < r.ms) return; const sp = r.sp || 'lavender', id = 'dried_' + sp; S.rack[k] = null; S.inv[id] = (S.inv[id] || 0) + 1; toast(`+1 ${ITEMS[id].name}`); }
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
function tradeJewel(what) {
  if (!spendJewels(1)) return;
  if (what === 'coins') S.coins += JEWEL_EXCHANGE.coins; else S.wood += JEWEL_EXCHANGE.wood;
  S.stats.jewelsTraded = (S.stats.jewelsTraded || 0) + 1; save(); hud(); renderPanel();
  toast(what === 'coins' ? `Traded 1 Jewel for ${JEWEL_EXCHANGE.coins} coins` : `Traded 1 Jewel for ${JEWEL_EXCHANGE.wood} Wood`);
}
function jewelsHTML() {
  const cards = JEWEL_BUNDLES.map((b) => `<button class="jewel-card${b.best ? ' best' : ''}" data-jewels="${b.id}">${b.best ? '<span class="best-tag">Best value</span>' : ''}
    <span class="jc-art">${'<i data-icon="jewel"></i>'.repeat(b.n >= 50 ? 3 : b.n >= 10 ? 2 : 1)}</span><b>${b.n} Jewel${b.n > 1 ? 's' : ''}</b><em>${b.price}</em></button>`).join('');
  return `<div class="jewel-hero"><i data-icon="jewel"></i><div><b>${S.jewels}</b><small>Jewels</small></div></div>
    <p class="muted" style="margin:6px 4px 12px">Jewels open Card Packs (${PACK_JEWELS} each), finish a restoration instantly (${RESTORE_HURRY_JEWELS}), grow a planted tree by a stage (${TREE.hurryJewels}) or complete the market rebuild (${BUILDS.market.hurryJewels}).</p>
    <div class="jewel-grid">${cards}</div>
    <div class="sec-title">Spend Jewels</div>
    <div class="list jewel-trades">
      <div class="row"><div class="ico"><img src="assets/pack.jpg" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px"/></div><div class="meta"><b>${PACKS.standard.name}</b><small>${PACKS.standard.cards} cards · ${PACK_JEWELS} Jewel each, in Market › Card Packs</small></div><button class="btn btn-gold sm" data-act="go-packs">Packs</button></div>
      <div class="row"><div class="ico"><i data-icon="coin" style="width:36px;height:36px"></i></div><div class="meta"><b>${JEWEL_EXCHANGE.coins} coins</b><small>Trade 1 Jewel</small></div><button class="btn btn-gold sm" data-act="trade-coins" ${S.jewels < 1 ? 'disabled' : ''}>${jewelPrice(1)}</button></div>
      <div class="row"><div class="ico"><i data-icon="wood" style="width:36px;height:36px"></i></div><div class="meta"><b>${JEWEL_EXCHANGE.wood} Wood</b><small>Trade 1 Jewel</small></div><button class="btn btn-gold sm" data-act="trade-wood" ${S.jewels < 1 ? 'disabled' : ''}>${jewelPrice(1)}</button></div>
    </div>
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
  if (b.dataset.upgrade) { upgradeCard(b.dataset.upgrade); return; }
  if (b.dataset.stockAntique) return stockAntique(b.dataset.stockAntique);
  if (b.dataset.sellRestored) return sellRestored(b.dataset.sellRestored);
  if (b.dataset.stock) return stock(b.dataset.stock, b.dataset.n);
  if (b.dataset.unstock) return unstock(b.dataset.unstock);
  if (b.dataset.buy) return buy(b.dataset.buy, +b.dataset.price);
  if (b.dataset.restore) return restore(b.dataset.restore);
  if (b.dataset.recycle) return recycle(b.dataset.recycle);
  if (b.dataset.hurry) return hurryRestore(+b.dataset.hurry);
  if (b.dataset.place) return enterPlace('decor', b.dataset.place);
  if (b.dataset.jewels) return askBuyJewels(b.dataset.jewels);
  if (b.dataset.opt) { useOpt[b.dataset.opt] = !useOpt[b.dataset.opt]; renderPanel(); return; }
  if (b.dataset.base) { S.tincBase = b.dataset.base; save(); renderPanel(); return; }
  if (b.dataset.distill) return distill(b.dataset.distill);
  if (b.dataset.scollect != null) return collectOil(+b.dataset.scollect);
  if (b.dataset.craft) return craftTincture(b.dataset.craft);
  if (b.dataset.tcollect != null) return collectTincture(+b.dataset.tcollect);
  if (b.dataset.unhook) return unhookIrrigation(b.dataset.unhook);
  if (b.dataset.slot != null) { const k = +b.dataset.slot; if (S.rack[k]) collect(k); else hang(k); afterRack(); return; }
  const a = b.dataset.act;
  if (a === 'fill-rack') { const sp = b.dataset.sp || 'lavender'; for (let k = 0; k < RACK_SLOTS; k++) hang(k, sp); afterRack(); return; }
  if (a === 'buy-pack') return buyPack();
  if (a === 'place-bed') return enterBuild();
  if (a === 'place-sapling') return enterPlace('sapling');
  if (a === 'assign-irrig') return enterPlace('irrigation');
  if (a === 'build-stand') return buildStand();
  if (a === 'build-rack') return buildRack();
  if (a === 'build-tincture') return buildTincture();
  if (a === 'build-still') return buildStill();
  if (a === 'build-parking') return buildTraffic('parking');
  if (a === 'build-windmill') return enterPlace('windmill');
  if (a === 'build-billboard') return buildTraffic('billboard');
  if (a === 'bb-run') return runAd(false);
  if (a === 'bb-jewel') return askRunAdJewel();
  if (a === 'place-barrel') return enterPlace('barrel');
  if (a === 'place-hive') return enterPlace('hive');
  if (a === 'use-sickle' || a === 'use-plow') return useTool(a.slice(4));
  if (a === 'open-market') return openPanel('market', 'buy');
  if (a === 'build-market') return startMarket();
  if (a === 'hurry-market') return hurryMarket();
  if (a === 'open-jewels') return openPanel('jewels');
  if (a === 'sell-stand') return sellPlaced({ kind: 'stand' });
  if (a === 'go-packs') { if (!S.marketBuilt) { toast('Card Packs are sold at the Supply Market — rebuild it first'); return; } return openPanel('market', 'packs'); }
  if (a === 'trade-coins' || a === 'trade-wood') return tradeJewel(a.slice(6));
  if (a === 'watch-ad') return watchAd();
  if (a === 'tips-again') { S.tips = {}; save(); closePanel(); const g = GOALS[S.goal]; tip(g ? g.hint : 'chop'); return; }
  if (a === 'reset') return confirmBox('<h3>Reset your garden?</h3><p class="muted">This erases all progress on this device and starts again in the woods.</p>', 'Reset', () => {
    clearTimeout(saveTimer); localStorage.removeItem(SAVE_KEY); localStorage.removeItem(V02_KEY); S = null; location.reload(); });
  if (a === 'buy-lot') return buyLot(b.dataset.lot);
  if (b.dataset.card === 'irrigation' && !b.classList.contains('card')) return irrigFree() > 0 && S.beds.length > S.irrigBeds.length ? enterPlace('irrigation') : zoomCard('irrigation');
  if (b.classList.contains('card') && b.dataset.card) zoomCard(b.dataset.card);
});

// ---------------- Customers ----------------
const testHold = { sales: false, front: false };   // test hook: keep parked customers browsing (for screenshots of a full lot)
let custs = [], nextCust = now() + 4000, nextPass = now() + 9000;   // v0.41: several customers can park at once (Parking Lot)
// v0.41 traffic: Parking Lot (more bays, shorter gaps, extra item) and Billboard (Run ad: 2× traffic for 5 min)
const parkCap = () => (S.parkingBuilt ? (cardLv('parking') >= 2 ? PARKING.capLv2 : PARKING.cap) : 1);
const bbActive = () => !!S.billboardBuilt && now() < (S.bb?.until || 0);
const bbReadyIn = () => Math.max(0, (S.bb?.readyAt || 0) - now());
const trafficMult = () => (S.parkingBuilt ? PARKING.gapMult : 1) / (bbActive() ? BILLBOARD.mult : 1);   // multiplies the gap between cars
const extraItemChance = () => (S.parkingBuilt ? PARKING.extraItem + CARD_LEVELS.parking.extraItem * (cardLv('parking') - 1) : 0);
const custGap = () => randInt(15000, 30000) * atmosMult() * trafficMult();
function pickWants() {
  const avail = SELL_ORDER.filter((id) => S.stand[id] > 0); if (!avail.length) return [];
  const types = avail.sort(() => Math.random() - 0.5).slice(0, avail.length > 1 && Math.random() < 0.4 ? 2 : 1);
  const wants = types.map((id) => ({ id, n: randInt(1, Math.min(3, S.stand[id])) }));
  if (Math.random() < extraItemChance()) { const w = wants[0]; w.n++; w.extra = true; }   // Parking Lot: "while I'm here…" +1 item (if the stand still has it)
  return wants;
}
function spawnCustomer() {
  const wants = pickWants(); if (!wants.length) return null;
  const bubble = el('div', 'bubble hidden'); $('#popups').appendChild(bubble);
  const c = { wants, bubble, car: null, slot: custs.length, done: false };
  custs.push(c);
  c.car = W.spawnCar({ stopX: PARK_X[c.slot], onPark: () => {
    bubble.innerHTML = `<span class="think">${wants.map((w) => `<span class="want">${itemSvg(w.id)}<b>×${w.n}</b></span>`).join('')}</span>`;
    bubble.classList.remove('hidden'); tip('customer'); if (panel === 'stand') renderPanel();
    const pay = () => (testHold.sales && !(testHold.front && custs[0] === c) ? setTimeout(pay, 500) : purchase(c)); setTimeout(pay, 1900);
  } });
  nextCust = now() + custGap();
  return c;
}
function purchase(c) {
  if (!c || c.paid) return; c.paid = true;
  let total = 0, items = 0, extra = 0;
  for (const w of c.wants) { const q = Math.min(w.n, S.stand[w.id] || 0); if (!q) continue; S.stand[w.id] -= q; if (!S.stand[w.id]) delete S.stand[w.id]; total += q * sellOf(w.id); items += q; if (w.extra && q === w.n) extra = 1; }
  if (total) {
    S.coins += total; S.stats.standEarned += total; S.stats.sold += items; S.stats.customers++; if (extra) S.stats.extraItems = (S.stats.extraItems || 0) + 1;
    if (S.stats.customers % ADS.interstitialEverySales === 0) setTimeout(() => Ads.maybeBreak('sales', adBlocked()), 2600);
    c.bubble.innerHTML = `<span class="thanks">${extra ? '♥ One more, please!' : '♥ Thank you!'}</span>`;
    const p = c.car.group.position; popAt(new THREE.Vector3(p.x, 1.9, p.z), `<i data-icon="coin"></i>+${total}`, 'coinpop');
    for (let k = 0; k < Math.min(6, items + 2); k++) setTimeout(() => coinFly(c.car.group.position), k * 90);
  } else c.bubble.innerHTML = `<span class="thanks">Sold out… next time!</span>`;
  syncStand(); save(); hud(); checkGoals(); if (panel === 'stand') renderPanel();
  setTimeout(() => { c.done = true; leaveQueue(); }, 1400);
}
// cars leave front-first; the ones behind pull forward one bay so nobody drives through a parked car
function leaveQueue() {
  let moved = false;
  while (custs.length && custs[0].done) { const c = custs.shift(); c.car.leave(); c.bubble.remove(); moved = true; }
  if (!moved) return;
  custs.forEach((c, k) => { if (c.slot !== k) { c.slot = k; c.car.stopX = PARK_X[k]; if (c.car.state === 'park') c.car.state = 'in'; } });
  nextCust = parkCap() > 1 ? Math.max(nextCust, now() + 2500) : now() + custGap();   // without a Parking Lot the gap starts when the car leaves (as before)
  if (panel === 'stand') renderPanel();
}
function coinFly(pos) {
  const s = W.project(new THREE.Vector3(pos.x, 1.4, pos.z)); const t = $('#pill-coins').getBoundingClientRect();
  const c = el('div', 'coin-fly', ICONS.coin); c.style.left = s.x + 'px'; c.style.top = s.y + 'px'; c.style.setProperty('--tx', (t.left + t.width * 0.25 - s.x) + 'px'); c.style.setProperty('--ty', (t.top + t.height / 2 - s.y) + 'px');
  $('#popups').appendChild(c); setTimeout(() => c.remove(), 900);
}
W.frameHooks.push(() => {
  for (const c of custs) if (c.bubble && c.car) { const p = c.car.group.position; const s = W.project(new THREE.Vector3(p.x, 2.15, p.z)); c.bubble.style.left = s.x + 'px'; c.bubble.style.top = s.y + 'px'; }
});

// ---------------- Cards ----------------
function cardHTML(id, extra = '') {
  const c = CARDS[id]; const r = RARITY[c.rarity]; const ct = cardTier(c), rl = PLANT_TIERS[ct]?.label || r.label;   // v0.51: every card (plant or feature) shows its tier
  const st = S.cards?.[id], lv = st?.lv || 1, bump = c.tier ? (lv - 1) * CARD_LEVELS.plant.statPip : 0;
  const statsOf = bump ? { ...c.stats, Beauty: Math.min(5, c.stats.Beauty + bump), Yield: Math.min(5, c.stats.Yield + bump) } : c.stats;
  if (st && (st.n > 1 || lv > 1)) extra += `${st.n > 1 ? `<span class="stack-badge">×${st.n}</span>` : ''}${CARD_LEVELS.upgradable(id, c) ? `<span class="lv-badge">Lv${lv}</span>` : ''}`;
  const art = SPECIES[id] || c.img ? `<img src="${c.img}" alt=""/>` : FEATURE_ART[id];
  const stats = Object.entries(statsOf).map(([k, v]) => `<span>${k}</span><span class="pips">${[1, 2, 3, 4, 5].map((n) => `<b class="${n <= v ? 'on' : ''}"></b>`).join('')}</span>`).join('');
  return `<div class="card r-${ct} t-${ct}${c.tier ? ' plant-card' : ' feature-card'}${S.cards && canUpgrade(id) ? ' can-up' : ''}" data-card="${id}">${extra}<div class="card-face"><div class="card-rar">${rl}</div><div class="card-art">${art}</div>
    <div class="card-name">${c.name}</div><div class="card-type">${c.type}</div><div class="stats">${stats}</div></div></div>`;
}
const plantUses = (sp) => { const d = SPECIES[sp]; if (!d) return ''; const T = PLANT_TIERS[d.tier], sd = T.seeds[0] === T.seeds[1] ? `${T.seeds[0]}${T.bonus ? ' (sometimes ' + (T.seeds[0] + 1) + ')' : ''}` : T.seeds.join('–');
  const u = [DRYING[sp] && 'drying', TINCTURE.recipes[sp] && 'tinctures', STILL.recipes[sp] && 'essential oil'].filter(Boolean);
  return `<br/><b>${T.label}</b> · grows in ${fmtTime(d.growS * 1000)} · seed costs ${d.seedPrice} coins · flowers sell for ${d.flowerSell} · ${sd} seeds per harvest${u.length ? ` · uses: ${u.join(', ')}` : ''}`; };
function zoomCard(id) { const z = el('div', 'zoom', cardHTML(id) + `<p class="zoom-text">${CARDS[id].blurb}${plantUses(id)}<br/><small>Tap anywhere to close</small></p>`); z.addEventListener('click', () => z.remove()); $('#ui').appendChild(z); }
// v0.5: one weighted pick over every card (PACK_W, in % of a card slot). Features keep their v0.41 odds; plants follow
// their tier (Basic 40 · Epic 8 · Legendary 4.5 · Rare 3 · Super Rare 1.8 · Ultra Rare 0.8 · Other World 0.4).
const PACK_TOTAL = Object.values(PACK_W).reduce((a, b) => a + b, 0);
const featureOdds = () => Object.keys(FEATURES).reduce((a, k) => a + PACK_W[k], 0) / PACK_TOTAL * 100;
const tierOdds = (t) => Object.keys(CARDS).filter((k) => cardTier(CARDS[k]) === t).reduce((a, k) => a + PACK_W[k], 0) / PACK_TOTAL * 100;
const tierRank = (t) => PLANT_TIERS[t]?.order || 1;
const ftag = (id) => { const t = FEATURES[id].rarity; return `<em class="tier-tag t-${t}">${PLANT_TIERS[t].label}</em>`; };
function drawCard(rnd = Math.random) {
  let w = rnd() * PACK_TOTAL;
  for (const [k, p] of Object.entries(PACK_W)) { if (!p) continue; w -= p; if (w < 0) return k; }
  return 'lavender';
}
function buyPack(forced) {
  if (!S.marketBuilt) return;
  if (S.jewels < PACK_JEWELS) { toast(`Need ${PACK_JEWELS} Jewel${PACK_JEWELS > 1 ? 's' : ''} for a Card Pack — get one in the Jewel Shop`); openPanel('jewels'); return; }
  S.jewels -= PACK_JEWELS; S.packs++;
  const ids = [drawCard(), drawCard(), drawCard()];
  if (S.packs === 1 && !S.unlocked.chamomile) ids[1] = 'chamomile';
  if (forced) forced.forEach((f, k) => f && (ids[k] = f));
  const seen = new Set();
  const results = ids.map((id) => { const isNew = (!S.discovered[id] || !S.unlocked[id]) && !seen.has(id); seen.add(id); S.discovered[id] = true; if (isNew) S.unlocked[id] = true;
    // v0.4: every copy stacks on its card. Extra Irrigation cards are extra irrigated beds; a maxed card still pays the old duplicate coins.
    const c = addCard(id); let coins = 0; if (!isNew && id === 'irrigation') S.irrigN++; if (!isNew && CARD_LEVELS.upgradable(id, CARDS[id]) && nextAt(id) == null) { coins = DUP_COINS; S.coins += coins; }
    return { id, isNew, n: c.n, up: canUpgrade(id), coins }; });
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
    const rar = cardTier(CARDS[r.id]);
    const c = el('div', `card flip ${tierRank(rar) >= 2 ? 'hint-tier hint-' + rar : ''}`);
    const w = el('div', 'slotw'); w.style.animationDelay = `${k * 0.16}s`; w.appendChild(c);
    c.innerHTML = `<div class="flip-inner"><div class="back"><img src="assets/emblem.png" alt=""/><span>Petalspire</span></div><div class="front">${cardHTML(r.id, r.isNew ? '<span class="new-tag">NEW</span>' : `<span class="dup-tag">${r.up ? '✨ Upgrade ready' : r.coins ? `Max level · +${r.coins}` : r.id === 'irrigation' ? `Stacked ×${r.n} · +1 bed` : `Stacked ×${r.n}`}</span>`)}</div></div>`;
    const front = c.querySelector('.front > .card'); front.style.cssText = 'position:absolute;inset:0;width:auto;--cw:inherit';
    c.addEventListener('click', () => { if (!c.classList.contains('flipped')) flip(c, r); else zoomCard(r.id); });
    d.appendChild(w);
  });
  $('[data-act="reveal-all"]', R).addEventListener('click', () => { [...d.querySelectorAll('.flip')].forEach((c, k) => setTimeout(() => !c.classList.contains('flipped') && flip(c, results[k]), k * 280)); });
}
function flip(c, r) {
  c.classList.add('flipped');
  const rar = cardTier(CARDS[r.id]); const b = c.getBoundingClientRect();
  if (tierRank(rar) >= 2) sparkles($('#reveal'), b.left + b.width / 2, b.top + b.height / 2, 10 + tierRank(rar) * 4);   // v0.51: more sparkle the higher the tier (Epic 18 … Other World 38)
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
  if (placing?.what === 'sickle' || placing?.what === 'plow') { const h = W.pick(x, y); let b = h?.kind === 'tile' ? Math.floor(h.index / PER_BED) : -1;
    if (b < 0) { const g = W.pick(x, y, 'ground'); if (g) b = S.beds.findIndex((id) => { const st = siteById(id); return Math.abs(st.x - g.point.x) < TILE * BED_N / 2 + 0.35 && Math.abs(st.z - g.point.z) < TILE * BED_N / 2 + 0.35; }); }
    if (b < 0) { toast('Tap one of your raised beds'); return; }
    if (placing.what === 'sickle') sickleBed(b); else plowBed(b, placing.sp); syncTools(); return; }
  if (placing?.what === 'irrigation') { const h = W.pick(x, y); const id = h?.kind === 'tile' ? bedOfTile(h.index) : null; if (!id) { toast('Tap one of your raised beds'); return; } if (assignIrrigation(id)) exitPlace(); return; }
  if (placing) { const g = W.pick(x, y, 'ground'); if (g) placeAt(g.point.x, g.point.z); return; }
  if (panel) return closePanel();
  const hit = W.pick(x, y);
  if (!hit || hit.kind === 'ground') { deselect(); return; }
  if (hit.kind === 'tile') {
    const p = S.tiles[hit.index];
    if (selected === hit.index && p) { if (!p.wateredAt && totalWater()) return water(hit.index); if (stageOf(p) === 3) return harvest(hit.index); }
    selectTile(hit.index);
  } else if (hit.kind === 'obstacle') { if (!hit.id.startsWith('g:')) deselect(); tapObstacle(hit.id); }
  else if (hit.kind === 'loot') collectLoot(hit.key);
  else if (hit.kind === 'decor') focusThing({ kind: 'decor', key: hit.key });
  else if (hit.kind === 'blueprint') openPanel('build');
  else if (hit.kind === 'lot') openLot(hit.id);
  else if (hit.kind === 'stand') openPanel('stand');
  else if (hit.kind === 'market') openPanel('market');
  else if (hit.kind === 'rack') openPanel('rack');
  else if (hit.kind === 'tincture') openPanel('tincture');
  else if (hit.kind === 'still') openPanel('still');
  else if (hit.kind === 'windmill') { if (!building.windmill) toast(`Windmill · every connected rain barrel refills every ${regenS()} s (instead of ${S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S} s)`); }
  else if (hit.kind === 'billboard') { if (!building.billboard) openPanel('billboard'); }
  else if (hit.kind === 'parking') { if (!building.parking) toast(`Parking Lot · ${custs.length}/${parkCap()} bays in use · ${Math.round(extraItemChance() * 100)}% of customers add an extra item`); }
  else if (hit.kind === 'barrel') focusThing({ kind: 'barrel', lot: hit.lot });
  else if (hit.kind === 'hive') focusThing({ kind: 'hive', lot: hit.lot });
}

// ---------------- Title & intro ----------------
if (S.introDone) $('#btn-start').textContent = 'Continue';
$('#btn-start').addEventListener('click', () => {
  $('#title').classList.add('out'); setTimeout(() => $('#title').classList.add('hidden'), 650);
  if (migrated) setTimeout(() => toast(`Petalspire v${BUILD} — a fresh start in the woods!`), 900);
  if (upgraded) setTimeout(() => toast(`Welcome to v${BUILD}! Your garden came along · +1 tree sapling · +${STARTER_JEWELS} Jewels`), 900);
  else if (migrated04) setTimeout(() => toast(`Welcome to v${BUILD} — water now only comes from rain barrels, one per plot (4 beds each)${migrated04.moved ? ` · ${migrated04.moved} bag water poured into your home barrel` : ''}${migrated04.lost ? ` · ${migrated04.lost} extra water didn’t fit and was lost` : ''}${migrated04.dropped ? ` · ${migrated04.dropped} irrigated bed${migrated04.dropped === 1 ? ' was' : 's were'} unhooked: give that plot a Rain Barrel (Supply Market), then re-assign` : ''}`), 900);
  if (hiveMigrated) setTimeout(() => toast('Your Honeybee Skep now sits on the Home plot — its bees boost only that plot’s beds (+1 flower per harvest)'), 6200);
  if (plantsMigrated) setTimeout(() => toast('Petalspire now grows real plants — your old plants became Lavender, Calendula and Chamomile, with all your seeds, flowers, plantings and products'), migrated04 || upgraded ? 3400 : 900);
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
    refreshShade();
    for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i]) syncTile(i); syncTools();
    syncRack(); syncTrees();
    for (const r of [...S.restoring]) if (now() - r.start >= r.ms) finishRestore(r);
    if (S.marketProj) { if (marketK() >= 1) finishMarket(); else W.setMarketState('building', marketK()); }
    if (regenBarrels() && selected != null) renderSheet();
    autoIrrigate(); syncBarrels(); syncTinc(); syncStill();
    if (focus?.kind === 'barrel') { const n = $('#barrel-txt'); if (n && S.barrels[focus.lot]) n.textContent = barrelText(focus.lot); }
    else if (selected != null && S.tiles[selected] && !S.tiles[selected].wateredAt && !totalWater() && +$('#tile-sheet').dataset.tw !== Math.floor(now() / 1000)) { $('#tile-sheet').dataset.tw = Math.floor(now() / 1000); renderSheet(); }
    if (panel === 'still') { let redo = false; S.stills.forEach((t, k) => { const n = $(`[data-sleft="${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (panel === 'tincture') { let redo = false; S.tinc.forEach((t, k) => { const n = $(`[data-tleft="${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (S.standBuilt && !building.stand) {
      if (custs.length < parkCap() && standCount() > 0 && now() >= nextCust && S.introDone) spawnCustomer();
      if (panel === 'stand' && !custs.length) { const n = $('#stand-status'); if (n && standCount()) n.textContent = `Next customer in about ${fmtTime(Math.max(0, nextCust - now()))}`; }
    }
    if (S.introDone && now() >= nextPass) { if (!W.cars.some((c) => c.dir < 0)) W.spawnCar({ dir: -1 }); nextPass = now() + randInt(14000, 32000) / (bbActive() ? BILLBOARD.mult : 1); }
    syncBillboard();
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
  BUILD, get fromBuild() { return fromBuild; },
  TIPS, JEWEL_DROP, obsState, PACKS,
  barrelRoof, lotRoofs, get gutterLots() { return [...W.gutters.keys()]; },
  get tincGrandfathered() { return tincGrandfathered; }, tincProblem, tincSpots, buildTincture, placeTincture, buildStill, placeStill, distill, collectOil, STILL,
  RESALE, sellPlaced, stockAntique, sellRestored, focusThing, get atmosphere() { return atmosphere(); }, get standCap() { return standCap(); },
  get state() { return S; }, get selected() { return selected; }, get focus() { return focus; }, get placing() { return placing; }, get panel() { return panel; },
  get customer() { const c = custs[0]; return c && { wants: c.wants, parked: c.car.state === 'park' }; }, get customers() { return custs.map((c) => ({ wants: c.wants, slot: c.slot, parked: c.car.state === 'park', x: c.car.x })); }, get buildMode() { return buildMode; }, W, THREE, TREE_MS,
  giveIrrigation(n = 1) { S.discovered.irrigation = S.unlocked.irrigation = true; S.irrigN += n; save(); if (panel) renderPanel(); }, assignIrrigation, autoIrrigate, get irrigFree() { return irrigFree(); },
  tileSun: (i) => tileSun[i], sunAt: (x, z) => sunAtXZ(x, z, casters()), siteSun: (id) => siteSun(id), tileXZ, refreshShade, SHADE,
  plantAt: (i) => S.tiles[i] && { ...S.tiles[i], k: progress(S.tiles[i]) }, treeInfo: (id) => { const t = treeById(id); return t && { ...t, stage: treeStage(t) }; },
  // simulate the game being closed for `sec` seconds: every timestamp moves back, then the page reloads and catches up
  placeWindmill, get regenS() { return regenS(); }, get windmillSails() { return W.windmill.userData.sails.rotation.z; }, get windmillVis() { return W.windmill.visible; },
  deselect, buildTraffic, runAd, askRunAdJewel, parkCap, trafficMult, extraItemChance, custGap, pickWants, testHold, goalPeek,
  get traffic() { return { parkVis: W.parking.visible, bays: W.parking.children.filter((g) => g.isGroup && g.visible).length, bbVis: W.billboard.visible, bbGlow: W.billboard.userData.face.material.emissiveIntensity > 0, passEvery: [14000, 32000].map((v) => Math.round(v / (bbActive() ? BILLBOARD.mult : 1))) }; },
  get bb() { return { ...S.bb, active: bbActive(), readyIn: bbReadyIn(), label: W.billboard.userData.label?.userData?.text } },
  goOffline(sec) { const ms = sec * 1000; S.tiles.forEach((p) => { if (p) { p.plantedAt -= ms; if (p.wateredAt) p.wateredAt -= ms; } }); S.trees.forEach((t) => (t.at -= ms)); if (S.waterAt) S.waterAt -= ms; Object.values(S.barrels).forEach((b) => (b.at -= ms)); S.tinc.forEach((t) => t && (t.start -= ms)); S.stills.forEach((t) => t && (t.start -= ms)); if (S.bb) { S.bb.until -= ms; S.bb.readyAt -= ms; } S.savedAt = now() - ms;
    localStorage.setItem(SAVE_KEY, JSON.stringify(S)); frozen = true; location.reload(); },
  skip(sec) { const ms = sec * 1000; S.tiles.forEach((p) => { if (p) { p.plantedAt -= ms; if (p.wateredAt) p.wateredAt -= ms; } }); S.rack.forEach((r) => r && (r.start -= ms)); S.tinc.forEach((t) => t && (t.start -= ms)); S.stills.forEach((t) => t && (t.start -= ms)); if (S.bb) { S.bb.until -= ms; S.bb.readyAt -= ms; } S.restoring.forEach((r) => (r.start -= ms)); if (S.marketProj) S.marketProj.start -= ms; nextCust -= ms; save(); },
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
  carScreen() { const c = custs[0]?.car; return c ? W.project(c.group.position.clone().setY(0.7)) : null; },
  nextCustomerIn(ms) { nextCust = now() + ms; }, spawnCustomer,
  grant(o) { for (const [k, v] of Object.entries(o)) { if (['coins', 'wood', 'jewels', 'scrap'].includes(k)) S[k] += v; else if (FINDS[k]) S.finds[k] = (S.finds[k] || 0) + v; else S.inv[k] += v; } save(); hud(); if (panel) renderPanel(); },
  tapObstacle, buildBed, enterBuild, exitBuild, selectTile, plant, water, harvest, openPanel, closePanel, buyPack, buy, stock, buyLot,
  buildStand, buildRack, startMarket, finishMarket, restore, recycle, collectLoot, enterPlace, placeAt, dropFor,
  camera(az, pol, zoom, tx, tz) { if (az != null) W.ctl.az = az; if (pol != null) W.ctl.pol = pol; if (zoom != null) W.ctl.zoom = zoom; if (tx != null) { W.ctl.target.set(tx, 0.3, tz); W.ctl.moved = true; } W.ctl.glide = null; W.updateCamera(); },
  Ads, get adsOn() { return Ads.enabled; },
  // v0.4 helpers
  get barrels() { return S.barrels; }, barrelText, totalWater, handSource: (i) => handSource(i)?.lot || null, buildBarrel, unhookIrrigation, BARREL, craftTincture, collectTincture, buildTincture,
  setBarrelCap(n) { BARREL.maxBeds = n; syncBarrels(); }, barrelScreen(lot) { const b = S.barrels[lot]; return W.project(V(b.x, 0.5, b.z)); }, barrelLabel(lot) { const s = W.barrels.get(lot)?.userData.info; return s && { main: s.userData.main, sub: s.userData.sub, visible: s.visible, scale: s.scale.y, opacity: s.material.opacity }; },
  CARDS, FEATURES, zoomCard: (id) => zoomCard(id), cardPool: (r) => Object.keys(CARDS).filter((k) => CARDS[k].rarity === r), cardTier, FEATURE_TIER_FROM_OLD, RARITY, SPECIES, FANTASY_SPECIES, PLANT_TIERS, TIER_ORDER, PACK_W, DRYING, ITEMS, TINCTURE, STILL, drawCard, packOdds: () => ({ total: PACK_TOTAL, tiers: Object.fromEntries(TIER_ORDER.map((t) => [t, tierOdds(t)])), features: featureOdds() }), rollSeeds,
  sickleBed, plowBed, useTool, toolLeft, lotTiles, bedTiles, get bedTargets() { return W.bedTargets.children.map((g) => ({ b: g.userData.b, ok: g.userData.ok })); }, get fxCount() { return W.fxCount(); },
  giveTool(id) { S.discovered[id] = true; S.unlocked[id] = true; S.owned[id] = true; if (!S.cards[id]) addCard(id); save(); hud(); },
  resetTool(id) { S.toolAt[id] = 0; save(); hud(); },
  focusBarrel(lot) { focusThing({ kind: 'barrel', lot }); },
  beeBonus, freeSpot, upgradeCard, canUpgrade, cardLv, sellOf, growK, CARD_LEVELS, hiveScreen(lot) { const h = S.hives[lot]; const s = W.project(V(h.x, 0.7, h.z)); return { x: s.x, y: s.y }; }, get beeFx() { return W.scene.children.find((o) => o.isGroup && o.children.some((c) => c.isSprite && c.material.map?.image?.width === 96))?.children.length || 0; },
  loadSave(json) { frozen = true; localStorage.setItem(SAVE_KEY, json); location.reload(); },
  giveCard(id, n = 1) { S.discovered[id] = true; S.unlocked[id] = true; addCard(id, n); if (id === 'irrigation' && S.cards[id].n > 1) S.irrigN += n - (S.cards[id].n === n ? 1 : 0); save(); if (panel) renderPanel(); },
  findSpotIn(lot) { const L = LOTS[lot]; for (let z = L.z1 - 1.4; z > L.z0 + 0.6; z -= 0.3) for (let x = L.x0 + 1.0; x < L.x1 - 1.0; x += 0.3) { if (lotAt(x, z) !== lot || placeProblem(x, z)) continue; const s = W.project(V(x, 0, z)); if (s.x > 30 && s.x < innerWidth - 30 && s.y > 160 && s.y < innerHeight - 260 && W.pick(s.x, s.y)?.kind === 'ground') return { x, z, sx: s.x, sy: s.y }; } return null; },
  clearLot(lot) { for (const o of OBSTACLES) if (o.lot === lot) { S.obs[o.id] = 'x'; W.setObstacle(o.id, 'gone'); } save(); },
  dismissTip() { clearTimeout(tipTimer); tipQueue.length = 0; $('#tip').classList.add('hidden'); },
};
