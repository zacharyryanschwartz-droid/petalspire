// Petalspire v0.7 — music + sound effects, all synthesized in the browser with the Web Audio API (no audio files to download).
// The two tunes ("Home Hearth" for Home, "Orchard Lane" for the Orchard) are original compositions written for Petalspire:
// a gentle pastoral folk feel (tin whistle, fiddle, harp/guitar, a soft frame drum). They are rendered once into a loop buffer
// with an OfflineAudioContext (low CPU while playing) and crossfade when you travel. Nothing starts until the first tap
// (browser autoplay rules). Settings: separate Music / Sound Effects volume + mute, stored in the save (S.audio).

const N = (name) => {   // 'A4', 'F#5', 'Bb3' → Hz
  const m = /^([A-G])([#b]?)(\d)$/.exec(name); const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (base + (+m[3] + 1) * 12 - 69) / 12);
};
const CH = { D: ['D3', 'A3', 'D4', 'F#4', 'A4'], G: ['G2', 'D3', 'G3', 'B3', 'D4'], A: ['A2', 'E3', 'A3', 'C#4', 'E4'], Bm: ['B2', 'F#3', 'B3', 'D4', 'F#4'],
  C: ['C3', 'G3', 'C4', 'E4', 'G4'], Em: ['E3', 'B3', 'E4', 'G4', 'B4'], D7: ['D3', 'A3', 'C4', 'F#4', 'A4'] };
// Melodies: [note | null (rest), length in eighths]; every bar is 3/4 = 6 eighths.
export const TUNES = {
  home: { name: 'Home Hearth', eighth: 0.27, lead: 'whistle', second: 'fiddle', pluck: 'harp',
    chords: ['D', 'D', 'G', 'D', 'Bm', 'G', 'A', 'A', 'D', 'D', 'G', 'D', 'G', 'A', 'D', 'D'],
    mel: [['A4', 2], ['D5', 2], ['E5', 1], ['F#5', 1], ['A5', 3], ['F#5', 1], ['E5', 2], ['D5', 2], ['B4', 2], ['D5', 1], ['E5', 1], ['F#5', 4], ['E5', 1], ['D5', 1],
      ['B4', 2], ['D5', 2], ['F#5', 2], ['G5', 3], ['F#5', 1], ['E5', 1], ['D5', 1], ['C#5', 2], ['E5', 2], ['A4', 2], ['E5', 4], [null, 2],
      ['A4', 2], ['D5', 2], ['E5', 1], ['F#5', 1], ['A5', 2], ['B5', 1], ['A5', 1], ['F#5', 2], ['G5', 2], ['E5', 2], ['D5', 1], ['B4', 1], ['A4', 2], ['F#5', 2], ['E5', 2],
      ['D5', 1], ['E5', 1], ['G5', 2], ['B5', 2], ['A5', 2], ['F#5', 1], ['E5', 1], ['C#5', 2], ['D5', 4], ['F#4', 1], ['A4', 1], ['D5', 6]] },
  orchard: { name: 'Orchard Lane', eighth: 0.3, lead: 'fiddle', second: 'whistle', pluck: 'guitar',
    chords: ['G', 'C', 'G', 'D', 'Em', 'C', 'D', 'D', 'G', 'C', 'G', 'D', 'C', 'D7', 'G', 'G'],
    mel: [['D5', 2], ['G5', 2], ['A5', 1], ['B5', 1], ['C6', 2], ['B5', 1], ['A5', 1], ['G5', 2], ['B5', 3], ['A5', 1], ['G5', 2], ['A5', 4], ['F#5', 2],
      ['E5', 2], ['G5', 2], ['B5', 2], ['C6', 2], ['E6', 1], ['D6', 1], ['C6', 2], ['B5', 2], ['A5', 2], ['F#5', 2], ['A5', 4], [null, 2],
      ['D5', 2], ['G5', 1], ['A5', 1], ['B5', 2], ['E5', 2], ['G5', 2], ['C6', 2], ['D6', 3], ['B5', 1], ['G5', 2], ['F#5', 2], ['A5', 2], ['D5', 2],
      ['E5', 1], ['G5', 1], ['C6', 2], ['B5', 2], ['A5', 2], ['F#5', 1], ['E5', 1], ['D5', 2], ['G5', 4], ['B4', 1], ['D5', 1], ['G5', 6]] },
};

// ---------- instruments (work on any BaseAudioContext, live or offline) ----------
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
// fiddle: two slightly detuned saws through a soft lowpass, slow bow attack, vibrato
export function fiddle(ctx, out, t, f, dur, v = 0.06) {
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain(), os = [];
  lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.5; pk.type = 'peaking'; pk.frequency.value = 2800; pk.gain.value = -6;
  lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.4, dur)); lfo.connect(lg);
  for (const d of [-4, 4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; lg.connect(o.frequency); o.connect(lp); os.push(o); }
  lp.connect(pk).connect(g).connect(out); env(g, t, Math.min(0.14, dur * 0.4), v, dur, 0.22, v * 0.9);
  const end = t + dur + 0.3; for (const s of [...os, lfo]) { s.start(t); s.stop(end); }
}
function bass(ctx, out, t, f, dur, v = 0.12) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(v * 0.25, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.35);
}
function drum(ctx, out, t, v = 0.18) {   // soft frame drum (bodhrán-like thump, felt beater)
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
}
function reverb(ctx, sec = 2.2) {
  const c = ctx.createConvolver(), n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
  c.buffer = b; return c;
}
const play = (ctx, out, inst, t, f, dur, v) => inst === 'whistle' ? whistle(ctx, out, t, f, dur, v) : fiddle(ctx, out, t, f, dur, v);

// ---------- render one tune into a seamless loop buffer: pass 1 = lead, pass 2 = the other voice + a light counter-line ----------
export async function renderTune(id, sampleRate = 22050) {
  const T = TUNES[id], e = T.eighth, bar = e * 6, bars = T.chords.length, loop = bar * bars * 2, tail = 2.6;
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OC(2, Math.ceil((loop + tail) * sampleRate), sampleRate);
  const dry = ctx.createGain(), wet = ctx.createGain(), rv = reverb(ctx), bus = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  dry.gain.value = 0.85; wet.gain.value = 0.32; bus.connect(dry); bus.connect(rv); rv.connect(wet); dry.connect(comp); wet.connect(comp); comp.connect(ctx.destination);
  const pan = (p) => { const s = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (s.pan) s.pan.value = p; s.connect(bus); return s; };
  const lead = pan(0.08), pl = pan(-0.25), lo = pan(0), sec2 = pan(0.3);
  for (let pass = 0; pass < 2; pass++) {
    const t0 = pass * bars * bar;
    T.chords.forEach((c, b) => { const tb = t0 + b * bar, ch = CH[c];
      bass(ctx, lo, tb, N(ch[0]) / (ch[0].endsWith('3') ? 2 : 1), bar * 0.9, 0.11);
      const arp = [1, 2, 3, 4, 3, 2]; arp.forEach((k, j) => pluck(ctx, pl, tb + j * e + (j ? (Math.random() - 0.5) * 0.012 : 0), N(ch[k]), j ? 0.11 : 0.15, T.pluck));
      if (b % 2 === 0) drum(ctx, lo, tb, 0.09); if (pass === 1) drum(ctx, lo, tb + 3 * e, 0.045);
      if (pass === 1 && b % 4 === 0) fiddle(ctx, sec2, tb, N(ch[2]), bar * 3.6, 0.025);   // a long held bowed note under pass 2
    });
    let t = t0; const inst = pass ? T.second : T.lead;
    for (const [n, len] of T.mel) { const d = len * e;
      if (n) { const f = N(n) / (pass && inst === 'fiddle' ? 2 : 1); play(ctx, lead, inst, t, f, d * 0.92, inst === 'whistle' ? 0.13 : 0.07); }
      t += d; }
  }
  const buf = await ctx.startRendering();
  // fold the reverb tail back onto the start so the loop is seamless, then normalise gently
  const L = Math.floor(loop * sampleRate), out = new (window.AudioBuffer)({ length: L, numberOfChannels: 2, sampleRate });
  let peak = 0; for (let ch = 0; ch < 2; ch++) { const s = buf.getChannelData(ch), d = out.getChannelData(ch); d.set(s.subarray(0, L)); for (let i = L; i < s.length && i - L < L; i++) d[i - L] += s[i]; for (let i = 0; i < L; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const k = peak > 0 ? 0.8 / peak : 1; for (let ch = 0; ch < 2; ch++) { const d = out.getChannelData(ch); for (let i = 0; i < L; i++) d[i] *= k; }
  return out;
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
export function createAudio({ prefs }) {
  let ctx = null, music = null, sfx = null, scene = null, cur = null, unlocked = false; const bufs = {}, rendering = {};
  const DEF = { music: 0.6, sfx: 0.8, musicMute: false, sfxMute: false }, P = () => prefs() || DEF;
  const mv = () => (P().musicMute ? 0 : P().music) * 0.55, sv = () => (P().sfxMute ? 0 : P().sfx) * 0.9;
  function apply() { if (!ctx) return; const t = ctx.currentTime; music.gain.setTargetAtTime(mv(), t, 0.08); sfx.gain.setTargetAtTime(sv(), t, 0.03); }
  async function ensure(id) { if (bufs[id]) return bufs[id]; if (!rendering[id]) rendering[id] = renderTune(id).then((b) => (bufs[id] = b)).catch(() => null); return rendering[id]; }
  async function start(id) {
    if (!ctx || !id) return; const b = await ensure(id); if (!b || scene !== id || (cur && cur.id === id)) return;
    const t = ctx.currentTime, g = ctx.createGain(), s = ctx.createBufferSource(); s.buffer = b; s.loop = true; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 2.5);
    s.connect(g).connect(music); s.start(t + 0.05);
    if (cur) { const old = cur; old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value || 1, t); old.g.gain.exponentialRampToValueAtTime(0.0001, t + 2); old.s.stop(t + 2.1); }
    cur = { id, s, g };
    for (const k of Object.keys(TUNES)) if (k !== id) setTimeout(() => ensure(k), 4000);   // pre-render the other place's tune quietly
  }
  function unlock() {
    if (unlocked) { if (ctx?.state === 'suspended' && !document.hidden) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (_) { ctx = new AC(); }
    unlocked = true; music = ctx.createGain(); sfx = ctx.createGain(); music.gain.value = 0; sfx.gain.value = sv(); music.connect(ctx.destination); sfx.connect(ctx.destination);
    ctx.resume?.(); apply(); start(scene);
  }
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend?.(); else if (unlocked) ctx.resume?.(); });
  return {
    unlock, apply,
    setScene(id) { scene = TUNES[id] ? id : 'home'; if (ctx) start(scene); },
    play(name) { if (!ctx || !SFX[name] || sv() <= 0 || ctx.state !== 'running') return false; try { SFX[name](ctx, sfx, ctx.currentTime + 0.01); } catch (_) {} return true; },
    get state() { return { unlocked, ctx: ctx?.state || 'none', scene, playing: cur?.id || null, music: +mv().toFixed(3), sfx: +sv().toFixed(3), musicGain: music ? +music.gain.value.toFixed(3) : null, rendered: Object.keys(bufs) }; },
  };
}
