// AdMob for the iOS app only. The web build never calls into the native plugin.
// Rewards are granted only after the rewarded callback. A failed load never pays and never hangs.
import { admobIds } from './admob-config.js';
import { isNative, launchCount } from './native.js';

const REWARD_EVENT = 'onRewardedVideoAdReward';
const REWARD_DISMISS = 'onRewardedVideoAdDismissed';
const REWARD_FAIL_SHOW = 'onRewardedVideoAdFailedToShow';
const INTERSTITIAL_DISMISS = 'interstitialAdDismissed';
const INTERSTITIAL_FAIL_SHOW = 'interstitialAdFailedToShow';
const BANNER_FAIL = 'bannerAdFailedToLoad';

function plugin() {
  const cap = globalThis.Capacitor;
  if (!isNative() || !cap?.registerPlugin) return null;
  try { return cap.registerPlugin('AdMob'); } catch { return null; }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function notify() {
  try { window.dispatchEvent(new Event('petalspire-ads')); } catch { /* no window */ }
}

const state = {
  allowed: false,
  started: false,
  rewardReady: false,
  interstitialReady: false,
  bannerUp: false,
};

function ids() { return admobIds(); }

async function listen(AdMob, name, fn) {
  try { return await AdMob.addListener(name, fn); } catch { return null; }
}

async function preloadReward(AdMob) {
  state.rewardReady = false;
  try {
    await withTimeout(AdMob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: false }), 20000);
    state.rewardReady = true;
  } catch { state.rewardReady = false; }
  notify();
  if (!state.rewardReady) setTimeout(() => { if (state.allowed) preloadReward(AdMob); }, 30000);
}

async function preloadInterstitial(AdMob) {
  state.interstitialReady = false;
  try {
    await withTimeout(AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: false }), 20000);
    state.interstitialReady = true;
  } catch { state.interstitialReady = false; }
  if (!state.interstitialReady) setTimeout(() => { if (state.allowed) preloadInterstitial(AdMob); }, 30000);
}

async function runConsent(AdMob) {
  let info = null;
  try { info = await withTimeout(AdMob.requestConsentInfo(), 20000); } catch { info = null; }
  if (info?.isConsentFormAvailable && info.status === 'REQUIRED') {
    try { info = await withTimeout(AdMob.showConsentForm(), 180000); } catch { /* keep the last info */ }
  }
  if (info && info.canRequestAds === false) return false;
  try {
    const status = await withTimeout(AdMob.trackingAuthorizationStatus(), 8000);
    if (status?.status === 'notDetermined') await withTimeout(AdMob.requestTrackingAuthorization(), 180000);
  } catch { /* ATT is optional; ads can still be non-personalized */ }
  try { await withTimeout(AdMob.initialize(), 20000); } catch { return false; }
  return true;
}

/** Call after the garden exists. ATT and UMP wait until launch 2 and Sprig's guide is done. */
export function considerNativeAds(guideDone) {
  if (!isNative() || state.started) return;
  if (launchCount() < 2) return;
  let done = false;
  try { done = !!guideDone(); } catch { done = false; }
  if (!done) return;
  state.started = true;
  const AdMob = plugin();
  if (!AdMob) return;
  runConsent(AdMob).then((ok) => {
    state.allowed = !!ok;
    if (!ok) { notify(); return; }
    preloadReward(AdMob);
    preloadInterstitial(AdMob);
    notify();
  });
}

export const nativeAds = {
  get rewardReady() { return !!(state.allowed && state.rewardReady); },
  get interstitialReady() { return !!(state.allowed && state.interstitialReady); },
  get bannerAllowed() { return !!state.allowed; },

  showRewarded() {
    const AdMob = plugin();
    if (!AdMob || !state.rewardReady) return Promise.resolve(false);
    state.rewardReady = false;
    notify();
    return new Promise((resolve) => {
      let earned = false;
      let settled = false;
      const handles = [];
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        handles.forEach((h) => { try { h?.remove?.(); } catch { /* already gone */ } });
        resolve(earned);
        preloadReward(AdMob);
      };
      const timer = setTimeout(finish, 180000);
      Promise.all([
        listen(AdMob, REWARD_EVENT, () => { earned = true; }),
        listen(AdMob, REWARD_DISMISS, () => finish()),
        listen(AdMob, REWARD_FAIL_SHOW, () => finish()),
      ]).then((hs) => hs.forEach((h) => h && handles.push(h))).finally(() => {
        AdMob.showRewardVideoAd().then(
          (item) => { if (item && (item.amount != null || item.type)) earned = true; },
          () => setTimeout(finish, 400),
        );
      });
    });
  },

  showInterstitial() {
    const AdMob = plugin();
    if (!AdMob || !state.interstitialReady) return Promise.resolve(false);
    state.interstitialReady = false;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(!!ok);
        preloadInterstitial(AdMob);
      };
      const timer = setTimeout(() => finish(true), 120000);
      listen(AdMob, INTERSTITIAL_DISMISS, () => finish(true));
      listen(AdMob, INTERSTITIAL_FAIL_SHOW, () => finish(false));
      AdMob.showInterstitial().catch(() => finish(false));
    });
  },

  async showBanner(margin) {
    const AdMob = plugin();
    if (!AdMob || !state.allowed) return false;
    try {
      await listen(AdMob, BANNER_FAIL, () => {
        state.bannerUp = false;
        AdMob.removeBanner?.().catch(() => {});
        try { window.dispatchEvent(new Event('petalspire-banner-failed')); } catch { /* noop */ }
      });
      await withTimeout(AdMob.showBanner({
        adId: ids().banner,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: Math.max(0, margin | 0),
        isTesting: false,
      }), 15000);
      state.bannerUp = true;
      return true;
    } catch {
      state.bannerUp = false;
      try { await AdMob.removeBanner(); } catch { /* already gone */ }
      return false;
    }
  },

  async hideBanner() {
    const AdMob = plugin();
    state.bannerUp = false;
    if (!AdMob) return;
    try { await AdMob.removeBanner(); } catch { /* not showing */ }
  },
};

export function safeBottomPx() {
  try {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;left:0;height:env(safe-area-inset-bottom);width:0;pointer-events:none';
    document.body.appendChild(el);
    const h = el.getBoundingClientRect().height;
    el.remove();
    return Math.round(h) || 0;
  } catch { return 0; }
}
