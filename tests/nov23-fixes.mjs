// Nov 23 fixes: every chopped tree grants a persisted sapling; Home has 6 plots (Back Woods retired
// with bag refunds); Olive Oil is Orchard-press only, with in-progress home-press runs refunded.
//   node tests/nov23-fixes.mjs

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS_DIR || '/workspace/petalspire-shots-nov23';
fs.mkdirSync(SHOTS, { recursive: true });

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
const ok = (name, pass, detail) => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
  if (!pass) fails.push(name);
};

const baseSave = {
  v: 3, build: '0.8.7.7', coins: 100, wood: 40, jewels: 2, scrap: 0,
  introDone: true, tut: { done: true }, guideDone: true,
  lots: { home: true }, standBuilt: true, marketBuilt: true, marketAvail: true,
  beds: ['home-0'], tiles: Array(9).fill(null),
  barrels: { home: { x: -1.15, z: 4.25, w: 9, at: Date.now(), lv: 1 } },
};

async function boot(save, extraInit) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 2 });
  await context.route(/appwrite\.io/, (route) => route.abort());
  await context.addInitScript((raw) => { localStorage.setItem('petalspire.v03', raw); }, JSON.stringify(save));
  if (extraInit) await context.addInitScript(extraInit);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps && window.__ps.state, { timeout: 20000 });
  await page.evaluate(() => {
    document.body.classList.remove('on-title');
    document.getElementById('title')?.classList.add('hidden');
  });
  return { context, page, errors };
}

try {
  // ---------- 1. Layout: 6 home plots, no Back Woods ----------
  {
    const { context, page, errors } = await boot(baseSave);
    const got = await page.evaluate(() => {
      const ps = window.__ps;
      const sale = ps.LOT_FOR_SALE.slice();
      const home = ps.HOME_LOTS.slice();
      const sites = ps.SITES.map((s) => s.lot);
      const lots = Object.keys(ps.LOTS);
      return {
        sale, home, saleN: sale.length, homeN: home.length,
        saleHasBack: sale.includes('backwoods'),
        lotsHasBack: lots.includes('backwoods'),
        sitesBack: sites.filter((l) => l === 'backwoods').length,
        signsBack: !!ps.SIGNS.backwoods,
        behindNorth: ps.BEHIND.north || null,
        prices: ps.LOT_PRICES.slice(),
        retired: ps.BACKWOODS_RETIRED,
        build: ps.BUILD,
      };
    });
    ok('build is 0.8.7.8', got.build === '0.8.7.8', got.build);
    ok('Home has 6 plots (Roadside + 5 neighbours)', got.homeN === 6 && got.home[0] === 'home', got.home);
    ok('five Home plots are for sale (Back Woods removed)', got.saleN === 5 && !got.saleHasBack, got.sale);
    ok('LOTS has no backwoods entry', !got.lotsHasBack, got.lotsHasBack);
    ok('no bed sites on the retired Back Woods', got.sitesBack === 0, got.sitesBack);
    ok('no For Sale sign for Back Woods', !got.signsBack);
    ok('North Woods has nothing behind it', got.behindNorth == null, got.behindNorth);
    ok('plot prices dropped the old 6000 Back Woods price', got.prices.length === 5 && !got.prices.includes(6000), got.prices);
    ok('BACKWOODS_RETIRED keeps the old bounds and price for save migration', got.retired?.id === 'backwoods' && got.retired.price === 6000 && got.retired.z0 === -28.6, got.retired);
    ok('6-plot layout does not throw', errors.length === 0, errors);
    await context.close();
  }

  // ---------- 2. Existing save on the 7th plot is refunded to the Bag ----------
  {
    const t0 = Date.now() - 60_000;
    const fixture = {
      ...baseSave,
      coins: 200,
      wood: 10,
      lots: { home: true, west: true, east: true, north: true, northwest: true, northeast: true, backwoods: true },
      beds: ['home-0', 'backwoods-0'],
      tiles: [
        ...Array(9).fill(null),
        { sp: 'lavender', plantedAt: t0, wateredAt: t0, growMs: 1000 },
        { sp: 'lavender', plantedAt: t0, wateredAt: t0, growMs: 1000 },
        ...Array(7).fill(null),
      ],
      barrels: {
        home: { x: -1.15, z: 4.25, w: 9, at: t0, lv: 1 },
        backwoods: { x: 0, z: -20, w: 4, at: t0, lv: 1 },
      },
      hives: { backwoods: { x: 1, z: -20 } },
      decor: [{ key: 'd99', type: 'planter', x: 0.5, z: -20, r: 0 }],
      trees: [{ id: 'g:99', x: -1, z: -22, at: t0, ms: 1000, st: 'full' }],
      pressBuilt: true,
      pressPos: { x: 1.2, z: -21, lot: 'backwoods' },
      pressSlots: [{ rid: 'sunoil', item: 'press_sunoil', start: t0, ms: 999999 }],
      bags: { home: { seed_sunflower: 0 }, orchard: {} },
    };
    const { context, page, errors } = await boot(fixture);
    const got = await page.evaluate(() => {
      const S = window.__ps.state, ps = window.__ps;
      return {
        lotsBack: !!S.lots.backwoods,
        homeLots: Object.keys(S.lots).filter((l) => l === 'home' || ps.LOT_FOR_SALE.includes(l)).sort(),
        beds: S.beds.slice(),
        coins: S.coins,
        wood: S.wood,
        seeds: S.bags.home.seed_lavender || 0,
        flowers: S.bags.home.flower_lavender || 0,
        sunIn: S.bags.home.seed_sunflower || 0,
        saplings: (S.bags.home.sapling || 0) + (S.bags.orchard.sapling || 0),
        decor: S.decorInv.planter || 0,
        hiveInv: S.hiveInv || 0,
        barrel: !!S.barrels.backwoods,
        pressBuilt: !!S.pressBuilt,
        pressPos: S.pressPos,
        mapOpen: !!S.mapOpen,
        report: S.retiredBackwoods,
      };
    });
    ok('retired save no longer owns Back Woods', got.lotsBack === false, got.lotsBack);
    ok('the other 6 Home plots stay owned', got.homeLots.length === 6 && !got.homeLots.includes('backwoods'), got.homeLots);
    ok('the Back Woods bed was removed', !got.beds.includes('backwoods-0') && got.beds.includes('home-0'), got.beds);
    ok('plants on that bed went to the Home Bag', got.seeds >= 2 && got.flowers >= 2, { seeds: got.seeds, flowers: got.flowers });
    ok('the plot price and barrel were refunded as coins', got.coins >= 200 + 6000 + 120, got.coins);
    ok('the bed and press refunded Wood', got.wood >= 10 + 12 + 20, got.wood);
    ok('the planted tree became a sapling in the Bag', got.saplings >= 1, got.saplings);
    ok('decor on the plot went back to the Bag', got.decor >= 1, got.decor);
    ok('the hive went back to the Bag', got.hiveInv >= 1, got.hiveInv);
    ok('the Back Woods barrel is gone', got.barrel === false);
    ok('the press was unplaced (Place stays in the Bag) and its seeds came back', got.pressBuilt === false && got.pressPos == null && got.sunIn >= 30, { pressBuilt: got.pressBuilt, sunIn: got.sunIn });
    ok('owning the remaining Home plots unlocks the Map', got.mapOpen === true, got.mapOpen);
    ok('backwoods refund does not throw', errors.length === 0, errors);
    await context.close();
  }

  // ---------- 3. Saplings: every chop awards one into a visible, persisted bag ----------
  {
    const { context, page, errors } = await boot(baseSave);
    const first = await page.evaluate(() => {
      const ps = window.__ps, S = ps.state;
      const trees = ps.obstacles('home', 'full').filter((o) => o.type === 'tree');
      const beforeHome = S.bags.home.sapling || 0;
      const beforeOrch = S.bags.orchard.sapling || 0;
      const a = trees[0], b = trees[1];
      ps.tapObstacle(a.id);
      ps.tapObstacle(b.id);
      ps.writeSave();
      return {
        chopped: 2,
        ids: [a.id, b.id],
        home: S.bags.home.sapling || 0,
        orch: S.bags.orchard.sapling || 0,
        beforeHome, beforeOrch,
        groundSaps: (S.ground || []).filter((g) => g.kind === 'sapling').length,
        raw: localStorage.getItem('petalspire.v03'),
      };
    });
    ok('chopping two trees without the Orchard adds 2 saplings to the Home Bag', first.home === first.beforeHome + 2, first);
    ok('those saplings are not hidden in the Orchard Bag', first.orch === first.beforeOrch, first);
    ok('chop no longer leaves a sapling on the ground to vanish', first.groundSaps === 0, first.groundSaps);

    const persisted = JSON.parse(first.raw);
    ok('the sapling count is written into the save', (persisted.bags?.home?.sapling || 0) === first.home, persisted.bags?.home);

    // cold load of that save: saplings must still be in the Home Bag (migTrees065 must not vacuum them)
    await context.close();
    const re = await boot(persisted);
    const afterReload = await re.page.evaluate(() => {
      const S = window.__ps.state;
      return { home: S.bags.home.sapling || 0, orch: S.bags.orchard.sapling || 0, groundSaps: (S.ground || []).filter((g) => g.kind === 'sapling').length };
    });
    ok('saplings stay in the Home Bag after reload', afterReload.home === first.home, afterReload);
    ok('reload does not move saplings into a hidden Orchard Bag', afterReload.orch === first.orch, afterReload);
    // continue the remaining sapling checks on the reloaded page
    const page2 = re.page;
    const context2 = re.context;
    const errors2 = re.errors;

    // ground saplings already in a save are scooped into the Bag
    const scooped = await page2.evaluate(() => {
      const S = window.__ps.state, ps = window.__ps;
      const before = S.bags.home.sapling || 0;
      S.ground.push({ key: 'ltest1', kind: 'sapling', x: 0, z: 0 }, { key: 'ltest2', kind: 'sapling', x: 1, z: 1 });
      const n = ps.collectGroundSaplings();
      return { n, home: S.bags.home.sapling || 0, before, left: (S.ground || []).filter((g) => g.kind === 'sapling').length };
    });
    ok('existing ground saplings are collected into the Bag', scooped.n === 2 && scooped.home === scooped.before + 2 && scooped.left === 0, scooped);

    // once the Orchard is owned, new chops go to the Orchard Bag
    const withOrch = await page2.evaluate(() => {
      const ps = window.__ps, S = ps.state;
      S.lots.orchard = true;
      const tree = ps.obstacles('home', 'full').filter((o) => o.type === 'tree' && o.state === 'full')[0];
      const beforeH = S.bags.home.sapling || 0, beforeO = S.bags.orchard.sapling || 0;
      if (tree) ps.tapObstacle(tree.id);
      return { ok: !!tree, home: S.bags.home.sapling || 0, orch: S.bags.orchard.sapling || 0, beforeH, beforeO, loc: ps.saplingBagLoc() };
    });
    ok('after the Orchard is owned, a chop grants the sapling to the Orchard Bag', withOrch.ok && withOrch.orch === withOrch.beforeO + 1 && withOrch.home === withOrch.beforeH && withOrch.loc === 'orchard', withOrch);

    // planted mature tree also grants a sapling
    const grown = await page2.evaluate(() => {
      const ps = window.__ps, S = ps.state;
      const id = 'g:choptest';
      const before = S.bags.orchard.sapling || 0;
      S.trees.push({ id, x: 2, z: 1, at: Date.now() - 999999, ms: 1000, baseMs: 1000, st: 'full' });
      ps.W.addGrown(id, 2, 1, 3, 'full');
      ps.tapObstacle(id);
      const t = S.trees.find((x) => x.id === id);
      return { after: S.bags.orchard.sapling || 0, before, st: t?.st };
    });
    ok('chopping a planted mature tree also grants one sapling', grown.after === grown.before + 1 && grown.st === 'stump', grown);

    ok('sapling tests do not throw', errors.length === 0 && errors2.length === 0, { errors, errors2 });
    await context2.close();
  }

  // ---------- 4. Olive Oil is gone from the home press, stays on the Orchard press ----------
  {
    const t0 = Date.now();
    const inProgress = {
      ...baseSave,
      coins: 500,
      lots: { home: true, orchard: true },
      pressBuilt: true,
      pressPos: { x: 2.2, z: 1.2, lot: 'home' },
      opressBuilt: true,
      opressPos: { x: 300, z: 0, lot: 'orchard' },
      pressSlots: [{ rid: 'olive', item: 'press_olive', start: t0, ms: 99999999 }, null],
      bags: { home: { fruit_olive: 0, press_olive: 2 }, orchard: { fruit_olive: 0 } },
      unlocked: { olive: true, sunflower: true, damaskrose: true, almond: true, cacao: true, sunpetal: true },
      discovered: { olive: true, sunflower: true },
    };
    const { context, page, errors } = await boot(inProgress);
    const got = await page.evaluate(() => {
      const ps = window.__ps, S = ps.state;
      const homeHtml = ps.craftHTML('press');
      const orchHtml = ps.craftHTML('opress');
      const olive = ps.PRESS.recipes.find((r) => r.id === 'olive');
      return {
        only: olive?.only,
        homeHasOlive: /Olive Oil/.test(homeHtml),
        orchHasOlive: /Olive Oil/.test(orchHtml),
        homeHasSun: /Sunflower Oil/.test(homeHtml),
        orchHasAlmond: /Almond Oil/.test(orchHtml),
        slot0: S.pressSlots[0],
        olivesHome: S.bags.home.fruit_olive || 0,
        olivesOrch: S.bags.orchard.fruit_olive || 0,
        bottled: S.bags.home.press_olive || 0,
        moved: S.pressMoved068,
      };
    });
    ok('Olive Oil recipe is marked orchard-only', got.only === 'orchard', got.only);
    ok('home press recipe list does not include Olive Oil', got.homeHasOlive === false && got.homeHasSun === true, { homeHasOlive: got.homeHasOlive, homeHasSun: got.homeHasSun });
    ok('Orchard Oil Press still lists Olive Oil', got.orchHasOlive === true, got.orchHasOlive);
    ok('in-progress Olive Oil at the home press refunds the olives to the Bag', got.slot0 == null && (got.olivesOrch + got.olivesHome) >= 6, { slot0: got.slot0, olivesOrch: got.olivesOrch, olivesHome: got.olivesHome });
    ok('Olive Oil already in the Bag is kept', got.bottled === 2, got.bottled);
    ok('olive press tests do not throw', errors.length === 0, errors);
    await context.close();
  }

  // finished Olive Oil in a home press slot stays collectable
  {
    const t0 = Date.now() - 200_000;
    const finished = {
      ...baseSave,
      lots: { home: true, orchard: true },
      pressBuilt: true,
      pressPos: { x: 2.2, z: 1.2, lot: 'home' },
      pressSlots: [{ rid: 'olive', item: 'press_olive', start: t0, ms: 1000 }, null],
      bags: { home: {}, orchard: {} },
      unlocked: { olive: true },
    };
    const { context, page } = await boot(finished);
    const got = await page.evaluate(() => {
      const ps = window.__ps, S = ps.state;
      const still = S.pressSlots[0];
      const collected = still ? ps.craftCollect('press', 0) : false;
      return { stillItem: still?.item, collected, bag: S.bags.home.press_olive || 0, slotAfter: S.pressSlots[0] };
    });
    ok('finished Olive Oil in the home press stays collectable', got.stillItem === 'press_olive' && got.collected === true && got.bag === 1 && got.slotAfter == null, got);
    await context.close();
  }

  // ---------- Screenshots ----------
  {
    const { context, page } = await boot({
      ...baseSave,
      coins: 200,
      wood: 40,
      lots: { home: true },
    });
    await page.evaluate(() => {
      document.getElementById('tip')?.classList.add('hidden');
      document.getElementById('story')?.classList.add('hidden');
      document.querySelectorAll('.cozy-modal, #starter').forEach((e) => e.remove());
      // leave the 5 neighbour plots for sale so their fences and signs mark the 2×3 Home grid,
      // with empty land behind North Woods (no 7th plot)
      window.__ps.camera(0, 0.72, 3.4, 0, -8);
    });
    await page.waitForTimeout(600);
    const homePath = path.join(SHOTS, 'home-6-plots.png');
    await page.screenshot({ path: homePath, fullPage: false });
    console.log('SHOT  ' + homePath);

    // home press list: give the player a built press and known recipes, including olive (so a regression would show it)
    await page.evaluate(() => {
      const S = window.__ps.state;
      S.pressBuilt = true;
      S.pressPos = { x: 2.4, z: 1.4, lot: 'home' };
      S.unlocked.olive = S.unlocked.sunflower = S.unlocked.damaskrose = S.unlocked.almond = S.unlocked.cacao = S.unlocked.sunpetal = true;
      S.discovered.olive = S.discovered.sunflower = true;
      S.bags.home.fruit_olive = 12;
      S.bags.home.seed_sunflower = 40;
      S.lots.orchard = true;
      document.querySelectorAll('.cozy-modal, #starter').forEach((e) => e.remove());
      window.__ps.openPanel('press');
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => { document.querySelectorAll('.cozy-modal, #starter').forEach((e) => e.remove()); });
    const pressPath = path.join(SHOTS, 'home-press-list.png');
    await page.screenshot({ path: pressPath, fullPage: false });
    console.log('SHOT  ' + pressPath);
    const listed = await page.evaluate(() => document.getElementById('panel')?.innerText || '');
    ok('screenshot press panel lists Sunflower Oil and not Olive Oil', /Sunflower Oil/.test(listed) && !/Olive Oil/.test(listed), listed.slice(0, 400));
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (fails.length) {
  console.error(`\n${fails.length} failed: ${fails.join(', ')}`);
  process.exit(1);
}
console.log('\nAll nov23 fix tests passed.');
