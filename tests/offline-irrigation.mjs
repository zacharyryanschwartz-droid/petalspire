// Regression for the v0.8.7.5 launch rule: rain-barrel irrigation shares water across beds,
// and one pour starts one thirsty plant. Live autoIrrigate does this. catchUpIrrigation
// (the close/reload path) still pours the whole barrel into the first bed as a group,
// so a short budget starts nothing and leaves the other beds dry.
//
// This test fails on 0.8.7.5. It is the reproduction, not a fix.
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
    ps.catchUpIrrigation();
    const offline = { started: started(), water: S.barrels.home.w, credit: { ...(S.bedCredit || {}) } };
    return { beds: S.beds.slice(), live, offline };
  });

  const liveOk = result.live.started.length === 2 && result.live.started.every((n) => n > 0) && result.live.started.reduce((a, b) => a + b, 0) === 4;
  const offlineOk = result.offline.started.length === 2 && result.offline.started.every((n) => n > 0) && result.offline.started.reduce((a, b) => a + b, 0) === 4;
  console.log(JSON.stringify(result, null, 2));
  if (!liveOk) {
    console.error('FAIL live autoIrrigate did not spread 4 water across both beds');
    process.exitCode = 1;
  }
  if (!offlineOk) {
    console.error('FAIL catchUpIrrigation did not spread 4 water into one plant per pour across both beds');
    console.error('expected both beds to start some of the 4 plants; got ' + JSON.stringify(result.offline));
    process.exitCode = 1;
  }
  if (liveOk && offlineOk) console.log('PASS offline irrigation matches the live pour');
} finally {
  await browser.close();
  server.close();
}
