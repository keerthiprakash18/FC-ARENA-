import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSecurityEnv } from '../scripts/check-security-env.mjs';
const valid = { NODE_ENV: 'production', JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40), DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1/test', WEB_ORIGIN: 'https://fcarena.in,https://www.fcarena.in' };
test('accepts the production contract without changing or returning values', () => {
  const original = { ...valid };
  assert.deepEqual(checkSecurityEnv(valid), { errors: [], warnings: [] });
  assert.deepEqual(valid, original);
});
test('rejects unsafe configuration with value-free diagnostics', () => {
  for (const change of [
    { NODE_ENV: 'development' }, { JWT_ACCESS_SECRET: 'short' },
    { JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET }, { NEXT_PUBLIC_JWT_SECRET: 'private-fixture-value' },
    { WEB_ORIGIN: '*' }, { WEB_ORIGIN: 'https://fcarena.in.evil.test/path' },
    { DATABASE_URL: 'private-fixture-value' }, { NODE_OPTIONS: '--inspect=0.0.0.0' },
    { NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { TRUST_PROXY_HOPS: 'invalid' },
    { PUSH_ENABLED: 'true', FIREBASE_ADMIN_CREDENTIALS_JSON: 'private-fixture-value' },
  ]) {
    const report = checkSecurityEnv({ ...valid, ...change });
    assert.ok(report.errors.length > 0);
    assert.ok(!JSON.stringify(report).includes('private-fixture-value'));
  }
});
test('flags remote database TLS for operational review', () => {
  assert.equal(checkSecurityEnv({ ...valid, DATABASE_URL: 'postgresql://fixture:fixture@database.example.com/test' }).warnings.length, 1);
});
