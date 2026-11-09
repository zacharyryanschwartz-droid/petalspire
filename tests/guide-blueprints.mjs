// The Farm Stand ghost stays hidden until Sprig's "Build your Farm Stand" step,
// and other guide-early blueprints and build cards stay hidden with it.
//   node tests/guide-blueprints.mjs

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
await page.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });

async function snap(name) {
  const dir = '/opt/cursor/artifacts';
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* already there */ }
  await page.screenshot({ path: path.join(dir, name) });
}

function readState() {
  const S = window.__ps.state;
  const W = window.__ps.W;
  const ghosts = {};
  W.scene.traverse((o) => {
    if (o.userData && o.userData.kind === 'blueprint' && o.userData.id && !ghosts[o.userData.id]) {
      const label = (o.children || []).find((c) => c.userData && c.userData.text);
      ghosts[o.userData.id] = { on: !!o.visible, label: label ? label.userData.text : '' };
    }
  });
  const html = window.__ps.buildHTML();
  const goal = document.querySelector('.tut-goal')?.textContent || '';
  return {
    step: S.tut.step,
    done: !!S.tut.done,
    goal,
    ghosts,
    glow: document.getElementById('tab-build')?.classList.contains('glow') || false,
    bloom: !document.getElementById('jd-bloom')?.classList.contains('hidden'),
    rush: !document.getElementById('jd-rush')?.classList.contains('hidden'),
    orders: !document.getElementById('jd-orders')?.classList.contains('hidden'),
    spin: !document.getElementById('spin-btn')?.classList.contains('hidden'),
    standCard: html.includes('Farm Stand'),
    rackCard: html.includes('Drying Rack'),
    marketCard: html.includes('Supply Market'),
    tinctureCard: html.includes('Tincture'),
    packHint: html.includes('Open Card Packs'),
    bedCard: html.includes('Raised Bed'),
  };
}

await page.evaluate(() => {
  const S = window.__ps.state;
  S.introDone = true;
  S.beds = ['home-0'];
  S.wood = 40;
  S.rackAvail = true;
  S.standBuilt = false;
  S.rackBuilt = false;
  S.stats.harvests = 0;
  S.oshedBuilt = false;
  S.tut = { step: 5, done: false };
  document.body.classList.remove('on-title');
  document.getElementById('title')?.classList.add('hidden');
  document.getElementById('story')?.classList.add('hidden');
});
await page.waitForFunction(() => (document.querySelector('.tut-goal')?.textContent || '').includes('Let them grow'), { timeout: 8000 });
let grow = await page.evaluate(readState);
ok('goal 6 is Let them grow', grow.goal.includes('Goal 6') && grow.goal.includes('Let them grow'), grow.goal);
ok('farm stand ghost is hidden on goal 6', grow.ghosts.stand && grow.ghosts.stand.on === false, grow.ghosts.stand);
ok('farm stand label is the wood blueprint', (grow.ghosts.stand?.label || '').includes('Blueprint') && (grow.ghosts.stand?.label || '').includes('Wood'), grow.ghosts.stand?.label);
ok('drying rack ghost is hidden during the guide', grow.ghosts.rack && grow.ghosts.rack.on === false, grow.ghosts.rack);
ok('orchard stand ghost stays hidden without an orchard', grow.ghosts.oshed && grow.ghosts.oshed.on === false, grow.ghosts.oshed);
ok('build menu on goal 6 is the raised bed only', grow.bedCard && !grow.standCard && !grow.rackCard && !grow.marketCard && !grow.tinctureCard && !grow.packHint, grow);
ok('build tab does not glow for the stand yet', grow.glow === false, grow.glow);
ok('bloom, rush, orders and spin stay hidden on goal 6', !grow.bloom && !grow.rush && !grow.orders && !grow.spin, grow);

await page.evaluate(() => { window.__ps.state.tut.step = 7; });
await page.waitForFunction(() => (document.querySelector('.tut-goal')?.textContent || '').includes('Build your Farm Stand'), { timeout: 8000 });
await page.waitForTimeout(300);
let stand = await page.evaluate(readState);
ok('farm stand step shows the blueprint', stand.ghosts.stand?.on === true, stand.ghosts.stand);
ok('farm stand card appears on that step', stand.standCard === true && stand.rackCard === false && stand.marketCard === false, { stand: stand.standCard, rack: stand.rackCard, market: stand.marketCard });
ok('build tab glows once the stand can be built', stand.glow === true, stand.glow);
ok('drying rack stays hidden on the farm stand step', stand.ghosts.rack?.on === false, stand.ghosts.rack);

const pos = await page.evaluate(() => {
  let p = null;
  window.__ps.W.scene.traverse((o) => { if (!p && o.userData?.kind === 'blueprint' && o.userData.id === 'stand') p = o.position; });
  if (p) window.__ps.camAt(p.x, p.z, 0.85);
  return p ? { x: p.x, z: p.z } : null;
});
await page.waitForTimeout(400);
await snap('guide-stand-step-390x844.png');

await page.evaluate(() => { window.__ps.state.tut.step = 5; });
await page.waitForFunction(() => (document.querySelector('.tut-goal')?.textContent || '').includes('Let them grow'), { timeout: 8000 });
await page.waitForTimeout(300);
await snap('guide-goal6-390x844.png');
grow = await page.evaluate(readState);
ok('going back to goal 6 hides the farm stand ghost again', grow.ghosts.stand?.on === false, grow.ghosts.stand);

await page.evaluate(() => { window.__ps.tutFinish(true); });
await page.waitForTimeout(400);
const skipped = await page.evaluate(readState);
ok('skipping the guide keeps the unbuilt farm stand ghost', skipped.done === true && skipped.ghosts.stand?.on === true, skipped.ghosts.stand);
ok('skipping the guide reveals the drying rack ghost', skipped.ghosts.rack?.on === true, skipped.ghosts.rack);
ok('orchard stand ghost stays off when the orchard was never bought', skipped.ghosts.oshed?.on === false, skipped.ghosts.oshed);
ok('build menu after the guide lists the stand and the rack', skipped.standCard && skipped.rackCard, { stand: skipped.standCard, rack: skipped.rackCard });
ok('guide blueprint check does not throw', errors.length === 0, errors);

console.log('camera', pos);
await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
