// Petalspire v0.52 — game logic + UI (v0.5: the full 21-plant catalog · v0.51: feature cards use the plant tier names · v0.52: supply cards, water truck, Rain Barrel in Build)
import * as THREE from 'three';
import { createWorld } from './world.js';
import { buildPlant } from './plants.js';
import { CHARMS, CHARM_IDS, STAND_BUY, BULK, BLOOM, bloomJewels, RUSH, STAND_UNLOCK, WORKER, itemLoc, sellsAt, ORCH_STAND, parkLv, hydroId, HYDROSOL, NON_CARDS, ROAD_SCRAP, TINC_DUP_COINS, SPECIES, FANTASY_SPECIES, PLANT_TIERS, cardTier, FEATURE_TIER_FROM_OLD, TIER_ORDER, PACK_W, DRYING, rollSeeds, FEATURES, CARDS, RARITY, ITEMS, SELL_ORDER, TIPS, RESALE, PACKS, PACK_JEWELS, JEWEL_EXCHANGE, JEWEL_DROP, PARKING, BILLBOARD, WINDMILL, DUP_COINS, SUPPLY_CARDS, SUPPLY_DUP, WATER_TRUCK, CARD_LEVELS, RACK_SLOTS, BUILDING_LV, CONS, consJewels,  DAILY, PACK_LOOT, rollLoot, PACK_MIX, OWNED_K, WATER, BARREL_LV, DRY_S, BARREL, BASES, TINCTURE, STILL, oilId, tinctureId, TINCTURE_NAMES,
  WOOD, BED_COSTS, STAND_CAP, MARKET_GOAL, WATER_REGEN_S, WATER_REGEN_MAX, STARTER, STARTER_FILL, STARTER_JEWELS,
  BUILDS, FINDS, FIND_IDS, FIND_CHANCE, SAPLING_CHANCE, RESTORE_HURRY_JEWELS, ATMOS_STEP, ATMOS_MAX, TREE, SHOP, JEWEL_BUNDLES, NO_ADS_BUNDLE, ADS, ADS_MODE, OTHER_GAMES, BOOSTS, STARTER_PACK, OFFER_PACKS, OFFER_VALUE, TOOL_SUB_JEWELS, TREE_IRRIG, STUDIO, CROSS_PROMO, SOCIALS, FOLLOW_REWARD, SHADE, TEA, teaInfo, teaId, teaSps, registerTea, DRY_TIER_S, PACK_W_ORCH, TREES, TREE_IDS, PRESS, FRUITSTAND, SEED_BAGS, bagId } from './data.js';
import { ROAD, LOTS, SIGNS, LOT_FOR_SALE, LOT_PRICES, SITES, OBSTACLES, SPOTS, PARK_X, BEHIND, FRONT, BED_N, TILE, SITE_HALF, siteById, obstacleById, inSite, lotCenter, lotAt, ORCHARD_TREE_SPOTS, ORCH_GRID_OLD_TO_NEW, ORCH_ROW_OLD_TO_NEW, ORCH_NORTH_OLD, OWNABLE_LOTS, LOCATIONS, ORCHARD_PRICE, ORCH_X, ORCH_FOR_SALE, ORCH_PLOT_PRICES, ORCH_LOTS, lotLoc } from './layout.js';
import { ICONS, itemIcon, FEATURE_ART, findIcon, decorIcon } from './icons.js';
import { Payments } from './payments.js';
import { createAds, gameArt } from './ads.js';
import { initTracker } from './games-tracker.js';
import { shadeAt, speedFor, sunLabel, rebaseStart } from './shade.js';
import { createAudio, MUSIC_CREDITS } from './audio.js';

// Save format: v0.3, v0.31 and v0.4 share one localStorage key (schema v: 3). `build` records which prototype build last wrote the save;
// v0.3 / v0.31 saves (no `build`, no per-plot barrels) are migrated on load (migrate04 below); v0.4 saves load as-is and are re-tagged. Prototype builds stay below 1.0.
export const BUILD = '0.7.2.2';
// v0.65: anonymous player tracking (Games Backend on Appwrite; no API key in the game, nothing personal). Skipped for automated runs (navigator.webdriver).
try { if (!navigator.webdriver) initTracker({ endpoint: 'https://nyc.cloud.appwrite.io/v1', projectId: '6ae0a41a002ce0a48fac', gameId: 'petalspire', platform: 'web', appVersion: BUILD }); } catch (_) {}
const SAVE_KEY = 'petalspire.v03', V02_KEY = 'petalspire.v02', OLD_KEYS = ['petalspire.v01'];
const QS = new URLSearchParams(location.search);
const TREE_MS = Math.max(0.05, +QS.get('treeMin') || TREE.growMin) * 60000;   // ?treeMin=1 for quick testing
const $ = (s, r = document) => r.querySelector(s);
// v0.61: anything the player hasn't unlocked stays a surprise — locked rows/cards render nothing (true brings back the old greyed rows)
const SHOW_LOCKED = false;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
let clockAt = null, quiet = 0;   // v0.61: workers' offline catch-up runs on a virtual clock, quietly
const now = () => clockAt ?? Date.now();
// v0.7: music + sound effects (js/audio.js). Silent during offline catch-up and while Gardeners work on their own.
let Sound = null, workerBusy = 0;
const sfx = (name) => { if (quiet || clockAt != null || workerBusy || !Sound) return; Sound.play(name); };
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
// v0.6: the two crafting stands share one engine (state keys, recipes, slots)
const CRAFT = {
  press:      { def: PRESS, name: 'Pressed Oil Stand', built: 'pressBuilt', pos: 'pressPos', slots: 'pressSlots', verb: 'Press', doing: 'Pressing', slotName: 'Press', size: [2.3, 3.0, 1.3], blurb: 'Press seeds, nuts and fruit into oils and butters' },
  // v0.66.1: the Orchard gets its own Oil Press (same recipes, presses from the Orchard Bag) — the Home one stays at Home
  opress:     { def: PRESS, name: 'Orchard Oil Press', built: 'opressBuilt', pos: 'opressPos', slots: 'opressSlots', verb: 'Press', doing: 'Pressing', slotName: 'Press', size: [2.3, 3.0, 1.3], blurb: 'Press fruit, nuts and seeds from your Orchard Bag into oils and butters' },
  fruitstand: { def: FRUITSTAND, name: 'Fruit Stand', built: 'fruitstandBuilt', pos: 'fruitstandPos', slots: 'fruitstandSlots', verb: 'Cook', doing: 'Cooking', slotName: 'Jar', size: [2.1, 2.6, 1.3], blurb: 'Cook orchard fruit into jellies, butters, sauces and canned fruit' },
};
// v0.61: where each stand may stand — the Fruit Stand only at the Orchard, the Pressed Oil Stand at both, every other stand Home only (for now)
const STAND_WHERE = { fruitstand: 'orchard', press: 'home', opress: 'orchard' };   // v0.66.1: press = Home, opress = Orchard (an older save's press already at the Orchard keeps working there)
BUILDS.opress ||= BUILDS.press; FEATURE_ART.opress ||= FEATURE_ART.press; CONS.s.opress ||= CONS.s.press; SHADE.boxes.opress ||= SHADE.boxes.press;
const standWhere = (what) => STAND_WHERE[what] || 'home';
const standOkAt = (what, loc) => { const w = standWhere(what); return w === 'both' || w === loc; };
const whereTag = (what) => (standWhere(what) === 'orchard' ? 'Orchard only' : standWhere(what) === 'home' ? 'Home only' : 'Home or Orchard');
const craftRecipe = (c, rid) => CRAFT[c]?.def.recipes.find((r) => r.id === rid);
// v0.6 orchard trees: { sp, at, growMs, cycleMs, next }. Stages 0–3 by growth; ripe when mature and now ≥ next.
const orchStage = (t, at = Date.now()) => { const k = (at - t.at) / t.growMs; return k >= 1 ? 3 : k >= 0.6 ? 2 : k >= 0.25 ? 1 : 0; };
const orchRipe = (t, at = Date.now()) => orchStage(t, at) >= 3 && !t.dry && at >= t.next;   // v0.67.1: a picked tree (t.dry) fruits again only after it is watered

// ---------------- State ----------------
function freshState() {
  return {
    v: 3, build: BUILD, coins: 10, wood: 0, jewels: 0, scrap: 0,
    // v0.5: one slot for every plant item (seeds, flowers, dried, tinctures, oils), generated from the catalog
    inv: { ...Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])), water: 0, sapling: 0, glycerin: 0, vinegar: 0 },
    unlocked: { ...Object.fromEntries(Object.keys(SPECIES).map((k) => [k, false])), lavender: true, calendula: true, rainbarrel: false, beehive: false, sundial: false, ...Object.fromEntries(CHARM_IDS.map((k) => [k, false])) },
    owned: { beehive: false, sundial: false, tincture: false, still: false, sickle: false, plow: false, parking: false, billboard: false, oparking: false, obillboard: false, windmill: false, teastand: false, press: false, fruitstand: false, ...Object.fromEntries(CHARM_IDS.map((k) => [k, false])) }, toolAt: {},
    cards: {},   // v0.4: card stacks { id: { n: copies, lv } }
    hives: {}, hiveInv: 0,   // v0.4: placeable Honeybee Skeps, one per plot ({ lot: { x, z } }); the boost only reaches beds on that plot
    discovered: {},
    lots: { home: true }, loc: 'home', lotsBought: 0, obs: {}, beds: [], tiles: [],
    rack: Array(RACK_SLOTS).fill(null), standLv: 1, rackLv: 1,   // v0.63: coin upgrades (Lv1–4)
    stand: {}, ostand: {}, starterOpened: false, waterAt: 0,
    // v0.3: things are built, not unlocked
    barrel: false, standBuilt: false, rackAvail: false, rackBuilt: false, marketAvail: false, marketBuilt: false, marketProj: null,
    finds: {}, restoring: [], decorInv: {}, gf: [], gfInv: {}, gfBought: {}, deliv: [], trip: null,   // v0.65: placed garden features, unplaced ones (bag), truck deliveries
    bonus: { can: false, barrow: false, crate: false },
    decor: [], ground: [], trees: [], looted: {}, uid: 1, noAds: false, follows: {}, adRewardAt: 0, daily: { streak: 0, last: null, lastTs: 0, best: 0, claims: 0, seen: null }, freePacks: 0, cons: {}, irrigN: 0, irrigBeds: [], irrigFrom: {}, treeIrrig: [],
    // v0.4: one rain barrel per plot ({ lot: { x, z, w, at } }), Tincture Stand
    barrels: {}, barrelInv: 0, tinctureBuilt: false, tinc: Array(TINCTURE.slots).fill(null), tincBase: 'glycerin',
    stillBuilt: false, stills: Array(STILL.slots).fill(null), stillPos: null,
    teaBuilt: false, teas: Array(TEA.slots).fill(null), teaPos: null,
    pressBuilt: false, pressPos: null, pressSlots: Array(PRESS.slots).fill(null), opressBuilt: false, opressPos: null, opressSlots: Array(PRESS.slots).fill(null), fruitstandBuilt: false, fruitstandPos: null, fruitstandSlots: Array(FRUITSTAND.slots).fill(null), orchard: {},   // v0.6   // v0.52 Tea Stand   // v0.41 Essential Oil Stand
    windmillBuilt: false, windmillPos: null,   // v0.41 Windmill (global barrel boost)
    parkingBuilt: false, billboardBuilt: false, oparkingBuilt: false, obillboardBuilt: false, bb: { until: 0, readyAt: 0, runs: 0, jewelRuns: 0 },   // v0.41 Parking Lot + Billboard (timestamps, so they keep counting while closed)
    packs: 0, tips: {}, goal: 0, introDone: false, monet: { playMs: 0, boostAt: 0, starter: {}, promo: {}, wish: {} },   // v0.66
    stats: { chopped: 0, stumps: 0, harvests: 0, watered: 0, stocked: 0, customers: 0, standEarned: 0, sold: 0,
      cleared: 0, finds: 0, restored: 0, recycled: 0, treesPlanted: 0, grownChopped: 0, jewelsBought: 0, jewelsFound: 0, jewelsTraded: 0, adBreaks: 0, adRewards: 0, irrigated: 0, tinctures: 0, oils: 0 },
  };
}
function mergeState(o) {
  const f = freshState();
  return { ...f, ...o, v: 3, build: BUILD, daily: { ...f.daily, ...(o.daily || {}) }, inv: { ...f.inv, ...o.inv }, stats: { ...f.stats, ...o.stats }, unlocked: { ...f.unlocked, ...o.unlocked }, owned: { ...f.owned, ...o.owned }, bonus: { ...f.bonus, ...o.bonus } };
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
// ---------------- v0.65: one Bag per location ----------------
// S.bags = { home: {...}, orchard: {...} } holds goods (seeds, flowers, crafted goods, fruit, bases, saplings).
// Coins, Wood, Scrap, Jewels and cards stay global. S.inv is a (non-saved) view of ONE bag: the location an action
// happens at (inBag) — or, by default, the location you are looking at.
var bagCtx = null, migBags = null;
const BAG_LOCS = ['home', 'orchard'];
const blankBag = () => ({ ...Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])), water: 0, sapling: 0, glycerin: 0, vinegar: 0 });
const viewLoc = () => (S.loc === 'orchard' && S.lots?.orchard ? 'orchard' : 'home');
function inBag(loc, fn) { const was = bagCtx; bagCtx = loc; try { return fn(); } finally { bagCtx = was; } }
const bagOf = (loc) => S.bags[loc === 'orchard' ? 'orchard' : 'home'];
// split an old shared bag: Orchard goods (fruit, jars) to the Orchard Bag; everything else, including 'both' goods, Home
function splitOrchardGoods(from, to) { let n = 0; for (const [id, q] of Object.entries(from)) if (q > 0 && ITEMS[id] && itemLoc(id) === 'orchard') { to[id] = (to[id] || 0) + q; from[id] = 0; n += q; } return n; }
function installBags() {
  if (!S.bags) { const old = S.inv || {}; S.bags = { home: { ...blankBag(), ...old }, orchard: blankBag() }; const n = splitOrchardGoods(S.bags.home, S.bags.orchard); migBags = { moved: n }; }
  else for (const l of BAG_LOCS) S.bags[l] = { ...blankBag(), ...(S.bags[l] || {}) };
  delete S.inv;
  Object.defineProperty(S, 'inv', { get: () => S.bags[bagCtx || viewLoc()], set: () => {}, enumerable: false, configurable: true });
}
installBags();
// v0.7: Glycerin and Vinegar are Home-only supplies — any left in the Orchard Bag move to the Home Bag (nothing lost)
function migBasesHome() { const o = S.bags?.orchard, h = S.bags?.home; let n = 0; if (!o || !h) return 0; for (const b of ['glycerin', 'vinegar']) if (o[b] > 0) { h[b] = (h[b] || 0) + o[b]; n += o[b]; o[b] = 0; } return n; }
migBasesHome();
// v0.68: every Orchard plot is a 4×4 tree grid (was 3×4 on The Orchard, 2×3 on the other plots). Planted trees are re-keyed
// to their plot's new grid (same plot, same row order, same side), irrigated rows follow their trees, and anything placed
// on Hilltop Grove moves back 2 m with the plot. Runs once (S.orchGrid = 4); a fresh save has nothing to move.
let orchGridMoved = 0;
function migrateOrchGrid() {
  if (S.orchGrid === 4) return; const old = S.orchard && typeof S.orchard === 'object' ? S.orchard : {}, nu = {};
  for (const [k, t] of Object.entries(old)) { const n = ORCH_GRID_OLD_TO_NEW(k); if (n == null || !t) continue; nu[n] = t; if (n !== +k) orchGridMoved++; }
  S.orchard = nu;
  if (Array.isArray(S.treeIrrig)) S.treeIrrig = [...new Set(S.treeIrrig.map((id) => ORCH_ROW_OLD_TO_NEW[id] || id))];
  const N = ORCH_NORTH_OLD, seen = new Set();
  const walk = (o) => { if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o);
    if (typeof o.x === 'number' && typeof o.z === 'number' && o.x >= N.x0 && o.x < N.x1 && o.z >= N.z0 && o.z < N.z1) o.z += N.dz;
    for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v); };
  for (const [key, v] of Object.entries(S)) if (key !== 'bags' && key !== 'orchard' && key !== 'stats') walk(v);
  S.orchGrid = 4;
}
migrateOrchGrid();
let saveTimer = 0;
let frozen = false;
const writeSave = () => { if (frozen) return; try { S.savedAt = now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} };
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeSave, 150); }
window.addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); });
window.addEventListener('pagehide', writeSave);

// ---------------- Ads (placeholders only — see js/ads.js; ADS_MODE in js/data.js) ----------------
const Ads = createAds({ root: $('#ui'), noAds: () => S.noAds, onRemoveAds: () => openPanel('jewels'), onHouseAd: () => openPanel('settings'),
  onEvent: (e) => { if (e.startsWith('break:')) { S.stats.adBreaks++; save(); } } });
// v0.68: no ad break while a panel, popup or the Map is open (it used to land on top of the Market mid-purchase)
const adBlocked = () => !!panel || !!placing || buildMode || modalOpen() || !$('#reveal').classList.contains('hidden') || !$('#confirm').classList.contains('hidden') || !S.introDone;

// v0.63: growth stalls at the end of the Sprout stage (WATER.budAt) until the bed's bud water is in (p.bud === false = waiting).
// Plants that were already growing when v0.63 loaded have no p.bud flag and simply grow on (they paid under the old rules).
const rawProg = (p, t = now()) => (!p || !p.wateredAt ? 0 : (t - p.wateredAt) / p.growMs);
function progress(p) { if (!p || !p.wateredAt) return 0; return Math.min(p.bud === false ? WATER.budAt - 1e-6 : 1, rawProg(p)); }
const budWait = (p, t = now()) => !!(p && p.wateredAt && p.bud === false && rawProg(p, t) >= WATER.budAt);
const thirsty = (p, t = now()) => !!(p && (!p.wateredAt || budWait(p, t)));
function stageOf(p) { if (!p.wateredAt) return 0; const k = progress(p); return k >= 1 ? 3 : k >= 0.5 ? 2 : k >= 0.2 ? 1 : 0; }
const STAGES = ['Seed', 'Sprout', 'Bud', 'Bloom'];
const obsState = (id) => { const v = S.obs[id]; if (v === 'x') return 'gone'; if (v === 's') return 'stump'; return obstacleById(id).type === 'stump' ? 'stump' : 'full'; };
const SITE_OBS = Object.fromEntries(SITES.map((s) => [s.id, OBSTACLES.filter((o) => inSite(o, s)).map((o) => o.id)]));
// v0.6: a crafting stand standing on an empty Roadside bed patch keeps a bed off it (the Roadside Lot has no other free ground)
const STAND_POS = [['teaBuilt', 'teaPos'], ['pressBuilt', 'pressPos'], ['opressBuilt', 'opressPos'], ['fruitstandBuilt', 'fruitstandPos']];
const siteStands = (s) => STAND_POS.filter(([, p]) => S[p] && S[p].lot === s.lot && Math.abs(S[p].x - s.x) < TILE * BED_N / 2 + 0.9 && Math.abs(S[p].z - s.z) < TILE * BED_N / 2 + 0.7).map(([, p]) => S[p]);
const siteThings = (id) => { const s = siteById(id); return [...S.decor, ...S.trees].filter((d) => inSite(d, s)).concat(siteStands(s)); };
const siteClear = (id) => SITE_OBS[id].every((o) => obsState(o) === 'gone') && !siteThings(id).length;
const siteLeft = (id) => SITE_OBS[id].filter((o) => obsState(o) !== 'gone').length + siteThings(id).length;
const bedCost = () => BED_COSTS[Math.min(S.beds.length, BED_COSTS.length - 1)];
const standCount = () => Object.values(S.stand).reduce((a, b) => a + b, 0);
// v0.6: the Crate Shelf is an item you install on the Farm Stand: +4 shelf space.
// v0.63: installing it is a permanent upgrade — the shelf leaves the Bag (S.bonus.crate = a spare one still in the Bag,
// S.shelfOn = installed for good). It can't be taken back out.
const SHELF_BONUS = 4;
const shelfOn = () => !!(S.shelfOn && S.standBuilt);
// v0.63: Farm Stand / Drying Rack levels (bought with coins, permanent)
const BLV_MAX = 4, blv = (k) => { const v = Math.round(+S[k + 'Lv']); return v >= 1 ? Math.min(v, BLV_MAX) : 1; };
const standSpaceLv = () => BUILDING_LV.stand.space[blv('stand') - 1];
const standSellK = () => 1 + BUILDING_LV.stand.sell[blv('stand') - 1];
// v0.65 garden charms: the value of an owned charm at its card level (0 when not bought). Fractions, or hours for the watch.
const charmLv = (id) => Math.min(CHARMS[id].lv.length, Math.max(1, Math.round(+S.cards?.[id]?.lv) || 1));
// v0.65 (later): garden features work while they stand on the map. Unplaced ones wait in the Bag.
const GF_IDS = ['sundial', ...CHARM_IDS], isGF = (id) => GF_IDS.includes(id);
const gfPlaced = (id) => (S.gf || []).find((d) => d.id === id);
const gfOn = (id) => !!(S.owned?.[id] && gfPlaced(id));
const charmV = (id) => (gfOn(id) ? CHARMS[id].lv[charmLv(id) - 1] : 0);
const charmAt = (id, loc) => { const d = gfPlaced(id); return d && lotLoc(d.lot) === loc ? charmV(id) : 0; };   // location-bound charms (the Bell)
let charmRoll = null;   // test hook: force the chance-based charms (true = always, false = never)
const charmHit = (id) => { const v = charmV(id); return v > 0 && (charmRoll ?? Math.random() < v); };
const craftK = () => 1 - charmV('faelantern');   // Fae Lantern: drying and crafting take less time
const standPrice = (id) => Math.round(sellOf(id) * (standSellK() + charmV('scales')));
const ostandPrice = (id) => Math.round(sellOf(id) * (1 + charmV('scales')));   // v0.65: the Fruit Stand (Orchard) with Honeygold Scales
const rackSlots = () => BUILDING_LV.rack.slots[blv('rack') - 1];
const rackK = () => (1 - BUILDING_LV.rack.faster[blv('rack') - 1]) * craftK();
const standCap = () => STAND_CAP + (shelfOn() ? SHELF_BONUS : 0) + standSpaceLv();
function syncShelf() { W.setStandShelf?.(shelfOn(), standCount() > STAND_CAP); }
function installShelf() {
  if (!S.bonus.crate || S.shelfOn) return false;
  if (!S.standBuilt) { toast('Build the Roadside Farm Stand first, then install the Crate Shelf on it'); return false; }
  S.shelfOn = true; S.bonus.crate = false; save(); syncShelf(); renderPanel(); hud();
  W.poof?.(V3(SPOTS.stand[0] + 1.98, 0.8, SPOTS.stand[1] + 0.2), '#F5D07A', 16, 1.5);
  toast(`Crate Shelf installed for good · shelf space ${STAND_CAP} → ${standCap()} · it's part of your Farm Stand now`); return true;
}
// v0.63: an installed shelf is permanent — it can't be taken back out into the Bag
function uninstallShelf(quiet) {
  if (S.shelfOn) { if (!quiet) toast('The Crate Shelf is a permanent part of your Farm Stand'); return { back: 0, permanent: true }; }
  return { back: 0 };
}
// (pre-v0.63 take-out logic, kept for reference only: everything that no longer fits went back in the bag)
function _oldUninstallShelf(quiet) {
  if (!S.shelfOn) return { back: 0 };
  S.shelfOn = false; let over = standCount() - STAND_CAP, back = 0;
  if (over > 0) for (const id of [...SELL_ORDER].reverse().concat(Object.keys(S.stand))) { if (over <= 0) break; const q = Math.min(over, S.stand[id] || 0); if (!q) continue;
    if (ITEMS[id]?.antique) { for (let n = 0; n < q; n++) giveRestored(ITEMS[id].antique); } else S.inv[id] = (S.inv[id] || 0) + q;
    S.stand[id] -= q; if (!S.stand[id]) delete S.stand[id]; over -= q; back += q; }
  save(); syncStand(); syncShelf(); hud(); if (panel) renderPanel();
  if (!quiet) toast(`Crate Shelf taken out — back in your Bag${back ? ` · ${back} item${back > 1 ? 's' : ''} moved from the stand to your Bag` : ''} · shelf space ${standCap()}`);
  return { back };
}
const lotPrice = () => LOT_PRICES[Math.min(S.lotsBought, LOT_PRICES.length - 1)];
const tileName = (i) => { const b = Math.floor(i / PER_BED), k = i % PER_BED; return `Bed ${b + 1} · ${'ABC'[Math.floor(k / BED_N)]}${(k % BED_N) + 1}`; };
// v0.52 Windmill: every connected barrel refills faster (60 → 20 s at Lv1, 18/17/15 s at Lv2–4; was 40 s); multiplies with the Brass Watering Can (×½)
const windK = () => (S.windmillBuilt ? WINDMILL.regenS[Math.min(WINDMILL.regenS.length, S.cards.windmill?.lv || 1) - 1] / WATER_REGEN_S : 1);
const regenS = () => Math.round((S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S) * windK() * (1 - charmV('rainchain')) * 10) / 10,   // v0.65: × Copper Rain Chain
  regenMax = (b) => barrelCap(typeof b === 'string' ? S.barrels[b] : b);
// v0.63: per-barrel size levels (BARREL_LV); the Brass Watering Can still adds +5 on top
const barrelLv = (b) => { const v = Math.round(+b?.lv); return v >= 1 ? Math.min(v, BARREL_LV.length) : 1; };
const barrelCap = (b) => BARREL_LV[barrelLv(b) - 1].cap + (S.bonus.can ? 5 : 0);
const atmosphere = () => S.decor.reduce((a, d) => a + (Object.values(FINDS).find((f) => f.into.decor === d.type)?.into.atm || 0), 0);
const atmosMult = () => Math.max(1 - ATMOS_MAX, 1 - ATMOS_STEP * atmosphere());
const DECOR_INFO = Object.fromEntries(Object.entries(FINDS).filter(([, f]) => f.into.decor).map(([k, f]) => [f.into.decor, { name: f.into.name, atm: f.into.atm, from: k }]));
const treeStage = (t) => { if (t.st === 'stump') return 3; const k = Math.min(1, (now() - t.at) / t.ms); return k >= 1 ? 3 : k >= TREE.stageAt[2] ? 2 : k >= TREE.stageAt[1] ? 1 : 0; };
const treeById = (id) => S.trees.find((t) => t.id === id);
const marketK = () => (S.marketProj ? Math.min(1, (now() - S.marketProj.start) / S.marketProj.ms) : 0);

// ---------------- v0.63: water economy + Irrigation (one card, hooks up beds, its level lowers the water per stage) ----------------
// Every raised bed pays water twice per grow: to START and to BUD (see WATER in data.js). Water is counted in "units" (ninths of a
// water per plant), so a full 3×3 bed pays WATER.stage[lv-1] water per stage. A pour is always 1 whole water (9 units) from a barrel
// into the bed; units left over stay with the bed (S.bedCredit) for its next thirsty plant. Hooked-up beds pay the Irrigation card's
// level cost — by drip or by hand — other beds pay Lv1. Blue Lotus: WATER.lotus (2 + 2 water at Lv1 · 1 water in all at Lv4).
const bedOfTile = (i) => S.beds[Math.floor(i / PER_BED)];
const hasIrrig = () => !!(S.cards.irrigation || S.irrigN > 0 || S.owned.irrigation);
const irrigLv = () => { const v = Math.round(+S.cards.irrigation?.lv); return v >= 1 ? Math.min(v, WATER.stage.length) : 1; };
const bedLv = (bed) => (S.irrigBeds.includes(bed) && hasIrrig() ? irrigLv() : 1);
const stageNeed = (i, p = S.tiles[i]) => { const lv = bedLv(bedOfTile(i)), k = p.wateredAt ? 1 : 0; return p.sp === 'bluelotus' ? WATER.lotus[lv - 1][k] : WATER.stage[lv - 1]; };
const bedWaterLine = (lv) => `a full bed uses ${WATER.stage[lv - 1]} water to start + ${WATER.stage[lv - 1]} to bud`;
const siteTiles = (bed) => { const b = S.beds.indexOf(bed), out = []; if (b < 0) return out; for (let k = 0; k < PER_BED; k++) out.push(b * PER_BED + k); return out; };
// Automated test browsers skip the bud stop unless a test opts in (localStorage 'petalspire.waterTest'), so older tests still run.
const budGate = () => !(navigator.webdriver && !localStorage.getItem('petalspire.waterTest'));
// A bed's water is shared: its thirsty plants that wait for the same stage (start, or bud) move on together once the bed's
// poured water covers all of them (e.g. 9 lavender = 9 water to start at Lv1). Leftover carries over in S.bedCredit (units).
function bedGroup(bed, prefer = null, t = now()) {
  const th = siteTiles(bed).filter((i) => thirsty(S.tiles[i], t)); if (!th.length) return { tiles: [], stage: null };
  const ref = prefer != null && th.includes(prefer) ? prefer : th[0], st = S.tiles[ref].wateredAt ? 'bud' : 'start';
  return { tiles: th.filter((i) => (S.tiles[i].wateredAt ? 'bud' : 'start') === st), stage: st };
}
// The bed's water for that group right now: { have, need } in whole water (e.g. 4/9)
function bedWater(bed, prefer = null, t = now()) {
  const g = bedGroup(bed, prefer, t); let need = 0, paid = 0; for (const i of g.tiles) { need += stageNeed(i, S.tiles[i]); paid += S.tiles[i].wu || 0; }
  const cr = (S.bedCredit && S.bedCredit[bed]) || 0, u = WATER.unit;
  return { need: Math.ceil(need / u), have: Math.min(Math.ceil(need / u), Math.floor((paid + cr) / u)), needU: need, paidU: Math.min(need, paid + cr), stage: g.stage };
}
function startGrowing(p, at, auto) {
  p.wateredAt = at; p.wu = 0; p.bud = budGate() ? false : true; if (p.sp === 'bluelotus') p.fill = 2;
  p.baseMs = SPECIES[p.sp].growS * 1000 * (gfOn('sundial') ? 0.75 : 1) * growK(p.sp); p.sun = 1; p.growMs = p.baseMs; if (auto) p.irrigated = true;
}
// Spend the bed's carried-over water on its thirsty plants. Returns what changed ({ i, kind: start | bud | part }).
function settleBed(bed, prefer = null, at = now(), auto = false) {
  const cr = S.bedCredit || (S.bedCredit = {}); const ev = [];
  for (let guard = 0; guard < 4; guard++) {
    const g = bedGroup(bed, guard ? null : prefer, at); if (!g.tiles.length) break; const have = cr[bed] || 0;
    let need = 0, paid = 0; for (const i of g.tiles) { need += stageNeed(i, S.tiles[i]); paid += S.tiles[i].wu || 0; }
    if (paid + have >= need) { cr[bed] = paid + have - need;
      for (const i of g.tiles) { const p = S.tiles[i];
        if (g.stage === 'start') { startGrowing(p, at, auto); ev.push({ i, kind: 'start' }); }
        else { p.bud = true; p.wu = 0; if (at - p.wateredAt > WATER.budAt * p.growMs) p.wateredAt = at - WATER.budAt * p.growMs; ev.push({ i, kind: 'bud' }); } }
      continue; }
    if (g.stage === 'start') for (const i of g.tiles) if (S.tiles[i].sp === 'bluelotus') { const f = (paid + have) * 2 >= need ? 1 : 0; if (f && !S.tiles[i].fill) S.stats.lotusHalf = (S.stats.lotusHalf || 0) + 1; S.tiles[i].fill = f; }   // half barrel at half the water
    if (have) for (const i of g.tiles) ev.push({ i, kind: 'part' });
    break;
  }
  if (cr[bed] > 0 && !siteTiles(bed).some((i) => thirsty(S.tiles[i], at))) cr[bed] = Math.min(cr[bed], WATER.unit - 1);   // never bank more than a pour
  if (!cr[bed]) delete cr[bed]; return ev;
}
const irrigTiles = () => S.irrigBeds.flatMap(siteTiles);
const thirstyIrrig = () => irrigTiles().filter((i) => thirsty(S.tiles[i]));
// v0.4: each plot has its own rain barrel. Irrigated beds drink only from their own plot's barrel; a barrel feeds at most BARREL.maxBeds beds.
const lotOfSite = (id) => siteById(id)?.lot;
const tileLoc = (i) => lotLoc(lotOfSite(bedOfTile(i)) || 'home');   // v0.65: which Bag a bed tile's seeds and harvest belong to
const standLoc = (c) => lotLoc(S[CRAFT[c]?.pos]?.lot || (c === 'fruitstand' || c === 'opress' ? 'orchard' : 'home'));
// v0.68: some press recipes belong to one place only (Rosehip Oil = Home roses; Almond Oil/Butter = Orchard almonds)
const recipeHere = (c, r) => !r.only || r.only === standLoc(c);
// v0.52: a barrel also reaches the owned plot directly behind it. S.irrigFrom[site] = the barrel's plot when a bed is fed
// from the barrel in front instead of its own plot's.
const feedLot = (id) => (S.irrigFrom && S.irrigFrom[id]) || lotOfSite(id);
const reachLots = (lot) => [lot, ...(BEHIND[lot] && S.lots[BEHIND[lot]] ? [BEHIND[lot]] : [])];
const barrelBeds = (lot) => S.irrigBeds.filter((id) => feedLot(id) === lot);
const barrelOf = (siteId) => S.barrels[feedLot(siteId)];
const barrelXZ = (lot) => { const b = S.barrels[lot]; return [b.x, b.z]; };
const totalWater = () => Object.values(S.barrels).reduce((a, b) => a + b.w, 0);   // v0.4: water only lives in rain barrels
const lotName = (lot) => (lot === 'home' ? 'Home plot' : LOTS[lot].name);
const clock = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)), p2 = (n) => String(n).padStart(2, '0'); return t >= 3600 ? `${Math.floor(t / 3600)}:${p2(Math.floor(t / 60) % 60)}:${p2(t % 60)}` : `${Math.floor(t / 60)}:${p2(t % 60)}`; };   // v0.64: h:mm:ss for long builds
const barrelLeft = (b) => Math.max(0, b.at + regenS() * 1000 - now());
const barrelText = (lot, withWm = false) => { const b = S.barrels[lot], max = regenMax(b); if (!barrelRoof(lot)) return `${b.w}/${max} · ${NOT_COLLECTING}`; const wm = S.windmillBuilt && withWm ? ' · Windmill: faster refill' : ''; return b.w >= max ? `${b.w}/${max} · Full${wm}` : `${b.w}/${max} · next in ${clock(barrelLeft(b))}${wm}`; };
// v0.63: rain barrel sizes (per barrel, permanent). Only the next size is shown; "Max size" at the top.
const lvCost = (L) => ({ coins: L.coins || 0, wood: L.wood || 0, scrap: L.scrap || 0 });
function barrelUpgHTML(lot) {
  const b = S.barrels[lot], lv = barrelLv(b), can = S.bonus.can ? 5 : 0;
  if (S.upg?.['barrel:' + lot]) return upgTimerHTML('barrel:' + lot, 'Rain Barrel');
  if (lv >= BARREL_LV.length) return `<div class="upg-card max" data-upg="barrel" data-upg-max><div class="upg-lv">Lv${lv}</div><div class="upg-meta"><b>Rain Barrel · Max size</b><small>Holds ${regenMax(b)} water</small></div></div>`;
  const c = lvCost(BARREL_LV[lv]), miss = [c.coins > S.coins && `${fmtC(c.coins - S.coins)} more coin${c.coins - S.coins === 1 ? '' : 's'}`, c.wood > S.wood && `${c.wood - S.wood} more Wood`, c.scrap > S.scrap && `${c.scrap - S.scrap} more Scrap Metal`].filter(Boolean);
  return `<div class="upg-card" data-upg="barrel" data-barrel-lv="${lv}"><div class="upg-lv">Lv${lv}</div><div class="upg-meta"><b>Bigger barrel · Lv${lv} → Lv${lv + 1}</b><small>Now: holds ${regenMax(b)}</small><small class="upg-next">Next: holds ${BARREL_LV[lv].cap + can} water</small>
    ${miss.length ? `<small class="upg-need" data-upg-need>Need ${miss.join(' · ')}</small>` : ''}</div>
    <button class="btn btn-gold sm" data-act="upgrade-barrel" data-upg-cost="${c.coins}" ${miss.length ? 'disabled' : ''}>${[coin(c.coins), c.wood && woodTag(c.wood), c.scrap && scrapTag(c.scrap)].filter(Boolean).join(' + ')}</button></div>`;
}
function upgradeBarrel(lot) {
  const b = S.barrels[lot]; if (!b) return false; const lv = barrelLv(b); if (lv >= BARREL_LV.length) return false;
  if (S.upg?.['barrel:' + lot]) return false;
  const c = lvCost(BARREL_LV[lv]); if (S.coins < c.coins || S.wood < c.wood || S.scrap < c.scrap) { toast(`Not enough for a bigger barrel yet`); return false; }
  S.coins -= c.coins; S.wood -= c.wood; S.scrap -= c.scrap;
  startUpg('barrel:' + lot, lv + 1, () => applyBarrelLv(lot, lv + 1)); return true;
}
function applyBarrelLv(lot, to, paid) {   // v0.64: runs when the upgrade timer ends (or at once in automated tests)
  const b = S.barrels[lot]; if (!b) return;
  const wasFull = b.w >= regenMax(b); b.lv = Math.max(barrelLv(b), to); if (wasFull) b.at = now();
  (S.stats.barrelUps ||= {})[lot] = b.lv; writeSave(); syncBarrels(); hud(); if (focus) renderSheet(); if (panel) renderPanel();
  W.setBarrelLv?.(lot, b.lv, true); W.poof?.(V3(b.x, 1.0, b.z), '#F5D07A', 18, 1.6);
  toast(`✨ Rain Barrel upgraded to Lv${b.lv} · holds ${regenMax(b)} water`);
}
function takeFromBarrel(b) { if (b.w >= regenMax(b)) b.at = now(); b.w--; }
// Hand watering (v0.4 rule): the bed's own plot barrel first, then the nearest other barrel with water.
function handSource(i) {
  const lot = lotOfSite(bedOfTile(i)), own = S.barrels[lot];
  if (own && own.w > 0) return { b: own, lot };
  const fl = feedLot(bedOfTile(i)) !== lot ? feedLot(bedOfTile(i)) : FRONT[lot]; const fb = fl && S.barrels[fl];   // v0.52: then the barrel in front
  if (fb && fb.w > 0 && reachLots(fl).includes(lot)) return { b: fb, lot: fl };
  const xz = tileXZ(i) || [0, 0]; let best = null, bd = Infinity;
  for (const [l, b] of Object.entries(S.barrels)) if (b.w > 0) { const d = Math.hypot(b.x - xz[0], b.z - xz[1]); if (d < bd) { bd = d; best = { b, lot: l }; } }
  return best;
}
// v0.41: a barrel only collects rain through a gutter from a roof on the SAME plot. Connection is automatic: any roofed
// building on that plot (Farm Stand, Supply Market — even boarded up —, Tincture Stand, Essential Oil Stand). The Home
// barrel uses the Farm Stand once built, and the Market roof before that, so the starter barrel always works.
const ROOF_NAMES = { stand: 'Farm Stand', market: 'Supply Market', tincture: 'Tincture Stand', still: 'Essential Oil Stand', teastand: 'Tea Stand', press: 'Pressed Oil Stand', opress: 'Orchard Oil Press', fruitstand: 'Fruit Stand', orchardshed: 'Orchard Stand' };
function lotRoofs(lot) {
  const out = [];
  if (lot === 'home') { if (S.standBuilt) out.push('stand'); out.push('market'); }
  if (lot === 'orchard' && S.lots.orchard && S.oshedBuilt) out.push('orchardshed');   // v0.61: the Orchard Stand's roof — only once it is built (no roof, no rain, as at Home)
  if (S.tinctureBuilt && (S.tincPos?.lot || 'home') === lot) out.push('tincture');
  if (S.stillBuilt && S.stillPos?.lot === lot) out.push('still');
  if (S.teaBuilt && S.teaPos?.lot === lot) out.push('teastand');
  for (const c of Object.keys(CRAFT)) if (S[CRAFT[c].built] && S[CRAFT[c].pos]?.lot === lot) out.push(c);
  return out;
}
// v0.52: every stand on the barrel's plot connects automatically (up to BARREL_STANDS_MAX), each adding 1 water per refill
// tick. Stands = Farm, Tincture and Essential Oil Stands; the Supply Market roof only feeds the Home barrel when there is no
// Farm Stand yet (so the starter barrel always works), and it doesn't count as a second stand.
const BARREL_STANDS_MAX = 2;
function barrelStands(lot) {
  const b = S.barrels[lot]; if (!b) return []; const rs = lotRoofs(lot); if (!rs.length) return [];
  const st = rs.filter((r) => r !== 'market' && r !== 'orchardshed'); if (!st.length) return [rs.includes('orchardshed') ? 'orchardshed' : 'market'];
  const d = (p) => (p === 'stand' ? -1 : Math.hypot(SPOTS[p][0] - b.x, SPOTS[p][1] - b.z));   // the Farm Stand first, then nearest
  return st.sort((p, q) => d(p) - d(q)).slice(0, BARREL_STANDS_MAX);
}
const barrelPerTick = (lot) => barrelStands(lot).length;
function barrelRoof(lot) { return barrelStands(lot)[0] || null; }
const standsLine = (lot) => { const n = barrelStands(lot).filter((r) => r !== 'market' && r !== 'orchardshed').length; return n ? `${n} stand${n > 1 ? 's' : ''} connected • +${barrelPerTick(lot)} per tick` : `${lot === 'orchard' ? 'Orchard Stand' : 'Supply Market'} roof • +1 per tick`; };
const NOT_COLLECTING = 'Not collecting: connect to a stand on this plot';
function regenBarrels() {
  let ch = false; const rs = regenS() * 1000;
  for (const [lot, b] of Object.entries(S.barrels)) { const max = regenMax(b);
    if (!barrelRoof(lot)) { b.at = now(); continue; }   // no gutter, no rain: the countdown is frozen
    if (b.w >= max) { b.at = now(); continue; }
    const n = Math.floor((now() - b.at) / rs);
    if (n > 0) { b.w = Math.min(max, b.w + n * barrelPerTick(lot)); b.at += n * rs; if (b.w >= max) b.at = now(); ch = true; }   // v0.52: +1 per connected stand
  }
  return ch;
}
// v0.63: drip lines pour into each hooked-up bed until its thirsty plants are paid for or the barrel runs dry
function autoIrrigate() { if (!S.irrigBeds.length) return; for (const bed of [...S.irrigBeds]) { let guard = 200; while (guard-- > 0) { const i = siteTiles(bed).find((k) => thirsty(S.tiles[k])); if (i == null || !water(i, true)) break; } } }
// Offline: per barrel, replay the time since the last save — pours whenever a hooked-up bed has a thirsty plant (to start, or one
// that reached the bud stop) and the barrel has a drop, refilling tick by tick.
function catchUpIrrigation() {
  if (!S.irrigBeds.length) return;
  const t0 = S.savedAt || now(), end = now(), rs = regenS() * 1000;
  for (const [lot, b] of Object.entries(S.barrels)) {
    const beds = barrelBeds(lot); if (!beds.length) continue;
    const max = regenMax(b), per = barrelPerTick(lot); let w = b.w, wAt = w >= max ? t0 : b.at || t0, t = t0, guard = 50000;
    const dry = (bed, at) => !siteTiles(bed).some((k) => thirsty(S.tiles[k], at));
    const pour = (at) => { for (const bed of beds) { let g = 200; while (g-- > 0) { settleBed(bed, null, at, true); if (dry(bed, at) || w <= 0) break;
      if (w >= max) wAt = at; w--; S.stats.watered++; S.stats.irrigated = (S.stats.irrigated || 0) + 1; (S.bedCredit ||= {})[bed] = (S.bedCredit[bed] || 0) + WATER.unit; } } };
    const nextBud = (after) => { let m = Infinity; for (const bed of beds) for (const k of siteTiles(bed)) { const p = S.tiles[k]; if (p && p.wateredAt && p.bud === false) { const tb = p.wateredAt + WATER.budAt * p.growMs; if (tb > after && tb < m) m = tb; } } return m; };
    while (t <= end && guard-- > 0) {
      pour(t);
      const tick = per && w < max ? wAt + rs : Infinity, nb = nextBud(t), nt = Math.min(tick, nb);
      if (nt > end || nt === Infinity) break;
      if (tick <= nb) { const n = Math.max(1, Math.floor((tick - wAt) / rs)); w = Math.min(max, w + n * per); wAt += n * rs; if (w >= max) wAt = tick; }
      t = nt;
    }
    b.w = w; b.at = wAt;   // regenBarrels() in tick() adds whatever is left over
  }
}
function assignIrrigation(siteId) {
  if (!S.beds.includes(siteId)) return false;
  if (S.irrigBeds.includes(siteId)) { toast('This bed is already irrigated'); return false; }
  if (!hasIrrig() && !placing?.buy) { toast('Buy Irrigation in the Supply Market — one raised bed per purchase'); return false; }
  // v0.52: its own plot's barrel first; otherwise the barrel of the plot in front (it reaches the plot behind it)
  const own = lotOfSite(siteId), fr = FRONT[own] && S.barrels[FRONT[own]] ? FRONT[own] : null;
  const cands = [S.barrels[own] ? own : null, fr].filter(Boolean);
  if (!cands.length) { toast(`${lotName(own)} has no rain barrel yet — build one there from the Build menu (Rain Barrel, ${BARREL.price} coins)${FRONT[own] ? `, or one on ${lotName(FRONT[own])} (it reaches the plot behind it)` : ''}`); tip('plotbarrel'); return false; }
  const lot = cands.find((l) => barrelBeds(l).length < BARREL.maxBeds);
  if (!lot) { toast(`This barrel already feeds ${BARREL.maxBeds} beds. Build another plot's barrel or unhook a bed`); return false; }
  S.irrigFrom = S.irrigFrom || {}; if (lot !== own) S.irrigFrom[siteId] = lot; else delete S.irrigFrom[siteId];
  S.irrigBeds.push(siteId); W.setIrrigation(siteId, true, barrelXZ(lot)); W.irrigPulse(siteId);
  const s = siteById(siteId); popAt(V3(s.x, 1.4, s.z), `<i data-icon="water"></i>Irrigated! ${barrelBeds(lot).length}/${BARREL.maxBeds} on this barrel`);
  save(); autoIrrigate(); return true;
}
function unhookIrrigation(siteId) {
  const k = S.irrigBeds.indexOf(siteId); if (k < 0) return false;
  S.irrigBeds.splice(k, 1); W.setIrrigation(siteId, false); if (S.irrigFrom) delete S.irrigFrom[siteId];
  toast('Bed unhooked from its rain barrel'); save(); if (selected != null || focus) renderSheet(); if (panel) renderPanel(); return true;
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
  const h = S.barrels.home, bag = S.bags.home.water || 0; if (!h || !bag) return { moved: 0, lost: 0 };
  const max = regenMax(h), moved = Math.max(0, Math.min(bag, max - h.w)); h.w += moved; if (h.w >= max) h.at = now(); S.bags.home.water = 0; return { moved, lost: bag - moved };
}
if (needs04) migrate04();
// v0.52: Glycerin & Vinegar are cards now, and the market only sells them once the Tincture Stand is open. Saves written before
// v0.52 that already own the Tincture Stand get both cards (discovered, unlocked, one copy) and keep buying them even while the
// stand is still unbuilt. Glycerin / Vinegar already in the bag always stays, whatever the save.
const pre052 = !!fromBuild && !(parseFloat(fromBuild) >= 0.52);
let basesMigrated = false;
if ((pre052 || upgraded) && S.owned?.tincture && !S.basesGrandfathered) {
  S.basesGrandfathered = true; basesMigrated = true;
  for (const b of SUPPLY_CARDS) { S.discovered[b] = S.unlocked[b] = true; if (!S.cards[b]) addCard(b); }
}
// v0.52: the Tincture Stand left the card packs. An old Tincture Stand card stack is removed: a stand you own or built stays,
// a card you found but never bought becomes the stand itself (unplaced, Place button in the Bag), and every duplicate copy
// becomes TINC_DUP_COINS coins.
let tincCardMigrated = null;
if (S.cards?.tincture) {
  const n = S.cards.tincture.n || 1, coins = (n - 1) * TINC_DUP_COINS, gave = !S.owned.tincture;
  if (gave) { S.owned.tincture = S.unlocked.tincture = true; }
  S.coins += coins; delete S.cards.tincture; tincCardMigrated = { n, coins, gave };
}
if (upgraded || needs04 || plantsMigrated || (fromBuild && fromBuild !== BUILD) || tincCardMigrated) writeSave();   // v0.4: also write the real-plant-mapped save straight away
const irrigHookable = () => hasIrrig() && S.beds.some((id) => !S.irrigBeds.includes(id));
// v0.7.1: Irrigation is simply bought, one raised bed per purchase (each purchase is also a card copy, so it levels up).
// It can only be bought while a bed still needs it.
// v0.7.2.2: a bed only "needs" irrigation when a rain barrel can feed it (its own plot's barrel, or the plot in front's)
const irrigNeedBeds = () => S.beds.filter((id) => !S.irrigBeds.includes(id) && (S.barrels[lotOfSite(id)] || (FRONT[lotOfSite(id)] && S.barrels[FRONT[lotOfSite(id)]])));
// v0.7.2.2 (user's rule): Scrap Metal is not in the Market, the Watch-an-ad picks or Card Pack bonuses until a Windmill exists
// at that location (the Windmill is Home-only). It can still be found any time clearing trees / stumps and on the road.
const windmillAt = (at) => !!S.windmillBuilt && (S.windmillPos?.lot ? lotLoc(S.windmillPos.lot) : 'home') === at;
const scrapUsable = (at = curLoc()) => windmillAt(at);
const irrigBlock = () => (irrigNeedBeds().length ? '' : 'No beds need irrigation');
const irrigBuyBtn = (cls = 'btn btn-primary sm') => { const c = buyCost('irrigation'), why = irrigBlock();
  return `<button class="${cls}" data-buy="irrigation" data-price="${c.coins}" ${why || !canPay(c) ? 'disabled' : ''}>${coin(c.coins)}</button>${why ? `<small class="opt-note irrig-why" data-irrig-why>${why}</small>` : ''}`; };
const irrigHTML = () => {   // v0.63: one card, hooks up beds; its level sets the water per stage
  if (!hasIrrig()) return '';
  const lv = irrigLv(), n = S.irrigBeds.length;
  return `<div class="row irrig-row" data-irrig-lv="${lv}"><button class="ico" data-card="irrigation" aria-label="Irrigation card">${FEATURE_ART.irrigation}</button><div class="meta"><b>Irrigation · Lv${lv}</b><small>${n} bed${n === 1 ? '' : 's'} irrigated · ${bedWaterLine(lv)} (max ${BARREL.maxBeds} beds per barrel)</small></div><div class="acts">${irrigBuyBtn()}</div></div>`;
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
  const B = SHADE.boxes, box = (id, k, x, z) => { const b = B[k]; out.push({ id, x: x + b.dx, z: z + b.dz, hx: b.hx, hz: b.hz, h: b.h, w: b.w }); };
  const add = (k) => SPOTS[k] && box('b:' + k, k, SPOTS[k][0], SPOTS[k][1]);
  add('market'); if (S.standBuilt) add('stand'); if (S.rackBuilt) add('rack'); if (S.tinctureBuilt) add('tincture'); if (S.stillBuilt) add('still'); if (S.teaBuilt) add('teastand'); for (const c of Object.keys(CRAFT)) if (S[CRAFT[c].built]) add(c);
  if (S.windmillBuilt) add('windmill'); if (S.billboardBuilt) add('billboard'); if (S.obillboardBuilt) box('b:obillboard', 'billboard', SPOTS.obillboard[0], SPOTS.obillboard[1]);
  for (const [lot, h] of Object.entries(S.hives || {})) if (h) box('hive:' + lot, 'hive', h.x, h.z);
  for (const [lot, b] of Object.entries(S.barrels || {})) if (b) box('barrel:' + lot, 'barrel', b.x, b.z);
  for (const [k, t] of Object.entries(S.orchard || {})) { const sp = ORCHARD_TREE_SPOTS[k]; if (!sp || !t) continue; const f = SHADE.grownStage[orchStage(t, at)]; out.push({ id: 'orch:' + k, x: sp.x, z: sp.z, w: SHADE.tree.w * 1.1 * f, reach: SHADE.tree.reach * 1.1 * (0.4 + 0.6 * f) }); }   // v0.6 orchard trees
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
const shadeSignature = () => `${S.beds.join(',')}|${S.standBuilt}|${S.rackBuilt}|${S.tinctureBuilt}|${S.stillBuilt}|${S.windmillBuilt}|${S.billboardBuilt}|${S.obillboardBuilt}|${S.teaBuilt}|${S.pressBuilt}|${S.opressBuilt}|${S.fruitstandBuilt}|${Object.entries(S.orchard || {}).map(([k, t]) => t ? k + t.sp + orchStage(t) : '').join(',')}|${['stand', 'tincture', 'still', 'windmill', 'teastand', 'press', 'fruitstand'].map((k) => SPOTS[k] ? SPOTS[k].map((v) => v.toFixed(2)).join(':') : '').join(',')}|${Object.entries(S.hives || {}).map(([l, h]) => h ? l + h.x.toFixed(2) + h.z.toFixed(2) : '').join(',')}|${Object.entries(S.barrels || {}).map(([l, b]) => b ? l + b.x.toFixed(2) + b.z.toFixed(2) : '').join(',')}|${OBSTACLES.filter((o) => o.type === 'tree' && obsState(o.id) === 'full').length}|${S.trees.map((t) => t.id + (t.st === 'full' ? treeStageAt(t, now()) : 's')).join(',')}`;
function refreshShade(force = false) {
  const sig = shadeSignature(); if (!force && sig === shadeSig) return; shadeSig = sig;
  applyShade(); save(); if (selected != null || focus) renderSheet();
}
const irrigLine = (i) => { const bed = bedOfTile(i); if (!S.irrigBeds.includes(bed)) return ''; const p = S.tiles[i], lot = feedLot(bed), b = S.barrels[lot];
  const paused = p && thirsty(p) && (!b || b.w <= 0);
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
// v0.52: Tea Stand — teas are generated items, so every tea the save mentions is registered before anything renders
if (!Array.isArray(S.teas) || S.teas.length !== TEA.slots) S.teas = Array(TEA.slots).fill(null);
for (const id of [...Object.keys(S.bags.home), ...Object.keys(S.bags.orchard), ...Object.keys(S.stand || {}), ...Object.keys(S.stats?.soldBy || {}), ...S.teas.filter(Boolean).map((t) => t.id)]) if (id.startsWith('tea_')) registerTea(id);
if (S.teaPos) { SPOTS.teastand = [S.teaPos.x, S.teaPos.z]; W.teastand.position.set(S.teaPos.x, 0, S.teaPos.z); }
// v0.6: crafting stands + orchard + the Sunflower rework (old Sunflower flowers / dried bunches become coins at their old prices)
for (const c of Object.keys(CRAFT)) { const C = CRAFT[c]; if (!Array.isArray(S[C.slots]) || S[C.slots].length !== C.def.slots) S[C.slots] = Array(C.def.slots).fill(null);
  S[C.slots] = S[C.slots].map((t) => (t && craftRecipe(c, t.rid) ? t : null));
  if (S[C.pos]) { SPOTS[c] = [S[C.pos].x, S[C.pos].z]; W[c].position.set(S[C.pos].x, 0, S[C.pos].z); } }
if (!S.orchard || typeof S.orchard !== 'object') S.orchard = {};
for (const k of Object.keys(S.orchard)) if (!S.orchard[k] || !TREES[S.orchard[k].sp] || !ORCHARD_TREE_SPOTS[k]) delete S.orchard[k];
let sunflowerRefund = 0;
{ const OLD = { flower_sunflower: 54, dried_sunflower: 132 };
  for (const [id, v] of Object.entries(OLD)) for (const box of [S.bags.home, S.bags.orchard, S.stand || {}]) { const n = box[id] || 0; if (n > 0) sunflowerRefund += n * v; delete box[id]; }
  if (Array.isArray(S.rack)) S.rack = S.rack.map((r) => { if (r?.sp === 'sunflower') { sunflowerRefund += OLD.dried_sunflower; return null; } return r; });
  if (sunflowerRefund) { S.coins += sunflowerRefund; S.stats.sunflowerRefund = (S.stats.sunflowerRefund || 0) + sunflowerRefund; writeSave(); } }
// v0.6: shelves used to switch on the moment they were restored. Keep it installed where it already worked (a built stand);
// a shelf that was stuck in the bag (no stand yet) becomes an installable item.
if (S.shelfOn === undefined) { S.shelfOn = !!(S.bonus.crate && S.standBuilt); }
// v0.63: before this build an installed shelf was ALSO the Bag's Crate Shelf (one flag, bonus.crate, for both). Installing is now
// permanent and takes it out of the Bag, so the installed unit is no longer counted in the Bag. bonus.crate could only ever hold
// one shelf, so there is no separate spare to keep; raw Old Crate finds (S.finds.old_crate) are untouched.
// v0.63: building levels — whole numbers 1–4, and the rack always has one slot per level's worth (drying bundles are kept)
for (const k of ['stand', 'rack']) S[k + 'Lv'] = blv(k);
if (!Array.isArray(S.rack)) S.rack = [];
while (S.rack.length < rackSlots()) S.rack.push(null);
const shelfMig063 = { dropped: false };
if (fromBuild && !(parseFloat(fromBuild) >= 0.63)) {
  if (S.shelfOn && S.bonus.crate && S.standBuilt) { S.bonus.crate = false; shelfMig063.dropped = true; }   // installed on a built stand: drop the duplicate Bag entry
  else if (S.shelfOn) S.shelfOn = false;   // flagged on but never really installed (no shelf, or no stand): a Bag shelf stays in the Bag
  writeSave(); }
if (S.mapOpen === undefined) S.mapOpen = LOT_FOR_SALE.every((l) => S.lots[l]) || !!S.lots.orchard;   // v0.61: old saves that own every Home plot get the Map
// ---- v0.61: Blue Lotus plantings move into a water barrel (full if already watered, else empty) ----
for (const p of S.tiles) if (p && p.sp === 'bluelotus' && p.fill === undefined) p.fill = p.wateredAt ? 2 : 0;
// ---- v0.61 location rules: migrate old saves without loss ----
const mig061 = { fruitBack: 0, moved: [], fsCard: null };
if (!S.ostand || typeof S.ostand !== 'object') S.ostand = {};
// v0.7: sound settings (Music / Sound Effects volume 0–1 + a mute each), kept in the save
S.audio = { music: 0.6, sfx: 0.8, musicMute: false, sfxMute: false, ...(S.audio && typeof S.audio === 'object' ? S.audio : {}) };
for (const k of ['music', 'sfx']) S.audio[k] = Math.min(1, Math.max(0, +S.audio[k] || 0)); for (const k of ['musicMute', 'sfxMute']) S.audio[k] = !!S.audio[k];
if (!S.workers || typeof S.workers !== 'object') S.workers = {};
if (!S.managers || typeof S.managers !== 'object') S.managers = {};   // v0.7.2: Market Managers (one per location, beside the Gardener)
migWorkerLoc();
// v0.7: the sound player. Nothing plays until the first tap/click/key (browser autoplay rules); then the place's tune loops softly.
Sound = createAudio({ prefs: () => S.audio }); Sound.setScene(S.loc === 'orchard' ? 'orchard' : 'home');
{ const first = () => Sound.unlock(); for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, first, { capture: true, passive: true }); }
document.addEventListener('click', (e) => { const b = e.target.closest?.('button, .btn, [data-act], [data-buy], .tab, .seg button, .follow-btn'); if (b && !b.disabled) sfx('tap'); }, true);
{ const ba = W.buildAnim; if (ba) W.buildAnim = (...a) => { sfx('build'); return ba(...a); }; }   // v0.61: Garden Workers ({ lot: { x, z, end, done, made } })
const bootSavedAt = S.savedAt;
// the old Orchard Shed came free with the Orchard (and fed its barrel), so a save that already owns the Orchard keeps it, built
if (S.oshedBuilt === undefined) S.oshedBuilt = !!S.lots.orchard;
// fruit and Fruit Stand jars sell only at the Orchard now: any stocked on the Home Farm Stand go back to the Bag
for (const id of Object.keys(S.stand || {})) if (!sellsAt(id, 'home') && S.stand[id] > 0) { S.inv[id] = (S.inv[id] || 0) + S.stand[id]; mig061.fruitBack += S.stand[id]; delete S.stand[id]; }
// stands in a place they may no longer stand go back to the Bag, unplaced (Place button), keeping their slots
for (const [what, built, pos] of [['fruitstand', 'fruitstandBuilt', 'fruitstandPos'], ['tincture', 'tinctureBuilt', 'tincPos'], ['still', 'stillBuilt', 'stillPos'], ['teastand', 'teaBuilt', 'teaPos']]) {
  if (!S[built]) continue; const lot = S[pos]?.lot || 'home';
  if (!standOkAt(what, lotLoc(lot))) { S[built] = false; S[pos] = null; mig061.moved.push(what); }
}
// the Fruit Stand left the card packs: free with the Orchard. A bought one is refunded (it was 120 coins), duplicates become coins.
if (S.cards?.fruitstand) { const n = S.cards.fruitstand.n || 1; const coins = (n - 1) * TINC_DUP_COINS + (S.owned.fruitstand && !S.fsFree ? 120 : 0); S.coins += coins; delete S.cards.fruitstand; mig061.fsCard = { n, coins }; }
if (S.lots.orchard) { S.owned.fruitstand = S.unlocked.fruitstand = S.discovered.fruitstand = true; S.fsFree = true; }
if (mig061.fruitBack || mig061.moved.length || mig061.fsCard) writeSave();
W.makeBlueprint(W.tincture, 'tincture', `Blueprint · ${BUILDS.tincture.wood} Wood`, 2.2, 1.4);
W.orchardShed.visible = true; W.makeBlueprint(W.orchardShed, 'oshed', `Orchard Stand · ${ORCH_STAND.coins} coins + ${ORCH_STAND.wood} Wood`, 2.6, 2.0); W.orchardShed.visible = false;
for (const o of OBSTACLES) W.setObstacle(o.id, obsState(o.id));
for (const id of [...LOT_FOR_SALE, ...ORCH_FOR_SALE]) W.setLotOwned(id, !!S.lots[id]);
setTimeout(() => syncOShed(), 0);   // after the Orchard Stand helpers are defined
S.beds.forEach((id) => W.addBed(id, false));
while (S.tiles.length < S.beds.length * PER_BED) S.tiles.push(null);
if (S.standBuilt) W.appear(W.stand, false);
for (const [lot, b] of Object.entries(S.barrels)) { if (lot === 'home') W.appear(W.barrel, false); else W.addBarrel(lot, b.x, b.z, false); }
// v0.4: the Honeybee Skep used to boost every harvest everywhere. An old global hive becomes a placed hive on the home plot.
let hiveMigrated = false;
// v0.4: card stacks — every card already discovered becomes a stack of 1 at Lv1 (extra Irrigation cards already owned count as copies).
if (!Object.keys(S.cards).length) { for (const id of Object.keys(CARDS)) if (S.discovered[id]) S.cards[id] = { n: id === 'irrigation' ? Math.max(1, S.irrigN || 0) : 1, lv: 1 }; }
// v0.63: repair card stacks on every load. Older saves (the v0.4 plant migration rewrote raw save text, old ids, hand-edited or
// partly-written saves) can hold stacks whose level/copies aren't clean whole numbers (lv missing/0/null/"1"/1.5, n as text) or
// whose id isn't an exact CARDS id (e.g. "Lavender", "heartvine"). nextAt() indexes CARD_LEVELS.thresholds by lv-1, so any of
// those silently hid the Upgrade button. Stacks are merged into their real card id (copies added, best level kept) and
// lv/n become whole numbers (lv clamped to 1–4, n ≥ 1). Earned levels are never taken away.
const cardFix063 = normalizeCards(S);
// v0.63 Irrigation: one card hooks up beds and levels up like any card. Old saves had one card per irrigated bed (S.irrigN):
// every copy they owned becomes level-up progress (n = copies, level still tapped up in the Bag) and every hook-up stays.
if (S.irrigN > 0 || S.irrigBeds.length || S.cards.irrigation) { const c = S.cards.irrigation || (S.cards.irrigation = { n: 0, lv: 1 }); c.n = Math.max(+c.n || 0, S.irrigN || 0, 1); S.owned.irrigation = S.discovered.irrigation = S.unlocked.irrigation = true; }
// v0.63 water: plants already growing keep growing this cycle (no bud stop — they have no p.bud flag); a half-filled Blue Lotus keeps its half.
for (const p of S.tiles) if (p && !p.wateredAt && p.sp === 'bluelotus' && p.fill >= 1 && p.wu == null) p.wu = WATER.lotus[0][0] / 2;
S.bedCredit = S.bedCredit && typeof S.bedCredit === 'object' ? S.bedCredit : {};
function normalizeCards(st) {
  const out = { fixed: [], merged: [] }; if (!st.cards || typeof st.cards !== 'object' || Array.isArray(st.cards)) { st.cards = Object.assign({}, st.cards || {}); out.fixed.push('cards'); }
  const ids = Object.keys(CARDS), lower = Object.fromEntries(ids.map((k) => [k.toLowerCase().replace(/[\s_-]/g, ''), k]));
  const maxLv = CARD_LEVELS.thresholds.length + 1, int = (v) => { const x = typeof v === 'string' ? parseFloat(v.replace(/[^\d.\-]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(x) ? Math.round(x) : NaN; };
  for (const key of Object.keys(st.cards)) {
    const raw = st.cards[key]; let id = key;
    if (!CARDS[id]) { const k = key.toLowerCase().replace(/[\s_-]/g, ''); id = lower[k] || lower[PLANT_MAP[k] || ''] || null; }
    if (!id || !CARDS[id]) continue;   // unknown/retired ids are left alone (other migrations handle tincture / fruitstand)
    const c = raw && typeof raw === 'object' ? raw : { n: raw };   // a bare number = copies
    let n = int(c.n ?? c.count ?? c.copies), lv = int(c.lv ?? c.level);
    if (!(n >= 1)) n = 1; if (!(lv >= 1)) lv = 1; if (lv > maxLv) lv = maxLv;
    const clean = { ...c, n, lv }; delete clean.count; delete clean.copies; delete clean.level;
    if (id !== key) { const prev = st.cards[id]; delete st.cards[key]; out.merged.push(`${key}→${id}`);
      if (prev && typeof prev === 'object') { prev.n = (int(prev.n) >= 1 ? int(prev.n) : 1) + n; prev.lv = Math.min(maxLv, Math.max(int(prev.lv) >= 1 ? int(prev.lv) : 1, lv)); } else st.cards[id] = clean; continue; }
    if (c.n !== n || c.lv !== lv || raw !== c || 'count' in c || 'copies' in c || 'level' in c) { out.fixed.push(`${id}: n ${JSON.stringify(c.n)}→${n}, lv ${JSON.stringify(c.lv)}→${lv}`); st.cards[id] = clean; }
  }
  if (out.fixed.length || out.merged.length) writeSave();
  return out;
}
if (S.owned.beehive && !S.hivesSold && !Object.keys(S.hives).length && !(S.hiveInv > 0)) { const sp = freeSpot('home', S.barrels.home); if (sp) { S.hives.home = sp; hiveMigrated = true; } else S.hiveInv = 1; writeSave(); }
for (const [lot, h] of Object.entries(S.hives)) W.addHive(lot, h.x, h.z, false);
for (const k of wkAll()) { const w = wkRec(k); W.addWorker(k, w.x, w.z, false); W.setWorker(k, Date.now() >= w.end ? 'pay' : 'work'); }
setTimeout(() => { catchUpWorkers(); migWorkerHour(); syncWorkers(); }, 0);
// v0.7: Gardeners now work 1-hour hires. Existing saves: every current worker (working or waiting for pay) gets a fresh hour, once.
function migWorkerHour() {
  if (S.workerHour) return 0; let n = 0; const t = Date.now();
  for (const [lot, w] of Object.entries(S.workers || {})) { w.hired = t; w.end = t + 3600e3; w.ended = false; w.pass = false; W.setWorker(lot, 'work'); n++; }
  S.workerHour = true; save(); return n;
}
// v0.7.2: one Gardener + one Market Manager per LOCATION (they used to be hired per plot). Existing saves, once: if any plot
// of a location has a Gardener still working, that location gets a Gardener AND a Market Manager for the longest remaining
// shift (free). Off-shift hires collapse into one location hire waiting to be hired again. Shift tallies are added up.
function migWorkerLoc() {
  if (S.wkLoc072) return 0; let n = 0; const t = Date.now(), oldW = S.workers || {}, oldM = S.managers || {}, W2 = {}, M2 = {};
  const sum = (recs) => { const d = {}; for (const r of recs) for (const [k, v] of Object.entries(r.done || {})) d[k] = (d[k] || 0) + (+v || 0); return d; };
  for (const loc of ['home', 'orchard']) {
    const ws = Object.entries(oldW).filter(([l]) => workerLoc(l) === loc).map(([, w]) => w), ms = Object.entries(oldM).filter(([l]) => workerLoc(l) === loc).map(([, w]) => w);
    if (!ws.length && !ms.length) continue;
    const live = ws.filter((w) => w.end > t), lead = oldW[loc] || ws[0] || ms[0];
    const best = (a) => a.reduce((x, y) => (y.end > x.end ? y : x));
    if (ws.length) { const b = best(live.length ? live : ws); W2[loc] = { ...lead, hired: b.hired, end: b.end, pass: !!b.pass, ended: !(b.end > t), done: sum(ws), made: [...new Set(ws.flatMap((w) => w.made || []))].slice(-40) }; n++; }
    const mLive = ms.filter((w) => w.end > t), cand = [...live, ...mLive];
    if (cand.length) { const b = best(cand), g = W2[loc] || lead; M2[loc] = { x: +(g.x + 0.9).toFixed(2), z: g.z, hired: b.hired || t, end: b.end, pass: !!b.pass, ended: false, done: sum(ms), made: [...new Set(ms.flatMap((w) => w.made || []))].filter((id) => !id.startsWith('flower_')).slice(-40) }; n++; }
    else if (ms.length) { const b = best(ms), m0 = oldM[loc] || ms[0]; M2[loc] = { ...m0, hired: b.hired, end: b.end, ended: true, done: sum(ms), made: [] }; n++; }
  }
  S.workers = W2; S.managers = M2; S.wkLoc072 = true; S.wkSplit072 = true; return n;
}
function migWorkerSplit() { S.wkSplit072 = true; return 0; }   // v0.7.2 (superseded by migWorkerLoc, which also hands out the Manager)
if (S.tinctureBuilt) W.appear(W.tincture, false);
if (S.stillBuilt && S.stillPos) W.appear(W.still, false);
if (S.teaBuilt && S.teaPos) W.appear(W.teastand, false);
for (const c of Object.keys(CRAFT)) if (S[CRAFT[c].built] && S[CRAFT[c].pos]) W.appear(W[c], false);
for (const k of Object.keys(S.orchard)) W.addOrchardTree(+k, S.orchard[k].sp);
if (S.lots.orchard) orchardStarterTree();   // v0.68: saves stuck with an empty Orchard and no tree card get the Apple Tree card
if (S.windmillPos) { SPOTS.windmill = [S.windmillPos.x, S.windmillPos.z]; W.windmill.position.set(S.windmillPos.x, 0, S.windmillPos.z); if (S.windmillBuilt) W.appear(W.windmill, false); }
setTimeout(() => { if (S.parkingBuilt) { W.setParking(parkCap()); W.appear(W.parking, false); } if (S.oparkingBuilt) { syncParking(); W.appear(W.oparking, false); } if (S.billboardBuilt) W.appear(W.billboard, false); if (S.obillboardBuilt) W.appear(W.obillboard, false); if (S.billboardBuilt || S.obillboardBuilt) syncBillboard(); }, 0);   // after the traffic helpers are defined
if (S.rackBuilt) W.appear(W.rack, false);
syncMarket();
for (const g of S.ground) W.addLoot(g.key, g.kind, g.x, g.z, false);
for (const d of S.decor) W.addDecor(d.key, d.type, d.x, d.z, d.r || 0, false);
for (const d of S.gf) W.addFeat(d.key, d.id, d.x, d.z, d.r || 0, false);   // v0.65
queueMicrotask(() => { migGF065(); migTrees065(); deliverOverdue(); });
for (const t of S.trees) W.addGrown(t.id, t.x, t.z, treeStage(t), t.st === 'stump' ? 'stump' : 'full');
syncBlueprints();
function syncBlueprints() {
  W.setBlueprint('stand', S.beds.length > 0 && !S.standBuilt && !building.stand);
  W.setBlueprint('rack', S.rackAvail && !S.rackBuilt && !building.rack);
  W.setBlueprint('tincture', false);   // v0.41: no fixed blueprint — the player picks the spot
}
function syncMarket() { W.setMarketState(S.marketBuilt ? 'open' : S.marketProj ? 'building' : 'closed', marketK()); }
const lastStage = [];
// v0.61: the Blue Lotus grows in a water barrel that needs two waterings: half full, then full — only then does it grow
const lotusFill = (p) => (p.sp !== 'bluelotus' ? 2 : p.wateredAt ? 2 : Math.min(2, p.fill || 0));
const LOTUS_TXT = ['empty', 'half full', 'full'];
const lotusLine = (p) => (p.sp === 'bluelotus' ? `<p class="lotus-line" data-lotus-fill="${lotusFill(p)}"><span class="lotus-gauge"><em style="height:${lotusFill(p) * 50}%"></em></span> Barrel: <b>${LOTUS_TXT[lotusFill(p)]}</b>${lotusFill(p) < 2 ? ` <small>· ${lotusFill(p) ? 'one more watering fills it' : 'water twice to fill it'}</small>` : ''}</p>` : '');
function syncTile(i, pop = true) {
  const p = S.tiles[i];
  if (!p) { W.setPlant(i, null, 0, false); W.setIcon(i, null); lastStage[i] = null; return; }
  if (p.hold && now() - p.plantedAt < 3000) return;   // v0.4: the plow reveals seedlings as its furrow passes
  const st = stageOf(p);
  const fill = p.sp === 'bluelotus' ? lotusFill(p) : '';
  if (W.setPlant(i, p.sp, st, !!p.wateredAt, fill)) W.attachPlant(i, buildPlant(p.sp, st, { fill }), pop);
  W.setIcon(i, thirsty(p) ? 'water' : st === 3 ? 'ready' : null);
  if (lastStage[i] != null && lastStage[i] !== st && st === 3) onBloom(i);
  lastStage[i] = st;
}
function syncStill() { W.setStill(S.stills.map((t) => t && { done: now() - t.start >= t.ms })); }
function syncTinc() { W.setTincture(S.tinc.map((t) => t && { base: t.base, done: now() - t.start >= t.ms })); }
function syncBarrels() {
  for (const [lot, b] of Object.entries(S.barrels)) { const roof = barrelRoof(lot); W.setBarrelLv?.(lot, barrelLv(b)); W.setGutter(lot, barrelStands(lot).map((r) => SPOTS[r]));
    if (roof) W.setBarrelInfo(lot, barrelText(lot, false), `${barrelPerTick(lot) > 1 ? '2 stands · +2 per tick · ' : ''}${S.windmillBuilt ? 'Windmill: faster refill · ' : ''}Feeds ${barrelBeds(lot).length}/${BARREL.maxBeds} beds`, b.w >= regenMax(b), b.w / regenMax(b));
    else W.setBarrelInfo(lot, `${b.w}/${regenMax(b)} · Not collecting`, 'Connect to a stand on this plot', false, b.w / regenMax(b)); }
}
function syncRack() { W.setRack(S.rack.map((r) => r && { done: now() - r.start >= r.ms })); }
// v0.5: the stand's three crates show any plant goods — plants cycle through the heart / sun / moon crates in catalog
// order (Lavender → heart, Calendula → sun, Chamomile → moon, exactly as before; then Peppermint → heart, …).
const SP_IDX = Object.fromEntries(Object.keys(SPECIES).map((k, i) => [k, i]));
function syncStand() {
  const box = { heart: 0, sun: 0, moon: 0 }, names = ['heart', 'sun', 'moon'];
  for (const [id, n] of Object.entries(S.stand)) { if (!n) continue; const m = /^(seed|flower|dried)_(.+)$/.exec(id); if (!m || SP_IDX[m[2]] == null) continue;
    box[names[SP_IDX[m[2]] % 3]] += n; if (id === 'dried_lavender') box.moon += n; }
  W.setStandStock(box); syncShelf();
}
bgCasters = W.bgTrees.map((b, n) => ({ id: 'bg' + n, x: b.x, z: b.z, w: SHADE.bgTree.w * b.s, reach: SHADE.bgTree.reach * b.s }));
catchUpIrrigation(); catchUpShade(); worldReady = true; applyShade(); shadeSig = shadeSignature();
for (const id of [...S.irrigBeds]) { if (!S.barrels[feedLot(id)]) { S.irrigBeds.splice(S.irrigBeds.indexOf(id), 1); if (S.irrigFrom) delete S.irrigFrom[id]; continue; } W.setIrrigation(id, true, barrelXZ(feedLot(id))); }
for (let i = 0; i < S.tiles.length; i++) syncTile(i, false);
syncRack(); syncStand(); syncTinc(); syncStill(); syncBarrels(); setTimeout(syncBees, 0);   // after the module has defined the bee helpers
document.fonts?.ready.then(() => W.relabel());

// ---------------- HUD ----------------
const shown = { coins: S.coins, wood: S.wood, water: totalWater(), jewels: S.jewels };
function bump(id) { const p = $(id); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
function hud() {
  syncMapBtn();
  $('#coin-count').textContent = S.coins; const tw = totalWater(); $('#water-count').textContent = tw; $('#wood-count').textContent = S.wood; $('#jewel-count').textContent = S.jewels;
  if (S.coins !== shown.coins) { bump('#pill-coins'); shown.coins = S.coins; }
  if (S.wood !== shown.wood) { bump('#pill-wood'); shown.wood = S.wood; }
  if (tw !== shown.water) { bump('#pill-water'); shown.water = tw; }
  if (S.jewels !== shown.jewels) { bump('#pill-jewels'); shown.jewels = S.jewels; }
  const done = S.rack.filter((r) => r && now() - r.start >= r.ms).length;
  const b = $('#rack-badge'); if (b) { b.classList.toggle('hidden', !done); b.textContent = done; }   // v0.65: no Rack tab any more (tap the rack in the garden)
  $('#tab-stand').classList.toggle('hidden', !(curLoc() === 'orchard' ? S.oshedBuilt || S.lots.orchard : S.standBuilt));   // v0.67.1: per-location stand
  $('#tab-market').classList.toggle('locked', !S.marketBuilt);
  const sb = $('#stand-badge'); const n = curLoc() === 'orchard' ? ostandCount() : standCount(); sb.classList.toggle('hidden', !n); sb.textContent = n;
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
function toast(msg) { if (quiet) return; const t = el('div', 'toast', msg); $('#ui').appendChild(t); fillIcons(t); setTimeout(() => t.remove(), 2300); }
function popAt(worldPos, html, cls = '') {
  if (quiet) return;
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
  // v0.65: 'Plant a tree sapling' is gone — trees are Orchard-only, and the Orchard comes long after this chain (saves are remapped in migTrees065)
  { id: 'plot', text: 'Buy a neighboring plot', n: () => S.lotsBought, of: 1, icon: 'sign', hint: 'plot' },
  { id: 'plotbarrel', text: 'Give a bought plot its own Rain Barrel · reward: a free Tincture Stand', reward: 'tincture', n: () => Object.keys(S.barrels).filter((l) => l !== 'home').length, of: 1, icon: 'water', hint: 'plotbarrel' },
];
// v0.52: the chain ends with the goal that grants the Tincture Stand. The old follow-ups (make a tincture, open a pack,
// distill an essential oil) are gone — the Essential Oil Stand is still a pack card, just not a goal. Saves that were on
// or past those goals land on "all done" (index = GOALS.length) and get the closing message once.
let closingAfter = 0, closingEl = null;
const GOALS_END = { title: 'The garden is yours now', text: 'Have fun discovering new cards and planting!' };
// v0.52: the Tincture Stand is free: the reward for the goal that names it. It goes straight into spot picking on a bought
// plot; with no other plot yet it waits in the Bag (Place button) until you buy one.
function grantTincture(quiet = false) {
  if (S.owned.tincture) return false;
  S.owned.tincture = S.unlocked.tincture = S.discovered.tincture = true; S.tincReward = now(); save();
  if (quiet) return true;
  setTimeout(() => {
    if (tincLots().length && !S.tinctureBuilt) { toast('🎁 Goal reward: a free <b>Tincture Stand</b> — tap a green spot on one of your other plots'); startStandPlace('tincture', 'Tincture Stand', 0); }
    else toast('🎁 Goal reward: a free <b>Tincture Stand</b>! Buy a neighbouring plot, then place it from your Bag');
    hud();
  }, 1400);
  return true;
}
function checkGoals(silent = false) {
  migTreeGoal065();   // v0.65
  if (!(S.goal <= GOALS.length)) S.goal = GOALS.length;   // v0.52 migration: old goals 13–15 were removed
  if (!S.marketAvail && S.stats.standEarned >= MARKET_GOAL) {
    S.marketAvail = true; save();
    if (!silent) { toast('<i data-icon="market"></i> New project: Rebuild the Supply Market'); setTimeout(() => tip('rebuild'), 900); }
  }
  while (S.goal < GOALS.length && GOALS[S.goal].n() >= GOALS[S.goal].of) {
    const g = GOALS[S.goal]; S.goal++; save();
    if (silent) continue;
    const card = $('#goal'); card.classList.remove('done'); void card.offsetWidth; card.classList.add('done'); goalPeek(4500);
    toast(`<i data-icon="flag"></i> Goal complete · ${g.text}`); sfx('goal');
    if (g.id === 'clear') setTimeout(() => tip('build'), 600);
    if (g.id === 'market') setTimeout(() => tip('plot'), 4000);
    if (S.goal >= GOALS.length) closingAfter = Date.now() + 4500;   // let the reward toast / stand placement go first
  }
  // v0.52: goal rewards (the Tincture Stand) — also granted silently for goals finished while loading
  for (let k = 0; k < S.goal; k++) if (GOALS[k].reward === 'tincture' && !S.owned.tincture) grantTincture(silent);
}
checkGoals(true);
let goalKey = '';
function renderGoal() {
  const G = $('#goal'); if (!S.introDone || (S.goalsClosed && S.goal >= GOALS.length)) { G.classList.add('hidden'); return; }
  G.classList.remove('hidden');
  const g = GOALS[S.goal];
  const key = g ? `${S.goal}:${Math.min(g.n(), g.of)}` : 'done'; if (key === goalKey) return; goalKey = key;
  if (!g) { if (S.goalsClosed) { G.classList.add('hidden'); return; }   // v0.52: retired after the closing message
    G.innerHTML = `<i data-icon="flag"></i><span class="gp">${GOALS.length}/${GOALS.length} ✓</span><div class="gfull"><b>All goals done</b><small>${GOALS_END.text}</small></div>`; fillIcons(G); return; }
  const n = Math.min(g.n(), g.of);
  G.innerHTML = `<i data-icon="${g.icon}"></i><span class="gp">${S.goal + 1}/${GOALS.length}${g.of > 1 ? `<em class="gpbar"><em style="width:${(n / g.of) * 100}%"></em></em>` : ''}</span><div class="gfull"><small>Goal ${S.goal + 1} of ${GOALS.length}</small><b>${g.text}</b>${g.of > 1 ? `<span class="gbar"><em style="width:${(n / g.of) * 100}%"></em></span><small class="gn">${n} / ${g.of}</small>` : ''}<button class="g-hint" type="button">Hint</button></div>`;
  fillIcons(G);
}
// v0.52: after the last goal, a warm one-time closing card with a petal flourish; then the goal pill retires for good
function maybeClosing() {
  if (S.goal < GOALS.length || S.goalsClosed || !S.introDone || closingEl || Date.now() < closingAfter) return;
  if (placing || document.body.classList.contains('modal-open')) return;   // wait for the stand placement / any panel
  showClosing();
}
function showClosing() {
  const o = el('div', 'goals-closing'); o.dataset.closing = '1';
  o.innerHTML = `<div class="gc-card"><div class="gc-badge"><i data-icon="flag"></i></div><small class="gc-kicker">All ${GOALS.length} goals complete</small>
    <h2>${GOALS_END.title}</h2><p>${GOALS_END.text}</p>
    <button class="btn btn-gold" data-act="goals-closing"><i data-icon="sparkle"></i> Let’s grow</button></div>`;
  $('#ui').appendChild(o); closingEl = o; fillIcons(o); syncOverlay();
  petals(o, 42); const r = o.querySelector('.gc-card').getBoundingClientRect(); sparkles(o, r.left + r.width / 2, r.top + 34, 18); buzz([20, 40, 20]);
  const drift = setInterval(() => o.isConnected ? petals(o, 6) : clearInterval(drift), 900);
  o.addEventListener('click', (e) => { if (e.target.closest('[data-act="goals-closing"]') || e.target === o) closeClosing(); });
}
function closeClosing() {
  if (!closingEl) return; S.goalsClosed = true; save();
  const o = closingEl; closingEl = null; o.classList.add('out'); setTimeout(() => { o.remove(); syncOverlay(); }, 320);
  goalKey = ''; renderGoal();
}
setInterval(maybeClosing, 1500);
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
  const open = vis('#panel') || vis('#confirm') || vis('#reveal') || vis('#tile-sheet') || !!document.querySelector('#ui > .ad-break, #ui > .zoom, #ui > .goals-closing');
  if (document.body.classList.contains('modal-open') !== open) document.body.classList.toggle('modal-open', open);
  const bar = vis('#buildbar'); if (document.body.classList.contains('bar-open') !== bar) document.body.classList.toggle('bar-open', bar);   // v0.64: the Jewel dock steps aside for the build bar
  if (open && !$('#goal').classList.contains('collapsed')) goalCollapse();
}
new MutationObserver(syncOverlay).observe($('#ui'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

// ---------------- Tips ----------------
const tipQueue = []; let tipTimer = 0;
// v0.68: Home-garden tips ("Tap the sparkling plant", "Tap a stump"…) no longer pop up at the Orchard, where there is nothing to
// tap — a Home bloom used to trigger one while you were away. They stay unseen and show the next time it happens at Home.
const HOME_TIPS = new Set(['chop', 'stump', 'find', 'build', 'standbp', 'water', 'growing', 'shade', 'bloom', 'harvested', 'stand', 'barrel']);
const tipHere = (key) => !HOME_TIPS.has(key) || !(S.loc === 'orchard' && S.lots.orchard);
function tip(key) { if (quiet || S.tips[key] || tipQueue.includes(key) || !TIPS[key] || !tipHere(key)) return; tipQueue.push(key); if (tipQueue.length === 1) showTip(); }
function showTip() {
  while (tipQueue.length && !tipHere(tipQueue[0])) tipQueue.shift();
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
  if (!S.stats.finds && !S.ground.some((g) => g.kind !== 'sapling' && g.kind !== 'roadscrap') && S.stats.cleared >= 2) return 'watering_can'; // never wait too long for the first find
  return null;
}
function dropLoot(kind, x, z, delay = 0) {
  const key = 'l' + S.uid++; const d = Math.hypot(x, z - 30) || 1;
  const lx = x + (0 - x) / d * 0.45, lz = z + (30 - z) / d * 0.45;   // nudge toward the road/camera so it isn't hidden by the stump
  S.ground.push({ key, kind, x: lx, z: lz }); save();
  setTimeout(() => { W.addLoot(key, kind, lx, lz, true); tip(kind === 'sapling' ? 'sapling' : 'find'); }, delay);
  return key;
}
// v0.52: now and then a piece of Scrap Metal lies by the road (1 Scrap, tap to pick up). One at a time; a new one turns up
// after a random 8–12 minutes of play (the clock only runs while the game is open and no piece is waiting).
const roadScrapNext = () => ROAD_SCRAP.minS + Math.random() * (ROAD_SCRAP.maxS - ROAD_SCRAP.minS);
function roadScrapTick(dt) {
  if (!S.introDone || S.ground.some((g) => g.kind === 'roadscrap')) return;
  const r = S.roadScrap || (S.roadScrap = { t: 0, next: roadScrapNext() });
  r.t += dt; if (r.t >= r.next) spawnRoadScrap();
}
function spawnRoadScrap() {
  if (S.ground.some((g) => g.kind === 'roadscrap')) return null;
  const side = Math.random() < 0.5 ? -1 : 1, x = +(side * (5.2 + Math.random() * 6)).toFixed(2), z = +(ROAD.z0 - 0.15 + Math.random() * 0.25).toFixed(2);   // on the near verge, clear of the stand & bays
  const key = 'l' + S.uid++; S.ground.push({ key, kind: 'roadscrap', x, z }); S.roadScrap = { t: 0, next: roadScrapNext() }; save();
  W.addLoot(key, 'roadscrap', x, z, true); return key;
}
function collectLoot(key) {
  const g = S.ground.find((x) => x.key === key); if (!g) return;
  S.ground = S.ground.filter((x) => x.key !== key);
  if (g.kind === 'roadscrap') { S.scrap += ROAD_SCRAP.scrap; S.stats.roadScrap = (S.stats.roadScrap || 0) + 1; popAt(V3(g.x, 1.2, g.z), `<i data-icon="scrap"></i>+${ROAD_SCRAP.scrap} Scrap Metal`); toast(`Picked up Scrap Metal from the roadside · you have ${S.scrap}`); }
  else if (g.kind === 'sapling') { const ob = S.bags.orchard; ob.sapling = (ob.sapling || 0) + 1; popAt(V3(g.x, 1.2, g.z), `<i data-icon="sapling"></i>Tree sapling → Orchard Bag`); tip('sapling'); }   // v0.65: trees are Orchard-only
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
function plantSapling(x, z) { return inBag(lotLoc(lotAt(x, z) || 'home'), () => plantSapling_(x, z)); }
function plantSapling_(x, z) {
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
  for (const d of [...S.decor, ...S.trees, ...(S.gf || [])]) if (Math.hypot(d.x - x, d.z - z) < 0.9) return 'Too close to something else';
  for (const g of S.ground) if (Math.hypot(g.x - x, g.z - z) < 0.6) return 'Pick up the item here first';
  for (const b of Object.values(S.barrels || {})) if (Math.hypot(b.x - x, b.z - z) < 1.0) return 'Too close to a rain barrel';
  for (const b of Object.values(S.hives || {})) if (Math.hypot(b.x - x, b.z - z) < 1.0) return 'Too close to a beehive';
  return null;
}
function enterPlace(what, type) {
  const bi = buyIntent;   // v0.52: buying straight into placement — nothing is owned (or charged) until the spot is confirmed
  if (what === 'sapling' && curLoc() !== 'orchard') { toast('<i data-icon="sapling"></i> Trees can only be planted in the Orchard'); return; }   // v0.65
  if (what === 'sapling' && !(S.inv.sapling > 0) && !bi) { toast('You have no saplings — buy one at the Supply Market (or find them while clearing)'); return; }
  if (what === 'decor' && !(S.decorInv[type] > 0)) return;
  if (what === 'gfeat') { if (!(S.gfInv?.[type] > 0)) { toast(`${FEATURES[type]?.name || 'That'} isn’t in your bag`); return; }
    closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what, type };
    $('#buildbar-text').innerHTML = `Tap open ground on your land to place <b>${FEATURES[type].name}</b>${type === 'gardenbell' ? ' · it helps the stand at the location where it stands' : ''}`; $('#buildbar').classList.remove('hidden'); return; }
  if (what === 'irrigation') { if (!hasIrrig() && !bi) { toast('Buy Irrigation in the Supply Market — one raised bed per purchase'); return; } closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Irrigation</b> · tap a raised bed to hook it up to its rain barrel`; $('#buildbar').classList.remove('hidden'); return; }
  if (what === 'hive') { const need = hiveLots(); if (!need.length) { toast('Every plot you own already has a beehive (one per plot)'); return; } if (!(S.hiveInv > 0) && !bi) { toast(`Buy a Honeybee Skep at the Supply Market first (${FEATURES.beehive.price} coins)`); return; }
    closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Honeybee Skep</b> · tap clear ground (not a bed) in ${need.map(lotName).join(' or ')} · its bees only help that plot`; $('#buildbar').classList.remove('hidden'); return; }
  if (what === 'windmill') { if (S.windmillBuilt || (!S.owned.windmill && !bi)) return; if (S.wood < BUILDS.windmill.wood || S.scrap < BUILDS.windmill.scrap) { toast(`The Windmill needs ${BUILDS.windmill.wood} Wood + ${BUILDS.windmill.scrap} Scrap Metal (you have ${S.wood} Wood, ${S.scrap} Scrap)`); return; }
    closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Windmill</b> · tap clear ground anywhere on your land (not a bed) · it speeds up every connected rain barrel`; $('#buildbar').classList.remove('hidden'); return; }
  if (what === 'barrel') { const need = barrelLots(); if (!need.length) { toast('Every plot already has its rain barrel'); return; } if (!(S.barrelInv > 0) && !S.unlocked.rainbarrel) { toast('Find the Rain Barrel card in a Card Pack first'); return; }
    if (!(S.barrelInv > 0) && S.coins < BARREL.price) { toast(`A Rain Barrel costs ${BARREL.price} coins — you have ${S.coins}`); return; }
    closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Rain Barrel</b> · tap open ground in ${need.map(lotName).join(' or ')} to place it${S.barrelInv > 0 ? '' : ` · ${BARREL.price} coins`}`; $('#buildbar').classList.remove('hidden'); return; }
  closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what, type };
  const name = what === 'sapling' ? 'your tree sapling' : DECOR_INFO[type].name;
  $('#buildbar-text').innerHTML = `Tap open ground on your land to place <b>${name}</b>${what === 'sapling' ? ' · not in beds · sunny spots grow faster' : ''}`;
  $('#buildbar').classList.remove('hidden');
}
function exitPlace() { if (placing?.spots) W.setSpotGhosts(null); placing = null; syncBedTargets(); $('#buildbar').classList.add('hidden'); }
function placeAt(x, z) {
  if (placing?.what === 'orchardtree') {   // v0.6: plant a bought tree sapling on a free Orchard spot
    const near = placing.spots.filter((p) => Math.hypot(p.x - x, p.z - z) < 1.0).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    if (!near) { toast('Tap one of the green tree spots in the Orchard'); return false; }
    const why = orchardProblem(near.k); if (why) { toast(why); return false; }
    const p = placing; if (!commitBuy(p)) return false; exitPlace();
    plantOrchard(near.k, p.sp); return true;
  }
  if (placing?.what === 'tincture' || placing?.what === 'still' || placing?.what === 'teastand' || CRAFT[placing?.what]) {
    const near = placing.spots.filter((p) => Math.hypot(p.x - x, p.z - z) < 0.75).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    if (near?.ok) { x = near.x; z = near.z; }
    const why = tincProblem(x, z, placing.what); if (why) { toast(why); return false; }
    const p = placing; if (!commitBuy(p)) return false; exitPlace();
    const ok = p.what === 'still' ? placeStill(x, z) : p.what === 'teastand' ? placeTea(x, z) : CRAFT[p.what] ? placeCraft(p.what, x, z) : placeTincture(x, z); if (!ok) rollbackBuy(p); return ok;
  }
  if (placing?.what === 'barrel') { const lot = lotAt(x, z); if (lot && S.lots[lot] && S.barrels[lot]) { toast('This plot already has its rain barrel (one per plot)'); return false; } if (lot === 'home' && !S.barrel) { toast('The home plot’s barrel comes free with your first bed'); return false; } }
  if (placing?.what === 'hive') { const lot = lotAt(x, z); if (lot && S.lots[lot] && S.hives[lot]) { toast('This plot already has a beehive (one per plot)'); return false; } }
  const why = placeProblem(x, z); if (why) { toast(why); return false; }
  const p = placing; if (!commitBuy(p)) return false; exitPlace();
  const ok = placeIt(p, x, z); if (!ok) rollbackBuy(p); return ok;
}
function placeIt(p, x, z) {
  if (p.what === 'hive') return buildHive(lotAt(x, z), x, z);
  if (p.what === 'windmill') return placeWindmill(x, z);
  if (p.what === 'barrel') return buildBarrel(lotAt(x, z), x, z);
  if (p.what === 'sapling') { if (lotLoc(lotAt(x, z) || 'home') !== 'orchard') { toast('Trees can only be planted in the Orchard — tap open Orchard ground'); return false; } if (plantSapling(x, z) === false) return false; if (S.goal >= 0) tip('decor'); return true; }
  if (p.what === 'gfeat') return placeGF(p.type, x, z);
  const key = 'd' + S.uid++; S.decorInv[p.type]--; if (!S.decorInv[p.type]) delete S.decorInv[p.type];
  const r = Math.atan2(W.camera.position.x - x, W.camera.position.z - z);
  S.decor.push({ key, type: p.type, x, z, r }); W.addDecor(key, p.type, x, z, r, true);
  popAt(V3(x, 1.6, z), `<i data-icon="heart"></i>+${DECOR_INFO[p.type].atm} atmosphere`); tip('decor'); sfx('build');
  save(); hud(); return true;
}
// v0.65: garden features (Sundial + charms) — place from the bag, tap on the map to put back in the bag
// v0.65 save migration: a Sundial bought before v0.65 had no spot on the map. It is placed for you on a free spot of your
// Home land (so its effect never stops); if no free spot is found it goes to the Bag instead. Nothing is lost either way.
let mig065 = null;
function freeGFSpot(cx = -2.4, cz = 1.6, loc = 'home') {   // nearest free ground on an owned plot (spiral search)
  for (let r = 0; r < 7; r += 0.7) for (let a = 0; a < 16; a++) { const x = cx + Math.cos(a / 16 * 6.283) * r, z = cz + Math.sin(a / 16 * 6.283) * r;
    if (lotAt(x, z) === loc && !placeProblem(x, z)) return { x, z }; if (!r) break; }
  return null;
}
// v0.65 user rule: trees (and tree saplings) are Orchard-only — bought only in the Orchard Market, planted only in the Orchard.
// Trees already standing at Home stay as they are. Unplaced saplings in the Home Bag move to the Orchard Bag (every load, so
// old grants / drops land there too), and the old 'Plant a tree sapling' goal index is remapped once.

function migTreeGoal065() { if (S.treeRule065) return; S.treeRule065 = true; if (S.goal > 10 /* the removed tree goal was index 10 */) S.goal--; if (S.goal > GOALS.length) S.goal = GOALS.length; }   // before any goal check clamps the index
function migTrees065() {
  const hb = S.bags?.home, ob = S.bags?.orchard; let moved = 0;
  if (hb && ob && hb.sapling > 0) { moved = hb.sapling; ob.sapling = (ob.sapling || 0) + moved; hb.sapling = 0; }
  migTreeGoal065();
  if (moved) { save(); setTimeout(() => toast(`<i data-icon="sapling"></i> Trees grow in the Orchard now · ${moved} tree sapling${moved > 1 ? 's' : ''} moved to your Orchard Bag`), 1800); }
  return moved;
}
function migGF065() {
  S.gf ||= []; S.gfInv ||= {}; S.deliv ||= [];
  // v0.65 bag rule: a garden feature is in the Bag only if it was BOUGHT at the Market (a pack card only unlocks it there).
  // Older saves: anything owned/placed/on the van was bought; anything else sitting in the Bag came from a card → removed, stays unlocked.
  if (!S.gfRule065) { S.gfRule065 = true; S.gfBought ||= {}; let gone = 0;
    for (const id of GF_IDS) { if (S.owned[id] || gfPlaced(id) || inTransit(id)) S.gfBought[id] = 1;
      else if (S.gfInv[id] > 0) { delete S.gfInv[id]; gone++; if (S.cards[id] || S.discovered[id]) S.unlocked[id] = true; } }
    if (gone) { writeSave(); setTimeout(() => toast('Garden features from Card Packs are unlocked in the Market now — buy one there and the van brings it to your Bag'), 3400); } }
  if (migBags) { migBags.moved += splitOrchardGoods(S.bags.home, S.bags.orchard); for (const d of S.deliv) d.loc ||= 'home'; writeSave();   // v0.65: older migrations may have put Orchard goods in the Home Bag
    if (migBags.moved) setTimeout(() => toast(`Your Bag is now split by location · ${migBags.moved} Orchard good${migBags.moved > 1 ? 's' : ''} moved to the Orchard Bag`), 2600); }
  for (const id of GF_IDS) {
    if (!S.owned[id] || !S.gfBought[id] || gfPlaced(id) || S.gfInv[id] > 0 || inTransit(id)) continue;
    const spot = freeGFSpot();
    S.gfInv[id] = 1;
    if (spot && placeGF(id, spot.x, spot.z, false)) (mig065 ||= {})[id] = 'placed'; else (mig065 ||= {})[id] = 'bag';
  }
  // v0.66.1 save clean-up (every load, idempotent): a garden feature can only be in the Bag as many times as it was bought
  // and is not standing on the map or riding the van; anything above that (old-state leftovers) is dropped from the Bag.
  let fix0661 = 0;
  for (const id of GF_IDS) { const n = S.gfInv[id] || 0; if (!n) continue;
    const cap = Math.max(0, (S.gfBought?.[id] || 0) - (S.gf || []).filter((d) => d.id === id).length - (S.deliv || []).filter((d) => d.id === id).length);
    if (n > cap) { fix0661 += n - cap; if (cap) S.gfInv[id] = cap; else delete S.gfInv[id]; if (S.cards[id] || S.discovered[id]) S.unlocked[id] = true; } }
  markBuildsDone();
  if (fix0661) writeSave();
  if (mig065) { writeSave(); setTimeout(() => toast(Object.entries(mig065).map(([id, w]) => `${FEATURES[id].name} ${w === 'placed' ? 'now stands in your garden — tap it to move it' : 'is in your Bag — place it to switch it on'}`).join(' · ')), 1500); }
}
function placeGF(id, x, z, animate = true) {
  if (!(S.gfInv?.[id] > 0)) return false; const lot = lotAt(x, z); if (!lot || !S.lots[lot]) return false;
  const key = 'g' + S.uid++, r = Math.atan2(W.camera.position.x - x, W.camera.position.z - z);
  if (!--S.gfInv[id]) delete S.gfInv[id];
  S.gf.push({ key, id, x, z, r, lot }); W.addFeat(key, id, x, z, r, animate);
  if (animate) popAt(V3(x, 1.6, z), `<i data-icon="sparkle"></i>${FEATURES[id].name}${CHARMS[id] ? ` · ${charmText(id)}` : ' · plants you water grow 25% faster'}`);
  save(); hud(); return true;
}
function storeGF(key) {
  const d = S.gf.find((x) => x.key === key); if (!d) return;
  S.gf = S.gf.filter((x) => x !== d); S.gfInv[d.id] = (S.gfInv[d.id] || 0) + 1; W.removeFeat(key); deselect(); save(); hud();
  toast(`${FEATURES[d.id].name} put back in your bag · its effect pauses until you place it again`);
}
const BUILT_FLAG = { windmill: 'windmillBuilt', parking: 'parkingBuilt', billboard: 'billboardBuilt', still: 'stillBuilt', tincture: 'tinctureBuilt', teastand: 'teaBuilt', press: 'pressBuilt', opress: 'opressBuilt', fruitstand: 'fruitstandBuilt' };
// true when every unit of this feature is on the map (so it has no reason to be in the bag)
const onMapOnly = (k) => (k === 'beehive' ? !(S.hiveInv > 0) && Object.keys(S.hives || {}).length > 0 : isGF(k) ? !(S.gfInv?.[k] > 0 && S.gfBought?.[k]) : BUILT_FLAG[k] ? !!S[BUILT_FLAG[k]] : false);
const gfBagRow = (k) => { const n = S.gfInv?.[k] || 0;
  return `<div class="row gf-bag" data-gf-bag="${k}"><div class="ico">${FEATURE_ART[k]}</div><div class="meta"><b>${FEATURES[k].name}${n > 1 ? ` ×${n}` : ''}${CHARMS[k] ? ` · Lv${charmLv(k)}` : ''}</b><small>Not placed yet · ${CHARMS[k] ? charmText(k) : 'plants you water grow 25% faster'} once it stands on your land</small></div><div class="acts"><button class="btn btn-primary sm" data-place-gf="${k}">Place</button></div></div>`; };
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
  S.bonus[f.into.bonus] = false;   // v0.63: for the Crate Shelf this is only ever the spare in the Bag, never the installed one
  if (f.into.bonus === 'can') { for (const b of Object.values(S.barrels)) if (b.w > regenMax(b)) b.w = regenMax(b); }
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
  const ks = FIND_IDS.filter((k) => restoredCount(k) > 0).sort((a, b) => RESALE.antique[b] - RESALE.antique[a] || FINDS[a].name.localeCompare(FINDS[b].name)); if (!ks.length) return '';   // v0.65: highest value first
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
    gone = () => { for (const id of beds) { const k = S.irrigBeds.indexOf(id); if (k >= 0) { S.irrigBeds.splice(k, 1); W.setIrrigation(id, false); } if (S.irrigFrom) delete S.irrigFrom[id]; } delete S.barrels[f.lot]; W.removeBarrel(f.lot); }; }
  else return false;
  confirmBox(`<h3>Sell ${name}?</h3><p class="muted">Instant buyback: <b>${v} coins</b>. It leaves your garden.${note}</p>`, `Sell for ${v}`, () => {
    gone(); S.coins += v; S.stats.sold = (S.stats.sold || 0) + 1; deselect(); save(); hud(); if (panel) renderPanel(); syncBlueprints?.(); toast(`Sold ${name} · +${v} coins`); });
  return true;
}
function finishRestore(r) {
  S.restoring = S.restoring.filter((x) => x !== r); const f = FINDS[r.kind]; S.stats.restored++;
  if (f.into.bonus === 'crate') { S.bonus.crate = true; toast(`<i data-icon="sparkle"></i> Restored: <b>${f.into.name}</b> · ${S.shelfOn ? 'your Farm Stand already has one — sell this spare or stock it as an antique' : `install it on your Farm Stand from Bag → Finds (+${SHELF_BONUS} shelf space)`}`); }
  else if (f.into.bonus) { S.bonus[f.into.bonus] = true; toast(`<i data-icon="sparkle"></i> Restored: <b>${f.into.name}</b> · ${f.into.blurb}`); }
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
  if (curLoc() === 'orchard') { toast('Raised beds are built at Home — the Orchard is for fruit trees'); return; }   // v0.65
  const cs = casters(); const list = SITES.filter((s) => S.lots[s.lot] && lotLoc(s.lot) === 'home' && !S.beds.includes(s.id)).map((s) => ({ id: s.id, ok: siteClear(s.id), sun: siteSun(s.id, cs) }));
  W.setGhosts(list);
  const ready = list.filter((s) => s.ok).length;
  $('#buildbar-text').innerHTML = ready ? `Tap a <b>glowing patch</b> to build a raised bed · ${woodTag(bedCost())}<small class="bb-sun"><i data-icon="sun"></i> Labels show sun · sunnier beds grow faster</small>` : `No patch is fully clear yet — clear the <b>trees &amp; stumps</b> inside a pink patch.`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  if (!ready) setTimeout(() => buildMode && exitBuild(), 4200);
  else tip('shade');
}
function exitBuild() { buildMode = false; W.setGhosts(null); $('#buildbar').classList.add('hidden'); }
function cancelPlacing() { if (!placing) return false; const b = placing.buy; exitPlace(); if (b) toast(`Cancelled — nothing was charged for the ${FEATURES[b.id]?.name || 'tree sapling'}`); return true; }
$('#buildbar-cancel').addEventListener('click', () => { if (!cancelPlacing()) exitBuild(); });
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
  for (const [k, v] of Object.entries(STARTER)) S.bags.home[k] += v;
  const h = S.barrels.home; if (h) { h.w = Math.max(h.w, Math.min(regenMax(h), STARTER_FILL)); if (h.w >= regenMax(h)) h.at = now(); syncBarrels(); }
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
// v0.7.1: purchases and builds no longer move the camera. It only glides (zoom unchanged) when the thing just placed is off-screen.
function offScreen(v, pad = 40) { const p = W.project(v); return p.behind || p.x < pad || p.x > innerWidth - pad || p.y < 90 || p.y > innerHeight - 160; }
function glideIfOff(v, dur = 0.8) { const loc = v.x > 150 ? 'orchard' : 'home'; if (loc !== curLoc() || !offScreen(v)) return false; W.ctl.moved = true; W.glide({ target: V3(v.x, 0.3, v.z) }, dur); return true; }
function glideTo(k) { glideIfOff(V3(SPOTS[k][0], 0.3, SPOTS[k][1])); }
// ---------------- v0.63: stand construction ----------------
// S.cons[kind] = { start, ms } while a stand is being built. Wall-clock time (saved), so it keeps going while the game is closed.
// Automated test browsers build instantly unless a test opts in (localStorage 'petalspire.consTest'), so older tests still run.
const CONS_NAME = { opress: 'Orchard Oil Press', stand: 'Farm Stand', rack: 'Drying Rack', tincture: 'Tincture Stand', still: 'Essential Oil Stand', teastand: 'Tea Stand', press: 'Pressed Oil Stand', fruitstand: 'Fruit Stand', oshed: 'Orchard Stand' };
const CONS_PANEL = { stand: 'stand', ostand: 'oshed', rack: 'rack', tincture: 'tincture', still: 'still', teastand: 'teastand' };
const consObj = (k) => (k === 'oshed' ? W.orchardShed : W[k]);
const consSize = (k) => ({ stand: [2.3, 2.2, 1.5], rack: [1.9, 2.1, 1.3], oshed: [2.4, 2.6, 1.9] }[k] || CRAFT[k]?.size || [2.1, 2.6, 1.3]);
const consLeft = (k) => { const c = S.cons?.[k]; return c ? Math.max(0, c.start + c.ms - now()) : 0; };
const consK = (k) => { const c = S.cons?.[k]; return c ? Math.min(1, (now() - c.start) / c.ms) : 1; };
const consMsg = (k, done) => (consLeft(k) > 0 ? `🚧 ${CONS_NAME[k]} under construction` : done);
function startCons(k) {
  const sec = CONS.s[k]; if (!sec) return;
  if (navigator.webdriver && !localStorage.getItem('petalspire.consTest')) return;
  (S.cons ||= {})[k] = { start: now(), ms: sec * 1000 }; save();
  setTimeout(() => toast(`🚧 Builders are on the ${CONS_NAME[k]} · ready in ${clock(sec * 1000)}`), 3200);
}
function finishCons(k, paid = false) {
  if (!S.cons?.[k]) return; delete S.cons[k]; save();
  W.setCons(consObj(k), consSize(k), null);
  const o = consObj(k); if (o) W.poof(o.position.clone().setY(1.2), '#F5D07A', 14, 1.4);
  toast(`✨ The ${CONS_NAME[k]} is ready${paid ? '' : ' · the builders are done'}!`); sfx('build');
  if (k === 'stand') tip('stand');
  hud(); checkGoals(); if (panel && (CONS_PANEL[panel] === k || panel === k)) renderPanel();
}
function hurryCons(k) { const left = consLeft(k); if (!left) return; if (!spendJewels(consJewels(left))) return; finishCons(k, true); }
// v0.64: coin upgrades take build time. S.upg[key] = { start, ms, to } with key 'stand' | 'rack' | 'barrel:<lot>'. Paid up front;
// the building keeps working at its old level until the timer ends (wall-clock, saved, runs while closed). Finish now = 1 Jewel.
// Automated browsers upgrade instantly unless a test opts in ('petalspire.consTest'), like construction.
const upgLeft = (key) => { const u = S.upg?.[key]; return u ? Math.max(0, u.start + u.ms - now()) : 0; };
const upgK = (key) => { const u = S.upg?.[key]; return u ? Math.min(1, (now() - u.start) / u.ms) : 1; };
const upgTimed = () => !(navigator.webdriver && !localStorage.getItem('petalspire.consTest'));
function startUpg(key, to, apply) {
  const kind = key.startsWith('barrel:') ? 'barrel' : key, sec = CONS.upg[kind]?.[to - 2];
  if (!sec || !upgTimed()) { apply(); return false; }
  (S.upg ||= {})[key] = { start: now(), ms: sec * 1000, to }; writeSave(); hud(); if (panel) renderPanel(); if (focus) renderSheet();
  toast(`🔨 Upgrading to Lv${to} · ready in ${clock(sec * 1000)} · it keeps working at its current level meanwhile`); return true;
}
function finishUpg(key, paid = false) {
  const u = S.upg?.[key]; if (!u) return; delete S.upg[key];
  if (key.startsWith('barrel:')) applyBarrelLv(key.slice(7), u.to, paid); else applyBuildingLv(key, u.to, paid);
}
function hurryUpg(key) { if (!upgLeft(key)) return; if (!spendJewels(consJewels())) return; finishUpg(key, true); }
function upgTimerHTML(key, name) {
  const u = S.upg[key], l = upgLeft(key);
  return `<div class="upg-card upgrading" data-upgt="${key}"><div class="upg-lv">Lv${u.to - 1}</div><div class="upg-meta"><b>${name} · upgrading to Lv${u.to}</b><small>Still works at Lv${u.to - 1} until it's done.</small>
    <div class="progress"><b data-uprog style="width:${(upgK(key) * 100).toFixed(1)}%"></b></div><small><span data-uleft>${clock(l)}</span> left</small></div>
    <button class="btn btn-gold sm" data-act="upg-finish" data-key="${key}" data-cons-cost="${consJewels()}">Finish now · ${jewelPrice(consJewels())}</button></div>`;
}
function syncUpg() { for (const key of Object.keys(S.upg || {})) if (upgLeft(key) <= 0) finishUpg(key); }
function syncCons() {
  syncUpg();
  for (const k of Object.keys(S.cons || {})) { if (consLeft(k) <= 0) finishCons(k); else if (!building[k === 'oshed' ? 'oshed' : k]) W.setCons(consObj(k), consSize(k), consK(k)); }
}
function consHTML(k) {
  const left = consLeft(k), j = consJewels(left);
  return `<div class="cons-card" data-cons="${k}"><div class="cons-sign">🚧</div><b>${CONS_NAME[k]} · under construction</b>
    <small>The builders are at work. It opens for business when they're done${k === 'stand' || k === 'oshed' ? ' — no sales or restocking until then' : ''}. They keep working while the game is closed.</small>
    <div class="progress"><b data-cprog style="width:${(consK(k) * 100).toFixed(1)}%"></b></div><p class="cons-left"><span data-cleft>${clock(left)}</span> left</p>
    <button class="btn btn-gold" data-act="cons-finish" data-kind="${k}" data-cons-cost="${j}">Finish now · ${jewelPrice(j)}</button>
    <p class="muted cons-note">Always ${CONS.jewels} Jewel, however long is left · you have ${S.jewels}</p></div>`;
}
function buildStand() {
  const B = BUILDS.stand;
  if (S.standBuilt || building.stand || !S.beds.length || S.wood < B.wood) return false;
  S.wood -= B.wood;
  let crate = false; if (useOpt.stand && S.finds.old_crate > 0 && !S.shelfOn) { S.finds.old_crate--; if (!S.finds.old_crate) delete S.finds.old_crate; S.shelfOn = true; crate = true; }
  S.standBuilt = true; building.stand = true; startCons('stand'); save(); closePanel(); syncBlueprints(); glideTo('stand');
  setTimeout(() => W.buildAnim(W.stand, [2.3, 2.2, 1.5], () => {
    building.stand = false; popAt(spotV('stand'), consMsg('stand', 'Farm Stand built!')); if (crate) setTimeout(() => toast('The Old Crate became a display shelf · +4 shelf space'), 600);
    tip('stand'); hud(); checkGoals();
  }), 500);
  hud(); return true;
}
function buildRack() {
  const B = BUILDS.rack;
  if (S.rackBuilt || building.rack || !S.rackAvail || S.wood < B.wood) return false;
  S.wood -= B.wood; S.rackBuilt = true; building.rack = true; startCons('rack'); save(); closePanel(); syncBlueprints(); glideTo('rack');
  setTimeout(() => W.buildAnim(W.rack, [1.9, 2.1, 1.3], () => { building.rack = false; popAt(spotV('rack'), consMsg('rack', 'Drying Rack built!')); hud(); }), 500);
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
function deselect() { selected = null; focus = null; W.select(null); $('#tile-sheet').classList.add('hidden'); syncBedTargets(); }   // v0.68: barrel reach frames clear at once
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
    const b = S.barrels[focus.lot]; if (!b) return deselect(); const beds = barrelBeds(focus.lot), max = regenMax(b);
    const spare = S.beds.some((id) => reachLots(focus.lot).includes(lotOfSite(id)) && !S.irrigBeds.includes(id)), behind = reachLots(focus.lot)[1];
    head = `<h3>Rain Barrel <small>${lotName(focus.lot)} · <span data-feeds>Feeds ${beds.length}/${BARREL.maxBeds} beds</span></small></h3>`;
    body = `<p class="barrel-line${b.w >= max ? ' full' : ''}"><i data-icon="water"></i> <b id="barrel-txt">${barrelText(focus.lot)}</b></p>
      ${barrelRoof(focus.lot) ? `<p class="stands-line${barrelPerTick(focus.lot) > 1 ? ' two' : ''}" data-stands="${barrelPerTick(focus.lot)}"><i data-icon="water"></i> <b>${standsLine(focus.lot)}</b></p>` : ''}
      <p class="muted gutter-line">${barrelRoof(focus.lot) ? `Gutter${barrelStands(focus.lot).length > 1 ? 's' : ''} from the ${barrelStands(focus.lot).map((r) => `<b>${ROOF_NAMES[r]}</b>`).join(' and ')} roof${barrelStands(focus.lot).length > 1 ? 's' : ''}${barrelStands(focus.lot).length < BARREL_STANDS_MAX && focus.lot !== 'home' ? ` · build a second stand on ${lotName(focus.lot)} and it connects automatically (+1 per tick)` : ''}` : `<b class="warn">${NOT_COLLECTING}.</b> Build a Tincture or Essential Oil Stand on ${lotName(focus.lot)} — its roof gutter connects automatically.`}</p>
      ${S.windmillBuilt && barrelRoof(focus.lot) ? `<p class="wm-line"><b>Windmill: faster refill</b> <small>(every ${regenS()} s instead of ${S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S} s)</small></p>` : ''}<p class="muted">Refills ${barrelPerTick(focus.lot) || 1} water every ${regenS() >= 60 ? 'minute' : regenS() + ' s'} (up to ${max}), even while the game is closed. Reaches ${behind ? `this plot and <b>${lotName(behind)}</b> behind it (green frames)` : BEHIND[focus.lot] ? `this plot, and ${lotName(BEHIND[focus.lot])} behind it once you buy it` : 'this plot'}; hand watering there uses it too.</p>`
      + (beds.length ? `<div class="list barrel-beds">${beds.map((id) => `<div class="row"><div class="ico">${FEATURE_ART.irrigation}</div><div class="meta"><b>Bed ${S.beds.indexOf(id) + 1}</b><small>${lotOfSite(id) !== focus.lot ? `${lotName(lotOfSite(id))} (behind) · ` : ''}Irrigated from this barrel</small></div><div class="acts"><button class="btn sm" data-unhook="${id}">Unhook</button></div></div>`).join('')}</div>` : `<p class="muted">No irrigated beds yet${hasIrrig() ? '' : ' · Irrigation cards come from Card Packs and the Supply Market'}.</p>`)
      + barrelUpgHTML(focus.lot)
      + `<div class="ts-actions">${spare && beds.length < BARREL.maxBeds && !irrigBlock() ? `<button class="btn btn-primary" data-buy="irrigation" data-price="${buyCost('irrigation').coins}" ${canPay(buyCost('irrigation')) ? '' : 'disabled'}><i data-icon="water"></i> Irrigation · ${coin(buyCost('irrigation').coins)}</button>` : ''}<button class="btn btn-blush" data-act="sell-placed">${focus.lot === 'home' ? 'Sell…' : `Sell ${coin(buyback(RESALE.placed.barrel))}`}</button></div>`;
  } else if (focus.kind === 'hive') {
    const h = S.hives[focus.lot]; if (!h) return deselect(); const n = S.beds.filter((id) => lotOfSite(id) === focus.lot).length;
    head = `<h3>Honeybee Skep <small>${lotName(focus.lot)} · one hive per plot</small></h3>`;
    body = `<p class="bee-line">🐝 +${HIVE_BONUS} flower per harvest on this plot’s ${n} bed${n === 1 ? '' : 's'} (only this plot)</p>
      <div class="ts-actions"><button class="btn btn-blush" data-act="sell-placed">Sell ${coin(buyback(RESALE.placed.beehive))}</button></div>`;
  } else if (focus.kind === 'gfeat') {
    const d = S.gf.find((x) => x.key === focus.key); if (!d) return deselect(); const id = d.id;
    head = `<h3>${FEATURES[id].name} <small>${PLANT_TIERS[cardTier(FEATURES[id])].label} garden feature${CHARMS[id] ? ` · Lv${charmLv(id)}` : ''} · ${lotName(d.lot)}</small></h3>`;
    body = `<p class="gf-line" data-gf-fx>${CHARMS[id] ? charmText(id) : 'Every plant you water grows 25% faster'}</p>${CHARMS[id] && nextAt(id) != null ? `<p class="muted">${S.cards[id]?.n || 0}/${nextAt(id)} copies to Lv${charmLv(id) + 1}</p>` : ''}
      <div class="ts-actions">${canUpgrade(id) ? `<button class="btn btn-gold" data-act="upg-gf">✨ Upgrade to Lv${cardLv(id) + 1}</button>` : ''}<button class="btn" data-act="store-gf">Put back in bag</button></div>`;
  } else if (focus.kind === 'decor') {
    const d = S.decor.find((x) => x.key === focus.key); if (!d) return deselect(); const info = DECOR_INFO[d.type];
    head = `<h3>${info.name} <small>Garden decor · +${info.atm} atmosphere</small></h3>`;
    body = `<p class="muted">Atmosphere ${atmosphere()} · customers arrive ${Math.round((1 - atmosMult()) * 100)}% sooner.</p><div class="ts-actions"><button class="btn" data-act="store-decor">Put back in bag</button><button class="btn btn-blush" data-act="sell-placed">Sell ${coin(buyback(RESALE.antique[kindOfDecor(d.type)]))}</button></div>`;
  }
  sh.innerHTML = `<div class="ts-head"><div class="ts-ico">${focus.kind === 'tree' ? ICONS.sapling : focus.kind === 'barrel' ? FEATURE_ART.rainbarrel : focus.kind === 'hive' ? '<span style="font-size:30px;line-height:1">🐝</span>' : focus.kind === 'gfeat' ? FEATURE_ART[S.gf.find((x) => x.key === focus.key)?.id] || '' : decorIcon(S.decor.find((x) => x.key === focus.key)?.type)}</div>${head}<button class="close-btn" data-act="close">×</button></div>${body}`;
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
    head = `<h3>Empty plot <small>${tileName(i)} · choose a seed to plant</small></h3>`; body = sunHTML(tileSun[i] ?? 1) + irrigLine(i) + workerLine(i) + (beeBonus(i) ? `<p class="bee-line">🐝 Bees: +${HIVE_BONUS} flower per harvest here</p>` : '');
    const owned = Object.keys(SPECIES).filter((sp) => S.inv['seed_' + sp] > 0);
    if (!owned.length) body += S.marketBuilt ? `<p class="muted">You’re out of seeds.</p><div class="ts-actions"><button class="btn btn-primary" data-act="open-market">Visit Supply Market</button></div>` : `<p class="muted">You’re out of seeds — harvest blooms to collect more. (Rebuild the Supply Market to buy them.)</p>`;
    else body += `<div class="ts-row">${owned.map((sp) => `<button class="seed-chip" data-plant="${sp}"><img src="${SPECIES[sp].img}" alt=""/>${SPECIES[sp].name}<small>×${S.inv['seed_' + sp]} seeds</small></button>`).join('')}</div>`;
  } else {
    const sp = SPECIES[p.sp], st = stageOf(p), k = progress(p);
    head = `<h3>${sp.name}${cardLv(p.sp) > 1 ? ` <em class="lv-badge inline">Lv${cardLv(p.sp)}</em>` : ''} <small>${tileName(i)} · ${budWait(p) ? 'Sprout · thirsty' : p.wateredAt ? STAGES[st] : p.sp === 'bluelotus' ? `Barrel ${LOTUS_TXT[lotusFill(p)]}` : 'Thirsty seed'}</small></h3>`;
    const dots = `<div class="stage-dots">${STAGES.map((s, n) => `<span class="${n <= st && p.wateredAt ? 'on' : ''}">${s}</span>`).join('')}</div>`;
    body = lotusLine(p) + sunHTML(p.wateredAt ? p.sun ?? 1 : tileSun[i] ?? 1) + irrigLine(i) + workerLine(i) + (beeBonus(i) ? `<p class="bee-line">🐝 Bees: +${beePct(p.sp)}% flowers <small>(+${HIVE_BONUS} per harvest · hive on this plot)</small></p>` : '') + (cardLv(p.sp) > 1 ? `<p class="lv-line">✨ Card Lv${cardLv(p.sp)}: +${Math.round(CARD_LEVELS.plant.sell * (cardLv(p.sp) - 1) * 100)}% sell price · −${Math.round(CARD_LEVELS.plant.grow * (cardLv(p.sp) - 1) * 100)}% grow time${lvFlower(p.sp) ? ' · +1 flower' : ''}</p>` : '');
    if (thirsty(p)) { const tw = totalWater(), src = tw ? handSource(i) : null, bed = bedOfTile(i), bw = bedWater(bed, i), lv = bedLv(bed), wait = Object.entries(S.barrels).filter(([l, b]) => b.w < regenMax(b) && barrelRoof(l)).map(([, b]) => barrelLeft(b));
      const what = p.wateredAt ? 'to bud' : 'to start growing', pct = bw.needU ? Math.min(100, (bw.paidU / bw.needU) * 100) : 0;
      body += `<div class="bed-water" data-bed-water="${bw.have}/${bw.need}" data-bed-stage="${p.wateredAt ? 'bud' : 'start'}"><div class="bw-top"><i data-icon="water"></i> <b>Bed water ${bw.have}/${bw.need}</b> <small>${what}${lv > 1 ? ` · Irrigation Lv${lv}` : ''}</small></div><span class="bw-bar"><em style="width:${pct.toFixed(1)}%"></em></span></div>
      <p class="muted">${p.wateredAt ? 'Growth has paused at the end of the sprout stage — this bed needs its bud water.' : p.sp === 'bluelotus' ? (lotusFill(p) ? 'One more watering fills the barrel — then the lotus grows.' : 'The lotus barrel needs two waterings: half, then full.') : 'This bed needs its water before the seeds can grow.'} Each pour is 1 water${lv > 1 ? '' : ` · a full bed takes ${WATER.stage[0]} to start + ${WATER.stage[0]} to bud (less with Irrigation levels)`}.${tw ? ` <small>From: the ${lotName(src.lot)} barrel</small>` : ` Rain barrels refill by 1 water every ${regenS() >= 60 ? 'minute' : regenS() + ' s'}${wait.length ? ` · next in ${clock(Math.min(...wait))}` : ''}.`}</p><div class="ts-actions"><button class="btn btn-primary" data-act="water" ${tw ? '' : 'disabled'}><i data-icon="water"></i> Pour 1 (${tw} in barrels)</button>${bw.need - bw.have > 1 ? `<button class="btn" data-act="water-bed" ${tw ? '' : 'disabled'}>Fill bed (${Math.min(tw, bw.need - bw.have)})</button>` : ''}</div>`; }
    else if (st < 3) body += `<div class="progress"><b id="sheet-prog" style="width:${(k * 100).toFixed(1)}%"></b></div>${dots}<p class="muted" id="sheet-left" style="margin-top:6px">Blooms in ${fmtTime(p.growMs * (1 - k))}</p>`;
    else body += `${dots}<div class="ts-actions"><button class="btn btn-gold" data-act="harvest"><i data-icon="sparkle"></i> Harvest</button></div>`;
  }
  sh.innerHTML = `<div class="ts-head">${head}<button class="close-btn" data-act="close">×</button></div>${body}`;
  sh.dataset.st = p ? stageOf(p) : -1; sh.dataset.bw = p && budWait(p) ? '1' : '0'; sh.dataset.water = totalWater();
  fillIcons(sh); sh.classList.remove('hidden');
}
$('#tile-sheet').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.plant) return plant(selected, b.dataset.plant);
  if (b.dataset.unhook) return unhookIrrigation(b.dataset.unhook);
  const a = b.dataset.act;
  if (a === 'upgrade-barrel') return upgradeBarrel(focus?.lot);
  if (a === 'upg-finish') return hurryUpg(b.dataset.key);
  if (a === 'assign-irrig') { deselect(); return startBuy('irrigation'); }
  if (a === 'pay-worker') return payWorker(b.dataset.lot);
  if (a === 'open-worker') return openPanel('worker', b.dataset.lot);
  if (a === 'close') deselect(); else if (a === 'water') water(selected); else if (a === 'water-bed') waterBed(selected); else if (a === 'harvest') harvest(selected); else if (a === 'open-market') openPanel('market', 'buy');
  else if (a === 'hurry-tree') hurryTree(focus.id); else if (a === 'chop-tree') tapGrown(focus.id); else if (a === 'store-decor') storeDecor(focus.key); else if (a === 'store-gf') storeGF(focus.key); else if (a === 'upg-gf') { const d = S.gf.find((x) => x.key === focus.key); if (d) { upgradeCard(d.id); renderFocus(); } } else if (a === 'sell-placed') sellPlaced(focus);
});
function plant(i, sp) { return inBag(tileLoc(i), () => plant_(i, sp)); }
function plant_(i, sp) {
  if (S.tiles[i] || !(S.inv['seed_' + sp] > 0)) return;
  S.inv['seed_' + sp]--; S.tiles[i] = { sp, plantedAt: now(), wateredAt: null, growMs: SPECIES[sp].growS * 1000 * growK(sp) }; if (sp === 'bluelotus') S.tiles[i].fill = 0;
  syncTile(i); save(); hud(); renderSheet(); tip('water'); sfx('plant');
}
// v0.63: Fill bed — keep pouring until this bed's thirsty plants have their water (or the barrels run dry)
function waterBed(i) {
  const bed = bedOfTile(i); let n = 0, guard = 120;
  while (guard-- > 0) { const k = thirsty(S.tiles[i]) ? i : siteTiles(bed).find((t) => thirsty(S.tiles[t])); if (k == null || !water(k)) break; n++; }
  return n;
}
// v0.63: one pour = 1 water from a barrel into this plant's bed; the bed's plants share it (this one first). A bed needs its
// stage cost in total (e.g. 9 to start + 9 to bud for a full bed at Lv1), so the sheet shows the bed's progress (4/9).
function water(i, auto = false) {
  const p = S.tiles[i]; if (!thirsty(p)) return false; const bed = bedOfTile(i), at = now();
  let ev = settleBed(bed, i, at, auto); let poured = false;
  if (thirsty(p) || (auto && siteTiles(bed).some((k) => thirsty(S.tiles[k], at)))) {
    const src = auto ? { b: barrelOf(bed) } : handSource(i);
    if (src?.b?.w > 0) { takeFromBarrel(src.b); poured = true; (S.bedCredit ||= {})[bed] = (S.bedCredit[bed] || 0) + WATER.unit; S.stats.watered++; if (auto) S.stats.irrigated = (S.stats.irrigated || 0) + 1;
      ev = ev.concat(settleBed(bed, i, at, auto)); syncBarrels(); }
  }
  if (!poured && !ev.some((e) => e.kind !== 'part')) return false;
  const started = ev.filter((e) => e.kind === 'start').length, budded = ev.filter((e) => e.kind === 'bud').length;
  if (started) applyShade(); for (const k of new Set(ev.map((e) => e.i).concat([i]))) { const q = S.tiles[k]; if (q && q.wateredAt && !q.sun) q.sun = tileSun[k] ?? 1; syncTile(k); }
  if (started) for (const e of ev) if (e.kind === 'start') { const q = S.tiles[e.i]; q.sun = tileSun[e.i] ?? 1; q.growMs = q.baseMs / speedFor(q.sun); }
  W.splash(i); if (!auto) sfx('water'); save(); hud(); if (selected === i || (!auto && selected != null)) renderSheet();
  const bw = bedWater(bed, i), prog = bw.need ? ` · bed ${bw.have}/${bw.need}` : '';
  const msg = started ? `Growing!${prog}` : budded ? `Budding!${prog}` : p.sp === 'bluelotus' && !p.wateredAt ? `Barrel ${LOTUS_TXT[lotusFill(p)]}${prog}` : `Watered${prog}`;
  if (auto) { if (!quiet) { W.irrigPulse(bed); popAt(W.tileWorld(i).setY(1), `<i data-icon="water"></i>${started || budded ? msg : 'Irrigated' + prog}`); } checkGoals(); return true; }
  if (started && p.wateredAt && p.growMs - (now() - p.wateredAt) > BOOSTS.kinds.grow.minLeftS * 1000) setTimeout(() => maybeBoost('grow', { i, sp: p.sp }), 700);   // v0.66
    tip('growing'); if (p.sun < 0.85) tip('shade'); if (S.stats.watered === 3) tip('barrel');
  popAt(W.tileWorld(i).setY(1), `<i data-icon="water"></i>${msg}`); checkGoals(); return true;
}
// ---------------- v0.4: card stacks & levels ----------------
function cardLv(id) { const v = Math.round(+S.cards[id]?.lv); return v >= 1 ? Math.min(v, CARD_LEVELS.thresholds.length + 1) : 1; }   // v0.63: always a whole number 1–4
const nextAt = (id) => CARD_LEVELS.thresholds[cardLv(id) - 1];   // copies needed for the next level (undefined at max)
const canUpgrade = (id) => !!CARDS[id] && CARD_LEVELS.upgradable(id, CARDS[id]) && nextAt(id) != null && (+S.cards[id]?.n || 0) >= nextAt(id);
function growK(sp) { return 1 - CARD_LEVELS.plant.grow * (cardLv(sp) - 1); }   // hoisted: offline catch-up runs before this line
const spOfItem = (id) => Object.keys(SPECIES).find((sp) => id.endsWith('_' + sp)) || (id.startsWith('fruit_') && TREES[id.slice(6)] ? id.slice(6) : undefined);   // v0.6: fruit gets its tree card's level bonus
const sellOf = (id) => { const sp = spOfItem(id); return sp ? Math.round(ITEMS[id].sell * (1 + CARD_LEVELS.plant.sell * (cardLv(sp) - 1))) : ITEMS[id].sell; };
const lvFlower = (sp) => (cardLv(sp) >= CARD_LEVELS.plant.bonusFlowerAt ? 1 : 0);
function addCard(id, n = 1) { const c = S.cards[id] || (S.cards[id] = { n: 0, lv: 1 }); c.n += n; return c; }
function upgradeCard(id) {
  if (!canUpgrade(id)) return false; sfx('levelup'); const c = S.cards[id]; c.lv = cardLv(id) + 1; c.n = +c.n; S.stats.upgrades = (S.stats.upgrades || 0) + 1; save(); hud(); if (panel) renderPanel();
  const L = CARD_LEVELS.plant, lv = c.lv;
  toast(CARDS[id].tier ? `✨ ${CARDS[id].name} reached Lv${lv}: +${Math.round(L.sell * (lv - 1) * 100)}% sell price · ${Math.round(L.grow * (lv - 1) * 100)}% faster growth${lv >= L.bonusFlowerAt ? ' · +1 flower per harvest' : ''}` : id === 'windmill' ? `✨ Windmill reached Lv${lv}: barrels refill every ${regenS()} s` : CHARMS[id] ? `✨ ${CARDS[id].name} reached Lv${lv}: ${charmText(id, lv)}` : id === 'parking' ? `✨ Parking Lot reached Lv${lv}: room for ${PARKING.spots[parkI()]} cars · ${Math.round((PARKING.extraItem + CARD_LEVELS.parking.extraItem * (lv - 1)) * 100)}% buy an extra item${S.parkingBuilt && S.oparkingBuilt ? ' · at Home and the Orchard' : ''}` : `✨ ${CARDS[id].name} reached Lv${lv}`);
  if (id === 'parking') syncParking();
  return true;
}
// v0.65: one line describing a charm's effect at a level (default: its current level)
const pct = (v) => `${+(v * 100).toFixed(1)}%`;
function charmText(id, lv = charmLv(id)) {
  const v = CHARMS[id].lv[Math.min(CHARMS[id].lv.length, Math.max(1, lv)) - 1];
  return id === 'gardenbell' ? `Customers at the stand where it stands arrive ${pct(v)} sooner`
    : id === 'rainchain' ? `Every rain barrel refills ${pct(v)} faster`
    : id === 'seedtin' ? `${pct(v)} chance of +1 seed per raised-bed harvest`
    : id === 'scales' ? `+${pct(v)} coins on Farm Stand and Fruit Stand sales`
    : id === 'pocketwatch' ? `Gardener and Market Manager hires last +${Math.round(v * 60)} min (same cost)`
    : id === 'moonfountain' ? `${pct(v)} chance of +1 flower per raised-bed harvest`
    : id === 'faelantern' ? `Drying and crafting take ${pct(v)} less time` : '';
}
function harvestCore(i) { return inBag(tileLoc(i), () => harvestCore_(i)); }
function harvestCore_(i) {   // normal yields/seeds rules, shared by the hand harvest and the Sickle
  const p = S.tiles[i]; if (!p || stageOf(p) < 3) return null;
  const sp = SPECIES[p.sp];
  // v0.6: Sunflower gives no flower — a fixed 100 seeds, v0.65: 50 (+10, v0.65: +5, per bee / Lv bonus that would have been a flower)
  // v0.65: Moonlit Fountain (chance of +1 flower; +5 seeds on a Sunflower) and Seed Keeper's Tin (chance of +1 seed)
  const moon = charmHit('moonfountain') ? 1 : 0, tin = charmHit('seedtin') ? 1 : 0;
  const f = sp.noFlower ? 0 : randInt(...sp.yieldF) + beeBonus(i) + lvFlower(p.sp) + moon, s = (sp.seedsFixed ? sp.seedsFixed + (sp.seedBonus || 10) * (beeBonus(i) + lvFlower(p.sp) + moon) : rollSeeds(sp.tier)) + tin;
  if (f) S.inv['flower_' + p.sp] = (S.inv['flower_' + p.sp] || 0) + f; S.inv['seed_' + p.sp] = (S.inv['seed_' + p.sp] || 0) + s; S.tiles[i] = null; S.stats.harvests++;
  if (p.sp === 'lavender' && !S.rackAvail) { S.rackAvail = true; setTimeout(() => { syncBlueprints(); hud(); tip('lavender'); }, 900); }
  return { sp: p.sp, f, s };
}
function harvest(i) {
  const p = S.tiles[i]; if (!p || stageOf(p) < 3) return;
  const sp = SPECIES[p.sp], loc = tileLoc(i); const { f, s } = harvestCore(i); sfx('harvest');
  syncTile(i); save(); hud();
  setTimeout(() => maybeBoost('harvest', { loc, sp: p.sp, f, s }), 900);   // v0.66: now and then, offer a Double Harvest
  if (S.stats.harvests % 50 === 0) promoMilestone('harvest' + S.stats.harvests);
  const at = W.tileWorld(i);
  if (f) { popAt(at.clone().setY(1.2), `+${f} ${sp.name}`); setTimeout(() => popAt(at.clone().setY(0.8), `+${s} seed${s > 1 ? 's' : ''}`), 350); }
  else popAt(at.clone().setY(1.2), `${itemSvg('seed_' + p.sp)}+${s} ${sp.name} seeds`);
  renderSheet(); tip('harvested');
  checkGoals();
}
// ---------------- v0.4: tools — Harvest Sickle (v0.41: one raised bed) and Hand Plow (v0.41: one raised bed) ----------------
// v0.64: no rest between uses — the Sickle and Plow are ready again right away (S.toolAt is still written, harmless)
const toolLeft = () => 0;
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
  const ripe = bedTiles(b).filter((i) => S.tiles[i] && stageOf(S.tiles[i]) >= 3);
  if (!ripe.length) { toast('Nothing is ripe in this bed yet — the sickle skips growing plants'); return { n: 0 }; }
  exitPlace(); S.toolAt.sickle = now();
  W.sickleSweep([bedCenter(b)]);
  const got = {}, spOf = {}; let seeds = 0;
  for (const i of ripe) { const r = harvestCore(i); got[r.sp] = (got[r.sp] || 0) + r.f; seeds += r.s; spOf[i] = r.sp; }
  save(); hud();
  setTimeout(() => { for (const i of ripe) { const at = W.tileWorld(i); syncTile(i); itemFly(at.clone().setY(1), itemSvg(ITEMS['flower_' + spOf[i]] ? 'flower_' + spOf[i] : 'seed_' + spOf[i]), Math.random() * 160); } }, 380);
  const c = bedCenter(b);
  setTimeout(() => popAt(V3(c.x, 1.6, c.z), Object.entries(got).filter(([, f]) => f).map(([sp, f]) => `+${f} ${SPECIES[sp].name}`).join(' · ') + ` · +${seeds} seeds`), 500);
  toast(`Sickle: harvested ${ripe.length} ripe plant${ripe.length > 1 ? 's' : ''} in ${bedLabel(b)}`);
  checkGoals(); return { n: ripe.length, got, seeds };
}
// v0.41: the Plow plants ONE raised bed (every empty tile in it, as far as the seeds go)
function plowBed(b, sp) { return inBag(lotLoc(lotOfSite(b)), () => plowBed_(b, sp)); }
function plowBed_(b, sp) {
  if (!S.owned.plow) return { n: 0 };
  if (!sp || !SPECIES[sp]) { toast('Pick a seed for the plow first'); return { n: 0 }; }
  if (b == null || b < 0 || !S.beds[b]) { toast('Tap one of your raised beds — the plow only plants beds'); return { n: 0 }; }
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
  const t = placing?.what;
  if (!placing && focus?.kind === 'barrel' && S.barrels[focus.lot]) {   // v0.52: show the barrel's reach — its own plot + the plot behind
    const R = reachLots(focus.lot), list = S.beds.map((id, b) => ({ id, b })).filter(({ id }) => R.includes(lotOfSite(id)))
      .map(({ id, b }) => { const c = bedCenter(b); return { x: c.x, z: c.z, b, ok: !S.irrigBeds.includes(id) || feedLot(id) === focus.lot }; });
    const key = 'barrel:' + focus.lot + ':' + list.map((l) => l.b + (l.ok ? 'y' : 'n')).join(','); if (key !== bedTargetKey) { bedTargetKey = key; W.setBedTargets(list); } return;
  }
  if (t !== 'sickle' && t !== 'plow') { if (bedTargetKey) { W.setBedTargets(null); bedTargetKey = ''; } return; }
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
  if (t === 'plow' && !Object.keys(SPECIES).some((k) => S.inv['seed_' + k] > 0)) { toast('No seeds for the plow — buy some at the Market'); return; }
  closePanel(); deselect(); if (buildMode) exitBuild(); if (placing) exitPlace();
  placing = { what: t, sp: null };
  if (t === 'plow') { const have = Object.keys(SPECIES).filter((k) => S.inv['seed_' + k] > 0); if (have.length === 1) placing.sp = have[0]; }
  toolBar(); $('#buildbar').classList.remove('hidden'); syncBedTargets();
}
$('#buildbar').addEventListener('click', (e) => { const b = e.target.closest('[data-plowseed]'); if (!b || placing?.what !== 'plow') return; placing.sp = b.dataset.plowseed; toolBar(); });
function syncTools() {
  syncBedTargets();
  const d = $('#tooldock'); const any = S.owned.sickle || S.owned.plow; const bedsHere = S.beds.some((b) => lotLoc(lotOfSite(b)) === curLoc());   // v0.68: no Sickle / Plow where there is no bed to use them on (the Orchard)
  d.classList.toggle('hidden', !any || !S.introDone || !bedsHere);
  if (any) { const tb = $('#tabbar').getBoundingClientRect(); if (tb.height) d.style.bottom = Math.round(innerHeight - tb.top + 56) + 'px'; }  // sit above the tab bar and the toast line
  for (const t of ['sickle', 'plow']) { const b = $('#tool-' + t); b.classList.toggle('hidden', !S.owned[t]); b.classList.remove('resting'); b.classList.toggle('on', placing?.what === t); b.querySelector('em').textContent = ''; }
}
for (const t of ['sickle', 'plow']) $('#tool-' + t + ' .tool-art').innerHTML = FEATURE_ART[t];
for (const t of ['sickle', 'plow']) $('#tool-' + t).addEventListener('click', () => (placing?.what === t ? exitPlace() : useTool(t)));
function onBloom(i) { tip('bloom'); if (selected === i) renderSheet(); }

// ---------------- v0.64: Jewel uses — Instant Bloom and Customer Rush (a small dock on the right, above the tab bar) ----------------
const bloomTargets = (loc = curLoc()) => (loc === 'orchard'
  ? Object.keys(S.orchard || {}).filter((id) => S.orchard[id] && !orchRipe(S.orchard[id])).map((id) => ({ tree: id }))
  : S.tiles.map((p, i) => (p && stageOf(p) < 3 ? { tile: i } : null)).filter(Boolean));
function instantBloom() {
  const T = bloomTargets(), n = T.length; if (!n) return 0;
  if (!spendJewels(bloomJewels(n))) return 0;
  const t = now();
  for (const x of T) {
    if (x.tree) { const o = S.orchard[x.tree]; o.at = Math.min(o.at, t - o.growMs - 1); o.next = Math.min(o.next || t, t); continue; }
    const p = S.tiles[x.tile]; if (!p.wateredAt) startGrowing(p, t); p.bud = true; p.wu = 0; if (p.sp === 'bluelotus') p.fill = 2; p.wateredAt = t - p.growMs - 1; syncTile(x.tile);
  }
  if (curLoc() === 'orchard') syncOrchard();
  S.stats.blooms = (S.stats.blooms || 0) + 1; writeSave(); hud(); if (selected != null || focus) renderSheet(); if (panel) renderPanel();
  petals($('#popups'), 40); toast(`🌸 Instant Bloom · ${n} ${curLoc() === 'orchard' ? `tree${n > 1 ? 's' : ''}` : `plant${n > 1 ? 's' : ''}`} ready to harvest`); syncJewelDock(); return n;
}
function askBloom() {
  const n = bloomTargets().length, j = bloomJewels(n); if (!n) return;
  confirmBox(`<i data-icon="jewel" class="confirm-ico"></i><h3>Instant Bloom?</h3><p>Grow <b>${n} ${curLoc() === 'orchard' ? `tree${n > 1 ? 's' : ''}` : `plant${n > 1 ? 's' : ''}`}</b> here straight to harvest-ready, no water needed, for <b>${j} Jewel${j > 1 ? 's' : ''}</b> (1 per ${BLOOM.perJewel} plants, max ${BLOOM.max}). You have ${S.jewels}.</p>`, `Bloom · ${j} Jewel${j > 1 ? 's' : ''}`, () => instantBloom());
}
const rushLeft = (loc = curLoc()) => (S.rush && S.rush.loc === loc ? Math.max(0, S.rush.until - now()) : 0);
const rushK = (loc) => (rushLeft(loc) > 0 ? RUSH.gapK : 1);
const rushReady = (loc = curLoc()) => (loc === 'orchard' ? !!(S.lots.orchard && S.oshedBuilt && !building.oshed && !consLeft('oshed') && ostandCount() > 0) : !!(S.standBuilt && !building.stand && !consLeft('stand') && standCount() > 0));
function customerRush() {
  const loc = curLoc(); if (!rushReady(loc) || rushLeft(loc) > 0) return false;
  if (!spendJewels(RUSH.jewels)) return false;
  S.rush = { loc, until: now() + RUSH.ms }; S.stats.rushes = (S.stats.rushes || 0) + 1;
  if (loc === 'orchard') nextOCust = Math.min(nextOCust, now() + RUSH.firstMs); else nextCust = Math.min(nextCust, now() + RUSH.firstMs);
  writeSave(); hud(); syncJewelDock(); toast(`📣 Customer Rush · a crowd is on its way for ${fmtTime(RUSH.ms)}!`); return true;
}
function askRush() {
  if (!rushReady() || rushLeft() > 0) return;
  confirmBox(`<i data-icon="jewel" class="confirm-ico"></i><h3>Customer Rush?</h3><p>For <b>${fmtTime(RUSH.ms)}</b> customers arrive about ${Math.round(1 / RUSH.gapK)}× as often at your ${curLoc() === 'orchard' ? 'Orchard Stand' : 'Farm Stand'} (as many as your parking allows). <b>${RUSH.jewels} Jewel</b> · you have ${S.jewels}.</p>`, `Rush · ${RUSH.jewels} Jewel`, () => customerRush());
}
function syncJewelDock() {
  const d = $('#jeweldock'); if (!d) return;
  const n = S.introDone ? bloomTargets().length : 0, rl = rushLeft(), rr = S.introDone && rushReady();
  const bb = $('#jd-bloom'), rb = $('#jd-rush');
  bb.classList.toggle('hidden', !n); if (n) { const j = bloomJewels(n); if (bb.dataset.j !== String(j)) { bb.dataset.j = j; bb.querySelector('em').innerHTML = `${j}<i data-icon="jewel"></i>`; fillIcons(bb); } }
  rb.classList.toggle('hidden', !(rr || rl > 0)); rb.classList.toggle('active', rl > 0);
  const em = rb.querySelector('em'), want = rl > 0 ? clock(rl) : `${RUSH.jewels}<i data-icon="jewel"></i>`; if (em.dataset.v !== want) { em.dataset.v = want; em.innerHTML = want; if (!rl) fillIcons(rb); }
  d.classList.toggle('hidden', (!n && !(rr || rl > 0)) || !!placing || !!buildMode);   // out of the way while placing / building
  // v0.65: Bloom / Rush sit on the LEFT edge, stacked above the tool dock (Sickle / Plow) when that is showing
  if (!d.classList.contains('hidden')) { const tb = $('#tabbar').getBoundingClientRect(), td = $('#tooldock'), th = td && !td.classList.contains('hidden') ? td.getBoundingClientRect().height + 8 : 0; if (tb.height) d.style.bottom = Math.round(innerHeight - tb.top + 56 + th) + 'px'; }
}
$('#jd-bloom')?.addEventListener('click', askBloom);
$('#jd-rush')?.addEventListener('click', askRush);
// ---------------- Panels ----------------
let panel = null, marketTab = 'buy', bagTab = 'satchel', panelArg = null, panelAt = 0;
function openPanel(name, tab) {
  if (buildMode) exitBuild(); if (placing) exitPlace();
  panel = name; if (name === 'market' && tab) marketTab = tab; if (name === 'bag' && tab) bagTab = tab; if (name === 'lot' || name === 'orchardtree' || name === 'worker' || name === 'bulk') panelArg = tab;
  $('#tile-sheet').classList.add('hidden'); if (selected != null || focus) { selected = null; focus = null; W.select(null); }
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.panel === name || (name === 'ostand' && b.dataset.panel === 'stand')));
  panelAt = performance.now(); $('#panel').classList.remove('hidden'); $('#panel').dataset.name = name; renderPanel(); $('#panel-body').scrollTop = 0;
}
function closePanel() { panel = null; $('#panel').classList.add('hidden'); document.querySelectorAll('#tabbar button').forEach((b) => b.classList.remove('on')); }
$('#panel-close').addEventListener('click', closePanel);
$('#panel').addEventListener('click', (e) => { if (e.target.id === 'panel' && performance.now() - panelAt > 450) closePanel(); });
const tabPanel = (p) => (p === 'stand' && curLoc() === 'orchard' ? 'ostand' : p);   // v0.67.1: the Stand button opens the stand of the location you are in
document.querySelectorAll('#tabbar button[data-panel]').forEach((b) => b.addEventListener('click', () => { const p = tabPanel(b.dataset.panel); return panel === p ? closePanel() : openPanel(p); }));
$('#pill-jewels').addEventListener('click', () => (panel === 'jewels' ? closePanel() : openPanel('jewels')));

// v0.4: plots (owned, with no barrel yet) that can get a barrel. Home's arrives free with the first bed.
const barrelLots = () => Object.keys(LOTS).filter((l) => S.lots[l] && !S.barrels[l] && (l !== 'home' || S.barrel));
function buildBarrel(lot, x, z) {
  if (!lot || !S.lots[lot] || S.barrels[lot]) return false;
  // v0.52: a barrel left over from an older save (barrelInv) is placed free; otherwise it is paid for now (Build menu, 40 coins)
  if (S.barrelInv > 0) S.barrelInv--; else if (S.unlocked.rainbarrel && S.coins >= BARREL.price) S.coins -= BARREL.price; else { toast(`A Rain Barrel costs ${BARREL.price} coins`); return false; }
  S.barrels[lot] = { x, z, w: 0, at: now() };
  W.addBarrel(lot, x, z, true); syncBarrels(); save(); hud();
  setTimeout(() => { if (barrelRoof(lot)) { popAt(V3(x, 1.6, z), `<i data-icon="water"></i>Rain barrel placed! Gutter from the ${ROOF_NAMES[barrelRoof(lot)]} · 1 water every 30 s`); tip('barrel'); } else toast(`Rain barrel placed — ${NOT_COLLECTING.toLowerCase()} (a Tincture or Essential Oil Stand there; its gutter connects automatically)`); }, 900);
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
// v0.52: a base is for sale once its card is found AND the Tincture Stand is open (built), or the save was grandfathered.
const standOpenForBases = () => !!(S.tinctureBuilt || S.basesGrandfathered);
const baseOpen = (b) => !!BASES[b] && !!S.tinctureBuilt;   // v0.7.2.1: Glycerin / Vinegar are not in the Market at all until the Tincture Stand is built (owned stock always stays)
const baseNeeds = (b) => [!S.tinctureBuilt && 'Build the Tincture Stand first'].filter(Boolean);
const tincBase = () => { const b = S.tincBase === 'vinegar' ? 'vinegar' : 'glycerin', o = b === 'glycerin' ? 'vinegar' : 'glycerin'; return S.inv[b] > 0 || !(S.inv[o] > 0) ? b : o; };
const tincCost = () => BUILDS.tincture.wood;   // v0.52: 0 — the stand is a free goal reward
const tincLots = (what) => OWNABLE_LOTS.filter((l) => S.lots[l] && l !== 'home' && standOkAt(what, lotLoc(l)));
// Can the Tincture Stand go here? Whole footprint must be on cleared ground of one bought neighbouring plot.
const BED_HALF = TILE * BED_N / 2;   // v0.41: stands may not cover a bed patch
function tincProblem(x, z, what) {
  const lot = lotAt(x, z); if (!lot || !S.lots[lot]) return 'Build it on a plot you own';
  if (!standOkAt(what, lotLoc(lot))) return standWhere(what) === 'orchard' ? 'The Fruit Stand goes at the Orchard' : 'This stand goes at Home for now';   // v0.61
  if (lot === 'home' && !ANY_PLOT.has(what)) return 'Build it on one of your other plots — not the Roadside Lot';
  if (lotLoc(lot) === 'orchard' && Math.hypot(SPOTS.orchardshed[0] - x, SPOTS.orchardshed[1] - z) < 2.0) return 'That’s the Orchard Stand’s spot';
  if (lotLoc(lot) === 'orchard' && ORCHARD_TREE_SPOTS.some((p) => Math.abs(p.x - x) < 1.6 && Math.abs(p.z - z) < 1.3)) return 'That’s a fruit-tree spot — keep it free for a tree';   // v0.6
  for (const [dx, dz] of [[0, 0], [0.8, 0.5], [-0.8, 0.5], [0.8, -0.5], [-0.8, -0.5]]) { if (lotAt(x + dx, z + dz) !== lot) return 'Too close to the edge of the plot'; const w = placeProblem(x + dx, z + dz); if (w) return w;
    for (const st of SITES) if (st.lot === lot && Math.abs(st.x - x - dx) < BED_HALF + 0.1 && Math.abs(st.z - z - dz) < BED_HALF + 0.1 && !(lot === 'home' && ANY_PLOT.has(what) && !S.beds.includes(st.id))) return 'That’s a bed patch — keep it free for a raised bed'; }
  return null;
}
const ANY_PLOT = new Set(['teastand', 'press', 'fruitstand', 'opress']);   // v0.52/v0.6: these stands may go on any owned plot, the Roadside Lot too
const standLots = (what) => (ANY_PLOT.has(what) && standOkAt(what, 'home') ? ['home', ...tincLots(what)] : tincLots(what));
function tincSpots(what) {
  const out = [];
  for (const lot of standLots(what)) { const L = LOTS[lot], fine = lot === 'home' && ANY_PLOT.has(what), st = fine ? 0.5 : lot === 'home' ? 2.2 : 1.5;
    // v0.6: the Roadside Lot is crowded (beds, buildings), so stands that may go there get a fine grid of only the spots that fit
    for (let z = Math.min(L.z1, 4.3) - 1.0; z > L.z0 + 0.9; z -= st) for (let x = L.x0 + 1.1; x < L.x1 - 1.0; x += st) { const ok = !tincProblem(x, z, what);
      if (fine && (!ok || out.some((q) => q.lot === 'home' && Math.hypot(q.x - x, q.z - z) < 1.1))) continue;
      out.push({ x: +x.toFixed(2), z: +z.toFixed(2), lot, ok }); } }
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
// ---------------- v0.52: buy & place in one step ----------------
// Buying anything that goes on the map drops straight into placement. Nothing is charged until the spot is confirmed;
// cancelling (or a refused spot) costs nothing. `coins` is the purchase price, wood/scrap the build cost paid by the builder.
let buyIntent = null;
const PLACE_BUY = {   // v0.6: + one entry per fruit tree (tree_<id>), added below
  sapling:    { what: 'sapling', coins: () => SHOP.sapling.price, apply: () => { S.inv.sapling++; }, undo: () => { S.inv.sapling--; } },
  beehive:    { what: 'hive', coins: () => FEATURES.beehive.price, apply: () => { S.hiveInv = (S.hiveInv || 0) + 1; S.owned.beehive = true; }, undo: () => { S.hiveInv--; S.owned.beehive = !!(Object.keys(S.hives).length || S.hiveInv); } },
  irrigation: { what: 'irrigation', coins: () => FEATURES.irrigation.price, apply: () => { S.owned.irrigation = S.discovered.irrigation = S.unlocked.irrigation = true; addCard('irrigation'); }, undo: () => { S.owned.irrigation = false; if (S.cards.irrigation && !--S.cards.irrigation.n) delete S.cards.irrigation; } },
  windmill:   { what: 'windmill', coins: () => FEATURES.windmill.price, wood: () => BUILDS.windmill.wood, scrap: () => BUILDS.windmill.scrap, apply: () => { S.owned.windmill = true; }, undo: () => { S.owned.windmill = false; } },
  still:      { what: 'still', coins: () => FEATURES.still.price, wood: () => BUILDS.still.wood, apply: () => { S.owned.still = true; }, undo: () => { S.owned.still = false; } },
  teastand:   { what: 'teastand', coins: () => FEATURES.teastand.price, wood: () => BUILDS.teastand.wood, apply: () => { S.owned.teastand = true; }, undo: () => { S.owned.teastand = false; } },
  press:      { what: 'press', coins: () => FEATURES.press.price, wood: () => BUILDS.press.wood, apply: () => { S.owned.press = true; }, undo: () => { S.owned.press = false; } },
  opress:     { what: 'opress', coins: () => FEATURES.press.price, wood: () => BUILDS.press.wood, apply: () => { S.owned.opress = true; }, undo: () => { S.owned.opress = false; } },
  fruitstand: { what: 'fruitstand', coins: () => FEATURES.fruitstand.price, wood: () => BUILDS.fruitstand.wood, apply: () => { S.owned.fruitstand = true; }, undo: () => { S.owned.fruitstand = false; } },
  parking:    { what: 'parking', coins: () => FEATURES.parking.price, wood: () => BUILDS.parking.wood, apply: () => { S.owned.parking = true; }, undo: () => { S.owned.parking = false; } },
  billboard:  { what: 'billboard', coins: () => FEATURES.billboard.price, wood: () => BUILDS.billboard.wood, apply: () => { S.owned.billboard = true; }, undo: () => { S.owned.billboard = false; } },
  // v0.68.1: the Orchard's own Parking Lot and Billboard (same cards, same prices; the Parking Lot card level is shared)
  oparking:   { what: 'oparking', coins: () => FEATURES.parking.price, wood: () => BUILDS.parking.wood, apply: () => { S.owned.oparking = true; }, undo: () => { S.owned.oparking = false; } },
  obillboard: { what: 'obillboard', coins: () => FEATURES.billboard.price, wood: () => BUILDS.billboard.wood, apply: () => { S.owned.obillboard = true; }, undo: () => { S.owned.obillboard = false; } },
};
const buyCost = (id) => { const B = PLACE_BUY[id]; return { coins: B.coins(), wood: B.wood?.() || 0, scrap: B.scrap?.() || 0 }; };
const missingText = (c) => [S.coins < c.coins && `${c.coins - S.coins} more coins`, S.wood < c.wood && `${c.wood - S.wood} more Wood`, S.scrap < c.scrap && `${c.scrap - S.scrap} more Scrap Metal`].filter(Boolean).join(' and ');
for (const t of TREE_IDS) PLACE_BUY['tree_' + t] = { what: 'orchardtree', tree: t, coins: () => TREES[t].saplingPrice, apply: () => {}, undo: () => {} };
function commitBuy(p) {
  const b = p?.buy; if (!b) return true;
  const c = buyCost(b.id); if (!canPay(c)) { toast(`You need ${missingText(c)}`); return false; }
  S.coins -= c.coins; b.paid = c.coins; PLACE_BUY[b.id].apply(); sfx('buy'); S.stats.placeBuys = (S.stats.placeBuys || 0) + 1;
  if (truckTimed()) { const loc = curLoc(); W.spawnVan({ stopX: DELIV_STOP[loc](), ox: loc === 'orchard' ? ORCH_X : 0, from: 22, onPark: (car) => { W.dropCrates(car.group.position.x, ROAD.z0 - 0.45, 1); setTimeout(() => car.leave(), TRUCK.park); } }); }   // v0.65: placed buys arrive by van too (placed at once)
  return true;
}
function rollbackBuy(p) { const b = p?.buy; if (!b?.paid) return; S.coins += b.paid; b.paid = 0; PLACE_BUY[b.id].undo(); S.stats.placeBuys--; save(); hud(); }
function startBuy(id) {
  const B = PLACE_BUY[id]; if (!B || (FEATURES[id] && !S.unlocked[id]) || (TRAF[id] && !S.unlocked[TRAF[id].base])) return false;
  if (TRAF[id] && (S.owned[id] || S[TRAF[id].key])) return false;
  if (id === 'opress' && (!S.unlocked.press || S.owned.opress)) return false;   // v0.66.1: needs the Pressed Oil Stand card (or its coin unlock)
  if (FEATURES[id] && S.owned[id] && id !== 'beehive' && id !== 'irrigation') return false;   // v0.63: Irrigation is bought once (duplicates come from packs)
  if (id === 'irrigation' && irrigBlock()) { toast(irrigBlock()); return false; }   // v0.7.1: one bed per purchase, only while a bed needs it
  const c = buyCost(id); if (!canPay(c)) { toast(`${FEATURES[id]?.name || 'A tree sapling'} costs ${[coin(c.coins), c.wood && woodTag(c.wood), c.scrap && scrapTag(c.scrap)].filter(Boolean).join(' + ')} — you need ${missingText(c)}`); return false; }
  if (TRAF[id]) {   // fixed roadside spots: buying is building, paid in one go (v0.68.1: at Home or at the Orchard)
    { const g = trafGate(id); if (g) { toast(g); return false; } }
    const p = { buy: { id } }; commitBuy(p); const ok = buildTraffic(id); if (!ok) rollbackBuy(p); return ok;
  }
  if ((id === 'tincture' || id === 'still') && !tincLots().length) { toast(`Buy a neighbouring plot first — the ${FEATURES[id].name} is built on one of your other plots`); return false; }
  if (id === 'beehive' && !hiveLots().length) { toast('Every plot you own already has a beehive (one per plot)'); return false; }
  if (B.tree && !S.lots.orchard) { toast('Buy The Orchard on the Map first — fruit trees grow only there'); return false; }
  buyIntent = { id };
  try { if (id === 'tincture' || id === 'still' || id === 'teastand' || CRAFT[id]) startStandPlace(id, (FEATURES[id] || CRAFT[id]).name, c.wood); else if (B.tree) startTreePlace(B.tree); else enterPlace(B.what); } finally { buyIntent = null; }
  if (!placing || placing.what !== B.what) return false;
  placing.buy = { id };
  $('#buildbar-text').innerHTML += ` · <span class="buy-on-place">pay ${costHTML(c)} when you place it</span>`; fillIcons($('#buildbar'));
  return true;
}
// Tincture & Essential Oil Stands: the player picks a spot (green ghosts) on cleared ground of a bought neighbouring plot.
function startStandPlace(what, title, c) {
  closePanel(); deselect(); if (buildMode) exitBuild(); if (placing) exitPlace();
  const spots = tincSpots(what), ok = spots.filter((p) => p.ok), lots = standLots(what);
  placing = { what, spots }; W.setSpotGhosts(spots);
  $('#buildbar-text').innerHTML = ok.length ? `<b>${title}</b> · tap a <b>green spot</b> on ${what === 'fruitstand' ? 'an Orchard plot' : what === 'press' ? 'any Home plot you own' : what === 'opress' ? 'the Orchard or an Orchard plot you own' : ANY_PLOT.has(what) ? 'any Home plot you own' : lots.map(lotName).join(' or ')}${buyIntent ? '' : ' · ' + woodTag(c)}` : `<b>${title}</b> · no clear spot yet — clear trees on ${lots.map(lotName).join(' or ')} first`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  const L = LOTS[(ANY_PLOT.has(what) ? ((ok.find((p) => lotLoc(p.lot) === curLoc()) || ok[0])?.lot || lots[0] || 'home') : (lots.includes(curLoc()) ? curLoc() : lots[0]))]; if (!ok.some((p) => lotLoc(p.lot) === curLoc() && !offScreen(V3(p.x, 0.3, p.z)))) { if (lotLoc(Object.keys(LOTS).find((id) => LOTS[id] === L)) !== curLoc()) { W.ctl.moved = true; glideW({ target: V3((L.x0 + L.x1) / 2, 0.3, (L.z0 + L.z1) / 2) }, 0.8); } else glideIfOff(V3((L.x0 + L.x1) / 2, 0.3, (L.z0 + L.z1) / 2)); }   // v0.7.1: only when no free spot is on screen; zoom unchanged
  return true;
}
function placeTincture(x, z) {
  const c = tincCost();
  if (S.tinctureBuilt || building.tincture || !S.owned.tincture || S.wood < c) return false;
  const lot = lotAt(x, z); S.tincPos = { x, z, lot }; SPOTS.tincture = [x, z]; W.tincture.position.set(x, 0, z);
  S.wood -= c; let bottles = false;
  if (c < BUILDS.tincture.wood) { S.decorInv.chime--; if (!S.decorInv.chime) delete S.decorInv.chime; bottles = true; }
  S.tinctureBuilt = true; building.tincture = true; startCons('tincture'); save(); closePanel(); syncBlueprints(); glideTo('tincture');
  setTimeout(() => W.buildAnim(W.tincture, [2.1, 2.6, 1.3], () => {
    building.tincture = false; popAt(spotV('tincture', 2.6), consMsg('tincture', 'Tincture Stand built!')); if (bottles) setTimeout(() => toast('Your restored Glass Bottles now line the shelves'), 600);
    tip('tincture'); hud(); checkGoals(); refreshShade(true);
  }), 500);
  hud(); return true;
}
function placeStill(x, z) {
  const c = BUILDS.still.wood;
  if (S.stillBuilt || building.still || !S.owned.still || S.wood < c) return false;
  S.stillPos = { x, z, lot: lotAt(x, z) }; SPOTS.still = [x, z]; W.still.position.set(x, 0, z);
  S.wood -= c; S.stillBuilt = true; building.still = true; startCons('still'); save(); closePanel(); syncBlueprints(); glideTo('still');
  setTimeout(() => W.buildAnim(W.still, [2.1, 2.6, 1.3], () => {
    building.still = false; popAt(spotV('still', 2.6), consMsg('still', 'Essential Oil Stand built!')); tip('still'); hud(); checkGoals(); refreshShade(true);
  }), 500);
  hud(); return true;
}
function distill(sp) { return inBag('home', () => distill_(sp)); }
function distill_(sp) {
  const r = STILL.recipes[sp], k = S.stills.findIndex((t) => !t), seed = r?.in || 'seed_' + sp;   // v0.6: tree recipes (eucalyptus leaves) use r.in
  if (!S.stillBuilt || building.still || !r || k < 0 || !(S.inv[seed] >= r.n)) return false;
  S.inv[seed] -= r.n; S.stills[k] = { sp, start: now(), ms: r.s * 1000 * craftK() };
  syncStill(); save(); hud(); renderPanel(); toast(`Distilling ${ITEMS[oilId(sp)].name} + ${ITEMS[hydroId(sp)].name} · ${fmtTime(r.s * 1000 * craftK())}`); return true;
}
function collectOil(k) { return inBag('home', () => collectOil_(k)); }
function collectOil_(k) {
  const t = S.stills[k]; if (!t || now() - t.start < t.ms) return false;
  // v0.52: one distillation, two products — the essential oil and its hydrosol (Rose Water for Damask Rose)
  const id = oilId(t.sp), hy = hydroId(t.sp); S.inv[id] = (S.inv[id] || 0) + 1; S.inv[hy] = (S.inv[hy] || 0) + 1; S.stills[k] = null;
  S.stats.oils = (S.stats.oils || 0) + 1; S.stats.hydrosols = (S.stats.hydrosols || 0) + 1;
  syncStill(); save(); hud(); renderPanel();
  popAt(spotV('still', 2.2), `<span class="pop-pair">${itemSvg(id)}+1 ${ITEMS[id].name}<br/>${itemSvg(hy)}+1 ${ITEMS[hy].name}</span>`);
  toast(`Distilled: <b>${ITEMS[id].name}</b> (${sellOf(id)}) + <b>${ITEMS[hy].name}</b> (${sellOf(hy)}) · sell both at the Farm Stand`); checkGoals(); return true;
}
// v0.5: Basic recipes are always listed (as before); higher-tier recipes appear once that plant is unlocked (or you hold some).
const recipeOpen = (sp) => SPECIES[sp]?.tier === 'basic' || S.unlocked[sp] || S.inv['flower_' + sp] > 0 || S.inv['seed_' + sp] > 0;
// ---------- v0.52: Tea Stand — blend any three dried herbs into a tea ----------
function buildTea() {
  const c = BUILDS.teastand.wood;
  if (S.teaBuilt || building.teastand || !S.owned.teastand) return false;
  if (S.wood < c) { toast(`The Tea Stand needs ${c} Wood`); return false; }
  return startStandPlace('teastand', 'Tea Stand', c);
}
function placeTea(x, z) {
  const c = BUILDS.teastand.wood;
  if (S.teaBuilt || building.teastand || !S.owned.teastand || S.wood < c) return false;
  S.teaPos = { x, z, lot: lotAt(x, z) }; SPOTS.teastand = [x, z]; W.teastand.position.set(x, 0, z);
  S.wood -= c; S.teaBuilt = true; building.teastand = true; startCons('teastand'); save(); closePanel(); syncBlueprints(); glideTo('teastand');
  setTimeout(() => W.buildAnim(W.teastand, [2.1, 2.6, 1.3], () => {
    building.teastand = false; popAt(spotV('teastand', 2.6), consMsg('teastand', 'Tea Stand built!')); tip('teastand'); hud(); checkGoals(); refreshShade(true);
  }), 500);
  hud(); return true;
}
let teaPick = [];   // species ids picked in the blend builder (max TEA.n, duplicates allowed)
const driedHave = (sp) => (S.inv['dried_' + sp] || 0) - teaPick.filter((p) => p === sp).length;
function teaAdd(sp) { if (teaPick.length >= TEA.n || !DRYING[sp] || driedHave(sp) <= 0) return false; teaPick.push(sp); return true; }
function teaRemove(k) { if (k < 0 || k >= teaPick.length) return false; teaPick.splice(k, 1); return true; }
function brewTea(sps = teaPick) { return inBag('home', () => brewTea_(sps)); }   // v0.7.2: honour the blend passed in (a Market Manager's)
function brewTea_(sps = teaPick) {
  const k = S.teas.findIndex((t) => !t);
  if (!S.teaBuilt || building.teastand || k < 0 || sps.length !== TEA.n) return false;
  const need = {}; for (const sp of sps) need[sp] = (need[sp] || 0) + 1;
  for (const [sp, n] of Object.entries(need)) if ((S.inv['dried_' + sp] || 0) < n) return false;
  for (const [sp, n] of Object.entries(need)) S.inv['dried_' + sp] -= n;
  const t = teaInfo(sps); registerTea(t.id);
  S.teas[k] = { id: t.id, sps: [...sps], start: now(), ms: t.s * 1000 * craftK(), color: t.color };
  if (sps === teaPick) teaPick = []; save(); syncTea(); hud(); if (panel === 'teastand') renderPanel();
  popAt(spotV('teastand', 2.2), `Brewing ${t.name}…`); return true;
}
function collectTea(k) { return inBag('home', () => collectTea_(k)); }
function collectTea_(k) {
  const t = S.teas[k]; if (!t || now() < t.start + t.ms) return false;
  registerTea(t.id); S.inv[t.id] = (S.inv[t.id] || 0) + 1; S.teas[k] = null; S.stats.teas = (S.stats.teas || 0) + 1;
  popAt(spotV('teastand', 2.2), `${itemSvg(t.id)}+1 ${ITEMS[t.id].name}`);
  save(); syncTea(); hud(); if (panel === 'teastand') renderPanel(); return true;
}
function syncTea() { if (!W.setTea) return; W.setTea(S.teas.map((t) => t && { done: now() >= t.start + t.ms, color: t.color })); }
// ---------- v0.6: Pressed Oil Stand & Fruit Stand — pick a recipe, the inputs leave your bag, collect the product later ----------
function buildCraft(c) {
  const C = CRAFT[c], w = BUILDS[c].wood;
  if (S[C.built] || building[c] || !S.owned[c]) return false;
  if (S.wood < w) { toast(`The ${C.name} needs ${w} Wood`); return false; }
  return startStandPlace(c, C.name, w);
}
function placeCraft(c, x, z) {
  const C = CRAFT[c], w = BUILDS[c].wood;
  if (S[C.built] || building[c] || !S.owned[c] || S.wood < w) return false;
  S[C.pos] = { x, z, lot: lotAt(x, z) }; SPOTS[c] = [x, z]; W[c].position.set(x, 0, z);
  S.wood -= w; S[C.built] = true; building[c] = true; startCons(c); save(); closePanel(); syncBlueprints(); glideTo(c);
  setTimeout(() => W.buildAnim(W[c], C.size, () => {
    building[c] = false; popAt(spotV(c, 2.6), consMsg(c, `${C.name} built!`)); tip(c); hud(); checkGoals(); refreshShade(true); syncCraft(c);
  }), 650);
  hud(); return true;
}
const recipeKnown = (r) => SPECIES[r.src]?.tier === 'basic' || TREES[r.src]?.tier === 'basic' && S.lots.orchard || S.unlocked[r.src] || (S.inv[r.in] || 0) > 0;
function craftMake(c, rid) { return inBag(standLoc(c), () => craftMake_(c, rid)); }
function craftMake_(c, rid) {
  const C = CRAFT[c], slots = S[C.slots], k = slots.findIndex((t) => !t), r = craftRecipe(c, rid);
  if (!S[C.built] || building[c] || k < 0 || !r || !recipeHere(c, r) || (S.inv[r.in] || 0) < r.n) return false;
  S.inv[r.in] -= r.n; slots[k] = { rid, item: r.item, start: now(), ms: r.s * 1000 * craftK() };
  save(); syncCraft(c); hud(); if (panel === c) renderPanel();
  popAt(spotV(c, 2.4), `${C.doing} ${r.name}…`); sfx(c === 'press' || c === 'opress' ? 'press' : 'tap'); return true;
}
function craftCollect(c, k) { return inBag(standLoc(c), () => craftCollect_(c, k)); }
function craftCollect_(c, k) {
  const C = CRAFT[c], t = S[C.slots][k]; if (!t || now() < t.start + t.ms) return false;
  S.inv[t.item] = (S.inv[t.item] || 0) + 1; S[C.slots][k] = null; S.stats.crafts = (S.stats.crafts || 0) + 1;
  popAt(spotV(c, 2.4), `${itemSvg(t.item)}+1 ${ITEMS[t.item].name}`); sfx(c === 'press' || c === 'opress' ? 'press' : 'pick');
  save(); syncCraft(c); hud(); if (panel === c) renderPanel(); return true;
}
function syncCraft(c) { if (!W.setCraft) return; W.setCraft(c, S[CRAFT[c].slots].map((t) => { if (!t) return null; const r = craftRecipe(c, t.rid); return { done: now() >= t.start + t.ms, color: r.color, glow: ITEMS[t.item].glow }; })); }
function craftHTML(c) {
  const C = CRAFT[c], slots = S[C.slots], free = slots.some((t) => !t);
  const sl = slots.map((t, k) => { if (!t) return `<div class="tslot empty">Empty ${C.slotName.toLowerCase()}</div>`; const left = t.start + t.ms - now();
    return left <= 0 ? `<button class="tslot done" data-makecollect="${c}:${k}">${itemSvg(t.item)}<span><b>${ITEMS[t.item].name}</b><small>Ready! Tap to collect</small></span></button>`
      : `<div class="tslot">${itemSvg(t.item)}<span><b>${ITEMS[t.item].name}</b><small>${C.doing} · <em data-cleft="${c}:${k}">${fmtTime(left)}</em></small></span></div>`; }).join('');
  const rows = C.def.recipes.filter((r) => recipeHere(c, r)).map((r) => { const srcN = (SPECIES[r.src] || TREES[r.src]), T = PLANT_TIERS[srcN.tier], inN = ITEMS[r.in].name, have = S.inv[r.in] || 0;
    if (!recipeKnown(r) && !SHOW_LOCKED) return '';
    if (!recipeKnown(r)) return `<div class="row locked craft-recipe" data-recipe="${r.id}"><div class="ico">${itemSvg(r.item)}</div><div class="meta"><b>${r.name}</b><small><em class="tier-tag t-${srcN.tier}">${T.label}</em> · find the ${srcN.name} card${TREES[r.src] ? ' (Orchard)' : ''} to unlock</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`;
    const ok = free && have >= r.n, sell = sellOf(r.item);
    return `<div class="row craft-recipe" data-recipe="${r.id}"><div class="ico">${itemSvg(r.item)}</div><div class="meta"><b>${r.name}${ITEMS[r.item].glow ? ' ✨' : ''}</b><small class="yields">Sells for <b>${coin(sell)}</b> <span class="oil-vs">vs ${coin(r.raw)} for the ${inN.toLowerCase()} · ×${(sell / r.raw).toFixed(2)}</span></small><small>${r.n} ${inN} · ${fmtTime(r.s * 1000 * craftK())} · you have ${have}</small></div><div class="acts"><button class="btn btn-gold sm" data-make="${c}:${r.id}" ${ok ? '' : 'disabled'}>${C.verb}</button></div></div>`; }).join('');
  return `<div class="hero tea-hero craft-hero">${FEATURE_ART[c]}<p>${C.blurb} — they sell at your Farm Stand for well above the raw ingredients.</p></div>
    <div class="sec-title">${C.slotName === 'Jar' ? 'Jam pots' : 'Presses'} · ${slots.filter(Boolean).length}/${slots.length}</div><div class="tslots">${sl}</div>
    <div class="sec-title">Recipes</div><div class="list">${rows.trim() ? rows : '<p class="muted empty-hint" data-empty-hint>Open Card Packs to discover recipes.</p>'}</div>
    <p class="muted" style="margin:10px 4px 0">${c === 'press' || c === 'opress' ? 'Oil = input value × (1.7 + 0.25 per tier above Basic); butters ×1.06 more. Sunflower bulk oils and Sunpetal Oil are hand-set.' : 'Price = fruit value × (1.6 + 0.25 per tier above Basic); jellies ×1.08, butters & preserves ×1.12. Cook time 40 s + 20 s per tier.'}</p>`;
}
// ---------- v0.6: the Orchard — fruit trees from cards, planted on fixed spots, fruit again and again ----------
const treeLvK = (sp) => 1 - CARD_LEVELS.plant.grow * (cardLv(sp) - 1);
const orchardSpots = () => ORCHARD_TREE_SPOTS.filter((p) => S.lots[p.lot]).map((p) => ({ x: p.x, z: p.z, k: p.k, lot: p.lot, ok: !orchardProblem(p.k) }));
function orchardProblem(k) {
  const p = ORCHARD_TREE_SPOTS[k]; if (!p) return 'Pick a tree spot in the Orchard';
  if (!S.lots.orchard) return 'Buy the Orchard first';
  if (!S.lots[p.lot]) return `Buy ${LOTS[p.lot].name} first`;
  if (S.orchard[k]) return 'A tree already grows there';
  // v0.68: a stand, barrel or decoration an older save placed where a new grid spot now is keeps that spot blocked
  const thing = [...Object.keys(CRAFT).map((c) => S[CRAFT[c].pos]), ...Object.values(S.barrels || {}), ...(S.decor || [])].find((o) => o && typeof o.x === 'number' && Math.abs(o.x - p.x) < 1.3 && Math.abs(o.z - p.z) < 1.1);
  if (thing) return 'Something is built on this spot';
  const o = OBSTACLES.find((q) => q.lot === p.lot && obsState(q.id) !== 'gone' && Math.hypot(q.x - p.x, q.z - p.z) < 1.0);
  if (o) return `Clear the ${o.type === 'tree' ? 'old tree' : o.type} there first`;
  return null;
}
function startTreePlace(sp) {
  closePanel(); deselect(); if (buildMode) exitBuild(); if (placing) exitPlace();
  const spots = orchardSpots(), ok = spots.filter((q) => q.ok);
  placing = { what: 'orchardtree', sp, spots }; W.setSpotGhosts(spots);
  $('#buildbar-text').innerHTML = ok.length ? `<b>${TREES[sp].name} sapling</b> · tap a <b>green spot</b> in the Orchard` : `<b>${TREES[sp].name} sapling</b> · no free spot — clear the old trees in the Orchard`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  if (curLoc() !== 'orchard') { W.ctl.moved = true; glideW({ target: V3(ORCH_X, 0.3, -4.2) }, 0.8); } else if (!ok.some((q) => !offScreen(V3(q.x, 0.3, q.z)))) glideIfOff(V3(ORCH_X, 0.3, -4.2));   // v0.7.1
  return true;
}
function plantOrchard(k, sp, at = now()) {
  const d = TREES[sp], lk = treeLvK(sp), growMs = d.growS * 1000 * lk;
  S.orchard[k] = { sp, at, growMs, cycleMs: d.cycleS * 1000 * lk, next: at + growMs };
  S.stats.treesPlanted = (S.stats.treesPlanted || 0) + 1;
  W.addOrchardTree(k, sp); syncOrchard(); save(); hud(); refreshShade(true);
  const p = ORCHARD_TREE_SPOTS[k]; W.poof(V3(p.x, 0.4, p.z), '#9CC49A', 14, 1.4); popAt(V3(p.x, 1.4, p.z), `${d.name} planted`); sfx('plant');
  return true;
}
function pickTree(k) { return inBag('orchard', () => pickTree_(k)); }
function pickTree_(k) {
  const t = S.orchard[k]; if (!t || !orchRipe(t)) return false;
  const d = TREES[t.sp], n = d.yield + lvFlower(t.sp);
  S.inv[d.fruit] = (S.inv[d.fruit] || 0) + n; t.dry = now(); t.next = t.dry + t.cycleMs; S.stats.fruitPicks = (S.stats.fruitPicks || 0) + 1;
  const p = ORCHARD_TREE_SPOTS[k]; popAt(V3(p.x, 2.4, p.z), `${itemSvg(d.fruit)}+${n} ${d.fruitName}`);
  autoWaterTrees(); save(); syncOrchard(); hud(); if (panel === 'orchardtree') renderPanel(); sfx('pick'); return true;
}
// ---- v0.67.1: trees need water to fruit again; tree-row Irrigation ----
// After a pick the tree is dry (t.dry = when it was picked): its next fruit only starts growing once it is watered — 1 water
// from a rain barrel (by hand, by a Gardener, or by an irrigated row). Rows = the tree spots sharing a line (lot + z).
const ORCH_ROWS = (() => { const m = new Map(); for (const p of ORCHARD_TREE_SPOTS) { const id = `${p.lot}:${p.z}`; if (!m.has(id)) m.set(id, { id, lot: p.lot, z: p.z, ks: [], xs: [] }); m.get(id).ks.push(p.k); m.get(id).xs.push(p.x); } return [...m.values()]; })();
const rowOfTree = (k) => ORCH_ROWS.find((r) => r.ks.includes(+k));
const rowNo = (r) => ORCH_ROWS.indexOf(r) + 1;
const rowsOwned = () => ORCH_ROWS.filter((r) => S.lots[r.lot]);
const rowIrrigated = (r) => !!r && (S.treeIrrig || []).includes(r.id);
const nextIrrigRow = () => rowsOwned().find((r) => !rowIrrigated(r) && r.ks.some((k) => S.orchard[k])) || null;   // v0.7.2.2: only rows with a planted tree
function treeWaterSrc(k, hand) {
  const lot = ORCHARD_TREE_SPOTS[k].lot, own = S.barrels[lot]; if (own && own.w > 0) return own;
  const orch = ORCH_LOTS.map((l) => S.barrels[l]).filter((b) => b && b.w > 0).sort((a, b) => b.w - a.w)[0]; if (orch) return orch;   // any Orchard barrel
  return hand ? Object.values(S.barrels).filter((b) => b.w > 0).sort((a, b) => b.w - a.w)[0] || null : null;   // by hand: any barrel with water
}
function waterTree(k, auto = false, at = now()) {
  const t = S.orchard[k]; if (!t || !t.dry) return false;
  const b = treeWaterSrc(k, !auto); if (!b) { if (!auto) toast('Your rain barrels are empty — build a Rain Barrel in the Orchard (Build menu) or wait for the rain'); return false; }
  takeFromBarrel(b); t.next = Math.max(t.dry, at) + t.cycleMs; delete t.dry;
  S.stats.treesWatered = (S.stats.treesWatered || 0) + 1; if (auto) S.stats.irrigated = (S.stats.irrigated || 0) + 1; else S.stats.watered++;
  if (!quiet) { const p = ORCHARD_TREE_SPOTS[k]; W.poof?.(V3(p.x, 1.2, p.z), '#8EC0D0', 12, 1.2); if (!auto) sfx('water'); if (!auto) popAt(V3(p.x, 2.2, p.z), `<i data-icon="water"></i>Watered · fruiting again in ${fmtTime(t.cycleMs)}`); }
  syncBarrels(); syncOrchard(); return true;
}
// irrigated rows water their own trees as soon as they are picked (from the row's plot barrel, else any Orchard barrel)
function autoWaterTrees() {
  let n = 0; for (const r of ORCH_ROWS) { if (!rowIrrigated(r)) continue;
    for (const k of r.ks) { const t = S.orchard[k]; if (t?.dry && waterTree(k, true, t.dry)) { n++; W.treeRowPulse?.(r.id); } } }
  if (n) { save(); if (panel === 'orchardtree' || panel === 'build') renderPanel(); } return n;
}
function syncTreeRows() { W.setTreeRows?.(rowsOwned().map((r) => ({ id: r.id, x0: Math.min(...r.xs), x1: Math.max(...r.xs), z: r.z, n: r.ks.length, on: rowIrrigated(r) }))); }
function buyTreeRow() {
  const r = nextIrrigRow(); if (!r) { toast('No tree rows need irrigation'); return false; }
  if (S.coins < TREE_IRRIG.coins) { toast(`Tree-row Irrigation costs ${TREE_IRRIG.coins} coins`); return false; }
  S.coins -= TREE_IRRIG.coins; (S.treeIrrig ||= []).push(r.id); S.stats.treeRows = S.treeIrrig.length;
  syncTreeRows(); W.treeRowPulse?.(r.id); autoWaterTrees();
  popAt(V3(Math.min(...r.xs) - 1.5, 1.4, r.z), `<i data-icon="water"></i>Row ${rowNo(r)} irrigated!`);
  toast(`💧 Row ${rowNo(r)} (${lotName(r.lot)}) is irrigated · its trees are watered for you after every pick`);
  save(); hud(); if (panel) renderPanel(); return true;
}
function treeRowsHTML() {
  const rows = rowsOwned(); if (!rows.length) return '';
  return `<div class="tree-rows" data-tree-rows>${rows.map((r) => `<span class="tr-chip${rowIrrigated(r) ? ' on' : ''}" data-tree-row="${r.id}" data-irrigated="${rowIrrigated(r) ? 1 : 0}">${rowIrrigated(r) ? '💧' : '○'} Row ${rowNo(r)}<small>${lotName(r.lot)}</small></span>`).join('')}</div>`;
}
function treeIrrigCard() {
  if (!nextIrrigRow()) return '';   // v0.7.2.2: hidden until a planted tree row needs irrigation
  const art = FEATURE_ART.irrigation, rows = rowsOwned(), done = rows.filter(rowIrrigated).length, nx = nextIrrigRow(), ok = S.coins >= TREE_IRRIG.coins;
  const sub = `A drip line along one row of fruit trees: it waters each tree right after it is picked, so it fruits again without you. Each purchase covers the next row · ${done}/${rows.length} rows irrigated.`;
  return `<div class="build-card" data-build-card="treeirrig"><div class="bc-art">${art}</div><div class="meta"><b>Tree-row Irrigation</b><small>${sub}</small>${treeRowsHTML()}
    ${nx ? `<div class="cost">${coin(TREE_IRRIG.coins)} <span class="${ok ? 'ok' : 'no'}">you have ${S.coins} coins</span></div><button class="btn btn-primary" data-act="buy-treerow" ${ok ? '' : 'disabled'}><i data-icon="water"></i> Irrigate Row ${rowNo(nx)}</button>` : `<div class="cost">${coin(TREE_IRRIG.coins)}</div><button class="btn btn-primary" data-act="buy-treerow" disabled>No tree rows need irrigation</button><span class="bstat done" data-treerow-all>Every row you own is irrigated${ORCH_FOR_SALE.some((l) => !S.lots[l]) ? ' · buy another Orchard plot for more rows' : ''}</span>`}</div></div>`;
}
let orchSig = '';
function syncOrchard() {
  const sig = Object.entries(S.orchard).map(([k, t]) => k + t.sp + orchStage(t) + (orchRipe(t) ? 'r' : '') + (t.dry ? 'd' : '')).join(',');
  if (sig === orchSig) return; const stageChanged = orchSig.replace(/[rd]/g, '') !== sig.replace(/[rd]/g, ''); orchSig = sig;
  for (const [k, t] of Object.entries(S.orchard)) { if (!W.orchardTrees.has(+k)) W.addOrchardTree(+k, t.sp); W.setOrchardTree(+k, orchStage(t), orchRipe(t), !!t.dry); }
  if (stageChanged && worldReady) refreshShade(true);
}
const treeUses = (sp) => { const d = TREES[sp], T = PLANT_TIERS[d.tier], u = [];
  if (FRUITSTAND.recipes.some((r) => r.src === sp)) u.push('Fruit Stand'); { const pr = PRESS.recipes.filter((r) => r.src === sp); if (pr.length) u.push(pr.every((r) => r.only === 'orchard') ? 'Orchard Oil Press' : pr.every((r) => r.only === 'home') ? 'Pressed Oil Stand (Home)' : 'Pressed Oil Stand'); } if (STILL.recipes[sp]) u.push('Essential Oil Stand');
  return `<br/><b>${T.label}</b> · Orchard tree · sapling ${d.saplingPrice} coins · fruits after ${fmtTime(d.growS * 1000)}, then every ${fmtTime(d.cycleS * 1000)} · ${d.yield} ${d.fruitName.toLowerCase()} a picking (${d.fruitSell} each)${u.length ? ` · uses: ${u.join(', ')}` : ''}`; };
function orchardTreeHTML(k) {
  const t = S.orchard[k]; if (!t) return '<p class="muted">Nothing grows here.</p>';
  const d = TREES[t.sp], st = orchStage(t), ripe = orchRipe(t), lv = cardLv(t.sp), n = d.yield + lvFlower(t.sp);
  const row = rowOfTree(k), irr = rowIrrigated(row);
  const rowLine = `<p class="muted tree-row-line" data-tree-row-line="${irr ? 'on' : 'off'}" style="margin:6px 4px">${irr ? '💧' : '○'} Row ${rowNo(row)} · ${irr ? 'Irrigated — watered for you after every pick' : 'Not irrigated — water it by hand after each pick, or add Tree-row Irrigation (Build menu)'}</p>`;
  if (t.dry && st >= 3) return `<div class="hero tea-hero tree-hero">${FEATURE_ART[t.sp]}<p>${d.blurb}</p></div>
    <p class="tree-line needs-water" data-tree-stage="${st}" data-tree-dry><i data-icon="water"></i> <b>Needs water</b> · it fruits again ${fmtTime(t.cycleMs)} after it is watered</p>${rowLine}
    <div class="ts-actions"><button class="btn btn-primary" data-wtree="${k}"><i data-icon="water"></i> Water the tree</button></div>
    <p class="muted" style="margin:6px 4px">Uses 1 water from a rain barrel (this plot's first, then any Orchard barrel).</p>`;
  const grow = st < 3 ? `Growing · <b data-oleft="${k}">${fmtTime(t.at + t.growMs - now())}</b> to its first fruit` : ripe ? `<b>Ripe!</b> ${n} ${d.fruitName.toLowerCase()} ready to pick` : `Fruiting again in <b data-oleft="${k}">${fmtTime(t.next - now())}</b>`;
  return `<div class="hero tea-hero tree-hero">${FEATURE_ART[t.sp]}<p>${d.blurb}</p></div>
    <p class="tree-line" data-tree-stage="${st}">${['Sapling', 'Young tree', 'Nearly grown', 'Mature'][st]} · ${grow}</p>
    ${rowLine}<p class="muted" style="margin:6px 4px">Fruits every ${fmtTime(t.cycleMs)} after each watering, without replanting · ${d.fruitName} sell for ${sellOf(d.fruit)} each${lv > 1 ? ` (Lv${lv})` : ''}.</p>
    <div class="ts-actions"><button class="btn btn-gold" data-pick="${k}" ${ripe ? '' : 'disabled'}>${itemSvg(d.fruit)} Pick ${n} ${d.fruitName}</button></div>`;
}
function teaHTML() {
  const free = S.teas.some((t) => !t);
  const slots = S.teas.map((t, k) => { if (!t) return `<div class="tslot empty">Empty teapot</div>`; const left = t.start + t.ms - now();
    return left <= 0 ? `<button class="tslot done" data-teacollect="${k}">${itemSvg(t.id)}<span><b>${ITEMS[t.id].name}</b><small>Ready! Tap to collect</small></span></button>`
      : `<div class="tslot">${itemSvg(t.id)}<span><b>${ITEMS[t.id].name}</b><small>Brewing · <em data-eleft="${k}">${fmtTime(left)}</em></small></span></div>`; }).join('');
  const cups = Array.from({ length: TEA.n }, (_, k) => { const sp = teaPick[k];
    return sp ? `<button class="tea-cup full" data-tearm="${k}" aria-label="Remove ${SPECIES[sp].name}">${itemSvg('dried_' + sp)}<small>${SPECIES[sp].name}</small><em>×</em></button>` : `<div class="tea-cup">${k + 1}</div>`; }).join('<span class="tea-plus">+</span>');
  let pred = `<div class="tea-pred empty">Pick ${TEA.n - teaPick.length} more dried herb${TEA.n - teaPick.length === 1 ? '' : 's'} — duplicates are fine</div>`;
  if (teaPick.length) {
    const fill = teaPick.length === TEA.n ? teaPick : [...teaPick, ...Array(TEA.n - teaPick.length).fill(teaPick[teaPick.length - 1])];
    const t = teaInfo(fill), done = teaPick.length === TEA.n;
    pred = `<div class="tea-pred${done ? '' : ' partial'}" id="tea-pred"><div class="tp-ico">${itemIcon(['tin', t.color])}</div><div class="tp-meta"><b>${done ? t.name : 'So far…'}</b>
      <span class="tp-price">${done ? '' : 'about '}${coin(t.sell)}</span>
      <small>vs ${coin(t.dried)} selling the herbs dried · ×${t.mult.toFixed(2)}${t.distinct === 3 ? ' · <em>3 different herbs +10%</em>' : ''}</small>
      <small>Brews in ${t.s} s · ${PLANT_TIERS[t.tier].label} blend</small></div></div>`;
  }
  const have = Object.keys(SPECIES).filter((sp) => (S.inv['dried_' + sp] || 0) > 0);
  const chips = have.length ? have.map((sp) => { const n = driedHave(sp), T = PLANT_TIERS[SPECIES[sp].tier];
    return `<button class="tea-herb" data-teaadd="${sp}" ${n > 0 && teaPick.length < TEA.n ? '' : 'disabled'}>${itemSvg('dried_' + sp)}<b>${SPECIES[sp].name}</b><small><em style="color:${T.color}">${T.label}</em> · ×${n} · ${coin(sellOf('dried_' + sp))}</small></button>`; }).join('')
    : `<p class="muted" style="margin:4px">No dried herbs yet — hang flowers on the Drying Rack (every plant dries now; higher tiers take longer).</p>`;
  return `<div class="hero tea-hero">${FEATURE_ART.teastand}<p>Blend any three dried herbs into a tea that sells at your Farm Stand</p></div>
    <div class="sec-title">Teapots · ${S.teas.filter(Boolean).length}/${S.teas.length}</div><div class="tslots">${slots}</div>
    <div class="sec-title">Your blend</div><div class="tea-cups">${cups}</div>${pred}
    <div class="ts-actions"><button class="btn btn-gold" data-act="brew-tea" ${teaPick.length === TEA.n && free ? '' : 'disabled'}>🫖 ${free ? 'Brew this tea' : 'Both teapots are busy'}</button>${teaPick.length ? '<button class="btn" data-act="tea-clear">Clear</button>' : ''}</div>
    <div class="sec-title">Dried herbs in your bag</div><div class="tea-herbs">${chips}</div>
    <p class="muted" style="margin:10px 4px 0">Tea price = the three herbs’ dried prices × a blend multiplier that grows with their average tier (×1.4 for Basic up to ×3.5 for Other World), +10% when all three herbs differ. Brewing takes ${TEA.brewS(1)}–${TEA.brewS(7)} s.</p>`;
}
function stillHTML() {
  const free = S.stills.some((t) => !t);
  const slots = S.stills.map((t, k) => { if (!t) return `<div class="tslot empty">Empty still</div>`; const id = oilId(t.sp), left = t.start + t.ms - now();
    const hy = hydroId(t.sp), two = `<span class="two-ico">${itemSvg(id)}${itemSvg(hy)}</span>`;   // v0.52: both products shown
    return left <= 0 ? `<button class="tslot done" data-scollect="${k}">${two}<span><b>${ITEMS[id].name} + ${ITEMS[hy].name}</b><small>Ready! Tap to collect both</small></span></button>`
      : `<div class="tslot">${two}<span><b>${ITEMS[id].name} + ${ITEMS[hy].name}</b><small>Distilling · <em data-sleft="${k}">${fmtTime(left)}</em></small></span></div>`; }).join('');
  const rows = Object.entries(STILL.recipes).filter(([sp, r]) => r.in ? (S.unlocked[sp] || S.inv[r.in] > 0) : recipeOpen(sp)).map(([sp, r]) => { const id = oilId(sp), inId = r.in || 'seed_' + sp, have = S.inv[inId] || 0, ok = free && have >= r.n, sd = SPECIES[sp];
    const hy = hydroId(sp);
    return `<div class="row still-recipe" data-recipe="${sp}"><div class="ico two-ico">${itemSvg(id)}${itemSvg(hy)}</div><div class="meta"><b>${ITEMS[id].name}</b><small class="yields">Makes <b>1 ${ITEMS[id].name}</b> (${sellOf(id)}) <b>+ 1 ${ITEMS[hy].name}</b> (${sellOf(hy)})</small><small>${r.in ? `${r.n} ${ITEMS[inId].name}` : `${r.n} ${sd.name} seeds`} · ${fmtTime(r.s * 1000 * craftK())} <span class="oil-vs">${r.in ? `(the leaves sell for ${r.n * sellOf(inId)})` : `(seeds sell for ${r.n * sd.seedSell}, cost ${r.n * sd.seedPrice} new)`}</span> · you have ${have}</small></div><div class="acts"><button class="btn btn-gold sm" data-distill="${sp}" ${ok ? '' : 'disabled'}>Distill</button></div></div>`; }).join('');
  return `<div class="hero tea-hero">${FEATURE_ART.still}<p>Essential oils — and their hydrosols — from your seeds</p></div>
    <div class="sec-title">Stills · ${S.stills.filter(Boolean).length}/${S.stills.length}</div><div class="tslots">${slots}</div>
    <div class="sec-title">Recipes · seeds${Object.values(STILL.recipes).some((r) => r.in) ? ' (and eucalyptus leaves)' : ''}</div><div class="list">${rows}</div>
    <p class="muted" style="margin:10px 4px 0">Every distillation gives two products: the essential oil and its hydrosol, the scented water left in the still (Damask Rose gives Rose Water). Each oil is worth far more than selling its seeds — but those seeds won’t be planted. Stills keep running while the game is closed. Sell oils at the Farm Stand.</p>`;
}
function craftTincture(sp) { return inBag('home', () => craftTincture_(sp)); }
function craftTincture_(sp) {
  const r = TINCTURE.recipes[sp], base = tincBase(), k = S.tinc.findIndex((t) => !t);
  if (!S.tinctureBuilt || building.tincture || !r || k < 0 || !(S.inv[base] > 0) || S.inv['flower_' + sp] < r.n) return false;
  S.inv['flower_' + sp] -= r.n; S.inv[base]--; S.tinc[k] = { sp, base, start: now(), ms: r.s * 1000 * craftK() };
  syncTinc(); save(); hud(); renderPanel(); toast(`Steeping ${ITEMS[tinctureId(sp, base)].name} · ${fmtTime(r.s * 1000 * craftK())}`); return true;
}
function collectTincture(k) { return inBag('home', () => collectTincture_(k)); }
function collectTincture_(k) {
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
    return `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>${r.n} ${TINCTURE_NAMES[sp]} + 1 ${BASES[base].name} · ${fmtTime(r.s * 1000 * craftK())} · sells for ${r.sell[base]} · you have ${have}</small></div><div class="acts"><button class="btn btn-gold sm" data-craft="${sp}" ${ok ? '' : 'disabled'}>Steep</button></div></div>`; }).join('');
  return `<div class="hero tea-hero">${FEATURE_ART.tincture}<p>Tinctures &amp; dried herbs</p></div>
    <div class="sec-title">Base</div>${seg}
    ${has ? '' : `<p class="need-base">Needs Glycerin or Vinegar: buy at the Market${SUPPLY_CARDS.some((b) => S.unlocked[b]) ? '' : ' · find the Glycerin or Vinegar card in a Card Pack first'}</p>${S.marketBuilt ? '<div class="ts-actions" style="margin:0 0 8px"><button class="btn" data-act="open-market">Visit Supply Market</button></div>' : ''}`}
    <div class="sec-title">Flasks · ${S.tinc.filter(Boolean).length}/${S.tinc.length}</div><div class="tslots">${slots}</div>
    <div class="sec-title">Recipes</div><div class="list">${rows.trim() ? rows : '<p class="muted empty-hint" data-empty-hint>Open Card Packs to discover recipes.</p>'}</div>
    <p class="muted" style="margin:10px 4px 0">Glycerites (Glycerin) sell a little higher than Vinegar Tinctures. Flasks keep steeping while the game is closed. Sell tinctures at the Farm Stand.</p>`;
}
function itemSvg(id) { const it = ITEMS[id]; if (it?.antique) return findIcon(it.antique); if (it) return itemIcon(...it.icon); if (BASES[id]) return itemIcon('bottle', BASES[id].color); return itemIcon('water'); }
function renderPanel() { return inBag(null, () => renderPanel_()); }
function renderPanel_() {
  const body = $('#panel-body'), title = $('#panel-title'); const st = body.scrollTop;
  if (panel === 'bag') { title.innerHTML = curLoc() === 'orchard' ? 'Orchard Bag' : 'Home Bag'; body.innerHTML = bagHTML(); }
  if (panel === 'build') { title.innerHTML = curLoc() === 'orchard' ? 'Build · Orchard' : 'Build · Home'; body.innerHTML = buildHTML(); }
  if (panel === 'stand') { title.innerHTML = 'Farm Stand'; body.innerHTML = standHTML(); }
  if (panel === 'ostand') { title.innerHTML = 'Orchard Stand'; body.innerHTML = ostandHTML(); }
  if (panel === 'bulk') { title.innerHTML = 'Bulk Sell Box'; body.innerHTML = bulkHTML(panelArg); }
  if (panel === 'market') { title.innerHTML = curLoc() === 'orchard' ? 'Supply Market · Orchard' : 'Supply Market · Home'; body.innerHTML = marketHTML(); }
  if (panel === 'rack') { title.innerHTML = 'Drying Rack'; body.innerHTML = rackHTML(); }
  if (panel === 'tincture') { title.innerHTML = 'Tincture Stand'; body.innerHTML = tinctureHTML(); }
  if (panel === 'still') { title.innerHTML = 'Essential Oil Stand'; body.innerHTML = stillHTML(); }
  if (panel === 'teastand') { title.innerHTML = 'Tea Stand'; body.innerHTML = teaHTML(); }
  if (CRAFT[panel]) { title.innerHTML = CRAFT[panel].name; body.innerHTML = craftHTML(panel); }
  if (panel === 'orchardtree') { const t = S.orchard[panelArg]; title.innerHTML = t ? TREES[t.sp].name : 'Orchard'; body.innerHTML = orchardTreeHTML(panelArg); }
  if (panel === 'billboard') { title.innerHTML = 'Roadside Billboard'; body.innerHTML = billboardHTML(); }
  if (panel === 'lot') { title.innerHTML = LOTS[panelArg].name; body.innerHTML = lotHTML(panelArg); }
  if (panel === 'worker') { title.innerHTML = `${locLabel(workerLoc(panelArg)).replace(/^t/, 'T')} · ${wkName(panelArg)}`; body.innerHTML = workerHTML(panelArg); }
  if (panel === 'settings') { title.innerHTML = 'Settings'; body.innerHTML = settingsHTML(); }
  if (panel === 'jewels') { title.innerHTML = `Jewel Shop${Payments.isTest ? ' <span class="test-tag">Test mode</span>' : ''}`; body.innerHTML = jewelsHTML(); }
  const ck = CONS_PANEL[panel] || (CRAFT[panel] ? panel : null); if (ck && consLeft(ck) > 0) body.innerHTML = consHTML(ck);   // v0.63
  fillIcons(body); fillIcons(title); body.scrollTop = st;
}
// v0.6: drawn brand marks for the Follow us buttons (brand colours, same soft hand-drawn style as js/icons.js)
const SOCIAL_ART = {
  facebook: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#1877F2" stroke="#0E5BC4" stroke-width="2"/><path d="M26.6 39V26.6h4.2l.7-4.9h-4.9v-3.1c0-1.4.5-2.4 2.5-2.4h2.6v-4.4c-.5-.1-2-.2-3.8-.2-3.8 0-6.3 2.3-6.3 6.5v3.6h-4.2v4.9h4.2V39" fill="#fff"/></svg>`,
  instagram: `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="igg" cx="0.3" cy="1.05" r="1.25"><stop offset="0" stop-color="#FFD776"/><stop offset=".25" stop-color="#F9A24B"/><stop offset=".5" stop-color="#E9466F"/><stop offset=".78" stop-color="#C13584"/><stop offset="1" stop-color="#6A4BD6"/></radialGradient></defs><rect x="3" y="3" width="42" height="42" rx="12" fill="url(#igg)" stroke="#A8326E" stroke-width="1.5"/><rect x="11.5" y="11.5" width="25" height="25" rx="7.5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="31.6" cy="16.4" r="1.9" fill="#fff"/></svg>`,
  x: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="12" fill="#14171A" stroke="#000" stroke-width="1.5"/><path d="M13 13h7.2l5.4 7.3L32 13h3.2l-8.1 9.3L35.5 35h-7.2l-5.8-7.8L15.6 35h-3.2l8.6-9.8z" fill="#fff"/><path d="M17.3 15.2h2l11.5 17.6h-2z" fill="#14171A"/></svg>`,
};
function claimFollow(id) {
  const p = SOCIALS.find((q) => q.id === id); if (!p) return false;
  S.follows = S.follows || {};
  if (S.follows[id]) { toast(`Thanks again for following on ${p.name}!`); return false; }
  S.follows[id] = Date.now(); S.jewels += FOLLOW_REWARD; save(); hud();
  toast(`<i data-icon="jewel"></i> +${FOLLOW_REWARD} Jewel, thanks for following!`); buzz([15, 30, 15]);
  if (panel === 'settings') renderPanel();
  return true;
}
// v0.7 — Sound settings: separate Music / Sound Effects volume + mute, saved in S.audio.
function soundSetHTML() {
  const A = S.audio, row = (k, name) => {
    const v = Math.round((A[k] || 0) * 100), m = !!A[k + 'Mute'];
    return `<div class="row vol-row${m ? ' muted' : ''}" data-vol-row="${k}"><b>${name} · <span data-vol-pct="${k}">${m ? 'Muted' : v + '%'}</span></b><input class="vol" type="range" min="0" max="100" step="5" value="${v}" data-vol="${k}" aria-label="${name} volume"><button class="btn mute-btn${m ? ' on' : ''}" data-act="mute-${k}">${m ? 'Unmute' : 'Mute'}</button></div>`;
  };
  return `<div class="sec-title" id="sound-settings">Sound</div><div class="list sound-set">${row('music', 'Music')}${row('sfx', 'Sound Effects')}</div><p class="muted music-credits" style="margin:6px 4px 0;font-size:12px">${MUSIC_CREDITS}</p>`;
}
function setVolume(k, v, commit) {
  if (k !== 'music' && k !== 'sfx') return;
  S.audio[k] = Math.max(0, Math.min(1, (+v || 0) / 100));
  if (commit && S.audio[k] > 0) S.audio[k + 'Mute'] = false;
  Sound?.apply();
  document.querySelectorAll(`[data-vol-pct="${k}"]`).forEach(e => { e.textContent = S.audio[k + 'Mute'] ? 'Muted' : Math.round(S.audio[k] * 100) + '%'; });
  if (commit) { save(); if (k === 'sfx') sfx('coin'); if (panel === 'settings') renderPanel(); }
}
function toggleMute(k) {
  S.audio[k + 'Mute'] = !S.audio[k + 'Mute'];
  Sound?.apply(); save();
  if (panel === 'settings') renderPanel();
}
document.addEventListener('input', e => { const t = e.target; if (t?.matches?.('input[data-vol]')) setVolume(t.dataset.vol, t.value, false); });
document.addEventListener('change', e => { const t = e.target; if (t?.matches?.('input[data-vol]')) setVolume(t.dataset.vol, t.value, true); });
function settingsHTML() {
  const games = OTHER_GAMES.filter((g) => g.id !== CROSS_PROMO.gameId).map((g) => `<div class="game-row" data-game="${g.id}"><div class="game-art">${gameArt(g.id)}</div>
    <div class="meta"><b>${g.name}${g.status === 'soon' ? ' <span class="soon-tag">Coming soon</span>' : ''}</b><small class="gr-tag">${g.tagline}</small><small>${g.blurb}</small></div>
    ${g.status === 'live' && g.url ? `<a class="btn btn-primary sm" href="${g.url}" target="_blank" rel="noopener">Play</a>` : ''}</div>`).join('');
  const adsRow = ADS_MODE === 'off' ? '' : S.noAds
    ? `<div class="row"><div class="ico"><i data-icon="heart" style="width:34px;height:34px"></i></div><div class="meta"><b>No More Ads · Owned</b><small>Thank you! Banners and partner ads are switched off.</small></div></div>`
    : `<div class="row"><div class="ico"><i data-icon="jewel" style="width:34px;height:34px"></i></div><div class="meta"><b>No More Ads + ${NO_ADS_BUNDLE.n} Jewels</b><small>Removes the banner and partner ads · ${NO_ADS_BUNDLE.price}</small></div><div class="acts"><button class="btn btn-blush sm" data-act="open-jewels">View</button></div></div>`;
  const follow = SOCIALS.map((p) => { const got = !!S.follows?.[p.id];
    return `<a class="follow-btn ${p.id}${got ? ' claimed' : ''}" href="${p.url}" target="_blank" rel="noopener" data-follow="${p.id}" aria-label="Follow Petalspire on ${p.name}">
      <span class="fb-ico">${SOCIAL_ART[p.id]}</span><span class="fb-txt"><b>${p.name}</b><small>${p.handle}</small></span>
      <em>${got ? '✓ Claimed' : `+${FOLLOW_REWARD} <i data-icon="jewel"></i>`}</em></a>`; }).join('');
  const nGot = SOCIALS.filter((p) => S.follows?.[p.id]).length;
  return soundSetHTML() + `<div class="sec-title" id="follow-us">Follow us</div><p class="muted follow-note">${nGot < SOCIALS.length ? `Follow Petalspire for news and sneak peeks — get ${FOLLOW_REWARD} free Jewel for each one (once per platform).` : 'Thanks for following Petalspire everywhere!'}</p><div class="follow-list">${follow}</div>
    <div class="sec-title" id="play-other-games">More from ${STUDIO.name}</div>${studioHeadHTML()}<div class="list games">${promoCardHTML()}${games}</div>
    ${adsRow ? `<div class="sec-title">Ads</div><div class="list">${adsRow}</div>` : ''}
    <div class="sec-title">Help</div><div class="list"><button class="row set-btn" data-act="tips-again"><b>Show tips again</b><small>Replay the helpful hints from the start</small></button></div>
    <div class="sec-title">Your save</div><div class="list"><div class="row"><div class="meta"><b>Autosaves on this device</b><small>Progress is kept in this browser, even while the game is closed.</small></div></div>
    <button class="row set-btn danger" data-act="reset"><b>Reset garden…</b><small>Erase all progress and start again in the woods</small></button></div>
    <div class="studio-credit-set" data-studio-credit><img src="${STUDIO.logo}" alt="${STUDIO.name}" /><small>Petalspire is made by ${STUDIO.name}</small></div>
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
  const rows = ids.map((id) => { const c = { ...S.cards[id], lv: cardLv(id), n: +S.cards[id].n || 1 }, up = CARD_LEVELS.upgradable(id, CARDS[id]), nx = nextAt(id), maxLv = T.length + 1;
    const fx = CARDS[id].tier ? (c.lv > 1 ? `+${Math.round(L.sell * (c.lv - 1) * 100)}% sell · −${Math.round(L.grow * (c.lv - 1) * 100)}% grow time${c.lv >= L.bonusFlowerAt ? ' · +1 flower' : ''}` : 'Level up for better prices and faster growth')
      : id === 'sickle' || id === 'plow' ? 'Ready again right away · no rest' : CHARMS[id] ? `${charmText(id, c.lv)}${S.owned[id] ? '' : ' · buy it in the Supply Market'}` : id === 'windmill' ? `Barrels refill every ${WINDMILL.regenS[Math.min(4, c.lv) - 1]} s (base ${WATER_REGEN_S})` : id === 'parking' ? parkLevelText(c.lv) : id === 'irrigation' ? `Lv${c.lv} · ${bedWaterLine(c.lv)}${c.lv < 4 ? ` (Lv${c.lv + 1}: ${WATER.stage[c.lv]})` : ''}` : 'Copies stack here';
    const prog = up ? (nx != null ? `<div class="lv-prog"><b style="width:${Math.min(100, (c.n / nx) * 100)}%"></b></div><small>${c.n}/${nx} copies to Lv${c.lv + 1}</small>` : `<small class="lv-max" data-lv-max>Max level · Lv${maxLv}</small>`) : FEATURES[id]?.tool ? `<small class="lv-none" data-no-level data-just-stack>Copies just stack · this tool doesn't level up</small>` : `<small class="lv-none" data-no-level>This card doesn't level up</small>`;
    return `<div class="stack-row${canUpgrade(id) ? ' glow' : ''}">${cardHTML(id)}<div class="meta"><b>${CARDS[id].name}${up ? ` · Lv${c.lv}` : ''}</b><small>×${c.n} collected · ${fx}</small>${prog}
      ${canUpgrade(id) ? `<button class="btn btn-gold sm" data-upgrade="${id}">✨ Upgrade to Lv${c.lv + 1}</button>` : ''}</div></div>`; }).join('');
  return `<p class="muted" style="margin:8px 2px">Duplicate cards stack. At ${T.join(' / ')} copies a plant (or Windmill, Parking Lot, Irrigation or garden charm) card can be upgraded — copies are kept, never spent. Seeds per harvest always follow the plant’s tier.</p><div class="stacks">${rows || '<p class="muted">Open a Card Pack to start your collection.</p>'}</div>`;
}
// v0.52: owned-but-unbuilt buildings (older saves bought them before buy-and-place) get a Place button in the Bag
const UNBUILT = [['tincture', 'tinctureBuilt'], ['still', 'stillBuilt'], ['windmill', 'windmillBuilt'], ['parking', 'parkingBuilt'], ['billboard', 'billboardBuilt'], ['teastand', 'teaBuilt'], ['press', 'pressBuilt'], ['fruitstand', 'fruitstandBuilt']];
const STAND_IDS = new Set(['tincture', 'still', 'teastand', 'press', 'fruitstand']);
const unbuiltHTML = () => UNBUILT.filter(([id, k]) => S.owned[id] && !S[k] && !building[id]).map(([id]) => `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="build-${id}" data-place-owned="${id}"><i data-icon="build"></i> Place your ${FEATURES[id].name}</button>${standOkAt(id, curLoc()) || !STAND_IDS.has(id) ? '' : `<span class="loc-tag" style="margin-left:6px">${whereTag(id)}</span>`}${id === 'tincture' && !tincLots().length ? '<small class="opt-note" style="display:block;margin-top:4px">Buy a neighbouring plot first — the Tincture Stand goes on one of your other plots</small>' : ''}</div>`).join('');
// v0.61: the shared Bag holds everything; goods that can't be sold where you are get a gentle tag
const locTagCell = (id) => (sellsAt(id, curLoc()) ? '' : `<em class="loc-tag sm" data-loctag="${id}">${sellTag(id)}</em>`);
let sendOpen = false;
document.addEventListener('toggle', (e) => { if (e.target?.matches?.('[data-send-box]')) sendOpen = e.target.open; }, true);
// v0.65: sort ready-made list rows (HTML strings) by value, highest first, within each section. Rows without a price
// (locked / owned / info rows) keep their order at the end of their section; titles and notes split sections.
const rowVal = (h) => { const m = /data-price="(\d+)"/.exec(h); return m ? +m[1] : -1; };
const rowTier = (h) => { const m = /tier-tag t-([a-z_]+)/.exec(h); return m ? TIER_ORDER.indexOf(m[1]) : -1; };
const rowName = (h) => (/<b>([^<]*)/.exec(h)?.[1] || '');
function sortRows(rows) {
  const out = []; let seg = [];
  const flush = () => { const pr = seg.filter((h) => rowVal(h) >= 0).sort((a, b) => rowVal(b) - rowVal(a) || rowTier(b) - rowTier(a) || rowName(a).localeCompare(rowName(b))); out.push(...pr, ...seg.filter((h) => rowVal(h) < 0)); seg = []; };
  for (const h of rows) { if (!h) continue; if (!/^\s*<div class="row/.test(h)) { flush(); out.push(h); } else seg.push(h); }
  flush(); return out;
}
const coinEq = (c) => (c?.coins || 0) + (c?.wood || 0) * SHOP.wood5.price / SHOP.wood5.wood + (c?.scrap || 0) * SHOP.scrap5.price / SHOP.scrap5.scrap;
// v0.65: every item list runs from the highest value to the lowest (sell value; buy price for things you only buy), within its
// own section; ties → higher tier first, then name. Game logic (customers, overflow) keeps SELL_ORDER.
const TIER_RANK = (id) => { const sp = spOfItem(id) || (id.startsWith('seed_') ? id.slice(5) : null), d = sp && (SPECIES[sp] || TREES[sp]); return d ? TIER_ORDER.indexOf(d.tier) : -1; };
const itemVal = (id) => (ITEMS[id] ? sellOf(id) : BASES[id] ? BASES[id].price : id === 'sapling' ? SHOP.sapling.price : 0);
const itemNm = (id) => ITEMS[id]?.name || BASES[id]?.name || id;
const byValue = (ids, val = itemVal) => [...ids].sort((a, b) => val(b) - val(a) || TIER_RANK(b) - TIER_RANK(a) || itemNm(a).localeCompare(itemNm(b)));
function satchelHTML() {
  const ids = ['seed_', 'flower_', 'dried_'].flatMap((p) => Object.keys(SPECIES).map((sp) => p + sp)).filter((id) => ITEMS[id]);   // v0.5: every plant
  const res = (icon, name, n) => `<div class="inv"><i data-icon="${icon}" style="width:38px;height:38px"></i><b>${name}</b><small>×${n}</small></div>`;
  const cells = res('wood', 'Wood', S.wood) + res('scrap', 'Scrap Metal', S.scrap || 0) + (S.inv.sapling ? res('sapling', 'Tree sapling', S.inv.sapling) : '') +
    byValue(ids.filter((id) => S.inv[id] > 0)).map((id) => `<div class="inv">${itemSvg(id)}<b>${ITEMS[id].name}</b><small>×${S.inv[id]}</small>${locTagCell(id)}</div>`).join('') +
    // v0.65: rain barrels are installed fixtures — never in the Bag (tap one in the garden to see its water and upgrade it with coins)
    byValue(['glycerin', 'vinegar'].filter((id) => S.inv[id] > 0 || (S.tinctureBuilt && S.inv === bagOf('home')))).map((id) => `<div class="inv">${itemSvg(id)}<b>${BASES[id].name}</b><small>×${S.inv[id]}</small></div>`).join('') +
    byValue(SELL_ORDER.filter((id) => ['tinc_', 'oil_', 'hydro_', 'tea_', 'press_', 'jar_', 'fruit_', 'bag'].some((p) => id.startsWith(p)) && S.inv[id] > 0)).map((id) => `<div class="inv">${itemSvg(id)}<b>${ITEMS[id].name}</b><small>×${S.inv[id]}</small>${locTagCell(id)}</div>`).join('');
  // v0.65: garden features show in the bag only while they are NOT on the map (placed/built ones leave it; picked up → back in)
  // v0.66.1: the Bag lists ONLY garden features bought at the Market and not placed yet (tools live on the tool dock,
  // Irrigation on its barrels, built stands on the map). Unbuilt bought buildings keep their Place button below.
  const feats = GF_IDS.filter((k) => S.gfInv?.[k] > 0 && S.gfBought?.[k]).sort((a, b) => (FEATURES[b].price || 0) - (FEATURES[a].price || 0) || FEATURES[a].name.localeCompare(FEATURES[b].name)).map(gfBagRow).join('');
  const here = curLoc(), sendable = S.lots.orchard ? [...ids, ...(here === 'home' ? ['sapling'] : []),   /* v0.65: saplings never go Home */ ...(here === 'home' ? [] : ['glycerin', 'vinegar']) /* v0.7: Tincture bases are Home-only (never sent to the Orchard) */, ...SELL_ORDER.filter((id) => !ids.includes(id))].filter((id, k, a) => a.indexOf(id) === k && S.inv[id] > 0) : [];
  const sendRows = byValue(sendable).map((id) => `<div class="row send-row" data-send-row="${id}"><div class="ico">${id === 'sapling' ? '<i data-icon="sapling" style="width:34px;height:34px"></i>' : itemSvg(id)}</div><div class="meta"><b>${id === 'sapling' ? 'Tree sapling' : ITEMS[id]?.name || BASES[id]?.name} ×${S.inv[id]}</b>${ITEMS[id] && !sellsAt(id, here) ? `<small><span class="loc-tag sm">${sellTag(id)}</span></small>` : ''}</div><div class="acts">${sendBtns(id)}</div></div>`).join('');
  return `<div class="bag-loc" data-bag-loc="${here}"><i data-icon="${here === 'orchard' ? 'sapling' : 'stand'}"></i><span><b>${here === 'orchard' ? 'Orchard Bag' : 'Home Bag'}</b><small>Goods here stay ${here === 'orchard' ? 'at the Orchard' : 'at Home'} · Coins, Wood, Scrap, Jewels and cards are shared</small></span></div>
    <div class="inv-grid">${cells || ''}</div>${bagStrip()}
    ${sendRows ? `<details class="send-box" data-send-box${sendOpen ? ' open' : ''}><summary>${vanOn() ? '🚚' : '📦'} Send to ${here === 'orchard' ? 'Home' : 'the Orchard'} · ${vanOn() ? 'by delivery van, ' : 'arrives at once, '}free</summary><div class="list send-list">${sendRows}</div></details>` : ''}
    ${S.hiveInv > 0 ? `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="place-hive">🐝 Place your Honeybee Skep (${S.hiveInv})</button></div>` : ''}
    ${unbuiltHTML()}
    ${feats ? `<div class="sec-title">Garden features</div><div class="list">${feats}</div>` : ''}
    ${S.gf?.length ? `<p class="muted" data-gf-onmap style="margin:8px 4px 0">${S.gf.length} garden feature${S.gf.length > 1 ? 's' : ''} on the map — tap one there to put it back in your bag.</p>` : ''}
    <p class="muted" style="margin:14px 4px 0">${here === 'orchard' ? 'Plant fruit-tree saplings from the Market, pick the ripe fruit, and sell it at the Orchard Stand or cook it at the Fruit Stand.' : 'Chop trees for Wood, build raised beds, and sell your harvest at the Farm Stand by the road.'}</p>`;   // v0.68: the Orchard Bag had the Home hint
}
function findsHTML() {
  const atm = atmosphere();
  const head = `<div class="finds-head"><span class="chip"><i data-icon="heart"></i>Atmosphere <b>${atm}</b></span><span class="chip"><i data-icon="scrap"></i>Scrap <b>${S.scrap}</b></span><span class="chip"><i data-icon="wood"></i><b>${S.wood}</b></span></div>
    ${atm ? `<p class="muted" style="margin:0 4px 8px">Customers arrive ${Math.round((1 - atmosMult()) * 100)}% sooner thanks to your decor.</p>` : ''}`;
  const restoring = S.restoring.map((r) => { const f = FINDS[r.kind], k = Math.min(1, (now() - r.start) / r.ms);
    return `<div class="find-row working"><div class="ico">${findIcon(r.kind)}</div><div class="meta"><b>${f.into.name}</b><small>Restoring · <span data-rleft="${r.id}">${fmtTime(r.ms * (1 - k))}</span> left</small>
      <div class="progress slim"><b data-rprog="${r.id}" style="width:${(k * 100).toFixed(1)}%"></b></div></div>
      <div class="acts"><button class="btn btn-blush sm" data-hurry="${r.id}">Finish · ${jewelTag(RESTORE_HURRY_JEWELS)}</button></div></div>`; }).join('');
  const raw = FIND_IDS.filter((k) => S.finds[k] > 0).sort((a, b) => RESALE.antique[b] - RESALE.antique[a] || FINDS[a].name.localeCompare(FINDS[b].name)).map((k) => { const f = FINDS[k]; const ok = canPay(f.restore);
    return `<div class="find-row"><div class="ico">${findIcon(k)}</div><div class="meta"><b>${f.name}${S.finds[k] > 1 ? ` ×${S.finds[k]}` : ''}</b>
      <small>Restore → <b>${f.into.name}</b> · ${f.into.bonus ? f.into.blurb : `decor, +${f.into.atm} atmosphere`}</small></div>
      <div class="find-acts"><button class="btn btn-primary sm" data-restore="${k}" ${ok ? '' : 'disabled'}>Restore ${costHTML(f.restore)} · ${fmtTime(f.restore.s * 1000)}</button>
      <button class="btn sm" data-recycle="${k}"><i data-icon="recycle"></i> Recycle ${gainHTML(f.recycle)}</button></div></div>`; }).join('');
  const decor = Object.entries(S.decorInv).filter(([, n]) => n > 0).map(([t, n]) => `<div class="find-row"><div class="ico">${decorIcon(t)}</div><div class="meta"><b>${DECOR_INFO[t].name}${n > 1 ? ` ×${n}` : ''}</b><small>Restored decor · +${DECOR_INFO[t].atm} atmosphere when placed</small></div><div class="acts"><button class="btn btn-gold sm" data-place="${t}">Place</button><button class="btn sm" data-sell-restored="${kindOfDecor(t)}">Sell ${coin(buyback(RESALE.antique[kindOfDecor(t)]))}</button></div></div>`).join('');
  // v0.63: only a Crate Shelf still in the Bag is listed; the installed one is part of the Farm Stand for good
  const shelfRow = (f) => { const k = kindOfBonus('crate'), has = !!S.shelfOn;
    return `<div class="row shelf-row" data-shelf-row><div class="ico">${findIcon(k)}</div><div class="meta"><b>${f.into.name}</b><small>${has ? `Spare · your Farm Stand already has a Crate Shelf (permanent) · sell it or stock it as an antique` : S.standBuilt ? `In your Bag · install it on your Farm Stand for +${SHELF_BONUS} shelf space (permanent)` : `In your Bag · build the Farm Stand to install it (+${SHELF_BONUS} shelf space)`}</small></div><div class="acts">${has ? '' : `<button class="btn btn-gold sm" data-install-shelf ${S.standBuilt ? '' : 'disabled'}>Install</button>`}<button class="btn sm" data-sell-restored="${k}">Sell ${coin(buyback(RESALE.antique[k]))}</button></div></div>`; };
  const bon = Object.values(FINDS).filter((f) => f.into.bonus && S.bonus[f.into.bonus]).map((f) => f.into.bonus === 'crate' ? shelfRow(f) : `<div class="row"><div class="ico">${findIcon(Object.keys(FINDS).find((k) => FINDS[k] === f))}</div><div class="meta"><b>${f.into.name}</b><small>${f.into.blurb} · <span class="ok-tag">Active</span></small></div><div class="acts"><button class="btn sm" data-sell-restored="${kindOfBonus(f.into.bonus)}">Sell ${coin(buyback(RESALE.antique[kindOfBonus(f.into.bonus)]))}</button></div></div>`).join('');
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
  const sc = BUILDS.windmill.scrap || 0;   // v0.52: the Windmill also needs Scrap Metal
  if (S.windmillBuilt || building.windmill || !S.owned.windmill || S.wood < c || S.scrap < sc) return false;
  S.windmillPos = { x, z, lot: lotAt(x, z) }; SPOTS.windmill = [x, z]; W.windmill.position.set(x, 0, z);
  S.wood -= c; S.scrap -= sc; S.windmillBuilt = true; building.windmill = true; save(); hud(); glideTo('windmill');
  setTimeout(() => W.buildAnim(W.windmill, [1.6, 3.4, 1.6], () => {
    building.windmill = false;   // barrels keep their progress; the next drop just arrives at the faster rate
    popAt(spotV('windmill', 3.6), `Windmill built! Barrels refill every ${regenS()} s`); tip('windmill'); hud(); checkGoals(); syncBarrels(); if (selected != null || focus) renderSheet();
  }), 500);
  return true;
}
// v0.68.1: Parking Lot + Billboard can be built at Home AND at the Orchard. The Parking Lot card (and its level) is shared.
const TRAF = { parking: { base: 'parking', loc: 'home', key: 'parkingBuilt', spot: 'stand' }, billboard: { base: 'billboard', loc: 'home', key: 'billboardBuilt', spot: 'billboard' },
  oparking: { base: 'parking', loc: 'orchard', key: 'oparkingBuilt', spot: 'orchardshed' }, obillboard: { base: 'billboard', loc: 'orchard', key: 'obillboardBuilt', spot: 'obillboard' } };
const trafObj = (id) => W[id];
const trafGate = (id) => (id === 'parking' && !S.standBuilt ? 'Build the Farm Stand first — the Parking Lot goes beside it' : id === 'oparking' && !S.oshedBuilt ? 'Build the Orchard Stand first — the Parking Lot goes beside it' : '');
const trafId = (base, loc = curLoc()) => (loc === 'orchard' ? 'o' + base : base);
function syncParking() { if (S.parkingBuilt && !building.parking) W.setParking(parkCap()); if (S.oparkingBuilt && !building.oparking) W.setOParking(oparkCap(), true); }
function buildTraffic(id) {
  const T = TRAF[id]; if (!T) return false; const c = BUILDS[T.base].wood, key = T.key, nm = BUILDS[T.base].name, isP = T.base === 'parking';
  if (S[key] || building[id] || !S.owned[id]) return false;
  { const g = trafGate(id); if (g) { toast(g); return false; } }
  if (S.wood < c) { toast(`The ${nm} needs ${c} Wood`); return false; }
  S.wood -= c; S[key] = true; building[id] = true; save(); closePanel(); syncBlueprints(); hud();
  const obj = trafObj(id); if (id === 'parking') W.setParking(parkCap()); if (id === 'oparking') W.setOParking(oparkCap(), true);
  glideTo(T.spot);
  setTimeout(() => W.buildAnim(obj, isP ? [7.8, 1.0, 1.6] : [3.6, 4.2, 0.9], () => {
    building[id] = false; popAt(isP ? V3(obj.position.x, 1.4, obj.position.z) : spotV(T.spot, 4.6), `${nm} built!`); tip(T.base); hud(); checkGoals();
    if (id === 'parking') nextCust = Math.min(nextCust, now() + 3000);
    if (id === 'oparking') nextOCust = Math.min(nextOCust, now() + 3000);
    if (!isP) syncBillboard();
  }), 500);
  return true;
}
function bbStatusText() { return bbActive() ? `Ad running · ${fmtTime(S.bb.until - now())}` : bbReadyIn() > 0 ? `Cooling off · ${fmtTime(bbReadyIn())}` : 'Tap to Run ad'; }   // v0.65: 1-hour cool-off after each run
// v0.52: the billboard's "top seller" panel — most units sold at the stand (S.stats.soldBy), else what's on the stand now
function topSeller() {
  const by = S.stats.soldBy || {}, ids = Object.keys(by).filter((id) => ITEMS[id] && by[id] > 0);
  const id = ids.sort((a, b) => by[b] - by[a])[0] || SELL_ORDER.find((k) => S.stand[k] > 0 && ITEMS[k]);
  return id ? { id, name: ITEMS[id].name, color: ITEMS[id].icon?.[1] || '#B79AD6', sold: by[id] || 0 } : null;
}
function syncBillboard() {
  if (!bbBuilt() || (building.billboard && !S.obillboardBuilt) || (building.obillboard && !S.billboardBuilt)) return;
  const txt = bbStatusText(), left = Math.max(0, Math.ceil(((S.bb?.until || 0) - now()) / 1000));
  W.setBillboard(bbActive(), txt, { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, top: topSeller() });
  if (panel === 'billboard') { const n = $('#bb-status'); if (n && n.dataset.mode === (bbActive() ? 'on' : bbReadyIn() > 0 ? 'wait' : 'ready') && n.dataset.j === String(S.jewels)) { n.textContent = txt; const cd = $('#bb-cd'); if (cd) cd.textContent = fmtTime(bbReadyIn()); } else renderPanel(); }
}
function runAd(withJewel = false) {
  if (!bbBuilt() || bbActive()) return false;
  const wait = bbReadyIn();
  if (wait > 0 && !withJewel) return false;
  if (withJewel) { if (S.jewels < BILLBOARD.jewels) { toast('You need 1 Jewel'); return false; } S.jewels -= BILLBOARD.jewels; S.bb.jewelRuns = (S.bb.jewelRuns || 0) + 1; }
  const t = now(); S.bb.until = t + BILLBOARD.boostMs; S.bb.readyAt = S.bb.until + BILLBOARD.cooldownMs;   // v0.65: the 1-hour cool-off starts when the ad ends (wall clock, saved) S.bb.runs = (S.bb.runs || 0) + 1;
  if (S.billboardBuilt) { nextCust = Math.min(nextCust, t + 4000); nextPass = Math.min(nextPass, t + 2500); }
  if (S.obillboardBuilt) { nextOCust = Math.min(nextOCust, t + 4000); nextOPass = Math.min(nextOPass, t + 2500); }
  save(); hud(); syncBillboard(); if (panel === 'billboard') renderPanel();
  popAt(spotV(curLoc() === 'orchard' && S.obillboardBuilt ? 'obillboard' : S.billboardBuilt ? 'billboard' : 'obillboard', 4.8), `Ad running! ${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min`);
  return true;
}
function askRunAdJewel() {
  if (bbActive() || !bbReadyIn()) return runAd(false);
  if (S.jewels < BILLBOARD.jewels) { toast('You need 1 Jewel'); return false; }
  confirmBox(`<i data-icon="jewel" class="confirm-ico"></i><h3>Run another ad?</h3><p>Spend <b>${BILLBOARD.jewels} Jewel</b> to skip the ${fmtTime(bbReadyIn())} cool-off and run another ad now (${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min). You have ${S.jewels}.</p>`, `Run another ad · ${BILLBOARD.jewels} <i data-icon="jewel"></i>`, () => runAd(true));
  return true;
}
function billboardHTML() {
  const on = bbActive(), wait = bbReadyIn(), mode = on ? 'on' : wait > 0 ? 'wait' : 'ready';
  const btn = on ? `<button class="btn" disabled>Ad running…</button><small class="opt-note">A 1-hour cool-off starts when this ad ends.</small>`
    : wait > 0 ? `<button class="btn btn-gold" data-act="bb-jewel" ${S.jewels >= BILLBOARD.jewels ? '' : 'disabled'}>Run another ad · ${BILLBOARD.jewels} <i data-icon="jewel"></i></button><small class="opt-note">The Billboard is cooling off · the next free ad in <span id="bb-cd">${fmtTime(wait)}</span>. ${S.jewels >= BILLBOARD.jewels ? `You have ${S.jewels} Jewel${S.jewels === 1 ? '' : 's'}.` : 'You have no Jewels.'}</small>`
    : `<button class="btn btn-gold" data-act="bb-run">Run ad · free</button>`;
  return `<div class="row" style="align-items:center"><div class="ico" style="width:64px;height:64px">${FEATURE_ART.billboard}</div><div class="meta"><b>Roadside Billboard</b><small>${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} minutes: customers stop twice as often and twice as many cars pass. Free, then a 1-hour cool-off after each ad (it keeps counting while the game is closed).</small></div></div>
    <div class="stand-status"><i data-icon="${on ? 'sun' : 'stand'}"></i><span id="bb-status" data-mode="${mode}" data-j="${S.jewels}">${bbStatusText()}</span></div>
    <div class="ts-actions" style="flex-direction:column;align-items:stretch;gap:6px">${btn}</div>
    <small class="muted">Ads run so far: ${S.bb.runs || 0}${S.bb.jewelRuns ? ` (${S.bb.jewelRuns} with a Jewel)` : ''}</small>`;
}
// v0.52: an unlocked building you don't own yet is bought and placed in one go from here too (paid when the spot is confirmed).
function buyBuildCard(id, art, nm, sub, lock) {
  if (lock) return '';   // v0.7.2.2: not shown until it can be bought here (was a greyed card with a lock)
  const c = buyCost(id), have = [`${S.coins} coins`, c.wood && `${S.wood} Wood`, c.scrap && `${S.scrap} Scrap`].filter(Boolean).join(', ');
  return card(art, nm, sub, `<div class="cost">${coin(c.coins)} ${c.wood ? woodTag(c.wood) : ''} ${c.scrap ? scrapTag(c.scrap) : ''} <span class="${canPay(c) ? 'ok' : 'no'}">you have ${have}</span></div>
    <button class="btn btn-gold" data-buy="${id}" data-price="${c.coins}" ${canPay(c) ? '' : 'disabled'}><i data-icon="build"></i> ${TRAF[id] ? 'Buy &amp; build' : 'Buy &amp; place'}</button>`);
}
// v0.61: coin unlock ladder for crafting stands — only the next one is ever offered, and only where it can be built
const COIN_STANDS = new Set(STAND_UNLOCK.map((u) => u.id));
const standGot = (id) => (id === 'tincture' ? !!S.owned.tincture : !!S.unlocked[id]);
const nextCoinStand = () => STAND_UNLOCK.find((u) => !standGot(u.id)) || null;
const coinStandHere = (id) => { const u = nextCoinStand(); return u && u.id === id && standOkAt(id, curLoc()) ? u : null; };
const fmtC = (n) => n.toLocaleString('en-US');
// v0.62: the card is the main route (Card Pack), coins are the fallback behind "Can't find the card?"
const tincGoal = () => GOALS.find((g) => g.reward === 'tincture').text.split(' · ')[0];
const cuTitle = (id) => (id === 'tincture' ? `Earn the ${FEATURES[id].name} free` : `Find the ${FEATURES[id].name} card in packs`);
const cuSub = (id) => (id === 'tincture' ? `A free reward for the goal “${tincGoal()}”` : `Open a Card Pack to find it — that unlocks it for free`) + ` · ${whereTag(id)}`;
const cuAskLabel = (id) => (id === 'tincture' ? 'Rather not wait?' : 'Can’t find the card?');
const cuPack = () => `<div class="cu-pack"><img src="assets/pack.jpg" alt=""/><span><b>${PACKS.standard.name}</b><small>${PACKS.standard.cards} cards · ${PACK_JEWELS} <i data-icon="jewel"></i></small></span></div>`;
function coinUnlockCard(id) { const u = coinStandHere(id); if (!u) return '';
  return `<div class="build-card coin-unlock" data-coin-unlock-card="${id}"><div class="bc-art">${FEATURE_ART[id]}</div><div class="meta"><b>${cuTitle(id)}</b><small>${cuSub(id)}.</small>
    ${id === 'tincture' ? '' : cuPack()}
    ${id === 'tincture' ? '' : `<button class="btn btn-gold" data-act="go-packs" data-cu-packs="${id}"><i data-icon="jewel"></i> Open Card Packs</button>`}
    <button class="cu-ask" data-act="coin-unlock-ask" data-id="${id}">${cuAskLabel(id)}</button></div></div>`; }
function coinUnlockRow(id) { const u = coinStandHere(id); if (!u) return '';
  return `<div class="row coin-unlock" data-coin-unlock-row="${id}"><div class="ico">${FEATURE_ART[id]}</div><div class="meta"><b>${cuTitle(id)}</b><small>${cuSub(id)}</small>${mktTag(id)}
    <div class="cu-acts">${id === 'tincture' ? '' : `<button class="btn btn-gold sm" data-act="go-packs" data-cu-packs="${id}"><i data-icon="jewel"></i> Card Packs</button>`}<button class="cu-ask" data-act="coin-unlock-ask" data-id="${id}">${cuAskLabel(id)}</button></div></div></div>`; }
// the small "Can't find the card?" panel: unlock price, your coins, Unlock (disabled + hint when short)
function coinUnlockAsk(id) {
  const u = nextCoinStand(); if (!u || u.id !== id || !standOkAt(id, curLoc())) return false;
  const ok = S.coins >= u.coins, short = u.coins - S.coins, C = $('#confirm');
  const bc = id === 'tincture' ? null : buyCost(id);
  C.innerHTML = `<div class="confirm-card cu-panel" data-cu-panel="${id}"><div class="cu-art">${FEATURE_ART[id]}</div>
    <h3>Unlock with coins</h3><p class="muted">${id === 'tincture' ? `Skip the goal and unlock the ${FEATURES[id].name} now.` : `No ${FEATURES[id].name} card yet? Unlock it now instead.`}</p>
    <div class="cu-lines"><div><span>Unlock price</span><b data-cu-price>${coin(fmtC(u.coins))}</b></div><div><span>Your coins</span><b data-cu-have class="${ok ? 'ok' : 'no'}">${coin(fmtC(S.coins))}</b></div></div>
    <p class="cu-note">${id === 'tincture' ? 'Placing it stays free.' : `Then build it as usual: ${coin(fmtC(bc.coins))}${bc.wood ? ' ' + woodTag(bc.wood) : ''} when you place it.`}</p>
    ${ok ? '' : `<p class="cu-hint" data-cu-hint>You need ${coin(fmtC(short))} more — sell at your stands, or keep an eye out for the card in packs.</p>`}
    <div class="confirm-acts"><button class="btn" data-c="no">Not now</button><button class="btn btn-gold" data-c="ok" data-cu-unlock="${id}" ${ok ? '' : 'disabled'}><i data-icon="coin"></i> Unlock · ${fmtC(u.coins)}</button></div></div>`;
  fillIcons(C); C.classList.remove('hidden');
  C.onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b && e.target !== C) return; if (b?.disabled) return; C.classList.add('hidden'); C.innerHTML = ''; if (b?.dataset.c === 'ok') coinUnlock(id); };
  return true;
}
function coinUnlock(id) {
  const u = nextCoinStand(); if (!u || u.id !== id || S.coins < u.coins) return false;
  S.coins -= u.coins; S.stats.coinUnlocks = (S.stats.coinUnlocks || 0) + 1;
  if (id === 'tincture') grantTincture(true); else { S.unlocked[id] = S.discovered[id] = true; if (!S.cards[id]) addCard(id); }
  save(); hud(); syncBlueprints(); if (panel) renderPanel();
  toast(id === 'tincture' ? 'Tincture Stand unlocked — place it free from the Build menu' : `${FEATURES[id].name} unlocked — buy &amp; place it from the Build menu or the Supply Market`);
  return true;
}
function projectCard(id) {
  const B = BUILDS[id];
  const status = (cls, txt) => `<span class="bstat ${cls}">${txt}</span>`;
  if (COIN_STANDS.has(id) && !standGot(id)) return coinUnlockCard(id);
  if (id === 'stand') {
    if (S.standBuilt) return card(BIG('stand'), 'Farm Stand', 'Sell flowers to passing drivers.', status('done', 'Built'));
    if (!S.beds.length) return card(BIG('stand'), 'Farm Stand', 'A roadside stand to sell your flowers.', status('lock', '<i data-icon="lock"></i> Build a raised bed first'), true);
    const crate = S.finds.old_crate > 0 && !S.shelfOn;
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
    if (!S.owned.windmill) return buyBuildCard('windmill', art, nm, sub);
    const sc = BUILDS.windmill.scrap, okW = S.wood >= c && S.scrap >= sc;
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} ${scrapTag(sc)} <span class="${okW ? 'ok' : 'no'}">you have ${S.wood} Wood, ${S.scrap} Scrap</span></div>
      <button class="btn btn-gold" data-act="build-windmill" ${okW ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button>`);
  }
  if (TRAF[id]) {   // v0.68.1: Home or Orchard Parking Lot / Billboard. Parking stays here once built: buy more cards to level it up.
    const T = TRAF[id], b = T.base, F = FEATURES[b], o = T.loc === 'orchard', nm = (o ? 'Orchard ' : '') + F.name, c = BUILDS[b].wood, art = FEATURE_ART[b];
    const sub = b === 'parking' ? `<b>Lv${cardLv('parking')}</b> · ${parkLevelText(cardLv('parking'))}. One card for every lot you build (Home and Orchard).` : `Across the ${o ? 'Orchard ' : ''}road · Run ad for ${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min, then a 1-hour cool-off.${bbBuilt() && !S[T.key] ? ' Shows the same ad as your other Billboard.' : ''}`;
    const gate = trafGate(id);
    if (S[T.key]) {
      if (b === 'billboard') return card(art, nm, sub, `${status('done', `Built · ${bbStatusText()}`)}${!bbActive() && bbReadyIn() <= 0 ? '<button class="btn btn-gold" data-act="bb-run">Run ad · free</button>' : ''}`);
      const p = copyPrice('parking'), mx = copyMax('parking'), up = canUpgrade('parking'), n = +S.cards.parking?.n || 0;
      return `<div data-park-build="${id}">${card(art, nm, `${sub} ${n} cop${n === 1 ? 'y' : 'ies'}${mx ? ' · fully stacked' : ` · Lv${cardLv('parking') + 1} at ${nextAt('parking')}`}.`, `${status('done', `Built · ${o ? oparkCap() : parkCap()} spots`)}
        ${up ? '<button class="btn btn-gold" data-upgrade="parking">✨ Level up</button>' : ''}${mx ? '' : `<button class="btn btn-gold" data-act="buy-copy-parking" data-price="${p}" ${S.coins < p ? 'disabled' : ''}>Buy another Parking Lot card · ${coin(p)}</button>`}`)}</div>`;
    }
    if (!S.unlocked[b]) return card(art, nm, sub, status('lock', `<i data-icon="lock"></i> Find the ${F.name} card in a Card Pack`), true);
    if (!S.owned[id]) return buyBuildCard(id, art, nm, sub, gate ? gate.split(' — ')[0] : '');
    if (gate) return card(art, nm, sub, status('lock', `<i data-icon="lock"></i> ${gate.split(' — ')[0]}`), 'gated');
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-${id}" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Build ${b === 'parking' ? 'by the stand' : 'by the road'}</button>`);
  }
  if (id === 'opress') {   // v0.66.1: the Orchard's own Oil Press
    const C = CRAFT.opress, art = FEATURE_ART.press, c = BUILDS.press.wood, sub = C.blurb + '.';
    if (S.opressBuilt) return card(art, C.name, sub, status('done', `Built · ${lotName(S.opressPos?.lot || 'orchard')}`));
    if (!S.unlocked.press) return '';   // v0.7.2.2: hidden until the Pressed Oil Stand is unlocked (was a greyed card)
    if (!S.owned.opress) return buyBuildCard('opress', art, C.name, sub);
    return card(art, C.name, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-opress" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">Goes on the Orchard or any Orchard plot you own</small>`);
  }
  if (CRAFT[id]) {   // v0.6
    const C = CRAFT[id], art = FEATURE_ART[id], c = BUILDS[id].wood, sub = C.blurb + '.';
    if (S[C.built]) return card(art, C.name, sub, status('done', `Built · ${lotName(S[C.pos]?.lot || 'home')}`));
    if (id === 'fruitstand' && !S.owned.fruitstand) return card(art, C.name, sub, status('lock', '<i data-icon="lock"></i> Comes free with the Orchard'), true);   // v0.61
    if (!S.unlocked[id]) return card(art, C.name, sub, status('lock', `<i data-icon="lock"></i> Find the ${C.name} card in a Card Pack`), true);
    if (!S.owned[id]) return buyBuildCard(id, art, C.name, sub, '');
    return card(art, C.name, sub, `<div class="cost">${c ? `${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span>` : '<span class="ok">Free · comes with the Orchard</span>'}</div>
      <button class="btn btn-gold" data-act="build-${id}" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">${id === 'fruitstand' ? 'Goes on any Orchard plot you own' : 'Goes on any plot you own, at Home or the Orchard'}</small>`);
  }
  if (id === 'teastand') {
    const art = FEATURE_ART.teastand, sub = 'Blend any three dried herbs into teas — the rarer the herbs, the pricier the tea.', nm = 'Tea Stand', c = BUILDS.teastand.wood;
    if (S.teaBuilt) return card(art, nm, sub, status('done', `Built · ${lotName(S.teaPos?.lot || 'home')}`));
    if (!S.unlocked.teastand) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Find the Tea Stand card in a Card Pack'), true);
    if (!S.owned.teastand) return buyBuildCard('teastand', art, nm, sub, '');
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-teastand" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">Goes on any Home plot you own</small>`);
  }
  if (id === 'still') {
    const art = FEATURE_ART.still, sub = 'Distill seeds in copper stills into essential oils that sell for a premium.', nm = 'Essential Oil Stand', c = BUILDS.still.wood;
    if (S.stillBuilt) return card(art, nm, sub, status('done', `Built · ${lotName(S.stillPos?.lot || 'home')}`));
    if (!S.unlocked.still) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Find the Essential Oil Stand card in a Card Pack'), true);
    if (!S.owned.still) return buyBuildCard('still', art, nm, sub, tincLots().length ? '' : 'Buy a neighbouring plot first — it’s built on one of your other plots');
    if (!tincLots().length) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Buy a neighbouring plot first — it’s built on one of your other plots'), 'gated');
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-still" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">Goes on one of your other plots (${tincLots().map(lotName).join(', ')})</small>`);
  }
  if (id === 'tincture') {
    const art = FEATURE_ART.tincture, sub = 'Steep flowers with Glycerin or Vinegar into tinctures that sell for far more.';
    if (S.tinctureBuilt) return card(art, 'Tincture Stand', sub, status('done', 'Built'));
    if (!S.owned.tincture) return card(art, 'Tincture Stand', sub, status('lock', `<i data-icon="lock"></i> Free goal reward: ${GOALS.find((g) => g.reward === 'tincture').text.split(' · ')[0]}`), true);
    if (!tincLots().length) return card(art, 'Tincture Stand', sub, status('lock', '<i data-icon="lock"></i> Yours! Buy a neighbouring plot first — it’s placed on one of your other plots'), 'gated');
    return card(art, 'Tincture Stand', sub, `<div class="cost"><span class="ok">Free to place · yours</span></div>
      <button class="btn btn-gold" data-act="build-tincture"><i data-icon="build"></i> Choose a spot &amp; place</button><small class="opt-note">Goes on one of your other plots (${tincLots().map(lotName).join(', ')})</small>`);
  }
  if (id === 'barrel') {
    const need = barrelLots(), n = Object.keys(S.barrels).length, sub = `Its own water for one plot: 1 every ${regenS()} s (up to ${regenMax()}, upgradable to ${BARREL_LV[BARREL_LV.length - 1].cap}), feeds up to ${BARREL.maxBeds} irrigated beds in that plot and the plot behind it.`;
    if (!S.barrel) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', sub, status('lock', '<i data-icon="lock"></i> Your first one comes free with your first raised bed'), true);
    if (S.barrelInv > 0 && need.length) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', `${sub} You have <b>${S.barrelInv}</b> to place in: <b>${need.map(lotName).join(', ')}</b>.`, `<button class="btn btn-primary" data-act="place-barrel"><i data-icon="build"></i> Place Rain Barrel</button>`);
    if (!need.length) return '';   // v0.7.2.2: every plot you own has one — nothing to buy, so it leaves the Build menu
    // v0.52: built straight from the Build menu like every other building (40 coins, charged when it is placed)
    if (!S.unlocked.rainbarrel) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', sub, status('lock', '<i data-icon="lock"></i> Find the Rain Barrel card in a Card Pack'), true);
    const ok = S.coins >= BARREL.price;
    return card(FEATURE_ART.rainbarrel, 'Rain Barrel', `${sub} Only collects rain with a stand roof on the same plot. Needed in: <b>${need.map(lotName).join(', ')}</b>.`,
      `<div class="cost">${coin(BARREL.price)} <span class="${ok ? 'ok' : 'no'}">you have ${S.coins} coins</span></div>
      <button class="btn btn-gold" data-act="build-barrel" ${ok ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">One per plot · ${BARREL.maxBeds} beds max</small>`);
  }
  if (id === 'market') {
    const pct = Math.min(100, (S.stats.standEarned / MARKET_GOAL) * 100);
    if (S.marketBuilt) return card(BIG('market'), 'Supply Market', 'Rebuilt and open for business.', status('done', 'Open'));
    if (S.marketProj) { const k = marketK();
      return card(BIG('market'), 'Rebuilding the Supply Market', 'Carpenters are at work on the old cottage.', `<div class="progress"><b data-mprog style="width:${(k * 100).toFixed(1)}%"></b></div><small class="muted" data-mleft>${fmtTime(S.marketProj.ms * (1 - k))} left</small>
        <button class="btn btn-blush" data-act="hurry-market">Finish now · ${jewelTag(B.hurryJewels)}</button>`); }
    if (!S.marketAvail) return card(BIG('market'), 'Rebuild the Supply Market', `The old market is boarded up. Earn <b>${MARKET_GOAL} coins</b> at your Farm Stand to start the project.`,
      `<div class="goal-mini"><span class="gbar"><em style="width:${pct}%"></em></span><small>${Math.min(S.stats.standEarned, MARKET_GOAL)} / ${MARKET_GOAL} coins earned</small></div>`, 'gated');
    const c = marketCoins(); const ok = S.wood >= B.wood && S.coins >= c; const canScrap = S.scrap >= B.opt.scrap;
    return card(BIG('market'), 'Rebuild the Supply Market', `Fix the roof, walls and awning. Takes ${fmtTime(B.s * 1000)} once started.`,
      `<div class="cost">${woodTag(B.wood)} ${coin(c)} <span class="${ok ? 'ok' : 'no'}">you have ${S.wood} Wood · ${S.coins} coins</span></div>
      ${canScrap ? `<button class="opt ${useOpt.market ? 'on' : ''}" data-opt="market"><span class="tick"></span><i data-icon="scrap" style="width:26px;height:26px"></i><span>${B.opt.label}</span></button>` : `<small class="opt-note">Optional: <b>3 Scrap</b> (recycle finds) patches the roof and saves ${B.opt.save} coins.</small>`}
      <button class="btn btn-gold" data-act="build-market" ${ok ? '' : 'disabled'}><i data-icon="build"></i> Start rebuilding</button>`);
  }
}
// v0.61: locked (not yet unlocked) build cards are hidden so they stay a surprise; 'gated' ones (yours, waiting on something) still show
function card(art, name, sub, extra, locked = false) { if (locked === true) return ''; return `<div class="build-card${locked ? ' locked' : ''}"><div class="bc-art">${art}</div><div class="meta"><b>${name}</b><small>${sub}</small>${extra || ''}</div></div>`; }
// v0.61: the Build menu shows what can be built HERE; the rest is listed greyed with a "Home only" / "Orchard only" tag
const BUILD_HOME = ['barrel', 'stand', 'rack', 'market', 'tincture', 'still', 'teastand', 'press', 'windmill', 'parking', 'billboard'];
const BUILD_ORCH = ['barrel', 'ostand', 'fruitstand', 'opress', 'treeirrig', 'oparking', 'obillboard'];   // v0.68.1: + the Orchard Parking Lot and Billboard   // v0.67.1: + Tree-row Irrigation (repeatable)   // v0.66.1: the Orchard's own Oil Press
const BUILD_NAMES = { stand: 'Farm Stand', rack: 'Drying Rack', market: 'Supply Market', tincture: 'Tincture Stand', still: 'Essential Oil Stand', teastand: 'Tea Stand', windmill: 'Windmill', parking: 'Parking Lot', billboard: 'Roadside Billboard', oparking: 'Orchard Parking Lot', obillboard: 'Orchard Billboard', fruitstand: 'Fruit Stand', ostand: 'Orchard Stand' };
const BUILT_KEY = { stand: 'standBuilt', rack: 'rackBuilt', market: 'marketBuilt', tincture: 'tinctureBuilt', still: 'stillBuilt', teastand: 'teaBuilt', windmill: 'windmillBuilt', parking: 'parkingBuilt', billboard: 'billboardBuilt', oparking: 'oparkingBuilt', obillboard: 'obillboardBuilt', fruitstand: 'fruitstandBuilt', ostand: 'oshedBuilt' };
function ostandProjectCard() {
  const art = FEATURE_ART.fruitstand, sub = `The Orchard’s selling stand by the Orchard road: visitors buy fruit and Fruit Stand jars. Its roof feeds the Orchard rain barrel.`;
  if (S.oshedBuilt) return card(art, 'Orchard Stand', sub, `<span class="bstat done">${building.oshed ? 'Building…' : 'Built · tap it to stock and sell'}</span>`);
  const ok = canPay(ORCH_STAND);
  return card(art, 'Orchard Stand', sub, `<div class="cost">${coin(ORCH_STAND.coins)} ${woodTag(ORCH_STAND.wood)} <span class="${ok ? 'ok' : 'no'}">you have ${S.coins} coins · ${S.wood} Wood</span></div>
    <button class="btn btn-gold" data-act="build-ostand" ${ok ? '' : 'disabled'}><i data-icon="build"></i> Build the Orchard Stand</button><small class="opt-note">Built on its spot by the Orchard road</small>`);
}
function elsewhereBuildRow(id, tag) {
  const art = id === 'ostand' ? FEATURE_ART.fruitstand : id === 'market' ? BIG('market') : FEATURE_ART[TRAF[id]?.base || id] || '';
  const st = S[BUILT_KEY[id]] ? `Built at ${tag === 'Home only' ? 'Home' : 'the Orchard'}` : S.owned[id] ? 'Yours · not placed yet' : '';
  if (!st) return '';   // v0.61: never list something you haven't got
  if (TRAF[id] && S[BUILT_KEY[id]]) return '';   // v0.7.1: a built Parking Lot / Billboard is not listed in either Build menu
  return `<div class="row dim" data-elsewhere-build="${id}"><div class="ico">${art}</div><div class="meta"><b>${BUILD_NAMES[id]}</b>${st ? `<small>${st}</small>` : ''}</div><div class="acts"><span class="loc-tag">${tag}</span></div></div>`;
}
// v0.66.1: one-time buildings leave the Build menu for good once bought and built (S.buildDone, kept in the save).
// The Rain Barrel is not one-time (one per plot) and stays. Upgrades are done by tapping the building on the map.
const builtNow = (id) => !!(id === 'ostand' ? S.oshedBuilt : S[BUILT_KEY[id] || CRAFT[id]?.built]);
function markBuildsDone() { S.buildDone ||= {}; for (const id of new Set([...BUILD_HOME, ...BUILD_ORCH])) if (id !== 'barrel' && id !== 'treeirrig' && builtNow(id)) S.buildDone[id] = true; }
const BUILD_STAYS = new Set(['barrel', 'treeirrig']);   // v0.7.1: Parking Lots / Billboards leave the Build menu once built (Parking levels up with Market cards; tap a Billboard to run an ad)   // v0.68.1: Parking Lots stay (buy more cards to level up), Billboards stay (Run ad)
const buildGone = (id) => !BUILD_STAYS.has(id) && (S.buildDone?.[id] || builtNow(id));
function buildHTML() {
  markBuildsDone();
  const loc = curLoc(), here = (loc === 'orchard' ? BUILD_ORCH : BUILD_HOME).filter((id) => !buildGone(id)), there = loc === 'orchard' ? BUILD_HOME.filter((x) => !BUILD_ORCH.includes(x)) : BUILD_ORCH.filter((x) => !BUILD_HOME.includes(x));
  const owned = SITES.filter((s) => S.lots[s.lot] && lotLoc(s.lot) === loc && !S.beds.includes(s.id)); const ready = owned.filter((s) => siteClear(s.id)).length;
  const cost = bedCost(); const can = S.wood >= cost;
  const best = owned.map((s) => siteLeft(s.id)).sort((a, b) => a - b)[0];
  const note = !owned.length ? 'Every patch on your land has a bed. Buy a neighboring plot to expand.' : ready ? `${ready} patch${ready > 1 ? 'es are' : ' is'} cleared and ready.` : `Clear a patch first (closest patch: ${best} thing${best === 1 ? '' : 's'} left).`;
  const bed = card(bedSvg(), 'Raised Bed', `A cedar bed with 3×3 planting plots. ${note}`, `<div class="cost">${woodTag(cost)} <span class="${can ? 'ok' : 'no'}">you have ${S.wood}</span></div>
    <button class="btn btn-primary" data-act="place-bed" ${can && owned.length ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot</button>`);
  // v0.52: saplings are a plain Supply Market item now (buy, then Plant) — no Plant-a-tree card in Build any more
  const bCost = (id0) => { const id = TRAF[id0]?.base || id0; return coinEq(id === 'treeirrig' ? TREE_IRRIG : id === 'ostand' ? ORCH_STAND : id === 'barrel' ? { coins: BARREL.price } : { ...BUILDS[id], coins: (BUILDS[id]?.coins || 0) + (FEATURES[id]?.price || 0) }); };
  const cards = here.map((id) => [id === 'treeirrig' ? treeIrrigCard() : id === 'ostand' ? ostandProjectCard() : projectCard(id), bCost(id), id === 'treeirrig' ? 'Tree-row Irrigation' : BUILD_NAMES[id] || FEATURES[id]?.name || BUILDS[id]?.name || id]).concat(loc === 'orchard' ? [] : [[null, coinEq({ wood: cost }), 'Raised Bed']]);
  const projects = cards.sort((a, b) => b[1] - a[1] || a[2].localeCompare(b[2])).map((c) => c[0] ?? bed).join('');   // v0.65: highest value first
  // v0.65: each location has its own Build menu — only what can be built HERE (no raised beds at the Orchard, no Home-only buildings there)
  return `<div class="build-list" data-build-loc="${loc}">${projects}</div>${here.map((id) => (id === 'treeirrig' ? treeIrrigCard() : id === 'ostand' ? ostandProjectCard() : projectCard(id))).join('').trim() ? '' : `<p class="muted empty-hint" data-empty-hint>Open Card Packs to discover more to build.</p>`}
    ${workersSection(loc)}<div class="sec-title">Your land</div><div class="list">${(loc === 'orchard' ? ORCH_LOTS : LOT_FOR_SALE.concat(['home'])).filter((l) => S.lots[l]).map((l) => `<div class="row"><div class="ico"><i data-icon="sign" style="width:30px;height:30px"></i></div><div class="meta"><b>${LOTS[l].name}</b><small>${loc === 'orchard' ? '' : `${SITES.filter((s) => s.lot === l && S.beds.includes(s.id)).length}/${SITES.filter((s) => s.lot === l).length} beds · `}${S.barrels[l] ? `barrel ${S.barrels[l].w}/${regenMax(S.barrels[l])}` : 'no barrel'} · ${OBSTACLES.filter((o) => o.lot === l && obsState(o.id) !== 'gone').length} trees &amp; stumps left</small></div></div>`).join('')}</div>
    <p class="muted" style="margin:10px 4px 0">More land: tap a <b>For Sale</b> sign ${loc === 'orchard' ? 'in the meadow around the Orchard' : 'in the woods around you'}.</p>`;
}
function bedSvg() { return `<svg viewBox="0 0 64 44"><path d="M4 22h56v14H4z" fill="#C99A6B" stroke="#7C5634" stroke-width="2"/><path d="M8 22l4-8h40l4 8z" fill="#8C6545" stroke="#7C5634" stroke-width="2" stroke-linejoin="round"/><path d="M4 29h56" stroke="#B07D52" stroke-width="2"/><path d="M22 16c0-5 2-8 5-9M38 16c0-6 3-9 6-10" stroke="#5E825F" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M27 7c-3.5 0-5-2.6-5-5 3 0 5 2 5 5zM44 6c.5-3 2.4-4.6 5-4.6-.3 3-2.2 4.5-5 4.6z" fill="#B7D4B5" stroke="#3D5A40" stroke-width="1.4"/></svg>`; }

// v0.63: Watch Ad — pick Coins, Wood or Scrap Metal, watch the (simulated) rewarded ad to the end, get the bonus.
// No cooldown, no daily limit, and it stays after No More Ads (opt-in). Shown in the Market and at the Farm Stand.
const AD_PICK = { coins: ['coin', 'Coins'], wood: ['wood', 'Wood'], scrap: ['scrap', 'Scrap Metal'] };
function rewardHTML() {
  if (!Ads.rewardOn) return '';
  const P = adPicks();
  return `<div class="ad-reward" data-watch-row data-ad-mult="${adMult()}"><span class="ad-tag">Ad</span><div class="meta"><b>Watch an ad for a bonus</b><small>Pick ${coin(P.coins)}${scrapUsable() ? `, ${P.wood} Wood or ${P.scrap} Scrap` : ` or ${P.wood} Wood`} · grows as your garden grows · as often as you like</small></div>
    <button class="btn btn-gold sm ad-btn" data-act="watch-ad" data-ad-coins="${P.coins}">▶ Watch · +${coin(P.coins)}</button></div>`;
}
// v0.65: the Watch Ad bonus scales with progression (Home plots, the Orchard and its plots) so it stays worth a few minutes
// of typical income at every stage. Base picks (data.js) × adMult(): fresh garden ×1 · all 6 Home plots ×4 · + Orchard ×6 · + its 3 plots ×7.8.
const adMult = () => +(1 + 0.25 * homeLotsOwned() + (S.lots.orchard ? 1 : 0) + 0.3 * ORCH_FOR_SALE.filter((l) => S.lots[l]).length).toFixed(2);   // v0.7 economy: was 0.5 / 2 / 0.6 (max ×7.8 → ×4.4)
function adPicks() { const B = ADS.rewarded.picks, m = adMult(); return { coins: Math.round(B.coins * m / 5) * 5, wood: Math.round(B.wood * m), scrap: Math.max(B.scrap, Math.round(B.scrap * m)) }; }
let adPickEl = null;
function closeAdPicker() { adPickEl?.remove(); adPickEl = null; }
function watchAd() {
  if (!Ads.rewardOn || Ads.showing) return;
  closeAdPicker();
  const P = adPicks(), el = adPickEl = document.createElement('div');
  el.id = 'ad-picker'; el.className = 'cozy-modal';
  el.innerHTML = `<div class="cozy-card"><button class="close-btn" data-ap="close" aria-label="Close">×</button><h3>Watch an ad</h3><p class="muted">Choose your bonus, then watch a short ad to the end.</p>
    <div class="ap-row">${Object.keys(AD_PICK).filter((r) => r !== 'scrap' || scrapUsable()).map((r) => `<button class="ap-pick" data-ap="${r}"><i data-icon="${AD_PICK[r][0]}"></i><b>+${P[r]}</b><small>${AD_PICK[r][1]}</small></button>`).join('')}</div>
    <p class="ap-note">No limit · watch as many as you like</p></div>`;
  $('#ui').appendChild(el); fillIcons(el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ap]'); if (!b && e.target !== el) return;
    const r = b?.dataset.ap; closeAdPicker(); if (!r || r === 'close') return;
    playRewardAd(r);
  });
}
function playRewardAd(r) {
  const amt = adPicks()[r]; if (!amt || (r === 'scrap' && !scrapUsable())) return false;   // v0.7.2.2: no Scrap until it has a use here
  return Ads.rewarded(() => {
    S[r] += amt; S.stats.adRewards = (S.stats.adRewards || 0) + 1; const st = (S.stats.adPicks ||= { coins: 0, wood: 0, scrap: 0 }); st[r] += amt;
    save(); hud(); toast(`<i data-icon="${AD_PICK[r][0]}"></i> +${amt} ${AD_PICK[r][1]} · thanks for watching`); if (panel) renderPanel();
  });
}
// v0.66: Schwarze Spiele studio splash — a short logo card on load (tap to skip). Automated browsers skip it unless the URL has ?splash.
(() => { const sp = $('#studio-splash'); if (!sp) return;
  if (navigator.webdriver && !/[?&]splash/.test(location.search)) { sp.remove(); return; }
  const out = () => { if (!sp.isConnected || sp.classList.contains('out')) return; sp.classList.add('out'); setTimeout(() => sp.remove(), 650); };
  sp.addEventListener('click', out); setTimeout(out, /[?&]splash=hold/.test(location.search) ? 1e9 : 1700); })();
// ---------------- v0.66: opt-in boosts (rewarded ads), Starter Pack offer, Schwarze Spiele cross-promo ----------------
// Automated test browsers see none of these unless a test opts in (localStorage 'petalspire.monetTest'), so older tests are untouched.
const monetOn = () => !(navigator.webdriver && !localStorage.getItem('petalspire.monetTest'));
const M = () => (S.monet ||= { playMs: 0, boostAt: 0, starter: {}, promo: {}, wish: {} });
const modalOpen = () => !!(adPickEl || dailyEl || starterEl || promoEl || Ads.showing) || !$('#reveal').classList.contains('hidden') || !$('#confirm').classList.contains('hidden') || !$('#map').classList.contains('hidden');
setInterval(() => { if (S.introDone && !document.hidden) { M().playMs += 5000; } }, 5000);   // play time (saved with the 5 s autosave)
// ---- boosts ----
let boostEl = null, boostTimer = 0;
function hideBoost() { clearTimeout(boostTimer); boostEl?.remove(); boostEl = null; }
function boostText(kind, d) {
  if (kind === 'harvest') return d.f ? `+${d.f} ${SPECIES[d.sp].name} · +${d.s} seed${d.s > 1 ? 's' : ''}` : `+${d.s} ${SPECIES[d.sp].name} seeds`;
  if (kind === 'sale') return `+${fmtC(d.coins)} coins`;
  return `${SPECIES[d.sp].name} ready now`;
}
function maybeBoost(kind, d, force = false) {
  const B = BOOSTS, K = B.kinds[kind]; if (!K || !Ads.rewardOn || !monetOn() || !S.introDone || boostEl || adBlocked() || modalOpen()) return false;
  if (!force) {
    if ((S.stats.harvests || 0) < B.minHarvests) return false;
    if (now() - (M().boostAt || 0) < B.cooldownMs) return false;
    if (kind === 'sale' && d.coins < K.minCoins) return false;
    if (Math.random() > B.chance) return false;
  }
  showBoost(kind, d); return true;
}
function showBoost(kind, d) {
  hideBoost(); const K = BOOSTS.kinds[kind]; M().boostAt = now(); (S.stats.boostOffers ||= {})[kind] = (S.stats.boostOffers[kind] || 0) + 1; save();
  const e = boostEl = el('div', 'boost-offer'); e.dataset.boost = kind;
  e.innerHTML = `<button class="bo-main" data-boost-go><span class="bo-ico"><i data-icon="${K.icon}"></i><em>▶</em></span><span class="bo-txt"><b>${K.name}?</b><small>Watch an ad · ${boostText(kind, d)}</small></span></button>
    <button class="bo-x" data-boost-x aria-label="No thanks">×</button><i class="bo-time" style="animation-duration:${BOOSTS.showMs}ms"></i>`;
  const tb = $('#tabbar').getBoundingClientRect(); e.style.bottom = (innerHeight - tb.top + 12) + 'px';
  $('#ui').appendChild(e); fillIcons(e);
  e.querySelector('[data-boost-x]').addEventListener('click', (ev) => { ev.stopPropagation(); hideBoost(); });
  e.querySelector('[data-boost-go]').addEventListener('click', (ev) => { ev.stopPropagation(); hideBoost(); Ads.rewarded(() => applyBoost(kind, d)); });
  boostTimer = setTimeout(hideBoost, BOOSTS.showMs);
  return e;
}
function applyBoost(kind, d) {
  const st = (S.stats.boosts ||= {}); st[kind] = (st[kind] || 0) + 1;
  if (kind === 'harvest') { inBag(d.loc, () => { if (d.f) S.inv['flower_' + d.sp] = (S.inv['flower_' + d.sp] || 0) + d.f; S.inv['seed_' + d.sp] = (S.inv['seed_' + d.sp] || 0) + d.s; });
    toast(`<i data-icon="sprout"></i> Double Harvest · ${boostText(kind, d)}`); }
  else if (kind === 'sale') { S.coins += d.coins; S.stats.boostCoins = (S.stats.boostCoins || 0) + d.coins; toast(`<i data-icon="coin"></i> Double Sale · +${fmtC(d.coins)} coins`); }
  else if (kind === 'grow') { const p = S.tiles[d.i];
    if (!p || p.sp !== d.sp || !p.wateredAt || stageOf(p) >= 3) { toast('That plant is already done — enjoy the ad bonus next time'); }
    else { const t = now(); p.bud = true; p.wu = 0; if (p.sp === 'bluelotus') p.fill = 2; p.wateredAt = t - p.growMs - 1; syncTile(d.i); W.splash?.(d.i); toast(`<i data-icon="sparkle"></i> Fast-Grow · ${SPECIES[d.sp].name} is ready to pick`); } }
  save(); hud(); if (panel) renderPanel();
}
// ---- v0.67: real-money packs (Starter Pack + Jewel Pouch, Gardener’s Pack, Orchard Pack, Collector’s Bundle) ----
// The Starter Pack pops up ONCE, right after the beginning goals are finished (when the closing card is dismissed — or on load
// for a save that finished them before v0.67), and then stays in the Jewel Shop until bought. All packs are listed in the Jewel
// Shop, highest coin-equivalent value first. Purchases go through Payments.purchaseOffer: a placeholder on the web (nothing is
// charged, nothing granted); a native iPhone build resolves it with a verified receipt and grantOffer hands out the contents.
let starterEl = null;
const offerById = (id) => OFFER_PACKS.find((o) => o.id === id);
const offerOwned = (o) => o.once && !!M().owned?.[o.id] || (o.starter && M().starter.bought);
const starterUnlocked = () => S.goal >= GOALS.length;   // the beginning goals are done
const starterLive = () => !M().starter.bought && starterUnlocked();
const tierSeedAvg = (t) => { const ps = Object.values(SPECIES).filter((s) => s.tier === t && s.enabled !== false); return ps.reduce((a, s) => a + s.seedPrice, 0) / Math.max(1, ps.length); };
// coin-equivalent value of a pack (see OFFER_VALUE in data.js)
function offerValue(o) {
  const V = OFFER_VALUE; let v = (o.jewels || 0) * V.jewel + (o.coins || 0) + (o.wood || 0) * V.wood + (o.packs || 0) * V.pack + (o.saplings || 0) * V.sapling;
  for (const t of o.tools || []) v += S.owned?.[t] ? TOOL_SUB_JEWELS * V.jewel : FEATURES[t]?.price || 0;
  if (o.plantsPerTier) for (const t of TIER_ORDER) v += o.plantsPerTier * tierSeedAvg(t) * ((o.seedsPerPlant || 0) + 2);
  if (o.plantTier) v += tierSeedAvg(o.plantTier) * ((o.seedsPerPlant || 0) + 2);
  if (o.dailyX2) v += V.dailyX2 * dailyAvgValue();
  v += (o.gardenerH || 0) * V.gardenerPerH + (o.trucks || 0) * V.truck + (o.irrigation || 0) * (FEATURES.irrigation?.price || 0);
  for (const [id, n] of Object.entries(o.seeds || {})) v += n * (SPECIES[id.slice(5)]?.seedPrice || 0);
  return Math.round(v);
}
const offersSorted = () => [...OFFER_PACKS].sort((a, b) => offerValue(b) - offerValue(a));
function offerRows(o) {
  const r = [];
  if (o.plantsPerTier) r.push(['sprout', `${o.plantsPerTier} random plant of each tier (${TIER_ORDER.length}) · card + ${o.seedsPerPlant} seeds`, 'wide']);
  if (o.plantTier) r.push(['sprout', `${o.plantsPerTier ? '+ 1 extra' : '1'} random ${PLANT_TIERS[o.plantTier].label} plant · card + ${o.seedsPerPlant} seeds`, 'wide']);
  if (o.gardenerH) r.push(['sprout', `1 Gardener hire · ${o.gardenerH} h`, 'wide']);
  for (const [id, n] of Object.entries(o.seeds || {})) r.push(['sprout', `${n} ${SPECIES[id.slice(5)]?.name || id} seeds`]);
  if (o.trucks) r.push(['water', `${o.trucks} truckloads of Water`]);
  if (o.irrigation) r.push(['water', `${o.irrigation} Irrigation row`]);
  if (o.jewels) r.push(['jewel', `${o.jewels} Jewels`]);
  if (o.coins) r.push(['coin', `${fmtC(o.coins)} coins`]);
  if (o.tools?.length) r.push(['build', o.tools.map((t) => FEATURES[t]?.name || t).join(' + ') + (o.tools.some((t) => S.owned?.[t]) ? ` <small class="sp-sub-tag">(already yours: +${TOOL_SUB_JEWELS} Jewels each instead)</small>` : ''), 'wide']);
  if (o.dailyX2) r.push(['gift', `Double Daily Rewards, for good <span class="dl-x2">×2</span>`, 'wide']);
  if (o.wood) r.push(['wood', `${o.wood} Wood`]);
  if (o.packs) r.push(['pack', `${o.packs} Card Packs`]);
  if (o.saplings) r.push(['sapling', `${o.saplings} random tree saplings`]);
  return r;
}
// v0.67.1 → v0.68: each pack is a hero bouquet made of the items themselves (plant cards fanned like petals, the Plow
// and Sickle tucked in, Jewels, coins and Wood spilling at the base); the Collector's is bigger, with a glowing Other World bloom.
const OFFER_ART = { starter_pack: 'assets/offer-starter.jpg?v=0.7.1', collector_bundle: 'assets/offer-collector.jpg?v=0.7.1' };   // v0.7.1: re-cropped art (cache-busted)
function offerChips(o) {
  const c = [], nT = TIER_ORDER.length;
  if (o.plantsPerTier) c.push(['<i data-icon="sprout"></i>', `${o.plantsPerTier * nT}`, 'plants · 1 per tier', 'plants']);
  if (o.plantTier) c.push([`<span class="tier-gem t-${o.plantTier}"></span>`, '+1', PLANT_TIERS[o.plantTier].label, 'bonus']);
  for (const t of o.tools || []) c.push([FEATURE_ART[t] || '<i data-icon="build"></i>', '1', FEATURES[t]?.name || t, t]);
  if (o.jewels) c.push(['<i data-icon="jewel"></i>', `${o.jewels}`, 'Jewels', 'jewels']);
  if (o.coins) c.push(['<i data-icon="coin"></i>', fmtC(o.coins), 'coins', 'coins']);
  if (o.wood) c.push(['<i data-icon="wood"></i>', `${o.wood}`, 'Wood', 'wood']);
  if (o.dailyX2) c.push(['<i data-icon="gift"></i>', '×2', 'Daily gifts', 'daily']);
  if (o.packs) c.push(['<i data-icon="pack"></i>', `${o.packs}`, 'Card Packs', 'packs']);
  if (o.saplings) c.push(['<i data-icon="sapling"></i>', `${o.saplings}`, 'saplings', 'saplings']);
  return c;
}
function offerCardHTML(o, compact = false) {
  const owned = offerOwned(o), art = OFFER_ART[o.id], big = o.id === 'collector_bundle';
  return `<div class="starter-card offer-card${compact ? ' compact' : ''}${o.starter ? ' is-starter' : ''}${big ? ' is-collector' : ''}" data-offer-card="${o.id}"${o.starter ? ' data-starter-card' : ''}>
    ${art ? `<div class="sp-hero${big ? ' big' : ''}" data-offer-hero="${o.id}"><img src="${art}" alt="${o.name}: a gift-wrapped bouquet of everything inside"/><span class="sp-shimmer"></span>${big ? '<span class="sp-glow"></span>' : ''}${o.dailyX2 ? '<span class="sp-ribbon" data-offer-ribbon>Double Daily</span>' : ''}</div>` : ''}
    <div class="sp-head"><div><b>${o.name}</b><small>${o.blurb}</small><em class="sp-val">≈ ${fmtC(offerValue(o))} coins of value</em></div></div>
    <ul class="sp-chips" data-offer-chips>${offerChips(o).map(([ic, n, l, k]) => `<li data-chip="${k}"><span class="ci">${ic}</span><b>${n}</b><small>${l}</small></li>`).join('')}</ul>
    <ul class="sp-items sp-fine">${offerRows(o).map(([ic, t, w]) => `<li${w ? ' class="wide"' : ''}><i data-icon="${ic}"></i>${t}</li>`).join('')}</ul>
    ${owned ? '<p class="sp-owned">Owned · thank you!</p>' : `<button class="btn btn-gold" data-offer-buy="${o.id}"${o.starter ? ' data-starter-buy' : ''}>Get it · ${o.price}</button>`}
    <p class="sp-note" data-starter-note>Purchases arrive with the iPhone app. This web prototype never charges.</p></div>`;
}
const starterCardHTML = (compact = false) => offerCardHTML(STARTER_PACK, compact);
// one popup, the moment the beginning goals are done (S.goalsClosed is set when the closing card is dismissed)
function starterReady() { const st = M().starter; return !st.bought && !st.shows && starterUnlocked() && !!S.goalsClosed; }
function maybeStarter() { if (!monetOn() || !S.introDone || panel || placing || buildMode || modalOpen() || closingEl || !starterReady()) return; showStarter(true); }
// v0.67 migration: the old $1.99 offer's timed popups don't count — the new Starter Pack gets its one popup after the goals
// v0.68: Rosehip Oil is Home-press only, Almond Oil/Butter Orchard-press only. A press still working on a recipe that no longer
// belongs there gives the ingredients back to that place's Bag; finished jars stay ready to collect, so nothing is lost.
for (const c of ['press', 'opress']) { const sl = S[CRAFT[c].slots]; if (!Array.isArray(sl)) continue;
  sl.forEach((t, k) => { const r = t && craftRecipe(c, t.rid); if (!r || recipeHere(c, r) || now() >= t.start + t.ms) return;
    const bag = bagOf(standLoc(c)); bag[r.in] = (bag[r.in] || 0) + r.n; sl[k] = null; (S.pressMoved068 ||= []).push(`${c}:${r.id}`); }); }
// v0.67.1: trees need water after each pick; tree-row Irrigation. Older saves: no row irrigated yet, and trees keep the
// fruit cycle they were on (none is left dry), so nothing is lost.
if (!Array.isArray(S.treeIrrig)) S.treeIrrig = []; S.treeIrrig = [...new Set(S.treeIrrig)].filter((id) => ORCH_ROWS.some((r) => r.id === id));
for (const t of Object.values(S.orchard || {})) if (t && t.dry != null && !(t.dry > 0)) delete t.dry;
syncTreeRows();
{ const st = M().starter; if (!st.v067) { st.v067 = true; st.shows = 0; delete st.until; delete st.lastShow; } }
setInterval(maybeStarter, 3000);
function showStarter(auto = false) {
  const st = M().starter; if (st.bought) return null;
  if (auto) { st.shows = (st.shows || 0) + 1; st.lastShow = now(); save(); }
  starterEl?.remove(); const e = starterEl = el('div', 'cozy-modal starter-modal'); e.id = 'starter';
  e.innerHTML = `<div class="cozy-card"><button class="close-btn" data-starter-x aria-label="Close">×</button><h3>You did it! A Starter Pack</h3><p class="muted sp-sub">All your beginning goals are done. Here’s an optional head start — it stays in the Jewel Shop whenever you want it.</p>${starterCardHTML()}<button class="btn sm sp-later" data-starter-x>Maybe later</button></div>`;
  $('#ui').appendChild(e); fillIcons(e);
  e.addEventListener('click', (ev) => { if (ev.target === e || ev.target.closest('[data-starter-x]')) { e.remove(); starterEl = null; return; } const b = ev.target.closest('[data-offer-buy]'); if (b) buyOffer(b.dataset.offerBuy, e); });
  return e;
}
async function buyOffer(id, root) {
  const o = offerById(id); if (!o || offerOwned(o)) return false;
  const r = await Payments.purchaseOffer(o);
  if (r.ok) return grantOffer(id, r.receipt);
  const n = root?.querySelector(`[data-offer-card="${id}"] [data-starter-note]`) || root?.querySelector('[data-starter-note]'); if (n) { n.textContent = r.reason; n.classList.add('on'); }
  S.stats.offerTaps = (S.stats.offerTaps || 0) + 1; if (o.starter) S.stats.starterTaps = (S.stats.starterTaps || 0) + 1; save(); return false;
}
const buyStarter = (root) => buyOffer(STARTER_PACK.id, root);
// Called only with a verified store receipt (the iPhone app). Hands out the contents (a once-pack only once).
function grantOffer(id, receipt) {
  const o = offerById(id); if (!o || offerOwned(o)) return false;
  const m = M(); m.owned ||= {}; m.receipts ||= {};
  if (o.once) m.owned[o.id] = true; if (o.starter) { m.starter.bought = true; m.starter.receipt = receipt || null; }
  (m.receipts[o.id] ||= []).push(receipt || null);
  S.jewels += o.jewels || 0; S.coins += o.coins || 0; S.wood += o.wood || 0; S.freePacks = (S.freePacks || 0) + (o.packs || 0);
  if (o.saplings) { const ob = S.bags.orchard || S.bags.home; ob.sapling = (ob.sapling || 0) + o.saplings; }
  const subs = []; for (const t of o.tools || []) { if (S.owned[t]) { S.jewels += TOOL_SUB_JEWELS; subs.push(t); continue; } S.discovered[t] = S.unlocked[t] = S.owned[t] = true; if (!S.cards[t]) addCard(t); }
  if (o.dailyX2) S.dailyX2 = true;   // permanent: every daily gift is doubled from now on
  S.gardenerPasses = (S.gardenerPasses || 0) + (o.gardenerH ? 1 : 0); if (o.gardenerH) S.gardenerPassH = o.gardenerH;
  S.freeTrucks = (S.freeTrucks || 0) + (o.trucks || 0);
  for (const [id, n] of Object.entries(o.seeds || {})) S.bags.home[id] = (S.bags.home[id] || 0) + n;
  if (o.irrigation) { S.discovered.irrigation = S.unlocked.irrigation = S.owned.irrigation = true; addCard('irrigation', o.irrigation); }
  const plants = [];
  const tierList = [...TIER_ORDER.flatMap((t) => Array(o.plantsPerTier || 0).fill(t)), ...(o.plantTier ? [o.plantTier] : [])];
  for (const t of tierList) {
    const pool = Object.values(SPECIES).filter((s) => s.tier === t && s.enabled !== false && ITEMS['seed_' + s.id]);
    if (!pool.length) continue; const sp = pool[Math.floor(Math.random() * pool.length)];
    applyPackCard(sp.id); S.bags.home['seed_' + sp.id] = (S.bags.home['seed_' + sp.id] || 0) + (o.seedsPerPlant || 0); plants.push(sp.id);
  }
  m.lastGrant = { id: o.id, plants, tiers: plants.map((p) => SPECIES[p].tier), subs };
  save(); hud(); syncTools(); starterEl?.remove(); starterEl = null; if (panel) renderPanel();
  toast(`<i data-icon="gift"></i> ${o.name} added · thank you!`); return true;
}
const grantStarter = (receipt) => grantOffer(STARTER_PACK.id, receipt);
// ---- More from Schwarze Spiele ----
let promoEl = null;
const promoGame = () => OTHER_GAMES.find((g) => g.id === CROSS_PROMO.gameId) || OTHER_GAMES[0];
function promoCardHTML() {
  const g = promoGame(), wished = !!M().wish[g.id];
  const act = g.status === 'live' && g.url ? `<a class="btn btn-primary sm" href="${g.url}" target="_blank" rel="noopener">Play ${g.name}</a>`
    : `<button class="btn ${wished ? '' : 'btn-blush '}sm" data-wish="${g.id}">${wished ? '♥ On your wishlist' : '♡ Wishlist'}</button>`;
  return `<div class="promo-card" data-promo="${g.id}"><div class="pc-art">${gameArt(g.id)}</div><div class="pc-meta"><b>${g.name}${g.status === 'soon' ? ' <span class="soon-tag">Coming soon</span>' : ''}</b><small class="gr-tag">${g.tagline}</small><small>${g.blurb}</small>
    <div class="pc-acts">${act}${wished && g.status !== 'live' ? '<small class="pc-wished">We’ll let you know right here when it’s out.</small>' : ''}</div></div></div>`;
}
const studioHeadHTML = () => `<div class="studio-head"><img src="${STUDIO.icon}" alt="" /><div><b>More from ${STUDIO.name}</b><small>The little studio behind Petalspire</small></div></div>`;
function wish(id) { const g = OTHER_GAMES.find((x) => x.id === id); if (!g) return; M().wish[id] = !M().wish[id]; save();
  if (M().wish[id] && g.wishlistUrl) window.open(g.wishlistUrl, '_blank', 'noopener');
  toast(M().wish[id] ? `♥ ${g.name} is on your wishlist` : `Removed ${g.name} from your wishlist`);
  for (const r of document.querySelectorAll('.promo-card')) { r.outerHTML = promoCardHTML(); } fillIcons($('#ui')); }
function promoMilestone(tag, force = false) {
  if (!monetOn() && !force) return false; const P = CROSS_PROMO, pr = M().promo;
  if (!force && ((pr.shows || 0) >= P.maxShows || M().playMs < P.firstAfterMs || (pr.last && now() - pr.last < P.minGapMs))) return false;
  const go = () => { if (panel || placing || buildMode || modalOpen()) return setTimeout(go, 4000); showPromo(tag); };
  setTimeout(go, force ? 0 : 3500); return true;
}
function showPromo(tag = '') {
  const pr = M().promo; pr.shows = (pr.shows || 0) + 1; pr.last = now(); pr.tag = tag; save();
  promoEl?.remove(); const e = promoEl = el('div', 'cozy-modal promo-modal'); e.id = 'promo';
  e.innerHTML = `<div class="cozy-card"><button class="close-btn" data-promo-x aria-label="Close">×</button>${studioHeadHTML()}<p class="muted">Lovely garden! If you enjoy Petalspire, here’s what we’re making next.</p>${promoCardHTML()}<button class="btn sm sp-later" data-promo-x>Back to the garden</button></div>`;
  $('#ui').appendChild(e); fillIcons(e);
  e.addEventListener('click', (ev) => { if (ev.target === e || ev.target.closest('[data-promo-x]')) { e.remove(); promoEl = null; } });
  return e;
}
document.addEventListener('click', (ev) => { const w = ev.target.closest?.('[data-wish]'); if (w) { ev.stopPropagation(); wish(w.dataset.wish); return; }
  const b = ev.target.closest?.('[data-shop-starter] [data-offer-buy]'); if (b) { ev.stopPropagation(); buyOffer(b.dataset.offerBuy, b.closest('[data-shop-starter]')); } }, true);
// v0.63: daily streak. Days are LOCAL calendar days (YYYY-MM-DD). One claim per day; claiming the day after keeps the streak,
// a gap of 2+ days restarts at Day 1. Clock guard: never two claims on the same day, and nothing is claimable while the
// device clock reads earlier than the last claim (setting the clock back can't farm gifts).
const dayKey = (d = new Date(now())) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = (k) => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const DAILY_N = DAILY.days.length;
const dailyCycleDay = (streak) => ((streak - 1) % DAILY_N) + 1;
function dailyStatus() {
  const D = S.daily, today = dayKey();
  if (!D.last) return { can: true, next: 1, today, reset: false };
  const diff = dayNum(today) - dayNum(D.last);
  if (now() < (D.lastTs || 0) - 36e5 || diff < 0) return { can: false, next: D.streak, today, clockBack: true };
  if (diff === 0) return { can: false, next: D.streak, today, claimed: true };
  if (diff === 1) return { can: true, next: D.streak + 1, today, reset: false };
  return { can: true, next: 1, today, reset: D.streak > 0 };
}
// v0.67: the Collector's Bundle doubles every daily gift for good (S.dailyX2), shown with a small ×2 badge
const dailyMult = () => (S.dailyX2 ? 2 : 1);
const dailyX = (g) => dailyMult() === 1 ? g : Object.fromEntries(Object.entries(g).map(([k, v]) => [k, typeof v === 'number' ? v * dailyMult() : v]));
const dailyGift = (streak) => dailyX(DAILY.days[dailyCycleDay(streak) - 1]);
const dailyAvgValue = () => DAILY.days.reduce((a, g) => a + (g.coins || 0) + (g.wood || 0) * OFFER_VALUE.wood + (g.scrap || 0) * 10 + (g.pack || 0) * OFFER_VALUE.pack + (g.jewels || 0) * OFFER_VALUE.jewel, 0) / DAILY.days.length;
const dailyBadge = () => (S.dailyX2 ? ' <span class="dl-x2" title="Double Daily Rewards">×2</span>' : '');
const giftBits = (g) => [g.coins && `<span><i data-icon="coin"></i>${g.coins}</span>`, g.wood && `<span><i data-icon="wood"></i>${g.wood}</span>`, g.scrap && `<span><i data-icon="scrap"></i>${g.scrap}</span>`,
  g.pack && `<span class="g-pack">🎴 Pack</span>`, g.jewels && `<span><i data-icon="jewel"></i>${g.jewels}</span>`].filter(Boolean).join('');
function claimDaily() {
  const st = dailyStatus(); if (!st.can) return null;
  const D = S.daily, g = dailyGift(st.next);
  D.streak = st.next; D.last = st.today; D.lastTs = now(); D.best = Math.max(D.best || 0, D.streak); D.claims = (D.claims || 0) + 1;
  for (const r of ['coins', 'wood', 'scrap', 'jewels']) if (g[r]) S[r] += g[r];
  if (g.pack) S.freePacks = (S.freePacks || 0) + g.pack;
  save(); hud(); return { day: dailyCycleDay(D.streak), streak: D.streak, gift: g };
}
let dailyEl = null;
function closeDaily() { dailyEl?.remove(); dailyEl = null; }
function showDaily(auto = false) {
  closeDaily();
  const st = dailyStatus(), cur = st.can ? st.next : S.daily.streak, cd = cur ? dailyCycleDay(cur) : 1, base = cur ? cur - cd : 0;
  const nextMs = DAILY.days.findIndex((d, i) => d.milestone && i + 1 >= cd + (st.can ? 0 : 1));
  if (auto) S.daily.seen = st.today;
  const el = dailyEl = document.createElement('div'); el.id = 'daily'; el.className = 'cozy-modal';
  el.innerHTML = `<div class="cozy-card daily-card"><button class="close-btn" data-dl="close" aria-label="Close">×</button>
    <h3>Daily Garden Gift${dailyBadge()}</h3><p class="muted">${st.can ? (st.reset ? 'You missed a day, so your streak starts again — welcome back!' : cur > 1 ? `Day ${cur} in a row — lovely!` : 'Come back each day for a bigger gift.') : st.clockBack ? 'Your device clock looks earlier than your last gift — check back later.' : `Claimed today · come back tomorrow for Day ${cur + 1}.`}</p>
    <div class="dl-tiles">${DAILY.days.map((g, i) => { const d = i + 1, done = d < cd || (d === cd && !st.can), today = st.can && d === cd;
      return `<div class="dl-tile${done ? ' done' : ''}${today ? ' today' : ''}${g.milestone ? ' ms' : ''}${i === nextMs ? ' next-ms' : ''}${g.grand ? ' grand' : ''}" data-day="${d}"><em>Day ${base + d}</em>${done ? '<b class="dl-check">✓</b>' : `<div class="dl-gift">${giftBits(dailyX(g))}</div>`}</div>`; }).join('')}</div>
    ${nextMs >= 0 ? `<p class="dl-next">Next milestone: <b>Day ${base + nextMs + 1}</b> · ${giftBits(dailyX(DAILY.days[nextMs]))}</p>` : ''}
    <button class="btn btn-gold dl-claim" data-dl="claim" ${st.can ? '' : 'disabled'}>${st.can ? `Claim Day ${cur}${S.dailyX2 ? ' · ×2' : ''}` : 'Claimed ✓'}</button>
    <p class="ap-note">Streak ${S.daily.streak || 0} · best ${S.daily.best || 0} · miss a day and it restarts</p></div>`;
  $('#ui').appendChild(el); fillIcons(el); save();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dl]'); if (!b && e.target !== el) return;
    if (b?.dataset.dl === 'claim') {
      const r = claimDaily(); if (!r) return;
      const t = el.querySelector('.dl-tile.today'); if (t) { t.classList.replace('today', 'done'); t.innerHTML = `<em>${t.firstElementChild.textContent}</em><b class="dl-check">✓</b>`; const bx = t.getBoundingClientRect(); sparkles(el, bx.left + bx.width / 2, bx.top + bx.height / 2, r.gift.milestone ? 24 : 10); }
      b.disabled = true; b.textContent = 'Claimed ✓'; buzz(r.gift.milestone ? [30, 40, 60] : 20);
      toast(`🌼 Day ${r.streak} gift: ${giftBits(r.gift).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
      if (r.gift.pack) setTimeout(() => { closeDaily(); if (S.marketBuilt) buyPack(); else toast('🎴 A free Card Pack is waiting at the Market once it’s rebuilt'); }, 900);
      return;
    }
    closeDaily();
  });
}
// first open each day: show the popup once the intro is done and nothing else is on screen (not in automated tests unless asked)
function maybeDaily() {
  if (!S.introDone || dailyEl || adPickEl || Ads.showing || panel || !$('#reveal').classList.contains('hidden')) return;
  if (navigator.webdriver && !localStorage.getItem('petalspire.dailyTest')) return;
  const st = dailyStatus(); if (st.can && S.daily.seen !== st.today) showDaily(true);
}
setInterval(maybeDaily, 4000);
// v0.6: Sunflower seeds can be bagged (50 or 100) — a bag sells for more than the same seeds one by one, and takes one stand slot
function bagStrip() {
  return Object.entries(SEED_BAGS).filter(([sp]) => (S.inv['seed_' + sp] || 0) >= SEED_BAGS[sp][0].n).map(([sp, bags]) => `<div class="row bag-strip" data-bag-strip="${sp}"><div class="ico">${itemSvg(bagId(sp, bags[0].n))}</div><div class="meta"><b>Bag your ${SPECIES[sp].name} seeds</b><small>You have ${S.inv['seed_' + sp]} · singly ${SPECIES[sp].seedSell} each · ${bags.map((b) => `${b.n} for ${b.sell}`).join(' · ')}</small></div>
    <div class="acts">${bags.map((b) => `<button class="btn btn-gold sm" data-bagseeds="${sp}:${b.n}" ${(S.inv['seed_' + sp] || 0) >= b.n ? '' : 'disabled'}>Bag ${b.n}</button>`).join('')}</div></div>`).join('');
}
function bagSeeds(sp, n) {
  const b = SEED_BAGS[sp]?.find((q) => q.n === n), id = 'seed_' + sp; if (!b || (S.inv[id] || 0) < n) return false;
  S.inv[id] -= n; const bid = bagId(sp, n); S.inv[bid] = (S.inv[bid] || 0) + 1; S.stats.bagged = (S.stats.bagged || 0) + 1;
  toast(`${itemSvg(bid)} Bagged ${n} ${SPECIES[sp].name} seeds · sells for ${b.sell}`); save(); hud(); if (panel) renderPanel(); return true;
}
// v0.63: one Upgrade card per building — the current level, ONLY the next level's effect and cost (the rest of the ladder stays
// hidden, like other locked things), greyed with a "need X more coins" hint when short, and "Max level" at Lv4.
const BLV_NAME = { stand: 'Farm Stand', rack: 'Drying Rack' };
function blvEffect(k, lv) {
  const L = BUILDING_LV[k], i = lv - 1;
  if (k === 'stand') return `${STAND_CAP + L.space[i]} shelf space${L.space[i] ? ` (+${L.space[i]})` : ''} · customers buy ${STAND_BUY.kinds[i].join('–')} kinds, up to ${STAND_BUY.upTo[i]} of each${L.sell[i] ? ` · +${Math.round(L.sell[i] * 100)}% coins on stand sales` : ''}`;
  return `${L.slots[i]} drying slots${L.faster[i] ? ` · dries ${Math.round(L.faster[i] * 100)}% faster` : ''}`;
}
function upgHTML(k) {
  const lv = blv(k), name = BLV_NAME[k];
  if (S.upg?.[k]) return upgTimerHTML(k, name);
  if (lv >= BLV_MAX) return `<div class="upg-card max" data-upg="${k}" data-upg-max><div class="upg-lv">Lv${lv}</div><div class="upg-meta"><b>${name} · Max level</b><small>${blvEffect(k, lv)}</small></div></div>`;
  const cost = BUILDING_LV[k].cost[lv - 1], short = Math.max(0, cost - S.coins);
  return `<div class="upg-card" data-upg="${k}"><div class="upg-lv">Lv${lv}</div><div class="upg-meta"><b>${name} Lv${lv} → Lv${lv + 1}</b><small>Now: ${blvEffect(k, lv)}</small><small class="upg-next">Next: ${blvEffect(k, lv + 1)}</small>
    ${short ? `<small class="upg-need" data-upg-need="${short}">Need ${fmtC(short)} more coin${short === 1 ? '' : 's'}</small>` : ''}</div>
    <button class="btn btn-gold sm" data-act="upgrade-building" data-kind="${k}" data-upg-cost="${cost}" ${short ? 'disabled' : ''}><i data-icon="coin"></i> ${fmtC(cost)}</button></div>`;
}
function upgradeBuilding(k) {
  if (!BUILDING_LV[k] || !(k === 'stand' ? S.standBuilt : S.rackBuilt)) return false;
  const lv = blv(k); if (lv >= BLV_MAX || S.upg?.[k]) return false;
  const cost = BUILDING_LV[k].cost[lv - 1]; if (S.coins < cost) { toast(`Need ${fmtC(cost - S.coins)} more coins to upgrade the ${BLV_NAME[k]}`); return false; }
  S.coins -= cost; startUpg(k, lv + 1, () => applyBuildingLv(k, lv + 1)); return true;
}
function applyBuildingLv(k, to) {   // v0.64: runs when the upgrade timer ends (or at once in automated tests)
  const lv = to - 1; S[k + 'Lv'] = Math.max(blv(k), to); (S.stats.buildingUps ||= {})[k] = S[k + 'Lv'];
  if (k === 'rack') { while (S.rack.length < rackSlots()) S.rack.push(null); syncRack(); } else { syncStand(); syncShelf(); }
  writeSave(); hud(); if (panel) renderPanel();
  const at = spotV(k); if (at) W.poof?.(at.clone ? at.clone().setY(1.0) : at, '#F5D07A', 18, 1.6);
  toast(`✨ ${BLV_NAME[k]} upgraded to Lv${lv + 1} · ${blvEffect(k, lv + 1)}`);
}
function standHTML() { return inBag('home', () => standHTML_()); }
function standHTML_() {
  const used = standCount(), cap = standCap();
  const onStand = byValue(SELL_ORDER.filter((id) => S.stand[id] > 0)).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name} ×${S.stand[id]}</b><small>${standPrice(id)} coins each</small></div><div class="acts"><button class="btn sm" data-unstock="${id}">Take back</button></div></div>`).join('');
  const fromBag = bagStrip() + byValue(SELL_ORDER.filter((id) => S.inv[id] > 0 && sellsAt(id, 'home'))).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>You have ${S.inv[id]} · sells for ${sellOf(id)}</small></div>
    <div class="acts"><button class="btn sm" data-stock="${id}" data-n="1" ${used >= cap ? 'disabled' : ''}>+1</button><button class="btn btn-gold sm" data-stock="${id}" data-n="all" ${used >= cap ? 'disabled' : ''}>Stock all</button></div></div>`).join('');
  const status = custs.length ? `<b>${custs.length > 1 ? `${custs.length} customers are` : 'A customer is'} at your stand!</b>` : used ? `Next customer in about ${fmtTime(Math.max(0, nextCust - now()))}` : 'Put items on the stand to attract customers.';
  const prog = !S.marketAvail ? `<div class="goal-mini"><small>Earn ${MARKET_GOAL} coins here to start rebuilding the Supply Market</small><span class="gbar"><em style="width:${Math.min(100, (S.stats.standEarned / MARKET_GOAL) * 100)}%"></em></span><small>${Math.min(S.stats.standEarned, MARKET_GOAL)} / ${MARKET_GOAL}</small></div>` : `<p class="muted" style="margin:0 4px 8px">Earned at your stand: ${coin(S.stats.standEarned)}${atmosphere() ? ` · atmosphere ${atmosphere()}` : ''}</p>`;
  return `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh flowers by the road</p></div>
    <div class="stand-status"><i data-icon="stand"></i><span id="stand-status">${status}</span></div>${upgHTML('stand')}${prog}${rewardHTML()}
    <div class="sec-title">On your stand · ${used}/${cap}${shelfOn() ? ' · crate shelf' : ''}</div>${shelfOn() ? `<div class="shelf-strip" data-shelf-strip>${findIcon('old_crate')}<span><b>Crate Shelf</b> installed · +${SHELF_BONUS} space · permanent</span></div>` : S.bonus.crate ? `<div class="shelf-strip" data-shelf-strip>${findIcon('old_crate')}<span><b>Crate Shelf</b> in your Bag · +${SHELF_BONUS} space for good</span><button class="btn btn-gold sm" data-install-shelf>Install</button></div>` : ''}
    ${onStand ? `<div class="list">${onStand}</div>` : '<div class="empty">The stand is empty.</div>'}
    ${antiquesHTML(used >= cap)}
    <div class="sec-title">From your satchel</div>
    ${fromBag ? `<div class="list">${fromBag}</div>` : '<div class="empty">Nothing to sell yet — harvest some blooms first.</div>'}
    ${consLeft('stand') ? '' : bulkStrip('home')}${elsewhereHTML('home')}
    <p class="muted" style="margin:14px 4px 0;text-align:center"><button class="link-btn" data-act="sell-stand">Sell the Farm Stand?</button></p>`;
}
// v0.61: each stand sells only its own place's goods (fruit + Fruit Stand jars at the Orchard Stand, pressed oils at both)
const sellTag = (id) => (itemLoc(id) === 'orchard' ? 'Sells at the Orchard' : 'Sells at Home');
const ostandCount = () => Object.values(S.ostand).reduce((a, b) => a + b, 0);
function stock(id, n, loc = 'home') { return inBag(loc, () => stock_(id, n, loc)); }
function stock_(id, n, loc = 'home') {
  if (loc === 'orchard') return ostock(id, n);
  if (consLeft('stand')) { toast(`The Farm Stand is still being built · ${clock(consLeft('stand'))} left`); return; }
  if (!sellsAt(id, 'home')) { toast(`${ITEMS[id]?.name || 'That'} · ${sellTag(id)}`); return; }
  const space = standCap() - standCount(); const q = Math.min(space, n === 'all' ? S.inv[id] : 1, S.inv[id]); if (q <= 0) return;
  const wasEmpty = standCount() === 0;
  S.inv[id] -= q; S.stand[id] = (S.stand[id] || 0) + q; S.stats.stocked += q;
  if (wasEmpty && !custs.length) nextCust = Math.max(nextCust, now() + (S.stats.customers ? 6000 : 3500));
  syncStand(); save(); hud(); renderPanel(); checkGoals();
}
function unstock(id, loc = 'home') { return inBag(loc, () => unstock_(id, loc)); }
function unstock_(id, loc = 'home') { if (loc === 'orchard') return ounstock(id); const q = S.stand[id] || 0; if (!q) return; if (ITEMS[id]?.antique) { for (let n = 0; n < q; n++) giveRestored(ITEMS[id].antique); } else S.inv[id] += q; delete S.stand[id]; syncStand(); save(); hud(); renderPanel(); }

// goods in the Bag that this stand can't sell: listed (greyed) with a gentle "Sells at …" tag
function elsewhereHTML(loc) { return inBag(loc, () => elsewhereHTML_(loc)); }
function elsewhereHTML_(loc) {
  const ids = byValue(SELL_ORDER.filter((id) => S.inv[id] > 0 && !sellsAt(id, loc))); if (!ids.length) return '';
  return `<div class="sec-title">In your ${locName(loc) === 'Home' ? 'Home' : 'Orchard'} Bag · sells elsewhere</div><div class="list elsewhere">${ids.map((id) => `<div class="row dim" data-elsewhere="${id}"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>You have ${S.inv[id]} · <span class="loc-tag sm">${sellTag(id)}</span></small></div><div class="acts">${sendBtns(id)}</div></div>`).join('')}</div>`;
}
// ---------------- v0.61: the Orchard Stand (the Orchard's selling stand) ----------------
function ostock(id, n) { return inBag('orchard', () => ostock_(id, n)); }
function ostock_(id, n) {
  if (!S.oshedBuilt) { toast('Build the Orchard Stand first'); return; }
  if (consLeft('oshed')) { toast(`The Orchard Stand is still being built · ${clock(consLeft('oshed'))} left`); return; }
  if (!sellsAt(id, 'orchard')) { toast(`${ITEMS[id]?.name || 'That'} · ${sellTag(id)}`); return; }
  const space = ORCH_STAND.cap - ostandCount(); const q = Math.min(space, n === 'all' ? S.inv[id] : 1, S.inv[id] || 0); if (q <= 0) return;
  const wasEmpty = ostandCount() === 0;
  S.inv[id] -= q; S.ostand[id] = (S.ostand[id] || 0) + q; S.stats.stocked += q;
  if (wasEmpty && !ocusts.length) nextOCust = Math.max(nextOCust, now() + 4000);
  syncOStand(); save(); hud(); renderPanel(); checkGoals();
}
function ounstock(id) { return inBag('orchard', () => ounstock_(id)); }
function ounstock_(id) { const q = S.ostand[id] || 0; if (!q) return; S.inv[id] = (S.inv[id] || 0) + q; delete S.ostand[id]; syncOStand(); save(); hud(); renderPanel(); }
function syncOStand() { W.setOStandStock?.(ostandCount()); }
function syncOShed(anim) {
  const on = !!(S.lots.orchard && S.oshedBuilt);
  if (on) { if (!building.oshed) W.appear(W.orchardShed, !!anim); } else W.orchardShed.visible = false;
  W.setBlueprint('oshed', !!(S.lots.orchard && !S.oshedBuilt && !building.oshed));
  syncOStand();
}
function buildOStand() {
  if (!S.lots.orchard || S.oshedBuilt || building.oshed) return false;
  if (!canPay(ORCH_STAND)) { toast(`The Orchard Stand needs ${missingText(ORCH_STAND)}`); return false; }
  S.coins -= ORCH_STAND.coins; S.wood -= ORCH_STAND.wood; S.oshedBuilt = true; building.oshed = true; startCons('oshed'); save(); closePanel(); syncOShed(); hud();
  glideIfOff(V3(SPOTS.orchardshed[0], 0.3, SPOTS.orchardshed[1]));
  setTimeout(() => W.buildAnim(W.orchardShed, [2.4, 2.6, 1.9], () => {
    building.oshed = false; popAt(V3(SPOTS.orchardshed[0], 2.4, SPOTS.orchardshed[1]), consMsg('oshed', 'Orchard Stand built!')); syncOShed(); syncBarrels?.(); hud(); checkGoals();
    toast('Stock fruit and jars on it — visitors on the Orchard road will stop to buy'); }), 500);
  return true;
}
function ostandBuildCard() {
  const c = ORCH_STAND, ok = canPay(c);
  return `<div class="lot-card"><span class="fs-art">${FEATURE_ART.fruitstand || ''}</span><div><b>Orchard Stand · Blueprint</b><small>The Orchard’s own roadside stand: visitors on the Orchard road buy fruit and Fruit Stand jars here. Its roof feeds the Orchard rain barrel.</small></div></div>
    <div class="ts-actions"><button class="btn btn-gold" data-act="build-ostand" ${ok ? '' : 'disabled'}><i data-icon="build"></i> Build · ${coin(c.coins)} + ${woodTag(c.wood)}</button></div>
    ${ok ? '' : `<p class="muted" style="margin:8px 4px 0;text-align:center">You need ${missingText(c)}.</p>`}`;
}
function ostandHTML() { return inBag('orchard', () => ostandHTML_()); }
function ostandHTML_() {
  if (!S.oshedBuilt) return ostandBuildCard();
  const used = ostandCount(), cap = ORCH_STAND.cap;
  const onStand = byValue(SELL_ORDER.filter((id) => S.ostand[id] > 0)).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name} ×${S.ostand[id]}</b><small>${ostandPrice(id)} coins each</small></div><div class="acts"><button class="btn sm" data-unstock="${id}" data-loc="orchard">Take back</button></div></div>`).join('');
  const fromBag = byValue(SELL_ORDER.filter((id) => S.inv[id] > 0 && sellsAt(id, 'orchard'))).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>You have ${S.inv[id]} · sells for ${sellOf(id)}</small></div>
    <div class="acts"><button class="btn sm" data-stock="${id}" data-loc="orchard" data-n="1" ${used >= cap ? 'disabled' : ''}>+1</button><button class="btn btn-gold sm" data-stock="${id}" data-loc="orchard" data-n="all" ${used >= cap ? 'disabled' : ''}>Stock all</button></div></div>`).join('');
  const status = ocusts.length ? `<b>${ocusts.length > 1 ? `${ocusts.length} visitors are` : 'A visitor is'} at your stand!</b>` : used ? `Next visitor in about ${fmtTime(Math.max(0, nextOCust - now()))}` : 'Put fruit or jars on the stand to attract visitors.';
  return `<div class="stand-status"><i data-icon="stand"></i><span id="stand-status">${status}</span></div>
    <p class="muted" style="margin:0 4px 8px">Earned at the Orchard Stand: ${coin(S.stats.orchEarned || 0)}</p>
    <div class="sec-title">On your stand · ${used}/${cap}</div>
    ${onStand ? `<div class="list">${onStand}</div>` : '<div class="empty">The stand is empty.</div>'}
    <div class="sec-title">From your satchel</div>
    ${fromBag ? `<div class="list">${fromBag}</div>` : '<div class="empty">Nothing to sell here yet — pick fruit, or make jars at the Fruit Stand.</div>'}
    ${bulkStrip('orchard')}${elsewhereHTML('orchard')}`;
}
// ---------------- v0.65: Bulk Sell Box — drop extra goods for an instant sale at half the stand price (this location's goods only) ----------------
const bulkPrice = (id, loc) => Math.max(1, Math.round(BULK.k * (loc === 'orchard' ? ostandPrice(id) : standPrice(id))));
const bulkItems = (loc) => byValue(SELL_ORDER.filter((id) => bagOf(loc)[id] > 0 && sellsAt(id, loc) && !ITEMS[id]?.antique));
const bulkBlocked = (loc) => (loc === 'orchard' ? (!S.oshedBuilt || consLeft('oshed')) : consLeft('stand'));
function bulkStrip(loc) { const n = bulkItems(loc).reduce((a, id) => a + bagOf(loc)[id], 0);
  return `<div class="row bulk-strip" data-bulk-strip="${loc}"><div class="ico">${FEATURE_ART.bulkbox || '📦'}</div><div class="meta"><b>Bulk Sell Box</b><small>Too much to shelve? Sell extras right now for ${Math.round(BULK.k * 100)}% of the stand price${n ? ` · ${n} item${n > 1 ? 's' : ''} you can drop in` : ''}</small></div><div class="acts"><button class="btn btn-gold sm" data-act="open-bulk-${loc}">Open</button></div></div>`; }
function bulkHTML(loc = curLoc()) { return inBag(loc, () => bulkHTML_(loc = curLoc())); }
function bulkHTML_(loc = curLoc()) {
  const items = bulkItems(loc), all = items.reduce((a, id) => a + S.inv[id] * bulkPrice(id, loc), 0);
  const rows = items.map((id) => `<div class="row" data-bulk-row="${id}"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name} ×${S.inv[id]}</b><small>${bulkPrice(id, loc)} each here · ${loc === 'orchard' ? ostandPrice(id) : standPrice(id)} on the stand</small></div>
    <div class="acts"><button class="btn sm" data-bulk="${id}" data-loc="${loc}" data-n="1">Sell 1</button><button class="btn btn-gold sm" data-bulk="${id}" data-loc="${loc}" data-n="all">All · ${coin(S.inv[id] * bulkPrice(id, loc))}</button></div></div>`).join('');
  return `<div class="bulk-hero">${FEATURE_ART.bulkbox || ''}<p>Drop in anything extra — it sells <b>instantly</b> for <b>${Math.round(BULK.k * 100)}%</b> of the ${loc === 'orchard' ? 'Orchard' : 'Farm'} Stand price. Customers pay full price, so shelve what fits first.</p></div>
    <div class="sec-title">Sells here · ${loc === 'orchard' ? 'the Orchard' : 'Home'}</div>
    ${rows ? `<div class="list">${rows}</div>${items.length > 1 ? `<div class="ts-actions"><button class="btn btn-primary" data-act="bulk-all-${loc}">Sell everything here · ${coin(all)}</button></div>` : ''}` : '<div class="empty">Nothing here sells at this location right now.</div>'}
    ${elsewhereHTML(loc)}`;
}
function bulkSell(id, n, loc = curLoc()) { return inBag(loc, () => bulkSell_(id, n, loc = curLoc())); }
function bulkSell_(id, n, loc = curLoc()) {
  if (bulkBlocked(loc)) { toast(loc === 'orchard' ? 'Build the Orchard Stand first' : 'The Farm Stand is still being built'); return 0; }
  if (!sellsAt(id, loc)) { toast(`${ITEMS[id]?.name || 'That'} · ${sellTag(id)}`); return 0; }
  const q = Math.min(S.inv[id] || 0, n === 'all' ? Infinity : n); if (q <= 0) return 0;
  const each = bulkPrice(id, loc), total = q * each;
  S.inv[id] -= q; S.coins += total; const st = S.stats; st.bulkSold = (st.bulkSold || 0) + q; st.bulkEarned = (st.bulkEarned || 0) + total;
  save(); hud(); checkGoals(); if (panel) renderPanel();
  W.bulkPop?.(loc); toast(`📦 Bulk sold ${q} ${ITEMS[id].name} · +${total} coins`);
  return total;
}
function bulkAll(loc = curLoc()) { return inBag(loc, () => bulkAll_(loc = curLoc())); }
function bulkAll_(loc = curLoc()) { let t = 0, q = 0; for (const id of bulkItems(loc)) { const n = S.inv[id]; const each = bulkPrice(id, loc); S.inv[id] = 0; t += n * each; q += n; }
  if (!q) return 0; S.coins += t; S.stats.bulkSold = (S.stats.bulkSold || 0) + q; S.stats.bulkEarned = (S.stats.bulkEarned || 0) + t;
  save(); hud(); checkGoals(); if (panel) renderPanel(); W.bulkPop?.(loc); sfx('coin'); toast(`📦 Bulk sold ${q} items · +${t} coins`); return t; }

// v0.67.1: Market item classes. ONE-TIME items (single builds and unique features) leave the Market once bought.
// Everything else always stays buyable: CONSUMABLES (supplies, seeds, saplings, bases, water) and REPEATABLE / STACKABLE items
// (Irrigation: one card at Home that levels up with copies + one Orchard tree row per purchase; Parking copies; Honeybee Skeps, one per plot).
const MKT_ONE_TIME = new Set(['tincture', 'still', 'teastand', 'windmill', 'billboard', 'press', 'opress', 'fruitstand', 'sundial', 'sickle', 'plow', ...CHARM_IDS, ...Object.keys(CRAFT)]);
const MKT_STACK = ['irrigation', 'parking'];   // owned once, then each Market buy adds a card copy (levels it up)
const MKT_CONSUMABLE = ['wood5', 'scrap5', 'sapling', 'glycerin', 'glycerin5', 'vinegar', 'vinegar5', 'fill-barrels', 'seed_*', 'tree_*'];
const MKT_REPEAT = ['irrigation', 'parking', 'beehive', 'buy-treerow'];
const copyPrice = (id) => FEATURES[id].price;
const copyMax = (id) => nextAt(id) == null || (+S.cards[id]?.n || 0) >= CARD_LEVELS.thresholds[CARD_LEVELS.thresholds.length - 1];
function buyCopy(id) {   // v0.67.1: stackables stay buyable — another card copy (it levels the card up)
  if (!MKT_STACK.includes(id) || (!S.marketBuilt && id !== 'parking')) return false; const p = copyPrice(id);   // v0.68.1: Parking copies are sold in the Build menu too
  if (copyMax(id)) { toast(`${FEATURES[id].name} has every copy it can use`); return false; }
  if (S.coins < p) { toast(`You need ${p - S.coins} more coins`); return false; }
  S.coins -= p; sfx('buy'); S.stats.marketBuys = (S.stats.marketBuys || 0) + 1; S.discovered[id] = S.unlocked[id] = true; if (id !== 'parking') S.owned[id] = true; const c = addCard(id);
  if (id === 'parking' && canUpgrade(id)) { upgradeCard(id); syncParking(); return true; }   // v0.68.1: a Parking Lot copy that reaches the next level levels it up at once (Home and Orchard lots)
  save(); hud(); if (panel) renderPanel();
  toast(`+1 ${FEATURES[id].name} card · ${c.n} cop${c.n === 1 ? 'y' : 'ies'}${canUpgrade(id) ? ' · ready to level up!' : ''}`); return true;
}
const copyRow = (id, sub) => { const p = copyPrice(id), mx = copyMax(id), up = canUpgrade(id);
  return `<div class="row copy-row" data-copy-row="${id}"><div class="ico">${FEATURE_ART[id]}</div><div class="meta"><b>${FEATURES[id].name} · Lv${cardLv(id)}</b><small>${sub} · ${+S.cards[id]?.n || 0} cop${(+S.cards[id]?.n || 0) === 1 ? 'y' : 'ies'}${mx ? ' · fully stacked' : ' · buy another card to level it up'}</small></div><div class="acts">${up ? `<button class="btn btn-gold sm" data-upgrade="${id}">✨ Lv${cardLv(id) + 1}</button>` : ''}${mx ? '' : `<button class="btn btn-primary sm" data-act="buy-copy-${id}" data-price="${p}" ${S.coins < p ? 'disabled' : ''}>${coin(p)}</button>`}</div></div>`; };
// where a consumable bought here is used: bases go to the Home Bag (Tincture Stand), seeds to the Home Bag unless this place has beds
const mktDest = (id, at = curLoc()) => (at === 'home' ? 'home' : BASES[id] || BASES[id.slice(0, -1)] ? 'home' : id.startsWith('seed_') && !S.beds.some((b) => lotLoc(lotOfSite(b)) === 'orchard') ? 'home' : at);
function marketHTML() {
  if (!S.marketBuilt) {
    return `<div class="hero locked-hero"><img src="assets/market.jpg" alt=""/><p>${S.marketProj ? 'Being rebuilt…' : 'Boarded up — for now'}</p></div>
      <p class="muted" style="margin:4px 4px 12px">The old Supply Market sold seeds, water, Wood and Card Packs. It has to be <b>rebuilt</b> before it can open again.</p>
      <div class="build-list">${projectCard('market')}</div>
      ${curLoc() === 'orchard' && S.inv.sapling ? `<div class="list" style="margin-top:12px">${saplingRow(false)}</div>` : ''}
      <button class="jewel-strip" data-act="open-jewels" style="margin-top:12px"><i data-icon="jewel"></i><span><b>${S.jewels} Jewels</b><small>Jewel Shop</small></span><em>Shop</em></button>`;
  }
  let h = `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh seeds &amp; fair prices</p></div>${rewardHTML()}<button class="daily-strip" data-act="open-daily"><b>🌼 Daily gift</b><small>${dailyStatus().can ? 'Ready to claim!' : `Streak ${S.daily.streak} · come back tomorrow`}</small></button>
    <div class="seg"><button data-tab="buy" class="${marketTab === 'buy' ? 'on' : ''}">Supplies</button><button data-tab="packs" class="${marketTab === 'packs' ? 'on' : ''}">Card Packs</button></div>`;
  if (marketTab === 'packs') return h + packsHTML();
  const rows = [], sec = { seeds: [], saplings: [], supplies: [], water: [], build: [], garden: [] };   // v0.68.1: grouped into sections
  // v0.65: each location has its own Market — it sells only what is usable there, and the van delivers to this location's Bag
  const at = curLoc(), atHome = at === 'home', bedsHere = atHome || S.beds.some((b) => lotLoc(lotOfSite(b)) === 'orchard');
  rows.push(`<p class="muted mkt-loc" data-mkt-loc-note="${at}" style="margin:2px 4px 8px">${vanOn() ? '🚚 Orders are delivered to your' : '📦 Orders go straight into your'} <b>${atHome ? 'Home' : 'Orchard'} Bag</b>.</p>`);
  sec.supplies.push(buyRow('wood5', `<i data-icon="wood" style="width:40px;height:40px"></i>`, 'Bundle of Wood', `+${SHOP.wood5.wood} Wood · you have ${S.wood}`, SHOP.wood5.price));
  if (scrapUsable(at)) sec.supplies.push(buyRow('scrap5', `<i data-icon="scrap" style="width:40px;height:40px"></i>`, `Scrap Metal ×${SHOP.scrap5.scrap}`, `For the Windmill and repairs · cheaper by recycling finds while clearing · you have ${S.scrap}`, SHOP.scrap5.price));
  if (!atHome && S.lots.orchard) sec.saplings.push(saplingRow(true));
  if (!atHome && S.lots.orchard && nextIrrigRow()) { const nx = nextIrrigRow(), rs = rowsOwned();   // v0.67.1: Tree-row Irrigation, one row per purchase
    sec.water.push(`<div class="row treerow-row" data-mkt-treerow><div class="ico">${FEATURE_ART.irrigation}</div><div class="meta"><b>Irrigation · tree rows</b><small>One row per purchase · ${nx ? `Drips Row ${rowNo(nx)} (${lotName(nx.lot)}) · waters its trees after every pick` : 'Every row you own is irrigated'} · ${rs.filter(rowIrrigated).length}/${rs.length} rows</small></div><div class="acts"><button class="btn btn-primary sm" data-act="buy-treerow" ${nx && S.coins >= TREE_IRRIG.coins ? '' : 'disabled'}>${coin(TREE_IRRIG.coins)}</button>${nx ? '' : '<small class="opt-note irrig-why" data-irrig-why>No tree rows need irrigation</small>'}</div></div>`); }   // v0.65: trees are sold only in the Orchard Market
  // v0.52: the Rain Barrel is built from the Build menu now; the market sells a water truck that fills your barrels instead.
  { const nb = Object.keys(S.barrels).length;
    if (nb && truckQuote().need) { const q = truckQuote(), per = WATER_TRUCK.perBarrel,   /* v0.7.2.2: only while a barrel needs filling */ pl = (n) => `${n} barrel${n === 1 ? '' : 's'}`;
      const sub = !q.need ? `${nb === 1 ? 'Your barrel is' : `All ${nb} barrels are`} already full · the truck only bills barrels it fills (${per} coins each)`
        : `A water truck fills ${q.need === nb ? `all ${pl(nb)}` : `${q.need} of your ${pl(nb)}`} to full · ${per} coins per barrel filled${q.can < q.need ? (q.can ? ` · you can pay for ${pl(q.can)} now (emptiest first)` : ` · you need ${per} coins`) : ''}`;
      sec.water.push(`<div class="row truck-row"><div class="ico">${TRUCK_SVG}</div><div class="meta"><b>Fill Rain Barrels</b><small>${sub}</small></div><div class="acts"><button class="btn btn-primary sm" data-act="fill-barrels" data-fill="${S.freeTrucks > 0 ? q.need : q.can}" ${q.can || (S.freeTrucks > 0 && q.need) ? '' : 'disabled'}>${S.freeTrucks > 0 ? `Free · ${S.freeTrucks} left` : coin((q.can || q.need || 0) * per)}</button></div></div>`); } }
  // v0.5: every unlocked plant is for sale (tier-coloured label, grow time, flower price). Locked Basic plants keep their own row;
  // locked higher-tier plants are folded into one compact row per tier so the list stays short.
  const seedNote = mktDest('seed_x', at) === at ? '' : ' · goes to your Home Bag';
  // v0.68.1: flower seeds are sold at the Home Market only (the Orchard sells trees)
  if (atHome) for (const t of TIER_ORDER) { const sps = Object.keys(SPECIES).filter((sp) => SPECIES[sp].tier === t), T = PLANT_TIERS[t];
    for (const sp of [...sps].sort((a, b) => SPECIES[b].seedPrice - SPECIES[a].seedPrice || SPECIES[a].name.localeCompare(SPECIES[b].name))) { const d = SPECIES[sp]; if (S.unlocked[sp]) sec.seeds.push(buyRow('seed_' + sp, `<img src="${d.img}" alt=""/>`, `${d.name} Seeds`, `<em class="tier-tag t-${t}">${T.label}</em> · blooms in ~${fmtTime(d.growS * 1000)} · ${d.noFlower ? `${d.seedsFixed} seeds a harvest, no flowers` : `flowers sell for ${d.flowerSell}`} · you have ${inBag(mktDest('seed_' + sp, at), () => S.inv['seed_' + sp])}${seedNote}`, d.seedPrice));
      else if (t === 'basic') sec.seeds.push(lockedRow(`<img src="${d.img}" alt=""/>`, `${d.name} Seeds`)); }
    const locked = sps.filter((sp) => !S.unlocked[sp]);
    if (SHOW_LOCKED && t !== 'basic' && locked.length) sec.seeds.push(`<div class="row locked tier-locked" data-tier-locked="${t}"><div class="ico"><span class="tier-gem t-${t}"></span></div><div class="meta"><b><em class="tier-tag t-${t}">${T.label}</em> ${locked.length === sps.length ? `${sps.length} plants` : `${locked.length} more`}</b><small>Discover ${locked.map((sp) => SPECIES[sp].name).join(', ')} in Card Packs (${T.pack}% a card)</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`); }
  // v0.7.1: one plain row — a price to buy (one bed per purchase), disabled with a reason when no bed needs irrigation
  if ((atHome || bedsHere) && S.unlocked.irrigation && irrigNeedBeds().some((b) => lotLoc(lotOfSite(b)) === at)) {   // v0.7.2.2: only while a bed here can use it
    { const nb = S.beds.length, ni = S.irrigBeds.length;
      sec.water.push(`<div class="row irrig-buy" data-irrig-buy><div class="ico">${FEATURE_ART.irrigation}</div><div class="meta"><b>Irrigation${hasIrrig() ? ` · Lv${irrigLv()}` : ''}</b><small>A drip line from its rain barrel to one raised bed · ${ni}/${nb} bed${nb === 1 ? '' : 's'} irrigated · ${bedWaterLine(hasIrrig() ? irrigLv() : 1)} · each purchase levels the card up · tap a bed to place it</small>${mktTag('irrigation')}</div><div class="acts">${irrigBuyBtn()}</div></div>`); } }
  // v0.52: buildings are bought AND placed in one step — the button starts placement, the price is paid when the spot is confirmed.
  // Owned-but-unbuilt ones (older saves) get a Build button right here.
  const ownedRow = (id, built, sub) => `<div class="row${standOkAt(id, curLoc()) ? '' : ' dim'}"><div class="ico">${FEATURE_ART[id]}</div><div class="meta"><b>${FEATURES[id].name}</b><small>${sub}</small>${mktTag(id)}</div>${built ? (canUpgrade(id) ? `<div class="acts"><button class="btn btn-gold sm" data-upgrade="${id}">✨ Lv${cardLv(id) + 1}</button></div>` : '') : `<div class="acts"><button class="btn btn-primary sm" data-act="build-${id}">Build</button></div>`}</div>`;   // v0.65: built features left the bag, so they upgrade here too
  if (atHome) for (const id of ['tincture', 'still']) { const F = FEATURES[id], built = S[id + 'Built'], pos = S[id === 'tincture' ? 'tincPos' : 'stillPos'];
    if (id === 'tincture' && !S.owned.tincture) { sec.build.push(coinUnlockRow('tincture')); if (SHOW_LOCKED) sec.build.push(`<div class="row locked tinc-reward"><div class="ico">${FEATURE_ART.tincture}</div><div class="meta"><b>${F.name}</b><small>Not for sale — a free reward for the goal “${GOALS.find((g) => g.reward === 'tincture').text.split(' · ')[0]}”</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`); continue; }
    if (S.owned[id]) continue;   // v0.65: one-time purchase — gone from the Market once bought (build it from the Build menu)
    if (id === 'still' && S.unlocked.still && !tincLots().length) continue;   // v0.7.2.2: hidden until there is a plot to put it on
    sec.build.push(S.owned[id] ? ownedRow(id, built, built ? `Owned · built on ${lotName(pos?.lot || 'home')}` : id === 'tincture' ? `Yours · not placed yet · free${tincLots().length ? '' : ' · buy a neighbouring plot first'}` : `Owned · not built yet · ${woodTag(BUILDS.still.wood)} on one of your other plots`)
      : !S.unlocked[id] ? coinUnlockRow(id) : placeRow(id, `${ftag(id)} · pick a spot on another plot — paid when you place it${tincLots().length ? '' : ' · buy a neighbouring plot first'} · ${id === 'tincture' ? 'steep flowers into tinctures' : 'distill seeds into oils'}`)); }
  if (atHome && !S.owned.teastand) { const F = FEATURES.teastand;
    sec.build.push(S.owned.teastand ? ownedRow('teastand', S.teaBuilt, S.teaBuilt ? `Owned · brewing on ${lotName(S.teaPos?.lot || 'home')}` : `Owned · not built yet · ${woodTag(BUILDS.teastand.wood)} on any plot you own`)
      : S.unlocked.teastand ? placeRow('teastand', `${ftag('teastand')} · pick a spot on any Home plot you own — paid when you place it · blend dried herbs into teas`) : coinUnlockRow('teastand')); }
  for (const c of Object.keys(CRAFT).filter((c) => c !== 'opress' && standOkAt(c, at))) { const C = CRAFT[c];   // v0.6 (v0.66.1: the Orchard Oil Press is bought from the Orchard Build menu)
    if (c === 'fruitstand' && !S.owned.fruitstand) { if (SHOW_LOCKED) sec.build.push(`<div class="row locked"><div class="ico">${FEATURE_ART.fruitstand}</div><div class="meta"><b>Fruit Stand</b><small>Not for sale — comes free with the Orchard</small></div><span class="loc-tag">Orchard only</span></div>`); continue; }
    if (S.owned[c]) continue;   // v0.65: one-time
    sec.build.push(S.owned[c] ? ownedRow(c, S[C.built], S[C.built] ? `Owned · built on ${lotName(S[C.pos]?.lot || 'home')}` : `Owned · not built yet · ${BUILDS[c].wood ? woodTag(BUILDS[c].wood) : 'free'} on ${c === 'fruitstand' ? 'an Orchard plot' : 'any plot you own'}`)
      : S.unlocked[c] ? placeRow(c, `${ftag(c)} · pick a spot on any plot you own — paid when you place it · ${C.blurb.toLowerCase()}`) : COIN_STANDS.has(c) ? coinUnlockRow(c) : lockedRow(FEATURE_ART[c], C.name)); }
  // v0.6: Orchard saplings — one per tree card you have found (planting needs the Orchard)
  if (!atHome) { const found = TREE_IDS.filter((t) => S.unlocked[t]);
    // v0.68.1: the Saplings section header is added with the other Market sections below
    for (const t of [...found].sort((a, b) => TREES[b].saplingPrice - TREES[a].saplingPrice || TIER_ORDER.indexOf(TREES[b].tier) - TIER_ORDER.indexOf(TREES[a].tier) || TREES[a].name.localeCompare(TREES[b].name))) { const d = TREES[t], price = d.saplingPrice, T = PLANT_TIERS[d.tier], free = orchardSpots().filter((q) => q.ok).length;
      sec.saplings.push(`<div class="row tree-sap" data-tree-row="${t}"><div class="ico">${FEATURE_ART[t]}</div><div class="meta"><b>${d.name} sapling</b><small><em class="tier-tag t-${d.tier}">${T.label}</em> · first fruit in ~${fmtTime(d.growS * 1000 * treeLvK(t))}, then every ${fmtTime(d.cycleS * 1000 * treeLvK(t))} · ${d.yield} ${d.fruitName.toLowerCase()} (${d.fruitSell} each)${S.lots.orchard ? ` · ${free} free spot${free === 1 ? '' : 's'}` : ' · buy the Orchard to plant'}</small></div>
        <div class="acts"><button class="btn btn-primary sm" data-buy="tree_${t}" data-price="${price}" ${S.coins >= price && S.lots.orchard && free ? '' : 'disabled'}>${coin(price)}</button></div></div>`); }
    if (S.lots.orchard && !found.length) sec.saplings.push(`<p class="muted" style="margin:4px">Find fruit-tree cards in Card Packs to unlock saplings.</p>`); }
  if (atHome && !S.owned.windmill) { const F = FEATURES.windmill;
    sec.build.push(S.owned.windmill ? ownedRow('windmill', S.windmillBuilt, S.windmillBuilt ? `Owned · turning on ${lotName(S.windmillPos?.lot || 'home')} · barrels refill every ${regenS()} s` : `Owned · not built yet · ${woodTag(BUILDS.windmill.wood)} ${scrapTag(BUILDS.windmill.scrap)} anywhere on your land`)
      : S.unlocked.windmill ? placeRow('windmill', `${ftag('windmill')} · needs ${BUILDS.windmill.scrap} Scrap Metal (you have ${S.scrap}) · all connected barrels refill every ${WINDMILL.regenS[0]} s instead of ${WATER_REGEN_S} s`) : lockedRow(FEATURE_ART.windmill, F.name)); }
  // v0.68.1: Parking Lot + Billboard at both Markets. Parking Lot cards always stay buyable: each one counts toward the next level
  // (shared by the Home and Orchard lots); a lot you haven't built here yet is bought & built from its own row.
  { const pid = trafId('parking', at), bid = trafId('billboard', at), anyLot = S.owned.parking || S.owned.oparking;
    // v0.7.2.2: a bought Parking Lot leaves the Market for good (more Parking Lot cards still come from Card Packs)
    const tRow = (id) => { const T = TRAF[id], b = T.base, c = buyCost(id), g = trafGate(id), o = T.loc === 'orchard';
      return `<div class="row place-buy" data-traffic-row="${id}"><div class="ico">${FEATURE_ART[b]}</div><div class="meta"><b>${o ? 'Orchard ' : ''}${FEATURES[b].name}</b><small>${ftag(b)} · built by the ${o ? 'Orchard ' : ''}road as soon as you buy it · ${b === 'parking' ? `${g ? g.split(' — ')[0] + ' · ' : ''}customers arrive 2 cars at a time · more Parking Lot cards level it up (up to 6 spots)` : `Run ad: ${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min, 1-hour cool-off`}</small></div><div class="acts"><button class="btn btn-primary sm buy-place" data-buy="${id}" data-price="${c.coins}" ${canPay(c) && !g ? '' : 'disabled'}>${[coin(c.coins), c.wood && woodTag(c.wood)].filter(Boolean).join('')}</button></div></div>`; };
    for (const [id, b] of [[pid, 'parking'], [bid, 'billboard']]) { if (S.owned[id] || S[TRAF[id].key]) continue;
      if (S.unlocked[b] && !trafGate(id)) sec.build.push(tRow(id)); } }   // v0.7.2.2: hidden until unlocked and buildable here
  if (atHome) for (const b of SUPPLY_CARDS) { const d = BASES[b], hb = inBag('home', () => S.inv[b]);   // v0.67.1: consumable — always buyable · v0.7: Home Market only (Tincture bases are used at Home only)
    sec.supplies.push(...(baseOpen(b) ? [buyRow(b, itemSvg(b), d.name, `${d.blurb} · for the Tincture Stand · you have ${hb}${atHome ? '' : ' · goes to your Home Bag'}`, d.price), buyRow(b + '5', itemSvg(b), `${d.name} ×${d.pack.n}`, `Pack of ${d.pack.n} · save ${d.price * d.pack.n - d.pack.price} coins`, d.pack.price)]   // v0.68: two rows, so each sorts by its own price
      : [])); }   // v0.7.2.1: not listed at all (not even greyed out) until the Tincture Stand is built
  { const d = FEATURES.beehive, need = hiveLots().filter((l) => lotLoc(l) === at && S.beds.some((b) => lotOfSite(b) === l)), more = need.length - (S.hiveInv || 0);   // v0.7.2.2: only plots here with a bed (the bees boost beds)
    if (S.unlocked.beehive && (S.hiveInv > 0 || more > 0)) sec.garden.push(!S.unlocked.beehive ? ''
      : S.hiveInv > 0 ? `<div class="row"><div class="ico">${FEATURE_ART.beehive}</div><div class="meta"><b>${d.name}</b><small>You have ${S.hiveInv} to place</small></div><div class="acts"><button class="btn btn-primary sm" data-act="place-hive">Place</button></div></div>`
      : more > 0 ? placeRow('beehive', `${ftag('beehive')} · tap a spot on ${need.map(lotName).join(' or ')} — paid when you place it · +${HIVE_BONUS} flower per harvest on that plot only · one per plot`)
      : `<div class="row"><div class="ico">${FEATURE_ART.beehive}</div><div class="meta"><b>${d.name}</b><small>${S.hiveInv > 0 ? `You have ${S.hiveInv} to place` : `${Object.keys(S.hives).length} placed · every plot you own has one`}</small></div>${S.hiveInv > 0 ? '<div class="acts"><button class="btn btn-primary sm" data-act="place-hive">Place</button></div>' : ''}</div>`); }
  for (const f of ['sundial', ...CHARM_IDS, 'sickle', 'plow'].filter((f) => S.beds.some((b) => lotLoc(lotOfSite(b)) === at) || !FEATURES[f].tool)) {   /* v0.7.2.2: tools only where there are beds */   // v0.65: + the garden charms (hidden until their card is found)
    const d = FEATURES[f], fx = CHARMS[f] ? charmText(f) : d.blurb.replace(/^Once bought( and placed)?, /, '').replace('A reusable tool. ', '');
    const up = canUpgrade(f) ? `<button class="btn btn-gold sm" data-upgrade="${f}">✨ Lv${cardLv(f) + 1}</button>` : '';
    if (S.owned[f] || inTransit(f)) continue;   // v0.65: one-time purchase — leaves the Market as soon as it is bought (the van brings it to the Bag)
    if (inTransit(f)) sec.garden.push(`<div class="row" data-gf-transit="${f}"><div class="ico">${FEATURE_ART[f]}</div><div class="meta"><b>${d.name}</b><small>🚚 On the delivery van · ${fx}</small></div></div>`);
    else if (S.owned[f] && isGF(f)) { const pl = gfPlaced(f);
      sec.garden.push(`<div class="row charm-row" data-charm="${f}"><div class="ico">${FEATURE_ART[f]}</div><div class="meta"><b>${d.name}${CHARMS[f] ? ` · Lv${charmLv(f)}` : ''}</b><small>${pl ? `Owned · on your land (${lotName(pl.lot)})` : 'Owned · in your Bag, not placed yet (no effect until placed)'} · ${fx}</small></div><div class="acts">${up}${pl ? '' : `<button class="btn btn-primary sm" data-place-gf="${f}">Place</button>`}</div></div>`); }
    else if (S.owned[f]) sec.garden.push(`<div class="row"><div class="ico">${FEATURE_ART[f]}</div><div class="meta"><b>${d.name}</b><small>Owned · ${fx}</small></div>${d.tool ? `<div class="acts"><button class="btn btn-primary sm" data-act="use-${f}">Use</button></div>` : ''}</div>`);
    else sec.garden.push(S.unlocked[f] ? buyRow(f, FEATURE_ART[f], d.name, d.blurb.replace(/^Once bought( and placed)?, /, '') + (isGF(f) ? ' · delivered by van to your Bag' : ''), d.price) : lockedRow(FEATURE_ART[f], d.name));
  }
  const more = Object.keys(CARDS).some((k) => !S.unlocked[k] && (!TREES[k] || S.lots.orchard));
  // v0.68.1: clear sections with headers (each still sorted highest value first)
  const SEC = atHome ? [['seeds', 'Seeds'], ['supplies', 'Supplies'], ['water', 'Water &amp; irrigation'], ['build', 'Buildings &amp; features'], ['garden', 'Garden charms &amp; tools']]
    : [['saplings', 'Tree saplings'], ['supplies', 'Supplies'], ['water', 'Water &amp; irrigation'], ['build', 'Buildings &amp; features'], ['garden', 'Garden charms &amp; tools']];
  for (const [k, title] of SEC) { const list = sec[k].filter(Boolean); if (!list.length) continue; rows.push(`<div class="sec-title mkt-sec" data-mkt-sec="${k}">${title}</div>`, ...list); }
  if (more) rows.push(`<p class="muted empty-hint" data-empty-hint>Open Card Packs to discover more.</p>`);
  return h + `<button class="jewel-strip" data-act="open-jewels"><i data-icon="jewel"></i><span><b>${S.jewels} Jewels</b><small>Jewel Shop</small></span><em>Shop</em></button><div class="list">${sortRows(rows).join('')}</div>`;
}
const buyRow = (id, icon, name, sub, price) => `<div class="row"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>${sub}</small></div><div class="acts"><button class="btn btn-primary sm" data-buy="${id}" data-price="${price}" ${S.coins < price ? 'disabled' : ''}>${coin(price)}</button></div></div>`;
const mktTag = (id) => (STAND_IDS.has(id) ? `<em class="loc-tag sm" data-mkt-loc="${id}">${whereTag(id)}</em>` : '');
const placeRow = (id, sub) => { const c = buyCost(id); return `<div class="row place-buy${!STAND_IDS.has(id) || standOkAt(id, curLoc()) ? '' : ' dim'}"><div class="ico">${FEATURE_ART[id]}</div><div class="meta"><b>${FEATURES[id].name}</b><small>${sub}</small>${mktTag(id)}</div><div class="acts"><button class="btn btn-primary sm buy-place" data-buy="${id}" data-price="${c.coins}" ${canPay(c) ? '' : 'disabled'}>${[coin(c.coins), c.wood && woodTag(c.wood), c.scrap && scrapTag(c.scrap)].filter(Boolean).join('')}</button></div></div>`; };
const lockedRow = (icon, name) => !SHOW_LOCKED ? '' : `<div class="row locked"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>Discover it in a Card Pack to unlock</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`;
// v0.52: Tree sapling — a plain Supply Market item: buy one, then plant it (Plant button, or straight after buying).
function saplingRow(canBuy) {
  const p = SHOP.sapling.price;
  return `<div class="row sapling-row"><div class="ico"><i data-icon="sapling" style="width:40px;height:40px"></i></div><div class="meta"><b>Tree sapling</b><small>Grows in ~${fmtTime(TREE_MS)} into a big tree (${TREE.wood} Wood) · you have ${S.inv.sapling}</small></div><div class="acts">${S.inv.sapling ? '<button class="btn sm" data-act="place-sapling">Plant</button>' : ''}${canBuy ? `<button class="btn btn-primary sm" data-buy="sapling" data-price="${p}" ${S.coins < p ? 'disabled' : ''}>${coin(p)}</button>` : ''}</div></div>`;
}
// v0.52: Fill Rain Barrels. A water truck tops every barrel that isn't full up to full and bills WATER_TRUCK.perBarrel per barrel
// it filled (already-full barrels are free). Short of coins, it fills as many as you can pay for, emptiest first.
const TRUCK_SVG = `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M2 22h44" stroke="#C9B9A0" stroke-width="2"/><rect x="4" y="9" width="24" height="11" rx="5.5" fill="#EEF2EE" stroke="#5E97AA" stroke-width="1.6"/><path d="M10 9v11M22 9v11" stroke="#5E97AA" stroke-width="2"/><path d="M28 10h8l6 6v5H28z" fill="#5E97AA" stroke="#3E6F80" stroke-width="1.4" stroke-linejoin="round"/><path d="M31 12h4l4 4h-8z" fill="#CFE6EE"/><circle cx="10" cy="23" r="3" fill="#5A4A44"/><circle cx="20" cy="23" r="3" fill="#5A4A44"/><circle cx="36" cy="23" r="3" fill="#5A4A44"/><path d="M16 12.5c-1.6 2.2-2.2 3.2-2.2 4a2.2 2.2 0 004.4 0c0-.8-.6-1.8-2.2-4z" fill="#7FB9D0"/></svg>`;
function truckQuote() {
  regenBarrels();
  const list = Object.entries(S.barrels).filter(([, b]) => b.w < regenMax(b)).sort((a, b) => a[1].w - b[1].w);
  return { list, need: list.length, can: Math.min(list.length, Math.floor(S.coins / WATER_TRUCK.perBarrel)), max: regenMax() };
}
let truck = null;
function fillBarrels() {
  if (!S.marketBuilt) return false;
  const q = truckQuote(), per = WATER_TRUCK.perBarrel;
  if (!q.need) { toast('Every rain barrel is already full — the truck has nothing to fill'); return false; }
  const free = S.freeTrucks > 0;   // v0.67: a truckload from the Gardener's Pack fills every barrel for free
  if (!free && !q.can) { toast(`The water truck charges ${per} coins per barrel — you need at least ${per} coins`); return false; }
  const lots = q.list.slice(0, free ? q.need : q.can).map(([l]) => l), bill = free ? 0 : lots.length * per, left = q.need - lots.length; if (free) S.freeTrucks--;
  for (const l of lots) { const b = S.barrels[l]; b.w = regenMax(b); b.at = now(); }
  S.coins -= bill; S.stats.truckFills = (S.stats.truckFills || 0) + 1; S.stats.truckBarrels = (S.stats.truckBarrels || 0) + lots.length;
  S.lastTruck = { at: now(), lots, bill, left };
  syncBarrels(); autoIrrigate(); save(); hud(); closePanel();
  const pl = (n) => `${n} barrel${n === 1 ? '' : 's'}`;
  toast(`🚚 Water truck on its way to fill ${pl(lots.length)}`);
  if (truck && truck.state !== 'out') truck.leave();
  const c = truck = W.spawnTruck({ stopX: -10.6, onPark: (car) => {
    W.poof(car.group.position.clone().setY(1.3), '#8EC5E0', 22, 2.2);
    lots.forEach((l, k) => setTimeout(() => { const b = S.barrels[l]; if (!b) return; W.poof(V3(b.x, 1.0, b.z), '#8EC5E0', 18, 2); popAt(V3(b.x, 1.6, b.z), `<i data-icon="water"></i>Filled ${regenMax(b)}/${regenMax(b)}`); }, 300 + k * 320));
    setTimeout(() => toast(`🚚 Water truck filled ${pl(lots.length)} · billed ${bill} coins${left ? ` · ${pl(left)} left unfilled (not enough coins)` : ''}`), 300);
    setTimeout(() => { car.leave(); if (truck === c) truck = null; }, 2600 + lots.length * 320); } });
  return { filled: lots.length, bill, left };
}
// ---------------- v0.65: Supply Market orders come by delivery van ----------------
// Paying is instant; the goods arrive with the van a few seconds later (TRUCK.ms). Orders placed while a van is still on its
// way ride along on that trip; later ones queue as the next trip (≥ TRUCK.gap after it). Deliveries are saved with their
// arrival time, so an order still lands if you change location or close the game (any overdue one is handed over on load).
const TRUCK = { ms: 4000, gap: 3500, park: 1400, late: 1500, from: 30 };
// v0.67.1: the delivery van only runs once the Map's production location is open (a later Map spot, not built yet), so for now
// the van never appears and Market orders, sent goods and placed buys arrive at once (as before v0.65). VAN_LOT is the one
// switch: when that location exists and is bought (S.lots[VAN_LOT]), the van turns back on. ('petalspire.vanTest' forces it for tests.)
const VAN_LOT = 'production';
const vanOn = () => !!S.lots?.[VAN_LOT] || !!localStorage.getItem('petalspire.vanTest');
const truckTimed = () => vanOn() && !(navigator.webdriver && !localStorage.getItem('petalspire.truckTest'));
const inTransit = (id) => (S.deliv || []).some((d) => d.id === id);
const vanOut = new Map();   // trip key → van (in memory only)
const DELIV_STOP = { home: () => SPOTS.market[0], orchard: () => ORCH_X - 3.2 };
const delivName = (id) => (ITEMS[id] && !id.startsWith('seed_') ? ITEMS[id].name : FEATURES[id] ? FEATURES[id].name : id === 'wood5' ? `${SHOP.wood5.wood} Wood` : id === 'scrap5' ? `${SHOP.scrap5.scrap} Scrap Metal` : id.startsWith('seed_') ? ITEMS[id].name.replace(' Seeds', ' seed') : BASES[id] ? BASES[id].name : BASES[id.slice(0, -1)] ? `${BASES[id.slice(0, -1)].pack.n} ${BASES[id.slice(0, -1)].name}` : ITEMS[id]?.name || id);
// v0.65: every delivery goes to one location's Bag (d.loc) — the Market you ordered from, or the place you sent goods to.
// opt = { loc, n, send } — send: goods moved from your other Bag (n of item id), free.
const locName = (l) => (l === 'orchard' ? 'the Orchard' : 'Home');
function orderDelivery(id, opt = {}) {
  const t = now(), loc = opt.loc || curLoc(); let trip = S.trip && (S.trip.loc || 'home') === loc && S.trip.at - t > 700 ? S.trip : null;   // still on its way there: ride along
  if (!trip) trip = S.trip = { k: S.uid++, loc, at: Math.max(t + TRUCK.ms, (S.trip?.at || 0) + TRUCK.gap) };
  S.deliv.push({ id, at: trip.at, k: trip.k, loc, ...(opt.send ? { send: true, n: opt.n } : {}) });
  const n = S.deliv.filter((d) => d.k === trip.k).length;
  toast(`🚚 ${opt.send ? `${opt.n} ${ITEMS[id]?.name || id}` : delivName(id)} ${opt.send ? `on the van to ${locName(loc)}` : 'is on the delivery van'}${n > 1 ? ` (${n} loads this trip)` : ''} · arrives in ~${Math.max(1, Math.round((trip.at - t) / 1000))} s`);
  syncDeliv();
}
const summary = (list) => { const c = {}; for (const d of list) c[d.id] = (c[d.id] || 0) + (d.send ? d.n : 1); return Object.entries(c).map(([id, n]) => `${delivName(id)}${n > 1 ? ` ×${n}` : ''}`).join(', '); };
function deliverTrip(k, quiet = false) {
  const list = S.deliv.filter((d) => d.k === k); if (!list.length) return [];
  S.deliv = S.deliv.filter((d) => d.k !== k); if (S.trip?.k === k && !S.deliv.length) S.trip = null;
  const loc = list[0].loc || 'home';
  inBag(loc, () => { for (const d of list) { if (d.send) S.inv[d.id] = (S.inv[d.id] || 0) + d.n; else grantBuy(d.id, true); } });
  S.stats.deliveries = (S.stats.deliveries || 0) + 1;
  writeSave(); hud(); if (panel) renderPanel();
  if (!quiet) toast(`📦 Delivered${loc !== curLoc() ? ` to ${locName(loc)}` : ''}: ${summary(list)}${list.some((d) => isGF(d.id)) ? ' · place it from your Bag' : ''}`);
  return list;
}
// v0.65: Send goods to your other location's Bag — they ride the delivery van (free)
function sendGoods(id, n) {
  if (!S.lots.orchard) return false; const from = curLoc(), to = from === 'orchard' ? 'home' : 'orchard', bag = bagOf(from);
  const q = Math.min(bag[id] || 0, n === 'all' ? Infinity : +n || 1); if (q <= 0 || !ITEMS[id] && id !== 'sapling' && !BASES[id] || id === 'sapling' && to === 'home') return false;   // v0.65: trees are Orchard-only
  bag[id] -= q; S.stats.sent = (S.stats.sent || 0) + q;
  if (!truckTimed()) { bagOf(to)[id] = (bagOf(to)[id] || 0) + q; toast(`📦 Sent ${q} ${ITEMS[id]?.name || id} to ${locName(to)}`); }
  else orderDelivery(id, { loc: to, n: q, send: true });
  save(); hud(); if (panel) renderPanel(); return q;
}
const sendBtns = (id) => (S.lots.orchard ? `<button class="btn sm" data-send="${id}" data-n="1">Send 1</button><button class="btn btn-primary sm" data-send="${id}" data-n="all">Send all to ${curLoc() === 'orchard' ? 'Home' : 'Orchard'}</button>` : '');
// every tick: start the van for a trip that is due soon (at the location you are looking at), and hand over anything overdue
function syncDeliv() {
  if (!S.deliv?.length) return; const t = now();
  if (!vanOn()) { for (const k of [...new Set(S.deliv.map((d) => d.k))]) deliverTrip(k); return; }   // v0.67.1: no van yet — hand everything over at once
  for (const k of [...new Set(S.deliv.map((d) => d.k))]) {
    const at = S.deliv.find((d) => d.k === k).at;
    if (t >= at + TRUCK.late) { deliverTrip(k); continue; }   // the van never made it on screen (other location, paused tab…) — still delivered
    const tl = S.deliv.find((d) => d.k === k).loc || 'home';
    if (!vanOut.has(k) && tl === curLoc() && at - t <= TRUCK.ms + 200 && at - t > 600 && !placing && !buildMode) {   // v0.65: the van drives up only where the goods are going
      const loc = tl, ox = loc === 'orchard' ? ORCH_X : 0, stopX = DELIV_STOP[loc]();
      const T = (at - t) / 1000, from = Math.min(30, Math.max(8, T * 7));   // v0.65: a timed drive-in, so it parks right when the trip is due
      const van = W.spawnVan({ stopX, ox, from, T, onPark: (car) => {
        const n = S.deliv.filter((d) => d.k === k).length;
        W.dropCrates(car.group.position.x, ROAD.z0 - 0.45, n);
        deliverTrip(k);
        setTimeout(() => { car.leave(); vanOut.delete(k); }, TRUCK.park);
      } });
      if (van) vanOut.set(k, van);
    }
  }
}
// on load: anything that arrived while the game was closed is handed over at once
function deliverOverdue() {
  if (!S.deliv?.length) return; const t = now(), due = S.deliv.filter((d) => d.at <= t || !vanOn()); if (!due.length) return;   // v0.67.1: pending van trips in older saves are delivered at once
  const ks = [...new Set(due.map((d) => d.k))], got = []; for (const k of ks) got.push(...deliverTrip(k, true));
  if (got.length) setTimeout(() => toast(`📦 Delivered while you were away: ${summary(got)}`), 1200);
}
function buy(id, price) {
  if (PLACE_BUY[id]) return startBuy(id);   // v0.52: one step — place it, pay on confirm
  if (S.coins < price || !S.marketBuilt) return;
  if (id === 'scrap5' && !scrapUsable()) return;   // v0.7.2.2: no Scrap from the Market before a Windmill here
  { const b = BASES[id] ? id : BASES[id.slice(0, -1)] ? id.slice(0, -1) : null; if (b && !baseOpen(b)) { toast(baseNeeds(b).join(' · ')); return; } }   // v0.52
  if (TRAF[id] && (S.owned[id] || S[TRAF[id].key])) return;   // v0.7.2.2: a Parking Lot / Billboard is bought once per location
  if (MKT_STACK.includes(id) && (S.owned[id] || (id === 'parking' && S.owned.oparking))) return buyCopy(id);   // v0.67.1: stackables stay buyable
  if (FEATURES[id] && !BASES[id] && (S.owned[id] || inTransit(id))) return;   // v0.65: a feature is bought once (also while its truck is on the way)
  S.coins -= price; S.stats.marketBuys = (S.stats.marketBuys || 0) + 1; sfx('buy');
  { const dest = mktDest(id); if (dest !== curLoc()) { inBag(dest, () => grantBuy(id)); return; } }   // v0.67.1: used elsewhere → straight to that Bag
  if (!truckTimed()) return grantBuy(id);   // automated test browsers: delivered at once unless a test opts in ('petalspire.truckTest')
  orderDelivery(id); save(); hud(); if (panel) renderPanel();
}
// v0.65: what a Supply Market order puts in your inventory (on delivery). quiet = the delivery truck shows one summary toast instead.
function grantBuy(id, quiet = false) {
  const say = quiet ? () => {} : toast;
  if (id === 'wood5') S.wood += SHOP.wood5.wood; else if (id === 'scrap5') S.scrap += SHOP.scrap5.scrap; else if (id === 'sapling') S.inv.sapling++;
  else if (id.startsWith('seed_')) S.inv[id]++; else if (id === 'irrigation') { if (hasIrrig()) { addCard('irrigation'); save(); hud(); if (panel) renderPanel(); return; } S.owned.irrigation = true; addCard('irrigation'); } else if (BASES[id]) S.inv[id]++; else if (BASES[id.slice(0, -1)]) S.inv[id.slice(0, -1)] += BASES[id.slice(0, -1)].pack.n; else if (id === 'beehive') { if (hiveLots().length <= (S.hiveInv || 0)) { S.coins += FEATURES.beehive.price; return; } S.hiveInv = (S.hiveInv || 0) + 1; S.owned.beehive = true; } else if (FEATURES[id]) S.owned[id] = true;
  if (isGF(id)) { S.gfInv[id] = (S.gfInv[id] || 0) + 1; (S.gfBought ||= {})[id] = (S.gfBought[id] || 0) + 1; }   // v0.65: a BOUGHT garden feature arrives in the bag, ready to place (the only way into the bag)
  save(); hud(); if (panel) renderPanel();
  if (id === 'beehive') { say('Honeybee Skep bought — tap clear ground on the plot it should help'); setTimeout(() => enterPlace('hive'), 500); return; }
  if (id === 'sapling') { say('Bought a tree sapling — tap open ground to plant it'); setTimeout(() => enterPlace('sapling'), 500); return; }
  if (isGF(id)) { say(`${FEATURES[id].name} is in your Bag — tap Place there to set it on your land`); return; }
  if (id === 'sickle' || id === 'plow') { say(`${FEATURES[id].name} bought — tap its button on the left to use it`); setTimeout(() => tip(id), 600); return; }
  if (id === 'windmill') { say('Windmill bought — build it anywhere on your land from the Build menu (20 Wood)'); return; }
  if (id === 'parking' || id === 'billboard') { syncBlueprints(); say(`${FEATURES[id].name} bought — build it by the road from the Build menu (${BUILDS[id].wood} Wood)`); return; }
  if (id === 'still') { say(tincLots().length ? 'Essential Oil Stand bought — build it on one of your other plots (Build menu)' : 'Essential Oil Stand bought — buy a neighbouring plot first, then build it there'); return; }
  if (id === 'tincture') { syncBlueprints(); say(tincLots().length ? 'Tincture Stand bought — build it on one of your other plots (Build menu)' : 'Tincture Stand bought — buy a neighbouring plot first, then build it there'); return; }
  if (BASES[id] || BASES[id.slice(0, -1)]) { const b = BASES[id] ? id : id.slice(0, -1); say(`+${BASES[id] ? 1 : BASES[b].pack.n} ${BASES[b].name} · you have ${S.inv[b]}`); return; }
  if (id === 'irrigation') { say('Irrigation bought — tap a raised bed to hook it up to its rain barrel'); setTimeout(() => enterPlace('irrigation'), 500); return; }
  say(id === 'wood5' ? `+${SHOP.wood5.wood} Wood` : id === 'scrap5' ? `+${SHOP.scrap5.scrap} Scrap Metal · you have ${S.scrap}` : id.startsWith('seed_') ? `Bought 1 ${ITEMS[id].name.replace(' Seeds', ' seed')}` : `${FEATURES[id].name} added to your garden`);
}
const collIds = () => Object.keys(CARDS).filter((k) => !TREES[k] || S.lots.orchard || S.discovered[k]);   // tree cards show once the Orchard is yours
function packsHTML() {
  const disc = Object.keys(CARDS).filter((k) => S.discovered[k]);
  // v0.5: odds per card, by plant tier (plus all feature cards together)
  // v0.51: one tier system for every card. Each chip is that tier's share of a card slot (its plants + its feature cards).
  // v0.63: 2 plant cards + 1 other card per pack — odds are shown per slot type
  const chip = (t, v) => `<span class="t-${t}" style="border-color:${PLANT_TIERS[t].color};color:${PLANT_TIERS[t].color}">${PLANT_TIERS[t].label} ${+v.toFixed(2)}%</span>`;
  const odds = `<div class="odds-label" data-odds-plants>2 plant cards · each</div>${TIER_ORDER.map((t) => chip(t, catTierOdds(true, t))).join('')}
    <div class="odds-label" data-odds-other>1 feature, tool, stand or supply card</div>${TIER_ORDER.filter((t) => catTierOdds(false, t) > 0).map((t) => chip(t, catTierOdds(false, t))).join('')}`;
  const allBasicPct = Math.pow(catTierOdds(true, 'basic') / 100, PACK_MIX.plants) * Math.pow(catTierOdds(false, 'basic') / 100, PACK_MIX.other) * 100;
  const tierLine = (t) => { const p = catTierOdds(true, t), o = catTierOdds(false, t); return [p ? `${+p.toFixed(2)}% a plant card` : '', o ? `${+o.toFixed(2)}% the other card` : ''].filter(Boolean).join(' · '); };
  // v0.61: only cards you have discovered are shown (no '?' backs, no totals) so the rest stay a surprise
  const group = (title, ids, cls = '') => { if (!SHOW_LOCKED) { const got = ids.filter((k) => S.discovered[k]); return got.length ? `<div class="sec-title coll-tier ${cls}">${title} · ${got.length} found</div><div class="coll">${got.map(cardHTML).join('')}</div>` : ''; }
    return `<div class="sec-title coll-tier ${cls}">${title} · ${ids.filter((k) => S.discovered[k]).length}/${ids.length}</div><div class="coll">${ids.map((k) => (S.discovered[k] ? cardHTML(k) : `<div class="card"><div class="back" style="position:absolute;inset:0;border-radius:1.1em;opacity:.55"><img src="assets/emblem.png" alt=""/><span>?</span></div></div>`)).join('')}</div>`; };
  return `<div class="pack-hero"><div class="pack-art"><img src="assets/pack.jpg" alt="Botanical card pack"/></div>
    <div class="pack-info"><h4>Botanical Card Pack</h4><p>3 illustrated cards: <b>2 plants + 1 feature, tool, stand or supply card</b>, plus a bonus of coins${scrapUsable() ? `, wood &amp; Scrap Metal (up to ${PACK_LOOT.coins} · ${PACK_LOOT.wood} · ${PACK_LOOT.scrap})` : ` &amp; wood (up to ${PACK_LOOT.coins} · ${PACK_LOOT.wood})`}. New discoveries unlock seeds &amp; features here at the market.</p>
    ${S.freePacks > 0 ? `<button class="btn btn-gold" data-act="buy-pack" data-free-pack>Open free pack${S.freePacks > 1 ? ` (${S.freePacks})` : ''}</button>` : S.jewels >= PACK_JEWELS ? `<button class="btn btn-gold" data-act="buy-pack">Open pack · ${jewelPrice(PACK_JEWELS)}</button>`
      : `<button class="btn btn-gold need-jewels" data-act="open-jewels">Need ${PACK_JEWELS} Jewel${PACK_JEWELS > 1 ? 's' : ''} · Jewel Shop</button>`}
    <small class="pack-note">You have ${S.jewels} <i data-icon="jewel"></i> · Jewels come from the Jewel Shop or, rarely, the woods</small></div></div>
    <div class="odds">${odds}</div>
    <p class="pack-swap-odds" data-swap-odds><b>Swap · ${SWAP.jewels} Jewel</b> (on a Basic, Epic or Legendary card in a reveal): a random Rare-or-better plant or garden item — ${SWAP_TIERS().map((t) => `${PLANT_TIERS[t].label} ${+swapTierOdds(true, t).toFixed(1)}%`).join(' · ')}. Cards you own count ${Math.round(OWNED_K * 100)}% as much.</p>
    <p class="pack-guarantee" data-guarantee><b>Every pack has at least one Epic or better.</b> If all 3 cards roll Basic (${+allBasicPct.toFixed(1)}% of packs), the feature card is redrawn from Epic-or-better with the same relative odds. Cards you already own are ${Math.round(OWNED_K * 100)}% as likely, so new cards turn up sooner.</p>
    ${!S.lots.orchard && !S.mapOpen && !SHOW_LOCKED ? '' : S.lots.orchard ? `<p class="pack-orchard" data-orchard-pool><b>Orchard owned:</b> the 14 fruit-tree cards are in the pack now (2 per tier).</p>` : `<p class="pack-orchard" data-orchard-pool>Buy <b>The Orchard</b> on the <b>Map</b> (after every Home plot) to add 14 fruit-tree cards to the pack.</p>`}
    <div class="sec-title">Your collection · ${SHOW_LOCKED ? `${disc.length}/${collIds().length}` : `${disc.length} discovered`}</div>
    ${TIER_ORDER.map((t) => { const pl = Object.keys(SPECIES).filter((k) => SPECIES[k].tier === t), fe = Object.keys(FEATURES).filter((k) => FEATURES[k].rarity === t && CARDS[k]), tr = collIds().filter((k) => TREES[k] && TREES[k].tier === t);
      return group(SHOW_LOCKED ? `<em class="tier-tag t-${t}">${PLANT_TIERS[t].label}</em> ${tierLine(t)} · ${pl.length} plants${tr.length ? ` + ${tr.length} tree${tr.length > 1 ? 's' : ''}` : ''}${fe.length ? ` + ${fe.length} feature${fe.length > 1 ? 's' : ''}` : ''}` : `<em class="tier-tag t-${t}">${PLANT_TIERS[t].label}</em> ${tierLine(t)}`, [...pl, ...tr, ...fe], 't-' + t); }).join('')}
    ${disc.length < collIds().length ? `<p class="muted empty-hint" data-empty-hint>${disc.length ? 'Open packs to discover more.' : 'Open packs to start your collection.'}</p>` : ''}`;
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
    return `<div class="row"><div class="ico">${itemSvg(f)}</div><div class="meta"><b>Fresh ${d.name} ×${S.inv[f]}</b><small>Dries in ${Math.round(DRYING[sp].s * rackK())}s · sells for ${sellOf('dried_' + sp)} (fresh: ${sellOf(f)})</small></div>
    <div class="acts"><button class="btn btn-blush sm" data-act="fill-rack" data-sp="${sp}" ${S.inv[f] && S.rack.includes(null) ? '' : 'disabled'}>Hang all</button></div></div>`; }).join('');
  const dried = dryables().filter((sp) => S.inv['dried_' + sp] > 0).map((sp) => `${S.inv['dried_' + sp]} Dried ${SPECIES[sp].name}`);
  return `<div class="hero"><img src="assets/rack.jpg" alt=""/><p>Hang fresh ${dryables().length > 1 ? 'herbs' : 'Lavender'} to dry</p></div>${upgHTML('rack')}<div class="slots">${slots}</div>
    ${rows}
    ${dried.length ? `<p class="muted" style="margin:10px 4px 0">You have ${dried.join(', ')} — put it on your Farm Stand.</p>` : ''}`;
}
const hang = (...a) => inBag('home', () => hang_(...a));
const hang_ = (k, sp = rackPick()) => { const f = 'flower_' + sp; if (S.rack[k] || !sp || !DRYING[sp] || !(S.inv[f] > 0)) return false; S.inv[f]--; S.rack[k] = { start: now(), ms: Math.round(DRYING[sp].s * 1000 * rackK()), sp }; return true; };
function collect(k) { return inBag('home', () => collect_(k)); }
function collect_(k) { const r = S.rack[k]; if (!r || now() - r.start < r.ms) return; const sp = r.sp || 'lavender', id = 'dried_' + sp; S.rack[k] = null; S.inv[id] = (S.inv[id] || 0) + 1; toast(`+1 ${ITEMS[id].name}`); }
function afterRack() { save(); hud(); renderPanel(); syncRack(); }

const orchardLocked = () => LOT_FOR_SALE.some((l) => !S.lots[l]);   // v0.6: every Home plot first (incl. the Back Woods)
// ---------------- v0.61: Garden Workers ----------------
// Hidden until every Home plot is bought (S.mapOpen). One worker per owned plot. During a 6-hour shift (real time; offline
// time is caught up like irrigation) a worker, on its own plot only: harvests ripe plants and replants the same species
// from Bag seeds (skipped if none), waters from that plot's barrel (both Blue Lotus barrel fills), picks ripe fruit trees,
// collects and restarts the stands standing on that plot (using the normal recipes and ingredients), and restocks the
// location's selling stand with what it made (Farm Stand at Home, Orchard Stand at the Orchard — sell-by-location rules).
const shiftH = () => WORKER.shiftH + charmV('pocketwatch');   // v0.65: + Gardener's Pocket Watch hours
const SHIFT_MS = () => shiftH() * 3600000;
// v0.7: '1 hour' / '1 h 15 min' / '24 hours'
const shiftTxt = (h = shiftH()) => { const mn = Math.round(h * 60), hh = Math.floor(mn / 60), r = mn % 60; return r ? (hh ? `${hh} h ${r} min` : `${r} min`) : `${hh} hour${hh === 1 ? '' : 's'}`; };
function workersOn() { return !!S.mapOpen; }
function workerLoc(lot) { lot = wkLotOf(lot); return ORCH_LOTS.includes(lot) ? 'orchard' : 'home'; }
// v0.7.2: ONE Gardener and ONE Market Manager per location (Home, the Orchard), not per plot. Keys: 'home' / 'orchard' for the
// Gardener, 'home~m' / 'orchard~m' for the Manager. The Gardener tends every bed and tree on that location's plots; the Manager
// runs every stand there and fills the location's selling stand. Each works 1 real-time hour per hire (WORKER.hire).
// Pacing: a worker has a time budget (the real time since its last pass) and every task it does costs the same time the
// walking worker spends on it (WK_MS: a bed tended, a tree picked, a stand run, a stock trip), so one worker covering many
// plots is not instant. Both pick their next task at random: no favouring the priciest seed, recipe or product.
function locLots(loc) { return loc === 'orchard' ? ORCH_LOTS.filter((l) => S.lots[l]) : ['home', ...LOT_FOR_SALE].filter((l) => l === 'home' || S.lots[l]); }
function locLabel(loc) { return loc === 'orchard' ? 'the Orchard' : 'Home'; }
function wkKey(lot, r = 'g') { return r === 'm' ? lot + '~m' : lot; }   // (function declarations: boot uses these before this line runs)
function wkLotOf(k) { return String(k).replace(/~m$/, ''); }
function wkRoleOf(k) { return String(k).endsWith('~m') ? 'm' : 'g'; }
function wkName(k) { return wkRoleOf(k) === 'm' ? 'Market Manager' : 'Gardener'; }
function wkRec(k) { return (wkRoleOf(k) === 'm' ? S.managers : S.workers)[wkLotOf(k)]; }
function wkAll() { return [...Object.keys(S.workers), ...Object.keys(S.managers || {}).map((l) => l + '~m')]; }
const rndOf = (a) => (a.length ? a[Math.floor(Math.random() * a.length)] : undefined);
function lotBedTiles(lot) { return S.beds.flatMap((sid, b) => (lotOfSite(sid) === lot ? bedTiles(b) : [])); }
function locBeds(loc) { const ls = locLots(loc); return S.beds.map((sid, b) => (ls.includes(lotOfSite(sid)) ? b : -1)).filter((b) => b >= 0); }
function locStands(loc) { return [...new Set(locLots(loc).flatMap((l) => workStands(l)))]; }
function workStands(lot) { return workStands0(lot).filter((k) => !consLeft(k)); }   // v0.63: skip stands still being built
function workStands0(lot) {
  const out = lotRoofs(lot).filter((r) => r !== 'stand' && r !== 'market' && r !== 'orchardshed');
  if (S.rackBuilt && SPOTS.rack && lotAt(SPOTS.rack[0], SPOTS.rack[1]) === lot) out.unshift('rack');
  return out;
}
function workerStatus(lot) { const w = wkRec(wkKey(workerLoc(lot), wkRoleOf(lot))); if (!w) return null; const left = w.end - now(); return left > 0 ? { working: true, left, txt: `Working · ${fmtTime(left)} left` } : { working: false, left: 0, txt: 'Shift over · hire again' }; }
function workerSpot(lot) {
  const b = S.beds.findIndex((sid) => lotOfSite(sid) === lot), near = b >= 0 ? bedCenter(b) : (([x, z]) => ({ x, z }))(lotCenter(lot));
  if (b >= 0) {   // just outside the bed's rim, behind it first (facing the camera across the bed, never hidden by a stand)
    const r = SITE_HALF + 0.42, c = [[0.45, -1], [-0.45, -1], [-1, -0.4], [1, -0.4], [-1, 0.35], [1, 0.35], [0, 1]].map(([dx, dz]) => ({ x: +(near.x + dx * r).toFixed(2), z: +(near.z + dz * r).toFixed(2) }));
    const inBed = (p) => S.beds.some((sid) => { const st = siteById(sid); return Math.abs(p.x - st.x) < SITE_HALF + 0.2 && Math.abs(p.z - st.z) < SITE_HALF + 0.2; });
    const ok = c.filter((p) => lotAt(p.x, p.z) === lot && !inBed(p));
    return ok.find((p) => !placeProblem(p.x, p.z)) || ok[0] || freeSpot(lot, near) || near;
  }
  return freeSpot(lot) || near;
}
function hireWorker(lot, role = 'g') {
  const loc = workerLoc(lot); lot = loc; const k = wkKey(loc, role), book = role === 'm' ? S.managers : S.workers, nm = wkName(k);
  if (!workersOn() || (loc === 'orchard' && !S.lots.orchard) || book[loc]) return false;
  const pass = role === 'g' && S.gardenerPasses > 0;   // v0.67: a Gardener's Pack hire — free, one 24 h shift (Gardener only)
  if (!pass && S.coins < WORKER.hire) { toast(`A ${nm} costs ${WORKER.hire} coins an hour`); return false; }
  let p = workerSpot(lot); if (role === 'm') { const g = S.workers[lot], q = g ? { x: +(g.x + 0.9).toFixed(2), z: g.z } : { x: +(p.x + 0.9).toFixed(2), z: p.z }; p = locLots(loc).includes(lotAt(q.x, q.z)) && !placeProblem(q.x, q.z) ? q : (freeSpot(lot, p) || q); }
  if (pass) S.gardenerPasses--; else S.coins -= WORKER.hire;
  book[lot] = { x: p.x, z: p.z, hired: now(), end: now() + (pass ? (S.gardenerPassH || 24) * 3600e3 : SHIFT_MS()), pass, done: { harvests: 0, planted: 0, watered: 0, picked: 0, made: 0, stocked: 0, tea: 0 }, made: [] };
  S.stats.workersHired = (S.stats.workersHired || 0) + 1;
  W.addWorker(k, p.x, p.z, true); W.setWorker(k, 'work'); save(); hud(); renderPanel();
  toast(`${role === 'm' ? '🧺 A Market Manager is running every stand at' : '🌿 A Gardener is tending every plot at'} ${locLabel(loc)} for ${pass ? shiftTxt(S.gardenerPassH || 24) : shiftTxt()}`); sfx('buy'); workerPass(k); return true;
}
function payWorker(k) {
  k = wkKey(workerLoc(k), wkRoleOf(k)); const w = wkRec(k), nm = wkName(k); if (!w || now() < w.end) return false;
  if (S.coins < WORKER.wage) { toast(`Hiring the ${nm} again costs ${WORKER.wage} coins`); return false; }
  S.coins -= WORKER.wage; w.hired = now(); w.last = now(); w.debt = 0; w.pass = false; w.end = now() + SHIFT_MS(); w.ended = false; w.done = { harvests: 0, planted: 0, watered: 0, picked: 0, made: 0, stocked: 0, tea: 0 };
  S.stats.workerPay = (S.stats.workerPay || 0) + WORKER.wage;
  W.setWorker(k, 'work'); save(); hud(); renderPanel(); if (selected != null) renderSheet();
  toast(`${wkRoleOf(k) === 'm' ? '🧺' : '🌿'} ${nm} hired again for ${WORKER.wage} coins · ${shiftTxt()} at ${locLabel(workerLoc(k))}`); sfx('buy'); workerPass(k); return true;
}
const workerKeep = (loc) => locBeds(loc).length * BED_N * BED_N;   // seeds of each kind held back for replanting
// v0.7.2 pacing: time budget for this pass = real time since the last pass (≥ one live step, ≤ one catch-up step), minus overrun
function wkBudget(w) { const dt = Math.min(WORKER.catchStepS * 1000, Math.max(WORKER.stepS * 1000, now() - (w.last || w.hired || now()))); return dt - (w.debt || 0); }
// v0.7.2: the seed a Gardener plants into an empty plot: any seed in this location's Bag, picked at random (no favouring price)
const workerSeed = () => rndOf(Object.keys(SPECIES).filter((sp) => S.inv['seed_' + sp] > 0 && ITEMS['flower_' + sp])) || null;
function workerPass(k) { workerBusy++; try { return inBag(workerLoc(k), () => (wkRoleOf(k) === 'm' ? managerPass_(k) : workerPass_(k))); } finally { workerBusy--; } }
// Gardener: plants, harvests, waters and picks on every plot of its location (beds and fruit trees), in random order, as far
// as its time budget goes. It makes nothing and stocks nothing.
function workerPass_(lot) {
  const w = S.workers[lot]; if (!w || now() >= w.end) return 0;
  const loc = workerLoc(lot), d = w.done || (w.done = {}), made = new Set(w.made || []); let n = 0, B = wkBudget(w); quiet++;
  const J = clockAt == null ? [] : null, job = (a, at, o = {}) => { if (J && at) J.push({ a, x: at[0], z: at[1], ...o }); };   // v0.65: visual jobs for the walking gardener (live passes only)
  try {
    const ls = locLots(loc), units = [...locBeds(loc).map((b) => ({ b })), ...ORCHARD_TREE_SPOTS.filter((sp) => ls.includes(sp.lot) && S.orchard[sp.k]).map((t) => ({ t }))].sort(() => Math.random() - 0.5);
    for (const u of units) { if (B <= 0) break; let cost = 0;
      if (u.b != null) { const tiles = bedTiles(u.b), at = bedCenter(u.b), xz = [at.x, at.z]; let h = 0, pl = 0, wa = 0, col;
        // harvest ripe plants, replant the same species from Bag seeds
        for (const i of tiles) { const p = S.tiles[i]; if (!p || stageOf(p) < 3) continue; const r = harvestCore(i); if (!r) continue; h++; col = SPECIES[r.sp]?.color;
          if (S.inv['seed_' + r.sp] > 0) { plant(i, r.sp); pl++; } else syncTile(i); }
        // fill the bed's empty spots with random seeds from this location's Bag
        for (const i of tiles) { if (S.tiles[i]) continue; const sp = workerSeed(); if (!sp) break; plant(i, sp); if (S.tiles[i]?.sp === sp) pl++; else break; }
        // water thirsty plants from the barrel (a Blue Lotus barrel needs two passes: half, then full)
        for (const i of tiles) { let g = 40; while (g-- > 0 && thirsty(S.tiles[i]) && water(i, true)) wa++; }
        if (h) { d.harvests = (d.harvests || 0) + h; cost += WK_MS.pick; job('pick', xz, { bed: u.b, color: col }); }
        if (pl) { d.planted = (d.planted || 0) + pl; cost += WK_MS.plant; job('plant', xz, { bed: u.b }); }
        if (wa) { d.watered = (d.watered || 0) + wa; cost += WK_MS.water; job('water', xz, { bed: u.b }); }
        n += h + pl + wa;
      } else { const sp = u.t, t = S.orchard[sp.k];
        if (t && orchRipe(t, now()) && pickTree(sp.k)) { n++; d.picked = (d.picked || 0) + 1; made.add(TREES[t.sp].fruit); cost += WK_MS.pick; job('pick', [sp.x, sp.z], { tree: sp.k, color: TREES[t.sp].fruitC || '#E0604A' }); }
        // v0.67.1: water a tree after picking (from this plot's barrel, else any Orchard barrel)
        if (S.orchard[sp.k]?.dry && waterTree(sp.k, true, clockAt ?? now())) { n++; d.watered = (d.watered || 0) + 1; cost += WK_MS.water; job('water', [sp.x, sp.z], { tree: sp.k }); } }
      B -= cost; }
  } finally { quiet--; }
  if (J && J.length) wkQueue(lot, J);
  w.debt = B < 0 ? -B : 0; w.made = [...made].slice(-40); w.last = now();
  if (n) { save(); hud(); }
  return n;
}
// Market Manager: runs every stand of its location (rack, tinctures, still, tea, presses, jars …): collects what is done and
// restarts it with a random recipe, and makes stock trips to the location's selling stand, in random order as far as its time
// budget goes. Dried herbs go into empty Tea Stand spots first; only herbs no tea can use go to the stand.
const teaHasRoom = () => S.teaBuilt && !consLeft('teastand') && S.teas.includes(null);
function managerPass_(k) {
  const lot = wkLotOf(k), w = S.managers[lot]; if (!w || now() >= w.end) return 0;
  const loc = workerLoc(lot), d = w.done || (w.done = {}), made = new Set(w.made || []); let n = 0, B = wkBudget(w); quiet++;
  const J = clockAt == null ? [] : null, job = (a, at, o = {}) => { if (J && at) J.push({ a, x: at[0], z: at[1], ...o }); };
  try {
    const st = locStands(loc), spare = (id) => (S.inv[id] || 0) - (id.startsWith('seed_') ? workerKeep(loc) : 0);
    const run = (c) => { let m = 0; const before = { ...S.inv };
      // collect finished goods at this stand
      if (c === 'rack') S.rack.forEach((r, i) => r && now() - r.start >= r.ms && collect(i));
      else if (c === 'tincture') S.tinc.forEach((t, i) => t && collectTincture(i));
      else if (c === 'still') S.stills.forEach((t, i) => t && collectOil(i));
      else if (c === 'teastand') S.teas.forEach((t, i) => t && collectTea(i));
      else if (CRAFT[c]) S[CRAFT[c].slots].forEach((t, i) => t && craftCollect(c, i));
      for (const [id, q] of Object.entries(S.inv)) if (q > (before[id] || 0)) { made.add(id); d.made = (d.made || 0) + q - (before[id] || 0); m++; }
      // dried herbs fill empty Tea Stand spots before anything else (a random blend of the herbs on hand)
      if (c === 'teastand') for (let g = 0; g < 4 && teaHasRoom(); g++) {
        const pool = []; for (const sp of Object.keys(DRYING)) for (let q = 0; q < (S.inv['dried_' + sp] || 0); q++) pool.push(sp);
        if (pool.length < TEA.n) break; const pick = [];
        for (let q = 0; q < TEA.n; q++) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        if (!brewTea(pick)) break; m++; d.tea = (d.tea || 0) + 1; }
      // start new batches, each recipe picked at random from what the Bag can make
      if (c === 'tincture') for (let g = 0; g < 9 && S.tinc.includes(null); g++) { const r = rndOf(Object.entries(TINCTURE.recipes).filter(([sp, x]) => recipeOpen(sp) && (S.inv['flower_' + sp] || 0) >= x.n)); if (!r || !craftTincture(r[0])) break; m++; }
      if (c === 'still') for (let g = 0; g < 9 && S.stills.includes(null); g++) { const r = rndOf(Object.entries(STILL.recipes).filter(([sp, x]) => (x.in ? S.unlocked[sp] || S.inv[x.in] > 0 : recipeOpen(sp)) && spare(x.in || 'seed_' + sp) >= x.n)); if (!r || !distill(r[0])) break; m++; }
      if (CRAFT[c]) { const C = CRAFT[c]; for (let g = 0; g < 9 && S[C.slots].includes(null); g++) { const r = rndOf((C.def.recipes || []).filter((x) => recipeHere(c, x) && recipeKnown(x) && spare(x.in) >= x.n)); if (!r || !craftMake(c, r.id)) break; m++; } }
      if (c === 'rack') { for (let i = 0; i < S.rack.length; i++) { if (S.rack[i]) continue; const sp = rndOf(Object.keys(DRYING).filter((x) => S.inv['flower_' + x] > 0)); if (sp && hang(i, sp)) m++; } syncRack(); }
      if (m) { const at = standXZ(c); if (at) job('craft', at, { stand: c }); }
      return m; };
    // a stock trip: fill this location's selling stand with what was made here (the Manager's goods + the Gardener's harvest),
    // in random order; dried herbs stay in the Bag while a Tea Stand still has an empty spot
    const stockTrip = () => { let m = 0; const g = S.workers[lot]; for (const id of g?.made || []) made.add(id);
      const ok = loc === 'orchard' ? S.oshedBuilt && !consLeft('oshed') : S.standBuilt && !consLeft('stand');   // v0.63: never restock a stand that's still being built
      if (ok) for (const id of [...made].sort(() => Math.random() - 0.5)) { if (!(S.inv[id] > 0) || !sellsAt(id, loc)) continue; if (id.startsWith('dried_') && teaHasRoom()) continue;
        const was = S.inv[id]; stock(id, 'all', loc); if (S.inv[id] < was) { d.stocked = (d.stocked || 0) + was - S.inv[id]; m++; } }
      if (m) job('stock', standXZ(loc === 'orchard' ? 'orchardshed' : 'stand'), { carry: true });
      return m; };
    for (const c of [...st, '@stock'].sort(() => Math.random() - 0.5)) { if (B <= 0) break;
      const m = c === '@stock' ? stockTrip() : run(c); if (m) { n += m; B -= c === '@stock' ? WK_MS.stock : WK_MS.craft; } }
  } finally { quiet--; }
  if (J && J.length) wkQueue(k, J);
  w.debt = B < 0 ? -B : 0; w.made = [...made].filter((id) => !id.startsWith('flower_') && !id.startsWith('fruit_')).slice(-40); w.last = now();
  if (n) { save(); hud(); }
  return n;
}
// offline: step a virtual clock from the last save to now (or the end of the shift), refilling barrels between passes
function catchUpWorkers(from = bootSavedAt, to = Date.now()) {
  const ids = wkAll(); if (!ids.length || !from || to - from < 15000) return 0;
  const step = WORKER.catchStepS * 1000; let steps = 0;
  try {
    for (let t = from + step; ; t += step) { const at = Math.min(t, to); clockAt = at; regenBarrels(); let any = false;
      for (const l of ids) { const w = wkRec(l); if (w && w.end > at - step) { clockAt = Math.min(at, w.end - 1); workerPass(l); clockAt = at; any = true; } }
      steps++; if (!any || at >= to || steps > 2000) break; }
  } finally { clockAt = null; }
  return steps;
}
function syncWorkers() {
  for (const lot of wkAll()) { const w = wkRec(lot);
    const done = now() >= w.end; W.setWorker(lot, done ? 'pay' : 'work');
    if (done && !w.ended) { w.ended = true; save(); toast(`${wkRoleOf(lot) === 'm' ? '🧺' : '🌿'} The ${wkName(lot)} at ${locLabel(workerLoc(lot))} finished their ${w.pass ? shiftTxt(S.gardenerPassH || 24) : shiftTxt()} shift · hire again for ${WORKER.wage} coins`); if (panel === 'worker' && panelArg === lot) renderPanel(); }
  }
}

// ---------------- v0.65: walking gardeners (visual only — workerPass has already done the work; this shows it) ----------------
// Each live pass queues jobs; the gardener walks a grid path around beds, buildings and trees to each one, plays a pose there
// (water / kneel to plant / bend to pick / reach at a stand), carries a basket to the stand, then wanders or rests by its spot.
// Cheap: one A* per job on a 0.4 m grid cached per location (rebuilt at most every 4 s), only for workers at the location on screen.
function standXZ(k) {
  if (k === 'stand' || k === 'market' || k === 'orchardshed' || k === 'rack') return SPOTS[k] ? [SPOTS[k][0], SPOTS[k][1]] : null;
  const pos = k === 'tincture' ? S.tincPos : k === 'still' ? S.stillPos : k === 'teastand' ? S.teaPos : CRAFT[k] ? S[CRAFT[k].pos] : null;
  return pos && isFinite(pos.x) ? [pos.x, pos.z] : null;
}
const WK_CELL = 0.4, WK_BOX = { home: { x0: -13.8, x1: 13.8, z0: -28.6, z1: 5.0 }, orchard: { x0: 279, x1: 321, z0: -28, z1: 5.0 } };
const wkGrids = {};
function wkGrid(loc, force) {
  const c = wkGrids[loc]; if (!force && c && performance.now() - c.at < 4000) return c;
  const B = WK_BOX[loc], nx = Math.ceil((B.x1 - B.x0) / WK_CELL), nz = Math.ceil((B.z1 - B.z0) / WK_CELL), bl = new Uint8Array(nx * nz);
  const circ = [];   // [x, z, r]
  for (const o of OBSTACLES) if (obsState(o.id) !== 'gone') circ.push([o.x, o.z, 0.6]);
  for (const k of ['stand', 'market', 'orchardshed', 'rack', 'tincture', 'still', 'teastand', ...Object.keys(CRAFT)]) { const built = k === 'stand' ? S.standBuilt : k === 'market' ? true : k === 'orchardshed' ? S.oshedBuilt : k === 'rack' ? S.rackBuilt : k === 'tincture' ? S.tinctureBuilt : k === 'still' ? S.stillBuilt : k === 'teastand' ? S.teaBuilt : S[CRAFT[k].built]; const at = built && standXZ(k); if (at) circ.push([at[0], at[1], k === 'market' ? 1.3 : 0.95]); }
  for (const d of [...S.decor, ...S.trees, ...(S.gf || [])]) circ.push([d.x, d.z, 0.42]);
  for (const b of [...Object.values(S.barrels || {}), ...Object.values(S.hives || {})]) if (isFinite(b.x)) circ.push([b.x, b.z, 0.5]);
  for (const sp of ORCHARD_TREE_SPOTS) if (S.orchard[sp.k]) circ.push([sp.x, sp.z, 0.5]);
  const beds = S.beds.map((id) => siteById(id)).filter(Boolean), BH = (BED_N * TILE) / 2 + 0.18;
  // land first (per cell), then stamp beds and round things into the grid — cheap even on a phone
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = B.x0 + (i + 0.5) * WK_CELL, z = B.z0 + (j + 0.5) * WK_CELL;
    const lot = lotAt(x, z); if (!(lot && S.lots[lot]) && !(z > 4.2 && lotAt(x, 4.0) && S.lots[lotAt(x, 4.0)])) bl[j * nx + i] = 1; }   // own land, plus the verge by the road
  const stamp = (x0, x1, z0, z1, test) => { const i0 = Math.max(0, Math.floor((x0 - B.x0) / WK_CELL)), i1 = Math.min(nx - 1, Math.floor((x1 - B.x0) / WK_CELL)), j0 = Math.max(0, Math.floor((z0 - B.z0) / WK_CELL)), j1 = Math.min(nz - 1, Math.floor((z1 - B.z0) / WK_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!test || test(B.x0 + (i + 0.5) * WK_CELL, B.z0 + (j + 0.5) * WK_CELL)) bl[j * nx + i] = 1; };
  for (const b of beds) stamp(b.x - BH, b.x + BH, b.z - BH, b.z + BH, (x, z) => Math.abs(b.x - x) < BH && Math.abs(b.z - z) < BH);
  for (const [cx, cz, r] of circ) stamp(cx - r, cx + r, cz - r, cz + r, (x, z) => (cx - x) ** 2 + (cz - z) ** 2 < r * r);
  return (wkGrids[loc] = { at: performance.now(), B, nx, nz, bl });
}
function wkPath(loc, from, to) {   // A* (8-way, no corner cutting) → line-of-sight smoothed waypoints; null when unreachable
  const G = wkGrid(loc), { B, nx, nz, bl } = G, ci = (x) => Math.floor((x - B.x0) / WK_CELL), cj = (z) => Math.floor((z - B.z0) / WK_CELL);
  const inG = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz, free = (i, j) => inG(i, j) && !bl[j * nx + i];
  const near = (x, z, R) => { const i0 = ci(x), j0 = cj(z); let best = null, bd = 1e9; for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { const i = i0 + di, j = j0 + dj; if (!free(i, j)) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = j * nx + i; } } return best; };
  const s0 = near(from.x, from.z, 4), g0 = near(to.x, to.z, 9); if (s0 == null || g0 == null) return null;
  const N = nx * nz, gs = new Float32Array(N).fill(Infinity), par = new Int32Array(N).fill(-1), shut = new Uint8Array(N), gi = g0 % nx, gj = (g0 / nx) | 0;
  const h = (k) => { const dx = Math.abs(k % nx - gi), dz = Math.abs(((k / nx) | 0) - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const heap = [[h(s0), s0]]; gs[s0] = 0; let it = 0;
  const push = (e) => { heap.push(e); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= e[0]) break; heap[k] = heap[p]; k = p; } heap[k] = e; };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let k = 0; for (;;) { let c = 2 * k + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= last[0]) break; heap[k] = heap[c]; k = c; } heap[k] = last; } return top; };
  while (heap.length && it++ < 12000) { const [, k] = pop(); if (shut[k]) continue; shut[k] = 1; if (k === g0) break; const i = k % nx, j = (k / nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const a = i + di, b = j + dj; if (!free(a, b) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
      const q = b * nx + a, ng = gs[k] + (di && dj ? 1.414 : 1); if (ng < gs[q]) { gs[q] = ng; par[q] = k; push([ng + h(q), q]); } } }
  if (!shut[g0]) return null;
  const cells = []; for (let k = g0; k !== -1; k = par[k]) { cells.push(k); if (k === s0) break; } cells.reverse();
  const pt = (k) => ({ x: +(B.x0 + (k % nx + 0.5) * WK_CELL).toFixed(2), z: +(B.z0 + (((k / nx) | 0) + 0.5) * WK_CELL).toFixed(2) });
  const sight = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.15); for (let m = 1; m < n; m++) { const x = a.x + (b.x - a.x) * m / n, z = a.z + (b.z - a.z) * m / n; if (!free(ci(x), cj(z))) return false; } return true; };
  const raw = cells.map(pt), out = []; let cur = { x: from.x, z: from.z }, k = 0;
  while (k < raw.length - 1) { let f = raw.length - 1; while (f > k + 1 && !sight(cur, raw[f])) f--; out.push(raw[f]); cur = raw[f]; k = f; }
  if (!out.length) out.push(raw[raw.length - 1]);
  return out;
}
const wkVis = {};   // lot → { q: [jobs], last }
const WK_MS = { water: 2600, plant: 2400, pick: 2400, craft: 2200, stock: 2400, rest: 5000 };
function wkQueue(lot, jobs) {
  const v = wkVis[lot] || (wkVis[lot] = { q: [] });
  for (const j of jobs) { const same = v.q.find((x) => x.a === j.a && ((j.bed != null && x.bed === j.bed) || (j.stand && x.stand === j.stand) || (j.a === 'stock' && x.a === 'stock'))); if (same) { same.n = (same.n || 1) + 1; continue; } v.q.push({ ...j, n: 1 }); }
  // stock trips go last, and the queue never piles up (oldest non-stock jobs drop first)
  v.q.sort((a, b) => (a.a === 'stock') - (b.a === 'stock')); while (v.q.length > 10) v.q.splice(v.q.findIndex((x) => x.a !== 'stock'), 1);
}
function wkDispatch() {
  if (!worldReady || !workersOn()) return; const here = curLoc();
  for (const lot of wkAll()) { const w = wkRec(lot);
    if (workerLoc(lot) !== here || !W.workerIdle(lot)) continue;
    const v = wkVis[lot] || (wkVis[lot] = { q: [] }), p = W.workerPose(lot); if (!p) continue;
    const working = now() < w.end; let j = working ? v.q.shift() : null;
    if (!working) v.q.length = 0;
    if (j) { const path = wkPath(here, p, j) || [{ x: j.x, z: j.z }]; const carrying = j.a === 'stock' || (p.carry && j.a !== 'stock');
      W.workerGo(lot, path, j.a, Math.min(WK_MS[j.a] * (1 + Math.min(2, (j.n || 1) - 1) * 0.35), 6000), { face: { x: j.x, z: j.z }, carry: j.a === 'pick' || carrying, color: j.color });
      if (j.a === 'stock') v.carryDone = true; v.cur = j.a; continue; }
    // idle: rest at the gardener's spot, now and then a little wander near it (off shift: walk back and wait to be paid)
    const home = { x: w.x, z: w.z }, far = Math.hypot(p.x - home.x, p.z - home.z) > 0.6;
    if (far && (!working || Math.random() < 0.6)) { W.workerGo(lot, wkPath(here, p, home) || [home], working ? 'rest' : null, working ? WK_MS.rest : 0, { carry: false }); v.cur = 'home'; }
    else if (working && Math.random() < 0.45) { const a = Math.random() * 6.283, r = 0.8 + Math.random() * 1.6, to = { x: home.x + Math.cos(a) * r, z: home.z + Math.sin(a) * r }; const path = wkPath(here, p, to); if (path && path.length) { W.workerGo(lot, path, 'rest', 2500 + Math.random() * 2500, { carry: false }); v.cur = 'wander'; } }
    else if (working) { W.workerGo(lot, [], 'rest', 3000 + Math.random() * 3000, { carry: false }); v.cur = 'rest'; }
  }
}
setInterval(wkDispatch, 350);
let workerStep = 0;
setInterval(() => {
  if (!worldReady) return; syncWorkers();
  if (++workerStep % WORKER.stepS === 0) { let any = 0; for (const lot of wkAll()) any += workerPass(lot); if (any && panel && panel !== 'worker') renderPanel(); }
  if (panel === 'worker') { const n = $('#worker-status'); const s = workerStatus(panelArg); if (n && s) n.textContent = s.txt; }
  if (selected != null) { const n = $('#sheet-worker'); const l = workerLoc(lotOfSite(bedOfTile(selected))), s = workerStatus(l); if (n && s) n.textContent = s.txt; }
}, 1000);
const GARDENER_SVG = `<svg viewBox="0 0 64 64" width="54" height="54"><ellipse cx="32" cy="60" rx="14" ry="3" fill="#000" opacity=".08"/><rect x="21" y="30" width="22" height="26" rx="10" fill="#F3E6D0"/><path d="M23 36h18v16a8 8 0 0 1-8 6h-2a8 8 0 0 1-8-6z" fill="#8FB08A"/><circle cx="32" cy="24" r="9" fill="#E8C4A0"/><circle cx="28.5" cy="24" r="1.2" fill="#3D3328"/><circle cx="35.5" cy="24" r="1.2" fill="#3D3328"/><circle cx="26.5" cy="27" r="1.6" fill="#F2A9A0" opacity=".7"/><circle cx="37.5" cy="27" r="1.6" fill="#F2A9A0" opacity=".7"/><ellipse cx="32" cy="17" rx="17" ry="3.4" fill="#E3C27A"/><path d="M24 17c0-6 16-6 16 0z" fill="#E3C27A"/><rect x="24" y="14.5" width="16" height="2.2" fill="#C2513F"/><circle cx="39" cy="14" r="2" fill="#B98BD6"/><rect x="44" y="40" width="9" height="8" rx="2" fill="#7FA6B8"/><path d="M53 42l6-4" stroke="#6C93A6" stroke-width="2" stroke-linecap="round"/></svg>`;
const MANAGER_SVG = `<svg viewBox="0 0 64 64" width="54" height="54"><ellipse cx="32" cy="60" rx="14" ry="3" fill="#000" opacity=".08"/><rect x="21" y="30" width="22" height="26" rx="10" fill="#FFF9F0"/><path d="M23 36h18v16a8 8 0 0 1-8 6h-2a8 8 0 0 1-8-6z" fill="#F7C5C5"/><circle cx="32" cy="24" r="9" fill="#E8C4A0"/><circle cx="28.5" cy="24" r="1.2" fill="#3D3328"/><circle cx="35.5" cy="24" r="1.2" fill="#3D3328"/><circle cx="26.5" cy="27" r="1.6" fill="#F2A9A0" opacity=".7"/><circle cx="37.5" cy="27" r="1.6" fill="#F2A9A0" opacity=".7"/><path d="M22 21c0-9 20-9 20 0z" fill="#3D5A40"/><rect x="22" y="19.5" width="20" height="2.4" rx="1" fill="#F5D07A"/><path d="M44 40h12l-2 10h-8z" fill="#C99A6B" stroke="#7C5634" stroke-width="1.4"/><path d="M46 40c0-4 8-4 8 0" stroke="#7C5634" stroke-width="1.6" fill="none"/><circle cx="48" cy="39" r="2" fill="#B98BD6"/><circle cx="52" cy="38.5" r="2" fill="#F5D07A"/></svg>`;
const WK_DUTY = { g: 'Plants &amp; harvests', m: 'Makes products &amp; fills the stand' };
// v0.7.2: two location-wide hire rows (Build menu › Workers), each with its own timer: Gardener and Market Manager
function wkRowOne(lot, role) {
  const k = wkKey(lot, role), s = workerStatus(k), nm = wkName(k), free = role === 'g' && S.gardenerPasses > 0;
  const line = `<small class="worker-line ${s && !s.working ? 'pay' : ''}" data-wk-line="${k}"><b>${role === 'm' ? '🧺' : '👩‍🌾'} ${nm}</b> · ${s ? s.txt : WK_DUTY[role]}</small>`;
  const btn = !s ? `<button class="btn btn-primary sm" data-act="hire-worker" data-role="${role}" data-lot="${lot}" ${S.coins >= WORKER.hire || free ? '' : 'disabled'}>${free ? `Hire · free ${S.gardenerPassH || 24} h pass` : `Hire 1 h · ${coin(WORKER.hire)}`}</button>`
    : s.working ? `<button class="btn sm" data-act="open-worker" data-lot="${k}">View</button>` : `<button class="btn btn-gold sm" data-act="pay-worker" data-lot="${k}" ${S.coins >= WORKER.wage ? '' : 'disabled'}>Hire again · ${coin(WORKER.wage)}</button>`;
  return `<div class="wk-hire" data-wk-role="${role}">${line}<div class="acts">${btn}</div></div>`;
}
function workerRowLine(lot) { const loc = workerLoc(lot); return `<div class="wk-hires" data-wk-loc="${loc}">${wkRowOne(loc, 'g')}${wkRowOne(loc, 'm')}</div>`; }
// v0.7.2: the location-wide Workers section (Build menu, above Your land): one row per worker, each with its own timer
function workersSection(loc) { if (!workersOn() || (loc === 'orchard' && !S.lots.orchard)) return '';
  return `<div class="sec-title">Workers · ${loc === 'orchard' ? 'the Orchard' : 'Home'}</div><p class="muted" style="margin:2px 4px 6px">One Gardener and one Market Manager look after every plot ${loc === 'orchard' ? 'at the Orchard' : 'at Home'}. ${coin(WORKER.hire)} each for ${shiftTxt()}.</p>${workerRowLine(loc)}`; }
function workerRowAct() { return ''; }
function workerLine(i) {
  const lot = workerLoc(lotOfSite(bedOfTile(i))), s = workerStatus(lot); if (!s) return '';
  return `<p class="worker-sheet ${s.working ? '' : 'pay'}"><span class="wk-ico">👩‍🌾</span><span><b>Gardener</b> · <span id="sheet-worker">${s.txt}</span></span>${s.working ? `<button class="btn sm" data-act="open-worker" data-lot="${lot}">Details</button>` : `<button class="btn btn-gold sm" data-act="pay-worker" data-lot="${lot}" ${S.coins >= WORKER.wage ? '' : 'disabled'}>Hire again ${WORKER.wage}</button>`}</p>`;
}
function workerHTML(k) {
  k = wkKey(workerLoc(k), wkRoleOf(k)); const lot = wkLotOf(k), role = wkRoleOf(k), nm = wkName(k), w = wkRec(k), s = workerStatus(k), loc = workerLoc(lot); if (!w) return `<p class="muted">No ${nm} at ${locLabel(loc)} yet.</p>`;
  const d = w.done || {}, st = locStands(loc).map((r) => ROOF_NAMES[r] || 'Drying Rack'), standNm = loc === 'orchard' ? 'Orchard Stand' : 'Farm Stand', nPlots = locLots(loc).length;
  const pr = s.working ? 1 - s.left / Math.max(1, w.end - (w.hired || w.end - SHIFT_MS())) : 1;
  const shift = role === 'm' ? `${d.made || 0} goods made · ${d.tea || 0} teas brewed · ${d.stocked || 0} put on the ${standNm}` : `${d.harvests || 0} harvested · ${d.planted || 0} planted · ${d.watered || 0} watered${d.picked ? ` · ${d.picked} fruit picks` : ''}`;
  const hasTrees = ORCHARD_TREE_SPOTS.some((p) => locLots(loc).includes(p.lot));
  const duty = role === 'm'
    ? `Runs every stand at ${locLabel(loc)}${st.length ? ` (the ${st.length > 1 ? st.slice(0, -1).join(', ') + ' and the ' + st[st.length - 1] : st[0]})` : ''}: collects what is done and restarts it with your ingredients, choosing recipes at random. Dried herbs go into empty Tea Stand spots first. Between stands it carries what was made here to the ${standNm}${(loc === 'orchard' ? S.oshedBuilt : S.standBuilt) ? '' : ' (once it is built)'}. One Manager walks between all of them, so each stand and stock trip takes a moment. It doesn’t plant or harvest.`
    : `Tends every bed${hasTrees ? ' and tree' : ''} on all ${nPlots} plot${nPlots === 1 ? '' : 's'} at ${locLabel(loc)}, in random order: harvests ripe plants and replants them from your Bag, fills empty bed spots with random seeds from the Bag, and waters from the barrels (Blue Lotus barrels get both fills)${hasTrees ? '. It also picks ripe fruit and waters the trees after picking' : ''}. One Gardener walks between all of them, so each bed or tree takes a moment. It doesn’t make products or stock the stand: hire a Market Manager for that.`;
  return `<div class="lot-card worker-card">${role === 'm' ? MANAGER_SVG : GARDENER_SVG}<div><b>${nm} · ${locLabel(loc).replace(/^t/, 'T')}</b><small id="worker-status" class="${s.working ? '' : 'pay'}">${s.txt}</small></div></div>
    <div class="progress"><b style="width:${(Math.min(1, pr) * 100).toFixed(1)}%"></b></div>
    <div class="sec-title">This shift</div><p class="muted" style="margin:4px">${shift}</p>
    <div class="sec-title">${loc === 'orchard' ? 'At the Orchard' : 'At Home'}</div><p class="muted" style="margin:4px">${duty}</p>
    <div class="ts-actions">${s.working ? `<button class="btn" disabled>Hired · ${fmtTime(s.left)} left</button>` : `<button class="btn btn-gold" data-act="pay-worker" data-lot="${k}" ${S.coins >= WORKER.wage ? '' : 'disabled'}>Hire again · ${coin(WORKER.wage)} · ${shiftTxt()}</button>`}</div>
    ${!s.working && S.coins < WORKER.wage ? `<p class="muted" style="margin:8px 4px 0;text-align:center">You need ${WORKER.wage - S.coins} more coins.</p>` : ''}
    <p class="muted" style="margin:10px 4px 0">A hire lasts ${shiftTxt()} of real time (the clock keeps running while you’re away) and costs ${WORKER.hire} coins. Then the ${nm} stops until you hire them again.</p>`;
}
function lotHTML(id) {
  if (ORCH_FOR_SALE.includes(id)) return orchLotHTML(id);
  const owned = !!S.lots[id]; const price = lotPrice();
  if (id === 'orchard' && !owned) { const left = LOT_FOR_SALE.filter((l) => !S.lots[l]);
    return `<div class="lot-card"><i data-icon="sign" style="width:54px;height:54px"></i><div><b>The Orchard · For sale</b><small>Room for 2 raised beds and ${ORCHARD_TREE_SPOTS.filter((q) => q.lot === 'orchard').length} fruit trees (a 4×4 grid)</small></div></div>
    <p class="muted" style="margin:10px 4px">The last plot. Buying it unlocks fruit trees: tree cards join the Card Pack odds, and the Supply Market sells saplings for every tree card you find. Trees grow slowly, then fruit again and again without replanting.</p>
    ${left.length ? `<p class="muted orchard-lock" style="margin:8px 4px 0;text-align:center"><i data-icon="lock"></i> Buy every other plot first · ${left.map(lotName).join(', ')} still for sale</p>`
      : `<div class="ts-actions"><button class="btn btn-gold" data-act="buy-lot" data-lot="${id}" ${canPay(ORCHARD_PRICE) ? '' : 'disabled'}>Buy the Orchard · ${coin(ORCHARD_PRICE.coins)} + ${woodTag(ORCHARD_PRICE.wood)}</button></div>${!canPay(ORCHARD_PRICE) ? `<p class="muted" style="margin:8px 4px 0;text-align:center">You need ${missingText(ORCHARD_PRICE)}.</p>` : ''}`}`; }
  const trees = OBSTACLES.filter((o) => o.lot === id && o.type === 'tree').length;
  return `<div class="lot-card"><i data-icon="sign" style="width:54px;height:54px"></i><div><b>${owned ? 'Your land' : 'Wooded plot · For sale'}</b>
    <small>${trees} trees (about ${trees * WOOD.tree + trees * WOOD.stump} Wood) · room for 4 raised beds</small></div></div>
    ${owned ? '<p class="muted" style="margin:10px 4px">Tap its trees to clear them.</p>' : `<p class="muted" style="margin:10px 4px">Buy this neighboring plot to chop its trees and build more beds. Each plot costs more than the last.</p>
    <div class="ts-actions"><button class="btn btn-gold" data-act="buy-lot" data-lot="${id}" ${S.coins >= price ? '' : 'disabled'}>Buy plot · ${coin(price)}</button></div>
    ${S.coins < price ? `<p class="muted" style="margin:8px 4px 0;text-align:center">You need ${price - S.coins} more coins.</p>` : ''}`}`;
}
function openLot(id) { openPanel('lot', id); }
// v0.61: Orchard plots — each costs more than the last (whichever you buy first pays the first price)
const orchLotPrice = () => ORCH_PLOT_PRICES[Math.min(ORCH_FOR_SALE.filter((l) => S.lots[l]).length, ORCH_PLOT_PRICES.length - 1)];
function orchLotHTML(id) {
  const owned = !!S.lots[id], p = orchLotPrice(), spots = ORCHARD_TREE_SPOTS.filter((q) => q.lot === id).length, beds = SITES.filter((q) => q.lot === id).length;
  return `<div class="lot-card"><i data-icon="sign" style="width:54px;height:54px"></i><div><b>${owned ? 'Your Orchard land' : 'Orchard plot · For sale'}</b><small>Open meadow · ${spots} fruit-tree spots and ${beds} raised-bed patches</small></div></div>
    ${owned ? '<p class="muted" style="margin:10px 4px">Plant fruit trees on its spots, or build beds and the Fruit Stand or Pressed Oil Stand here.</p>' : `<p class="muted" style="margin:10px 4px">More room for fruit. Each Orchard plot costs more than the last.</p>
    <div class="ts-actions"><button class="btn btn-gold" data-act="buy-lot" data-lot="${id}" ${canPay(p) ? '' : 'disabled'}>Buy plot · ${coin(p.coins)} + ${woodTag(p.wood)}</button></div>
    ${canPay(p) ? '' : `<p class="muted" style="margin:8px 4px 0;text-align:center">You need ${missingText(p)}.</p>`}`}`;
}
function buyOrchLot(id) {
  if (S.lots[id] || !S.lots.orchard) return false; const p = orchLotPrice();
  if (!canPay(p)) { toast(`You need ${missingText(p)}`); return false; }
  S.coins -= p.coins; S.wood -= p.wood; S.lots[id] = true; save(); closePanel(); W.setLotOwned(id, true); syncTreeRows();
  const [cx, cz] = lotCenter(id); W.poof(new THREE.Vector3(cx, 0.6, cz), '#F5D07A', 26, 3);
  /* v0.7.1: buying a plot no longer moves the camera */
  toast(`${LOTS[id].name} is yours! · ${ORCHARD_TREE_SPOTS.filter((q) => q.lot === id).length} more tree spots`); hud(); checkGoals(); return true;
}
function buyLot(id) {
  if (id === 'orchard') return buyOrchard();
  if (ORCH_FOR_SALE.includes(id)) return buyOrchLot(id);
  const price = lotPrice(); if (S.lots[id] || S.coins < price || !LOT_FOR_SALE.includes(id)) return false;
  S.coins -= price; S.lots[id] = true; S.lotsBought++; save();
  closePanel(); W.setLotOwned(id, true); syncTreeRows();
  const [cx, cz] = lotCenter(id); W.poof(new THREE.Vector3(cx, 0.6, cz), '#F5D07A', 26, 3);
  /* v0.7.1: buying a plot no longer moves the camera */
  toast(`${LOTS[id].name} is yours!`); tip('plotbought'); hud(); checkGoals(); unlockMapIfReady(); return true;
}

// ---------------- v0.6: the Map — Home, The Orchard, and places coming soon ----------------
const curLoc = () => (S.loc === 'orchard' && S.lots.orchard ? 'orchard' : 'home');
function setLoc(loc, quiet) {
  if (loc === 'orchard' && !S.lots.orchard) return false;
  S.loc = loc; PAN = PANS[loc]; Sound?.setScene(loc); W.setLocation(loc === 'home' ? null : LOCATIONS[loc].target);
  document.body.dataset.loc = loc; $('#loc-chip').textContent = LOCATIONS[loc].name;
  $('#loc-chip').classList.toggle('hidden', loc === 'home');
  if (!quiet) save();
  return true;
}
// every camera glide that crosses between places switches location first (e.g. planting a sapling from Home)
function glideW(to, dur, cb) { const loc = to.target && to.target.x > 150 ? 'orchard' : 'home'; if (loc !== curLoc()) { if (!setLoc(loc)) return; fadeFlash(); } W.glide(to, dur, cb); }
function fadeFlash() { const f = $('#travel-fade'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function travel(loc) {
  if (loc === curLoc()) { closeMap(); return true; }
  if (loc === 'orchard' && !S.lots.orchard) return false;
  if (placing) exitPlace(); if (buildMode) exitBuild(); deselect(); closePanel();
  const f = $('#travel-fade'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  setTimeout(() => { setLoc(loc); hud(); closeMap(); toast(loc === 'home' ? 'Back home' : `Welcome to ${LOCATIONS[loc].name}`); if (loc === 'orchard') { tip('orchard'); syncOrchard(); } }, 260);
  return true;
}
// v0.68: a fresh Orchard had no fruit trees and no way to get a sapling except tree cards from Jewel packs (Jewels only come
// from the Day 15 daily gift) — a dead end after spending 75,000 coins. The Orchard now comes with the Apple Tree card, so
// Apple saplings are in its Market at once. Returns true when the card was given.
function orchardStarterTree() {
  if (TREE_IDS.some((t) => S.unlocked[t]) || Object.keys(S.orchard || {}).length) return false;
  S.discovered.apple = S.unlocked.apple = true; if (!S.cards.apple) addCard('apple'); return true;
}
function buyOrchard() {
  if (S.lots.orchard) return false;
  if (orchardLocked()) { toast('Buy every Home plot first — then the Orchard opens on the Map'); return false; }
  if (!canPay(ORCHARD_PRICE)) { toast(`You need ${missingText(ORCHARD_PRICE)}`); return false; }
  S.coins -= ORCHARD_PRICE.coins; S.wood -= ORCHARD_PRICE.wood; S.lots.orchard = true; setTimeout(syncTreeRows, 0);
  S.owned.fruitstand = S.unlocked.fruitstand = S.discovered.fruitstand = true; S.fsFree = true;   // v0.61: the Fruit Stand comes free with it
  const gotApple = orchardStarterTree(); save(); syncOShed();
  closePanel(); hud(); renderMap(); toast(`The Orchard is yours! · a free Fruit Stand is in your Build menu${gotApple ? ' · Apple saplings are in the Market' : ''}`); checkGoals();
  setTimeout(() => travel('orchard'), 600); promoMilestone('orchard');   // v0.66
  return true;
}
const MAP_PLACES = [
  { id: 'home', name: 'Home', x: 188, y: 548, line: 'Your cottage garden: raised beds, stands and the roadside market.' },
  { id: 'orchard', name: 'The Orchard', x: 300, y: 408, line: 'A sunny field of fruit trees, with room for raised beds and its own shed.' },
  { id: 'soon', name: 'Somewhere new', x: 84, y: 402, soon: true, line: 'Something new is growing beyond the hills. Check back later.' },   // v0.67.1: one generic, unnamed teaser (other places are ideas for after launch)
];
const MAP_ART = {
  soon: `<path d="M-36 22h72" stroke="#C9B9A0" stroke-width="2" stroke-linecap="round"/><path d="M-2 24V-6h4v30z" fill="#A97C50" stroke="#7A5A3C" stroke-width="1.2"/><path d="M-22-18h40l6 7-6 7h-40z" fill="#F2E2C4" stroke="#7A5A3C" stroke-width="1.5" stroke-linejoin="round"/><text x="-1" y="-6.5" text-anchor="middle" font-family="Fraunces,serif" font-size="12" font-weight="700" fill="#3D5A40">?</text><g fill="#B7D4B5"><circle cx="-24" cy="20" r="5"/><circle cx="24" cy="19" r="6"/></g><g fill="#F7C5C5"><circle cx="-20" cy="16" r="2"/><circle cx="27" cy="15" r="2"/></g>`,
  home: `<path d="M-26 6h52v20h-52z" fill="#F2E2C4" stroke="#7A5A3C" stroke-width="2"/><path d="M-32 8 0-18 32 8z" fill="#C86F4E" stroke="#7A5A3C" stroke-width="2" stroke-linejoin="round"/><rect x="-6" y="12" width="12" height="14" fill="#8E6040"/><rect x="-21" y="11" width="9" height="8" fill="#9FC7D9" stroke="#7A5A3C"/><rect x="12" y="11" width="9" height="8" fill="#9FC7D9" stroke="#7A5A3C"/><g fill="#B98BD6"><circle cx="-36" cy="26" r="4"/><circle cx="-28" cy="29" r="4"/><circle cx="36" cy="26" r="4"/></g><g fill="#F2B04C"><circle cx="-32" cy="22" r="3.5"/><circle cx="30" cy="30" r="3.5"/></g>`,
  orchard: `<g stroke="#7A5A3C" stroke-width="2"><path d="M-22 26v-12M0 22v-14M22 26v-12" /></g><g stroke="#4F7A45" stroke-width="1.5"><circle cx="-22" cy="6" r="13" fill="#7FB069"/><circle cx="22" cy="6" r="13" fill="#8DBB6E"/><circle cx="0" cy="-2" r="15" fill="#6FA35F"/></g><g fill="#E0584A"><circle cx="-26" cy="4" r="3"/><circle cx="-17" cy="10" r="3"/><circle cx="4" cy="-6" r="3"/><circle cx="-5" cy="4" r="3"/></g><g fill="#F2B04C"><circle cx="20" cy="2" r="3"/><circle cx="27" cy="10" r="3"/></g>`,
};
const LOCK_SVG = `<g class="lock"><circle r="11" fill="#FBF6EA" stroke="#7A5A3C" stroke-width="1.5"/><path d="M-4.5-1v-3a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#7A5A3C" stroke-width="2"/><rect x="-6" y="-1" width="12" height="9" rx="2" fill="#D9A93F" stroke="#7A5A3C" stroke-width="1.2"/></g>`;
// v0.61: coming-soon places stay hidden · v0.66.1: once the Orchard is yours, one fogged 'Coming soon' spot shows · v0.67.1: generic, unnamed
const NEXT_SOON = 'soon';
const mapShown = (p) => SHOW_LOCKED || !p.soon || (p.id === NEXT_SOON && !!S.lots.orchard);
function placeState(p) {
  if (p.soon) return 'soon';
  if (p.id === 'home') return 'open';
  return S.lots.orchard ? 'open' : orchardLocked() ? 'locked' : 'forsale';
}
// v0.65: storybook map — parchment paper (one cached canvas texture), watercolour washes, winding dirt roads, hand-drawn
// Home + Orchard vignettes, a stream with a bridge, fences / trees / flowers, and cloud-fog over the unexplored north and over
// any place you don't own yet (it drifts away the first time you open the Map after unlocking it). Plain SVG, no filters
// on the big layers, so it stays light on iPhone Safari. Unexplored places stay hidden under the clouds (hide-locked rule).
let paperURL_ = null;
function paperURL() {
  if (paperURL_) return paperURL_;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); let r = 7;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#FFF9F0'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 46; i++) { const x = rnd() * 256, y = rnd() * 256, rr = 18 + rnd() * 46, gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(${rnd() < 0.5 ? '236,214,170' : '214,226,196'},${0.10 + rnd() * 0.10})`); gr.addColorStop(1, 'rgba(255,249,240,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(122,90,60,${0.025 + rnd() * 0.05})`; g.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(160,130,90,${0.04 + rnd() * 0.04})`; g.lineWidth = 0.6; g.beginPath(); const x = rnd() * 256, y = rnd() * 256; g.moveTo(x, y); g.quadraticCurveTo(x + rnd() * 40 - 20, y + rnd() * 20, x + rnd() * 60 - 30, y + rnd() * 30 - 15); g.stroke(); }
    paperURL_ = c.toDataURL('image/png');
  } catch (_) { paperURL_ = ''; }
  return paperURL_;
}
// a wobbly closed blob (deterministic) — watercolour washes, tree canopies, clouds
function blobPath(cx, cy, rx, ry, seed, n = 9, wob = 0.18) {
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 1 + (rnd() - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  let d = ''; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; d += i ? `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}` : `M${m[0].toFixed(1)} ${m[1].toFixed(1)}`; }
  const p = pts[0], m = [(p[0] + pts[1][0]) / 2, (p[1] + pts[1][1]) / 2]; return d + `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}Z`;
}
// watercolour wash: two offset translucent layers + a darker pooled edge
const wash = (cx, cy, rx, ry, seed, fill, op = 0.42) => `<path d="${blobPath(cx, cy, rx, ry, seed)}" fill="${fill}" opacity="${op}"/><path d="${blobPath(cx + 3, cy - 2, rx * 0.92, ry * 0.9, seed + 3)}" fill="${fill}" opacity="${op * 0.6}" stroke="${fill}" stroke-width="2.4" stroke-opacity=".55"/>`;
const mTree = (x, y, s = 1, c = '#9CC39A', fruit = '') => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="9" rx="9" ry="2.6" fill="#3D5A40" opacity=".12"/><path d="M0 9V1" stroke="#8E6A4E" stroke-width="2.2" stroke-linecap="round"/><path d="${blobPath(0, -5, 8.5, 7.5, Math.round(x * 7 + y))}" fill="${c}" stroke="#3D5A40" stroke-width=".9" stroke-opacity=".55"/><path d="${blobPath(-2.5, -7, 4.5, 3.5, Math.round(x + y * 3))}" fill="#fff" opacity=".22"/>${fruit ? `<g fill="${fruit}"><circle cx="-3.5" cy="-4" r="1.5"/><circle cx="3" cy="-6.5" r="1.5"/><circle cx="2" cy="-1.5" r="1.4"/><circle cx="-1" cy="-9" r="1.3"/></g>` : ''}</g>`;
const mPine = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="8" rx="7" ry="2" fill="#3D5A40" opacity=".12"/><path d="M0-12 7 0H3l5 7H-8l5-7h-4z" fill="#7FAF84" stroke="#3D5A40" stroke-width=".9" stroke-opacity=".6" stroke-linejoin="round"/><path d="M0 7v2" stroke="#8E6A4E" stroke-width="2"/></g>`;
const mFlowers = (pts) => pts.map(([x, y], i) => `<g transform="translate(${x} ${y})"><path d="M0 3V0" stroke="#7FAF84" stroke-width=".9"/><circle r="1.7" fill="${['#F7C5C5', '#F5D07A', '#FFFFFF', '#E99A9A'][i % 4]}" stroke="#C98A7A" stroke-width=".35"/></g>`).join('');
const mFence = (x1, y1, x2, y2, n) => { let s = `<path d="M${x1} ${y1 - 3}L${x2} ${y2 - 3}M${x1} ${y1 - 6}L${x2} ${y2 - 6}" stroke="#A47A55" stroke-width="1.1" stroke-linecap="round"/>`; for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}v-8" stroke="#8E6A4E" stroke-width="1.5" stroke-linecap="round"/>`; } return s; };
const mCloud = (x, y, s, cls = '') => { const b = [blobPath(-18, 0, 20, 13, Math.round(x + y)), blobPath(8, -6, 24, 17, Math.round(x * 3 + y)), blobPath(30, 2, 16, 11, Math.round(x + y * 5))];
  return `<g class="m-cloud ${cls}" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="4" cy="10" rx="46" ry="7" fill="#C8E0E8" opacity=".45"/><g fill="none" stroke="#B9D3DE" stroke-width="3">${b.map((d) => `<path d="${d}"/>`).join('')}</g><g fill="#FFFDF8">${b.map((d) => `<path d="${d}"/>`).join('')}</g><path d="${blobPath(4, -10, 12, 6, Math.round(x + y * 2))}" fill="#FFFFFF"/><path d="M-30 8Q0 13 40 8" fill="none" stroke="#C8E0E8" stroke-width="2.2" stroke-linecap="round"/></g>`; };
const MAP_SCENE = {
  home: () => `<g class="scene">
    ${wash(0, 6, 72, 40, 11, '#B7D4B5', 0.55)}
    <path d="M-62 30Q-20 22 0 34T60 30" fill="none" stroke="#D9BF85" stroke-width="5" stroke-linecap="round" opacity=".7"/>
    <g transform="translate(-30 4)"><rect x="-17" y="-2" width="34" height="13" rx="2" fill="#A97C50" stroke="#7A5A3C" stroke-width="1"/><g fill="#7FAF84">${[-11, -4, 3, 10].map((x) => `<circle cx="${x}" cy="3" r="2.6"/><circle cx="${x}" cy="8" r="2.4"/>`).join('')}</g><g fill="#F7C5C5">${[-11, 3].map((x) => `<circle cx="${x}" cy="2" r="1.4"/>`).join('')}</g><g fill="#F5D07A"><circle cx="-4" cy="8" r="1.4"/><circle cx="10" cy="7" r="1.4"/></g></g>
    <g transform="translate(-30 22)"><rect x="-17" y="-2" width="34" height="11" rx="2" fill="#A97C50" stroke="#7A5A3C" stroke-width="1"/><g fill="#7FAF84">${[-11, -4, 3, 10].map((x) => `<circle cx="${x}" cy="3" r="2.4"/>`).join('')}</g><g fill="#F7C5C5"><circle cx="-4" cy="2" r="1.4"/><circle cx="10" cy="2" r="1.4"/></g></g>
    <g transform="translate(18 -2)"><ellipse cx="0" cy="22" rx="30" ry="5" fill="#3D5A40" opacity=".14"/>
      <rect x="-21" y="-4" width="42" height="25" rx="1.5" fill="#FFF3DF" stroke="#7A5A3C" stroke-width="1.4"/>
      <path d="M-27-2 0-24 27-2z" fill="#E7A3A0" stroke="#7A5A3C" stroke-width="1.4" stroke-linejoin="round"/><path d="M-20-4-4-17M-10-4 4-15M2-4 12-12" stroke="#C97F7C" stroke-width="1" opacity=".7"/>
      <rect x="10" y="-26" width="6" height="12" fill="#C9A27A" stroke="#7A5A3C" stroke-width="1"/>
      <g class="smoke" fill="#FFFFFF" opacity=".85"><circle cx="13" cy="-31" r="3"/><circle cx="17" cy="-37" r="4"/><circle cx="14" cy="-45" r="5"/></g>
      <rect x="-4.5" y="7" width="9" height="14" rx="4" fill="#3D5A40"/><circle cx="2.4" cy="14" r=".9" fill="#F5D07A"/>
      <g fill="#C8E0E8" stroke="#7A5A3C" stroke-width=".9"><rect x="-17" y="3" width="8" height="7"/><rect x="9" y="3" width="8" height="7"/></g>
      <g fill="#F7C5C5"><circle cx="-15" cy="11.5" r="1.6"/><circle cx="-11" cy="11.5" r="1.6"/><circle cx="11" cy="11.5" r="1.6"/><circle cx="15" cy="11.5" r="1.6"/></g></g>
    <g transform="translate(52 24)"><rect x="-10" y="-3" width="20" height="9" fill="#C9A27A" stroke="#7A5A3C" stroke-width="1"/><path d="M-12-3h24l-2-7h-20z" fill="#F5D07A" stroke="#7A5A3C" stroke-width="1"/><path d="M-8-10v-0M-4-3l1-7M3-3l-1-7" stroke="#FFF9F0" stroke-width="2"/><g fill="#E99A9A"><circle cx="-5" cy="-1" r="1.5"/><circle cx="0" cy="-1" r="1.5"/></g><g fill="#F5D07A"><circle cx="5" cy="-1" r="1.5"/></g></g>
    ${mFence(-52, 36, 46, 36, 14)}
    ${mTree(-60, -10, 1.1, '#9CC39A')}${mTree(58, -14, 1, '#8DBB8E')}${mTree(-48, -22, 0.8, '#A9CDA6')}
    ${mFlowers([[-54, 30], [-44, 32], [-6, 30], [2, 32], [30, 31], [38, 33], [-64, 18], [64, 10]])}
  </g>`,
  orchard: () => `<g class="scene">
    ${wash(0, 4, 70, 44, 23, '#B7D4B5', 0.5)}${wash(-18, 10, 34, 18, 29, '#F5D07A', 0.18)}
    ${[-1, 0, 1].map((r) => [-1, 0, 1].map((c) => mTree(c * 24 + r * 5, r * 15 + 2, 0.95, ['#8DBB8E', '#9CC39A', '#7FAF84'][(r + c + 3) % 3], ['#E0584A', '#F5D07A', '#E99A9A'][(r + 1 + c + 1) % 3])).join('')).join('')}
    <g transform="translate(46 4)"><rect x="-9" y="-2" width="18" height="13" fill="#C9A27A" stroke="#7A5A3C" stroke-width="1"/><path d="M-12-2 0-12 12-2z" fill="#3D5A40" stroke="#2E4530" stroke-width="1" stroke-linejoin="round"/><rect x="-3" y="4" width="6" height="7" fill="#7A5A3C"/></g>
    <g transform="translate(46 22)"><rect x="-7" y="-2" width="14" height="7" fill="#A97C50" stroke="#7A5A3C" stroke-width=".8"/><g fill="#E0584A"><circle cx="-3" cy="-2.5" r="1.8"/><circle cx="1" cy="-3" r="1.8"/></g><circle cx="4.5" cy="-2.5" r="1.8" fill="#F5D07A"/></g>
    ${mFence(-46, 34, 40, 34, 12)}
    ${mFlowers([[-56, 22], [-52, 28], [52, 32], [60, 26], [-30, 38], [20, 38]])}
  </g>`,
};
let fogT = 0;
function mapSVG() {
  const here = curLoc(), SHOWN = MAP_PLACES.filter(mapShown), P = Object.fromEntries(SHOWN.map((p) => [p.id, p]));
  const orchSt = placeState(MAP_PLACES.find((p) => p.id === 'orchard')), orchOpen = orchSt === 'open';
  const clearing = orchOpen && !S.mapFogCleared?.orchard; if (clearing && !fogT) fogT = performance.now();   // marked cleared once the Map has been open long enough to watch it drift away
  const H = P.home, O = P.orchard;
  // the road Home → Orchard winds over the stream (bridge at ~ (238, 452)); two more tracks lead north into the clouds
  const mainRoad = `M${H.x + 58} ${H.y + 30}C ${H.x + 92} ${H.y + 22} 248 548 262 505 S 262 450 ${O.x - 40} ${O.y + 24}`;
  const roads = `<g class="m-roads">
      <path d="${mainRoad}" class="m-road${orchOpen ? ' open' : ''}"/><path d="${mainRoad}" class="m-rut"/>
      <path d="M${H.x - 40} ${H.y - 12}C 120 470 70 420 90 360 S 120 280 110 230" class="m-road far"/>
      <path d="M${O.x - 6} ${O.y - 36}C 300 300 330 270 300 220" class="m-road far"/>
    </g>`;
  const stream = `<g class="m-stream"><path d="M392 120C 330 170 352 230 300 280 S 214 360 232 420 S 282 470 262 506 S 300 610 352 664" fill="none" stroke="#C8E0E8" stroke-width="15" stroke-linecap="round"/>
      <path d="M392 120C 330 170 352 230 300 280 S 214 360 232 420 S 282 470 262 506 S 300 610 352 664" fill="none" stroke="#9FC7D9" stroke-width="15" stroke-linecap="round" stroke-opacity=".35" stroke-dasharray="1 0"/>
      <path d="M392 120C 330 170 352 230 300 280 S 214 360 232 420 S 282 470 262 506 S 300 610 352 664" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-dasharray="6 14" opacity=".9" class="m-ripple"/>
      <g transform="translate(262 505) rotate(-68)"><rect x="-13" y="-7" width="26" height="14" rx="3" fill="#C9A27A" stroke="#7A5A3C" stroke-width="1.2"/><path d="M-13-7h26M-13 7h26" stroke="#8E6A4E" stroke-width="2"/><path d="M-8-7v14M-3-7v14M2-7v14M7-7v14" stroke="#A47A55" stroke-width=".8"/></g></g>`;
  const deco = `<g class="m-deco">
      ${[[28, 600], [52, 618], [362, 600], [340, 622], [20, 440], [40, 462], [150, 610], [326, 520], [356, 470], [180, 420], [150, 448], [372, 380], [24, 330], [60, 300], [210, 340], [354, 300]].map(([x, y], i) => (i % 3 ? mTree(x, y, 0.9 + (i % 4) * 0.08, ['#9CC39A', '#8DBB8E', '#A9CDA6'][i % 3]) : mPine(x, y, 1))).join('')}
      ${mFlowers([[96, 600], [104, 606], [112, 598], [300, 560], [308, 566], [70, 520], [76, 528], [296, 470], [120, 380], [128, 386], [176, 470], [340, 430]])}
      ${mFence(84, 470, 140, 486, 6)}
      <g transform="translate(110 520)"><ellipse cx="0" cy="3" rx="6" ry="3.5" fill="#FFFFFF" stroke="#7A5A3C" stroke-width=".8"/><circle cx="5" cy="1" r="2.2" fill="#3D3326"/></g>
      <g transform="translate(122 528)"><ellipse cx="0" cy="3" rx="5.5" ry="3.2" fill="#FFFFFF" stroke="#7A5A3C" stroke-width=".8"/><circle cx="-4.6" cy="1.2" r="2" fill="#3D3326"/></g>
    </g>`;
  const ribbon = (p, st) => { const w = Math.max(70, p.name.length * 8.4 + 26);
    return `<g class="m-ribbon" transform="translate(0 ${p.id === 'home' ? 50 : 52})"><path d="M${-w / 2 - 9} -3l7 -7v20l-7 -6z" class="rb-tail"/><path d="M${w / 2 + 9} -3l-7 -7v20l7 -6z" class="rb-tail"/>
      <rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="4" class="rb"/><text y="5" text-anchor="middle" class="m-label">${p.name}</text></g>
      ${st === 'forsale' || st === 'locked' || st === 'soon' ? `<g class="m-price${st === 'soon' ? ' m-soon' : ''}" transform="translate(0 ${p.id === 'home' ? 74 : 76})"><rect x="-62" y="-10" width="124" height="20" rx="10"/><text y="4" text-anchor="middle">${st === 'soon' ? 'Coming soon' : st === 'locked' ? 'Buy every Home plot' : `${ORCHARD_PRICE.coins.toLocaleString('en-US')} coins · ${ORCHARD_PRICE.wood} Wood`}</text></g>` : ''}`; };
  const place = (p) => { const st = placeState(p), locked = st === 'locked' || st === 'forsale' || st === 'soon';
    return `<g class="map-place st-${st}${p.id === here ? ' here' : ''}" data-place="${p.id}" transform="translate(${p.x} ${p.y})" role="button" aria-label="${p.name}${locked ? ' · locked' : ''}">
      <ellipse class="hit" cx="0" cy="10" rx="74" ry="60" fill="transparent"/>
      ${(MAP_SCENE[p.id] || (() => `<g filter="url(#paint)">${MAP_ART[p.id]}</g>`))()}
      ${locked || (p.id === 'orchard' && clearing) ? `<g class="m-fog${clearing && !locked ? ' clearing' : ''}" pointer-events="none">${mCloud(-30, -4, 1.05)}${mCloud(26, 10, 0.95)}${mCloud(-4, 26, 0.8)}</g>` : ''}
      ${locked ? `<g transform="translate(0 2)" class="m-lock">${LOCK_SVG}</g>` : ''}
      ${p.id === here ? `<g class="you" transform="translate(${p.id === 'home' ? 18 : 0} -44)"><path d="M0 12-8-1a9 9 0 1 1 16 0z" fill="#E99A9A" stroke="#3D5A40" stroke-width="1.4"/><circle cy="-4" r="3.2" fill="#FFF9F0"/></g>` : ''}
      ${ribbon(p, st)}
    </g>`; };
  const pu = paperURL();
  return `<svg class="map-svg storybook" viewBox="0 0 390 640" preserveAspectRatio="xMidYMid meet" aria-label="Map of Petalspire">
    <defs>
      <filter id="paint" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter>
      ${pu ? `<pattern id="paper" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${pu}" width="256" height="256"/></pattern>` : ''}
      <radialGradient id="vignette" cx=".5" cy=".52" r=".72"><stop offset=".62" stop-color="#E8D6B0" stop-opacity="0"/><stop offset="1" stop-color="#C9A97A" stop-opacity=".55"/></radialGradient>
      <linearGradient id="northFog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFDF8" stop-opacity=".98"/><stop offset=".72" stop-color="#FFFDF8" stop-opacity=".9"/><stop offset="1" stop-color="#FFFDF8" stop-opacity="0"/></linearGradient>
    </defs>
    <rect x="-400" y="-400" width="1190" height="1440" fill="${pu ? 'url(#paper)' : '#FFF9F0'}"/>${wash(195, 700, 260, 90, 23, '#B7D4B5', 0.3)}${wash(195, -40, 260, 80, 29, '#C8E0E8', 0.25)}
    ${wash(200, 470, 230, 190, 3, '#B7D4B5', 0.38)}${wash(90, 560, 90, 60, 5, '#B7D4B5', 0.3)}${wash(320, 380, 90, 80, 8, '#B7D4B5', 0.32)}
    ${wash(70, 420, 50, 34, 13, '#F5D07A', 0.16)}${wash(330, 560, 50, 36, 17, '#F7C5C5', 0.2)}${wash(150, 330, 70, 40, 19, '#B7D4B5', 0.26)}
    ${stream}${roads}${deco}
    ${SHOWN.map(place).join('')}
    <g class="m-north" pointer-events="none"><rect x="0" y="0" width="390" height="300" fill="url(#northFog)"/>
      ${mCloud(60, 120, 1.3)}${mCloud(200, 80, 1.5)}${mCloud(330, 140, 1.2)}${mCloud(120, 230, 1.1)}${mCloud(290, 250, 1.0)}${mCloud(40, 40, 1.0)}${mCloud(350, 40, 1.1)}
      <text class="m-unexplored" x="195" y="175" text-anchor="middle">Beyond the clouds…</text><text class="m-unexplored sm" x="195" y="194" text-anchor="middle">more of the valley to discover</text></g>
    <g transform="translate(46 596)" class="compass"><circle r="17" fill="#FFF9F0" stroke="#7A5A3C" stroke-width="1.2"/><path d="M0-14 4 0 0 14-4 0z" fill="#E99A9A" stroke="#7A5A3C" stroke-width=".6"/><path d="M-14 0 0-3 14 0 0 3z" fill="#B7D4B5" stroke="#7A5A3C" stroke-width=".6"/><text y="-20" text-anchor="middle">N</text></g>
    <g class="m-title" transform="translate(195 30)"><path d="M-70-14h140l-8 14 8 14h-140l8-14z" fill="#FFF9F0" stroke="#7A5A3C" stroke-width="1.2"/><text y="5" text-anchor="middle">Petalspire Vale</text></g>
    <rect x="-400" y="-400" width="1190" height="1440" fill="url(#vignette)" pointer-events="none"/>
  </svg>`;
}
function mapCard(id) {
  const p = MAP_PLACES.find((q) => q.id === id); if (!p || !mapShown(p)) return '';
  const st = placeState(p), here = curLoc() === id;
  let act = '';
  if (st === 'soon') act = `<div class="soon-pill">Coming soon</div>`;
  else if (here) act = `<button class="btn sm" disabled>You are here</button>`;
  else if (st === 'open') act = `<button class="btn btn-primary" data-travel="${id}">Travel to ${p.name}</button>`;
  else if (st === 'locked') { const left = LOT_FOR_SALE.filter((l) => !S.lots[l]); act = `<p class="muted">Opens after you buy every Home plot · <b>${left.length} left</b> (${left.map(lotName).join(', ')})</p><p class="muted">Then: ${coin(ORCHARD_PRICE.coins)} + ${woodTag(ORCHARD_PRICE.wood)}</p>`; }
  else act = `<button class="btn btn-primary" data-buy-orchard ${canPay(ORCHARD_PRICE) ? '' : 'disabled'}>Buy The Orchard · ${coin(ORCHARD_PRICE.coins)} + ${woodTag(ORCHARD_PRICE.wood)}</button>${canPay(ORCHARD_PRICE) ? '' : `<p class="muted">You need ${missingText(ORCHARD_PRICE)}.</p>`}`;
  return `<div class="map-card st-${st}" data-card="${id}"><svg viewBox="-60 -40 120 80" class="mc-art"><g filter="url(#paint)">${MAP_ART[id]}</g></svg><div class="mc-meta"><b>${p.name}</b><p>${p.line}</p>${act}</div></div>`;
}
let mapSel = null;
function renderMap() {
  const m = $('#map'); if (m.classList.contains('hidden')) return;
  $('#map-body').innerHTML = mapSVG(); $('#map-card').innerHTML = mapSel ? mapCard(mapSel) : '';   // v0.66.1: no hint panel — the Map is the whole screen; a card shows only for a tapped place
  fillIcons($('#map'));
}
// v0.61: the Map stays locked until every Home plot is owned
function mapLocked() { return !S.mapOpen; }
function homeLotsOwned() { return LOT_FOR_SALE.filter((l) => S.lots[l]).length; }
function syncMapBtn() {
  const b = $('#btn-map'); if (!b) return; const lk = mapLocked();
  b.classList.toggle('locked', lk);   // v0.65: the Map sits in the tab bar and shows its lock (dimmed) until every Home plot is yours
  b.setAttribute('aria-label', lk ? `Map · locked (${homeLotsOwned()}/${LOT_FOR_SALE.length} Home plots)` : 'Map');
}
function unlockMapIfReady() {
  if (S.mapOpen || LOT_FOR_SALE.some((l) => !S.lots[l])) return false;
  S.mapOpen = true; save(); syncMapBtn();
  const b = $('#btn-map'); b.classList.add('just-unlocked'); setTimeout(() => b.classList.remove('just-unlocked'), 2400);
  const r = b.getBoundingClientRect(); sparkles($('#ui'), r.left + r.width / 2, r.top + r.height / 2, 16); buzz([20, 40, 20]);
  setTimeout(() => toast('<i data-icon="sparkle"></i> All Home plots are yours — the Map is unlocked!'), 900);
  promoMilestone('map');   // v0.66
  return true;
}
function openMap() { if (mapLocked()) { toast(`<i data-icon="lock"></i> Buy all plots to unlock the Map · ${homeLotsOwned()}/${LOT_FOR_SALE.length} Home plots`); return false; }
  closePanel(); if (placing) exitPlace(); if (buildMode) exitBuild(); deselect(); mapSel = null; $('#map').classList.remove('hidden'); renderMap(); }
function closeMap() { $('#map').classList.add('hidden'); mapSel = null; if (fogT && performance.now() - fogT > 2400 && S.lots.orchard) { (S.mapFogCleared ||= {}).orchard = true; save(); } fogT = 0; }
$('#btn-map').addEventListener('click', (e) => { e.stopPropagation(); $('#map').classList.contains('hidden') ? openMap() : closeMap(); });
$('#map-close').addEventListener('click', closeMap);
$('#map').addEventListener('click', (e) => {
  const t = e.target.closest('[data-travel]'); if (t) { travel(t.dataset.travel); return; }
  if (e.target.closest('[data-buy-orchard]')) { buyOrchard(); return; }
  const g = e.target.closest('[data-place]'); if (!g) return;
  const id = g.dataset.place, p = MAP_PLACES.find((q) => q.id === id), st = p && placeState(p);
  if (st === 'open') { if (id === curLoc()) toast(`You are here · ${p.name}`); else travel(id); return; }   // v0.65: tapping an open place travels straight there
  mapSel = id; renderMap();
});

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
  const offers = offersSorted().filter((o) => !o.starter || starterUnlocked() || M().starter.bought);   // v0.67: highest value first; the Starter Pack once the beginning goals are done
  return `<div class="jewel-hero"><i data-icon="jewel"></i><div><b>${S.jewels}</b><small>Jewels</small></div></div>
    <p class="muted" style="margin:6px 4px 12px">Jewels open Card Packs (${PACK_JEWELS} each), finish a restoration instantly (${RESTORE_HURRY_JEWELS}), grow a planted tree by a stage (${TREE.hurryJewels}) or complete the market rebuild (${BUILDS.market.hurryJewels}).</p>
    <div class="jewel-grid">${cards}</div>
    <div class="sec-title">Packs</div><div class="shop-offers" data-shop-starter>${offers.map((o) => offerCardHTML(o, true)).join('')}</div>
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
  const fl = e.target.closest('[data-follow]'); if (fl) { claimFollow(fl.dataset.follow); return; }   // the link itself opens the page in a new tab
  const b = e.target.closest('button, .coll .card'); if (!b) return;
  if (b.dataset.tab) { marketTab = b.dataset.tab; renderPanel(); return; }
  if (b.dataset.bag) { bagTab = b.dataset.bag; renderPanel(); return; }
  if (b.dataset.upgrade) { upgradeCard(b.dataset.upgrade); return; }
  if (b.dataset.placeGf) { enterPlace('gfeat', b.dataset.placeGf); return; }
  if (b.dataset.stockAntique) return stockAntique(b.dataset.stockAntique);
  if (b.dataset.sellRestored) return sellRestored(b.dataset.sellRestored);
  if (b.hasAttribute('data-install-shelf')) return installShelf();
  if (b.hasAttribute('data-uninstall-shelf')) return uninstallShelf();
  if (b.dataset.send) return sendGoods(b.dataset.send, b.dataset.n);   // v0.65
  if (b.dataset.bulk) return bulkSell(b.dataset.bulk, b.dataset.n === 'all' ? 'all' : +b.dataset.n, b.dataset.loc);   // v0.65
  if (b.dataset.stock) return stock(b.dataset.stock, b.dataset.n, b.dataset.loc);
  if (b.dataset.unstock) return unstock(b.dataset.unstock, b.dataset.loc);
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
  if (b.dataset.teacollect != null) return collectTea(+b.dataset.teacollect);
  if (b.dataset.make) { const [c, r] = b.dataset.make.split(':'); return craftMake(c, r); }
  if (b.dataset.makecollect) { const [c, k] = b.dataset.makecollect.split(':'); return craftCollect(c, +k); }
  if (b.dataset.pick != null) return pickTree(+b.dataset.pick);
  if (b.dataset.wtree != null) { const ok = waterTree(+b.dataset.wtree); if (ok) { save(); hud(); renderPanel(); } return ok; }
  if (b.dataset.bagseeds) { const [sp, n] = b.dataset.bagseeds.split(':'); return bagSeeds(sp, +n); }
  if (b.dataset.teaadd != null) { teaAdd(b.dataset.teaadd); return renderPanel(); }
  if (b.dataset.tearm != null) { teaRemove(+b.dataset.tearm); return renderPanel(); }
  if (b.dataset.craft) return craftTincture(b.dataset.craft);
  if (b.dataset.tcollect != null) return collectTincture(+b.dataset.tcollect);
  if (b.dataset.unhook) return unhookIrrigation(b.dataset.unhook);
  if (b.dataset.slot != null) { const k = +b.dataset.slot; if (S.rack[k]) collect(k); else hang(k); afterRack(); return; }
  const a = b.dataset.act || '';   // v0.68: cards and buttons without an action fall through to the card-zoom check below (a.startsWith used to throw on them, so tapping a collection card did nothing)
  if (a === 'fill-rack') { const sp = b.dataset.sp || 'lavender'; for (let k = 0; k < S.rack.length; k++) hang(k, sp); afterRack(); return; }
  if (a === 'upgrade-building') return upgradeBuilding(b.dataset.kind);
  if (a === 'upg-finish') return hurryUpg(b.dataset.key);
  if (a === 'buy-pack') return buyPack();
  if (a === 'place-bed') return enterBuild();
  if (a === 'place-sapling') return enterPlace('sapling');
  if (a.startsWith('buy-copy-')) return buyCopy(a.slice(9));   // v0.67.1
  if (a === 'build-barrel') return enterPlace('barrel');
  if (a === 'fill-barrels') return fillBarrels();
  if (a === 'assign-irrig') return startBuy('irrigation');
  if (a === 'build-stand') return buildStand();
  if (a === 'build-ostand') return buildOStand();
  if (a === 'buy-treerow') return buyTreeRow();
  if (a === 'coin-unlock') return coinUnlock(b.dataset.id);
  if (a === 'coin-unlock-ask') return coinUnlockAsk(b.dataset.id);
  if (a === 'hire-worker') return hireWorker(b.dataset.lot, b.dataset.role || 'g');
  if (a === 'pay-worker') return payWorker(b.dataset.lot);
  if (a === 'open-worker') return openPanel('worker', b.dataset.lot);
  if (a === 'build-rack') return buildRack();
  if (a === 'build-tincture') return buildTincture();
  if (a === 'build-teastand') return buildTea();
  if (a === 'build-press') return buildCraft('press');
  if (a === 'build-opress') return buildCraft('opress');
  if (a === 'build-fruitstand') return buildCraft('fruitstand');
  if (a === 'brew-tea') return brewTea();
  if (a === 'tea-clear') { teaPick = []; return renderPanel(); }
  if (a === 'build-still') return buildStill();
  if (a === 'build-parking') return buildTraffic('parking');
  if (a === 'build-oparking') return buildTraffic('oparking');
  if (a === 'build-obillboard') return buildTraffic('obillboard');
  if (a === 'build-windmill') return enterPlace('windmill');
  if (a === 'build-billboard') return buildTraffic('billboard');
  if (a === 'bb-run') return runAd(false);
  if (a === 'bb-jewel') return askRunAdJewel();
  if (a === 'place-barrel') return enterPlace('barrel');
  if (a === 'place-hive') return enterPlace('hive');
  if (a === 'use-sickle' || a === 'use-plow') return useTool(a.slice(4));
  if (a === 'open-market') return openPanel('market', 'buy');
  if (a === 'open-bulk-home' || a === 'open-bulk-orchard') return openPanel('bulk', a.slice(10));
  if (a === 'bulk-all-home' || a === 'bulk-all-orchard') return bulkAll(a.slice(9));
  if (a === 'build-market') return startMarket();
  if (a === 'hurry-market') return hurryMarket();
  if (a === 'open-jewels') return openPanel('jewels');
  if (a === 'sell-stand') return sellPlaced({ kind: 'stand' });
  if (a === 'go-packs') { if (!S.marketBuilt) { toast('Card Packs are sold at the Supply Market — rebuild it first'); return; } return openPanel('market', 'packs'); }
  if (a === 'trade-coins' || a === 'trade-wood') return tradeJewel(a.slice(6));
  if (a === 'watch-ad') return watchAd();
  if (a === 'cons-finish') return hurryCons(b.dataset.kind);
  if (a === 'open-daily') { closePanel(); return showDaily(); }
  if (a === 'mute-music' || a === 'mute-sfx') return toggleMute(a.slice(5));
  if (a === 'tips-again') { S.tips = {}; save(); closePanel(); const g = GOALS[S.goal]; tip(g ? g.hint : 'chop'); return; }
  if (a === 'reset') return confirmBox('<h3>Reset your garden?</h3><p class="muted">This erases all progress on this device and starts again in the woods.</p>', 'Reset', () => {
    clearTimeout(saveTimer); localStorage.removeItem(SAVE_KEY); localStorage.removeItem(V02_KEY); S = null; location.reload(); });
  if (a === 'buy-lot') return buyLot(b.dataset.lot);
  if (b.dataset.card === 'irrigation' && !b.classList.contains('card')) return zoomCard('irrigation');
  if (b.classList.contains('card') && b.dataset.card) zoomCard(b.dataset.card);
});

// ---------------- Customers ----------------
const testHold = { sales: false, front: false };   // test hook: keep parked customers browsing (for screenshots of a full lot)
let custs = [], nextCust = now() + 4000, nextPass = now() + 9000;   // v0.41: several customers can park at once (Parking Lot)
// v0.41 traffic: Parking Lot (more bays, shorter gaps, extra item) and Billboard (Run ad: 2× traffic for 5 min)
const parkI = () => parkLv(cardLv('parking'));
const parkCap = () => (S.parkingBuilt ? PARKING.spots[parkI()] : 1);
const parkCars = () => (S.parkingBuilt ? PARKING.cars[parkI()] : 1);
// v0.68.1: the Orchard Parking Lot — same card level, its own bays beside the Orchard Stand (bay 0 = the stand's own stop)
const oparkCap = () => (S.oparkingBuilt ? PARKING.spots[parkI()] : 1);
const oparkCars = () => (S.oparkingBuilt ? PARKING.cars[parkI()] : 1);
const oBayXs = () => PARK_X.slice(0, oparkCap()).map((x) => x + SPOTS.orchardshed[0] - PARK_X[0]).sort((a, b) => b - a);
const oBayX = (k) => oBayXs()[Math.min(k, oparkCap() - 1)];
const oTrafficMult = () => (S.oparkingBuilt ? PARKING.gapMult[parkI()] : 1) / (bbActiveAt('orchard') ? BILLBOARD.mult : 1);
const oExtraChance = () => (S.oparkingBuilt ? PARKING.extraItem + CARD_LEVELS.parking.extraItem * (cardLv('parking') - 1) : 0);            // v0.52: cars per arrival (each is a customer)
// the bays in use, front (largest x, cars drive in +x) to back, so nobody drives through a parked car
const bayXs = () => PARK_X.slice(0, parkCap()).sort((a, b) => b - a);
const bayX = (k) => bayXs()[Math.min(k, parkCap() - 1)];
function parkLevelText(lv) { const i = parkLv(lv);
  return `${PARKING.spots[i]} spots · groups of ${PARKING.cars[i]} cars · a group every ~${Math.round(22.5 * PARKING.gapMult[i])} s · ${Math.round((PARKING.extraItem + CARD_LEVELS.parking.extraItem * i) * 100)}% buy an extra item`; }
const bbBuilt = () => !!(S.billboardBuilt || S.obillboardBuilt);
const bbActive = () => bbBuilt() && now() < (S.bb?.until || 0);   // v0.68.1: one ad campaign, shown on every Billboard you have built
const bbActiveAt = (loc) => bbActive() && !!(loc === 'orchard' ? S.obillboardBuilt : S.billboardBuilt);   // …and it boosts traffic only where a Billboard stands
const bbReadyIn = () => Math.max(0, (S.bb?.readyAt || 0) - now());
const trafficMult = () => (S.parkingBuilt ? PARKING.gapMult[parkI()] : 1) / (bbActiveAt('home') ? BILLBOARD.mult : 1);   // multiplies the gap between cars
const extraItemChance = () => (S.parkingBuilt ? PARKING.extraItem + CARD_LEVELS.parking.extraItem * (cardLv('parking') - 1) : 0);
const custGap = () => randInt(15000, 30000) * atmosMult() * trafficMult() * rushK('home') * (1 - charmAt('gardenbell', 'home'));   // v0.65: Brass Garden Bell — only where it stands
// v0.65: a visit picks STAND_BUY.kinds[lv] different goods (as many as the stand has) and up to STAND_BUY.upTo[lv] of each
function rollWants(avail, stock, lv) { const i = Math.max(0, Math.min(STAND_BUY.upTo.length - 1, (lv || 1) - 1)), [a, b] = STAND_BUY.kinds[i];
  const types = avail.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(avail.length, randInt(a, b)));
  return types.map((id) => ({ id, n: randInt(1, Math.min(STAND_BUY.upTo[i], stock[id])) })); }
function pickWants() {
  if (consLeft('stand')) return [];   // v0.63: no sales while it's being built
  const avail = SELL_ORDER.filter((id) => S.stand[id] > 0); if (!avail.length) return [];
  const wants = rollWants(avail, S.stand, blv('stand'));   // v0.65: several kinds per visit, more at higher stand levels
  if (Math.random() < extraItemChance()) { const w = wants[0]; w.n++; w.extra = true; }   // Parking Lot: "while I'm here…" +1 item (if the stand still has it)
  return wants;
}
// v0.52: one arrival = a group of cars (Parking Lot: 2, more at higher levels), nose to tail, each parking in its own bay
function spawnArrival() {
  const free = parkCap() - custs.length, n = Math.min(parkCars(), free); if (n < 1) return [];   // a part-full lot takes a smaller group
  const out = []; for (let k = 0; k < n; k++) { const c = spawnCustomer(k); if (c) out.push(c); }
  if (out.length) { S.stats.arrivals = (S.stats.arrivals || 0) + 1; if (out.length > 1) S.stats.groupCars = (S.stats.groupCars || 0) + out.length; }
  return out;
}
function spawnCustomer(behind = 0) {
  const wants = pickWants(); if (!wants.length) return null;
  const bubble = el('div', 'bubble hidden'); $('#popups').appendChild(bubble);
  const c = { wants, bubble, car: null, slot: custs.length, done: false };
  custs.push(c);
  c.car = W.spawnCar({ stopX: bayX(c.slot), behind, onPark: () => {
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
  for (const w of c.wants) { const q = Math.min(w.n, S.stand[w.id] || 0); if (!q) continue; S.stand[w.id] -= q; if (!S.stand[w.id]) delete S.stand[w.id]; total += q * standPrice(w.id); items += q; (S.stats.soldBy ||= {})[w.id] = (S.stats.soldBy[w.id] || 0) + q; if (w.extra && q === w.n) extra = 1; }
  if (total) {
    S.coins += total; S.stats.standEarned += total; S.stats.sold += items; S.stats.customers++; if (extra) S.stats.extraItems = (S.stats.extraItems || 0) + 1;
    if (S.stats.customers % ADS.interstitialEverySales === 0) setTimeout(() => Ads.maybeBreak('sales', adBlocked()), 2600);
    c.bubble.innerHTML = `<span class="thanks">${extra ? '♥ One more, please!' : '♥ Thank you!'}</span>`;
    const p = c.car.group.position; popAt(new THREE.Vector3(p.x, 1.9, p.z), `<i data-icon="coin"></i>+${total}`, 'coinpop');
    for (let k = 0; k < Math.min(6, items + 2); k++) setTimeout(() => coinFly(c.car.group.position), k * 90);
    if (curLoc() === 'home') setTimeout(() => maybeBoost('sale', { coins: total, loc: 'home' }), 1500);   // v0.66
  } else c.bubble.innerHTML = `<span class="thanks">Sold out… next time!</span>`;
  syncStand(); save(); hud(); checkGoals(); if (panel === 'stand') renderPanel();
  setTimeout(() => { c.done = true; leaveQueue(); }, 1400);
}
// cars leave front-first; the ones behind pull forward one bay so nobody drives through a parked car
function leaveQueue() {
  let moved = false;
  while (custs.length && custs[0].done) { const c = custs.shift(); c.car.leave(); c.bubble.remove(); moved = true; }
  if (!moved) return;
  custs.forEach((c, k) => { if (c.slot !== k) { c.slot = k; c.car.stopX = bayX(k); if (c.car.state === 'park') c.car.state = 'in'; } });
  nextCust = parkCap() > 1 ? Math.max(nextCust, now() + 2500) : now() + custGap();   // without a Parking Lot the gap starts when the car leaves (as before)
  if (panel === 'stand') renderPanel();
}
// v0.61: Orchard Stand visitors — one car at a time on the Orchard road, buying from S.ostand
let ocusts = [], nextOCust = now() + 5000, nextOPass = now() + 7000;
const oGap = () => randInt(15000, 30000) * atmosMult() * oTrafficMult() * rushK('orchard') * (1 - charmAt('gardenbell', 'orchard'));
function spawnOArrival() {   // v0.68.1: with an Orchard Parking Lot, visitors come in groups like at Home
  const free = oparkCap() - ocusts.length, n = Math.min(oparkCars(), free); if (n < 1) return [];
  const out = []; for (let k = 0; k < n; k++) { const c = spawnOCustomer(k); if (c) out.push(c); }
  return out;
}
function spawnOCustomer(behind = 0) {
  if (consLeft('oshed')) return null;
  const avail = SELL_ORDER.filter((id) => S.ostand[id] > 0); if (!avail.length) return null;
  const wants = rollWants(avail, S.ostand, 1);   // v0.65: the Orchard Stand buys like a Lv1 Farm Stand
  if (Math.random() < oExtraChance()) { wants[0].n++; wants[0].extra = true; }   // v0.68.1: Parking Lot "while I'm here…" item
  const bubble = el('div', 'bubble hidden'); $('#popups').appendChild(bubble);
  const c = { wants, bubble, car: null, loc: 'orchard', done: false, slot: ocusts.length }; ocusts.push(c);
  c.car = W.spawnCar({ ox: ORCH_X, stopX: oBayX(c.slot), behind, onPark: () => {
    bubble.innerHTML = `<span class="think">${wants.map((w) => `<span class="want">${itemSvg(w.id)}<b>×${w.n}</b></span>`).join('')}</span>`;
    bubble.classList.remove('hidden'); if (panel === 'ostand') renderPanel();
    const pay = () => (testHold.sales ? setTimeout(pay, 500) : opurchase(c)); setTimeout(pay, 1900);
  } });
  nextOCust = now() + oGap(); S.stats.oArrivals = (S.stats.oArrivals || 0) + 1;
  return c;
}
function opurchase(c) {
  if (!c || c.paid) return; c.paid = true; let total = 0, items = 0;
  for (const w of c.wants) { const q = Math.min(w.n, S.ostand[w.id] || 0); if (!q) continue; S.ostand[w.id] -= q; if (!S.ostand[w.id]) delete S.ostand[w.id]; total += q * ostandPrice(w.id); items += q; (S.stats.soldBy ||= {})[w.id] = (S.stats.soldBy[w.id] || 0) + q; }
  if (total) {
    S.coins += total; S.stats.orchEarned = (S.stats.orchEarned || 0) + total; S.stats.sold += items; S.stats.customers++;
    c.bubble.innerHTML = '<span class="thanks">♥ Thank you!</span>';
    const p = c.car.group.position; popAt(new THREE.Vector3(p.x, 1.9, p.z), `<i data-icon="coin"></i>+${total}`, 'coinpop');
    if (curLoc() === 'orchard') for (let k = 0; k < Math.min(6, items + 2); k++) setTimeout(() => coinFly(c.car.group.position), k * 90);
    if (curLoc() === 'orchard') setTimeout(() => maybeBoost('sale', { coins: total, loc: 'orchard' }), 1500);   // v0.66
  } else c.bubble.innerHTML = '<span class="thanks">Sold out… next time!</span>';
  syncOStand(); save(); hud(); checkGoals(); if (panel === 'ostand') renderPanel();
  setTimeout(() => { c.done = true; c.bubble.remove(); oleaveQueue(); }, 1400);
}
// v0.68.1: Orchard cars leave front-first too, and the ones behind pull forward (as at the Home Parking Lot)
function oleaveQueue() {
  let moved = false;
  while (ocusts.length && ocusts[0].done) { ocusts.shift().car.leave(); moved = true; }
  if (!moved) return;
  ocusts.forEach((c, k) => { if (c.slot !== k) { c.slot = k; c.car.stopX = oBayX(k); if (c.car.state === 'park') c.car.state = 'in'; } });
  nextOCust = Math.max(nextOCust, now() + 2500); if (panel === 'ostand') renderPanel();
}
function coinFly(pos) {
  sfx('coin');
  const s = W.project(new THREE.Vector3(pos.x, 1.4, pos.z)); const t = $('#pill-coins').getBoundingClientRect();
  const c = el('div', 'coin-fly', ICONS.coin); c.style.left = s.x + 'px'; c.style.top = s.y + 'px'; c.style.setProperty('--tx', (t.left + t.width * 0.25 - s.x) + 'px'); c.style.setProperty('--ty', (t.top + t.height / 2 - s.y) + 'px');
  $('#popups').appendChild(c); setTimeout(() => c.remove(), 900);
}
W.frameHooks.push(() => {
  const here = curLoc();
  for (const c of [...custs, ...ocusts]) if (c.bubble && c.car) { c.bubble.style.visibility = (c.loc || 'home') === here ? '' : 'hidden'; const p = c.car.group.position; const s = W.project(new THREE.Vector3(p.x, 2.15, p.z)); c.bubble.style.left = s.x + 'px'; c.bubble.style.top = s.y + 'px'; }
});

// v0.7: a small timer pill over each hired Gardener (time left, or 'Hire again' once the hour is up)
const wkTimers = new Map();
function wkTimerText(lot) { const w = wkRec(lot); if (!w) return null; const left = w.end - now(); if (left <= 0) return { t: (wkRoleOf(lot) === 'm' ? '🧺 ' : '') + 'Hire again', c: 'done' }; const mn = Math.ceil(left / 60000); return { t: (wkRoleOf(lot) === 'm' ? '🧺 ' : '') + '⏱ ' + (mn >= 60 ? `${Math.floor(mn / 60)}h ${mn % 60 ? (mn % 60) + 'm' : ''}`.trim() : mn + 'm'), c: mn <= 5 ? 'low' : '' }; }
W.frameHooks.push(() => {
  const here = curLoc();
  for (const [lot, el_] of wkTimers) if (!wkRec(lot)) { el_.remove(); wkTimers.delete(lot); }
  for (const lot of wkAll()) {
    let e = wkTimers.get(lot); if (!e) { e = document.createElement('div'); e.className = 'wk-timer'; e.dataset.lot = lot; $('#popups').appendChild(e); wkTimers.set(lot, e); }
    const p = W.workerPose(lot), tt = wkTimerText(lot); if (!p || !tt || workerLoc(lot) !== here) { e.style.display = 'none'; continue; }
    const s = W.project(new THREE.Vector3(p.x, 2.0, p.z)); e.style.display = ''; e.style.left = s.x + 'px'; e.style.top = s.y + 'px';
    if (e.textContent !== tt.t) e.textContent = tt.t; const cn = 'wk-timer' + (tt.c ? ' ' + tt.c : ''); if (e.className !== cn) e.className = cn;
  }
});

// ---------------- Cards ----------------
function cardHTML(id, extra = '') {
  const c = CARDS[id]; const r = RARITY[c.rarity]; const ct = cardTier(c), rl = PLANT_TIERS[ct]?.label || r.label;   // v0.51: every card (plant or feature) shows its tier
  const st = S.cards?.[id], lv = st ? cardLv(id) : 1, bump = c.tier ? (lv - 1) * CARD_LEVELS.plant.statPip : 0;
  const statsOf = bump ? { ...c.stats, Beauty: Math.min(5, c.stats.Beauty + bump), Yield: Math.min(5, c.stats.Yield + bump) } : c.stats;
  if (st && (st.n > 1 || lv > 1)) extra += `${st.n > 1 ? `<span class="stack-badge">×${st.n}</span>` : ''}${CARD_LEVELS.upgradable(id, c) ? `<span class="lv-badge">Lv${lv}</span>` : ''}`;
  const art = SPECIES[id] || c.img ? `<img src="${c.img}" alt=""/>` : FEATURE_ART[id];
  const stats = Object.entries(statsOf).map(([k, v]) => `<span>${k}</span><span class="pips">${[1, 2, 3, 4, 5].map((n) => `<b class="${n <= v ? 'on' : ''}"></b>`).join('')}</span>`).join('');
  return `<div class="card r-${ct} t-${ct}${c.tier ? ' plant-card' : ' feature-card'}${S.cards && canUpgrade(id) ? ' can-up' : ''}" data-card="${id}">${extra}<div class="card-face"><div class="card-rar">${rl}</div><div class="card-art">${art}</div>
    <div class="card-name">${c.name}</div><div class="card-type">${c.type}</div><div class="stats">${stats}</div></div></div>`;
}
const plantUses = (sp) => { const d = SPECIES[sp]; if (TREES[sp]) return treeUses(sp); if (!d) return '';
  if (d.noFlower) return `<br/><b>${PLANT_TIERS[d.tier].label}</b> · grows in ${fmtTime(d.growS * 1000)} · seed costs ${d.seedPrice} coins · <b>${d.seedsFixed} seeds per harvest</b>, no flowers · seeds sell for ${d.seedSell} each, ${SEED_BAGS[sp].map((b) => `${b.sell} a bag of ${b.n}`).join(', ')} · uses: replant, bag, Pressed Oil Stand`; const T = PLANT_TIERS[d.tier], sd = !T.seeds[1] && T.bonus ? `0 or 1 (${Math.round(T.bonus * 100)}% chance of 1)` : T.seeds[0] === T.seeds[1] ? `${T.seeds[0]}${T.bonus ? ' (sometimes ' + (T.seeds[0] + 1) + ')' : ''}` : T.seeds.join('–');   // v0.65: Other World = 1 seed half the time
  const u = [DRYING[sp] && 'drying', TINCTURE.recipes[sp] && 'tinctures', STILL.recipes[sp] && 'essential oil'].filter(Boolean);
  return `<br/><b>${T.label}</b> · grows in ${fmtTime(d.growS * 1000)} · seed costs ${d.seedPrice} coins · flowers sell for ${d.flowerSell} · ${sd} seeds per harvest${u.length ? ` · uses: ${u.join(', ')}` : ''}`; };
function zoomCard(id) { const z = el('div', 'zoom', cardHTML(id) + `<p class="zoom-text">${CARDS[id].blurb}${plantUses(id)}<br/><small>Tap anywhere to close</small></p>`); z.addEventListener('click', () => z.remove()); $('#ui').appendChild(z); }
// v0.5: one weighted pick over every card (PACK_W, in % of a card slot). Features keep their v0.41 odds; plants follow
// their tier (Basic 40 · Epic 8 · Legendary 4.5 · Rare 3 · Super Rare 1.8 · Ultra Rare 0.8 · Other World 0.4).
// v0.6: once the Orchard is bought, the 14 tree cards join the pool (PACK_W_ORCH). Each tier's total share is unchanged —
// trees take half of their tier's plant share.
const packW0 = () => (S.lots?.orchard ? PACK_W_ORCH : PACK_W);
// v0.7.2.1: no Glycerin / Vinegar cards in Card Packs until the Tincture Stand is built (the rest of the pool is renormalised)
// v0.7.2.2: likewise no Irrigation card until you have a rain barrel to feed it
const packHidden = (k) => (!S.tinctureBuilt && SUPPLY_CARDS.includes(k)) || (k === 'irrigation' && !Object.keys(S.barrels || {}).length && !S.unlocked.irrigation);
const packW = () => { const w = packW0(); return Object.fromEntries(Object.entries(w).filter(([k]) => !packHidden(k))); };
const packTotal = () => Object.values(packW()).reduce((a, b) => a + b, 0);
const featureOdds = () => Object.keys(FEATURES).reduce((a, k) => a + (packW()[k] || 0), 0) / packTotal() * 100;
const tierOdds = (t) => Object.keys(CARDS).filter((k) => cardTier(CARDS[k]) === t).reduce((a, k) => a + (packW()[k] || 0), 0) / packTotal() * 100;
const cardOdds = (k) => (packW()[k] || 0) / packTotal() * 100;
const tierRank = (t) => PLANT_TIERS[t]?.order || 1;
const ftag = (id) => { const t = FEATURES[id].rarity; return `<em class="tier-tag t-${t}">${PLANT_TIERS[t].label}</em>`; };
function drawCard(rnd = Math.random) {
  let w = rnd() * packTotal();
  for (const [k, p] of Object.entries(packW())) { if (!p) continue; w -= p; if (w < 0) return k; }
  return 'lavender';
}
// v0.52: a pack is never all Basic. If every rolled card is Basic, the LAST slot is rerolled from the Epic-or-better pool
// with the usual relative weights (so the odds inside that pool are unchanged).
const nonBasicW = () => Object.entries(packW()).filter(([k, w]) => w && cardTier(CARDS[k]) !== 'basic');
function drawNonBasic(rnd = Math.random) { const NB = nonBasicW(), tot = NB.reduce((a, [, w]) => a + w, 0); let w = rnd() * tot; for (const [k, p] of NB) { w -= p; if (w < 0) return k; } return NB[NB.length - 1][0]; }
const allBasic = (ids) => ids.every((id) => cardTier(CARDS[id]) === 'basic');
function guarantee(ids, rnd = Math.random) { if (allBasic(ids)) { ids[ids.length - 1] = drawNonBasic(rnd); S.stats.pityRerolls = (S.stats.pityRerolls || 0) + 1; } return ids; }
// v0.63: a pack is 2 plant cards + 1 non-plant card. Each slot draws from its own category with the usual weights (so the tier
// odds INSIDE each category are unchanged), and a card you already own counts OWNED_K (×0.4) as much. The all-Basic guarantee
// redraws the non-plant slot from its Epic-or-better cards.
const isPlantCard = (k) => !!CARDS[k]?.tier;
const ownK = (k, owned) => (owned && S.cards?.[k]?.n > 0 ? OWNED_K : 1);
const catW = (plant, owned = true, nonBasic = false) => Object.entries(packW()).filter(([k, w]) => w > 0 && CARDS[k] && isPlantCard(k) === plant && (!nonBasic || cardTier(CARDS[k]) !== 'basic')).map(([k, w]) => [k, w * ownK(k, owned)]);
function drawFrom(list, rnd = Math.random) { const tot = list.reduce((a, [, w]) => a + w, 0); let w = rnd() * tot; for (const [k, p] of list) { w -= p; if (w < 0) return k; } return list[list.length - 1]?.[0] || 'lavender'; }
const drawPlant = (rnd = Math.random, owned = true) => drawFrom(catW(true, owned), rnd);
const drawOther = (rnd = Math.random, owned = true, nonBasic = false) => drawFrom(catW(false, owned, nonBasic), rnd);
function rollIds(rnd = Math.random, owned = true) {
  const ids = []; for (let i = 0; i < PACK_MIX.plants; i++) ids.push(drawPlant(rnd, owned)); for (let i = 0; i < PACK_MIX.other; i++) ids.push(drawOther(rnd, owned));
  if (allBasic(ids)) { ids[ids.length - 1] = drawOther(rnd, owned, true); S.stats.pityRerolls = (S.stats.pityRerolls || 0) + 1; }
  return ids;
}
const catTierOdds = (plant, t) => { const L = catW(plant, false), tot = L.reduce((a, [, w]) => a + w, 0); return tot ? L.filter(([k]) => cardTier(CARDS[k]) === t).reduce((a, [, w]) => a + w, 0) / tot * 100 : 0; };
function rollPackLoot(rnd = Math.random) { const L = {}; for (const r of ['coins', 'wood', 'scrap']) L[r] = rollLoot(PACK_LOOT[r], rnd); if (!scrapUsable()) L.scrap = 0; return L; }   // v0.7.2.2: no Scrap before a Windmill here
function rollPack(n = 1) { const out = []; for (let i = 0; i < n; i++) out.push(rollIds()); return out; }
let forcedLoot = null;   // test hook: the next pack's loot
// v0.64: one pack card into the collection. Remembers what it changed so a Swap can take it back exactly.
function applyPackCard(id, seen = new Set()) {
  const isNew = (!S.discovered[id] || !S.unlocked[id]) && !seen.has(id); seen.add(id);
  const undo = { disc: !!S.discovered[id], unl: !!S.unlocked[id], irr: !!S.owned.irrigation, supply: 0 };
  S.discovered[id] = true; if (isNew) S.unlocked[id] = true;
  // v0.4: every copy stacks on its card (v0.63: Irrigation copies are level-up progress like any card); a maxed card still pays the old duplicate coins.
    const c = addCard(id); let coins = 0; if (id === 'irrigation') S.owned.irrigation = true; if (!isNew && SUPPLY_CARDS.includes(id)) { bagOf('home')[id] += SUPPLY_DUP; undo.supply = SUPPLY_DUP; }   /* v0.7: free units always go to the Home Bag */   /* v0.52: +2 free units per duplicate supply card */ if (!isNew && (CARD_LEVELS.upgradable(id, CARDS[id]) || FEATURES[id]?.tool) && nextAt(id) == null) {   /* v0.64: a Sickle/Plow kept at max level from an older save still pays */ coins = DUP_COINS; S.coins += coins; }
  return { id, isNew, n: c.n, up: canUpgrade(id), coins, undo };
}
function buyPack(forced) {
  if (!S.marketBuilt) return;
  if (S.freePacks > 0) S.freePacks--;   // v0.63: a free pack (Day 10 gift) is opened before any Jewels are spent
  else { if (S.jewels < PACK_JEWELS) { toast(`Need ${PACK_JEWELS} Jewel${PACK_JEWELS > 1 ? 's' : ''} for a Card Pack — get one in the Jewel Shop`); openPanel('jewels'); return; }
    S.jewels -= PACK_JEWELS; }
  S.packs++;
  const ids = rollIds();
  if (S.packs === 1 && !S.unlocked.chamomile) ids[1] = 'chamomile';
  if (forced) forced.forEach((f, k) => f && (ids[k] = f));
  const loot = forcedLoot || rollPackLoot(); forcedLoot = null; if (!scrapUsable()) loot.scrap = 0;   // v0.63: coins, wood & Scrap Metal in every pack
  S.coins += loot.coins; S.wood += loot.wood; S.scrap += loot.scrap; const st = (S.stats.packLoot ||= { coins: 0, wood: 0, scrap: 0 }); for (const r in loot) st[r] += loot[r];
  const seen = new Set();
  const results = ids.map((id) => applyPackCard(id, seen));
  save(); hud(); closePanel();
  showReveal(results, { title: 'Botanical Card Pack', again: !forced, loot, swap: true, onCollect: (news) => { tip('pack'); if (news.length) openPanel('market', 'buy'); if (ADS.interstitialAfterPack) setTimeout(() => Ads.maybeBreak('pack', adBlocked()), 700); } });
}
let revealCards = null, revealOpts = {};
// v0.64: Swap · 1 Jewel. After a card flips, a card below Rare (Basic, Epic, Legendary) can be swapped ONCE for a random Rare-or-better
// card (Rare, Super Rare, Ultra Rare, Other World) at their normal relative odds (v0.65: one mixed pool, see below) when
// that pool has cards, owned cards ×OWNED_K. The old card is taken back out (its copy, duplicate coins and supply bonus reversed).
const SWAP = { jewels: 1, minTier: 'rare' };
const swapOk = (r) => !r.swapped && tierRank(cardTier(CARDS[r.id])) < tierRank(SWAP.minTier);
// v0.65: every swap (plant or non-plant card) draws from ALL Rare-or-better cards — plants, trees (with the Orchard) and garden
// charms/features together — with their normal pack weights (so the normal tier odds), and cards you own count ×OWNED_K.
// The plant flag is kept for old callers and ignored.
const swapPool = (plant, owned = true) => [...catW(true, owned), ...catW(false, owned)].filter(([k]) => tierRank(cardTier(CARDS[k])) >= tierRank(SWAP.minTier));
const SWAP_TIERS = () => TIER_ORDER.filter((t) => swapTierOdds(true, t) > 0);
const swapTierOdds = (plant, t) => { const L = swapPool(plant, false), tot = L.reduce((a, [, w]) => a + w, 0); return tot ? L.filter(([k]) => cardTier(CARDS[k]) === t).reduce((a, [, w]) => a + w, 0) / tot * 100 : 0; };
function unapplyPackCard(r) {
  const c = S.cards[r.id], u = r.undo || {};
  if (c) { c.n = (+c.n || 1) - 1; if (c.n <= 0) delete S.cards[r.id]; }
  S.coins -= r.coins || 0; if (u.supply) { const hb = bagOf('home'); hb[r.id] = Math.max(0, (hb[r.id] || 0) - u.supply); }
  const still = revealCards.some((x) => x !== r && x.id === r.id && !x.gone);
  if (!still && !S.cards[r.id]) { if (!u.disc) delete S.discovered[r.id]; if (!u.unl) delete S.unlocked[r.id]; if (r.id === 'irrigation' && !u.irr) S.owned.irrigation = false; }
}
let swapForced = null;   // test hook: the next swap's card
function swapCard(k, rnd = Math.random) {
  const old = revealCards?.[k]; if (!old || !swapOk(old)) return null;
  if (!spendJewels(SWAP.jewels)) return null;
  unapplyPackCard(old); old.gone = true;
  const id = swapForced || drawFrom(swapPool(isPlantCard(old.id)), rnd); swapForced = null;
  const seen = new Set(revealCards.filter((x) => !x.gone).map((x) => x.id));
  const nr = applyPackCard(id, seen); nr.swapped = true; nr.from = old.id; revealCards[k] = nr;
  S.stats.swaps = (S.stats.swaps || 0) + 1; save(); hud();
  return nr;
}
const tagHTML = (r) => (r.isNew ? '<span class="new-tag">NEW</span>' : `<span class="dup-tag">${r.up ? '✨ Upgrade ready' : r.coins ? `Max level · +${r.coins}` : r.id === 'irrigation' ? `Stacked ×${r.n} · Lv${irrigLv()}: full bed ${WATER.stage[irrigLv() - 1]} water/stage` : SUPPLY_CARDS.includes(r.id) ? `Stacked ×${r.n} · +${SUPPLY_DUP} ${CARDS[r.id].name}` : `Stacked ×${r.n}`}</span>`);
function swapBtn(c, k) {   // added under a flipped card; the slot (and its listener) goes away with the reveal
  const w = c.parentElement; if (!revealOpts.swap || !w || w.querySelector('.swap-btn')) return;
  const r = revealCards[k]; if (!r || !swapOk(r)) return;
  const b = el('button', 'swap-btn' + (S.jewels < SWAP.jewels ? ' off' : ''), S.jewels < SWAP.jewels ? `Swap · ${SWAP.jewels}<i data-icon="jewel"></i><small>Need ${SWAP.jewels} Jewel</small>` : `Swap · ${SWAP.jewels}<i data-icon="jewel"></i>`);
  b.type = 'button'; b.dataset.swap = k; if (S.jewels < SWAP.jewels) b.disabled = true; w.appendChild(b); fillIcons(b);
  b.addEventListener('click', (e) => { e.stopPropagation();
    confirmBox(`<i data-icon="jewel" class="confirm-ico"></i><h3>Swap ${CARDS[r.id].name}?</h3><p>Spend <b>${SWAP.jewels} Jewel</b> to trade this ${PLANT_TIERS[cardTier(CARDS[r.id])].label} card for a random <b>Rare or better</b> card — a plant or a garden item (${SWAP_TIERS().map((t) => `${PLANT_TIERS[t].label} ${+swapTierOdds(true, t).toFixed(1)}%`).join(' · ')}). This card is given back. You have ${S.jewels}.</p>`, `Swap · ${SWAP.jewels} Jewel`, () => swapIn(k)); });
}
function swapIn(k) {
  const R = $('#reveal'), w = R?.querySelectorAll('.deal .slotw')[k]; if (!w) return;
  const nr = swapCard(k); if (!nr) return;
  const rar = cardTier(CARDS[nr.id]);
  w.querySelector('.swap-btn')?.remove();
  const c = el('div', `card flip flipped swap-in hint-tier hint-${rar}`);
  c.innerHTML = `<div class="flip-inner"><div class="back"><img src="assets/emblem.png" alt=""/><span>Petalspire</span></div><div class="front">${cardHTML(nr.id, tagHTML(nr) + '<span class="swap-tag">Swapped</span>')}</div></div>`;
  const front = c.querySelector('.front > .card'); front.style.cssText = 'position:absolute;inset:0;width:auto;--cw:inherit';
  c.addEventListener('click', () => zoomCard(nr.id));
  w.querySelector('.card.flip')?.replaceWith(c); fillIcons(c);
  const b = c.getBoundingClientRect(); sparkles(R, b.left + b.width / 2, b.top + b.height / 2, 14 + tierRank(rar) * 3); petals(R, 18, PLANT_TIERS[rar].color);
  if (HERO_TIERS[rar]) heroShow(nr, rar);
  for (const x of R.querySelectorAll('.swap-btn')) { const kk = +x.dataset.swap; x.remove(); swapBtn(R.querySelectorAll('.deal .card.flip')[kk], kk); }   // refresh the others (Jewels changed)
  if (R.querySelector('.deal')) { const news = revealCards.filter((x) => x.isNew).map((x) => CARDS[x.id].name); const sub = $('.sub', R); if (sub && [...R.querySelectorAll('.deal .flip')].every((x) => x.classList.contains('flipped'))) sub.textContent = revealOpts.done || (news.length ? `Unlocked in the Supply Market: ${news.join(', ')}` : 'All duplicates — coins added to your purse'); }
}
function showReveal(results, opts = {}) {
  revealCards = results; revealOpts = opts;
  const R = $('#reveal'); R.classList.remove('hidden', 'sus', 'sus-1', 'sus-2', 'sus-3'); R.dataset.stage = 'pack'; delete R.dataset.tier; delete R.dataset.hero; revealTimers.forEach(clearTimeout); revealTimers = [];
  R.innerHTML = `<div class="rays"></div><h2>${opts.title || 'Card Pack'}</h2><p class="sub">Tap the pack to open</p><div class="big-pack" id="bigpack"><img src="assets/pack.jpg" alt=""/>${opts.title?.startsWith('Starter') ? '<span class="pack-ribbon">Starter Seeds</span>' : ''}</div><div class="reveal-actions"></div>`;
  const bp = $('#bigpack');
  // v0.52: a pack holding a Super Rare / Ultra Rare / Other World card gets a suspense moment first: it shakes harder and
  // glows in that tier's colour (Other World adds a starfield + aurora and a longer build-up). Tap anywhere to skip.
  const top = results.map((r) => cardTier(CARDS[r.id])).sort((a, b) => tierRank(b) - tierRank(a))[0], H = HERO_TIERS[top];
  const open = () => {
    bp.removeEventListener('click', open); sfx('pack');
    if (H) return suspense(R, bp, top, H, results);
    bp.classList.add('shake');
    setTimeout(() => { bp.classList.remove('shake'); bp.classList.add('burst'); R.appendChild(el('div', 'flash')); sparkles(R, window.innerWidth / 2, window.innerHeight * 0.45, 26); }, 850);
    setTimeout(() => deal(results), 1250);
  };
  bp.addEventListener('click', open); R.dataset.stage = 'pack';
}
// ---------------- v0.52: big reveals for Super Rare, Ultra Rare and Other World ----------------
// Pure CSS transforms/opacity + a few dozen small DOM particles (no images), so it stays smooth on iPhone Safari.
const HERO_TIERS = {
  superrare:  { lvl: 1, wait: 1500, hold: 2800, glow: '#8FD6A8', light: '#E4F7EA', dark: '#18382A', petals: 34, buzz: [25, 70, 25, 70, 40] },
  ultra:      { lvl: 2, wait: 2100, hold: 3400, glow: '#C9A2F2', light: '#F3E6FD', dark: '#2C1C47', petals: 48, buzz: [25, 60, 30, 60, 40, 50, 60] },
  otherworld: { lvl: 3, wait: 3000, hold: 4400, glow: '#A8B6FF', light: '#EEF0FF', dark: '#14122A', petals: 64, buzz: [20, 60, 25, 55, 30, 50, 40, 45, 60, 40, 120] },
};
const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* not supported (iOS Safari) */ } };
const PETAL_COLS = ['#F7C5C5', '#EDA3A8', '#F3E7B5', '#BFDCCF', '#FFFFFF', '#F5D07A'];
function petals(root, n, tint) {
  n = Math.min(n, Math.max(0, 70 - root.getElementsByClassName('petal').length));   // v0.63: never more than ~70 live petals (iOS memory)
  for (let i = 0; i < n; i++) {
    const p = el('i', i % 3 ? 'petal' : 'petal sp'); const x = Math.random() * 100, dx = (Math.random() - 0.5) * 120, d = 1.6 + Math.random() * 1.6;
    p.style.cssText = `left:${x}%;--dx:${dx}px;--r:${(Math.random() - 0.5) * 720}deg;animation-duration:${d}s;animation-delay:${Math.random() * 0.6}s;background:${i % 7 === 0 && tint ? tint : PETAL_COLS[i % PETAL_COLS.length]}`;
    root.appendChild(p); setTimeout(() => p.remove(), (d + 0.8) * 1000);
  }
}
function starfield(root) {
  const f = el('div', 'starfield'); for (let i = 0; i < 40; i++) { const st = el('i'); st.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 2}s;transform:scale(${0.4 + Math.random()})`; f.appendChild(st); }
  root.prepend(el('div', 'aurora')); root.prepend(f);
}
let revealTimers = [];
const rlater = (fn, ms) => revealTimers.push(setTimeout(fn, ms));
function suspense(R, bp, tier, H, results) {
  R.dataset.stage = 'suspense'; R.dataset.tier = tier; R.style.setProperty('--tc', H.glow); R.style.setProperty('--tcl', H.light); R.style.setProperty('--tcd', H.dark); R.classList.add('sus', 'sus-' + H.lvl);
  if (tier === 'otherworld') starfield(R);
  bp.classList.add('suspense'); $('.sub', R).textContent = tier === 'otherworld' ? 'Something otherworldly stirs…' : 'Something rare is inside…';
  buzz(H.buzz);
  let done = false;
  const go = () => { if (done) return; done = true; revealTimers.forEach(clearTimeout); revealTimers = []; R.removeEventListener('click', skip);
    bp.classList.remove('suspense'); bp.classList.add('burst'); R.appendChild(el('div', 'flash big'));
    sparkles(R, window.innerWidth / 2, window.innerHeight * 0.45, 30 + H.lvl * 10); petals(R, H.petals, H.glow); buzz([60, 40, 90]);
    setTimeout(() => { R.classList.remove('sus', 'sus-1', 'sus-2', 'sus-3'); deal(results, tier); }, 520); };
  const skip = (e) => { if (e.target.closest('#bigpack') || R.dataset.stage === 'suspense') go(); };
  setTimeout(() => R.addEventListener('click', skip), 50);
  rlater(go, H.wait);
}
// The big card moment: god-rays, a flash, the card flipping in large with a holographic sheen, the tier name stamped in with
// a bounce and a petal & sparkle shower. Tap anywhere to skip; it closes by itself after `hold`.
let heroOpen = null, heroHoldMs = 0;   // heroHoldMs: test hook so slow headless screenshots can catch the peak
function heroShow(r, tier) {
  const H = HERO_TIERS[tier], R = $('#reveal'); if (!H || !R) return;
  if (heroOpen) heroOpen.close(true);
  const o = el('div', `hero-reveal hr-${H.lvl} hr-${tier}`); o.style.setProperty('--tc', H.glow); o.style.setProperty('--tcl', H.light); o.style.setProperty('--tcd', H.dark);
  o.innerHTML = `<div class="hr-bg"></div><div class="hr-rays"></div><div class="hr-rays r2"></div><div class="hr-card"><div class="hr-flip">${cardHTML(r.id)}<div class="holo"></div></div></div>
    <div class="hr-stamp">${PLANT_TIERS[tier].label}</div><div class="hr-name">${CARDS[r.id].name}${r.isNew ? ' · NEW' : ''}</div><small class="hr-skip">Tap to continue</small>`;
  if (tier === 'otherworld') starfield(o);
  R.appendChild(o); R.dataset.stage = 'hero'; R.dataset.hero = tier; fillIcons(o);
  o.appendChild(el('div', 'flash big'));
  petals(o, H.petals, H.glow); setTimeout(() => sparkles(o, window.innerWidth / 2, window.innerHeight * 0.42, 24 + H.lvl * 12), 450);
  if (H.lvl >= 2) setTimeout(() => petals(o, Math.round(H.petals / 2), H.glow), 1300);
  buzz(H.lvl === 3 ? [40, 50, 80, 50, 160] : [40, 50, 110]);
  let t = 0; const drift = setInterval(() => o.isConnected ? petals(o, 6 + H.lvl * 3, H.glow) : clearInterval(drift), 650);   // a gentle shower keeps falling while the card is shown
  const close = (instant) => { if (!o.isConnected) return; clearTimeout(t); clearInterval(drift); heroOpen = null; R.dataset.stage = 'deal'; delete R.dataset.hero;
    if (instant) o.remove(); else { o.classList.add('out'); setTimeout(() => o.remove(), 320); } };
  heroOpen = { close, tier };
  setTimeout(() => o.addEventListener('click', () => close()), 250);
  t = setTimeout(() => close(), heroHoldMs || H.hold);
}
function deal(results) {
  const R = $('#reveal'); R.dataset.stage = 'deal';
  const keep = [...R.querySelectorAll('.petal, .sparkle, .flash.big')];   // v0.52: let the burst's petal shower finish over the dealt cards
  R.innerHTML = `<div class="rays"></div><h2>Your new cards</h2><p class="sub">Tap each card to reveal it</p>${revealOpts.loot ? lootHTML(revealOpts.loot) : ''}<div class="deal"></div><div class="reveal-actions"><button class="btn" data-act="reveal-all">Reveal all</button></div>`;
  keep.forEach((k) => R.appendChild(k));
  if (revealOpts.loot) { fillIcons($('.pack-loot', R)); lootCount(R); }
  const d = $('.deal', R);
  results.forEach((r, k) => {
    const rar = cardTier(CARDS[r.id]);
    const c = el('div', `card flip ${tierRank(rar) >= 2 ? 'hint-tier hint-' + rar : ''}`);
    const w = el('div', 'slotw'); w.style.animationDelay = `${k * 0.16}s`; w.appendChild(c);
    c.innerHTML = `<div class="flip-inner"><div class="back"><img src="assets/emblem.png" alt=""/><span>Petalspire</span></div><div class="front">${cardHTML(r.id, tagHTML(r))}</div></div>`;
    const front = c.querySelector('.front > .card'); front.style.cssText = 'position:absolute;inset:0;width:auto;--cw:inherit';
    c.addEventListener('click', () => { if (!c.classList.contains('flipped')) flip(c, r); else zoomCard(r.id); });
    d.appendChild(w);
  });
  $('[data-act="reveal-all"]', R).addEventListener('click', () => { [...d.querySelectorAll('.flip')].forEach((c, k) => setTimeout(() => !c.classList.contains('flipped') && flip(c, results[k]), k * 280)); });
}
// v0.63: the pack's coins / wood / Scrap Metal count up under the title. One rAF loop for all three chips; it stops by itself
// when done or when the reveal is closed (no timers or listeners left behind). A near-max roll (≥ 90% of max) gets a gold flourish.
const LOOT_UI = { coins: ['coin', 'Coins'], wood: ['wood', 'Wood'], scrap: ['scrap', 'Scrap'] };
const lootBig = (r, n) => n >= PACK_LOOT[r] * PACK_LOOT.bigAt;
function lootHTML(L) {
  return `<div class="pack-loot" data-pack-loot>${Object.keys(LOOT_UI).filter((r) => r !== 'scrap' || L[r] > 0).map((r, k) => `<div class="loot-chip${lootBig(r, L[r]) ? ' big' : ''}" data-loot="${r}" data-to="${L[r]}" style="animation-delay:${0.15 + k * 0.12}s"><i data-icon="${LOOT_UI[r][0]}"></i><b>+0</b><small>${LOOT_UI[r][1]}</small>${lootBig(r, L[r]) ? '<em class="loot-wow">WOW!</em>' : ''}</div>`).join('')}</div>`;
}
function lootCount(R) {
  const chips = [...R.querySelectorAll('.loot-chip')], t0 = performance.now() + 350, dur = 1100;
  const step = (t) => {
    if (!chips[0]?.isConnected) return;   // reveal closed → stop
    const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
    for (const c of chips) c.firstElementChild.nextElementSibling.textContent = '+' + fmtC(Math.round(+c.dataset.to * e));
    if (k < 1) return requestAnimationFrame(step);
    for (const c of chips) { c.classList.add('done'); const b = c.getBoundingClientRect(); sparkles(R, b.left + b.width / 2, b.top + b.height / 2, c.classList.contains('big') ? 22 : 6); }
    if (chips.some((c) => c.classList.contains('big'))) { buzz([30, 40, 60]); R.querySelector('.pack-loot')?.classList.add('jackpot'); }
  };
  requestAnimationFrame(step);
}
function flip(c, r) {
  c.classList.add('flipped');
  { const k = [...(c.closest('.deal')?.querySelectorAll('.card.flip') || [])].indexOf(c); if (k >= 0) swapBtn(c, k); }
  const rar = cardTier(CARDS[r.id]); const b = c.getBoundingClientRect();
  if (tierRank(rar) >= 2) sparkles($('#reveal'), b.left + b.width / 2, b.top + b.height / 2, 10 + tierRank(rar) * 4);   // v0.51: more sparkle the higher the tier (Epic 18 … Other World 38)
  if (HERO_TIERS[rar]) heroShow(r, rar);   // v0.52
  const R = $('#reveal');
  if ([...R.querySelectorAll('.deal .flip')].every((x) => x.classList.contains('flipped'))) {
    const news = revealCards.filter((x) => x.isNew).map((x) => CARDS[x.id].name);
    $('.sub', R).textContent = revealOpts.done || (news.length ? `Unlocked in the Supply Market: ${news.join(', ')}` : 'All duplicates — coins added to your purse');
    const A = $('.reveal-actions', R), J = S.jewels, pj = `${PACK_JEWELS} Jewel${PACK_JEWELS > 1 ? 's' : ''}`;
    // v0.52: after a bought pack, offer the next one right here while Jewels last (Done ends the run; 0 Jewels → Done + a soft Jewel Shop link)
    if (revealOpts.again) {
      A.classList.add('again-wrap');
      A.innerHTML = J >= PACK_JEWELS
        ? `<button class="btn btn-primary big again" data-act="pack-again"><i data-icon="jewel"></i> Open another pack (${pj})</button><small class="jewels-left" data-jewels-left="${J}">You have ${J} Jewel${J === 1 ? '' : 's'}</small><button class="btn done-btn" data-act="collect">Done</button>`
        : `<button class="btn btn-primary big" data-act="collect">Done</button><small class="jewels-left" data-jewels-left="0">No Jewels left · <a href="#" class="get-jewels" data-act="get-jewels">Get more Jewels</a></small>`;
      fillIcons(A);
    } else A.innerHTML = `<button class="btn btn-primary big" data-act="collect">Collect</button>`;
    const shut = () => { heroOpen?.close(true); R.classList.add('hidden'); R.innerHTML = ''; };
    $('[data-act="collect"]', R).addEventListener('click', () => { shut(); revealOpts.onCollect?.(news); });
    $('[data-act="pack-again"]', R)?.addEventListener('click', () => { S.stats.packAgain = (S.stats.packAgain || 0) + 1; shut(); buyPack(); });
    $('[data-act="get-jewels"]', R)?.addEventListener('click', (e) => { e.preventDefault(); shut(); openPanel('jewels'); });
  }
}
function sparkles(root, x, y, n) {
  n = Math.min(n, Math.max(0, 60 - root.getElementsByClassName('sparkle').length));   // v0.63: cap live sparkles
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
const PANS = { home: { x0: -13, x1: 13, z0: -28, z1: 5 }, orchard: { x0: ORCH_X - 9, x1: ORCH_X + 9, z0: -15, z1: 6 } };   // v0.6: per Map location
let PAN = PANS.home;
// v0.7.1: generous pan limits — the land of this location (every plot, owned or for sale, plus the road) and, past it, about half
// a screen of margin so an edge item can be brought to the middle. Past the land edge the drag is damped (a soft limit), and it
// stops at the margin so nobody gets lost in the void.
const PAN_DAMP = 0.5;
function panBounds() {
  const loc = curLoc(), ls = Object.entries(LOTS).filter(([id]) => lotLoc(id) === loc).map(([, L]) => L);
  const land = ls.length ? { x0: Math.min(...ls.map((L) => L.x0)), x1: Math.max(...ls.map((L) => L.x1)), z0: Math.min(...ls.map((L) => L.z0)), z1: Math.max(ROAD.z1, ...ls.map((L) => L.z1)) } : PAN;
  const w = innerWidth, h = innerHeight, c = W.groundAt(w / 2, h / 2), e = W.groundAt(w, h / 2), tp = W.groundAt(w / 2, h * 0.15);
  const mx = Math.max(6, c && e ? Math.hypot(e.x - c.x, e.z - c.z) : 6), mz = Math.max(6, c && tp ? Math.hypot(tp.x - c.x, tp.z - c.z) : 6);
  return { land, x0: land.x0 - mx, x1: land.x1 + mx, z0: land.z0 - mz, z1: land.z1 + mz };
}
const panStep = (v, d, lo, hi, l0, l1) => { let n = v + d; if ((n < l0 && d < 0) || (n > l1 && d > 0)) n = v + d * PAN_DAMP; return THREE.MathUtils.clamp(n, Math.min(lo, v), Math.max(hi, v)); };
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
  const t = W.ctl.target, B = panBounds(); t.x = panStep(t.x, -(b.x - a.x), B.x0, B.x1, B.land.x0, B.land.x1); t.z = panStep(t.z, -(b.z - a.z), B.z0, B.z1, B.land.z0, B.land.z1);
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
    if (h?.kind === 'site') { if (h.ok) buildBed(h.id); else if (siteStands(siteById(h.id)).length) toast('A crafting stand stands on this patch — no room for a bed here'); else toast(`Clear the ${siteLeft(h.id)} trees, stumps or decor in this patch first`); }
    return;
  }
  if (placing?.what === 'sickle' || placing?.what === 'plow') { const h = W.pick(x, y); let b = h?.kind === 'tile' ? Math.floor(h.index / PER_BED) : -1;
    if (b < 0) { const g = W.pick(x, y, 'ground'); if (g) b = S.beds.findIndex((id) => { const st = siteById(id); return Math.abs(st.x - g.point.x) < TILE * BED_N / 2 + 0.35 && Math.abs(st.z - g.point.z) < TILE * BED_N / 2 + 0.35; }); }
    if (b < 0) { toast('Tap one of your raised beds'); return; }
    if (placing.what === 'sickle') sickleBed(b); else plowBed(b, placing.sp); syncTools(); return; }
  if (placing?.what === 'irrigation') { const h = W.pick(x, y); const id = h?.kind === 'tile' ? bedOfTile(h.index) : null; if (!id) { toast('Tap one of your raised beds'); return; } if (!commitBuy(placing)) return; if (assignIrrigation(id)) exitPlace(); else rollbackBuy(placing); return; }
  if (placing) { const g = W.pick(x, y, 'ground'); if (g) placeAt(g.point.x, g.point.z); return; }
  if (panel) return closePanel();
  const hit = W.pick(x, y);
  if (!hit || hit.kind === 'ground') { deselect(); return; }
  if (hit.kind === 'tile') {
    const p = S.tiles[hit.index];
    if (selected === hit.index && p) { if (thirsty(p) && totalWater()) return water(hit.index); if (stageOf(p) === 3) return harvest(hit.index); }
    selectTile(hit.index);
  } else if (hit.kind === 'obstacle') { if (!hit.id.startsWith('g:')) deselect(); tapObstacle(hit.id); }
  else if (hit.kind === 'loot') collectLoot(hit.key);
  else if (hit.kind === 'decor') focusThing({ kind: 'decor', key: hit.key });
  else if (hit.kind === 'gfeat') focusThing({ kind: 'gfeat', key: hit.key });
  else if (hit.kind === 'blueprint') openPanel(hit.id === 'oshed' ? 'ostand' : 'build');
  else if (hit.kind === 'lot') openLot(hit.id);
  else if (hit.kind === 'bulkbox') openPanel('bulk', hit.loc);   // v0.65
  else if (hit.kind === 'stand') openPanel('stand');
  else if (hit.kind === 'orchardshed') openPanel('ostand');
  else if (hit.kind === 'worker') openPanel('worker', hit.id);
  else if (hit.kind === 'market') openPanel('market');
  else if (hit.kind === 'rack') openPanel('rack');
  else if (hit.kind === 'tincture') openPanel('tincture');
  else if (hit.kind === 'still') openPanel('still');
  else if (hit.kind === 'teastand') openPanel('teastand');
  else if (hit.kind === 'press' || hit.kind === 'opress' || hit.kind === 'fruitstand') openPanel(hit.kind);
  else if (hit.kind === 'orchardtree') { const t = S.orchard[hit.k]; if (t && orchRipe(t)) pickTree(hit.k); else if (t?.dry && orchStage(t) >= 3 && waterTree(hit.k)) { save(); hud(); } else openPanel('orchardtree', hit.k); }
  else if (hit.kind === 'windmill') { if (!building.windmill) toast(`Windmill · every connected rain barrel refills every ${regenS()} s (instead of ${S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S} s)`); }
  else if (hit.kind === 'billboard') { if (!building[hit.loc === 'orchard' ? 'obillboard' : 'billboard']) openPanel('billboard'); }
  else if (hit.kind === 'parking') { const o = hit.loc === 'orchard'; if (!building[o ? 'oparking' : 'parking']) toast(`${o ? 'Orchard ' : ''}Parking Lot Lv${cardLv('parking')} · ${(o ? ocusts : custs).length}/${o ? oparkCap() : parkCap()} spots in use · groups of ${o ? oparkCars() : parkCars()} cars · ${Math.round((o ? oExtraChance() : extraItemChance()) * 100)}% add an extra item${cardLv('parking') < 4 ? ' · buy more Parking Lot cards (Market or Build menu) to level up' : ''}`); }
  else if (hit.kind === 'barrel') focusThing({ kind: 'barrel', lot: hit.lot });
  else if (hit.kind === 'hive') focusThing({ kind: 'hive', lot: hit.lot });
}

setLoc(curLoc(), true);   // v0.6: resume where the player left off (Home or the Orchard)

// ---------------- Title & intro ----------------
if (S.introDone) $('#btn-start').textContent = 'Continue';
$('#btn-start').addEventListener('click', () => {
  $('#title').classList.add('out'); setTimeout(() => $('#title').classList.add('hidden'), 650);
  document.body.classList.remove('on-title');   // v0.68: the HUD and tab bar wait behind the title screen
  if (migrated) setTimeout(() => toast(`Petalspire v${BUILD} — a fresh start in the woods!`), 900);
  if (upgraded) setTimeout(() => toast(`Welcome to v${BUILD}! Your garden came along · +1 tree sapling (Orchard Bag) · +${STARTER_JEWELS} Jewels`), 900);
  else if (migrated04) setTimeout(() => toast(`Welcome to v${BUILD} — water now only comes from rain barrels, one per plot (4 beds each)${migrated04.moved ? ` · ${migrated04.moved} bag water poured into your home barrel` : ''}${migrated04.lost ? ` · ${migrated04.lost} extra water didn’t fit and was lost` : ''}${migrated04.dropped ? ` · ${migrated04.dropped} irrigated bed${migrated04.dropped === 1 ? ' was' : 's were'} unhooked: give that plot a Rain Barrel (Supply Market), then re-assign` : ''}`), 900);
  if (hiveMigrated) setTimeout(() => toast('Your Honeybee Skep now sits on the Home plot — its bees boost only that plot’s beds (+1 flower per harvest)'), 6200);
  if (mig061.fruitBack || mig061.moved.length || mig061.fsCard) setTimeout(() => toast(`v0.61: each place sells its own goods${mig061.fruitBack ? ` · ${mig061.fruitBack} fruit item${mig061.fruitBack > 1 ? 's' : ''} moved from the Farm Stand to your Bag (sell them at the Orchard Stand)` : ''}${mig061.moved.length ? ` · ${mig061.moved.map((w) => FEATURES[w]?.name || w).join(', ')} moved to your Bag — place ${mig061.moved.length > 1 ? 'them' : 'it'} again (Bag › Place)` : ''}${mig061.fsCard ? ` · the Fruit Stand is free with the Orchard now${mig061.fsCard.coins ? ` · +${mig061.fsCard.coins} coins back` : ''}` : ''}`), 2600);
  if (tincCardMigrated) setTimeout(() => toast(`v0.52: the Tincture Stand is a free goal reward now, not a pack card${tincCardMigrated.gave ? ' — your card became the stand itself (Bag › Place)' : ' — you keep your stand'}${tincCardMigrated.coins ? ` · ${tincCardMigrated.n - 1} duplicate card${tincCardMigrated.n > 2 ? 's' : ''} → +${tincCardMigrated.coins} coins` : ''}`), 4200);
  if (basesMigrated) setTimeout(() => toast('v0.52: Glycerin and Vinegar are cards now — you own the Tincture Stand, so both are unlocked for you'), 2600);
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
const revealEl = $('#reveal');
function tick() {
  requestAnimationFrame(tick);
  const t = performance.now();
  W.setPaused(revealEl && !revealEl.classList.contains('hidden') && revealEl.dataset.stage !== 'none');   // v0.63: no 3D redraws under the pack reveal
  if (t - lastTick > 250) { syncBedTargets();
    roadScrapTick(Math.min(1, (t - lastTick) / 1000));
    lastTick = t;
    refreshShade();
    for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i]) syncTile(i); syncTools();
    syncRack(); syncTrees();
    for (const r of [...S.restoring]) if (now() - r.start >= r.ms) finishRestore(r);
    if (S.marketProj) { if (marketK() >= 1) finishMarket(); else W.setMarketState('building', marketK()); }
    syncCons(); syncJewelDock(); syncDeliv();
    if (regenBarrels() && selected != null) renderSheet();
    autoIrrigate(); autoWaterTrees(); syncBarrels(); syncTinc(); syncStill(); syncTea(); syncCraft('press'); syncCraft('opress'); syncCraft('fruitstand'); syncOrchard();
    if (focus?.kind === 'barrel') { const n = $('#barrel-txt'); if (n && S.barrels[focus.lot]) n.textContent = barrelText(focus.lot); }
    else if (selected != null && S.tiles[selected] && thirsty(S.tiles[selected]) && (+$('#tile-sheet').dataset.water !== totalWater() || !totalWater()) && +$('#tile-sheet').dataset.tw !== Math.floor(now() / 1000)) { $('#tile-sheet').dataset.tw = Math.floor(now() / 1000); renderSheet(); }
    if (panel === 'still') { let redo = false; S.stills.forEach((t, k) => { const n = $(`[data-sleft="${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (CRAFT[panel]) { let redo = false; S[CRAFT[panel].slots].forEach((t, k) => { const n = $(`[data-cleft="${panel}:${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (panel === 'orchardtree') { const t = S.orchard[panelArg], n = $(`[data-oleft="${panelArg}"]`); if (t) { const left = orchStage(t) < 3 ? t.at + t.growMs - now() : t.next - now(); if (left <= 0 || (orchRipe(t) && n)) renderPanel(); else if (n) n.textContent = fmtTime(left); } }
    if (panel === 'teastand') { let redo = false; S.teas.forEach((t, k) => { const n = $(`[data-eleft="${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (panel === 'tincture') { let redo = false; S.tinc.forEach((t, k) => { const n = $(`[data-tleft="${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (S.standBuilt && !building.stand) {
      if (custs.length < parkCap() && standCount() > 0 && now() >= nextCust && S.introDone) spawnArrival();
      if (panel === 'stand' && !custs.length) { const n = $('#stand-status'); if (n && standCount()) n.textContent = `Next customer in about ${fmtTime(Math.max(0, nextCust - now()))}`; }
    }
    if (S.introDone && now() >= nextPass) { if (!W.cars.some((c) => c.dir < 0 && !c.ox)) W.spawnCar({ dir: -1 }); nextPass = now() + randInt(14000, 32000) / (bbActiveAt('home') ? BILLBOARD.mult : 1); }
    if (S.lots.orchard && S.oshedBuilt && !building.oshed) {   // v0.61: the Orchard Stand's visitors
      if (ocusts.length < oparkCap() && ostandCount() > 0 && now() >= nextOCust && (S.oparkingBuilt || !ocusts.length)) spawnOArrival();
      if (panel === 'ostand' && !ocusts.length) { const n = $('#stand-status'); if (n && ostandCount()) n.textContent = `Next visitor in about ${fmtTime(Math.max(0, nextOCust - now()))}`; }
    }
    if (S.lots.orchard && now() >= nextOPass) { if (!W.cars.some((c) => (c.ox && c.state === 'pass') || c.van)) W.spawnCar({ dir: Math.random() < 0.5 ? -1 : 1, ox: ORCH_X }); nextOPass = now() + randInt(12000, 26000) / (bbActiveAt('orchard') ? BILLBOARD.mult : 1); }
    syncBillboard();
    hud(); checkGoals();
    if (selected != null && S.tiles[selected]?.wateredAt) {
      const p = S.tiles[selected], k = progress(p), pr = $('#sheet-prog');
      if (pr && $('#sheet-left')) { pr.style.width = (k * 100).toFixed(1) + '%'; $('#sheet-left').textContent = `Blooms in ${fmtTime(p.growMs * (1 - k))}`; }
      if (stageOf(p) !== +$('#tile-sheet').dataset.st || budWait(p) !== ($('#tile-sheet').dataset.bw === '1')) renderSheet();
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
    for (const uc of document.querySelectorAll('[data-upgt]')) { const key = uc.dataset.upgt, l = upgLeft(key); if (l) { uc.querySelector('[data-uprog]').style.width = (upgK(key) * 100).toFixed(1) + '%'; uc.querySelector('[data-uleft]').textContent = clock(l); } }
    { const cc = document.querySelector('#panel-body [data-cons]'); if (cc) { const k = cc.dataset.cons, l = consLeft(k); if (!l) renderPanel(); else { cc.querySelector('[data-cprog]').style.width = (consK(k) * 100).toFixed(1) + '%'; cc.querySelector('[data-cleft]').textContent = clock(l); const fb = cc.querySelector('[data-act="cons-finish"]'), j = consJewels(l); if (+fb.dataset.consCost !== j) { fb.dataset.consCost = j; fb.innerHTML = `Finish now · ${jewelPrice(j)}`; fillIcons(fb); } } } }
    if (S.marketProj && (panel === 'market' || panel === 'build')) { const k = marketK(); const a = document.querySelector('[data-mprog]'), b = document.querySelector('[data-mleft]'); if (a) a.style.width = (k * 100).toFixed(1) + '%'; if (b) b.textContent = `${fmtTime(S.marketProj.ms * (1 - k))} left`; }
  }
  W.render();
}
fillIcons(); hud(); tick();
setInterval(save, 5000);

// ---------------- Debug hooks (used by automated tests) ----------------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
window.__ps = {
  STAND_UNLOCK, coinUnlock, coinUnlockAsk, nextCoinStand, WORKER, hireWorker, payWorker, migWorkerHour, migWorkerSplit, migWorkerLoc, locLots, workerPass, wkKey, wkAll, workerStatus, migBasesHome, shiftTxt, wkTimerText, musicSkip: () => Sound?.skip(), get sound() { return Sound?.state; }, get audioPrefs() { return S.audio; }, setVolume, toggleMute, soundSetHTML, sfxPlay: (n) => Sound?.play(n), workerPass, catchUpWorkers, syncWorkers, workerStatus, workStands, workersOn, workerAt: (l) => W.workerAt(l), workerPose: (l) => W.workerPose(l), camAt: (x, z, zoom = 0.7) => { W.ctl.moved = true; W.glide({ target: V3(x, 0.3, z), zoom }, 0.01); }, wkPath, wkQueue, wkVis, wkGrid, standXZ, get workers() { return S.workers; },
  setClock: (t) => { clockAt = t; },
  BUILD, adMult, adPicks, standHTML, itemVal, byValue, sortRows, rewardHTML, get fromBuild() { return fromBuild; }, get bags() { return S.bags; }, get migBags() { return migBags; }, inBag, bagOf, sendGoods, tileLoc, standLoc, splitOrchardGoods, buildHTML, marketHTML, satchelHTML, billboardHTML, bbStatusText, bbReadyIn, BILLBOARD, CHARMS, CHARM_IDS, charmV, charmLv, charmText, craftK, shiftH, standPrice, ostandPrice, custGap, harvestCore, setCharmRoll(v) { charmRoll = v; }, freeGFSpot, bulkSell, bulkAll, bulkPrice, bulkItems, bulkHTML, rollWants, STAND_BUY, BULK, GF_IDS, gfOn, gfPlaced, placeGF, storeGF, onMapOnly, charmAt, oGap, TRUCK, orderDelivery, deliverTrip, syncDeliv, inTransit, vanOn, VAN_LOT, rowOfTree, exitPlace, buyCopy, mktDest, MKT_ONE_TIME, MKT_STACK, MKT_CONSUMABLE, MKT_REPEAT, tabPanel, get deliv() { return S.deliv; }, get vanOut() { return vanOut.size; }, migGF065, get mig065() { return mig065; }, regenNow: () => regenS(), SWAP_TIERS, swapPool, get bagTab() { return bagTab; }, setBagTab(t) { bagTab = t; }, shelfMig063, rollIds, rollPackLoot, catTierOdds, drawPlant, drawOther, isPlantCard, PACK_LOOT, OWNED_K, setForcedLoot(L) { forcedLoot = L; }, consLeft, finishCons, hurryCons, startCons, plantTile: plant, syncTile, bloomTargets, instantBloom, askBloom, customerRush, askRush, rushLeft, rushReady, syncJewelDock, get rush() { return S.rush; }, get nextCustAt() { return nextCust; }, get nextOCustAt() { return nextOCust; }, swapCard, swapIn, swapPool, swapTierOdds, SWAP, setSwapForced(id) { swapForced = id; }, get revealCards() { return revealCards; }, upgLeft, finishUpg, hurryUpg, deselect, get upg() { return S.upg; }, toolLeft, get cons() { return S.cons; }, dailyStatus, claimDaily, showDaily, maybeDaily, dayKey, watchAd, playRewardAd, DAILY, upgradeBuilding, get standLv() { return S.standLv; }, cardFix063, normalizeCards,
  TIPS, JEWEL_DROP, obsState, PACKS,
  hud, dailyGift: (n) => dailyGift(n), syncBarrels, lotRoofs, standsLine, buildBarrelAt: (lot, x, z) => buildBarrel(lot, x, z), openMap, closeMap, mapLocked, syncMapBtn, maybeBoost, showBoost, applyBoost, hideBoost, showStarter, grantStarter, buyStarter, starterLive, grantOffer, buyOffer, offerValue, offersSorted, maybeStarter, starterReady, maybeStarter, promoMilestone, showPromo, wish, settingsHTML, jewelsHTML, unlockMapIfReady, travel, buyOrchard, claimFollow, SOCIALS, setLoc, loc: () => curLoc(), orchardLocked, mapPlaces: () => MAP_PLACES.map((p) => ({ id: p.id, name: p.name, soon: !!p.soon, state: placeState(p) })), ORCHARD_PRICE, casterIds: () => casters().map((c) => c.id + (c.h != null ? ":box" : ":tree")), checkGoals, regenBarrels, feedLot, reachLots,  get barrelReachTargets() { return W.bedTargets.children.map((g) => ({ b: g.userData.b, ok: g.userData.ok })); }, barrelRoof, lotRoofs, barrelStands, barrelPerTick, get gutterLots() { return [...W.gutters.keys()]; }, gutterPipes(lot) { return W.gutters.get(lot)?.userData.pipes || 0; },
  get tincGrandfathered() { return tincGrandfathered; }, tincProblem, tincSpots, buildTincture, placeTincture, buildStill, placeStill, distill, collectOil, STILL, TEA, teaInfo, teaId, teaSps, registerTea, buildTea, placeTea, brewTea, collectTea, teaAdd, teaRemove, get teaPick() { return [...teaPick]; }, set teaPick(v) { teaPick = [...v]; }, teaHTML, syncTea, DRY_TIER_S,
  CRAFT, PRESS, FRUITSTAND, TREES, TREE_IDS, SEED_BAGS, bagId, bagSeeds, buildCraft, placeCraft, craftMake, craftCollect, craftHTML, syncCraft, orchardSpots, orchardProblem, plantOrchard, pickTree, syncOrchard, orchStage, orchRipe, waterTree, autoWaterTrees, buyTreeRow, ORCH_ROWS, rowsOwned, rowIrrigated, nextIrrigRow, syncTreeRows, TREE_IRRIG, orchardTreeHTML, startTreePlace, orchardLocked, packW, cardOdds, tierOdds, featureOdds, drawNonBasic, collIds, get sunflowerRefund() { return sunflowerRefund; }, LOTS, ORCHARD_TREE_SPOTS,
  RESALE, sellPlaced, stockAntique, sellRestored, installShelf, uninstallShelf, shelfOn, syncShelf, SHELF_BONUS, STAND_CAP, focusThing, get atmosphere() { return atmosphere(); }, get standCap() { return standCap(); },
  maybeClosing() { closingAfter = 0; maybeClosing(); return !!closingEl; }, closeClosing() { closeClosing(); }, get GOALS() { return GOALS.map((g) => g.id); },
  get state() { return S; }, get selected() { return selected; }, get focus() { return focus; }, get placing() { return placing; }, get panel() { return panel; },
  get customer() { const c = custs[0]; return c && { wants: c.wants, parked: c.car.state === 'park' }; }, get customers() { return custs.map((c) => ({ wants: c.wants, slot: c.slot, parked: c.car.state === 'park', x: c.car.x })); }, get buildMode() { return buildMode; }, W, THREE, TREE_MS,
  giveIrrigation(n = 1) { S.discovered.irrigation = S.unlocked.irrigation = S.owned.irrigation = true; addCard('irrigation', n); save(); if (panel) renderPanel(); }, assignIrrigation, autoIrrigate, get hasIrrig() { return hasIrrig(); }, irrigLv, bedWater, stageNeed, settleBed, thirsty, budWait, rawProg, WATER, BARREL_LV, barrelLv, barrelCap, upgradeBarrel: (lot) => upgradeBarrel(lot), catchUpIrrigation,
  tileSun: (i) => tileSun[i], sunAt: (x, z) => sunAtXZ(x, z, casters()), siteSun: (id) => siteSun(id), tileXZ, refreshShade, SHADE,
  plantAt: (i) => S.tiles[i] && { ...S.tiles[i], k: progress(S.tiles[i]) }, treeInfo: (id) => { const t = treeById(id); return t && { ...t, stage: treeStage(t) }; },
  // simulate the game being closed for `sec` seconds: every timestamp moves back, then the page reloads and catches up
  placeWindmill, get regenS() { return regenS(); }, get windmillSails() { return W.windmill.userData.sails.rotation.z; }, get windmillVis() { return W.windmill.visible; },
  deselect, buildTraffic, runAd, askRunAdJewel, parkCap, trafficMult, extraItemChance, custGap, pickWants, testHold, goalPeek,
  get traffic() { return { parkVis: W.parking.visible, bays: W.parking.children.filter((g) => g.isGroup && g.visible).length, bbVis: W.billboard.visible, bbGlow: W.billboard.userData.face.material.emissiveIntensity > 0.2, passEvery: [14000, 32000].map((v) => Math.round(v / (bbActive() ? BILLBOARD.mult : 1))) }; },
  get bb() { return { ...S.bb, active: bbActive(), readyIn: bbReadyIn(), label: W.billboard.userData.label?.userData?.text } },
  get bbFace() { const d = W.billboard.userData.bb; return { mode: d.mode, panel: d.shown, draws: d.draws, key: d.key, shimmer: W.billboard.userData.shimmer.material.opacity, glow: W.billboard.userData.face.material.emissiveIntensity, bulbs: W.billboard.children.filter((m) => m.geometry?.type === 'SphereGeometry').length, litBulbs: W.billboard.children.filter((m) => m.geometry?.type === 'SphereGeometry' && m.material.emissiveIntensity > 0).length }; },
  bbPixels: (x, y) => [...W.billboard.userData.bb.c.getContext('2d').getImageData(x, y, 1, 1).data], topSeller, syncBillboard,
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
  nextCustomerIn(ms) { nextCust = now() + ms; }, spawnCustomer, spawnArrival, spawnOArrival, get oVisitors() { return ocusts.map((c) => ({ slot: c.slot, x: c.car?.stopX, done: c.done })); }, get opark() { return { built: !!S.oparkingBuilt, spots: oparkCap(), cars: oparkCars(), bays: oBayXs(), vis: W.oparking.visible, bayVis: W.oparking.children.filter((g) => g.isGroup && g.visible).length, bbVis: W.obillboard.visible, bbHome: bbActiveAt('home'), bbOrch: bbActiveAt('orchard') }; }, nextOCustIn(ms) { nextOCust = now() + ms; }, buildTraffic, get park() { return { lv: cardLv('parking'), spots: parkCap(), cars: parkCars(), bays: bayXs(), gapMult: S.parkingBuilt ? PARKING.gapMult[parkI()] : 1 }; }, parkLevelText,
  grant(o) { for (const [k, v] of Object.entries(o)) { if (['coins', 'wood', 'jewels', 'scrap'].includes(k)) S[k] += v; else if (FINDS[k]) S.finds[k] = (S.finds[k] || 0) + v; else S.inv[k] += v; } save(); hud(); if (panel) renderPanel(); },
  tapObstacle, buildBed, siteTiles, irrigBlock, enterBuild, exitBuild, selectTile, plant, water, waterBed, writeSave, syncBarrels, harvest, openPanel, closePanel, buyPack, buy, stock, buyLot,
  buildStand, buildRack, startMarket, finishMarket, restore, recycle, collectLoot, enterPlace, placeAt, dropFor,
  camera(az, pol, zoom, tx, tz) { if (az != null) W.ctl.az = az; if (pol != null) W.ctl.pol = pol; if (zoom != null) W.ctl.zoom = zoom; if (tx != null) { W.ctl.target.set(tx, 0.3, tz); W.ctl.moved = true; } W.ctl.glide = null; W.updateCamera(); },
  Ads, get adsOn() { return Ads.enabled; },
  // v0.4 helpers
  setHeroHold: (ms) => { heroHoldMs = ms; }, grantTincture, get tincCardMigrated() { return tincCardMigrated; }, mig061, ostock, ounstock, lotusProbe: (i) => { const g = W.tilePlant(i); if (!g) return null; const b = g.getObjectByName('lotusBarrel'), w = g.getObjectByName('lotusWater'); return { barrel: !!b, fill: b?.userData.fill, waterY: w ? +w.position.y.toFixed(3) : null, waterVisible: !!w?.visible }; }, ostandCount, buildOStand, syncOShed, spawnOCustomer, get ocusts() { return ocusts; }, itemLoc, sellsAt, standWhere, standOkAt, standLots, tincSpots, orchLotPrice, lotLoc, ORCH_STAND, ORCH_FOR_SALE, ORCH_PLOT_PRICES, nextOCustIn: (ms) => { nextOCust = now() + ms; }, nextOPassIn: (ms) => { nextOPass = now() + ms; }, spawnRoadScrap: () => spawnRoadScrap(), get roadScrap() { return S.roadScrap; }, packIsAllBasic: (ids) => ids.every((id) => cardTier(CARDS[id]) === 'basic'), rollPack: (n) => rollPack(n),
  startBuy, buyCost, cancelPlace: cancelPlacing,
  fillBarrels, truckQuote: () => { const q = truckQuote(); return { need: q.need, can: q.can, lots: q.list.map(([l]) => l) }; }, get truck() { return truck && { state: truck.state, x: truck.x, stopX: truck.stopX }; }, baseOpen, baseNeeds, SUPPLY_CARDS, get basesMigrated() { return basesMigrated; },
  get barrels() { return S.barrels; }, barrelText, totalWater, handSource: (i) => handSource(i)?.lot || null, buildBarrel, unhookIrrigation, BARREL, craftTincture, collectTincture, buildTincture,
  setBarrelCap(n) { BARREL.maxBeds = n; syncBarrels(); }, barrelScreen(lot) { const b = S.barrels[lot]; return W.project(V(b.x, 0.5, b.z)); }, barrelLabel(lot) { const s = W.barrels.get(lot)?.userData.info; return s && { main: s.userData.main, sub: s.userData.sub, visible: s.visible, scale: s.scale.y, opacity: s.material.opacity }; },
  CARDS, FEATURES, zoomCard: (id) => zoomCard(id), cardPool: (r) => Object.keys(CARDS).filter((k) => CARDS[k].rarity === r), cardTier, FEATURE_TIER_FROM_OLD, RARITY, SPECIES, FANTASY_SPECIES, PLANT_TIERS, TIER_ORDER, PACK_W, DRYING, ITEMS, TINCTURE, STILL, drawCard, packOdds: () => ({ total: packTotal(), orchard: !!S.lots.orchard, tiers: Object.fromEntries(TIER_ORDER.map((t) => [t, tierOdds(t)])), features: featureOdds(), plantTiers: Object.fromEntries(TIER_ORDER.map((t) => [t, catTierOdds(true, t)])), otherTiers: Object.fromEntries(TIER_ORDER.map((t) => [t, catTierOdds(false, t)])) }), rollSeeds,
  sickleBed, plowBed, useTool, toolLeft, lotTiles, bedTiles, get bedTargets() { return W.bedTargets.children.map((g) => ({ b: g.userData.b, ok: g.userData.ok })); }, get fxCount() { return W.fxCount(); },
  giveTool(id) { S.discovered[id] = true; S.unlocked[id] = true; S.owned[id] = true; if (isGF(id)) (S.gfBought ||= {})[id] = 1; if (!S.cards[id]) addCard(id); save(); hud(); },
  resetTool(id) { S.toolAt[id] = 0; save(); hud(); },   // kept for old tests: a no-op now (no rest)
  focusBarrel(lot) { focusThing({ kind: 'barrel', lot }); },
  beeBonus, freeSpot, upgradeCard, canUpgrade, cardLv, sellOf, growK, CARD_LEVELS, hiveScreen(lot) { const h = S.hives[lot]; const s = W.project(V(h.x, 0.7, h.z)); return { x: s.x, y: s.y }; }, get beeFx() { return W.scene.children.find((o) => o.isGroup && o.children.some((c) => c.isSprite && c.material.map?.image?.width === 96))?.children.length || 0; },
  loadSave(json) { frozen = true; localStorage.setItem(SAVE_KEY, json); location.reload(); },
  giveCard(id, n = 1) { S.discovered[id] = true; S.unlocked[id] = true; addCard(id, n); if (id === 'irrigation') S.owned.irrigation = true; save(); if (panel) renderPanel(); },
  findSpotIn(lot) { const L = LOTS[lot]; for (let z = L.z1 - 1.4; z > L.z0 + 0.6; z -= 0.3) for (let x = L.x0 + 1.0; x < L.x1 - 1.0; x += 0.3) { if (lotAt(x, z) !== lot || placeProblem(x, z)) continue; const s = W.project(V(x, 0, z)); if (s.x > 30 && s.x < innerWidth - 30 && s.y > 160 && s.y < innerHeight - 260 && W.pick(s.x, s.y)?.kind === 'ground') return { x, z, sx: s.x, sy: s.y }; } return null; },
  clearLot(lot) { for (const o of OBSTACLES) if (o.lot === lot) { S.obs[o.id] = 'x'; W.setObstacle(o.id, 'gone'); } save(); },
  dismissTip() { clearTimeout(tipTimer); tipQueue.length = 0; $('#tip').classList.add('hidden'); },
};
