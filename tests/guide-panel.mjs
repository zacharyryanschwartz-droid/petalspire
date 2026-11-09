// Goal 10 can close the Farm Stand, the sale still completes, and the last row clears the nav.
//   node tests/guide-panel.mjs

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
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.state && window.__ps.openPanel, { timeout: 20000 });

await page.evaluate(() => {
  const S = window.__ps.state;
  S.introDone = true;
  S.standBuilt = true;
  S.stats.customers = 0;
  S.stats.stocked = 1;
  S.stand = { flower_lavender: 4 };
  S.inv.seed_lavender = 2;
  S.tut = { step: 9, done: false };
  document.body.classList.remove('on-title');
  document.body.classList.add('ads-on');
  document.documentElement.classList.add('native-app');
  document.documentElement.style.setProperty('--native-sat', '59px');
  document.documentElement.style.setProperty('--native-sab', '34px');
  document.documentElement.style.setProperty('--app-h', '844px');
  document.getElementById('title')?.classList.add('hidden');
  document.getElementById('story')?.classList.add('hidden');
  const banner = document.getElementById('ad-banner');
  if (banner) {
    banner.classList.remove('hidden');
    banner.innerHTML = '<span class="hb-copy"><b>Market Plot</b><small>Coming soon</small></span>';
  }
  window.__ps.openPanel('stand');
});
await page.waitForFunction(() => (document.querySelector('.tut-goal')?.textContent || '').includes('Make your first sale'), { timeout: 8000 });
await page.waitForTimeout(400);

const before = await page.evaluate(() => ({
  open: !document.getElementById('panel').classList.contains('hidden'),
  goal: document.querySelector('.tut-goal')?.textContent || '',
}));
ok('sale step opens the farm stand', before.open && before.goal.includes('Goal 10'), before);

await page.click('#panel-close');
await page.waitForTimeout(350);
const closed = await page.evaluate(() => ({
  open: !document.getElementById('panel').classList.contains('hidden'),
  goal: document.querySelector('.tut-goal')?.textContent || '',
  step: window.__ps.state.tut.step,
}));
ok('the X closes the stand during the sale step', closed.open === false, closed);
ok('the goal stays on the first sale', closed.goal.includes('Make your first sale') && closed.step === 9, closed);

await page.evaluate(() => {
  window.__ps.nextCustomerIn(0);
  const car = window.__ps.W.cars.find((c) => c.onPark);
  if (car) car.onPark();
});
await page.waitForFunction(() => window.__ps.state.stats.customers > 0, { timeout: 8000 });
await page.waitForFunction(() => !(document.querySelector('.tut-goal')?.textContent || '').includes('Make your first sale'), { timeout: 8000 });
const sold = await page.evaluate(() => ({
  customers: window.__ps.state.stats.customers,
  goal: document.querySelector('.tut-goal')?.textContent || '',
  open: !document.getElementById('panel').classList.contains('hidden'),
}));
ok('a customer buys with the panel closed and the goal advances', sold.customers > 0 && !sold.goal.includes('Make your first sale') && sold.open === false, sold);

// Other steps that used to pin a menu: closing returns a pointer to reopen.
await page.evaluate(() => {
  const S = window.__ps.state;
  S.tut = { step: 8, done: false, orders: false };
  S.stats.customers = 1;
  S.stats.stocked = 0;
  window.__ps.openPanel('stand');
});
await page.waitForTimeout(400);
await page.click('#panel-close');
await page.waitForTimeout(400);
const stock = await page.evaluate(() => ({
  open: !document.getElementById('panel').classList.contains('hidden'),
  text: document.querySelector('.tut-do')?.textContent || '',
}));
ok('stock step can close the stand and points back at it', stock.open === false && /farm stand/i.test(stock.text), stock);

await page.evaluate(() => {
  window.__ps.state.tut = { step: 5, done: false };
  window.__ps.openPanel('bag');
});
await page.waitForTimeout(400);
await page.click('#panel-close');
await page.waitForTimeout(300);
const grow = await page.evaluate(() => ({
  open: !document.getElementById('panel').classList.contains('hidden'),
  goal: document.querySelector('.tut-goal')?.textContent || '',
}));
ok('let them grow can close a menu too', grow.open === false && grow.goal.includes('Let them grow'), grow);

await page.evaluate(() => {
  const S = window.__ps.state;
  S.tut = { step: 9, done: false };
  S.stats.customers = 0;
  S.inv.seed_lavender = 2;
  document.body.classList.add('ads-on');
  window.__ps.openPanel('stand');
  const body = document.getElementById('panel-body');
  for (let i = 0; i < 14; i++) {
    const row = document.createElement('div');
    row.className = 'row extra-seed';
    row.innerHTML = '<div class="meta"><b>Lavender Seeds</b><small>You have 2 · sells for 3</small></div>';
    body.appendChild(row);
  }
  body.scrollTop = body.scrollHeight;
});
await page.waitForTimeout(400);
const fit = await page.evaluate(() => {
  const body = document.getElementById('panel-body');
  body.scrollTop = body.scrollHeight;
  const row = [...body.querySelectorAll('.extra-seed')].at(-1).getBoundingClientRect();
  const tab = document.getElementById('tabbar').getBoundingClientRect();
  const banner = document.getElementById('ad-banner')?.getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(document.getElementById('panel')).paddingBottom);
  return {
    rowBottom: Math.round(row.bottom),
    tabTop: Math.round(tab.top),
    bannerTop: banner && banner.height ? Math.round(banner.top) : null,
    bannerH: banner ? Math.round(banner.height) : 0,
    pad: Math.round(pad),
    scrollable: body.scrollHeight > body.clientHeight + 4,
  };
});
ok('the seeds row scrolls above the nav', fit.scrollable && fit.rowBottom <= fit.tabTop - 8, fit);
ok('the seeds row also clears the banner slot', fit.bannerTop == null || fit.rowBottom <= fit.bannerTop - 8, fit);
ok('native ads lift the panel by the banner height', fit.pad >= 34 + 64 + 70, fit.pad);

fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
await page.screenshot({ path: '/opt/cursor/artifacts/guide-sale-panel-390x844.png' });

ok('panel close check does not throw', errors.length === 0, errors);
await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
