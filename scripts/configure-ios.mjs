// Idempotent iOS project settings: portrait, encryption flag, AdMob, tracking prompt, icons.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ADMOB_LIVE } from '../js/admob-config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plistPath = join(root, 'ios/App/App/Info.plist');
const pbxPath = join(root, 'ios/App/App.xcodeproj/project.pbxproj');
const skad = JSON.parse(readFileSync(join(root, 'scripts/skadnetworks.json'), 'utf8'));

function upsertPlist(xml, key, inner) {
  const block = new RegExp(`<key>${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</key>\\s*(?:<string>[\\s\\S]*?</string>|<true/>|<false/>|<array>[\\s\\S]*?</array>)`);
  const replacement = `<key>${key}</key>\n\t${inner}`;
  if (block.test(xml)) return xml.replace(block, replacement);
  return xml.replace('\n</dict>\n</plist>', `\n\t${replacement}\n</dict>\n</plist>`);
}

if (!existsSync(plistPath)) {
  console.error('Info.plist not found. Run npx cap add ios first.');
  process.exit(1);
}

let plist = readFileSync(plistPath, 'utf8');
const skadXml = `<array>\n${skad.map((id) => `\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>${id}</string>\n\t\t</dict>`).join('\n')}\n\t</array>`;
const orientations = `<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>`;
plist = upsertPlist(plist, 'CFBundleDisplayName', '<string>Petalspire</string>');
plist = upsertPlist(plist, 'GADApplicationIdentifier', `<string>${ADMOB_LIVE.appId}</string>`);
plist = upsertPlist(plist, 'ITSAppUsesNonExemptEncryption', '<false/>');
plist = upsertPlist(plist, 'NSUserTrackingUsageDescription', '<string>This lets Petalspire show ads that are more relevant to you.</string>');
plist = upsertPlist(plist, 'SKAdNetworkItems', skadXml);
plist = upsertPlist(plist, 'UIStatusBarHidden', '<true/>');
plist = upsertPlist(plist, 'UIViewControllerBasedStatusBarAppearance', '<false/>');
plist = upsertPlist(plist, 'UISupportedInterfaceOrientations', orientations);
plist = upsertPlist(plist, 'UIRequiresFullScreen', '<true/>');
writeFileSync(plistPath, plist);

if (existsSync(pbxPath)) {
  let pbx = readFileSync(pbxPath, 'utf8');
  pbx = pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 16.4;');
  pbx = pbx.replace(/TARGETED_DEVICE_FAMILY = "[^"]*";/g, 'TARGETED_DEVICE_FAMILY = 1;');
  if (!pbx.includes('INFOPLIST_KEY_ITSAppUsesNonExemptEncryption')) {
    pbx = pbx.replace(/CODE_SIGN_STYLE = Automatic;/g, 'CODE_SIGN_STYLE = Automatic;\n\t\t\t\tINFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;');
  }
  writeFileSync(pbxPath, pbx);
}

const storyboard = join(root, 'ios/App/App/Base.lproj/LaunchScreen.storyboard');
if (existsSync(storyboard)) {
  let xml = readFileSync(storyboard, 'utf8');
  xml = xml.replace(/red="[^"]*" green="[^"]*" blue="[^"]*" alpha="[^"]*"/, 'red="1" green="0.976" blue="0.941" alpha="1"');
  writeFileSync(storyboard, xml);
}

const podfile = join(root, 'ios/App/Podfile');
if (existsSync(podfile)) {
  let pod = readFileSync(podfile, 'utf8');
  if (!pod.includes('IPHONEOS_DEPLOYMENT_TARGET')) {
    pod += `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
    end
  end
end
`;
    writeFileSync(podfile, pod);
  }
}

console.log('configured iOS project');
