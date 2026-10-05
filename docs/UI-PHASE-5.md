# FC Arena UI/UX — Phase 5

## Scope and outcome

Phase 5 starts from `6e5f9ee` and completes the local release-consistency gate.
The checkpoint is the commit titled `feat(ui): complete phase 5 release consistency pass`
containing this document. Its hash is available with:

```sh
git log -1 --format=%h -- docs/UI-PHASE-5.md
```

## Final consistency changes

- Added a small release contract for readable field labels, invalid-control
  borders, 44px buttons/disclosures, long names, bracket headings and token-based
  selected buttons/progressbars. Legacy cyan selection borders and the browser's
  default green progress appearance now follow the selected FC Arena theme.
- Admin filter controls wrap according to available width. Header profile text
  responds to its container width, preventing overflow with enlarged content.
- Added accessible names to member search, screenshot upload, participant entry
  and import fields, group assignment/rename controls and preview matchday.
  Selection buttons expose `aria-pressed` without changing their values/handlers.
- All Builder loading screens use the shared skeleton/status treatment. Review,
  Qualification, Career League History, Career Achievements and legacy Tournament
  Rankings show recoverable error states instead of an indefinite loading screen
  or unhandled rejected read.
- Legacy Tournament Rankings now share mobile ranked rows/disclosed statistics
  with the newer ranking surfaces while keeping detailed desktop tables.
- Corrected garbled arrows/separators on tournament groups, fixtures and playoffs.
  Removed development-version labels from Admin, Fair Play, Discover and Awards.
  Root metadata explains the actual competition product.
- Native CSS remains last. Its only intentional change is a final reduced-motion
  override for the shell's short color transitions; safe areas, scrolling and
  native business code retain their prior rules.

## Route and state review

`phase5-ui.mjs` covers 14 core routes across every required width, both palettes
and both display modes, plus 84 broader paths at 390 and 1440px. Broad coverage
includes public/auth/legal pages, main destinations, career/community, all award
categories and Ballon detail, Discover/player, league/tournament subroutes,
poster, legacy rankings, all seven Builder steps, all five Generator steps,
Match Center/Dispute Center, rivalry and every Admin section. Legacy redirects
such as Verify Email are exercised with their existing behavior.

The review checks visible field names, duplicate IDs, rendered legacy-label
contrast, token contrast, settled idle animation, horizontal overflow and route
errors. It is fixture-based presentation coverage, not a backend end-to-end or
complete screen-reader/WCAG certification. Some permission-dependent screens
exercise their existing read-only/redirect state rather than all privileged
mutation states.

The shared state contract is:

| State | Treatment |
| --- | --- |
| Loading | Shared skeleton and polite status text |
| Empty | Title, explanation and contextual next action where available |
| Error | Semantic alert and retry where the read can be retried |
| Success | Contextual atomic polite notice |
| Invalid | Associated label/error, invalid border and focus on affected control |
| Disabled/busy | Disabled control, visible busy label and bounded activity indicator |
| Unauthorized | Existing authentication/permission semantics and shared access state |
| Confirmation | Named native modal, focus containment/restoration and Escape cancel |

## Exact change inventory

- `apps/web/src/app/admin/analytics/page.tsx`
- `apps/web/src/app/admin/android/page.tsx`
- `apps/web/src/app/admin/fair-play/page.tsx`
- `apps/web/src/app/admin/system/page.tsx`
- `apps/web/src/app/awards/page.tsx`
- `apps/web/src/app/career/achievements/page.tsx`
- `apps/web/src/app/career/leagues/page.tsx`
- `apps/web/src/app/discover/page.tsx`
- `apps/web/src/app/fair-play/page.tsx`
- `apps/web/src/app/fixtures/generate/page.tsx`
- `apps/web/src/app/fixtures/generate/preview/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/leagues/[leagueId]/members/page.tsx`
- `apps/web/src/app/matches/[matchId]/page.tsx`
- `apps/web/src/app/native-android.css`
- `apps/web/src/app/release-consistency.css`
- `apps/web/src/app/tournaments/[tournamentId]/fixtures/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/groups/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/rankings/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/fixture-settings/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/groups/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/qualification/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/review/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/setup/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/wizard/teams/page.tsx`
- `apps/web/src/app/ux-polish.css`
- `apps/web/src/components/admin/admin-filter-bar.tsx`
- `apps/android/tests/phase-ui-fixtures.mjs`
- `apps/android/tests/phase-ui-harness.mjs`
- `apps/android/tests/phase5-ui.mjs`
- `docs/UI-PHASE-5.md`
- `docs/UI-MODERNIZATION-FINAL.md`

## Validation gate

- Web standalone TypeScript and production build: passed; 62 static routes.
- Full web ESLint: 0 errors / 160 existing warnings.
- API lint: 0 errors / 5 existing warnings. API Vitest: 152 tests / 26 files passed.
- Node regressions: 22 passed.
- Phase 5: **504 route/viewport/theme checks passed**:
  14 × 6 widths × 2 themes × 2 modes, plus 84 × 2 broader-route widths.
- Core widths: 360, 390, 768, 1024, 1280, 1440px. Both Luxury Gold/Classic Blue
  and light/dark passed. Main text, secondary/muted text and primary-button token
  pairs met 4.5:1 in the checked themes. Rendered legacy field-label contrast
  checks passed on the audited panel surfaces.
- Additionally passed 8 CSS-zoom 200% enlargement checks in web/Android-UA,
  two keyboard skip-link checks, five failed-read/retry-state checks and the
  player-role Super Admin navigation exclusion check.
- Zero unnamed audited fields, duplicate IDs, route exceptions, unexpected
  mutations or unmocked API requests remained in the final Phase 5 run.
- Reran Phase 1 (3 widths), Phase 2 (4), Phase 3 (5), Phase 4 (15 profiles),
  general UI smoke (91) and Android-UA smoke (48): all passed after final fixes.
- Screenshot review of mobile Dashboard/Match Center and desktop Builder
  confirmed hierarchy and exposed/fixed the pale legacy field labels. Optional
  screenshots are in `/tmp/omnirush/phase5-*.png`, outside the committed inventory.

## Performance, preservation and release limits

No packages, animation dependencies, fonts or API polling were introduced.
Progress effects are bounded; settled screens have no continuous animations.
QR stays lazy-loaded and upload preview dimensions remain stable. These are
structural/browser checks; physical-device responsiveness and production Web
Vitals are still manual/staging measurements.

The optional API build was attempted: Prisma generation completed, then the
existing Nest CLI `cli-table3` toolchain failed with
`TypeError: stringWidth is not a function`. Generated output is not staged.
The installed Next.js runtime reports 16.3.5 while manifests specify 16.3.6;
the existing ESLint stylish formatter also has a chalk compatibility issue.
Dependency repair is outside this UI checkpoint.

Physical Android WebView/TalkBack, OS share sheets, real browser-toolbar zoom,
soft keyboard, insets and back/background/resume remain manual checks. Automated
200% checks use CSS enlargement and responsive reflow widths, not an OS/browser
toolbar interaction. Populated privileged workflows still need staging testing.

The local UI gate is passed and the isolated UI commits are ready for merge
review. Production release readiness still depends on the API toolchain and
the manual/staging checks above. No push, merge, deployment or native bundle was
performed; protected unrelated working-tree changes remain outside the commits.
