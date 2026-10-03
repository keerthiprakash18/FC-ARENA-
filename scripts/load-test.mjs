import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

export const PROFILES = Object.freeze({
  baseline: { vus: 5, durationSeconds: 10, targetRps: 5 },
  '50': { vus: 50, durationSeconds: 20, targetRps: 10 },
  '100': { vus: 100, durationSeconds: 20, targetRps: 15 },
  '250': { vus: 250, durationSeconds: 30, targetRps: 20 },
  '500': { vus: 500, durationSeconds: 30, targetRps: 20 },
});

const PRODUCTION_HOSTS = new Set([
  'fcarena.in',
  'www.fcarena.in',
  'api.fcarena.in',
]);

function bool(value) {
  return String(value ?? '').toLowerCase() === 'true';
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

export function classifyTarget(rawUrl) {
  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase();
  const loopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';
  const production = PRODUCTION_HOSTS.has(hostname);
  return { url, hostname, loopback, production };
}

function normalizePath(path) {
  const trimmed = String(path ?? '').trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('/api/')) {
    throw new Error(`Load-test paths must start with /api/: ${trimmed}`);
  }
  return trimmed;
}

export function buildScenarios(env = process.env) {
  const scenarios = [{ name: 'health', path: '/api/health', auth: false }];
  const accessToken = env.LOAD_TEST_ACCESS_TOKEN?.trim();

  if (accessToken) {
    scenarios.push(
      { name: 'auth-me', path: '/api/auth/me', auth: true },
      { name: 'dashboard', path: '/api/players/me/dashboard', auth: true },
      { name: 'leagues', path: '/api/leagues/my', auth: true },
      { name: 'awards-overview', path: '/api/awards/overview', auth: true },
    );

    // GET /notifications synchronizes materialized notifications and can write
    // deduplicated rows. Keep it opt-in and use only isolated test accounts.
    if (bool(env.LOAD_TEST_INCLUDE_NOTIFICATION_SYNC)) {
      scenarios.push({
        name: 'notifications-sync',
        path: '/api/notifications',
        auth: true,
      });
    }

    const leagueId = env.LOAD_TEST_LEAGUE_ID?.trim();
    if (leagueId) {
      scenarios.push({
        name: 'league-tournaments',
        path: `/api/leagues/${encodeURIComponent(leagueId)}/tournaments`,
        auth: true,
      });
    }

    const tournamentId = env.LOAD_TEST_TOURNAMENT_ID?.trim();
    if (tournamentId) {
      const id = encodeURIComponent(tournamentId);
      scenarios.push(
        { name: 'fixtures', path: `/api/tournaments/${id}/fixtures`, auth: true },
        { name: 'standings', path: `/api/tournaments/${id}/standings`, auth: true },
        { name: 'award-races', path: `/api/tournaments/${id}/award-races`, auth: true },
      );
    }
  }

  const extra = String(env.LOAD_TEST_EXTRA_PATHS ?? '')
    .split(',')
    .map(normalizePath)
    .filter(Boolean);

  for (const [index, path] of extra.entries()) {
    scenarios.push({
      name: `extra-${index + 1}`,
      path,
      auth: Boolean(accessToken),
    });
  }

  return scenarios;
}

export function resolvePlan(env = process.env) {
  const profileName = String(env.LOAD_TEST_PROFILE ?? 'baseline');
  const profile = PROFILES[profileName];
  if (!profile) {
    throw new Error(
      `Unknown LOAD_TEST_PROFILE "${profileName}". Use baseline, 50, 100, 250, or 500.`,
    );
  }

  const baseUrl = String(env.LOAD_TEST_BASE_URL ?? 'http://127.0.0.1:4000');
  const target = classifyTarget(baseUrl);
  const scenarios = buildScenarios(env);

  const plan = {
    profile: profileName,
    baseUrl: target.url.origin,
    vus: Math.floor(positiveNumber(env.LOAD_TEST_VUS, profile.vus)),
    durationSeconds: positiveNumber(
      env.LOAD_TEST_DURATION_SECONDS,
      profile.durationSeconds,
    ),
    targetRps: positiveNumber(env.LOAD_TEST_TARGET_RPS, profile.targetRps),
    timeoutMs: positiveNumber(env.LOAD_TEST_TIMEOUT_MS, 5_000),
    maxRequests: Math.floor(positiveNumber(env.LOAD_TEST_MAX_REQUESTS, 100_000)),
    p95LimitMs: positiveNumber(env.LOAD_TEST_P95_LIMIT_MS, 1_000),
    maxErrorRate: positiveNumber(env.LOAD_TEST_MAX_ERROR_RATE, 0.01),
    allowRemote: bool(env.LOAD_TEST_ALLOW_REMOTE),
    allowProductionSmoke: bool(env.LOAD_TEST_ALLOW_PRODUCTION_SMOKE),
    accessToken: env.LOAD_TEST_ACCESS_TOKEN?.trim() || null,
    outputPath: env.LOAD_TEST_OUTPUT?.trim() || null,
    dryRun: bool(env.LOAD_TEST_DRY_RUN),
    scenarios,
    target,
  };

  assertSafePlan(plan);
  return plan;
}

export function assertSafePlan(plan) {
  if (!plan.target.loopback && !plan.target.production && !plan.allowRemote) {
    throw new Error(
      'Remote load tests are disabled by default. Set LOAD_TEST_ALLOW_REMOTE=true only for an approved staging/test target.',
    );
  }

  if (plan.target.production) {
    const healthOnly =
      plan.scenarios.length === 1 && plan.scenarios[0]?.path === '/api/health';

    if (!plan.allowProductionSmoke) {
      throw new Error(
        'Production load testing is blocked. Use staging/local. A tiny health-only smoke requires LOAD_TEST_ALLOW_PRODUCTION_SMOKE=true.',
      );
    }

    if (
      !healthOnly ||
      plan.vus > 2 ||
      plan.durationSeconds > 5 ||
      plan.targetRps > 2 ||
      plan.maxRequests > 10
    ) {
      throw new Error(
        'Production safety limit: health-only, <=2 VUs, <=5 seconds, <=2 RPS, <=10 requests.',
      );
    }
  }

  if (plan.vus > 1_000) {
    throw new Error('Refusing more than 1000 virtual users in this harness.');
  }

  if (plan.targetRps > 2_000) {
    throw new Error('Refusing target RPS above 2000.');
  }
}

function metricSummary(samples) {
  const latencies = samples.map((sample) => sample.latencyMs);
  const errors = samples.filter((sample) => !sample.ok).length;
  const statusCounts = {};

  for (const sample of samples) {
    const key = String(sample.status);
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }

  return {
    requests: samples.length,
    errors,
    errorRate: samples.length ? Number((errors / samples.length).toFixed(4)) : 0,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    maxMs: latencies.length ? Number(Math.max(...latencies).toFixed(2)) : 0,
    statusCounts,
  };
}

async function requestOnce(plan, scenario) {
  const started = performance.now();
  const headers = { Accept: 'application/json' };

  if (scenario.auth) {
    if (!plan.accessToken) {
      throw new Error(`Scenario ${scenario.name} requires LOAD_TEST_ACCESS_TOKEN.`);
    }
    headers.Authorization = `Bearer ${plan.accessToken}`;
  }

  const url = new URL(scenario.path, plan.baseUrl);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(plan.timeoutMs),
    });
    await response.arrayBuffer();
    return {
      scenario: scenario.name,
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
      latencyMs: Number((performance.now() - started).toFixed(2)),
    };
  } catch (error) {
    return {
      scenario: scenario.name,
      status: 'ERR',
      ok: false,
      latencyMs: Number((performance.now() - started).toFixed(2)),
      error: error instanceof Error ? error.name : 'RequestError',
    };
  }
}

async function healthSnapshot(plan) {
  if (plan.target.production && !plan.allowProductionSmoke) return null;
  const started = performance.now();
  try {
    const response = await fetch(new URL('/api/health', plan.baseUrl), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.min(plan.timeoutMs, 5_000)),
    });
    const body = await response.json().catch(() => null);
    const data = body?.data;
    return {
      status: response.status,
      latencyMs: Number((performance.now() - started).toFixed(2)),
      databaseLatencyMs: data?.checks?.database?.latencyMs ?? null,
      redisLatencyMs: data?.checks?.redis?.latencyMs ?? null,
      rssMb: data?.runtime?.memory?.rssMb ?? null,
      heapUsedMb: data?.runtime?.memory?.heapUsedMb ?? null,
      release: data?.runtime?.release ?? null,
    };
  } catch {
    return { status: 'ERR', latencyMs: Number((performance.now() - started).toFixed(2)) };
  }
}

export async function runLoadTest(plan) {
  if (plan.dryRun) {
    return {
      dryRun: true,
      plan: {
        profile: plan.profile,
        baseUrl: plan.baseUrl,
        vus: plan.vus,
        durationSeconds: plan.durationSeconds,
        targetRps: plan.targetRps,
        maxRequests: plan.maxRequests,
        scenarios: plan.scenarios.map(({ name, path, auth }) => ({ name, path, auth })),
      },
    };
  }

  const before = await healthSnapshot(plan);
  const samples = [];
  const started = performance.now();
  const deadline = started + plan.durationSeconds * 1_000;
  const intervalPerVuMs = Math.max(0, (plan.vus / plan.targetRps) * 1_000);
  const startSpreadMs = Math.min(
    plan.durationSeconds * 1_000,
    intervalPerVuMs,
  );
  let issued = 0;

  const workers = Array.from({ length: plan.vus }, (_, workerIndex) =>
    (async () => {
      // Spread VU starts across one per-VU interval so a rate-controlled
      // profile does not become an artificial first-second thundering herd.
      const initialDelayMs =
        plan.vus > 1 ? (workerIndex / plan.vus) * startSpreadMs : 0;
      if (initialDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, initialDelayMs));
      }

      let iteration = 0;
      while (performance.now() < deadline && issued < plan.maxRequests) {
        const iterationStarted = performance.now();
        const requestNumber = issued++;
        if (requestNumber >= plan.maxRequests) break;

        const scenario =
          plan.scenarios[(workerIndex + iteration) % plan.scenarios.length];
        samples.push(await requestOnce(plan, scenario));
        iteration += 1;

        const elapsed = performance.now() - iterationStarted;
        const waitMs = intervalPerVuMs - elapsed;
        if (waitMs > 0) {
          const remainingMs = deadline - performance.now();
          if (waitMs >= remainingMs) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    })(),
  );

  await Promise.all(workers);
  const elapsedSeconds = Math.max(0.001, (performance.now() - started) / 1_000);
  const after = await healthSnapshot(plan);
  const overall = metricSummary(samples);
  const byScenario = {};

  for (const scenario of plan.scenarios) {
    byScenario[scenario.name] = metricSummary(
      samples.filter((sample) => sample.scenario === scenario.name),
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    target: {
      baseUrl: plan.baseUrl,
      production: plan.target.production,
    },
    profile: {
      name: plan.profile,
      vus: plan.vus,
      durationSeconds: plan.durationSeconds,
      targetRps: plan.targetRps,
      elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    },
    overall: {
      ...overall,
      requestsPerSecond: Number((overall.requests / elapsedSeconds).toFixed(2)),
    },
    byScenario,
    health: { before, after },
    thresholds: {
      p95LimitMs: plan.p95LimitMs,
      maxErrorRate: plan.maxErrorRate,
      pass:
        overall.p95Ms <= plan.p95LimitMs &&
        overall.errorRate <= plan.maxErrorRate,
    },
  };

  if (plan.outputPath) {
    await writeFile(plan.outputPath, `${JSON.stringify(summary, null, 2)}\n`, {
      mode: 0o600,
    });
  }

  return summary;
}

async function main() {
  const plan = resolvePlan(process.env);
  const result = await runLoadTest(plan);
  console.log(JSON.stringify(result, null, 2));

  if (!result.dryRun && !result.thresholds?.pass) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
