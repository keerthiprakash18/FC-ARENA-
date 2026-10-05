# FC Arena UI/UX — Phase 3

## Scope and outcome

Phase 3 builds on `e7b136c` and improves workflow clarity, keyboard navigation,
mobile ranking hierarchy and administrator review queues. Business handlers,
payloads, scoring, generation, verification, roles and API contracts retain
their existing behavior. All testing uses intercepted API fixtures and a local
production build.

## UX improvements

- Tournament Builder and Fixture Generator show numbered progress, current
  steps, save/resume expectations and a shared contextual rail. Overflow is
  explained and the active step is kept in the rail's visible region without
  scrolling the document or Android WebView.
- Tournament setup separates basics, competition format and registration.
  Optional branding/description and generator scheduling use native disclosures.
  Field labels target their controls; existing required constraints are explicit.
- Consistent action areas wrap at small widths without fixed overlays covering
  inputs, content or native bottom navigation. Review explains what publishing
  does before the existing confirmation.
- Generator validation associates field errors, marks invalid controls and moves
  focus to the field needing correction. Dispute resolution notes have associated
  labels and errors while retaining the original validation and request payload.
- Match Center puts score/opponents in a compact readable grid and folds schedule,
  round and venue into a disclosure. Correction reasons have a visible label.
- League War retains its navy/gold rivalry scoreboard, adds status-dependent
  next-step guidance and discloses secondary schedule/statistics.
- Mobile public standings show rank/name/points first; public and authenticated
  standings and leaderboards disclose supporting statistics. Desktop tables remain.
- Admin Analytics adds direct pending-work links and recently completed counts.
  Disputes, Safety Reports and Fair Play history get local search/status filters,
  active-filter summaries, counts, reset and filtered-empty explanations.
- Desktop search exposes combobox/listbox semantics, a selected option, arrow-key
  navigation, Enter activation and Escape dismissal retaining input focus.
- The mobile rail has Home, League, Tournament, Fixtures and More. Awards and
  League War remain accessible from More; desktop navigation retains its scope.

## Exact change inventory

- `apps/web/src/app/admin/analytics/page.tsx`
- `apps/web/src/app/admin/disputes/page.tsx`
- `apps/web/src/app/admin/fair-play/page.tsx`
- `apps/web/src/app/admin/safety-reports/page.tsx`
- `apps/web/src/app/fixtures/generate/page.tsx`
- `apps/web/src/app/fixtures/generate/participants/page.tsx`
- `apps/web/src/app/fixtures/generate/preview/page.tsx`
- `apps/web/src/app/fixtures/generate/rules/page.tsx`
- `apps/web/src/app/fixtures/generate/save/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/leaderboards/page.tsx`
- `apps/web/src/app/league-war/[warId]/page.tsx`
- `apps/web/src/app/matches/[matchId]/page.tsx`
- `apps/web/src/app/modernization.css`
- `apps/web/src/app/more/page.tsx`
- `apps/web/src/app/public/tournaments/[code]/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/standings/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/fixture-preview/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/fixture-settings/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/groups/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/qualification/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/review/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/setup/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/teams/page.tsx`
- `apps/web/src/app/ux-polish.css`
- `apps/web/src/components/admin/admin-filter-bar.tsx`
- `apps/web/src/components/app/app-header.tsx`
- `apps/web/src/components/app/bottom-navigation.tsx`
- `apps/web/src/components/app/primary-navigation.ts`
- `apps/web/src/components/fc/fc-context-nav.tsx`
- `apps/web/src/components/fixtures/fixture-generator-shell.tsx`
- `apps/web/src/components/tournaments/tournament-wizard-shell.tsx`
- `apps/android/tests/phase3-ui.mjs`
- `apps/android/tests/phase-ui-fixtures.mjs`
- `docs/UI-PHASE-3.md`

## Validation gate

- Web TypeScript and production build: passed; 62 static routes generated.
- Full web ESLint via its programmatic API: 0 errors, 160 existing warnings.
  The installed stylish formatter has an existing chalk incompatibility.
- API lint: 0 errors, 5 existing warnings. API Vitest: 152 tests / 26 files passed.
- Node regression suite: 22 tests passed.
- Phase 3 browser suite: passed at 360, 390, 768, 1024 and 1440px. Includes
  progress/active-step visibility, seven wizard routes, five generator routes,
  invalid-field focus, optional disclosures, search keyboard behavior, mobile
  navigation, public standings, rankings, rivalry and admin review filters.
- Phase 1 browser suite: passed at 360, 390 and 1440px.
- Phase 2 browser suite: passed at 360, 390, 768 and 1440px.
- General UI smoke: 91 route/viewport checks passed.
- Android-UA smoke: 48 route/viewport checks passed, including scroll/navigation.
- Browser checks used Windows Chrome/Playwright against the local production
  server. No uncaught page errors or unmocked API requests remained.

## Review and limitations

The initial new-suite dashboard failure was diagnosed as a missing account
`status` in its fixture; production status handling was not altered to mask it.
Protected pre-existing line-ending and generated/API changes remain unstaged.
Physical Android/TalkBack, soft keyboard, lifecycle and safe-area checks remain
manual device validation. Phase 3 passes the local UI gate for Phase 4.
