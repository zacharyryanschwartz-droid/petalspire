// AdMob ids for the Android (Google Play) app. iOS ids stay in js/admob-config.js.
// Android needs its OWN AdMob app and ad units in the same AdMob account (pub-7278113923202511).
// Until they exist, the PLACEHOLDER values below stay in and the app requests Google's Android demo units.
// To go live: create the Android app + 3 units in AdMob, paste them below, set the same app id as
// PETALSPIRE_ADMOB_APP_ID in android/gradle.properties, and set ADMOB_ANDROID_TEST_ADS = false.
export const ADMOB_ANDROID_TEST_ADS = true;

export const ADMOB_ANDROID_LIVE = {
  appId: 'PLACEHOLDER_ANDROID_ADMOB_APP_ID',           // ca-app-pub-7278113923202511~XXXXXXXXXX
  rewarded: 'PLACEHOLDER_ANDROID_REWARDED_UNIT',      // ca-app-pub-7278113923202511/XXXXXXXXXX
  interstitial: 'PLACEHOLDER_ANDROID_INTERSTITIAL_UNIT',
  banner: 'PLACEHOLDER_ANDROID_BANNER_UNIT',
};

// Official Android demo units: https://developers.google.com/admob/android/test-ads
export const ADMOB_ANDROID_DEMO = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  banner: 'ca-app-pub-3940256099942544/9214589741',
};

export function androidAdmobLiveReady() {
  return Object.values(ADMOB_ANDROID_LIVE).every((v) => typeof v === 'string' && v.startsWith('ca-app-pub-7278113923202511'));
}

/** Demo units while testing or while any live id is still a placeholder. */
export function androidAdmobIds() {
  return ADMOB_ANDROID_TEST_ADS || !androidAdmobLiveReady() ? ADMOB_ANDROID_DEMO : ADMOB_ANDROID_LIVE;
}
