# FC ARENA — repository-wide AI development and release contract

**Applies to every AI coding assistant (Codex, ChatGPT with repo access, Claude, Copilot, other agents) and every developer.** Treat this checked-in file as the source of truth, not an earlier chat or an assumed server state. Read it before changing code, building, cleaning storage, releasing WEB/API, or publishing Android. Subdirectory instructions (e.g. `apps/web/AGENTS.md`) add framework details; they do **not** waive production safety.

## First: distinguish development from deployment

- A request to **implement, fix, refactor, test, or commit** means change the GitHub repository and verify it in a separate branch/PR. **Never infer permission to touch production.**
- A request that expressly says **deploy/release to production** permits planning and attempting a controlled release **only after** the gates below have been verified and the actual requested production change is authorized. Stop and report blockers, rather than bypassing checks. If the assistant cannot access required host, tools or approval, give precise handoff steps; **do not claim success**.
- `main`, a PR, a passing Actions run or a downloaded bundle **is not automatically live**. Determine live release SHAs from public endpoints and the effective systemd configuration. Do not use outdated chat memories as a live source of truth.

## Non-negotiable invariants

1. **Preserve all existing business logic, tournaments, fixtures, group standings/GD/tie-breakers, results, awards/Ballon d'Or, match history, rankings, player profiles, XP, admin controls, registrations, chat, files and user experience.** Make changes only within the requested scope. Never reset live tournaments or silently drop legacy features.
2. **Preserve production data and references:** PostgreSQL, Redis, uploads, media, storage, environment files, backups, signing assets and the verified rollback. Do not assume an empty media folder means other uploads are disposable.
3. **Off-host builds by default.** Source and CI builds belong in GitHub/GitHub Actions; VCL holds only WEB/API runtime, required runtime dependencies, PostgreSQL/Redis, release-independent user data, configuration, and verified rollback. Never run `npm ci`, `npm install`, `npm run build` or `next build` on VCL production as part of a normal release; do not create release-local copies of persistent media or accumulate source/build folders on the host.
4. **Never auto-delete historical releases or user files.** Target *one active release plus one verified rollback* only after proven-safe reference cleanup. Read-only inventory first; check systemd drop-ins, env files, crons/timers, symlinks, mounts, open files, running processes, backup dependencies and rollback needs. Require **separate explicit owner approval** before any deletion. No blanket `rm -rf /opt/fcarena-deployments/*` or blind retention cron.
5. **Never apply unreviewed production database migrations or restore over live PostgreSQL.** Schema changes need an isolated PostgreSQL 17 rehearsal, verified compatible backup, backward/forward compatibility assessment and separately approved production migration. The API `start:prod` npm script currently performs `prisma migrate deploy` before starting: **do not invoke it during a trial or unapproved restart**.
6. Protect secrets: no committed/probed production credentials, no secrets or private user images in Actions artifacts/logs, no sharing of user data. Never overwrite live `/etc/fcarena` environment precedence or `/etc/fcarena/push/firebase-push.env` casually.

## Current production identity — historical observation, not eternal truth

- Production host: **VCL/VCCLHosting**, hostname `fcarena-prod`; **InterServer retired**. Web: `https://fcarena.in/` (`fcarena-web.service`); API: `https://api.fcarena.in/api/health` (`fcarena-api.service`).
- Last verified 20 Nov 2026: WEB+API live release **V12** `154b8440b92ca18f15fc186ee17019820cf8e116`; protected **V11 rollback** `/opt/fcarena-deployments/playoff-visual-v11-2433159e0d5c`; V12 directory `/opt/fcarena-deployments/fcarena-v12-stage-154b8440b92c`. The code currently executes from server-managed runtime paths; **inspect actual effective `systemctl show` and processes before any alteration**.
- Ubuntu 24.04 x86_64, Node 24, glibc 2.39 observed; verify current ABI. DB uses PostgreSQL 17. A verified off-host DB dump + isolated restore and a 32-file Windows off-host SHA256 copy were completed, **but media restoration into a full application was NOT proven**.
- As of 20 Nov 2026: **101 historical deployment directories and 29 GB free**, 67% disk used. Effective API/WEB service release references listed V12 only; other scripts/configs referenced historical directories. **No historical release deletion authorized.**
- Security Hardening CI identified **three high-severity dependency findings** in Issue **#192**. Overall security readiness is **not green** until resolved and checked. Follow-up maintenance/verification in Issue **#193**.

## Mandatory workflow for every feature/change

1. Read source, DB schema, existing user flows, `AGENTS.md` and relevant subfolder docs. Identify exact requested feature and existing behavior that cannot regress.
2. Create a focused Git branch/PR (unless user explicitly requires a different reviewed workflow). Keep unrelated data, format, locale, and business rules unchanged. Check mobile WebView impact for WEB changes.
3. Run relevant unit/integration/E2E tests on **disposable** databases and storage; test match verification, standings/GD, playoffs, awards, player history, admin access and security when affected. Add regression coverage for changes. Record pass/fail clearly.
4. Run GitHub Actions API/WEB build and security gates. Prefer `.github/workflows/offhost-build-artifact.yml` for immutable, checksum-verified GitHub runtime bundles. **It builds; it does not deploy.** A red dependency/security gate must be reported and resolved/risk-reviewed, never hidden.
5. For an actual requested VCL deployment: first establish live WEB/API SHA and health, capture **fresh verified** off-host DB **and all relevant persistent-file** recovery proof (existing historical backups do not substitute for freshness), identify protected rollback, confirm free space and references. Use `.github/workflows/manual-offhost-predeploy-readiness.yml` as a read-only **candidate** check; its PASS is **not deployment authorization**.
6. Rehearse the *exact* candidate artifact, native dependencies, config paths and DB/migration compatibility on isolated staging without writing to production. Plan an atomic/reversible WEB+API activation and clear rollback. Deploy only the reviewed candidate under explicit owner approval, using stable release-independent media and root-only secrets; never use a new per-release storage root. Verify health and actual release IDs, plus authenticated read-only critical user journeys and Android WebView if affected. Roll back immediately on failed gates without data loss.
7. New releases must not silently multiply release folders. Retention is a separate, guarded post-verification change and **not automatic in this repository yet**. If retention conditions cannot be proven, **leave existing directories intact**, report disk usage and the blockers.
8. Handoff with exact source SHA, tested artifact, checks run and results, live WEB/API SHA, production changed? yes/no, backup+rollback proof, disk usage, and remaining blockers. Never say "deployed", "safe to delete", "fully tested" or "zero-regression" without evidence.

## Where to look

- Off-host build: `.github/workflows/offhost-build-artifact.yml`.
- Manual **read-only** predeploy: `.github/workflows/manual-offhost-predeploy-readiness.yml`.
- VCL data and release policy (including verified baseline and blockers): `ops/VCL_RELEASE_STORAGE_POLICY.md`.
- Release/rollback background: `docs/readiness/fc-arena-release-design.md`, `docs/readiness/step-19-rollback-dr.md` (older guidance may be outdated; current live VCL inventory wins).
- Android: `apps/android`, `docs/readiness/step-18-release-system.md`. App package `in.fcarena.app`. Preserve signing key; use next **unused** versionCode, Play testing track and real-device smoke. On Windows, after reviewing frozen Git state and current tool instructions, use `powershell.exe -NoProfile -File .\apps\android\build-signed-release.ps1` with its **local** signing prompt. Android publishing is separate from WEB/API deployment.

**Decision rule:** If uncertain, make the change in source and test it; do not mutate live VCL or delete files. Production release is a distinct, verifiable, deliberately approved step.
