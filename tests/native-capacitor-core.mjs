// The iOS bundle (www/) must work with ONLY the native bridge's window.Capacitor (no registerPlugin):
// @capacitor/core is loaded by js/native-boot.js and routes PetalspireStore calls to the native bridge.
//   node scripts/bundle-www.mjs && node tests/native-capacitor-core.mjs
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const www = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
if (!fs.existsSync(path.join(www, 'vendor/capacitor-core.js'))) { console.error('run node scripts/bundle-www.mjs first'); process.exit(1); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const f = path.join(www, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!f.startsWith(www)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + JSON.stringify(detail) : ''}`); if (!pass) fails.push(name); };
const save = JSON.stringify({ v: 3, coins: 5, wood: 40, jewels: 2, introDone: true, tut: { done: true }, guideDone: true, lots: { home: true }, standBuilt: true, marketBuilt: true, marketAvail: true, beds: ['home-0'], tiles: Array(9).fill(null), marketWelcome: { done: true } });

const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript((raw) => {
  localStorage.setItem('petalspire.v03', raw);
  // Shape of Capacitor iOS native-bridge.js: no registerPlugin, PluginHeaders from the native side, nativePromise.
  window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
  window.__calls = [];
  const P = (name, methods) => ({ name, methods: methods.map((m) => ({ name: m, rtype: 'promise' })) });
  window.Capacitor = {
    PluginHeaders: [P('PetalspireStore', ['loadProducts', 'purchase', 'finish', 'restore', 'addListener', 'removeListener']), P('Preferences', ['get', 'set', 'remove', 'keys']), P('StatusBar', ['hide', 'show', 'setStyle'])],
    Plugins: {},
    getPlatform: () => 'ios',
    isNativePlatform: () => true,
    isPluginAvailable(n) { return this.PluginHeaders.some((h) => h.name === n); },
    nativeCallback() { return 'cb'; },
    async nativePromise(plugin, method, options) {
      window.__calls.push(`${plugin}.${method}`);
      if (plugin === 'PetalspireStore' && method === 'loadProducts') return { products: (options.productIds || []).map((p) => ({ productId: p, displayPrice: '$1.11' })), requested: options.productIds.length, storefront: 'USA', canPay: true };
      if (plugin === 'Preferences' && method === 'get') return { value: null };
      return {};
    },
  };
}, save);
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps?.state, { timeout: 25000 });
await page.waitForTimeout(1200);
const g = await page.evaluate(() => ({ reg: typeof window.Capacitor.registerPlugin, calls: [...new Set(window.__calls)] }));
ok('@capacitor/core added Capacitor.registerPlugin on top of the native bridge', g.reg === 'function', g.reg);
ok('the game asked PetalspireStore for products through the native bridge', g.calls.includes('PetalspireStore.loadProducts'), g.calls);
await page.evaluate(() => window.__ps.openPanel('jewels'));
await page.waitForTimeout(300);
const s = await page.evaluate(() => { const b = document.getElementById('panel-body'); const shown = (sel) => { const e = b.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }; return { visible: { grid: shown('.jewel-grid'), offers: shown('.shop-offers'), noads: shown('.noads-card') }, cards: b.querySelectorAll('.jewel-card').length, prices: [...b.querySelectorAll('.jewel-card em')].map((e) => e.textContent), down: !!b.querySelector('[data-store-down]') }; });
ok('Jewel Shop lists the App Store packs with App Store prices, and they are visible', s.visible.grid && s.visible.offers && s.visible.noads && s.cards === 3 && s.prices.every((p) => p === '$1.11') && !s.down, s);
ok('no page errors', errors.length === 0, errors);
await page.screenshot({ path: '/opt/cursor/artifacts/native-core-jewel-shop-390x844.png' });
await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
console.log('all passed');
