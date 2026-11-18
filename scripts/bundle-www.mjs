// Copy the game into www/ for Capacitor. GitHub Pages keeps serving the repo root.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const name of ['style.css', 'js', 'vendor', 'assets', 'audio']) {
  cpSync(join(root, name), join(www, name), { recursive: true });
}

// Capacitor's native bridge (injected by iOS) has no registerPlugin; @capacitor/core adds it. Without this file every
// plugin lookup (PetalspireStore, AdMob, Preferences, StatusBar, Browser) returns nothing in the app.
const coreSrc = join(root, 'node_modules/@capacitor/core/dist/index.js');
if (!existsSync(coreSrc)) throw new Error('@capacitor/core is not installed (npm ci)');
cpSync(coreSrc, join(www, 'vendor/capacitor-core.js'));

// Only prototype-only bits are hidden in the app. The Jewel Shop packs, No More Ads, bundles and the Starter popup are
// real StoreKit products now (js/store.js shows them only once the App Store returns prices), so they must NOT be hidden here.
const nativeCss = `html.native-app .test-note,html.native-app #ad-break{display:none!important}`;
for (const sel of ['.jewel-grid', '.noads-card', '.shop-offers', '.starter-modal']) {
  if (nativeCss.includes(sel)) throw new Error(`native CSS must not hide ${sel} (real in-app purchases)`);
}
let html = readFileSync(join(root, 'index.html'), 'utf8');
const boot = `<style>${nativeCss}</style>\n<script>window.__PETALSPIRE_NATIVE__=true;document.documentElement.classList.add('native-app');</script>\n<script type="module" src="js/native-boot.js"></script>`;
if (!html.includes('src="js/main.js"')) throw new Error('index.html no longer loads js/main.js');
html = html.replace('<script type="module" src="js/main.js"></script>', boot);
writeFileSync(join(www, 'index.html'), html);
if (!html.includes('__PETALSPIRE_NATIVE__')) throw new Error('native flag was not injected');
const bootJs = readFileSync(join(www, 'js/native-boot.js'), 'utf8');
if (!/^import '\.\.\/vendor\/capacitor-core\.js';/m.test(bootJs)) throw new Error('js/native-boot.js must import ../vendor/capacitor-core.js first');
if (!readFileSync(join(www, 'vendor/capacitor-core.js'), 'utf8').includes('cap.registerPlugin = registerPlugin')) throw new Error('vendor/capacitor-core.js does not define registerPlugin');
console.log('bundled www/ (with @capacitor/core)');
