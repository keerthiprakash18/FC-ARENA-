# FC Arena premium startup preflight

15 November 2026 · Candidate branch `codex/premium-startup`

## Baseline and overlapping work

- GitHub `main` was verified at `2b50f0ae358d1c9ffca306fc800a1dcd2876bbd4`. The candidate is a separate clone in `.cache/premium-startup-20261115`. The original `main` is at `b06a23ef03f344c5662dffc9b3faffbf0ede975c`, three commits ahead of and 66 behind its cached remote ref before preflight. The original working copy had 189 modified and 331 untracked files. Existing integration and release worktrees were left in place. Their local work does not enter the candidate implicitly.
- GitHub reported ten open PRs. Eight are dependency updates. [PR #138](https://github.com/keerthiprakash18/FC-ARENA-/pull/138) touches `MainActivity` and Android release metadata. [PR #127](https://github.com/keerthiprakash18/FC-ARENA-/pull/127) touches navigation, Android CSS, and league-logo administration. Both were reported as conflicting with `main`. Compare the current implementation and PR heads again before publishing a candidate.
- Main already includes league-scoped Duo selection and aggregate scoring, four-game Duo cross-play, registration and club assignment improvements, opponent-only WhatsApp opt-in, and active-tournament team-logo permissions. Recent merge evidence is available in [PR #157](https://github.com/keerthiprakash18/FC-ARENA-/pull/157), [PR #158](https://github.com/keerthiprakash18/FC-ARENA-/pull/158), [PR #162](https://github.com/keerthiprakash18/FC-ARENA-/pull/162), and [PR #163](https://github.com/keerthiprakash18/FC-ARENA-/pull/163).

## Application and regression inventory

- The web application uses Next.js 16.4.2 App Router, React 19.2, Tailwind CSS 4, Geist, and CSS custom properties. `design-tokens.css`, `arena-design.css`, `AppShell`, `FcSkeleton`, and shared dialog and navigation primitives already support release-wide styling. The dashboard already includes next match actions, active tournaments, configurable stats and quick actions, notifications, and recovery states. Keep those integrations and improve the hierarchy and consistency of existing components.
- The NestJS 12 API uses Prisma 7, PostgreSQL, and Redis/BullMQ. Test fixtures must use an isolated database. Vitest covers fixture generation, standings, qualification, results and corrections, player dashboard, privacy authorization, and related invariants. `apps/api/test` contains API integration coverage. Repository Node tests cover dashboard order, auth startup, mobile accessibility, recovery, and deployment contracts.
- Android is a single Java `MainActivity` with a hardened WebView, minimum API 24 and target API 36. The app launches `/dashboard` by default and uses the existing resolver for FC Arena app links and notification destinations. It paints a `#05080D` native background, then displays WebView content behind a progress bar. First install or app update bypasses the HTTP cache for the first web document. Existing fallbacks cover connection loss, main-frame timeouts and renderer failure. The public web root layout detects `FC-Arena-Android` before hydration and respects stored theme/display preferences.
- The Android checkout contains an emulator CI workflow, Robolectric coverage, and a CDP-based browser regression suite for results, registration, group editing, brackets, standings, profile, notifications, and recovery. The Playwright Test configuration requested in the brief was not found in this baseline. Reuse the Android CDP harness and add Playwright Test only where it closes a verified browser-coverage gap.
- The attachment directory contained the brief only. The supplied textual launch sequence is enough to design an original transition. The referenced CricHeroes recording was unavailable for inspection.

## Development tools and design references

- Playwright MCP was added with the official Codex CLI command. Node 24.18.0 exceeds the server's Node 18 minimum. The official package reported version `0.0.85`. A browser tool call is required to verify the runtime. [Microsoft setup](https://github.com/microsoft/playwright-mcp)
- The local Codex plugin inventory has no enabled EGM package. The published Desktop installation is through the EGM listing. The full package and fresh reviewer launches must be confirmed before an outcome can be recorded as Goldfish review. [Desktop installation](https://egm.dev/install/) · [EGM review workflow](https://egm.dev/workflow/)
- Mobbin's public examples informed task-first dashboard content, contextual next actions in empty states, and progressive disclosure for wizard forms. Use existing FC Arena navigation and artwork. [Mobbin dashboard research](https://mobbin.com/blog/what-good-dashboard-design-looks-like) · [Mobbin design patterns](https://mobbin.com/blog/how-to-use-mobbin-mcp)
- Aceternity's Glowing Effect is available through its registry and tracks pointer proximity. FC Arena already has suitable CSS primitives. The launch needs a brief compositor-friendly animation that also works on touch hardware. The proposal has zero additional web animation dependencies and incorporates no third-party component source or assets. [Glowing Effect](https://ui.aceternity.com/components/glowing-effect) · [Aceternity licensing](https://ui.aceternity.com/licence)

## Implementation sequence

1. Measure the verified baseline and exercise native and web recovery behavior. Verify browser setup and run the existing build and regression gates in the isolated checkout.
2. Review and approve the startup design. Implement a bounded, Android-only cold-launch sequence and keep the existing WebView loading and fallback paths available. Add regression coverage for lifecycle, navigation, and accessibility. [Startup proposal](premium-startup-design.md)
3. Review existing dashboard, competition, player, and admin screens on mobile and desktop. Extend the shared tokens and components for specific observed usability gaps. Keep tournament state transitions and authorization at existing API boundaries.
4. Compare before and after on the same Android target, produce recording or device evidence, rerun source and security checks, and prepare a reviewable PR with explicit release blockers and rollback evidence.

## Production and storage review

The repository documents encrypted PostgreSQL backups with archive validation, GPG encryption, checksum sidecars, retention, and optional off-server copying. A CI job is designed to exercise restoration with synthetic data. Production release and rollback scripts use recorded source and artifact identities. The active on-host retention, off-server destination, disk use, Cloudinary usage, database restore results, and current rollback point require separate live verification through the existing trusted SSH identity. No storage claim is based on static configuration alone. [Backup runbook](../../ops/backup/README.md) · [Rollback runbook](step-19-rollback-dr.md)
