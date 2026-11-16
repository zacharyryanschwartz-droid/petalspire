// Android launcher icons, adaptive icon layers, splash screens and Play listing art,
// built from the same emblem, palette and iOS splash as scripts/make-icons.mjs.
// Run `npm run icons` first if the iOS splash is missing, then `npm run icons:android`.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');
const cream = { r: 255, g: 249, b: 240, alpha: 1 };
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const emblem = join(root, 'assets/emblem.png');
const iosIcon = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png');
const iosSplash = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732.png');
if (!existsSync(iosIcon) || !existsSync(iosSplash)) throw new Error('Run npm run icons first (iOS icon/splash missing)');

function wash(w, h) {
  const s = Math.max(w, h);
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#FFF9F0"/>
    <circle cx="${w * 0.2}" cy="${h * 0.18}" r="${s * 0.42}" fill="#F7C5C5" opacity="0.45"/>
    <circle cx="${w * 0.84}" cy="${h * 0.86}" r="${s * 0.46}" fill="#B7D4B5" opacity="0.55"/>
    <circle cx="${w * 0.5}" cy="${h * 0.48}" r="${s * 0.28}" fill="#F5D07A" opacity="0.2"/>
  </svg>`);
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const round = (n) => Buffer.from(`<svg width="${n}" height="${n}"><circle cx="${n / 2}" cy="${n / 2}" r="${n / 2}" fill="#fff"/></svg>`);

for (const [d, k] of Object.entries(densities)) {
  const dir = join(res, `mipmap-${d}`);
  mkdirSync(dir, { recursive: true });
  const legacy = Math.round(48 * k);
  const layer = Math.round(108 * k);
  await sharp(iosIcon).resize(legacy, legacy).png().toFile(join(dir, 'ic_launcher.png'));
  await sharp(iosIcon).resize(legacy, legacy).composite([{ input: round(legacy), blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher_round.png'));
  // Adaptive layers: the emblem sits inside the 66dp safe zone of the 108dp canvas.
  const mark = await sharp(emblem).resize(Math.round(layer * 0.6), Math.round(layer * 0.6), { fit: 'contain', background: clear }).png().toBuffer();
  await sharp({ create: { width: layer, height: layer, channels: 4, background: clear } }).composite([{ input: mark, gravity: 'centre' }]).png().toFile(join(dir, 'ic_launcher_foreground.png'));
  await sharp(wash(layer, layer)).png().toFile(join(dir, 'ic_launcher_background.png'));
}

mkdirSync(join(res, 'mipmap-anydpi-v26'), { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
writeFileSync(join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
writeFileSync(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
writeFileSync(join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFF9F0</color>
</resources>
`);
for (const stale of ['drawable/ic_launcher_background.xml', 'drawable-v24/ic_launcher_foreground.xml']) rmSync(join(res, stale), { force: true });

// Splash (pre-Android 12 and the Capacitor launch theme background), cropped from the iOS splash.
const splashSizes = {
  drawable: [480, 320],
  'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
  'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
};
for (const [dir, [w, h]] of Object.entries(splashSizes)) {
  mkdirSync(join(res, dir), { recursive: true });
  await sharp(iosSplash).resize(w, h, { fit: 'cover', position: 'centre' }).png().toFile(join(res, dir, 'splash.png'));
}

// Play Console listing art: 512x512 icon and 1024x500 feature graphic.
const store = join(root, 'android/store-assets');
mkdirSync(store, { recursive: true });
await sharp(iosIcon).resize(512, 512).png().toFile(join(store, 'play-icon-512.png'));
const markWide = await sharp(emblem).resize(340, 340, { fit: 'contain', background: clear }).png().toBuffer();
const words = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <text x="610" y="245" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="92" fill="#3D5A40">Petalspire</text>
  <text x="610" y="310" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" fill="#6B7A69">Flower Garden Game</text>
</svg>`);
await sharp(wash(1024, 500)).composite([{ input: markWide, left: 40, top: 80 }, { input: words, left: 0, top: 0 }]).removeAlpha().png().toFile(join(store, 'play-feature-1024x500.png'));
console.log('wrote android icons, splash and store art', readdirSync(store).join(', '));
