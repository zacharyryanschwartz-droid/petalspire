// games-tracker.js — tiny, dependency-free player tracking for Appwrite (TablesDB REST).
// Usage: import { initTracker } from './games-tracker.js';
//        initTracker({ endpoint, projectId, gameId, platform, appVersion });
// Sends no personal data: only gameId, an anonymous Appwrite user id, platform, appVersion, timestamps, session count.
// Never throws, never logs. All network errors are swallowed and retried with backoff.

const DB = 'games', TABLE = 'players', BEAT_MS = 60000, MAX_BACKOFF = 15 * 60000;
let started = false;

export function initTracker(opts) {
  try {
    if (started || !opts || typeof fetch !== 'function') return;
    started = true;
    run(opts);
  } catch (_) {}
}

function run({ endpoint, projectId, gameId, platform = 'web', appVersion = '' }) {
  const ep = String(endpoint).replace(/\/+$/, '');
  const game = String(gameId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'game';
  const KEY = 'gt_' + projectId;
  const ls = (() => { try { return window.localStorage; } catch (_) { return null; } })();
  let st = {}; try { st = JSON.parse((ls && ls.getItem(KEY)) || '{}') || {}; } catch (_) {}
  const save = () => { try { ls && ls.setItem(KEY, JSON.stringify(st)); } catch (_) {} };
  let skew = 0, timer = 0, fails = 0, ready = false, busy = false, lastBeat = 0;

  const now = () => new Date(Date.now() + skew).toISOString();
  const rowPath = () => `/tablesdb/${DB}/tables/${TABLE}/rows/${game}_${st.uid}`;

  async function req(method, path, body) {
    const h = { 'Content-Type': 'application/json', 'X-Appwrite-Project': projectId };
    if (st.fb) h['X-Fallback-Cookies'] = st.fb; // works when Safari/iOS blocks 3rd-party cookies
    const r = await fetch(ep + path, { method, headers: h, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
    try { const d = Date.parse(r.headers.get('Date')); if (d) skew = d - Date.now(); } catch (_) {}
    const fb = r.headers.get('X-Fallback-Cookies'); if (fb) { st.fb = fb; save(); }
    let j = null; try { j = await r.json(); } catch (_) {}
    return { s: r.status, j };
  }

  async function session() {
    const r = await req('POST', '/account/sessions/anonymous');
    if (r.s !== 201 || !r.j || !r.j.userId) throw 0;
    st.uid = r.j.userId; save();
  }

  // First call per launch: sign-up (create row) or bump sessions on existing row.
  async function launch() {
    if (!st.uid) await session();
    let r = await req('GET', rowPath());
    if (r.s === 401) { st = {}; await session(); r = await req('GET', rowPath()); }
    const t = now();
    if (r.s === 404) {
      const u = `"user:${st.uid}"`;
      r = await req('POST', `/tablesdb/${DB}/tables/${TABLE}/rows`, {
        rowId: `${game}_${st.uid}`,
        data: { gameId: game, playerId: st.uid, platform, appVersion, createdAt: t, lastSeen: t, sessions: 1 },
        permissions: [`read(${u})`, `update(${u})`],
      });
      if (r.s === 409) r = await req('GET', rowPath()); else if (r.s === 201) return;
    }
    if (r.s !== 200 || !r.j) throw 0;
    r = await req('PATCH', rowPath(), { data: { lastSeen: t, sessions: (r.j.sessions | 0) + 1, platform, appVersion } });
    if (r.s !== 200) throw 0;
  }

  async function beat() {
    const r = await req('PATCH', rowPath(), { data: { lastSeen: now() } });
    if (r.s === 401 || r.s === 404) { ready = false; } // session lost: redo launch next tick
    if (r.s !== 200) throw 0;
  }

  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

  function schedule(ms) { clearTimeout(timer); if (!hidden()) timer = setTimeout(tick, ms); }

  async function tick() {
    if (busy || hidden()) return;
    busy = true;
    try {
      if (!ready) { await launch(); ready = true; } else await beat();
      lastBeat = Date.now(); fails = 0; busy = false; schedule(BEAT_MS);
    } catch (_) {
      busy = false; fails++;
      const back = Math.min(MAX_BACKOFF, 5000 * 2 ** Math.min(fails, 8));
      schedule(back * (0.75 + Math.random() * 0.5));
    }
  }

  try {
    document.addEventListener('visibilitychange', () => {
      try {
        if (hidden()) clearTimeout(timer);
        else if (Date.now() - lastBeat > 15000) { clearTimeout(timer); tick(); } // one beat on return
        else schedule(BEAT_MS - (Date.now() - lastBeat));
      } catch (_) {}
    });
  } catch (_) {}
  tick();
}
