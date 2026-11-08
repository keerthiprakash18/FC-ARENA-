import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { replaceBrevoKey, verifyBrevoKey } from '../ops/mail/repair-brevo.mjs';

const key = 'xkeysib-local-test-fixture-value';

test('replaces duplicate keys while preserving unrelated production settings', () => {
  const source = '# production\r\nDATABASE_URL="postgresql://fixture@localhost/test"\r\nBREVO_API_KEY=old\r\nMAIL_FROM_NAME="FC ARENA"\r\nexport BREVO_API_KEY = invalid\r\n';
  const result = replaceBrevoKey(source, key);
  const { BREVO_API_KEY: _before, ...before } = dotenv.parse(source);
  const { BREVO_API_KEY: afterKey, ...after } = dotenv.parse(result);
  assert.deepEqual(after, before);
  assert.equal(afterKey, key);
  assert.equal(result.match(/^BREVO_API_KEY=/gm).length, 1);
  assert.equal(result.replaceAll('\r\n', '').includes('\n'), false);
});

test('rejects pasted assignments, quotes and multiline input', () => {
  for (const value of [`BREVO_API_KEY=${key}`, `"${key}"`, `${key}\nINJECTED=value`, '']) {
    assert.throws(() => replaceBrevoKey('', value));
  }
});

test('validates with a read-only transactional endpoint', async () => {
  await verifyBrevoKey(key, async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=1');
    assert.equal(options.method, undefined);
    assert.equal(options.headers['api-key'], key);
    return new Response('{}');
  });
});

test('provider errors never expose the supplied key or raw response', async () => {
  await assert.rejects(verifyBrevoKey(key, async () => new Response(
    JSON.stringify({ message: `Private provider detail ${key}` }), { status: 401 },
  )), error => {
    assert.match(error.message, /HTTP 401/);
    assert.ok(!error.message.includes(key));
    assert.ok(!error.message.includes('Private provider detail'));
    return true;
  });
});
