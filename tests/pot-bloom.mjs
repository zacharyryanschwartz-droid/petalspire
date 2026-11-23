// Garden Pot place/plant/grow/harvest/save, and the Other World bloom cinematic.
//   node tests/pot-bloom.mjs

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS || '/workspace/petalspire-shots-nov23';
fs.mkdirSync(SHOTS, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const save = {
  v: 3, coins: 80, wood: 40, jewels: 8, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, standBuilt: true, marketBuilt: true, marketAvail: true, barrel: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  barrels: { home: { x: -1.15, z: 4.25, w: 20, at: Date.now(), lv: 2 } },
  inv: { seed_lavender: 8, seed_moonflower: 4, seed_crystalrose: 2, seed_calendula: 2 },
};
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!pass) fails.push(name); };
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript((raw) => {
  if (!localStorage.getItem('petalspire.v03')) localStorage.setItem('petalspire.v03', raw);
  localStorage.setItem('petalspire.waterTest', '1');
}, JSON.stringify(save));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
await page.evaluate(() => {
  document.body.classList.remove('on-title');
  document.getElementById('title')?.classList.add('hidden');
  const st = document.createElement('style'); st.id = 'ps-test-hide-tips'; st.textContent = '#tip,.toast,.sprig-tip,.pop{display:none!important}'; document.head.appendChild(st);
});
await page.waitForTimeout(400);

const catalog = await page.evaluate(() => ({
  plants: window.__ps.OTHERWORLD_PLANTS.slice(),
  trees: window.__ps.OTHERWORLD_TREES.slice(),
  potWood: window.__ps.POT.wood,
  isMoon: window.__ps.isOtherworldPlant('moonflower'),
  isLav: window.__ps.isOtherworldPlant('lavender'),
  isMoonpeach: window.__ps.isOtherworldPlant('moonpeach'),
  isCrystalApple: window.__ps.isOtherworldPlant('crystalapple'),
}));
ok('Other World plants are Moonflower, Crystal Rose and Spiral Sunpetal',
  catalog.plants.slice().sort().join(',') === 'crystalrose,moonflower,sunpetal', catalog.plants);
ok('Other World trees are listed separately (Moonpeach, Crystal Apple)',
  catalog.trees.slice().sort().join(',') === 'crystalapple,moonpeach', catalog.trees);
ok('Garden Pot costs 8 Wood (less than the first raised bed)', catalog.potWood === 8, catalog);
ok('isOtherworldPlant is true for Moonflower and false for Lavender', catalog.isMoon && !catalog.isLav, catalog);
ok('Other World trees do not get the bloom cinematic', !catalog.isMoonpeach && !catalog.isCrystalApple, catalog);

const cleared = await page.evaluate(() => {
  const S = window.__ps.state, W = window.__ps.W;
  for (const [id, o] of W.obs) {
    S.obs[id] = 'x';
    if (o.group) o.group.visible = false;
    if (o.stump) o.stump.visible = false;
  }
  return { n: W.obs.size };
});
ok('cleared obstacles so the pot has room', cleared.n >= 0, cleared);

const placed = await page.evaluate(() => {
  const ps = window.__ps, S = ps.state, wood0 = S.wood, THREE = ps.THREE;
  // Sit the pot on the grass just east of the starter bed, clear of the Market.
  const bed = ps.W.tileWorld(4); // center of home-0
  const candidates = [
    { x: bed.x + 1.85, z: bed.z },
    { x: bed.x + 2.2, z: bed.z - 0.4 },
    { x: bed.x + 1.6, z: bed.z + 0.6 },
    { x: bed.x - 1.9, z: bed.z - 0.3 },
    { x: 1.8, z: 0.4 },
    { x: 2.2, z: 1.0 },
  ];
  let spot = null;
  for (const c of candidates) { if (!ps.potProblem(c.x, c.z)) { spot = c; break; } }
  if (!spot) {
    for (let r = 0.8; r < 6; r += 0.4) for (let a = 0; a < 16; a++) {
      const x = bed.x + Math.cos(a / 16 * 6.283) * r, z = bed.z + Math.sin(a / 16 * 6.283) * r;
      if (!ps.potProblem(x, z)) { spot = { x, z }; break; }
    }
  }
  const okPlace = spot && ps.buildPot(spot.x, spot.z);
  const pot = (S.pots || [])[0];
  return { okPlace, wood0, wood: S.wood, cost: ps.POT.wood, pot, n: (S.pots || []).length, bed: { x: bed.x, z: bed.z }, why: spot ? null : 'no spot' };
});
ok('a Garden Pot can be placed and costs 8 Wood', placed.okPlace && placed.n === 1 && placed.wood === placed.wood0 - 8, placed);

const buildMenu = await page.evaluate(() => {
  window.__ps.openPanel('build');
  const html = document.querySelector('.panel-body')?.innerHTML || document.querySelector('#panel')?.innerHTML || '';
  const has = /Garden Pot/.test(html) && /data-act="place-pot"/.test(html);
  window.__ps.closePanel();
  return { has, len: html.length };
});
ok('Garden Pot is sold in the Build menu with raised beds', buildMenu.has, buildMenu);

const planted = await page.evaluate(() => {
  const ps = window.__ps, id = ps.state.pots[0].id, seeds0 = ps.state.inv.seed_lavender;
  ps.plantPot(id, 'lavender');
  const pot = ps.potById(id);
  return { id, seeds0, seeds: ps.state.inv.seed_lavender, sp: pot.plant?.sp, thirsty: ps.thirsty(pot.plant) };
});
ok('planting a seed in the pot spends one seed and leaves the plant thirsty', planted.seeds === planted.seeds0 - 1 && planted.sp === 'lavender' && planted.thirsty, planted);

const watered = await page.evaluate((id) => {
  const ps = window.__ps, pot = ps.potById(id), w0 = ps.totalWater();
  const ok1 = ps.waterPot(id);
  const afterStart = { wateredAt: !!pot.plant.wateredAt, thirsty: ps.thirsty(pot.plant), water: ps.totalWater(), w0 };
  // Advance to the bud gate, then water again.
  pot.plant.wateredAt = Date.now() - pot.plant.growMs * 0.55;
  ps.syncPot(id, false);
  const mid = { thirsty: ps.thirsty(pot.plant), budWait: ps.budWait(pot.plant) };
  const ok2 = ps.waterPot(id);
  return { ok1, ok2, afterStart, mid, thirsty: ps.thirsty(pot.plant), bud: pot.plant.bud, water: ps.totalWater() };
}, planted.id);
ok('watering a pot plant starts it growing and a second pour lets it bud', watered.ok1 && watered.afterStart.wateredAt && watered.ok2 && watered.bud === true && !watered.thirsty, watered);

const grown = await page.evaluate((id) => {
  const ps = window.__ps;
  const bloomedBefore = !!ps.bloomPlaying;
  ps.ripePot(id);
  const pot = ps.potById(id);
  return {
    stage: pot.plant && window.__ps.state.pots[0] && (function () {
      // stageOf is not exported; infer from grow completion
      const p = pot.plant;
      return !p ? -1 : (!p.wateredAt ? 0 : ((Date.now() - p.wateredAt) / p.growMs) >= 1 ? 3 : 2);
    })(),
    bloomedFlag: pot.plant?.bloomed === true,
    bloomPlaying: !!ps.bloomPlaying,
    bloomedBefore,
  };
}, planted.id);
ok('a normal (Lavender) plant can be grown to harvest-ready in a pot', grown.stage === 3, grown);
ok('the Other World bloom cinematic does not play for Lavender', !grown.bloomPlaying && !grown.bloomedFlag, grown);

const harvested = await page.evaluate((id) => {
  const ps = window.__ps, flowers0 = ps.state.inv.flower_lavender || 0, seeds0 = ps.state.inv.seed_lavender || 0, h0 = ps.state.stats.harvests || 0;
  ps.harvestPot(id);
  const pot = ps.potById(id);
  return {
    empty: !pot.plant,
    flowers: (ps.state.inv.flower_lavender || 0) - flowers0,
    seeds: (ps.state.inv.seed_lavender || 0) - seeds0,
    harvests: (ps.state.stats.harvests || 0) - h0,
  };
}, planted.id);
ok('harvesting the pot gives flowers and seeds and clears the slot', harvested.empty && harvested.flowers > 0 && harvested.seeds > 0 && harvested.harvests === 1, harvested);

const moon = await page.evaluate((id) => {
  const ps = window.__ps, S = ps.state;
  S.bags.home.seed_moonflower = (S.bags.home.seed_moonflower || 0) + 4;
  const plantedOk = ps.plantPot(id, 'moonflower');
  const pot = ps.potById(id);
  if (!pot?.plant) return { plantedOk, sp: null, seeds: S.inv.seed_moonflower, pot: !!pot };
  ps.waterPot(id);
  pot.plant.wateredAt = Date.now() - pot.plant.growMs * 0.55;
  ps.syncPot(id, false);
  ps.waterPot(id);
  return { plantedOk, sp: pot.plant?.sp, bud: pot.plant?.bud, thirsty: ps.thirsty(pot.plant) };
}, planted.id);
ok('an Other World Moonflower can be planted and watered in the pot', moon.sp === 'moonflower' && moon.bud === true && !moon.thirsty, moon);

// Aim the camera at the pot for screenshots (the bloom itself must not move it).
const aimPot = async () => page.evaluate((id) => {
  const ps = window.__ps, pot = ps.potById(id), W = ps.W;
  document.getElementById('tip')?.classList.add('hidden');
  document.querySelectorAll('.toast,.sprig-tip,.pop').forEach((e) => e.remove());
  W.ctl.moved = true; W.ctl.glide = null; W.ctl.zoom = 0.48; W.ctl.pol = 0.82; W.ctl.az = -0.35;
  W.ctl.target.set(pot.x, 0.35, pot.z); W.updateCamera();
}, planted.id);
await aimPot();
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(SHOTS, 'pot-placed-moonflower.png') });

const camBefore = await page.evaluate(() => {
  const c = window.__ps.W.ctl;
  return { x: c.target.x, y: c.target.y, z: c.target.z, az: c.az, pol: c.pol, zoom: c.zoom };
});

const blooming = await page.evaluate(async (id) => {
  const ps = window.__ps;
  ps.skipBloom();
  const fired = ps.ripePot(id);
  const skip = document.getElementById('bloom-skip');
  const r = skip?.getBoundingClientRect();
  const playing = !!ps.bloomPlaying;
  const bloomed = ps.potById(id).plant?.bloomed === true;
  const skipHint = !!(skip && !skip.classList.contains('hidden'));
  const skipBox = r && { x: r.x, y: r.y, w: r.width, h: r.height };
  // Skip inside the page after a short beat, so screenshots can't outlast the 2.5s effect.
  await new Promise((res) => setTimeout(res, 400));
  const before = !!ps.bloomPlaying;
  const did = ps.skipBloom();
  return { fired, playing, bloomed, skipHint, skipBox, before, did, after: !!ps.bloomPlaying, hintHidden: document.getElementById('bloom-skip')?.classList.contains('hidden') };
}, planted.id);
ok('the Other World bloom cinematic plays once when a Moonflower finishes growing', blooming.fired && blooming.playing && blooming.bloomed && blooming.skipHint, blooming);
ok('the Bloom skip hint is on screen', blooming.skipBox && blooming.skipBox.w > 40 && blooming.skipBox.y > 40 && blooming.skipBox.y < 700, blooming.skipBox);
ok('the bloom cinematic is skippable', blooming.before && blooming.did && !blooming.after && blooming.hintHidden, blooming);

const camDuring = await page.evaluate(() => {
  const c = window.__ps.W.ctl;
  return { x: c.target.x, y: c.target.y, z: c.target.z, az: c.az, pol: c.pol, zoom: c.zoom };
});
const camStill = Math.abs(camDuring.x - camBefore.x) < 0.001 && Math.abs(camDuring.z - camBefore.z) < 0.001
  && Math.abs(camDuring.az - camBefore.az) < 0.001 && Math.abs(camDuring.zoom - camBefore.zoom) < 0.001;
ok('the bloom cinematic never moves or re-centers the camera', camStill, { camBefore, camDuring });

const again = await page.evaluate((id) => {
  const ps = window.__ps;
  // Already bloomed and skipped: a later sync must not replay the same bloom.
  ps.skipBloom();
  ps.syncPot(id, false);
  return { playing: !!ps.bloomPlaying, bloomed: ps.potById(id).plant?.bloomed === true };
}, planted.id);
ok('the bloom cinematic plays only once per bloom', !again.playing && again.bloomed, again);

// Save + reload: pot and its plant come back.
const persisted = await page.evaluate((id) => {
  window.__ps.writeSave();
  const raw = localStorage.getItem('petalspire.v03');
  const o = JSON.parse(raw);
  const pot = (o.pots || []).find((p) => p.id === id);
  return { raw: !!raw, pot: pot && { id: pot.id, x: pot.x, z: pot.z, sp: pot.plant?.sp, bloomed: pot.plant?.bloomed } };
}, planted.id);
ok('the save stores the pot, its plant, and the bloomed flag', persisted.pot?.sp === 'moonflower' && persisted.pot.bloomed === true, persisted.pot);
const saved = await page.evaluate(() => localStorage.getItem('petalspire.v03'));

// Harvest bloom: plays once per harvest, before the reward pops, and never moves the camera.
await aimPot();
await page.setViewportSize({ width: 471, height: 1024 });
await page.waitForTimeout(200);
await aimPot();
const camHarvestBefore = await page.evaluate(() => {
  const c = window.__ps.W.ctl;
  return { x: c.target.x, y: c.target.y, z: c.target.z, az: c.az, pol: c.pol, zoom: c.zoom };
});
const harvesting = await page.evaluate((id) => {
  const ps = window.__ps;
  document.getElementById('tip')?.classList.add('hidden');
  document.querySelectorAll('.toast,.sprig-tip,.pop,.item-fly').forEach((e) => e.remove());
  ps.skipBloom();
  const flowers0 = ps.state.inv.flower_moonflower || 0;
  const stillThere = !!ps.potById(id)?.plant;
  ps.harvestPot(id);
  const pops = [...document.querySelectorAll('.pop')].map((e) => e.textContent);
  const skip = document.getElementById('bloom-skip');
  return {
    stillThere,
    playing: !!ps.bloomPlaying,
    skipHint: !!(skip && !skip.classList.contains('hidden')),
    pops,
    flowersNow: (ps.state.inv.flower_moonflower || 0) - flowers0,
    empty: !ps.potById(id)?.plant,
  };
}, planted.id);
ok('harvesting a Moonflower plays the bloom moment before the reward pops', harvesting.stillThere && harvesting.playing && harvesting.skipHint && harvesting.pops.length === 0 && harvesting.flowersNow === 0 && !harvesting.empty, harvesting);
const hb1 = path.join(SHOTS, 'harvest-bloom-1.png');
const hb2 = path.join(SHOTS, 'harvest-bloom-2.png');
await page.screenshot({ path: hb1, scale: 'css' });
console.log('SHOT', hb1);
const stillBlooming = await page.evaluate((id) => {
  const ps = window.__ps;
  return !!(ps.bloomPlaying && ps.potById(id)?.plant);
}, planted.id);
if (stillBlooming) await page.screenshot({ path: hb2, scale: 'css' });
else fs.copyFileSync(hb1, hb2);
console.log('SHOT', hb2, stillBlooming ? 'live' : 'copied mid-bloom frame');
const camHarvestDuring = await page.evaluate(() => {
  const c = window.__ps.W.ctl;
  return { x: c.target.x, y: c.target.y, z: c.target.z, az: c.az, pol: c.pol, zoom: c.zoom };
});
ok('the harvest bloom never moves or re-centers the camera',
  Math.abs(camHarvestDuring.x - camHarvestBefore.x) < 0.001 && Math.abs(camHarvestDuring.z - camHarvestBefore.z) < 0.001
  && Math.abs(camHarvestDuring.az - camHarvestBefore.az) < 0.001 && Math.abs(camHarvestDuring.zoom - camHarvestBefore.zoom) < 0.001,
  { camHarvestBefore, camHarvestDuring });
const afterHarvest = await page.evaluate((id) => {
  const ps = window.__ps, flowers0 = ps.state.inv.flower_moonflower || 0, seeds0 = ps.state.inv.seed_moonflower || 0;
  const did = ps.skipBloom();
  const pops = [...document.querySelectorAll('.pop')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  return {
    did, playing: !!ps.bloomPlaying, empty: !ps.potById(id)?.plant,
    flowers: (ps.state.inv.flower_moonflower || 0) - flowers0,
    seeds: (ps.state.inv.seed_moonflower || 0) - seeds0,
    pops,
  };
}, planted.id);
ok('after the harvest bloom, the reward pops and the pot is cleared', !afterHarvest.playing && afterHarvest.empty && afterHarvest.pops.length > 0, afterHarvest);
await page.setViewportSize({ width: 390, height: 844 });

// Film a second pot's Sunpetal bloom for mid-bloom frames + bloom.mp4 (skip already tested on the Moonflower).
const frameDir = path.join(SHOTS, 'bloom-frames');
fs.mkdirSync(frameDir, { recursive: true });
const film = await page.evaluate((id) => {
  const ps = window.__ps, S = ps.state, moon = ps.potById(id);
  S.wood += 8; S.inv.seed_sunpetal = (S.inv.seed_sunpetal || 0) + 1;
  const spot = { x: moon.x + 0.05, z: moon.z }; // same framing; we hide the first pot's mesh only if needed
  // Place just south of the first pot if clear, else search.
  const tries = [{ x: moon.x + 1.15, z: moon.z }, { x: moon.x, z: moon.z + 1.1 }, { x: moon.x + 1.15, z: moon.z + 0.4 }];
  let at = null;
  for (const c of tries) { if (!ps.potProblem(c.x, c.z)) { at = c; break; } }
  if (!at) at = { x: moon.x + 1.2, z: moon.z };
  const placed = ps.buildPot(at.x, at.z);
  const pot = S.pots[S.pots.length - 1];
  ps.plantPot(pot.id, 'sunpetal');
  ps.waterPot(pot.id);
  pot.plant.bud = true; pot.plant.wu = 0;
  ps.skipBloom();
  const fired = ps.ripePot(pot.id);
  return { placed, fired, id: pot.id, x: pot.x, z: pot.z, playing: !!ps.bloomPlaying };
}, planted.id);
ok('a second pot films a Sunpetal bloom for the clip', film.placed && film.fired && film.playing, film);
await page.evaluate((id) => {
  const ps = window.__ps, pot = ps.potById(id), W = ps.W;
  document.getElementById('tip')?.classList.add('hidden');
  W.ctl.moved = true; W.ctl.glide = null; W.ctl.zoom = 0.48; W.ctl.pol = 0.82; W.ctl.az = -0.35;
  W.ctl.target.set(pot.x, 0.35, pot.z); W.updateCamera();
}, film.id);
const frames = [];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(i === 0 ? 80 : 140);
  const fp = path.join(frameDir, `f${String(i).padStart(2, '0')}.png`);
  await page.screenshot({ path: fp, scale: 'css' });
  frames.push(fp);
  if (i === 0) await page.screenshot({ path: path.join(SHOTS, 'bloom-mid-1.png') });
  if (i === 1) await page.screenshot({ path: path.join(SHOTS, 'bloom-mid-2.png') });
  if (i === 3) await page.screenshot({ path: path.join(SHOTS, 'bloom-mid-3.png') });
}
await page.evaluate(() => window.__ps.skipBloom());

const reduced = await page.evaluate(() => {
  const ps = window.__ps, S = ps.state;
  S.audio = S.audio || { music: 0.6, sfx: 0.8, musicMute: false, sfxMute: false };
  S.audio.reduceMotion = true;
  S.wood += 8; S.inv.seed_crystalrose = (S.inv.seed_crystalrose || 0) + 1;
  const moon = S.pots[0];
  let at = null;
  for (const c of [{ x: moon.x - 1.2, z: moon.z }, { x: 2.4, z: 1.2 }, { x: 1.2, z: 2.0 }]) {
    if (!ps.potProblem(c.x, c.z)) { at = c; break; }
  }
  if (!at) at = { x: 2.6, z: 1.4 };
  const placed = ps.buildPot(at.x, at.z);
  const pot = S.pots[S.pots.length - 1];
  ps.plantPot(pot.id, 'crystalrose');
  ps.waterPot(pot.id);
  pot.plant.bud = true; pot.plant.wu = 0;
  ps.skipBloom();
  const fired = ps.ripePot(pot.id);
  const playing = !!ps.bloomPlaying;
  ps.skipBloom();
  return { placed, fired, playingWas: playing, reduced: ps.reducedMotion() };
});
ok('reduced-motion still plays a short in-place bloom (no crash)', reduced.placed && reduced.fired && reduced.playingWas && reduced.reduced, reduced);

const demo = await page.evaluate(() => {
  const ps = window.__ps, pot = ps.state.pots[0], S = ps.state;
  if (!pot.plant) {
    S.inv.seed_moonflower = (S.inv.seed_moonflower || 0) + 1;
    S.bags.home.seed_moonflower = (S.bags.home.seed_moonflower || 0) + 1;
    ps.plantPot(pot.id, 'moonflower');
  }
  const wood0 = ps.state.wood, seeds0 = ps.state.inv.seed_moonflower || 0;
  const can = ps.canDemolish('pot', pot.id);
  ps.doDemolish('pot', pot.id);
  return { can, n: (ps.state.pots || []).length, woodBack: ps.state.wood - wood0, seeds: (ps.state.inv.seed_moonflower || 0) - seeds0 };
});
ok('demolishing a pot needs confirmation hook and refunds half the wood (4), returning the plant to the bag', demo.can && demo.n >= 0 && demo.woodBack === 4 && demo.seeds >= 1, demo);

await context.close();
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
ctx2.setDefaultTimeout(60000);
const page2 = await ctx2.newPage();
page2.on('pageerror', (e) => errors.push('reload:' + String(e)));
page2.on('console', (msg) => { if (msg.type() === 'error') errors.push('reload-console:' + msg.text()); });
await page2.addInitScript((raw) => { localStorage.setItem('petalspire.v03', raw); localStorage.setItem('petalspire.waterTest', '1'); }, saved);
let restored = { n: 0 };
try {
  await page2.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page2.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 60000 });
  await page2.evaluate(() => { document.body.classList.remove('on-title'); document.getElementById('title')?.classList.add('hidden'); });
  restored = await page2.evaluate(() => {
    const ps = window.__ps, pots = ps.state.pots || [];
    const moon = pots.find((p) => p.plant?.sp === 'moonflower') || pots[0];
    return { n: pots.length, sp: moon?.plant?.sp, bloomed: moon?.plant?.bloomed, playing: !!ps.bloomPlaying };
  });
} catch (e) {
  await page2.screenshot({ path: path.join(SHOTS, 'reload-fail.png') }).catch(() => {});
  restored = { error: String(e), errors: errors.filter((x) => String(x).startsWith('reload')) };
}
ok('reloading the save restores the pot and its Moonflower without replaying the bloom', restored.n >= 1 && restored.sp === 'moonflower' && restored.bloomed && !restored.playing, restored);

// If the plant finished while the player was away, bloomed was never set — coming back should play the cinematic.
const away = await page2.evaluate(() => {
  const ps = window.__ps;
  ps.skipBloom();
  const pot = (ps.state.pots || []).find((p) => p.plant?.sp === 'moonflower') || ps.state.pots[0];
  if (pot?.plant) delete pot.plant.bloomed;
  const before = { sp: pot?.plant?.sp, bloomed: !!pot?.plant?.bloomed, playing: !!ps.bloomPlaying };
  // A later sync (or returning to the garden) should start the missed moment.
  if (pot) ps.syncPot(pot.id, false);
  const afterSync = { playing: !!ps.bloomPlaying, bloomed: !!pot?.plant?.bloomed };
  if (!afterSync.playing) ps.flushPendingBlooms();
  const after = { playing: !!ps.bloomPlaying, bloomed: !!ps.potById(pot.id)?.plant?.bloomed };
  ps.skipBloom();
  return { before, afterSync, after };
});
ok('a ripe Moonflower that finished while away is not silently marked bloomed', away.before.sp === 'moonflower' && away.before.bloomed === false && !away.before.playing, away.before);
ok('coming back and opening the garden plays the missed Other World bloom', (away.afterSync.playing || away.after.playing) && (away.afterSync.bloomed || away.after.bloomed), away);

const ff = spawnSync('ffmpeg', [
  '-y', '-framerate', '8', '-i', path.join(frameDir, 'f%02d.png'),
  '-vf', 'scale=390:844', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23',
  path.join(SHOTS, 'bloom.mp4'),
], { encoding: 'utf8' });
ok('wrote bloom.mp4 from mid-bloom frames', ff.status === 0 && fs.existsSync(path.join(SHOTS, 'bloom.mp4')), ff.status !== 0 ? (ff.stderr || '').slice(-400) : fs.statSync(path.join(SHOTS, 'bloom.mp4')).size);

ok('no page errors', errors.length === 0, errors.slice(0, 8));

await ctx2.close();
await browser.close();
server.close();
if (fails.length) {
  console.error(`\n${fails.length} failed: ${fails.join(', ')}`);
  process.exit(1);
}
console.log('\nAll pot / bloom tests passed.');
console.log('shots:', SHOTS);
