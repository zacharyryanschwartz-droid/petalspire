// Petalspire v0.4 — game data
// v0.4: REAL PLANTS ONLY. Each species is one self-contained entry, so the full plant catalog can be added later.
// v0.5 PLANT TIERS — the full catalog: 21 plants, 3 per tier. Lowest → highest (the user's order). Each higher tier has
// lower pack odds, a longer grow time, a higher seed cost and a higher sell price. Basic keeps the v0.4 numbers exactly.
//   pack: % chance that ONE pack card is a plant of this tier (split between its 3 plants by packShare; features keep their v0.41 odds)
//   glow: 0 = none, 1 = soft (Rare+), 2 = Ultra Rare shimmer, 3 = Other World (strongest glow + floating motes)
//   seeds: [min, max] seeds per harvest; bonus: chance of +1 seed (v0.65: Ultra Rare 25%, Other World 15% → 2)
//   color: tier label / card frame colour (brand palette)
export const PLANT_TIERS = {
  basic:      { label: 'Basic',       order: 1, pack: 40,  glow: 0, seeds: [2, 3], color: '#5E825F' },
  epic:       { label: 'Epic',        order: 2, pack: 8,   glow: 0, seeds: [2, 3], color: '#B07A1E' },
  legendary:  { label: 'Legendary',   order: 3, pack: 4.5, glow: 0, seeds: [2, 2], color: '#9A6A12' },
  rare:       { label: 'Rare',        order: 4, pack: 3,   glow: 1, seeds: [1, 2], color: '#4F8597' },
  superrare:  { label: 'Super Rare',  order: 5, pack: 1.8, glow: 1, seeds: [1, 2], color: '#3D5A40' },
  ultra:      { label: 'Ultra Rare',  order: 6, pack: 0.8, glow: 2, seeds: [1, 1], bonus: 0.25, color: '#8A5FB8' },
  otherworld: { label: 'Other World', order: 7, pack: 0.4, glow: 3, seeds: [1, 1], bonus: 0.15, color: '#6C7FD0' },
};
export const TIER_ORDER = Object.keys(PLANT_TIERS).sort((a, b) => PLANT_TIERS[a].order - PLANT_TIERS[b].order);
// Seeds from one harvest, by the plant's tier rule. v0.65 roughly halved them, but every plant can still give 2 (oils need seeds):
// Basic 2–3 · Epic 2–3 · Legendary 2 · Rare 1–2 · Super Rare 1–2 · Ultra Rare 1, 25% → 2 · Other World 1, 15% → 2. (Was: Basic 5 · Epic 4–5 · Legendary 4 · Rare 3–4 · Super Rare 2–3 · Ultra Rare 2 · Other World 1, 25% → 2.)
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
    growS: 120, seedPrice: 18, flowerSell: 24, seedSell: 9, yieldF: [1, 2], color: '#FFFFFF', icon: 'daisy', img: 'assets/card-chamomile.jpg', packShare: 0.1,
    stats: st(2, 4, 2, 5), blurb: 'Tiny white daisies with sunny yellow centres and feathery leaves. Prized for calming tea.' },
  // ---- Epic ----
  peppermint: P('peppermint', 'epic', 'Peppermint', 'Plant · Cooling mint', [285, 24, 28, [2, 3]], '#8FC48A', 'leaf', st(4, 3, 4, 4),
    'Bright, square-stemmed mint with serrated leaves and lilac flower spikes. Dries into tea, steeps into tinctures, distils into a cool oil.', { dries: true }),
  echinacea: P('echinacea', 'epic', 'Echinacea', 'Plant · Purple coneflower', [320, 27, 32, [2, 3]], '#D77FB0', 'cone', st(3, 5, 3, 3),
    'Tall coneflowers with drooping pink-magenta petals around a spiky copper cone. A favourite immune-support tincture.'),
  lemonbalm: P('lemonbalm', 'epic', 'Lemon Balm', 'Plant · Lemon-scented herb', [300, 25, 30, [2, 3]], '#B9DB7C', 'leaf', st(4, 3, 4, 4),
    'A soft mound of crinkled, lemon-scented leaves. Calming in tea and glycerites; dries well.', { dries: true }),
  // ---- Legendary ----
  rosemary: P('rosemary', 'legendary', 'Rosemary', 'Plant · Woody herb', [570, 38, 46, [2, 3]], '#6E8F86', 'leaf', st(3, 3, 4, 4),
    'Upright woody sprigs of needle-like leaves dotted with pale blue flowers. Dries, steeps and distils beautifully.', { dries: true }),
  yarrow: P('yarrow', 'legendary', 'Yarrow', 'Plant · Meadow herb', [600, 40, 48, [2, 3]], '#F2BFC6', 'umbel', st(3, 4, 4, 3),
    'Feathery leaves under flat clusters of tiny blush flowers. A classic dried herb and tincture.', { dries: true }),
  sunflower: P('sunflower', 'legendary', 'Sunflower', 'Plant · Golden giant', [640, 44, 54, [2, 3]], '#F5C542', 'daisy', st(3, 5, 4, 4),
    'A tall, cheerful giant whose whole worth is its seed disc: one plant gives 50 seeds a harvest (no cut flowers). Sell them in bags of 50 or 100, replant them, or press them into Sunflower Oil and Sun Butter.', { seedsFixed: 50, seedBonus: 5, noFlower: true, seedSell: 1 }),
  // ---- Rare (soft glow) ----
  damaskrose: P('damaskrose', 'rare', 'Damask Rose', 'Plant · Old rose', [1260, 68, 84, [2, 3]], '#F2A7B8', 'bloom', st(2, 5, 3, 5),
    'The perfumer’s rose: full, fragrant blush blooms. Its seeds distil into precious rose otto oil.'),
  tulsi: P('tulsi', 'rare', 'Holy Basil', 'Plant · Tulsi', [1140, 62, 78, [2, 3]], '#A884C2', 'spike', st(3, 4, 4, 4),
    'Sacred tulsi: purple-tinged leaves and mauve flower spikes. Dries into a fragrant tea and makes a prized tincture.', { dries: true }),
  elderflower: P('elderflower', 'rare', 'Elderflower', 'Plant · Elder shrub', [1200, 65, 80, [2, 3]], '#F6F1DC', 'umbel', st(2, 4, 4, 5),
    'Lacy, creamy-white umbels on a young elder. Dried for tea, steeped into a sweet glycerite.', { dries: true }),
  // ---- Super Rare (soft glow) ----
  saffron: P('saffron', 'superrare', 'Saffron Crocus', 'Plant · Autumn crocus', [2580, 100, 140, [2, 2]], '#B79AE0', 'bloom', st(2, 5, 2, 4),
    'Lilac crocus cups with three vivid red threads — the world’s most precious spice. Sells for a fortune.'),
  bluelotus: P('bluelotus', 'superrare', 'Blue Lotus', 'Plant · Water lily', [2700, 110, 150, [2, 2]], '#8FB8E8', 'bloom', st(2, 5, 2, 5),
    'Star-shaped sky-blue water lilies with golden hearts, floating over round pads.'),
  jasmine: P('jasmine', 'superrare', 'Jasmine', 'Plant · Night-scented vine', [2820, 118, 158, [2, 2]], '#FFFDF6', 'star', st(2, 5, 2, 5),
    'A twining vine of starry white flowers with blush buds. Its seeds distil into a heady jasmine oil.'),
  // ---- Ultra Rare (real but famously rare; shimmering glow) ----
  ghostorchid: P('ghostorchid', 'ultra', 'Ghost Orchid', 'Plant · Leafless orchid', [5160, 170, 245, [2, 2]], '#F4F7F2', 'bloom', st(1, 5, 2, 5),
    'A leafless orchid of the swamps: one pale, floating bloom with long curling tails, hanging from a tangle of roots.'),
  jadevine: P('jadevine', 'ultra', 'Jade Vine', 'Plant · Rainforest vine', [5400, 180, 260, [2, 2]], '#5FD3B8', 'claw', st(1, 5, 2, 5),
    'Cascades of claw-shaped flowers in an impossible luminous jade-turquoise.'),
  middlemist: P('middlemist', 'ultra', 'Middlemist Red', 'Plant · Rare camellia', [5640, 190, 275, [2, 2]], '#E0607A', 'bloom', st(1, 5, 2, 5),
    'Perhaps the rarest flower on Earth: lush, fully double rose-pink camellia blooms on glossy dark leaves.'),
  // ---- Other World (fantasy; glows the most) ----
  moonflower: P('moonflower', 'otherworld', 'Moonflower', 'Plant · Night-bloom', [10320, 280, 440, [2, 2]], '#FFF6E6', 'moon', st(1, 5, 2, 5),
    'A white trumpet bloom that glows softly, as if holding a little moonlight. Motes of light drift around it.'),
  crystalrose: P('crystalrose', 'otherworld', 'Crystal Rose', 'Plant · Crystal bloom', [10800, 300, 480, [2, 2]], '#C9D6F5', 'bloom', st(1, 5, 2, 5),
    'A rose of translucent, faceted crystal petals that catch and hold the light.'),
  sunpetal: P('sunpetal', 'otherworld', 'Spiral Sunpetal', 'Plant · Golden spire', [11280, 320, 520, [2, 2]], '#F5D07A', 'sun', st(1, 5, 2, 5),
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

// ---------------- v0.6 ORCHARD TREES ----------------
// Tree cards join the pack pool only once The Orchard (bought on the Map after every Home plot) is owned. A tree is planted from a sapling (bought at
// the Market once its card is found) on a tree spot in the Orchard, grows slowly by tier, then fruits again and again on a
// long cycle — no replanting. Card levels work like plants: +10% fruit price and −5% grow/cycle time per level.
//   by tier order o (1 Basic … 7 Other World): grow 300 · 420 · 540 · 660 · 840 · 1020 · 1200 s;
//   v0.7.2: fruit every 190 · 225 · 270 · 270 · 420 · 400 · 420 s; fruit per pick 5 · 4 · 3 · 4 · 3 · 2 · 2; sapling 90 · 210 · 420 · 720 · 1200 · 1950 · 3000 coins.
export const TREE_TIER = {
  growS: [300, 420, 540, 660, 840, 1020, 1200], cycleS: [190, 225, 270, 270, 420, 400, 420], yield: [5, 4, 3, 4, 3, 2, 2], sapling: [90, 210, 420, 720, 1200, 1950, 3000],
  packShare: 0.5,   // a tree card's raw weight = half an average plant of its tier (then the tier is renormalised to the plan)
};
const T_ = (id, tier, name, fruit, fruitName, fruitSell, use, shape, leaf, fruitC, trunk, blurb, extra = {}) => {
  const o = PLANT_TIERS[tier].order - 1;
  return { id, tier, rarity: tier, kind: 'tree', name, type: `Tree · ${use}`, fruit, fruitName, fruitSell, shape, leaf, fruitC, trunk, blurb,
    growS: TREE_TIER.growS[o], cycleS: TREE_TIER.cycleS[o], yield: TREE_TIER.yield[o], saplingPrice: TREE_TIER.sapling[o],
    stats: st(1, Math.min(5, 3 + (o >> 1)), Math.min(5, 3 + (o > 2 ? 1 : 0)), Math.min(5, 3 + (o >> 1))), glow: PLANT_TIERS[tier].glow, ...extra };
};
export const TREES = {
  apple:        T_('apple', 'basic', 'Apple Tree', 'fruit_apple', 'Apples', 6, 'Fruit', 'round', '#6FA35A', '#D9473B', '#7A5236', 'A sturdy, round-crowned tree hung with glossy red apples. Sauce, butter — or sell them by the bushel.'),
  peach:        T_('peach', 'basic', 'Peach Tree', 'fruit_peach', 'Peaches', 8, 'Fruit', 'spread', '#7DAF5F', '#F6A46B', '#86593A', 'A low, spreading tree of narrow leaves and blushing, fuzzy peaches.'),
  cherry:       T_('cherry', 'epic', 'Cherry Tree', 'fruit_cherry', 'Cherries', 14, 'Fruit', 'oval', '#5E9A55', '#B8203A', '#5E3B2C', 'A tall oval crown that drips with pairs of dark red cherries.'),
  plum:         T_('plum', 'epic', 'Plum Tree', 'fruit_plum', 'Plums', 16, 'Fruit', 'weep', '#6A8F55', '#6A3A7A', '#5A3C30', 'A graceful tree with arching branches heavy with dusky purple plums.'),
  lemon:        T_('lemon', 'legendary', 'Lemon Tree', 'fruit_lemon', 'Lemons', 24, 'Citrus', 'lollipop', '#3F7A45', '#F5D547', '#7A6A4A', 'A clipped, glossy-leaved citrus with bright lemons all year round.'),
  fig:          T_('fig', 'legendary', 'Fig Tree', 'fruit_fig', 'Figs', 28, 'Fruit', 'broad', '#5C9A4A', '#6B4E7A', '#8A7A6A', 'Big, lobed leaves on pale branches, and soft purple figs full of honeyed seeds.'),
  olive:        T_('olive', 'rare', 'Olive Tree', 'fruit_olive', 'Olives', 20, 'Press', 'olive', '#9DB39A', '#4E5A2A', '#8A7F6E', 'A gnarled, silver-leaved olive. Press its olives into golden Olive Oil.'),
  almond:       T_('almond', 'rare', 'Almond Tree', 'fruit_almond', 'Almonds', 22, 'Press', 'blossom', '#7FA86A', '#C9A27A', '#6E4C3A', 'Clouds of pink-white blossom, then velvety almonds. Press them into Almond Oil or Almond Butter.'),
  pomegranate:  T_('pomegranate', 'superrare', 'Pomegranate Tree', 'fruit_pomegranate', 'Pomegranates', 60, 'Fruit', 'vase', '#4F8A47', '#C0283A', '#7A5040', 'A many-stemmed little tree crowned with ruby, jewel-filled pomegranates.'),
  persimmon:    T_('persimmon', 'superrare', 'Persimmon Tree', 'fruit_persimmon', 'Persimmons', 64, 'Fruit', 'lantern', '#6E9A4A', '#F08A24', '#4E3A2E', 'Orange persimmons hang like little lanterns along its branches.'),
  eucalyptus:   T_('eucalyptus', 'ultra', 'Rainbow Eucalyptus', 'fruit_eucalyptus', 'Eucalyptus Leaves', 70, 'Essential oil', 'eucalyptus', '#8FC2B0', '#8FC2B0', '#E07A5A', 'A tall tree whose peeling bark streaks green, blue, purple and orange. Its leaves distil into eucalyptus oil + hydrosol.'),
  cacao:        T_('cacao', 'ultra', 'Cacao Tree', 'fruit_cacao', 'Cacao Pods', 75, 'Press', 'cacao', '#3E7A3E', '#C9772E', '#6A4A32', 'A shady understorey tree with ribbed golden pods growing right on its trunk. Press the beans into Cocoa Butter.'),
  moonpeach:    T_('moonpeach', 'otherworld', 'Moonpeach Tree', 'fruit_moonpeach', 'Moonpeaches', 200, 'Fruit', 'moon', '#9FB8D8', '#FFE9C9', '#6C6A8A', 'Silver-blue leaves and peaches that glow softly like little moons.'),
  crystalapple: T_('crystalapple', 'otherworld', 'Crystal Apple Tree', 'fruit_crystalapple', 'Crystal Apples', 220, 'Fruit', 'crystal', '#BFE3FF', '#E8F6FF', '#8A9AB8', 'A tree of faceted glassy leaves bearing apples clear as crystal, glowing from within.'),
};
for (const t of Object.values(TREES)) t.packW = PLANT_TIERS[t.tier].pack / 3 * TREE_TIER.packShare;
export const TREE_IDS = Object.keys(TREES);
// tree spots in the Orchard (see layout.js ORCHARD_TREE_SPOTS)

export const FEATURES = {
  rainbarrel: {
    id: 'rainbarrel', name: 'Rain Barrel', rarity: 'basic', type: 'Feature · Water',
    stats: { Growth: 3, Beauty: 2, Yield: 3, Atmosphere: 3 },
    blurb: 'Unlocks the Rain Barrel in the Build menu (120 coins): place it in a plot you bought to give that plot its own water — 1 every 30 s, up to 12 (upgrade it to hold up to 60), feeding up to 8 irrigated beds (its plot and the plot behind it).',
  },
  beehive: {
    id: 'beehive', name: 'Honeybee Skep', rarity: 'legendary', type: 'Feature · Pollinators',
    price: 60, stats: { Growth: 3, Beauty: 3, Yield: 5, Atmosphere: 4 },
    blurb: 'Once bought and placed, busy bees add +1 flower to every harvest.',
  },
  irrigation: {
    id: 'irrigation', name: 'Irrigation', rarity: 'basic', type: 'Feature · Water',
    price: 45, stats: { Growth: 4, Beauty: 2, Yield: 3, Atmosphere: 2 },
    blurb: 'A drip line from a rain barrel pays a raised bed’s water for you. Buy one per bed; every purchase or duplicate levels the card up — a full bed’s water per stage (to start, then to bud): Lv1 9 · Lv2 7 · Lv3 5 · Lv4 3.',
  },
  tincture: {
    id: 'tincture', name: 'Tincture Stand', rarity: 'epic', type: 'Feature · Crafting',
    price: 0, packW: 0, reward: 'plotbarrel', stats: { Growth: 1, Beauty: 4, Yield: 5, Atmosphere: 4 },   // v0.52: a free goal reward, not a pack card or a purchase
    blurb: 'A little wooden stall of glass bottles, given free when you give a bought plot its own Rain Barrel: steep your blooms in Glycerin or Vinegar into tinctures that sell for far more.',
  },
  still: {
    id: 'still', name: 'Essential Oil Stand', rarity: 'epic', type: 'Feature · Crafting',
    price: 150, stats: { Growth: 1, Beauty: 4, Yield: 5, Atmosphere: 5 },
    blurb: 'A little stall with gleaming copper stills. Find it, buy it at the Supply Market, build it on one of your other plots, then distill your seeds: each run gives an essential oil that sells for a premium plus its hydrosol (Rose Water from Damask Rose).',
  },
  sickle: {
    id: 'sickle', name: 'Harvest Sickle', rarity: 'epic', type: 'Tool · Harvest',
    price: 80, stats: { Growth: 1, Beauty: 2, Yield: 4, Atmosphere: 2 }, tool: true,
    blurb: 'Harvest a whole raised bed at once. Tap the Sickle, then a raised bed: every ripe plant in that bed is harvested in one sweep (normal yields and seeds). Ready again right away: no rest between sweeps.',
  },
  plow: {
    id: 'plow', name: 'Hand Plow', rarity: 'epic', type: 'Tool · Planting',
    price: 90, stats: { Growth: 3, Beauty: 1, Yield: 3, Atmosphere: 2 }, tool: true,
    blurb: 'Plant a whole raised bed at once. Tap the Plow, pick a seed, then a raised bed: every empty tile in that bed is planted, as far as your seeds go. Ready again right away: no rest between uses.',
  },
  parking: {
    id: 'parking', name: 'Parking Lot', rarity: 'legendary', type: 'Feature · Traffic',
    price: 140, stats: { Growth: 1, Beauty: 2, Yield: 5, Atmosphere: 3 },
    blurb: 'Painted bays by your Farm Stand: room for 2 cars at once (3 at card Lv2+), customers come 30% more often, and 30% of them pick up one extra item. Build it next to the stand for 20 Wood.',
  },
  windmill: {
    id: 'windmill', name: 'Windmill', rarity: 'legendary', type: 'Feature · Water',
    price: 160, stats: { Growth: 3, Beauty: 4, Yield: 3, Atmosphere: 4 },
    blurb: 'Pumps for every rain barrel on your land: connected barrels refill every 15 s instead of 30 s (faster with card levels, and it stacks with the Brass Watering Can). Build it once anywhere on your cleared ground for 20 Wood + 5 Scrap Metal.',
  },
  teastand: {
    id: 'teastand', name: 'Tea Stand', rarity: 'epic', type: 'Feature · Crafting',
    price: 130, stats: { Growth: 1, Beauty: 4, Yield: 5, Atmosphere: 5 },   // v0.52
    blurb: 'A little tea stall with a steaming kettle and tins. Find it, buy it at the Supply Market and place it on any plot you own, then blend any three dried herbs into a tea: the rarer the herbs, the bigger the multiplier — Other World teas sell for a fortune.',
  },
  press: {
    id: 'press', name: 'Pressed Oil Stand', rarity: 'epic', type: 'Feature · Crafting',
    price: 140, stats: { Growth: 1, Beauty: 3, Yield: 5, Atmosphere: 4 },   // v0.6
    blurb: 'A wooden screw press. Press Sunflower seeds into Sunflower Oil or Sun Butter, Damask Rose seeds into Rosehip Oil, Spiral Sunpetal seeds into glowing Sunpetal Oil — and, with an Orchard, olives and cacao into Olive Oil and Cocoa Butter. (Almond Oil and Almond Butter are pressed at the Orchard Oil Press.) Buy it and place it on any plot you own (20 Wood).',
  },
  fruitstand: {
    id: 'fruitstand', name: 'Fruit Stand', rarity: 'epic', type: 'Feature · Crafting',
    price: 0, stats: { Growth: 1, Beauty: 4, Yield: 5, Atmosphere: 5 },   // v0.61: free with the Orchard (was 120)
    blurb: 'A canning kitchen under a striped awning. Turn orchard fruit into Canned Fruit, Jelly, Fruit Butter and Sauce — Apple Sauce, Peach Butter, Cherry Jelly, Lemon Curd, glowing Moonpeach Preserves… Free with the Orchard: place it on any Orchard plot. Sell its jars at the Orchard Stand.',
  },
  billboard: {
    id: 'billboard', name: 'Roadside Billboard', rarity: 'epic', type: 'Feature · Advertising',
    price: 90, stats: { Growth: 1, Beauty: 3, Yield: 4, Atmosphere: 2 },
    blurb: 'A painted sign across the road. Tap it to Run ad: twice the traffic for 5 minutes. Free once an hour, or 1 Jewel to run it now. Build it by the road for 15 Wood.',
  },
  // v0.52: the two tincture bases are cards too. Finding one unlocks it at the Supply Market (buyable once the Tincture
  // Stand is open); every duplicate copy gives SUPPLY_DUP free units of that base.
  glycerin: {
    id: 'glycerin', name: 'Glycerin', rarity: 'basic', type: 'Supply · Tincture base', packW: 2,
    stats: { Growth: 1, Beauty: 3, Yield: 3, Atmosphere: 2 },
    blurb: 'Unlocks Glycerin at the Supply Market (sold once your Tincture Stand is open): a sweet, gentle base for Glycerites. Each duplicate card gives +2 free Glycerin.',
  },
  vinegar: {
    id: 'vinegar', name: 'Vinegar', rarity: 'basic', type: 'Supply · Tincture base', packW: 2,
    stats: { Growth: 1, Beauty: 2, Yield: 3, Atmosphere: 2 },
    blurb: 'Unlocks Vinegar at the Supply Market (sold once your Tincture Stand is open): a tangy base for Vinegar Tinctures. Each duplicate card gives +2 free Vinegar.',
  },
  sundial: {
    id: 'sundial', name: 'Golden Sundial', rarity: 'rare', type: 'Feature · Time',
    price: 90, stats: { Growth: 5, Beauty: 4, Yield: 3, Atmosphere: 5 },
    blurb: 'Once bought and placed, every plant you water grows 25% faster.',
  },
  // v0.65: garden charms — Sundial-style keepsakes for the upper tiers. Find the card, buy it in the Supply Market, and its
  // effect works while you own it. Copies level it up (3 / 6 / 10 copies → Lv2–4); CHARMS below holds the per-level values.
  gardenbell: {
    id: 'gardenbell', name: 'Brass Garden Bell', rarity: 'rare', type: 'Charm · Customers', packW: 1,
    price: 120, stats: { Growth: 1, Beauty: 4, Yield: 3, Atmosphere: 5 },
    blurb: 'Once bought and placed, it rings for the stand nearby: customers at that location (Home or the Orchard) arrive 8% sooner (Lv4: 15%).',
  },
  rainchain: {
    id: 'rainchain', name: 'Copper Rain Chain', rarity: 'superrare', type: 'Charm · Water', packW: 0.6,
    price: 180, stats: { Growth: 4, Beauty: 4, Yield: 2, Atmosphere: 4 },
    blurb: 'Once bought and placed, every rain barrel refills 10% faster (Lv4: 20%).',
  },
  seedtin: {
    id: 'seedtin', name: "Seed Keeper's Tin", rarity: 'superrare', type: 'Charm · Seeds', packW: 0.6,
    price: 200, stats: { Growth: 2, Beauty: 3, Yield: 5, Atmosphere: 3 },
    blurb: 'Once bought and placed, every raised-bed harvest has a 15% chance of +1 seed (Lv4: 30%).',
  },
  scales: {
    id: 'scales', name: 'Honeygold Scales', rarity: 'ultra', type: 'Charm · Sales', packW: 0.27,
    price: 280, stats: { Growth: 1, Beauty: 5, Yield: 5, Atmosphere: 4 },
    blurb: 'Once bought and placed, items sell for 5% more at the Farm Stand and the Fruit Stand (Lv4: 10%).',
  },
  pocketwatch: {
    id: 'pocketwatch', name: "Gardener's Pocket Watch", rarity: 'ultra', type: 'Charm · Helpers', packW: 0.27,
    price: 300, stats: { Growth: 4, Beauty: 3, Yield: 4, Atmosphere: 4 },
    blurb: 'Once bought and placed, every Gardener and Market Manager hire lasts 10 minutes longer for the same cost (Lv4: +30 minutes).',
  },
  moonfountain: {
    id: 'moonfountain', name: 'Moonlit Fountain', rarity: 'otherworld', type: 'Charm · Otherworldly', packW: 0.13,
    price: 420, stats: { Growth: 5, Beauty: 5, Yield: 5, Atmosphere: 5 },
    blurb: 'Once bought and placed, every raised-bed harvest has a 20% chance of +1 flower (Lv4: 35%).',
  },
  faelantern: {
    id: 'faelantern', name: 'Fae Lantern', rarity: 'otherworld', type: 'Charm · Otherworldly', packW: 0.13,
    price: 450, stats: { Growth: 5, Beauty: 5, Yield: 4, Atmosphere: 5 },
    blurb: 'Once bought and placed, drying and crafting (rack, still, tinctures, tea, press, fruit stand) take 15% less time (Lv4: 25%).',
  },
};
// v0.65: per-level values of the garden charms (index = card level − 1). Fractions are % (0.08 = 8%); pocketwatch is hours (v0.7: fractions of an hour).
export const CHARMS = {
  gardenbell:   { lv: [0.08, 0.10, 0.12, 0.15], fx: 'gap',   where: 'home' },
  rainchain:    { lv: [0.10, 0.13, 0.16, 0.20], fx: 'water', where: 'all' },
  seedtin:      { lv: [0.15, 0.20, 0.25, 0.30], fx: 'seed',  where: 'all' },
  scales:       { lv: [0.05, 0.06, 0.08, 0.10], fx: 'sell',  where: 'stands' },
  pocketwatch:  { lv: [10 / 60, 15 / 60, 20 / 60, 30 / 60], fx: 'shift', where: 'all' },   // v0.7: +10/15/20/30 minutes (was hours)
  moonfountain: { lv: [0.20, 0.25, 0.30, 0.35], fx: 'flower', where: 'all' },
  faelantern:   { lv: [0.15, 0.18, 0.21, 0.25], fx: 'craft', where: 'all' },
};
export const CHARM_IDS = Object.keys(CHARMS);

// v0.52: the Tincture Stand is a goal reward now, so it is not a collectable card (and never in packs).
export const NON_CARDS = ['tincture', 'fruitstand'];   // v0.61: the Fruit Stand is free with the Orchard, no longer a pack card
export const CARDS = { ...SPECIES, ...TREES, ...Object.fromEntries(Object.entries(FEATURES).filter(([k]) => !NON_CARDS.includes(k))) };

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
// v0.52: the Glycerin and Vinegar cards (Basic, 2% each) are carved out of the two Basic feature cards (Rain Barrel and
// Irrigation 10% → 8% each), so every tier's total and every other card's odds stay exactly as in v0.51 (total 100%).
export const FEATURE_PACK_W = { basic: 8, epic: 2.5, legendary: 7 / 3, rare: 2 };
for (const f of Object.values(FEATURES)) f.packW ??= FEATURE_PACK_W[f.rarity] ?? 0;
export const SUPPLY_CARDS = ['glycerin', 'vinegar'], SUPPLY_DUP = 2;
// v0.52: the water truck (Supply Market › Fill Rain Barrels) tops every barrel up to full and bills per barrel it filled.
export const WATER_TRUCK = { perBarrel: 10 };
// v0.52: the Tincture Stand's 2.5% left the packs; every remaining weight is scaled by 100 / 97.5 so a pack slot still totals
// exactly 100% and every card keeps its odds relative to the others.
// v0.52 (later): cards added after the tier-odds plan (the Tea Stand) take their share from inside their own tier, so every
// tier keeps exactly the planned odds below (Basic 34.62 … Other World 0.70) and the tier's other cards shrink in proportion.
export const PLAN_LATE = ['teastand', 'press', 'fruitstand', ...Object.keys(TREES), ...Object.keys(CHARMS)];   // v0.65: + the garden charms   // carved out of their tier: tier totals stay on the plan
const RAW_ALL = Object.fromEntries(Object.entries(CARDS).map(([k, c]) => [k, c.packW || 0]));
const RAW_W = Object.fromEntries(Object.entries(RAW_ALL).map(([k, w]) => [k, PLAN_LATE.includes(k) ? 0 : w]));
const RAW_TOTAL = Object.values(RAW_W).reduce((a, b) => a + b, 0);
export const PACK_SCALE = 100 / RAW_TOTAL;
// v0.52 odds boost: every tier above Basic gets ×PACK_BOOST of its share (plants + features together, relative weights kept
// inside each tier) and Basic shrinks to make the total exactly 100%. A full ×2 would push Basic (23%) below Epic (37%),
// breaking the strictly decreasing tier order, so the boost is ×1.7: Basic 34.6 > Epic 31.4 > Legendary 20.1 > Rare 8.7 >
// Super Rare 3.1 > Ultra Rare 1.4 > Other World 0.7 (%).
export const PACK_BOOST = 1.7;
const tierOfCard = (k) => CARDS[k].tier || CARDS[k].rarity;
const NB_TOTAL = Object.entries(RAW_W).filter(([k]) => tierOfCard(k) !== 'basic').reduce((a, [, w]) => a + w * PACK_SCALE, 0);
const B_TOTAL = 100 - NB_TOTAL, BASIC_K = (100 - NB_TOTAL * PACK_BOOST) / B_TOTAL;
export const TIER_K = Object.fromEntries(Object.keys(PLANT_TIERS).map((t) => [t, PACK_SCALE * (t === 'basic' ? BASIC_K : PACK_BOOST)]));
const tierSum = (W) => { const o = {}; for (const [k, w] of Object.entries(W)) { const t = tierOfCard(k); o[t] = (o[t] || 0) + w * TIER_K[t]; } return o; };
const PLAN_T = tierSum(RAW_W);
// v0.6: two pools. Before the Orchard is bought tree cards weigh 0; after, they join. Each pool is renormalised per tier,
// so the per-tier odds are identical either way (the plan) and only the split inside a tier changes.
const mkPool = (raw) => { const A = tierSum(raw), fix = Object.fromEntries(Object.keys(PLANT_TIERS).map((t) => [t, A[t] ? PLAN_T[t] / A[t] : 1]));
  return { fix, w: Object.fromEntries(Object.entries(raw).map(([k, w]) => [k, w * TIER_K[tierOfCard(k)] * fix[tierOfCard(k)]])) }; };
const RAW_NO_TREES = Object.fromEntries(Object.entries(RAW_ALL).map(([k, w]) => [k, TREES[k] ? 0 : w]));
const POOL = mkPool(RAW_NO_TREES), POOL_ORCH = mkPool(RAW_ALL);
export const TIER_FIX = POOL.fix, TIER_FIX_ORCH = POOL_ORCH.fix;
export const PACK_W = POOL.w, PACK_W_ORCH = POOL_ORCH.w;
for (const [k, w] of Object.entries(PACK_W)) CARDS[k].packW = w;
for (const [t, T] of Object.entries(PLANT_TIERS)) T.pack = +(T.pack * TIER_K[t] * TIER_FIX[t]).toFixed(2);   // shown in the Market's locked-tier rows
// v0.52: Scrap Metal also turns up on the road now and then — one tappable piece at a time, about every 8–12 minutes of play.
export const ROAD_SCRAP = { minS: 480, maxS: 720, scrap: 1 };
// v0.52: duplicate Tincture Stand cards in older saves become coins (the stand itself is kept).
export const TINC_DUP_COINS = 10;

// v0.4 CARD STACKS & UPGRADES (placeholder numbers). Every copy of a card you find stacks on one card (×n).
// Copies are kept as progress (never consumed): at 3 / 6 / 10 copies the card can be upgraded to Lv2 / Lv3 / Lv4 with a tap.
// Plant levels: +10% sell price and -5% grow time per level above 1, +1 Beauty/Yield pip per level, and +1 flower per harvest at Lv4.
// Seeds per harvest always follow the plant's tier rule (PLANT_TIERS) — levels never change them.
// v0.64: Sickle and Plow have no rest and no levels (copies just stack). Irrigation (v0.63): owning one card hooks up any number of beds
// (barrel limit applies); its level lowers the water a hooked bed needs per stage (see WATER.stage).
export const CARD_LEVELS = {
  thresholds: [3, 6, 10],          // copies needed for Lv2, Lv3, Lv4 (max)
  plant: { sell: 0.10, grow: 0.05, statPip: 1, bonusFlowerAt: 4 },
  upgradable: (id, card) => !!card.tier || id === 'parking' || id === 'windmill' || id === 'irrigation' || !!CHARMS[id],   // v0.65: + garden charms
  parking: { extraItem: 0.10 },   // v0.52: spots / cars per arrival / gap per level live in PARKING; each level adds +10% extra-item chance
};
// v0.41: Card Packs cost Jewels, not coins (1 Jewel = one standard pack). Add more pack types here (e.g. a premium pack at 3 Jewels).
export const PACKS = { standard: { name: 'Botanical Card Pack', jewels: 1, cards: 3 } };
export const PACK_JEWELS = PACKS.standard.jewels;
// v0.41: Jewel trades in the Jewel Shop, and the rare free Jewel hidden in the woods (so free players can still open packs now and then).
export const JEWEL_EXCHANGE = { coins: 1000, wood: 250 };
export const JEWEL_DROP = { clear: 0.01 };   // v0.52: 1% (was 4%) — chance that clearing a tree, stump, bush or rock (without a find) turns up 1 Jewel
export const DUP_COINS = 8;
export const RACK_SLOTS = 3;
// v0.63: the Farm Stand and the Drying Rack level up with coins (Lv1 → Lv4, permanent). Index = level − 1; cost[k] buys level k + 2.
// Balanced against the stand milestones (Tincture Stand at 1,000 earned, Essential Oil Stand at 2,500): the first step is a few
// good sales, the last is a mid-game goal.
// v0.63: every Card Pack also holds coins, wood and Scrap Metal. Each rolls on its own: 1 + floor(max · u^CURVE) (capped at max),
// u uniform 0–1. CURVE 4 = mostly small amounts, rare big ones (median ≈ 6% of max, mean ≈ 20%, top 10% of the range ≈ 2.6%).
export const PACK_LOOT = { coins: 500, wood: 100, scrap: 25, curve: 4, bigAt: 0.9 };
export const rollLoot = (max, rnd = Math.random, curve = PACK_LOOT.curve) => Math.min(max, 1 + Math.floor(max * Math.pow(rnd(), curve)));
// v0.63: every pack = 2 plant cards + 1 non-plant card (feature, tool, stand, supply…). Cards you already own are drawn at
// OWNED_K × their weight (the tier odds shown in the Market are for cards you don't have yet).
export const PACK_MIX = { plants: 2, other: 1 }, OWNED_K = 0.4;
// v0.63: daily streak — one gift per consecutive local calendar day. Miss a day and it starts again at Day 1. After Day 15 the
// 15-day calendar loops (Day 16 pays like Day 1 …) while the streak counter keeps counting. Milestones: 5, 10 (+ a Card Pack), 15 (+ Jewels).
export const DAILY = {
  days: [
    { coins: 25 }, { wood: 10 }, { scrap: 3 }, { coins: 40 },
    { coins: 100, wood: 30, scrap: 8, milestone: true },
    { wood: 15 }, { scrap: 4 }, { coins: 60 }, { wood: 20 },
    { coins: 200, wood: 50, scrap: 12, pack: 1, milestone: true },
    { scrap: 5 }, { coins: 80 }, { wood: 25 }, { scrap: 6 },
    { coins: 400, wood: 100, scrap: 20, jewels: 3, milestone: true, grand: true },
  ],
};
// v0.63: stands take real time to build. After paying & placing, a stand is under construction (wall-clock, saved, keeps
// running while the game is closed) and only works when done.
// v0.64: slower builds (first builds stay quick), coin upgrades take build time too, and 'Finish now' is ALWAYS 1 Jewel.
// Seconds per stand:
export const CONS = {
  s: { stand: 5, rack: 60, fruitstand: 300, tincture: 900, still: 1800, teastand: 3600, press: 7200, oshed: 14400 },
  // v0.64: coin-upgrade build time, index = target level − 2 (Lv2, Lv3, Lv4[, Lv5]). The building keeps working at its old level meanwhile.
  upg: { stand: [300, 1200, 3600], rack: [300, 1200, 3600], barrel: [300, 1200, 3600, 7200] },
  jewels: 1,
};
export const consJewels = () => CONS.jewels;   // v0.64: flat 1 Jewel, however long is left
// v0.64 Jewel uses. Instant Bloom: every growing plant (or orchard tree) at the current location → harvest-ready, skipping water
// and bud stops. Cost = ceil(plants / perJewel), between min and max. Customer Rush: for `ms`, customers arrive `gapK` × as far
// apart at this location's stand (parking / visitor capacity still applies).
export const BLOOM = { perJewel: 6, min: 1, max: 5 };
export const bloomJewels = (n) => Math.min(BLOOM.max, Math.max(BLOOM.min, Math.ceil(n / BLOOM.perJewel)));
export const RUSH = { jewels: 1, ms: 150000, gapK: 0.2, firstMs: 1200 };
export const BUILDING_LV = {
  stand: { cost: [250, 750, 2000], space: [0, 6, 12, 18], sell: [0, 0, 0.05, 0.10] },   // +shelf space · +% coins on Farm Stand sales
  rack:  { cost: [150, 450, 1200], slots: [3, 4, 5, 6], faster: [0, 0.10, 0.20, 0.30] }, // drying slots · % shorter drying time
};
export const DRY_S = 40;

// ---------- v0.4: one rain barrel per plot ----------
// Each owned plot gets ONE barrel (the home lot's arrives with your first bed; other plots: Build → Rain Barrel).
// A barrel feeds at most maxBeds irrigated beds: its own plot's beds plus (v0.52) the beds of the owned plot directly behind it.
export const BARREL = { price: 120, maxBeds: 8 };   // v0.52: 8 (was 4) — own plot + the plot behind   // v0.52: built from the Build menu (v0.7.2: 120 coins) (water itself is only sold by the truck load)

// ---------- v0.4: Tincture Stand ----------
// Bases are bought at the Supply Market. Every craft uses 1 base (Glycerin OR Vinegar) + flowers.
export const BASES = {
  glycerin: { name: 'Glycerin', price: 24, pack: { n: 5, price: 96 }, color: '#F3E7B5', blurb: 'Sweet, gentle base · makes Glycerites' },
  vinegar:  { name: 'Vinegar',  price: 18, pack: { n: 5, price: 72 }, color: '#E3BF8C', blurb: 'Tangy base · makes Vinegar Tinctures' },
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
  recipes: {   // seeds per distill, time (s), Farm Stand price · v0.7: every seed oil takes 10 seeds (Eucalyptus stays 3 leaves)
    lavender:  { n: 10, s: 180, sell: 70 },
    calendula: { n: 10, s: 210, sell: 95 },
    chamomile: { n: 10, s: 240, sell: 120 },
    // v0.5: peppermint, rosemary, rose otto and jasmine oils
    peppermint: { n: 10, s: 240, sell: 150 },
    rosemary:   { n: 10, s: 270, sell: 250 },
    damaskrose: { n: 10, s: 300, sell: 330 },
    jasmine:    { n: 10, s: 360, sell: 420 },
    // v0.6: Rainbow Eucalyptus LEAVES (orchard tree) — 3 leaves → Eucalyptus Essential Oil + Eucalyptus Hydrosol
    eucalyptus: { n: 3, s: 300, sell: 600, in: 'fruit_eucalyptus' },
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
// v0.52: every plant dries now (the Tea Stand blends dried herbs). The new ones dry for a time set by their tier and sell
// for 2.45× the fresh flower — the same ratio as the v0.5 dried herbs (Peppermint 70 / 28 = 2.5, Tulsi 190 / 78 = 2.44).
// ---------------- v0.7 economy pass ----------------
// Money came in too fast at the top. Sell prices now fall off by tier (Basic barely changes, Other World is cut the most).
// Costs (seed prices, saplings, packs, Gardeners, builds, plots) are NOT changed. Every crafted good stays worth more than its
// raw inputs: a tincture is worth at least ECON.margin × (its flowers + its base), an essential oil at least ECON.margin × the
// seeds (or leaves) it takes, and press/jar/tea multipliers stay above 1.
export const ECON = {
  tier: {basic: 0.9, epic: 0.525, legendary: 0.45, rare: 0.45, superrare: 0.41, ultra: 0.375, otherworld: 0.34},
  tinc: 0.9,     // tinctures: a further cut on top of the tier factor
  margin: 1.25,
  // v0.7: shorter grow times for the top tiers (×), so a late-game bed earns more per hour than a mid-game one. Grow times still rise by tier.
  grow: {epic: 1.35, legendary: 1.35, rare: 1.0, superrare: 0.6, ultra: 0.4455, otherworld: 0.324},
  dryRatio: 1.25,   // dried herb = 1.25× the fresh flower (was 2.45×) · = DRY_RATIO below
};
const econF = (tier) => ECON.tier[tier] ?? 1;
const TREE_F = { basic: 0.9, epic: 0.7, legendary: 0.6, rare: 0.6, superrare: 0.55, ultra: 0.5, otherworld: 0.45 }, treeF = (tier) => TREE_F[tier] ?? 1;
for (const sp of Object.values(SPECIES)) {
  const f = econF(sp.tier);
  sp.flowerSell = Math.max(1, Math.round(sp.flowerSell * f));
  if (ECON.grow[sp.tier]) { sp.growS = Math.round(sp.growS * ECON.grow[sp.tier]); sp.stats.Growth = Math.max(sp.stats.Growth, 2); }   // card Growth stat follows the faster grow
  if (sp.tier !== 'basic' && !sp.noFlower) sp.seedSell = Math.max(1, Math.round(sp.seedPrice / 2 * f));
}
{ let prev = 0;   // keep tiers apart: a tier's cheapest flower still sells above the tier below's priciest (Epic vs Chamomile)
  for (const t of TIER_ORDER) { const ps = Object.values(SPECIES).filter((x) => x.tier === t && !x.noFlower);
    for (const x of ps) x.flowerSell = Math.max(x.flowerSell, prev + 1); prev = Math.max(prev, ...ps.map((x) => x.flowerSell)); } }
for (const t of Object.values(TREES)) t.fruitSell = Math.max(1, Math.round(t.fruitSell * treeF(t.tier)));
for (const [k, d] of Object.entries(DRYING)) d.sell = Math.max(SPECIES[k].flowerSell + 1, Math.round(SPECIES[k].flowerSell * ECON.dryRatio));   // v0.7: every dried herb = 1.25× its fresh flower
for (const [k, r] of Object.entries(TINCTURE.recipes)) { const sp = SPECIES[k], f = econF(sp.tier);
  const per = Math.max(sp.flowerSell, DRYING[k]?.sell ?? Math.round(sp.flowerSell * ECON.dryRatio));   // a flower could be dried instead: beat that too
  for (const b of ['glycerin', 'vinegar']) r.sell[b] = Math.max(Math.ceil(ECON.margin * (r.n * per + BASES[b].price)), Math.round(r.sell[b] * f * ECON.tinc)); }
for (const [k, r] of Object.entries(STILL.recipes)) { const src = SPECIES[k] || TREES[k], f = SPECIES[k] ? econF(src.tier) : treeF(src.tier);
  const raw = r.n * (r.in ? src.fruitSell : src.seedSell); r.sell = Math.max(Math.ceil(ECON.margin * raw), Math.round(r.sell * f)); }
export const DRY_TIER_S = { basic: 40, epic: 60, legendary: 75, rare: 90, superrare: 110, ultra: 130, otherworld: 150 };
export const DRY_RATIO = ECON.dryRatio;   // v0.7: 1.25 (was 2.45)
for (const sp of Object.values(SPECIES)) { if (sp.noFlower) { delete DRYING[sp.id]; sp.dries = false; continue; } DRYING[sp.id] ??= { s: DRY_TIER_S[sp.tier], sell: Math.round(sp.flowerSell * DRY_RATIO) }; sp.dries = true; }
export const oilId = (sp) => 'oil_' + sp;
export const tinctureId = (sp, base) => `tinc_${base === 'vinegar' ? 'v' : 'g'}_${sp}`;
export const TINCTURE_NAMES = Object.fromEntries(Object.values(SPECIES).map((s) => [s.id, s.name]));

// Bag / stand items. v0.5: generated for every plant (seeds, fresh flowers, dried bundles, tinctures, oils); the
// v0.4 Basic items keep their exact names, prices and icons.
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); };
export const ITEMS = {};
for (const sp of Object.values(SPECIES)) {
  ITEMS['seed_' + sp.id] = { name: `${sp.name} Seeds`, sell: sp.seedSell, icon: ['seed', sp.color] };
  if (!sp.noFlower) ITEMS['flower_' + sp.id] = { name: sp.name, sell: sp.flowerSell, icon: [sp.icon || 'daisy', sp.color] };
  if (DRYING[sp.id]) ITEMS['dried_' + sp.id] = { name: `Dried ${sp.name}`, sell: DRYING[sp.id].sell, icon: ['bundle', shade(sp.color, 0.92)] };
  if (STILL.recipes[sp.id] && !STILL.recipes[sp.id].in) ITEMS[oilId(sp.id)] = { name: `${sp.name} Essential Oil`, sell: STILL.recipes[sp.id].sell, icon: ['dropper', shade(sp.color, 0.75)] };
  const tr = TINCTURE.recipes[sp.id];
  if (tr) { ITEMS[tinctureId(sp.id, 'glycerin')] = { name: `${sp.name} Glycerite`, sell: tr.sell.glycerin, icon: ['dropper', shade(sp.color, 1.05)] };
    ITEMS[tinctureId(sp.id, 'vinegar')] = { name: `${sp.name} Vinegar Tincture`, sell: tr.sell.vinegar, icon: ['dropper', shade(sp.color, 0.7)] }; }
}
// v0.4 originals (exact icons and colours kept)
Object.assign(ITEMS, {
  seed_lavender:  { name: 'Lavender Seeds',  sell: SPECIES.lavender.seedSell,  icon: ['seed', '#B9A6DC'] },
  seed_calendula:   { name: 'Calendula Seeds',   sell: SPECIES.calendula.seedSell,  icon: ['seed', '#F0A33A'] },
  seed_chamomile: { name: 'Chamomile Seeds', sell: SPECIES.chamomile.seedSell,  icon: ['seed', '#F3EFC9'] },
  flower_lavender:{ name: 'Lavender',        sell: SPECIES.lavender.flowerSell,  icon: ['spike', '#9C86C9'] },
  flower_calendula: { name: 'Calendula',  sell: SPECIES.calendula.flowerSell,  icon: ['daisy', '#F0A33A'] },
  flower_chamomile:{ name: 'Chamomile',      sell: SPECIES.chamomile.flowerSell, icon: ['daisy', '#FFFFFF'] },
  dried_lavender: { name: 'Dried Lavender',  sell: DRYING.lavender.sell, icon: ['bundle', '#A58BC9'] },
  oil_lavender:  { name: 'Lavender Essential Oil',  sell: STILL.recipes.lavender.sell,  icon: ['dropper', '#7E5FB0'] },
  oil_calendula: { name: 'Calendula Essential Oil', sell: STILL.recipes.calendula.sell,  icon: ['dropper', '#D9822B'] },
  oil_chamomile: { name: 'Chamomile Essential Oil', sell: STILL.recipes.chamomile.sell, icon: ['dropper', '#C9A43A'] },
  tinc_g_lavender:  { name: 'Lavender Glycerite',         sell: TINCTURE.recipes.lavender.sell.glycerin, icon: ['dropper', '#C7B3E6'] },
  tinc_v_lavender:  { name: 'Lavender Vinegar Tincture',  sell: TINCTURE.recipes.lavender.sell.vinegar, icon: ['dropper', '#9A7A9A'] },
  tinc_g_calendula:   { name: 'Calendula Glycerite',          sell: TINCTURE.recipes.calendula.sell.glycerin, icon: ['dropper', '#EDC15A'] },
  tinc_v_calendula:   { name: 'Calendula Vinegar Tincture',   sell: TINCTURE.recipes.calendula.sell.vinegar, icon: ['dropper', '#C08A3A'] },
  tinc_g_chamomile: { name: 'Chamomile Glycerite',        sell: TINCTURE.recipes.chamomile.sell.glycerin, icon: ['dropper', '#F3E7B5'] },
  tinc_v_chamomile: { name: 'Chamomile Vinegar Tincture', sell: TINCTURE.recipes.chamomile.sell.vinegar, icon: ['dropper', '#D2B67A'] },
});
// Most valuable first (oils, tinctures, dried, flowers, seeds) — the same order as v0.4 for the Basic items.
// v0.52 Hydrosols: like a real steam still, every essential-oil distillation gives two products: 1 oil + 1 hydrosol (the
// scented water) named after its plant — Damask Rose gives Rose Water. Hydrosol sells for 11% of that oil's price, Rose Water
// for 15% (a little more than other hydrosols, still far below rose oil). Only plants with an oil recipe can be distilled.
export const HYDROSOL = { share: 0.11, roseWater: 'damaskrose', roseShare: 0.19 };   // v0.7: Rose Water 15% → 19% so it stays the top flower hydrosol after the oil re-pricing
export const hydroId = (sp) => 'hydro_' + sp;
const hydroTint = (hex) => { const n = parseInt(hex.slice(1), 16), m = (v) => Math.round(v + (255 - v) * 0.55); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => m(v).toString(16).padStart(2, '0')).join(''); };
for (const [sp, r] of Object.entries(STILL.recipes)) {
  const rose = sp === HYDROSOL.roseWater, src = SPECIES[sp] || TREES[sp], nm = sp === 'eucalyptus' ? 'Eucalyptus' : src.name;
  if (r.in) ITEMS[oilId(sp)] = { name: `${nm} Essential Oil`, sell: r.sell, icon: ['dropper', shade(src.fruitC || src.color, 0.75)] };
  ITEMS[hydroId(sp)] = { name: rose ? 'Rose Water' : `${nm} Hydrosol`, sell: Math.round(r.sell * (rose ? HYDROSOL.roseShare : HYDROSOL.share)), icon: ['hydrosol', hydroTint(src.fruitC || src.color)], hydrosol: true };
}
// ---------------- v0.6 Sunflower seed bags ----------------
// A Sunflower harvest is 50 seeds (v0.65; was 100) (no flowers). Seeds sell for 1 coin each singly; a bag of 50 sells for 85 and a bag of 100
// for 200 (2 a seed) — about a fair Legendary harvest (e.g. Rosemary: ~2.5 flowers × 46 + 4 seeds × 19 ≈ 191).
export const SEED_BAGS = { sunflower: [{ n: 50, sell: 60 }, { n: 100, sell: 140 }] };   // v0.7: was 85 / 200
export const bagId = (sp, n) => `bag${n}_${sp}`;
for (const [sp, bags] of Object.entries(SEED_BAGS)) for (const b of bags) ITEMS[bagId(sp, b.n)] = { name: `${SPECIES[sp].name} Seeds · bag of ${b.n}`, sell: b.sell, icon: ['seedbag', SPECIES[sp].color], bag: b.n };
// ---------------- v0.6 fruit + crafting stands ----------------
for (const t of Object.values(TREES)) ITEMS[t.fruit] = { name: t.fruitName, sell: t.fruitSell, icon: [t.id === 'eucalyptus' ? 'leafbunch' : 'fruit', t.fruitC], fruit: t.id, glow: t.glow };
// Pressed Oil Stand: sell = round(n × input price × (1.7 + 0.25·(tier order − 1))), a little more for butters; Sunpetal Oil is special.
// Fruit Stand: sell = round(n × fruit price × (1.6 + 0.25·(tier order − 1)) × kind) with kind sauce/canned 1.0, jelly 1.08,
// butter/preserves 1.12; time 40 + 20·(o − 1) s. No market ingredient — fruit alone (simpler on a phone; see README).
const ordOf = (id) => PLANT_TIERS[(SPECIES[id] || TREES[id]).tier].order;
const R_ = (id, name, src, input, n, kind, icon, color, extra = {}) => ({ id, name, src, in: input, n, kind, icon, color, ...extra });
export const PRESS = { slots: 2, mult: (o) => 1.4 + 0.1 * (o - 1),   // v0.7: was 1.7 + 0.25·(o − 1)
  kinds: { oil: 1, butter: 1.06 }, recipes: [
  R_('sunoil', 'Sunflower Oil', 'sunflower', 'seed_sunflower', 30, 'oil', 'oilbottle', '#F2C53D', { sell: 80, s: 60, only: 'home' }),
  R_('sunbutter', 'Sun Butter', 'sunflower', 'seed_sunflower', 50, 'butter', 'butterjar', '#D9A441', { sell: 135, s: 90, only: 'home' }),   // v0.7.2: sunflower seeds grow at Home — Sunflower Oil & Sun Butter are Home press only
  R_('rosehip', 'Rosehip Oil', 'damaskrose', 'seed_damaskrose', 3, 'oil', 'oilbottle', '#D4553A', { s: 120, only: 'home' }),   // v0.68: rose hips come from Home roses — Home press only
  R_('olive', 'Olive Oil', 'olive', 'fruit_olive', 6, 'oil', 'oilbottle', '#B5B03A', { s: 120 }),
  R_('almondoil', 'Almond Oil', 'almond', 'fruit_almond', 6, 'oil', 'oilbottle', '#EAD3A8', { s: 120, only: 'orchard' }),   // v0.68: almonds grow on Orchard trees — Orchard Oil Press only
  R_('almondbutter', 'Almond Butter', 'almond', 'fruit_almond', 8, 'butter', 'butterjar', '#B9895A', { s: 150, only: 'orchard' }),
  R_('cocoa', 'Cocoa Butter', 'cacao', 'fruit_cacao', 4, 'butter', 'butterjar', '#F1E0C0', { s: 180 }),
  R_('sunpetal', 'Sunpetal Oil', 'sunpetal', 'seed_sunpetal', 2, 'oil', 'oilbottle', '#FFD86A', { sell: 640, s: 240, glow: 3 }),
] };
export const FRUITSTAND = { slots: 2, mult: (o) => 1.3 + 0.1 * (o - 1),   // v0.7: was 1.6 + 0.25·(o − 1)
  kinds: { sauce: 1, canned: 1, jelly: 1.08, butter: 1.12, preserves: 1.12 }, recipes: [
  R_('applesauce', 'Apple Sauce', 'apple', 'fruit_apple', 4, 'sauce', 'jar', '#E9C27A'),
  R_('applebutter', 'Apple Butter', 'apple', 'fruit_apple', 6, 'butter', 'jar', '#8A4A22'),
  R_('cannedpeach', 'Canned Peaches', 'peach', 'fruit_peach', 4, 'canned', 'can', '#F6A46B'),
  R_('peachbutter', 'Peach Butter', 'peach', 'fruit_peach', 6, 'butter', 'jar', '#D9783A'),
  R_('cherryjelly', 'Cherry Jelly', 'cherry', 'fruit_cherry', 4, 'jelly', 'jar', '#B8203A'),
  R_('cannedcherry', 'Canned Cherries', 'cherry', 'fruit_cherry', 5, 'canned', 'can', '#8E1A30'),
  R_('plumjam', 'Plum Jelly', 'plum', 'fruit_plum', 4, 'jelly', 'jar', '#6A3A7A'),
  R_('plumsauce', 'Plum Sauce', 'plum', 'fruit_plum', 4, 'sauce', 'jar', '#8A3A4A'),
  R_('lemoncurd', 'Lemon Curd', 'lemon', 'fruit_lemon', 3, 'jelly', 'jar', '#F5D547'),
  R_('marmalade', 'Lemon Marmalade', 'lemon', 'fruit_lemon', 4, 'jelly', 'jar', '#F0B830'),
  R_('figjam', 'Fig Jam', 'fig', 'fruit_fig', 3, 'jelly', 'jar', '#6B4E7A'),
  R_('figbutter', 'Fig Butter', 'fig', 'fruit_fig', 4, 'butter', 'jar', '#7A5A3A'),
  R_('pomjelly', 'Pomegranate Jelly', 'pomegranate', 'fruit_pomegranate', 3, 'jelly', 'jar', '#C0283A'),
  R_('persbutter', 'Persimmon Butter', 'persimmon', 'fruit_persimmon', 3, 'butter', 'jar', '#E07A20'),
  R_('moonpreserves', 'Moonpeach Preserves', 'moonpeach', 'fruit_moonpeach', 2, 'preserves', 'jar', '#FFE9C9', { glow: 3 }),
  R_('crystaljelly', 'Crystal Apple Jelly', 'crystalapple', 'fruit_crystalapple', 2, 'jelly', 'jar', '#CFEAFF', { glow: 3 }),
] };
for (const [C, pre] of [[PRESS, 'press_'], [FRUITSTAND, 'jar_']]) for (const r of C.recipes) {
  const o = ordOf(r.src), inSell = ITEMS[r.in].sell;
  r.item = pre + r.id; r.sell ??= Math.round(r.n * inSell * C.mult(o) * C.kinds[r.kind]); r.s ??= 40 + 20 * (o - 1); r.raw = r.n * inSell;
  ITEMS[r.item] = { name: r.name, sell: r.sell, icon: [r.icon, r.color], craft: true, glow: r.glow || (TREES[r.src] || SPECIES[r.src]).glow || 0 };
}
// v0.61: where each good can be SOLD. Fruit and Fruit Stand jars only at the Orchard Stand, pressed oils at both stands,
// everything else (flowers, herbs, tinctures, essential oils, teas, dried herbs, hydrosols, seeds, antiques) only at Home.
export const itemLoc = (id) => (id.startsWith('fruit_') || id.startsWith('jar_') ? 'orchard' : id.startsWith('press_') ? 'both' : 'home');
export const sellsAt = (id, loc) => { const w = itemLoc(id); return w === 'both' || w === loc; };
// v0.61: the Orchard Stand — the Orchard's selling stand (like the Home Farm Stand), built on its spot by the Orchard road
export const ORCH_STAND = { coins: 900, wood: 30, cap: 18 };   // v0.65: cap 12 → 18
// v0.61: Garden Workers (after every Home plot is bought). One per plot; a shift is 6 real hours (offline time counts).
// hire = the price of the last Home plot; wage = about a tenth of what a busy plot earns in 6 hours.
// v0.61: every crafting stand can also be unlocked with coins (no real money needed). In the order players reach them;
// only the next one on the ladder is offered. A Card Pack find (or the Tincture goal reward) is still the faster, luckier route.
export const STAND_UNLOCK = [{ id: 'tincture', coins: 3000 }, { id: 'still', coins: 7500 }, { id: 'teastand', coins: 15000 }, { id: 'press', coins: 24000 }];   // v0.7.2: ×3
// v0.67.1: Orchard tree-row Irrigation — each purchase drips one more row of tree spots (next row in order), up to every row you own.
export const TREE_IRRIG = { coins: 450 };
// v0.7: a hire lasts 1 real-time hour, then the worker stops and must be hired again for the same cost (wage = hire).
// v0.7.2: two hires per LOCATION (Home, the Orchard) at this price each: the Gardener (plants, harvests, waters, picks fruit on every
// plot there) and the Market Manager (runs every stand there, fills the stand). Each costs 2000 coins per 1 h shift, no extra wage.
export const WORKER = { hire: 2000, wage: 2000, shiftH: 1, stepS: 5, catchStepS: 120 };
const kindRank = (id) => ['oil_', 'press_', 'jar_', 'tea_', 'tinc_', 'hydro_', 'dried_', 'fruit_', 'flower_', 'bag', 'seed_'].findIndex((p) => id.startsWith(p));
export const SELL_ORDER = Object.keys(ITEMS).sort((a, b) => kindRank(a) - kindRank(b) || ITEMS[b].sell - ITEMS[a].sell || (a.startsWith('tinc_g') ? -1 : 1));

// ---------------- v0.52 Tea Stand ----------------
// Any THREE dried herbs (duplicates allowed) → one tea. o = the average tier order of the three (Basic 1 … Other World 7).
//   tea price = round( Σ dried sell × min(1.8, mult(o) × (three different plants ? 1 + distinct : 1)) ),  mult(o) = 1.2 + 0.1·(o − 1)
//   → 3 Basic ×1.20 · Epic ×1.30 · Legendary ×1.40 · Rare ×1.50 · Super Rare ×1.60 · Ultra ×1.70 · Other World ×1.80 (v0.7; capped at 1.8)
//   brew time = 15 + 10·(o − 1) s  → 15 s for Basic … 75 s for Other World.
// v0.7 TEA RULE: the multiplier runs 1.2 (Basic) … 1.8 (Other World) and, with the different-herbs bonus, never exceeds 1.8×
// the three dried herbs (was 1.4 … 3.5, +10%).
export const TEA = { slots: 2, n: 3, distinct: 0.10, max: 1.8, mult: (o) => 1.2 + 0.1 * (o - 1), brewS: (o) => Math.round(15 + 10 * (o - 1)) };
export const teaId = (sps) => 'tea_' + [...sps].sort().join('-');
export const teaSps = (id) => id.slice(4).split('-');
export function teaInfo(sps) {
  const sp = sps.map((k) => SPECIES[k]); if (sps.length !== TEA.n || sp.some((x) => !x || !DRYING[x.id])) return null;
  const ord = (x) => PLANT_TIERS[x.tier].order, o = sp.reduce((a, x) => a + ord(x), 0) / sp.length;
  const dried = sp.reduce((a, x) => a + DRYING[x.id].sell, 0), distinct = new Set(sps).size;
  const mult = Math.min(TEA.max, TEA.mult(o) * (distinct === 3 ? 1 + TEA.distinct : 1));
  const counts = {}; for (const x of sps) counts[x] = (counts[x] || 0) + 1;
  const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || ord(SPECIES[b]) - ord(SPECIES[a]) || sps.indexOf(a) - sps.indexOf(b)).map((k) => SPECIES[k].name);
  const top = [...sp].sort((a, b) => ord(b) - ord(a))[0];
  const name = o >= 6.5 ? `${top.name} Starlight Tea` : o >= 5.5 ? `${top.name} Moonlit Blend`
    : names.length === 1 ? `${names[0]} Tea` : names.length === 2 ? `${names[0]} & ${names[1]} Blend` : `${names[0]}, ${names[1]} & ${names[2]} Blend`;
  return { id: teaId(sps), name, sell: Math.min(Math.round(dried * mult), Math.floor(dried * TEA.max)), dried, mult, o, distinct, s: TEA.brewS(o), color: top.color, tier: Object.keys(PLANT_TIERS).find((t) => PLANT_TIERS[t].order === Math.round(o)) };
}
// teas are registered on demand (any 3 of 21 herbs = 1771 blends) so they behave like every other bag / stand item
export function registerTea(id) {
  if (ITEMS[id]) return ITEMS[id]; if (!id.startsWith('tea_')) return null;
  const t = teaInfo(teaSps(id)); if (!t) return null;
  ITEMS[id] = { name: t.name, sell: t.sell, icon: ['tin', t.color], tea: true };
  SELL_ORDER.push(id); SELL_ORDER.sort((a, b) => kindRank(a) - kindRank(b) || ITEMS[b].sell - ITEMS[a].sell || (a.startsWith('tinc_g') ? -1 : 1));
  return ITEMS[id];
}

export const WOOD = { tree: 3, stump: 1, bush: 0, rock: 0 };
export const BED_COSTS = [12, 20, 28, 36, 44, 52];   // wood per raised bed, escalating
export const STAND_CAP = 18;   // v0.65: was 12
// v0.65: customers may buy several kinds of item per visit; index = Farm Stand level − 1 (the Orchard Stand uses Lv1).
// kinds = [min, max] different items, upTo = most units of each. (Before v0.65: 1 kind, 40% → 2; up to 3 of each.)
export const STAND_BUY = { kinds: [[1, 3], [1, 3], [2, 3], [2, 4]], upTo: [3, 3, 4, 5] };
// v0.65: the Bulk Sell Box at each location — instant sale of extra goods at half the stand price (min 1 coin each).
export const BULK = { k: 0.5 };
export const MARKET_GOAL = 100;                        // coins earned at the stand to unlock the Rebuild Market project
export const WATER_REGEN_S = 30, WATER_REGEN_MAX = 12; // v0.63: +1 water every 30 s (was 60 s), Lv1 barrel holds 12 (was 10), offline too
// v0.63 WATER ECONOMY. A raised bed (3×3) pays water twice per grow cycle: to START growing and again to BUD (growth stalls
// at the end of the sprout stage until the bud water is in). Costs are in ninths of a water per plant ("units"), so a full bed
// of 9 plants pays stage[lv-1] water per stage. Hand watering pours 1 water (9 units) per tap into the bed; leftovers carry
// over (S.bedCredit). Beds hooked up to Irrigation pay the Irrigation card's level cost (hand or drip); other beds pay Lv1.
// Blue Lotus: 2 water to start (barrel half full after the 1st, full after the 2nd) and 2 to bud; Lv4 Irrigation: 1 water for the whole grow.
export const WATER = { unit: 9, budAt: 0.5, stage: [9, 7, 5, 3], lotus: [[18, 18], [14, 14], [10, 10], [5, 4]] };
// v0.63: rain barrel sizes — per barrel, bought with coins (+ wood / Scrap Metal at the top). The Brass Watering Can adds +5 to any size.
export const BARREL_LV = [
  { cap: 12 },
  { cap: 20, coins: 150 },
  { cap: 30, coins: 450, wood: 20 },
  { cap: 45, coins: 1200, wood: 40, scrap: 8 },
  { cap: 60, coins: 3000, wood: 80, scrap: 20 },
];
export const STARTER = { seed_lavender: 4, seed_calendula: 3 }, STARTER_FILL = 12;   // v0.4: no bag water — the starter pack fills the home barrel instead
export const STARTER_JEWELS = 3;

// ---------- v0.3: things you build ----------
export const BUILDS = {
  stand:  { name: 'Roadside Farm Stand', wood: 15, coins: 0, opt: { find: 'old_crate', label: 'Use an Old Crate as a display shelf (+4 shelf space)' } },
  rack:   { name: 'Drying Rack', wood: 10, coins: 0 },
  still: { name: 'Essential Oil Stand', wood: 25, coins: 0 },
  teastand: { name: 'Tea Stand', wood: 20, coins: 0 },   // v0.52
  press: { name: 'Pressed Oil Stand', wood: 20, coins: 0 },   // v0.6
  fruitstand: { name: 'Fruit Stand', wood: 0, coins: 0 },   // v0.61: free, built right away at the Orchard
  parking: { name: 'Parking Lot', wood: 20, coins: 0 },
  windmill: { name: 'Windmill', wood: 20, coins: 0, scrap: 5 },   // v0.52: + 5 Scrap Metal (and the 160-coin card price when bought)
  billboard: { name: 'Roadside Billboard', wood: 15, coins: 0 },
  tincture: { name: 'Tincture Stand', wood: 0, coins: 0 },   // v0.52: a free goal reward — placing it costs nothing
  market: { name: 'Rebuild the Supply Market', wood: 30, coins: 180, s: 60, opt: { scrap: 3, save: 60, label: 'Patch the roof with 3 Scrap (save 60 coins)' }, hurryJewels: 2 },
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
export const TREE = { growMin: 40, wood: 30, stump: 1, saplingBack: 0.5, stageAt: [0, 0.25, 0.6, 1], stageNames: ['Sapling', 'Young tree', 'Growing tree', 'Mature tree'], hurryJewels: 1 };
export const SHOP = { wood5: { wood: 5, price: 55 }, sapling: { price: 60 }, scrap5: { scrap: 5, price: 135 } };   // v0.52: Scrap Metal ×5 (recycling finds stays the cheap way)

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
  // v0.63: opt-in 'Watch Ad' — the player picks Coins, Wood or Scrap Metal first. NO cooldown and NO daily limit: watch as many
  // as you like, but the ad has to play to the end before anything is paid. Still offered after No More Ads (it's opt-in).
  rewarded: { watchMs: 5000, picks: { coins: 50, wood: 20, scrap: 5 } },
};

// Settings → Play Other Games. Add more entries here; status 'soon' | 'live' (live entries need a url).
// v0.6: follow Petalspire on social media. Each platform's button opens the page in a new tab and gives 1 Jewel, once per platform (saved).
export const SOCIALS = [
  { id: 'facebook', name: 'Facebook', handle: 'Petalspire', url: 'https://www.facebook.com/profile.php?id=61595699559019' },
  { id: 'instagram', name: 'Instagram', handle: '@petal_spire_game', url: 'https://www.instagram.com/petal_spire_game/' },
  { id: 'x', name: 'X', handle: '@petalspiregame', url: 'https://x.com/petalspiregame' },
];
export const FOLLOW_REWARD = 1;   // Jewels per platform
export const OTHER_GAMES = [
  { id: 'market_plot', name: 'Market Plot', status: 'soon', tagline: 'Invent it. Grow it. Sell it.',
    blurb: 'A solo sandbox farming game: invent new crops and handmade goods, then market them your way.',
    url: null,            // v0.66: set the store / play link here when Market Plot launches (status → 'live')
    wishlistUrl: null },  // v0.66: set a wishlist page here (Steam / App Store pre-order); null = the Wishlist button just remembers it in the save
];

export const JEWEL_BUNDLES = [
  { id: 'jewels_1',  n: 1,  price: '$0.99',  productId: 'com.petalspire.jewels.1' },
  { id: 'jewels_10', n: 10, price: '$6.99',  productId: 'com.petalspire.jewels.10' },
  { id: 'jewels_50', n: 50, price: '$29.99', productId: 'com.petalspire.jewels.50', best: true },
];

// v0.41: traffic features
// v0.52: customers arrive in groups. Per card level (Lv1…Lv4): parking spots on the lot, cars per arrival (each car is one
// customer) and the multiplier on the gap between arrivals (base 15–30 s, no lot = 1 car, gap counted from when it leaves).
export const PARKING = { spots: [2, 3, 4, 6], cars: [2, 2, 3, 3], gapMult: [1.4, 1.2, 1.25, 1.15], extraItem: 0.3 };
export const parkLv = (lv) => Math.max(1, Math.min(4, lv || 1)) - 1;
export const WINDMILL = { regenS: [15, 13, 11, 10] };   // v0.63: base refill is now 30 s (was 60), so the Windmill is 15/13/11/10 s (was 20/18/17/15)
export const BILLBOARD = { boostMs: 5 * 60000, cooldownMs: 60 * 60000, mult: 2, jewels: 1 };  // Run ad: 2× traffic for 5 min · free, then a 1 h cool-off after each run (v0.65) · 1 Jewel runs another
export const TIPS = {
  parking: 'Your <b>Parking Lot</b> is open! Customers now come in <b>groups of 2 cars</b> — each car is a customer. Stack Parking Lot cards to level it up: more spots (2 → 3 → 4 → 6), bigger groups and shorter gaps. Some customers buy an extra item.',
  windmill: 'Your <b>Windmill</b> is turning! Every rain barrel that’s connected to a stand now refills every <b>15 s</b> instead of 30 s (faster with card levels).',
  billboard: 'Your <b>Billboard</b> is up! Tap it and <b>Run ad</b> for twice the traffic for 5 minutes. It’s free, then the Billboard cools off for 1 hour after each ad; while it cools off you can spend 1 Jewel to run another.',
  chop: 'An old wooded lot. <b>Tap a tree</b> to chop it down — you’ll get <b>Wood</b>.',
  stump: 'Stumps stay behind. <b>Tap a stump</b> to dig it out and clear the ground.',
  find: 'Something glints! <b>Tap the sparkle</b> to pick up what you found.',
  finds: 'Found items go to <b>Bag → Finds</b>. <b>Restore</b> them into something useful, or <b>recycle</b> them.',
  sapling: 'A <b>tree sapling</b>! Trees grow only in the <b>Orchard</b> — it waits in your <b>Orchard Bag</b>; plant it on open Orchard ground. Trees grow slowly but give lots of Wood.',
  build: 'Nice clearing! Tap <b>Build</b> and place a <b>raised bed</b> on a fully cleared patch.',
  standbp: 'Next: build your <b>Farm Stand</b> by the road. Tap the glowing blueprint or open <b>Build</b>.',
  water: 'Seeds need a drink. <b>Tap the planted tile</b> and water it.',
  growing: 'It’s growing! <b>Drag</b> to move around, <b>pinch</b> to zoom, <b>twist two fingers</b> to turn.',
  bloom: 'A bloom! <b>Tap the sparkling plant</b> to harvest it.',
  harvested: 'Harvests give flowers <i>and</i> seeds. Put spares on your <b>Farm Stand</b> by the road.',
  stand: 'Your <b>Farm Stand</b> is built! Tap it to stock flowers — drivers will pull over to buy.',
  barrel: 'Each <b>rain barrel</b> refills by <b>1 water every 30 s</b> (up to 12 — tap it to upgrade its size), even while the game is closed — the badge shows when the next drop lands. Hand watering uses the bed’s own plot barrel first, then the nearest other barrel. Water only comes from rain barrels.',
  plotbarrel: 'This plot has no rain barrel yet. Build a <b>Rain Barrel</b> from the Build menu (120 coins) and place it here: its own water for irrigation, up to <b>8 beds</b> (this plot and the one behind it). A barrel only collects rain through a gutter from a <b>stand on the same plot</b> (Tincture or Essential Oil Stand) — it connects automatically. Until then, hand watering borrows from your nearest barrel. <b>Goal reward:</b> a free <b>Tincture Stand</b> — place it on that plot and its roof feeds the barrel.',
  sickle: 'You own the <b>Harvest Sickle</b>! Wherever you have raised beds, tap the sickle button on the left, then tap a glowing raised bed to harvest every ripe plant in that bed at once.',
  plow: 'You own the <b>Hand Plow</b>! Wherever you have raised beds, tap the plow button on the left, pick a seed, then tap a glowing raised bed to plant every empty tile in that bed.',
  oils: 'The <b>Essential Oil Stand</b> is an Epic card: find it in a Card Pack, buy it at the Supply Market (450 coins), then build it (25 Wood) on one of your <b>other plots</b>. It distills <b>seeds</b> into oils worth far more than the seeds.',
  teastand: 'Your <b>Tea Stand</b> is ready! Tap it, pick any <b>three dried herbs</b> (duplicates allowed) and brew a tea — the predicted price shows as you pick. Rarer herbs make far pricier teas; three different herbs add 10%. Teas sell at your Farm Stand.',
  press: 'Your <b>Pressed Oil Stand</b> is ready! Tap it and pick a recipe — Sunflower seeds become <b>Sunflower Oil</b> or <b>Sun Butter</b>; Damask Rose seeds, olives, cacao and Sunpetal seeds make richer oils.',
  fruitstand: 'Your <b>Fruit Stand</b> is ready! Tap it to cook orchard fruit into <b>jellies, butters, sauces and canned fruit</b> — each sells for well above the raw fruit.',
  orchard: 'Welcome to <b>The Orchard</b>! Fruit-tree cards are in Card Packs now. Buy saplings at the Supply Market and plant them on the tree spots. Build beds and a rain barrel here too (the shed roof feeds it). Tap <b>Map</b> to go home: both places keep growing.',
  still: 'Your <b>Essential Oil Stand</b> is ready! Distill <b>seeds</b> into essential oils (10 seeds each, e.g. 10 Lavender, Calendula or Chamomile seeds) — oils sell for a premium at the Farm Stand, far more than the seeds. Each distillation also leaves a <b>hydrosol</b> (Rose Water from Damask Rose) — a small extra to sell.',
  tincture: 'Your <b>Tincture Stand</b> is ready! Steep flowers with <b>Glycerin</b> or <b>Vinegar</b> — find their cards in Card Packs, then buy them at the Supply Market — tinctures sell for far more at the Farm Stand.',
  customer: 'A customer! They’ll pick what they want from your stand and pay in coins.',
  lavender: 'You can now build a <b>Drying Rack</b> (Build). Dried Lavender sells for almost 3× fresh.',
  rebuild: 'Your stand has earned enough to <b>rebuild the Supply Market</b>. Tap the old cottage or open Build.',
  market: 'The <b>Supply Market</b> is open — seeds, a <b>water truck</b> to fill your rain barrels, <b>Wood bundles</b>, <b>saplings</b> and Card Packs (<b>1 Jewel</b> each).',
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
  // v0.52: built objects shade along the rendered shadow instead of in a circle. light = the scene's DirectionalLight
  // (world.js: sunDir (-0.75, 0.32, -0.58) · 26 with y = 14): dir = ground direction toward the sun, k = shadow length
  // per unit of height (24.6 / 14). Boxes are the renderer's own shadow-casting mesh bounds (measured from world.js):
  // dx/dz = footprint centre offset from the object's spot, hx/hz = half sizes, h = height, w = shadow strength.
  light: { dir: [-0.791, -0.612], k: 1.76, soft: 0.18 },
  boxes: {
    stand:     { dx: 0.24,  dz: 0.08, hx: 1.69, hz: 0.71, h: 2.77, w: 0.6 },
    market:    { dx: 0.05,  dz: 0.22, hx: 1.63, hz: 1.45, h: 2.81, w: 0.6 },
    rack:      { dx: 0,     dz: 0,    hx: 1.06, hz: 0.79, h: 1.82, w: 0.45 },
    tincture:  { dx: -0.01, dz: 0.04, hx: 1.1,  hz: 0.79, h: 1.96, w: 0.55 },
    still:     { dx: 0.01,  dz: 0.04, hx: 1.1,  hz: 0.75, h: 1.96, w: 0.55 },
    teastand:  { dx: 0,     dz: 0.04, hx: 1.05, hz: 0.75, h: 2.0,  w: 0.55 },
    press:      { dx: -0.1,  dz: 0.0,  hx: 1.0,  hz: 0.55, h: 2.4,  w: 0.5 },    // v0.6
    fruitstand: { dx: 0,     dz: 0.04, hx: 1.05, hz: 0.75, h: 2.0,  w: 0.55 },   // v0.6
    windmill:  { dx: 0,     dz: 0,    hx: 0.75, hz: 0.75, h: 3.6,  w: 0.6 },   // tower + cap (the open sails add ~0.5 height)
    billboard: { dx: 0,     dz: 0.07, hx: 1.68, hz: 0.37, h: 3.73, w: 0.5 },
    hive:      { dx: 0,     dz: 0,    hx: 0.32, hz: 0.32, h: 0.9,  w: 0.45 },
    barrel:    { dx: 0,     dz: 0,    hx: 0.36, hz: 0.36, h: 1.05, w: 0.45 },
  },
  slowerBelow: 0.95,              // sun under this shows 'growing slower'
  muchSlowerBelow: 0.3,
};

// ---------------- v0.66: monetization + studio ----------------
// Opt-in boost offers: a small badge offers a rewarded ad right after a moment that matters (a harvest, a stand sale, watering
// a new plant). Offered now and then, never constantly: one offer at most every cooldownMs, only `chance` of eligible moments,
// and it slips away after showMs. They use the same rewarded-ad flow as Watch Ad (the ad has to play to the end).
export const BOOSTS = {
  cooldownMs: 4 * 60000, showMs: 20000, chance: 0.5, minHarvests: 3,
  kinds: {
    harvest: { name: 'Double Harvest', icon: 'sprout' },   // doubles the flowers and seeds of the harvest you just picked
    sale:    { name: 'Double Sale',    icon: 'coin', minCoins: 20 },   // doubles the coins of the stand sale that just happened
    grow:    { name: 'Fast-Grow',      icon: 'sparkle', minLeftS: 60 },  // the plant you just watered is ready to pick right away
  },
};
// v0.67 REAL-MONEY PACKS. PRICES ARE PLACEHOLDERS for the iPhone App Store products (productId). The web build has NO real
// payments: Payments.purchaseOffer refuses on the web, so nothing is charged and nothing is granted here (soft wording in the UI).
// Contents: jewels, coins, wood, packs (Botanical Card Packs, opened free), tools (Hand Plow / Harvest Sickle), plantsPerTier
// (1 random plant of EACH tier: its card + seedsPerPlant seeds), saplings (fruit-tree saplings for the Orchard).
// Value = coin-equivalent (1 Jewel = 1,000 coins as in the Jewel trade, 1 Wood = 4 coins, a Card Pack = 1 Jewel, tools at their
// Market price, a plant = seedsPerPlant x its tier's average seed price + its card at 2x that, a sapling = 140 coins). Bigger packs
// give more value per dollar. The Jewel Shop lists them highest value first. once: true = can be bought only once.
// The Starter Pack pops up once, right after the beginning goals are done (the closing card), and stays in the Jewel Shop after.
export const OFFER_PACKS = [
  { id: 'starter_pack', productId: 'com.petalspire.starter2', name: 'Starter Pack', blurb: 'A gift bouquet of everything inside: a plant from every tier, the Plow and Sickle, Jewels, coins and Wood', price: '$4.99', usd: 4.99, once: true, starter: true,
    jewels: 20, coins: 1000, wood: 100, tools: ['plow', 'sickle'], plantsPerTier: 1, seedsPerPlant: 3 },
  { id: 'collector_bundle', productId: 'com.petalspire.collector', name: 'Collector’s Bundle', blurb: 'A grand gift bouquet: everything in the Starter Pack, a glowing Other World plant, more Jewels, coins and Wood, and Double Daily Rewards for good', price: '$19.99', usd: 19.99,
    plantsPerTier: 1, plantTier: 'otherworld', seedsPerPlant: 3, jewels: 120, coins: 6000, wood: 400, tools: ['plow', 'sickle'], dailyX2: true },
];
// A tool the player already owns is swapped for TOOL_SUB_JEWELS Jewels (a fair substitute).
export const TOOL_SUB_JEWELS = 2;
// coin equivalents. Double Daily Rewards is valued as 30 days of doubled gifts (≈ the average daily gift x 30).
export const OFFER_VALUE = { jewel: 1000, wood: 4, pack: 1000, sapling: 140, gardenerPerH: 2000 / 6, truck: 40, dailyX2: 30 };
export const STARTER_PACK = OFFER_PACKS[0];
// The studio. Logos live in assets/studio (copied from the Schwarze Spiele brand kit).
export const STUDIO = {
  name: 'Schwarze Spiele',
  logo: 'assets/studio/schwarze-spiele-logo.png', logoWhite: 'assets/studio/schwarze-spiele-logo-white.png', icon: 'assets/studio/schwarze-spiele-icon.png',
};
// Cross-promo card ('More from Schwarze Spiele'): always in Settings; also offered once after a session milestone
// (all Home plots, the Orchard, every 50th harvest) — at most every minGapMs, maxShows in all, never before firstAfterMs of play.
export const CROSS_PROMO = { gameId: 'market_plot', firstAfterMs: 20 * 60000, minGapMs: 3 * 864e5, maxShows: 3 };

// v0.7.2: coin costs ×3 (sell prices unchanged)
for (const sp of Object.values(SPECIES)) sp.seedPrice *= 3;
for (const f of Object.values(FEATURES)) if (f.price) f.price *= 3;
