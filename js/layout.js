// Petalspire v0.4: world layout (lots, bed sites, obstacles). Deterministic, so saves only store ids.
export const TILE = 1.08;          // tile spacing in a bed
export const BED_N = 3;            // beds are 3x3 plots
export const SITE_HALF = 2.0;      // half-size of a bed footprint used for clearing checks
export const ROAD = { z0: 5.0, z1: 7.8, near: 5.72, far: 7.08 };
export const SPOTS = { market: [-3.35, 3.75], stand: [0.75, 3.95], rack: [3.6, 3.8], barrel: [-1.15, 4.25], tincture: [3.25, 2.4], still: [0, -60], teastand: [0, -80], press: [0, -90], fruitstand: [0, -100], windmill: [0, -70], billboard: [-6.6, 9.3], orchardshed: [305.2, 2.2] };
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
  // once every Home plot is yours. Sunny open field: 2 raised-bed patches up front, 12 tree spots behind.
  orchard:   { name: 'The Orchard',    x0: 293,   x1: 307,  z0: -10,   z1: 4, away: true },
};
export const ORCH_X = 300, ORCH_Z = -3;
export const LOCATIONS = { home: { name: 'Home', target: [-0.3, 0.3, -0.4] }, orchard: { name: 'The Orchard', target: [ORCH_X, 0.3, ORCH_Z - 0.6] } };
export const ORCHARD_PRICE = { coins: 3000, wood: 60 };
// v0.52: the plot directly BEHIND another = the neighbour one row further from the road (the road runs along +z, so
// "behind" is the plot with the same x-range and the next z-range toward −z). The back row has nothing behind it.
export const BEHIND = { home: 'north', west: 'northwest', east: 'northeast', north: 'backwoods' };
export const FRONT = Object.fromEntries(Object.entries(BEHIND).map(([f, b]) => [b, f]));
export const LOT_FOR_SALE = ['west', 'east', 'north', 'northwest', 'northeast', 'backwoods'];   // the Home plots (the Orchard is bought on the Map)
export const LOT_PRICES = [150, 300, 600, 1000, 1500, 2000];
export const OWNABLE_LOTS = [...LOT_FOR_SALE, 'orchard'];
export const ORCHARD = 'orchard';
// 12 tree spots in the back of the Orchard (the front row keeps 2 raised-bed patches)
export const ORCHARD_TREE_SPOTS = [];
for (const z of [-3.2, -5.6, -8.0]) for (const x of [-4.5, -1.5, 1.5, 4.5]) ORCHARD_TREE_SPOTS.push({ k: ORCHARD_TREE_SPOTS.length, x: ORCH_X + x, z });
export const SIGNS = {
  west: [-5.25, -1.7], east: [5.15, -1.9], north: [1.2, -7.4], northwest: [-5.4, -7.4], northeast: [5.4, -7.4], backwoods: [0, -18.4],
};

export const BARREL_SPOT_HOME = [-1.15, 4.25];
export const lotCenter = (id) => { const l = LOTS[id]; return [(l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2]; };
export function lotAt(x, z) { for (const [id, l] of Object.entries(LOTS)) if (x >= l.x0 && x < l.x1 && z >= l.z0 && z < l.z1) return id; return null; }

// ---- bed sites ----
export const SITES = [];
for (const id of Object.keys(LOTS)) {
  const [cx, cz] = lotCenter(id);
  const xs = id === 'home' ? [-2.15, 2.15] : [cx - 2.3, cx + 2.3];
  const zs = (id === 'home' || id === 'west' || id === 'east') ? [-0.55, -4.5] : id === 'orchard' ? [1.2] : [cz + 2.2, cz - 2.2];
  for (const z of zs) for (const x of xs) SITES.push({ id: `${id}-${SITES.filter((s) => s.lot === id).length}`, lot: id, x, z });
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
