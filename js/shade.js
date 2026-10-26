// Petalspire v0.31: shade model. Pure functions, no DOM; numbers live in SHADE (js/data.js).
import { SHADE } from './data.js';

// casters: [{ x, z, w, reach }] — w and reach are already scaled for the caster's size/stage
// v0.52: tall built objects cast a projected shadow. c = { x, z, hx, hz, h, w }: an axis-aligned footprint
// (half sizes hx/hz around x/z) of height h. A ground point is shaded when the ray from it toward the sun
// (C.light.dir on the ground, rising 1 unit per C.light.k) passes over the footprint before it climbs above h,
// i.e. exactly the shadow the renderer's directional light draws. Edges are softened by averaging 3 footprints.
function rayHits(px, pz, ux, uz, L, hx, hz) {
  if (hx <= 0 || hz <= 0) return false;
  let t0 = 0, t1 = L;
  for (const [p, u, h] of [[px, ux, hx], [pz, uz, hz]]) {
    if (Math.abs(u) < 1e-9) { if (Math.abs(p) > h) return false; continue; }
    let a = (-h - p) / u, b = (h - p) / u; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
  }
  return true;
}
export function boxShade(x, z, c, C = SHADE) {
  const L = c.h * C.light.k, [ux, uz] = C.light.dir, soft = C.light.soft;
  let hit = 0;
  for (const m of [-soft, 0, soft]) if (rayHits(x - c.x, z - c.z, ux, uz, L, c.hx + m, c.hz + m)) hit++;
  return c.w * hit / 3;
}
export function shadeAt(x, z, casters, C = SHADE) {
  let s = 0;
  for (const c of casters) {
    if (c.h != null) { s += boxShade(x, z, c, C); if (s >= 1) return 1; continue; }
    const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
    if (d >= c.reach) continue;
    const dir = d < 1e-3 ? 1 : Math.max(0, (dx * C.sunDir[0] + dz * C.sunDir[1]) / d);
    s += c.w * Math.pow(1 - d / c.reach, C.falloff) * ((1 - C.sunBias) + C.sunBias * dir);
    if (s >= 1) return 1;
  }
  return Math.min(1, Math.max(0, s));
}
export const sunAt = (x, z, casters, C = SHADE) => 1 - shadeAt(x, z, casters, C);
export const speedFor = (sun, C = SHADE) => C.minSpeed + (1 - C.minSpeed) * Math.min(1, Math.max(0, sun));
export function sunLabel(sun, C = SHADE) {
  const pct = Math.round(sun * 100);
  const how = sun >= C.slowerBelow ? 'full speed' : sun >= C.muchSlowerBelow ? 'growing slower' : 'growing much slower';
  return { pct, how, text: `Sun: ${pct}% · ${how}`, speed: speedFor(sun, C) };
}
// Keep progress k fixed at time `at` while changing the duration: returns the new start time.
export const rebaseStart = (start, oldMs, newMs, at) => { if (at <= start) return start; const k = Math.min(1, Math.max(0, (at - start) / oldMs)); return at - k * newMs; };
