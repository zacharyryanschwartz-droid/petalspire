// Ads. The web build keeps house banners plus simulated rewarded/interstitial placeholders.
// The iOS app (isNative) serves rewarded, interstitial, and a share of the bottom slot through AdMob.
// House ads — Market Plot and each book in js/books.js — stay in the same bottom slot on both builds.
import { ADS_MODE, ADS, OTHER_GAMES } from './data.js';
import { BOOK_PROMO_LINE, promoBooks } from './books.js';
import { isNative, openExternal } from './native.js';
import { nativeAds, safeBottomPx } from './admob.js';

const MP_ART = `<svg viewBox="0 0 64 44" aria-hidden="true"><rect x="2" y="30" width="60" height="12" rx="4" fill="#8C6545"/><path d="M6 32h52M6 36h52" stroke="#6E4D33" stroke-width="1.4"/>
  <path d="M11 30v-12h42v12" fill="#FFF9F0" stroke="#3D5A40" stroke-width="2"/><path d="M8 18l4-10h40l4 10z" fill="#F7C5C5" stroke="#3D5A40" stroke-width="2" stroke-linejoin="round"/>
  <path d="M18 8l-2 10M28 8l-1 10M37 8l1 10M46 8l2 10" stroke="#FFF9F0" stroke-width="2.4"/><circle cx="20" cy="26" r="3.4" fill="#F5D07A"/><circle cx="28" cy="26" r="3.4" fill="#E07F86"/>
  <circle cx="36" cy="26" r="3.4" fill="#B7D4B5"/><path d="M44 21l3 6h-6z" fill="#F5D07A" stroke="#3D5A40" stroke-width="1.2"/></svg>`;
const BOOK_ART = `<svg viewBox="0 0 64 44" aria-hidden="true"><path d="M8 8h30c8 0 14 3 14 8v20H20c-7 0-12-3-12-8V8z" fill="#FFF9F0" stroke="#3D5A40" stroke-width="2"/><path d="M20 8v24" stroke="#3D5A40" stroke-width="2"/><path d="M26 16h18M26 22h14" stroke="#F7C5C5" stroke-width="2.2" stroke-linecap="round"/><circle cx="46" cy="30" r="5" fill="#F5D07A" stroke="#3D5A40" stroke-width="1.4"/></svg>`;
export const gameArt = (id) => (id === 'books' ? BOOK_ART : MP_ART);

const ROTATE_MS = 45000;

function marketGame() {
  const id = ADS.houseAds[0];
  return OTHER_GAMES.find((g) => g.id === id) || OTHER_GAMES[0];
}

/** Bottom-slot order. Web: house ads only. iOS: AdMob, then the same house ads. */
export function bannerSlots() {
  const slots = [];
  if (isNative()) slots.push({ kind: 'admob' });
  const g = marketGame();
  if (g) slots.push({ kind: 'house', id: g.id, title: g.name, line: g.tagline, tag: g.status === 'soon' ? 'Coming soon' : 'Play' });
  for (const book of promoBooks()) slots.push({ kind: 'book', id: 'book:' + book.url, title: book.title, line: BOOK_PROMO_LINE, url: book.url, tag: 'Book' });
  return slots;
}

export function createAds({ root, noAds, onHouseAd, onRemoveAds, onEvent = () => {} }) {
  const on = () => ADS_MODE !== 'off' && !noAds();
  const partnerOn = () => on() && ADS_MODE === 'placeholder';
  let lastBreak = 0, open = null, slotIdx = 0, timer = 0, shownKey = '', presenting = false, displayed = null;
  const providers = { placeholder: { showRewarded: ({ onDone }) => overlay('reward', onDone) } };
  const banner = document.createElement('button');
  banner.id = 'ad-banner'; banner.type = 'button'; banner.className = 'ad-banner hidden';
  root.appendChild(banner);

  const covered = () => {
    const b = document.body;
    return !b || b.classList.contains('guide-on') || b.classList.contains('on-title');
  };

  function renderHouse(slot) {
    banner.dataset.slot = slot.kind;
    banner.dataset.ref = slot.url || slot.id || '';
    banner.classList.toggle('book-slot', slot.kind === 'book');
    banner.classList.remove('admob-slot');
    banner.setAttribute('aria-label', slot.kind === 'book' ? `${slot.title}. ${slot.line}` : slot.title);
    banner.innerHTML = `<span class="hb-art">${slot.kind === 'book' ? BOOK_ART : gameArt(slot.id)}</span><span class="hb-copy"><b>${slot.title}</b><small>${slot.line}</small></span>
      <span class="hb-tag">${slot.tag}</span><span class="hb-from">from the makers of Petalspire</span>`;
  }

  async function present(force = false) {
    const slots = bannerSlots();
    const show = on() && ADS.banner && slots.length > 0;
    banner.classList.toggle('hidden', !show);
    document.body.classList.toggle('ads-on', show);
    if (!show || covered()) {
      shownKey = '';
      banner.classList.remove('admob-slot');
      if (isNative()) nativeAds.hideBanner();
      return;
    }
    if (presenting) return;
    let slot = slots[slotIdx % slots.length];
    if (slot.kind === 'admob' && !nativeAds.bannerAllowed) {
      const house = slots.find((s) => s.kind !== 'admob');
      if (!house) { nativeAds.hideBanner(); return; }
      slot = house;
    }
    const key = slot.kind + ':' + (slot.id || '');
    if (!force && key === shownKey) return;
    presenting = true;
    shownKey = key;
    displayed = slot;
    try {
      if (slot.kind === 'admob') {
        banner.classList.add('admob-slot');
        banner.classList.remove('book-slot');
        const ok = await nativeAds.showBanner(safeBottomPx() + 6);
        if (!ok) { shownKey = ''; slotIdx = (slotIdx + 1) % slots.length; presenting = false; present(true); return; }
      } else {
        await nativeAds.hideBanner();
        renderHouse(slot);
      }
    } finally { presenting = false; }
  }

  function advance() { slotIdx += 1; shownKey = ''; present(true); }

  banner.addEventListener('click', () => {
    const slot = displayed;
    if (!slot || slot.kind === 'admob' || banner.classList.contains('admob-slot')) return;
    if (slot.kind === 'book') { openExternal(slot.url); return; }
    onHouseAd(slot.id);
  });

  function sync() {
    const show = on() && ADS.banner && bannerSlots().length > 0;
    if (!timer && show) timer = setInterval(advance, ROTATE_MS);
    if (!show && timer) { clearInterval(timer); timer = 0; }
    present(false);
    if (!on() && open && open.kind === 'break') open.close(false);
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    new MutationObserver(() => present(false)).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('petalspire-ads', () => present(false));
  window.addEventListener('petalspire-banner-failed', () => { if (shownKey.startsWith('admob')) advance(); });

  function overlay(kind, onDone) {
    const wait = kind === 'reward' ? ADS.rewarded.watchMs : ADS.skipAfterMs;
    const O = document.createElement('div'); O.id = 'ad-break'; O.className = 'ad-break';
    O.innerHTML = `<div class="ad-card"><div class="ad-top"><span class="ad-tag">Partner ad</span><button class="ad-skip" type="button" disabled>${kind === 'reward' ? 'Watching' : 'Skip in'} <b>${Math.ceil(wait / 1000)}</b></button></div>
      <div class="ad-art"><svg viewBox="0 0 120 80"><rect x="4" y="4" width="112" height="72" rx="14" fill="#FFF9F0" stroke="#B7D4B5" stroke-width="3" stroke-dasharray="7 6"/><path d="M48 28l26 12-26 12z" fill="#B7D4B5"/></svg></div>
      <h3>Partner ad</h3><p>${kind === 'reward' ? 'Watch to the end for your bonus.' : 'A short ad from our ad partner would play here.'}<br/><b>Placeholder only</b> · no ad network, nothing is loaded or tracked.</p>
      <div class="ad-bar"><em></em></div>
      ${noAds() ? '' : '<button class="btn btn-blush ad-noads" type="button">No More Ads + 10 Jewels · $8.99</button>'}</div>`;
    root.appendChild(O);
    const skip = O.querySelector('.ad-skip'), bar = O.querySelector('.ad-bar em'), t0 = performance.now();
    let done = false;
    const close = (finished) => { if (!O.isConnected) return; clearInterval(iv); O.remove(); open = null; onEvent(kind + '-close'); onDone && onDone(finished); };
    const iv = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / wait); bar.style.width = (k * 100) + '%';
      if (k >= 1 && !done) { done = true; skip.disabled = false; skip.innerHTML = kind === 'reward' ? 'Collect reward' : 'Skip ✕'; skip.classList.add('ready'); }
      else if (!done) skip.querySelector('b').textContent = Math.ceil((wait - (performance.now() - t0)) / 1000);
    }, 100);
    skip.addEventListener('click', () => done && close(true));
    O.querySelector('.ad-noads')?.addEventListener('click', () => { close(false); onRemoveAds(); });
    open = { close, kind }; onEvent(kind + '-open');
  }

  return {
    get mode() { return ADS_MODE; }, get enabled() { return on(); }, get partner() { return partnerOn(); }, get showing() { return !!open; },
    get rewardReady() { return isNative() ? nativeAds.rewardReady : true; },
    sync,
    maybeBreak(reason, blocked = false) {
      if (!partnerOn() || open || blocked || (lastBreak && performance.now() - lastBreak < ADS.minGapMs)) return false;
      if (isNative()) {
        if (!nativeAds.interstitialReady) return false;
        lastBreak = performance.now();
        open = { close() { open = null; }, kind: 'break' };
        nativeAds.showInterstitial().finally(() => { if (open?.kind === 'break') open = null; });
        onEvent('break:' + reason);
        return true;
      }
      lastBreak = performance.now(); overlay('break'); onEvent('break:' + reason); return true;
    },
    get rewardOn() { return ADS_MODE !== 'off'; },
    rewarded(onReward, onClose = () => {}) {
      if (ADS_MODE === 'off' || open) return false;
      if (isNative()) {
        if (!nativeAds.rewardReady) return false;
        open = { close() { open = null; }, kind: 'reward' };
        nativeAds.showRewarded().then((earned) => {
          if (open?.kind === 'reward') open = null;
          const ok = !!earned;
          onClose(ok);
          if (ok) onReward();
        });
        return true;
      }
      const p = providers[ADS.partner.network] || providers.placeholder;
      p.showRewarded({ unit: ADS.partner.rewardedUnit, onDone: (finished) => { onClose(finished); if (finished) onReward(); } });
      return true;
    },
    registerProvider(name, impl) { providers[name] = impl; },
    _resetGap() { lastBreak = 0; },
  };
}
