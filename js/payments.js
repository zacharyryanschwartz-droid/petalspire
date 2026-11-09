// Real-money purchases. The website refuses them. The iOS app uses StoreKit and grants nothing
// until Apple has verified the transaction (see js/store.js).
import { isNative } from './native.js';
import { buyProduct } from './store.js';

export const Payments = {
  get isTest() { return false; },
  async purchase(bundle) {
    if (!isNative()) return { ok: false, reason: 'Purchases aren’t available in this version.' };
    return buyProduct(bundle.productId);
  },
  async purchaseOffer(offer) {
    if (!isNative()) return { ok: false, productId: offer.productId, reason: 'Purchases aren’t available in this version.' };
    return buyProduct(offer.productId);
  },
};
