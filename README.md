# Petalspire v0.4

A cozy 3D flower-garden prototype for iPhone Safari (portrait, one thumb). Also plays on desktop with a mouse.
This is a **prototype**: version numbers stay below 1.0 until the first official release.

**Play:** https://zacharyryanschwartz-droid.github.io/petalspire/

## v0.3 loop
1. **The woods.** Tap trees to chop them (+3 Wood), then tap the stumps (+1 Wood). About 1 in 5 obstacles hides a **find**: a sparkle appears where it stood, and you tap it to pick it up. Trees sometimes drop a **sapling**.
2. **Finds** (Bag → Finds). Each find can be **Restored** for a small cost and some waiting time (20–45 s, or 1 Jewel to finish now) or **Recycled** for Wood, coins or Scrap.
   - 10 kinds. Restored decor (planter, lantern, bench, gnome, trellis, bottle chime, weathervane) can be placed on your land and raises **atmosphere**, which brings customers sooner.
   - Watering Can: faster water. Wheelbarrow: +1 Wood per tree. Old Crate: +4 stand shelf.
3. **Raised beds.** Build → Raised bed (12 Wood). The first bed brings the home rain barrel (filled by the Starter Seed Pack), so water can never run out. Other plots get their own barrel from the Supply Market.
4. **Build it yourself.**
   - After your first bed, a glowing **Farm Stand blueprint** appears by the road. It costs 15 Wood; adding an Old Crate is optional. A scaffold rises, sawdust flies, and the stand is done.
   - The **Drying Rack** (10 Wood) becomes buildable after your first Lavender harvest.
   - The Build menu lists every structure with its cost and whether it is locked.
5. **Rebuild the Supply Market.** Once you've earned 100 coins at the stand, the boarded-up market can be rebuilt for 30 Wood + 60 coins (3 Scrap saves 20 coins). It goes boarded → scaffold (60 s, or 2 Jewels) → open. It sells seeds, Rain Barrels for your plots, garden features, Card Packs, a **bundle of 5 Wood (12 coins)** and **saplings (20 coins)**.
6. **Grow trees.** Plant a sapling on cleared ground you own (not in beds). It grows through four stages over **40 minutes of real time**, and keeps growing while the game is closed. Chop a mature tree for 6 Wood; it leaves a stump (+1) and has a 50% chance to drop a new sapling.
7. **Land for sale.** Five wooded plots, each with a floating For Sale sign: 150 → 300 → 600 → 1000 → 1500 coins.

Drag with one finger to pan, pinch to zoom, and twist with two fingers to turn. On desktop, right-drag or shift-drag turns the view.

## New in v0.4
- **Real plants only.** The garden now grows real plants, with the same gameplay roles as before:

    | Plant | Rarity | Blooms in | Seed price | Flower sells | Notes |
    |---|---|---|---|---|---|
    | Lavender (purple spikes) | Common | 35 s | 6 | 5 | Starter herb; dries on the rack into Dried Lavender (14) |
    | Calendula (orange-gold daisy blooms) | Uncommon | 50 s | 10 | 9 | Calendula Glycerite / Vinegar Tincture |
    | Chamomile (small white daisies, yellow centres) | Rare | 80 s | 18 | 24 | Chamomile Glycerite / Vinegar Tincture |

  - New 3D models (lavender spikes over grey-green leaves, orange double daisies, feathery chamomile with white daisies) and new card art. No glows on plants.
  - Saves are migrated automatically: old plant ids map to Lavender, Calendula and Chamomile everywhere (seeds, flowers, dried goods, tinctures, planted tiles, stand stock, cards).
  - Plant data is one entry per species in `SPECIES` (`js/data.js`) plus one model builder in `js/plants.js`, so the full catalog can be added later. A reserved **Ultra Rare** rarity (weight 0) exists for the earlier fantasy plants, which are kept disabled in `FANTASY_SPECIES` (not in packs, Market or starter content).
- **Harvest Sickle** (Rare tool card, 100 coins at the Market once found). Tap the Sickle button (left side, or Use in the Bag/Market), then tap a plot: every ripe plant in every bed on that plot is harvested with a sweeping blade and items fly to the Bag. Unripe plants are skipped; normal yields and seeds apply. Reusable, with a 20 s rest.
- **Hand Plow** (Rare tool card, 110 coins at the Market once found). Tap the Plow, pick a seed, then tap a plot: every empty bed tile there is planted in order, as far as your seeds go (e.g. "Planted 9 / 12 (out of seeds)"), with a furrow animation. Beds only. Reusable, with a 20 s rest.
- **Plant tiers (data only for now):** `PLANT_TIERS` in `js/data.js`, lowest → highest: Basic, Epic, Legendary, Rare, Super Rare, Ultra Rare, Other World. Each tier sets seeds per harvest (Basic 5 · Epic 4–5 · Legendary 4 · Rare 3–4 · Super Rare 2–3 · Ultra Rare 2 · Other World 1, 25% chance of 2) plus placeholder multipliers for pack drop weight, grow time, cost and sell price. Lavender, Calendula and Chamomile are Basic; the disabled fantasy plants are Ultra Rare / Other World. Plant cards show their tier; feature/tool cards keep their Common…Legendary frame.
- **Beehives are placed, and boost only their own plot.** The Honeybee Skep (Epic feature card, **60 coins** at the Market) is now a placeable skep: after buying, tap cleared ground on an owned plot (not a bed). Its bees give **+1 flower per harvest** (the old effect) but only to beds on that plot. Boosted beds get a soft honey tint and a 🐝 marker, and plant info shows "🐝 Bees: +40% flowers" (Lavender/Calendula +40%, Chamomile +67% of an average harvest). **One hive per plot**, no stacking; the Market keeps selling hives while an owned plot still lacks one. Seeds are unaffected.
- **Card stacks & upgrades.** Every copy of a card now stacks on one card with a ×n badge (Bag → Cards; pack reveals say "Stacked ×n"). At **3 / 6 / 10 copies** a plant or tool card glows and shows **Upgrade**; tap it to level up (Lv2 / Lv3 / Lv4 max). Copies are **kept as progress**, never spent.
  - Plants, per level: +10% sell price (flowers and that plant's dried goods / tinctures), −5% grow time, +1 Beauty/Yield pip on the card; Lv4 also adds +1 flower per harvest. **Seeds per harvest never change** (they follow the tier).
  - Sickle and Plow: −15% rest per level.
  - Each extra Irrigation card is one more irrigated bed. Other feature cards just stack. A copy of an already-maxed card pays the old duplicate coins.
  - Thresholds and boosts live in `CARD_LEVELS` in `js/data.js`. The level shows on the card and in plant info.
- **One rain barrel per plot. Water only comes from rain barrels.**
  - Water is no longer sold. The Market's "Watering can refill" and "Rain Barrel water" items are gone, and there is no bag water.
  - The home plot's barrel is still free with your first raised bed. The Starter Seed Pack now fills it to 10 instead of giving 10 bag water.
  - A bought plot gets its barrel from the Supply Market: **Rain Barrel, 40 coins** (unlocked by the Rain Barrel card in the Starter Pack). Buying it gives a placeable barrel. Tap open ground in an owned plot that has no barrel to place it.
  - The rule is one barrel per plot. The Market only offers a barrel while one of your plots still needs it, and the Build menu shows which plots need one.
  - Each barrel has its own water: 1 per minute, cap 10 (the Brass Watering Can makes it 30 s and cap 15). Each refills independently, including while the game is closed.
- **Live countdown.** A badge floats above each barrel, e.g. "7/10 · next in 0:42", or "10/10 · Full", plus "Feeds 2/4 beds".
  - It ticks every second, shrinks when zoomed out, and fades when zoomed far out.
  - Tap a barrel to open its sheet. It shows the same countdown and the connected beds, each with an **Unhook** button.
- **4 beds per barrel.**
  - Irrigated beds drink only from their own plot's barrel. Hoses run inside the plot to the bed side that faces the barrel.
  - A barrel feeds at most 4 beds in its plot. A 5th is refused with "This barrel already feeds 4 beds. Build another plot's barrel or unhook a bed".
  - Every plot has exactly 4 bed patches, so the cap is a safety rule that normal play does not reach.
  - Unhook a bed from its tile sheet or from the barrel sheet. The Irrigation card becomes spare again.
- **Hand watering.** It uses the bed's own plot barrel first, then the nearest other barrel that has water. Barrels always refill, and the home barrel is free, so you can't get stuck.
- **Tincture Stand** (Rare feature card): found in a Card Pack, then bought at the Supply Market for 120 coins, then built from the Build menu.
  - The build costs 20 Wood, or 14 Wood if you add your restored Glass Bottles (Bottle Chime). It goes up with a scaffold animation.
  - It has 2 flasks. Each craft uses 1 base plus flowers, and flasks keep steeping while the game is closed. Sell the results at the Farm Stand.

    | Recipe | Steep time | Glycerite | Vinegar Tincture |
    |---|---|---|---|
    | 2 Lavender | 90 s | 42 | 36 |
    | 2 Calendula | 2 min | 52 | 46 |
    | 1 Chamomile | 2.5 min | 80 | 72 |

  - Bases are sold at the Supply Market:
    - Glycerin: 8 coins each, or 5 for 32.
    - Vinegar: 6 coins each, or 5 for 24.
  - Pick the base in the stand's panel. With neither base, crafting is disabled with "Needs Glycerin or Vinegar: buy at the Market".
  - New goals: "Give a bought plot its own Rain Barrel" and "Make a tincture".
- **Save migration (v0.3 / v0.31 → v0.4).** Saves from v0.3 and v0.31 load into v0.4 automatically and are re-tagged `build: '0.4'`.
  - Your barrel becomes the home plot's barrel.
  - Banked bag water is poured into it up to the cap. Anything over the cap is lost, and a toast tells you how much.
  - Irrigation outside the home plot (or beyond 4 beds) is unhooked with a toast.
  - Old plant ids become Lavender / Calendula / Chamomile.
  - An old global beehive becomes a placed hive on the Home plot.
  - Every card you'd already found becomes a ×1 Lv1 stack (Irrigation counts the cards you owned).

## New in v0.31
- **Shade slows growth.** Every standing tree (wild, planted or the background woods) and every building (stand, market, rack) casts shade in a circle around it. Bigger and closer casters shade more, and casters on the golden-hour (north-west) side count most. Stumps cast none.
  - Model: `shade = Σ weight · (1 − dist/reach)^1.3 · (0.4 + 0.6 · sunSide)`, clamped to 0–100%; `sun = 1 − shade`.
  - Growth speed = 25% + 75% × sun, so **full shade grows 4× slower**. This applies to bed plants and saplings, and to offline catch-up.
  - Shaded tiles get a soft dappled overlay. Tile and tree info shows "Sun: 40% · growing slower", and the Build preview labels every patch with its Sun %.
  - Shade is recomputed whenever a tree is chopped, planted or grows a stage, or a building or bed is placed. Progress is kept and only the remaining time stretches or shrinks.
  - All numbers live in `SHADE` in `js/data.js`.
- **Rain barrel refills 1 water per minute** (was 1 per 20 s), cap 10, including while the game is closed. The Brass Watering Can halves that to 30 s and raises the cap to 15.
- **Irrigation card** (Uncommon feature, 45 coins in the Supply Market once pulled from a Card Pack). Tap the card in Bag → Garden features, then tap a raised bed. A drip hose runs from the rain barrel to that bed, and the bed waters its thirsty plants by itself, using 1 barrel water per plant. When the barrel is empty it pauses until it refills. Each card covers one bed, so more cards cover more beds. Offline catch-up waters plants at the barrel's 1-per-minute pace.

## Jewels, ads and settings (prototype, no real money)
- **Jewel Shop:** opens from the Jewel counter, the Bag or the Market.
  - Bundles: 1 for $0.99, 10 for $6.99, 50 for $29.99 (Best value).
  - **No More Ads + 10 Jewels** costs $8.99. It removes the banner and partner ads and then shows as Owned.
  - Purchases are **simulated**: a "Prototype: purchase simulated, no charge" confirm appears, then the items are granted. `PAYMENTS_MODE` in `js/data.js` is the single switch (`'simulated'`, or a future `'apple-iap'` bridge in `js/payments.js`).
- **Ads (placeholders, no ad SDK):**
  - The bottom banner is a **house ad** for our own games. Right now that's *Market Plot, coming soon*; tapping it opens Settings → Play Other Games. It sits below the tab bar, and the UI moves up to make room.
  - **Partner ad** interstitials appear after every 3rd sale and after opening a bought Card Pack, at most once per 90 s. They can be skipped after 3 s.
  - An opt-in "watch an ad for +10 coins" placeholder is at the stand (3 min cooldown).
  - `ADS_MODE` and `ADS` in `js/data.js` control all of this. `ADS.partner` is the hook for a future partner SDK.
- **Settings** (gear icon) contains:
  - Play Other Games: a list driven by `OTHER_GAMES` in `js/data.js`.
  - Ad status.
  - Show tips again.
  - Reset garden.

Progress autosaves to localStorage (`petalspire.v03`; v0.3, v0.31 and v0.4 share the same save key, and v0.4 tags saves with `build: '0.4'`; plants already growing in a v0.3 save keep their progress). v0.2 saves are migrated automatically: your beds, stand, rack, market, land and coins are kept, plus a gift of a sapling and 3 Jewels. The old save is kept as a backup.

## Tech
Plain HTML/CSS/ES modules with no build step. Three.js r170 is vendored in `vendor/`. All 3D meshes are procedural low-poly, made in code.
- `js/layout.js`: lots, bed sites and obstacle placement (seeded, so the same for everyone)
- `js/world.js`: the scene, camera, picking, chopping, cars, build animations, blueprints, finds, decor and growing trees
- `js/data.js`: costs, timings, finds, bundles, ad config
- `js/main.js`: game state, goals, panels, the stand and customers, and the card reveal
- `js/payments.js`, `js/ads.js`: the swappable purchase and ad layers
- `js/shade.js`: the shade model (pure functions)

Run it locally with `python3 -m http.server` and open http://localhost:8000. Add `?treeMin=1` to make trees grow in 1 minute when testing.
