// Rain barrel / bulk box spacing, finger-sized hits, move, and demolish.
//   node tests/move-demolish.mjs

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  v: 3, coins: 40, wood: 4, jewels: 2, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, standBuilt: true, rackAvail: true, rackBuilt: true, rackLv: 3,
  beds: ['home-0', 'home-1'], tiles: Array(18).fill(null),
  barrels: { home: { x: -2.2, z: 2.35, w: 9, at: Date.now(), lv: 3 } },
  rack: [{ sp: 'lavender', start: Date.now(), ms: 9e9 }, null, null],
  upg: { rack: { start: Date.now(), ms: 9e9, to: 4 } },
  stats: { standEarned: 16 },
};
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!pass) fails.push(name); };
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript((raw) => { if (!localStorage.getItem('petalspire.v03')) localStorage.setItem('petalspire.v03', raw); }, JSON.stringify(save));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
await page.waitForTimeout(400);

const spaced = await page.evaluate(() => {
  const S = window.__ps.state, W = window.__ps.W, THREE = window.__ps.THREE;
  const nudged = { ...S.barrels.home }, bulk0 = W.bulkAt('home');
  const dist = Math.hypot(nudged.x - bulk0.x, nudged.z - bulk0.z);
  S.barrels.home.x = -1.15; S.barrels.home.z = 4.25; W.setBarrelXZ('home', -1.15, 4.25);
  const b = S.barrels.home, bulk = W.bulkAt('home');
  const aim = (x, z) => { W.ctl.moved = true; W.ctl.glide = null; W.ctl.zoom = 0.8; W.ctl.pol = 0.72; W.ctl.target.set(x, 0.4, z); W.updateCamera(); };
  const span = (x, y, z, dx, dz) => {
    const a = W.project(new THREE.Vector3(x, y, z));
    const c = W.project(new THREE.Vector3(x + dx, y, z + dz));
    return Math.hypot(c.x - a.x, c.y - a.y) * 2;
  };
  W.barrel.visible = true; W.stand.visible = true; W.bulkHome().visible = true;
  W.barrel.updateMatrixWorld(true); W.bulkHome().updateMatrixWorld(true); W.stand.updateMatrixWorld(true);
  aim(b.x, b.z);
  const barrelPx = span(b.x, 0.7, b.z, 0.95, 0);
  const bc = W.project(new THREE.Vector3(b.x, 0.7, b.z));
  const barrelHit = W.pick(bc.x, bc.y);
  aim(bulk.x, bulk.z);
  const bulkPx = span(bulk.x, 0.8, bulk.z, 1.05, 0);
  const uc = W.project(new THREE.Vector3(bulk.x, 0.8, bulk.z));
  const bulkHit = W.pick(uc.x, uc.y);
  const parked = { x: b.x, z: b.z, w: b.w, lv: b.lv };
  aim(b.x, b.z);
  W.setBulkPos('home', b.x + 0.4, b.z + 0.15);
  W.bulkHome().updateMatrixWorld(true);
  const bc2 = W.project(new THREE.Vector3(b.x, 0.7, b.z));
  const overlap = W.pick(bc2.x, bc2.y);
  W.setBulkPos('home', bulk.x, bulk.z);
  return { dist, moved: Math.hypot(nudged.x + 2.2, nudged.z - 2.35) > 0.2, barrelPx, bulkPx, barrelHit: barrelHit?.kind, bulkHit: bulkHit?.kind, overlap: overlap?.kind, parked, bulk };
});
ok('an overlapping saved barrel is pushed clear of the bulk box', spaced.dist >= 2 && spaced.moved, spaced);
ok('barrel tap area is at least 44px across', spaced.barrelPx >= 44, spaced);
ok('bulk box tap area is at least 44px across', spaced.bulkPx >= 44, spaced);
ok('tapping the barrel center picks the barrel', spaced.barrelHit === 'barrel', spaced);
ok('tapping the bulk box center picks the bulk box', spaced.bulkHit === 'bulkbox', spaced);
ok('when the hit areas overlap, the object under the finger wins', spaced.overlap === 'barrel', spaced);

const moved = await page.evaluate(() => {
  const S = window.__ps.state;
  const before = { w: S.barrels.home.w, lv: S.barrels.home.lv, x: S.barrels.home.x, z: S.barrels.home.z };
  let spot = null;
  for (let x = -4; x <= 4 && !spot; x += 0.5) for (let z = -1; z <= 3.2 && !spot; z += 0.5) if (window.__ps.moveSpotOk(x, z, 'barrel', 'home')) spot = { x, z };
  const bad = window.__ps.commitMove({ what: 'move', kind: 'barrel', id: 'home' }, 0.75, 3.95);
  const same = S.barrels.home.x === before.x && S.barrels.home.z === before.z;
  const good = spot ? window.__ps.commitMove({ what: 'move', kind: 'barrel', id: 'home' }, spot.x, spot.z) : false;
  for (const [id, o] of window.__ps.W.obs) {
    const p = o.group?.position || o.stump?.position; if (!p) continue;
    if (Math.abs(p.x - 2.15) < 2 && Math.abs(p.z + 4.5) < 2) S.obs[id] = 'x';
  }
  const bed = window.__ps.commitMove({ what: 'move', kind: 'bed', id: 'home-0' }, 'home-3');
  return {
    before, spot, bad, same, good,
    w: S.barrels.home.w, lv: S.barrels.home.lv, x: S.barrels.home.x, z: S.barrels.home.z,
    bed, beds: [...S.beds],
  };
});
ok('a blocked spot is refused and the barrel stays', moved.bad === false && moved.same, moved);
ok('moving the barrel keeps its water and level', moved.good === true && moved.w === moved.before.w && moved.lv === moved.before.lv && (moved.x !== moved.before.x || moved.z !== moved.before.z), moved);
ok('the first bed can move to another patch', moved.bed === true && moved.beds.includes('home-3') && !moved.beds.includes('home-0'), moved);

const guard = await page.evaluate(() => {
  const ps = window.__ps, S = ps.state;
  const no = ['stand', 'market', 'bulk', 'oshed'].map((k) => ps.canDemolish(k, ''));
  const barrel = ps.canDemolish('barrel', 'home');
  const first = ps.canDemolish('bed', S.beds.find((id) => id.startsWith('home')) || S.beds[0]);
  const extra = ps.canDemolish('bed', 'home-1');
  return { no, barrel, first, extra };
});
ok('the farm stand, market, bulk box, and orchard stand stay', guard.no.every((v) => v === false), guard);
ok('the home barrel and the first bed stay', guard.barrel === false && guard.first === false, guard);
ok('a later bed can be demolished', guard.extra === true, guard);

const demo = await page.evaluate(() => {
  const S = window.__ps.state;
  S.tiles[9] = { sp: 'lavender', plantedAt: 1, wateredAt: 1, growMs: 1, sun: 1 };
  const flowers = S.inv.flower_lavender || 0, seeds = S.inv.seed_lavender || 0, wood = S.wood;
  window.__ps.doDemolish('bed', 'home-1');
  const rackWood = S.wood, rackFlowers = S.inv.flower_lavender || 0;
  window.__ps.doDemolish('rack', '');
  return {
    flowers: (S.inv.flower_lavender || 0) - flowers, seeds: (S.inv.seed_lavender || 0) - seeds,
    wood: S.wood - wood, rackWood: S.wood - rackWood, rackLv: S.rackLv, rackBuilt: S.rackBuilt,
    upg: S.upg?.rack || null, driedOrFlower: rackFlowers, beds: S.beds.length, tiles: S.tiles.length,
  };
});
ok('demolishing a bed returns its plant and refunds half the wood', demo.flowers >= 1 && demo.seeds >= 1 && demo.wood >= 5 && demo.beds === 1 && demo.tiles === 9, demo);
ok('demolishing the rack returns the hanging flower, refunds half the wood, and drops its level', demo.rackWood === 5 && demo.driedOrFlower >= 1 && demo.rackLv === 1 && demo.rackBuilt === false && !demo.upg, demo);

await page.evaluate(() => {
  const root = document.documentElement;
  root.classList.add('native-app');
  root.style.setProperty('--native-sat', '59px');
  root.style.setProperty('--native-sab', '34px');
  root.style.setProperty('--app-h', '844px');
  document.body.classList.add('ads-on');
  document.body.classList.remove('on-title');
  document.getElementById('title')?.classList.add('hidden');
  document.querySelectorAll('.toast').forEach((n) => n.remove());
  const S = window.__ps.state, W = window.__ps.W, THREE = window.__ps.THREE;
  W.appear(W.stand, false); W.appear(W.barrel, false);
  S.barrels.home.x = -1.15; S.barrels.home.z = 4.25; W.setBarrelXZ('home', -1.15, 4.25);
  W.setBulkPos('home', -2.2, 1.7);
  const b = S.barrels.home, bulk = W.bulkAt('home');
  W.ctl.moved = true; W.ctl.glide = null; W.ctl.zoom = 0.62; W.ctl.pol = 0.55;
  W.ctl.target.set((b.x + bulk.x) / 2, 0.4, (b.z + bulk.z) / 2);
  W.updateCamera(); W.render();
});
await page.waitForTimeout(200);
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
await page.screenshot({ path: '/opt/cursor/artifacts/move-spaced-390x844.png' });

await page.evaluate(() => {
  window.__ps.startMove('barrel', 'home');
  const S = window.__ps.state, W = window.__ps.W;
  const b = S.barrels.home;
  let spot = null;
  for (let x = -4; x <= 4 && !spot; x += 0.5) for (let z = 0; z <= 3.4 && !spot; z += 0.5) if (window.__ps.moveSpotOk(x, z, 'barrel', 'home')) spot = { x, z };
  let show = null;
  for (let x = -3.4; x <= 3.4 && !show; x += 0.4) for (let z = 1.2; z <= 3.6 && !show; z += 0.4) if (window.__ps.moveSpotOk(x, z, 'barrel', 'home')) show = { x, z };
  if (show) W.setMoveGhost(show.x, show.z, true);
  W.ctl.moved = true; W.ctl.glide = null; W.ctl.zoom = 0.7; W.ctl.pol = 0.6;
  W.ctl.target.set((show || b).x, 0.4, (show || b).z); W.updateCamera(); W.render();
  window.__ps._blocked = { x: b.x + 0.2, z: b.z };
});
await page.waitForTimeout(250);
await page.screenshot({ path: '/opt/cursor/artifacts/move-preview-390x844.png' });
await page.evaluate(() => {
  const b = window.__ps._blocked; if (!b) return;
  const W = window.__ps.W;
  W.setMoveGhost(b.x, b.z, false);
  W.ctl.target.set(b.x, 0.4, b.z); W.updateCamera(); W.render();
});
await page.waitForTimeout(150);
await page.screenshot({ path: '/opt/cursor/artifacts/move-blocked-390x844.png' });

await page.evaluate(() => {
  window.__ps.exitPlace();
  const S = window.__ps.state;
  S.rackBuilt = true; S.rackLv = 2; window.__ps.W.rack.visible = true;
  window.__ps.openPanel('rack');
});
await page.waitForTimeout(200);
await page.click('#panel-body [data-act="demo-thing"]');
await page.waitForTimeout(200);
const confirm = await page.evaluate(() => {
  const t = document.getElementById('confirm')?.innerText?.replace(/\s+/g, ' ') || '';
  const btn = document.querySelector('#panel-body .move-demo');
  return { text: t, move: !!document.querySelector('#panel-body [data-act="move-thing"]'), h: btn ? Math.round(btn.getBoundingClientRect().height) : 0 };
});
ok('demolish asks, names the wood refund, and says upgrades are lost', /Demolish/.test(confirm.text) && /Wood/.test(confirm.text) && /Upgrades on it are lost/.test(confirm.text), confirm);
ok('move and demolish buttons are a finger-height row', confirm.move && confirm.h >= 44, confirm);
await page.screenshot({ path: '/opt/cursor/artifacts/demolish-confirm-390x844.png' });

const standBtns = await page.evaluate(() => {
  window.__ps.closePanel();
  document.getElementById('confirm')?.classList.add('hidden');
  window.__ps.openPanel('stand');
  const body = document.getElementById('panel-body');
  return { move: !!body.querySelector('[data-move="stand"]'), demo: !!body.querySelector('[data-act="demo-thing"]') };
});
ok('the farm stand can move and cannot be demolished', standBtns.move && !standBtns.demo, standBtns);
ok('move and demolish do not throw', errors.length === 0, errors);

await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
