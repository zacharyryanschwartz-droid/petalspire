// Petalspire v0.2 — game data
export const SPECIES = {
  heartvine: {
    id: 'heartvine', name: 'Heartvine', rarity: 'common', type: 'Plant · Climbing vine',
    growS: 35, seedPrice: 6, flowerSell: 5, seedSell: 3, yieldF: [2, 3], yieldS: [1, 2],
    color: '#F7C5C5', img: 'assets/card-heartvine.jpg',
    stats: { Growth: 4, Beauty: 3, Yield: 4, Atmosphere: 2 },
    blurb: 'Blush, heart-shaped leaves on a twisting vine. Dries beautifully on the rack.',
  },
  sunpetal: {
    id: 'sunpetal', name: 'Spiral Sunpetal', rarity: 'uncommon', type: 'Plant · Golden spire',
    growS: 50, seedPrice: 10, flowerSell: 9, seedSell: 5, yieldF: [2, 3], yieldS: [1, 2],
    color: '#F5D07A', img: 'assets/card-sunpetal.jpg',
    stats: { Growth: 3, Beauty: 4, Yield: 3, Atmosphere: 3 },
    blurb: 'Golden petals unfurl in a perfect spiral, catching the evening light.',
  },
  moonflower: {
    id: 'moonflower', name: 'Moonflower', rarity: 'rare', type: 'Plant · Night-bloom',
    growS: 80, seedPrice: 18, flowerSell: 24, seedSell: 9, yieldF: [1, 2], yieldS: [1, 1],
    color: '#FFF6E6', img: 'assets/card-moonflower.jpg',
    stats: { Growth: 2, Beauty: 5, Yield: 2, Atmosphere: 5 },
    blurb: 'A white trumpet bloom that glows softly, as if holding a little moonlight.',
  },
};

export const FEATURES = {
  rainbarrel: {
    id: 'rainbarrel', name: 'Rain Barrel', rarity: 'uncommon', type: 'Feature · Water',
    stats: { Growth: 3, Beauty: 2, Yield: 3, Atmosphere: 3 },
    blurb: 'Unlocks Rain Barrel water in the market: 15 water for 10 coins.',
  },
  beehive: {
    id: 'beehive', name: 'Honeybee Skep', rarity: 'epic', type: 'Feature · Pollinators',
    price: 60, stats: { Growth: 3, Beauty: 3, Yield: 5, Atmosphere: 4 },
    blurb: 'Once bought, busy bees add +1 flower to every harvest.',
  },
  sundial: {
    id: 'sundial', name: 'Golden Sundial', rarity: 'legendary', type: 'Feature · Time',
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
};

export const PACK_PRICE = 40;
export const DUP_COINS = 8;
export const RACK_SLOTS = 3;
export const DRY_S = 40;
export const WATER_PRICE = 5;      // for 5
export const BARREL_PRICE = 10;    // for 15

export const ITEMS = {
  seed_heartvine:  { name: 'Heartvine Seeds',  sell: 3,  icon: ['seed', '#F2A9AE'] },
  seed_sunpetal:   { name: 'Sunpetal Seeds',   sell: 5,  icon: ['seed', '#EDC15A'] },
  seed_moonflower: { name: 'Moonflower Seeds', sell: 9,  icon: ['seed', '#D8E6EC'] },
  flower_heartvine:{ name: 'Heartvine',        sell: 5,  icon: ['heart', '#F2A9AE'] },
  flower_sunpetal: { name: 'Spiral Sunpetal',  sell: 9,  icon: ['sun', '#EDC15A'] },
  flower_moonflower:{ name: 'Moonflower',      sell: 24, icon: ['moon', '#FFFFFF'] },
  dried_heartvine: { name: 'Dried Heartvine',  sell: 14, icon: ['bundle', '#C99A8E'] },
};
export const SELL_ORDER = ['dried_heartvine', 'flower_moonflower', 'flower_sunpetal', 'flower_heartvine', 'seed_moonflower', 'seed_sunpetal', 'seed_heartvine'];

export const WOOD = { tree: 3, stump: 1, bush: 0, rock: 0 };
export const BED_COSTS = [12, 20, 28, 36, 44, 52];   // wood per raised bed, escalating
export const STAND_CAP = 12;
export const MARKET_GOAL = 100;                        // coins earned at the stand to reopen the Supply Market
export const WATER_REGEN_S = 20, WATER_REGEN_MAX = 10; // rain barrel by the stand
export const STARTER = { seed_heartvine: 4, seed_sunpetal: 3, water: 10 };

export const TIPS = {
  chop: 'An old wooded lot. <b>Tap a tree</b> to chop it down — you’ll get <b>Wood</b>.',
  stump: 'Stumps stay behind. <b>Tap a stump</b> to dig it out and clear the ground.',
  build: 'Nice clearing! Tap <b>Build</b> and place a <b>raised bed</b> on a fully cleared patch.',
  water: 'Seeds need a drink. <b>Tap the planted tile</b> and water it.',
  growing: 'It’s growing! <b>Drag</b> to look around, <b>pinch</b> to zoom.',
  bloom: 'A bloom! <b>Tap the sparkling plant</b> to harvest it.',
  harvested: 'Harvests give flowers <i>and</i> seeds. Put spares on your <b>Farm Stand</b> by the road.',
  stand: 'Your <b>Farm Stand</b> is open! Tap it to stock flowers — drivers will pull over to buy.',
  barrel: 'The <b>rain barrel</b> by the stand slowly refills your watering can.',
  customer: 'A customer! They’ll pick what they want from your stand and pay in coins.',
  heartvine: 'A <b>Drying Rack</b> appeared! Dried Heartvine sells for almost 3× fresh.',
  market: 'The <b>Supply Market</b> reopened — buy seeds, water and Card Packs there.',
  pack: 'Discovered cards unlock new items in the Supply Market — buy them with coins.',
  plot: 'The woods around you are <b>for sale</b>. Tap a <b>For Sale</b> sign to expand.',
  plotbought: 'New land! Clear its trees for Wood and room for more beds.',
};
