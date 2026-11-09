import assert from 'node:assert/strict';
import test from 'node:test';
import { BOOKS, BOOKS_PROMO_ENABLED, BOOK_PROMO_LINE, promoBooks } from '../js/books.js';
import { ADMOB_TEST_ADS, ADMOB_LIVE, admobIds } from '../js/admob-config.js';
import { chooseSave, isNative } from '../js/native.js';
import { bannerSlots } from '../js/ads.js';
import { Payments } from '../js/payments.js';

test('books list is the only promo source', () => {
  assert.equal(BOOKS_PROMO_ENABLED, true);
  assert.equal(BOOKS.length, 1);
  assert.deepEqual(BOOKS[0], { title: 'Love Bug Critters', url: 'https://a.co/d/040I747u' });
  assert.equal(promoBooks()[0].title, 'Love Bug Critters');
  assert.match(BOOK_PROMO_LINE, /Buy any Schwarze Spiele book/);
});

test('web banner rotates house ad and each book, with no AdMob', () => {
  globalThis.__PETALSPIRE_NATIVE__ = false;
  const slots = bannerSlots();
  assert.deepEqual(slots.map((s) => s.kind), ['house', 'book']);
  assert.equal(slots[1].title, 'Love Bug Critters');
  assert.equal(slots[1].url, BOOKS[0].url);
  assert.equal(slots[1].line, BOOK_PROMO_LINE);
  assert.equal(slots.some((s) => s.kind === 'admob'), false);
});

test('native banner leads with AdMob then the same house ads', () => {
  globalThis.__PETALSPIRE_NATIVE__ = true;
  const slots = bannerSlots();
  assert.deepEqual(slots.map((s) => s.kind), ['admob', 'house', 'book']);
  globalThis.__PETALSPIRE_NATIVE__ = false;
});

test('TestFlight requests Google demo units until the flag is flipped', () => {
  assert.equal(ADMOB_TEST_ADS, true);
  const ids = admobIds();
  assert.equal(ids.rewarded, 'ca-app-pub-3940256099942544/1712485313');
  assert.equal(ids.interstitial, 'ca-app-pub-3940256099942544/4411468910');
  assert.equal(ids.banner, 'ca-app-pub-3940256099942544/2435281174');
  assert.equal(ADMOB_LIVE.rewarded, 'ca-app-pub-7278113923202511/3300151917');
  assert.equal(ADMOB_LIVE.interstitial, 'ca-app-pub-7278113923202511/2098750887');
  assert.equal(ADMOB_LIVE.banner, 'ca-app-pub-7278113923202511/6967934189');
  assert.equal(ADMOB_LIVE.appId, 'ca-app-pub-7278113923202511~9974526421');
});

test('chooseSave prefers a newer or only-surviving mirror', () => {
  const older = JSON.stringify({ v: 3, savedAt: 10, coins: 1 });
  const newer = JSON.stringify({ v: 3, savedAt: 20, coins: 2 });
  assert.equal(chooseSave(null, newer), 'mirror');
  assert.equal(chooseSave('{', newer), 'mirror');
  assert.equal(chooseSave(newer, older), 'local');
  assert.equal(chooseSave(older, newer), 'mirror');
  assert.equal(chooseSave(newer, null), 'local');
  assert.equal(chooseSave(newer, newer), 'local');
});

test('web purchases stay simulated and the native build refuses them', async () => {
  assert.equal(isNative(), false);
  const web = await Payments.purchase({ id: 'jewels_1', n: 1 });
  assert.equal(web.ok, true);
  assert.equal(web.simulated, true);
  globalThis.__PETALSPIRE_NATIVE__ = true;
  const native = await Payments.purchase({ id: 'jewels_1', n: 1 });
  assert.equal(native.ok, false);
  const offer = await Payments.purchaseOffer({ productId: 'com.petalspire.starter', name: 'Starter' });
  assert.equal(offer.ok, false);
  globalThis.__PETALSPIRE_NATIVE__ = false;
});
