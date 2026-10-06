# FC Arena — premium visual redesign

## Pre-edit audit and plan

Plan recorded before application edits on `ui-modernization-phases`, baseline
`bdb028e`. Initial status is captured in
`/tmp/omnirush/premium-redesign-initial-status.txt`: 455 modified tracked files
(442 line-ending-only and 13 generated Prisma changes), 19 pre-existing untracked
files, and an empty index. The uncommitted release-gate report is existing work.

Source, populated fixture-browser renders and screenshots were inspected.
Before captures cover 13 routes at 390 and 1440px in
`/tmp/omnirush/premium-before`. The installed Next server/client component guide
was read before implementation.

### Ten highest-impact screens

| Priority / screen | Current visual weakness | Planned composition |
| --- | --- | --- |
| 1. Dashboard | Onboarding/inbox precede identity; repetitive empty panels and equal statistic/action tiles | Competition-first match masthead, asymmetric live-competition spread, compact career ribbon, prestige/rivalry gateways and activity ledger |
| 2. League hub | Invite above identity; seven equivalent destination cards | Crest-led navy identity, membership/role summary, tournament-first hub, grouped match/standings/member destinations; invite and management secondary |
| 3. Tournament hub | Progress precedes identity; small header and fragmented action cards | Large competition masthead, entry/stage ribbon, next-match broadcast card, premium context tabs and quiet management toolbar |
| 4. Match Center | Separate status panel precedes competition; no team crests; weak VS area | Competition-first broadcast scoreboard with crests, round/deadline/status, explicit result task and subordinate verification/admin surfaces |
| 5. Awards | Small trophy, emoji category grid, administrator panel interrupts honours | Flagship trophy masthead, real ranking preview, editorial category lanes, Playmaker/Power Ranking gateways, preserved administrator tools |
| 6. Ballon season | Scoring disclosure precedes ranking; mostly repeated table rows | Genuine eligible top-three podium, large rating/player identity, ranking ledger, secondary transparent-scoring disclosure |
| 7. League War | Repetitive panel rhythm; rose utilities and technical details compete with rivalry | Exclusive navy/gold rivalry board, aggregate score, leader/winner and match-completion progress; participants and remaining matches clear |
| 8. Fixtures | Long filter stack before fixtures; two equal cards and tiny team identity | Competition matchday masthead, summary ribbon, compact filter workbench, date-grouped full-width match ledger and clear result states |
| 9. Admin Analytics | Equal counters precede pending work; oversized data panels | Needs-attention masthead and prioritised review queues, completion/activity ribbon, quieter health/configuration and audit detail |
| 10. Public tournament | Generic cover strip, blank header space, equal counters | Simplified FC Arena shell, competition masthead, anchored match/table/results sections and football-style rankings |

Also refine public player identity, standings, playoffs, shared navigation and
shared surfaces. Preserve all existing actions, identifiers, dialog/focus/error
handling, permissions, endpoints, data calculations and theme preferences.

### Visual system

Warm ivory canvas; deep navy mastheads/shell; controlled gold; semantic
emerald/amber/red. Three surfaces only: base, featured, inset. Four action types:
primary, secondary, destructive, quiet. Use restrained geometric pitch/crest and
trophy art, 32–42px display, 28–36px page titles, 20–24px section titles,
14–16px body, 12–14px supporting and 11–12px metadata. No new font/network or
animation dependency. Native CSS remains the final stylesheet.

Mobile navigation will expose Home, League, Tournament, Fixtures, Awards and
League War directly, plus secondary More. Test direct access, readable labels,
active-tab visibility and safe areas at 360/390/412/430px.

### Implementation / validation sequence

1. Shared premium components, surface/typography system and direct navigation.
2. Actual composition/section-order changes to the ten screens above.
3. Populated before/after screenshot review and responsive/theme checks.
4. TypeScript, production build, ESLint, Phases 1–5, UI and Android-UA smoke.
5. Complete A–N results and design estimates; stage only intended changes;
   create one local `feat(ui): premium FC Arena visual redesign` commit.

## Final redesign report

The premium redesign is complete as a UI-only checkpoint on top of `bdb028e`.
The existing API, schema, auth/session behavior, permissions, competition
calculations, Android native behavior and Phase 1–5 contracts remain intact.

### Before / after summary

Before, the product had a strong Phase 1–5 foundation but many flagship routes
still read as utility dashboards: identity and action context were separated,
competition pages used equal-weight card grids, Match Center lacked a broadcast
scoreboard, Awards and League War were secondary or visually inconsistent, and
mobile primary navigation hid Awards and League War behind More.

After, FC Arena has a consistent competition-operations identity: warm ivory
canvas, deep navy featured heroes, controlled gold, semantic emerald/amber/red,
crest and pitch geometry, broadcast-style scores, editorial award lanes,
podiums, rivalry boards, queue-first admin operations and direct mobile access
to Home, League, Tournament, Fixtures, Awards and League War. Empty and pending
states remain truthful and use the existing data contracts.

Subjective implementation estimates based on code review, populated fixture
renders and browser checks (not user research or accessibility certification):

| Dimension | Before | After |
| --- | ---: | ---: |
| Visual UI | 6.8 / 10 | 8.9 / 10 |
| Workflow UX | 8.4 / 10 | 8.8 / 10 |
| Mobile usability | 7.8 / 10 | 8.9 / 10 |
| Cross-screen consistency | 7.9 / 10 | 9.2 / 10 |
| Premium brand readiness | 6.4 / 10 | 9.0 / 10 |

### A. Screens fully redesigned

- Dashboard: competition-first identity and next-match hero, honest schedule
  empty state, upcoming-match ledger, career metrics ribbon, Awards and War
  gateways, recent activity and quieter quick actions.
- League hub: crest-led league identity, membership/role context, tournament-
  first destinations and secondary invite/administration treatment.
- Tournament hub: competition masthead, format/status/entries context, next
  fixture, progress ribbon, context navigation and quiet management toolbar.
- Match Center: competition/round/status scoreboard with crests and score,
  readiness/deadline task, verification links and disclosed technical metadata.
- Awards: flagship Ballon masthead, current leader, real top-three podium,
  editorial award lanes, Playmaker/Power Ranking destinations and collapsed
  administrator controls.
- Ballon season: seasonal masthead, real eligible podium, rating ledger and
  secondary transparent scoring disclosure.
- League War detail: navy/gold rivalry board, aggregate points, leader/winner,
  roster/match progress and remaining-match summary.
- Fixtures: matchday masthead, genuine status metrics, collapsible filter
  workbench and full-width fixture ledger with crest-led opponents.
- Admin Analytics: operations masthead, needs-attention review queues, activity
  and alert hierarchy, competition health and quieter audit detail.
- Public tournament: branded public shell, competition hero, anchored fixtures,
  verified results, standings and top-player presentation.

### B. Screens partially redesigned

- League War landing now uses the premium masthead, direct create action and
  navy/gold treatment; detailed ranking/content modules retain their existing
  data presentation underneath the new hierarchy.
- Public player now has a crest/profile hero, fair-play summary, career ribbon,
  league identity and trophy-cabinet composition; existing honour data remains
  in its original read-only flows.
- Tournament standings and playoffs now have competition heroes, metrics,
  crest-led rows, responsive disclosures and a horizontal/stacked bracket
  treatment; table values and qualification calculations are unchanged.
- Shared `SecondaryFeaturePage` supports premium headers while all other
  secondary destinations retain their Phase 1–5 composition.

### C. Navigation changes

- Desktop primary order is Home, League, Tournament, Fixtures, Awards, League
  War and More.
- Mobile exposes the same seven direct destinations in a horizontally scrollable
  readable rail. The active item is revealed without document scrolling, and
  safe-area/native inset CSS remains authoritative.
- More no longer duplicates Awards or League War; it remains the secondary
  destination for career, admin, settings and utility routes.

### D. Awards changes

- Ballon d'Or is the flagship hero, with real season status/range and existing
  ranking data.
- Top-three podium cards preserve server position/rating and link to the
  existing player detail route; no client ranking or award winner is invented.
- Golden Boot, Golden Glove, Player of Tournament, Rising Star, Champion,
  Runner-Up and Winning Streak use vector emblems and editorial lanes.
- Playmaker and Power Ranking are honest gateways to existing tournament and
  leaderboard surfaces.
- Administrator Start/Quick Start remains gated by the existing admin-league
  discovery and uses the same handlers/payloads.

### E. League War changes

- War detail uses a distinctive navy/gold rivalry scoreboard, crest identity,
  aggregate War Points, leader/winner emphasis and genuine completion progress.
- Rose presentation is mapped to the existing premium/gold semantic system;
  War rules, tiebreaks, roster locking, result confirmation and mutations were
  not changed.
- Ranking and player-form modules are secondary to the rivalry board.

### F. Dashboard changes

- Identity and next action lead the page in one asymmetric masthead.
- Upcoming personal fixtures use existing fixture data and route to the same
  Match Center or fixture destination.
- Existing onboarding, inbox, career calculations, recent results and admin
  creation links remain available in a clearer order.

### G. Tournament changes

- Tournament identity, crest/logo, status, format, mode, dates and entries are
  visible before progress and management controls.
- Existing TournamentNavigation and PlayerProgress remain in the competition
  flow. Teams, Groups, Standings and Bracket are destinations rather than an
  equal-weight card grid.
- Continue Setup and Open Fixtures preserve the original draft/admin condition.

### H. Match Center changes

- The visual and DOM order now leads with tournament/round/scoreboard, then
  result/readiness task, then notices and disclosed metadata.
- Existing readiness, OCR, verification, dispute, reminder, share and result
  handlers were not altered.

### I. Mobile changes

- Tested at 360, 390, 412 and 430px, plus 768px Android-UA/native profiles.
- The seven-item rail keeps labels readable, reveals the active item and does
  not create document overflow.
- Heroes stack, metrics become compact ribbons, standings disclose secondary
  statistics, and playoff brackets remain reachable with horizontal/stacked
  presentation as appropriate.
- Reduced motion and native CSS behavior remain inherited from Phase 1–5.

### J. Admin changes

- Analytics leads with review queues: pending results, open disputes and league
  applications, with genuine counts and links to existing admin routes.
- Activity, alerts, totals, top leagues and audit history remain read-only and
  use the existing overview endpoint.
- Awards administration is collapsed below honours and remains permission
  gated. No admin endpoint or role check was changed.

### K. Public-page changes

- Public Tournament now uses the same FC Arena identity in a simpler public
  shell, with genuine schedule, verified results, standings, top players and
  rules sections.
- Public Player uses genuine identity, fair-play summary, career statistics,
  leagues, Ballon history and honours without fabricating matches or awards.
- Public sharing behavior is preserved.

### L. Exact files changed for this redesign

- `apps/android/tests/phase3-ui.mjs`
- `apps/android/tests/smoke.mjs`
- `apps/android/tests/premium-ui.mjs`
- `apps/web/src/app/admin/analytics/page.tsx`
- `apps/web/src/app/awards/page.tsx`
- `apps/web/src/app/awards/ballon/[seasonId]/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/discover/players/[userId]/page.tsx`
- `apps/web/src/app/fixtures/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/league-war/page.tsx`
- `apps/web/src/app/league-war/[warId]/page.tsx`
- `apps/web/src/app/leagues/[leagueId]/page.tsx`
- `apps/web/src/app/matches/[matchId]/page.tsx`
- `apps/web/src/app/more/page.tsx`
- `apps/web/src/app/native-android.css`
- `apps/web/src/app/premium-redesign.css`
- `apps/web/src/app/public/tournaments/[code]/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/playoffs/page.tsx`
- `apps/web/src/app/tournaments/[tournamentId]/standings/page.tsx`
- `apps/web/src/components/app/app-shell.tsx`
- `apps/web/src/components/app/bottom-navigation.tsx`
- `apps/web/src/components/app/primary-navigation.ts`
- `apps/web/src/components/fc/fc-ui.tsx`
- `apps/web/src/components/fc/premium-ui.tsx`
- `apps/web/src/components/fc/secondary-feature-page.tsx`
- `docs/UI-PREMIUM-REDESIGN.md`

The repository's pre-existing line-ending changes, generated Prisma output,
`docs/UI-RELEASE-GATE.md`, `build11-error.txt` and malformed filename are not
part of this inventory and must remain unstaged.

### M. Test/build results

- Web TypeScript: passed.
- Web production build: passed; 62 routes generated.
- Web ESLint: 0 errors, 158 existing warnings.
- API lint: 0 errors, 4 existing warnings.
- API Vitest: 152 tests across 26 files passed.
- Node regression suite: 22 tests passed.
- Premium populated fixture suite: 504 core route/viewport/theme checks passed
  across 360, 390, 412, 430, 768, 1024 and 1440px, both themes, both modes,
  plus Android-UA coverage; contrast findings were empty.
- Phase 5: 504 core checks and 84 broad routes at 390/1440 passed, with zero
  unnamed audited fields, duplicate IDs, route errors or unexpected mutations.
- Phase 1: 3 widths passed; Phase 2: 4 widths passed; Phase 3: 5 widths
  passed; Phase 4: 15 profiles passed.
- General UI smoke: 91 route/viewport checks passed.
- Android-UA smoke: 60 page/viewport checks across six profiles passed after
  updating the old selector and navigation assumptions for the premium rail.
- Premium-specific keyboard rail, contrast, real podium values, verified
  public result, and Awards OWNER/ADMIN/PLAYER checks passed.
- Before/after captures at 390px and 1440px were recreated from the exact
  `bdb028e` baseline and the redesign build, then reviewed for Dashboard,
  Awards, Match Center, League War, Fixtures, Admin Analytics, Tournament and
  public Tournament hierarchy.

All browser checks used local production output and intercepted fixture APIs.
No production accounts, writes, deploys, merges or pushes were used.

### N. Remaining visual weaknesses and manual checks

- Secondary utility/admin routes still largely use the completed Phase 1–5
  consistency layer rather than the flagship premium composition.
- Real populated privileged staging workflows and physical Android WebView,
  TalkBack, keyboard, safe-area, share-sheet, lifecycle and browser-toolbar zoom
  checks remain manual validation.
- The numeric quality scores above are subjective implementation estimates, not
  user research or WCAG certification.

### Shutdown recovery note

Recovery confirmed the branch at `bdb028e`, an empty index, 458 broad modified
tracked files dominated by preserved line-ending work, and 22 pre-existing/new
untracked entries before the final premium test harness was added. Premium
source files were complete and typechecked; no partial write or corruption was
found. The final redesign checkpoint is intentionally local only.
