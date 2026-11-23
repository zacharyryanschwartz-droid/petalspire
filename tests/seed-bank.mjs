// Seed Bank: with 9 seeds of a flower (a full 3×3 bed) you can bank that type so those seeds can never be sold.
// Planting uses loose bag seeds first, then the bank. Harvests refill the bank back to 9.
//   node tests/seed-bank.mjs

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

const SHOTS = process.env.SHOTS || '/workspace/petalspire-shots-nov23';
fs.mkdirSync(SHOTS, { recursive: true });

const save = JSON.stringify({
  v: 3, coins: 200, wood: 40, jewels: 2, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, loc: 'home', standBuilt: true, marketBuilt: true, marketAvail: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  barrels: { home: { x: -1.15, z: 4.25, w: 9, at: Date.now(), lv: 1 } },
  bags: { home: { seed_lavender: 12, seed_sunflower: 60 }, orchard: {} },
});

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const fails = [];
const ok = (name, pass, detail) => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
  if (!pass) fails.push(name);
};

async function boot(raw = save) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((raw) => {
    localStorage.setItem('petalspire.v03', raw);
  }, raw);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps && window.__ps.state && window.__ps.bankSeeds, { timeout: 20000 });
  await page.evaluate(() => {
    document.body.classList.remove('on-title');
    document.getElementById('title')?.classList.add('hidden');
    document.getElementById('studio-splash')?.remove();
  });
  return { context, page, errors };
}

const snap = async (page, name, sel) => {
  const dest = path.join(SHOTS, name);
  if (sel) {
    const el = page.locator(sel).first();
    await el.waitFor({ state: 'visible', timeout: 8000 });
    await el.screenshot({ path: dest });
  } else {
    await page.screenshot({ path: dest });
  }
  console.log('SHOT', dest);
  return dest;
};

const { context, page, errors } = await boot();

const meta = await page.evaluate(() => {
  const ps = window.__ps;
  return {
    bankN: ps.BANK_N,
    perBed: ps.BANK_N,
    loose: ps.looseSeeds('lavender'),
    banked: ps.isBanked('lavender'),
    have: ps.seedHave('lavender'),
    bank: JSON.parse(JSON.stringify(ps.seedBank)),
  };
});
ok('BANK_N is 9 (a full 3×3 bed)', meta.bankN === 9, meta);
ok('starting loose lavender is 12, not yet banked', meta.loose === 12 && meta.banked === false && meta.have === 12, meta);

const eight = await page.evaluate(() => {
  const ps = window.__ps;
  ps.state.bags.home.seed_lavender = 8;
  const fail = ps.bankSeeds('lavender');
  return { fail, loose: ps.looseSeeds('lavender'), banked: ps.isBanked('lavender'), bank: ps.bankCount('lavender') };
});
ok('banking is refused when the player has only 8 seeds', eight.fail === false && eight.loose === 8 && eight.banked === false && eight.bank === 0, eight);

await page.evaluate(() => { window.__ps.state.bags.home.seed_lavender = 12; });

await page.evaluate(() => { window.__ps.closePanel(); window.__ps.openPanel('bag', 'satchel'); });
await page.waitForTimeout(250);
const readyUi = await page.evaluate(() => {
  const btn = document.querySelector('[data-bank="lavender"]');
  const title = document.querySelector('[data-seed-bank-title]');
  return {
    hasBankBtn: !!btn,
    btnText: btn?.innerText.replace(/\s+/g, ' ').trim() || null,
    hasSection: !!title,
    section: title?.innerText.replace(/\s+/g, ' ').trim() || null,
    readyRow: document.querySelector('[data-seed-bank-ready="lavender"]')?.innerText.replace(/\s+/g, ' ').trim() || null,
  };
});
ok('Bag shows a Bank 9 button once you hold 9+ seeds', readyUi.hasBankBtn && /Bank 9/.test(readyUi.btnText || ''), readyUi);
await snap(page, 'seedbank-ready.png', '.panel-card');

const banked = await page.evaluate(() => {
  const ps = window.__ps;
  const result = ps.bankSeeds('lavender');
  return {
    result,
    loose: ps.looseSeeds('lavender'),
    bankCount: ps.bankCount('lavender'),
    banked: ps.isBanked('lavender'),
    have: ps.seedHave('lavender'),
  };
});
ok('banking 12 seeds moves 9 into the bank and leaves 3 loose', banked.result === true && banked.loose === 3 && banked.bankCount === 9 && banked.have === 12, banked);

await page.evaluate(() => { window.__ps.openPanel('bag', 'satchel'); });
await page.waitForTimeout(250);
const bankedUi = await page.evaluate(() => {
  const row = document.querySelector('[data-seed-bank="lavender"]');
  const badge = document.querySelector('[data-bag-item="seed_lavender"] .bank-badge, [data-seed-bank="lavender"] .bank-badge');
  return {
    row: row?.innerText.replace(/\s+/g, ' ').trim() || null,
    hasBadge: !!badge,
    hasBankBtn: !!document.querySelector('[data-bank="lavender"]'),
    looseCell: document.querySelector('[data-bag-item="seed_lavender"]')?.innerText.replace(/\s+/g, ' ').trim() || null,
  };
});
ok('Bag shows a banked row with a vault badge and no second Bank button', !!(bankedUi.row && /banked/i.test(bankedUi.row) && /can’t be sold|can't be sold/i.test(bankedUi.row)) && bankedUi.hasBadge && !bankedUi.hasBankBtn, bankedUi);
await snap(page, 'seedbank-banked.png', '.panel-card');

// Selling: stock, bulk, and sunflower bagging must not touch the bank
const sell = await page.evaluate(() => {
  const ps = window.__ps;
  const coins0 = ps.state.coins;
  ps.stock('seed_lavender', 'all', 'home');
  const afterStock = { loose: ps.looseSeeds('lavender'), bank: ps.bankCount('lavender'), stand: ps.state.stand.seed_lavender || 0, coins: ps.state.coins };
  // put the 3 loose seeds back off the stand, then bulk-sell them
  if (typeof ps.unstock === 'function') ps.unstock('seed_lavender', 'home');
  else { ps.state.bags.home.seed_lavender = (ps.state.bags.home.seed_lavender || 0) + (ps.state.stand.seed_lavender || 0); ps.state.stand.seed_lavender = 0; }
  const looseMid = ps.looseSeeds('lavender');
  const bulk = ps.bulkSell('seed_lavender', 'all', 'home');
  const afterBulk = { loose: ps.looseSeeds('lavender'), bank: ps.bankCount('lavender'), bulk, coins: ps.state.coins, looseMid };
  // sunflower: 60 loose, bank 9 of them, then bag 50 of the remaining loose seeds
  ps.state.bags.home.seed_sunflower = 60;
  const sunBank = ps.bankSeeds('sunflower');
  const looseSun = ps.looseSeeds('sunflower');
  const bagOk = ps.bagSeeds('sunflower', 50);
  const afterBag = { ok: bagOk, loose: ps.looseSeeds('sunflower'), bank: ps.bankCount('sunflower'), bags: ps.state.bags.home.bag50_sunflower || 0 };
  return { coins0, afterStock, looseMid, afterBulk, sunBank, looseSun, afterBag };
});
ok('stocking “all” only shelves the 3 loose seeds and leaves 9 banked', sell.afterStock.stand === 3 && sell.afterStock.bank === 9 && sell.afterStock.loose === 0, sell.afterStock);
ok('bulk-selling “all” only sells loose seeds and leaves the bank at 9', sell.afterBulk.loose === 0 && sell.afterBulk.bank === 9 && sell.afterBulk.bulk > 0, sell.afterBulk);
ok('sunflower can be banked from a stack of 60, leaving 51 loose', sell.sunBank === true && sell.looseSun === 51, { sunBank: sell.sunBank, looseSun: sell.looseSun });
ok('bagging 50 sunflower seeds uses only loose seeds and leaves 9 banked', sell.afterBag.ok === true && sell.afterBag.loose === 1 && sell.afterBag.bank === 9 && sell.afterBag.bags === 1, sell.afterBag);

// Planting from the bank when loose is empty
const planted = await page.evaluate(() => {
  const ps = window.__ps;
  // reset bed and lavender: 0 loose, 9 banked
  ps.state.tiles = Array(9).fill(null);
  ps.state.bags.home.seed_lavender = 0;
  if (ps.bankCount('lavender') !== 9) ps.seedBank.home.lavender = 9;
  ps.deselect?.();
  const before = { loose: ps.looseSeeds('lavender'), bank: ps.bankCount('lavender') };
  ps.plant(0, 'lavender');
  const tile = ps.state.tiles[0];
  return { before, loose: ps.looseSeeds('lavender'), bank: ps.bankCount('lavender'), sp: tile && tile.sp, empty1: !ps.state.tiles[1] };
});
ok('planting one tile draws from the bank when the loose stack is empty', planted.sp === 'lavender' && planted.loose === 0 && planted.bank === 8 && planted.empty1, planted);

await page.evaluate(() => {
  const ps = window.__ps;
  ps.state.tiles = Array(9).fill(null);
  ps.state.bags.home.seed_lavender = 0;
  ps.seedBank.home.lavender = 9;
  ps.selectTile(0);
});
await page.waitForTimeout(250);
const plantUi = await page.evaluate(() => {
  const sheet = document.getElementById('tile-sheet');
  const bedBtn = sheet?.querySelector('[data-act="plant-bed-pick"]');
  const chips = [...(sheet?.querySelectorAll('[data-plant], .seed-chip, .seed-bank-row') || [])];
  const plantBedBtns = [...(sheet?.querySelectorAll('[data-plantbed]') || [])];
  const hud = document.getElementById('hud')?.getBoundingClientRect();
  const box = sheet?.getBoundingClientRect();
  return {
    bedBtn: bedBtn?.innerText.replace(/\s+/g, ' ').trim() || null,
    bedBtnCount: sheet ? sheet.querySelectorAll('[data-act="plant-bed-pick"]').length : 0,
    chips: chips.length,
    plantBedBtns: plantBedBtns.length,
    sheetHidden: sheet?.classList.contains('hidden'),
    underHud: !!(hud && box && box.top < hud.bottom - 1),
    sheetTop: box && Math.round(box.top),
    hudBottom: hud && Math.round(hud.bottom),
  };
});
ok('empty soil sheet has one Plant this bed button and no seed-bank cards', plantUi.bedBtnCount === 1 && /Plant this bed/.test(plantUi.bedBtn || '') && plantUi.chips === 0 && plantUi.plantBedBtns === 0 && plantUi.sheetHidden === false, plantUi);
ok('the bed panel sits below the HUD', plantUi.underHud === false && plantUi.sheetTop >= plantUi.hudBottom, plantUi);
await snap(page, 'seedbank-plant.png');

await page.click('#tile-sheet [data-act="plant-bed-pick"]');
await page.waitForTimeout(200);
const pickerUi = await page.evaluate(() => {
  const picker = document.getElementById('seed-picker');
  const tile = picker?.querySelector('[data-plantbed="lavender"]');
  const tiles = [...(picker?.querySelectorAll('.seed-pick') || [])];
  const hud = document.getElementById('hud')?.getBoundingClientRect();
  const box = picker?.getBoundingClientRect();
  const widths = tiles.map((t) => Math.round(t.getBoundingClientRect().width));
  const wraps = tiles.map((t) => {
    const b = t.querySelector('b');
    if (!b) return false;
    const cs = getComputedStyle(b);
    return cs.overflowWrap === 'anywhere' || cs.wordBreak === 'break-all';
  });
  return {
    hidden: picker?.classList.contains('hidden'),
    text: tile?.innerText.replace(/\s+/g, ' ').trim() || null,
    banked: !!tile?.classList.contains('banked'),
    n: tiles.length,
    widths,
    uniform: widths.length > 1 ? Math.max(...widths) - Math.min(...widths) <= 2 : true,
    midWordCss: wraps.some(Boolean),
    underHud: !!(hud && box && !picker?.classList.contains('hidden') && box.top < hud.bottom - 1),
    pickerTop: box && Math.round(box.top),
    hudBottom: hud && Math.round(hud.bottom),
  };
});
ok('Plant this bed opens a seed picker with loose and banked counts', !pickerUi.hidden && /Lavender/i.test(pickerUi.text || '') && /banked/i.test(pickerUi.text || '') && pickerUi.n >= 1, pickerUi);
ok('the seed picker sits below the HUD with even tiles and no mid-word wrap CSS', pickerUi.underHud === false && pickerUi.uniform && !pickerUi.midWordCss, pickerUi);

const fullBed = await page.evaluate(() => {
  const ps = window.__ps;
  const r = ps.plantBed(0, 'lavender');
  const plantedN = ps.state.tiles.filter((t) => t && t.sp === 'lavender').length;
  return { r, plantedN, loose: ps.looseSeeds('lavender'), bank: ps.bankCount('lavender'), stillBanked: ps.isBanked('lavender') };
});
ok('Plant this bed uses the 9 banked seeds and empties the bank (type stays banked)', fullBed.r?.n === 9 && fullBed.plantedN === 9 && fullBed.loose === 0 && fullBed.bank === 0 && fullBed.stillBanked === true, fullBed);

const refill = await page.evaluate(() => {
  const ps = window.__ps;
  ps.state.bags.home.seed_lavender = 12;
  const moved = ps.refillSeedBank('home');
  return { moved, loose: ps.looseSeeds('lavender'), bank: ps.bankCount('lavender') };
});
ok('the bank refills back to 9 from loose harvests, leaving the extras in the bag', refill.moved === 9 && refill.bank === 9 && refill.loose === 3, refill);

// Planting prefers loose seeds so the bank stays at 9
const preferLoose = await page.evaluate(() => {
  const ps = window.__ps;
  ps.state.tiles = Array(9).fill(null);
  ps.state.bags.home.seed_lavender = 3;
  ps.seedBank.home.lavender = 9;
  ps.plant(0, 'lavender');
  return { loose: ps.looseSeeds('lavender'), bank: ps.bankCount('lavender'), sp: ps.state.tiles[0]?.sp };
});
ok('planting uses loose seeds first and leaves the bank at 9', preferLoose.sp === 'lavender' && preferLoose.loose === 2 && preferLoose.bank === 9, preferLoose);

// Persist
await page.evaluate(() => {
  const ps = window.__ps;
  ps.state.bags.home.seed_lavender = 3;
  ps.seedBank.home.lavender = 9;
  ps.writeSave();
});
const persisted = await page.evaluate(() => {
  const raw = localStorage.getItem('petalspire.v03');
  const s = JSON.parse(raw);
  return { hasBank: !!s.seedBank, home: s.seedBank?.home, loose: s.bags?.home?.seed_lavender, invLeaked: s.inv != null };
});
ok('writeSave stores seedBank on the save and keeps 3 loose + 9 banked', persisted.hasBank && persisted.home?.lavender === 9 && persisted.loose === 3, persisted);

const raw = await page.evaluate(() => localStorage.getItem('petalspire.v03'));
await context.close();

const reload = await boot(raw);
const afterLoad = await reload.page.evaluate(() => {
  const ps = window.__ps;
  return { loose: ps.looseSeeds('lavender'), bank: ps.bankCount('lavender'), banked: ps.isBanked('lavender'), have: ps.seedHave('lavender') };
});
ok('reloading the save restores the banked 9 and the 3 loose seeds', afterLoad.loose === 3 && afterLoad.bank === 9 && afterLoad.banked === true && afterLoad.have === 12, afterLoad);
ok('reload page had no errors', reload.errors.length === 0, reload.errors);
await reload.context.close();

// Old saves without seedBank migrate cleanly
const oldRaw = JSON.stringify({
  v: 3, coins: 40, wood: 10, jewels: 0, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, standBuilt: true, marketBuilt: true, marketAvail: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  bags: { home: { seed_lavender: 4 }, orchard: {} },
});
const old = await boot(oldRaw);
const migrated = await old.page.evaluate(() => {
  const ps = window.__ps;
  return { bank: JSON.parse(JSON.stringify(ps.seedBank)), loose: ps.looseSeeds('lavender'), banked: ps.isBanked('lavender'), can: ps.canBank('lavender') };
});
ok('old saves without a Seed Bank still load; nothing is auto-banked', migrated.bank && migrated.bank.home && Object.keys(migrated.bank.home).length === 0 && Object.keys(migrated.bank.orchard).length === 0 && migrated.loose === 4 && migrated.banked === false && migrated.can === false, migrated);
ok('old-save page had no errors', old.errors.length === 0, old.errors);
await old.context.close();

ok('first page had no errors', errors.length === 0, errors);

// Phone-size shots of the short bed panel and the open picker (about 471×1024).
const phone = await browser.newContext({ viewport: { width: 471, height: 1024 }, deviceScaleFactor: 2 });
const phonePage = await phone.newPage();
phonePage.on('pageerror', (e) => errors.push('phone:' + String(e)));
const phoneSave = JSON.stringify({
  v: 3, coins: 200, wood: 40, jewels: 2, introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, loc: 'home', standBuilt: true, marketBuilt: true, marketAvail: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  barrels: { home: { x: -1.15, z: 4.25, w: 9, at: Date.now(), lv: 1 } },
  bags: { home: {
    seed_lavender: 3, seed_calendula: 4, seed_chamomile: 4, seed_peppermint: 4,
    seed_rosemary: 4, seed_yarrow: 4, seed_sunflower: 12, seed_damaskrose: 8,
    seed_tulsi: 8, seed_elderflower: 8, seed_saffron: 8, seed_bluelotus: 8,
  }, orchard: {} },
  seedBank: { home: {
    lavender: 9, sunflower: 8, damaskrose: 8, tulsi: 8, elderflower: 8, saffron: 8, bluelotus: 8,
  }, orchard: {} },
  unlocked: { lavender: true, calendula: true, chamomile: true, peppermint: true, rosemary: true, yarrow: true, sunflower: true, damaskrose: true, tulsi: true, elderflower: true, saffron: true, bluelotus: true, moonflower: true },
});
await phonePage.addInitScript((raw) => { localStorage.setItem('petalspire.v03', raw); }, phoneSave);
await phonePage.goto(base, { waitUntil: 'domcontentloaded' });
await phonePage.waitForFunction(() => window.__ps && window.__ps.state && window.__ps.bankSeeds, { timeout: 20000 });
await phonePage.evaluate(() => {
  document.body.classList.remove('on-title');
  document.getElementById('title')?.classList.add('hidden');
  document.getElementById('studio-splash')?.remove();
  document.getElementById('tip')?.classList.add('hidden');
  document.querySelectorAll('.toast,.sprig-tip,.pop').forEach((e) => e.remove());
  window.__ps.state.unlocked.moonflower = true;
  window.__ps.selectTile(0);
  window.__ps.layoutSheet();
});
await phonePage.waitForTimeout(300);
const phonePanel = await phonePage.evaluate(() => {
  const sheet = document.getElementById('tile-sheet').getBoundingClientRect();
  const hud = document.getElementById('hud').getBoundingClientRect();
  const btnN = document.querySelectorAll('#tile-sheet [data-act="plant-bed-pick"]').length;
  const wall = document.querySelectorAll('#tile-sheet [data-plantbed], #tile-sheet .seed-chip, #tile-sheet .seed-bank-row').length;
  return { btnN, wall, underHud: sheet.top < hud.bottom - 1, top: Math.round(sheet.top), hudBottom: Math.round(hud.bottom) };
});
ok('phone bed panel is a single Plant this bed button, clear of the HUD', phonePanel.btnN === 1 && phonePanel.wall === 0 && !phonePanel.underHud, phonePanel);
await phonePage.screenshot({ path: path.join(SHOTS, 'bedpanel-empty.png') });
console.log('SHOT', path.join(SHOTS, 'bedpanel-empty.png'));
await phonePage.click('#tile-sheet [data-act="plant-bed-pick"]');
await phonePage.waitForTimeout(250);
const phonePick = await phonePage.evaluate(() => {
  const picker = document.getElementById('seed-picker');
  const box = picker.getBoundingClientRect();
  const hud = document.getElementById('hud').getBoundingClientRect();
  const tiles = [...picker.querySelectorAll('.seed-pick')];
  const widths = tiles.map((t) => Math.round(t.getBoundingClientRect().width));
  const moon = picker.querySelector('[data-plantbed="moonflower"]');
  return {
    hidden: picker.classList.contains('hidden'),
    n: tiles.length,
    underHud: box.top < hud.bottom - 1,
    uniform: widths.length ? Math.max(...widths) - Math.min(...widths) <= 2 : false,
    moonOff: !!(moon && moon.disabled),
  };
});
ok('phone seed picker is a uniform grid below the HUD, with ineligible seeds disabled', !phonePick.hidden && phonePick.n >= 12 && !phonePick.underHud && phonePick.uniform && phonePick.moonOff, phonePick);
await phonePage.screenshot({ path: path.join(SHOTS, 'bedpanel-picker.png') });
console.log('SHOT', path.join(SHOTS, 'bedpanel-picker.png'));
await phone.close();

await browser.close();
server.close();
if (fails.length) {
  console.error(`\n${fails.length} failed: ${fails.join('; ')}`);
  process.exit(1);
}
console.log('\nAll Seed Bank tests passed.');
