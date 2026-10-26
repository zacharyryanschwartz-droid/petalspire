// Petalspire v0.4 — game data
// v0.4: REAL PLANTS ONLY. Each species is one self-contained entry, so the full plant catalog can be added later.
// v0.5 PLANT TIERS — the full catalog: 21 plants, 3 per tier. Lowest → highest (the user's order). Each higher tier has
// lower pack odds, a longer grow time, a higher seed cost and a higher sell price. Basic keeps the v0.4 numbers exactly.
//   pack: % chance that ONE pack card is a plant of this tier (split between its 3 plants by packShare; features keep their v0.41 odds)
//   glow: 0 = none, 1 = soft (Rare+), 2 = Ultra Rare shimmer, 3 = Other World (strongest glow + floating motes)
//   seeds: [min, max] seeds per harvest; bonus: chance of +1 seed (Other World: 1, sometimes 2)
//   color: tier label / card frame colour (brand palette)
export const PLANT_TIERS = {
  basic:      { label: 'Basic',       order: 1, pack: 40,  glow: 0, seeds: [5, 5], color: '#5E825F' },
  epic:       { label: 'Epic',        order: 2, pack: 8,   glow: 0, seeds: [4, 5], color: '#B07A1E' },
  legendary:  { label: 'Legendary',   order: 3, pack: 4.5, glow: 0, seeds: [4, 4], color: '#9A6A12' },
  rare:       { label: 'Rare',        order: 4, pack: 3,   glow: 1, seeds: [3, 4], color: '#4F8597' },
  superrare:  { label: 'Super Rare',  order: 5, pack: 1.8, glow: 1, seeds: [2, 3], color: '#3D5A40' },
  ultra:      { label: 'Ultra Rare',  order: 6, pack: 0.8, glow: 2, seeds: [2, 2], color: '#8A5FB8' },
  otherworld: { label: 'Other World', order: 7, pack: 0.4, glow: 3, seeds: [1, 1], bonus: 0.25, color: '#6C7FD0' },
};
export const TIER_ORDER = Object.keys(PLANT_TIERS).sort((a, b) => PLANT_TIERS[a].order - PLANT_TIERS[b].order);
// Seeds from one harvest, by the plant's tier rule (Basic 5 · Epic 4–5 · Legendary 4 · Rare 3–4 · Super Rare 2–3 · Ultra Rare 2 · Other World 1, 25% → 2).
export function rollSeeds(tier, rnd = Math.random) {
  const t = PLANT_TIERS[tier] || PLANT_TIERS.basic; const [a, b] = t.seeds;
  return a + Math.floor(rnd() * (b - a + 1)) + (t.bonus && rnd() < t.bonus ? 1 : 0);
}
// Fields: tier (key of PLANT_TIERS), rarity (card frame = the tier), growS, seedPrice, flowerSell, seedSell, yieldF [min, max] flowers
// (seeds come from the tier), color, icon (bag/stand icon kind), img, stats, blurb, packShare (share of the tier's pack odds),
// uses (shown on the card): dries / tincture / oil (see DRYING, TINCTURE.recipes, STILL.recipes).
const P = (id, tier, name, type, [growS, seedPrice, flowerSell, yieldF], color, icon, stats, blurb, extra = {}) =>
  ({ id, tier, rarity: tier, name, type, growS, seedPrice, flowerSell, seedSell: Math.round(seedPrice / 2), yieldF, color, icon, img: `assets/card-${id}.jpg`, stats, blurb, ...extra });
const st = (Growth, Beauty, Yield, Atmosphere) => ({ Growth, Beauty, Yield, Atmosphere });
export const SPECIES = {
  // ---- Basic (unchanged from v0.4) ----
  lavender: { id: 'lavender', tier: 'basic', name: 'Lavender', rarity: 'basic', type: 'Plant · Aromatic herb',
    growS: 35, seedPrice: 6, flowerSell: 5, seedSell: 3, yieldF: [2, 3], color: '#9C86C9', icon: 'spike', img: 'assets/card-lavender.jpg', dries: true, packShare: 0.7,
    stats: st(4, 3, 4, 4), blurb: 'Silvery leaves and slender purple flower spikes. Smells wonderful and dries beautifully on the rack.' },
  calendula: { id: 'calendula', tier: 'basic', name: 'Calendula', rarity: 'basic', type: 'Plant · Pot marigold',
    growS: 50, seedPrice: 10, flowerSell: 9, seedSell: 5, yieldF: [2, 3], color: '#F0A33A', icon: 'daisy', img: 'assets/card-calendula.jpg', packShare: 0.2,
    stats: st(3, 4, 3, 3), blurb: 'Cheerful orange-gold, daisy-like blooms. A classic for soothing glycerites and salves.' },
  chamomile: { id: 'chamomile', tier: 'basic', name: 'Chamomile', rarity: 'basic', type: 'Plant · Tea herb',
    growS: 80, seedPrice: 18, flowerSell: 24, seedSell: 9, yieldF: [1, 2], color: '#FFFFFF', icon: 'daisy', img: 'assets/card-chamomile.jpg', packShare: 0.1,
    stats: st(2, 4, 2, 5), blurb: 'Tiny white daisies with sunny yellow centres and feathery leaves. Prized for calming tea.' },
  // ---- Epic ----
  peppermint: P('peppermint', 'epic', 'Peppermint', 'Plant · Cooling mint', [100, 24, 28, [2, 3]], '#8FC48A', 'leaf', st(4, 3, 4, 4),
    'Bright, square-stemmed mint with serrated leaves and lilac flower spikes. Dries into tea, steeps into tinctures, distils into a cool oil.', { dries: true }),
  echinacea: P('echinacea', 'epic', 'Echinacea', 'Plant · Purple coneflower', [115, 27, 32, [2, 3]], '#D77FB0', 'cone', st(3, 5, 3, 3),
    'Tall coneflowers with drooping pink-magenta petals around a spiky copper cone. A favourite immune-support tincture.'),
  lemonbalm: P('lemonbalm', 'epic', 'Lemon Balm', 'Plant · Lemon-scented herb', [105, 25, 30, [2, 3]], '#B9DB7C', 'leaf', st(4, 3, 4, 4),
    'A soft mound of crinkled, lemon-scented leaves. Calming in tea and glycerites; dries well.', { dries: true }),
  // ---- Legendary ----
  rosemary: P('rosemary', 'legendary', 'Rosemary', 'Plant · Woody herb', [145, 38, 46, [2, 3]], '#6E8F86', 'leaf', st(3, 3, 4, 4),
    'Upright woody sprigs of needle-like leaves dotted with pale blue flowers. Dries, steeps and distils beautifully.', { dries: true }),
  yarrow: P('yarrow', 'legendary', 'Yarrow', 'Plant · Meadow herb', [150, 40, 48, [2, 3]], '#F2BFC6', 'umbel', st(3, 4, 4, 3),
    'Feathery leaves under flat clusters of tiny blush flowers. A classic dried herb and tincture.', { dries: true }),
  sunflower: P('sunflower', 'legendary', 'Sunflower', 'Plant · Golden giant', [165, 44, 54, [2, 3]], '#F5C542', 'daisy', st(3, 5, 4, 4),
    'A tall, cheerful giant with a honey-gold face and a dark seed disc. Sells well fresh — customers love it.'),
  // ---- Rare (soft glow) ----
  damaskrose: P('damaskrose', 'rare', 'Damask Rose', 'Plant · Old rose', [205, 68, 84, [2, 3]], '#F2A7B8', 'bloom', st(2, 5, 3, 5),
    'The perfumer’s rose: full, fragrant blush blooms. Its seeds distil into precious rose otto oil.'),
  tulsi: P('tulsi', 'rare', 'Holy Basil', 'Plant · Tulsi', [190, 62, 78, [2, 3]], '#A884C2', 'spike', st(3, 4, 4, 4),
    'Sacred tulsi: purple-tinged leaves and mauve flower spikes. Dries into a fragrant tea and makes a prized tincture.', { dries: true }),
  elderflower: P('elderflower', 'rare', 'Elderflower', 'Plant · Elder shrub', [200, 65, 80, [2, 3]], '#F6F1DC', 'umbel', st(2, 4, 4, 5),
    'Lacy, creamy-white umbels on a young elder. Dried for tea, steeped into a sweet glycerite.', { dries: true }),
  // ---- Super Rare (soft glow) ----
  saffron: P('saffron', 'superrare', 'Saffron Crocus', 'Plant · Autumn crocus', [260, 100, 140, [2, 2]], '#B79AE0', 'bloom', st(2, 5, 2, 4),
    'Lilac crocus cups with three vivid red threads — the world’s most precious spice. Sells for a fortune.'),
  bluelotus: P('bluelotus', 'superrare', 'Blue Lotus', 'Plant · Water lily', [275, 110, 150, [2, 2]], '#8FB8E8', 'bloom', st(2, 5, 2, 5),
    'Star-shaped sky-blue water lilies with golden hearts, floating over round pads.'),
  jasmine: P('jasmine', 'superrare', 'Jasmine', 'Plant · Night-scented vine', [285, 118, 158, [2, 2]], '#FFFDF6', 'star', st(2, 5, 2, 5),
    'A twining vine of starry white flowers with blush buds. Its seeds distil into a heady jasmine oil.'),
  // ---- Ultra Rare (real but famously rare; shimmering glow) ----
  ghostorchid: P('ghostorchid', 'ultra', 'Ghost Orchid', 'Plant · Leafless orchid', [350, 170, 245, [2, 2]], '#F4F7F2', 'bloom', st(1, 5, 2, 5),
    'A leafless orchid of the swamps: one pale, floating bloom with long curling tails, hanging from a tangle of roots.'),
  jadevine: P('jadevine', 'ultra', 'Jade Vine', 'Plant · Rainforest vine', [365, 180, 260, [2, 2]], '#5FD3B8', 'claw', st(1, 5, 2, 5),
    'Cascades of claw-shaped flowers in an impossible luminous jade-turquoise.'),
  middlemist: P('middlemist', 'ultra', 'Middlemist Red', 'Plant · Rare camellia', [380, 190, 275, [2, 2]], '#E0607A', 'bloom', st(1, 5, 2, 5),
    'Perhaps the rarest flower on Earth: lush, fully double rose-pink camellia blooms on glossy dark leaves.'),
  // ---- Other World (fantasy; glows the most) ----
  moonflower: P('moonflower', 'otherworld', 'Moonflower', 'Plant · Night-bloom', [460, 280, 440, [2, 2]], '#FFF6E6', 'moon', st(1, 5, 2, 5),
    'A white trumpet bloom that glows softly, as if holding a little moonlight. Motes of light drift around it.'),
  crystalrose: P('crystalrose', 'otherworld', 'Crystal Rose', 'Plant · Crystal bloom', [480, 300, 480, [2, 2]], '#C9D6F5', 'bloom', st(1, 5, 2, 5),
    'A rose of translucent, faceted crystal petals that catch and hold the light.'),
  sunpetal: P('sunpetal', 'otherworld', 'Spiral Sunpetal', 'Plant · Golden spire', [500, 320, 520, [2, 2]], '#F5D07A', 'sun', st(1, 5, 2, 5),
    'Golden petals unfurl in a perfect spiral, glowing like the last of the evening light.'),
};
// v0.4 kept the fantasy plants disabled; v0.5 brings Moonflower and Spiral Sunpetal back as the Other World tier (with Crystal Rose).
// Heartvine stays disabled (not in CARDS, packs or the Market).
export const FANTASY_SPECIES = {
  heartvine: {
    id: 'heartvine', tier: 'ultra', name: 'Heartvine', rarity: 'ultra', enabled: false, type: 'Plant · Climbing vine',
    growS: 35, seedPrice: 6, flowerSell: 5, seedSell: 3, yieldF: [2, 3],
    color: '#F7C5C5', img: 'assets/card-heartvine.jpg',
    stats: { Growth: 4, Beauty: 3, Yield: 4, Atmosphere: 2 },
    blurb: 'Blush, heart-shaped leaves on a twisting vine. Dries beautifully on the rack.',
  },
};
// Pack weight (in % of one card slot) for every plant: tier pack odds × the plant's share (equal shares unless set).
for (const t of Object.keys(PLANT_TIERS)) { const ps = Object.values(SPECIES).filter((s) => s.tier === t);
  for (const s of ps) s.packW = PLANT_TIERS[t].pack * (s.packShare ?? 1 / ps.length); }

export const FEATURES = {
  rainbarrel: {
    id: 'rainbarrel', name: 'Rain Barrel', rarity: 'basic', type: 'Feature · Water',
    stats: { Growth: 3, Beauty: 2, Yield: 3, Atmosphere: 3 },
    blurb: 'Unlocks the Rain Barrel at the Supply Market (40 coins): place it in a plot you bought to give that plot its own water — 1 a minute, up to 10, feeding up to 4 irrigated beds.',
  },
  beehive: {
    id: 'beehive', name: 'Honeybee Skep', rarity: 'legendary', type: 'Feature · Pollinators',
    price: 60, stats: { Growth: 3, Beauty: 3, Yield: 5, Atmosphere: 4 },
    blurb: 'Once bought, busy bees add +1 flower to every harvest.',
  },
  irrigation: {
    id: 'irrigation', name: 'Irrigation', rarity: 'basic', type: 'Feature · Water',
    price: 45, stats: { Growth: 4, Beauty: 2, Yield: 3, Atmosphere: 2 },
    blurb: 'Assign it to one raised bed: a drip line from the rain barrel waters that bed’s thirsty plants for you (1 water each). Each card covers one bed.',
  },
  tincture: {
    id: 'tincture', name: 'Tincture Stand', rarity: 'epic', type: 'Feature · Crafting', img: 'assets/card-tincture.jpg',
    price: 120, stats: { Growth: 1, Beauty: 4, Yield: 5, Atmosphere: 4 },
    blurb: 'A little wooden stall of glass bottles. Find it, buy it at the Supply Market, then build it: steep your blooms in Glycerin or Vinegar into tinctures that sell for far more.',
  },
  still: {
    id: 'still', name: 'Essential Oil Stand', rarity: 'epic', type: 'Feature · Crafting', img: 'assets/card-still.jpg',
    price: 150, stats: { Growth: 1, Beauty: 4, Yield: 5, Atmosphere: 5 },
    blurb: 'A little stall with gleaming copper stills. Find it, buy it at the Supply Market, build it on one of your other plots, then distill your seeds into essential oils that sell for a premium.',
  },
  sickle: {
    id: 'sickle', name: 'Harvest Sickle', rarity: 'epic', type: 'Tool · Harvest',
    price: 80, stats: { Growth: 1, Beauty: 2, Yield: 4, Atmosphere: 2 }, cooldownS: 8,
    blurb: 'Harvest a whole raised bed at once. Tap the Sickle, then a raised bed: every ripe plant in that bed is harvested in one sweep (normal yields and seeds). Rests 8 s between sweeps.',
  },
  plow: {
    id: 'plow', name: 'Hand Plow', rarity: 'epic', type: 'Tool · Planting',
    price: 90, stats: { Growth: 3, Beauty: 1, Yield: 3, Atmosphere: 2 }, cooldownS: 8,
    blurb: 'Plant a whole raised bed at once. Tap the Plow, pick a seed, then a raised bed: every empty tile in that bed is planted, as far as your seeds go. Rests 8 s between uses.',
  },
  parking: {
    id: 'parking', name: 'Parking Lot', rarity: 'legendary', type: 'Feature · Traffic',
    price: 140, stats: { Growth: 1, Beauty: 2, Yield: 5, Atmosphere: 3 },
    blurb: 'Painted bays by your Farm Stand: room for 2 cars at once (3 at card Lv2+), customers come 30% more often, and 30% of them pick up one extra item. Build it next to the stand for 20 Wood.',
  },
  windmill: {
    id: 'windmill', name: 'Windmill', rarity: 'legendary', type: 'Feature · Water',
    price: 160, stats: { Growth: 3, Beauty: 4, Yield: 3, Atmosphere: 4 },
    blurb: 'Pumps for every rain barrel on your land: connected barrels refill every 40 s instead of 60 s (faster with card levels, and it stacks with the Brass Watering Can). Build it once anywhere on your cleared ground for 20 Wood.',
  },
  billboard: {
    id: 'billboard', name: 'Roadside Billboard', rarity: 'epic', type: 'Feature · Advertising',
    price: 90, stats: { Growth: 1, Beauty: 3, Yield: 4, Atmosphere: 2 },
    blurb: 'A painted sign across the road. Tap it to Run ad: twice the traffic for 5 minutes. Free once an hour, or 1 Jewel to run it now. Build it by the road for 15 Wood.',
  },
  sundial: {
    id: 'sundial', name: 'Golden Sundial', rarity: 'rare', type: 'Feature · Time',
    price: 90, stats: { Growth: 5, Beauty: 4, Yield: 3, Atmosphere: 5 },
    blurb: 'Once bought, every plant you water grows 25% faster.',
  },
};

export const CARDS = { ...SPECIES, ...FEATURES };

export const RARITY = {
  common:    { label: 'Common',    w: 46, color: '#8DB78A' },
  uncommon:  { label: 'Uncommon',  w: 30, color: '#EDA3A8' },
  rare:      { label: 'Rare',      w: 15, color: '#7FB3C6' },
  epic:      { label: 'Epic',      w: 7,  color: '#E2B653' },
  legendary: { label: 'Legendary', w: 2,  color: '#D9A93F' },
  ultra:     { label: 'Ultra Rare', w: 0,  color: '#B48AD8' },
  basic:      { label: 'Basic',       w: 0, color: '#8DB78A' },
  superrare:  { label: 'Super Rare',  w: 0, color: '#3D5A40' },
  otherworld: { label: 'Other World', w: 0, color: '#8C9BE0' },
};
// v0.51: every card (plant or feature) is framed and labelled by its tier, so a tier name means the same thing everywhere.
for (const t of Object.keys(PLANT_TIERS)) RARITY[t] = { ...RARITY[t], label: PLANT_TIERS[t].label, color: PLANT_TIERS[t].color };
export const cardTier = (c) => c.tier || c.rarity;
// v0.5 pack odds: every card has a weight in % of one pack slot. Features keep exactly their v0.41 odds (rarity weight split
// over that v0.41 rarity pool): Uncommon 10% each, Rare 2.5% each, Epic 2.33% each, Legendary 2%. Plants get the rest (58.5%)
// through PLANT_TIERS[].pack. Total = 100%.
// v0.51: feature cards use the plant tier names too (one tier system everywhere). Old feature ranks map in order, keeping
// each card's rank and exact per-card odds: Uncommon → Basic (10% each), Rare → Epic (2.5%), Epic → Legendary (2.33%), Legendary → Rare (2%).
export const FEATURE_TIER_FROM_OLD = { common: 'basic', uncommon: 'basic', rare: 'epic', epic: 'legendary', legendary: 'rare' };
export const FEATURE_PACK_W = { basic: 10, epic: 2.5, legendary: 7 / 3, rare: 2 };
for (const f of Object.values(FEATURES)) f.packW = FEATURE_PACK_W[f.rarity] ?? 0;
export const PACK_W = Object.fromEntries(Object.entries(CARDS).map(([k, c]) => [k, c.packW || 0]));

// v0.4 CARD STACKS & UPGRADES (placeholder numbers). Every copy of a card you find stacks on one card (×n).
// Copies are kept as progress (never consumed): at 3 / 6 / 10 copies the card can be upgraded to Lv2 / Lv3 / Lv4 with a tap.
// Plant levels: +10% sell price and -5% grow time per level above 1, +1 Beauty/Yield pip per level, and +1 flower per harvest at Lv4.
// Seeds per harvest always follow the plant's tier rule (PLANT_TIERS) — levels never change them.
// Tool levels (Sickle, Plow): -15% rest time per level. Irrigation: every copy is one more card (= one more irrigated bed).
export const CARD_LEVELS = {
  thresholds: [3, 6, 10],          // copies needed for Lv2, Lv3, Lv4 (max)
  plant: { sell: 0.10, grow: 0.05, statPip: 1, bonusFlowerAt: 4 },
  tool: { cooldown: 0.15 },
  upgradable: (id, card) => !!card.tier || id === 'sickle' || id === 'plow' || id === 'parking' || id === 'windmill',
  parking: { capAt: 2, extraItem: 0.10 },   // v0.41: Lv2+ fits 3 cars; each level adds +10% extra-item chance
};
// v0.41: Card Packs cost Jewels, not coins (1 Jewel = one standard pack). Add more pack types here (e.g. a premium pack at 3 Jewels).
export const PACKS = { standard: { name: 'Botanical Card Pack', jewels: 1, cards: 3 } };
export const PACK_JEWELS = PACKS.standard.jewels;
// v0.41: Jewel trades in the Jewel Shop, and the rare free Jewel hidden in the woods (so free players can still open packs now and then).
export const JEWEL_EXCHANGE = { coins: 1000, wood: 250 };
export const JEWEL_DROP = { clear: 0.04 };   // chance that clearing a tree, stump, bush or rock (without a find) turns up 1 Jewel
export const DUP_COINS = 8;
export const RACK_SLOTS = 3;
export const DRY_S = 40;

// ---------- v0.4: one rain barrel per plot ----------
// Each owned plot gets ONE barrel (the home lot's arrives with your first bed; other plots: Build → Rain Barrel).
// A barrel feeds at most maxBeds irrigated beds, and only beds in its own plot.
export const BARREL = { price: 40, maxBeds: 4 };   // v0.4: bought at the Supply Market as a placeable barrel (water itself is never sold)

// ---------- v0.4: Tincture Stand ----------
// Bases are bought at the Supply Market. Every craft uses 1 base (Glycerin OR Vinegar) + flowers.
export const BASES = {
  glycerin: { name: 'Glycerin', price: 8, pack: { n: 5, price: 32 }, color: '#F3E7B5', blurb: 'Sweet, gentle base · makes Glycerites' },
  vinegar:  { name: 'Vinegar',  price: 6, pack: { n: 5, price: 24 }, color: '#E3BF8C', blurb: 'Tangy base · makes Vinegar Tinctures' },
};
export const TINCTURE = {
  slots: 2,
  recipes: {   // flowers per craft, steep time (s), sale price by base
    lavender:  { n: 2, s: 90,  sell: { glycerin: 42, vinegar: 36 } },
    calendula:   { n: 2, s: 120, sell: { glycerin: 52, vinegar: 46 } },
    chamomile: { n: 1, s: 150, sell: { glycerin: 80, vinegar: 72 } },
    // v0.5 (botanically plausible herbal tinctures / glycerites)
    peppermint:  { n: 2, s: 150, sell: { glycerin: 130, vinegar: 118 } },
    echinacea:   { n: 2, s: 160, sell: { glycerin: 142, vinegar: 128 } },
    lemonbalm:   { n: 2, s: 150, sell: { glycerin: 134, vinegar: 122 } },
    rosemary:    { n: 2, s: 180, sell: { glycerin: 200, vinegar: 182 } },
    yarrow:      { n: 2, s: 180, sell: { glycerin: 210, vinegar: 190 } },
    tulsi:       { n: 1, s: 210, sell: { glycerin: 175, vinegar: 160 } },
    elderflower: { n: 1, s: 210, sell: { glycerin: 182, vinegar: 166 } },
  },
};
// v0.41 Essential Oil Stand: SEEDS only in, oil out. Each oil is worth well over selling those seeds (or buying them new).
export const STILL = {
  slots: 2,
  recipes: {   // seeds per distill, time (s), Farm Stand price
    lavender:  { n: 5, s: 180, sell: 70 },
    calendula: { n: 4, s: 210, sell: 95 },
    chamomile: { n: 3, s: 240, sell: 120 },
    // v0.5: peppermint, rosemary, rose otto and jasmine oils
    peppermint: { n: 4, s: 240, sell: 150 },
    rosemary:   { n: 4, s: 270, sell: 250 },
    damaskrose: { n: 3, s: 300, sell: 330 },
    jasmine:    { n: 2, s: 360, sell: 420 },
  },
};
// v0.5 Drying Rack: which flowers dry, how long (s) and what the dried bundle sells for (Lavender is unchanged: 40 s, 14).
export const DRYING = {
  lavender:    { s: 40, sell: 14 },
  peppermint:  { s: 60, sell: 70 },
  lemonbalm:   { s: 60, sell: 74 },
  rosemary:    { s: 75, sell: 112 },
  yarrow:      { s: 75, sell: 118 },
  tulsi:       { s: 90, sell: 190 },
  elderflower: { s: 90, sell: 196 },
};
export const oilId = (sp) => 'oil_' + sp;
export const tinctureId = (sp, base) => `tinc_${base === 'vinegar' ? 'v' : 'g'}_${sp}`;
export const TINCTURE_NAMES = Object.fromEntries(Object.values(SPECIES).map((s) => [s.id, s.name]));

// Bag / stand items. v0.5: generated for every plant (seeds, fresh flowers, dried bundles, tinctures, oils); the
// v0.4 Basic items keep their exact names, prices and icons.
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };
export const ITEMS = {};
for (const sp of Object.values(SPECIES)) {
  ITEMS['seed_' + sp.id] = { name: `${sp.name} Seeds`, sell: sp.seedSell, icon: ['seed', sp.color] };
  ITEMS['flower_' + sp.id] = { name: sp.name, sell: sp.flowerSell, icon: [sp.icon || 'daisy', sp.color] };
  if (DRYING[sp.id]) ITEMS['dried_' + sp.id] = { name: `Dried ${sp.name}`, sell: DRYING[sp.id].sell, icon: ['bundle', shade(sp.color, 0.92)] };
  if (STILL.recipes[sp.id]) ITEMS[oilId(sp.id)] = { name: `${sp.name} Essential Oil`, sell: STILL.recipes[sp.id].sell, icon: ['dropper', shade(sp.color, 0.75)] };
  const tr = TINCTURE.recipes[sp.id];
  if (tr) { ITEMS[tinctureId(sp.id, 'glycerin')] = { name: `${sp.name} Glycerite`, sell: tr.sell.glycerin, icon: ['dropper', shade(sp.color, 1.05)] };
    ITEMS[tinctureId(sp.id, 'vinegar')] = { name: `${sp.name} Vinegar Tincture`, sell: tr.sell.vinegar, icon: ['dropper', shade(sp.color, 0.7)] }; }
}
// v0.4 originals (exact icons and colours kept)
Object.assign(ITEMS, {
  seed_lavender:  { name: 'Lavender Seeds',  sell: 3,  icon: ['seed', '#B9A6DC'] },
  seed_calendula:   { name: 'Calendula Seeds',   sell: 5,  icon: ['seed', '#F0A33A'] },
  seed_chamomile: { name: 'Chamomile Seeds', sell: 9,  icon: ['seed', '#F3EFC9'] },
  flower_lavender:{ name: 'Lavender',        sell: 5,  icon: ['spike', '#9C86C9'] },
  flower_calendula: { name: 'Calendula',  sell: 9,  icon: ['daisy', '#F0A33A'] },
  flower_chamomile:{ name: 'Chamomile',      sell: 24, icon: ['daisy', '#FFFFFF'] },
  dried_lavender: { name: 'Dried Lavender',  sell: 14, icon: ['bundle', '#A58BC9'] },
  oil_lavender:  { name: 'Lavender Essential Oil',  sell: 70,  icon: ['dropper', '#7E5FB0'] },
  oil_calendula: { name: 'Calendula Essential Oil', sell: 95,  icon: ['dropper', '#D9822B'] },
  oil_chamomile: { name: 'Chamomile Essential Oil', sell: 120, icon: ['dropper', '#C9A43A'] },
  tinc_g_lavender:  { name: 'Lavender Glycerite',         sell: 42, icon: ['dropper', '#C7B3E6'] },
  tinc_v_lavender:  { name: 'Lavender Vinegar Tincture',  sell: 36, icon: ['dropper', '#9A7A9A'] },
  tinc_g_calendula:   { name: 'Calendula Glycerite',          sell: 52, icon: ['dropper', '#EDC15A'] },
  tinc_v_calendula:   { name: 'Calendula Vinegar Tincture',   sell: 46, icon: ['dropper', '#C08A3A'] },
  tinc_g_chamomile: { name: 'Chamomile Glycerite',        sell: 80, icon: ['dropper', '#F3E7B5'] },
  tinc_v_chamomile: { name: 'Chamomile Vinegar Tincture', sell: 72, icon: ['dropper', '#D2B67A'] },
});
// Most valuable first (oils, tinctures, dried, flowers, seeds) — the same order as v0.4 for the Basic items.
const kindRank = (id) => ['oil_', 'tinc_', 'dried_', 'flower_', 'seed_'].findIndex((p) => id.startsWith(p));
export const SELL_ORDER = Object.keys(ITEMS).sort((a, b) => kindRank(a) - kindRank(b) || ITEMS[b].sell - ITEMS[a].sell || (a.startsWith('tinc_g') ? -1 : 1));

export const WOOD = { tree: 3, stump: 1, bush: 0, rock: 0 };
export const BED_COSTS = [12, 20, 28, 36, 44, 52];   // wood per raised bed, escalating
export const STAND_CAP = 12;
export const MARKET_GOAL = 100;                        // coins earned at the stand to unlock the Rebuild Market project
export const WATER_REGEN_S = 60, WATER_REGEN_MAX = 10; // rain barrel by the stand: +1 water per minute (v0.31), offline too
export const STARTER = { seed_lavender: 4, seed_calendula: 3 }, STARTER_FILL = 10;   // v0.4: no bag water — the starter pack fills the home barrel instead
export const STARTER_JEWELS = 3;

// ---------- v0.3: things you build ----------
export const BUILDS = {
  stand:  { name: 'Roadside Farm Stand', wood: 15, coins: 0, opt: { find: 'old_crate', label: 'Use an Old Crate as a display shelf (+4 shelf space)' } },
  rack:   { name: 'Drying Rack', wood: 10, coins: 0 },
  still: { name: 'Essential Oil Stand', wood: 25, coins: 0 },
  parking: { name: 'Parking Lot', wood: 20, coins: 0 },
  windmill: { name: 'Windmill', wood: 20, coins: 0 },
  billboard: { name: 'Roadside Billboard', wood: 15, coins: 0 },
  tincture: { name: 'Tincture Stand', wood: 20, coins: 0, opt: { decor: 'chime', save: 6, label: 'Use your restored Glass Bottles (Bottle Chime) for the shelves (−6 Wood)' } },
  market: { name: 'Rebuild the Supply Market', wood: 30, coins: 60, s: 60, opt: { scrap: 3, save: 20, label: 'Patch the roof with 3 Scrap (save 20 coins)' }, hurryJewels: 2 },
};
export const BUILD_ANIM_MS = 2450;

// ---------- v0.3: found items (seeded ~22% of trees, stumps, bushes and rocks hide one) ----------
export const FIND_CHANCE = 0.22, SAPLING_CHANCE = 0.12;   // sapling chance applies to wild trees only
export const FINDS = {
  watering_can: { name: 'Rusty Watering Can', restore: { wood: 2, coins: 5, s: 30 }, recycle: { scrap: 2 },
    into: { name: 'Brass Watering Can', bonus: 'can', blurb: 'Every rain barrel refills twice as fast (1 water / 30 s) and holds 15' } },
  wheelbarrow:  { name: 'Old Wheelbarrow', restore: { wood: 6, coins: 8, s: 45 }, recycle: { wood: 3, scrap: 1 },
    into: { name: 'Trusty Wheelbarrow', bonus: 'barrow', blurb: '+1 Wood from every tree you chop' } },
  old_crate:    { name: 'Old Crate', restore: { wood: 2, coins: 0, s: 20 }, recycle: { wood: 3 },
    into: { name: 'Crate Shelf', bonus: 'crate', blurb: '+4 shelf space on your Farm Stand' } },
  flower_pot:   { name: 'Cracked Flower Pot', restore: { wood: 0, coins: 4, s: 20 }, recycle: { coins: 3 },
    into: { name: 'Blooming Planter', decor: 'planter', atm: 1 } },
  lantern:      { name: 'Broken Lantern', restore: { wood: 1, coins: 6, scrap: 1, s: 30 }, recycle: { scrap: 1, coins: 2 },
    into: { name: 'Garden Lantern', decor: 'lantern', atm: 2 } },
  bench:        { name: 'Weathered Bench', restore: { wood: 5, coins: 4, s: 45 }, recycle: { wood: 5 },
    into: { name: 'Garden Bench', decor: 'bench', atm: 3 } },
  gnome:        { name: 'Old Garden Gnome', restore: { wood: 0, coins: 6, s: 25 }, recycle: { coins: 4 },
    into: { name: 'Garden Gnome', decor: 'gnome', atm: 2 } },
  fencing:      { name: 'Tangled Wire Fencing', restore: { wood: 3, coins: 0, s: 30 }, recycle: { scrap: 3 },
    into: { name: 'Rose Trellis', decor: 'trellis', atm: 2 } },
  bottles:      { name: 'Glass Bottles', restore: { wood: 1, coins: 2, s: 20 }, recycle: { coins: 4 },
    into: { name: 'Bottle Chime', decor: 'chime', atm: 2 } },
  scrap_metal:  { name: 'Scrap Metal', restore: { wood: 2, coins: 5, s: 35 }, recycle: { scrap: 4 },
    into: { name: 'Copper Weathervane', decor: 'vane', atm: 2 } },
};
export const FIND_IDS = Object.keys(FINDS);
// v0.41 RESALE. Restored finds can go on the Farm Stand as antiques (a collector pays the antique price, well above the restore cost),
// or be sold back instantly (Bag, or tap a placed item → Sell) for RESALE.buyback of their value. Placed garden items sell back the same way.
export const RESALE = {
  buyback: 0.5,
  antique: { flower_pot: 18, lantern: 26, bench: 34, gnome: 24, fencing: 20, bottles: 16, scrap_metal: 28, watering_can: 40, wheelbarrow: 45, old_crate: 15 },
  placed: { beehive: 60, barrel: 40 },   // what they cost new at the Market; buyback pays half
};
for (const k of FIND_IDS) ITEMS['antique_' + k] = { name: FINDS[k].into.name, sell: RESALE.antique[k], antique: k };
SELL_ORDER.unshift(...[...FIND_IDS].sort((a, b) => RESALE.antique[b] - RESALE.antique[a]).map((k) => 'antique_' + k));
export const FIND_COLORS = { watering_can: '#9FB0A8', wheelbarrow: '#8FA39A', old_crate: '#B9946A', flower_pot: '#C9876A', lantern: '#8A8F8A', bench: '#A89A86', gnome: '#8FAF86', fencing: '#8A8F8A', bottles: '#BFDCCF', scrap_metal: '#9AA3A6' };
export const RESTORE_HURRY_JEWELS = 1;
export const ATMOS_STEP = 0.04, ATMOS_MAX = 0.4;          // each atmosphere point: customers arrive 4% sooner (max 40%)

// ---------- v0.3: trees you grow ----------
// Real time to maturity. Keep it slow: this is a long-term Wood source. Override for testing with ?treeMin=1
export const TREE = { growMin: 40, wood: 6, stump: 1, saplingBack: 0.5, stageAt: [0, 0.25, 0.6, 1], stageNames: ['Sapling', 'Young tree', 'Growing tree', 'Mature tree'], hurryJewels: 1 };
export const SHOP = { wood5: { wood: 5, price: 12 }, sapling: { price: 20 } };

// ---------- v0.3: Jewel Shop ----------
// ONE flag: 'simulated' = prototype test purchases (no charge). Set to 'apple-iap' once a native StoreKit bridge exists (see js/payments.js).
export const PAYMENTS_MODE = 'simulated';
// 'No More Ads' package: removes every ad placeholder and adds 10 Jewels. Same simulated purchase path as Jewels.
export const NO_ADS_BUNDLE = { id: 'no_ads', n: 10, price: '$8.99', productId: 'com.petalspire.noads', noAds: true };

// Ads (v0.3 prototype). ADS_MODE is the single switch:
//   'placeholder' -> house banner + brand-styled 'Partner ad' placeholders; no ad SDK, nothing is loaded from the network
//   'sdk'         -> reserved for a real partner-network SDK bridge (see js/ads.js); until one exists no partner ads show
//   'off'         -> no ads at all
// Banners are HOUSE ADS only (they promote our own games, see OTHER_GAMES). Full-screen interstitials and the opt-in
// rewarded ad come from an ad partner network: ADS.partner.network names the future SDK (null = placeholder).
export const ADS_MODE = 'placeholder';
export const ADS = {
  banner: true,                 // small bottom house-ad banner under the tab bar (the UI is lifted so nothing is covered)
  houseAds: ['market_plot'],    // which of OTHER_GAMES the banner promotes, in rotation
  partner: { network: null, interstitialUnit: null, rewardedUnit: null },   // e.g. { network: 'admob', interstitialUnit: 'ca-app-pub-…' }
  interstitialEverySales: 3,    // a full-screen ad break after every 3rd customer sale…
  interstitialAfterPack: true,  // …and after opening a bought Card Pack
  minGapMs: 90 * 1000,          // never more than one ad break per 90 s
  skipAfterMs: 3000,            // ad breaks can be skipped after 3 s
  rewarded: { coins: 10, cooldownMs: 3 * 60 * 1000, watchMs: 3000 },   // opt-in 'watch an ad' at the stand
};

// Settings → Play Other Games. Add more entries here; status 'soon' | 'live' (live entries need a url).
export const OTHER_GAMES = [
  { id: 'market_plot', name: 'Market Plot', status: 'soon', tagline: 'Invent it. Grow it. Sell it.',
    blurb: 'A cozy invent-and-market farming game: dream up new crops and handmade goods, then run your own little market.', url: null },
];

export const JEWEL_BUNDLES = [
  { id: 'jewels_1',  n: 1,  price: '$0.99',  productId: 'com.petalspire.jewels.1' },
  { id: 'jewels_10', n: 10, price: '$6.99',  productId: 'com.petalspire.jewels.10' },
  { id: 'jewels_50', n: 50, price: '$29.99', productId: 'com.petalspire.jewels.50', best: true },
];

// v0.41: traffic features
export const PARKING = { cap: 2, capLv2: 3, gapMult: 0.7, extraItem: 0.3 };            // gaps between customers ×0.7 (30% shorter)
export const WINDMILL = { regenS: [40, 36, 33, 30] };   // seconds per water for a 60 s barrel at card Lv1..Lv4 (global: every connected barrel); ×½ again with the Brass Watering Can
export const BILLBOARD = { boostMs: 5 * 60000, cooldownMs: 60 * 60000, mult: 2, jewels: 1 };  // Run ad: 2× traffic for 5 min · free once an hour · 1 Jewel to skip the wait
export const TIPS = {
  parking: 'Your <b>Parking Lot</b> is open! Up to 2 cars can stop at once (3 at card Lv2), customers come 30% more often, and some buy an extra item.',
  windmill: 'Your <b>Windmill</b> is turning! Every rain barrel that’s connected to a stand now refills faster (40 s instead of 60 s; more with card levels).',
  billboard: 'Your <b>Billboard</b> is up! Tap it and <b>Run ad</b> for twice the traffic for 5 minutes. It’s free once an hour; during the wait you can spend 1 Jewel to run it now.',
  chop: 'An old wooded lot. <b>Tap a tree</b> to chop it down — you’ll get <b>Wood</b>.',
  stump: 'Stumps stay behind. <b>Tap a stump</b> to dig it out and clear the ground.',
  find: 'Something glints! <b>Tap the sparkle</b> to pick up what you found.',
  finds: 'Found items go to <b>Bag → Finds</b>. <b>Restore</b> them into something useful, or <b>recycle</b> them.',
  sapling: 'A <b>tree sapling</b>! Plant it on open ground (Bag or Build). Trees grow slowly but give lots of Wood.',
  build: 'Nice clearing! Tap <b>Build</b> and place a <b>raised bed</b> on a fully cleared patch.',
  standbp: 'Next: build your <b>Farm Stand</b> by the road. Tap the glowing blueprint or open <b>Build</b>.',
  water: 'Seeds need a drink. <b>Tap the planted tile</b> and water it.',
  growing: 'It’s growing! <b>Drag</b> to move around, <b>pinch</b> to zoom, <b>twist two fingers</b> to turn.',
  bloom: 'A bloom! <b>Tap the sparkling plant</b> to harvest it.',
  harvested: 'Harvests give flowers <i>and</i> seeds. Put spares on your <b>Farm Stand</b> by the road.',
  stand: 'Your <b>Farm Stand</b> is built! Tap it to stock flowers — drivers will pull over to buy.',
  barrel: 'Each <b>rain barrel</b> refills by <b>1 water a minute</b> (up to 10), even while the game is closed — the badge shows when the next drop lands. Hand watering uses the bed’s own plot barrel first, then the nearest other barrel. Water only comes from rain barrels.',
  plotbarrel: 'This plot has no rain barrel yet. Buy a <b>Rain Barrel</b> at the Supply Market (40 coins) and place it here: its own water for irrigation, up to <b>4 beds</b>. A barrel only collects rain through a gutter from a <b>stand on the same plot</b> (Tincture or Essential Oil Stand) — it connects automatically. Until then, hand watering borrows from your nearest barrel.',
  sickle: 'You own the <b>Harvest Sickle</b>! Tap the sickle button on the left, then tap a glowing raised bed to harvest every ripe plant in that bed at once.',
  plow: 'You own the <b>Hand Plow</b>! Tap the plow button on the left, pick a seed, then tap a glowing raised bed to plant every empty tile in that bed.',
  oils: 'The <b>Essential Oil Stand</b> is an Epic card: find it in a Card Pack, buy it at the Supply Market (150 coins), then build it (25 Wood) on one of your <b>other plots</b>. It distills <b>seeds</b> into oils worth far more than the seeds.',
  still: 'Your <b>Essential Oil Stand</b> is ready! Distill <b>seeds</b> into essential oils (5 Lavender, 4 Calendula or 3 Chamomile seeds each) — oils sell for a premium at the Farm Stand, far more than the seeds.',
  tincture: 'Your <b>Tincture Stand</b> is ready! Steep flowers with <b>Glycerin</b> or <b>Vinegar</b> (Supply Market) — tinctures sell for far more at the Farm Stand.',
  customer: 'A customer! They’ll pick what they want from your stand and pay in coins.',
  lavender: 'You can now build a <b>Drying Rack</b> (Build). Dried Lavender sells for almost 3× fresh.',
  rebuild: 'Your stand has earned enough to <b>rebuild the Supply Market</b>. Tap the old cottage or open Build.',
  market: 'The <b>Supply Market</b> is open — seeds, <b>Rain Barrels</b> for new plots, <b>Wood bundles</b>, <b>saplings</b> and Card Packs (<b>1 Jewel</b> each).',
  packs: 'Card Packs cost <b>1 Jewel</b> each: Supply Market › Card Packs. Out of Jewels? Get some in the <b>Jewel Shop</b> — or keep clearing the woods, where a Jewel turns up now and then.',
  pack: 'Discovered cards unlock new items in the Supply Market — buy them with coins. More Card Packs cost <b>1 Jewel</b> each (Jewels: Jewel Shop, or rare finds in the woods).',
  decor: 'Placed decor raises your garden’s <b>atmosphere</b> — customers stop by more often.',
  plot: 'The woods around you are <b>for sale</b>. Tap a <b>For Sale</b> sign to expand.',
  plotbought: 'New land! Clear its trees for Wood and room for more beds.',
  shade: 'Trees and buildings cast <b>shade</b> — a shaded plot grows up to <b>4× slower</b>. <b>Clear nearby trees to let the sun in.</b>',
};

// ---------- v0.31: shade slows growth ----------
// Every standing tree (wild, grown, background woods) and building casts shade in a circle around it.
// shade at a spot = Σ weight · (1 − dist/reach)^falloff · sunBias, clamped to 0–1;  sun = 1 − shade.
// Casters on the golden-hour (north-west) side count fully; casters on the far side count (1 − sunBias).
// Growth speed = minSpeed + (1 − minSpeed) · sun  →  full sun 100%, full shade 25% (4× slower).
export const SHADE = {
  minSpeed: 0.25,                 // growth speed in full shade
  sunDir: [-0.79, -0.61],         // ground direction toward the low sun (matches the scene light)
  sunBias: 0.6,                   // 0 = shade equal all round, 1 = only the sun side shades
  falloff: 1.3,
  tree: { w: 0.55, reach: 3.4 },  // a wild tree of scale 1 (weight & reach scale with tree size)
  grownStage: [0.15, 0.45, 0.75, 1.0], // planted trees cast more shade as they grow (sapling → mature)
  bgTree: { w: 0.55, reach: 3.4 },
  buildings: { stand: { w: 0.35, reach: 2.6 }, market: { w: 0.55, reach: 3.4 }, rack: { w: 0.2, reach: 2.0 }, tincture: { w: 0.3, reach: 2.4 }, still: { w: 0.3, reach: 2.4 } },
  slowerBelow: 0.95,              // sun under this shows 'growing slower'
  muchSlowerBelow: 0.3,
};
