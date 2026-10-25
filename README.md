# Petalspire v0.1

A cozy 3D flower-garden prototype for iPhone Safari (portrait, one thumb). Also plays on desktop with a mouse.

**Play:** https://zacharyryanschwartz-droid.github.io/petalspire/

## Loop
Plant → water → grow (seed → sprout → bud → bloom, about 35–80 s) → harvest flowers and seeds → replant, sell at the Market, open a Card Pack (3-card reveal, which unlocks new items in the Market), or hang Heartvine on the Drying Rack (Dried Heartvine sells for more).

- Drag to rotate the garden, pinch or scroll to zoom, tap a soil tile, the Market stall or the Drying Rack.
- Progress autosaves to localStorage. Settings (gear) → Reset garden.

## Tech
Plain HTML/CSS/ES modules with no build step. Three.js r170 is vendored in `vendor/`. All 3D meshes are procedural low-poly, made in code.
Run it locally with `python3 -m http.server` and open http://localhost:8000.
