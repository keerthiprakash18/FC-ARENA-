# FC Arena UI modernization v1

Branch: `ui/fc-arena-modernization-v1`, based on `342bf25`.

## Changes

- Warm cream/navy visual system with restrained gold highlights; existing saved theme and dark-mode preferences remain supported. Unset local theme preferences now start with Luxury Gold.
- Shared card, badge, stat, empty-state, input and button treatments; 44px control targets, system fonts, focus indicators and a skip link.
- Dashboard prioritizes next match, league and tournament activity ahead of career statistics and compact quick actions.
- Consistent bottom navigation and section tabs. Desktop search closes on focus leaving its container instead of installing an invisible full-screen button.
- Lightweight responsive authentication layout with associated field labels, readable helper text and no decorative animation.
- Fixture scheduling has persistent field labels and clear status badges. League creation fields have labels.
- Tournament standings use mobile lists with all existing statistics; desktop retains the detailed table.
- Confirmation dialogs have unique accessible names, focus containment, Escape dismissal and focus restoration.
- Removed 2,021 lines of redundant dashboard/shell motion CSS and replaced the animation-heavy authentication stylesheet. Crest images load lazily within fixed-size containers.

No API, database, permission, scoring, tournament progression, Android native code, signing, or production-data changes.

## Validation

- `npm run lint --workspace=apps/web`: zero errors; 118 existing warnings remain (legacy image, hook and typing warnings).
- `npm run build:web`: production compilation, TypeScript and route generation pass.
- `apps/android/tests/ui-smoke.mjs`: 77 route/viewport checks across 360, 375, 390, 412, 430, 768 and 1440px. Includes authentication label associations, populated standings, long names, overflow, idle animation, dark mode and browser history checks.
- Existing `apps/android/tests/smoke.mjs`: 48 Android-user-agent route/viewport checks across six widths, including Chromium touch scrolling and stable header/bottom navigation.
- All browser API responses are fixtures. No production credentials or mutations are used.

Run browser checks with a production web server at `127.0.0.1:3000`, Playwright installed in `apps/android/tests`, and optionally `CHROMIUM_PATH` pointing to a Chromium executable:

```sh
node apps/android/tests/ui-smoke.mjs
node apps/android/tests/smoke.mjs
```

Screenshots and JSON results are written to `/tmp/fcarena-ui` and `/tmp/fcarena-smoke` by default; override with `SMOKE_OUTPUT`.

## Remaining validation

Physical-device Android back/background/resume checks and live populated admin/result-entry workflows need staging/device validation before release. Browser tests use mock data and do not establish backend end-to-end correctness. Existing native scroll/safe-area stylesheet is unchanged. No main merge, deployment or new Android bundle is included.
