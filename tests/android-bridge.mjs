import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ADMOB_ANDROID_DEMO, ADMOB_ANDROID_LIVE, ADMOB_ANDROID_TEST_ADS, androidAdmobIds, androidAdmobLiveReady } from '../js/admob-config-android.js';
import { isAndroid, nativePlatform } from '../js/native.js';
import { PRODUCT_IDS } from '../js/store.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('platform detection: web, ios, android', () => {
  globalThis.__PETALSPIRE_NATIVE__ = false;
  assert.equal(nativePlatform(), 'web');
  globalThis.__PETALSPIRE_NATIVE__ = true;
  globalThis.Capacitor = { getPlatform: () => 'android' };
  assert.equal(isAndroid(), true);
  globalThis.Capacitor = { getPlatform: () => 'ios' };
  assert.equal(nativePlatform(), 'ios');
  delete globalThis.Capacitor;
  globalThis.__PETALSPIRE_NATIVE__ = false;
});

test('Android requests demo units while live ids are placeholders', () => {
  assert.equal(androidAdmobLiveReady(), Object.values(ADMOB_ANDROID_LIVE).every((v) => v.startsWith('ca-app-pub-7278113923202511')));
  if (ADMOB_ANDROID_TEST_ADS || !androidAdmobLiveReady()) assert.deepEqual(androidAdmobIds(), ADMOB_ANDROID_DEMO);
  assert.notEqual(ADMOB_ANDROID_LIVE.appId, 'ca-app-pub-7278113923202511~9974526421', 'Android must not reuse the iOS AdMob app');
});

test('manifest AdMob app id matches the JS config', () => {
  const m = read('android/gradle.properties').match(/^PETALSPIRE_ADMOB_APP_ID=(.+)$/m);
  assert.ok(m, 'PETALSPIRE_ADMOB_APP_ID missing');
  const expected = androidAdmobLiveReady() && !ADMOB_ANDROID_TEST_ADS ? ADMOB_ANDROID_LIVE.appId : ADMOB_ANDROID_DEMO.appId;
  if (!androidAdmobLiveReady()) assert.equal(m[1].trim(), ADMOB_ANDROID_DEMO.appId);
  else assert.equal(m[1].trim(), ADMOB_ANDROID_LIVE.appId, `expected ${expected}`);
});

test('Play Billing plugin sells the same products as StoreKit', () => {
  const java = read('android/app/src/main/java/com/schwarzespiele/petalspire/PetalspireStorePlugin.java');
  const swift = read('ios/App/App/StoreKitPlugin.swift');
  const ids = (src) => [...src.matchAll(/"(com\.petalspire\.[a-z0-9.]+)"/g)].map((m) => m[1]);
  const javaAll = [...new Set(ids(java.split('CONSUMABLES')[0]))];
  assert.deepEqual(javaAll.sort(), [...new Set(ids(swift))].sort());
  assert.deepEqual(javaAll.sort(), [...PRODUCT_IDS].sort());
  const consumable = ids(java.split('CONSUMABLES = ')[1].split(');')[0]);
  assert.deepEqual(consumable.sort(), ['com.petalspire.jewels.1', 'com.petalspire.jewels.10', 'com.petalspire.jewels.50']);
  assert.match(read('android/app/src/main/java/com/schwarzespiele/petalspire/MainActivity.java'), /registerPlugin\(PetalspireStorePlugin\.class\)/);
});

test('Android app id, name and version', () => {
  const g = read('android/app/build.gradle');
  assert.match(g, /applicationId "com\.schwarzespiele\.petalspire"/);
  assert.match(g, /versionName "1\.0"/);
  assert.match(g, /petalspireVersionCode'\) \?: '1'/);
  assert.match(read('android/app/src/main/res/values/strings.xml'), /<string name="app_name">Petalspire<\/string>/);
});
