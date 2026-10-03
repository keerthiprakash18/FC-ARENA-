import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing Data Safety audit file: ${relativePath}`);
  }
  return fs.readFileSync(full, 'utf8');
}

function requireMatch(condition, message) {
  if (!condition) throw new Error(message);
}

const privacy = read('apps/web/src/app/privacy/page.tsx');
const terms = read('apps/web/src/app/terms/page.tsx');
const deletion = read('apps/web/src/app/account-deletion/page.tsx');
const manifest = read('apps/android/app/src/main/AndroidManifest.xml');
const gradle = read('apps/android/app/build.gradle');
const worksheet = read('docs/readiness/step-16-privacy-data-safety.md');

for (const required of [
  'full name',
  'email address',
  'phone number',
  'game UID',
  'profile image',
  'Firebase Crashlytics',
  'Google Firebase Cloud Messaging',
  'Brevo',
  'Cloudinary',
  'Data retention',
  'Account & data deletion',
]) {
  requireMatch(
    privacy.toLowerCase().includes(required.toLowerCase()),
    `Privacy Policy is missing required disclosure: ${required}`,
  );
}

requireMatch(
  privacy.includes('Vercel') && privacy.includes('Railway'),
  'Privacy Policy must identify current hosting/infrastructure providers.',
);

requireMatch(
  privacy.includes('We do not sell personal information'),
  'Privacy Policy must retain the no-sale disclosure unless practices change.',
);

requireMatch(
  deletion.includes('You do not need to be signed in'),
  'Public account deletion must remain accessible without login.',
);

for (const phrase of [
  'harassment',
  'hate',
  'sexual',
  'scams',
  'impersonation',
  'reporting',
  'blocking',
]) {
  requireMatch(
    terms.toLowerCase().includes(phrase.toLowerCase()),
    `Terms are missing UGC/moderation rule: ${phrase}`,
  );
}

requireMatch(
  manifest.includes('firebase_analytics_collection_enabled') &&
    manifest.includes('android:value="false"'),
  'Firebase Analytics must remain disabled unless the Data Safety audit is reopened.',
);

requireMatch(
  !manifest.includes('com.google.android.gms.permission.AD_ID') &&
    !manifest.includes('android.permission.AD_ID'),
  'Advertising ID permission requires a new ads/Data Safety review.',
);

requireMatch(
  gradle.includes("implementation 'com.google.firebase:firebase-crashlytics'") &&
    gradle.includes("implementation 'com.google.firebase:firebase-messaging'"),
  'Firebase SDK inventory changed; review Data Safety declarations.',
);

for (const heading of [
  'Data Safety worksheet',
  'Firebase Cloud Messaging',
  'Firebase Crashlytics',
  'Account creation: Yes',
  'external deletion resource',
]) {
  requireMatch(
    worksheet.toLowerCase().includes(heading.toLowerCase()),
    `Step 16 worksheet is incomplete: ${heading}`,
  );
}

console.log('Data Safety consistency gate: PASS');
console.log('Privacy/provider disclosures: PASS');
console.log('UGC terms/moderation wording: PASS');
console.log('Account deletion disclosure: PASS');
console.log('Ads/Analytics guard: PASS');
