// Single switch for TestFlight vs the App Store launch.
// true  -> Google's iOS demo ad units (safe to click, no invalid traffic).
// false -> the live Petalspire units below.
// The Info.plist GADApplicationIdentifier stays the live app id either way.
export const ADMOB_TEST_ADS = true;

export const ADMOB_LIVE = {
  appId: 'ca-app-pub-7278113923202511~9974526421',
  rewarded: 'ca-app-pub-7278113923202511/3300151917',
  interstitial: 'ca-app-pub-7278113923202511/2098750887',
  banner: 'ca-app-pub-7278113923202511/6967934189',
};

// Official iOS demo units: https://developers.google.com/admob/ios/test-ads
const ADMOB_DEMO = {
  appId: 'ca-app-pub-3940256099942544~1458002511',
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
  banner: 'ca-app-pub-3940256099942544/2435281174',
};

export function admobIds() {
  return ADMOB_TEST_ADS ? ADMOB_DEMO : ADMOB_LIVE;
}
