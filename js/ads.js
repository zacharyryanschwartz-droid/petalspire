// Petalspire v0.31: ads. Prototype only: there is NO ad SDK and nothing is requested from an ad network.
//  - Banner: a HOUSE ad for our own games (OTHER_GAMES in js/data.js). Tapping it opens Settings → Play Other Games.
//  - Interstitial + rewarded: 'Partner ad' placeholders. A real partner-network SDK (ADS.partner.network) can replace
//    overlay() later — the game only calls maybeBreak() / rewarded() and never needs to change.
// ADS_MODE (js/data.js) is the single switch; the No More Ads purchase (state.noAds) hides everything.
import { ADS_MODE, ADS, OTHER_GAMES } from './data.js';

const MP_ART = `<svg viewBox="0 0 64 44" aria-hidden="true"><rect x="2" y="30" width="60" height="12" rx="4" fill="#8C6545"/><path d="M6 32h52M6 36h52" stroke="#6E4D33" stroke-width="1.4"/>
  <path d="M11 30v-12h42v12" fill="#FFF9F0" stroke="#3D5A40" stroke-width="2"/><path d="M8 18l4-10h40l4 10z" fill="#F7C5C5" stroke="#3D5A40" stroke-width="2" stroke-linejoin="round"/>
  <path d="M18 8l-2 10M28 8l-1 10M37 8l1 10M46 8l2 10" stroke="#FFF9F0" stroke-width="2.4"/><circle cx="20" cy="26" r="3.4" fill="#F5D07A"/><circle cx="28" cy="26" r="3.4" fill="#E07F86"/>
  <circle cx="36" cy="26" r="3.4" fill="#B7D4B5"/><path d="M44 21l3 6h-6z" fill="#F5D07A" stroke="#3D5A40" stroke-width="1.2"/></svg>`;
export const gameArt = (id) => (id === 'market_plot' ? MP_ART : MP_ART);

export function createAds({ root, noAds, onHouseAd, onRemoveAds, onEvent = () => {} }) {
  const on = () => ADS_MODE !== 'off' && !noAds();
  const partnerOn = () => on() && ADS_MODE === 'placeholder';   // 'sdk' mode: real partner SDK goes here
  let lastBreak = 0, open = null, houseIdx = 0;
  const banner = document.createElement('button');
  banner.id = 'ad-banner'; banner.type = 'button'; banner.className = 'ad-banner hidden';
  root.appendChild(banner);
  function renderBanner() {
    const g = OTHER_GAMES.find((x) => x.id === ADS.houseAds[houseIdx % ADS.houseAds.length]) || OTHER_GAMES[0];
    banner.dataset.game = g.id;
    banner.innerHTML = `<span class="hb-art">${gameArt(g.id)}</span><span class="hb-copy"><b>${g.name}</b><small>${g.tagline}</small></span>
      <span class="hb-tag">${g.status === 'soon' ? 'Coming soon' : 'Play'}</span><span class="hb-from">from the makers of Petalspire</span>`;
  }
  banner.addEventListener('click', () => onHouseAd(banner.dataset.game));
  function sync() {
    const show = on() && ADS.banner && OTHER_GAMES.length > 0;
    if (show && !banner.innerHTML) renderBanner();
    banner.classList.toggle('hidden', !show); document.body.classList.toggle('ads-on', show);
    if (!on() && open) open.close(false);
  }
  // full-screen partner placeholder; kind = 'break' (skippable interstitial) | 'reward' (opt-in, pays out when finished)
  function overlay(kind, onDone) {
    const wait = kind === 'reward' ? ADS.rewarded.watchMs : ADS.skipAfterMs;
    const O = document.createElement('div'); O.id = 'ad-break'; O.className = 'ad-break';
    O.innerHTML = `<div class="ad-card"><div class="ad-top"><span class="ad-tag">Partner ad</span><button class="ad-skip" type="button" disabled>${kind === 'reward' ? 'Watching' : 'Skip in'} <b>${Math.ceil(wait / 1000)}</b></button></div>
      <div class="ad-art"><svg viewBox="0 0 120 80"><rect x="4" y="4" width="112" height="72" rx="14" fill="#FFF9F0" stroke="#B7D4B5" stroke-width="3" stroke-dasharray="7 6"/><path d="M48 28l26 12-26 12z" fill="#B7D4B5"/></svg></div>
      <h3>Partner ad</h3><p>${kind === 'reward' ? 'Watch to the end for your bonus.' : 'A short ad from our ad partner would play here.'}<br/><b>Placeholder only</b> · no ad network, nothing is loaded or tracked.</p>
      <div class="ad-bar"><em></em></div>
      <button class="btn btn-blush ad-noads" type="button">No More Ads + 10 Jewels · $8.99</button></div>`;
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
    O.querySelector('.ad-noads').addEventListener('click', () => { close(false); onRemoveAds(); });
    open = { close }; onEvent(kind + '-open');
  }
  return {
    get mode() { return ADS_MODE; }, get enabled() { return on(); }, get partner() { return partnerOn(); }, get showing() { return !!open; },
    sync,
    // a natural break: shown only if partner ads are on, nothing else is open, and the last break was a while ago
    maybeBreak(reason, blocked = false) {
      if (!partnerOn() || open || blocked || (lastBreak && performance.now() - lastBreak < ADS.minGapMs)) return false;
      lastBreak = performance.now(); overlay('break'); onEvent('break:' + reason); return true;
    },
    rewarded(onReward) { if (!partnerOn() || open) return false; overlay('reward', (ok) => ok && onReward()); return true; },
    _resetGap() { lastBreak = 0; },
  };
}
