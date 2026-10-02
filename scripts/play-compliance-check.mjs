import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(message) {
  failures.push(message);
}

function pass(message) {
  passes.push(message);
}

const failures = [];
const passes = [];

const gradle = read('apps/android/app/build.gradle');
const manifest = read('apps/android/app/src/main/AndroidManifest.xml');
const privacy = read('apps/web/src/app/privacy/page.tsx');
const settings = read('apps/web/src/app/settings/page.tsx');
const deletionPage = read('apps/web/src/app/account-deletion/page.tsx');
const deletionForm = read('apps/web/src/app/account-deletion/account-deletion-form.tsx');
const version = read('apps/android/version.properties');

const targetSdkMatch = gradle.match(/targetSdk\s+(\d+)/);
const targetSdk = Number(targetSdkMatch?.[1] ?? 0);

if (targetSdk >= 36) {
  pass(`targetSdk ${targetSdk} meets the 2026 Google Play mobile-app submission target.`);
} else {
  fail(`targetSdk must be at least 36 for the planned 2026 Play submission; found ${targetSdk || 'missing'}.`);
}

if (/applicationId\s+['"]in\.fcarena\.app['"]/.test(gradle)) {
  pass('Production package id is in.fcarena.app.');
} else {
  fail('Production applicationId must remain in.fcarena.app.');
}

if (/android:usesCleartextTraffic="false"/.test(manifest)) {
  pass('Cleartext HTTP traffic is disabled.');
} else {
  fail('Android manifest must keep android:usesCleartextTraffic="false".');
}

if (/firebase_messaging_auto_init_enabled" android:value="false"/.test(manifest)) {
  pass('Firebase Messaging auto-init is disabled until the app enables notifications.');
} else {
  fail('Firebase Messaging auto-init must remain disabled by default.');
}

if (/firebase_analytics_collection_enabled" android:value="false"/.test(manifest)) {
  pass('Firebase Analytics collection is disabled in the Android build.');
} else {
  fail('Firebase Analytics collection must remain explicitly disabled unless Play Data safety and Privacy Policy are updated first.');
}

const forbiddenPermissions = [
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'READ_CONTACTS',
  'WRITE_CONTACTS',
  'READ_SMS',
  'SEND_SMS',
  'RECEIVE_SMS',
  'READ_CALL_LOG',
  'WRITE_CALL_LOG',
  'CALL_PHONE',
  'RECORD_AUDIO',
  'CAMERA',
  'READ_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE',
  'MANAGE_EXTERNAL_STORAGE',
  'READ_MEDIA_IMAGES',
  'READ_MEDIA_VIDEO',
  'READ_MEDIA_AUDIO',
  'QUERY_ALL_PACKAGES',
  'REQUEST_INSTALL_PACKAGES',
  'SYSTEM_ALERT_WINDOW',
];

const foundForbidden = forbiddenPermissions.filter((permission) =>
  manifest.includes(`android.permission.${permission}`),
);

if (foundForbidden.length === 0) {
  pass('No unapproved sensitive Android permissions are declared.');
} else {
  fail(
    `Sensitive permissions require a fresh Play policy review before release: ${foundForbidden.join(', ')}.`,
  );
}

if (
  manifest.includes('android.permission.POST_NOTIFICATIONS') &&
  manifest.includes('android.permission.INTERNET') &&
  manifest.includes('android.permission.ACCESS_NETWORK_STATE')
) {
  pass('Declared Android permissions match the approved FC Arena baseline.');
} else {
  fail('Expected baseline permissions are missing or changed.');
}

if (
  privacy.includes('Google Firebase Cloud Messaging') &&
  privacy.includes('Firebase installation identifier') &&
  privacy.includes('does not enable Firebase Analytics collection')
) {
  pass('Privacy Policy discloses Firebase push/installation data and Analytics state.');
} else {
  fail('Privacy Policy must disclose Firebase Cloud Messaging, installation identifiers and Analytics state.');
}

if (
  privacy.includes('Cloudinary') &&
  privacy.includes('Brevo') &&
  privacy.includes('Vercel') &&
  privacy.includes('Railway')
) {
  pass('Privacy Policy names current operational service providers.');
} else {
  fail('Privacy Policy service-provider disclosure is incomplete.');
}

if (
  settings.includes('href="/account-deletion"') &&
  deletionPage.includes('Delete Your FC ARENA Account & Data') &&
  deletionForm.includes('/auth/account-deletion-request')
) {
  pass('Account deletion is discoverable in-app and available through a public web resource.');
} else {
  fail('Account deletion must remain accessible from Settings and the public deletion page.');
}

if (
  privacy.includes('account deletion') &&
  privacy.includes('/account-deletion')
) {
  pass('Privacy Policy links to the account-deletion resource.');
} else {
  fail('Privacy Policy must link to the public account-deletion resource.');
}

const versionCode = version.match(/VERSION_CODE=(\d+)/)?.[1];
const versionName = version.match(/VERSION_NAME=([^\s]+)/)?.[1];

if (versionCode && versionName) {
  pass(`Android release version source is present: ${versionName} (build ${versionCode}).`);
} else {
  fail('apps/android/version.properties must contain VERSION_CODE and VERSION_NAME.');
}

console.log('\nGoogle Play compliance gate\n');

for (const message of passes) {
  console.log(`✓ ${message}`);
}

if (failures.length > 0) {
  console.error('\nCompliance blockers:\n');

  for (const message of failures) {
    console.error(`✗ ${message}`);
  }

  process.exit(1);
}

console.log('\n✓ Automated Play compliance checks passed.');
console.log('Manual Play Console declarations, closed-test evidence, Pre-launch report and reviewer access still require human verification.\n');
