// referral.js — v0.8 friend referrals over Appwrite TablesDB (public endpoint + the player's own ANONYMOUS session only).
// No server credentials are used or needed here. Trust comes from Appwrite row permissions and server timestamps:
//  · ref_codes  row id = the code, { uid, game }, perms: read(users) + update(user:<uid>) — the update permission proves the
//               row was written by <uid> itself (a client can only grant permissions for its own roles).
//  · ref_links  row id = the FRIEND's user id (so one link per friend, ever), { inviter, friend, code, game, level, qualified },
//               perms: read(users) + update(user:<friend>). Same proof: only the friend can have created it.
// Qualification is judged from the server's $createdAt / $updatedAt (join → Lv3 report between 1 and 14 days).
// Never throws: every call resolves to { ok, ... }.
const DB = 'games', CODES = 'ref_codes', LINKS = 'ref_links';
const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const REF_RULES = { minAgeMs: 24 * 3600e3, maxAgeMs: 14 * 24 * 3600e3, qualifyLv: 3 };
export const newCode = (rnd = Math.random) => 'PETAL-' + Array.from({ length: 6 }, () => ALPHA[Math.floor(rnd() * ALPHA.length)]).join('');
export const cleanCode = (c) => { const m = /PETAL-?([2-9A-HJKMNP-Z]{6})/i.exec(String(c || '').toUpperCase().replace(/\s+/g, '')); return m ? 'PETAL-' + m[1] : null; };

export function createReferral({ endpoint, projectId, game }) {
  const ep = String(endpoint).replace(/\/+$/, ''), KEY = 'gt_' + projectId;
  const ls = (() => { try { return window.localStorage; } catch (_) { return null; } })();
  const load = () => { try { return JSON.parse((ls && ls.getItem(KEY)) || '{}') || {}; } catch (_) { return {}; } };
  const store = (st) => { try { const cur = load(); ls && ls.setItem(KEY, JSON.stringify({ ...cur, ...st })); } catch (_) {} };
  let skew = 0;
  async function req(method, path, body) {
    const st = load(), h = { 'Content-Type': 'application/json', 'X-Appwrite-Project': projectId };
    if (st.fb) h['X-Fallback-Cookies'] = st.fb;
    const r = await fetch(ep + path, { method, headers: h, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
    try { const d = Date.parse(r.headers.get('Date')); if (d) skew = d - Date.now(); } catch (_) {}
    const fb = r.headers.get('X-Fallback-Cookies'); if (fb) store({ fb });
    let j = null; try { j = await r.json(); } catch (_) {}
    return { s: r.status, j };
  }
  async function me() {
    let st = load();
    if (st.uid) { const r = await req('GET', '/account'); if (r.s === 200 && r.j?.$id === st.uid) return st.uid; }
    const r = await req('POST', '/account/sessions/anonymous'); if (r.s !== 201 || !r.j?.userId) throw new Error('session');
    store({ uid: r.j.userId }); return r.j.userId;
  }
  const rows = (t) => `/tablesdb/${DB}/tables/${t}/rows`;
  const q = (method, attribute, values) => 'queries[]=' + encodeURIComponent(JSON.stringify({ method, attribute, values }));
  const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { return { ok: false, err: String(e?.message || e) }; } };
  const ownsCode = (row) => row && row.uid && (row.$permissions || []).includes(`update("user:${row.uid}")`);
  const ownsLink = (row) => row && row.friend === row.$id && (row.$permissions || []).includes(`update("user:${row.$id}")`);
  return {
    now: () => Date.now() + skew,
    // my code: reuse the one on the server for this player, else create one
    myCode: wrap(async (want) => {
      const uid = await me();
      if (want) { const r = await req('GET', `${rows(CODES)}/${want}`); if (r.s === 200 && r.j.uid === uid) return { ok: true, code: want, uid }; }
      const f = await req('GET', `${rows(CODES)}?${q('equal', 'uid', [uid])}&queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [5] }))}`);
      const mine = (f.j?.rows || []).find((x) => x.uid === uid && x.game === game); if (mine) return { ok: true, code: mine.$id, uid };
      for (let i = 0; i < 5; i++) {
        const code = newCode(), r = await req('POST', rows(CODES), { rowId: code, data: { uid, game }, permissions: ['read("users")', `update("user:${uid}")`] });
        if (r.s === 201) return { ok: true, code, uid };
        if (r.s !== 409) return { ok: false, err: 'create ' + r.s };
      }
      return { ok: false, err: 'busy' };
    }),
    // friend side: join with a code (only on a brand-new save — checked by the game)
    join: wrap(async (code) => {
      code = cleanCode(code); if (!code) return { ok: false, err: 'bad-code' };
      const uid = await me(), c = await req('GET', `${rows(CODES)}/${code}`);
      if (c.s !== 200 || c.j?.game !== game || !ownsCode(c.j)) return { ok: false, err: 'unknown-code' };
      if (c.j.uid === uid) return { ok: false, err: 'self' };
      const r = await req('POST', rows(LINKS), { rowId: uid, data: { inviter: c.j.uid, friend: uid, code, game, level: 1, qualified: false }, permissions: ['read("users")', `update("user:${uid}")`] });
      if (r.s === 201) return { ok: true, code, joinedAt: r.j.$createdAt };
      if (r.s === 409) return { ok: false, err: 'already' };
      return { ok: false, err: 'join ' + r.s };
    }),
    // friend side: report reaching the qualifying level (only accepted 1–14 days after joining, by server time)
    report: wrap(async (level) => {
      const uid = await me(), r = await req('GET', `${rows(LINKS)}/${uid}`); if (r.s !== 200) return { ok: false, err: 'no-link' };
      if (r.j.qualified) return { ok: true, qualified: true, already: true };
      const age = Date.now() + skew - Date.parse(r.j.$createdAt);
      if (level < REF_RULES.qualifyLv) return { ok: true, qualified: false, wait: 'level' };
      if (age < REF_RULES.minAgeMs) return { ok: true, qualified: false, wait: 'age', readyIn: REF_RULES.minAgeMs - age };
      if (age > REF_RULES.maxAgeMs) return { ok: true, qualified: false, expired: true };
      const u = await req('PATCH', `${rows(LINKS)}/${uid}`, { data: { level: Math.min(100000, level | 0), qualified: true } });
      return u.s === 200 ? { ok: true, qualified: true } : { ok: false, err: 'report ' + u.s };
    }),
    // inviter side: my friends (only links the friend wrote itself; qualified = reported Lv3 1–14 days after joining)
    friends: wrap(async () => {
      const uid = await me(), r = await req('GET', `${rows(LINKS)}?${q('equal', 'inviter', [uid])}&queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] }))}`);
      if (r.s !== 200) return { ok: false, err: 'list ' + r.s };
      const list = (r.j.rows || []).filter((x) => ownsLink(x) && x.inviter === uid && x.game === game).map((x) => {
        const age = Date.parse(x.$updatedAt) - Date.parse(x.$createdAt), ok = !!x.qualified && x.level >= REF_RULES.qualifyLv && age >= REF_RULES.minAgeMs && age <= REF_RULES.maxAgeMs;
        return { id: x.$id, joinedAt: x.$createdAt, level: x.level, qualified: ok, qualifiedAt: ok ? x.$updatedAt : null };
      });
      return { ok: true, list };
    }),
  };
}
