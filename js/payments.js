// Petalspire v0.31: Jewel purchases.
// Prototype only: there is NO real payment integration in this build.
// PAYMENTS_MODE (js/data.js) is the single switch:
//   'simulated'  -> the purchase is simulated after an on-screen confirm, nothing is charged.
//   'apple-iap'  -> reserved for a native StoreKit bridge (e.g. a WKWebView message handler) that a
//                   wrapped iOS build would provide. Until then it refuses, so nothing is ever granted for free by accident.
import { PAYMENTS_MODE } from './data.js';

export const Payments = {
  mode: PAYMENTS_MODE,
  get isTest() { return this.mode === 'simulated'; },
  async purchase(bundle) {
    if (this.mode === 'simulated') return { ok: true, simulated: true, jewels: bundle.n, receipt: `sim-${bundle.id}-${Date.now()}` };
    if (this.mode === 'apple-iap') {
      const bridge = window.webkit?.messageHandlers?.iap;
      if (!bridge) return { ok: false, reason: 'In-app purchases are not available in this build.' };
      // A native bridge would post the productId, then resolve with a verified transaction. Not implemented in the prototype.
      return { ok: false, reason: 'Apple IAP bridge not implemented yet.' };
    }
    return { ok: false, reason: 'Purchases are turned off.' };
  },
};
