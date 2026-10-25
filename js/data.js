// Petalspire v0.31 — game data
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
  irrigation: {
    id: 'irrigation', name: 'Irrigation', rarity: 'uncommon', type: 'Feature · Water',
    price: 45, stats: { Growth: 4, Beauty: 2, Yield: 3, Atmosphere: 2 },
    blurb: 'Assign it to one raised bed: a drip line from the rain barrel waters that bed’s thirsty plants for you (1 water each). Each card covers one bed.',
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
export const MARKET_GOAL = 100;                        // coins earned at the stand to unlock the Rebuild Market project
export const WATER_REGEN_S = 60, WATER_REGEN_MAX = 10; // rain barrel by the stand: +1 water per minute (v0.31), offline too
export const STARTER = { seed_heartvine: 4, seed_sunpetal: 3, water: 10 };
export const STARTER_JEWELS = 3;

// ---------- v0.3: things you build ----------
export const BUILDS = {
  stand:  { name: 'Roadside Farm Stand', wood: 15, coins: 0, opt: { find: 'old_crate', label: 'Use an Old Crate as a display shelf (+4 shelf space)' } },
  rack:   { name: 'Drying Rack', wood: 10, coins: 0 },
  market: { name: 'Rebuild the Supply Market', wood: 30, coins: 60, s: 60, opt: { scrap: 3, save: 20, label: 'Patch the roof with 3 Scrap (save 20 coins)' }, hurryJewels: 2 },
};
export const BUILD_ANIM_MS = 2450;

// ---------- v0.3: found items (seeded ~22% of trees, stumps, bushes and rocks hide one) ----------
export const FIND_CHANCE = 0.22, SAPLING_CHANCE = 0.12;   // sapling chance applies to wild trees only
export const FINDS = {
  watering_can: { name: 'Rusty Watering Can', restore: { wood: 2, coins: 5, s: 30 }, recycle: { scrap: 2 },
    into: { name: 'Brass Watering Can', bonus: 'can', blurb: 'Rain barrel refills twice as fast (1 water / 30 s) and holds 15' } },
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

export const TIPS = {
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
  barrel: 'The <b>rain barrel</b> by the road refills your watering can by <b>1 water a minute</b> (up to 10), even while the game is closed.',
  customer: 'A customer! They’ll pick what they want from your stand and pay in coins.',
  heartvine: 'You can now build a <b>Drying Rack</b> (Build). Dried Heartvine sells for almost 3× fresh.',
  rebuild: 'Your stand has earned enough to <b>rebuild the Supply Market</b>. Tap the old cottage or open Build.',
  market: 'The <b>Supply Market</b> is open — seeds, water, <b>Wood bundles</b>, <b>saplings</b> and Card Packs.',
  pack: 'Discovered cards unlock new items in the Supply Market — buy them with coins.',
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
  buildings: { stand: { w: 0.35, reach: 2.6 }, market: { w: 0.55, reach: 3.4 }, rack: { w: 0.2, reach: 2.0 } },
  slowerBelow: 0.95,              // sun under this shows 'growing slower'
  muchSlowerBelow: 0.3,
};
