// Copy the game into www/ for Capacitor. GitHub Pages keeps serving the repo root.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const name of ['style.css', 'js', 'vendor', 'assets', 'audio']) {
  cpSync(join(root, name), join(www, name), { recursive: true });
}

const nativeCss = `html.native-app .jewel-grid,html.native-app .noads-card,html.native-app .shop-offers,html.native-app .starter-modal,html.native-app .test-note,html.native-app #ad-break{display:none!important}`;
let html = readFileSync(join(root, 'index.html'), 'utf8');
const boot = `<style>${nativeCss}</style>\n<script>window.__PETALSPIRE_NATIVE__=true;document.documentElement.classList.add('native-app');</script>\n<script type="module" src="js/native-boot.js"></script>`;
if (!html.includes('src="js/main.js"')) throw new Error('index.html no longer loads js/main.js');
html = html.replace('<script type="module" src="js/main.js"></script>', boot);
writeFileSync(join(www, 'index.html'), html);
if (!html.includes('__PETALSPIRE_NATIVE__')) throw new Error('native flag was not injected');
console.log('bundled www/');
