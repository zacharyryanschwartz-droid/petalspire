// Book redeem codes: SNOWFINCH and QUILTBEE grant keepsakes once, show in the Bag, and stay in the save.
//   node tests/book-codes.mjs

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
const save = JSON.stringify({
  v: 3, coins: 40, wood: 40, jewels: 2, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, standBuilt: true, marketBuilt: true, marketAvail: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  barrels: { home: { x: -1.15, z: 4.25, w: 9, at: Date.now(), lv: 1 } },
});
const SNOW = ['d8_snowfinch', 'd8_holly', 'd8_ornament'];
const QUILT = ['d8_quiltstar', 'd8_logcabin', 'd8_compass'];
const NAMES = {
  d8_snowfinch: 'Snowfinch Pair', d8_holly: 'Holly Cluster', d8_ornament: 'Winter Ornament',
  d8_quiltstar: 'Star Quilt', d8_logcabin: 'Log Cabin Quilt', d8_compass: 'Quilt Compass',
};
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!pass) fails.push(name); };
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript((raw) => {
  if (!localStorage.getItem('petalspire.v03')) localStorage.setItem('petalspire.v03', raw);
}, save);
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
await page.evaluate(() => {
  document.body.classList.remove('on-title');
  document.getElementById('title')?.classList.add('hidden');
});

async function redeem(typed) {
  if (!(await page.locator('#redeem-in').isVisible())) await page.click('#btn-settings');
  await page.fill('#redeem-in', typed);
  await page.click('[data-act="redeem"]');
  const text = (await page.locator('.toast').last().innerText()).replace(/\s+/g, ' ');
  return text;
}

const before = await page.evaluate(() => ({ coins: window.__ps.state.coins, wood: window.__ps.state.wood, atm: window.__ps.atmosphereAt('home') }));
const snowToast = await redeem('snow finch');
ok('SNOWFINCH names the book and the three keepsakes', /Holly & Wing/.test(snowToast) && /Snowfinch Pair/.test(snowToast) && /Holly Cluster/.test(snowToast) && /Winter Ornament/.test(snowToast) && /just for looks/.test(snowToast), snowToast);

const snowBag = await page.evaluate((ids) => {
  const s = window.__ps.state;
  return {
    inv: Object.fromEntries(ids.map((id) => [id, s.decorInv[id] || 0])),
    claimed: !!s.codes.SNOWFINCH,
    atm: ids.every((id) => window.__ps.DECO8[id].atm === 0 && window.__ps.DECO8[id].cosmetic && window.__ps.DECO8[id].special),
    shop: window.__ps.decoMarketRows('home').join(''),
  };
}, SNOW);
ok('SNOWFINCH grants two of each keepsake', SNOW.every((id) => snowBag.inv[id] === 2), snowBag.inv);
ok('SNOWFINCH is remembered on the save', snowBag.claimed);
ok('snow keepsakes add no atmosphere and stay out of the Market', snowBag.atm && !/Snowfinch|Holly Cluster|Winter Ornament/.test(snowBag.shop));

const again = await redeem('SNOWFINCH');
ok('a second SNOWFINCH says already claimed', /already claimed/i.test(again), again);
const snowStill = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, window.__ps.state.decorInv[id] || 0])), SNOW);
ok('a second SNOWFINCH adds nothing', SNOW.every((id) => snowStill[id] === 2), snowStill);

await page.click('#tab-bag');
await page.click('[data-bag="finds"]');
const bag = await page.evaluate((ids) => {
  const rows = ids.map((id) => {
    const row = document.querySelector(`[data-d8-bag="${id}"]`);
    return row ? { text: row.innerText.replace(/\s+/g, ' '), html: row.querySelector('.ico')?.innerHTML || '' } : null;
  });
  return { rows, imgs: document.querySelectorAll('#panel-body img').length };
}, SNOW);
ok('Bag Finds lists the snow keepsakes as looks-only', bag.rows.every((r) => r && /Keepsake decoration · just for looks/.test(r.text) && /×2/.test(r.text)), bag.rows?.map((r) => r?.text));
ok('menu icons are drawn markup, not images', bag.rows.every((r) => /<svg/i.test(r.html) && !/<img/i.test(r.html)) && bag.imgs === 0);
await page.locator('[data-d8-bag="d8_ornament"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: '/opt/cursor/artifacts/book-codes-bag.png' });

await page.click('[data-d8-bag="d8_snowfinch"] [data-place]');
const placed = await page.evaluate(async () => {
  const ps = window.__ps;
  ps.camAt(-1.5, 1.2, 0.7);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let hit = null;
  const tryAt = (x, z) => {
    const before = ps.state.decor.length;
    const p = ps.W.project(new ps.THREE.Vector3(x, 0, z));
    if (p.behind) return;
    ps.handleTap(p.x, p.y);
    if (ps.state.decor.length > before) hit = ps.state.decor.at(-1);
  };
  tryAt(-4, 1.4);
  for (let x = -3.2; x <= 2.4 && !hit; x += 0.6) for (let z = -1.6; z <= 3 && !hit; z += 0.6) tryAt(x, z);
  if (hit) ps.camAt(hit.x, hit.z, 0.55);
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  return { hit, stillPlacing: !!ps.placing, atm: ps.atmosphereAt('home'), pop: document.querySelector('.pop')?.innerText || '' };
});
ok('Snowfinch Pair can be placed in the garden', placed.hit?.type === 'd8_snowfinch' && !placed.stillPlacing, placed.hit);
ok('placing a keepsake does not raise atmosphere', placed.atm === before.atm && /Just for looks/.test(placed.pop), { atm: placed.atm, pop: placed.pop });
await page.screenshot({ path: '/opt/cursor/artifacts/book-codes-garden.png' });

const models = await page.evaluate((ids) => {
  const out = {};
  for (const id of ids) {
    window.__ps.W.addDecor('probe-' + id, id, 30, 30);
    const g = window.__ps.W.decors.get('probe-' + id);
    out[id] = g ? g.children.length : 0;
    window.__ps.W.removeDecor('probe-' + id);
  }
  return out;
}, [...SNOW, ...QUILT]);
ok('each keepsake has its own garden model', Object.values(models).every((n) => n >= 3), models);

const quiltToast = await redeem('quiltbee');
ok('QUILTBEE names Pieced & Puzzled and the quilt blocks', /Pieced & Puzzled/.test(quiltToast) && /Star Quilt/.test(quiltToast) && /Log Cabin Quilt/.test(quiltToast) && /Quilt Compass/.test(quiltToast), quiltToast);
const quiltAgain = await redeem('QUILT BEE');
ok('a second QUILTBEE says already claimed', /already claimed/i.test(quiltAgain), quiltAgain);
await page.click('#tab-bag');
await page.click('[data-bag="finds"]');
await page.locator('[data-d8-bag="d8_compass"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: '/opt/cursor/artifacts/book-codes-quilt.png' });

const love = await page.evaluate(() => ({ ok: window.__ps.redeemCode('LOVEBUG'), n: window.__ps.state.decorInv.d8_lovebug || 0 }));
ok('LOVEBUG still grants its own keepsake', love.ok === true && love.n === 2, love);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.state?.codes?.SNOWFINCH, { timeout: 20000 });
const kept = await page.evaluate((ids) => {
  const s = window.__ps.state;
  const raw = JSON.parse(localStorage.getItem('petalspire.v03'));
  return {
    inv: Object.fromEntries(ids.map((id) => [id, s.decorInv[id] || 0])),
    saved: Object.fromEntries(ids.map((id) => [id, raw.decorInv?.[id] || 0])),
    placed: s.decor.filter((d) => d.type === 'd8_snowfinch').length,
    placedSaved: (raw.decor || []).filter((d) => d.type === 'd8_snowfinch').length,
    codes: raw.codes,
    coins: s.coins,
    wood: s.wood,
    atm: window.__ps.atmosphereAt('home'),
  };
}, [...SNOW, ...QUILT, 'd8_lovebug']);
ok('keepsakes persist in the save after reload', SNOW.concat(QUILT).every((id) => kept.inv[id] === (id === 'd8_snowfinch' ? 1 : 2) && kept.saved[id] === kept.inv[id]) && kept.inv.d8_lovebug === 2, kept.inv);
ok('a placed Snowfinch Pair is still in the garden', kept.placed === 1 && kept.placedSaved === 1);
ok('redeeming changes neither coins nor wood nor atmosphere', kept.coins === before.coins && kept.wood === before.wood && kept.atm === before.atm, kept);
ok('both codes stay claimed', !!(kept.codes?.SNOWFINCH && kept.codes?.QUILTBEE && kept.codes?.LOVEBUG));
ok('the page stays free of script errors', errors.length === 0, errors);

await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
console.log('book codes ok');
