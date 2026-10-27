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
  // v0.66/v0.67: real-money packs (Starter Pack, Jewel Pouch, Gardener’s, Orchard, Collector’s). PLACEHOLDER PURCHASE HOOK — iPhone in-app purchase goes here.
  // The web build never fakes a real-money charge: outside a native app it refuses and grants nothing.
  // A wrapped iOS build: post { productId } to window.webkit.messageHandlers.iap, wait for StoreKit's verified
  // transaction, then resolve { ok: true, receipt } — main.js then calls grantOffer(id, receipt) to hand out the contents.
  async purchaseOffer(offer) {
    if (this.mode === 'apple-iap' && window.webkit?.messageHandlers?.iap) {
      return { ok: false, reason: 'Apple IAP bridge not implemented yet.', productId: offer.productId };
    }
    return { ok: false, placeholder: true, productId: offer.productId, reason: `${offer.name || 'This pack'} arrives with the iPhone app. Nothing was charged.` };
  },
};
