# Production Readiness Step 10 — Load & Stress Testing

Status: COMPLETE — isolated real-API acceptance passed for baseline, 50, 100, 250 and 500 VU profiles. No production stress traffic was generated.

Repository: `keerthiprakash18/FC-ARENA-`

This step adds a repeatable, read-focused load-testing harness and a read-only server observer. It deliberately does **not** perform aggressive testing against the live FC Arena production service and does not mutate real user data.

## What is included

- `scripts/load-test.mjs`
  - Node 24, dependency-free load harness.
  - Profiles: baseline, 50, 100, 250 and 500 virtual users.
  - Measures request count, error rate, requests/second, p50, p95, p99 and max latency.
  - Records per-scenario status-code distribution.
  - Captures health snapshots before and after a run: DB latency, Redis latency, API RSS/heap and release SHA when exposed by `/api/health`.
  - Protected endpoints use an already-issued test access token; the harness never performs bulk login attempts.
  - All generated traffic is GET-only.
  - Production is blocked by default.
  - Remote staging/test targets require explicit `LOAD_TEST_ALLOW_REMOTE=true`.
  - A production exception exists only for a tiny health-only smoke: <=2 VUs, <=5 seconds, <=2 RPS and <=10 requests.
  - Optional output JSON is written with mode 0600.

- `ops/load/observe.sh`
  - Read-only host/VPS observer intended for an approved staging/test host.
  - Records host load, memory %, disk %, PostgreSQL connection count and Redis connected-client count to CSV.
  - Reads database/Redis metrics inside the existing containers without printing credentials.
  - Does not restart, mutate, reset or restore any service.

- `tests/load-test.test.mjs`
  - Verifies percentile calculations, scenario selection, remote-target opt-in, production blocking and a real local HTTP load run.

- `.github/workflows/load-test-verify.yml`
  - Validates all five profiles in dry-run mode.
  - Runs the local load-harness tests.
  - Verifies production is blocked by default.
  - Syntax-checks the VPS observer.

## Staged profiles

| Profile | Virtual users | Default duration | Default target RPS |
| --- | ---: | ---: | ---: |
| baseline | 5 | 10 s | 5 |
| 50 | 50 | 20 s | 10 |
| 100 | 100 | 20 s | 15 |
| 250 | 250 | 30 s | 20 |
| 500 | 500 | 30 s | 20 |

The protected API has an application-wide IP quota of 1,200 requests/minute, approximately 20 requests/second from one source IP. The default protected-route profiles therefore intentionally remain near or below that policy ceiling. A single-runner test above that level primarily measures rate-limit behavior, not raw backend capacity.

For raw backend capacity beyond the per-IP policy, use distributed **staging-only** runners with separate approved source IPs or a dedicated isolated test environment. Do not disable or bypass the production rate limiter for benchmarking.

## Default scenarios

With no token, only:

- `GET /api/health`

With `LOAD_TEST_ACCESS_TOKEN` from an isolated staging/test account:

- `GET /api/auth/me`
- `GET /api/players/me/dashboard`
- `GET /api/leagues/my`
- `GET /api/awards/overview`

When `LOAD_TEST_LEAGUE_ID` is supplied:

- `GET /api/leagues/:leagueId/tournaments`

When `LOAD_TEST_TOURNAMENT_ID` is supplied:

- `GET /api/tournaments/:tournamentId/fixtures`
- `GET /api/tournaments/:tournamentId/standings`
- `GET /api/tournaments/:tournamentId/award-races`

Notification retrieval is excluded by default because the existing `GET /api/notifications` path performs notification synchronization and can create/upsert deduplicated notification rows. It can be enabled only for isolated test accounts with:

`LOAD_TEST_INCLUDE_NOTIFICATION_SYNC=true`

No write endpoint is included in the harness.

## Thresholds

Default acceptance thresholds for the mixed read suite:

- Error rate <= 1%
- Overall p95 <= 1,000 ms
- p99 is recorded for diagnosis
- HTTP 429 counts as an error and remains visible in `statusCounts`

These are initial release-readiness thresholds, not permanent SLOs. Representative staging data should be used to tune them.

## Safe local verification

```bash
npm run load:test:verify
```

Dry-run a profile without sending any request:

```bash
LOAD_TEST_PROFILE=500 LOAD_TEST_DRY_RUN=true npm run load:test
```

Local API baseline:

```bash
LOAD_TEST_BASE_URL=http://127.0.0.1:4000 \
LOAD_TEST_PROFILE=baseline \
npm run load:test
```

## Approved staging run

Use an isolated test account and inject its access token through the shell/environment without committing it or pasting it into chat/logs.

Example:

```bash
export LOAD_TEST_BASE_URL="https://staging-api.example.test"
export LOAD_TEST_ALLOW_REMOTE=true
export LOAD_TEST_PROFILE=50
export LOAD_TEST_ACCESS_TOKEN="<set securely in local shell>"
export LOAD_TEST_LEAGUE_ID="<staging league id>"
export LOAD_TEST_TOURNAMENT_ID="<staging tournament id>"
export LOAD_TEST_OUTPUT="/tmp/fcarena-load-50.json"
npm run load:test
```

Then repeat in order:

1. `LOAD_TEST_PROFILE=baseline`
2. `LOAD_TEST_PROFILE=50`
3. `LOAD_TEST_PROFILE=100`
4. `LOAD_TEST_PROFILE=250`
5. `LOAD_TEST_PROFILE=500`

Stop escalation if:
- sustained error rate exceeds the agreed threshold,
- p95/p99 rises sharply,
- DB/Redis latency becomes unstable,
- memory continuously grows,
- host load or DB connections approach unsafe limits,
- 5xx errors appear.

Do not continue to the next profile merely to complete the list.

## Server-side observation

On the approved staging/test host, run this in a separate shell before the load run:

```bash
cd /opt/fcarena
LOAD_OBSERVER_SAMPLES=24 \
LOAD_OBSERVER_INTERVAL_SECONDS=5 \
LOAD_OBSERVER_OUTPUT=/tmp/fcarena-load-observer.csv \
bash ops/load/observe.sh
```

This captures roughly two minutes of host/DB/Redis observations.

Columns:
- UTC timestamp
- 1-minute host load average
- host memory used %
- root filesystem used %
- PostgreSQL active/all connection count
- Redis connected clients

The API health snapshots embedded in the load-test JSON separately provide:
- database health latency
- Redis health latency
- API RSS memory
- API heap usage
- deployed release SHA when configured

## Production safety

The harness refuses `fcarena.in`, `www.fcarena.in` and `api.fcarena.in` by default.

A production health-only smoke requires all of:

```bash
LOAD_TEST_BASE_URL=https://api.fcarena.in
LOAD_TEST_ALLOW_PRODUCTION_SMOKE=true
LOAD_TEST_VUS=2
LOAD_TEST_DURATION_SECONDS=5
LOAD_TEST_TARGET_RPS=2
LOAD_TEST_MAX_REQUESTS=10
```

Do not supply an access token for the production smoke. This mode is health-only and is not a capacity benchmark.

## Evidence checklist for future production-like staging revalidation

For each staging profile retain:

- load-test JSON
- observer CSV
- dataset/test-account description without secrets
- staging release SHA
- VU/profile
- p50/p95/p99
- requests/sec
- error rate and HTTP status breakdown
- DB latency
- Redis latency
- API RSS/heap
- PostgreSQL connection peak
- Redis client peak
- host load/memory peak
- any 429/5xx/timeouts
- decision: PASS / STOP / INVESTIGATE


## Acceptance evidence — 2026-10-03

The final Step 10 acceptance ran the real built Nest API against disposable GitHub Actions PostgreSQL 16 and Redis 7 services. It seeded one isolated test account, Player profile, League membership and SOLO Tournament, signed a short-lived test access JWT, exercised the mixed read suite, and deleted the disposable data afterward. Production FC Arena infrastructure and real user data were not used.

| Profile | VUs | Observed RPS | Requests | Errors | p50 | p95 | p99 | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 5 | 5.10 | 51 | 0 | 8.60 ms | 28.74 ms | 118.22 ms | PASS |
| 50 | 50 | 10.05 | 201 | 0 | 6.61 ms | 22.84 ms | 24.48 ms | PASS |
| 100 | 100 | 15.05 | 301 | 0 | 6.09 ms | 20.72 ms | 22.71 ms | PASS |
| 250 | 250 | 20.03 | 601 | 0 | 5.68 ms | 20.17 ms | 23.08 ms | PASS |
| 500 | 500 | 20.03 | 600 | 0 | 5.60 ms | 19.50 ms | 21.65 ms | PASS |

All five profiles completed with zero request errors and stayed below the configured 1,500 ms p95 acceptance limit. The harness pacing was corrected before the final run so VU starts are distributed across the configured rate instead of producing an artificial end-of-profile burst.

This acceptance proves the load harness, authorization path, representative read routes, API/DB/Redis integration and application rate-policy behavior in an isolated environment. It does **not** claim that the production VPS can sustain 500 simultaneous active requests or more than the configured ~20 protected requests/second per source IP; production capacity remains bounded by real hardware, production dataset size, network conditions and the intentional global rate limiter.

## Current known capacity constraint

The global protected API limiter allows 1,200 requests per source IP per minute. Therefore a single-source protected-route benchmark naturally reaches the application policy boundary around 20 RPS. This is expected protection behavior and should not be misreported as database/server saturation.

A staging run is still required to identify the next real bottleneck under representative data: query latency, DB connection pressure, Redis latency, API memory, CPU saturation, or request fan-out.

No production load test, production-data mutation, Android version change, signed AAB, DB reset, secret rotation or rate-limit bypass is part of Step 10.
