# FC ARENA NEXT — QA, security and performance evidence (26 Nov 2026)

This ledger separates verified inherited CI, local verification of the continuation,
and work that still requires a frozen final candidate. It is not a whole-product
acceptance certificate or production deployment approval.

## Build identity and environments

- Inherited integration candidate: `ec3b26e72eac57ed66f46aac5d733f75c6a9cff0`,
  [draft PR #228](https://github.com/keerthiprakash18/FC-ARENA-/pull/228).
- Continuation workspace: `.tmp-release/next-completion`, branch
  `codex/fc-arena-next-completion-20261126`. Final continuation commit and pipeline
  must be recorded after the changes are committed; inherited CI does not cover
  subsequent edits.
- Local host: Windows, Node `24.18.0`, npm `12.1.0`, Python `3.13.7`.
- Browser verification: installed Chrome, Playwright `1.58.2`, local production
  preview `http://127.0.0.1:3109`. The browser harness intercepts API traffic with
  synthetic accounts and fixtures; no production account or database was used.

## Local execution

| Verification | Observed result | Scope and limits |
|---|---|---|
| Cross-platform `tests/*.test.mjs` and `tests/*.test.cjs` | 265 passed, zero failed | Enumerated all files except the Unix fake-clock `emulator-services.test.cjs`; no source assertions were weakened. Logs: `.tmp-next-qa-node-tests-final.log`. |
| Availability and load-harness local HTTP fixtures | 19 passed | Includes timeout, stalled-body, API/proxy drift, assets, production-load prohibition and read-only load transport. These are harness tests, not production capacity measurements. |
| Brevo configuration/secret handling | 4 passed | Synthetic dotenv input and mocked provider responses only. Included in the 265-test sweep. |
| Immutable runtime bundle safety | 13 passed | Checksum/commit mismatch, escaping links, symlink ancestry, required runtime file types, secrets and uploaded data exclusion. |
| Encrypted backup/transfer safety | 4 passed | Synthetic manifests and ciphertext receipts; no live recovery rehearsal. |
| Managed runtime safety | 13 passed | Includes exact/fresh/root-owned staging proof, strict boolean flags, baseline binding, storage admission, environment escaping and rollback guards. |
| PostgreSQL restore operator safety | 4 passed | Bash script executed with mocked Docker. Verifies final TCP readiness, checksum refusal, resource isolation and cleanup after failure. This is not an actual production dump restore. |
| Discover and Settings browser regression | 12 scenarios passed | Delayed/reversed query responses, old failure after latest success, filter change, Clear while pending, automatic GET retry followed by manual retry, featured/search failure isolation, and Settings at 320/390/1280 in Light/Dark. Zero API mutations. |
| Final local web build and lint | Passed | Next.js 16.4.6 production compilation/type checks and strict web ESLint; no dependency or schema change. |
| Integrated UI smoke | 182 route/viewport cases passed | Seven widths from 360 to 1440, existing theme/navigation/interaction checks, intercepted synthetic API only. |
| Premium hierarchy | 66 route/viewport/mode cases passed | Eleven screens at 320/390/1280 in Light/Dark; role-filtered feature search, match identity, career outcomes and award presentation. |
| Final Arena reading regression | Eight scenarios passed | Six responsive Light/Dark cases plus hidden-poll/attachment audience confirmation and Unmute draft retention. Synthetic Unmute mutation intercepted locally. |
| Matched visual evidence | 32 before/after PNGs captured and inspected | Pristine integration and final local production previews; Settings, Discover and Arena Talk; see design evidence ledger. |
| Fresh lockfile advisory check | Exit 0; all severity counts 0 | `npm audit --package-lock-only --json`, exact candidate lockfile; no dependency changes. Advisory state may change after this observation. |

The new browser regression is `apps/android/tests/discover-search-regression.mjs`.
Run with `SMOKE_WEB_ORIGIN` pointing to an isolated built preview and
`SMOKE_OUTPUT` pointing to a disposable screenshot directory; `CHROMIUM_PATH`
can select installed Chrome. Fixtures delay responses explicitly rather than
assuming completion from arbitrary sleep intervals. Recovery tests exhaust the
existing one-time automatic safe-GET retry before pressing the page's retry button.

Screenshots from that run are in `.tmp-qa-browser-evidence/`:

- `next-discover-loading-390-dark.png`
- `next-discover-error-390-dark.png`
- `next-discover-search-390-dark.png`
- `next-settings-{320,390,1280}-{light,dark}.png`

These are synthetic after-change views, not evidence of real user data or a
complete before/after visual audit. The design ledger records matched baselines
and human visual inspection separately.

The existing `player-community-regression.mjs` also passed against the local
production build with `COMMUNITY_INTERACTIONS_ONLY=true`: frame-error recovery,
PNG card export, poll voting, reactions, comments, idempotent post retry, public
and league-feed isolation, profile editing access, public player cards and
moderation review. Every mutation was intercepted by the synthetic harness. This
run did not repeat its 12-theme screenshot sweep and does not establish real-API
permission acceptance.

## Inherited candidate security evidence

[Security Hardening CI run 45759959434](https://github.com/keerthiprakash18/FC-ARENA-/actions/runs/45759959434)
completed successfully for the inherited candidate:

- API unit tests: 116 files passed, one skipped; 1,024 tests passed, five skipped.
- API E2E: 29 files and 170 tests passed against disposable PostgreSQL 17/Redis.
- Full dependency audit: zero vulnerabilities at the run timestamp.
- Production dependency gate: no high/critical findings and no exceptions.
- Request isolation, environment checking and nonce-based CSP regressions passed.

Source review confirmed the existing database-backed security E2E exercises the
shared production HTTP-security setup: unauthenticated reads, private-response
headers, foreign-origin refresh refusal, role-injection rejection, temporary
refresh failure, refresh replay/session rotation, logout revocation, and closure
of private match streams after logout or membership removal. This is targeted
coverage; it does not constitute a penetration test or an exhaustive OWASP audit.

Historical dependency issue #192 was still open when inspected. The fresh audit
and inherited workflow do not show its old three high-severity findings in this
lockfile. Closing that issue is a separate repository tracking action; do not
describe the old findings as current without reproducing them.

## Measured isolated load evidence

[Load Acceptance run 45759959186](https://github.com/keerthiprakash18/FC-ARENA-/actions/runs/45759959186)
ran the inherited candidate with two local API instances, disposable PostgreSQL
17/Redis and read-only request traffic after synthetic seeding.

| Profile | Achieved requests/sec | Requests | Errors | p50 ms | p95 ms | p99 ms | Latency result |
|---|---:|---:|---:|---:|---:|---:|---|
| Baseline | 5.10 | 51 | 0 | 9.01 | 37.26 | 151.46 | Pass |
| 50 paced virtual users | 10.05 | 201 | 0 | 6.73 | 24.27 | 31.37 | Pass |
| 100 paced virtual users | 15.03 | 300 | 0 | 5.80 | 21.79 | 26.89 | Pass |
| 250 paced virtual users | 20.03 | 601 | 0 | 5.18 | 20.87 | 22.29 | Pass |
| 500 paced virtual users | 20.03 | 600 | 0 | 4.93 | 20.06 | 22.00 | Pass |
| 100 RPS capacity probe | 100.09 | 1,501 | 0 | 5.07 | 21.09 | 24.66 | Pass |
| 250 RPS capacity probe | 249.97 | 3,753 | 0 | 8.57 | 26.93 | 35.80 | Pass |
| 500 RPS exploratory burst | 310.13 | 2,005 | 0 | 641.58 | 2,557.32 | 4,050.32 | **Fail** |

The load script explicitly classifies the final burst as exploratory and
preserves its failed latency/throughput result. Required acceptance covers the
250 RPS probe under these isolated conditions. A 500-user paced profile at 20 RPS
does not prove 500 simultaneous active requests or 500 RPS capacity. These values
are not VCL production measurements and do not establish before/after gains.
No live load traffic was generated. LCP/INP/CLS field measurements remain unknown.

## Review findings and remaining verification

- Discover stale-query/filter/clear state could be overwritten by an older
  response. The continuation aborts superseded requests and guards all response
  paths; the new rendered regression exercises the resulting behavior.
- Arena composer collapse retains the mounted form, preserving draft state when
  reopening. Review also identified that sidebar Unmute increments `feedRevision`
  and previously remounted the composer. The implementation now refreshes the
  feed through an effect while keeping its composer mounted; draft detection
  also includes temporarily hidden poll options. Source review found both
  reported draft-loss paths addressed. The final rebuilt local production preview
  passed Unmute, hidden-poll, attachment and feed-switch cases in
  `apps/android/tests/arena-reading-regression.mjs`.
- Final continuation CI, exact final artifact identity, authenticated real-API
  staging, fresh production DB/media recovery, protected rollback rehearsal and
  physical Android device acceptance remain separate gates. No Android binary was
  published and no production service was changed by this QA work.
- ADB discovery found zero connected physical devices and zero emulators on this
  workstation. The inherited API 33–36 emulator evidence cannot establish
  physical-device acceptance. No device credentials or private account data were requested.

Initial broad attempts exposed sandbox/platform restrictions: localhost fetches
were denied, fresh-worktree dotenv was absent, sandbox temporary-file replacement
failed, and Unix fake-clock Bash fixtures did not execute correctly on Windows.
Localhost tests passed after an authorized unsandboxed rerun; dependencies and a
workspace-local temporary directory resolved the applicable non-product failures.
The Unix emulator timing test remains a Linux CI check. The initial failures are
not silently reclassified as product passes or used to weaken production gates.
