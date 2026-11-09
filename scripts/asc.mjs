// App Store Connect helper. Reads the API key from the environment, never from argv, and never prints it.
import { createSign } from 'crypto';
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const APP_ID = '6832561595';
const BUNDLE_ID = 'com.schwarzespiele.petalspire';

function normalizePem(raw) {
  let s = String(raw || '').replace(/^\uFEFF/, '').trim();
  if (!s.includes('BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(s)) {
    try { s = Buffer.from(s.replace(/\s+/g, ''), 'base64').toString('utf8').trim(); } catch { /* keep raw */ }
  }
  const m = s.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+?)-----END \1-----/);
  if (!m) return s.endsWith('\n') ? s : s + '\n';
  const body = m[2].replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g)?.join('\n') || body;
  return `-----BEGIN ${m[1]}-----\n${lines}\n-----END ${m[1]}-----\n`;
}

function token() {
  const key = readFileSync(process.env.ASC_KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (v) => Buffer.from(v).toString('base64url');
  const header = b64(JSON.stringify({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' }));
  const payload = b64(JSON.stringify({
    iss: process.env.ASC_ISSUER_ID,
    iat: now,
    exp: now + 19 * 60,
    aud: 'appstoreconnect-v1',
  }));
  const data = `${header}.${payload}`;
  const sign = createSign('SHA256');
  sign.update(data);
  return `${data}.${b64(sign.sign({ key, dsaEncoding: 'ieee-p1363' }))}`;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status || res.status} ${e.title || ''} ${e.detail || ''}`).join('; ') || res.status;
    throw new Error(`App Store Connect ${method} ${path} failed: ${detail}`);
  }
  return json;
}

async function allBuilds() {
  let url = `/v1/builds?filter[app]=${APP_ID}&limit=200&fields[builds]=version,processingState,uploadedDate`;
  const rows = [];
  while (url) {
    const json = await api(url.replace('https://api.appstoreconnect.apple.com', ''));
    rows.push(...(json.data || []));
    url = json.links?.next || '';
  }
  return rows;
}

async function cmdTeam() {
  const json = await api(`/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=5&fields[bundleIds]=identifier,name,seedId,platform`);
  const row = (json.data || []).find((d) => d.attributes?.identifier === BUNDLE_ID) || json.data?.[0];
  const seed = row?.attributes?.seedId || '';
  if (!/^[A-Z0-9]{10}$/.test(seed)) throw new Error('Could not read the Team ID (seedId) for the Petalspire bundle id');
  process.stdout.write(seed);
}

async function cmdNextBuild() {
  const rows = await allBuilds();
  let max = 0;
  for (const row of rows) {
    const n = parseInt(row.attributes?.version, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  process.stdout.write(String(max + 1));
}

async function cmdWait() {
  const build = process.argv[3];
  if (!/^\d+$/.test(build || '')) throw new Error('wait expects a numeric build');
  const deadline = Date.now() + 40 * 60 * 1000;
  while (Date.now() < deadline) {
    const rows = await allBuilds();
    const row = rows.find((r) => String(r.attributes?.version) === build);
    const state = row?.attributes?.processingState || 'MISSING';
    console.log(`build ${build} processingState=${state}`);
    if (state === 'VALID') return;
    if (state === 'FAILED' || state === 'INVALID') throw new Error(`Build ${build} ${state}`);
    await new Promise((r) => setTimeout(r, 20000));
  }
  throw new Error(`Build ${build} was not processing after 40 minutes`);
}

function openssl(args, opts = {}) {
  return execFileSync('openssl', args, { encoding: 'utf8', ...opts });
}

function decodeB64(raw, name) {
  const s = String(raw || '').replace(/\s+/g, '');
  if (!s) throw new Error(`${name} is missing. This workflow does not create or revoke certificates. Add the saved signing secrets and run again.`);
  const buf = Buffer.from(s, 'base64');
  if (!buf.length) throw new Error(`${name} is empty. This workflow does not create or revoke certificates.`);
  return buf;
}

async function cmdMaterialize() {
  const dir = process.env.ASC_SIGN_DIR;
  if (!dir) throw new Error('ASC_SIGN_DIR is not set');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const pass = process.env.DIST_CERT_PASSWORD || '';
  if (!pass) throw new Error('DIST_CERT_PASSWORD is missing. This workflow does not create or revoke certificates. Import the saved distribution certificate instead.');
  const p12 = join(dir, 'dist.p12');
  const pemPath = join(dir, 'dist.pem');
  writeFileSync(p12, decodeB64(process.env.DIST_CERT_P12, 'DIST_CERT_P12'), { mode: 0o600 });
  writeFileSync(join(dir, 'profile.mobileprovision'), decodeB64(process.env.DIST_PROFILE, 'DIST_PROFILE'));
  writeFileSync(join(dir, 'p12.pass'), pass, { mode: 0o600 });
  try {
    openssl(['pkcs12', '-in', p12, '-nokeys', '-passin', 'env:DIST_CERT_PASSWORD', '-out', pemPath]);
  } catch {
    throw new Error('The saved distribution certificate could not be read. Check DIST_CERT_P12 and DIST_CERT_PASSWORD. This workflow does not create or revoke certificates.');
  }
  let end = '';
  try { end = openssl(['x509', '-enddate', '-noout', '-in', pemPath]).trim(); } catch { end = ''; }
  let current = true;
  try { openssl(['x509', '-checkend', '86400', '-noout', '-in', pemPath]); }
  catch { current = false; }
  if (!current) throw new Error(`The saved distribution certificate is expired or expires within a day (${end || 'no end date'}). This workflow does not create or revoke certificates.`);
  console.log(`using saved distribution certificate ${end || 'end date unread'}`);
  console.log('signing materials ready');
}

function cmdWriteKey() {
  const pem = normalizePem(process.env.ASC_KEY_P8 || '');
  if (!pem.includes('BEGIN') || !pem.includes('PRIVATE KEY')) throw new Error('ASC_KEY_P8 is missing or is not a private key');
  const path = process.env.ASC_KEY_PATH;
  if (!path) throw new Error('ASC_KEY_PATH is not set');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, pem, { mode: 0o600 });
  console.log('API key file ready');
}

async function cmdAssign() {
  const build = process.argv[3];
  if (!/^\d+$/.test(build || '')) throw new Error('assign expects a numeric build');
  const rows = await allBuilds();
  const row = rows.find((r) => String(r.attributes?.version) === build);
  if (!row?.id) throw new Error(`Build ${build} was not found, so it could not be added to the Internal group`);
  const groups = await api(`/v1/betaGroups?filter[app]=${APP_ID}&limit=50&fields[betaGroups]=name,isInternalGroup,hasAccessToAllBuilds`);
  const internal = (groups.data || []).filter((g) => g.attributes?.isInternalGroup);
  const group = internal.find((g) => /internal/i.test(g.attributes?.name || '')) || internal[0];
  if (!group) throw new Error('No Internal TestFlight group was found');
  if (group.attributes?.hasAccessToAllBuilds) {
    console.log(`Internal group ${group.attributes?.name || 'Internal'} gets every build automatically, including ${build}`);
    return;
  }
  try {
    await api(`/v1/betaGroups/${group.id}/relationships/builds`, {
      method: 'POST',
      body: { data: [{ type: 'builds', id: row.id }] },
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (!/already|409|exists/i.test(msg)) throw err;
  }
  console.log(`Internal group ${group.attributes?.name || 'Internal'} has build ${build}`);
}

const cmd = process.argv[2];
const run = { 'write-key': cmdWriteKey, team: cmdTeam, 'next-build': cmdNextBuild, wait: cmdWait, 'materialize-signing': cmdMaterialize, assign: cmdAssign }[cmd];
if (!run) {
  console.error('usage: asc.mjs write-key|team|next-build|wait <build>');
  process.exit(2);
}
Promise.resolve(run()).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
