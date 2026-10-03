import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  buildScenarios,
  percentile,
  resolvePlan,
  runLoadTest,
} from '../scripts/load-test.mjs';

test('percentile uses nearest-rank values', () => {
  assert.equal(percentile([10, 20, 30, 40], 0.5), 20);
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
});

test('protected scenarios are added only when an access token is supplied', () => {
  assert.deepEqual(buildScenarios({}).map((item) => item.name), ['health']);
  const names = buildScenarios({
    LOAD_TEST_ACCESS_TOKEN: 'redacted-test-token',
    LOAD_TEST_LEAGUE_ID: 'league-1',
    LOAD_TEST_TOURNAMENT_ID: 'tournament-1',
  }).map((item) => item.name);
  assert.ok(names.includes('dashboard'));
  assert.ok(names.includes('leagues'));
  assert.ok(names.includes('fixtures'));
  assert.ok(names.includes('standings'));
  assert.ok(names.includes('award-races'));
});

test('remote staging requires explicit opt-in', () => {
  assert.throws(
    () =>
      resolvePlan({
        LOAD_TEST_BASE_URL: 'https://staging.example.test',
      }),
    /LOAD_TEST_ALLOW_REMOTE=true/,
  );

  assert.doesNotThrow(() =>
    resolvePlan({
      LOAD_TEST_BASE_URL: 'https://staging.example.test',
      LOAD_TEST_ALLOW_REMOTE: 'true',
      LOAD_TEST_DRY_RUN: 'true',
    }),
  );
});

test('production is blocked except for a tiny health-only smoke', () => {
  assert.throws(
    () =>
      resolvePlan({
        LOAD_TEST_BASE_URL: 'https://api.fcarena.in',
      }),
    /Production load testing is blocked/,
  );

  assert.doesNotThrow(() =>
    resolvePlan({
      LOAD_TEST_BASE_URL: 'https://api.fcarena.in',
      LOAD_TEST_ALLOW_PRODUCTION_SMOKE: 'true',
      LOAD_TEST_VUS: '2',
      LOAD_TEST_DURATION_SECONDS: '5',
      LOAD_TEST_TARGET_RPS: '2',
      LOAD_TEST_MAX_REQUESTS: '10',
      LOAD_TEST_DRY_RUN: 'true',
    }),
  );

  assert.throws(
    () =>
      resolvePlan({
        LOAD_TEST_BASE_URL: 'https://api.fcarena.in',
        LOAD_TEST_ALLOW_PRODUCTION_SMOKE: 'true',
        LOAD_TEST_ACCESS_TOKEN: 'never-log-this',
        LOAD_TEST_VUS: '2',
        LOAD_TEST_DURATION_SECONDS: '5',
        LOAD_TEST_TARGET_RPS: '2',
        LOAD_TEST_MAX_REQUESTS: '10',
      }),
    /Production safety limit/,
  );
});

test('local harness records latency, throughput and health without writes', async () => {
  const server = http.createServer((request, response) => {
    assert.equal(request.method, 'GET');
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        success: true,
        data: {
          checks: {
            database: { latencyMs: 2 },
            redis: { latencyMs: 1 },
          },
          runtime: {
            memory: { rssMb: 120, heapUsedMb: 40 },
            release: 'test-release',
          },
        },
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    const plan = resolvePlan({
      LOAD_TEST_BASE_URL: `http://127.0.0.1:${address.port}`,
      LOAD_TEST_VUS: '2',
      LOAD_TEST_DURATION_SECONDS: '0.6',
      LOAD_TEST_TARGET_RPS: '8',
      LOAD_TEST_MAX_REQUESTS: '20',
      LOAD_TEST_P95_LIMIT_MS: '1000',
      LOAD_TEST_MAX_ERROR_RATE: '0.01',
    });

    const result = await runLoadTest(plan);
    assert.ok(result.overall.requests > 0);
    assert.equal(result.overall.errors, 0);
    assert.ok(result.overall.requestsPerSecond > 0);
    assert.ok(result.overall.p95Ms >= 0);
    assert.equal(result.health.before.release, 'test-release');
    assert.equal(result.thresholds.pass, true);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
