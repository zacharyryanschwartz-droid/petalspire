// Petalspire — music + sound effects with the Web Audio API.
// v0.7.2: the music is real recorded tracks in audio/music/: four CC0 tracks (credits in audio/music/LICENSES.md) and
// two takes of 'Morning on the Hill', Petalspire's own instrumental, played as one shuffled
// playlist on both Home and the Orchard: no immediate repeats, a ~2.5 s crossfade between tracks. Each track is fetched and
// decoded lazily (only the current one and the next are held in memory; the next is preloaded while the current one plays).
// The sound effects are still synthesized live. Nothing starts until the first tap (browser autoplay rules).
// Settings: separate Music / Sound Effects volume + mute, stored in the save (S.audio).
//
// To add a track (e.g. a theme song): drop the mp3 in audio/music/ and add one line to PLAYLIST.
//   Optional fields: gain (loudness trim, 1 = as is), scenes (['home'] or ['orchard'] to limit where it plays),
//   weight (2 = comes up about twice as often).

export const PLAYLIST = [
  { id: 'town-theme', title: 'Town Theme', artist: 'The Cynic Project', src: 'audio/music/town-theme.mp3' },
  { id: 'a-small-fire-will-do', title: 'A Small Fire Will Do', artist: 'Cal McEachern (Trex0n)', src: 'audio/music/a-small-fire-will-do.mp3' },
  { id: 'meadow-thoughts', title: 'Meadow Thoughts', artist: 'Écrivain', src: 'audio/music/meadow-thoughts.mp3' },
  { id: 'a-new-town', title: 'A New Town', artist: 'The Cynic Project', src: 'audio/music/a-new-town.mp3' },
  // Petalspire's own instrumentals (the game owner's songs, not CC0; no credit needed)
  { id: 'morning-on-the-hill', title: 'Morning on the Hill', artist: 'Petalspire', src: 'audio/music/morning-on-the-hill.mp3' },
  { id: 'morning-on-the-hill-2', title: 'Morning on the Hill (take 2)', artist: 'Petalspire', src: 'audio/music/morning-on-the-hill-2.mp3' },
];
export const MUSIC_CREDITS = 'Music: The Cynic Project (cynicmusic.com), Écrivain, Cal McEachern (Trex0n), via OpenGameArt.org, CC0.';
export const XFADE_S = 2.5;

const N = (name) => {   // 'A4', 'F#5', 'Bb3' → Hz
  const m = /^([A-G])([#b]?)(\d)$/.exec(name); const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (base + (+m[3] + 1) * 12 - 69) / 12);
};
// ---------- SFX building blocks (work on any BaseAudioContext) ----------
let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf = b);
}
const PLUCK_WAVE = new WeakMap();
function pluckWave(ctx) { let w = PLUCK_WAVE.get(ctx); if (!w) { const n = 10, re = new Float32Array(n + 1), im = new Float32Array(n + 1); for (let k = 1; k <= n; k++) im[k] = Math.pow(k, -1.3) * (k % 2 ? 1 : 0.7); w = ctx.createPeriodicWave(re, im); PLUCK_WAVE.set(ctx, w); } return w; }
function env(g, t, a, peak, dur, rel, sus = peak) {
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
  if (sus !== peak) g.gain.linearRampToValueAtTime(sus, t + a + 0.08);
  g.gain.setValueAtTime(sus, t + Math.max(a + 0.08, dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
}
// plucked string (harp: bright, long; guitar: darker, shorter)
export function pluck(ctx, out, t, f, v = 0.3, kind = 'harp') {
  const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), dec = kind === 'harp' ? 2.2 : 1.3;
  o.setPeriodicWave(pluckWave(ctx)); o.frequency.value = f;
  lp.type = 'lowpass'; lp.Q.value = 0.6; lp.frequency.setValueAtTime(kind === 'harp' ? 4200 : 2600, t); lp.frequency.exponentialRampToValueAtTime(kind === 'harp' ? 900 : 500, t + 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dec + 0.05);
}
// tin whistle / flute: pure tone, a breath of noise, delayed vibrato
export function whistle(ctx, out, t, f, dur, v = 0.16) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.12;
  lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.35, dur)); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  o2.connect(g2).connect(g); o.connect(g); env(g, t, 0.05, v, dur, 0.12, v * 0.85); g.connect(out);
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noise(ctx); bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2.5); bp.Q.value = 1.5;
  ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(v * 0.18, t + 0.03); ng.gain.exponentialRampToValueAtTime(v * 0.04, t + 0.15); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  n.connect(bp).connect(ng).connect(out);
  const end = t + dur + 0.2; for (const s of [o, o2, lfo]) { s.start(t); s.stop(end); } n.start(t, Math.random() * 0.5); n.stop(end);
}
// ---------- sound effects (short, soft; synthesized live) ----------
function bell(ctx, out, t, f, v = 0.12, dec = 0.9) {
  for (const [m, a] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * m;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec / m ** 0.5); o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.05); }
}
function burst(ctx, out, t, { type = 'lowpass', f = 800, q = 0.7, v = 0.1, a = 0.005, d = 0.12, f2 } = {}) {
  const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noise(ctx); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d); fl.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); n.connect(fl).connect(g).connect(out); n.start(t, Math.random() * 0.6); n.stop(t + a + d + 0.05);
}
function blip(ctx, out, t, f1, f2, d = 0.08, v = 0.08, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.04); o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.08);
}
export const SFX = {
  tap: (c, o, t) => blip(c, o, t, 980, 760, 0.035, 0.05),
  plant: (c, o, t) => { burst(c, o, t, { f: 520, v: 0.16, d: 0.09 }); blip(c, o, t + 0.04, 330, 190, 0.09, 0.12); pluck(c, o, t + 0.1, N('G5'), 0.06, 'harp'); },
  water: (c, o, t) => { burst(c, o, t, { type: 'bandpass', f: 2600, q: 0.8, v: 0.05, a: 0.04, d: 0.35, f2: 1400 }); for (let k = 0; k < 4; k++) blip(c, o, t + 0.04 + k * 0.07 + Math.random() * 0.03, 380 + Math.random() * 200, 900 + Math.random() * 400, 0.05, 0.05); },
  harvest: (c, o, t) => { burst(c, o, t, { type: 'highpass', f: 2200, v: 0.04, d: 0.08 }); ['D5', 'F#5', 'A5'].forEach((n, k) => pluck(c, o, t + 0.03 + k * 0.07, N(n), 0.12, 'harp')); },
  pick: (c, o, t) => { blip(c, o, t, 600, 260, 0.06, 0.1); ['G5', 'B5'].forEach((n, k) => pluck(c, o, t + 0.05 + k * 0.07, N(n), 0.11, 'harp')); },
  coin: (c, o, t) => { bell(c, o, t, N('E6'), 0.07, 0.5); bell(c, o, t + 0.07, N('B6'), 0.06, 0.6); },
  buy: (c, o, t) => { pluck(c, o, t, N('A5'), 0.1, 'harp'); pluck(c, o, t + 0.08, N('D6'), 0.09, 'harp'); bell(c, o, t + 0.08, N('D6'), 0.03, 0.4); },
  build: (c, o, t) => { for (let k = 0; k < 2; k++) { burst(c, o, t + k * 0.13, { type: 'bandpass', f: 850 + k * 120, q: 4, v: 0.25, d: 0.06 }); blip(c, o, t + k * 0.13, 180, 110, 0.06, 0.1); } bell(c, o, t + 0.3, N('D6'), 0.04, 0.6); },
  pack: (c, o, t) => { burst(c, o, t, { type: 'highpass', f: 3000, v: 0.05, a: 0.15, d: 0.5 }); ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'].forEach((n, k) => bell(c, o, t + k * 0.06, N(n), 0.05, 0.7)); },
  levelup: (c, o, t) => { ['D5', 'F#5', 'A5', 'D6'].forEach((n, k) => { pluck(c, o, t + k * 0.09, N(n), 0.12, 'harp'); }); whistle(c, o, t + 0.36, N('A5'), 0.35, 0.07); bell(c, o, t + 0.36, N('D6'), 0.04, 0.9); },
  goal: (c, o, t) => { ['G4', 'B4', 'D5', 'G5', 'B5'].forEach((n, k) => pluck(c, o, t + k * 0.08, N(n), 0.11, 'harp')); bell(c, o, t + 0.42, N('G6'), 0.04, 1); },
  press: (c, o, t) => { const s = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); s.type = 'sawtooth'; s.frequency.setValueAtTime(95, t); s.frequency.linearRampToValueAtTime(70, t + 0.25); s.frequency.linearRampToValueAtTime(88, t + 0.4);
    lp.type = 'lowpass'; lp.frequency.value = 420; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); s.connect(lp).connect(g).connect(o); s.start(t); s.stop(t + 0.5);
    burst(c, o, t + 0.2, { f: 700, v: 0.07, a: 0.03, d: 0.2, f2: 250 }); blip(c, o, t + 0.42, 520, 300, 0.06, 0.05); },
};

// ---------- the player ----------
export function createAudio({ prefs, playlist = PLAYLIST }) {
  let ctx = null, music = null, sfx = null, scene = null, cur = null, nextT = null, unlocked = false, bag = [], tick = null, plays = 0;
  const bufs = {}, loading = {}, failed = new Set();
  const DEF = { music: 0.6, sfx: 0.8, musicMute: false, sfxMute: false }, P = () => prefs() || DEF;
  const mv = () => (P().musicMute ? 0 : P().music) * 0.4, sv = () => (P().sfxMute ? 0 : P().sfx) * 0.9;   // v0.7.2: 0.4 (was 0.55) for the recorded tracks
  function apply() { if (!ctx) return; const t = ctx.currentTime; music.gain.setTargetAtTime(mv(), t, 0.08); sfx.gain.setTargetAtTime(sv(), t, 0.03); }
  const pool = () => { const p = playlist.filter((t) => !failed.has(t.id) && (!t.scenes || t.scenes.includes(scene))); return p.length ? p : playlist.filter((t) => !failed.has(t.id)); };
  // shuffled bag: every track once per round (weight = copies), and never the same track twice in a row
  function pick() {
    const p = pool(); if (!p.length) return null;
    bag = bag.filter((t) => p.includes(t));
    if (!bag.length) { for (const t of p) for (let k = 0; k < (t.weight || 1); k++) bag.push(t); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
    let i = bag.findIndex((t) => t.id !== cur?.id); if (i < 0) i = 0;
    return bag.splice(i, 1)[0];
  }
  function load(t) {
    if (!t || !ctx) return Promise.resolve(null); if (bufs[t.id]) return Promise.resolve(bufs[t.id]);
    if (!loading[t.id]) loading[t.id] = fetch(t.src).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((a) => new Promise((res, rej) => { const p = ctx.decodeAudioData(a, res, rej); if (p?.then) p.then(res, rej); }))
      .then((b) => { bufs[t.id] = b; return b; }).catch(() => { failed.add(t.id); return null; }).finally(() => { delete loading[t.id]; });
    return loading[t.id];
  }
  // keep only the playing track and the preloaded next one decoded (a decoded minute of stereo audio is ~20 MB)
  const trim = () => { for (const id of Object.keys(bufs)) if (id !== cur?.id && id !== nextT?.id) delete bufs[id]; };
  let starting = false;
  async function playNext() {
    if (!ctx || starting) return; starting = true;
    try {
      let t = nextT || pick(), b = null;
      for (let k = 0; k < playlist.length + 1 && t; k++) { b = await load(t); if (b) break; nextT = null; t = pick(); }
      if (!b || !ctx) return;
      const now = ctx.currentTime, g = ctx.createGain(), s = ctx.createBufferSource(), lv = t.gain ?? 1;
      s.buffer = b; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(lv, now + XFADE_S); s.connect(g).connect(music); s.start(now + 0.02);
      if (cur) { const o = cur; o.g.gain.cancelScheduledValues(now); o.g.gain.setValueAtTime(o.g.gain.value, now); o.g.gain.linearRampToValueAtTime(0, now + XFADE_S); try { o.s.stop(now + XFADE_S + 0.1); } catch (_) {} }
      cur = { id: t.id, title: t.title, s, g, start: now + 0.02, end: now + 0.02 + b.duration }; plays++;
      nextT = pick(); trim(); setTimeout(() => load(nextT), 3000);   // preload the next track quietly
    } finally { starting = false; }
  }
  // the crossfade is driven by the AudioContext clock, so a paused (hidden) tab never skips ahead
  function loop() { if (!ctx || ctx.state !== 'running' || mv() <= 0 && !cur) return; if (!cur) return void playNext(); if (ctx.currentTime >= cur.end - XFADE_S) playNext(); }
  function unlock() {
    if (unlocked) { if (ctx?.state === 'suspended' && !document.hidden) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (_) { ctx = new AC(); }
    unlocked = true; music = ctx.createGain(); sfx = ctx.createGain(); music.gain.value = 0; sfx.gain.value = sv(); music.connect(ctx.destination); sfx.connect(ctx.destination);
    ctx.resume?.(); apply(); playNext(); tick = setInterval(loop, 500);
  }
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend?.(); else if (unlocked) ctx.resume?.(); });
  return {
    unlock, apply,
    // one playlist everywhere: travelling keeps the current track going (scene only matters for tracks limited by `scenes`)
    setScene(id) { scene = id === 'orchard' ? 'orchard' : 'home'; if (nextT?.scenes && !nextT.scenes.includes(scene)) nextT = null; },
    skip() { return playNext(); },   // tests / a future "next track" button
    play(name) { if (!ctx || !SFX[name] || sv() <= 0 || ctx.state !== 'running') return false; try { SFX[name](ctx, sfx, ctx.currentTime + 0.01); } catch (_) {} return true; },
    get state() { return { unlocked, ctx: ctx?.state || 'none', scene, playing: cur?.id || null, title: cur?.title || null, next: nextT?.id || null, pos: cur && ctx ? +(ctx.currentTime - cur.start).toFixed(1) : 0, dur: cur ? +(cur.end - cur.start).toFixed(1) : 0, plays, tracks: playlist.length,
      music: +mv().toFixed(3), sfx: +sv().toFixed(3), musicGain: music ? +music.gain.value.toFixed(3) : null, rendered: Object.keys(bufs), failed: [...failed] }; },
  };
}
