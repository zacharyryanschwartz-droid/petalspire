// Regression for the v0.8.7.6 launch rule: rain-barrel irrigation shares water across beds,
// and one pour starts one thirsty plant — while the game is open and while it was closed.
// Closed-time pours are dated at the moment the water landed, so that growth counts.
//
// Run from the repo root with Playwright installed:
//   node tests/offline-irrigation.mjs

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };

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

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await page.route(/appwrite\.io/, (route) => route.abort());
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps && window.__ps.BUILD);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__ps.state.introDone === true, { timeout: 25000 });

  const result = await page.evaluate(() => {
    const ps = window.__ps, S = ps.state;
    S.wood = 200; S.starterOpened = true; S.tut = { done: true }; S.guideDone = true;
    for (const o of ps.obstacles('home')) { S.obs[o.id] = 'x'; ps.W.setObstacle(o.id, 'gone'); }
    for (const id of ['home-0', 'home-1']) ps.buildBed(id);
    S.bags.home.seed_lavender = 30;
    for (let i = 0; i < S.tiles.length; i++) if (!S.tiles[i]) ps.plant(i, 'lavender');
    ps.giveIrrigation(1);
    for (const id of S.beds) ps.assignIrrigation(id);
    const reset = () => {
      for (const t of S.tiles) if (t) { t.wateredAt = null; t.bud = false; t.wu = 0; }
      S.bedCredit = {};
      S.barrels.home.w = 4;
      S.savedAt = Date.now();
      S.barrels.home.at = Date.now();
    };
    const started = () => S.beds.map((id) => {
      const b = S.beds.indexOf(id);
      let n = 0;
      for (let k = 0; k < 9; k++) if (S.tiles[b * 9 + k]?.wateredAt) n++;
      return n;
    });
    reset();
    ps.autoIrrigate(() => 0);
    const live = { started: started(), water: S.barrels.home.w };
    reset();
    ps.catchUpIrrigation(() => 0);
    const offline = { started: started(), water: S.barrels.home.w, credit: { ...(S.bedCredit || {}) } };
    reset();
    const past = Date.now() - 20000;
    S.savedAt = past;
    S.barrels.home.at = past;
    S.barrels.home.w = 4;
    ps.catchUpIrrigation(() => 0);
    const aged = S.tiles.filter((p) => p && p.wateredAt).map((p) => Date.now() - p.wateredAt);
    const grown = { started: started(), credit: { ...(S.bedCredit || {}) }, minAge: aged.length ? Math.min(...aged) : 0, n: aged.length };
    return { beds: S.beds.slice(), live, offline, grown };
  });

  const liveOk = result.live.started.length === 2 && result.live.started.every((n) => n > 0) && result.live.started.reduce((a, b) => a + b, 0) === 4;
  const offlineOk = result.offline.started.length === 2 && result.offline.started.every((n) => n > 0) && result.offline.started.reduce((a, b) => a + b, 0) === 4;
  const credit = Object.values(result.offline.credit || {}).reduce((a, b) => a + b, 0);
  const grownOk = result.grown.n === 4 && result.grown.started.every((n) => n > 0) && result.grown.minAge >= 15000 && Object.values(result.grown.credit || {}).reduce((a, b) => a + b, 0) === 0;
  console.log(JSON.stringify(result, null, 2));
  if (!liveOk) {
    console.error('FAIL live autoIrrigate did not spread 4 water across both beds');
    process.exitCode = 1;
  }
  if (!offlineOk || credit !== 0) {
    console.error('FAIL catchUpIrrigation did not spread 4 water into one plant per pour across both beds');
    console.error('expected both beds to start some of the 4 plants and leave no unused credit; got ' + JSON.stringify(result.offline));
    process.exitCode = 1;
  }
  if (!grownOk) {
    console.error('FAIL closed-time growth was not dated from the pour during the offline window');
    console.error(JSON.stringify(result.grown));
    process.exitCode = 1;
  }
  if (liveOk && offlineOk && credit === 0 && grownOk) console.log('PASS offline irrigation matches the live pour');
} finally {
  await browser.close();
  server.close();
}
