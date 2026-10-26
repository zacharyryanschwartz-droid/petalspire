// Petalspire v0.52 — game logic + UI (v0.5: the full 21-plant catalog · v0.51: feature cards use the plant tier names · v0.52: supply cards, water truck, Rain Barrel in Build)
import * as THREE from 'three';
import { createWorld } from './world.js';
import { buildPlant } from './plants.js';
import { parkLv, hydroId, HYDROSOL, NON_CARDS, ROAD_SCRAP, TINC_DUP_COINS, SPECIES, FANTASY_SPECIES, PLANT_TIERS, cardTier, FEATURE_TIER_FROM_OLD, TIER_ORDER, PACK_W, DRYING, rollSeeds, FEATURES, CARDS, RARITY, ITEMS, SELL_ORDER, TIPS, RESALE, PACKS, PACK_JEWELS, JEWEL_EXCHANGE, JEWEL_DROP, PARKING, BILLBOARD, WINDMILL, DUP_COINS, SUPPLY_CARDS, SUPPLY_DUP, WATER_TRUCK, CARD_LEVELS, RACK_SLOTS, DRY_S, BARREL, BASES, TINCTURE, STILL, oilId, tinctureId, TINCTURE_NAMES,
  WOOD, BED_COSTS, STAND_CAP, MARKET_GOAL, WATER_REGEN_S, WATER_REGEN_MAX, STARTER, STARTER_FILL, STARTER_JEWELS,
  BUILDS, FINDS, FIND_IDS, FIND_CHANCE, SAPLING_CHANCE, RESTORE_HURRY_JEWELS, ATMOS_STEP, ATMOS_MAX, TREE, SHOP, JEWEL_BUNDLES, NO_ADS_BUNDLE, ADS, ADS_MODE, OTHER_GAMES, SOCIALS, FOLLOW_REWARD, SHADE, TEA, teaInfo, teaId, teaSps, registerTea, DRY_TIER_S, PACK_W_ORCH, TREES, TREE_IDS, PRESS, FRUITSTAND, SEED_BAGS, bagId } from './data.js';
import { ROAD, LOTS, SIGNS, LOT_FOR_SALE, LOT_PRICES, SITES, OBSTACLES, SPOTS, PARK_X, BEHIND, FRONT, BED_N, TILE, SITE_HALF, siteById, obstacleById, inSite, lotCenter, lotAt, ORCHARD_TREE_SPOTS, OWNABLE_LOTS, LOCATIONS, ORCHARD_PRICE, ORCH_X } from './layout.js';
import { ICONS, itemIcon, FEATURE_ART, findIcon, decorIcon } from './icons.js';
import { Payments } from './payments.js';
import { createAds, gameArt } from './ads.js';
import { shadeAt, speedFor, sunLabel, rebaseStart } from './shade.js';

// Save format: v0.3, v0.31 and v0.4 share one localStorage key (schema v: 3). `build` records which prototype build last wrote the save;
// v0.3 / v0.31 saves (no `build`, no per-plot barrels) are migrated on load (migrate04 below); v0.4 saves load as-is and are re-tagged. Prototype builds stay below 1.0.
export const BUILD = '0.6';
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
// v0.6: the two crafting stands share one engine (state keys, recipes, slots)
const CRAFT = {
  press:      { def: PRESS, name: 'Pressed Oil Stand', built: 'pressBuilt', pos: 'pressPos', slots: 'pressSlots', verb: 'Press', doing: 'Pressing', slotName: 'Press', size: [2.3, 3.0, 1.3], blurb: 'Press seeds, nuts and fruit into oils and butters' },
  fruitstand: { def: FRUITSTAND, name: 'Fruit Stand', built: 'fruitstandBuilt', pos: 'fruitstandPos', slots: 'fruitstandSlots', verb: 'Cook', doing: 'Cooking', slotName: 'Jar', size: [2.1, 2.6, 1.3], blurb: 'Cook orchard fruit into jellies, butters, sauces and canned fruit' },
};
const craftRecipe = (c, rid) => CRAFT[c]?.def.recipes.find((r) => r.id === rid);
// v0.6 orchard trees: { sp, at, growMs, cycleMs, next }. Stages 0–3 by growth; ripe when mature and now ≥ next.
const orchStage = (t, at = Date.now()) => { const k = (at - t.at) / t.growMs; return k >= 1 ? 3 : k >= 0.6 ? 2 : k >= 0.25 ? 1 : 0; };
const orchRipe = (t, at = Date.now()) => orchStage(t, at) >= 3 && at >= t.next;

// ---------------- State ----------------
function freshState() {
  return {
    v: 3, build: BUILD, coins: 10, wood: 0, jewels: 0, scrap: 0,
    // v0.5: one slot for every plant item (seeds, flowers, dried, tinctures, oils), generated from the catalog
    inv: { ...Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])), water: 0, sapling: 0, glycerin: 0, vinegar: 0 },
    unlocked: { ...Object.fromEntries(Object.keys(SPECIES).map((k) => [k, false])), lavender: true, calendula: true, rainbarrel: false, beehive: false, sundial: false },
    owned: { beehive: false, sundial: false, tincture: false, still: false, sickle: false, plow: false, parking: false, billboard: false, windmill: false, teastand: false, press: false, fruitstand: false }, toolAt: {},
    cards: {},   // v0.4: card stacks { id: { n: copies, lv } }
    hives: {}, hiveInv: 0,   // v0.4: placeable Honeybee Skeps, one per plot ({ lot: { x, z } }); the boost only reaches beds on that plot
    discovered: {},
    lots: { home: true }, loc: 'home', lotsBought: 0, obs: {}, beds: [], tiles: [],
    rack: Array(RACK_SLOTS).fill(null),
    stand: {}, starterOpened: false, waterAt: 0,
    // v0.3: things are built, not unlocked
    barrel: false, standBuilt: false, rackAvail: false, rackBuilt: false, marketAvail: false, marketBuilt: false, marketProj: null,
    finds: {}, restoring: [], decorInv: {}, bonus: { can: false, barrow: false, crate: false },
    decor: [], ground: [], trees: [], looted: {}, uid: 1, noAds: false, follows: {}, adRewardAt: 0, irrigN: 0, irrigBeds: [], irrigFrom: {},
    // v0.4: one rain barrel per plot ({ lot: { x, z, w, at } }), Tincture Stand
    barrels: {}, barrelInv: 0, tinctureBuilt: false, tinc: Array(TINCTURE.slots).fill(null), tincBase: 'glycerin',
    stillBuilt: false, stills: Array(STILL.slots).fill(null), stillPos: null,
    teaBuilt: false, teas: Array(TEA.slots).fill(null), teaPos: null,
    pressBuilt: false, pressPos: null, pressSlots: Array(PRESS.slots).fill(null), fruitstandBuilt: false, fruitstandPos: null, fruitstandSlots: Array(FRUITSTAND.slots).fill(null), orchard: {},   // v0.6   // v0.52 Tea Stand   // v0.41 Essential Oil Stand
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
// v0.6: a crafting stand standing on an empty Roadside bed patch keeps a bed off it (the Roadside Lot has no other free ground)
const STAND_POS = [['teaBuilt', 'teaPos'], ['pressBuilt', 'pressPos'], ['fruitstandBuilt', 'fruitstandPos']];
const siteStands = (s) => STAND_POS.filter(([, p]) => S[p] && S[p].lot === s.lot && Math.abs(S[p].x - s.x) < TILE * BED_N / 2 + 0.9 && Math.abs(S[p].z - s.z) < TILE * BED_N / 2 + 0.7).map(([, p]) => S[p]);
const siteThings = (id) => { const s = siteById(id); return [...S.decor, ...S.trees].filter((d) => inSite(d, s)).concat(siteStands(s)); };
const siteClear = (id) => SITE_OBS[id].every((o) => obsState(o) === 'gone') && !siteThings(id).length;
const siteLeft = (id) => SITE_OBS[id].filter((o) => obsState(o) !== 'gone').length + siteThings(id).length;
const bedCost = () => BED_COSTS[Math.min(S.beds.length, BED_COSTS.length - 1)];
const standCount = () => Object.values(S.stand).reduce((a, b) => a + b, 0);
// v0.6: the Crate Shelf is an item you install on (and take back off) the Farm Stand: +4 shelf space while installed
const SHELF_BONUS = 4;
const shelfOn = () => !!(S.bonus.crate && S.shelfOn && S.standBuilt);
const standCap = () => STAND_CAP + (shelfOn() ? SHELF_BONUS : 0);
function syncShelf() { W.setStandShelf?.(shelfOn(), standCount() > STAND_CAP); }
function installShelf() {
  if (!S.bonus.crate || S.shelfOn) return false;
  if (!S.standBuilt) { toast('Build the Roadside Farm Stand first, then install the Crate Shelf on it'); return false; }
  S.shelfOn = true; save(); syncShelf(); renderPanel(); hud();
  W.poof?.(V3(SPOTS.stand[0] + 1.98, 0.8, SPOTS.stand[1] + 0.2), '#F5D07A', 16, 1.5);
  toast(`Crate Shelf installed on your Farm Stand · shelf space ${STAND_CAP} → ${standCap()}`); return true;
}
// taking the shelf out puts everything that no longer fits back in the bag (last-listed products first)
function uninstallShelf(quiet) {
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
// v0.52: a barrel also reaches the owned plot directly behind it. S.irrigFrom[site] = the barrel's plot when a bed is fed
// from the barrel in front instead of its own plot's.
const feedLot = (id) => (S.irrigFrom && S.irrigFrom[id]) || lotOfSite(id);
const reachLots = (lot) => [lot, ...(BEHIND[lot] && S.lots[BEHIND[lot]] ? [BEHIND[lot]] : [])];
const barrelBeds = (lot) => S.irrigBeds.filter((id) => feedLot(id) === lot);
const barrelOf = (siteId) => S.barrels[feedLot(siteId)];
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
  const fl = feedLot(bedOfTile(i)) !== lot ? feedLot(bedOfTile(i)) : FRONT[lot]; const fb = fl && S.barrels[fl];   // v0.52: then the barrel in front
  if (fb && fb.w > 0 && reachLots(fl).includes(lot)) return { b: fb, lot: fl };
  const xz = tileXZ(i) || [0, 0]; let best = null, bd = Infinity;
  for (const [l, b] of Object.entries(S.barrels)) if (b.w > 0) { const d = Math.hypot(b.x - xz[0], b.z - xz[1]); if (d < bd) { bd = d; best = { b, lot: l }; } }
  return best;
}
// v0.41: a barrel only collects rain through a gutter from a roof on the SAME plot. Connection is automatic: any roofed
// building on that plot (Farm Stand, Supply Market — even boarded up —, Tincture Stand, Essential Oil Stand). The Home
// barrel uses the Farm Stand once built, and the Market roof before that, so the starter barrel always works.
const ROOF_NAMES = { stand: 'Farm Stand', market: 'Supply Market', tincture: 'Tincture Stand', still: 'Essential Oil Stand', teastand: 'Tea Stand', press: 'Pressed Oil Stand', fruitstand: 'Fruit Stand', orchardshed: 'Orchard Shed' };
function lotRoofs(lot) {
  const out = [];
  if (lot === 'home') { if (S.standBuilt) out.push('stand'); out.push('market'); }
  if (lot === 'orchard' && S.lots.orchard) out.push('orchardshed');   // v0.6: the Orchard's own shed roof
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
const standsLine = (lot) => { const n = barrelStands(lot).filter((r) => r !== 'market' && r !== 'orchardshed').length; return n ? `${n} stand${n > 1 ? 's' : ''} connected • +${barrelPerTick(lot)} per tick` : `${lot === 'orchard' ? 'Orchard Shed' : 'Supply Market'} roof • +1 per tick`; };
const NOT_COLLECTING = 'Not collecting: connect to a stand on this plot';
function regenBarrels() {
  let ch = false; const rs = regenS() * 1000, max = regenMax();
  for (const [lot, b] of Object.entries(S.barrels)) {
    if (!barrelRoof(lot)) { b.at = now(); continue; }   // no gutter, no rain: the countdown is frozen
    if (b.w >= max) { b.at = now(); continue; }
    const n = Math.floor((now() - b.at) / rs);
    if (n > 0) { b.w = Math.min(max, b.w + n * barrelPerTick(lot)); b.at += n * rs; if (b.w >= max) b.at = now(); ch = true; }   // v0.52: +1 per connected stand
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
    const q = thirstyIrrig().filter((i) => feedLot(bedOfTile(i)) === lot); if (!q.length) continue;
    let w = b.w, wAt = w >= max ? t0 : b.at || t0;
    while (q.length && w > 0) { give(q.shift(), t0); w--; }
    const per = barrelPerTick(lot);
    if (q.length && w < max && per) { let next = wAt + rs; while (q.length && next <= end) { let k = 0; for (; k < per && q.length; k++) give(q.shift(), next); w = per - k; wAt = next; next += rs; } }
    b.w = w; b.at = wAt;   // regenBarrels() in tick() adds whatever is left over
  }
}
function assignIrrigation(siteId) {
  if (!S.beds.includes(siteId)) return false;
  if (S.irrigBeds.includes(siteId)) { toast('This bed is already irrigated'); return false; }
  if (irrigFree() <= 0) { toast('Every Irrigation card is in use — buy another in the Supply Market'); return false; }
  // v0.52: its own plot's barrel first; otherwise the barrel of the plot in front (it reaches the plot behind it)
  const own = lotOfSite(siteId), fr = FRONT[own] && S.barrels[FRONT[own]] ? FRONT[own] : null;
  const cands = [S.barrels[own] ? own : null, fr].filter(Boolean);
  if (!cands.length) { toast(`${lotName(own)} has no rain barrel yet — build one there from the Build menu (Rain Barrel, 40 coins)${FRONT[own] ? `, or one on ${lotName(FRONT[own])} (it reaches the plot behind it)` : ''}`); tip('plotbarrel'); return false; }
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
  const B = SHADE.boxes, box = (id, k, x, z) => { const b = B[k]; out.push({ id, x: x + b.dx, z: z + b.dz, hx: b.hx, hz: b.hz, h: b.h, w: b.w }); };
  const add = (k) => SPOTS[k] && box('b:' + k, k, SPOTS[k][0], SPOTS[k][1]);
  add('market'); if (S.standBuilt) add('stand'); if (S.rackBuilt) add('rack'); if (S.tinctureBuilt) add('tincture'); if (S.stillBuilt) add('still'); if (S.teaBuilt) add('teastand'); for (const c of Object.keys(CRAFT)) if (S[CRAFT[c].built]) add(c);
  if (S.windmillBuilt) add('windmill'); if (S.billboardBuilt) add('billboard');
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
const shadeSignature = () => `${S.beds.join(',')}|${S.standBuilt}|${S.rackBuilt}|${S.tinctureBuilt}|${S.stillBuilt}|${S.windmillBuilt}|${S.billboardBuilt}|${S.teaBuilt}|${S.pressBuilt}|${S.fruitstandBuilt}|${Object.entries(S.orchard || {}).map(([k, t]) => t ? k + t.sp + orchStage(t) : '').join(',')}|${['stand', 'tincture', 'still', 'windmill', 'teastand', 'press', 'fruitstand'].map((k) => SPOTS[k] ? SPOTS[k].map((v) => v.toFixed(2)).join(':') : '').join(',')}|${Object.entries(S.hives || {}).map(([l, h]) => h ? l + h.x.toFixed(2) + h.z.toFixed(2) : '').join(',')}|${Object.entries(S.barrels || {}).map(([l, b]) => b ? l + b.x.toFixed(2) + b.z.toFixed(2) : '').join(',')}|${OBSTACLES.filter((o) => o.type === 'tree' && obsState(o.id) === 'full').length}|${S.trees.map((t) => t.id + (t.st === 'full' ? treeStageAt(t, now()) : 's')).join(',')}`;
function refreshShade(force = false) {
  const sig = shadeSignature(); if (!force && sig === shadeSig) return; shadeSig = sig;
  applyShade(); save(); if (selected != null || focus) renderSheet();
}
const irrigLine = (i) => { const bed = bedOfTile(i); if (!S.irrigBeds.includes(bed)) return ''; const p = S.tiles[i], lot = feedLot(bed), b = S.barrels[lot];
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
// v0.52: Tea Stand — teas are generated items, so every tea the save mentions is registered before anything renders
if (!Array.isArray(S.teas) || S.teas.length !== TEA.slots) S.teas = Array(TEA.slots).fill(null);
for (const id of [...Object.keys(S.inv), ...Object.keys(S.stand || {}), ...Object.keys(S.stats?.soldBy || {}), ...S.teas.filter(Boolean).map((t) => t.id)]) if (id.startsWith('tea_')) registerTea(id);
if (S.teaPos) { SPOTS.teastand = [S.teaPos.x, S.teaPos.z]; W.teastand.position.set(S.teaPos.x, 0, S.teaPos.z); }
// v0.6: crafting stands + orchard + the Sunflower rework (old Sunflower flowers / dried bunches become coins at their old prices)
for (const c of Object.keys(CRAFT)) { const C = CRAFT[c]; if (!Array.isArray(S[C.slots]) || S[C.slots].length !== C.def.slots) S[C.slots] = Array(C.def.slots).fill(null);
  S[C.slots] = S[C.slots].map((t) => (t && craftRecipe(c, t.rid) ? t : null));
  if (S[C.pos]) { SPOTS[c] = [S[C.pos].x, S[C.pos].z]; W[c].position.set(S[C.pos].x, 0, S[C.pos].z); } }
if (!S.orchard || typeof S.orchard !== 'object') S.orchard = {};
for (const k of Object.keys(S.orchard)) if (!S.orchard[k] || !TREES[S.orchard[k].sp] || !ORCHARD_TREE_SPOTS[k]) delete S.orchard[k];
let sunflowerRefund = 0;
{ const OLD = { flower_sunflower: 54, dried_sunflower: 132 };
  for (const [id, v] of Object.entries(OLD)) for (const box of [S.inv, S.stand || {}]) { const n = box[id] || 0; if (n > 0) sunflowerRefund += n * v; delete box[id]; }
  if (Array.isArray(S.rack)) S.rack = S.rack.map((r) => { if (r?.sp === 'sunflower') { sunflowerRefund += OLD.dried_sunflower; return null; } return r; });
  if (sunflowerRefund) { S.coins += sunflowerRefund; S.stats.sunflowerRefund = (S.stats.sunflowerRefund || 0) + sunflowerRefund; writeSave(); } }
// v0.6: shelves used to switch on the moment they were restored. Keep it installed where it already worked (a built stand);
// a shelf that was stuck in the bag (no stand yet) becomes an installable item.
if (S.shelfOn === undefined) { S.shelfOn = !!(S.bonus.crate && S.standBuilt); }
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
if (S.teaBuilt && S.teaPos) W.appear(W.teastand, false);
for (const c of Object.keys(CRAFT)) if (S[CRAFT[c].built] && S[CRAFT[c].pos]) W.appear(W[c], false);
for (const k of Object.keys(S.orchard)) W.addOrchardTree(+k, S.orchard[k].sp);
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
  for (const [lot, b] of Object.entries(S.barrels)) { const roof = barrelRoof(lot); W.setGutter(lot, barrelStands(lot).map((r) => SPOTS[r]));
    if (roof) W.setBarrelInfo(lot, barrelText(lot, false), `${barrelPerTick(lot) > 1 ? '2 stands · +2 per tick · ' : ''}${S.windmillBuilt ? 'Windmill: faster refill · ' : ''}Feeds ${barrelBeds(lot).length}/${BARREL.maxBeds} beds`, b.w >= regenMax(), b.w / regenMax());
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
  if (!(S.goal <= GOALS.length)) S.goal = GOALS.length;   // v0.52 migration: old goals 13–15 were removed
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
  else if (g.kind === 'sapling') { S.inv.sapling++; popAt(V3(g.x, 1.2, g.z), `<i data-icon="sapling"></i>Tree sapling!`); tip('sapling'); }
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
  const bi = buyIntent;   // v0.52: buying straight into placement — nothing is owned (or charged) until the spot is confirmed
  if (what === 'sapling' && !(S.inv.sapling > 0) && !bi) { toast('You have no saplings — buy one at the Supply Market (or find them while clearing)'); return; }
  if (what === 'decor' && !(S.decorInv[type] > 0)) return;
  if (what === 'irrigation') { if (irrigFree() <= 0 && !bi) { toast('No spare Irrigation card'); return; } closePanel(); deselect(); if (buildMode) exitBuild(); placing = { what };
    $('#buildbar-text').innerHTML = `<b>Irrigation</b> · tap a raised bed to run a drip line to it${bi ? '' : ` (${irrigFree()} card${irrigFree() > 1 ? 's' : ''} free)`}`; $('#buildbar').classList.remove('hidden'); return; }
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
  if (p.what === 'sapling') { if (plantSapling(x, z) === false) return false; if (S.goal >= 0) tip('decor'); return true; }
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
  if (f.into.bonus === 'crate') uninstallShelf(true);
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
    gone = () => { for (const id of beds) { const k = S.irrigBeds.indexOf(id); if (k >= 0) { S.irrigBeds.splice(k, 1); W.setIrrigation(id, false); } if (S.irrigFrom) delete S.irrigFrom[id]; } delete S.barrels[f.lot]; W.removeBarrel(f.lot); }; }
  else return false;
  confirmBox(`<h3>Sell ${name}?</h3><p class="muted">Instant buyback: <b>${v} coins</b>. It leaves your garden.${note}</p>`, `Sell for ${v}`, () => {
    gone(); S.coins += v; S.stats.sold = (S.stats.sold || 0) + 1; deselect(); save(); hud(); if (panel) renderPanel(); syncBlueprints?.(); toast(`Sold ${name} · +${v} coins`); });
  return true;
}
function finishRestore(r) {
  S.restoring = S.restoring.filter((x) => x !== r); const f = FINDS[r.kind]; S.stats.restored++;
  if (f.into.bonus === 'crate') { S.bonus.crate = true; S.shelfOn = false; toast(`<i data-icon="sparkle"></i> Restored: <b>${f.into.name}</b> · install it on your Farm Stand from Bag → Finds (+${SHELF_BONUS} shelf space)`); }
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
  const cs = casters(); const list = SITES.filter((s) => S.lots[s.lot] && !S.beds.includes(s.id)).map((s) => ({ id: s.id, ok: siteClear(s.id), sun: siteSun(s.id, cs) }));
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
function glideTo(k) { W.ctl.moved = true; glideW({ target: V3(SPOTS[k][0] > 150 ? SPOTS[k][0] : SPOTS[k][0] * 0.85, 0.3, SPOTS[k][1] - 0.8), zoom: Math.min(W.ctl.zoom, 1.0) }, 0.8); }
function buildStand() {
  const B = BUILDS.stand;
  if (S.standBuilt || building.stand || !S.beds.length || S.wood < B.wood) return false;
  S.wood -= B.wood;
  let crate = false; if (useOpt.stand && S.finds.old_crate > 0 && !S.bonus.crate) { S.finds.old_crate--; if (!S.finds.old_crate) delete S.finds.old_crate; S.bonus.crate = true; S.shelfOn = true; crate = true; }
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
    const spare = S.beds.some((id) => reachLots(focus.lot).includes(lotOfSite(id)) && !S.irrigBeds.includes(id)), behind = reachLots(focus.lot)[1];
    head = `<h3>Rain Barrel <small>${lotName(focus.lot)} · <span data-feeds>Feeds ${beds.length}/${BARREL.maxBeds} beds</span></small></h3>`;
    body = `<p class="barrel-line${b.w >= max ? ' full' : ''}"><i data-icon="water"></i> <b id="barrel-txt">${barrelText(focus.lot)}</b></p>
      ${barrelRoof(focus.lot) ? `<p class="stands-line${barrelPerTick(focus.lot) > 1 ? ' two' : ''}" data-stands="${barrelPerTick(focus.lot)}"><i data-icon="water"></i> <b>${standsLine(focus.lot)}</b></p>` : ''}
      <p class="muted gutter-line">${barrelRoof(focus.lot) ? `Gutter${barrelStands(focus.lot).length > 1 ? 's' : ''} from the ${barrelStands(focus.lot).map((r) => `<b>${ROOF_NAMES[r]}</b>`).join(' and ')} roof${barrelStands(focus.lot).length > 1 ? 's' : ''}${barrelStands(focus.lot).length < BARREL_STANDS_MAX && focus.lot !== 'home' ? ` · build a second stand on ${lotName(focus.lot)} and it connects automatically (+1 per tick)` : ''}` : `<b class="warn">${NOT_COLLECTING}.</b> Build a Tincture or Essential Oil Stand on ${lotName(focus.lot)} — its roof gutter connects automatically.`}</p>
      ${S.windmillBuilt && barrelRoof(focus.lot) ? `<p class="wm-line"><b>Windmill: faster refill</b> <small>(every ${regenS()} s instead of ${S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S} s)</small></p>` : ''}<p class="muted">Refills ${barrelPerTick(focus.lot) || 1} water every ${regenS() >= 60 ? 'minute' : regenS() + ' s'} (up to ${max}), even while the game is closed. Reaches ${behind ? `this plot and <b>${lotName(behind)}</b> behind it (green frames)` : BEHIND[focus.lot] ? `this plot, and ${lotName(BEHIND[focus.lot])} behind it once you buy it` : 'this plot'}; hand watering there uses it too.</p>`
      + (beds.length ? `<div class="list barrel-beds">${beds.map((id) => `<div class="row"><div class="ico">${FEATURE_ART.irrigation}</div><div class="meta"><b>Bed ${S.beds.indexOf(id) + 1}</b><small>${lotOfSite(id) !== focus.lot ? `${lotName(lotOfSite(id))} (behind) · ` : ''}Irrigated from this barrel</small></div><div class="acts"><button class="btn sm" data-unhook="${id}">Unhook</button></div></div>`).join('')}</div>` : `<p class="muted">No irrigated beds yet${S.irrigN ? '' : ' · Irrigation cards come from Card Packs and the Supply Market'}.</p>`)
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
const spOfItem = (id) => Object.keys(SPECIES).find((sp) => id.endsWith('_' + sp)) || (id.startsWith('fruit_') && TREES[id.slice(6)] ? id.slice(6) : undefined);   // v0.6: fruit gets its tree card's level bonus
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
  // v0.6: Sunflower gives no flower — a fixed 100 seeds (+10 per bee / Lv bonus that would have been a flower)
  const f = sp.noFlower ? 0 : randInt(...sp.yieldF) + beeBonus(i) + lvFlower(p.sp), s = sp.seedsFixed ? sp.seedsFixed + 10 * (beeBonus(i) + lvFlower(p.sp)) : rollSeeds(sp.tier);
  if (f) S.inv['flower_' + p.sp] = (S.inv['flower_' + p.sp] || 0) + f; S.inv['seed_' + p.sp] = (S.inv['seed_' + p.sp] || 0) + s; S.tiles[i] = null; S.stats.harvests++;
  if (p.sp === 'lavender' && !S.rackAvail) { S.rackAvail = true; setTimeout(() => { syncBlueprints(); hud(); tip('lavender'); }, 900); }
  return { sp: p.sp, f, s };
}
function harvest(i) {
  const p = S.tiles[i]; if (!p || stageOf(p) < 3) return;
  const sp = SPECIES[p.sp]; const { f, s } = harvestCore(i);
  syncTile(i); save(); hud();
  const at = W.tileWorld(i);
  if (f) { popAt(at.clone().setY(1.2), `+${f} ${sp.name}`); setTimeout(() => popAt(at.clone().setY(0.8), `+${s} seed${s > 1 ? 's' : ''}`), 350); }
  else popAt(at.clone().setY(1.2), `${itemSvg('seed_' + p.sp)}+${s} ${sp.name} seeds`);
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
  setTimeout(() => { for (const i of ripe) { const at = W.tileWorld(i); syncTile(i); itemFly(at.clone().setY(1), itemSvg(ITEMS['flower_' + spOf[i]] ? 'flower_' + spOf[i] : 'seed_' + spOf[i]), Math.random() * 160); } }, 380);
  const c = bedCenter(b);
  setTimeout(() => popAt(V3(c.x, 1.6, c.z), Object.entries(got).filter(([, f]) => f).map(([sp, f]) => `+${f} ${SPECIES[sp].name}`).join(' · ') + ` · +${seeds} seeds`), 500);
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
  panel = name; if (name === 'market' && tab) marketTab = tab; if (name === 'bag' && tab) bagTab = tab; if (name === 'lot' || name === 'orchardtree') panelArg = tab;
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
  if (!lot || !S.lots[lot] || S.barrels[lot]) return false;
  // v0.52: a barrel left over from an older save (barrelInv) is placed free; otherwise it is paid for now (Build menu, 40 coins)
  if (S.barrelInv > 0) S.barrelInv--; else if (S.unlocked.rainbarrel && S.coins >= BARREL.price) S.coins -= BARREL.price; else { toast(`A Rain Barrel costs ${BARREL.price} coins`); return false; }
  S.barrels[lot] = { x, z, w: 0, at: now() };
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
// v0.52: a base is for sale once its card is found AND the Tincture Stand is open (built), or the save was grandfathered.
const standOpenForBases = () => !!(S.tinctureBuilt || S.basesGrandfathered);
const baseOpen = (b) => !!S.unlocked[b] && standOpenForBases();
const baseNeeds = (b) => [!S.unlocked[b] && `Find the ${BASES[b].name} card`, !standOpenForBases() && 'Unlocks with Tincture Stand'].filter(Boolean);
const tincBase = () => { const b = S.tincBase === 'vinegar' ? 'vinegar' : 'glycerin', o = b === 'glycerin' ? 'vinegar' : 'glycerin'; return S.inv[b] > 0 || !(S.inv[o] > 0) ? b : o; };
const tincCost = () => BUILDS.tincture.wood;   // v0.52: 0 — the stand is a free goal reward
const tincLots = () => OWNABLE_LOTS.filter((l) => S.lots[l]);
// Can the Tincture Stand go here? Whole footprint must be on cleared ground of one bought neighbouring plot.
const BED_HALF = TILE * BED_N / 2;   // v0.41: stands may not cover a bed patch
function tincProblem(x, z, what) {
  const lot = lotAt(x, z); if (!lot || !S.lots[lot]) return 'Build it on a plot you own';
  if (lot === 'home' && !ANY_PLOT.has(what)) return 'Build it on one of your other plots — not the Roadside Lot';
  if (lot === 'orchard' && ORCHARD_TREE_SPOTS.some((p) => Math.abs(p.x - x) < 1.6 && Math.abs(p.z - z) < 1.3)) return 'That’s a fruit-tree spot — keep it free for a tree';   // v0.6
  for (const [dx, dz] of [[0, 0], [0.8, 0.5], [-0.8, 0.5], [0.8, -0.5], [-0.8, -0.5]]) { if (lotAt(x + dx, z + dz) !== lot) return 'Too close to the edge of the plot'; const w = placeProblem(x + dx, z + dz); if (w) return w;
    for (const st of SITES) if (st.lot === lot && Math.abs(st.x - x - dx) < BED_HALF + 0.1 && Math.abs(st.z - z - dz) < BED_HALF + 0.1 && !(lot === 'home' && ANY_PLOT.has(what) && !S.beds.includes(st.id))) return 'That’s a bed patch — keep it free for a raised bed'; }
  return null;
}
const ANY_PLOT = new Set(['teastand', 'press', 'fruitstand']);   // v0.52/v0.6: these stands may go on any owned plot, the Roadside Lot too
const standLots = (what) => (ANY_PLOT.has(what) ? ['home', ...tincLots()] : tincLots());
function tincSpots(what) {
  const out = [];
  for (const lot of ['home', ...tincLots()]) { const L = LOTS[lot], fine = lot === 'home' && ANY_PLOT.has(what), st = fine ? 0.5 : lot === 'home' ? 2.2 : 1.5;
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
  irrigation: { what: 'irrigation', coins: () => FEATURES.irrigation.price, apply: () => { S.irrigN++; }, undo: () => { S.irrigN--; } },
  windmill:   { what: 'windmill', coins: () => FEATURES.windmill.price, wood: () => BUILDS.windmill.wood, scrap: () => BUILDS.windmill.scrap, apply: () => { S.owned.windmill = true; }, undo: () => { S.owned.windmill = false; } },
  still:      { what: 'still', coins: () => FEATURES.still.price, wood: () => BUILDS.still.wood, apply: () => { S.owned.still = true; }, undo: () => { S.owned.still = false; } },
  teastand:   { what: 'teastand', coins: () => FEATURES.teastand.price, wood: () => BUILDS.teastand.wood, apply: () => { S.owned.teastand = true; }, undo: () => { S.owned.teastand = false; } },
  press:      { what: 'press', coins: () => FEATURES.press.price, wood: () => BUILDS.press.wood, apply: () => { S.owned.press = true; }, undo: () => { S.owned.press = false; } },
  fruitstand: { what: 'fruitstand', coins: () => FEATURES.fruitstand.price, wood: () => BUILDS.fruitstand.wood, apply: () => { S.owned.fruitstand = true; }, undo: () => { S.owned.fruitstand = false; } },
  parking:    { what: 'parking', coins: () => FEATURES.parking.price, wood: () => BUILDS.parking.wood, apply: () => { S.owned.parking = true; }, undo: () => { S.owned.parking = false; } },
  billboard:  { what: 'billboard', coins: () => FEATURES.billboard.price, wood: () => BUILDS.billboard.wood, apply: () => { S.owned.billboard = true; }, undo: () => { S.owned.billboard = false; } },
};
const buyCost = (id) => { const B = PLACE_BUY[id]; return { coins: B.coins(), wood: B.wood?.() || 0, scrap: B.scrap?.() || 0 }; };
const missingText = (c) => [S.coins < c.coins && `${c.coins - S.coins} more coins`, S.wood < c.wood && `${c.wood - S.wood} more Wood`, S.scrap < c.scrap && `${c.scrap - S.scrap} more Scrap Metal`].filter(Boolean).join(' and ');
for (const t of TREE_IDS) PLACE_BUY['tree_' + t] = { what: 'orchardtree', tree: t, coins: () => TREES[t].saplingPrice, apply: () => {}, undo: () => {} };
function commitBuy(p) {
  const b = p?.buy; if (!b) return true;
  const c = buyCost(b.id); if (!canPay(c)) { toast(`You need ${missingText(c)}`); return false; }
  S.coins -= c.coins; b.paid = c.coins; PLACE_BUY[b.id].apply(); S.stats.placeBuys = (S.stats.placeBuys || 0) + 1; return true;
}
function rollbackBuy(p) { const b = p?.buy; if (!b?.paid) return; S.coins += b.paid; b.paid = 0; PLACE_BUY[b.id].undo(); S.stats.placeBuys--; save(); hud(); }
function startBuy(id) {
  const B = PLACE_BUY[id]; if (!B || (FEATURES[id] && !S.unlocked[id])) return false;
  if (FEATURES[id] && S.owned[id] && !['beehive', 'irrigation'].includes(id)) return false;
  const c = buyCost(id); if (!canPay(c)) { toast(`${FEATURES[id]?.name || 'A tree sapling'} costs ${[coin(c.coins), c.wood && woodTag(c.wood), c.scrap && scrapTag(c.scrap)].filter(Boolean).join(' + ')} — you need ${missingText(c)}`); return false; }
  if (id === 'parking' || id === 'billboard') {   // fixed roadside spots: buying is building, paid in one go
    if (id === 'parking' && !S.standBuilt) { toast('Build the Farm Stand first — the Parking Lot goes beside it'); return false; }
    const p = { buy: { id } }; commitBuy(p); const ok = buildTraffic(id); if (!ok) rollbackBuy(p); return ok;
  }
  if ((id === 'tincture' || id === 'still') && !tincLots().length) { toast(`Buy a neighbouring plot first — the ${FEATURES[id].name} is built on one of your other plots`); return false; }
  if (id === 'beehive' && !hiveLots().length) { toast('Every plot you own already has a beehive (one per plot)'); return false; }
  if (B.tree && !S.lots.orchard) { toast('Buy The Orchard on the Map first — fruit trees grow only there'); return false; }
  buyIntent = { id };
  try { if (id === 'tincture' || id === 'still' || id === 'teastand' || CRAFT[id]) startStandPlace(id, FEATURES[id].name, c.wood); else if (B.tree) startTreePlace(B.tree); else enterPlace(B.what); } finally { buyIntent = null; }
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
  $('#buildbar-text').innerHTML = ok.length ? `<b>${title}</b> · tap a <b>green spot</b> on ${ANY_PLOT.has(what) ? 'any plot you own' : lots.map(lotName).join(' or ')}${buyIntent ? '' : ' · ' + woodTag(c)}` : `<b>${title}</b> · no clear spot yet — clear trees on ${lots.map(lotName).join(' or ')} first`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  const L = LOTS[(ANY_PLOT.has(what) ? ((ok.find((p) => (p.lot === 'orchard') === (curLoc() === 'orchard')) || ok[0])?.lot || 'home') : (lots.includes(curLoc()) ? curLoc() : lots[0]))]; W.ctl.moved = true; glideW({ target: V3((L.x0 + L.x1) / 2, 0.3, (L.z0 + L.z1) / 2), zoom: Math.max(W.ctl.zoom, 1.0) }, 0.8);
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
  const r = STILL.recipes[sp], k = S.stills.findIndex((t) => !t), seed = r?.in || 'seed_' + sp;   // v0.6: tree recipes (eucalyptus leaves) use r.in
  if (!S.stillBuilt || building.still || !r || k < 0 || !(S.inv[seed] >= r.n)) return false;
  S.inv[seed] -= r.n; S.stills[k] = { sp, start: now(), ms: r.s * 1000 };
  syncStill(); save(); hud(); renderPanel(); toast(`Distilling ${ITEMS[oilId(sp)].name} + ${ITEMS[hydroId(sp)].name} · ${fmtTime(r.s * 1000)}`); return true;
}
function collectOil(k) {
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
  S.wood -= c; S.teaBuilt = true; building.teastand = true; save(); closePanel(); syncBlueprints(); glideTo('teastand');
  setTimeout(() => W.buildAnim(W.teastand, [2.1, 2.6, 1.3], () => {
    building.teastand = false; popAt(spotV('teastand', 2.6), 'Tea Stand built!'); tip('teastand'); hud(); checkGoals(); refreshShade(true);
  }), 500);
  hud(); return true;
}
let teaPick = [];   // species ids picked in the blend builder (max TEA.n, duplicates allowed)
const driedHave = (sp) => (S.inv['dried_' + sp] || 0) - teaPick.filter((p) => p === sp).length;
function teaAdd(sp) { if (teaPick.length >= TEA.n || !DRYING[sp] || driedHave(sp) <= 0) return false; teaPick.push(sp); return true; }
function teaRemove(k) { if (k < 0 || k >= teaPick.length) return false; teaPick.splice(k, 1); return true; }
function brewTea(sps = teaPick) {
  const k = S.teas.findIndex((t) => !t);
  if (!S.teaBuilt || building.teastand || k < 0 || sps.length !== TEA.n) return false;
  const need = {}; for (const sp of sps) need[sp] = (need[sp] || 0) + 1;
  for (const [sp, n] of Object.entries(need)) if ((S.inv['dried_' + sp] || 0) < n) return false;
  for (const [sp, n] of Object.entries(need)) S.inv['dried_' + sp] -= n;
  const t = teaInfo(sps); registerTea(t.id);
  S.teas[k] = { id: t.id, sps: [...sps], start: now(), ms: t.s * 1000, color: t.color };
  teaPick = []; save(); syncTea(); hud(); if (panel === 'teastand') renderPanel();
  popAt(spotV('teastand', 2.2), `Brewing ${t.name}…`); return true;
}
function collectTea(k) {
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
  S.wood -= w; S[C.built] = true; building[c] = true; save(); closePanel(); syncBlueprints(); glideTo(c);
  setTimeout(() => W.buildAnim(W[c], C.size, () => {
    building[c] = false; popAt(spotV(c, 2.6), `${C.name} built!`); tip(c); hud(); checkGoals(); refreshShade(true); syncCraft(c);
  }), 650);
  hud(); return true;
}
const recipeKnown = (r) => SPECIES[r.src]?.tier === 'basic' || TREES[r.src]?.tier === 'basic' && S.lots.orchard || S.unlocked[r.src] || (S.inv[r.in] || 0) > 0;
function craftMake(c, rid) {
  const C = CRAFT[c], slots = S[C.slots], k = slots.findIndex((t) => !t), r = craftRecipe(c, rid);
  if (!S[C.built] || building[c] || k < 0 || !r || (S.inv[r.in] || 0) < r.n) return false;
  S.inv[r.in] -= r.n; slots[k] = { rid, item: r.item, start: now(), ms: r.s * 1000 };
  save(); syncCraft(c); hud(); if (panel === c) renderPanel();
  popAt(spotV(c, 2.4), `${C.doing} ${r.name}…`); return true;
}
function craftCollect(c, k) {
  const C = CRAFT[c], t = S[C.slots][k]; if (!t || now() < t.start + t.ms) return false;
  S.inv[t.item] = (S.inv[t.item] || 0) + 1; S[C.slots][k] = null; S.stats.crafts = (S.stats.crafts || 0) + 1;
  popAt(spotV(c, 2.4), `${itemSvg(t.item)}+1 ${ITEMS[t.item].name}`);
  save(); syncCraft(c); hud(); if (panel === c) renderPanel(); return true;
}
function syncCraft(c) { if (!W.setCraft) return; W.setCraft(c, S[CRAFT[c].slots].map((t) => { if (!t) return null; const r = craftRecipe(c, t.rid); return { done: now() >= t.start + t.ms, color: r.color, glow: ITEMS[t.item].glow }; })); }
function craftHTML(c) {
  const C = CRAFT[c], slots = S[C.slots], free = slots.some((t) => !t);
  const sl = slots.map((t, k) => { if (!t) return `<div class="tslot empty">Empty ${C.slotName.toLowerCase()}</div>`; const left = t.start + t.ms - now();
    return left <= 0 ? `<button class="tslot done" data-makecollect="${c}:${k}">${itemSvg(t.item)}<span><b>${ITEMS[t.item].name}</b><small>Ready! Tap to collect</small></span></button>`
      : `<div class="tslot">${itemSvg(t.item)}<span><b>${ITEMS[t.item].name}</b><small>${C.doing} · <em data-cleft="${c}:${k}">${fmtTime(left)}</em></small></span></div>`; }).join('');
  const rows = C.def.recipes.map((r) => { const srcN = (SPECIES[r.src] || TREES[r.src]), T = PLANT_TIERS[srcN.tier], inN = ITEMS[r.in].name, have = S.inv[r.in] || 0;
    if (!recipeKnown(r)) return `<div class="row locked craft-recipe" data-recipe="${r.id}"><div class="ico">${itemSvg(r.item)}</div><div class="meta"><b>${r.name}</b><small><em class="tier-tag t-${srcN.tier}">${T.label}</em> · find the ${srcN.name} card${TREES[r.src] ? ' (Orchard)' : ''} to unlock</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`;
    const ok = free && have >= r.n, sell = sellOf(r.item);
    return `<div class="row craft-recipe" data-recipe="${r.id}"><div class="ico">${itemSvg(r.item)}</div><div class="meta"><b>${r.name}${ITEMS[r.item].glow ? ' ✨' : ''}</b><small class="yields">Sells for <b>${coin(sell)}</b> <span class="oil-vs">vs ${coin(r.raw)} for the ${inN.toLowerCase()} · ×${(sell / r.raw).toFixed(2)}</span></small><small>${r.n} ${inN} · ${fmtTime(r.s * 1000)} · you have ${have}</small></div><div class="acts"><button class="btn btn-gold sm" data-make="${c}:${r.id}" ${ok ? '' : 'disabled'}>${C.verb}</button></div></div>`; }).join('');
  return `<div class="hero tea-hero craft-hero">${FEATURE_ART[c]}<p>${C.blurb} — they sell at your Farm Stand for well above the raw ingredients.</p></div>
    <div class="sec-title">${C.slotName === 'Jar' ? 'Jam pots' : 'Presses'} · ${slots.filter(Boolean).length}/${slots.length}</div><div class="tslots">${sl}</div>
    <div class="sec-title">Recipes</div><div class="list">${rows}</div>
    <p class="muted" style="margin:10px 4px 0">${c === 'press' ? 'Oil = input value × (1.7 + 0.25 per tier above Basic); butters ×1.06 more. Sunflower bulk oils and Sunpetal Oil are hand-set.' : 'Price = fruit value × (1.6 + 0.25 per tier above Basic); jellies ×1.08, butters & preserves ×1.12. Cook time 40 s + 20 s per tier.'}</p>`;
}
// ---------- v0.6: the Orchard — fruit trees from cards, planted on fixed spots, fruit again and again ----------
const treeLvK = (sp) => 1 - CARD_LEVELS.plant.grow * (cardLv(sp) - 1);
const orchardSpots = () => ORCHARD_TREE_SPOTS.map((p) => ({ x: p.x, z: p.z, k: p.k, lot: 'orchard', ok: !orchardProblem(p.k) }));
function orchardProblem(k) {
  const p = ORCHARD_TREE_SPOTS[k]; if (!p) return 'Pick a tree spot in the Orchard';
  if (!S.lots.orchard) return 'Buy the Orchard first';
  if (S.orchard[k]) return 'A tree already grows there';
  const o = OBSTACLES.find((q) => q.lot === 'orchard' && obsState(q.id) !== 'gone' && Math.hypot(q.x - p.x, q.z - p.z) < 1.0);
  if (o) return `Clear the ${o.type === 'tree' ? 'old tree' : o.type} there first`;
  return null;
}
function startTreePlace(sp) {
  closePanel(); deselect(); if (buildMode) exitBuild(); if (placing) exitPlace();
  const spots = orchardSpots(), ok = spots.filter((q) => q.ok);
  placing = { what: 'orchardtree', sp, spots }; W.setSpotGhosts(spots);
  $('#buildbar-text').innerHTML = ok.length ? `<b>${TREES[sp].name} sapling</b> · tap a <b>green spot</b> in the Orchard` : `<b>${TREES[sp].name} sapling</b> · no free spot — clear the old trees in the Orchard`;
  fillIcons($('#buildbar')); $('#buildbar').classList.remove('hidden');
  W.ctl.moved = true; glideW({ target: V3(ORCH_X, 0.3, -4.2), zoom: Math.max(W.ctl.zoom, 1.0) }, 0.8);
  return true;
}
function plantOrchard(k, sp, at = now()) {
  const d = TREES[sp], lk = treeLvK(sp), growMs = d.growS * 1000 * lk;
  S.orchard[k] = { sp, at, growMs, cycleMs: d.cycleS * 1000 * lk, next: at + growMs };
  S.stats.treesPlanted = (S.stats.treesPlanted || 0) + 1;
  W.addOrchardTree(k, sp); syncOrchard(); save(); hud(); refreshShade(true);
  const p = ORCHARD_TREE_SPOTS[k]; W.poof(V3(p.x, 0.4, p.z), '#9CC49A', 14, 1.4); popAt(V3(p.x, 1.4, p.z), `${d.name} planted`);
  return true;
}
function pickTree(k) {
  const t = S.orchard[k]; if (!t || !orchRipe(t)) return false;
  const d = TREES[t.sp], n = d.yield + lvFlower(t.sp);
  S.inv[d.fruit] = (S.inv[d.fruit] || 0) + n; t.next = now() + t.cycleMs; S.stats.fruitPicks = (S.stats.fruitPicks || 0) + 1;
  const p = ORCHARD_TREE_SPOTS[k]; popAt(V3(p.x, 2.4, p.z), `${itemSvg(d.fruit)}+${n} ${d.fruitName}`);
  save(); syncOrchard(); hud(); if (panel === 'orchardtree') renderPanel(); return true;
}
let orchSig = '';
function syncOrchard() {
  const sig = Object.entries(S.orchard).map(([k, t]) => k + t.sp + orchStage(t) + (orchRipe(t) ? 'r' : '')).join(',');
  if (sig === orchSig) return; const stageChanged = orchSig.replace(/r/g, '') !== sig.replace(/r/g, ''); orchSig = sig;
  for (const [k, t] of Object.entries(S.orchard)) { if (!W.orchardTrees.has(+k)) W.addOrchardTree(+k, t.sp); W.setOrchardTree(+k, orchStage(t), orchRipe(t)); }
  if (stageChanged && worldReady) refreshShade(true);
}
const treeUses = (sp) => { const d = TREES[sp], T = PLANT_TIERS[d.tier], u = [];
  if (FRUITSTAND.recipes.some((r) => r.src === sp)) u.push('Fruit Stand'); if (PRESS.recipes.some((r) => r.src === sp)) u.push('Pressed Oil Stand'); if (STILL.recipes[sp]) u.push('Essential Oil Stand');
  return `<br/><b>${T.label}</b> · Orchard tree · sapling ${d.saplingPrice} coins · fruits after ${fmtTime(d.growS * 1000)}, then every ${fmtTime(d.cycleS * 1000)} · ${d.yield} ${d.fruitName.toLowerCase()} a picking (${d.fruitSell} each)${u.length ? ` · uses: ${u.join(', ')}` : ''}`; };
function orchardTreeHTML(k) {
  const t = S.orchard[k]; if (!t) return '<p class="muted">Nothing grows here.</p>';
  const d = TREES[t.sp], st = orchStage(t), ripe = orchRipe(t), lv = cardLv(t.sp), n = d.yield + lvFlower(t.sp);
  const grow = st < 3 ? `Growing · <b data-oleft="${k}">${fmtTime(t.at + t.growMs - now())}</b> to its first fruit` : ripe ? `<b>Ripe!</b> ${n} ${d.fruitName.toLowerCase()} ready to pick` : `Fruiting again in <b data-oleft="${k}">${fmtTime(t.next - now())}</b>`;
  return `<div class="hero tea-hero tree-hero">${FEATURE_ART[t.sp]}<p>${d.blurb}</p></div>
    <p class="tree-line" data-tree-stage="${st}">${['Sapling', 'Young tree', 'Nearly grown', 'Mature'][st]} · ${grow}</p>
    <p class="muted" style="margin:6px 4px">Fruits every ${fmtTime(t.cycleMs)} without replanting · ${d.fruitName} sell for ${sellOf(d.fruit)} each${lv > 1 ? ` (Lv${lv})` : ''}.</p>
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
    return `<div class="row still-recipe" data-recipe="${sp}"><div class="ico two-ico">${itemSvg(id)}${itemSvg(hy)}</div><div class="meta"><b>${ITEMS[id].name}</b><small class="yields">Makes <b>1 ${ITEMS[id].name}</b> (${sellOf(id)}) <b>+ 1 ${ITEMS[hy].name}</b> (${sellOf(hy)})</small><small>${r.in ? `${r.n} ${ITEMS[inId].name}` : `${r.n} ${sd.name} seeds`} · ${fmtTime(r.s * 1000)} <span class="oil-vs">${r.in ? `(the leaves sell for ${r.n * sellOf(inId)})` : `(seeds sell for ${r.n * sd.seedSell}, cost ${r.n * sd.seedPrice} new)`}</span> · you have ${have}</small></div><div class="acts"><button class="btn btn-gold sm" data-distill="${sp}" ${ok ? '' : 'disabled'}>Distill</button></div></div>`; }).join('');
  return `<div class="hero tea-hero">${FEATURE_ART.still}<p>Essential oils — and their hydrosols — from your seeds</p></div>
    <div class="sec-title">Stills · ${S.stills.filter(Boolean).length}/${S.stills.length}</div><div class="tslots">${slots}</div>
    <div class="sec-title">Recipes · seeds${Object.values(STILL.recipes).some((r) => r.in) ? ' (and eucalyptus leaves)' : ''}</div><div class="list">${rows}</div>
    <p class="muted" style="margin:10px 4px 0">Every distillation gives two products: the essential oil and its hydrosol, the scented water left in the still (Damask Rose gives Rose Water). Each oil is worth far more than selling its seeds — but those seeds won’t be planted. Stills keep running while the game is closed. Sell oils at the Farm Stand.</p>`;
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
  return `<div class="hero tea-hero">${FEATURE_ART.tincture}<p>Tinctures &amp; dried herbs</p></div>
    <div class="sec-title">Base</div>${seg}
    ${has ? '' : `<p class="need-base">Needs Glycerin or Vinegar: buy at the Market${SUPPLY_CARDS.some((b) => S.unlocked[b]) ? '' : ' · find the Glycerin or Vinegar card in a Card Pack first'}</p>${S.marketBuilt ? '<div class="ts-actions" style="margin:0 0 8px"><button class="btn" data-act="open-market">Visit Supply Market</button></div>' : ''}`}
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
  if (panel === 'teastand') { title.innerHTML = 'Tea Stand'; body.innerHTML = teaHTML(); }
  if (CRAFT[panel]) { title.innerHTML = CRAFT[panel].name; body.innerHTML = craftHTML(panel); }
  if (panel === 'orchardtree') { const t = S.orchard[panelArg]; title.innerHTML = t ? TREES[t.sp].name : 'Orchard'; body.innerHTML = orchardTreeHTML(panelArg); }
  if (panel === 'billboard') { title.innerHTML = 'Roadside Billboard'; body.innerHTML = billboardHTML(); }
  if (panel === 'lot') { title.innerHTML = LOTS[panelArg].name; body.innerHTML = lotHTML(panelArg); }
  if (panel === 'settings') { title.innerHTML = 'Settings'; body.innerHTML = settingsHTML(); }
  if (panel === 'jewels') { title.innerHTML = `Jewel Shop${Payments.isTest ? ' <span class="test-tag">Test mode</span>' : ''}`; body.innerHTML = jewelsHTML(); }
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
function settingsHTML() {
  const games = OTHER_GAMES.map((g) => `<div class="game-row" data-game="${g.id}"><div class="game-art">${gameArt(g.id)}</div>
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
  return `<div class="sec-title" id="follow-us">Follow us</div><p class="muted follow-note">${nGot < SOCIALS.length ? `Follow Petalspire for news and sneak peeks — get ${FOLLOW_REWARD} free Jewel for each one (once per platform).` : 'Thanks for following Petalspire everywhere!'}</p><div class="follow-list">${follow}</div>
    <div class="sec-title" id="play-other-games">Play Other Games</div><div class="list games">${games}</div>
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
      : id === 'sickle' || id === 'plow' ? (c.lv > 1 ? `Rests ${Math.round(toolCd(id))} s` : 'Level up for a shorter rest') : id === 'windmill' ? `Barrels refill every ${WINDMILL.regenS[Math.min(4, c.lv) - 1]} s (base 60)` : id === 'parking' ? parkLevelText(c.lv) : id === 'irrigation' ? `${c.n} card${c.n > 1 ? 's' : ''} · every copy irrigates one more bed` : 'Copies stack here';
    const prog = up ? (nx != null ? `<div class="lv-prog"><b style="width:${Math.min(100, (c.n / nx) * 100)}%"></b></div><small>${c.n}/${nx} copies to Lv${c.lv + 1}</small>` : '<small>Max level</small>') : '';
    return `<div class="stack-row${canUpgrade(id) ? ' glow' : ''}">${cardHTML(id)}<div class="meta"><b>${CARDS[id].name}${up ? ` · Lv${c.lv}` : ''}</b><small>×${c.n} collected · ${fx}</small>${prog}
      ${canUpgrade(id) ? `<button class="btn btn-gold sm" data-upgrade="${id}">✨ Upgrade to Lv${c.lv + 1}</button>` : ''}</div></div>`; }).join('');
  return `<p class="muted" style="margin:8px 2px">Duplicate cards stack. At ${T.join(' / ')} copies a plant (or tool) card can be upgraded — copies are kept, never spent. Seeds per harvest always follow the plant’s tier.</p><div class="stacks">${rows || '<p class="muted">Open a Card Pack to start your collection.</p>'}</div>`;
}
// v0.52: owned-but-unbuilt buildings (older saves bought them before buy-and-place) get a Place button in the Bag
const UNBUILT = [['tincture', 'tinctureBuilt'], ['still', 'stillBuilt'], ['windmill', 'windmillBuilt'], ['parking', 'parkingBuilt'], ['billboard', 'billboardBuilt'], ['teastand', 'teaBuilt'], ['press', 'pressBuilt'], ['fruitstand', 'fruitstandBuilt']];
const unbuiltHTML = () => UNBUILT.filter(([id, k]) => S.owned[id] && !S[k] && !building[id]).map(([id]) => `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="build-${id}" data-place-owned="${id}"><i data-icon="build"></i> Place your ${FEATURES[id].name}</button>${id === 'tincture' && !tincLots().length ? '<small class="opt-note" style="display:block;margin-top:4px">Buy a neighbouring plot first — the Tincture Stand goes on one of your other plots</small>' : ''}</div>`).join('');
function satchelHTML() {
  const ids = ['seed_', 'flower_', 'dried_'].flatMap((p) => Object.keys(SPECIES).map((sp) => p + sp)).filter((id) => ITEMS[id]);   // v0.5: every plant
  const res = (icon, name, n) => `<div class="inv"><i data-icon="${icon}" style="width:38px;height:38px"></i><b>${name}</b><small>×${n}</small></div>`;
  const cells = res('wood', 'Wood', S.wood) + res('scrap', 'Scrap Metal', S.scrap || 0) + (S.inv.sapling ? res('sapling', 'Tree sapling', S.inv.sapling) : '') +
    ids.filter((id) => S.inv[id] > 0).map((id) => `<div class="inv">${itemSvg(id)}<b>${ITEMS[id].name}</b><small>×${S.inv[id]}</small></div>`).join('') +
    Object.entries(S.barrels).map(([l, b]) => `<div class="inv">${FEATURE_ART.rainbarrel}<b>${lotName(l)} barrel</b><small>${b.w}/${regenMax()}</small></div>`).join('') +
    ['glycerin', 'vinegar'].filter((id) => S.inv[id] > 0 || S.owned.tincture).map((id) => `<div class="inv">${itemSvg(id)}<b>${BASES[id].name}</b><small>×${S.inv[id]}</small></div>`).join('') +
    SELL_ORDER.filter((id) => ['tinc_', 'oil_', 'hydro_', 'tea_', 'press_', 'jar_', 'fruit_', 'bag'].some((p) => id.startsWith(p)) && S.inv[id] > 0).map((id) => `<div class="inv">${itemSvg(id)}<b>${ITEMS[id].name}</b><small>×${S.inv[id]}</small></div>`).join('');
  const feats = Object.keys(S.owned).filter((k) => S.owned[k]).map((k) => `<div class="row"><div class="ico">${FEATURE_ART[k]}</div><div class="meta"><b>${FEATURES[k].name}</b><small>${k === 'beehive' ? `${Object.keys(S.hives).length} placed (${Object.keys(S.hives).map(lotName).join(', ') || 'none yet'}) · +${HIVE_BONUS} flower per harvest on that plot only` : k === 'tincture' ? (S.tinctureBuilt ? 'Built · steep flowers with Glycerin or Vinegar' : 'Bought · build it from the Build menu') : FEATURES[k].blurb.replace('Once bought, ', '').replace('A reusable tool. ', '')}</small></div>${FEATURES[k].cooldownS ? `<div class="acts"><button class="btn btn-primary sm" data-act="use-${k}">Use</button></div>` : ''}</div>`).join('');
  return `<div class="inv-grid">${cells}</div>${bagStrip()}
    ${S.hiveInv > 0 ? `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="place-hive">🐝 Place your Honeybee Skep (${S.hiveInv})</button></div>` : ''}
    ${unbuiltHTML()}
    ${S.barrelInv > 0 ? `<div class="ts-actions" style="margin-top:10px"><button class="btn btn-primary" data-act="place-barrel"><i data-icon="water"></i> Place your Rain Barrel (${S.barrelInv})</button></div>` : ''}
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
  const shelfRow = (f) => { const on = shelfOn(), k = kindOfBonus('crate');
    return `<div class="row shelf-row${on ? ' on' : ''}" data-shelf-row><div class="ico">${findIcon(k)}</div><div class="meta"><b>${f.into.name}</b><small>${on ? `<span class="ok-tag">Installed</span> on your Farm Stand · +${SHELF_BONUS} shelf space (${standCount()}/${standCap()} used)` : S.standBuilt ? `In your Bag · install it on your Farm Stand for +${SHELF_BONUS} shelf space` : `In your Bag · build the Farm Stand to install it (+${SHELF_BONUS} shelf space)`}</small></div><div class="acts">${on ? `<button class="btn sm" data-uninstall-shelf>Take out</button>` : `<button class="btn btn-gold sm" data-install-shelf ${S.standBuilt ? '' : 'disabled'}>Install</button>`}<button class="btn sm" data-sell-restored="${k}">Sell ${coin(buyback(RESALE.antique[k]))}</button></div></div>`; };
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
// v0.52: the billboard's "top seller" panel — most units sold at the stand (S.stats.soldBy), else what's on the stand now
function topSeller() {
  const by = S.stats.soldBy || {}, ids = Object.keys(by).filter((id) => ITEMS[id] && by[id] > 0);
  const id = ids.sort((a, b) => by[b] - by[a])[0] || SELL_ORDER.find((k) => S.stand[k] > 0 && ITEMS[k]);
  return id ? { id, name: ITEMS[id].name, color: ITEMS[id].icon?.[1] || '#B79AD6', sold: by[id] || 0 } : null;
}
function syncBillboard() {
  if (!S.billboardBuilt || building.billboard) return;
  const txt = bbStatusText(), left = Math.max(0, Math.ceil(((S.bb?.until || 0) - now()) / 1000));
  W.setBillboard(bbActive(), txt, { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, top: topSeller() });
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
// v0.52: an unlocked building you don't own yet is bought and placed in one go from here too (paid when the spot is confirmed).
function buyBuildCard(id, art, nm, sub, lock) {
  if (lock) return card(art, nm, sub, `<span class="bstat lock"><i data-icon="lock"></i> ${lock}</span>`, true);
  const c = buyCost(id), have = [`${S.coins} coins`, c.wood && `${S.wood} Wood`, c.scrap && `${S.scrap} Scrap`].filter(Boolean).join(', ');
  return card(art, nm, sub, `<div class="cost">${coin(c.coins)} ${c.wood ? woodTag(c.wood) : ''} ${c.scrap ? scrapTag(c.scrap) : ''} <span class="${canPay(c) ? 'ok' : 'no'}">you have ${have}</span></div>
    <button class="btn btn-gold" data-buy="${id}" data-price="${c.coins}" ${canPay(c) ? '' : 'disabled'}><i data-icon="build"></i> ${id === 'parking' || id === 'billboard' ? 'Buy &amp; build' : 'Buy &amp; place'}</button>`);
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
    if (!S.owned.windmill) return buyBuildCard('windmill', art, nm, sub);
    const sc = BUILDS.windmill.scrap, okW = S.wood >= c && S.scrap >= sc;
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} ${scrapTag(sc)} <span class="${okW ? 'ok' : 'no'}">you have ${S.wood} Wood, ${S.scrap} Scrap</span></div>
      <button class="btn btn-gold" data-act="build-windmill" ${okW ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button>`);
  }
  if (id === 'parking' || id === 'billboard') {
    const F = FEATURES[id], nm = F.name, c = BUILDS[id].wood, art = FEATURE_ART[id];
    const sub = id === 'parking' ? `<b>Lv${cardLv('parking')}</b> · ${parkLevelText(cardLv('parking'))}.` : `Across the road · Run ad for ${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min, free once an hour.`;
    if (S[id + 'Built']) return card(art, nm, sub, status('done', 'Built'));
    if (!S.unlocked[id]) return card(art, nm, sub, status('lock', `<i data-icon="lock"></i> Find the ${nm} card in a Card Pack`), true);
    if (!S.owned[id]) return buyBuildCard(id, art, nm, sub, id === 'parking' && !S.standBuilt ? 'Build the Farm Stand first' : '');
    if (id === 'parking' && !S.standBuilt) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Build the Farm Stand first'), true);
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-${id}" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Build ${id === 'parking' ? 'by the stand' : 'by the road'}</button>`);
  }
  if (CRAFT[id]) {   // v0.6
    const C = CRAFT[id], art = FEATURE_ART[id], c = BUILDS[id].wood, sub = C.blurb + '.';
    if (S[C.built]) return card(art, C.name, sub, status('done', `Built · ${lotName(S[C.pos]?.lot || 'home')}`));
    if (!S.unlocked[id]) return card(art, C.name, sub, status('lock', `<i data-icon="lock"></i> Find the ${C.name} card in a Card Pack`), true);
    if (!S.owned[id]) return buyBuildCard(id, art, C.name, sub, '');
    return card(art, C.name, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-${id}" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">Goes on any plot you own</small>`);
  }
  if (id === 'teastand') {
    const art = FEATURE_ART.teastand, sub = 'Blend any three dried herbs into teas — the rarer the herbs, the pricier the tea.', nm = 'Tea Stand', c = BUILDS.teastand.wood;
    if (S.teaBuilt) return card(art, nm, sub, status('done', `Built · ${lotName(S.teaPos?.lot || 'home')}`));
    if (!S.unlocked.teastand) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Find the Tea Stand card in a Card Pack'), true);
    if (!S.owned.teastand) return buyBuildCard('teastand', art, nm, sub, '');
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-teastand" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">Goes on any plot you own</small>`);
  }
  if (id === 'still') {
    const art = FEATURE_ART.still, sub = 'Distill seeds in copper stills into essential oils that sell for a premium.', nm = 'Essential Oil Stand', c = BUILDS.still.wood;
    if (S.stillBuilt) return card(art, nm, sub, status('done', `Built · ${lotName(S.stillPos?.lot || 'home')}`));
    if (!S.unlocked.still) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Find the Essential Oil Stand card in a Card Pack'), true);
    if (!S.owned.still) return buyBuildCard('still', art, nm, sub, tincLots().length ? '' : 'Buy a neighbouring plot first — it’s built on one of your other plots');
    if (!tincLots().length) return card(art, nm, sub, status('lock', '<i data-icon="lock"></i> Buy a neighbouring plot first — it’s built on one of your other plots'), true);
    return card(art, nm, sub, `<div class="cost">${woodTag(c)} <span class="${S.wood >= c ? 'ok' : 'no'}">you have ${S.wood}</span></div>
      <button class="btn btn-gold" data-act="build-still" ${S.wood >= c ? '' : 'disabled'}><i data-icon="build"></i> Choose a spot &amp; build</button><small class="opt-note">Goes on one of your other plots (${tincLots().map(lotName).join(', ')})</small>`);
  }
  if (id === 'tincture') {
    const art = FEATURE_ART.tincture, sub = 'Steep flowers with Glycerin or Vinegar into tinctures that sell for far more.';
    if (S.tinctureBuilt) return card(art, 'Tincture Stand', sub, status('done', 'Built'));
    if (!S.owned.tincture) return card(art, 'Tincture Stand', sub, status('lock', `<i data-icon="lock"></i> Free goal reward: ${GOALS.find((g) => g.reward === 'tincture').text.split(' · ')[0]}`), true);
    if (!tincLots().length) return card(art, 'Tincture Stand', sub, status('lock', '<i data-icon="lock"></i> Yours! Buy a neighbouring plot first — it’s placed on one of your other plots'), true);
    return card(art, 'Tincture Stand', sub, `<div class="cost"><span class="ok">Free · goal reward</span></div>
      <button class="btn btn-gold" data-act="build-tincture"><i data-icon="build"></i> Choose a spot &amp; place</button><small class="opt-note">Goes on one of your other plots (${tincLots().map(lotName).join(', ')})</small>`);
  }
  if (id === 'barrel') {
    const need = barrelLots(), n = Object.keys(S.barrels).length, sub = `Its own water for one plot: 1 a minute (up to ${regenMax()}), feeds up to ${BARREL.maxBeds} irrigated beds in that plot and the plot behind it.`;
    if (!S.barrel) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', sub, status('lock', '<i data-icon="lock"></i> Your first one comes free with your first raised bed'), true);
    if (S.barrelInv > 0 && need.length) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', `${sub} You have <b>${S.barrelInv}</b> to place in: <b>${need.map(lotName).join(', ')}</b>.`, `<button class="btn btn-primary" data-act="place-barrel"><i data-icon="build"></i> Place Rain Barrel</button>`);
    if (!need.length) return card(FEATURE_ART.rainbarrel, 'Rain Barrel', `${sub} One per plot · ${n} placed.`, status('done', LOT_FOR_SALE.every((l) => S.lots[l]) ? 'Every plot has one' : 'Every plot you own has one · buy more land for another'));
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
  // v0.52: saplings are a plain Supply Market item now (buy, then Plant) — no Plant-a-tree card in Build any more
  return `<div class="build-list">${bed}${projectCard('barrel')}${projectCard('stand')}${projectCard('rack')}${projectCard('market')}${projectCard('tincture')}${projectCard('still')}${projectCard('teastand')}${projectCard('press')}${projectCard('fruitstand')}${projectCard('windmill')}${projectCard('parking')}${projectCard('billboard')}</div>
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
function standHTML() {
  const used = standCount(), cap = standCap();
  const onStand = SELL_ORDER.filter((id) => S.stand[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name} ×${S.stand[id]}</b><small>${sellOf(id)} coins each</small></div><div class="acts"><button class="btn sm" data-unstock="${id}">Take back</button></div></div>`).join('');
  const fromBag = bagStrip() + SELL_ORDER.filter((id) => S.inv[id] > 0).map((id) => `<div class="row"><div class="ico">${itemSvg(id)}</div><div class="meta"><b>${ITEMS[id].name}</b><small>You have ${S.inv[id]} · sells for ${sellOf(id)}</small></div>
    <div class="acts"><button class="btn sm" data-stock="${id}" data-n="1" ${used >= cap ? 'disabled' : ''}>+1</button><button class="btn btn-gold sm" data-stock="${id}" data-n="all" ${used >= cap ? 'disabled' : ''}>Stock all</button></div></div>`).join('');
  const status = custs.length ? `<b>${custs.length > 1 ? `${custs.length} customers are` : 'A customer is'} at your stand!</b>` : used ? `Next customer in about ${fmtTime(Math.max(0, nextCust - now()))}` : 'Put items on the stand to attract customers.';
  const prog = !S.marketAvail ? `<div class="goal-mini"><small>Earn ${MARKET_GOAL} coins here to start rebuilding the Supply Market</small><span class="gbar"><em style="width:${Math.min(100, (S.stats.standEarned / MARKET_GOAL) * 100)}%"></em></span><small>${Math.min(S.stats.standEarned, MARKET_GOAL)} / ${MARKET_GOAL}</small></div>` : `<p class="muted" style="margin:0 4px 8px">Earned at your stand: ${coin(S.stats.standEarned)}${atmosphere() ? ` · atmosphere ${atmosphere()}` : ''}</p>`;
  return `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh flowers by the road</p></div>
    <div class="stand-status"><i data-icon="stand"></i><span id="stand-status">${status}</span></div>${prog}${rewardHTML()}
    <div class="sec-title">On your stand · ${used}/${cap}${shelfOn() ? ' · crate shelf' : ''}</div>${S.bonus.crate ? `<div class="shelf-strip" data-shelf-strip>${findIcon('old_crate')}<span><b>Crate Shelf</b> ${shelfOn() ? `installed · +${SHELF_BONUS} space` : 'in your Bag'}</span>${shelfOn() ? '<button class="btn sm" data-uninstall-shelf>Take out</button>' : '<button class="btn btn-gold sm" data-install-shelf>Install</button>'}</div>` : ''}
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
      ${S.inv.sapling ? `<div class="list" style="margin-top:12px">${saplingRow(false)}</div>` : ''}
      <button class="jewel-strip" data-act="open-jewels" style="margin-top:12px"><i data-icon="jewel"></i><span><b>${S.jewels} Jewels</b><small>Jewel Shop</small></span><em>Shop</em></button>`;
  }
  let h = `<div class="hero"><img src="assets/market.jpg" alt=""/><p>Fresh seeds &amp; fair prices</p></div>
    <div class="seg"><button data-tab="buy" class="${marketTab === 'buy' ? 'on' : ''}">Supplies</button><button data-tab="packs" class="${marketTab === 'packs' ? 'on' : ''}">Card Packs</button></div>`;
  if (marketTab === 'packs') return h + packsHTML();
  const rows = [];
  rows.push(buyRow('wood5', `<i data-icon="wood" style="width:40px;height:40px"></i>`, 'Bundle of Wood', `+${SHOP.wood5.wood} Wood · you have ${S.wood}`, SHOP.wood5.price));
  rows.push(buyRow('scrap5', `<i data-icon="scrap" style="width:40px;height:40px"></i>`, `Scrap Metal ×${SHOP.scrap5.scrap}`, `For the Windmill and repairs · cheaper by recycling finds while clearing · you have ${S.scrap}`, SHOP.scrap5.price));
  rows.push(saplingRow(true));
  // v0.52: the Rain Barrel is built from the Build menu now; the market sells a water truck that fills your barrels instead.
  { const nb = Object.keys(S.barrels).length;
    if (nb) { const q = truckQuote(), per = WATER_TRUCK.perBarrel, pl = (n) => `${n} barrel${n === 1 ? '' : 's'}`;
      const sub = !q.need ? `All ${pl(nb)} already full · the truck only bills barrels it fills (${per} coins each)`
        : `A water truck fills ${q.need === nb ? `all ${pl(nb)}` : `${q.need} of your ${pl(nb)}`} to full · ${per} coins per barrel filled${q.can < q.need ? (q.can ? ` · you can pay for ${pl(q.can)} now (emptiest first)` : ` · you need ${per} coins`) : ''}`;
      rows.push(`<div class="row truck-row"><div class="ico">${TRUCK_SVG}</div><div class="meta"><b>Fill Rain Barrels</b><small>${sub}</small></div><div class="acts"><button class="btn btn-primary sm" data-act="fill-barrels" data-fill="${q.can}" ${q.can ? '' : 'disabled'}>${coin((q.can || q.need || 0) * per)}</button></div></div>`); } }
  // v0.5: every unlocked plant is for sale (tier-coloured label, grow time, flower price). Locked Basic plants keep their own row;
  // locked higher-tier plants are folded into one compact row per tier so the list stays short.
  for (const t of TIER_ORDER) { const sps = Object.keys(SPECIES).filter((sp) => SPECIES[sp].tier === t), T = PLANT_TIERS[t];
    for (const sp of sps) { const d = SPECIES[sp]; if (S.unlocked[sp]) rows.push(buyRow('seed_' + sp, `<img src="${d.img}" alt=""/>`, `${d.name} Seeds`, `<em class="tier-tag t-${t}">${T.label}</em> · blooms in ~${fmtTime(d.growS * 1000)} · ${d.noFlower ? `${d.seedsFixed} seeds a harvest, no flowers` : `flowers sell for ${d.flowerSell}`} · you have ${S.inv['seed_' + sp]}`, d.seedPrice));
      else if (t === 'basic') rows.push(lockedRow(`<img src="${d.img}" alt=""/>`, `${d.name} Seeds`)); }
    const locked = sps.filter((sp) => !S.unlocked[sp]);
    if (t !== 'basic' && locked.length) rows.push(`<div class="row locked tier-locked" data-tier-locked="${t}"><div class="ico"><span class="tier-gem t-${t}"></span></div><div class="meta"><b><em class="tier-tag t-${t}">${T.label}</em> ${locked.length === sps.length ? `${sps.length} plants` : `${locked.length} more`}</b><small>Discover ${locked.map((sp) => SPECIES[sp].name).join(', ')} in Card Packs (${T.pack}% a card)</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`); }
  rows.push(S.unlocked.irrigation ? placeRow('irrigation', `Waters one raised bed from your rain barrel · tap the bed to place it${S.irrigN ? ` · you have ${S.irrigN}` : ''}`) + (irrigFree() > 0 && S.beds.length > S.irrigBeds.length ? `<div class="ts-actions" style="margin:-4px 0 6px"><button class="btn sm" data-act="assign-irrig">Assign a spare card to a bed</button></div>` : '') : lockedRow(FEATURE_ART.irrigation, 'Irrigation'));
  // v0.52: buildings are bought AND placed in one step — the button starts placement, the price is paid when the spot is confirmed.
  // Owned-but-unbuilt ones (older saves) get a Build button right here.
  const ownedRow = (id, built, sub) => `<div class="row"><div class="ico">${FEATURE_ART[id]}</div><div class="meta"><b>${FEATURES[id].name}</b><small>${sub}</small></div>${built ? '' : `<div class="acts"><button class="btn btn-primary sm" data-act="build-${id}">Build</button></div>`}</div>`;
  for (const id of ['tincture', 'still']) { const F = FEATURES[id], built = S[id + 'Built'], pos = S[id === 'tincture' ? 'tincPos' : 'stillPos'];
    if (id === 'tincture' && !S.owned.tincture) { rows.push(`<div class="row locked tinc-reward"><div class="ico">${FEATURE_ART.tincture}</div><div class="meta"><b>${F.name}</b><small>Not for sale — a free reward for the goal “${GOALS.find((g) => g.reward === 'tincture').text.split(' · ')[0]}”</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`); continue; }
    rows.push(S.owned[id] ? ownedRow(id, built, built ? `Owned · built on ${lotName(pos?.lot || 'home')}` : id === 'tincture' ? `Yours (goal reward) · not placed yet · free${tincLots().length ? '' : ' · buy a neighbouring plot first'}` : `Owned · not built yet · ${woodTag(BUILDS.still.wood)} on one of your other plots`)
      : S.unlocked[id] ? placeRow(id, `${ftag(id)} · pick a spot on another plot — paid when you place it${tincLots().length ? '' : ' · buy a neighbouring plot first'} · ${id === 'tincture' ? 'steep flowers into tinctures' : 'distill seeds into oils'}`) : lockedRow(FEATURE_ART[id], F.name)); }
  { const F = FEATURES.teastand;
    rows.push(S.owned.teastand ? ownedRow('teastand', S.teaBuilt, S.teaBuilt ? `Owned · brewing on ${lotName(S.teaPos?.lot || 'home')}` : `Owned · not built yet · ${woodTag(BUILDS.teastand.wood)} on any plot you own`)
      : S.unlocked.teastand ? placeRow('teastand', `${ftag('teastand')} · pick a spot on any plot you own — paid when you place it · blend dried herbs into teas`) : lockedRow(FEATURE_ART.teastand, F.name)); }
  for (const c of Object.keys(CRAFT)) { const C = CRAFT[c];   // v0.6
    rows.push(S.owned[c] ? ownedRow(c, S[C.built], S[C.built] ? `Owned · built on ${lotName(S[C.pos]?.lot || 'home')}` : `Owned · not built yet · ${woodTag(BUILDS[c].wood)} on any plot you own`)
      : S.unlocked[c] ? placeRow(c, `${ftag(c)} · pick a spot on any plot you own — paid when you place it · ${C.blurb.toLowerCase()}`) : lockedRow(FEATURE_ART[c], C.name)); }
  // v0.6: Orchard saplings — one per tree card you have found (planting needs the Orchard)
  { const found = TREE_IDS.filter((t) => S.unlocked[t]);
    if (S.lots.orchard || found.length) rows.push(`<div class="sec-title orchard-title">Orchard saplings</div>`);
    for (const t of found) { const d = TREES[t], price = d.saplingPrice, T = PLANT_TIERS[d.tier], free = orchardSpots().filter((q) => q.ok).length;
      rows.push(`<div class="row tree-sap" data-tree-row="${t}"><div class="ico">${FEATURE_ART[t]}</div><div class="meta"><b>${d.name} sapling</b><small><em class="tier-tag t-${d.tier}">${T.label}</em> · first fruit in ~${fmtTime(d.growS * 1000 * treeLvK(t))}, then every ${fmtTime(d.cycleS * 1000 * treeLvK(t))} · ${d.yield} ${d.fruitName.toLowerCase()} (${d.fruitSell} each)${S.lots.orchard ? ` · ${free} free spot${free === 1 ? '' : 's'}` : ' · buy the Orchard to plant'}</small></div>
        <div class="acts"><button class="btn btn-primary sm" data-buy="tree_${t}" data-price="${price}" ${S.coins >= price && S.lots.orchard && free ? '' : 'disabled'}>${coin(price)}</button></div></div>`); }
    if (S.lots.orchard && !found.length) rows.push(`<p class="muted" style="margin:4px">Find fruit-tree cards in Card Packs to unlock saplings.</p>`); }
  { const F = FEATURES.windmill;
    rows.push(S.owned.windmill ? ownedRow('windmill', S.windmillBuilt, S.windmillBuilt ? `Owned · turning on ${lotName(S.windmillPos?.lot || 'home')} · barrels refill every ${regenS()} s` : `Owned · not built yet · ${woodTag(BUILDS.windmill.wood)} ${scrapTag(BUILDS.windmill.scrap)} anywhere on your land`)
      : S.unlocked.windmill ? placeRow('windmill', `${ftag('windmill')} · needs ${BUILDS.windmill.scrap} Scrap Metal (you have ${S.scrap}) · all connected barrels refill every ${WINDMILL.regenS[0]} s instead of ${WATER_REGEN_S} s`) : lockedRow(FEATURE_ART.windmill, F.name)); }
  for (const id of ['parking', 'billboard']) { const F = FEATURES[id];
    rows.push(S.owned[id] ? ownedRow(id, S[id + 'Built'], S[id + 'Built'] ? 'Owned · built by the road' : `Owned · not built yet · ${woodTag(BUILDS[id].wood)} by the road`)
      : S.unlocked[id] ? placeRow(id, `${ftag(id)} · built by the road as soon as you buy it · ${id === 'parking' ? 'customers arrive 2 cars at a time · stack cards for up to 6 spots' : `Run ad: ${BILLBOARD.mult}× traffic for ${BILLBOARD.boostMs / 60000} min, free hourly`}`) : lockedRow(FEATURE_ART[id], F.name)); }
  for (const b of SUPPLY_CARDS) { const d = BASES[b];   // v0.52: card + open Tincture Stand needed; the row says what is still missing
    rows.push(baseOpen(b) ? buyRow(b, itemSvg(b), d.name, `${d.blurb} · you have ${S.inv[b]}`, d.price) + buyRow(b + '5', itemSvg(b), `${d.name} ×${d.pack.n}`, `Pack of ${d.pack.n} · save ${d.price * d.pack.n - d.pack.price} coins`, d.pack.price)
      : `<div class="row locked supply-locked" data-supply-locked="${b}"><div class="ico">${itemSvg(b)}</div><div class="meta"><b>${d.name}</b><small>${baseNeeds(b).join(' · ')}${S.inv[b] ? ` · you have ${S.inv[b]}` : ''}</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`); }
  { const d = FEATURES.beehive, need = hiveLots(), more = need.length - (S.hiveInv || 0);
    rows.push(!S.unlocked.beehive ? lockedRow(FEATURE_ART.beehive, d.name)
      : S.hiveInv > 0 ? `<div class="row"><div class="ico">${FEATURE_ART.beehive}</div><div class="meta"><b>${d.name}</b><small>You have ${S.hiveInv} to place</small></div><div class="acts"><button class="btn btn-primary sm" data-act="place-hive">Place</button></div></div>`
      : more > 0 ? placeRow('beehive', `${ftag('beehive')} · tap a spot on ${need.map(lotName).join(' or ')} — paid when you place it · +${HIVE_BONUS} flower per harvest on that plot only · one per plot`)
      : `<div class="row"><div class="ico">${FEATURE_ART.beehive}</div><div class="meta"><b>${d.name}</b><small>${S.hiveInv > 0 ? `You have ${S.hiveInv} to place` : `${Object.keys(S.hives).length} placed · every plot you own has one`}</small></div>${S.hiveInv > 0 ? '<div class="acts"><button class="btn btn-primary sm" data-act="place-hive">Place</button></div>' : ''}</div>`); }
  for (const f of ['sundial', 'sickle', 'plow']) {
    const d = FEATURES[f];
    if (S.owned[f]) rows.push(`<div class="row"><div class="ico">${FEATURE_ART[f]}</div><div class="meta"><b>${d.name}</b><small>Owned · ${d.blurb.replace('Once bought, ', '').replace('A reusable tool. ', '')}</small></div>${d.cooldownS ? `<div class="acts"><button class="btn btn-primary sm" data-act="use-${f}">Use</button></div>` : ''}</div>`);
    else rows.push(S.unlocked[f] ? buyRow(f, FEATURE_ART[f], d.name, d.blurb.replace('Once bought, ', ''), d.price) : lockedRow(FEATURE_ART[f], d.name));
  }
  return h + `<button class="jewel-strip" data-act="open-jewels"><i data-icon="jewel"></i><span><b>${S.jewels} Jewels</b><small>Jewel Shop</small></span><em>Shop</em></button><div class="list">${rows.join('')}</div>`;
}
const buyRow = (id, icon, name, sub, price) => `<div class="row"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>${sub}</small></div><div class="acts"><button class="btn btn-primary sm" data-buy="${id}" data-price="${price}" ${S.coins < price ? 'disabled' : ''}>${coin(price)}</button></div></div>`;
const placeRow = (id, sub) => { const c = buyCost(id); return `<div class="row place-buy"><div class="ico">${FEATURE_ART[id]}</div><div class="meta"><b>${FEATURES[id].name}</b><small>${sub}</small></div><div class="acts"><button class="btn btn-primary sm buy-place" data-buy="${id}" data-price="${c.coins}" ${canPay(c) ? '' : 'disabled'}>${[coin(c.coins), c.wood && woodTag(c.wood), c.scrap && scrapTag(c.scrap)].filter(Boolean).join('')}</button></div></div>`; };
const lockedRow = (icon, name) => `<div class="row locked"><div class="ico">${icon}</div><div class="meta"><b>${name}</b><small>Discover it in a Card Pack to unlock</small></div><i data-icon="lock" style="width:22px;height:22px"></i></div>`;
// v0.52: Tree sapling — a plain Supply Market item: buy one, then plant it (Plant button, or straight after buying).
function saplingRow(canBuy) {
  const p = SHOP.sapling.price;
  return `<div class="row sapling-row"><div class="ico"><i data-icon="sapling" style="width:40px;height:40px"></i></div><div class="meta"><b>Tree sapling</b><small>Grows in ~${fmtTime(TREE_MS)} into a big tree (${TREE.wood} Wood) · you have ${S.inv.sapling}</small></div><div class="acts">${S.inv.sapling ? '<button class="btn sm" data-act="place-sapling">Plant</button>' : ''}${canBuy ? `<button class="btn btn-primary sm" data-buy="sapling" data-price="${p}" ${S.coins < p ? 'disabled' : ''}>${coin(p)}</button>` : ''}</div></div>`;
}
// v0.52: Fill Rain Barrels. A water truck tops every barrel that isn't full up to full and bills WATER_TRUCK.perBarrel per barrel
// it filled (already-full barrels are free). Short of coins, it fills as many as you can pay for, emptiest first.
const TRUCK_SVG = `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M2 22h44" stroke="#C9B9A0" stroke-width="2"/><rect x="4" y="9" width="24" height="11" rx="5.5" fill="#EEF2EE" stroke="#5E97AA" stroke-width="1.6"/><path d="M10 9v11M22 9v11" stroke="#5E97AA" stroke-width="2"/><path d="M28 10h8l6 6v5H28z" fill="#5E97AA" stroke="#3E6F80" stroke-width="1.4" stroke-linejoin="round"/><path d="M31 12h4l4 4h-8z" fill="#CFE6EE"/><circle cx="10" cy="23" r="3" fill="#5A4A44"/><circle cx="20" cy="23" r="3" fill="#5A4A44"/><circle cx="36" cy="23" r="3" fill="#5A4A44"/><path d="M16 12.5c-1.6 2.2-2.2 3.2-2.2 4a2.2 2.2 0 004.4 0c0-.8-.6-1.8-2.2-4z" fill="#7FB9D0"/></svg>`;
function truckQuote() {
  regenBarrels(); const max = regenMax();
  const list = Object.entries(S.barrels).filter(([, b]) => b.w < max).sort((a, b) => a[1].w - b[1].w);
  return { list, need: list.length, can: Math.min(list.length, Math.floor(S.coins / WATER_TRUCK.perBarrel)), max };
}
let truck = null;
function fillBarrels() {
  if (!S.marketBuilt) return false;
  const q = truckQuote(), per = WATER_TRUCK.perBarrel;
  if (!q.need) { toast('Every rain barrel is already full — the truck has nothing to fill'); return false; }
  if (!q.can) { toast(`The water truck charges ${per} coins per barrel — you need at least ${per} coins`); return false; }
  const lots = q.list.slice(0, q.can).map(([l]) => l), bill = lots.length * per, left = q.need - lots.length;
  for (const l of lots) { const b = S.barrels[l]; b.w = q.max; b.at = now(); }
  S.coins -= bill; S.stats.truckFills = (S.stats.truckFills || 0) + 1; S.stats.truckBarrels = (S.stats.truckBarrels || 0) + lots.length;
  S.lastTruck = { at: now(), lots, bill, left };
  syncBarrels(); autoIrrigate(); save(); hud(); closePanel();
  const pl = (n) => `${n} barrel${n === 1 ? '' : 's'}`;
  toast(`🚚 Water truck on its way to fill ${pl(lots.length)}`);
  if (truck && truck.state !== 'out') truck.leave();
  W.ctl.moved = true; glideW({ target: V3(-5.5, 0.3, 3.6), zoom: Math.max(W.ctl.zoom, 1.05) }, 1.0);
  const c = truck = W.spawnTruck({ stopX: -10.6, onPark: (car) => {
    W.poof(car.group.position.clone().setY(1.3), '#8EC5E0', 22, 2.2);
    lots.forEach((l, k) => setTimeout(() => { const b = S.barrels[l]; if (!b) return; W.poof(V3(b.x, 1.0, b.z), '#8EC5E0', 18, 2); popAt(V3(b.x, 1.6, b.z), `<i data-icon="water"></i>Filled ${q.max}/${q.max}`); }, 300 + k * 320));
    setTimeout(() => toast(`🚚 Water truck filled ${pl(lots.length)} · billed ${bill} coins${left ? ` · ${pl(left)} left unfilled (not enough coins)` : ''}`), 300);
    setTimeout(() => { car.leave(); if (truck === c) truck = null; }, 2600 + lots.length * 320); } });
  return { filled: lots.length, bill, left };
}
function buy(id, price) {
  if (PLACE_BUY[id]) return startBuy(id);   // v0.52: one step — place it, pay on confirm
  if (S.coins < price || !S.marketBuilt) return;
  { const b = BASES[id] ? id : BASES[id.slice(0, -1)] ? id.slice(0, -1) : null; if (b && !baseOpen(b)) { toast(baseNeeds(b).join(' · ')); return; } }   // v0.52
  S.coins -= price;
  if (id === 'wood5') S.wood += SHOP.wood5.wood; else if (id === 'scrap5') S.scrap += SHOP.scrap5.scrap; else if (id === 'sapling') S.inv.sapling++;
  else if (id.startsWith('seed_')) S.inv[id]++; else if (id === 'irrigation') S.irrigN++; else if (BASES[id]) S.inv[id]++; else if (BASES[id.slice(0, -1)]) S.inv[id.slice(0, -1)] += BASES[id.slice(0, -1)].pack.n; else if (id === 'beehive') { if (hiveLots().length <= (S.hiveInv || 0)) { S.coins += price; return; } S.hiveInv = (S.hiveInv || 0) + 1; S.owned.beehive = true; } else if (FEATURES[id]) S.owned[id] = true;
  save(); hud(); renderPanel();
  if (id === 'beehive') { toast('Honeybee Skep bought — tap clear ground on the plot it should help'); setTimeout(() => enterPlace('hive'), 500); return; }
  if (id === 'sapling') { toast('Bought a tree sapling — tap open ground to plant it'); setTimeout(() => enterPlace('sapling'), 500); return; }
  if (id === 'sickle' || id === 'plow') { toast(`${FEATURES[id].name} bought — tap its button on the left to use it`); setTimeout(() => tip(id), 600); return; }
  if (id === 'windmill') { toast('Windmill bought — build it anywhere on your land from the Build menu (20 Wood)'); return; }
  if (id === 'parking' || id === 'billboard') { syncBlueprints(); toast(`${FEATURES[id].name} bought — build it by the road from the Build menu (${BUILDS[id].wood} Wood)`); return; }
  if (id === 'still') { toast(tincLots().length ? 'Essential Oil Stand bought — build it on one of your other plots (Build menu)' : 'Essential Oil Stand bought — buy a neighbouring plot first, then build it there'); return; }
  if (id === 'tincture') { syncBlueprints(); toast(tincLots().length ? 'Tincture Stand bought — build it on one of your other plots (Build menu)' : 'Tincture Stand bought — buy a neighbouring plot first, then build it there'); return; }
  if (BASES[id] || BASES[id.slice(0, -1)]) { const b = BASES[id] ? id : id.slice(0, -1); toast(`+${BASES[id] ? 1 : BASES[b].pack.n} ${BASES[b].name} · you have ${S.inv[b]}`); return; }
  if (id === 'irrigation') { toast('Irrigation card bought — now tap a raised bed to irrigate it'); setTimeout(() => enterPlace('irrigation'), 500); return; }
  toast(id === 'wood5' ? `+${SHOP.wood5.wood} Wood` : id === 'scrap5' ? `+${SHOP.scrap5.scrap} Scrap Metal · you have ${S.scrap}` : id.startsWith('seed_') ? `Bought 1 ${ITEMS[id].name.replace(' Seeds', ' seed')}` : `${FEATURES[id].name} added to your garden`);
}
const collIds = () => Object.keys(CARDS).filter((k) => !TREES[k] || S.lots.orchard || S.discovered[k]);   // tree cards show once the Orchard is yours
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
    <p class="pack-guarantee" data-guarantee><b>Every pack has at least one Epic or better.</b> Odds above are per card; if all 3 cards roll Basic (${+(Math.pow(tierOdds('basic') / 100, 3) * 100).toFixed(1)}% of packs), the last one is redrawn from Epic-or-better with the same relative odds.</p>
    ${S.lots.orchard ? `<p class="pack-orchard" data-orchard-pool><b>Orchard owned:</b> the 14 fruit-tree cards are in the pack now (2 per tier).</p>` : `<p class="pack-orchard" data-orchard-pool>Buy <b>The Orchard</b> on the <b>Map</b> (after every Home plot) to add 14 fruit-tree cards to the pack.</p>`}
    <div class="sec-title">Your collection · ${disc.length}/${collIds().length}</div>
    ${TIER_ORDER.map((t) => { const pl = Object.keys(SPECIES).filter((k) => SPECIES[k].tier === t), fe = Object.keys(FEATURES).filter((k) => FEATURES[k].rarity === t && CARDS[k]), tr = collIds().filter((k) => TREES[k] && TREES[k].tier === t);
      return group(`<em class="tier-tag t-${t}">${PLANT_TIERS[t].label}</em> ${+tierOdds(t).toFixed(2)}% a card · ${pl.length} plants${tr.length ? ` + ${tr.length} tree${tr.length > 1 ? 's' : ''}` : ''}${fe.length ? ` + ${fe.length} feature${fe.length > 1 ? 's' : ''}` : ''}`, [...pl, ...tr, ...fe], 't-' + t); }).join('')}`;
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

const orchardLocked = () => LOT_FOR_SALE.some((l) => !S.lots[l]);   // v0.6: every Home plot first (incl. the Back Woods)
function lotHTML(id) {
  const owned = !!S.lots[id]; const price = lotPrice();
  if (id === 'orchard' && !owned) { const left = LOT_FOR_SALE.filter((l) => !S.lots[l]);
    return `<div class="lot-card"><i data-icon="sign" style="width:54px;height:54px"></i><div><b>The Orchard · For sale</b><small>Room for 2 raised beds and ${ORCHARD_TREE_SPOTS.length} fruit trees</small></div></div>
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
function buyLot(id) {
  if (id === 'orchard') return buyOrchard();
  const price = lotPrice(); if (S.lots[id] || S.coins < price || !LOT_FOR_SALE.includes(id)) return false;
  S.coins -= price; S.lots[id] = true; S.lotsBought++; save();
  closePanel(); W.setLotOwned(id, true);
  const [cx, cz] = lotCenter(id); W.poof(new THREE.Vector3(cx, 0.6, cz), '#F5D07A', 26, 3);
  W.ctl.moved = true; glideW({ target: new THREE.Vector3(cx * 0.6, 0.3, cz * 0.6 + 0.6), zoom: 1.15 }, 1.4);
  toast(`${LOTS[id].name} is yours!`); tip('plotbought'); hud(); checkGoals(); return true;
}

// ---------------- v0.6: the Map — Home, The Orchard, and places coming soon ----------------
const curLoc = () => (S.loc === 'orchard' && S.lots.orchard ? 'orchard' : 'home');
function setLoc(loc, quiet) {
  if (loc === 'orchard' && !S.lots.orchard) return false;
  S.loc = loc; PAN = PANS[loc]; W.setLocation(loc === 'home' ? null : LOCATIONS[loc].target);
  document.body.dataset.loc = loc; $('#btn-map b').textContent = loc === 'home' ? 'Map' : 'Map'; $('#loc-chip').textContent = LOCATIONS[loc].name;
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
  setTimeout(() => { setLoc(loc); closeMap(); toast(loc === 'home' ? 'Back home' : `Welcome to ${LOCATIONS[loc].name}`); if (loc === 'orchard') { tip('orchard'); syncOrchard(); } }, 260);
  return true;
}
function buyOrchard() {
  if (S.lots.orchard) return false;
  if (orchardLocked()) { toast('Buy every Home plot first — then the Orchard opens on the Map'); return false; }
  if (!canPay(ORCHARD_PRICE)) { toast(`You need ${missingText(ORCHARD_PRICE)}`); return false; }
  S.coins -= ORCHARD_PRICE.coins; S.wood -= ORCHARD_PRICE.wood; S.lots.orchard = true; save();
  closePanel(); hud(); renderMap(); toast('The Orchard is yours!'); checkGoals();
  setTimeout(() => travel('orchard'), 600);
  return true;
}
const MAP_PLACES = [
  { id: 'home', name: 'Home', x: 188, y: 548, line: 'Your cottage garden: raised beds, stands and the roadside market.' },
  { id: 'orchard', name: 'The Orchard', x: 300, y: 408, line: 'A sunny field of fruit trees, with room for raised beds and its own shed.' },
  { id: 'vegfarm', name: 'Vegetable Farm', x: 84, y: 402, soon: true, line: 'Long rows of vegetables, from tomatoes to giant pumpkins.' },
  { id: 'grain', name: 'Grain Fields', x: 96, y: 236, soon: true, line: 'Golden wheat, oats and barley rolling in the wind.' },
  { id: 'ranch', name: 'Livestock Ranch', x: 292, y: 240, soon: true, line: 'A red barn with hens, goats and a gentle dairy cow.' },
  { id: 'factory', name: 'Full Production', x: 196, y: 128, soon: true, line: 'A processing facility that turns your harvests into finished goods.' },
  { id: 'grocery', name: 'Grocery Store', x: 312, y: 70, soon: true, line: 'Your own shop in town, stocked with everything you grow and make.' },
];
const MAP_ART = {
  home: `<path d="M-26 6h52v20h-52z" fill="#F2E2C4" stroke="#7A5A3C" stroke-width="2"/><path d="M-32 8 0-18 32 8z" fill="#C86F4E" stroke="#7A5A3C" stroke-width="2" stroke-linejoin="round"/><rect x="-6" y="12" width="12" height="14" fill="#8E6040"/><rect x="-21" y="11" width="9" height="8" fill="#9FC7D9" stroke="#7A5A3C"/><rect x="12" y="11" width="9" height="8" fill="#9FC7D9" stroke="#7A5A3C"/><g fill="#B98BD6"><circle cx="-36" cy="26" r="4"/><circle cx="-28" cy="29" r="4"/><circle cx="36" cy="26" r="4"/></g><g fill="#F2B04C"><circle cx="-32" cy="22" r="3.5"/><circle cx="30" cy="30" r="3.5"/></g>`,
  orchard: `<g stroke="#7A5A3C" stroke-width="2"><path d="M-22 26v-12M0 22v-14M22 26v-12" /></g><g stroke="#4F7A45" stroke-width="1.5"><circle cx="-22" cy="6" r="13" fill="#7FB069"/><circle cx="22" cy="6" r="13" fill="#8DBB6E"/><circle cx="0" cy="-2" r="15" fill="#6FA35F"/></g><g fill="#E0584A"><circle cx="-26" cy="4" r="3"/><circle cx="-17" cy="10" r="3"/><circle cx="4" cy="-6" r="3"/><circle cx="-5" cy="4" r="3"/></g><g fill="#F2B04C"><circle cx="20" cy="2" r="3"/><circle cx="27" cy="10" r="3"/></g>`,
  vegfarm: `<g stroke="#7A5A3C" stroke-width="1.2"><path d="M-30 4h60M-32 12h64M-34 20h68" stroke="#A97C50" stroke-width="5" stroke-linecap="round"/></g><g fill="#6FA35F"><circle cx="-20" cy="0" r="4"/><circle cx="-4" cy="0" r="4"/><circle cx="12" cy="0" r="4"/><circle cx="-12" cy="8" r="4"/><circle cx="4" cy="8" r="4"/><circle cx="20" cy="8" r="4"/></g><ellipse cx="0" cy="-12" rx="12" ry="9" fill="#E98A3C" stroke="#7A5A3C" stroke-width="1.5"/><path d="M0-21v-5" stroke="#4F7A45" stroke-width="3" stroke-linecap="round"/>`,
  grain: `<path d="M-38 20Q0-6 38 20z" fill="#E9C66A" stroke="#B88C38" stroke-width="1.5"/><g stroke="#C99A3E" stroke-width="1.5"><path d="M-26 18q8-12 16-16M-8 16q8-12 16-16M10 18q8-10 14-12"/></g><g fill="#D9A93F" stroke="#9C7430" stroke-width="1"><ellipse cx="0" cy="-8" rx="5" ry="12"/><ellipse cx="-8" cy="-4" rx="4" ry="10" transform="rotate(-20 -8 -4)"/><ellipse cx="8" cy="-4" rx="4" ry="10" transform="rotate(20 8 -4)"/></g><path d="M-10 4h20" stroke="#9C7430" stroke-width="3"/>`,
  ranch: `<path d="M-24 0h48v26h-48z" fill="#C2513F" stroke="#7A3A2C" stroke-width="2"/><path d="M-28 2 0-20 28 2z" fill="#9C3E30" stroke="#7A3A2C" stroke-width="2" stroke-linejoin="round"/><path d="M-8 26V10h16v16M-8 10l16 16M8 10l-16 16" fill="none" stroke="#F2E2C4" stroke-width="2"/><g stroke="#8E6040" stroke-width="2"><path d="M30 26V12M42 26V12M30 16h12M30 22h12"/></g><ellipse cx="-38" cy="22" rx="7" ry="5" fill="#F7F1E3" stroke="#7A5A3C"/>`,
  factory: `<path d="M-30 26V2l14 8V2l14 8V2l14 8V-14h10v40z" fill="#B9A68C" stroke="#6E5A44" stroke-width="2" stroke-linejoin="round"/><g fill="#F5D35A"><rect x="-24" y="14" width="7" height="6"/><rect x="-10" y="14" width="7" height="6"/><rect x="4" y="14" width="7" height="6"/></g><g fill="#E6E0D4" opacity=".9"><circle cx="28" cy="-22" r="5"/><circle cx="34" cy="-30" r="6"/><circle cx="42" cy="-36" r="5"/></g><circle cx="-36" cy="10" r="9" fill="none" stroke="#6E5A44" stroke-width="2.5" stroke-dasharray="4 3"/>`,
  grocery: `<path d="M-28 2h56v24h-56z" fill="#F2E2C4" stroke="#7A5A3C" stroke-width="2"/><path d="M-32 2h64l-4-12h-56z" fill="#5E8C6A" stroke="#3D5A40" stroke-width="1.5"/><g fill="#F7F1E3"><path d="M-24 2h8l-2-12h-6zM-8 2h8l-1-12h-6zM8 2h8l0-12h-6zM24 2h8l-3-12h-6z" opacity=".9"/></g><rect x="-6" y="12" width="12" height="14" fill="#8E6040"/><rect x="-22" y="9" width="12" height="9" fill="#9FC7D9" stroke="#7A5A3C"/><rect x="10" y="9" width="12" height="9" fill="#9FC7D9" stroke="#7A5A3C"/><g fill="#E0584A"><circle cx="-36" cy="22" r="3"/><circle cx="-32" cy="24" r="3"/></g>`,
};
const LOCK_SVG = `<g class="lock"><circle r="11" fill="#FBF6EA" stroke="#7A5A3C" stroke-width="1.5"/><path d="M-4.5-1v-3a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#7A5A3C" stroke-width="2"/><rect x="-6" y="-1" width="12" height="9" rx="2" fill="#D9A93F" stroke="#7A5A3C" stroke-width="1.2"/></g>`;
function placeState(p) {
  if (p.soon) return 'soon';
  if (p.id === 'home') return 'open';
  return S.lots.orchard ? 'open' : orchardLocked() ? 'locked' : 'forsale';
}
function mapSVG() {
  const here = curLoc();
  const roads = [['home', 'orchard'], ['home', 'vegfarm'], ['vegfarm', 'grain'], ['orchard', 'ranch'], ['grain', 'factory'], ['ranch', 'factory'], ['factory', 'grocery']];
  const P = Object.fromEntries(MAP_PLACES.map((p) => [p.id, p]));
  const road = ([a, b]) => { const A = P[a], B = P[b], mx = (A.x + B.x) / 2 + (A.y - B.y) * 0.12, my = (A.y + B.y) / 2 + (B.x - A.x) * 0.12; const open = !A.soon && !B.soon && (a !== 'orchard' && b !== 'orchard' || S.lots.orchard); return `<path d="M${A.x} ${A.y + 20}Q${mx} ${my} ${B.x} ${B.y + 20}" class="road${open ? ' open' : ''}"/>`; };
  const place = (p) => { const st = placeState(p);
    return `<g class="map-place st-${st}${p.id === here ? ' here' : ''}" data-place="${p.id}" transform="translate(${p.x} ${p.y})" role="button" aria-label="${p.name}">
      <ellipse cx="0" cy="24" rx="50" ry="13" fill="#000" opacity=".08"/><ellipse class="hit" cx="0" cy="6" rx="56" ry="44" fill="transparent"/>
      <g class="art" filter="url(#paint)">${MAP_ART[p.id]}</g>
      ${st === 'soon' || st === 'locked' ? `<ellipse class="fog" cx="0" cy="4" rx="52" ry="34" fill="url(#fogG)"/>` : ''}
      ${st === 'soon' || st === 'locked' ? `<g transform="translate(30 -20)">${LOCK_SVG}</g>` : ''}
      ${p.id === here ? `<g class="you" transform="translate(0 -34)"><path d="M0 10-7-2a8 8 0 1 1 14 0z" fill="#C2513F" stroke="#fff" stroke-width="1.5"/><circle cy="-4" r="3" fill="#fff"/></g>` : ''}
      <g transform="translate(0 46)"><rect x="${-p.name.length * 3.6 - 10}" y="-11" width="${p.name.length * 7.2 + 20}" height="20" rx="10" class="ribbon"/><text y="4" text-anchor="middle">${p.name}</text></g>
      ${st === 'soon' ? `<text class="soon-tag" y="64" text-anchor="middle">Coming soon</text>` : ''}
    </g>`; };
  return `<svg class="map-svg" viewBox="0 0 390 640" preserveAspectRatio="xMidYMid meet" aria-label="Map of Petalspire">
    <defs>
      <filter id="paint" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter>
      <filter id="wash"><feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .62  0 0 0 0 .38  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <radialGradient id="fogG"><stop offset="0" stop-color="#FBF6EA" stop-opacity=".72"/><stop offset=".7" stop-color="#FBF6EA" stop-opacity=".45"/><stop offset="1" stop-color="#FBF6EA" stop-opacity="0"/></radialGradient>
      <radialGradient id="edgeFog" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#F3EAD3" stop-opacity="0"/><stop offset="1" stop-color="#F3EAD3" stop-opacity=".95"/></radialGradient>
      <linearGradient id="landG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCE3B0"/><stop offset=".55" stop-color="#CFDDA0"/><stop offset="1" stop-color="#BFD68E"/></linearGradient>
    </defs>
    <rect width="390" height="640" fill="#F3EAD3"/>
    <path d="M14 30Q60 8 140 20T300 14 380 40 384 300 376 620 200 630 10 610 8 300z" fill="url(#landG)"/>
    <rect width="390" height="640" fill="#BFD68E" filter="url(#wash)"/>
    <path d="M384 150Q330 170 340 220T300 330 350 470 330 640" fill="none" stroke="#9FC7D9" stroke-width="14" stroke-linecap="round" opacity=".75"/>
    <path d="M384 150Q330 170 340 220T300 330 350 470 330 640" fill="none" stroke="#C9E1EA" stroke-width="5" stroke-linecap="round" opacity=".8"/>
    <g fill="#A9C78A" opacity=".55"><ellipse cx="40" cy="560" rx="60" ry="26"/><ellipse cx="360" cy="560" rx="50" ry="22"/><ellipse cx="200" cy="330" rx="70" ry="22"/><ellipse cx="30" cy="140" rx="40" ry="60"/></g>
    <g fill="#7FB069" stroke="#5E8C4F" stroke-width="1" opacity=".8">${[[30, 480], [46, 492], [356, 330], [368, 344], [150, 470], [250, 480], [60, 320], [240, 330], [140, 60], [36, 70], [252, 590], [124, 600]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/>`).join('')}</g>
    <g class="roads">${roads.map(road).join('')}</g>
    ${MAP_PLACES.map(place).join('')}
    <rect width="390" height="640" fill="url(#edgeFog)" pointer-events="none"/>
    <g transform="translate(40 604)" class="compass"><circle r="14" fill="#FBF6EA" stroke="#7A5A3C"/><path d="M0-11 4 0 0 11-4 0z" fill="#C2513F"/><text y="-17" text-anchor="middle">N</text></g>
  </svg>`;
}
function mapCard(id) {
  const p = MAP_PLACES.find((q) => q.id === id); if (!p) return '';
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
  $('#map-body').innerHTML = mapSVG(); $('#map-card').innerHTML = mapSel ? mapCard(mapSel) : `<p class="muted map-hint">Tap a place. Everything keeps growing while you are away.</p>`;
  fillIcons($('#map'));
}
function openMap() { closePanel(); if (placing) exitPlace(); if (buildMode) exitBuild(); deselect(); mapSel = null; $('#map').classList.remove('hidden'); renderMap(); }
function closeMap() { $('#map').classList.add('hidden'); mapSel = null; }
$('#btn-map').addEventListener('click', (e) => { e.stopPropagation(); $('#map').classList.contains('hidden') ? openMap() : closeMap(); });
$('#map-close').addEventListener('click', closeMap);
$('#map').addEventListener('click', (e) => {
  const t = e.target.closest('[data-travel]'); if (t) { travel(t.dataset.travel); return; }
  if (e.target.closest('[data-buy-orchard]')) { buyOrchard(); return; }
  const g = e.target.closest('[data-place]'); if (g) { mapSel = g.dataset.place; renderMap(); }
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
  const fl = e.target.closest('[data-follow]'); if (fl) { claimFollow(fl.dataset.follow); return; }   // the link itself opens the page in a new tab
  const b = e.target.closest('button, .coll .card'); if (!b) return;
  if (b.dataset.tab) { marketTab = b.dataset.tab; renderPanel(); return; }
  if (b.dataset.bag) { bagTab = b.dataset.bag; renderPanel(); return; }
  if (b.dataset.upgrade) { upgradeCard(b.dataset.upgrade); return; }
  if (b.dataset.stockAntique) return stockAntique(b.dataset.stockAntique);
  if (b.dataset.sellRestored) return sellRestored(b.dataset.sellRestored);
  if (b.hasAttribute('data-install-shelf')) return installShelf();
  if (b.hasAttribute('data-uninstall-shelf')) return uninstallShelf();
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
  if (b.dataset.teacollect != null) return collectTea(+b.dataset.teacollect);
  if (b.dataset.make) { const [c, r] = b.dataset.make.split(':'); return craftMake(c, r); }
  if (b.dataset.makecollect) { const [c, k] = b.dataset.makecollect.split(':'); return craftCollect(c, +k); }
  if (b.dataset.pick != null) return pickTree(+b.dataset.pick);
  if (b.dataset.bagseeds) { const [sp, n] = b.dataset.bagseeds.split(':'); return bagSeeds(sp, +n); }
  if (b.dataset.teaadd != null) { teaAdd(b.dataset.teaadd); return renderPanel(); }
  if (b.dataset.tearm != null) { teaRemove(+b.dataset.tearm); return renderPanel(); }
  if (b.dataset.craft) return craftTincture(b.dataset.craft);
  if (b.dataset.tcollect != null) return collectTincture(+b.dataset.tcollect);
  if (b.dataset.unhook) return unhookIrrigation(b.dataset.unhook);
  if (b.dataset.slot != null) { const k = +b.dataset.slot; if (S.rack[k]) collect(k); else hang(k); afterRack(); return; }
  const a = b.dataset.act;
  if (a === 'fill-rack') { const sp = b.dataset.sp || 'lavender'; for (let k = 0; k < RACK_SLOTS; k++) hang(k, sp); afterRack(); return; }
  if (a === 'buy-pack') return buyPack();
  if (a === 'place-bed') return enterBuild();
  if (a === 'place-sapling') return enterPlace('sapling');
  if (a === 'build-barrel') return enterPlace('barrel');
  if (a === 'fill-barrels') return fillBarrels();
  if (a === 'assign-irrig') return enterPlace('irrigation');
  if (a === 'build-stand') return buildStand();
  if (a === 'build-rack') return buildRack();
  if (a === 'build-tincture') return buildTincture();
  if (a === 'build-teastand') return buildTea();
  if (a === 'build-press') return buildCraft('press');
  if (a === 'build-fruitstand') return buildCraft('fruitstand');
  if (a === 'brew-tea') return brewTea();
  if (a === 'tea-clear') { teaPick = []; return renderPanel(); }
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
const parkI = () => parkLv(cardLv('parking'));
const parkCap = () => (S.parkingBuilt ? PARKING.spots[parkI()] : 1);
const parkCars = () => (S.parkingBuilt ? PARKING.cars[parkI()] : 1);            // v0.52: cars per arrival (each is a customer)
// the bays in use, front (largest x, cars drive in +x) to back, so nobody drives through a parked car
const bayXs = () => PARK_X.slice(0, parkCap()).sort((a, b) => b - a);
const bayX = (k) => bayXs()[Math.min(k, parkCap() - 1)];
function parkLevelText(lv) { const i = parkLv(lv);
  return `${PARKING.spots[i]} spots · groups of ${PARKING.cars[i]} cars · a group every ~${Math.round(22.5 * PARKING.gapMult[i])} s · ${Math.round((PARKING.extraItem + CARD_LEVELS.parking.extraItem * i) * 100)}% buy an extra item`; }
const bbActive = () => !!S.billboardBuilt && now() < (S.bb?.until || 0);
const bbReadyIn = () => Math.max(0, (S.bb?.readyAt || 0) - now());
const trafficMult = () => (S.parkingBuilt ? PARKING.gapMult[parkI()] : 1) / (bbActive() ? BILLBOARD.mult : 1);   // multiplies the gap between cars
const extraItemChance = () => (S.parkingBuilt ? PARKING.extraItem + CARD_LEVELS.parking.extraItem * (cardLv('parking') - 1) : 0);
const custGap = () => randInt(15000, 30000) * atmosMult() * trafficMult();
function pickWants() {
  const avail = SELL_ORDER.filter((id) => S.stand[id] > 0); if (!avail.length) return [];
  const types = avail.sort(() => Math.random() - 0.5).slice(0, avail.length > 1 && Math.random() < 0.4 ? 2 : 1);
  const wants = types.map((id) => ({ id, n: randInt(1, Math.min(3, S.stand[id])) }));
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
  for (const w of c.wants) { const q = Math.min(w.n, S.stand[w.id] || 0); if (!q) continue; S.stand[w.id] -= q; if (!S.stand[w.id]) delete S.stand[w.id]; total += q * sellOf(w.id); items += q; (S.stats.soldBy ||= {})[w.id] = (S.stats.soldBy[w.id] || 0) + q; if (w.extra && q === w.n) extra = 1; }
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
  custs.forEach((c, k) => { if (c.slot !== k) { c.slot = k; c.car.stopX = bayX(k); if (c.car.state === 'park') c.car.state = 'in'; } });
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
const plantUses = (sp) => { const d = SPECIES[sp]; if (TREES[sp]) return treeUses(sp); if (!d) return '';
  if (d.noFlower) return `<br/><b>${PLANT_TIERS[d.tier].label}</b> · grows in ${fmtTime(d.growS * 1000)} · seed costs ${d.seedPrice} coins · <b>${d.seedsFixed} seeds per harvest</b>, no flowers · seeds sell for ${d.seedSell} each, ${SEED_BAGS[sp].map((b) => `${b.sell} a bag of ${b.n}`).join(', ')} · uses: replant, bag, Pressed Oil Stand`; const T = PLANT_TIERS[d.tier], sd = T.seeds[0] === T.seeds[1] ? `${T.seeds[0]}${T.bonus ? ' (sometimes ' + (T.seeds[0] + 1) + ')' : ''}` : T.seeds.join('–');
  const u = [DRYING[sp] && 'drying', TINCTURE.recipes[sp] && 'tinctures', STILL.recipes[sp] && 'essential oil'].filter(Boolean);
  return `<br/><b>${T.label}</b> · grows in ${fmtTime(d.growS * 1000)} · seed costs ${d.seedPrice} coins · flowers sell for ${d.flowerSell} · ${sd} seeds per harvest${u.length ? ` · uses: ${u.join(', ')}` : ''}`; };
function zoomCard(id) { const z = el('div', 'zoom', cardHTML(id) + `<p class="zoom-text">${CARDS[id].blurb}${plantUses(id)}<br/><small>Tap anywhere to close</small></p>`); z.addEventListener('click', () => z.remove()); $('#ui').appendChild(z); }
// v0.5: one weighted pick over every card (PACK_W, in % of a card slot). Features keep their v0.41 odds; plants follow
// their tier (Basic 40 · Epic 8 · Legendary 4.5 · Rare 3 · Super Rare 1.8 · Ultra Rare 0.8 · Other World 0.4).
// v0.6: once the Orchard is bought, the 14 tree cards join the pool (PACK_W_ORCH). Each tier's total share is unchanged —
// trees take half of their tier's plant share.
const packW = () => (S.lots?.orchard ? PACK_W_ORCH : PACK_W);
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
function rollPack(n = 1) { const out = []; for (let i = 0; i < n; i++) out.push(guarantee([drawCard(), drawCard(), drawCard()])); return out; }
function buyPack(forced) {
  if (!S.marketBuilt) return;
  if (S.jewels < PACK_JEWELS) { toast(`Need ${PACK_JEWELS} Jewel${PACK_JEWELS > 1 ? 's' : ''} for a Card Pack — get one in the Jewel Shop`); openPanel('jewels'); return; }
  S.jewels -= PACK_JEWELS; S.packs++;
  const ids = [drawCard(), drawCard(), drawCard()];
  if (S.packs === 1 && !S.unlocked.chamomile) ids[1] = 'chamomile';
  if (!forced) guarantee(ids);
  if (forced) forced.forEach((f, k) => f && (ids[k] = f));
  const seen = new Set();
  const results = ids.map((id) => { const isNew = (!S.discovered[id] || !S.unlocked[id]) && !seen.has(id); seen.add(id); S.discovered[id] = true; if (isNew) S.unlocked[id] = true;
    // v0.4: every copy stacks on its card. Extra Irrigation cards are extra irrigated beds; a maxed card still pays the old duplicate coins.
    const c = addCard(id); let coins = 0; if (!isNew && id === 'irrigation') S.irrigN++; if (!isNew && SUPPLY_CARDS.includes(id)) S.inv[id] += SUPPLY_DUP;   /* v0.52: +2 free units per duplicate supply card */ if (!isNew && CARD_LEVELS.upgradable(id, CARDS[id]) && nextAt(id) == null) { coins = DUP_COINS; S.coins += coins; }
    return { id, isNew, n: c.n, up: canUpgrade(id), coins }; });
  save(); hud(); closePanel();
  showReveal(results, { title: 'Botanical Card Pack', again: !forced, onCollect: (news) => { tip('pack'); if (news.length) openPanel('market', 'buy'); if (ADS.interstitialAfterPack) setTimeout(() => Ads.maybeBreak('pack', adBlocked()), 700); } });
}
let revealCards = null, revealOpts = {};
function showReveal(results, opts = {}) {
  revealCards = results; revealOpts = opts;
  const R = $('#reveal'); R.classList.remove('hidden', 'sus', 'sus-1', 'sus-2', 'sus-3'); R.dataset.stage = 'pack'; delete R.dataset.tier; delete R.dataset.hero; revealTimers.forEach(clearTimeout); revealTimers = [];
  R.innerHTML = `<div class="rays"></div><h2>${opts.title || 'Card Pack'}</h2><p class="sub">Tap the pack to open</p><div class="big-pack" id="bigpack"><img src="assets/pack.jpg" alt=""/>${opts.title?.startsWith('Starter') ? '<span class="pack-ribbon">Starter Seeds</span>' : ''}</div><div class="reveal-actions"></div>`;
  const bp = $('#bigpack');
  // v0.52: a pack holding a Super Rare / Ultra Rare / Other World card gets a suspense moment first: it shakes harder and
  // glows in that tier's colour (Other World adds a starfield + aurora and a longer build-up). Tap anywhere to skip.
  const top = results.map((r) => cardTier(CARDS[r.id])).sort((a, b) => tierRank(b) - tierRank(a))[0], H = HERO_TIERS[top];
  const open = () => {
    bp.removeEventListener('click', open);
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
  for (let i = 0; i < n; i++) {
    const p = el('i', i % 3 ? 'petal' : 'petal sp'); const x = Math.random() * 100, dx = (Math.random() - 0.5) * 120, d = 1.6 + Math.random() * 1.6;
    p.style.cssText = `left:${x}%;--dx:${dx}px;--r:${(Math.random() - 0.5) * 720}deg;animation-duration:${d}s;animation-delay:${Math.random() * 0.6}s;background:${i % 7 === 0 && tint ? tint : PETAL_COLS[i % PETAL_COLS.length]}`;
    root.appendChild(p); setTimeout(() => p.remove(), (d + 0.8) * 1000);
  }
}
function starfield(root) {
  const f = el('div', 'starfield'); for (let i = 0; i < 70; i++) { const st = el('i'); st.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 2}s;transform:scale(${0.4 + Math.random()})`; f.appendChild(st); }
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
  R.innerHTML = `<div class="rays"></div><h2>Your new cards</h2><p class="sub">Tap each card to reveal it</p><div class="deal"></div><div class="reveal-actions"><button class="btn" data-act="reveal-all">Reveal all</button></div>`;
  keep.forEach((k) => R.appendChild(k));
  const d = $('.deal', R);
  results.forEach((r, k) => {
    const rar = cardTier(CARDS[r.id]);
    const c = el('div', `card flip ${tierRank(rar) >= 2 ? 'hint-tier hint-' + rar : ''}`);
    const w = el('div', 'slotw'); w.style.animationDelay = `${k * 0.16}s`; w.appendChild(c);
    c.innerHTML = `<div class="flip-inner"><div class="back"><img src="assets/emblem.png" alt=""/><span>Petalspire</span></div><div class="front">${cardHTML(r.id, r.isNew ? '<span class="new-tag">NEW</span>' : `<span class="dup-tag">${r.up ? '✨ Upgrade ready' : r.coins ? `Max level · +${r.coins}` : r.id === 'irrigation' ? `Stacked ×${r.n} · +1 bed` : SUPPLY_CARDS.includes(r.id) ? `Stacked ×${r.n} · +${SUPPLY_DUP} ${CARDS[r.id].name}` : `Stacked ×${r.n}`}</span>`)}</div></div>`;
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
const PANS = { home: { x0: -13, x1: 13, z0: -28, z1: 5 }, orchard: { x0: ORCH_X - 9, x1: ORCH_X + 9, z0: -13, z1: 6 } };   // v0.6: per Map location
let PAN = PANS.home;
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
  else if (hit.kind === 'teastand') openPanel('teastand');
  else if (hit.kind === 'press' || hit.kind === 'fruitstand') openPanel(hit.kind);
  else if (hit.kind === 'orchardtree') { const t = S.orchard[hit.k]; if (t && orchRipe(t)) pickTree(hit.k); else openPanel('orchardtree', hit.k); }
  else if (hit.kind === 'windmill') { if (!building.windmill) toast(`Windmill · every connected rain barrel refills every ${regenS()} s (instead of ${S.bonus.can ? WATER_REGEN_S / 2 : WATER_REGEN_S} s)`); }
  else if (hit.kind === 'billboard') { if (!building.billboard) openPanel('billboard'); }
  else if (hit.kind === 'parking') { if (!building.parking) toast(`Parking Lot Lv${cardLv('parking')} · ${custs.length}/${parkCap()} spots in use · groups of ${parkCars()} cars · ${Math.round(extraItemChance() * 100)}% add an extra item${cardLv('parking') < 4 ? ' · stack Parking Lot cards to level up' : ''}`); }
  else if (hit.kind === 'barrel') focusThing({ kind: 'barrel', lot: hit.lot });
  else if (hit.kind === 'hive') focusThing({ kind: 'hive', lot: hit.lot });
}

setLoc(curLoc(), true);   // v0.6: resume where the player left off (Home or the Orchard)

// ---------------- Title & intro ----------------
if (S.introDone) $('#btn-start').textContent = 'Continue';
$('#btn-start').addEventListener('click', () => {
  $('#title').classList.add('out'); setTimeout(() => $('#title').classList.add('hidden'), 650);
  if (migrated) setTimeout(() => toast(`Petalspire v${BUILD} — a fresh start in the woods!`), 900);
  if (upgraded) setTimeout(() => toast(`Welcome to v${BUILD}! Your garden came along · +1 tree sapling · +${STARTER_JEWELS} Jewels`), 900);
  else if (migrated04) setTimeout(() => toast(`Welcome to v${BUILD} — water now only comes from rain barrels, one per plot (4 beds each)${migrated04.moved ? ` · ${migrated04.moved} bag water poured into your home barrel` : ''}${migrated04.lost ? ` · ${migrated04.lost} extra water didn’t fit and was lost` : ''}${migrated04.dropped ? ` · ${migrated04.dropped} irrigated bed${migrated04.dropped === 1 ? ' was' : 's were'} unhooked: give that plot a Rain Barrel (Supply Market), then re-assign` : ''}`), 900);
  if (hiveMigrated) setTimeout(() => toast('Your Honeybee Skep now sits on the Home plot — its bees boost only that plot’s beds (+1 flower per harvest)'), 6200);
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
function tick() {
  requestAnimationFrame(tick);
  const t = performance.now();
  if (t - lastTick > 250) { syncBedTargets();
    roadScrapTick(Math.min(1, (t - lastTick) / 1000));
    lastTick = t;
    refreshShade();
    for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i]) syncTile(i); syncTools();
    syncRack(); syncTrees();
    for (const r of [...S.restoring]) if (now() - r.start >= r.ms) finishRestore(r);
    if (S.marketProj) { if (marketK() >= 1) finishMarket(); else W.setMarketState('building', marketK()); }
    if (regenBarrels() && selected != null) renderSheet();
    autoIrrigate(); syncBarrels(); syncTinc(); syncStill(); syncTea(); syncCraft('press'); syncCraft('fruitstand'); syncOrchard();
    if (focus?.kind === 'barrel') { const n = $('#barrel-txt'); if (n && S.barrels[focus.lot]) n.textContent = barrelText(focus.lot); }
    else if (selected != null && S.tiles[selected] && !S.tiles[selected].wateredAt && !totalWater() && +$('#tile-sheet').dataset.tw !== Math.floor(now() / 1000)) { $('#tile-sheet').dataset.tw = Math.floor(now() / 1000); renderSheet(); }
    if (panel === 'still') { let redo = false; S.stills.forEach((t, k) => { const n = $(`[data-sleft="${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (CRAFT[panel]) { let redo = false; S[CRAFT[panel].slots].forEach((t, k) => { const n = $(`[data-cleft="${panel}:${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (panel === 'orchardtree') { const t = S.orchard[panelArg], n = $(`[data-oleft="${panelArg}"]`); if (t) { const left = orchStage(t) < 3 ? t.at + t.growMs - now() : t.next - now(); if (left <= 0 || (orchRipe(t) && n)) renderPanel(); else if (n) n.textContent = fmtTime(left); } }
    if (panel === 'teastand') { let redo = false; S.teas.forEach((t, k) => { const n = $(`[data-eleft="${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (panel === 'tincture') { let redo = false; S.tinc.forEach((t, k) => { const n = $(`[data-tleft="${k}"]`); if (t && n) { const left = t.start + t.ms - now(); if (left <= 0) redo = true; else n.textContent = fmtTime(left); } }); if (redo) renderPanel(); }
    if (S.standBuilt && !building.stand) {
      if (custs.length < parkCap() && standCount() > 0 && now() >= nextCust && S.introDone) spawnArrival();
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
  hud, syncBarrels, lotRoofs, standsLine, buildBarrelAt: (lot, x, z) => buildBarrel(lot, x, z), openMap, closeMap, travel, buyOrchard, claimFollow, SOCIALS, setLoc, loc: () => curLoc(), orchardLocked, mapPlaces: () => MAP_PLACES.map((p) => ({ id: p.id, name: p.name, soon: !!p.soon, state: placeState(p) })), ORCHARD_PRICE, casterIds: () => casters().map((c) => c.id + (c.h != null ? ":box" : ":tree")), checkGoals, regenBarrels, feedLot, reachLots,  get barrelReachTargets() { return W.bedTargets.children.map((g) => ({ b: g.userData.b, ok: g.userData.ok })); }, barrelRoof, lotRoofs, barrelStands, barrelPerTick, get gutterLots() { return [...W.gutters.keys()]; }, gutterPipes(lot) { return W.gutters.get(lot)?.userData.pipes || 0; },
  get tincGrandfathered() { return tincGrandfathered; }, tincProblem, tincSpots, buildTincture, placeTincture, buildStill, placeStill, distill, collectOil, STILL, TEA, teaInfo, teaId, teaSps, registerTea, buildTea, placeTea, brewTea, collectTea, teaAdd, teaRemove, get teaPick() { return [...teaPick]; }, set teaPick(v) { teaPick = [...v]; }, teaHTML, syncTea, DRY_TIER_S,
  CRAFT, PRESS, FRUITSTAND, TREES, TREE_IDS, SEED_BAGS, bagId, bagSeeds, buildCraft, placeCraft, craftMake, craftCollect, craftHTML, syncCraft, orchardSpots, orchardProblem, plantOrchard, pickTree, syncOrchard, orchStage, orchRipe, orchardTreeHTML, startTreePlace, orchardLocked, packW, cardOdds, tierOdds, featureOdds, drawNonBasic, collIds, get sunflowerRefund() { return sunflowerRefund; }, ORCHARD_TREE_SPOTS,
  RESALE, sellPlaced, stockAntique, sellRestored, installShelf, uninstallShelf, shelfOn, syncShelf, SHELF_BONUS, STAND_CAP, focusThing, get atmosphere() { return atmosphere(); }, get standCap() { return standCap(); },
  maybeClosing() { closingAfter = 0; maybeClosing(); return !!closingEl; }, closeClosing() { closeClosing(); }, get GOALS() { return GOALS.map((g) => g.id); },
  get state() { return S; }, get selected() { return selected; }, get focus() { return focus; }, get placing() { return placing; }, get panel() { return panel; },
  get customer() { const c = custs[0]; return c && { wants: c.wants, parked: c.car.state === 'park' }; }, get customers() { return custs.map((c) => ({ wants: c.wants, slot: c.slot, parked: c.car.state === 'park', x: c.car.x })); }, get buildMode() { return buildMode; }, W, THREE, TREE_MS,
  giveIrrigation(n = 1) { S.discovered.irrigation = S.unlocked.irrigation = true; S.irrigN += n; save(); if (panel) renderPanel(); }, assignIrrigation, autoIrrigate, get irrigFree() { return irrigFree(); },
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
  nextCustomerIn(ms) { nextCust = now() + ms; }, spawnCustomer, spawnArrival, get park() { return { lv: cardLv('parking'), spots: parkCap(), cars: parkCars(), bays: bayXs(), gapMult: S.parkingBuilt ? PARKING.gapMult[parkI()] : 1 }; }, parkLevelText,
  grant(o) { for (const [k, v] of Object.entries(o)) { if (['coins', 'wood', 'jewels', 'scrap'].includes(k)) S[k] += v; else if (FINDS[k]) S.finds[k] = (S.finds[k] || 0) + v; else S.inv[k] += v; } save(); hud(); if (panel) renderPanel(); },
  tapObstacle, buildBed, enterBuild, exitBuild, selectTile, plant, water, harvest, openPanel, closePanel, buyPack, buy, stock, buyLot,
  buildStand, buildRack, startMarket, finishMarket, restore, recycle, collectLoot, enterPlace, placeAt, dropFor,
  camera(az, pol, zoom, tx, tz) { if (az != null) W.ctl.az = az; if (pol != null) W.ctl.pol = pol; if (zoom != null) W.ctl.zoom = zoom; if (tx != null) { W.ctl.target.set(tx, 0.3, tz); W.ctl.moved = true; } W.ctl.glide = null; W.updateCamera(); },
  Ads, get adsOn() { return Ads.enabled; },
  // v0.4 helpers
  setHeroHold: (ms) => { heroHoldMs = ms; }, grantTincture, get tincCardMigrated() { return tincCardMigrated; }, spawnRoadScrap: () => spawnRoadScrap(), get roadScrap() { return S.roadScrap; }, packIsAllBasic: (ids) => ids.every((id) => cardTier(CARDS[id]) === 'basic'), rollPack: (n) => rollPack(n),
  startBuy, buyCost, cancelPlace: cancelPlacing,
  fillBarrels, truckQuote: () => { const q = truckQuote(); return { need: q.need, can: q.can, lots: q.list.map(([l]) => l) }; }, get truck() { return truck && { state: truck.state, x: truck.x, stopX: truck.stopX }; }, baseOpen, baseNeeds, SUPPLY_CARDS, get basesMigrated() { return basesMigrated; },
  get barrels() { return S.barrels; }, barrelText, totalWater, handSource: (i) => handSource(i)?.lot || null, buildBarrel, unhookIrrigation, BARREL, craftTincture, collectTincture, buildTincture,
  setBarrelCap(n) { BARREL.maxBeds = n; syncBarrels(); }, barrelScreen(lot) { const b = S.barrels[lot]; return W.project(V(b.x, 0.5, b.z)); }, barrelLabel(lot) { const s = W.barrels.get(lot)?.userData.info; return s && { main: s.userData.main, sub: s.userData.sub, visible: s.visible, scale: s.scale.y, opacity: s.material.opacity }; },
  CARDS, FEATURES, zoomCard: (id) => zoomCard(id), cardPool: (r) => Object.keys(CARDS).filter((k) => CARDS[k].rarity === r), cardTier, FEATURE_TIER_FROM_OLD, RARITY, SPECIES, FANTASY_SPECIES, PLANT_TIERS, TIER_ORDER, PACK_W, DRYING, ITEMS, TINCTURE, STILL, drawCard, packOdds: () => ({ total: packTotal(), orchard: !!S.lots.orchard, tiers: Object.fromEntries(TIER_ORDER.map((t) => [t, tierOdds(t)])), features: featureOdds() }), rollSeeds,
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
