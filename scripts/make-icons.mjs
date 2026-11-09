// App icon and launch image from the Petalspire emblem and palette.
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cream = { r: 255, g: 249, b: 240, alpha: 1 };
const emblem = join(root, 'assets/emblem.png');

async function plate(size, emblemSize) {
  const wash = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#FFF9F0"/>
    <circle cx="${size * 0.2}" cy="${size * 0.18}" r="${size * 0.42}" fill="#F7C5C5" opacity="0.45"/>
    <circle cx="${size * 0.84}" cy="${size * 0.86}" r="${size * 0.46}" fill="#B7D4B5" opacity="0.55"/>
    <circle cx="${size * 0.5}" cy="${size * 0.48}" r="${size * 0.28}" fill="#F5D07A" opacity="0.2"/>
  </svg>`);
  const mark = await sharp(emblem).resize(emblemSize, emblemSize, { fit: 'contain', background: cream }).png().toBuffer();
  return sharp(wash).composite([{ input: mark, gravity: 'centre' }]).removeAlpha().png().toBuffer();
}

const iconDir = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const splashDir = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset');
mkdirSync(iconDir, { recursive: true });
mkdirSync(splashDir, { recursive: true });

const icon = await plate(1024, 820);
await sharp(icon).png().toFile(join(iconDir, 'AppIcon-1024.png'));

const splash = await plate(2732, 1100);
const word = Buffer.from(`<svg width="2732" height="2732" xmlns="http://www.w3.org/2000/svg">
  <text x="1366" y="1760" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="150" fill="#3D5A40">Petalspire</text>
  <text x="1366" y="1860" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="48" fill="#6B7A69">Flower Garden Game</text>
</svg>`);
await sharp(splash).composite([{ input: word, gravity: 'centre' }]).png().toFile(join(splashDir, 'splash-2732.png'));
await sharp(splash).resize(1366, 1366).png().toFile(join(splashDir, 'splash-1366.png'));
writeFileSync(join(iconDir, 'Contents.json'), JSON.stringify({
  images: [{ filename: 'AppIcon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 },
}, null, 2));
writeFileSync(join(splashDir, 'Contents.json'), JSON.stringify({
  images: [
    { idiom: 'universal', filename: 'splash-2732.png', scale: '1x' },
    { idiom: 'universal', filename: 'splash-2732.png', scale: '2x' },
    { idiom: 'universal', filename: 'splash-2732.png', scale: '3x' },
  ],
  info: { author: 'xcode', version: 1 },
}, null, 2));
console.log('wrote icon and splash');
