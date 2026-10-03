import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

function read(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing final-release file: ${relativePath}`);
  }
  return fs.readFileSync(full, 'utf8');
}

function requireMatch(condition, message) {
  if (!condition) throw new Error(message);
}

function parseProperties(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        if (index < 1) throw new Error(`Invalid properties line: ${line}`);
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const version = parseProperties(read('apps/android/version.properties'));
const history = JSON.parse(read('apps/android/play-upload-history.json'));
const gradle = read('apps/android/app/build.gradle');
const manifest = read('apps/android/app/src/main/AndroidManifest.xml');
const signer = read('apps/android/build-signed-release.ps1');

const versionCode = Number(version.VERSION_CODE);
const versionName = version.VERSION_NAME;
const highestUploaded = Number(history.highestKnownUploadedVersionCode);

requireMatch(Number.isInteger(versionCode) && versionCode > 0, 'Invalid Android VERSION_CODE.');
requireMatch(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName), 'Invalid Android VERSION_NAME.');
requireMatch(
  Number.isInteger(highestUploaded) && versionCode > highestUploaded,
  `Candidate versionCode ${versionCode} must be higher than highest known uploaded versionCode ${highestUploaded}.`,
);
requireMatch(
  history.packageName === 'in.fcarena.app',
  'Play upload history package does not match FC ARENA.',
);
requireMatch(
  Number(history.nextCandidateVersionCode) === versionCode &&
    history.nextCandidateVersionName === versionName,
  'version.properties and play-upload-history candidate do not match.',
);

const targetSdk = Number(gradle.match(/targetSdk\s+(\d+)/)?.[1]);
const compileSdk = Number(gradle.match(/compileSdk\s+(\d+)/)?.[1]);
requireMatch(targetSdk >= 36, `Final Google Play gate requires targetSdk 36+; found ${targetSdk}.`);
requireMatch(compileSdk >= 36, `compileSdk 36+ required; found ${compileSdk}.`);
requireMatch(gradle.includes("applicationId 'in.fcarena.app'"), 'Android package ID changed.');
requireMatch(manifest.includes('android:usesCleartextTraffic="false"'), 'Cleartext traffic must remain disabled.');
requireMatch(!manifest.includes('android.permission.AD_ID'), 'Unexpected Advertising ID permission.');

for (const requiredPath of [
  'docs/readiness/step-16-privacy-data-safety.md',
  'docs/readiness/step-17-play-final-audit.md',
  'docs/readiness/step-18-release-system.md',
  'docs/readiness/step-19-rollback-dr.md',
  'ops/rollback/check-readiness.sh',
]) {
  requireMatch(fs.existsSync(path.join(root, requiredPath)), `Missing release prerequisite: ${requiredPath}`);
}

for (const token of [
  'sourceCommit=',
  'uploadCertificateSHA256=',
  'fileSHA256=',
  'ExpectedUploadFingerprint',
]) {
  requireMatch(signer.includes(token), `Signed release helper is missing artifact traceability control: ${token}`);
}

// Reuse the dedicated policy gates rather than duplicating their detailed logic.
execFileSync(process.execPath, ['scripts/check-play-store-compliance.mjs'], {
  cwd: root,
  stdio: 'inherit',
});
execFileSync(process.execPath, ['scripts/check-data-safety.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

if (process.env.FC_ARENA_ENFORCE_CLEAN_MAIN === 'true') {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  requireMatch(branch === 'main', `Final artifact must be built from main; current branch is ${branch}.`);

  execFileSync('git', ['fetch', 'origin', 'main', '--quiet'], { cwd: root });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const originMain = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
  requireMatch(head === originMain, 'Local main is not current origin/main.');

  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  requireMatch(!dirty, 'Tracked/staged files are dirty. Freeze source before final artifact build.');
}

console.log('FC_ARENA_FINAL_RELEASE_GATE=PASS');
console.log(`package=in.fcarena.app versionCode=${versionCode} versionName=${versionName}`);
console.log(`highestKnownPlayVersionCode=${highestUploaded}`);
