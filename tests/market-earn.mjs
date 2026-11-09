// Farm Stand rebuild progress counts orders and bulk sales, and the market sheet clears the nav.
//   node tests/market-earn.mjs

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
  v: 3, coins: 192, wood: 20, jewels: 4, standBuilt: true, introDone: true,
  tut: { done: true }, guideDone: true, lots: { home: true },
  stats: { standEarned: 16, orderEarned: 40, bulkEarned: 10, boostCoins: 5, customers: 2, stocked: 4 },
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

const loaded = await page.evaluate(() => {
  const st = window.__ps.state.stats;
  const html = window.__ps.buildHTML();
  const m = html.match(/(\d+) \/ 100 coins earned/);
  return {
    stand: st.standEarned, orders: st.homeOrderEarned, bulk: st.homeBulkEarned, boost: st.homeSaleBoost,
    shown: m ? +m[1] : null, backfill: !!st.standEarnBackfill, coins: window.__ps.state.coins,
  };
});
ok('old save backfills orders, bulk, and double-sale coins onto the 16', loaded.shown === 71 && loaded.stand === 16 && loaded.orders === 40 && loaded.bulk === 10 && loaded.boost === 5, loaded);

const sold = await page.evaluate(() => {
  const S = window.__ps.state;
  S.inv.flower_lavender = 6;
  S.orders.home.slots[0] = { id: 'o-test', items: [{ id: 'flower_lavender', n: 2 }], at: Date.now(), exp: Date.now() + 1e9 };
  const pay = window.__ps.orderPay('home', S.orders.home.slots[0]);
  const sum = () => (S.stats.standEarned || 0) + (S.stats.homeOrderEarned || 0) + (S.stats.homeBulkEarned || 0) + (S.stats.homeSaleBoost || 0);
  const before = sum();
  window.__ps.fillOrder('home', 0);
  const afterOrder = sum();
  S.inv.seed_lavender = 2;
  window.__ps.stock('seed_lavender', 'all');
  const afterStock = sum();
  const bulk = window.__ps.bulkSell('flower_lavender', 1, 'home');
  const after = sum();
  return { pay, before, afterOrder, afterStock, bulk, after, orders: S.stats.orders };
});
ok('a filled home order counts', sold.afterOrder === sold.before + sold.pay, sold);
ok('stocking the stand does not count as earnings', sold.afterStock === sold.afterOrder, sold);
ok('a home bulk sale counts', sold.bulk > 0 && sold.after === sold.afterStock + sold.bulk, sold);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.state?.stats?.standEarnBackfill, { timeout: 20000 });
const kept = await page.evaluate(() => {
  const st = window.__ps.state.stats;
  return (st.standEarned || 0) + (st.homeOrderEarned || 0) + (st.homeBulkEarned || 0) + (st.homeSaleBoost || 0);
});
ok('the counter is still there after reload', kept === sold.after, { kept, after: sold.after });

await page.evaluate(() => {
  const root = document.documentElement;
  root.classList.add('native-app');
  root.style.setProperty('--native-sat', '59px');
  root.style.setProperty('--native-sab', '34px');
  root.style.setProperty('--app-h', '844px');
  document.body.classList.add('ads-on');
  document.body.classList.remove('on-title');
  document.getElementById('title')?.classList.add('hidden');
  const banner = document.getElementById('ad-banner');
  if (banner) { banner.classList.remove('hidden'); banner.innerHTML = '<span class="hb-copy"><b>Market Plot</b><small>Coming soon</small></span>'; }
  window.__ps.openPanel('market');
});
await page.waitForTimeout(400);
const fit = await page.evaluate(() => {
  const body = document.getElementById('panel-body');
  body.scrollTop = body.scrollHeight;
  const jewel = body.querySelector('.jewel-strip')?.getBoundingClientRect();
  const tab = document.getElementById('tabbar').getBoundingClientRect();
  const banner = document.getElementById('ad-banner')?.getBoundingClientRect();
  return {
    text: body.querySelector('.jewel-strip')?.innerText?.replace(/\s+/g, ' ').slice(0, 40),
    jewelBottom: jewel ? Math.round(jewel.bottom) : null,
    tabTop: Math.round(tab.top),
    bannerTop: banner && banner.height ? Math.round(banner.top) : null,
  };
});
ok('the jewels row scrolls above the nav', fit.jewelBottom != null && fit.jewelBottom <= fit.tabTop - 8, fit);
ok('the jewels row clears the banner slot', fit.bannerTop == null || fit.jewelBottom <= fit.bannerTop - 8, fit);
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
await page.screenshot({ path: '/opt/cursor/artifacts/market-earn-390x844.png' });
ok('market earn check does not throw', errors.length === 0, errors);

await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
