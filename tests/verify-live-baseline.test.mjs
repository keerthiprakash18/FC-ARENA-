import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readExpectedReleases, verifyLiveBaseline } from '../scripts/verify-live-baseline.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const expected = { web: A, api: B };

function mockFetch({ web = A, api = B, status = 'healthy', db = 'connected', success = true, code = 200 } = {}) {
  return async (url, init) => {
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.accept, 'application/json');
    return {
      ok: code === 200,
      status: code,
      async json() {
        return url.includes('web-release')
          ? { release: web }
          : { success, data: { runtime: { release: api }, status, database: db } };
      },
    };
  };
}

test('snapshot release manifest is parsed with valid SHA identities', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-release-'));
  try {
    const file = path.join(directory, 'manifest.json');
    fs.writeFileSync(file, JSON.stringify({ release: expected }));
    assert.deepEqual(readExpectedReleases(file, {}), expected);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('operators can pin both expected identities via environment', () => {
  assert.deepEqual(readExpectedReleases('/missing', {
    FC_ARENA_EXPECTED_WEB_RELEASE: A,
    FC_ARENA_EXPECTED_API_RELEASE: B,
  }), expected);
  assert.throws(() => readExpectedReleases('/missing', { FC_ARENA_EXPECTED_WEB_RELEASE: A }), /Both expected/);
});

test('matching production identities and healthy API pass', async () => {
  const result = await verifyLiveBaseline({ expected, fetchImpl: mockFetch() });
  assert.deepEqual(result, { web: A, api: B, apiStatus: 'healthy' });
});

test('degraded API remains visible, does not mask release match', async () => {
  const result = await verifyLiveBaseline({ expected, fetchImpl: mockFetch({ status: 'degraded' }) });
  assert.equal(result.apiStatus, 'degraded');
});

test('changed live web identity blocks a deployment', async () => {
  await assert.rejects(verifyLiveBaseline({ expected, fetchImpl: mockFetch({ web: C }) }), /Release drift/);
});

test('changed live API identity blocks a deployment', async () => {
  await assert.rejects(verifyLiveBaseline({ expected, fetchImpl: mockFetch({ api: C }) }), /Release drift/);
});

test('an API without release identity blocks a deployment', async () => {
  await assert.rejects(verifyLiveBaseline({ expected, fetchImpl: mockFetch({ api: null }) }), /Missing or invalid/);
});

test('unavailable database blocks a deployment', async () => {
  await assert.rejects(verifyLiveBaseline({ expected, fetchImpl: mockFetch({ db: 'unavailable' }) }), /database/);
});

test('HTTP 503 blocks a deployment', async () => {
  await assert.rejects(verifyLiveBaseline({ expected, fetchImpl: mockFetch({ code: 503 }) }), /HTTP 503/);
});

test('noncanonical HTTP host is forbidden', async () => {
  await assert.rejects(verifyLiveBaseline({ expected, fetchImpl: mockFetch(), webUrl: 'http://localhost:3000/web-release' }), /canonical/);
});

test('invalid expected identity blocks even if remote looks valid', async () => {
  await assert.rejects(verifyLiveBaseline({ expected: { web: 'unknown', api: B }, fetchImpl: mockFetch() }), /40-character/);
});
