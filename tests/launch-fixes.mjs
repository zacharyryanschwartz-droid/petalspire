// v0.8.7.6 checks: unreadable save backup, tiles:null repair, Orders tip, title-screen popups.
// Run from the repo root with Playwright installed:
//   node tests/launch-fixes.mjs

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
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!pass) fails.push(name); };

async function boot(init) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await context.route(/appwrite\.io/, (route) => route.abort());
  if (init) await context.addInitScript(init.fn, init.arg);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps && window.__ps.BUILD, { timeout: 20000 }).catch(() => {});
  return { context, page, errors };
}

try {
  { const { context, page, errors } = await boot({ fn: () => localStorage.setItem('petalspire.v03', '{not json'), arg: undefined });
    await page.waitForTimeout(400);
    const got = await page.evaluate(() => ({
      build: window.__ps?.BUILD || null,
      bak: localStorage.getItem('petalspire.v03.bak'),
      raw: localStorage.getItem('petalspire.v03'),
      coins: window.__ps?.state?.coins,
    }));
    let parsed = false; try { parsed = !!JSON.parse(got.raw); } catch { parsed = false; }
    ok('version is 0.8.7.6', got.build === '0.8.7.6', got.build);
    ok('unreadable save is kept in petalspire.v03.bak', got.bak === '{not json', got.bak);
    ok('a fresh garden replaces the bad key only after the backup', parsed && got.coins === 10, { coins: got.coins, head: (got.raw || '').slice(0, 40) });
    ok('unreadable save does not throw', errors.length === 0, errors);
    await context.close();
  }

  { const fixture = { v: 3, build: '0.8.7.5', coins: 2222, wood: 9, jewels: 4, introDone: true, tut: { done: true }, guideDone: true, lots: { home: true }, tiles: null, teas: null, trees: null, beds: ['home-0'], stats: { customers: 6 } };
    const { context, page, errors } = await boot({ fn: (raw) => localStorage.setItem('petalspire.v03', raw), arg: JSON.stringify(fixture) });
    const got = await page.evaluate(() => {
      const S = window.__ps?.state;
      return S ? { coins: S.coins, wood: S.wood, jewels: S.jewels, customers: S.stats?.customers, tiles: Array.isArray(S.tiles), teas: Array.isArray(S.teas), trees: Array.isArray(S.trees), beds: S.beds?.slice?.() } : null;
    });
    ok('tiles:null keeps coins, wood, jewels and stats', !!got && got.coins === 2222 && got.wood === 9 && got.jewels === 4 && got.customers === 6, got);
    ok('tiles, teas and trees are arrays after repair', !!got && got.tiles && got.teas && got.trees, got);
    ok('tiles:null does not throw on startup', errors.length === 0, errors);
    await context.close();
  }

  { const { context, page, errors } = await boot({ fn: () => localStorage.setItem('petalspire.tipTest', '1'), arg: undefined });
    await page.click('#btn-start');
    await page.waitForFunction(() => window.__ps.state.introDone === true);
    const tip = await page.evaluate(() => {
      const S = window.__ps.state;
      S.tut = { done: true }; S.guideDone = true; S.seenTips = {};
      window.__ps.openPanel('orders');
      return document.querySelector('.sprig-tip')?.innerText?.replace(/\s+/g, ' ') || '';
    });
    ok('Orders tip says every 4 orders earn a spin', /Every 4 orders you fill earn a Bonus Wheel spin/.test(tip) && !/free wheel spin/i.test(tip), tip);
    ok('Orders tip has no page error', errors.length === 0, errors);
    await context.close();
  }

  { const save = { v: 3, build: '0.8.7.6', coins: 20, introDone: true, tut: { done: true }, guideDone: true, lots: { home: true }, monet: { playMs: 0, boostAt: 0, starter: {}, promo: {}, wish: {} } };
    const { context, page } = await boot({
      fn: (raw) => {
        localStorage.setItem('petalspire.v03', raw);
        localStorage.setItem('petalspire.monetTest', '1');
        localStorage.setItem('petalspire.dailyTest', '1');
      },
      arg: JSON.stringify(save),
    });
    await page.waitForTimeout(4500);
    const onTitle = await page.evaluate(() => ({
      onTitle: document.body.classList.contains('on-title'),
      starter: !!document.querySelector('#starter'),
      daily: !!document.querySelector('#daily'),
      giftHidden: document.querySelector('#gift-btn')?.classList.contains('hidden'),
    }));
    ok('title screen stays up with no Starter Pack or Daily Gift', onTitle.onTitle && !onTitle.starter && !onTitle.daily && onTitle.giftHidden === true, onTitle);
    await page.click('#btn-start');
    await page.waitForFunction(() => !document.body.classList.contains('on-title'));
    await page.waitForTimeout(5000);
    const inGame = await page.evaluate(() => ({
      onTitle: document.body.classList.contains('on-title'),
      starter: !!document.querySelector('#starter'),
      daily: !!document.querySelector('#daily'),
    }));
    ok('Starter Pack or Daily Gift can show after Continue', !inGame.onTitle && (inGame.starter || inGame.daily), inGame);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (fails.length) { console.error(fails.length + ' failed'); process.exit(1); }
console.log('PASS launch fixes');
