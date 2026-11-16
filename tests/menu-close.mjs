// v0.8.7.7: every menu closes on an iPhone screen, even while Sprig's goal card is showing.
// Taps the X with touch, taps outside the menu, and presses Escape, at iPhone SE and iPhone 14 sizes.
//   node tests/menu-close.mjs

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
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + JSON.stringify(detail) : ''}`); if (!pass) fails.push(name); };
const shots = process.env.SHOTS || '/opt/cursor/artifacts';
try { fs.mkdirSync(shots, { recursive: true }); } catch { /* optional */ }

const SIZES = [{ w: 375, h: 667, sat: 20, sab: 0 }, { w: 390, h: 844, sat: 59, sab: 34 }];
const STATES = {
  guide: { tut: { step: 4, done: false }, mw: { done: true } },             // goal card "Water each seedling"
  sale: { tut: { step: 9, done: false }, mw: { done: true } },
  market: { tut: { step: 99, done: true }, mw: { guide: true, started: true, done: false, step: 1 } },
  free: { tut: { step: 99, done: true }, mw: { done: true } },
};
const PANELS = ['market', 'bag', 'build', 'settings', 'jewels', 'orders'];

for (const vp of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('petalspire.tipTest', '1'));   // Sprig's menu tips show too
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps && window.__ps.state && window.__ps.openPanel, { timeout: 20000 });
  await page.evaluate((vp) => {
    document.body.classList.remove('on-title'); document.body.classList.add('ads-on');
    document.getElementById('title')?.classList.add('hidden'); document.getElementById('studio-splash')?.remove();
    const R = document.documentElement; R.classList.add('native-app');
    R.style.setProperty('--native-sat', vp.sat + 'px'); R.style.setProperty('--native-sab', vp.sab + 'px'); R.style.setProperty('--app-h', vp.h + 'px');
  }, vp);
  for (const [sname, st] of Object.entries(STATES)) {
    for (const p of PANELS) {
      const open = async () => {
        await page.evaluate(([st, p]) => {
          const S = window.__ps.state; window.__ps.closePanel();
          S.introDone = true; S.tut = { ...st.tut }; S.marketBuilt = true; S.standBuilt = true; S.marketWelcome = { ...st.mw }; S.seenTips = {};
          window.__ps.openPanel(p);
        }, [st, p]);
        await page.waitForTimeout(260);
      };
      const isOpen = () => page.evaluate(() => !document.getElementById('panel').classList.contains('hidden'));
      const tag = `${vp.w}x${vp.h} ${sname} ${p}`;
      await open();
      const x = await page.evaluate(() => {
        const b = document.getElementById('panel-close').getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const top = document.elementFromPoint(cx, cy);
        return { cx, cy, w: b.width, inView: b.top >= 0 && b.bottom <= innerHeight, onTop: !!top?.closest('#panel-close'), top: top && (top.id || top.className) };
      });
      ok(`${tag}: X is visible, on top and at least 44px`, x.inView && x.onTop && x.w >= 44, x.onTop ? undefined : x);
      await page.touchscreen.tap(x.cx, x.cy); await page.waitForTimeout(160);
      ok(`${tag}: one tap on the X closes it`, !(await isOpen()));
      if (p === 'market') {
        await open(); await page.waitForTimeout(500);
        await page.keyboard.press('Escape'); await page.waitForTimeout(120);
        ok(`${tag}: Escape closes it`, !(await isOpen()));
        await open(); await page.evaluate(() => { document.querySelector('.sprig-tip')?.click(); }); await page.waitForTimeout(500);   // Sprig's own tip closes on its tap
        const gap = await page.evaluate(() => { const c = document.querySelector('#panel .panel-card').getBoundingClientRect(), hb = document.getElementById('hud').getBoundingClientRect().bottom;
          return { x: Math.round(innerWidth / 2), y: Math.round((hb + c.top) / 2) }; });
        await page.touchscreen.tap(gap.x, gap.y); await page.waitForTimeout(160);   // the open space above the menu card (goal cards let the tap through)
        ok(`${tag}: tapping outside the menu closes it`, !(await isOpen()));
      }
    }
  }
  // screenshot: Market open during the guide, X in plain sight
  await page.evaluate(() => { const S = window.__ps.state; window.__ps.closePanel(); S.tut = { step: 4, done: false }; S.marketWelcome = { done: true }; S.seenTips = { market: 1 }; window.__ps.openPanel('market'); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shots, `menu-close-${vp.w}x${vp.h}.png`) });
  ok(`${vp.w}x${vp.h}: no page errors`, errors.length === 0, errors.slice(0, 3));
  await ctx.close();
}
// A save made part-way through the Market seed lesson: after a restart, Continue and the menus still answer taps.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps && window.__ps.state && window.__ps.writeSave, { timeout: 20000 });
  await page.evaluate(() => { const S = window.__ps.state; S.introDone = true; S.tut = { step: 99, done: true }; S.guideDone = true; S.lots.home = true; S.marketBuilt = true;
    S.marketWelcome = { started: true, guide: true, done: false, step: 1, showcase: 'later' }; window.__ps.writeSave(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
  await page.waitForTimeout(2500);   // studio splash
  const pre = await page.evaluate(() => ({ title: document.body.classList.contains('on-title'), mw: window.__ps.state.marketWelcome }));
  ok('half-done lesson save loads on the title screen', pre.title && pre.mw?.guide && !pre.mw?.done, pre);
  const b = await page.evaluate(() => { const r = document.getElementById('btn-start').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(b.x, b.y); await page.waitForTimeout(1500);
  ok('Continue works with a half-done lesson', !(await page.evaluate(() => document.body.classList.contains('on-title'))));
  await page.evaluate(() => document.querySelectorAll('.cozy-modal').forEach((m) => m.remove()));
  const t = await page.evaluate(() => { const r = document.getElementById('tab-market').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(t.x, t.y); await page.waitForTimeout(400);
  const card = await page.evaluate(() => !!document.querySelector('#mkt-tut:not(.hidden)'));
  ok('the lesson card is back after Continue', card);
  const x = await page.evaluate(() => { const r = document.getElementById('panel-close').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, open: !document.getElementById('panel').classList.contains('hidden') }; });
  if (x.open) { await page.touchscreen.tap(x.x, x.y); await page.waitForTimeout(300); }
  ok('the Market opened during the lesson closes with its X', x.open && !(await page.evaluate(() => !document.getElementById('panel').classList.contains('hidden'))), x);
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n${fails.length} failed` : '\nall passed');
process.exit(fails.length ? 1 : 0);
