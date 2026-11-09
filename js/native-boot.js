// Loaded only by the bundled iOS copy of index.html. The web build keeps js/main.js.
import { prepareNativeApp, watchSaveLifecycle } from './native.js';

await prepareNativeApp();
await import('./main.js');
watchSaveLifecycle();
