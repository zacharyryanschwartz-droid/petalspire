// Petalspire v0.4: world layout (lots, bed sites, obstacles). Deterministic, so saves only store ids.
export const TILE = 1.08;          // tile spacing in a bed
export const BED_N = 3;            // beds are 3x3 plots
export const SITE_HALF = 2.0;      // half-size of a bed footprint used for clearing checks
export const ROAD = { z0: 5.0, z1: 7.8, near: 5.72, far: 7.08 };
export const SPOTS = { market: [-3.35, 3.75], stand: [0.75, 3.95], rack: [3.6, 3.8], barrel: [-1.15, 4.25], tincture: [3.25, 2.4], still: [0, -60], teastand: [0, -80], press: [0, -90], opress: [0, -95], fruitstand: [0, -100], windmill: [0, -70], billboard: [-6.6, 9.3], orchardshed: [305.2, 2.2], obillboard: [293.4, 9.3] };   // v0.68.1: + the Orchard Billboard across the Orchard road
// v0.52: up to 6 bays along the near lane, unlocked in this order as the Parking Lot levels up (2 / 3 / 4 / 6).
// Cars drive in +x, so the occupied bays are always used front (largest x) to back — see bayXs() in main.js.
export const PARK_X = [0.75, -1.75, -4.25, 3.25, -6.75, 5.75];   // v0.41 Parking Lot bays along the near lane (bay 0 = in front of the Farm Stand)   // still: off-map until the player places it (v0.41)

export const LOTS = {
  home:      { name: 'Roadside Lot',   x0: -4.6,  x1: 4.6,  z0: -6.6,  z1: 4.6 },
  west:      { name: 'West Woods',     x0: -13.8, x1: -4.6, z0: -6.6,  z1: 4.6 },
  east:      { name: 'East Woods',     x0: 4.6,   x1: 13.8, z0: -6.6,  z1: 4.6 },
  north:     { name: 'North Woods',    x0: -4.6,  x1: 4.6,  z0: -17.8, z1: -6.6 },
  northwest: { name: 'Hollow Woods',   x0: -13.8, x1: -4.6, z0: -17.8, z1: -6.6 },
  northeast: { name: 'Bramble Woods',  x0: 4.6,   x1: 13.8, z0: -17.8, z1: -6.6 },
  backwoods: { name: 'Back Woods',     x0: -4.6,  x1: 4.6,  z0: -28.6, z1: -17.8 },   // v0.6: the last wooded plot at Home
  // v0.6: The Orchard is its own place on the Map (far from Home, so it reads as a separate scene). Bought on the Map
  // once every Home plot is yours. Sunny open field: 2 raised-bed patches up front, 16 tree spots behind (v0.68: 4×4).
  // v0.68: every Orchard plot is 16 deep (z0 −12, was −10) so it holds a full 4×4 grid of trees; Hilltop Grove moved back 2 m to match
  orchard:   { name: 'The Orchard',    x0: 293,   x1: 307,  z0: -12,   z1: 4, away: true },
  // v0.61: more Orchard land, open meadow (nothing to clear), bought from For Sale signs at the Orchard
  orchwest:  { name: 'Pear Meadow',    x0: 279,   x1: 293,  z0: -12,   z1: 4, away: true },
  orcheast:  { name: 'Plum Hollow',    x0: 307,   x1: 321,  z0: -12,   z1: 4, away: true },
  orchnorth: { name: 'Hilltop Grove',  x0: 293,   x1: 307,  z0: -28,   z1: -12, away: true },
};
export const ORCH_X = 300, ORCH_Z = -3;
export const LOCATIONS = { home: { name: 'Home', target: [-0.3, 0.3, -0.4] }, orchard: { name: 'The Orchard', target: [ORCH_X, 0.3, ORCH_Z - 0.6] } };
export const ORCHARD_PRICE = { coins: 9000, wood: 60 };   // v0.7.2: ×3 coins (was 3000)
// v0.52: the plot directly BEHIND another = the neighbour one row further from the road (the road runs along +z, so
// "behind" is the plot with the same x-range and the next z-range toward −z). The back row has nothing behind it.
export const BEHIND = { home: 'north', west: 'northwest', east: 'northeast', north: 'backwoods' };
export const FRONT = Object.fromEntries(Object.entries(BEHIND).map(([f, b]) => [b, f]));
export const LOT_FOR_SALE = ['west', 'east', 'north', 'northwest', 'northeast', 'backwoods'];   // the Home plots (the Orchard is bought on the Map)
export const LOT_PRICES = [450, 900, 1800, 3000, 4500, 6000];   // v0.7.2: ×3 (was 150 · 300 · 600 · 1000 · 1500 · 2000)
// v0.61: Orchard plots for sale (in this order of price; any order may be bought): coins + Wood, priced above every Home plot
export const ORCH_FOR_SALE = ['orchwest', 'orcheast', 'orchnorth'];
export const ORCH_PLOT_PRICES = [{ coins: 12000, wood: 40 }, { coins: 18000, wood: 60 }, { coins: 27000, wood: 80 }];   // v0.7.2: ×3 coins (was 4000 · 6000 · 9000)
export const ORCH_LOTS = ['orchard', ...ORCH_FOR_SALE];
export const lotLoc = (lot) => (ORCH_LOTS.includes(lot) ? 'orchard' : 'home');
export const OWNABLE_LOTS = [...LOT_FOR_SALE, ...ORCH_LOTS];
export const ORCHARD = 'orchard';
// v0.68: every Orchard plot holds a 4×4 grid of tree spots (16), 4 rows per plot. Keys: 0–15 The Orchard (0–11 are the
// old v0.6 spots, unchanged), 16–31 Pear Meadow, 32–47 Plum Hollow, 48–63 Hilltop Grove. Older saves are re-keyed in
// main.js (migrateOrchGrid) using ORCH_GRID_OLD_TO_NEW below, so every planted tree keeps its plot, row and side.
export const ORCH_GRID = { cols: [-4.5, -1.5, 1.5, 4.5], rows: { orchard: [-3.2, -5.6, -8.0, -10.4], orchwest: [-3.2, -5.6, -8.0, -10.4], orcheast: [-3.2, -5.6, -8.0, -10.4], orchnorth: [-14.0, -16.4, -18.8, -21.2] } };
export const ORCHARD_TREE_SPOTS = [];
for (const lot of ['orchard', 'orchwest', 'orcheast', 'orchnorth']) {
  const cx = (LOTS[lot].x0 + LOTS[lot].x1) / 2;
  for (const z of ORCH_GRID.rows[lot]) for (const dx of ORCH_GRID.cols) ORCHARD_TREE_SPOTS.push({ k: ORCHARD_TREE_SPOTS.length, x: cx + dx, z, lot });
}
// pre-v0.68 layout: The Orchard 3 rows × 4 (keys 0–11), each other plot 2 rows × 3 (12–17, 18–23, 24–29).
// Old side-plot rows sat at z −4.0/−7.4 (Hilltop Grove −12.6/−15.6, before it moved back 2 m) → nearest new rows.
export const ORCH_GRID_OLD_TO_NEW = (k) => {
  k = +k; if (k < 12) return k;
  if (k > 29) return null;
  const L = Math.floor((k - 12) / 6), r = Math.floor((k - 12) % 6 / 3), c = (k - 12) % 3;
  const newRow = L === 2 ? [0, 1][r] : [0, 2][r], newCol = [0, 1, 3][c];
  return 16 + L * 16 + newRow * 4 + newCol;
};
export const ORCH_ROW_OLD_TO_NEW = { 'orchwest:-4': 'orchwest:-3.2', 'orchwest:-7.4': 'orchwest:-8', 'orcheast:-4': 'orcheast:-3.2', 'orcheast:-7.4': 'orcheast:-8', 'orchnorth:-12.6': 'orchnorth:-14', 'orchnorth:-15.6': 'orchnorth:-16.4' };
// anything placed on Hilltop Grove before v0.68 (old bounds) moves back with it
export const ORCH_NORTH_OLD = { x0: 293, x1: 307, z0: -24, z1: -10, dz: -2 };
export const SIGNS = {
  west: [-5.25, -1.7], east: [5.15, -1.9], north: [1.2, -7.4], northwest: [-5.4, -7.4], northeast: [5.4, -7.4], backwoods: [0, -18.4],
  orchwest: [291.4, 3.0], orcheast: [308.6, 3.0], orchnorth: [300, -13.2],
};

export const BARREL_SPOT_HOME = [-1.15, 4.25];
export const lotCenter = (id) => { const l = LOTS[id]; return [(l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2]; };
export function lotAt(x, z) { for (const [id, l] of Object.entries(LOTS)) if (x >= l.x0 && x < l.x1 && z >= l.z0 && z < l.z1) return id; return null; }

// ---- bed sites ----
export const SITES = [];
for (const id of Object.keys(LOTS)) {
  const [cx, cz] = lotCenter(id);
  const xs = id === 'home' ? [-2.15, 2.15] : [cx - 2.3, cx + 2.3];
  const zs = (id === 'home' || id === 'west' || id === 'east') ? [-0.55, -4.5] : id === 'orchard' ? [1.2] : id === 'orchnorth' ? [-25.0] : ORCH_LOTS.includes(id) ? [1.0] : [cz + 2.2, cz - 2.2];
  for (const z of zs) for (const x of (ORCH_LOTS.includes(id) && id !== 'orchard' ? [cx - 3.2, cx + 3.2] : xs)) SITES.push({ id: `${id}-${SITES.filter((s) => s.lot === id).length}`, lot: id, x, z });
}
export const siteById = (id) => SITES.find((s) => s.id === id);

// ---- obstacles ----
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const OBSTACLES = [];
const add = (lot, type, x, z, s) => OBSTACLES.push({ id: `${lot}:${OBSTACLES.filter((o) => o.lot === lot).length}`, lot, type, x, z, s: s ?? 0.85 + rnd() * 0.4, k: Math.floor(rnd() * 1e6) });

// Home lot is hand placed so the first patches clear quickly
[
  // front-left patch
  ['tree', -3.0, -1.30], ['tree', -1.25, 0.25], ['tree', -2.7, 0.65], ['tree', -1.45, -1.50],
  // front-right patch (+ an old stump)
  ['tree', 1.35, -1.25], ['tree', 3.05, 0.05], ['tree', 2.05, 0.75], ['tree', 3.15, -1.65], ['stump', 1.75, -0.30, 1],
  // back patches
  ['tree', -3.1, -3.55], ['tree', -1.3, -3.4], ['tree', -1.45, -5.3], ['tree', -3.2, -5.55], ['bush', -2.3, -4.5, 1],
  ['tree', 1.3, -3.55], ['tree', 3.0, -3.9], ['tree', 2.1, -5.45], ['rock', 3.25, -5.7, 1], ['stump', 1.35, -5.0, 1],
  // between patches & front verge
  ['tree', 0.0, -2.25], ['tree', 0.05, -6.15], ['bush', -0.15, 1.3, 0.9], ['bush', -4.35, -2.2, 0.8], ['rock', 4.15, 1.6, 0.8],
].forEach(([t, x, z, s]) => add('home', t, x, z, s));

for (const id of LOT_FOR_SALE) {
  const l = LOTS[id]; const sg = SIGNS[id];
  for (let x = l.x0 + 1.0; x < l.x1 - 0.6; x += 2.05) for (let z = l.z0 + 1.0; z < l.z1 - 0.6; z += 2.1) {
    const px = x + (rnd() - 0.5) * 1.0, pz = z + (rnd() - 0.5) * 1.0;
    if (Math.hypot(px - sg[0], pz - sg[1]) < 1.3) continue;
    const r = rnd();
    if (r < 0.08) continue;
    add(id, r < 0.82 ? 'tree' : r < 0.91 ? 'bush' : r < 0.96 ? 'rock' : 'stump', px, pz);
  }
}
export const obstacleById = (id) => OBSTACLES.find((o) => o.id === id);
export const inSite = (o, s) => Math.abs(o.x - s.x) < SITE_HALF && Math.abs(o.z - s.z) < SITE_HALF;
