# Petalspire v0.68

A cozy 3D flower-garden prototype for iPhone Safari (portrait, one thumb). Also plays on desktop with a mouse.
This is a **prototype**: version numbers stay below 1.0 until the first official release.

**Play:** https://zacharyryanschwartz-droid.github.io/petalspire/

## v0.3 loop
1. **The woods.** Tap trees to chop them (+3 Wood), then tap the stumps (+1 Wood). About 1 in 5 obstacles hides a **find**: a sparkle appears where it stood, and you tap it to pick it up. Trees sometimes drop a **sapling**.
2. **Finds** (Bag → Finds). Each find can be **Restored** for a small cost and some waiting time (20–45 s, or 1 Jewel to finish now) or **Recycled** for Wood, coins or Scrap.
   - 10 kinds. Restored decor (planter, lantern, bench, gnome, trellis, bottle chime, weathervane) can be placed on your land and raises **atmosphere**, which brings customers sooner.
   - Watering Can: faster water. Wheelbarrow: +1 Wood per tree. Old Crate: +4 stand shelf.
3. **Raised beds.** Build → Raised bed (12 Wood). The first bed brings the home rain barrel (filled by the Starter Seed Pack), so water can never run out. Other plots get their own barrel from the Build menu (40 coins, since v0.52).
4. **Build it yourself.**
   - After your first bed, a glowing **Farm Stand blueprint** appears by the road. It costs 15 Wood; adding an Old Crate is optional. A scaffold rises, sawdust flies, and the stand is done.
   - The **Drying Rack** (10 Wood) becomes buildable after your first Lavender harvest.
   - The Build menu lists every structure with its cost and whether it is locked.
5. **Rebuild the Supply Market.** Once you've earned 100 coins at the stand, the boarded-up market can be rebuilt for 30 Wood + 60 coins (3 Scrap saves 20 coins). It goes boarded → scaffold (60 s, or 2 Jewels) → open. It sells seeds, a water truck that fills your rain barrels (v0.52), garden features, Card Packs (1 Jewel each), a **bundle of 5 Wood (12 coins)** and **saplings (20 coins)**.
6. **Grow trees.** Plant a sapling on cleared ground you own (not in beds). It grows through four stages over **40 minutes of real time**, and keeps growing while the game is closed. Chop a mature tree for 6 Wood; it leaves a stump (+1) and has a 50% chance to drop a new sapling.
7. **Land for sale.** Five wooded plots, each with a floating For Sale sign: 450 → 900 → 1800 → 3000 → 4500 coins (v0.7.2; was 150 → 1500).

Drag with one finger to pan, pinch to zoom, and twist with two fingers to turn. On desktop, right-drag or shift-drag turns the view.

## New in v0.7.2: economy
- **Coin costs ×3** (sell prices unchanged): seeds, Supply Market cards (Irrigation 135, Still 450, Parking 420 …), Glycerin 24 / Vinegar 18 (packs 96 / 72), Rain Barrel 120, Home plots 450 → 900 → 1800 → 3000 → 4500 → 6000, the Orchard 9,000, Orchard plots 12,000 / 18,000 / 27,000, the Orchard Stand 900, tree-row Irrigation 450, the coin stand unlocks 3,000 / 7,500 / 15,000 / 24,000 and the Supply Market rebuild 180. Workers are the exception: 2,000 per hire (see below).
- **Home earns less than the Orchard:** lower Home sell factors (Epic 0.525 … Other World 0.34), slower Epic/Legendary flowers (×1.35) and Chamomile (120 s). Model, coins/hour: Early 8,743 · Mid 13,027 · Late Home 15,883 · Late Orchard 22,059.
- **Fruit (softened cut):** trees keep their v0.7 sell factors; fruit every 190 · 225 · 270 · 270 · 420 · 400 · 420 s and 5 · 4 · 3 · 4 · 3 · 2 · 2 fruit per pick.
- **Sunflower Oil and Sun Butter are Home press only** (sunflower seeds grow at Home), like Rosehip Oil. The Orchard Oil Press no longer lists them; a batch already running there in an old save is stopped and its seeds go back to the Orchard Bag.
- **Wood and saplings:** a felled grown tree gives 30 Wood (was 6); Market Wood ×5 costs 55 (was 12), so growing wood is the better deal. Saplings cost 90 … 3,000 by tier; a Market sapling 60; Scrap ×5 135.

## New in v0.7.2: Gardener + Market Manager
The single all-round Gardener is split into two hires, and workers are now hired **per location, not per plot**: one Gardener and one Market Manager at Home, and one of each at the Orchard.
- **Gardener:** plants and harvests only, on **every plot of its location**. It harvests and replants every bed, fills empty bed spots, waters from the barrels, and picks and waters fruit trees. It makes no products and does not stock the stand.
- **Market Manager (new):** runs **every crafting stand at its location** (Drying Rack, Tincture, Still, Tea Stand, presses, jars and the rest): it collects and restarts them, then fills that location's stand (Farm Stand or Orchard Stand) with what was made there.
- **Paced work:** one worker covering many plots is not instant. Each worker walks through its location's beds, trees and stands in random order, using the existing per-task times (about 2.4 s to pick, 2.4 s to plant and 2.6 s to water a bed; 2.2 s per stand run; 2.4 s per stock trip). It works through about 5 s of tasks every 5 s and catches up at most 2 minutes at a time after the game was closed.
- **Cost and shift:** each hire costs **2,000 coins** and lasts **1 real-time hour**, then must be re-hired for the same 2,000. There is no separate wage.
- **Each hire has its own timer.** The Build menu has a **Workers** section for the location you are at (Home or the Orchard), above "Your land". It has one row per worker, each with its own timer. Each worker also has a timer pill in the world. The Manager wears a blush apron.
- **Random choices:** both workers pick seeds, recipes and stock order at random. They never favour the priciest item.
- **Dried herbs go to tea first:** the Manager puts dried herbs into empty Tea Stand spots before anything else, as a random blend of the herbs on hand. Dried herbs only go to the stand while no Tea Stand there has an empty spot.
- **Pocket Watch and Gardener's Pack:** the Pocket Watch adds time to both hires. A Gardener's Pack free pass applies to the Gardener only.
- **Existing saves:** per-plot workers are merged into one per location, once per save and for free. If any plot at a location had a Gardener still working, that location gets one Gardener **and** one Market Manager for the longest remaining shift. Shift tallies are added together.
- Older notes below that say Gardeners make products, stock stands, or plant the most valuable seed describe the earlier versions.

### Music: recorded tracks instead of the synthesized tunes
- The synthesized tunes ("Home Hearth" / "Orchard Lane") are gone. The music is now **six recorded tracks**. Four are CC0 tracks from OpenGameArt: Town Theme, A Small Fire Will Do, Meadow Thoughts and A New Town. The other two are takes 1 and 2 of **Morning on the Hill**, Petalspire's own instrumental. All six are in `audio/music/`, and the CC0 credits are in `audio/music/LICENSES.md`.
- They play as **one shuffled playlist on both Home and the Orchard**. Every track comes up once per round, never the same track twice in a row, with a **2.5 s crossfade** between tracks. Travelling doesn't restart the music.
- Tracks are fetched and decoded **lazily**. Only the playing track and the next one, which is preloaded, are held in memory.
- The Music slider, Mute, the first-tap unlock, and the pause while the tab is hidden all work as before. The music level factor is now 0.4 (was 0.55). Sound effects are unchanged.
- Settings › Sound has a Music credits line.
- **To add a track:** put the mp3 in `audio/music/` and add one line to `PLAYLIST` in `js/audio.js`. Optional fields: `gain`, `scenes: ['home']` and `weight`.

## New in v0.7.1: menu fixes (Home + Orchard)

- **Parking Lot and Billboard leave the Build menu once built**, at Home and at the Orchard (and are not listed as "Built at …" in the other place's menu). Parking Lot cards are still bought in the Supply Market at both places and level the lot up; tap a Billboard to run an ad.
- **Irrigation is a plain price to buy** (45 coins): one raised bed per purchase. You buy it, then tap the bed to place it; each purchase is also a card copy, so it levels the card up. The "Hook up" buttons and the "free with your card" row are gone (Market, Bag row, rain-barrel panel).
- **Irrigation can only be bought when something needs it.** At Home it is disabled with "No beds need irrigation" when every bed is irrigated (or there are no beds). At the Orchard, tree-row Irrigation is disabled with "No tree rows need irrigation" in both the Market and the Build menu.
- Saves from v0.7 load unchanged: irrigated beds, Irrigation copies, Parking level and built lots are kept.
- **Camera: pan past your land.** You can now drag about half a screen beyond the outermost plot (and past the road). Movement gets softer near the edge and stops at a gentle limit.
- **Camera: buying never moves or zooms the view.** Market items, Build cards, card copies and plots leave the camera where it is. It moves only when something you are placing has no free spot on screen; it glides there, keeps your zoom, and doesn't snap back.
- **Pack art fills its frame.** The Starter Pack and Collector's Bundle bouquets are re-cropped so the bouquet sits in the centre with even margins. They now fill the offer popup and the Jewel Shop cards edge to edge (`object-fit: cover`) on phones and desktops.

## New in v0.7: music, sound effects, sound settings, and 1-hour Gardeners

### Music
Two gentle, looping folk tunes in a cozy countryside style:
- **Home Hearth** plays at Home. It is a D-major waltz for tin whistle and fiddle, with harp, a soft bass and a frame drum. Each loop is about 52 s.
- **Orchard Lane** plays at the Orchard. It is a G-major waltz for fiddle and whistle, with guitar. Each loop is about 58 s.

The tunes crossfade when you travel. Music starts after your first tap, because browsers block autoplay.

### Sound effects
Short, soft sounds for:
- UI taps, planting, watering, harvesting and picking fruit
- coins and selling, buying, and building or placing
- opening a card pack, levelling up, finishing a goal, and the Oil Press

Gardeners work quietly, and offline catch-up makes no sound.

### Audio license
All music and sound effects are **original compositions and synthesized sounds created for Petalspire**. They are generated in the browser with the Web Audio API (`js/audio.js`). There are no third-party audio files or samples, and nothing to download, so mobile load size does not change. The melodies are new and are not based on, or imitations of, any film score or existing tune. They are released with the game's code.

### Settings › Sound
- **Music** and **Sound Effects** each have their own volume slider (0–100 %) and a **Mute** button.
- These settings are saved with your game.

### Gardeners: 1-hour hires
- A Gardener hire now lasts **1 real-time hour**. The clock keeps running while you are away.
- When the hour is up, the Gardener stops working. To keep them working, **hire them again for the same cost** (2,000 coins).
- A small timer above each Gardener shows the time left. When the hour ends, it changes to "Hire again", and a gentle notice tells you the shift is over.
- **Gardener's Pocket Watch** now adds +10 / 15 / 20 / 30 minutes per hire (by card level). It used to add hours.
- A Gardener's Pack free pass still gives the hours you bought with it.
- **Existing saves:** every Gardener you already had gets a fresh 1-hour timer when you first load v0.7.

### Economy pass: slower earnings
Money was coming in too fast (teas sold for over 13,000), so sell prices are lower, especially at the top. Costs are unchanged: seed prices, saplings, packs, Gardeners, builds and plots. Real-money packs are unchanged too. Items already in your Bag or on a stand use the new prices.
- **Sell prices by tier** (flowers, fruit and seed sales): Basic ×0.9, Epic ×0.7, Legendary ×0.6, Rare ×0.6, Super Rare ×0.55, Ultra Rare ×0.5, Other World ×0.45. Each tier's cheapest flower still sells for more than the most expensive flower one tier down.
- **Dried herbs** sell for 1.25× the fresh flower (was 2.45×).
- **Tea:** the multiplier runs from ×1.2 (Basic) to ×1.8 (Other World). Even with the different-herbs bonus, a tea never sells for more than **1.8×** its three dried herbs (it used to reach ×3.85). The top tea is now about 1,580 (was 13,377).
- **Crafted goods always beat their inputs.** Every tincture, essential oil, press product and jar sells for at least 1.25× what goes into it. For tinctures, the herbs are counted at the higher of their fresh or dried price, which fixes Holy Basil and Elderflower tinctures selling below the dried herb.
- **Lower multipliers:** Oil Press 1.4–2.0× (was 1.7–3.2×), Fruit Stand 1.3–1.9× (was 1.6–3.1×). Sunpetal Oil 1,600 → 640, Cocoa Butter 938 → 306, Crystal Apple Jelly 1,473 → 406, Moonpeach Preserves 1,389 → 383, Sunflower seed bags 85/200 → 60/140. Rose Water is now 19% of the rose oil price (was 15%).
- **Faster top-tier plants:** Rare plants grow in about 17 min (was 20), Super Rare about 22 min (was 45), Ultra Rare about 30 min (was 90) and Other World about 43 min (was 3 h). Higher tiers still grow slower than lower ones, but each tier from Legendary up now earns more per bed-hour than the one below, and a late-game Home earns more than a mid-game one. Card Growth stats now reflect the faster times.
- **Watch-ad coin rewards** grow more slowly as you buy land: up to ×4.4 (was ×7.8).
- Modelled earnings, in coins per hour: early game 14.8k → 11.9k, mid game 62k → 21k, late game (Home + Orchard) 184k → 65k.

### Other v0.7 changes
- **Essential oils take 10 seeds.** Every seed-based oil at the Still (Lavender, Calendula, Chamomile, Peppermint, Rosemary, Damask Rose, Jasmine) now uses 10 seeds. Eucalyptus still uses 3 leaves. Sell prices are unchanged.
- **Glycerin and Vinegar are Home only.** They are sold only in the Home Market, because the Tincture Stand is at Home. Nothing at the Orchard uses them. Any Glycerin or Vinegar left in an old Orchard Bag moves to the Home Bag on load, so nothing is lost.
- **Orchard Wood and Scrap.** Wood and Scrap bought at the Orchard Market go into your shared Wood and Scrap (shown in the top bar and in either Bag). A test now covers this.

## New in v0.68.1: quick fixes (Home + Orchard, no new features)
- **No flower seeds at the Orchard.** The Orchard Market sells tree saplings, Tree-row Irrigation, supplies and Orchard builds only; flower seeds are sold at the Home Market.
- **Parking Lot + Billboard at the Orchard.** Both can be bought & built at the Orchard (Market or Build menu): the Orchard Parking Lot paints bays beside the Orchard Stand (visitors arrive in groups, like at Home); the Orchard Billboard stands across the Orchard road. One ad campaign lights every Billboard you've built and boosts traffic wherever one stands.
- **Parking Lots level up.** The Parking Lot used to leave the Build menu once built and its copies were sold only in the Home Market, so there was no obvious way to buy more. Parking Lot cards now stay buyable in the Market at both places and on the Parking Lot's Build card; each copy counts toward the next level, which applies at once (the level is shared by the Home and Orchard lots).
- **Market sections.** The Supply Market is grouped under headers: Seeds (Home) / Tree saplings (Orchard), Supplies, Water & irrigation, Buildings & features, Garden charms & tools — each still sorted from the highest price down.
- **Pack art centred.** The Starter Pack and Collector's Bundle bouquets are shown whole and centred in the offer popup and the Jewel Shop cards.

## New in v0.68: polish pass (no new features)

A full play-through of Home and the Orchard on a fresh save and on older saves, at iPhone size (390×844, touch). Fixes only:

- **Orchard dead end fixed.** Buying the Orchard now gives you the **Apple Tree** card, so Apple saplings are in the Orchard Market right away. Before, a new Orchard had no tree cards, and those came only from Jewel packs. Older saves that own the Orchard with no tree card and no trees get the same card when they load.
- **Card zoom works again.** Tapping a card in the Collection crashed the panel's click handler from v0.67.1 onward (`startsWith` on a button with no action). Fixed.
- **Ads wait their turn.** An interstitial no longer opens while a panel, popup or the Map is open.
- **Title screen is clean.** The HUD, tab bar and tool dock stay hidden until you tap Begin.
- **The tool dock (Sickle/Plow) hides** where there are no raised beds, such as the Orchard.
- **Home-only tips** (chop, stumps, beds, Farm Stand, blooms and so on) no longer show up while you're at the Orchard. They wait for your next Home visit.
- **Orchard Bag hint:** the empty Orchard Bag now explains the Orchard: plant saplings from the Market, pick the fruit, sell it at the Orchard Stand or cook it at the Fruit Stand.
- **Clearer wording:** "Your barrel is already full" (was "All 1 barrel already full"). The Sickle and Plow tips now say they work wherever you have raised beds.
- **Bigger tap targets** for small link buttons and the goal hint.
- **Market sorting fixed.** Glycerin and Vinegar singles and ×5 packs are now separate rows, so the Market list is highest to lowest price all the way down (the ×5 packs used to ride along with their single and break the order).
- **Leaf icon fixed.** The leaf-bunch icon on tree cards had a broken SVG path, so its left leaves were missing and every draw logged an error.
- **Barrel reach frames** now clear as soon as you deselect, instead of lingering until the next tap.
- **Every Orchard plot is a 4×4 grid of 16 tree spots.** The Orchard was 3×4 and Pear Meadow, Plum Hollow and Hilltop Grove were 2×3. Every Orchard plot is now 16 m deep, and its ground, plot outline and fence were resized to fit. Hilltop Grove sits 2 m further back to make room. Tree-row Irrigation now has 4 rows per plot.
  - **Saves:** trees on The Orchard keep their spots. Trees on the other plots move to the nearest spot in the new grid, on the same plot and in the same row order, with their growth timers kept. Irrigated rows follow their trees. Anything you placed on Hilltop Grove moves back with it.
- **Press recipes are in the right places.** Rosehip Oil (from Damask Rose seeds, a Home plant) is pressed only at the Home Pressed Oil Stand. Almond Oil and Almond Butter (from Orchard almond trees) are pressed only at the Orchard Oil Press. Older saves:
  - a press that was mid-way through a recipe that has moved gives its ingredients back to that place's Bag;
  - a jar that was already finished stays ready to collect.
- **New pack art.** The Starter Pack and Collector's Bundle heroes are now gift bouquets made of the actual contents: the Plow and Sickle, fanned plant cards, Jewels, coins and Wood, tucked in with a few flowers. The Collector's Bundle is the bigger one, with a glowing Other World plant and a Double Daily Rewards ribbon. The blurbs match.
- Version label, page title and save stamp now read **v0.68**. Saves migrate without loss.

## New in v0.67.1: trees need water, tree-row Irrigation, no delivery van yet, Market fix, bouquet packs

- **Trees need water to fruit again.** After a pick the tree is dry and shows the usual needs-water drop. Its next fruit only starts growing once it is watered: tap the tree, or use **Water the tree** in its sheet. Watering takes 1 water from a rain barrel: the tree's plot barrel first, then any Orchard barrel (by hand, any barrel). The fruit is ready one cycle after watering. **Gardeners** water the picked trees on their plot too, including the ones they pick.
- **Tree-row Irrigation** is sold in the Orchard Build menu and the Orchard Market for 150 coins. Each purchase covers **exactly one row** of tree spots: the next row in order (Orchard rows 1–3, then 2 rows on each Orchard plot you own). That row's trees are watered automatically right after every pick. You can buy it again until every row you own is covered. Each row shows its status: a drip line and drip badge when irrigated, a pale dashed badge when not. The Build card, the tree sheet and the Market show it too.
- **No delivery van until the production location opens.** The van only comes with the production spot on the Map, a later location that isn't built yet. Until then, Market orders, goods sent between Home and the Orchard, and placed buys arrive instantly, as before v0.65. The van code stays behind one switch (`VAN_LOT = 'production'`; on when `S.lots.production`).
- **Saves:** no row starts irrigated, and trees that were mid-cycle keep their timer. Van trips still pending in older saves are delivered at once on load.
- **Market fix: nothing repeatable disappears any more.** Only true one-time items leave the Market once bought:
  - single builds: Tincture Stand, Essential Oil Stand, Tea Stand, Windmill, Billboard, and the craft stands;
  - unique features: Sundial, Sickle, Plow and the garden charms.

  Everything else always stays buyable:
  - **consumables**: Wood, Scrap Metal, every seed, saplings, Vinegar and Glycerin (singles and packs of 5), and the water truck;
  - **repeatables and stackables**: Irrigation, Parking copies, and the Honeybee Skep (one per plot).

  The items that had gone missing in v0.67:
  - **Irrigation:** hidden at Home once you owned it, including its "hook up another bed" button, and never listed in the Orchard. It now has a Home row where each buy adds a card copy that levels it up, with *Hook up another bed* alongside, plus **Irrigation · tree rows** in the Orchard.
  - **Vinegar and Glycerin, and their ×5 packs:** never sold in the Orchard Market, and locked at Home until you had found the card *and* built the Tincture Stand. They are now always buyable at both Markets. Bought in the Orchard, they go to the Home Bag, where the Tincture Stand is.
  - **Every flower seed:** missing from the Orchard Market unless the Orchard had beds. Seeds are now sold there too, and go to the Home Bag when the Orchard has no beds.
  - **Parking Lot copies:** gone once owned, though Parking stacks up to 6 spots. There is now a copy row that levels the card up.
  - **The Honeybee Skep row:** vanished once every plot had one. It now stays as a status row.

  Nothing was taken from saves: the items were hidden by the Market listing, not removed from your state. Old saves see them again on load.
- **The Stand button opens the stand where you are.** In the Orchard, the bottom-menu Stand button opens the Orchard Stand (or its build card); at Home it opens the Farm Stand. The badge counts the goods on that stand.
- **Map teaser is generic now.** The single fogged *Coming soon* spot (shown once the Orchard is yours) is an unnamed signpost, **Somewhere new**. The named future places were removed from the Map; for now the game is Home and the Orchard.
- **Packs are bouquets now.** The Starter Pack and the Collector's Bundle, in both the popup and the Jewel Shop, lead with a painted, gift-wrapped bouquet of what's inside:
  - a flower per tier fanned out;
  - the Plow and Sickle tucked in;
  - Jewels, coins and Wood spilling at the base.

  The Collector's Bundle is bigger and fuller, with a glowing Other World bloom at the centre and a *Double Daily* ribbon. Under the art, icon chips show the counts. The art has a gentle pop-in and a slow shimmer, and the wording stays calm. Reduced-motion settings turn the animation off.

## New in v0.67 — real-money packs, and the v0.66.1 fixes

**Packs (placeholder purchases).** The Jewel Shop lists two packs, highest value first. Prices are placeholders for the iPhone App Store. The web build never charges and never grants: tapping *Get it* shows "… arrives with the iPhone app. Nothing was charged."

Value is a coin equivalent:
- 1 Jewel = 1,000 coins (the Jewel trade);
- 1 Wood = 4 coins;
- a tool at its Market price (or 2 Jewels if you already own it);
- a plant = its tier's average seed price × (seeds + 2 for the card);
- Double Daily Rewards = 30 average daily gifts.

| Pack | Price | Contents | Value (coins) |
|---|---|---|---|
| Collector's Bundle | $19.99 | Everything in the Starter Pack **plus** 1 extra random Other World plant, 100 more Jewels, 5,000 more coins, 300 more Wood and **Double Daily Rewards for good**. In total: 1 random plant of each of the 7 tiers + 1 extra Other World plant (card + 3 seeds each), 120 Jewels, 6,000 coins, 400 Wood, Hand Plow + Harvest Sickle | 145,898 |
| Starter Pack (one time only) | $4.99 | 1 random plant of each of the 7 tiers (card + 3 seeds), 20 Jewels, 1,000 coins, Hand Plow + Harvest Sickle, 100 Wood | 25,228 |

- If you already own the Plow or the Sickle, each one you own is swapped for 2 Jewels.
- **Double Daily Rewards**: every Daily Garden Gift is doubled from then on. A small **×2** badge shows on the gift.

- The **Starter Pack** replaces the old $1.99 one. It pops up **once, right after the beginning goals are completed** (when the "The garden is yours now" card is closed). Saves that finished the goals earlier see it once on load. It stays in the Jewel Shop afterwards until bought. The old 15-minute / 8-harvest trigger is gone.
- The Hand Plow plants a whole bed at once; the Harvest Sickle harvests a whole bed at once.
- `Payments.purchaseOffer` is still the one IAP hook; a native build calls `grantOffer(id, receipt)` with a verified receipt.

## v0.66.1 fixes (shipped in v0.67)

- Fixed: items from the Orchard Bag could not be put on the Orchard Stand (and could not be taken back). Since v0.65 the per-location `stock()`/`unstock()` wrappers always passed `home` to the stand logic, so Orchard taps hit the Home-stand check and only showed "Sells at the Orchard".
- **Bag** lists only garden features bought at the Market and not yet placed. Tools are used from the tool dock and irrigation from the barrels. A load-time migration caps stale copies left by older saves.
- **Build menu**: one-time builds disappear for good once built (`S.buildDone`, back-filled from older saves on load). Rain barrels stay.
- **Map** is truly full screen, edge to edge, with no panel or margins. It respects the iPhone safe areas and has a ‹ Back button. Once the Orchard is yours, the next place, the **Vegetable Farm**, shows as a fogged, locked "Coming soon" spot.
- **Gardeners** plant empty bed tiles with the most valuable seed in that location's Bag, as well as watering, picking and replanting, at Home and at the Orchard.
- **Orchard Oil Press**: the Orchard has its own Oil Press in its Build menu. You need the Pressed Oil Stand unlocked first. It is placed on Orchard land, built in 2 h, and can be finished now for 1 Jewel. It presses from the Orchard Bag. The Home press stays at Home.
- **Orchard fence** outlines only the land you own, with a gate at the lane. It grows automatically when you buy an Orchard plot; unbought plots stay outside.

## New in v0.66 — optional boosts, a Starter Pack (placeholder), More from Schwarze Spiele, and a studio splash

**Optional boosts (rewarded ads).** Now and then a small badge slides up above the tab bar. Watching the ad (the same Watch Ad break as before) gives the boost; tapping × or waiting 20 s lets it slip away.

| Boost | When it can appear | What the ad gives |
|---|---|---|
| Double Harvest | right after a harvest | the same flowers and seeds again |
| Double Sale | right after a stand sale of 20+ coins | the sale's coins again |
| Fast-Grow | right after watering a plant with 60+ s left | that one plot is ready to pick |

Badges only start after 3 harvests, show for about half of the moments, and at most one every 4 minutes. Never during a pack reveal, a dialog, the Map, or building.

**Starter Pack.** 10 Jewels, 2 Card Packs, 500 coins and 50 Wood for $1.99. It first appears after about 15 minutes of play, 8 harvests and 3 customers. Then it shows rarely: at most 4 times, at least 3 days apart. Each offer window lasts 48 h, with a gentle "Available for …" timer. You can close it with × or "Maybe later". While the window is open it is also listed at the top of the Jewel Shop. The copy uses no pressure wording.
- *Placeholder purchase hook:* `Payments.purchaseOffer()` in `js/payments.js` is where the iPhone in-app purchase goes (product id `com.petalspire.starter`). On the web it charges nothing and grants nothing; it only says the pack arrives with the iPhone app. The contents are granted once, and only after a verified receipt (`grantStarter`).

**More from Schwarze Spiele.** Settings has a "More from Schwarze Spiele" section with a card for **Market Plot** (a solo sandbox invent-and-market farming game from the same studio). It is marked Coming soon and has a Wishlist toggle that is remembered. The same card pops up once after a session milestone (20+ minutes of play plus the Map unlock, the Orchard, or every 50th harvest), at most 3 times and 3 days apart. There is no link yet: set `url` / `wishlistUrl` for `market_plot` in `OTHER_GAMES` (`js/data.js`).

**Studio brand.** A short Schwarze Spiele splash (white logo, "presents") plays on load and can be tapped away. The title screen and Settings carry the studio credit. Logos are in `assets/studio/`.

**Fix.** Toast messages no longer block taps on buttons underneath them.

## New in v0.65 — garden charms, delivery van, one Bag per place, a fairer economy, walking Gardeners and a storybook Map

v0.65 (build `0.65`, label "v0.65 prototype") is v0.64.1 plus this update. Saves load with nothing lost (save key `petalspire.v03`; every change below migrates).

### Garden charms (Sundial-style keepsakes)
Find the card in a pack or swap, buy it once in the Supply Market, place it on your land. Copies level it up (3 / 6 / 10 copies → Lv2–4).

| Charm | Tier | Price | Effect Lv1 → Lv4 |
|---|---|---|---|
| Golden Sundial | Rare | 90 | watered plants grow 25% faster |
| Brass Garden Bell | Rare | 120 | customers where it stands arrive 8% → 15% sooner |
| Copper Rain Chain | Super Rare | 180 | rain barrels refill 10% → 20% faster |
| Seed Keeper's Tin | Super Rare | 200 | 15% → 30% chance of +1 seed per harvest |
| Honeygold Scales | Ultra Rare | 280 | Farm Stand / Fruit Stand sales +5% → +10% |
| Gardener's Pocket Watch | Ultra Rare | 300 | Gardener hires +10 min → +30 min, same cost (v0.7; was +1 h → +3 h) |
| Moonlit Fountain | Other World | 420 | 20% → 35% chance of +1 flower |
| Fae Lantern | Other World | 450 | drying and crafting 15% → 25% faster |

- **Bag rule:** a feature is in the Bag only if it was **bought** (a pack card only unlocks it in the Market). Placed features leave the Bag; tap one on the map to put it back. A Sundial bought before v0.65 is placed for you on a free spot.
- **One-time Market:** features and buildings leave the Market once bought (build them from the Build menu).
- **Plant exchange (Swap):** draws from every Rare-or-better card — Rare 62.5% · Super Rare 22.5% · Ultra Rare 10% · Other World 5%; cards you already own weigh ×0.4.

### Delivery van
Supply Market orders and goods you send between places ride a delivery van to the Bag of the place you ordered from: about 4 s; it drives up if the trip is more than 0.7 s out, trips are at least 3.5 s apart, it parks 1.4 s, and anything overdue (+1.5 s, or on load) is delivered at once.

### One Bag, Market and Build menu per place
Home and the Orchard each have their own Bag, Market, Build menu, Stand and **Bulk Sell Box** (instant sale at half the stand price). Send goods between Bags from the Bag (free, by van). Owned features and buildings stay global.

### Trees are Orchard-only
Saplings are sold only in the Orchard Market and planted only on Orchard ground. Trees already growing at Home stay; unplanted saplings in the Home Bag moved to the Orchard Bag. The "Plant a tree sapling" goal is gone (goal chain 13 → 12; saves are remapped).

### Economy
| | Before | v0.65 |
|---|---|---|
| Seeds per harvest | Basic 5 · Epic 4–5 · Legendary 4 · Rare 3–4 · SR 2–3 · UR 2 · OW 1 (25% → 2) | Basic 2–3 · Epic 2–3 · Legendary 2 · Rare 1–2 · SR 1–2 · UR 1 (25% → 2) · OW 1 (15% → 2) |
| Sunflower seeds | 100 per harvest | 50 |
| Grow time, seconds (examples) | Peppermint 100 · Rosemary 145 · Damask Rose 205 · Saffron 260 · Ghost Orchid 350 · Moonflower 460 | 285 · 570 · 1260 · 2580 · 5160 · 10320 (Epic ≈×2.85 up to Other World ≈×22) |
| Stand shelf | 12 (+4/+8/+12 by level) | 18 (+6/+12/+18) |
| Customers | 1 kind (40% → 2), up to 3 each | 1–3 kinds (Lv4: 2–4), up to 3–5 each |

Basic plants keep their old grow times; seed prices are unchanged; card packs never granted seeds, so there was nothing to halve there.

### Billboard
Run ad: 2× traffic for 5 minutes, free, then a **1-hour cool-off after each run** (wall clock, saved). 1 Jewel runs another during the cool-off.

### Walking Gardeners
Gardeners now walk between beds with a basket, kneel to plant and pick, and carry goods to the stand (visual only — the work itself is unchanged). Idle Gardeners rest near where they were hired.

### Tab bar, Jewel dock
The Rack tab is gone (tap the rack in the garden). The **Map** sits in the tab bar, dimmed with a lock until every Home plot is yours. Instant Bloom and Customer Rush moved to the left edge, stacked above the Sickle/Plow dock.

### Orchard Stand rush fix
"Finish for 1 Jewel" now works for every build and upgrade at every location. The Orchard Stand scaffold was not tappable (the Orchard shed was missing from tap targets); it is now, and the finished stand appears at once and stays after reload.

### Watch Ad scales with progress
Unlimited, and always worth a few minutes of income; the button shows the reward (e.g. "▶ Watch · +300").

| Stage | Multiplier | Coins | Wood | Scrap |
|---|---|---|---|---|
| Fresh garden | ×1 | 50 | 20 | 5 |
| 3 Home plots | ×2.5 | 125 | 50 | 13 |
| All 6 Home plots | ×4 | 200 | 80 | 20 |
| + the Orchard | ×6 | 300 | 120 | 30 |
| + 3 Orchard plots | ×7.8 | 390 | 156 | 39 |

### Rain barrels are fixtures
Barrels never show in the Bag. Tap one in the garden to see its water and upgrade it in place. Spare barrel credits from old saves stay usable from the Build menu card.

### Sorted lists
Market, Bag, Stand restock, Bulk Sell Box, Send list and Build menu all run from the highest value to the lowest (sell value; buy price for things you only buy) within each section; ties by tier, then name.

### Storybook Map
The Map is now a hand-painted storybook map (light SVG plus one small canvas paper texture, no 3D): parchment paper, watercolour meadows, winding dirt roads, a stream with a bridge, the Home cottage garden and the Orchard trees, fences, sheep and flowers. Clouds cover the unexplored north. A place you don't own sits under fog with a lock and its price; the fog drifts away the first time you open the Map after buying it. Tap an open place to travel straight there.

### Player stats
Anonymous play stats (sessions, version) go to the studio's Games Backend. No API key is in the game and nothing personal is sent. Automated test browsers are skipped.

## New in v0.64 — the Sickle and Plow never rest, slower builds, and new Jewel uses

v0.64 (build `0.64`, label "v0.64 prototype") is v0.63 plus this patch. Saves load with nothing lost.

- **No rest:** the Harvest Sickle and Hand Plow can be used again **right away**. There's no countdown on their buttons, no greyed "resting" look and no **Skip · 1 💎** button any more.
- **No tool levels:** levels only shortened the rest, so Sickle and Plow cards no longer level up. Bag › Cards shows them as "×N collected · Ready again right away · no rest" with **"Copies just stack · this tool doesn't level up"**, with no level bar and no Upgrade button. There's no new bonus in its place.
- **Saves:** a Sickle or Plow level stored in an older save is left as it is (it does nothing now). The old "last used" time is ignored.
- **Duplicates:** a duplicate Sickle or Plow copy just stacks. If a tool card was already at max level (Lv4) in an older save, a duplicate still pays the usual max-level **+8 coins**, as before.
- Also fixed: the Windmill card row said "(base 60)". It now shows the v0.63 base refill of 30 s.
- Screenshots: `107-tools-no-rest`, `113-sickle-plow-copies-stack`.

### Slower builds (v0.64)
Builds now take real time. Timers use the real clock, are saved, and keep running while the game is closed. **Finish now always costs exactly 1 Jewel**, however much time is left (the v0.63 per-5-minutes curve is gone). The button reads **"Finish now · 1 💎"** with "Always 1 Jewel, however long is left".

| Stand | Build time | Finish now |
|---|---|---|
| Farm Stand | 5 s | 1 Jewel |
| Drying Rack | 1 min | 1 Jewel |
| Fruit Stand | 5 min | 1 Jewel |
| Tincture Stand | 15 min | 1 Jewel |
| Essential Oil Stand | 30 min | 1 Jewel |
| Tea Stand | 1 h | 1 Jewel |
| Pressed Oil Stand | 2 h | 1 Jewel |
| Orchard Stand | 4 h | 1 Jewel |

**Coin upgrades take build time too.** The coins are paid when you start; the building **keeps working at its old level** until the upgrade is done ("Still works at LvN until it's done"), and **Finish now** is 1 Jewel here as well.

| Upgrade | Lv2 | Lv3 | Lv4 | Lv5 |
|---|---|---|---|---|
| Farm Stand | 5 min | 20 min | 1 h | — |
| Drying Rack | 5 min | 20 min | 1 h | — |
| Rain Barrel (each) | 5 min | 20 min | 1 h | 2 h |

Screenshots: `114-stand-upgrading-finish-now`, `115-barrel-upgrading`.

### Jewel uses: Instant Bloom, Customer Rush, Swap
A small dock on the right (above the tab bar) holds the first two. Each asks first and shows its price.

- **🌸 Instant Bloom** (shows only while something is growing here): every plant at your **current location** goes straight to **harvest-ready**, skipping its start water, bud water and Blue Lotus barrel water. At the Orchard it ripens every unripe tree. **Price: 1 Jewel per 6 plants, rounded up, minimum 1, maximum 5** (1–6 plants: 1 · 7–12: 2 · 13–18: 3 · 19–24: 4 · 25 or more: 5). Screenshots: `118-instant-bloom-confirm`, `119-instant-bloom-ready`.
- **📣 Customer Rush** (shows only when this location's stand is built, finished and stocked): **1 Jewel for 2 min 30 s**. Customers arrive **5× as often** (the gap between arrivals is ×0.2, so about every 3–6 s instead of 15–30 s), and the first one turns up within about a second. Parking and the Orchard's one visitor still cap how many come at once. While it runs, the button glows and shows the time left. It survives a reload. Screenshot: `120-customer-rush`.
- **Swap · 1 💎** on the pack reveal: after a card flips, every card **below Rare** (Basic, Epic or Legendary) shows a Swap button. Tap it, confirm, and it's replaced by a random **Rare-or-better** card of the same kind (plant for a plant, other for another card), drawn at the normal relative pack odds, with cards you already own at ×0.4 as usual. The old card is given back: its copy, any duplicate coins, a supply card's +2 units and a new Irrigation card's ownership are all reversed. The new card flips in with its own spin, sparkles and a "Swapped" tag (Super Rare and better also get the full reveal). Each card can be swapped once. The loot bonus doesn't change. With 0 Jewels the button is greyed out with "Need 1 Jewel". Screenshots: `116-pack-swap`, `117-pack-swap-no-jewels`.

    | Swap result (before the ×0.4 for owned cards) | Rare | Super Rare | Ultra Rare | Other World |
    |---|---|---|---|---|
    | Plant card | 50% | 30% | 13.3% | 6.7% |
    | Other card | 100% (the Sundial, the only Rare-or-better non-plant card) | — | — | — |

    Per plant: Damask Rose, Tulsi, Elderflower 16.7% each (Rare) · Saffron Crocus, Blue Lotus, Jasmine 10% each (Super Rare) · Ghost Orchid, Jade Vine, Middlemist 4.4% each (Ultra Rare) · Moonflower, Crystal Rose, Sunpetal 2.2% each (Other World).

- The **Premium Pack** idea was dropped in favour of Swap.

## New in v0.63 — iPhone crash fix, pack bonuses, daily gifts, Watch Ad, building upgrades, build timers, a water economy, stacking Irrigation and bigger rain barrels

v0.63 (build `0.63`, label "v0.63 prototype") is v0.62 plus the changes below. Saves migrate on load with nothing lost.

### iPhone memory crash (opening many packs)
- The 3D renderer ran at the phone's full 3× pixel ratio and kept drawing the whole garden behind the full-screen pack reveal, whose huge blurred/blended layers were extra full-screen GPU surfaces. Some objects (cars) also made new geometry each time. On iOS Safari that adds up until the tab is killed.
- Now: pixel ratio capped (1.5 on iPhone), the 3D view pauses while the reveal is open and resumes after, reveal layers are smaller with no blur/blend on big layers, car geometry is shared, and at most ~70 petals are alive at once. A 32-pack test keeps geometries, textures, shader programs, listeners and heap flat.

### Card upgrades (e.g. Lavender Lv1 ×11 with no Upgrade button)
- Some older saves stored card stacks whose level/copies weren't clean whole numbers or whose id wasn't an exact card id; the level lookup then failed silently and hid the button. Every load now repairs stacks (merge into the real id, whole numbers, levels 1–4, earned levels never taken away). Cards that don't level up say so; Lv4 shows "Max level".

### Farm Stand and Drying Rack upgrades (coins, instant)
| Level | Farm Stand cost | Shelf space | Sell bonus | Drying Rack cost | Slots | Faster drying |
|---|---|---|---|---|---|---|
| 1 | — | +0 | +0% | — | 3 | 0% |
| 2 | 250 | +4 | +0% | 150 | 4 | 10% |
| 3 | 750 | +8 | +5% | 450 | 5 | 20% |
| 4 | 2000 | +12 | +10% | 1200 | 6 | 30% |

### Card packs
- Every pack is **2 plant cards + 1 non-plant card** (feature, tool, stand or supply). Cards you already own are 40% as likely. Odds are shown per slot type in the Market.
- Every pack also gives a bonus: **1–500 coins, 1–100 wood and 1–25 Scrap Metal**, each rolled on its own (`1 + floor(max × u⁴)`), so big amounts are rare. The reveal counts up with sparkles, and rolls ≥ 90% of max get a "WOW!" flourish.
- 10,000-pack averages: coins 99.5 (median 32), wood 20.7 (median 6), Scrap 5.6 (median 2). Max roll: coins 0.03%, wood 0.31%, Scrap 0.93%.

### Daily Garden Gift (streak)
One claim per local calendar day. Claiming the next day continues the streak; missing a day restarts at Day 1. Turning the clock back doesn't give extra claims. After Day 15 the calendar loops while the streak keeps counting.

| Day | Gift | Day | Gift | Day | Gift |
|---|---|---|---|---|---|
| 1 | 25 coins | 6 | 15 wood | 11 | 5 Scrap |
| 2 | 10 wood | 7 | 4 Scrap | 12 | 80 coins |
| 3 | 3 Scrap | 8 | 60 coins | 13 | 25 wood |
| 4 | 40 coins | 9 | 20 wood | 14 | 6 Scrap |
| **5** | **100 coins + 30 wood + 8 Scrap** | **10** | **200 coins + 50 wood + 12 Scrap + 1 Card Pack** | **15** | **400 coins + 100 wood + 20 Scrap + 3 Jewels** |

### Watch Ad
"▶ Watch" at the Farm Stand and at the top of the Market: pick **+50 coins, +20 wood or +5 Scrap Metal**, then watch the (placeholder) ad to the end to get it. No cooldown and no daily limit. Works with No More Ads too (rewarded ads are opt-in). `js/ads.js` has `registerProvider()` for a real ad network.

### Sickle and Plow rest (removed in v0.64)
~~Rest is 30 s at Lv1, 15% shorter per card level (25.5 s at Lv2, 21 s at Lv3, 16.5 s at Lv4). While resting, a **Skip · 1 💎** button ends the rest.~~ v0.64: no rest, no Skip, no tool levels (see above).

### Stand build times (superseded in v0.64, see "Slower builds" above)
After you place a stand it shows a construction scaffold and a timer and only opens for business when done (no sales, stocking or worker restocking until then). Timers use the real clock, are saved, and keep running while the game is closed. Stands built before v0.63 stay built. ~~**Finish now** costs 1 Jewel per started 5 minutes left (minimum 1). Coin upgrades stay instant.~~ v0.64: Finish now is always 1 Jewel, and coin upgrades take build time.

| Stand | Build time | Finish now at start |
|---|---|---|
| Farm Stand | 20 s | 1 Jewel |
| Drying Rack | 20 s | 1 Jewel |
| Fruit Stand | 1 min | 1 Jewel |
| Tincture Stand | 3 min | 1 Jewel |
| Essential Oil Stand | 5 min | 1 Jewel |
| Tea Stand | 8 min | 2 Jewels |
| Pressed Oil Stand | 15 min | 3 Jewels |
| Orchard Stand | 20 min | 4 Jewels |

### Water economy: start water and bud water
- A raised bed now needs water twice per crop: **water to start growing** and **water to reach the bud stage**. Growth stops at the end of the Sprout stage (halfway) until the bud water is in. A stalled plant shows the water icon, and its sheet says "Sprout · thirsty".
- Water is shared by the bed. The plants waiting for the same stage move on **together** once the bed has its water. The tile sheet shows the progress (**"Bed water 4/9 to start growing"**) with a bar. **Pour 1** pours 1 water per tap, and **Fill bed** pours until the bed has its water or the barrels run dry. Leftover water from the last pour carries over.
- Base cost (no Irrigation, or Irrigation Lv1): **1 water per plant per stage**, so a full 9-plant bed takes **9 to start + 9 to bud = 18 per crop**. A bed with fewer plants pays less (one plant: 1 + 1).
- **Blue Lotus**: 2 water to start (half full after the 1st, full after the 2nd), then 2 more at the bud stage. With Irrigation Lv4 it needs just **1 water for the whole grow**.

    | Irrigation (hooked bed) | Full bed to start | Full bed to bud | Full bed per crop | Blue Lotus (per plant, whole grow) |
    |---|---|---|---|---|
    | none / Lv1 | 9 | 9 | 18 | 4 |
    | Lv2 | 7 | 7 | 14 | 3.1 (28/9) |
    | Lv3 | 5 | 5 | 10 | 2.2 (20/9) |
    | Lv4 | **3** | **3** | **6** | **1** |

  "Lv4 waters a whole bed for 3 water" means **3 per stage** (3 to start + 3 to bud).
- The level applies to beds hooked up to a barrel, whether the drip line or your can does the pouring.
- A Gardener pours from the barrel until the bed has the water it needs, then keeps harvesting and replanting.
- Saves are migrated without wiping anything. Plants that are already growing finish this crop with no bud stop. A half-filled lotus barrel keeps its half. The bud stop applies from their next crop.
- **Rebalance so early game stays playable:**

    | | v0.62 | v0.63 |
    |---|---|---|
    | Barrel refill | 1 per 60 s | **1 per 30 s** |
    | Barrel size (Lv1) | 10 | **12** (upgradable to 60) |
    | Starter Seed Pack fill | 10 | **12** |
    | Windmill Lv1–4 | 20 / 18 / 17 / 15 s | **15 / 13 / 11 / 10 s** |

  The Brass Watering Can still halves the refill time (no Windmill 15 s; with Windmill Lv1–4 7.5 / 6.5 / 5.5 / 5 s) and still adds +5 to every barrel's size.

### Irrigation is one stacking card
- No more "assign a spare card to a bed". Irrigation is a single card that **stacks and levels up** like the others: **3 / 6 / 10 copies → Lv2 / Lv3 / Lv4**, with the usual Upgrade button in Bag › Cards.
- Owning it lets you **hook up any raised bed** to its rain barrel (the Irrigation row in the Market, the card, or a barrel's "Hook up a bed"). Each barrel still feeds up to 8 beds. The card's level sets the water a hooked bed needs (table above).
- The card text, the Market row and the pack reveal tag show the level and cost, e.g. "Lv2 · a full bed uses 7 water to start + 7 to bud (Lv3: 5)" and "Stacked ×4 · Lv2: full bed 7 water/stage". The Market sells the card only once.
- Saves are migrated: every bed that was irrigated stays hooked up, and all the old Irrigation cards become copies on the one card (e.g. 5 cards → ×5, so the Lv2 upgrade is ready).

### Bigger rain barrels
- Tap a rain barrel to open its panel. It has an **Upgrade** card that shows **only the next size and its price**. When you can't afford it, the button is greyed out with a "Need 50 more coins" hint. At the top it says **Max size**.
- Upgrades are **per barrel** (each plot's barrel is upgraded on its own), instant, saved and permanent. The barrel model grows a little and gains a honey-brass band per level.

    | Level | Holds | Cost |
    |---|---|---|
    | Lv1 | 12 | — |
    | Lv2 | 20 | 150 coins |
    | Lv3 | 30 | 450 coins + 20 Wood |
    | Lv4 | 45 | 1,200 coins + 40 Wood + 8 Scrap Metal |
    | Lv5 | 60 | 3,000 coins + 80 Wood + 20 Scrap Metal |

  The Brass Watering Can adds +5 on top at every level.
- Screenshots: `108-bed-water-4-of-9`, `109-bud-stall-2-of-9`, `110-barrel-upgrade-need-more`, `111-barrel-max-size`, `112-market-irrigation-lv3`.

### Crate Shelf is a permanent upgrade

- The Crate Shelf (a restored **Old Crate**, +4 Farm Stand shelf space) leaves the Bag the moment it is installed. It is part of the Farm Stand for good: it is saved and kept on reload, there is no **Take out** button any more, and it can't be sold from the Bag.
- The Farm Stand panel shows it as "installed · +4 space · permanent".
- A second restored Crate Shelf is listed in the Bag as a **Spare**. It can be sold or stocked as an antique, but it can't be installed, because the stand already has one. Restoring another one no longer switches off the installed shelf.
- **Save migration:** before v0.63, one flag meant both "you own a shelf" and "it is in your Bag", so an installed shelf also showed in the Bag. On load, an installed shelf on a built stand stays installed and that duplicate Bag entry is removed. A shelf that was only in the Bag stays there. Raw Old Crate finds are never touched.
- Screenshots: `92-crate-shelf-in-bag-before`, `93-crate-shelf-installed-bag-after`.

## New in v0.62 — find the card first, coins as the backup

v0.62 (build `0.62`, label "v0.62 prototype") is v0.61 with a clearer stand unlock. Saves carry over unchanged.

- Where the next unlockable stand shows (one card in Build, one row in the Supply Market), it now reads **"Find the [Stand] card in packs"**. The Card Pack (3 cards · 1 Jewel) is shown, and the main button, **Open Card Packs**, goes to Market › Card Packs. The Tincture Stand is not a pack card, so it reads **"Earn the Tincture Stand free"** with its goal.
- A secondary blush button, **"Can't find the card?"** ("Rather not wait?" for the Tincture Stand), opens a small panel with the **unlock price**, **your coins**, the normal build price that still applies when you place it, and **Unlock**. If you can't afford it, Unlock is disabled and a hint says how many coins you still need.
- The rules are unchanged: same ladder (1,000 → 2,500 → 5,000 → 8,000), only the next stand is shown, only where it can be built, other locked items stay hidden, and the normal build price still applies after unlocking.
- Screenshots: `89-find-card-in-packs`, `90-unlock-panel-affordable`, `91-unlock-panel-not-enough` (87/88 updated to the new look).

## New in v0.61 — the Orchard grows up, and Gardeners

v0.61 (build `0.61`, label "v0.61 prototype") is v0.6 plus the changes below. Old saves migrate on load with nothing lost.

### The Map unlocks with your land
- The **Map button is hidden until all 6 Home plots are bought**. Buying the 6th plot reveals it with a bounce, sparkles and the toast "All Home plots are yours — the Map is unlocked!". The unlock is kept in the save.
- Old saves that already own every Home plot (or The Orchard) get the Map on load.

### The Orchard
- A **road with passing cars** runs along the Orchard.
- **Orchard plots for sale** at escalating prices: **4000 coins + 40 Wood → 6000 + 60 → 9000 + 80**.
- The **Orchard Stand** replaces the Orchard Shed. It is a glowing blueprint in the Build menu (**300 coins + 30 Wood**, 12 shelf slots) with its own tappable panel, and Orchard visitors buy from it.
- **Roof rule:** the Orchard rain barrel is fed by the Orchard Stand's roof, so it collects nothing until the stand is built. Saves that already owned The Orchard keep their barrel working.
- The **Fruit Stand is free and Orchard-only**. A Fruit Stand bought in an older save is refunded 120 coins (and duplicates are removed).

### Stands, menus and selling by location
- The **Pressed Oil Stand** can go at Home or the Orchard. All other crafting stands are Home-only.
- The **Build, Market and Bag menus follow where you are** and show only what applies there.
- **Items sell only where they belong:** Bag items carry a Home or Orchard tag. Fruit sells at the Orchard Stand; flowers and herbal products sell at the Farm Stand. Fruit left on the Home stand goes back to the Bag.

### Every stand can be unlocked with coins
- No real money is ever needed. Each crafting stand still unlocks the usual way: its card from a Card Pack, or the free goal reward for the Tincture Stand. It can also be unlocked with coins, on a rising ladder in the order players usually reach the stands:

| Stand | Coin unlock | Where |
|---|---|---|
| Tincture Stand | 1,000 | Home only |
| Essential Oil Stand | 2,500 | Home only |
| Tea Stand | 5,000 | Home only |
| Pressed Oil Stand | 8,000 | Home or Orchard |

- **Only the next stand on the ladder is offered**, as one card in Build and one row in the Market, with its price. The next one appears once that stand is unlocked, whether by coins or by finding its card. The offer only shows where that stand can be built.
- After unlocking, the stand is bought and placed as before (for example, the Tea Stand is still 130 coins + 20 Wood to place).
- Stands that were already free stay free: the Farm Stand and Drying Rack, and the Fruit Stand, which comes with the Orchard. The Orchard Stand has always cost coins (300 + 30 Wood).

### Follow us
- The Instagram handle is now **@petal_spire_game** (https://www.instagram.com/petal_spire_game/).
- 4:5 (1080×1350) crops for Instagram feed posts are in `screenshots/ig/`.

### Blue Lotus barrel
- A Blue Lotus grows in a barrel that needs **two waterings** (half full → full), with a visible water level. It only grows when full. The barrel is removed at harvest.

### Locked items are hidden
- Anything you can't use yet is **hidden everywhere** (Build, Market, Collection, recipes) instead of being shown greyed out. Empty lists show a short hint about what unlocks more.

### Gardeners (workers)
- **Unlock:** Gardeners appear (Build › Your land, and on each plot's sheet) once all Home plots are bought. Before that they are hidden.
- **Hire: 2000 coins** per Gardener, at most one per plot. A small straw-hatted Gardener with a watering can appears beside that plot's bed.
- **What they do on their plot, automatically:**
  - harvest ready plants and replant the same species from your Bag (they skip it if you have no seeds);
  - water when needed, including both fills of the Blue Lotus barrel;
  - pick ripe fruit trees;
  - run the stands on that plot (Drying Rack, Tincture, Still, Tea and crafting stands) with the normal recipes, and collect what they make;
  - restock the stand that sells those products, following the sell-by-location rule.
  - Gardeners keep one seed per bed tile for replanting before they spend spare seeds on recipes.
- **Shift:** a Gardener works **6 real-time hours**, including while the game is closed (caught up on load, like irrigation). Then they stop and show **Needs pay**, with a sign over their head and a gentle toast.
- **Wage: 500 coins** starts a new 6-hour shift. A busy plot earns several thousand coins in 6 hours, so the wage is roughly a tenth of that. The hire price matches the last Home plot.
- The plot sheet shows "Gardener · Working · 4h 12m left" (with Details) or "Gardener · Needs pay" (with **Pay 500**). Tapping the Gardener or Details opens a sheet showing the shift progress and that shift's work.

### Screenshots
`screenshots/69-map-hidden-soon.png`, `70-orchard-road-plots`, `71-orchard-stand-blueprint`, `72-orchard-stand-panel`, `73-build-orchard`, `74-orchard-visitor`, `75-build-home`, `76-home-stand-sell-tags`, `77-lotus-barrel-half`, `79-lotus-barrel-full`, `78/80/82-*-hidden-after` (with `78b/80b/82b-*-locked-before`), `83-worker-working`, `84-worker-panel-working`, `85-worker-needs-pay`, `86-worker-needs-pay-panel`, `87-coin-unlock-next-stand`, `88-coin-unlock-market`.

## New in v0.6 — the Map, the Orchard, Sunflower seeds, the Pressed Oil Stand and the Fruit Stand

v0.6 (build `0.6`, label "v0.6 prototype") contains everything listed under v0.52 below, plus the items here.

### Sunflower rework
- A Sunflower harvest now gives **100 seeds and no flowers** (+10 seeds per beehive / card-level bonus). Sunflowers can no longer be dried.
- Loose seeds sell for **1 coin** each. On the Farm Stand, a **"Bag your Sunflower seeds"** strip packs them: **bag of 50 → 85 coins**, **bag of 100 → 200 coins**. A bag takes one stand slot.
- Save migration: Sunflower flowers and dried Sunflowers already owned (bag, stand, drying rack) are refunded at **54** and **132** coins each.

### Pressed Oil Stand (Epic card, 140 coins + 20 Wood, 2 presses, any owned plot incl. the Roadside Lot)
Price = raw value × (1.7 + 0.25 × (tier − 1)), butters ×1.06.

| Product | Input | Raw value | Sells for | Time |
|---|---|---|---|---|
| Sunflower Oil | 30 Sunflower seeds | 30 | 110 | 60 s |
| Sun Butter | 50 Sunflower seeds | 50 | 190 | 90 s |
| Rosehip Oil | 3 Damask Rose seeds | 102 | 250 | 120 s |
| Olive Oil | 6 olives | 120 | 294 | 120 s |
| Almond Oil | 6 almonds | 132 | 323 | 120 s |
| Almond Butter | 8 almonds | 176 | 457 | 150 s |
| Cocoa Butter | 4 cacao pods | 300 | 938 | 180 s |
| Sunpetal Oil (glows) | 2 Sunpetal seeds | 320 | 1600 | 240 s |

Recipes stay locked until you have found the source card.

### The Map and The Orchard (its own place)
- A **Map** button (top right) opens a painted map: **Home**, **The Orchard**, and five places marked *Coming soon* (Vegetable Farm, Grain Fields, Livestock Ranch, Full Production, Grocery Store), each locked and fogged. Tap one to see a teaser card.
- Home now has **6 plots for sale**: 150 · 300 · 600 · 1000 · 1500 · **2000 (the new Back Woods)**. The old Orchard plot behind Home is now this ordinary wooded plot.
- **The Orchard unlocks after every Home plot is bought**, then costs **3000 coins + 60 Wood** on the Map. Buying it takes you there. Travel back and forth any time; both places grow in real time in one save, and your Bag is shared.
- The Orchard is a sunny fenced field with **12 fruit-tree spots**, **2 raised-bed sites** and an **Orchard Shed** whose roof feeds an Orchard rain barrel (+1 per tick, more with stands). Growth, shade and water rules are the same as at Home. Crafting stands (Fruit Stand, Pressed Oil Stand, …) can go at either place but not on a tree spot.
- Buying it adds **14 tree cards** (2 per tier) to the Card Pack pool; until then no tree card can be drawn. Tier totals stay Basic 34.615 · Epic 31.385 · Legendary 20.051 · Rare 8.718 · Super Rare 3.138 · Ultra 1.395 · Other World 0.697 %. Trees take ≈14.34% of draws: e.g. Apple 3.1469%, Cherry 1.4857%, Lemon 1.1568%, Olive 0.7265%, Pomegranate 0.3923%, Eucalyptus 0.1744%, Moonpeach 0.0872%; each Epic feature 3.0769% → 2.7856%.
- Find a tree card → the Supply Market sells its sapling → tap a free tree spot. Trees grow sapling → young → tree → fruiting (25% / 60% / 100% of the grow time), then fruit again every cycle without replanting. Tap a ripe tree to pick it. Grown trees cast shade. Card levels shorten the times.

| Tree | Tier | Sapling | First fruit | Then every | Fruit per pick | Fruit price |
|---|---|---|---|---|---|---|
| Apple / Peach | Basic | 30 | 5:00 | 2:30 | 6 | 6 / 8 |
| Cherry / Plum | Epic | 70 | 7:00 | 3:00 | 5 | 14 / 16 |
| Lemon / Fig | Legendary | 140 | 9:00 | 3:30 | 5 | 24 / 28 |
| Olive / Almond | Rare | 240 | 11:00 | 4:00 | 4 | 20 / 22 |
| Pomegranate / Persimmon | Super Rare | 400 | 14:00 | 4:40 | 4 | 60 / 64 |
| Rainbow Eucalyptus / Cacao | Ultra | 650 | 17:00 | 5:20 | 3 | 70 / 75 |
| Moonpeach / Crystal Apple | Other World | 1000 | 20:00 | 6:00 | 3 | 200 / 220 |

Every tree has its own 3D model (rainbow bark, cacao pods on the trunk, glowing moonpeaches, crystal fruit…).
Eucalyptus leaves go in the Essential Oil Stand: **3 leaves, 5 min → Eucalyptus Essential Oil (600) + Eucalyptus Hydrosol (66)**.

### Fruit Stand (Epic card, 120 coins + 20 Wood, 2 jam pots, any owned plot)
Price = raw × (1.6 + 0.25 × (tier − 1)); jelly ×1.08, butters/preserves ×1.12. Times 40 s (Basic) · 60 s · 80 s · 120 s · 160 s (Other World).

| Product | Raw | Sells for | | Product | Raw | Sells for |
|---|---|---|---|---|---|---|
| Apple Sauce (4) | 24 | 38 | | Lemon Curd (3) | 72 | 163 |
| Apple Butter (6) | 36 | 65 | | Lemon Marmalade (4) | 96 | 218 |
| Canned Peaches (4) | 32 | 51 | | Fig Jam (3) | 84 | 191 |
| Peach Butter (6) | 48 | 86 | | Fig Butter (4) | 112 | 263 |
| Cherry Jelly (4) | 56 | 112 | | Pomegranate Jelly (3) | 180 | 505 |
| Canned Cherries (5) | 70 | 130 | | Persimmon Butter (3) | 192 | 559 |
| Plum Jelly (4) | 64 | 128 | | Moonpeach Preserves (2) | 400 | 1389 |
| Plum Sauce (4) | 64 | 118 | | Crystal Apple Jelly (2) | 440 | 1473 |

### Also since v0.51
- **Follow us** (Settings): buttons for Facebook, Instagram and X open each page in a new tab and give **1 free Jewel per platform, once** (3 max). Claims are kept in the save, so they can't be claimed twice; claimed buttons show ✓ Claimed.
- **Crate Shelf**: a restored Old Crate is now an item in Bag › Finds. **Install** puts it on the Farm Stand at once: a stacked-crate shelf appears beside the counter, with jars on it once the stand holds more than 12, and shelf space goes **12 → 16**. **Take out** (in the Bag or the Stand panel) returns it to the Bag; anything over 12 goes back to your Bag. Old saves keep an already-working shelf installed; a shelf that was stuck in the Bag can now be installed.
- The Tincture Stand and Essential Oil Stand use drawn icons (dropper bottles on a stand, a copper still) everywhere, like every other feature.
- **Tea Stand** (Epic card, any owned plot): blend 3 dried herbs. Price = round(Σ dried × (1.4 + 0.35 × (avg tier − 1)) × 1.1 if all different); brew 15 + 10 × (tier − 1) s. Lavender Tea 59 (vs 42 dried) · Lavender + Rosemary + Tulsi 689 (vs 316) · Moonflower Starlight 11319 (vs 3234) · Moonflower + Crystal Rose + Sunpetal 13583.
- Shade fix (shadows follow the sun direction) and a live Billboard face.
- On the Roadside Lot, crafting stands may stand on an unbuilt bed patch; that patch then can't take a bed until the stand moves.

## New in v0.52 — supply cards, the water truck, Rain Barrel in Build

- **Glycerin and Vinegar cards.** Both are new **Basic** cards with the shared Basic frame, 2% per card slot each. Their odds come out of the two Basic feature cards (Rain Barrel and Irrigation, 10% → 8% each), so each tier's total is unchanged (Basic 60%, Epic 20.5%, Legendary 11.5%, Rare 5%, Super Rare 1.8%, Ultra Rare 0.8%, Other World 0.4%) and so is every other card's odds. Finding a card unlocks that base at the Supply Market. Duplicates stack like other cards, and **each duplicate gives +2 free units** of that base.
- **Glycerin and Vinegar are locked until the Tincture Stand is open (built).** A locked row says what is still missing: "Find the Glycerin card", "Unlocks with Tincture Stand", or both.
- **Rain Barrel moved to the Build menu.** Build → Rain Barrel → Choose a spot & build. It costs 40 coins, charged when placed. The rules are unchanged: one per plot, up to 8 irrigated beds (see below), collects rain only when a stand roof is on the same plot, refills every 60 s (40 s with the Windmill), up to 10. It still needs the Rain Barrel card (every starter pack has one), but it no longer needs the Supply Market.
- **Fill Rain Barrels (Supply Market).** A water truck drives up the road, parks, and fills your barrels to full. It bills **10 coins per barrel it filled**. Barrels that were already full cost nothing. If you can't pay for every barrel, it fills as many as you can afford (emptiest first) and tells you how many it left. If you have under 10 coins the button is disabled.
- **Tree sapling is a plain market item.** Buy it at the Supply Market, then tap open ground to plant it. Saplings you own also get a **Plant** button on that row, which shows even while the market is still boarded up. The Build card and the Bag button for saplings are gone.
- **Save migration.** Nothing is lost. Saves from before v0.52 that own the Tincture Stand get both cards and keep buying both bases, even if the stand isn't built yet. Glycerin and Vinegar already in the bag always stay. An unplaced Rain Barrel from an older save is placed for free from the Build card or the Bag.

### More in v0.52

- **Buy and place in one step.** Every placeable purchase (beehive, sapling, stands, windmill, decor) goes straight into spot picking. You pay only when you place it, and cancelling costs nothing. The Parking Lot and Billboard are built the moment you buy them.
- **Windmill.** 160 coins + 20 Wood + **5 Scrap Metal**. Barrels refill every **20 s** at Lv1 (18 / 17 / 15 s at Lv2–4).
- **Scrap Metal.** You get it from recycling finds, at the market (5 for 45 coins), or from the road: a piece of scrap turns up on the verge every 8–12 minutes of play, one at a time. Tap it to pick it up.
- **Jewels from clearing.** The drop chance is now 1% (was 4%).
- **The Tincture Stand is a free goal reward** for "Give a bought plot its own Rain Barrel". It is no longer a pack card or a purchase. Old saves: a found card becomes the stand, and each duplicate becomes 10 coins.
- **Goals end with that reward.** The make-a-tincture, open-a-pack and distill-an-essential-oil goals are gone. After the last goal, a one-time closing card appears: "The garden is yours now. Have fun discovering new cards and planting!" A petal shower falls, and the goal pill then retires. Saves that were on or past a removed goal go straight to the closing card. Saves still on the Tincture Stand goal stay on it. The Essential Oil Stand is still a pack card.
- **Pack guarantee.** Every pack has at least one Epic-or-better card. If all 3 cards roll Basic (about 4.1% of packs), the last one is redrawn from Epic-or-better.
- **Bigger odds above Basic.** After the tincture card was removed, every tier above Basic got ×1.7 and Basic shrank to compensate: Basic 34.62% · Epic 31.38% · Legendary 20.05% · Rare 8.72% · Super Rare 3.14% · Ultra Rare 1.39% · Other World 0.7%. A full ×2 would have put Basic (23%) below Epic (37%).
- **The big reveal.** A Super Rare, Ultra Rare or Other World card gets a build-up (shake, glow, burst, petals), then a full-screen hero card with rays, a holo sheen and a tier stamp. Other World adds a starfield and an aurora. Tap anywhere to skip.
- **Open another pack.** After a bought pack is revealed, a big "Open another pack (1 Jewel)" button appears with your Jewel count, next to a smaller "Done". With 0 Jewels you see only Done and a "Get more Jewels" link.
- **Hydrosol byproduct.** Every distillation gives the essential oil **plus** its hydrosol: Rose Water for Damask Rose, worth 15% of the oil; every other hydrosol is worth 11%. Lavender 8 · Calendula 10 · Chamomile 13 · Peppermint 17 · Rosemary 28 · Jasmine 46 · Rose Water 50 coins. Both sell at the Farm Stand.
- **Parking Lot: customers come in groups.** With a lot, each arrival brings a group of cars, nose to tail, and each car is one customer. Stack Parking Lot cards to level the lot up:

  | Level | Spots | Cars per arrival | Gap between arrivals (avg, before atmosphere) | Customers / min (vs ~2 with no lot) | Extra-item chance |
  |---|---|---|---|---|---|
  | Lv1 | 2 | 2 | ×1.4 (~32 s) | ~3.8 | 30% |
  | Lv2 | 3 | 2 | ×1.2 (~27 s) | ~4.4 | 40% |
  | Lv3 | 4 | 3 | ×1.25 (~28 s) | ~6.4 | 50% |
  | Lv4 | 6 | 3 | ×1.15 (~26 s) | ~7.0 | 60% |

  Painted spots appear on the lot as it levels up. Cars park front to back, shop, then leave. If the lot is partly full, a smaller group comes. The water truck now parks clear of the lot.
- **Two stands per rain barrel.** Every stand on the barrel's plot connects automatically (Farm, Tincture or Essential Oil Stand, up to 2). Each connected stand adds 1 water per refill tick, so 2 stands give +2 per tick, and with the Windmill that is 2 water every 20 s. Capacity stays 10. Each connection gets its own gutter pipe. The barrel panel shows "2 stands connected • +2 per tick" along with the countdown. The Supply Market roof only feeds the Home barrel while there is no Farm Stand, and it doesn't count as a stand.
- **A barrel feeds up to 8 beds.** That is its own plot's beds plus those on the plot directly **behind** it: Home → North Woods, West Woods → Hollow Woods, East Woods → Bramble Woods ("behind" = the owned plot one row further from the road). Irrigation and hand watering there use the barrel in front, so the plot behind doesn't need its own barrel, though it can still have one. A bed uses its own plot's barrel first. Selecting a barrel frames every bed it reaches in green, and the panel says "Feeds X/8 beds".

## New in v0.51 — one tier system for every card

Garden and feature cards now use the plant tiers too (Basic, Epic, Legendary, Rare, Super Rare, Ultra Rare, Other World, from lowest to highest), so a tier name means the same thing everywhere. The old feature ranks were mapped in order, and every card keeps its rank and its exact per-card pack odds.

| Old feature rank | New tier | Cards | Odds per card |
|---|---|---|---|
| Uncommon | **Basic** | Rain Barrel, Irrigation | 10% |
| Rare | **Epic** | Tincture Stand, Essential Oil Stand, Harvest Sickle, Hand Plow, Roadside Billboard | 2.5% |
| Epic | **Legendary** | Honeybee Skep, Parking Lot, Windmill | 2.33% |
| Legendary | **Rare** | Golden Sundial | 2% |

(No feature card was ever Common.)

- **Cards:** feature cards use the same tier label, colour and frame as plant cards of that tier.
- **Collection:** grouped into 7 tier groups, each holding its plants plus its features.
- **Pack odds:** shown per tier. Each figure is that tier's plants plus its features: Basic 60%, Epic 20.5%, Legendary 11.5%, Rare 5%, Super Rare 1.8%, Ultra Rare 0.8%, Other World 0.4%.
- **Market and pack opening:**
  - Market feature rows carry the tier tag.
  - When you open a pack, the face-down glow and the sparkles follow the tier.
- **Saves:** rarity was never stored in a save, so old saves load unchanged and are re-tagged 0.51.
- **Fix:** Epic-and-up cards used to fade to 35% opacity every 2.4 s. A tab-bar animation with the same name was overriding the card glow pulse; it has been renamed.

## New in v0.5 — the full plant catalog

21 plants, 3 per tier, in tier order. Each tier up has lower pack odds, a longer grow time, a higher seed cost and a higher flower price, with no overlap between tiers.

| Tier | Plants | Grow | Seed cost | Flower sells | Seeds / harvest | Pack odds (tier) |
|---|---|---|---|---|---|---|
| Basic | Lavender, Calendula, Chamomile | 35–80 s | 6–18 | 5–24 | 5 | 40% |
| Epic | Peppermint, Echinacea, Lemon Balm | 100–115 s | 24–27 | 28–32 | 4–5 | 8% |
| Legendary | Rosemary, Yarrow, Sunflower | 145–165 s | 38–44 | 46–54 | 4 | 4.5% |
| Rare | Damask Rose, Holy Basil (Tulsi), Elderflower | 190–205 s | 62–68 | 78–84 | 3–4 | 3% |
| Super Rare | Saffron Crocus, Blue Lotus, Jasmine | 260–285 s | 100–118 | 140–158 | 2–3 | 1.8% |
| Ultra Rare | Ghost Orchid, Jade Vine, Middlemist Red | 350–380 s | 170–190 | 245–275 | 2 | 0.8% |
| Other World | Moonflower, Crystal Rose, Spiral Sunpetal | 460–500 s | 280–320 | 440–520 | 1 (sometimes 2) | 0.4% |

Garden-feature cards keep their v0.41 odds exactly (41.5% of all cards together). Plants share the other 58.5% by tier. The Jewel drop stays at 4%.

- **3D:** every plant has its own procedural model in the painterly palette. Rare and Super Rare plants have a soft halo, Ultra Rare a brighter one, and Other World the strongest glow plus floating motes.
- **Cards:** tier label and colour on every card. Rare and above get distinct frames, and Other World gets an iridescent animated frame. The Packs screen shows odds per tier, and the collection is grouped by tier.
- **Market:** a plant's seeds appear in the Supply Market once its card is found. Locked tiers show one summary row each.
- **Uses:**
  - glycerite and vinegar tinctures: Peppermint, Echinacea, Lemon Balm, Rosemary, Yarrow, Holy Basil, Elderflower;
  - drying rack: Lavender, Peppermint, Lemon Balm, Rosemary, Yarrow, Holy Basil, Elderflower;
  - essential oils: Peppermint, Rosemary, Damask Rose, Jasmine.
  
  Recipes for higher tiers show once the plant is unlocked.
- **Early game unchanged:** Basic plants keep their exact numbers and the starter pack is the same.
- **Saves:** older saves load without loss. New items start at 0 and the save is re-tagged 0.5. The old fantasy-id remap now runs only for saves from before v0.5, so the new Other World plants are never rewritten.

## New in v0.41
- **Card Packs cost Jewels.** The Botanical Card Pack (3 cards; there is only one pack type) costs **1 Jewel** instead of coins.
  - With no Jewels the Market button reads **"Need 1 Jewel"** and opens the Jewel Shop.
  - The free Starter Pack is unchanged and still gives 3 Jewels. The v0.2 migration gift (3 Jewels + a sapling) stays.
  - **Earning Jewels in play:** every cleared tree, stump or rock has a **4%** chance to hide a Jewel (`JEWEL_DROP` in `js/data.js`).
  - **Spend Jewels** (Jewel Shop): 1 Jewel → **1000 coins**, or 1 Jewel → **250 Wood** (`JEWEL_EXCHANGE`).
  - New goal "Open a Card Pack"; tips, Market text and goals updated.
- **Selling restored finds and placed items.** Two routes:
  - **Antiques at the stand:** stock a restored find on the Farm Stand ("Restored finds · antiques") and a customer buys it for the antique price. Unstocking returns it to your Bag.
  - **Instant buyback (50%)** from Bag → Restored, or from a placed item's sheet, always with a confirm step.

    | Item | Antique (stand) | Buyback |
    |---|---|---|
    | Old Crate Shelf | 15 | 8 |
    | Bottle Chime | 16 | 8 |
    | Planter | 18 | 9 |
    | Trellis | 20 | 10 |
    | Gnome | 24 | 12 |
    | Lantern | 26 | 13 |
    | Weathervane | 28 | 14 |
    | Bench | 34 | 17 |
    | Brass Watering Can | 40 | 20 |
    | Wheelbarrow | 45 | 22 |
    | Placed Beehive | — | 30 |
    | Plot rain barrel | — | 20 |

  - Selling removes the item's effect: decor drops its atmosphere, the Watering Can returns barrels to 1/min and cap 10 (water above the cap is clamped), the Wheelbarrow bonus ends, the Crate Shelf can't be sold while the stand holds more than its normal capacity, a sold hive stops its bees, and a sold plot barrel unhooks that plot's irrigated beds.
  - **Can't be sold:** the Home plot's rain barrel (your free water) and the Farm Stand.
- **Tincture Stand is placed by you.** Build → Tincture Stand → "Choose a spot & build". It must go on cleared ground of a **bought neighbouring plot**, never the Home (Roadside) lot.
  - Valid spots show as green ghosts and invalid ones as pink. Tapping the Home lot says "Build it on one of your other plots".
  - Until you own another plot the Build entry is locked with "Buy a neighbouring plot first".
  - **Migration: grandfathered.** A Tincture Stand already built on the Home lot in an older save stays where it is and keeps its flasks.
- **Essential Oil Stand** (Rare feature card, found in Card Packs): bought at the Supply Market for **150 coins**, built for **25 Wood**, placed with the same rules as the Tincture Stand.
  - A copper-still stall with 2 stills that glow and puff steam while distilling. It uses **seeds only** (no flowers, no base), and stills keep running while the game is closed.

    | Oil | Seeds | Time | Sells for | Those seeds sell / cost new |
    |---|---|---|---|---|
    | Lavender Essential Oil | 5 Lavender | 3:00 | 70 | 15 / 30 |
    | Calendula Essential Oil | 4 Calendula | 3:30 | 95 | 20 / 40 |
    | Chamomile Essential Oil | 3 Chamomile | 4:00 | 120 | 27 / 54 |

  - Oils sell at the Farm Stand (prices rise with the plant card's level). New goal "Distill an essential oil".
- **Rain barrels need a roof.** A barrel only collects rain through a **gutter** from a roofed stand on the **same plot**. It connects automatically (no tapping); the gutter and downspout are drawn from the roof to the barrel.
  - The Home barrel connects to the Farm Stand; before the stand exists it uses the Supply Market's roof, so the free water always works.
  - On a bought plot the barrel connects to a Tincture Stand or Essential Oil Stand on that plot (the Drying Rack has no roof).
  - An unconnected barrel shows "Not collecting: connect to a stand on this plot", has no countdown, and does not refill, including offline catch-up. Its stored water can still be used.
- **Sickle and Plow work on one raised bed.** Tap the tool, then tap a raised bed; every bed you own gets a frame (green = something to do there, grey = nothing to do).
  - **Harvest Sickle: "Harvest a whole raised bed at once."** Harvests every ripe plant in that bed only (normal yields and seeds). **80 coins** (was 100).
  - **Hand Plow: "Plant a whole raised bed at once."** Pick a seed, then a bed: every empty tile in that bed is planted, as far as your seeds go. **90 coins** (was 110).
  - Both now rest **8 s** between uses (was 20 s). Card levels still shorten that by 15% per level.
- **Windmill** (Epic feature card): bought at the Supply Market for **160 coins** once found, built **once** anywhere on your own cleared ground for **20 Wood** (Build → Windmill → "Choose a spot & build"). Its sails turn gently.
  - **Global:** every rain barrel on the map that is connected to a stand refills faster. Unconnected barrels still don't collect.

    | | No Watering Can | Brass Watering Can (×½) |
    |---|---|---|
    | No Windmill | 60 s | 30 s |
    | Windmill Lv1 | **40 s** | **20 s** |
    | Windmill Lv2 | 36 s | 18 s |
    | Windmill Lv3 | 33 s | 16.5 s |
    | Windmill Lv4 | 30 s | 15 s |

  - The bonuses multiply. Countdowns, barrel labels and offline catch-up all use the new rate, and barrel info shows **"Windmill: faster refill"**.
- **Parking Lot** (Epic feature card, found in Card Packs): bought at the Supply Market for **140 coins** once found, built for **20 Wood** (needs the Farm Stand). It paints parking bays along the near lane beside the Farm Stand and adds a blue "P" sign.
  - **Room for 2 cars at once** (card Lv2+: **3 cars**). Without the lot only one customer stops at a time.
  - Customers arrive **30% more often**: the gap between arrivals is 15–30 s × 0.7 = **10.5–21 s** (×atmosphere, as before). Without the lot the 15–30 s gap starts when the previous car leaves.
  - **30% of customers buy +1 item** (+10% per card level above 1): their bubble shows the extra and they say "One more, please!".
  - Cars park in bays from the stand outward; when the front car leaves, the others pull forward.
- **Roadside Billboard** (Rare feature card): bought at the Supply Market for **90 coins**, built across the road for **15 Wood**.
  - Tap it → **Run ad**: **2× traffic for 5 minutes** (customer gaps halved, passing cars twice as often). The bulbs chase and the sign glows, and a label over it counts down ("Ad running · 4m 12s").
  - **Free once an hour** (the hour starts when the ad starts); the label then reads "Free again in 42m 10s".
  - During the wait, **1 Jewel runs it now**, always after a confirm dialog (Cancel spends nothing). With no Jewels the confirm opens the Jewel Shop.
  - Boost and cooldown are saved as timestamps, so they keep counting while the game is closed.
  - Both traffic effects stack: Parking + ad = gaps × 0.35.
- **HUD tidy-up for phones.**
  - The goal tracker is a small pill under the top bar (goal icon + goal number, e.g. "3/16"). Tap it to expand the full goal card; it collapses on the next tap or after 5 s. It also opens briefly when a goal completes. "Hint" in the expanded card opens the goal's tip.
  - Floating buttons (Sickle, Plow), the goal pill and customer speech bubbles hide whenever a panel, sheet, card reveal, confirm, zoomed card or partner ad is open, and come back when it closes. Panels sit above every floating HUD item.
  - Safe areas: HUD, goal pill, tool dock, panels, tab bar and the ad banner all use `env(safe-area-inset-*)`, so nothing sits under the notch or the home indicator.
- **Save migration (v0.4 → v0.41):** saves are re-tagged `build: '0.41'`; Oil Stand, Windmill, Parking Lot and Billboard state is added; a Home-lot Tincture Stand is grandfathered; barrel connections are worked out live, so nothing else needs converting.

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
- **Harvest Sickle** (Rare tool card, 100 coins at the Market once found; *v0.41: 80 coins, one bed, 8 s rest*). Tap the Sickle button (left side, or Use in the Bag/Market), then tap a plot: every ripe plant in every bed on that plot is harvested with a sweeping blade and items fly to the Bag. Unripe plants are skipped; normal yields and seeds apply. Reusable, with a 20 s rest.
- **Hand Plow** (Rare tool card, 110 coins at the Market once found; *v0.41: 90 coins, one bed, 8 s rest*). Tap the Plow, pick a seed, then tap a plot: every empty bed tile there is planted in order, as far as your seeds go (e.g. "Planted 9 / 12 (out of seeds)"), with a furrow animation. Beds only. Reusable, with a 20 s rest.
- **Plant tiers (data only for now):** `PLANT_TIERS` in `js/data.js`, lowest → highest: Basic, Epic, Legendary, Rare, Super Rare, Ultra Rare, Other World. Each tier sets seeds per harvest (Basic 5 · Epic 4–5 · Legendary 4 · Rare 3–4 · Super Rare 2–3 · Ultra Rare 2 · Other World 1, 25% chance of 2) plus placeholder multipliers for pack drop weight, grow time, cost and sell price. Lavender, Calendula and Chamomile are Basic; the disabled fantasy plants are Ultra Rare / Other World. Plant cards show their tier; feature/tool cards keep their Common…Legendary frame.
- **Beehives are placed, and boost only their own plot.** The Honeybee Skep (Epic feature card, **60 coins** at the Market) is now a placeable skep: after buying, tap cleared ground on an owned plot (not a bed). Its bees give **+1 flower per harvest** (the old effect) but only to beds on that plot. Boosted beds get a soft honey tint and a 🐝 marker, and plant info shows "🐝 Bees: +40% flowers" (Lavender/Calendula +40%, Chamomile +67% of an average harvest). **One hive per plot**, no stacking; the Market keeps selling hives while an owned plot still lacks one. Seeds are unaffected.
- **Card stacks & upgrades.** Every copy of a card now stacks on one card with a ×n badge (Bag → Cards; pack reveals say "Stacked ×n"). At **3 / 6 / 10 copies** a plant or tool card glows and shows **Upgrade**; tap it to level up (Lv2 / Lv3 / Lv4 max). Copies are **kept as progress**, never spent.
  - Plants, per level: +10% sell price (flowers and that plant's dried goods / tinctures), −5% grow time, +1 Beauty/Yield pip on the card; Lv4 also adds +1 flower per harvest. **Seeds per harvest never change** (they follow the tier).
  - Sickle and Plow: −15% rest per level *(v0.64: removed; the tools have no rest and their copies just stack)*.
  - Each extra Irrigation card is one more irrigated bed. Other feature cards just stack. A copy of an already-maxed card pays the old duplicate coins.
  - Thresholds and boosts live in `CARD_LEVELS` in `js/data.js`. The level shows on the card and in plant info.
- **One rain barrel per plot. Water only comes from rain barrels.**
  - Water is no longer sold. The Market's "Watering can refill" and "Rain Barrel water" items are gone, and there is no bag water.
  - The home plot's barrel is still free with your first raised bed. The Starter Seed Pack now fills it to 10 instead of giving 10 bag water.
  - A bought plot gets its barrel from the Supply Market: **Rain Barrel, 40 coins** (unlocked by the Rain Barrel card in the Starter Pack). Buying it gives a placeable barrel. Tap open ground in an owned plot that has no barrel to place it.
  - The rule is one barrel per plot. The Market only offers a barrel while one of your plots still needs it, and the Build menu shows which plots need one.
  - Each barrel has its own water: 1 per minute, cap 10 (the Brass Watering Can makes it 30 s and cap 15). Each refills independently, including while the game is closed. *(v0.41: only while connected to a roofed stand on the same plot; see below.)*
- **Live countdown.** A badge floats above each barrel, e.g. "7/10 · next in 0:42", or "10/10 · Full", plus "Feeds 2/4 beds".
  - It ticks every second, shrinks when zoomed out, and fades when zoomed far out.
  - Tap a barrel to open its sheet. It shows the same countdown and the connected beds, each with an **Unhook** button.
- **4 beds per barrel.**
  - Irrigated beds drink only from their own plot's barrel. Hoses run inside the plot to the bed side that faces the barrel.
  - A barrel feeds at most 4 beds in its plot. A 5th is refused with "This barrel already feeds 4 beds. Build another plot's barrel or unhook a bed".
  - Every plot has exactly 4 bed patches, so the cap is a safety rule that normal play does not reach.
  - Unhook a bed from its tile sheet or from the barrel sheet. The Irrigation card becomes spare again.
- **Hand watering.** It uses the bed's own plot barrel first, then the nearest other barrel that has water. Barrels always refill, and the home barrel is free, so you can't get stuck.
- **Tincture Stand** (Rare feature card): found in a Card Pack, then bought at the Supply Market for 120 coins, then built from the Build menu. *(v0.41: it is now placed by you on a bought neighbouring plot; see below.)*
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

Progress autosaves to localStorage (`petalspire.v03`; v0.3 through v0.41 share the same save key, and saves are tagged with their build, now `build: '0.41'`; plants already growing in a v0.3 save keep their progress). v0.2 saves are migrated automatically: your beds, stand, rack, market, land and coins are kept, plus a gift of a sapling and 3 Jewels. The old save is kept as a backup.

## Tech
Plain HTML/CSS/ES modules with no build step. Three.js r170 is vendored in `vendor/`. All 3D meshes are procedural low-poly, made in code.
- `js/layout.js`: lots, bed sites and obstacle placement (seeded, so the same for everyone)
- `js/world.js`: the scene, camera, picking, chopping, cars, build animations, blueprints, finds, decor and growing trees
- `js/data.js`: costs, timings, finds, bundles, ad config
- `js/main.js`: game state, goals, panels, the stand and customers, and the card reveal
- `js/payments.js`, `js/ads.js`: the swappable purchase and ad layers
- `js/shade.js`: the shade model (pure functions)

Run it locally with `python3 -m http.server` and open http://localhost:8000. Add `?treeMin=1` to make trees grow in 1 minute when testing.
