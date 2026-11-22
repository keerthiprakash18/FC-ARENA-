# FC Arena app and architecture audit — 22 November 2026

## Scope and release baseline

The requested audit covers next-match navigation, leaderboards, Golden Boot,
regression testing, and the ten architecture topics in the supplied reference
image. The image supplies a checklist; its captions are reference material.
Technology presence alone does not establish correctness or capacity.

At production preflight, VCCLHosting served web release
`d8cd6b452a8dc740435bac289a6b02f1509fc25d` and API release
`154b8440b92ca18f15fc186ee17019820cf8e116`. nginx, the web service and API
service were active. API health reported connected PostgreSQL and Redis.
The source baseline on GitHub main was
`2ef7871d0486f3d8e8378c0c9bf6691560e4d373`.

The active API schema and every migration file match the candidate. The schema
SHA-256 is `7829d87b9910422cf57a34e9fc2990b5bf7d361d1413cdb07b61d1698bd227ea`.
The production-source comparison covered 512 API/shared/configuration files.
An achievements-file discrepancy was an extra carriage return on a blank line;
the other baseline differences were regenerated Prisma client files. There was
no additional production-only API logic to preserve. Main's root dependency
override updates are included in the candidate's dependency verification.
The task requires **no database migration**.

## Ten architecture topics

1. **Rate limiting — implemented, with capacity work remaining.** Authentication
   uses persistent atomic PostgreSQL counters, with additional global API and
   mutation ceilings. Health and OPTIONS requests bypass the global limiter.
   Production forwards client addresses directly from nginx to the loopback
   API. A PostgreSQL counter write on every API request can itself become an
   overload bottleneck. A measured edge limit or atomic Redis limiter is a
   future improvement; limits need shared-NAT and real-traffic validation.
2. **Caching — deliberately scoped.** The service worker caches the public shell
   and static assets; its own script is served with no-cache/no-store headers.
   Authenticated API responses use `Cache-Control: no-store`. Production Redis
   is healthy. Expensive rankings/award aggregates remain candidates for
   event-invalidated server caching after profiling; user-visible verified
   result changes must invalidate that cache.
3. **Load balancing — single-instance topology.** nginx currently routes to one
   web process and one API process. This suits the present deployment, but the
   server remains a single point of failure. This audit makes no claim of
   horizontal scalability or a production concurrency capacity measurement.
   Add replicas only with shared jobs, uploads, rate limits and stream behavior
   explicitly reconciled.
4. **Reverse proxy — implemented.** nginx terminates HTTPS/HTTP2 and routes web
   traffic to loopback port 3000 and API traffic to loopback port 4000.
   Same-origin API and authentication routes avoid extra proxy hops. The
   checked-in API snippet disables buffering for event streams and API caching.
5. **API gateway — the existing edge supplies the required routing boundary.**
   nginx plus Nest authentication, authorization, validation, rate limits and
   safe error responses provide the current gateway functions. A separate
   gateway service is unnecessary for this single API. Edge overload controls
   and uniform upstream timeout configuration remain useful follow-up work.
6. **CI/CD — source verification and staged activation are separate gates.**
   GitHub validates the candidate; Linux builds must happen outside production.
   Production activation uses an immutable artifact, release lock, loopback
   rehearsal, preserved rollback runtime/static chunks, and explicit service
   pointers. After activation, dispatch the production release verifier from
   main with each component and exact deployed SHA. Existing operations debt
   includes 67 web and 55 API drop-ins at preflight. Consolidating them into a
   reviewed managed release pointer would reduce ambiguity and rollback risk.
7. **Docker — already used where useful.** Production PostgreSQL 17 and Redis 7
   run in healthy Docker containers. Web/API run as isolated systemd users.
   Recovery uses disposable containers with no network, read-only root,
   bounded tmpfs, 512 MB memory, one CPU and a PID limit. Containerizing every
   app process is an optional operations choice.
8. **Kubernetes — currently unnecessary.** There is no Kubernetes control plane
   in the single-host release architecture. Installing one would not provide
   another physical failure domain. Multi-host availability, workload
   measurements and operator ownership should drive any later adoption.
9. **Service discovery — explicit local addresses are sufficient today.**
   systemd service identities, loopback ports and Docker service configuration
   identify the current dependencies. Dynamic discovery becomes relevant when
   workloads move between multiple hosts or replicas.
10. **Circuit breaker — added for bounded external-provider failure.** The
    candidate adds per-origin circuit state to the existing bounded external
    HTTP helper, a cooldown and one recovery probe. Regression tests cover
    provider isolation and stale concurrent completions. This process-local
    circuit is appropriate to the current single API process; it is not a
    distributed outage coordinator.

## Recovery defect found and repaired

The weekly production restore verifier had failed at 04:35 IST on 22 November.
The official PostgreSQL image briefly starts a socket-only initialization
server. The old readiness probe accepted that server, then `pg_restore` raced
its shutdown and failed with a missing Unix socket.

Both restore scripts now wait for the final TCP server on container loopback.
The scheduled verifier also requires its checksum, refuses an absent reviewed
image, fails immediately on restore errors and confines the recovery database
to a disconnected, resource-limited disposable container. Four executable
synthetic regressions cover the initialization race, restore-failure cleanup,
missing checksum and absent image. Existing restore-safety contracts and bash
syntax checks pass.

The corrected scheduled verifier was installed with its previous script
privately retained. Running the helper against an actual fresh production
backup passed. Its systemd result is `success`, exit status `0`; the web and API
process IDs remained unchanged. The installed script SHA-256 is
`654ef643f4cd15633c2b3283afd1291f6cde7fa21d1258d28d58e38b9c690ac1`.

## Actual production backup and recovery evidence

A fresh PostgreSQL custom-format backup and all three persistent server media
roots were captured on 22 November 2026 at approximately 03:48:59 UTC
(09:18:59 IST). Archive integrity was verified before recovery.

- Database SHA-256:
  `51e54c5d2f4c8a1fc1c2e7582eea8b523b7cad998110dcedbf12b64c7a7aff5f`.
- Media archive SHA-256:
  `469012979d9600a21be535164c60157ea14c49bd0cf22c77937749b7575a59a6`.
- A same-host, network-disconnected PostgreSQL 17 recovery passed.
- The user explicitly authorized a private local copy and recovery check.
  The destination is excluded from Git and restricted by local filesystem ACLs;
  production payloads and credentials are excluded from repository and CI
  artifacts.
- The actual backup was copied off the production host, verified again and
  restored into a newly initialized, password-authenticated PostgreSQL 18
  cluster bound only to workstation loopback. That cluster was then stopped.
- The restored database contains **67 public base tables, 49 finished
  migrations, zero unresolved migrations and nonempty user data**. The generic
  verifier's count of 69 includes two views.
- All 49 migration names are present in candidate source. The historical
  `20261101090000_player_experience_arena_talk` ledger checksum matches the SQL's
  CRLF encoding; active source and candidate use equivalent LF SQL. This is a
  newline discrepancy, with no migration repair required.
- The copied media archive was extracted into a separate private recovery
  directory. All **31 regular files, 40,285,930 bytes**, matched the archived
  bytes individually. These are the server-persisted media roots; external
  image-provider storage is outside this filesystem proof.

## Remaining weaknesses and practical limits

The awards overview currently includes up to six active competitions, while
older active races remain reachable from each tournament's Award Centre.
Award polling still makes an overview request plus a request per tournament
every 15 seconds. League recent form concatenates tournament summaries instead
of reconstructing a globally chronological match sequence. These are follow-up
work; they were not silently redefined in the scoring fixes.

The daily production runner still retains plaintext local dumps, and a managed
encrypted off-server backup destination/recovery-key lifecycle was not proved.
The authorized private workstation recovery establishes this release's
recoverability; durable scheduled off-server backup remains an operations
improvement. The stale restore probe was repaired during this audit.

Production web/API have sound user separation and strict read-only systemd
filesystem protections, but remain a single-host deployment. App service memory
limits are currently unlimited, and the accumulated override chain increases
operational complexity. Capacity acceptance requires a controlled load test;
this audit does not generate saturation traffic against production.

Candidate verification supplied by the release owner passed:

- API unit tests: 945 passed and five skipped across 105 passing files and one
  skipped file.
- API database-backed end-to-end tests: 157 passed across 27 files.
- The high-severity dependency gate and CodeQL passed.
- Browser next-match regressions passed at widths 360, 390 and 1280;
  award/leaderboard regressions passed at 320, 390 and 1280, plus tournament
  tabs at 390.
- The controlled load exercise reported zero errors and p95 25.23 ms at its
  maximum offered rate of 20 requests per second. A configuration ceiling of
  500 virtual users in that run does not establish capacity for 500 simultaneous
  unrestricted requests. A representative capacity acceptance test remains
  follow-up work.

Full production authenticated journeys, artifact staging and release-marker
checks remain activation gates. Android WebView content changes ship through
the web/API release; this task does not require a native Play binary or a new
Android version code.
