// Book redeem codes: SNOWFINCH, QUILTBEE, and the later KDP sets grant keepsakes only (no jewels, App Store 3.1.1) once, show in the Bag, and stay in the save.
//   node tests/book-codes.mjs

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
  v: 3, coins: 40, wood: 40, jewels: 2, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, standBuilt: true, marketBuilt: true, marketAvail: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  barrels: { home: { x: -1.15, z: 4.25, w: 9, at: Date.now(), lv: 1 } },
});
const SNOW = ['d8_snowfinch', 'd8_holly', 'd8_ornament'];
const QUILT = ['d8_quiltstar', 'd8_logcabin', 'd8_compass'];
const NAMES = {
  d8_snowfinch: 'Snowfinch Pair', d8_holly: 'Holly Cluster', d8_ornament: 'Winter Ornament',
  d8_quiltstar: 'Star Quilt', d8_logcabin: 'Log Cabin Quilt', d8_compass: 'Quilt Compass',
};
const BOOKS = [
  { code: 'LAMPLIT', typed: 'lamp lit', book: 'Escape the Lighthouse', ids: ['d8_stormlantern', 'd8_spyglass', 'd8_tidekey'], names: ['Storm Lantern', "Keeper's Spyglass", 'Tide-Worn Key'] },
  { code: 'COZYCABIN', typed: 'cozy cabin', book: 'Woodsmoke & Wool', ids: ['d8_woolthrow', 'd8_woodstove', 'd8_honeymug'], names: ['Woolen Throw', 'Woodsmoke Stove', 'Honey Mug'] },
  { code: 'GLASSHOUSE', typed: 'glass house', book: 'The Locked Glasshouse', ids: ['d8_terrarium', 'd8_potting', 'd8_mister'], names: ['Fern Terrarium', 'Potting Bench', 'Copper Mister'] },
  { code: 'LEADLIGHT', typed: 'lead light', book: 'Leadlight', ids: ['d8_rosewindow', 'd8_leadpanel', 'd8_medallion'], names: ['Rose Window', 'Leadlight Panel', 'Honey Medallion'] },
  { code: 'CLOSEDSTACKS', typed: 'closed stacks', book: 'Closed Stacks', ids: ['d8_tomes', 'd8_brasslamp', 'd8_catalog'], names: ['Stacked Tomes', 'Brass Lamp', 'Card Catalog'] },
  { code: 'PICTUREPALACE', typed: 'picture palace', book: 'The Picture Palace', ids: ['d8_velvetseat', 'd8_marquee', 'd8_filmreel'], names: ['Velvet Seat', 'Marquee Lamp', 'Film Reel'] },
  { code: 'LASTVINTAGE', typed: 'last vintage', book: 'The Last Vintage', ids: ['d8_cellarcask', 'd8_vinbottle', 'd8_grapevine'], names: ['Cellar Cask', 'Vintage Bottle', 'Grapevine Cluster'] },
  { code: 'MIDWAY', typed: 'mid way', book: 'The Locked Midway', ids: ['d8_fairticket', 'd8_carousel', 'd8_prizeballoon'], names: ['Midway Ticket', 'Carousel Horse', 'Prize Balloon'] },
  { code: 'AFTERDARK', typed: 'after dark', book: 'The Museum After Dark', ids: ['d8_bust', 'd8_exhibit', 'd8_nightlamp'], names: ['Marble Bust', 'Exhibit Case', 'Night Lantern'] },
];
const NEW_IDS = BOOKS.flatMap((b) => b.ids);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!pass) fails.push(name); };
const ART = (() => { for (const d of ['/opt/cursor/artifacts', '/tmp/petalspire-artifacts']) { try { fs.mkdirSync(d, { recursive: true }); return d; } catch {} } return '.'; })();

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript((raw) => {
  if (!localStorage.getItem('petalspire.v03')) localStorage.setItem('petalspire.v03', raw);
}, save);
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
await page.evaluate(() => {
  document.body.classList.remove('on-title');
  document.getElementById('title')?.classList.add('hidden');
});

async function redeem(typed) {
  const panelOpen = await page.evaluate(() => !document.getElementById('panel')?.classList.contains('hidden'));
  const redeemVisible = await page.locator('#redeem-in').isVisible();
  if (panelOpen && !redeemVisible) {
    const close = page.locator('#panel-close');
    if (await close.count()) await close.click({ force: true });
    else await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('panel')?.classList.contains('hidden'), { timeout: 5000 });
  }
  if (!(await page.locator('#redeem-in').isVisible())) {
    await page.click('#btn-settings');
    await page.locator('#redeem-in').waitFor({ state: 'visible' });
  }
  await page.locator('#redeem-in').fill(typed);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((el) => el.remove()));
  await page.click('[data-act="redeem"]');
  const toast = page.locator('.toast').last();
  await toast.waitFor({ state: 'visible', timeout: 15000 });
  return (await toast.innerText()).replace(/\s+/g, ' ');
}

async function openFinds() {
  const bagOpen = await page.evaluate(() => window.__ps.panel === 'bag' && !document.getElementById('panel')?.classList.contains('hidden'));
  if (!bagOpen) {
    if (await page.locator('#panel:not(.hidden)').count()) {
      try { await page.click('#panel-close', { timeout: 1000 }); } catch {}
    }
    await page.click('#tab-bag');
  }
  await page.locator('[data-bag="finds"]').click();
}

async function bagRow(id) {
  return page.evaluate((id) => {
    const row = document.querySelector(`[data-d8-bag="${id}"]`);
    return row ? row.innerText.replace(/\s+/g, ' ') : null;
  }, id);
}

async function goLoc(loc) {
  await page.evaluate((loc) => {
    window.__ps.state.lots.orchard = true;
    window.__ps.setLoc(loc, true);
  }, loc);
}

async function placeDecor(type, cx, cz, span = 6) {
  const sel = `[data-d8-bag="${type}"] [data-place]`;
  if (await page.locator(sel).count()) await page.click(sel);
  else await page.evaluate((t) => window.__ps.enterPlace('decor', t), type);
  return page.evaluate(async ({ cx, cz, span, type }) => {
    const ps = window.__ps;
    ps.camAt(cx, cz, 0.7);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    let hit = null;
    const tryAt = (x, z) => {
      const before = ps.state.decor.length;
      const p = ps.W.project(new ps.THREE.Vector3(x, 0, z));
      if (p.behind) return;
      ps.handleTap(p.x, p.y);
      if (ps.state.decor.length > before) hit = ps.state.decor.at(-1);
    };
    tryAt(cx, cz);
    for (let x = cx - span / 2; x <= cx + span / 2 && !hit; x += 0.6)
      for (let z = cz - span / 2; z <= cz + span / 2 && !hit; z += 0.6) tryAt(x, z);
    if (hit) ps.camAt(hit.x, hit.z, 0.55);
    document.querySelectorAll('.toast').forEach((el) => el.remove());
    return { hit, stillPlacing: !!ps.placing, inv: ps.state.decorInv[type] || 0 };
  }, { cx, cz, span, type });
}

const before = await page.evaluate(() => ({ coins: window.__ps.state.coins, wood: window.__ps.state.wood, atm: window.__ps.atmosphereAt('home') }));
const snowToast = await redeem('snow finch');
ok('SNOWFINCH names the book and the three keepsakes', /Holly & Wing/.test(snowToast) && /Snowfinch Pair/.test(snowToast) && /Holly Cluster/.test(snowToast) && /Winter Ornament/.test(snowToast) && /just for looks/.test(snowToast), snowToast);
ok('SNOWFINCH toast does not mention jewels', !/jewel/i.test(snowToast), snowToast);
ok('SNOWFINCH toast does not mention two copies or both locations', !/Home and/i.test(snowToast) && !/the Orchard/i.test(snowToast) && !/×2|two of each/i.test(snowToast), snowToast);
const snowJewels = await page.evaluate(() => window.__ps.state.jewels);
ok('SNOWFINCH grants no jewels', snowJewels === 2, snowJewels);

const snowBag = await page.evaluate((ids) => {
  const s = window.__ps.state;
  return {
    inv: Object.fromEntries(ids.map((id) => [id, s.decorInv[id] || 0])),
    claimed: !!s.codes.SNOWFINCH,
    atm: ids.every((id) => window.__ps.DECO8[id].atm === 0 && window.__ps.DECO8[id].cosmetic && window.__ps.DECO8[id].special),
    shop: window.__ps.decoMarketRows('home').join(''),
  };
}, SNOW);
ok('SNOWFINCH grants one of each keepsake', SNOW.every((id) => snowBag.inv[id] === 1), snowBag.inv);
ok('SNOWFINCH is remembered on the save', snowBag.claimed);
ok('snow keepsakes add no atmosphere and stay out of the Market', snowBag.atm && !/Snowfinch|Holly Cluster|Winter Ornament/.test(snowBag.shop));

const again = await redeem('SNOWFINCH');
ok('a second SNOWFINCH says already claimed', /already claimed/i.test(again), again);
const snowStill = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, window.__ps.state.decorInv[id] || 0])), SNOW);
ok('a second SNOWFINCH adds nothing', SNOW.every((id) => snowStill[id] === 1), snowStill);
ok('a second SNOWFINCH adds no jewels', (await page.evaluate(() => window.__ps.state.jewels)) === 2);

await page.click('#tab-bag');
await page.click('[data-bag="finds"]');
const bag = await page.evaluate((ids) => {
  const rows = ids.map((id) => {
    const row = document.querySelector(`[data-d8-bag="${id}"]`);
    return row ? { text: row.innerText.replace(/\s+/g, ' '), html: row.querySelector('.ico')?.innerHTML || '' } : null;
  });
  return { rows, imgs: document.querySelectorAll('#panel-body img').length };
}, SNOW);
ok('Bag Finds lists the snow keepsakes as looks-only', bag.rows.every((r) => r && /Keepsake decoration · just for looks/.test(r.text) && !/×2/.test(r.text) && !/one per location/.test(r.text)), bag.rows?.map((r) => r?.text));
ok('menu icons are drawn markup, not images', bag.rows.every((r) => /<svg/i.test(r.html) && !/<img/i.test(r.html)) && bag.imgs === 0);
await page.locator('[data-d8-bag="d8_ornament"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${ART}/book-codes-bag.png` });

await page.click('[data-d8-bag="d8_snowfinch"] [data-place]');
const placed = await page.evaluate(async () => {
  const ps = window.__ps;
  ps.camAt(-1.5, 1.2, 0.7);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let hit = null;
  const tryAt = (x, z) => {
    const before = ps.state.decor.length;
    const p = ps.W.project(new ps.THREE.Vector3(x, 0, z));
    if (p.behind) return;
    ps.handleTap(p.x, p.y);
    if (ps.state.decor.length > before) hit = ps.state.decor.at(-1);
  };
  tryAt(-4, 1.4);
  for (let x = -3.2; x <= 2.4 && !hit; x += 0.6) for (let z = -1.6; z <= 3 && !hit; z += 0.6) tryAt(x, z);
  if (hit) ps.camAt(hit.x, hit.z, 0.55);
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  return { hit, stillPlacing: !!ps.placing, atm: ps.atmosphereAt('home'), pop: document.querySelector('.pop')?.innerText || '' };
});
ok('Snowfinch Pair can be placed in the garden', placed.hit?.type === 'd8_snowfinch' && !placed.stillPlacing, placed.hit);
ok('placing a keepsake does not raise atmosphere', placed.atm === before.atm && /Just for looks/.test(placed.pop), { atm: placed.atm, pop: placed.pop });
const snowInv = await page.evaluate(() => window.__ps.state.decorInv.d8_snowfinch || 0);
ok('placing a Snowfinch Pair takes it out of the bag', snowInv === 0, snowInv);
await openFinds();
ok('a placed Snowfinch Pair leaves the Home bag', (await bagRow('d8_snowfinch')) == null);
await goLoc('orchard');
await openFinds();
ok('a placed Snowfinch Pair also leaves the Orchard bag', (await bagRow('d8_snowfinch')) == null);
await goLoc('home');
await page.screenshot({ path: `${ART}/book-codes-garden.png` });

const models = await page.evaluate((ids) => {
  const out = {};
  for (const id of ids) {
    window.__ps.W.addDecor('probe-' + id, id, 30, 30);
    const g = window.__ps.W.decors.get('probe-' + id);
    out[id] = g ? g.children.length : 0;
    window.__ps.W.removeDecor('probe-' + id);
  }
  return out;
}, [...SNOW, ...QUILT, ...NEW_IDS]);
ok('each keepsake has its own garden model', Object.values(models).every((n) => n >= 3), models);

const quiltToast = await redeem('quiltbee');
ok('QUILTBEE names Pieced & Puzzled and the quilt blocks', /Pieced & Puzzled/.test(quiltToast) && /Star Quilt/.test(quiltToast) && /Log Cabin Quilt/.test(quiltToast) && /Quilt Compass/.test(quiltToast) && !/jewel/i.test(quiltToast), quiltToast);
const quiltJewels = await page.evaluate(() => window.__ps.state.jewels);
ok('QUILTBEE grants no jewels', quiltJewels === 2, quiltJewels);
const quiltAgain = await redeem('QUILT BEE');
ok('a second QUILTBEE says already claimed', /already claimed/i.test(quiltAgain), quiltAgain);
ok('a second QUILTBEE adds no jewels', (await page.evaluate(() => window.__ps.state.jewels)) === 2);
await page.click('#tab-bag');
await page.click('[data-bag="finds"]');
await page.locator('[data-d8-bag="d8_compass"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${ART}/book-codes-quilt.png` });

let jewelsPrev = await page.evaluate(() => window.__ps.state.jewels);
for (const book of BOOKS) {
  const toast = await redeem(book.typed);
  ok(`${book.code} names the book and the three keepsakes`, new RegExp(esc(book.book)).test(toast) && book.names.every((n) => new RegExp(esc(n)).test(toast)) && /just for looks/.test(toast), toast);
  ok(`${book.code} toast does not mention jewels`, !/jewel/i.test(toast), toast);
  ok(`${book.code} toast does not mention two copies or both locations`, !/Home and/i.test(toast) && !/the Orchard/i.test(toast), toast);
  const jewels0 = await page.evaluate(() => window.__ps.state.jewels);
  ok(`${book.code} grants no jewels`, jewels0 === jewelsPrev, { jewels0, jewelsPrev });
  const info = await page.evaluate(({ ids, code, names }) => {
    const s = window.__ps.state;
    return {
      inv: Object.fromEntries(ids.map((id) => [id, s.decorInv[id] || 0])),
      claimed: !!s.codes[code],
      atm: ids.every((id) => window.__ps.DECO8[id].atm === 0 && window.__ps.DECO8[id].cosmetic && window.__ps.DECO8[id].special),
      shop: window.__ps.decoMarketRows('home').join(''),
      names,
    };
  }, book);
  ok(`${book.code} grants one of each keepsake`, book.ids.every((id) => info.inv[id] === 1), info.inv);
  ok(`${book.code} is remembered on the save`, info.claimed);
  ok(`${book.code} keepsakes add no atmosphere and stay out of the Market`, info.atm && !book.names.some((n) => info.shop.includes(n)));
  const again = await redeem(book.code);
  ok(`a second ${book.code} says already claimed`, /already claimed/i.test(again), again);
  const still = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, window.__ps.state.decorInv[id] || 0])), book.ids);
  ok(`a second ${book.code} adds nothing`, book.ids.every((id) => still[id] === 1), still);
  ok(`a second ${book.code} adds no jewels`, (await page.evaluate(() => window.__ps.state.jewels)) === jewels0);
  jewelsPrev = jewels0;
}

await page.click('#tab-bag');
await page.click('[data-bag="finds"]');
const newBag = await page.evaluate((ids) => {
  const rows = ids.map((id) => {
    const row = document.querySelector(`[data-d8-bag="${id}"]`);
    return row ? { id, text: row.innerText.replace(/\s+/g, ' '), html: row.querySelector('.ico')?.innerHTML || '' } : null;
  });
  return { rows, imgs: document.querySelectorAll('#panel-body img').length };
}, NEW_IDS);
ok('Bag Finds lists the new keepsakes as looks-only', newBag.rows.every((r) => r && /Keepsake decoration · just for looks/.test(r.text) && !/×2/.test(r.text) && !/one per location/.test(r.text)), newBag.rows?.map((r) => r?.id + ':' + r?.text));
ok('new keepsake menu icons are drawn markup, not images', newBag.rows.every((r) => /<svg/i.test(r.html) && !/<img/i.test(r.html)) && newBag.imgs === 0);
await page.locator('[data-d8-bag="d8_nightlamp"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${ART}/book-codes-new-sets.png` });

const loveJewels0 = await page.evaluate(() => window.__ps.state.jewels);
const love = await page.evaluate(() => ({ ok: window.__ps.redeemCode('LOVEBUG'), n: window.__ps.state.decorInv.d8_lovebug || 0, jewels: window.__ps.state.jewels }));
ok('LOVEBUG still grants its own keepsake', love.ok === true && love.n === 1, love);
ok('LOVEBUG grants no jewels', love.jewels === loveJewels0, love);

await goLoc('home');
await openFinds();
const loveBag0 = await bagRow('d8_lovebug');
ok('Love Bug shows once in the bag before placing', !!(loveBag0 && /Love Bug/.test(loveBag0) && !/×2/.test(loveBag0)), loveBag0);
const loveHome = await placeDecor('d8_lovebug', -1.5, 1.2);
ok('placing a Love Bug takes it out of the bag', loveHome.hit?.type === 'd8_lovebug' && !loveHome.stillPlacing && loveHome.inv === 0, loveHome);
await openFinds();
ok('a placed Love Bug leaves the Home bag', (await bagRow('d8_lovebug')) == null);
await goLoc('orchard');
await openFinds();
ok('a placed Love Bug also leaves the Orchard bag', (await bagRow('d8_lovebug')) == null);
await goLoc('home');

const moved = await page.evaluate(() => {
  const d = window.__ps.state.decor.find((x) => x.type === 'd8_lovebug' && x.x < 100);
  if (!d) return { ok: false };
  const inv0 = window.__ps.state.decorInv.d8_lovebug || 0;
  window.__ps.startMove('decor', d.key);
  const x = d.x + 0.9, z = d.z + 0.4;
  const ok = window.__ps.commitMove({ kind: 'decor', id: d.key }, x, z);
  const again = window.__ps.state.decor.find((x) => x.key === d.key);
  return { ok, inv0, inv: window.__ps.state.decorInv.d8_lovebug || 0, stillPlaced: !!again };
});
ok('moving a placed Love Bug does not change the bag', moved.ok && moved.inv === moved.inv0 && moved.inv === 0 && moved.stillPlaced, moved);

const demo = await page.evaluate(() => {
  const d = window.__ps.state.decor.find((x) => x.type === 'd8_lovebug' && x.x < 100);
  window.__ps.doDemolish('decor', d.key);
  return { inv: window.__ps.state.decorInv.d8_lovebug || 0, placed: window.__ps.state.decor.filter((x) => x.type === 'd8_lovebug').length };
});
ok('demolishing a Love Bug returns it to the bag', demo.inv === 1 && demo.placed === 0, demo);
await goLoc('home');
await openFinds();
ok('the returned Love Bug shows again in the Home bag', /Love Bug/.test((await bagRow('d8_lovebug')) || ''));
await goLoc('orchard');
await openFinds();
ok('the returned Love Bug also shows in the Orchard bag', /Love Bug/.test((await bagRow('d8_lovebug')) || ''));
await goLoc('home');

// Midway Ticket is placed at the Orchard to prove a single copy can stand at either location.
await goLoc('orchard');
await openFinds();
ok('Midway Ticket is in the Orchard bag before placing', !!(await bagRow('d8_fairticket')));
const ticketHit = await placeDecor('d8_fairticket', 300, -2, 10);
ok('placing a Midway Ticket at the Orchard takes it out of the bag', ticketHit.hit?.type === 'd8_fairticket' && ticketHit.inv === 0, ticketHit);
await openFinds();
ok('a placed Midway Ticket leaves the Orchard bag', (await bagRow('d8_fairticket')) == null);
await goLoc('home');
await openFinds();
ok('a placed Midway Ticket also leaves the Home bag', (await bagRow('d8_fairticket')) == null);

await openFinds();
ok('Marble Bust is in the Home bag before placing', !!(await bagRow('d8_bust')));
const bustHit = await placeDecor('d8_bust', 1.2, 1.6);
ok('placing a Marble Bust takes it out of the bag', bustHit.hit?.type === 'd8_bust' && bustHit.inv === 0, bustHit);
await openFinds();
ok('a placed Marble Bust leaves the Home bag', (await bagRow('d8_bust')) == null);
await goLoc('orchard');
await openFinds();
ok('a placed Marble Bust also leaves the Orchard bag', (await bagRow('d8_bust')) == null);
await goLoc('home');

const jewelsBefore = await page.evaluate(() => window.__ps.state.jewels);
const bloom = await redeem('early bloom');
ok('EARLYBLOOM (web prototype only) thanks the tester for 25 jewels', /Thanks for testing Petalspire!/.test(bloom) && /\+25 jewels/.test(bloom), bloom);
await page.screenshot({ path: `${ART}/earlybloom-thanks.png` });
const bloomed = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('petalspire.v03'));
  return { jewels: window.__ps.state.jewels, hud: document.getElementById('jewel-count')?.textContent, saved: raw.jewels, strip: document.querySelector('#panel .jewel-strip b')?.textContent || '' };
});
ok('EARLYBLOOM adds 25 jewels on the HUD and in the save', bloomed.jewels === jewelsBefore + 25 && bloomed.saved === bloomed.jewels && bloomed.hud === String(bloomed.jewels), bloomed);
const bloomAgain = await redeem('EARLYBLOOM');
ok('a second EARLYBLOOM says already claimed', /already claimed/i.test(bloomAgain), bloomAgain);
const bloomStill = await page.evaluate(() => window.__ps.state.jewels);
ok('a second EARLYBLOOM adds nothing', bloomStill === jewelsBefore + 25, bloomStill);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.state?.codes?.SNOWFINCH, { timeout: 20000 });
const kept = await page.evaluate((ids) => {
  const s = window.__ps.state;
  const raw = JSON.parse(localStorage.getItem('petalspire.v03'));
  return {
    inv: Object.fromEntries(ids.map((id) => [id, s.decorInv[id] || 0])),
    saved: Object.fromEntries(ids.map((id) => [id, raw.decorInv?.[id] || 0])),
    placed: s.decor.filter((d) => d.type === 'd8_snowfinch').length,
    placedSaved: (raw.decor || []).filter((d) => d.type === 'd8_snowfinch').length,
    codes: raw.codes,
    coins: s.coins,
    wood: s.wood,
    jewels: s.jewels,
    jewelsSaved: raw.jewels,
    atm: window.__ps.atmosphereAt('home'),
  };
}, [...SNOW, ...QUILT, ...NEW_IDS, 'd8_lovebug']);
const outOfBag = new Set(['d8_snowfinch', 'd8_fairticket', 'd8_bust']);
ok('keepsakes persist in the save after reload', SNOW.concat(QUILT, NEW_IDS, ['d8_lovebug']).every((id) => kept.inv[id] === (outOfBag.has(id) ? 0 : 1) && kept.saved[id] === kept.inv[id]), kept.inv);
ok('a placed Snowfinch Pair is still in the garden', kept.placed === 1 && kept.placedSaved === 1);
ok('the returned Love Bug stays in the bag after reload', kept.inv.d8_lovebug === 1 && kept.saved.d8_lovebug === 1, { inv: kept.inv.d8_lovebug, saved: kept.saved.d8_lovebug });
ok('redeeming changes neither coins nor wood nor atmosphere', kept.coins === before.coins && kept.wood === before.wood && kept.atm === before.atm, kept);
ok('all book codes stay claimed', !!(kept.codes?.SNOWFINCH && kept.codes?.QUILTBEE && kept.codes?.LOVEBUG && kept.codes?.EARLYBLOOM && BOOKS.every((b) => kept.codes?.[b.code])), kept.codes);
ok('the 25 tester jewels persist after reload', kept.jewels === jewelsBefore + 25 && kept.jewelsSaved === jewelsBefore + 25, { jewels: kept.jewels, saved: kept.jewelsSaved, before: jewelsBefore });
ok('book codes added no jewels (only the web tester code did)', kept.jewels === 2 + 25, kept.jewels);
ok('the page stays free of script errors', errors.length === 0, errors);

const broken = {
  v: 3, coins: 40, wood: 40, jewels: 2, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true, orchard: true }, standBuilt: true, marketBuilt: true, marketAvail: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  barrels: { home: { x: -1.15, z: 4.25, w: 9, at: Date.now(), lv: 1 } },
  codes: { LOVEBUG: 1, MIDWAY: 1, AFTERDARK: 1 },
  decorInv: {
    d8_lovebug: 2, d8_fairticket: 2, d8_carousel: 1, d8_prizeballoon: 2, d8_bust: 1, d8_arbor: 1,
  },
  decor: [
    { key: 'd1', type: 'd8_lovebug', x: -2, z: 1.2, r: 0 },
    { key: 'd2', type: 'd8_fairticket', x: -3, z: 1.2, r: 0 },
    { key: 'd3', type: 'd8_fairticket', x: 300, z: -2, r: 0 },
    { key: 'd4', type: 'd8_carousel', x: -2.8, z: 0.4, r: 0 },
    { key: 'd5', type: 'd8_arbor', x: -1, z: 0.2, r: 0 },
  ],
};
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page2 = await ctx2.newPage();
const errors2 = [];
page2.on('pageerror', (e) => errors2.push(String(e)));
await page2.addInitScript((raw) => { localStorage.setItem('petalspire.v03', raw); }, JSON.stringify(broken));
await page2.goto(base, { waitUntil: 'domcontentloaded' });
await page2.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
const fixed = await page2.evaluate(() => {
  const s = window.__ps.state;
  const raw = JSON.parse(localStorage.getItem('petalspire.v03'));
  const count = (id) => ({
    inv: s.decorInv[id] || 0,
    saved: raw.decorInv?.[id] || 0,
    placed: s.decor.filter((d) => d.type === id).length,
  });
  return {
    love: count('d8_lovebug'),
    ticket: count('d8_fairticket'),
    horse: count('d8_carousel'),
    balloon: count('d8_prizeballoon'),
    bust: count('d8_bust'),
    exhibit: count('d8_exhibit'),
    arbor: count('d8_arbor'),
    jewels: s.jewels,
    jewelsSaved: raw.jewels,
    codeJewels: raw.codeJewels,
  };
});
ok('a placed Love Bug drops leftover bag copies', fixed.love.inv === 0 && fixed.love.saved === 0 && fixed.love.placed === 1, fixed.love);
ok('two already-placed Midway Tickets drop leftover bag copies', fixed.ticket.inv === 0 && fixed.ticket.saved === 0 && fixed.ticket.placed === 2, fixed.ticket);
ok('a placed Carousel Horse drops its leftover bag copy', fixed.horse.inv === 0 && fixed.horse.saved === 0 && fixed.horse.placed === 1, fixed.horse);
ok('unplaced Prize Balloons keep exactly one in the bag', fixed.balloon.inv === 1 && fixed.balloon.saved === 1 && fixed.balloon.placed === 0, fixed.balloon);
ok('a single unplaced Marble Bust is left alone', fixed.bust.inv === 1 && fixed.bust.saved === 1 && fixed.bust.placed === 0, fixed.bust);
ok('a redeemed Exhibit Case with no copies gets one in the bag', fixed.exhibit.inv === 1 && fixed.exhibit.saved === 1 && fixed.exhibit.placed === 0, fixed.exhibit);
ok('a placed Friendship Arbor does not keep a leftover bag copy', fixed.arbor.inv === 0 && fixed.arbor.saved === 0 && fixed.arbor.placed === 1, fixed.arbor);
ok('already-claimed book codes get no jewel backfill on load', fixed.jewels === 2 && fixed.jewelsSaved === 2, fixed);
ok('no jewel backfill is marked on the save', !fixed.codeJewels || Object.keys(fixed.codeJewels).length === 0, fixed.codeJewels);
ok('the repair load stays free of script errors', errors2.length === 0, errors2);

await page2.reload({ waitUntil: 'domcontentloaded' });
await page2.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
const fixedAgain = await page2.evaluate(() => ({ jewels: window.__ps.state.jewels, saved: JSON.parse(localStorage.getItem('petalspire.v03')).jewels }));
ok('a second load adds no jewels either', fixedAgain.jewels === 2 && fixedAgain.saved === 2, fixedAgain);
await ctx2.close();

// Jewels already granted by codes stay (nothing is taken back).
const oldPaid = { ...broken, jewels: 57, codes: { ...broken.codes, EARLYBLOOM: 1 }, codeJewels: { LOVEBUG: 1, MIDWAY: 1, AFTERDARK: 1 } };
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page3 = await ctx3.newPage();
await page3.addInitScript((raw) => { localStorage.setItem('petalspire.v03', raw); }, JSON.stringify(oldPaid));
await page3.goto(base, { waitUntil: 'domcontentloaded' });
await page3.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
const keptPaid = await page3.evaluate(() => ({ jewels: window.__ps.state.jewels, saved: JSON.parse(localStorage.getItem('petalspire.v03')).jewels }));
ok('jewels already paid by codes are kept, not taken back', keptPaid.jewels === 57 && keptPaid.saved === 57, keptPaid);
await ctx3.close();

// iOS app: EARLYBLOOM (jewel-only) is inactive; book codes still give their keepsakes and no jewels.
const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page4 = await ctx4.newPage();
const errors4 = [];
page4.on('pageerror', (e) => errors4.push(String(e)));
await page4.addInitScript((raw) => {
  window.__PETALSPIRE_NATIVE__ = true;
  window.Capacitor = { registerPlugin() { return { async loadProducts() { return { products: [] }; }, addListener() {} }; } };
  localStorage.setItem('petalspire.v03', raw);
}, save);
await page4.goto(base, { waitUntil: 'domcontentloaded' });
await page4.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
const ios = await page4.evaluate(() => {
  const j0 = window.__ps.state.jewels;
  const bloom = window.__ps.redeemCode('EARLYBLOOM');
  const j1 = window.__ps.state.jewels;
  const book = window.__ps.redeemCode('LASTVINTAGE');
  return { bloom, j0, j1, claimed: !!window.__ps.state.codes?.EARLYBLOOM, book, j2: window.__ps.state.jewels, cask: window.__ps.state.decorInv.d8_cellarcask || 0 };
});
ok('iOS: EARLYBLOOM is inactive (no jewels, not claimed)', ios.bloom === false && ios.j1 === ios.j0 && !ios.claimed, ios);
ok('iOS: LASTVINTAGE gives its keepsakes and no jewels', ios.book === true && ios.cask === 1 && ios.j2 === ios.j0, ios);
ok('iOS code checks stay free of script errors', errors4.length === 0, errors4);
await ctx4.close();

await browser.close();
server.close();
if (fails.length) { console.error('FAILED', fails); process.exit(1); }
console.log('book codes ok');
