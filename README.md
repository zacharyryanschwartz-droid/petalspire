# Petalspire v0.2

A cozy 3D flower-garden prototype for iPhone Safari (portrait, one thumb). Also plays on desktop with a mouse.

**Play:** https://zacharyryanschwartz-droid.github.io/petalspire/

## v0.2 loop
1. **The woods.** A new game opens on an overgrown lot beside a country road. Tap trees to chop them (+3 Wood, sometimes a coin). Tap the stumps left behind to dig them out (+1 Wood).
2. **Build.** Build → Choose a spot → tap a cleared patch to place a raised bed (12 Wood for the first; later beds cost more). You can only plant in raised beds (3×3 plots).
3. **Starter Seed Pack.** Your first bed comes with a free pack: Heartvine and Spiral Sunpetal seeds plus 10 water. A rain barrel by the stand refills 1 water every 20 s, up to 10.
4. **Roadside Farm Stand.** Stock it with flowers, seeds or dried herbs. Every 15–30 s a pastel car pulls up, shows what it wants in a thought bubble, pays and drives off.
5. **Supply Market.** It starts boarded up and reopens after you earn 100 coins at the stand. It sells seeds, water, garden features and Card Packs (new cards unlock items here).
6. **Drying Rack.** Appears after your first Heartvine harvest. Dried Heartvine sells for more.
7. **Land for sale.** Five wooded plots surround yours, each with a For Sale sign. Prices go 150 → 300 → 600 → 1000 → 1500 coins. Once you buy a plot, you can clear its trees for Wood and room for 4 more beds. You can't chop trees on land you don't own.

A goal tracker under the HUD walks you through each step. Tap it to repeat the hint.

- Drag to rotate, pinch or scroll to zoom, and tap trees, soil, the stand, the market, the rack or the signs.
- Progress autosaves to localStorage (`petalspire.v02`). Old v0.1 saves are cleared, so you start fresh in the woods. Settings → Reset garden.

## Tech
Plain HTML/CSS/ES modules with no build step. Three.js r170 is vendored in `vendor/`. All 3D meshes are procedural low-poly, made in code.
- `js/layout.js`: lots, bed sites and obstacle placement
- `js/world.js`: the scene, camera, picking, chopping, cars and structures
- `js/main.js`: game state, goals, the stand and customers, panels and the card reveal

Run it locally with `python3 -m http.server` and open http://localhost:8000.
