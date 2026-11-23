# FC ARENA — Obsidian Matchday V13 review and safety dossier

**Prepared:** 23 November 2026. **Source baseline:** `main`
`5e092abf57ccbfa42c625604763cd162dfd2b06d`. **Deployment status: NOT DEPLOYED.**

## User intent and invariant

Deliver a more distinctive, calm premium UI across FC ARENA's signed-in
experience. Do not modify any business rules, results, fixtures, tournaments,
registrations, live stage/qualification logic, leaderboards, ratings, awards,
Ballon d'Or, player stats, permissions, uploads, database, API or Android
signing. This is explicitly a **visual** development request. Deployment is a
separate owner-approved action after all release gates are proven.

## Phase 1 — Design foundation: implemented as reviewable source

- Canonical brand roles in `apps/web/src/app/obsidian-matchday.css`: Navy,
  Porcelain canvas, Gold fill vs readable Gold text, neutral panels, semantic
  success/danger, controlled radii, spacing, buttons, input and focus states.
- Uses the existing bundled Geist and existing shared `FcPanel`,
  `FcPageHeader`, `FcStatCard`, button, status and navigation components.
- Default `luxury-gold` theme has coordinated light and dark surface roles.
  All existing club palettes and preferences retain their own mappings;
  there is **no** API field, schema or storage migration.
- Layer is appended once after the unchanged V12 sections **inside** the
  single imported `arena-consolidated.css`. Rollback during review is removal
  of its dedicated V13 block, plus the V13-only Cup Center append; retain
  the source file as an auditable reference.
- The 13 V12 consolidated source sections remain intact and the V13 source
  is appended as a fourteenth section. CSS duplication
  clean-up is deferred until visual parity is verified, not performed blindly.

## Phase 2 — Product surfaces: source-level coverage

| Surface | Styling and layout intent | Data/behavior unchanged? |
| --- | --- | --- |
| Desktop navigation and header | Obsidian rail, understated active state and editorial headers | Yes |
| Android bottom tabs | Active, labelled 5-tab state; floating safe-area placement preserved | Yes |
| Dashboard | Quieter welcome hero, purposeful stadium, featured next match, restrained stats/actions | Yes |
| Cup Center | Neutral listing, one featured matchday-style tournament, calmer filters and cards | Yes |
| Tournament Studio | Left intact to avoid changing organizer workflows and live draws | Yes |
| Fixtures and match center | Predictable match card radii, legible scores, table-style numerics | Yes |
| Awards, Ballon d'Or, Hall of Fame | Reserved gold, dark prestige hero distinct from standard headings | Yes |
| Player profile/career | Editorial title, consistent identity and career cards | Yes |
| Leaderboards | Ranking numbers, row boundaries, quiet podium emphasis | Yes |
| Admin | Editorial heading, grouped controls/tables with quieter surfaces | Yes |
| Secondary screens | Shared headings/cards/buttons used wherever components already appear | Yes |

Scope is styling and documented choices, not a claim that every visual has
been manually approved. Route-level screenshots remain a required gate.

## Phase 3 — Test coverage introduced

1. `node --test tests/obsidian-matchday.test.mjs`: checks one-bundle source
   ordering, brand palette, static WCAG AA sample contrast, theme presence,
   primary targets, accessibility media queries and restricted Cup changes.
2. `node apps/android/tests/obsidian-matchday-regression.mjs` runs **against
   locally built Web with API stubs**: Dashboard at 360/390/430/768/1440 px,
   LIGHT/DARK, Android user-agent on small widths; all twelve saved themes
   checked at 390 px; admin headings at 390/1440 px; visual screenshots.
3. Existing Frontend CI remains intact: lint, Next production build, V12/VNext
   source regression suites, Playwright user journeys/axe checks, home,
   awards, group editor, result and Android mobile smoke. Existing E2E smoke
   covers the other key signed-in routes and asserts no horizontal overflow.
4. CI screenshots are output as the 7-day GitHub artifact
   `fcarena-ux-review-<commit_sha>`, subject to Actions passing.

**Limits:** Static contrast pairs are not a replacement for axe or real
contrast inspection in every state; automated screenshots do not equal
owner-approved visual QA; simulated Android viewport does not replace a
physical Android WebView device. Do not label all phases fully verified until
the checks and hands-on review are completed.

## Acceptance matrix before merge/release

- [ ] Frontend CI lint, build and static regression suite green.
- [ ] Obsidian source/contrast/theme contract green.
- [ ] Existing Android Playwright route/fixture screenshot and axe checks green.
- [ ] V13 mobile/theme visual script green and artifacts inspected.
- [ ] Review 360, 390, 430, 768, 1024 and 1440 widths, orientation and
      long player/club names. Existing smoke covers 412; add manual 1024.
- [ ] Verify every saved club palette in LIGHT, DARK and SYSTEM display modes.
- [ ] Keyboard/focus, 200% zoom, reduced-motion, high-contrast, safe areas.
- [ ] Authenticated role-based Admin, fixture/result submission, screenshot
      evidence, verified standings/tiebreakers, playoff rules, league join,
      Ballon d'Or, awards, profile and chat journeys are unchanged.
- [ ] Real Android WebView smoke on supported device.
- [ ] Confirm no unintended changes in API, Prisma migration, Android
      signing, production data, user files or business logic.
- [ ] Owner accepts screenshots/design direction and approves merge.
- [ ] Owner **separately** approves production release after fresh off-host
      DB + uploads recovery proof, isolated restore, exact artifact rehearsal,
      current live WEB/API identities, rollback, disk and health checks.

## Handling conflicts and rollback

PR #207 (Top-12 Duo playoff feature) is concurrent. Do not force-merge or
override its tournament behavior. Rebase the reviewed V13 CSS-only branch onto
current main **after** any other tournament change lands and rerun full CI.

The VCL host is not an appropriate development/build workspace. Use
GitHub Actions off-host immutable artifacts. This V13 branch requires no DB
migration and no production restart. Production rollback must use a verified
previous release and preserve stable media/user data per `AGENTS.md`.

## Known risk checkpoints

1. The 4,511-line frozen cascade has legacy `!important` and stadium
   selectors; the V13 layer includes explicit targeted overrides instead of
   deleting older declarations. Inspect each affected route's computed style.
2. Cup Center is module-scoped. The listing has new colors while the Studio
   retains the old dark workflow; ensure contrast and keyboard focus there.
3. A user who chooses a club-specific theme may see its original broad
   palette; this is intentional preference preservation, not an error.
4. Awards, fixtures and some legacy specialized layouts still use local
   dark-surfaces. A future consolidation should move them gradually onto
   typed surface tokens, with pixel parity evidence. Do not hide this
   remaining work or call all one-off CSS eliminated.

**Release decision today:** keep the PR reviewable, do not merge/deploy.
