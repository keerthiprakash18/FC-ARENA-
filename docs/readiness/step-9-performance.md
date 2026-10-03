# Step 9 — Measured performance improvements

Date: 2026-10-03. Base: bb4f4210df8b8b14df82e11cbc509322ed6c1238.

No redesign, feature removal, production load generation, database changes, Android AAB or Android version bump. The implementation improves measured client request behavior. Production/device performance acceptance is **not complete**: there is no representative production/staging dataset or physical-device timing in these results.

## Measure-first method and results

Baseline source was copied from the unchanged base before implementation. Both benchmark scripts execute the real source after TypeScript transpilation in isolated VM contexts. Transport is mocked with a fixed 40ms delay. Run 15 samples per scenario. Reported p95 uses the highest of these 15 samples; this small sample is a regression diagnostic, not a service SLO estimate. Raw results are in the four adjacent before/after JSON files.

| Measured case | Before | After | Interpretation |
| --- | --- | --- | --- |
| Three simultaneous identical default GETs, nine endpoint categories | 3 network calls | 1 network call | 66.7% fewer calls for this contention pattern; not 66.7% faster pages |
| Notification reads | 1 network call | 1 network call | Existing notification cache/coalescing preserved |
| Shared-read median latency | approximately 40.22–40.28ms | approximately 40.21–40.26ms | Parallel calls already had similar wall time; the gain is lower backend work |
| Fixture-management loading effect, two independent reads, median | 80.48ms | 40.26ms | Removed one sequential transport wait |
| Same effect, p95 | 81.63ms | 40.75ms | Controlled effect timing, not rendering/LCP |

Reproduce: `node tests/request-performance.cjs [source-path]` and `node tests/fixture-loading-performance.cjs [page-source-path]`. Checkout/extract the base sources to reproduce the baseline. The effect test mocks React state setters, uses an empty membership result and times completion of the actual loading effect; it does not measure DOM rendering or tournament fan-out.

## Changes and correctness

- Coalesce only **simultaneous** identical default authenticated GETs. No resolved private-data cache was added. Different path/query scopes remain separate; requests with signals, headers, cache flags or other options are excluded. Mutation, login and logout boundaries discard pending-read sharing. Failed reads are removable/retryable. Existing 10-second notification caching and invalidation remain.
- Fixture-management user and league reads now run with Promise.all. Per-league tournament fan-out is unchanged and starts only after league results arrive. Backend authorization remains authoritative.
- Awards category polling/focus refresh no longer starts an overlapping load while its existing overview/races request chain is pending. The existing 15-second interval, visibility behavior and displayed feature set remain.
- Native WebView HTTP cache remains enabled. Step 8 cleanup is restricted to owned obsolete worker caches. Deployment version handling avoids serving stale frontend variants without clearing user settings.
- Push registration retries are event-driven (login/online/focus); no new polling timer.

## Coverage of requested surfaces

| Surface | Audit result / action | Measurement limit |
| --- | --- | --- |
| Dashboard initial load | Already parallel user + bounded /players/me/dashboard summary. Shared reads now coalesce where consumers overlap. | Request-layer benchmark; no production LCP |
| League switching | Paths include league IDs; no completed cache introduced, preventing reuse across league scopes. Existing page reads are parallel. | Scope isolation regression, not interactive device latency |
| Upcoming across leagues | Existing summary scopes fixtures by both membership and participant identity. Four bounded tournament/future/unscheduled/overdue queries run in parallel after career/membership results. Preserved. | Existing API tests pass; query latency not profiled on production data |
| Fixtures | Main listing already parallelizes tournament requests and skips hidden-tab polling. Management's independent initial reads are now parallel. | Actual management effect benchmark above; large fixture payload not reworked |
| Standings | Request sharing only; no stale standings caching or score calculation changes. | Synthetic request benchmark; no ranking query plan collected |
| Tournament pages | Existing Promise.all retained. Request sharing can reduce simultaneous duplicate reads. | Request-layer measurement only |
| Awards/Ballon d'Or | Category overview then per-tournament races can create fan-out; suppress overlapping refresh chains. Scoring and Ballon computations untouched. | Fan-out cost and populated Ballon page p95 still require staging profile |
| Notifications | Bell already pauses hidden reads and polls at 60s; inbox polls 30s, with shared notification cache. API synchronizes notifications and returns up to 100. No extra polling. | Existing cache tests; synchronization DB cost remains unmeasured |
| Profile/career | Existing parallel reads retained; simultaneous current-user/career requests share work. Existing transformed images/cache behavior retained. | Request-layer benchmark and browser smoke; no image/LCP device metric |
| Admin | Fixture-management waterfall removed. Other admin pages have membership→tournament/team fan-out. Destructive actions and role checks unchanged. | Not all populated admin pages benchmarked |

React renders were inspected at the modified loading effects, but no broad React Profiler session was run. No speculative memoization was added. Repeated image requests, payload sizes, full N+1 detection and SQL EXPLAIN/load tests need representative staging data; they are not claimed resolved by the client changes. Existing hidden-tab polling guards and loading/error states were retained.

## Targets for staging/device acceptance (not measured production claims)

Use release WebView on a mid-range Android device, warm backend, representative two-league account, and separately record cold/warm runs under controlled 4G. Collect at least 30 samples with dataset/device/network metadata.

- Cold dashboard usable at p75 <= 3s; warm dashboard <= 1.5s.
- League switch and ordinary fixture/standings navigation p75 <= 1s with already initialized auth.
- User-facing read endpoints p95 <= 500ms; heavy awards/admin aggregates <= 1s initially, then profile outliers.
- At most one overlapping identical default GET in a browser session; zero hidden-tab polling from visibility-aware screens.
- Initial private JSON target <= 250KB per screen; paginate large listings only with tested UI/API compatibility.
- Scroll/input should stay responsive; collect long tasks and frame timing on device rather than inferring them from transport mocks.

## Validation

API build/lint and 146 unit / 15 local e2e tests pass. Web production build and lint pass (161 existing warnings, no errors). Android lintRelease/debug APK/release Java compile pass. Ten new behavioral regressions and the existing notification-cache test pass. Existing browser smoke passes all 48 page/viewport checks against the rebuilt local app with mocked API data. Android versions remain 1.0.9 / code 11. No production credentials/data were accessed.

The first restricted Turbopack build failed binding an internal build port; retrying with permitted process access and a clean local build cache passed. This removed only generated build output, not user storage.

## Remaining release work

1. Complete the Step 8 actual Play update/device checklist.
2. Collect the staging/device metrics above for all requested surfaces, especially awards/admin fan-out and notification synchronization. Baseline and after measurements here are deliberately limited to the changed client behavior.
3. Run GitHub CI. The inherited Step 5–7 high npm dependency findings still block a production-ready merge.
4. Preserve existing auth, leagues, fixture/result correctness and scoped access when undertaking further query/payload changes; do not add shared server caching without user/scope isolation.
