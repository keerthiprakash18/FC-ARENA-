# FC Arena UI/UX — Phase 1

## Scope

Foundation and UI reliability changes only, using Dashboard and Authentication as the visual benchmark. Luxury Gold retains the warm cream canvas, navy shell and controlled gold accent. Saved Classic Blue and dark/system display preferences remain supported.

- `apps/web/src/app/design-tokens.css` is the canonical source for palette, semantic feedback colours, focus, typography, spacing, radii, motion and legacy token aliases. Duplicate token definitions were removed from the older stylesheets.
- Gold/premium accents are separate from amber warning/pending status. Shared controls, notices, loading, empty, retry and access states use the same tokens.
- `SecondaryFeaturePage` exits loading on failed authentication, distinguishes 401/403 from other failures, supports retry after connection failures, and ignores responses after unmount.
- Shared native modal dialogs provide associated labels/descriptions, inert backgrounds, keyboard focus containment, Escape cancellation, focus restoration, field validation and safe-area-aware sizing. Destructive dialogs initially focus Cancel.
- All web `window.prompt` and `window.confirm` calls were replaced. Named deletions retain the same exact-name checks and API payloads; result reasons retain their existing payload handling; fixture editing uses team selection and numeric matchday inputs.
- Destructive confirmation titles, action labels and consequences were clarified for account, league, tournament, team, group, member, role, photo/logo, fixture and result actions. Match Admin access removal now has an explicit confirmation.
- Shared success/error notices expose polite status or assertive alert announcements. Error/retry presentation was unified in the affected routes and boundaries.
- Native Android CSS remains last in load order. Native document scrolling, navigation/safe-area rules and reduced-motion handling are preserved. No decorative motion or new runtime dependencies were added.

API endpoints, request schemas, database, authentication/session mechanics, permissions, tournament progression, scoring, Android native code and production infrastructure were not modified. Phases 2–5 were not started.

## Validation

- Web ESLint: **0 errors, 160 warnings**. The existing dependency installation's default stylish formatter fails with `chalk.underline is not a function`; the same lint check passed using `--format json`.
- TypeScript: `node node_modules/typescript/bin/tsc --project apps/web/tsconfig.json --noEmit --incremental false` passed.
- Production build: `npm run build:web` passed, including TypeScript and 62 static pages.
- Existing Node regression suite: **22 tests passed**, covering read retries/coalescing, mutation non-replay, account isolation, notification caching, deployment IDs and service-worker/push lifecycle.
- `apps/android/tests/ui-smoke.mjs`: **91 route/viewport checks passed** at 360, 375, 390, 412, 430, 768 and 1440px. Its pre-existing match fixture was brought into line with the current readiness/schedule/event fields and current Match Room text.
- `apps/android/tests/smoke.mjs`: **48 Android-user-agent page/viewport checks passed**, including touch scrolling and stable navigation.
- `apps/android/tests/phase1-ui.mjs`: passed at **360, 390 and 1440px**, covering 401/403/connection-error recovery, cancelled/mismatched deletion without writes, failure without mutation replay, unchanged deletion/fixture/result payloads, focus restoration/containment, form validation, result rejection and two-step reversal cancellation, live-region roles, mobile overflow, native-app detection, separate warning/accent tokens, dark mode and reduced motion.
- All browser API requests were intercepted fixtures. No production accounts or writes were used.

Run browser tests with Playwright/Chromium available and the local production web server on `127.0.0.1:3000`. `phase1-ui.mjs` and `smoke.mjs` also accept `SMOKE_WEB_ORIGIN`; all three accept `CHROMIUM_PATH`.

## Remaining Phase 1 validation

Physical Android WebView/TalkBack checks for modal focus, soft-keyboard sizing, native Back, background/resume and safe-area behavior remain device-only validation. The browser checks verify live-region markup, not spoken screen-reader output. Existing legacy lint warnings remain. The new shared states are applied to the affected flows; some other legacy routes still have inline feedback that can be migrated incrementally without redesigning them.

## Change inventory

New files:

- `apps/web/src/app/design-tokens.css`
- `apps/web/src/components/fc/fc-dialog.tsx`
- `apps/android/tests/phase1-ui.mjs`
- `docs/UI-PHASE-1.md`

Modified files:

- `apps/android/tests/ui-smoke.mjs`
- `apps/web/src/app/account-deletion/authenticated-account-deletion.tsx`
- `apps/web/src/app/admin/safety-reports/page.tsx`
- `apps/web/src/app/career/matches/page.tsx`
- `apps/web/src/app/career/tournaments/page.tsx`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/fixtures/generate/participants/page.tsx`
- `apps/web/src/app/fixtures/generate/preview/page.tsx`
- `apps/web/src/app/fixtures/page.tsx`
- `apps/web/src/app/forgot-password/page.tsx`
- `apps/web/src/app/global-error.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/league-war/[warId]/page.tsx`
- `apps/web/src/app/leagues/[leagueId]/members/page.tsx`
- `apps/web/src/app/leagues/[leagueId]/roles/page.tsx`
- `apps/web/src/app/leagues/[leagueId]/settings/page.tsx`
- `apps/web/src/app/leagues/[leagueId]/tournaments/page.tsx`
- `apps/web/src/app/leagues/page.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/matches/[matchId]/page.tsx`
- `apps/web/src/app/modernization.css`
- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/app/register/page.tsx`
- `apps/web/src/app/reset-password/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/achievements/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/fixtures/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/groups/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/standings/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/teams/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/fixture-preview/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/groups/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/review/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/teams/page.tsx`
- `apps/web/src/app/tournaments/page.tsx`
- `apps/web/src/app/verify-email/page.tsx`
- `apps/web/src/components/auth/auth-experience.module.css`
- `apps/web/src/components/fc/confirmation-provider.tsx`
- `apps/web/src/components/fc/fc-ui.tsx`
- `apps/web/src/components/fc/secondary-feature-page.tsx`
- `apps/web/src/components/tournaments/fixture-card.tsx`
- `apps/web/src/components/tournaments/tournament-logo-upload.tsx`

Initial git status contained widespread tracked line-ending changes and an untracked `build11-error.txt`; the initial whitespace-insensitive diff was empty. The Phase 1 diff was inspected separately with `--ignore-space-at-eol`, and the prior line-ending changes and untracked file were preserved. No commit, push, deployment or history changes were made.
