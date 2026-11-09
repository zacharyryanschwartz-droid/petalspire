// Native bridge for the Capacitor iOS app.
// The web build never sets window.__PETALSPIRE_NATIVE__, so isNative() stays false there.
// One flag: simulated jewel purchases stay off, and AdMob (js/admob.js) serves the ad spots.

const SAVE_PREFIX = 'petalspire.';
const MIRROR_KEY = 'petalspire.native.mirror';
const LAUNCH_KEY = 'petalspire.native.launches';

export function isNative() {
  return globalThis.__PETALSPIRE_NATIVE__ === true;
}

export function saveTimestamp(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 3) return null;
    return typeof o.savedAt === 'number' ? o.savedAt : 0;
  } catch {
    return null;
  }
}

/** 'mirror' when Preferences holds a readable v3 save and local is missing, unreadable, or older. */
export function chooseSave(localRaw, mirrorRaw) {
  const localTs = saveTimestamp(localRaw);
  const mirrorTs = saveTimestamp(mirrorRaw);
  if (mirrorTs == null) return 'local';
  if (localTs == null) return 'mirror';
  return mirrorTs > localTs ? 'mirror' : 'local';
}

function preferences() {
  const cap = globalThis.Capacitor;
  if (!cap || typeof cap.registerPlugin !== 'function') return null;
  try { return cap.registerPlugin('Preferences'); } catch { return null; }
}

function statusBar() {
  const cap = globalThis.Capacitor;
  if (!cap || typeof cap.registerPlugin !== 'function') return null;
  try { return cap.registerPlugin('StatusBar'); } catch { return null; }
}

export function launchCount() {
  try { return Math.max(0, parseInt(localStorage.getItem(LAUNCH_KEY) || '0', 10) || 0); } catch { return 0; }
}

function bumpLaunches() {
  try { localStorage.setItem(LAUNCH_KEY, String(launchCount() + 1)); } catch { /* private mode */ }
}

export async function restoreNativeSave() {
  if (!isNative()) return false;
  const prefs = preferences();
  if (!prefs?.get) return false;
  let blob = null;
  try {
    const res = await prefs.get({ key: MIRROR_KEY });
    blob = res?.value ? JSON.parse(res.value) : null;
  } catch { return false; }
  if (!blob || typeof blob !== 'object') return false;
  const mirrorRaw = typeof blob['petalspire.v03'] === 'string' ? blob['petalspire.v03'] : null;
  let localRaw = null;
  try { localRaw = localStorage.getItem('petalspire.v03'); } catch { localRaw = null; }
  if (chooseSave(localRaw, mirrorRaw) !== 'mirror') return false;
  try {
    for (const [k, v] of Object.entries(blob)) {
      if (k.startsWith(SAVE_PREFIX) && typeof v === 'string') localStorage.setItem(k, v);
    }
    return true;
  } catch { return false; }
}

let mirrorTimer = 0;
let prefsRef = null;

function collectSaves() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SAVE_PREFIX) && k !== MIRROR_KEY) {
        const v = localStorage.getItem(k);
        if (typeof v === 'string') data[k] = v;
      }
    }
  } catch { /* storage unavailable */ }
  return data;
}

export async function flushNativeSave() {
  if (!isNative() || !prefsRef?.set) return false;
  try {
    await prefsRef.set({ key: MIRROR_KEY, value: JSON.stringify(collectSaves()) });
    return true;
  } catch { return false; }
}

function scheduleMirror() {
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => { flushNativeSave(); }, 300);
}

export function installSaveMirror() {
  if (!isNative() || globalThis.__petalspireMirror) return;
  prefsRef = preferences();
  if (!prefsRef) return;
  globalThis.__petalspireMirror = true;
  const origSet = localStorage.setItem.bind(localStorage);
  const origRemove = localStorage.removeItem.bind(localStorage);
  localStorage.setItem = (key, value) => {
    origSet(key, value);
    if (typeof key === 'string' && key.startsWith(SAVE_PREFIX)) scheduleMirror();
  };
  localStorage.removeItem = (key) => {
    origRemove(key);
    if (typeof key === 'string' && key.startsWith(SAVE_PREFIX)) scheduleMirror();
  };
}

export function watchSaveLifecycle() {
  if (!isNative()) return;
  const flush = () => { clearTimeout(mirrorTimer); flushNativeSave(); };
  window.addEventListener('pagehide', flush);
  window.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  setTimeout(flush, 1200);
}

export async function openExternal(url) {
  if (!url) return;
  if (isNative()) {
    try {
      const Browser = globalThis.Capacitor?.registerPlugin?.('Browser');
      if (Browser?.open) { await Browser.open({ url }); return; }
    } catch { /* fall through */ }
  }
  window.open(url, '_blank', 'noopener');
}

async function hideStatusBar() {
  const bar = statusBar();
  try { await bar?.setOverlaysWebView?.({ overlay: true }); } catch { /* plist also hides it */ }
  try { await bar?.hide?.(); } catch { /* optional */ }
}

export async function prepareNativeApp() {
  if (!isNative()) return;
  document.documentElement.classList.add('native-app');
  await restoreNativeSave();
  installSaveMirror();
  bumpLaunches();
  await hideStatusBar();
}
