// One-time distribution certificate mint. Never prints the private key or the p12 password.
// Revokes the older distribution certificate once, then writes the new p12 and profile
// into ASC_SIGN_DIR for the workflow to store as Actions secrets.
import { createSign, randomBytes } from 'crypto';
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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
  const key = normalizePem(process.env.ASC_KEY_P8 || '');
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
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status || res.status} ${e.title || ''} ${e.detail || ''}`).join('; ') || res.status;
    throw new Error(`App Store Connect ${method} ${path} failed: ${detail}`);
  }
  return json;
}

function openssl(args) {
  return execFileSync('openssl', args, { encoding: 'utf8' });
}

const dir = process.env.ASC_SIGN_DIR;
if (!dir) throw new Error('ASC_SIGN_DIR is not set');
mkdirSync(dir, { recursive: true, mode: 0o700 });

const existing = await api('/v1/certificates?limit=200&fields[certificates]=certificateType,displayName,expirationDate');
const dist = (existing.data || []).filter((c) => /DISTRIBUTION/.test(c.attributes?.certificateType || ''));
dist.sort((a, b) => String(a.attributes?.expirationDate || '').localeCompare(String(b.attributes?.expirationDate || '')));
console.log(`distribution certificates: ${dist.length}`);
for (const c of dist) console.log(`cert ${c.id} expires ${c.attributes?.expirationDate || '?'}`);

const keyPath = join(dir, 'dist.key');
const csrPath = join(dir, 'dist.csr');
openssl(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', csrPath, '-subj', '/CN=Petalspire Distribution/O=Schwarze Spiele/C=US']);
const csr = readFileSync(csrPath, 'utf8');

if (dist.length >= 2) {
  const old = dist[0];
  await api(`/v1/certificates/${old.id}`, { method: 'DELETE' });
  console.log(`revoked older distribution certificate ${old.id} expires ${old.attributes?.expirationDate || '?'}`);
  writeFileSync(join(dir, 'revoked.txt'), `${old.id} ${old.attributes?.expirationDate || ''}\n`, { mode: 0o600 });
} else {
  console.log('fewer than two distribution certificates, so none was revoked');
  writeFileSync(join(dir, 'revoked.txt'), 'none\n', { mode: 0o600 });
}

let created = null;
let lastErr = null;
for (const certificateType of ['DISTRIBUTION', 'IOS_DISTRIBUTION']) {
  try {
    created = await api('/v1/certificates', {
      method: 'POST',
      body: { data: { type: 'certificates', attributes: { certificateType, csrContent: csr } } },
    });
    break;
  } catch (err) {
    lastErr = err;
  }
}
if (!created?.data?.id) throw new Error(lastErr?.message || 'Could not create the distribution certificate');
const createdId = created.data.id;
const expires = created.data.attributes?.expirationDate || '';
console.log(`created distribution certificate ${createdId} expires ${expires}`);

const certB64 = created.data.attributes?.certificateContent;
if (!certB64) throw new Error('Certificate response did not include certificate content');
const cerPath = join(dir, 'dist.cer');
const pemPath = join(dir, 'dist.pem');
writeFileSync(cerPath, Buffer.from(certB64, 'base64'));
try { openssl(['x509', '-inform', 'DER', '-in', cerPath, '-out', pemPath]); }
catch { openssl(['x509', '-inform', 'PEM', '-in', cerPath, '-out', pemPath]); }
const pass = randomBytes(24).toString('hex');
const p12 = join(dir, 'dist.p12');
const p12Args = ['pkcs12', '-export', '-inkey', keyPath, '-in', pemPath, '-out', p12, '-passout', 'env:P12_PASS', '-keypbe', 'PBE-SHA1-3DES', '-certpbe', 'PBE-SHA1-3DES', '-macalg', 'sha1'];
try { execFileSync('openssl', p12Args, { env: { ...process.env, P12_PASS: pass } }); }
catch { execFileSync('openssl', ['pkcs12', '-export', '-legacy', '-inkey', keyPath, '-in', pemPath, '-out', p12, '-passout', 'env:P12_PASS'], { env: { ...process.env, P12_PASS: pass } }); }
writeFileSync(join(dir, 'p12.pass'), pass, { mode: 0o600 });
writeFileSync(join(dir, 'p12.b64'), readFileSync(p12).toString('base64'), { mode: 0o600 });

const bundles = await api(`/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=5`);
const bundle = (bundles.data || []).find((d) => d.attributes?.identifier === BUNDLE_ID) || bundles.data?.[0];
if (!bundle?.id) throw new Error('Petalspire bundle id was not found');
const profileName = `Petalspire App Store saved`;
const profile = await api('/v1/profiles', {
  method: 'POST',
  body: {
    data: {
      type: 'profiles',
      attributes: { name: profileName, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundle.id } },
        certificates: { data: [{ type: 'certificates', id: createdId }] },
      },
    },
  },
});
const profB64 = profile.data?.attributes?.profileContent;
if (!profB64) throw new Error('Profile response did not include profile content');
writeFileSync(join(dir, 'profile.b64'), profB64.replace(/\s+/g, ''), { mode: 0o600 });
console.log(`profile ${profile.data?.id || ''} stored for ${profileName}`);
console.log('mint files ready');
