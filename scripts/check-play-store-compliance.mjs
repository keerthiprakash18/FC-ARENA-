import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  const fullPath = path.join(root, relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required Play compliance file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, 'utf8');
}

function requireMatch(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const gradle = read('apps/android/app/build.gradle');
const manifest = read('apps/android/app/src/main/AndroidManifest.xml');
const privacy = read('apps/web/src/app/privacy/page.tsx');
const settings = read('apps/web/src/app/settings/page.tsx');
const deletionPage = read('apps/web/src/app/account-deletion/page.tsx');
const deletionForm = read('apps/web/src/app/account-deletion/account-deletion-form.tsx');
const versionProperties = read('apps/android/version.properties');

const targetSdkMatch = gradle.match(/targetSdk\s+(\d+)/);
requireMatch(targetSdkMatch, 'Android targetSdk is not declared.');
requireMatch(
  Number(targetSdkMatch[1]) >= 36,
  `Google Play submission gate requires targetSdk 36+; found ${targetSdkMatch[1]}.`,
);

const forbiddenPermissions = [
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.RECORD_AUDIO',
  'android.permission.CAMERA',
  'android.permission.READ_PHONE_STATE',
  'android.permission.MANAGE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

for (const permission of forbiddenPermissions) {
  requireMatch(
    !manifest.includes(permission),
    `Sensitive Android permission added without Play compliance review: ${permission}`,
  );
}

requireMatch(
  manifest.includes('android.permission.POST_NOTIFICATIONS'),
  'Notification permission declaration is expected for FC Arena Android push notifications.',
);

requireMatch(
  manifest.includes('android:allowBackup="false"'),
  'Android backup must remain disabled until a documented restore/privacy design is approved.',
);

requireMatch(
  manifest.includes('firebase_analytics_collection_enabled') &&
    manifest.includes('android:value="false"'),
  'Firebase Analytics collection must remain disabled unless Data Safety and privacy disclosures are updated first.',
);

requireMatch(
  privacy.includes('Google Firebase Cloud Messaging'),
  'Privacy Policy must disclose Google Firebase Cloud Messaging.',
);

requireMatch(
  privacy.includes('registration token') &&
    privacy.includes('push notifications'),
  'Privacy Policy must explain Android push-token processing.',
);

requireMatch(
  settings.includes('/account-deletion'),
  'The signed-in Settings page must expose an in-app account deletion path.',
);

requireMatch(
  deletionPage.includes('You do not need to be signed in'),
  'The public account deletion page must remain accessible without login.',
);

requireMatch(
  deletionForm.includes('/auth/account-deletion-request'),
  'The public deletion form must submit to the deletion-request API.',
);

requireMatch(
  /VERSION_CODE=\d+/.test(versionProperties) &&
    /VERSION_NAME=\d+\.\d+\.\d+/.test(versionProperties),
  'Android version.properties is invalid.',
);

console.log('Play compliance gate: PASS');
console.log(`targetSdk=${targetSdkMatch[1]}`);
console.log('Sensitive permission guard: PASS');
console.log('Privacy + deletion routes: PASS');
console.log('Firebase Analytics disabled: PASS');
