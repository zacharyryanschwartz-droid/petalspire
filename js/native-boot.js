// Loaded only by the bundled iOS copy of index.html. The web build keeps js/main.js.
// @capacitor/core must load first: it adds Capacitor.registerPlugin on top of the native bridge (copied in by scripts/bundle-www.mjs).
import '../vendor/capacitor-core.js';
import { prepareNativeApp, watchSaveLifecycle } from './native.js';

await prepareNativeApp();
await import('./main.js');
watchSaveLifecycle();
