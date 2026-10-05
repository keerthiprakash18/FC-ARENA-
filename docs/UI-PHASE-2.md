# FC Arena UI/UX — Phase 2

## Scope

Phase 2 consolidates the remaining web presentation around the Phase 1 design
tokens. The application canvas remains warm cream, the product shell remains
deep navy, body copy uses muted navy, and gold, emerald, amber and red retain
their semantic roles. Functional behavior, API contracts, data, permissions,
competition rules, scoring, result verification, Android native code and
production infrastructure were not changed.

## Visual consolidation

- Added `FcContextNav`, a shared horizontally scrollable contextual navigation
  treatment for Admin, Career, League, Tournament and Fixture Generator flows.
  Active, completed, disabled, hover and focus states now use the shared
  surface, border and semantic tokens.
- Standardized `BackHeader` and Fixture Generator headings around the same type,
  muted text and link treatments used by the authenticated shell.
- Extended the Phase 1 compatibility layer for route-level legacy dark, cyan,
  sky, rose, blue, white and slate utilities. Legacy markup now resolves to
  shared panel, canvas, border, primary, success, warning and danger values.
- Reduced excessive visual weight from legacy `font-black`, tiny uppercase
  labels, oversized tracking and nested bordered panels without changing copy
  or route behavior.
- Added shared spacing, panel shadow, tab radius and responsive overflow rules.
  Nested panels use a quieter secondary surface and do not stack full card
  elevation.
- Moved the public Tournament page onto the FC Arena canvas, header, brand mark,
  panel, button, table and status palette while retaining its public read-only
  information architecture.
- Consolidated League War into the FC Arena system. Its rivalry identity is
  retained through a navy/gold competition hero and semantic status colors
  rather than a separate rose/dark skin.

## Change inventory

Phase 2 files intentionally changed:

- `apps/web/src/app/design-tokens.css`
- `apps/web/src/app/modernization.css`
- `apps/web/src/app/league-war/page.tsx`
- `apps/web/src/app/league-war/[warId]/page.tsx`
- `apps/web/src/app/public/tournaments/[code]/page.tsx`
- `apps/web/src/components/fc/fc-context-nav.tsx`
- `apps/web/src/components/fc/fc-ui.tsx`
- `apps/web/src/components/app/back-header.tsx`
- `apps/web/src/components/admin/admin-navigation.tsx`
- `apps/web/src/components/career/career-navigation.tsx`
- `apps/web/src/components/leagues/league-navigation.tsx`
- `apps/web/src/components/tournaments/tournament-navigation.tsx`
- `apps/web/src/components/tournaments/tournament-wizard-shell.tsx`
- `apps/web/src/components/fixtures/fixture-generator-shell.tsx`
- `apps/android/tests/phase2-ui.mjs`
- `docs/UI-PHASE-2.md`

The repository already contained widespread tracked line-ending changes and
uncommitted generated/API work at the Phase 1 checkpoint. Those files were
preserved and were not included in the Phase 2 change inventory.

## Validation

- Web TypeScript: **passed** with `tsc --project apps/web/tsconfig.json --noEmit --incremental false`.
- Web production build: **passed**, including TypeScript and 62 generated routes.
- Web ESLint: **0 errors, 160 warnings** using the JSON formatter. The existing
  stylish formatter remains incompatible with the installed chalk version.
- API lint: **0 errors, 7 existing warnings**.
- API Vitest suite: **152 tests passed across 26 test files**.
- Existing Node regression suite: **22 tests passed**.
- `apps/android/tests/ui-smoke.mjs`: **91 route/viewport checks passed** at
  360, 375, 390, 412, 430, 768 and 1440px.
- `apps/android/tests/smoke.mjs`: **48 Android-user-agent checks passed** at
  360, 375, 390, 412, 430 and 768px, including touch scroll and navigation
  continuity.
- `apps/android/tests/phase1-ui.mjs`: **passed** at 360, 390 and 1440px.
- `apps/android/tests/phase2-ui.mjs`: **passed** at 360, 390, 768 and 1440px,
  covering shared Career navigation, public Tournament branding, token values
  and horizontal overflow.
- All browser checks used mocked API responses and the local production web
  server. No production accounts, data or writes were used.

## Remaining issues

- Physical Android WebView/TalkBack, soft-keyboard, safe-area and lifecycle
  checks remain device-only validation, as documented in Phase 1.
- The optional API production build was attempted. Prisma generation completed,
  but the existing Nest CLI toolchain stopped in `cli-table3` with
  `TypeError: stringWidth is not a function`; no API source was changed to work
  around that environment dependency issue. Web production build and all
  required Phase 2 validation suites passed.
- Existing lint warnings remain in unrelated legacy routes and generated/API
  code.

## Phase 3 readiness

Phase 2 is safe for Phase 3 from the UI scope: the shared visual system,
contextual navigation, public Tournament presentation, League War presentation,
Admin styling and responsive checks are consolidated without changing product
logic. Resolve the existing API build-toolchain dependency issue and complete
physical Android accessibility/lifecycle checks before production release.
