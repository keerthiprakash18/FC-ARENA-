# Discover and Settings — design and behavior evidence

Development base: `ec3b26e72eac57ed66f46aac5d733f75c6a9cff0` (PR #228).
This record does not establish complete product acceptance or production readiness.

## Skills, references and constraints checked before implementation

- Read repository and web `AGENTS.md`, FC ARENA Elite UI/UX Designer,
  Full-Stack Engineer, Design System Engineer and Mobile Experience Architect skills.
- Read the installed Refero Design skill and its `references/craft-details.md`.
- An actual Refero `refero_search_styles` request returned `NO_SUBSCRIPTION`.
  No reference image or style was retrieved; no live Refero research is claimed.
- Read the installed **Next.js 16.4.6** Server and Client Components, Linking and
  Navigating, and CSS guides from an existing local worktree with that exact version.
- Primary design target: existing Obsidian Matchday components and the reviewed
  fixture screenshot baseline in `next-visual-baseline.md`. Preserve Geist, navy/gold,
  all twelve club palettes, both display modes and the existing navigation shell.

| Decision | Evidence or rule | Application |
|---|---|---|
| Search responses must belong to the current query and filter | Existing Discover effect only cleared its debounce timer, allowing an older request to settle after a newer request | Abort the old request and guard success, failure and finalization; clear results when the query/filter changes |
| Recovery must stay on the current task | Existing search and featured loading shared a single error with no retry | Separate search/featured errors and attempts; retry the failed request without navigating away |
| Failed data is unknown, not empty | Existing featured failure fell through to “No active competitions” | Suppress the no-data listing until a successful featured response exists |
| Input focus and feedback must be perceivable | Refero craft: focus-within for compound controls; native input semantics; mobile targets | Search landmark and searchbox, visible compound focus, busy result region, live result heading and 44px filters/clear action |
| Settings should group related choices | Existing Settings had seven equal rows in one undifferentiated panel | Group experience, account/privacy and account data; keep each original destination and permission boundary |
| Account identity should explain whose preferences are edited | Existing verified current-user projection | Show the existing player name/code and link to the existing profile editor; no new personal data request |
| Restrained operational surfaces | Existing visual baseline and theme semantic roles | Reuse FcPanel/FcMenuRow; local CSS for responsive grouping; no palette changes, gradients, dependency or global override |

## Acceptance and verification

- Preserve all original Settings destinations and private date-of-birth behavior.
- Search debounce remains 280ms, existing API query shape and result privacy remain.
- Slow older success, slow older failure, changing filter, clearing a pending query,
  genuine empty results, retry and featured recovery need isolated browser evidence.
- Check 320/390/1280 widths, both modes, long player names, keyboard focus and no
  horizontal page overflow using synthetic fixtures only.
- TypeScript syntax transpilation passed for both changed route files. Full lint,
  build, browser results and screenshots are recorded by the integrated verification;
  syntax transpilation alone is not type checking or rendered acceptance.
- Android physical-device behavior, authenticated production flows, fresh recovery
  and deployment are separate gates and are not proven by these source changes.

### Observed verification on 26 November 2026

- Focused ESLint for both changed routes and TypeScript syntax transpilation passed.
  The final build and CI remain separate gates.
- QA's `apps/android/tests/discover-search-regression.mjs` passed twelve synthetic
  browser scenarios against the local production preview: out-of-order responses,
  superseded failures, filter changes, clearing pending requests, search retry,
  independent featured failure/recovery, and all original Settings destinations
  without horizontal overflow at 320/390/1280 in both modes. No fixture mutations.
- Visually inspected actual 1280px light and 320px dark Settings screenshots and
  390px dark Discover loading/error screenshots. This found a redundant added
  search focus outline and a pale account label on white. Removed the redundant
  wrapper outline while preserving existing focus treatment; changed the account
  label to the existing muted semantic text role. Inspected the final rebuilt
  Settings and Discover search screenshots to verify those refinements.
- Captured 24 matched before/after images from two separate local production
  previews: pristine `ec3b26e7` on port 3108 and the changed build on port 3109.
  Matrix: Settings, Discover featured, Discover search × 390/1280 × light/dark ×
  before/after. Settings also uses an intentionally long synthetic player name.
  Both sides passed the harness checks for horizontal overflow and idle motion;
  no unexpected API requests, fixture mutations or page errors were recorded.
- Local evidence lives under the original workspace's
  `.tmp-release/evidence/next-completion-20261126/screenshots/` and is not part of
  the runtime bundle. `discover-settings-evidence.json` records the complete image
  inventory and source baseline. Representative pairs:
  `before-settings-1280-light.png` / `after-settings-1280-light.png`,
  `before-settings-390-light.png` / `after-settings-390-light.png`,
  `before-discover-search-390-dark.png` / `after-discover-search-390-dark.png`.
- Also captured and inspected matched Arena Talk screenshots for the integration:
  `before-arena-390-dark.png` / `after-arena-390-dark.png` and desktop light.
  In the same synthetic 390px fixture, the first post starts at 1100.80px before
  and 651.88px after. At 1280px it moves from 1058.81px to 613.98px. These are
  observed document-position measurements, not a general performance claim.
  `arena-evidence.json` records all eight Arena screenshots and measurements.
- Initial dev previews failed before hydration (baseline HTTP 500 and CSP/HMR
  diagnostics). Those failed attempts were replaced with production-preview
  captures and are not used as accepted visual evidence.
- These results do not establish physical-device behavior, authenticated live user
  journeys, complete accessibility acceptance or production readiness.
