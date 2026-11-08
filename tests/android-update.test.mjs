import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const source = stripTypeScriptTypes(readFileSync(new URL('../apps/web/src/lib/android-update.ts', import.meta.url), 'utf8'), { mode: 'transform' });
const { androidUpdateNotice, installedAndroidVersion, updateIsSnoozed, UPDATE_SNOOZE_MS } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const policy = { updateAvailable: true, latest: { versionCode: 20, versionName: '1.0.18' } };
test('only actual native app agents expose an installed version', () => {
  assert.equal(installedAndroidVersion('Chrome Android 14 FC-Arena-Android/1.0.17'), '1.0.17');
  for (const value of ['Chrome Android 14', 'FC-Arena-Android/1.0', 'FakeFC-Arena-Android/1.0.17']) assert.equal(installedAndroidVersion(value), null);
});
test('published policy works for older apps and absent releases stay hidden', () => {
  assert.deepEqual(androidUpdateNotice(policy), { key: 'code:20', versionName: '1.0.18' });
  assert.equal(androidUpdateNotice({ updateAvailable: false, latest: null }), null);
});
test('Play eligibility overrides global server policy for account-specific rollout', () => {
  assert.equal(androidUpdateNotice(policy, { checked: true, available: false, installedVersionCode: 19, availableVersionCode: 0 }), null);
  assert.deepEqual(androidUpdateNotice(null, { checked: true, available: true, installedVersionCode: 20, availableVersionCode: 21 }), { key: 'code:21', versionName: null });
  assert.equal(androidUpdateNotice(policy, { checked: true, available: true, installedVersionCode: 20, availableVersionCode: 20 }), null);
});
test('Later applies to one version for twelve hours and cannot suppress subsequent releases', () => {
  const raw = JSON.stringify({ key: 'code:20', until: 1_000 + UPDATE_SNOOZE_MS });
  assert.equal(updateIsSnoozed(raw, 'code:20', 1_000), true);
  assert.equal(updateIsSnoozed(raw, 'code:21', 1_000), false);
  assert.equal(updateIsSnoozed(raw, 'code:20', 1_000 + UPDATE_SNOOZE_MS), false);
  for (const value of ['bad JSON', 'null', JSON.stringify({ key: 'code:20', until: 1e18 })]) assert.equal(updateIsSnoozed(value, 'code:20', 1_000), false);
});
