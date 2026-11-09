// StoreKit 2 bridge. The web build never loads a store, so real-money buttons stay hidden there.
import { JEWEL_BUNDLES, NO_ADS_BUNDLE, OFFER_PACKS } from './data.js';
import { isNative } from './native.js';

export const PRIVACY_URL = 'https://zacharyryanschwartz-droid.github.io/petalspire/privacy.html';

export const PRODUCT_IDS = [
  ...JEWEL_BUNDLES.map((b) => b.productId),
  NO_ADS_BUNDLE.productId,
  ...OFFER_PACKS.map((o) => o.productId),
];

const state = { ready: false, prices: {} };

function plugin() {
  if (!isNative()) return null;
  const cap = globalThis.Capacitor;
  if (!cap?.registerPlugin) return null;
  try { return cap.registerPlugin('PetalspireStore'); } catch { return null; }
}

export function storeReady() { return state.ready; }

/** Localized App Store price, or the fallback string from data.js. */
export function storePrice(productId, fallback) {
  return state.prices[productId] || fallback;
}

/** Real-money buttons show only in the iOS app after the store has returned products. */
export function purchasesVisible() {
  return isNative() && state.ready;
}

function notify() {
  try { window.dispatchEvent(new Event('petalspire-store')); } catch { /* no window */ }
}

export async function loadStore() {
  if (!isNative() || state.ready) return state.ready;
  const Store = plugin();
  if (!Store?.loadProducts) return false;
  try {
    const res = await Store.loadProducts({ productIds: PRODUCT_IDS });
    const products = res?.products || [];
    state.prices = {};
    for (const p of products) if (p?.productId && p.displayPrice) state.prices[p.productId] = p.displayPrice;
    state.ready = products.length > 0;
  } catch { state.ready = false; }
  notify();
  return state.ready;
}

export async function buyProduct(productId) {
  const Store = plugin();
  if (!Store?.purchase) return { ok: false, reason: 'Purchases aren’t available in this version.' };
  let res;
  try { res = await Store.purchase({ productId }); }
  catch { return { ok: false, reason: 'Purchase didn’t go through' }; }
  if (!res || res.status === 'cancelled') return { ok: false, cancelled: true };
  if (res.status === 'pending') return { ok: false, pending: true, reason: 'Waiting for approval from the App Store.' };
  if (res.status !== 'purchased' || res.verified !== true || !res.transactionId) {
    return { ok: false, reason: res.reason || 'Purchase didn’t go through' };
  }
  return { ok: true, productId: res.productId || productId, transactionId: String(res.transactionId) };
}

export async function finishProduct(transactionId) {
  const Store = plugin();
  if (!Store?.finish || transactionId == null) return;
  try { await Store.finish({ transactionId: String(transactionId) }); } catch { /* finished later from Transaction.updates */ }
}

export async function restoreProducts() {
  const Store = plugin();
  if (!Store?.restore) return { ok: false, productIds: [] };
  try {
    const res = await Store.restore();
    return { ok: true, productIds: res?.productIds || [] };
  } catch { return { ok: false, productIds: [] }; }
}

export function listenForTransactions(onTransaction) {
  const Store = plugin();
  if (!Store?.addListener) return;
  Store.addListener('transaction', (tx) => { try { onTransaction(tx); } catch { /* grant path handles its own errors */ } });
}
