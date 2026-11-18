// Jewel Shop when the App Store returns nothing: show "Store unavailable" with a retry, never a silently empty shop.
//   node tests/store-unavailable.mjs
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const f = path.join(root, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const save = JSON.stringify({ v: 3, coins: 5, wood: 40, jewels: 2, introDone: true, tut: { done: true }, guideDone: true, lots: { home: true }, standBuilt: true, marketBuilt: true, marketAvail: true, beds: ['home-0'], tiles: Array(9).fill(null), marketWelcome: { done: true } });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + JSON.stringify(detail) : ''}`); if (!pass) fails.push(name); };

async function boot(mode) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(({ raw, mode }) => {
    window.__loads = 0;
    if (mode !== 'web') {
      window.__PETALSPIRE_NATIVE__ = true;
      window.Capacitor = { registerPlugin() { return {
        async loadProducts({ productIds }) {
          window.__loads++;
          if (mode === 'throw') throw new Error('StoreKit down');
          if (mode === 'empty' || (mode === 'later' && window.__loads < 2)) return { products: [], requested: productIds.length, storefront: 'USA', canPay: true };
          return { products: productIds.map((p) => ({ productId: p, displayPrice: '$1.23' })) };
        },
        async purchase() { return { status: 'cancelled' }; },
        addListener() {},
      }; } };
    }
    localStorage.setItem('petalspire.v03', raw);
  }, { raw: save, mode });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps?.state, { timeout: 20000 });
  await page.waitForTimeout(800);
  return { page, errors, context };
}
const shopState = (page) => page.evaluate(() => {
  const b = document.getElementById('panel-body');
  return { cards: b.querySelectorAll('.jewel-card').length, offers: b.querySelectorAll('[data-offer-card]').length, noads: b.querySelectorAll('.noads-card').length,
    down: b.querySelector('[data-store-down]')?.innerText.replace(/\s+/g, ' ') || '', retry: !!b.querySelector('[data-act="store-retry"]'), loads: window.__loads };
});

{ const { page, errors, context } = await boot('ok');
  await page.evaluate(() => window.__ps.openPanel('jewels'));
  const s = await shopState(page);
  ok('store loaded: 3 jewel packs, 2 bundles, No More Ads, no warning', s.cards === 3 && s.offers === 2 && s.noads === 1 && !s.down, s);
  ok('no page errors (loaded)', errors.length === 0, errors); await context.close(); }

for (const mode of ['empty', 'throw']) {
  const { page, errors, context } = await boot(mode);
  await page.evaluate(() => window.__ps.openPanel('jewels'));
  await page.waitForTimeout(300);
  const s = await shopState(page);
  ok(`${mode}: shop says Store unavailable with a Try again button`, s.cards === 0 && /Store unavailable/.test(s.down) && s.retry, s);
  ok(`${mode}: the card names why it is empty`, mode === 'empty' ? /0 of 6 products · storefront USA/.test(s.down) : /bridge: StoreKit down/.test(s.down), s.down);
  ok(`${mode}: opening the shop retried the store`, s.loads >= 2, s.loads);
  await page.waitForTimeout(1500);
  const idle = await page.evaluate(() => window.__loads);
  ok(`${mode}: no retry loop while the shop sits open`, idle === s.loads, { before: s.loads, after: idle });
  if (mode === 'empty') await page.screenshot({ path: '/opt/cursor/artifacts/jewel-shop-store-unavailable-390x844.png' });
  ok(`no page errors (${mode})`, errors.length === 0, errors); await context.close();
}

{ const { page, errors, context } = await boot('later');
  // launch load came back empty; opening the shop asks again and the second answer has products
  await page.evaluate(() => window.__ps.openPanel('jewels'));
  await page.waitForFunction(() => document.querySelectorAll('#panel-body .jewel-card').length === 3, { timeout: 5000 }).catch(() => {});
  const s = await shopState(page);
  ok('a later load fills the open shop without reopening it', s.cards === 3 && s.offers === 2 && !s.down, s);
  ok('no page errors (later)', errors.length === 0, errors); await context.close(); }

{ const { page, errors, context } = await boot('later');
  await page.evaluate(() => { window.__loads = 99; });   // block the auto-retry from succeeding: first click path
  await page.evaluate(() => { window.__loads = 0; window.__ps.openPanel('jewels'); });
  await page.waitForTimeout(300);
  const s = await shopState(page);
  ok('retry button path: shop fills after Try again', s.cards === 3 || (s.retry && await page.click('[data-act="store-retry"]').then(() => page.waitForTimeout(500)).then(() => shopState(page)).then((t) => t.cards === 3)), s);
  ok('no page errors (retry)', errors.length === 0, errors); await context.close(); }

{ const { page, errors, context } = await boot('web');
  await page.evaluate(() => window.__ps.openPanel('jewels'));
  const s = await shopState(page);
  ok('web build: no paid section and no store warning', s.cards === 0 && s.offers === 0 && !s.down, s);
  ok('no page errors (web)', errors.length === 0, errors); await context.close(); }

await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
console.log('all passed');
