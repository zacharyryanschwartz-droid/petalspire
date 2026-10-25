// Petalspire v0.31: shade model. Pure functions, no DOM; numbers live in SHADE (js/data.js).
import { SHADE } from './data.js';

// casters: [{ x, z, w, reach }] — w and reach are already scaled for the caster's size/stage
export function shadeAt(x, z, casters, C = SHADE) {
  let s = 0;
  for (const c of casters) {
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
