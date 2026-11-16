// iOS 1.0 build 10 audio checks: bundled mp3 answered with status 0 (Capacitor iOS) still plays music;
// sound stops when the app goes to the background and comes back on return / the next tap; full-screen ads hold audio;
// a broken (closed / interrupted) context is rebuilt on the next tap with music restarted; settings are kept.
// Run from the repo root with Playwright installed:  node tests/ios-audio.mjs
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { audioResponseOk } from '../js/audio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
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
const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!pass) fails.push(name); };

ok('status 0 counts as a good audio response', audioResponseOk({ ok: false, status: 0 }) && audioResponseOk({ ok: true, status: 200 }) && !audioResponseOk({ ok: false, status: 404 }));

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
await context.route(/appwrite\.io/, (route) => route.abort());
// act like Capacitor iOS: bundled .mp3 comes back with status 0 / ok false, body intact
await context.addInitScript(() => {
  const AC = window.AudioContext; window.__actx = [];
  window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__actx.push(this); } };
  const real = window.fetch.bind(window);
  window.fetch = async (u, o) => {
    const r = await real(u, o);
    if (!String(u).endsWith('.mp3')) return r;
    const buf = await r.arrayBuffer();
    return { ok: false, status: 0, type: 'basic', arrayBuffer: async () => buf };
  };
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ps && window.__ps.sound, null, { timeout: 30000 });
const st = () => page.evaluate(() => window.__ps.sound);
const prefsBefore = await page.evaluate(() => JSON.stringify(window.__ps.audioPrefs));

await page.mouse.click(550, 350);
await page.waitForFunction(() => window.__ps.sound.playing, null, { timeout: 20000 }).catch(() => {});
let s = await st();
ok('music plays after the first tap with status-0 mp3 responses', !!s.playing && s.ctx === 'running' && !s.failed.length, { playing: s.playing, ctx: s.ctx, failed: s.failed });

// app goes to the background (Capacitor 'pause') and comes back ('resume')
await page.evaluate(() => document.dispatchEvent(new Event('pause')));
await page.waitForTimeout(300);
s = await st(); ok('audio is held while the app is in the background', s.ctx === 'suspended', s.ctx);
await page.evaluate(() => document.dispatchEvent(new Event('resume')));
await page.waitForTimeout(600);
s = await st(); ok('audio comes back right away on return', s.ctx === 'running' && !!s.playing, { ctx: s.ctx, playing: s.playing });
await page.mouse.click(550, 350); await page.waitForTimeout(200);
s = await st(); ok('first tap after return keeps a healthy context (no needless rebuild)', s.rebuilds === 0 && s.ctx === 'running', { rebuilds: s.rebuilds });

// full-screen ad
await page.evaluate(() => window.dispatchEvent(new CustomEvent('petalspire-fullscreen-ad', { detail: { open: true } })));
await page.waitForTimeout(300);
s = await st(); ok('a full-screen ad holds the game audio', s.ctx === 'suspended' && s.adOpen, s.ctx);
await page.evaluate(() => window.dispatchEvent(new CustomEvent('petalspire-fullscreen-ad', { detail: { open: false } })));
await page.waitForTimeout(600);
s = await st(); ok('audio comes back after the ad closes', s.ctx === 'running' && !s.adOpen, s.ctx);

// iOS left the context broken (closed / interrupted): the next tap builds a fresh one and restarts music
const before = (await st()).rebuilds;
await page.evaluate(async () => { document.dispatchEvent(new Event('pause')); });
await page.evaluate(() => window.__actx[window.__actx.length - 1].close());   // iOS killed the context while away
await page.evaluate(() => document.dispatchEvent(new Event('resume')));
await page.mouse.click(550, 350);
await page.waitForFunction(() => window.__ps.sound.ctx === 'running' && window.__ps.sound.playing, null, { timeout: 20000 }).catch(() => {});
s = await st(); ok('after the background the next tap leaves sound + music running', s.ctx === 'running' && !!s.playing && s.rebuilds === before + 1, { ctx: s.ctx, playing: s.playing, rebuilds: s.rebuilds });
ok('sfx play after return', await page.evaluate(() => window.__ps.sfxPlay('coin') !== false));
ok('sound settings kept', prefsBefore === await page.evaluate(() => JSON.stringify(window.__ps.audioPrefs)));
ok('no page errors', !errors.length, errors.slice(0, 3));

await browser.close(); server.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log('\nall passed');
