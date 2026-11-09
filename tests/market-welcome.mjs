// Market opening: iOS bundle showcase once, then Sprig's seed lesson. Web skips the showcase.
//   node tests/market-welcome.mjs

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
  v: 3, coins: 5, wood: 40, jewels: 2, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, standBuilt: true, marketBuilt: true, marketAvail: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  barrels: { home: { x: -1.15, z: 4.25, w: 9, at: Date.now(), lv: 1 } },
});
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!pass) fails.push(name); };
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });

async function boot(native) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(({ raw, isNative }) => {
    if (isNative) {
      window.__PETALSPIRE_NATIVE__ = true;
      window.Capacitor = { registerPlugin() { return {
        async loadProducts() { return { products: [
          { productId: 'com.petalspire.starter2', displayPrice: '$4.99' },
          { productId: 'com.petalspire.collector', displayPrice: '$19.99' },
        ] }; },
        async purchase() { return { status: 'cancelled' }; },
      }; } };
    }
    if (!localStorage.getItem('petalspire.v03')) localStorage.setItem('petalspire.v03', raw);
  }, { raw: save, isNative: native });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.classList.add('native-app');
    root.style.setProperty('--native-sat', '59px');
    root.style.setProperty('--native-sab', '34px');
    root.style.setProperty('--app-h', '844px');
    document.body.classList.add('ads-on');
    document.body.classList.remove('on-title');
    document.getElementById('title')?.classList.add('hidden');
  });
  return { page, errors, context };
}

const web = await boot(false);
await web.page.evaluate(() => window.__ps.beginMarketWelcome());
await web.page.waitForTimeout(300);
const webState = await web.page.evaluate(() => ({
  showcase: !!document.getElementById('bundle-showcase'),
  step: document.getElementById('mkt-tut')?.innerText?.replace(/\s+/g, ' ').slice(0, 80) || '',
  skip: !!document.querySelector('#mkt-tut .tut-skip'),
}));
ok('web skips the bundle showcase', webState.showcase === false, webState);
ok('web still starts the seed lesson', /Open the Market/.test(webState.step) && webState.skip === false, webState);
await web.context.close();

const native = await boot(true);
await native.page.evaluate(() => window.__ps.beginMarketWelcome());
await native.page.waitForSelector('#bundle-showcase', { timeout: 8000 });
const shown = await native.page.evaluate(() => {
  const t = document.getElementById('bundle-showcase').innerText.replace(/\s+/g, ' ');
  return { t, buys: document.querySelectorAll('#bundle-showcase [data-offer-buy]').length, later: !!document.querySelector('#bundle-showcase [data-bundle-x]') };
});
ok('showcase lists both bundles with prices and a way out', /Starter Pack/.test(shown.t) && /Collector/.test(shown.t) && /\$4\.99/.test(shown.t) && /\$19\.99/.test(shown.t) && shown.buys === 2 && shown.later, shown.t.slice(0, 180));
await native.page.screenshot({ path: '/opt/cursor/artifacts/market-showcase-390x844.png' });
await native.page.click('#bundle-showcase .sp-later');
await native.page.waitForSelector('#mkt-tut', { timeout: 5000 });
const openStep = await native.page.evaluate(() => document.getElementById('mkt-tut').innerText.replace(/\s+/g, ' '));
ok('Sprig starts by opening the Market', /Step 1 of 4: Open the Market/.test(openStep) && !/skip/i.test(openStep), openStep);
await native.page.screenshot({ path: '/opt/cursor/artifacts/market-sprig-open-390x844.png' });
await native.page.click('#tab-market');
await native.page.waitForFunction(() => /Pick a seed/.test(document.getElementById('mkt-tut')?.innerText || ''));
await native.page.screenshot({ path: '/opt/cursor/artifacts/market-sprig-pick-390x844.png' });
await native.page.click('#panel-body [data-seed-pick]');
await native.page.waitForFunction(() => /Buy it/.test(document.getElementById('mkt-tut')?.innerText || ''));
const topped = await native.page.evaluate(() => window.__ps.state.coins);
ok('Sprig tops up coins so the seed can be bought', topped >= 18, topped);
await native.page.screenshot({ path: '/opt/cursor/artifacts/market-sprig-buy-390x844.png' });
await native.page.click('#panel-body [data-buy^="seed_"]');
await native.page.waitForFunction(() => /See it in your Bag/.test(document.getElementById('mkt-tut')?.innerText || ''));
await native.page.screenshot({ path: '/opt/cursor/artifacts/market-sprig-bag-390x844.png' });
await native.page.click('#tab-bag');
await native.page.waitForFunction(() => window.__ps.state.marketWelcome?.done === true, { timeout: 5000 });
const after = await native.page.evaluate(() => {
  window.__ps.openPanel('market');
  const id = window.__ps.state.marketWelcome.seed;
  const n = window.__ps.state.inv[id] || 0;
  return { id, n, showcase: !!document.getElementById('bundle-showcase'), guide: !!document.getElementById('mkt-tut') && !document.getElementById('mkt-tut').classList.contains('hidden') };
});
ok('the bought seed is in the bag and the welcome does not return', after.n >= 1 && after.showcase === false && after.guide === false, after);
ok('market welcome does not throw', native.errors.length === 0 && web.errors.length === 0, native.errors.concat(web.errors));

await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
